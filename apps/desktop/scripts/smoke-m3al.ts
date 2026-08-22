/**
 * Batch AL — Slice 5 exit verification (automated checks).
 * Run: npm run smoke:m3al -w @r2a/desktop
 *
 * Static + source guards. Does not start M4 / owner web Create Customer /
 * real printer IPC / card SDK / MFS provider APIs / cloud shift API.
 *
 * Note: do not import modules that pull `import.meta.env`.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatShiftClock,
  formatShiftDuration,
  formatShiftOpenedAt,
} from "../src/lib/shiftStore";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..", "..");
const SRC = join(__dirname, "..", "src");
const SERVER_SRC = join(ROOT, "apps", "server", "src");

function readSrc(rel: string): string {
  return readFileSync(join(SRC, rel), "utf8");
}

function readRepo(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function readServer(rel: string): string {
  return readFileSync(join(SERVER_SRC, rel), "utf8");
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function checkShiftStoreHelpers(): void {
  const iso = "2026-08-12T08:42:00.000Z";
  const opened = formatShiftOpenedAt(iso);
  assert(/\d{2}:\d{2}/.test(opened), "openedAt must use Latin HH:MM");
  assert(!/[০-৯]/.test(opened), "openedAt must not use Bengali digits");
  const clock = formatShiftClock(iso);
  assert(/^\d{2}:\d{2}$/.test(clock), "clock HH:MM");
  const dur = formatShiftDuration(iso, new Date(iso).getTime() + 125 * 60_000);
  assert(dur === "2h 5m", `duration expected 2h 5m got ${dur}`);

  const storeSrc = readSrc("lib/shiftStore.ts");
  assert(
    storeSrc.includes("TODO(cloud)") && storeSrc.includes("localStorage"),
    "shiftStore must be local + document cloud TODO",
  );
  assert(
    storeSrc.includes("pharmasync.shift"),
    "shift key prefix pharmasync.shift",
  );
  console.log("  ✓ shiftStore helpers + local TODO");
}

function checkShiftUiWiring(): void {
  const panel = readSrc("features/shift/ShiftPanel.tsx");
  assert(panel.includes("Open Shift") === false || panel.includes('t("shift.openShift")'), "Open Shift via i18n");
  assert(panel.includes('t("shift.openShift")'), "openShift key");
  assert(panel.includes('t("shift.closeShift")'), "closeShift key");
  assert(panel.includes("ConfirmDialog"), "close confirm");
  assert(panel.includes('event.key === "Tab"'), "Tab blocked");
  assert(panel.includes("ArrowLeft") && panel.includes("ArrowRight"), "←/→ CTAs");
  assert(!/>\s*Baki\s*</.test(panel) && !/["'`]Baki["'`]/.test(panel), "no Baki");

  const sidebar = readSrc("features/shell/Sidebar.tsx");
  assert(
    sidebar.includes("onOpenShift") && sidebar.includes("shiftOpen"),
    "Sidebar Shift wired (not coming-soon stub only)",
  );
  assert(
    sidebar.includes("shiftOpen ? navActiveClass"),
    "Shift uses active nav class when open",
  );

  const shell = readSrc("features/shell/AppShell.tsx");
  assert(shell.includes("ShiftPanel"), "AppShell mounts ShiftPanel");

  const app = readSrc("App.tsx");
  assert(app.includes("shiftOpen") && app.includes("setShiftOpen"), "App shift state");
  assert(app.includes("shiftEpoch"), "Counter Ready epoch bump");
  assert(app.includes("onOpenShift"), "App wires onOpenShift");
  assert(
    app.includes("shift.requiredForSale") &&
      app.includes("shiftStore.get") &&
      app.includes("setShiftOpen(true)"),
    "New Sale must soft-gate on open shift (toast + open Shift panel)",
  );

  const counter = readSrc("features/counter/CounterReadyScreen.tsx");
  assert(
    counter.includes("shiftStore") && counter.includes("counter.noActiveShift"),
    "Counter Ready reads active shift",
  );
  assert(
    !counter.includes("Morning (08:00 - 16:00)"),
    "stub Morning shift copy must be gone",
  );

  const en = readSrc("i18n/locales/en.ts");
  const bn = readSrc("i18n/locales/bn-BD.ts");
  for (const key of [
    "shift.title",
    "shift.openShift",
    "shift.closeShift",
    "shift.requiredForSale",
    "counter.noActiveShift",
    "counter.shiftOpenSince",
  ]) {
    assert(en.includes(`"${key}"`), `en missing ${key}`);
    assert(bn.includes(`"${key}"`), `bn-BD missing ${key}`);
  }
  console.log("  ✓ Shift UI + Counter Ready + i18n");
}

function checkSlice5DoD(): void {
  // F4
  const f4 = readSrc("features/pos/GenericSubstitutesModal.tsx");
  assert(f4.length > 100, "GenericSubstitutesModal present");
  const app = readSrc("App.tsx");
  assert(app.includes("F4") || app.includes('"F4"'), "F4 wired in App");
  assert(app.includes("GenericSubstitutesModal") || app.includes("substitutes"), "F4 modal path");

  // Pharmacy header → receipt
  assert(
    readSrc("lib/pharmacyHeaderStore.ts").includes("pharmasync.pharmacyHeader"),
    "pharmacyHeaderStore",
  );
  const receipt = readSrc("lib/receiptModel.ts");
  assert(
    receipt.includes("resolvePharmacyHeader") ||
      receipt.includes("pharmacyHeaderStore"),
    "receipt resolves pharmacy header",
  );

  // Force Offline
  assert(
    readSrc("lib/forceOfflineStore.ts").includes("pharmasync.forceOffline"),
    "forceOfflineStore",
  );
  const conn = readSrc("features/shell/ConnectivityProvider.tsx");
  assert(
    conn.includes("forceOffline") || conn.includes("forcedOffline"),
    "ConnectivityProvider force offline",
  );

  // Transactions list + detail + reprint
  assert(
    readSrc("lib/transactionLogStore.ts").includes("pharmasync.transactionLog"),
    "transactionLogStore",
  );
  assert(
    readSrc("features/transactions/TransactionsPanel.tsx").includes("list"),
    "TransactionsPanel",
  );
  assert(
    readSrc("features/transactions/TransactionDetailView.tsx").includes(
      "Reprint",
    ) ||
      readSrc("features/transactions/TransactionDetailView.tsx").includes(
        "reprint",
      ),
    "Transaction detail reprint",
  );

  // Create Customer check
  const selectCustomer = readSrc("features/pos/SelectCustomerModal.tsx");
  assert(
    selectCustomer.includes("mode === \"create\"") || selectCustomer.includes("Register Customer"),
    "SelectCustomerModal must implement Create Customer flow",
  );

  // POST customers is role-aware (Owner/Manager/Cashier can create)
  const customerRouter = readServer("modules/customer/customer.router.ts");
  assert(
    !customerRouter.includes('restrictTo("OWNER")'),
    'POST /customers must not be restricted to OWNER only',
  );

  // No M4 flush
  assert(!/sync\/ingest/.test(app), "App must not call M4 sync/ingest");
  assert(
    !readSrc("features/shell/LocalDbProvider.tsx").includes("flushQueue") ||
      readSrc("features/shell/LocalDbProvider.tsx").includes("TODO"),
    "no M4 flush worker required — soft",
  );

  // Catalog §17
  const catalog = readRepo("Completed_API_lists.md");
  assert(
    catalog.includes("## 17. M3 Slice 5") ||
      catalog.includes("## 17. M3 Slice 5 —"),
    "Completed_API_lists.md must have §17 Slice 5",
  );
  assert(
    catalog.includes("Shift") && catalog.includes("Force Offline"),
    "§17 documents Shift + Force Offline",
  );

  console.log("  ✓ Slice 5 DoD source checklist");
}

async function main(): Promise<void> {
  console.log("smoke:m3al — Slice 5 exit (Batch AL)\n");
  checkShiftStoreHelpers();
  checkShiftUiWiring();
  checkSlice5DoD();
  console.log("\nPASS — smoke:m3al");
}

main().catch((err) => {
  console.error("\nFAIL — smoke:m3al");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
