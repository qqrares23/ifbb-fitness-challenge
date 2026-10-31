//! Automatic backups: a dated copy of the whole database in a folder on the Desktop, made when the
//! app closes, every 30 minutes while it is open, and before an import. Each copy can also go to a
//! second folder, e.g. one that Google Drive for desktop uploads. Only copies leave the app's data
//! folder: a sync tool must never touch the live database, which it could corrupt mid-write.

use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

use serde::{Deserialize, Serialize};
use sqlx::sqlite::SqliteConnectOptions;
use sqlx::{ConnectOptions, Connection};
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::Mutex;

/// Made on the Desktop, and inside the cloud folder.
const FOLDER: &str = "IFBB Fitness Challenge backups";
const PREFIX: &str = "fitness-challenge-";
/// Newest copies kept per folder; older ones are deleted.
const KEEP: usize = 30;
const INTERVAL: Duration = Duration::from_secs(30 * 60);
const SETTINGS_FILE: &str = "backup-settings.json";

/// One backup at a time: the timer, closing, an import and "Back up now" can overlap. Also held
/// while an import or restore replaces the database file, so no backup opens it meanwhile.
pub(crate) static RUNNING: Mutex<()> = Mutex::const_new(());

#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
struct Settings {
    /// The folder the user picked (e.g. Google Drive's "My Drive"); copies go to FOLDER inside it.
    cloud_folder: Option<String>,
    /// The set-up guide opens by itself until it has been closed once.
    guide_seen: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupStatus {
    folder: String,
    cloud_folder: Option<String>,
    guide_seen: bool,
    /// File name of the newest backup, e.g. "fitness-challenge-2026-10-27_19-30-05.db".
    latest: Option<String>,
}

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path().app_config_dir().map(|dir| dir.join(SETTINGS_FILE)).map_err(|e| e.to_string())
}

fn load_settings(app: &AppHandle) -> Settings {
    settings_path(app)
        .ok()
        .and_then(|path| fs::read_to_string(path).ok())
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_default()
}

/// Read-modify-write of the settings file, one at a time so two changes can't undo each other.
fn update_settings(app: &AppHandle, change: impl FnOnce(&mut Settings)) -> Result<Settings, String> {
    static LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());
    let _one_at_a_time = LOCK.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    let mut settings = load_settings(app);
    change(&mut settings);
    let text = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    // Through a temporary file, so a crash mid-write can't leave half a file that reads as defaults.
    let path = settings_path(app)?;
    let partial = crate::with_suffix(&path, ".partial");
    fs::write(&partial, text)
        .and_then(|_| fs::rename(&partial, &path))
        .map_err(|e| format!("The backup settings couldn't be saved: {e}"))?;
    Ok(settings)
}

fn desktop_folder(app: &AppHandle) -> Result<PathBuf, String> {
    app.path().desktop_dir().map(|dir| dir.join(FOLDER)).map_err(|e| format!("The Desktop folder couldn't be found: {e}"))
}

/// Backup file names, oldest first. Ordered by when the file was written, not by the local time in
/// its name, which repeats an hour when the clocks go back.
fn backups_in(folder: &Path) -> Vec<String> {
    let mut names: Vec<(Option<SystemTime>, String)> = fs::read_dir(folder)
        .into_iter()
        .flatten()
        .flatten()
        .filter_map(|entry| entry.file_name().into_string().ok())
        .filter(|name| name.starts_with(PREFIX) && name.ends_with(".db"))
        .map(|name| (modified(&folder.join(&name)), name))
        .collect();
    names.sort();
    names.into_iter().map(|(_, name)| name).collect()
}

fn prune(folder: &Path) {
    let names = backups_in(folder);
    for name in &names[..names.len().saturating_sub(KEEP)] {
        let _ = fs::remove_file(folder.join(name));
    }
    // Left by a copy that failed or a crash; no copy is running now (the caller holds RUNNING).
    let partials = fs::read_dir(folder).into_iter().flatten().flatten().filter(|entry| {
        let name = entry.file_name();
        let name = name.to_string_lossy();
        name.starts_with(PREFIX) && name.ends_with(".partial")
    });
    for partial in partials {
        let _ = fs::remove_file(partial.path());
    }
}

fn modified(path: &Path) -> Option<SystemTime> {
    fs::metadata(path).and_then(|m| m.modified()).ok()
}

/// Whether the database (or its write-ahead log, where recent saves live) changed after `backup`.
fn changed_since(db: &Path, backup: Option<&Path>) -> bool {
    let Some(saved) = backup.and_then(modified) else { return true };
    // SQLite creates an empty log whenever the app opens the database; only a written one is a save.
    let wal_written = fs::metadata(crate::with_suffix(db, "-wal")).ok().filter(|m| m.len() > 0).and_then(|m| m.modified().ok());
    [modified(db), wal_written].into_iter().flatten().any(|time| time > saved)
}

