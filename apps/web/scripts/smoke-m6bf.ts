/**
 * M6 Batch BF smoke — Sales Report UI + dashboard View Report enablement.
 * Run: npm run smoke:m6bf -w @r2a/web
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

const KEYS = [
  "reports.salesReport.title",
  "reports.salesReport.subtitle",
  "reports.salesReport.range.last30",
  "reports.salesReport.kpi.totalSales",
  "reports.salesReport.payment.mfs",
  "reports.salesReport.topMedicines",
  "reports.salesReport.recentTransactions",
  "reports.salesReport.exportHint",
  "reports.salesReport.pagination.prev",
  "reports.salesReport.pagination.next",
] as const;

function checkPackage(): void {
  const pkg = JSON.parse(readRel("package.json")) as { scripts?: Record<string, string> };
  assert(pkg.scripts?.["smoke:m6bf"]?.includes("smoke-m6bf"), "package.json must define smoke:m6bf");
  console.log("  ✓ smoke:m6bf script registered");
}

function checkI18n(): void {
  const en = readSrc("i18n/locales/en.ts");
  const bn = readSrc("i18n/locales/bn-BD.ts");
  for (const key of KEYS) {
    assert(en.includes(`"${key}"`) && bn.includes(`"${key}"`), `${key} must exist in en and bn-BD`);
  }
  console.log("  ✓ Sales Report i18n keys in en + bn-BD");
}

function checkRoutes(): void {
  const ownerPath = readSrc("lib/ownerPath.ts");
  const shell = readSrc("features/shell/AppShell.tsx");
  assert(ownerPath.includes('pathname === "/reports/sales"'), "/reports/sales must be a registered reports subpath");
  assert(ownerPath.includes('pathname.startsWith("/reports/")'), "reports subpaths must be allowed as live URLs");
  assert(shell.includes("SalesReportPage") && shell.includes('sub.kind === "sales"'), "AppShell must route /reports/sales to SalesReportPage");
  console.log("  ✓ /reports/sales route registered");
}

function checkClientAndPage(): void {
  const client = readSrc("lib/ownerReports.ts");
  const page = readSrc("features/reports/SalesReportPage.tsx");
  const dashboard = readSrc("features/reports/ReportsDashboardPage.tsx");
  assert(client.includes("/api/v1/owner/reports/sales"), "Sales Report client must call the BE endpoint");
  assert(page.includes("fetchSalesReport"), "Sales Report page must fetch live report data");
  assert(page.includes("visibleMedicines") && page.includes("visibleTransactions"), "Sales Report tables must render paginated visible rows");
  assert(page.includes("MEDICINES_PAGE_SIZE") && page.includes("TRANSACTIONS_PAGE_SIZE"), "Top medicines and recent transactions must have local pagination");
  assert(page.includes('navigate(`/sales/${sale.saleId}`)'), "Recent transaction invoice rows must link to sale details");
  assert(page.includes('navigate("/staff/shifts")'), "Staff performance CTA must link to shift/staff performance surface");
  assert(page.includes("disabled") && page.includes('t("reports.salesReport.exportHint")'), "Export Report must remain disabled with a hint");
  assert(page.includes("PaginationControls"), "Sales Report must include pagination controls");
  assert(page.indexOf('className="flex min-w-0 flex-col gap-4"') < page.indexOf('title={t("reports.salesReport.bestCategory")'), "Main report tables must sit in the main column before the right rail to avoid the large layout gap");
  assert(dashboard.includes('navigate("/reports/sales")'), "Reports Dashboard Sales View Report must navigate to /reports/sales");
  assert(!page.includes("৳2,45,600") && !page.includes("1,240") && !page.includes("Seclo 20mg"), "Sales Report page must not hard-code mock KPI/table values");
  console.log("  ✓ Sales Report uses live data and enabled dashboard CTA");
}

function main(): void {
  console.log("M6 Batch BF smoke (@r2a/web)\n");
  checkPackage();
  checkI18n();
  checkRoutes();
  checkClientAndPage();
  console.log("\nPASS");
}

try {
  main();
} catch (err) {
  console.error("\nFAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
}
