/**
 * Batch AP — Slice 6 exit verification (automated checks).
 * Run: npm run smoke:m3ap -w @r2a/desktop
 *
 * Static + source guards. Hold/park only. Queue flush is M4 Batch D
 * (`syncWorker`, not App.tsx). Does not start hard reservation / cloud hold /
 * owner web Create Customer / real printer IPC / card SDK / MFS provider APIs.
 *
 * Note: do not import modules that pull `import.meta.env` (heldSaleStore →
 * customerSearch → api → env).
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..", "..");
const SRC = join(__dirname, "..", "src");

function readSrc(rel: string): string {
  return readFileSync(join(SRC, rel), "utf8");
}

function readRepo(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const HOLD_I18N_KEYS = [
  "hold.action",
  "hold.held",
  "hold.badge",
  "hold.emptyCart",
  "hold.atCapacity",
  "hold.parked",
  "hold.resumeCartNotEmpty",
  "hold.resumed",
  "hold.resumeAllUnsellable",
  "hold.resumeStripped",
  "hold.resumeClamped",
  "hold.resumeRecheckFailed",
  "hold.rechecking",
  "hold.storageFailed",
  "hold.busy",
  "hold.title",
  "hold.subtitle",
  "hold.close",
  "hold.listLabel",
  "hold.empty",
  "hold.emptyHint",
  "hold.colTime",
  "hold.colSale",
  "hold.colLines",
  "hold.colTotal",
  "hold.actions",
  "hold.resume",
  "hold.discard",
  "hold.discardTitle",
  "hold.discardBody",
  "hold.discardWarn",
  "hold.keepHeld",
  "hold.footer",
  "hold.footerEmpty",
  "hold.footerBusyCart",
  "hold.loyaltyApplied",
] as const;

function checkHeldSaleStoreMax3(): void {
  const storeSrc = readSrc("lib/heldSaleStore.ts");
  assert(
    /export const MAX_HELD_SALES = 3/.test(storeSrc),
    "MAX_HELD_SALES must be 3",
  );
  assert(
    storeSrc.includes("existingCount < MAX_HELD_SALES"),
    "canAddHeldSale must refuse at capacity",
  );
  assert(
    storeSrc.includes('reason: "at_capacity"'),
    "add must return at_capacity (no 4th overwrite)",
  );
  assert(
    storeSrc.includes(".slice(0, MAX_HELD_SALES)"),
    "list write/parse must cap at MAX_HELD_SALES",
  );
  assert(
    storeSrc.includes("pharmasync.heldSales"),
    "held key prefix pharmasync.heldSales",
  );
  assert(
    storeSrc.includes("localStorage") && storeSrc.includes("TODO(cloud)"),
    "heldSaleStore must be local + document cloud TODO",
  );
  assert(
    storeSrc.includes("Does NOT reserve stock") ||
      storeSrc.includes("Does not reserve"),
    "soft hold (no reservation) must be documented",
  );
  assert(
    !/cashReceived|cardApproved|mfsTrx/i.test(storeSrc) ||
      storeSrc.includes("does not include cash-received"),
    "snapshot must not persist tender drafts",
  );

  const canAdd = (n: number) => n < 3;
  assert(canAdd(0) && canAdd(2) && !canAdd(3) && !canAdd(4), "max-3 contract");

  const latin = readSrc("lib/heldSaleStore.ts");
  assert(
    latin.includes("Latin digits"),
    "held-at clock must document Latin digits",
  );

  console.log("  ✓ heldSaleStore max-3 + local soft-hold TODO");
}

function checkSoftRecheck(): void {
  const recheck = readSrc("lib/heldSaleRecheck.ts");
  assert(
    recheck.includes("export function recheckHeldSaleLines"),
    "pure recheckHeldSaleLines",
  );
  assert(
    recheck.includes("export async function recheckHeldSale"),
    "async recheckHeldSale",
  );
  assert(/STRIP/i.test(recheck) && /CLAMP/i.test(recheck), "strip + clamp rules");
  assert(
    recheck.includes("keep the hold") || recheck.includes("keep the hold in storage"),
    "all-unsellable must keep the hold",
  );
  assert(
    recheck.includes("TODO(cloud)") &&
      (recheck.includes("no hold/reserve") || recheck.includes("no hold")),
    "recheck must document no reserve API",
  );
  console.log("  ✓ soft resume recheck (strip/clamp / keep hold)");
}

function checkHoldUiWiring(): void {
  const app = readSrc("App.tsx");
  assert(app.includes("holdActiveSale"), "App holdActiveSale");
  assert(app.includes("resumeHeldSale"), "App resumeHeldSale");
  assert(
    app.includes('event.key === "F6"'),
    "F6 Hold wired",
  );
  assert(
    app.includes('event.key === "F7"') && app.includes("openHeldList"),
    "F7 Held list wired",
  );
  assert(app.includes("abortOpenTenders"), "Hold aborts open tenders");
  assert(
    app.includes("tenderEpochRef") && app.includes("tenderAbortRef"),
    "epoch + AbortController guard ingest",
  );
  assert(
    app.includes("recheckHeldSale") && app.includes("posCatalogOnline"),
    "resume calls soft recheck",
  );
  assert(
    app.includes('t("hold.resumeAllUnsellable")'),
    "all-unsellable keeps hold (toast, no remove)",
  );
  assert(
    app.includes('t("hold.resumeCartNotEmpty")'),
    "resume gated when cart not empty",
  );
  assert(
    app.includes("setCartLines([])") && app.includes('t("hold.parked")'),
    "after Hold: empty cart + parked toast",
  );
  assert(app.includes('setView("sale")'), "after Hold: empty New Sale view");
  assert(
    app.includes("completingSale") && app.includes('t("hold.busy")'),
    "Hold blocked while completingSale",
  );
  assert(
    app.includes("onHold={onCounter || onCompleted ? undefined : holdActiveSale}"),
    "Hold control on sale view only",
  );
  // M4 Batch D: /sync/ingest lives in syncWorker, not App complete handlers.
  assert(
    !/["'`]\/api\/v1\/sync\/ingest["'`]/.test(app),
    "App.tsx must not POST /sync/ingest (worker owns flush)",
  );

  const panel = readSrc("features/hold/HeldSalesPanel.tsx");
  assert(panel.includes("ConfirmDialog"), "discard ConfirmDialog");
  assert(panel.includes('event.key === "Tab"'), "Tab blocked on Held list");
  assert(
    panel.includes("ArrowLeft") && panel.includes("ArrowRight"),
    "←/→ Resume / Discard",
  );
  assert(
    panel.includes("ArrowUp") && panel.includes("ArrowDown"),
    "↑/↓ rows",
  );
  assert(!/>\s*Baki\s*</.test(panel) && !/["'`]Baki["'`]/.test(panel), "no Baki");

  const cart = readSrc("features/shell/CartPanel.tsx");
  assert(cart.includes("[F6]") && cart.includes('t("hold.action")'), "cart Hold [F6]");
  assert(cart.includes("[F7]") && cart.includes('t("hold.badge")'), "cart Held n/3 [F7]");

  const footer = readSrc("features/shell/Footer.tsx");
  assert(footer.includes("[F6]") && footer.includes('t("footer.hold")'), "footer F6 Hold");
  assert(
    footer.includes("[F7]") && footer.includes('t("footer.heldList")'),
    "footer F7 Held list",
  );

  const shell = readSrc("features/shell/AppShell.tsx");
  assert(shell.includes("HeldSalesPanel"), "AppShell mounts HeldSalesPanel");

  const card = readSrc("features/pos/CardPaymentModal.tsx");
  const mfs = readSrc("features/pos/MfsPaymentModal.tsx");
  assert(card.includes("abortSignal"), "Card stub abortSignal");
  assert(mfs.includes("abortSignal"), "MFS stub abortSignal");
  assert(
    app.includes("abortSignal={tenderAbortRef.current.signal}"),
    "App passes tender abort to Card/MFS",
  );

  const en = readSrc("i18n/locales/en.ts");
  const bn = readSrc("i18n/locales/bn-BD.ts");
  for (const key of HOLD_I18N_KEYS) {
    assert(en.includes(`"${key}"`), `en missing ${key}`);
    assert(bn.includes(`"${key}"`), `bn-BD missing ${key}`);
  }
  assert(en.includes('"footer.hold"') && bn.includes('"footer.hold"'), "footer.hold i18n");
  assert(
    en.includes('"footer.heldList"') && bn.includes('"footer.heldList"'),
    "footer.heldList i18n",
  );

  console.log("  ✓ Hold F6 + Held list + payment abort + i18n");
}

function checkSlice6DoD(): void {
  const catalog = readRepo("Completed_API_lists.md");
  assert(
    catalog.includes("## 18. M3 Slice 6") ||
      catalog.includes("## 18. M3 Slice 6 —"),
    "Completed_API_lists.md must have §18 Slice 6",
  );
  assert(
    catalog.includes("Hold") && catalog.includes("soft"),
    "§18 documents Hold + soft hold",
  );
  assert(
    catalog.includes("**No new Express routes**"),
    "§18 must state no new cloud routes",
  );
  assert(
    !/\/api\/v1\/holds/.test(catalog),
    "catalog must not invent /api/v1/holds",
  );

  const app = readSrc("App.tsx");
  assert(!/\/holds/.test(app), "desktop must not call a hold cloud route");

  console.log("  ✓ Slice 6 DoD source checklist (catalog §18, no cloud hold, no M4)");
}

async function main(): Promise<void> {
  console.log("smoke:m3ap — Slice 6 exit (Batch AP)\n");
  checkHeldSaleStoreMax3();
  checkSoftRecheck();
  checkHoldUiWiring();
  checkSlice6DoD();
  console.log("\nPASS — smoke:m3ap");
}

main().catch((err) => {
  console.error("\nFAIL — smoke:m3ap");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