/// Copies through a temporary name, so a sync tool never uploads a half-written file.
fn copy_into(file: &Path, folder: &Path) -> std::io::Result<()> {
    fs::create_dir_all(folder)?;
    let name = file.file_name().unwrap_or_default();
    let partial = crate::with_suffix(folder.join(name), ".partial");
    fs::copy(file, &partial).and_then(|_| fs::rename(&partial, folder.join(name))).inspect_err(|_| {
        let _ = fs::remove_file(&partial);
    })
}

/// Saves a copy unless `only_if_changed` and nothing changed since the newest one (so opening and
/// closing the app, or an idle evening, doesn't push older backups out), then the cloud copy.
async fn backup(app: &AppHandle, only_if_changed: bool) -> Result<(), String> {
    let _one_at_a_time = RUNNING.lock().await;
    match desktop_backup(app, only_if_changed).await? {
        Some(file) => cloud_copy(app, &file),
        None => Ok(()),
    }
}

/// The newest Desktop backup, made now unless `only_if_changed` and nothing changed since the last
/// one. None when there is no database yet. The caller holds RUNNING.
async fn desktop_backup(app: &AppHandle, only_if_changed: bool) -> Result<Option<PathBuf>, String> {
    let db = crate::database_path(app)?;
    if !db.exists() {
        return Ok(None);
    }
    let folder = desktop_folder(app)?;
    let latest = backups_in(&folder).pop().map(|name| folder.join(name));
    Ok(Some(match latest {
        Some(file) if only_if_changed && !changed_since(&db, Some(&file)) => file,
        _ => write_copy(&db, &folder).await?,
    }))
}

/// Copies `file` into the cloud folder, if one is set and the file isn't there yet, so a copy that
/// failed (e.g. while Google Drive wasn't running) is made up by the next backup.
fn cloud_copy(app: &AppHandle, file: &Path) -> Result<(), String> {
    let Some(cloud) = load_settings(app).cloud_folder else { return Ok(()) };
    let cloud = Path::new(&cloud).join(FOLDER);
    if cloud.join(file.file_name().unwrap_or_default()).exists() {
        return Ok(());
    }
    copy_into(file, &cloud).map_err(|e| format!("Backed up on the Desktop, but not copied to the Google Drive folder: {e}"))?;
    prune(&cloud);
    Ok(())
}

/// Before an import replaces the database: a dated copy of it (the cloud copy is best effort, the
/// next backup makes it up), and no other backup opens the file until the returned guard drops.
pub(crate) async fn before_import(app: &AppHandle) -> Result<tokio::sync::MutexGuard<'static, ()>, String> {
    let guard = RUNNING.lock().await;
    if let Some(file) = desktop_backup(app, false).await? {
        if let Err(error) = cloud_copy(app, &file) {
            eprintln!("{error}");
        }
    }
    Ok(guard)
}

/// Writes a dated copy of `db` into `folder` and drops the oldest copies beyond KEEP.
async fn write_copy(db: &Path, folder: &Path) -> Result<PathBuf, String> {
    fs::create_dir_all(folder).map_err(|e| format!("The backup folder couldn't be created: {e}"))?;
    let mut conn = SqliteConnectOptions::new()
        .filename(db)
        .create_if_missing(false)
        .busy_timeout(Duration::from_secs(5))
        .connect()
        .await
        .map_err(|e| format!("The database couldn't be opened for a backup: {e}"))?;
    // VACUUM INTO writes a complete, consistent copy, including what is still in the write-ahead
    // log, while the app keeps using the database. It needs a path that doesn't exist yet.
    let copy = async {
        let stamp: String = sqlx::query_scalar("SELECT strftime('%Y-%m-%d_%H-%M-%S', 'now', 'localtime')").fetch_one(&mut conn).await?;
        let name = format!("{PREFIX}{stamp}.db");
        let partial = crate::with_suffix(folder.join(&name), ".partial");
        let _ = fs::remove_file(&partial);
        let started = SystemTime::now();
        sqlx::query("VACUUM INTO ?").bind(partial.to_string_lossy().into_owned()).execute(&mut conn).await?;
        // Dated from before the copy, so a save made while it ran still counts as a change since.
        let _ = fs::File::options().write(true).open(&partial).and_then(|file| file.set_modified(started));
        Ok::<_, sqlx::Error>((name, partial))
    }
    .await;
    let _ = conn.close().await;
    let (name, partial) = copy.map_err(|e| format!("The backup couldn't be written: {e}"))?;
    let file = folder.join(&name);
    fs::rename(&partial, &file).map_err(|e| format!("The backup couldn't be saved: {e}"))?;
    prune(folder);
    Ok(file)
}

fn status(app: &AppHandle) -> Result<BackupStatus, String> {
    let folder = desktop_folder(app)?;
    let settings = load_settings(app);
    Ok(BackupStatus {
        latest: backups_in(&folder).pop(),
        folder: folder.to_string_lossy().into_owned(),
        cloud_folder: settings.cloud_folder.map(|f| Path::new(&f).join(FOLDER).to_string_lossy().into_owned()),
        guide_seen: settings.guide_seen,
    })
}

