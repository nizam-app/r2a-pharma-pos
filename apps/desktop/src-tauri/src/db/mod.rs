//! Local SQLite (`pos_local.db`) — Milestone 3 Batch E + M4 Batch A.
//! Catalog cache + outbound sync queue (retry / dead-letter cols). Flush worker = M4 D.

pub mod commands;
mod schema;

pub use commands::DbState;
pub use schema::migrate;

use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

pub fn db_path(app: &AppHandle) -> Result<PathBuf, String> {
  let dir = app
    .path()
    .app_data_dir()
    .map_err(|e| format!("app_data_dir: {e}"))?;
  std::fs::create_dir_all(&dir).map_err(|e| format!("create app data dir: {e}"))?;
  Ok(dir.join("pos_local.db"))
}

pub fn open_connection(app: &AppHandle) -> Result<Connection, String> {
  let path = db_path(app)?;
  let conn = Connection::open(&path).map_err(|e| format!("open sqlite: {e}"))?;
  conn
    .execute_batch("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;")
    .map_err(|e| format!("pragma: {e}"))?;
  migrate(&conn)?;
  Ok(conn)
}

pub fn with_conn<T>(
  state: &State<'_, DbState>,
  f: impl FnOnce(&Connection) -> Result<T, String>,
) -> Result<T, String> {
  let conn = state
    .0
    .lock()
    .map_err(|_| "local db lock poisoned".to_string())?;
  f(&conn)
}

pub fn init_state(app: &AppHandle) -> Result<DbState, String> {
  let conn = open_connection(app)?;
  Ok(DbState(Mutex::new(conn)))
}
