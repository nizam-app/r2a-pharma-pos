//! Lean local schema (Batch E catalog + M4 Batch A queue columns).
//! Not a Prisma mirror: search/batch cache + outbound queue only.

use rusqlite::Connection;

pub fn migrate(conn: &Connection) -> Result<(), String> {
  conn
    .execute_batch(
      r#"
      CREATE TABLE IF NOT EXISTS outbound_sync_queue (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        action TEXT NOT NULL,
        payload TEXT NOT NULL,
        synced INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        attempt_count INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        last_attempt_at TEXT,
        dead INTEGER NOT NULL DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_outbound_sync_queue_synced
        ON outbound_sync_queue (synced, created_at);

      CREATE TABLE IF NOT EXISTS cached_products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        generic_name TEXT,
        manufacturer TEXT,
        strength TEXT,
        form TEXT,
        sku TEXT,
        barcode TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        cached_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_cached_products_name
        ON cached_products (name);
      CREATE INDEX IF NOT EXISTS idx_cached_products_generic
        ON cached_products (generic_name);
      CREATE INDEX IF NOT EXISTS idx_cached_products_manufacturer
        ON cached_products (manufacturer);
      CREATE INDEX IF NOT EXISTS idx_cached_products_sku
        ON cached_products (sku);
      CREATE INDEX IF NOT EXISTS idx_cached_products_barcode
        ON cached_products (barcode);

      CREATE TABLE IF NOT EXISTS cached_product_units (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        unit_type TEXT NOT NULL,
        factor_to_base INTEGER NOT NULL,
        label TEXT,
        FOREIGN KEY (product_id) REFERENCES cached_products(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_cached_product_units_product
        ON cached_product_units (product_id);

      CREATE TABLE IF NOT EXISTS cached_batches (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        store_id TEXT NOT NULL,
        batch_number TEXT NOT NULL,
        expiry_date TEXT NOT NULL,
        quantity_on_hand INTEGER NOT NULL,
        sell_per_base REAL NOT NULL,
        cached_at TEXT NOT NULL,
        FOREIGN KEY (product_id) REFERENCES cached_products(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_cached_batches_product_expiry
        ON cached_batches (product_id, expiry_date);
      "#,
    )
    .map_err(|e| format!("migrate: {e}"))?;

  // Existing installs created cached_products without catalog display cols.
  add_column_if_missing(conn, "cached_products", "manufacturer", "TEXT")?;
  add_column_if_missing(conn, "cached_products", "strength", "TEXT")?;
  add_column_if_missing(conn, "cached_products", "form", "TEXT")?;

  // Existing installs created outbound_sync_queue without retry / dead-letter cols.
  add_column_if_missing(
    conn,
    "outbound_sync_queue",
    "attempt_count",
    "INTEGER NOT NULL DEFAULT 0",
  )?;
  add_column_if_missing(conn, "outbound_sync_queue", "last_error", "TEXT")?;
  add_column_if_missing(conn, "outbound_sync_queue", "last_attempt_at", "TEXT")?;
  add_column_if_missing(
    conn,
    "outbound_sync_queue",
    "dead",
    "INTEGER NOT NULL DEFAULT 0",
  )?;

  conn
    .execute_batch(
      r#"
      CREATE INDEX IF NOT EXISTS idx_outbound_sync_queue_pending
        ON outbound_sync_queue (synced, dead, created_at);
      "#,
    )
    .map_err(|e| format!("queue pending index: {e}"))?;

  Ok(())
}

fn add_column_if_missing(
  conn: &Connection,
  table: &str,
  column: &str,
  decl: &str,
) -> Result<(), String> {
  let mut stmt = conn
    .prepare(&format!("PRAGMA table_info({table})"))
    .map_err(|e| format!("pragma table_info: {e}"))?;
  let names = stmt
    .query_map([], |row| row.get::<_, String>(1))
    .map_err(|e| format!("pragma rows: {e}"))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| format!("pragma collect: {e}"))?;
  if names.iter().any(|n| n == column) {
    return Ok(());
  }
  conn
    .execute(
      &format!("ALTER TABLE {table} ADD COLUMN {column} {decl}"),
      [],
    )
    .map_err(|e| format!("alter add {column}: {e}"))?;
  Ok(())
}
