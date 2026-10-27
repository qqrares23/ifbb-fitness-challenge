//! A small HTTP server that lets judges on the local network record results from a phone browser.
//!
//! It serves one self-contained mobile page (`judge/index.html`) plus a JSON API, and reads/writes
//! the same SQLite file the app uses through its own `sqlx` pool. SQLite's WAL mode lets this pool
//! coexist with tauri-plugin-sql's. The database's own triggers and CHECKs stay the source of
//! truth (results only while `running`, kind-isolation, value ranges), so this server does not
//! re-validate — a rejected write surfaces as HTTP 400 with the database's message.

use std::net::{IpAddr, UdpSocket};
use std::path::Path;
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use axum::response::{Html, IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions};
use sqlx::{Row, SqlitePool};
use tauri::{AppHandle, Manager};
use tokio::sync::oneshot;

/// The judging page and API listen here on every network interface.
const PORT: u16 = 8080;

/// Managed Tauri state: the running server, if any.
#[derive(Default)]
pub struct JudgeServer(pub Mutex<Option<Running>>);

pub struct Running {
    code: String,
    url: String,
    shutdown: oneshot::Sender<()>,
}

#[derive(Serialize)]
pub struct JudgeServerStatus {
    running: bool,
    url: Option<String>,
    code: Option<String>,
}

impl JudgeServerStatus {
    fn stopped() -> Self {
        Self { running: false, url: None, code: None }
    }
    fn of(r: &Running) -> Self {
        Self { running: true, url: Some(r.url.clone()), code: Some(r.code.clone()) }
    }
}

/// Shared with every request handler. `SqlitePool` is cheap to clone (an `Arc` inside).
#[derive(Clone)]
struct ApiState {
    pool: SqlitePool,
    code: String,
}

#[tauri::command]
pub async fn start_judge_server(app: AppHandle) -> Result<JudgeServerStatus, String> {
    if let Some(r) = app.state::<JudgeServer>().0.lock().unwrap().as_ref() {
        return Ok(JudgeServerStatus::of(r)); // already hosting
    }

    let pool = open_pool(&crate::database_path(&app)?).await?;
    let code = generate_code();
    let ip = lan_ip().ok_or("Couldn't find this computer's network address.")?;
    let url = format!("http://{ip}:{PORT}");

    let router = Router::new()
        .route("/", get(index))
        .route("/api/state", get(get_state))
        .route("/api/score", post(post_score))
        .route("/api/time", post(post_time))
        .with_state(ApiState { pool, code: code.clone() });

    let listener = tokio::net::TcpListener::bind(("0.0.0.0", PORT))
        .await
        .map_err(|e| format!("Couldn't start hosting on port {PORT}: {e}"))?;
    let (shutdown, rx) = oneshot::channel::<()>();
    tauri::async_runtime::spawn(async move {
        let _ = axum::serve(listener, router)
            .with_graceful_shutdown(async {
                let _ = rx.await;
            })
            .await;
    });

    let running = Running { code, url, shutdown };
    let status = JudgeServerStatus::of(&running);
    *app.state::<JudgeServer>().0.lock().unwrap() = Some(running);
    Ok(status)
}

#[tauri::command]
pub fn stop_judge_server(app: AppHandle) -> JudgeServerStatus {
    if let Some(running) = app.state::<JudgeServer>().0.lock().unwrap().take() {
        let _ = running.shutdown.send(()); // best effort; the task stops on the next poll
    }
    JudgeServerStatus::stopped()
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
    let nanos = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.subsec_nanos()).unwrap_or(0);
    format!("{:06}", nanos % 1_000_000)
}

/// This computer's primary LAN address, found by asking the OS which interface would reach the
/// internet (no packet is actually sent).
fn lan_ip() -> Option<IpAddr> {
    let socket = UdpSocket::bind("0.0.0.0:0").ok()?;
    socket.connect("8.8.8.8:80").ok()?;
    socket.local_addr().ok().map(|addr| addr.ip())
}

