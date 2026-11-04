//! A small HTTP server that lets judges on the local network record results from a phone browser.
//!
//! It serves one self-contained mobile page (`judge/index.html`) plus a JSON API, and reads/writes
//! the same SQLite file the app uses through its own `sqlx` pool. SQLite's WAL mode lets this pool
//! coexist with tauri-plugin-sql's. The database's own triggers and CHECKs stay the source of
//! truth (results only while `running`, kind-isolation, value ranges), so this server does not
//! re-validate — a rejected write surfaces as HTTP 400 with the database's message.

use std::collections::HashMap;
use std::hash::{BuildHasher, RandomState};
use std::net::{IpAddr, SocketAddr, UdpSocket};
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use axum::extract::{ConnectInfo, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{Html, IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteRow};
use sqlx::{Row, SqlitePool};
use tauri::{AppHandle, Manager};
use tokio::sync::oneshot;

/// The judging page and API listen here on every network interface.
const PORT: u16 = 8080;

/// Different wrong codes one device may try before it has to wait.
const MAX_WRONG_CODES: u32 = 10;
const LOCKOUT: Duration = Duration::from_secs(60);

/// Managed Tauri state: the running server, if any.
#[derive(Default)]
pub struct JudgeServer(pub Mutex<Option<Running>>);

pub struct Running {
    code: String,
    url: String,
    other_urls: Vec<String>,
    pool: SqlitePool,
    shutdown: oneshot::Sender<()>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JudgeServerStatus {
    running: bool,
    url: Option<String>,
    /// This computer's other network addresses, for when `url` isn't reachable (e.g. a VPN is on).
    other_urls: Vec<String>,
    code: Option<String>,
}

impl JudgeServerStatus {
    fn stopped() -> Self {
        Self { running: false, url: None, other_urls: Vec::new(), code: None }
    }
    fn of(r: &Running) -> Self {
        Self { running: true, url: Some(r.url.clone()), other_urls: r.other_urls.clone(), code: Some(r.code.clone()) }
    }
}

/// Wrong codes from one device. A phone still polling with an old code repeats the same one, so
/// only a different code counts: that phone doesn't lock itself out of typing the new one.
#[derive(Default)]
struct WrongCodes {
    count: u32,
    last: String,
    locked_until: Option<Instant>,
}

/// Shared with every request handler. `SqlitePool` is cheap to clone (an `Arc` inside).
#[derive(Clone)]
struct ApiState {
    pool: SqlitePool,
    code: String,
    wrong_codes: Arc<Mutex<HashMap<IpAddr, WrongCodes>>>,
}

#[tauri::command]
pub async fn start_judge_server(app: AppHandle) -> Result<JudgeServerStatus, String> {
    if let Some(r) = app.state::<JudgeServer>().0.lock().unwrap().as_ref() {
        return Ok(JudgeServerStatus::of(r)); // already hosting
    }

    let pool = open_pool(&crate::database_path(&app)?).await?;
    let code = generate_code();
    let interfaces = local_ip_address::list_afinet_netifas().unwrap_or_default().into_iter().map(|(_, ip)| ip);
    let mut urls = lan_ips(routed_ip(), interfaces).into_iter().map(|ip| format!("http://{ip}:{PORT}"));
    let url = urls.next().ok_or("Couldn't find this computer's network address.")?;
    let other_urls: Vec<String> = urls.collect();

    let router = Router::new()
        .route("/", get(index))
        .route("/api/state", get(get_state))
        .route("/api/score", post(post_score))
        .route("/api/time", post(post_time))
        .with_state(ApiState { pool: pool.clone(), code: code.clone(), wrong_codes: Arc::default() });

    let listener = tokio::net::TcpListener::bind(("0.0.0.0", PORT))
        .await
        .map_err(|e| format!("Couldn't start hosting on port {PORT}: {e}"))?;
    let (shutdown, rx) = oneshot::channel::<()>();
    tauri::async_runtime::spawn(async move {
        let _ = axum::serve(listener, router.into_make_service_with_connect_info::<SocketAddr>())
            .with_graceful_shutdown(async {
                let _ = rx.await;
            })
            .await;
    });

    let running = Running { code, url, other_urls, pool, shutdown };
    let status = JudgeServerStatus::of(&running);
    *app.state::<JudgeServer>().0.lock().unwrap() = Some(running);
    Ok(status)
}

#[tauri::command]
pub async fn stop_judge_server(app: AppHandle) -> JudgeServerStatus {
    stop(&app).await;
    JudgeServerStatus::stopped()
}

/// Stops hosting and closes the server's connections, so the database file can be replaced next.
pub(crate) async fn stop(app: &AppHandle) {
    let running = app.state::<JudgeServer>().0.lock().unwrap().take();
    if let Some(running) = running {
        let _ = running.shutdown.send(()); // best effort; the task stops on the next poll
        running.pool.close().await;
    }
}

#[tauri::command]
pub fn judge_server_status(app: AppHandle) -> JudgeServerStatus {
    match app.state::<JudgeServer>().0.lock().unwrap().as_ref() {
        Some(r) => JudgeServerStatus::of(r),
        None => JudgeServerStatus::stopped(),
    }
}

async fn open_pool(db_path: &Path) -> Result<SqlitePool, String> {
    let options = SqliteConnectOptions::new()
        .filename(db_path)
        .create_if_missing(false)
        .journal_mode(SqliteJournalMode::Wal)
        .busy_timeout(Duration::from_secs(5));
    SqlitePoolOptions::new()
        .max_connections(4)
        .connect_with(options)
        .await
        .map_err(|e| format!("Couldn't open the competition database: {e}"))
}

/// A 6-digit gate shown to the organiser and typed by judges. Not cryptographic — just keeps
/// casual devices on the same Wi-Fi from editing results.
fn generate_code() -> String {
    // RandomState is keyed from the OS's random source. (A clock's low digits aren't random:
    // Windows ticks every 100 ns, so every code would end in 00.)
    format!("{:06}", RandomState::new().hash_one(()) % 1_000_000)
}

/// The address of the interface that would reach the internet (no packet is actually sent). None
/// on a network with no gateway, e.g. a router that isn't connected to anything.
fn routed_ip() -> Option<IpAddr> {
    let socket = UdpSocket::bind("0.0.0.0:0").ok()?;
    socket.connect("8.8.8.8:80").ok()?;
    socket.local_addr().ok().map(|addr| addr.ip())
}

/// The addresses to offer judges: the routed one first, then every other private IPv4 one.
fn lan_ips(routed: Option<IpAddr>, interfaces: impl IntoIterator<Item = IpAddr>) -> Vec<IpAddr> {
    let mut ips: Vec<IpAddr> = routed.into_iter().collect();
    for ip in interfaces {
        if matches!(ip, IpAddr::V4(v4) if v4.is_private()) && !ips.contains(&ip) {
            ips.push(ip);
        }
    }
    ips
}

/// Lets a request through if it has the code. Each device gets MAX_WRONG_CODES tries, then waits
/// out LOCKOUT, so nobody on the Wi-Fi can simply try all the codes.
fn check_code(wrong_codes: &Mutex<HashMap<IpAddr, WrongCodes>>, ip: IpAddr, sent: Option<&str>, code: &str, now: Instant) -> Result<(), StatusCode> {
    let mut wrong_codes = wrong_codes.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    let wrong = wrong_codes.entry(ip).or_default();
    match wrong.locked_until {
        Some(until) if until > now => return Err(StatusCode::TOO_MANY_REQUESTS),
        Some(_) => *wrong = WrongCodes::default(),
        None => {}
    }
    match sent {
        Some(sent) if sent == code => {
            wrong_codes.remove(&ip);
            Ok(())
        }
        Some(sent) if !sent.is_empty() && sent != wrong.last => {
            wrong.count += 1;
            wrong.last = sent.to_owned();
            if wrong.count >= MAX_WRONG_CODES {
                wrong.locked_until = Some(now + LOCKOUT);
            }
            Err(StatusCode::UNAUTHORIZED)
        }
        _ => Err(StatusCode::UNAUTHORIZED),
    }
}

impl ApiState {
    fn authorize(&self, from: SocketAddr, headers: &HeaderMap) -> Result<(), StatusCode> {
        let sent = headers.get("x-judge-code").and_then(|v| v.to_str().ok());
        check_code(&self.wrong_codes, from.ip(), sent, &self.code, Instant::now())
    }
}

/// Turns a database error (including a trigger's `RAISE` message) into a user-facing string.
fn db_error(error: sqlx::Error) -> String {
    match &error {
        sqlx::Error::Database(e) => e.message().to_string(),
        _ => error.to_string(),
    }
}

async fn index() -> Html<&'static str> {
    Html(include_str!("../judge/index.html"))
}

async fn get_state(State(state): State<ApiState>, ConnectInfo(from): ConnectInfo<SocketAddr>, headers: HeaderMap) -> Result<Json<Value>, StatusCode> {
    state.authorize(from, &headers)?;
    let competitions = running_competitions(&state.pool).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(json!({ "competitions": competitions })))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ScoreBody {
    entry_id: i64,
    set_id: i64,
    station_number: i64,
    /// null clears the result.
    reps: Option<i64>,
}

async fn post_score(State(state): State<ApiState>, ConnectInfo(from): ConnectInfo<SocketAddr>, headers: HeaderMap, Json(body): Json<ScoreBody>) -> Response {
    if let Err(status) = state.authorize(from, &headers) {
        return status.into_response();
    }
    // Mirrors db/scores.ts setScore: delete on null, else insert-or-update.
    let result = match body.reps {
        None => sqlx::query("DELETE FROM scores WHERE entry_id = ? AND set_id = ? AND station_number = ?")
            .bind(body.entry_id)
            .bind(body.set_id)
            .bind(body.station_number)
            .execute(&state.pool)
            .await,
        Some(reps) => sqlx::query(
            "INSERT INTO scores (entry_id, set_id, station_number, reps) VALUES (?, ?, ?, ?) \
             ON CONFLICT (entry_id, set_id, station_number) DO UPDATE SET reps = excluded.reps, updated_at = datetime('now')",
        )
        .bind(body.entry_id)
        .bind(body.set_id)
        .bind(body.station_number)
        .bind(reps)
        .execute(&state.pool)
        .await,
    };
    match result {
        Ok(_) => StatusCode::OK.into_response(),
        Err(e) => (StatusCode::BAD_REQUEST, db_error(e)).into_response(),
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct TimeBody {
    entry_id: i64,
    /// null clears the result.
    time_ms: Option<i64>,
}

async fn post_time(State(state): State<ApiState>, ConnectInfo(from): ConnectInfo<SocketAddr>, headers: HeaderMap, Json(body): Json<TimeBody>) -> Response {
    if let Err(status) = state.authorize(from, &headers) {
        return status.into_response();
    }
    // Mirrors db/speedFitTimes.ts setTime.
    let result = match body.time_ms {
        None => sqlx::query("DELETE FROM speed_fit_times WHERE entry_id = ?").bind(body.entry_id).execute(&state.pool).await,
        Some(time_ms) => sqlx::query(
            "INSERT INTO speed_fit_times (entry_id, time_ms) VALUES (?, ?) \
             ON CONFLICT (entry_id) DO UPDATE SET time_ms = excluded.time_ms, updated_at = datetime('now')",
        )
        .bind(body.entry_id)
        .bind(time_ms)
        .execute(&state.pool)
        .await,
    };
    match result {
        Ok(_) => StatusCode::OK.into_response(),
        Err(e) => (StatusCode::BAD_REQUEST, db_error(e)).into_response(),
    }
}

/// Rows tagged with what they belong to (a competition or a station set), for grouping in Rust.
type Tagged = Vec<(i64, Value)>;

async fn tagged(pool: &SqlitePool, sql: &str, row: impl Fn(&SqliteRow) -> Value) -> Result<Tagged, sqlx::Error> {
    Ok(sqlx::query(sql).fetch_all(pool).await?.iter().map(|r| (r.get::<i64, _>("owner"), row(r))).collect())
}

fn owned_by(rows: &Tagged, owner: i64) -> Vec<Value> {
    rows.iter().filter(|(o, _)| *o == owner).map(|(_, v)| v.clone()).collect()
}

/// Everything the judging page needs for each competition that is currently `running`. One query
/// per kind of data for all of them (the page polls every few seconds from every phone).
/// Read queries mirror the SQL in db/categories.ts, db/entries.ts, db/stations.ts and db/results.ts.
async fn running_competitions(pool: &SqlitePool) -> Result<Vec<Value>, sqlx::Error> {
    const RUNNING: &str = "(SELECT id FROM competitions WHERE status = 'running')";
    let comps = sqlx::query("SELECT id, name FROM competitions WHERE status = 'running' ORDER BY id")
        .fetch_all(pool)
        .await?;
    if comps.is_empty() {
        return Ok(Vec::new());
    }

    let categories = tagged(
        pool,
        &format!(
            "SELECT competition_id AS owner, id, name, kind, age_group AS ageGroup, level, format, gender, min_age AS minAge, max_age AS maxAge, \
                (SELECT json_group_array(set_id) FROM (SELECT set_id FROM category_station_sets WHERE category_id = c.id ORDER BY set_id)) AS stationSetIds \
             FROM categories c WHERE competition_id IN {RUNNING} ORDER BY id"
        ),
        |r| {
            let set_ids: Option<String> = r.get("stationSetIds");
            json!({
                "id": r.get::<i64, _>("id"),
                "name": r.get::<String, _>("name"),
                "kind": r.get::<String, _>("kind"),
                "ageGroup": r.get::<String, _>("ageGroup"),
                "level": r.get::<String, _>("level"),
                "format": r.get::<String, _>("format"),
                "gender": r.get::<String, _>("gender"),
                "minAge": r.get::<Option<i64>, _>("minAge"),
                "maxAge": r.get::<Option<i64>, _>("maxAge"),
                "stationSetIds": set_ids.and_then(|s| serde_json::from_str::<Value>(&s).ok()).unwrap_or_else(|| json!([])),
            })
        },
    )
    .await?;

    // A couple or team is named by all its athletes, in order (entries.athlete_id is only the first),
    // and shows each of their countries once, like the app.
    let entries = tagged(
        pool,
        &format!(
            "SELECT e.competition_id AS owner, e.id, e.category_id AS categoryId, e.bib_number AS bibNumber, \
                COALESCE((SELECT group_concat(country, ' / ') FROM (SELECT x.country \
                            FROM entry_members m JOIN athletes x ON x.id = m.athlete_id WHERE m.entry_id = e.id \
                            GROUP BY x.country ORDER BY MIN(m.position))), a.country) AS country, \
                COALESCE((SELECT group_concat(name, ' / ') FROM (SELECT x.last_name || ' ' || x.first_name AS name \
                            FROM entry_members m JOIN athletes x ON x.id = m.athlete_id WHERE m.entry_id = e.id ORDER BY m.position)), \
                         a.last_name || ' ' || a.first_name) AS name \
             FROM entries e JOIN athletes a ON a.id = e.athlete_id WHERE e.competition_id IN {RUNNING} ORDER BY e.bib_number"
        ),
        |r| {
            json!({
                "id": r.get::<i64, _>("id"),
                "categoryId": r.get::<i64, _>("categoryId"),
                "bibNumber": r.get::<i64, _>("bibNumber"),
                "name": r.get::<String, _>("name"),
                "country": r.get::<String, _>("country"),
            })
        },
    )
    .await?;

    let times = tagged(
        pool,
        &format!(
            "SELECT e.competition_id AS owner, t.entry_id AS entryId, t.time_ms AS timeMs FROM speed_fit_times t \
             JOIN entries e ON e.id = t.entry_id WHERE e.competition_id IN {RUNNING}"
        ),
        |r| json!({ "entryId": r.get::<i64, _>("entryId"), "timeMs": r.get::<i64, _>("timeMs") }),
    )
    .await?;

    let stations = tagged(
        pool,
        &format!(
            "SELECT s.set_id AS owner, s.station_number AS stationNumber, x.name AS exerciseName \
             FROM competition_stations s JOIN station_sets t ON t.id = s.set_id \
             LEFT JOIN exercises x ON x.id = s.exercise_id WHERE t.competition_id IN {RUNNING} ORDER BY s.station_number"
        ),
        |r| json!({ "stationNumber": r.get::<i64, _>("stationNumber"), "exerciseName": r.get::<Option<String>, _>("exerciseName") }),
    )
    .await?;
    let station_sets = tagged(
        pool,
        &format!("SELECT competition_id AS owner, id, name FROM station_sets WHERE competition_id IN {RUNNING} ORDER BY id"),
        |r| {
            let id = r.get::<i64, _>("id");
            json!({ "id": id, "name": r.get::<String, _>("name"), "stations": owned_by(&stations, id) })
        },
    )
    .await?;

    let scores = tagged(
        pool,
        &format!(
            "SELECT e.competition_id AS owner, s.entry_id AS entryId, s.set_id AS setId, s.station_number AS stationNumber, s.reps \
             FROM scores s JOIN entries e ON e.id = s.entry_id WHERE e.competition_id IN {RUNNING}"
        ),
        |r| {
            json!({
                "entryId": r.get::<i64, _>("entryId"),
                "setId": r.get::<i64, _>("setId"),
                "stationNumber": r.get::<i64, _>("stationNumber"),
                "reps": r.get::<i64, _>("reps"),
            })
        },
    )
    .await?;

    Ok(comps
        .iter()
        .map(|comp| {
            let id: i64 = comp.get("id");
            // Each category says whether it takes reps (Fitness Challenge) or a time (Speed Fit).
            json!({
                "id": id,
                "name": comp.get::<String, _>("name"),
                "categories": owned_by(&categories, id),
                "entries": owned_by(&entries, id),
                "stationSets": owned_by(&station_sets, id),
                "scores": owned_by(&scores, id),
                "times": owned_by(&times, id),
            })
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lan_ips_put_the_routed_address_first_and_keep_only_other_private_ones() {
        let ip = |text: &str| text.parse::<IpAddr>().unwrap();
        let interfaces = [ip("127.0.0.1"), ip("192.168.1.5"), ip("10.8.0.2"), ip("8.8.4.4"), ip("fe80::1")];
        assert_eq!(lan_ips(Some(ip("10.8.0.2")), interfaces), [ip("10.8.0.2"), ip("192.168.1.5")]);
        assert_eq!(lan_ips(None, interfaces), [ip("192.168.1.5"), ip("10.8.0.2")], "no gateway");
    }

    #[test]
    fn different_wrong_codes_lock_a_device_out_for_a_while() {
        let wrong_codes = Mutex::default();
        let phone: IpAddr = "192.168.1.9".parse().unwrap();
        let other: IpAddr = "192.168.1.10".parse().unwrap();
        let now = Instant::now();
        let check = |ip: IpAddr, sent: &str, at: Instant| check_code(&wrong_codes, ip, Some(sent), "123456", at);

        for _ in 0..50 {
            assert_eq!(check(phone, "111111", now), Err(StatusCode::UNAUTHORIZED), "an old code repeated doesn't count");
        }
        assert_eq!(check(phone, "123456", now), Ok(()));
        for guess in 0..MAX_WRONG_CODES {
            assert_eq!(check(phone, &format!("{guess:06}"), now), Err(StatusCode::UNAUTHORIZED));
        }
        assert_eq!(check(phone, "123456", now), Err(StatusCode::TOO_MANY_REQUESTS), "even the right code waits");
        assert_eq!(check(other, "123456", now), Ok(()), "other devices aren't affected");
        assert_eq!(check(phone, "123456", now + LOCKOUT), Ok(()));
    }

    #[test]
    fn a_teams_countries_read_in_member_order_each_once() {
        tauri::async_runtime::block_on(async {
            let pool = SqlitePoolOptions::new().max_connections(1).connect("sqlite::memory:").await.unwrap();
            for migration in crate::migrations() {
                sqlx::raw_sql(migration.sql).execute(&pool).await.unwrap();
            }
            // Athlete ids deliberately don't follow the member order.
            sqlx::raw_sql(
                "INSERT INTO athletes (id, first_name, last_name, date_of_birth, sex, country) VALUES
                   (7, 'A', 'A', '2000-01-01', 'male', 'ROU'), (3, 'B', 'B', '2000-01-01', 'male', 'HUN'),
                   (5, 'C', 'C', '2000-01-01', 'male', 'ROU'), (1, 'D', 'D', '2000-01-01', 'male', 'BGR');
                 INSERT INTO competitions (id, name, date) VALUES (1, 'Cup', '2026-01-01');
                 INSERT INTO categories (id, competition_id, name, gender, format, kind) VALUES (1, 1, 'Teams', 'male', 'team', 'speed_fit');
                 INSERT INTO entries (id, competition_id, category_id, athlete_id, bib_number) VALUES (1, 1, 1, 7, 1);
                 INSERT INTO entry_members (entry_id, athlete_id, position) VALUES (1, 7, 1), (1, 3, 2), (1, 5, 3), (1, 1, 4);
                 UPDATE competitions SET status = 'running' WHERE id = 1;",
            )
            .execute(&pool)
            .await
            .unwrap();
            let competitions = running_competitions(&pool).await.unwrap();
            assert_eq!(competitions[0]["entries"][0]["country"], "ROU / HUN / BGR");
        });
    }

    #[test]
    fn old_speed_fit_competitions_keep_their_times_and_new_ones_mix_both_challenges() {
        tauri::async_runtime::block_on(async {
            let pool = SqlitePoolOptions::new().max_connections(1).connect("sqlite::memory:").await.unwrap();
            async fn exec(pool: &SqlitePool, sql: &str) -> Result<(), sqlx::Error> {
                sqlx::raw_sql(sql).execute(pool).await.map(|_| ())
            }
            let run = |sql: &'static str| exec(&pool, sql);
            let (before, after) = crate::migrations().into_iter().partition::<Vec<_>, _>(|m| m.version < 16);
            for migration in before {
                run(migration.sql).await.unwrap();
            }
            // A finished Speed Fit competition, saved before 0016.
            run("INSERT INTO athletes (id, first_name, last_name, date_of_birth, sex, country) VALUES (1, 'A', 'A', '2000-01-01', 'male', 'ROU');
                 INSERT INTO competitions (id, name, date, kind) VALUES (1, 'Old', '2026-01-01', 'speed_fit');
                 INSERT INTO categories (id, competition_id, name, gender) VALUES (1, 1, 'Open', 'male');
                 INSERT INTO entries (id, competition_id, category_id, athlete_id, bib_number) VALUES (1, 1, 1, 1, 1);
                 UPDATE competitions SET status = 'running' WHERE id = 1;
                 INSERT INTO speed_fit_times (entry_id, time_ms) VALUES (1, 61000);
                 UPDATE competitions SET status = 'finished' WHERE id = 1;
                 INSERT INTO competitions (id, name, date, kind) VALUES (4, 'Old draft', '2026-01-02', 'speed_fit');
                 INSERT INTO categories (id, competition_id, name, gender, age_group) VALUES (4, 4, 'Junior Men', 'male', 'Junior');")
                .await
                .unwrap();
            for migration in after {
                run(migration.sql).await.unwrap();
            }
            let kind: String = sqlx::query_scalar("SELECT kind FROM categories WHERE id = 1").fetch_one(&pool).await.unwrap();
            assert_eq!(kind, "speed_fit");
            let time: i64 = sqlx::query_scalar("SELECT time_ms FROM speed_fit_times WHERE entry_id = 1").fetch_one(&pool).await.unwrap();
            assert_eq!(time, 61000);

            // An old draft one: renamed as the app names it now, so its Fitness Challenge twin fits,
            // and given "Set A" for that category. An entry can't move between the two.
            let name: String = sqlx::query_scalar("SELECT name FROM categories WHERE id = 4").fetch_one(&pool).await.unwrap();
            assert_eq!(name, "Speed Fit · Junior Men");
            run("INSERT INTO categories (id, competition_id, name, gender, age_group) VALUES (5, 4, 'Junior Men', 'male', 'Junior');
                 INSERT INTO entries (id, competition_id, category_id, athlete_id, bib_number) VALUES (4, 4, 5, 1, 1);")
                .await
                .unwrap();
            let fc_sets: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM category_station_sets WHERE category_id = 5").fetch_one(&pool).await.unwrap();
            assert_eq!(fc_sets, 1, "the Fitness Challenge category gets Set A");
            assert!(run("UPDATE entries SET category_id = 4 WHERE id = 4").await.is_err(), "no move between challenges");

            // One new competition: the same athlete in a Fitness Challenge and a Speed Fit category, one number.
            run("INSERT INTO competitions (id, name, date) VALUES (2, 'New', '2026-02-01');
                 INSERT INTO categories (id, competition_id, name, gender, kind) VALUES (2, 2, 'Reps', 'male', 'fitness_challenge'), (3, 2, 'Speed Fit · Reps', 'male', 'speed_fit');
                 INSERT INTO competition_stations (set_id, station_number) SELECT id, 1 FROM station_sets WHERE competition_id = 2;
                 INSERT INTO entries (id, competition_id, category_id, athlete_id, bib_number) VALUES (2, 2, 2, 1, 5), (3, 2, 3, 1, 5);
                 UPDATE competitions SET status = 'running' WHERE id = 2;
                 INSERT INTO scores (entry_id, set_id, station_number, reps) SELECT 2, id, 1, 10 FROM station_sets WHERE competition_id = 2;
                 INSERT INTO speed_fit_times (entry_id, time_ms) VALUES (3, 50000);")
                .await
                .unwrap();
            let sf_sets: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM category_station_sets WHERE category_id = 3").fetch_one(&pool).await.unwrap();
            assert_eq!(sf_sets, 0, "Speed Fit categories have no station set");
            assert!(run("INSERT INTO speed_fit_times (entry_id, time_ms) VALUES (2, 1000)").await.is_err(), "no time for reps");
            assert!(run("INSERT INTO scores (entry_id, set_id, station_number, reps) SELECT 3, id, 1, 1 FROM station_sets WHERE competition_id = 2").await.is_err(), "no reps for Speed Fit");
            assert!(run("UPDATE categories SET kind = 'speed_fit' WHERE id = 2").await.is_err(), "type is fixed");
        });
    }

    #[test]
    fn codes_have_six_digits_and_all_of_them_vary() {
        let codes: Vec<String> = (0..50).map(|_| generate_code()).collect();
        assert!(codes.iter().all(|c| c.len() == 6 && c.bytes().all(|b| b.is_ascii_digit())));
        for position in 0..6 {
            let digits: std::collections::HashSet<u8> = codes.iter().map(|c| c.as_bytes()[position]).collect();
            assert!(digits.len() > 1, "digit {position} never changes");
        }
    }
}
