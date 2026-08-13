use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      let db_state = db::init_state(app.handle()).map_err(|e| {
        log::error!("Failed to open pos_local.db: {e}");
        e
      })?;
      app.manage(db_state);
      log::info!("Local SQLite ready (pos_local.db)");
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      db::commands::db_migrate,
      db::commands::get_local_db_path,
      db::commands::search_cached_products,
      db::commands::list_cached_batches,
      db::commands::replace_catalog_cache,
      db::commands::enqueue_sync_event,
      db::commands::count_unsynced,
      db::commands::list_sync_queue,
      db::commands::list_sync_pending,
      db::commands::mark_sync_synced,
      db::commands::mark_sync_attempt,
      db::commands::mark_sync_dead,
      db::commands::retry_sync_event,
      db::commands::count_sync_dead,
      db::commands::apply_cached_stock_delta,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

mod db;
