/**
 * M6 Batch BA smoke — Shift Details Open + Closed balanced.
 * Run: npm run smoke:m6ba -w @r2a/web
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "src");

function readRel(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function readSrc(rel: string): string {
  return readFileSync(join(SRC, rel), "utf8");
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const DETAIL_KEYS = [
  "shifts.detail.loading",
  "shifts.detail.error",
  "shifts.detail.back",
  "shifts.detail.viewPosActivity",
  "shifts.detail.cashSummary",
  "shifts.detail.salesSummary",
  "shifts.detail.activity",
  "shifts.detail.audit",
  "shifts.detail.payment.cash",
  "shifts.detail.payment.card",
  "shifts.detail.payment.mfs",
  "shifts.detail.activity.OPENED",
  "shifts.detail.activity.CLOSE_SUBMITTED",
] as const;

function checkPackage(): void {
  const pkg = JSON.parse(readRel("package.json")) as { scripts?: Record<string, string> };
  assert(pkg.scripts?.["smoke:m6ba"]?.includes("smoke-m6ba"), "package.json must define smoke:m6ba");
  console.log("  ✓ smoke:m6ba script registered");
}

function checkI18n(): void {
  const en = readSrc("i18n/locales/en.ts");
  const bn = readSrc("i18n/locales/bn-BD.ts");
  for (const key of DETAIL_KEYS) {
    assert(en.includes(`"${key}"`) && bn.includes(`"${key}"`), `${key} must exist in en and bn-BD`);
  }
  console.log("  ✓ shift detail i18n keys in en + bn-BD");
}

function checkClient(): void {
  const lib = readSrc("lib/shifts.ts");
  assert(lib.includes("fetchShiftDetail"), "shift client must export fetchShiftDetail");
  assert(lib.includes("/api/v1/owner/shifts/${encodeURIComponent(shiftId)}"), "fetchShiftDetail must call owner shift detail endpoint");
  assert(lib.includes("ShiftActivityRow") && lib.includes("ShiftPaymentBreakdown"), "shift detail must type activity and payment breakdown");
  console.log("  ✓ typed live shift detail client");
}

function checkRoute(): void {
  const shell = readSrc("features/shell/AppShell.tsx");
  const index = readSrc("features/staff/index.ts");
  assert(shell.includes("ShiftDetailPage") && shell.includes("shiftId={sub.shiftId}"), "AppShell must route /staff/shifts/:id to ShiftDetailPage");
  assert(index.includes("ShiftDetailPage"), "staff barrel must export ShiftDetailPage");
  console.log("  ✓ /staff/shifts/:id route renders detail page");
}

function checkPage(): void {
  const page = readSrc("features/staff/ShiftDetailPage.tsx");
  assert(page.includes("fetchShiftDetail"), "ShiftDetailPage must fetch live shift detail");
  assert(page.includes("Cash Summary") === false, "ShiftDetailPage must localize Cash Summary");
  assert(page.includes('t("shifts.detail.cashSummary")'), "ShiftDetailPage must render cash summary section");
  assert(page.includes('t("shifts.detail.salesSummary")'), "ShiftDetailPage must render sales/payment summary section");
  assert(page.includes('t("shifts.detail.activity")') && page.includes('t("shifts.detail.audit")'), "ShiftDetailPage must render activity and audit sections");
  assert(page.includes("disabled title={t(\"shifts.disabled.requestCashCountHint\")}"), "Request Cash Count must stay disabled with localized hint");
  assert(page.includes("buildPosActivityUrl") && page.includes("params.set(\"userId\"") && page.includes("params.set(\"from\""), "View POS Activity must build filtered sales URL");
  assert(page.includes("resolveVariance") === false && page.includes("resolve-variance") === false, "Batch BA must not wire BB variance resolution");
  console.log("  ✓ live shift detail page sections and BA scope guards");
}

function main(): void {
  console.log("M6 Batch BA smoke (@r2a/web)\n");
  checkPackage();
  checkI18n();
  checkClient();
  checkRoute();
  checkPage();
  console.log("\nPASS");
}

try {
  main();
} catch (err) {
  console.error("\nFAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
}