fn check_code(headers: &HeaderMap, code: &str) -> Result<(), StatusCode> {
    match headers.get("x-judge-code").and_then(|v| v.to_str().ok()) {
        Some(sent) if sent == code => Ok(()),
        _ => Err(StatusCode::UNAUTHORIZED),
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

async fn get_state(State(state): State<ApiState>, headers: HeaderMap) -> Result<Json<Value>, StatusCode> {
    check_code(&headers, &state.code)?;
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

async fn post_score(State(state): State<ApiState>, headers: HeaderMap, Json(body): Json<ScoreBody>) -> Response {
    if check_code(&headers, &state.code).is_err() {
        return StatusCode::UNAUTHORIZED.into_response();
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

async fn post_time(State(state): State<ApiState>, headers: HeaderMap, Json(body): Json<TimeBody>) -> Response {
    if check_code(&headers, &state.code).is_err() {
        return StatusCode::UNAUTHORIZED.into_response();
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

/// Everything the judging page needs for each competition that is currently `running`.
/// Read queries mirror the SQL in db/categories.ts, db/entries.ts, db/stations.ts and db/results.ts.
async fn running_competitions(pool: &SqlitePool) -> Result<Vec<Value>, sqlx::Error> {
    let comps = sqlx::query("SELECT id, name, kind FROM competitions WHERE status = 'running' ORDER BY id")
        .fetch_all(pool)
        .await?;

    let mut out = Vec::with_capacity(comps.len());
    for comp in &comps {
        let id: i64 = comp.get("id");
        let kind: String = comp.get("kind");

        let categories = sqlx::query(
            "SELECT id, name, age_group AS ageGroup, level, \
                (SELECT json_group_array(set_id) FROM (SELECT set_id FROM category_station_sets WHERE category_id = c.id ORDER BY set_id)) AS stationSetIds \
             FROM categories c WHERE competition_id = ? ORDER BY id",
        )
        .bind(id)
        .fetch_all(pool)
        .await?
        .iter()
        .map(|r| {
            let set_ids: Option<String> = r.get("stationSetIds");
            json!({
                "id": r.get::<i64, _>("id"),
                "name": r.get::<String, _>("name"),
                "ageGroup": r.get::<Option<String>, _>("ageGroup").unwrap_or_default(),
                "level": r.get::<Option<String>, _>("level").unwrap_or_default(),
                "stationSetIds": set_ids.and_then(|s| serde_json::from_str::<Value>(&s).ok()).unwrap_or_else(|| json!([])),
            })
        })
        .collect::<Vec<_>>();

        let entries = sqlx::query(
            "SELECT e.id, e.category_id AS categoryId, e.bib_number AS bibNumber, \
                a.first_name AS firstName, a.last_name AS lastName, a.country \
             FROM entries e JOIN athletes a ON a.id = e.athlete_id WHERE e.competition_id = ? ORDER BY e.bib_number",
        )
        .bind(id)
        .fetch_all(pool)
        .await?
        .iter()
        .map(|r| {
            json!({
                "id": r.get::<i64, _>("id"),
                "categoryId": r.get::<i64, _>("categoryId"),
                "bibNumber": r.get::<i64, _>("bibNumber"),
                "firstName": r.get::<String, _>("firstName"),
                "lastName": r.get::<String, _>("lastName"),
                "country": r.get::<String, _>("country"),
            })
        })
        .collect::<Vec<_>>();

        let mut value = json!({ "id": id, "name": comp.get::<String, _>("name"), "kind": kind.clone(), "categories": categories, "entries": entries });

        if kind == "speed_fit" {
            let times = sqlx::query(
                "SELECT t.entry_id AS entryId, t.time_ms AS timeMs FROM speed_fit_times t \
                 JOIN entries e ON e.id = t.entry_id WHERE e.competition_id = ?",
            )
            .bind(id)
            .fetch_all(pool)
            .await?
            .iter()
            .map(|r| json!({ "entryId": r.get::<i64, _>("entryId"), "timeMs": r.get::<i64, _>("timeMs") }))
            .collect::<Vec<_>>();
            value["times"] = json!(times);
        } else {
            let sets = sqlx::query("SELECT id, name FROM station_sets WHERE competition_id = ? ORDER BY id").bind(id).fetch_all(pool).await?;
            let stations = sqlx::query(
                "SELECT s.set_id AS setId, s.station_number AS stationNumber, x.name AS exerciseName \
                 FROM competition_stations s JOIN station_sets t ON t.id = s.set_id \
                 LEFT JOIN exercises x ON x.id = s.exercise_id WHERE t.competition_id = ? ORDER BY s.station_number",
            )
            .bind(id)
            .fetch_all(pool)
            .await?;
            let station_sets = sets
                .iter()
                .map(|set| {
                    let set_id: i64 = set.get("id");
                    let stations = stations
                        .iter()
                        .filter(|r| r.get::<i64, _>("setId") == set_id)
                        .map(|r| json!({ "stationNumber": r.get::<i64, _>("stationNumber"), "exerciseName": r.get::<Option<String>, _>("exerciseName") }))
                        .collect::<Vec<_>>();
                    json!({ "id": set_id, "name": set.get::<String, _>("name"), "stations": stations })
                })
                .collect::<Vec<_>>();
            let scores = sqlx::query(
                "SELECT s.entry_id AS entryId, s.set_id AS setId, s.station_number AS stationNumber, s.reps \
                 FROM scores s JOIN entries e ON e.id = s.entry_id WHERE e.competition_id = ?",
            )
            .bind(id)
            .fetch_all(pool)
            .await?
            .iter()
            .map(|r| {
                json!({
                    "entryId": r.get::<i64, _>("entryId"),
                    "setId": r.get::<i64, _>("setId"),
                    "stationNumber": r.get::<i64, _>("stationNumber"),
                    "reps": r.get::<i64, _>("reps"),
                })
            })
            .collect::<Vec<_>>();
            value["stationSets"] = json!(station_sets);
            value["scores"] = json!(scores);
        }
        out.push(value);
    }
    Ok(out)
}
