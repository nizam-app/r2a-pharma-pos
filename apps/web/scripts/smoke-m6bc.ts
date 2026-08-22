/**
 * M6 Batch BC smoke — Reports nav + Reports Dashboard.
 * Run: npm run smoke:m6bc -w @r2a/web
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

const REPORT_KEYS = [
  "reports.title",
  "reports.subtitle",
  "reports.kpi.totalSales",
  "reports.kpi.purchaseValue",
  "reports.kpi.inventoryValue",
  "reports.kpi.activeStaff",
  "reports.sales.title",
  "reports.inventory.title",
  "reports.purchasing.title",
  "reports.staff.title",
  "reports.staff.viewShiftReports",
  "reports.shift.view",
  "reports.disabledHint",
] as const;

function checkPackage(): void {
  const pkg = JSON.parse(readRel("package.json")) as { scripts?: Record<string, string> };
  assert(pkg.scripts?.["smoke:m6bc"]?.includes("smoke-m6bc"), "package.json must define smoke:m6bc");
  console.log("  ✓ smoke:m6bc script registered");
}

function checkI18n(): void {
  const en = readSrc("i18n/locales/en.ts");
  const bn = readSrc("i18n/locales/bn-BD.ts");
  for (const key of REPORT_KEYS) {
    assert(en.includes(`"${key}"`) && bn.includes(`"${key}"`), `${key} must exist in en and bn-BD`);
  }
  console.log("  ✓ reports i18n keys in en + bn-BD");
}

function checkRoutes(): void {
  const nav = readSrc("features/shell/nav.ts");
  const ownerPath = readSrc("lib/ownerPath.ts");
  const shell = readSrc("features/shell/AppShell.tsx");
  assert(nav.includes('id: "reports"') && nav.includes('path: "/reports"') && nav.includes("live: true"), "Reports nav must be live at /reports");
  assert(ownerPath.includes('"/reports"') && ownerPath.includes('if (path === "/reports") return "nav.reports"'), "ownerPath must register /reports");
  assert(shell.includes("ReportsDashboardPage") && shell.includes('path === "/reports"'), "AppShell must route /reports to ReportsDashboardPage");
  console.log("  ✓ Reports nav and route registered");
}

function checkDashboard(): void {
  const page = readSrc("features/reports/ReportsDashboardPage.tsx");
  assert(page.includes('fetchOwnerDashboard("last7")'), "reports dashboard must use live owner dashboard data");
  assert(page.includes("fetchInventorySummary"), "reports dashboard must use live inventory summary");
  assert(page.includes("fetchPurchaseOrders"), "reports dashboard must use live purchase order summary");
  assert(page.includes("fetchShiftKpis"), "reports dashboard must use live shift KPI counts");
  assert(page.includes('navigate("/staff/shifts")'), "Shift report links must navigate to /staff/shifts");
  assert(page.includes("disabled") && page.includes('t("reports.disabledHint")'), "Sales/Inventory/Purchase report detail actions must stay disabled");
  assert(!page.includes("৳2,45,600") && !page.includes("৳98,500"), "reports dashboard must not hard-code mock KPI totals");
  console.log("  ✓ Reports Dashboard composes live widgets and parks detail reports");
}

function main(): void {
  console.log("M6 Batch BC smoke (@r2a/web)\n");
  checkPackage();
  checkI18n();
  checkRoutes();
  checkDashboard();
  console.log("\nPASS");
}

try {
  main();
} catch (err) {
  console.error("\nFAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
}
