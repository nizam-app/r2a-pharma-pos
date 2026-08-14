/**
 * M4 Batch E smoke — Sync Queue panel + badge/Settings entry + i18n.
 * Run: npm run smoke:m4e -w @r2a/desktop
 *
 * Verifies: panel source (Esc, Retry, no Tab navigator), no sidebar Sync route,
 * i18n keys in en + bn-BD, badge + Settings entry, Failed-first list + retry
 * on the memory backend. Live Retry walkthrough is manual.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  __resetLocalDbForTests,
  countSyncDead,
  countUnsynced,
  enqueueSyncEvent,
  ensureLocalDb,
  listSyncQueue,
  markSyncDead,
  retrySyncEvent,
} from "../src/lib/localDb/client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "..", "src");

function readSrc(rel: string): string {
  return readFileSync(join(SRC, rel), "utf8");
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function installMemoryStorage(): void {
  const store = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => {
      store.set(k, String(v));
    },
    removeItem: (k) => {
      store.delete(k);
    },
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  };
}

const SYNC_I18N_KEYS = [
  "syncQueue.title",
  "syncQueue.subtitle",
  "syncQueue.pendingCount",
  "syncQueue.failedCount",
  "syncQueue.close",
  "syncQueue.listLabel",
  "syncQueue.empty",
  "syncQueue.emptyHint",
  "syncQueue.colTime",
  "syncQueue.colTxn",
  "syncQueue.colTotal",
  "syncQueue.colStatus",
  "syncQueue.statusPending",
  "syncQueue.statusSyncing",
  "syncQueue.statusFailed",
  "syncQueue.retry",
  "syncQueue.footer",
  "syncQueue.footerEmpty",
  "syncQueue.footerPending",
  "connectivity.syncQueue",
  "settings.syncPending",
  "settings.syncFailed",
  "settings.lastFlush",
  "settings.lastFlushNever",
  "settings.openSyncQueue",
] as const;

function checkSource(): void {
  const panel = readSrc("features/sync/SyncQueuePanel.tsx");
  const index = readSrc("features/sync/index.ts");
  const badge = readSrc("features/shell/ConnectivityBadge.tsx");
  const settings = readSrc("features/settings/SettingsPanel.tsx");
  const sidebar = readSrc("features/shell/Sidebar.tsx");
  const shell = readSrc("features/shell/AppShell.tsx");
  const app = readSrc("App.tsx");
  const localDb = readSrc("features/shell/LocalDbProvider.tsx");
  const en = readSrc("i18n/locales/en.ts");
  const bn = readSrc("i18n/locales/bn-BD.ts");

  assert(index.includes("SyncQueuePanel"), "features/sync exports panel");
  assert(panel.includes("listSyncQueue"), "panel lists queue");
  assert(panel.includes("retrySyncEvent"), "panel retries dead rows");
  assert(panel.includes('event.key === "Escape"'), "Esc closes panel");
  assert(panel.includes("syncQueue.retry"), "Retry copy present");
  assert(
    panel.includes('event.key === "Tab"') && panel.includes("preventDefault"),
    "panel must swallow Tab (not a POS navigator)",
  );
  assert(
    panel.includes("ArrowUp") && panel.includes("ArrowDown"),
    "↑/↓ row navigation",
  );
  assert(panel.includes('t("syncQueue.empty")'), "empty state i18n");
  assert(
    !panel.includes("All synchronized"),
    "empty copy must not be hard-coded in the panel",
  );
  assert(!/>\s*Baki\s*</.test(panel) && !/["'`]Baki["'`]/.test(panel), "no Baki");
  assert(!panel.includes("[Tab]"), "no Tab hint in panel");

  assert(
    badge.includes("connectivity.syncQueue") &&
      badge.includes("onOpenSyncQueue"),
    "badge menu has Sync queue",
  );
  assert(
    badge.includes('event.key === "Tab"') && badge.includes("preventDefault"),
    "badge menu swallows Tab",
  );
  assert(
    badge.includes("ArrowUp") && badge.includes("ArrowDown"),
    "badge menu ↑/↓ between Force/Go Online and Sync queue",
  );

  assert(
    settings.includes("settings.openSyncQueue") &&
      settings.includes("onOpenSyncQueue"),
    "Settings Connectivity opens sync queue",
  );
  assert(
    settings.includes("settings.syncPending") &&
      settings.includes("settings.syncFailed") &&
      settings.includes("settings.lastFlush"),
    "Settings shows pending, failed, last flush",
  );

  assert(
    !sidebar.includes("syncQueue") &&
      !sidebar.includes("Sync queue") &&
      !sidebar.includes("sidebar.sync"),
    "no sidebar Sync nav item",
  );
  assert(
    sidebar.includes("sidebar.newSale") &&
      sidebar.includes("sidebar.transactions") &&
      sidebar.includes("sidebar.shift") &&
      sidebar.includes("sidebar.settings"),
    "sidebar still New Sale / Transactions / Shift / Settings",
  );

  assert(shell.includes("SyncQueuePanel"), "AppShell mounts SyncQueuePanel");
  assert(
    !shell.includes("sidebar.sync") && !app.includes("sidebar.sync"),
    "App must not add a Sync sidebar key",
  );
  assert(app.includes("syncQueueOpen") && app.includes("openSyncQueue"), "App mounts queue overlay");

  assert(
    localDb.includes("__r2aMarkHeadSyncDead") &&
      localDb.includes("markSyncDead"),
    "QA helper __r2aMarkHeadSyncDead",
  );

  for (const key of SYNC_I18N_KEYS) {
    assert(en.includes(`"${key}"`), `en missing ${key}`);
    assert(bn.includes(`"${key}"`), `bn-BD missing ${key}`);
  }
}

async function checkQueueUiOrder(): Promise<void> {
  installMemoryStorage();
  __resetLocalDbForTests();
  globalThis.localStorage.clear();
  await ensureLocalDb();

  await enqueueSyncEvent({
    id: "evt-pending",
    entityType: "sale",
    action: "create",
    payload: { eventId: "evt-pending", total: 12.5 },
  });
  await enqueueSyncEvent({
    id: "evt-dead",
    entityType: "sale",
    action: "create",
    payload: { eventId: "evt-dead", total: 40 },
  });
  await markSyncDead("evt-dead", "QA poison");

  const listed = await listSyncQueue();
  assert(listed.length === 2, "list unsynced + dead");
  assert(listed[0]?.id === "evt-dead", "Failed (dead) first");
  assert(listed[0]?.dead === 1 && listed[0]?.lastError === "QA poison", "dead row error");
  assert(listed[1]?.id === "evt-pending" && listed[1]?.dead === 0, "pending after failed");
  assert((await countUnsynced()) === 1, "dead is not pending");
  assert((await countSyncDead()) === 1, "one dead");

  await retrySyncEvent("evt-dead");
  assert((await countSyncDead()) === 0, "retry clears dead");
  assert((await countUnsynced()) === 2, "retried row is pending");
  const after = await listSyncQueue();
  assert(
    after.every((r) => r.dead === 0),
    "retry leaves Failed",
  );
}

async function main() {
  checkSource();
  await checkQueueUiOrder();
  console.log("smoke-m4e PASS", {
    i18nKeys: SYNC_I18N_KEYS.length,
    panel: "features/sync/SyncQueuePanel.tsx",
    noSidebarSync: true,
    retryEsc: true,
  });
}

main().catch((err) => {
  console.error("smoke-m4e FAIL", err);
  process.exit(1);
});
