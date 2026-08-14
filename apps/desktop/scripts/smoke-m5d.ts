/**
 * M5 Batch D smoke — 409 conflict UX on Sync Queue Failed rows.
 * Run: npm run smoke:m5d -w @r2a/desktop
 *
 * Failed rows map last_error → i18n conflict reason + raw last_error.
 * Enter Retry unchanged. No void. Online ingest 4xx stay-on-payment unchanged.
 * Catalog §19 / §20 document 409 UX (M5). No void.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  isSyncConflictLastError,
  QA_SYNC_CONFLICT_LAST_ERROR,
} from "../src/lib/syncConflict";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DESKTOP = join(__dirname, "..");
const ROOT = join(DESKTOP, "..", "..");
const SRC = join(DESKTOP, "src");

function readSrc(rel: string): string {
  return readFileSync(join(SRC, rel), "utf8");
}

function readRepo(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const CONFLICT_I18N_KEYS = ["syncQueue.conflictReason", "syncQueue.retry"] as const;

function hasVoidUi(src: string): boolean {
  return (
    /syncQueue\.void/.test(src) ||
    /void sale/i.test(src) ||
    /discard.?sale/i.test(src) ||
    /delete.?sale/i.test(src)
  );
}

function checkMapper(): void {
  assert(
    isSyncConflictLastError("Insufficient stock"),
    "insufficient stock must map",
  );
  assert(
    isSyncConflictLastError("INSUFFICIENT STOCK on batch NP23091"),
    "case-insensitive insufficient stock must map",
  );
  assert(isSyncConflictLastError("409"), "409 must map");
  assert(
    isSyncConflictLastError("HTTP 409 Conflict"),
    "409 conflict must map",
  );
  assert(
    isSyncConflictLastError("Insufficient stock during sale commit"),
    "ingest commit message must map",
  );
  assert(
    isSyncConflictLastError("No in-stock FEFO batch for product Napa"),
    "FEFO ingest message must map",
  );
  assert(
    isSyncConflictLastError(QA_SYNC_CONFLICT_LAST_ERROR),
    "QA default last_error must map",
  );
  assert(
    !isSyncConflictLastError("unsupported entity_type/action: product/create"),
    "non-stock poison must not map",
  );
  assert(!isSyncConflictLastError("network timeout"), "transient must not map");
  assert(!isSyncConflictLastError(""), "empty must not map");
  assert(!isSyncConflictLastError(null), "null must not map");
  console.log("  ✓ last_error mapper (insufficient stock / 409 / conflict)");
}

function checkPanelAndRetry(): void {
  const panel = readSrc("features/sync/SyncQueuePanel.tsx");
  const helper = readSrc("lib/syncConflict.ts");
  const localDb = readSrc("features/shell/LocalDbProvider.tsx");
  const ingest = readSrc("lib/saleIngest.ts");

  assert(
    helper.includes("isSyncConflictLastError") &&
      helper.includes("insufficient stock") &&
      helper.includes("409"),
    "syncConflict must map insufficient stock / 409",
  );
  assert(
    panel.includes("isSyncConflictLastError") &&
      panel.includes('t("syncQueue.conflictReason")') &&
      panel.includes("lastError"),
    "Failed row must show i18n conflictReason plus raw last_error",
  );
  assert(
    panel.includes("retrySyncEvent") &&
      panel.includes('t("syncQueue.retry")') &&
      panel.includes('event.key === "Enter"'),
    "Enter Retry on Failed must remain retrySyncEvent",
  );
  assert(
    panel.includes('event.key === "Tab"') && panel.includes("preventDefault"),
    "panel must swallow Tab",
  );
  assert(!hasVoidUi(panel), "Sync Queue must not add void / discard-sale / delete-sale");
  assert(
    !panel.includes("syncQueue.void") && !panel.includes("syncQueue.discard"),
    "no void/discard i18n keys on the panel",
  );

  assert(
    localDb.includes("__r2aMarkHeadSyncDead") &&
      localDb.includes("QA_SYNC_CONFLICT_LAST_ERROR") &&
      localDb.includes("markSyncDead"),
    "QA helper __r2aMarkHeadSyncDead must default to 409-style last_error",
  );

  assert(
    ingest.includes("stay on payment") &&
      ingest.includes("isTransientIngestFailure"),
    "online ingest 4xx stay-on-payment must be unchanged",
  );
  assert(
    /4xx[\s\S]{0,80}stay on payment/.test(ingest) ||
      ingest.includes("4xx (validation / 409 stock / 401) stay on payment"),
    "saleIngest 4xx/409 must still stay on payment (do not enqueue)",
  );

  console.log("  ✓ panel conflict copy + Retry; no void; stay-on-payment locked");
}

function checkI18n(): void {
  const en = readSrc("i18n/locales/en.ts");
  const bn = readSrc("i18n/locales/bn-BD.ts");
  for (const key of CONFLICT_I18N_KEYS) {
    assert(en.includes(`"${key}"`), `en.ts missing ${key}`);
    assert(bn.includes(`"${key}"`), `bn-BD.ts missing ${key}`);
  }
  assert(
    /"syncQueue\.conflictReason":/.test(en) &&
      /"syncQueue\.conflictReason":/.test(bn),
    "conflictReason must exist in both locales",
  );
  assert(!hasVoidUi(en) && !hasVoidUi(bn), "i18n must not add void/discard-sale copy");
  console.log("  ✓ i18n conflictReason in en + bn-BD");
}

function checkCatalogStillM5(): void {
  const catalog = readRepo("Completed_API_lists.md");
  assert(
    catalog.includes("409 conflict UX") && catalog.includes("M5"),
    "catalog must document 409 conflict UX as M5 (§19.5 / §20)",
  );
  assert(
    catalog.includes("do not invent void") ||
      catalog.includes("do not invent void here") ||
      catalog.includes("Conflict / void UI is **M5**") ||
      catalog.includes("Still **no** void") ||
      catalog.includes("**No** void"),
    "catalog must still forbid void",
  );
  console.log("  ✓ catalog documents 409 UX (M5) and forbids void");
}

function checkStubsAndGrnUntouched(): void {
  const print = readSrc("lib/printStub.ts");
  const fefo = readSrc("lib/fefoOverrideAuth.ts");
  const receive = readSrc("lib/receiveStock.ts");
  assert(
    print.includes("TODO(real printer IPC)"),
    "print stub TODO must remain",
  );
  assert(
    fefo.includes("STUB_MANAGER_PIN_LENGTH") &&
      fefo.includes("TODO(real integration)") &&
      !fefo.includes("pinHash"),
    "FEFO PIN stub must remain (no pinHash)",
  );
  assert(
    receive.includes("postReceiveLot") && receive.includes("patchReceiveQty"),
    "Receive stock helpers must be unchanged in this batch",
  );
  console.log("  ✓ print stub + FEFO PIN stub + GRN helpers untouched");
}

function main(): void {
  console.log("smoke:m5d — M5 Batch D 409 conflict UX\n");
  checkMapper();
  checkPanelAndRetry();
  checkI18n();
  checkCatalogStillM5();
  checkStubsAndGrnUntouched();
  console.log("\nPASS — smoke:m5d");
}

main();
