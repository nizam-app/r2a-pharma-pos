/**
 * M6 Batch AZ smoke — Staff Shift Management button + shifts list.
 * Run: npm run smoke:m6az -w @r2a/web
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

const SHIFT_KEYS = [
  "staff.shiftManagement",
  "staff.shifts.placeholder.detailTitle",
  "staff.shifts.placeholder.detailHint",
  "shifts.title",
  "shifts.subtitle",
  "shifts.kpi.all",
  "shifts.kpi.open",
  "shifts.kpi.closed",
  "shifts.kpi.flagged",
  "shifts.tab.all",
  "shifts.tab.open",
  "shifts.tab.closed",
  "shifts.tab.flagged",
  "shifts.filter.cashier",
  "shifts.col.shift",
  "shifts.col.cashier",
  "shifts.col.variance",
  "shifts.reviewPlaceholder",
] as const;

function checkPackage(): void {
  const pkg = JSON.parse(readRel("package.json")) as { scripts?: Record<string, string> };
  assert(pkg.scripts?.["smoke:m6az"]?.includes("smoke-m6az"), "package.json must define smoke:m6az");
  console.log("  ✓ smoke:m6az script registered");
}

function checkI18n(): void {
  const en = readSrc("i18n/locales/en.ts");
  const bn = readSrc("i18n/locales/bn-BD.ts");
  for (const key of SHIFT_KEYS) {
    assert(en.includes(`"${key}"`) && bn.includes(`"${key}"`), `${key} must exist in en and bn-BD`);
  }
  console.log("  ✓ shift list i18n keys in en + bn-BD");
}

function checkClient(): void {
  const lib = readSrc("lib/shifts.ts");
  assert(lib.includes("/api/v1/owner/shifts"), "shift client must call /api/v1/owner/shifts");
  assert(lib.includes("fetchShiftKpis") && lib.includes("status: \"OPEN\"") && lib.includes("status: \"FLAGGED\""), "shift KPIs must come from live shift list meta counts");
  console.log("  ✓ live shift client and KPI meta derivation");
}

function checkRoutes(): void {
  const ownerPath = readSrc("lib/ownerPath.ts");
  const shell = readSrc("features/shell/AppShell.tsx");
  assert(ownerPath.includes('parts[0] === "shifts"'), "ownerPath must parse /staff/shifts before staff detail params");
  assert(shell.includes("ShiftManagementPage") && shell.includes('sub.kind === "shifts"'), "AppShell must route /staff/shifts to ShiftManagementPage");
  console.log("  ✓ /staff/shifts route registered");
}

function checkPages(): void {
  const staff = readSrc("features/staff/StaffPage.tsx");
  const shifts = readSrc("features/staff/ShiftManagementPage.tsx");
  assert(staff.includes('navigate("/staff/shifts")') && staff.includes('t("staff.shiftManagement")'), "Staff page must expose Shift Management button");
  assert(shifts.includes("fetchShifts") && shifts.includes("fetchShiftKpis"), "ShiftManagementPage must load live shifts and KPI counts");
  assert(shifts.includes('t("shifts.tab.open")') && shifts.includes('t("shifts.tab.flagged")'), "ShiftManagementPage must render status tabs");
  assert(shifts.includes("FilterDropdown") && shifts.includes('t("shifts.filter.cashier")'), "ShiftManagementPage must render cashier filter");
  assert(shifts.includes("Review in Batch BB") === false, "Review placeholder must be localized, not hard-coded English");
  console.log("  ✓ Staff CTA and live Shift Management list page");
}

function main(): void {
  console.log("M6 Batch AZ smoke (@r2a/web)\n");
  checkPackage();
  checkI18n();
  checkClient();
  checkRoutes();
  checkPages();
  console.log("\nPASS");
}

try {
  main();
} catch (err) {
  console.error("\nFAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
}
