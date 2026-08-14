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
  /** M4/M5 walkthrough — mark FIFO head dead. Default last_error is 409 Insufficient stock. */
  __r2aMarkHeadSyncDead?: (lastError?: string) => Promise<string | null>;
}