#[tauri::command]
pub fn backup_status(app: AppHandle) -> Result<BackupStatus, String> {
    status(&app)
}

#[tauri::command]
pub async fn backup_now(app: AppHandle) -> Result<BackupStatus, String> {
    backup(&app, false).await?;
    status(&app)
}

/// Sets (or with None, stops) the second folder, then backs up so it gets a copy straight away.
#[tauri::command]
pub async fn set_cloud_backup_folder(app: AppHandle, folder: Option<String>) -> Result<BackupStatus, String> {
    if let Some(dir) = &folder {
        if !Path::new(dir).is_dir() {
            return Err("That folder doesn't exist.".into());
        }
    }
    // Picking the backups folder itself (shown in the dialog) means its parent, not a folder inside it.
    let folder = folder.map(|dir| match Path::new(&dir) {
        path if path.file_name().is_some_and(|name| name == FOLDER) => path.parent().map_or(dir.clone(), |p| p.to_string_lossy().into_owned()),
        _ => dir,
    });
    let settings = update_settings(&app, |settings| settings.cloud_folder = folder)?;
    if settings.cloud_folder.is_some() {
        backup(&app, false).await?;
    }
    status(&app)
}

#[tauri::command]
pub fn mark_backup_guide_seen(app: AppHandle) -> Result<(), String> {
    update_settings(&app, |settings| settings.guide_seen = true).map(|_| ())
}

/// Backs up every INTERVAL while the app is open; a failure is shown in the app ("backup-failed").
pub fn start_timer(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(INTERVAL).await;
            if let Err(error) = backup(&app, true).await {
                let _ = app.emit("backup-failed", error);
            }
        }
    });
}

/// The backup made as the app quits (its window is already gone, so a failure can only be logged).
pub fn on_exit(app: &AppHandle) {
    if let Err(error) = tauri::async_runtime::block_on(backup(app, true)) {
        eprintln!("Backup on close failed: {error}");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_folder(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("ifbb-backup-test-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn prune_keeps_the_newest_backups_and_nothing_else_is_touched() {
        let dir = temp_folder("prune");
        for day in 1..=(KEEP + 5) {
            fs::write(dir.join(format!("{PREFIX}2026-10-{day:02}_12-00-00.db")), "x").unwrap();
        }
        fs::write(dir.join("notes.txt"), "mine").unwrap();
        fs::write(dir.join(format!("{PREFIX}2026-10-01_12-00-00.db.partial")), "half").unwrap();
        prune(&dir);
        let left = backups_in(&dir);
        assert_eq!(left.len(), KEEP);
        assert_eq!(left.first().unwrap(), &format!("{PREFIX}2026-10-06_12-00-00.db"));
        assert!(dir.join("notes.txt").exists());
        assert!(!dir.join(format!("{PREFIX}2026-10-01_12-00-00.db.partial")).exists());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn changed_since_compares_the_database_with_the_newest_backup() {
        let dir = temp_folder("changed");
        let db = dir.join("fitness-challenge.db");
        fs::write(&db, "db").unwrap();
        assert!(changed_since(&db, None), "no backup yet");
        std::thread::sleep(Duration::from_millis(50));
        let backup = dir.join("backup.db");
        fs::write(&backup, "copy").unwrap();
        assert!(!changed_since(&db, Some(&backup)));
        std::thread::sleep(Duration::from_millis(50));
        fs::write(dir.join("fitness-challenge.db-wal"), "").unwrap();
        assert!(!changed_since(&db, Some(&backup)), "opening the app creates an empty log, not a save");
        fs::write(dir.join("fitness-challenge.db-wal"), "new save").unwrap();
        assert!(changed_since(&db, Some(&backup)), "a save in the write-ahead log counts");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn write_copy_includes_saves_still_in_the_write_ahead_log() {
        let dir = temp_folder("copy");
        let db = dir.join("fitness-challenge.db");
        let folder = dir.join(FOLDER);
        tauri::async_runtime::block_on(async {
            // Kept open while copying, like the app's own connection, so the row is only in the WAL.
            let mut app_conn = SqliteConnectOptions::new()
                .filename(&db)
                .create_if_missing(true)
                .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
                .connect()
                .await
                .unwrap();
            sqlx::query("CREATE TABLE athletes (name TEXT); INSERT INTO athletes VALUES ('Ana')").execute(&mut app_conn).await.unwrap();

            let file = write_copy(&db, &folder).await.unwrap();
            assert!(file.file_name().unwrap().to_string_lossy().starts_with(PREFIX));
            assert!(!backups_in(&folder).iter().any(|n| n.ends_with(".partial")));

            let mut copy = SqliteConnectOptions::new().filename(&file).connect().await.unwrap();
            let name: String = sqlx::query_scalar("SELECT name FROM athletes").fetch_one(&mut copy).await.unwrap();
            assert_eq!(name, "Ana");
            let _ = copy.close().await;
            let _ = app_conn.close().await;
        });
        let _ = fs::remove_dir_all(&dir);
    }
}
