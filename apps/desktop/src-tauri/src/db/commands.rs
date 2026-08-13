//! Tauri IPC for local SQLite (Batch E catalog + M4 Batch A queue).
//! No cloud flush / worker (M4 Batches B–D).

use super::{db_path, with_conn};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, State};

pub struct DbState(pub Mutex<Connection>);

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CachedProduct {
  pub id: String,
  pub name: String,
  pub generic_name: Option<String>,
  pub manufacturer: Option<String>,
  pub strength: Option<String>,
  pub form: Option<String>,
  pub sku: Option<String>,
  pub barcode: Option<String>,
  pub is_active: bool,
  pub cached_at: String,
  #[serde(default)]
  pub units: Vec<CachedProductUnit>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CachedProductUnit {
  pub id: String,
  pub product_id: String,
  pub unit_type: String,
  pub factor_to_base: i64,
  pub label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CachedBatch {
  pub id: String,
  pub product_id: String,
  pub store_id: String,
  pub batch_number: String,
  pub expiry_date: String,
  pub quantity_on_hand: i64,
  pub sell_per_base: f64,
  pub cached_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogCachePayload {
  pub products: Vec<CachedProduct>,
  pub batches: Vec<CachedBatch>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnqueueInput {
  pub id: String,
  pub entity_type: String,
  pub action: String,
  /// JSON object/string — stored as TEXT.
  pub payload: serde_json::Value,
}

/// Queue row for UI + worker (payload parsed from TEXT JSON).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncQueueRow {
  pub id: String,
  pub entity_type: String,
  pub action: String,
  pub payload: serde_json::Value,
  pub synced: i64,
  pub created_at: String,
  pub attempt_count: i64,
  pub last_error: Option<String>,
  pub last_attempt_at: Option<String>,
  pub dead: i64,
}

#[tauri::command]
pub fn db_migrate(state: State<'_, DbState>) -> Result<(), String> {
  with_conn(&state, |conn| super::migrate(conn))
}

#[tauri::command]
pub fn get_local_db_path(app: AppHandle) -> Result<String, String> {
  db_path(&app).map(|p| p.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn search_cached_products(
  state: State<'_, DbState>,
  q: Option<String>,
  limit: Option<i64>,
) -> Result<Vec<CachedProduct>, String> {
  let limit = limit.unwrap_or(20).clamp(1, 100);
  with_conn(&state, |conn| {
    let q_trim = q.as_deref().map(str::trim).filter(|s| !s.is_empty());
    let mut products = if let Some(needle) = q_trim {
      let like = format!("%{}%", escape_like(needle));
      let mut stmt = conn
        .prepare(
          r#"
          SELECT id, name, generic_name, manufacturer, strength, form,
                 sku, barcode, is_active, cached_at
          FROM cached_products
          WHERE is_active = 1
            AND (
              name LIKE ?1 ESCAPE '\'
              OR IFNULL(generic_name, '') LIKE ?1 ESCAPE '\'
              OR IFNULL(manufacturer, '') LIKE ?1 ESCAPE '\'
              OR IFNULL(strength, '') LIKE ?1 ESCAPE '\'
              OR IFNULL(form, '') LIKE ?1 ESCAPE '\'
              OR IFNULL(sku, '') LIKE ?1 ESCAPE '\'
              OR IFNULL(barcode, '') LIKE ?1 ESCAPE '\'
            )
          ORDER BY name ASC
          LIMIT ?2
          "#,
        )
        .map_err(|e| format!("prepare search: {e}"))?;
      let rows = stmt
        .query_map(params![like, limit], map_product_row)
        .map_err(|e| format!("search: {e}"))?;
      collect_rows(rows)?
    } else {
      let mut stmt = conn
        .prepare(
          r#"
          SELECT id, name, generic_name, manufacturer, strength, form,
                 sku, barcode, is_active, cached_at
          FROM cached_products
          WHERE is_active = 1
          ORDER BY name ASC
          LIMIT ?1
          "#,
        )
        .map_err(|e| format!("prepare list: {e}"))?;
      let rows = stmt
        .query_map(params![limit], map_product_row)
        .map_err(|e| format!("list: {e}"))?;
      collect_rows(rows)?
    };

    for p in &mut products {
      p.units = load_units(conn, &p.id)?;
    }
    Ok(products)
  })
}

#[tauri::command]
pub fn list_cached_batches(
  state: State<'_, DbState>,
  product_id: Option<String>,
) -> Result<Vec<CachedBatch>, String> {
  with_conn(&state, |conn| {
    if let Some(pid) = product_id.filter(|s| !s.is_empty()) {
      let mut stmt = conn
        .prepare(
          r#"
          SELECT id, product_id, store_id, batch_number, expiry_date,
                 quantity_on_hand, sell_per_base, cached_at
          FROM cached_batches
          WHERE product_id = ?1
          ORDER BY expiry_date ASC, id ASC
          "#,
        )
        .map_err(|e| format!("prepare batches: {e}"))?;
      let rows = stmt
        .query_map(params![pid], map_batch_row)
        .map_err(|e| format!("batches: {e}"))?;
      collect_rows(rows)
    } else {
      let mut stmt = conn
        .prepare(
          r#"
          SELECT id, product_id, store_id, batch_number, expiry_date,
                 quantity_on_hand, sell_per_base, cached_at
          FROM cached_batches
          ORDER BY expiry_date ASC, id ASC
          "#,
        )
        .map_err(|e| format!("prepare all batches: {e}"))?;
      let rows = stmt
        .query_map([], map_batch_row)
        .map_err(|e| format!("all batches: {e}"))?;
      collect_rows(rows)
    }
  })
}

#[tauri::command]
pub fn replace_catalog_cache(
  state: State<'_, DbState>,
  payload: CatalogCachePayload,
) -> Result<(), String> {
  with_conn(&state, |conn| {
    let tx = conn
      .unchecked_transaction()
      .map_err(|e| format!("begin tx: {e}"))?;

    tx.execute_batch(
      r#"
      DELETE FROM cached_batches;
      DELETE FROM cached_product_units;
      DELETE FROM cached_products;
      "#,
    )
    .map_err(|e| format!("clear cache: {e}"))?;

    {
      let mut ins_product = tx
        .prepare(
          r#"
          INSERT INTO cached_products
            (id, name, generic_name, manufacturer, strength, form,
             sku, barcode, is_active, cached_at)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
          "#,
        )
        .map_err(|e| format!("prepare product insert: {e}"))?;
      let mut ins_unit = tx
        .prepare(
          r#"
          INSERT INTO cached_product_units
            (id, product_id, unit_type, factor_to_base, label)
          VALUES (?1, ?2, ?3, ?4, ?5)
          "#,
        )
        .map_err(|e| format!("prepare unit insert: {e}"))?;

      for p in &payload.products {
        ins_product
          .execute(params![
            p.id,
            p.name,
            p.generic_name,
            p.manufacturer,
            p.strength,
            p.form,
            p.sku,
            p.barcode,
            if p.is_active { 1 } else { 0 },
            p.cached_at,
          ])
          .map_err(|e| format!("insert product {}: {e}", p.id))?;
        for u in &p.units {
          ins_unit
            .execute(params![
              u.id,
              u.product_id,
              u.unit_type,
              u.factor_to_base,
              u.label,
            ])
            .map_err(|e| format!("insert unit {}: {e}", u.id))?;
        }
      }
    }

    {
      let mut ins_batch = tx
        .prepare(
          r#"
          INSERT INTO cached_batches
            (id, product_id, store_id, batch_number, expiry_date,
             quantity_on_hand, sell_per_base, cached_at)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
          "#,
        )
        .map_err(|e| format!("prepare batch insert: {e}"))?;
      for b in &payload.batches {
        ins_batch
          .execute(params![
            b.id,
            b.product_id,
            b.store_id,
            b.batch_number,
            b.expiry_date,
            b.quantity_on_hand,
            b.sell_per_base,
            b.cached_at,
          ])
          .map_err(|e| format!("insert batch {}: {e}", b.id))?;
      }
    }

    tx.commit().map_err(|e| format!("commit cache: {e}"))?;
    Ok(())
  })
}

#[tauri::command]
pub fn enqueue_sync_event(
  state: State<'_, DbState>,
  input: EnqueueInput,
) -> Result<(), String> {
  let payload = serde_json::to_string(&input.payload)
    .map_err(|e| format!("serialize payload: {e}"))?;
  with_conn(&state, |conn| {
    // Same `id` (sale eventId) is a no-op success — do not duplicate the row.
    conn
      .execute(
        r#"
        INSERT OR IGNORE INTO outbound_sync_queue
          (id, entity_type, action, payload, synced, attempt_count, dead)
        VALUES (?1, ?2, ?3, ?4, 0, 0, 0)
        "#,
        params![input.id, input.entity_type, input.action, payload],
      )
      .map_err(|e| format!("enqueue: {e}"))?;
    Ok(())
  })
}

#[tauri::command]
pub fn count_unsynced(state: State<'_, DbState>) -> Result<i64, String> {
  with_conn(&state, |conn| {
    let count: i64 = conn
      .query_row(
        "SELECT COUNT(*) FROM outbound_sync_queue WHERE synced = 0 AND dead = 0",
        [],
        |row| row.get(0),
      )
      .optional()
      .map_err(|e| format!("count: {e}"))?
      .unwrap_or(0);
    Ok(count)
  })
}

const QUEUE_SELECT: &str = r#"
  SELECT id, entity_type, action, payload, synced, created_at,
         IFNULL(attempt_count, 0), last_error, last_attempt_at, IFNULL(dead, 0)
  FROM outbound_sync_queue
"#;

/// Unsynced pending + dead rows (UI). Failed (`dead = 1`) first, then FIFO.
#[tauri::command]
pub fn list_sync_queue(state: State<'_, DbState>) -> Result<Vec<SyncQueueRow>, String> {
  with_conn(&state, |conn| {
    let sql = format!(
      "{QUEUE_SELECT}
       WHERE synced = 0 OR dead = 1
       ORDER BY dead DESC, created_at ASC, id ASC"
    );
    let mut stmt = conn
      .prepare(&sql)
      .map_err(|e| format!("prepare list_sync_queue: {e}"))?;
    let rows = stmt
      .query_map([], map_queue_row)
      .map_err(|e| format!("list_sync_queue: {e}"))?;
    collect_rows(rows)
  })
}

/// FIFO pending only (`synced = 0 AND dead = 0`). Worker batch; default limit 10.
#[tauri::command]
pub fn list_sync_pending(
  state: State<'_, DbState>,
  limit: Option<i64>,
) -> Result<Vec<SyncQueueRow>, String> {
  let limit = limit.unwrap_or(10).clamp(1, 100);
  with_conn(&state, |conn| {
    let sql = format!(
      "{QUEUE_SELECT}
       WHERE synced = 0 AND dead = 0
       ORDER BY created_at ASC, id ASC
       LIMIT ?1"
    );
    let mut stmt = conn
      .prepare(&sql)
      .map_err(|e| format!("prepare list_sync_pending: {e}"))?;
    let rows = stmt
      .query_map(params![limit], map_queue_row)
      .map_err(|e| format!("list_sync_pending: {e}"))?;
    collect_rows(rows)
  })
}

#[tauri::command]
pub fn mark_sync_synced(state: State<'_, DbState>, id: String) -> Result<(), String> {
  with_conn(&state, |conn| {
    conn
      .execute(
        "UPDATE outbound_sync_queue SET synced = 1 WHERE id = ?1",
        params![id],
      )
      .map_err(|e| format!("mark_sync_synced: {e}"))?;
    Ok(())
  })
}

#[tauri::command]
pub fn mark_sync_attempt(
  state: State<'_, DbState>,
  id: String,
  last_error: String,
) -> Result<(), String> {
  with_conn(&state, |conn| {
    conn
      .execute(
        r#"
        UPDATE outbound_sync_queue
        SET attempt_count = IFNULL(attempt_count, 0) + 1,
            last_error = ?2,
            last_attempt_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ?1
        "#,
        params![id, last_error],
      )
      .map_err(|e| format!("mark_sync_attempt: {e}"))?;
    Ok(())
  })
}

#[tauri::command]
pub fn mark_sync_dead(
  state: State<'_, DbState>,
  id: String,
  last_error: String,
) -> Result<(), String> {
  with_conn(&state, |conn| {
    conn
      .execute(
        r#"
        UPDATE outbound_sync_queue
        SET dead = 1,
            last_error = ?2,
            last_attempt_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ?1
        "#,
        params![id, last_error],
      )
      .map_err(|e| format!("mark_sync_dead: {e}"))?;
    Ok(())
  })
}

#[tauri::command]
pub fn retry_sync_event(state: State<'_, DbState>, id: String) -> Result<(), String> {
  with_conn(&state, |conn| {
    conn
      .execute(
        r#"
        UPDATE outbound_sync_queue
        SET dead = 0,
            attempt_count = 0,
            last_error = NULL,
            last_attempt_at = NULL
        WHERE id = ?1
        "#,
        params![id],
      )
      .map_err(|e| format!("retry_sync_event: {e}"))?;
    Ok(())
  })
}

#[tauri::command]
pub fn count_sync_dead(state: State<'_, DbState>) -> Result<i64, String> {
  with_conn(&state, |conn| {
    let count: i64 = conn
      .query_row(
        "SELECT COUNT(*) FROM outbound_sync_queue WHERE dead = 1",
        [],
        |row| row.get(0),
      )
      .optional()
      .map_err(|e| format!("count_sync_dead: {e}"))?
      .unwrap_or(0);
    Ok(count)
  })
}

/// Add `quantity_change` to cached batch qty (negative = sale). Clamp at 0.
#[tauri::command]
pub fn apply_cached_stock_delta(
  state: State<'_, DbState>,
  batch_id: String,
  quantity_change: i64,
) -> Result<(), String> {
  with_conn(&state, |conn| {
    conn
      .execute(
        r#"
        UPDATE cached_batches
        SET quantity_on_hand = MAX(0, quantity_on_hand + ?2)
        WHERE id = ?1
        "#,
        params![batch_id, quantity_change],
      )
      .map_err(|e| format!("apply_cached_stock_delta: {e}"))?;
    Ok(())
  })
}

fn map_queue_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<SyncQueueRow> {
  let payload_text: String = row.get(3)?;
  let payload = serde_json::from_str(&payload_text)
    .unwrap_or_else(|_| serde_json::Value::Object(Default::default()));
  Ok(SyncQueueRow {
    id: row.get(0)?,
    entity_type: row.get(1)?,
    action: row.get(2)?,
    payload,
    synced: row.get(4)?,
    created_at: row.get(5)?,
    attempt_count: row.get(6)?,
    last_error: row.get(7)?,
    last_attempt_at: row.get(8)?,
    dead: row.get(9)?,
  })
}

fn map_product_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<CachedProduct> {
  let is_active_i: i64 = row.get(8)?;
  Ok(CachedProduct {
    id: row.get(0)?,
    name: row.get(1)?,
    generic_name: row.get(2)?,
    manufacturer: row.get(3)?,
    strength: row.get(4)?,
    form: row.get(5)?,
    sku: row.get(6)?,
    barcode: row.get(7)?,
    is_active: is_active_i != 0,
    cached_at: row.get(9)?,
    units: Vec::new(),
  })
}

fn map_batch_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<CachedBatch> {
  Ok(CachedBatch {
    id: row.get(0)?,
    product_id: row.get(1)?,
    store_id: row.get(2)?,
    batch_number: row.get(3)?,
    expiry_date: row.get(4)?,
    quantity_on_hand: row.get(5)?,
    sell_per_base: row.get(6)?,
    cached_at: row.get(7)?,
  })
}

fn load_units(conn: &Connection, product_id: &str) -> Result<Vec<CachedProductUnit>, String> {
  let mut stmt = conn
    .prepare(
      r#"
      SELECT id, product_id, unit_type, factor_to_base, label
      FROM cached_product_units
      WHERE product_id = ?1
      ORDER BY factor_to_base ASC
      "#,
    )
    .map_err(|e| format!("prepare units: {e}"))?;
  let rows = stmt
    .query_map(params![product_id], |row| {
      Ok(CachedProductUnit {
        id: row.get(0)?,
        product_id: row.get(1)?,
        unit_type: row.get(2)?,
        factor_to_base: row.get(3)?,
        label: row.get(4)?,
      })
    })
    .map_err(|e| format!("units: {e}"))?;
  collect_rows(rows)
}

fn collect_rows<T>(
  rows: impl Iterator<Item = Result<T, rusqlite::Error>>,
) -> Result<Vec<T>, String> {
  let mut out = Vec::new();
  for row in rows {
    out.push(row.map_err(|e| format!("row: {e}"))?);
  }
  Ok(out)
}

fn escape_like(s: &str) -> String {
  s.replace('\\', "\\\\")
    .replace('%', "\\%")
    .replace('_', "\\_")
}
