use std::ffi::OsString;
use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager};
use tauri_plugin_sql::{Migration, MigrationKind};

mod backup;
mod judge_server;

/// Must match `DATABASE_URL` in `src/db/client.ts`.
pub(crate) const DATABASE_URL: &str = "sqlite:fitness-challenge.db";

/// The database as it was just before an import, so an import that won't open can be undone. Removed
/// once the imported database has opened: from then on, restoring it would throw away newer work.
const BACKUP_FILE: &str = "fitness-challenge.before-import.db";

/// The database a restore replaced, in case that wasn't what was wanted.
const BEFORE_RESTORE_FILE: &str = "fitness-challenge.before-restore.db";

fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "init",
            sql: include_str!("../migrations/0001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "lifecycle_rules",
            sql: include_str!("../migrations/0002_lifecycle_rules.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "speed_fit",
            sql: include_str!("../migrations/0003_speed_fit.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "category_library",
            sql: include_str!("../migrations/0004_category_library.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "late_entries",
            sql: include_str!("../migrations/0005_late_entries.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "category_hierarchy",
            sql: include_str!("../migrations/0006_category_hierarchy.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "multiple_levels",
            sql: include_str!("../migrations/0007_multiple_levels.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 8,
            description: "unique_subgroups",
            sql: include_str!("../migrations/0008_unique_subgroups.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 9,
            description: "category_libraries",
            sql: include_str!("../migrations/0009_category_libraries.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 10,
            description: "station_sets",
            sql: include_str!("../migrations/0010_station_sets.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 11,
            description: "clubs_and_photos",
            sql: include_str!("../migrations/0011_clubs_and_photos.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 12,
            description: "category_multiple_sets",
            sql: include_str!("../migrations/0012_category_multiple_sets.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 13,
            description: "teams_and_restart",
            sql: include_str!("../migrations/0013_teams_and_restart.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 14,
            description: "rename_competitions",
            sql: include_str!("../migrations/0014_rename_competitions.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 15,
            description: "end_date",
            sql: include_str!("../migrations/0015_end_date.sql"),
            kind: MigrationKind::Up,
        },
    ]
}

/// Where tauri-plugin-sql keeps the database: the app config dir (see its `path_mapper`).
pub(crate) fn database_path(app: &AppHandle) -> Result<PathBuf, String> {
    let file = DATABASE_URL.trim_start_matches("sqlite:");
    app.path().app_config_dir().map(|dir| dir.join(file)).map_err(|e| e.to_string())
}

/// `path` with `suffix` added to its file name, e.g. the database's "-wal" log or a ".partial" copy.
pub(crate) fn with_suffix(path: impl AsRef<Path>, suffix: &str) -> PathBuf {
    let mut name = OsString::from(path.as_ref().as_os_str());
    name.push(suffix);
    PathBuf::from(name)
}

/// SQLite's write-ahead log files; stale ones must not be paired with a replaced database file.
fn remove_journal(db: &Path) {
    for suffix in ["-wal", "-shm"] {
        let _ = fs::remove_file(with_suffix(db, suffix));
    }
}

/// Moves a database file with its write-ahead log, where its latest saves may still be. The file goes
/// first: if something still has it open, that fails on Windows and nothing has moved.
fn move_database(from: &Path, to: &Path) -> std::io::Result<()> {
    remove_journal(to);
    fs::rename(from, to)?;
    for suffix in ["-wal", "-shm"] {
        let _ = fs::rename(with_suffix(from, suffix), with_suffix(to, suffix));
    }
    Ok(())
}

/// Where an export is written before it replaces `destination` (SQLite's `VACUUM INTO` needs a
/// path that doesn't exist yet, and a failed export must not leave a half-written file behind).
fn partial_export_path(destination: &str) -> PathBuf {
    with_suffix(destination, ".partial")
}

/// Step 1 of an export: clears a stale partial file and returns the path the app runs
/// `VACUUM INTO` on (a complete, consistent copy, whatever is still in the write-ahead log).
#[tauri::command]
fn prepare_export(destination: String) -> Result<String, String> {
    let partial = partial_export_path(&destination);
    if partial.exists() {
        fs::remove_file(&partial).map_err(|e| format!("A leftover export file couldn't be cleared: {e}"))?;
    }
    partial.into_os_string().into_string().map_err(|_| "That file name can't be used.".into())
}

/// Step 2 of an export: moves the finished copy to `destination`, replacing an older file there.
#[tauri::command]
fn finish_export(destination: String) -> Result<(), String> {
    let partial = partial_export_path(&destination);
    // rename replaces an existing file atomically (same folder), so a failed save keeps the old one.
    fs::rename(&partial, &destination).map_err(|e| format!("The database couldn't be saved there: {e}"))
}

/// Replaces the database with `source`, after a dated backup of the current one. The app closes its
/// connection before calling this and reloads afterwards, which runs any pending migrations.
#[tauri::command]
async fn import_database(app: AppHandle, source: String) -> Result<(), String> {
    let mut header = [0u8; 16];
    File::open(&source)
        .and_then(|mut file| file.read_exact(&mut header))
        .map_err(|e| format!("That file can't be read: {e}"))?;
    if &header != b"SQLite format 3\0" {
        return Err("That file isn't a database exported from this app.".into());
    }
    let _backup_lock = backup::before_import(&app)
        .await
        .map_err(|e| format!("The current data couldn't be backed up, so nothing was imported: {e}"))?;
    let db = database_path(&app)?;
    // Copied aside first, so a failed copy (e.g. a full disk) leaves the current database untouched.
    let incoming = with_suffix(&db, ".partial");
    fs::copy(&source, &incoming).map_err(|e| {
        let _ = fs::remove_file(&incoming);
        format!("The database couldn't be imported: {e}")
    })?;
    // Its connections are the last ones open: closing them folds the write-ahead log into the file.
    judge_server::stop(&app).await;
    // Always the database from just before this import. It opened (importing is only offered once
    // it has), so it is what a "won't open" import must go back to.
    let replaced = if db.exists() {
        fs::copy(&db, db.with_file_name(BACKUP_FILE)).map(|_| ()).map_err(|e| format!("The current database couldn't be backed up, so nothing was imported: {e}"))
    } else {
        Ok(())
    }
    .and_then(|_| {
        remove_journal(&db);
        fs::rename(&incoming, &db).map_err(|e| format!("The database couldn't be imported: {e}"))
    });
    if replaced.is_err() {
        let _ = fs::remove_file(&incoming);
    }
    replaced
}

#[tauri::command]
fn has_database_backup(app: AppHandle) -> Result<bool, String> {
    Ok(database_path(&app)?.with_file_name(BACKUP_FILE).exists())
}

/// The database has opened, so the import (if there was one) worked and there is nothing to undo.
/// The dated copy made before it stays in the backups folder.
#[tauri::command]
fn discard_database_backup(app: AppHandle) -> Result<(), String> {
    let _ = fs::remove_file(database_path(&app)?.with_file_name(BACKUP_FILE));
    Ok(())
}

/// Puts back the database from before the last import (e.g. when the imported one won't open).
#[tauri::command]
async fn restore_database_backup(app: AppHandle) -> Result<(), String> {
    let _no_backup_meanwhile = backup::RUNNING.lock().await;
    judge_server::stop(&app).await;
    let db = database_path(&app)?;
    restore_files(&db, &db.with_file_name(BACKUP_FILE))
}

/// Sets the current database aside and moves `backup` in; on failure the current one goes back.
/// Moved, not copied: once restored, this old copy must not be offered again.
fn restore_files(db: &Path, backup: &Path) -> Result<(), String> {
    if !backup.exists() {
        return Err("There is no backup to restore.".into());
    }
    let aside = db.with_file_name(BEFORE_RESTORE_FILE);
    let had_database = db.exists();
    if had_database {
        move_database(db, &aside).map_err(|e| format!("The backup couldn't be restored: {e}"))?;
    }
    remove_journal(db);
    fs::rename(backup, db).map_err(|e| {
        if had_database {
            let _ = move_database(&aside, db);
        }
        format!("The backup couldn't be restored: {e}")
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::new()
                .add_migrations(DATABASE_URL, migrations())
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(judge_server::JudgeServer::default())
        .setup(|app| {
            backup::start_timer(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            prepare_export,
            finish_export,
            import_database,
            has_database_backup,
            discard_database_backup,
            restore_database_backup,
            backup::backup_status,
            backup::backup_now,
            backup::set_cloud_backup_folder,
            backup::mark_backup_guide_seen,
            judge_server::start_judge_server,
            judge_server::stop_judge_server,
            judge_server::judge_server_status
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                backup::on_exit(app);
            }
        });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn restore_keeps_the_replaced_database_with_its_log() {
        let dir = std::env::temp_dir().join(format!("ifbb-restore-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let db = dir.join("fitness-challenge.db");
        let backup = dir.join(BACKUP_FILE);
        let aside = dir.join(BEFORE_RESTORE_FILE);

        assert!(restore_files(&db, &backup).is_err(), "nothing to restore");

        fs::write(&db, "current").unwrap();
        fs::write(with_suffix(&db, "-wal"), "latest saves").unwrap();
        fs::write(&backup, "old").unwrap();
        restore_files(&db, &backup).unwrap();

        assert_eq!(fs::read_to_string(&db).unwrap(), "old");
        assert!(!with_suffix(&db, "-wal").exists(), "the old log must not pair with the restored file");
        assert!(!backup.exists());
        assert_eq!(fs::read_to_string(&aside).unwrap(), "current");
        assert_eq!(fs::read_to_string(with_suffix(&aside, "-wal")).unwrap(), "latest saves");
        let _ = fs::remove_dir_all(&dir);
    }
}
