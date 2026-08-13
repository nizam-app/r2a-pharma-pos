/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  /** M4 Batch D walkthrough — flush outbound_sync_queue now (no-op while forced/offline). */
  __r2aFlushSyncNow?: () => Promise<void>;
}
