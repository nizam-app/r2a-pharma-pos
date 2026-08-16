/**
 * M6 Batch G smoke — Owner Dashboard screen.
 * Run: npm run smoke:m6g -w @r2a/web
 *
 * Source guards only (no live API). Dashboard must call GET /owner/dashboard,
 * must not hard-code mock KPIs, and recent rows must navigate to /sales/:id.
 */

import { readFileSync, readdirSync } from "node:fs";
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

function walkTs(dir: string, acc: string[] = []): string[] {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) walkTs(p, acc);
    else if (ent.name.endsWith(".ts") || ent.name.endsWith(".tsx")) acc.push(p);
  }
  return acc;
}

const DASH_I18N_KEYS = [
  "dashboard.kpi.todaySales",
  "dashboard.kpi.netProfit",
  "dashboard.salesOverview",
  "dashboard.inventoryHealth",
  "dashboard.fefoTitle",
  "dashboard.recentSales",
  "dashboard.viewAllSales",
  "dashboard.emptySales",
  "dashboard.error",
  "dashboard.range.last7",
] as const;

function checkPackage(): void {
  const pkg = JSON.parse(readRel("package.json")) as {
    name?: string;
    scripts?: Record<string, string>;
  };
  assert(pkg.name === "@r2a/web", `package name must be @r2a/web, got ${pkg.name}`);
  assert(
    pkg.scripts?.["smoke:m6g"]?.includes("smoke-m6g"),
    "package.json must define smoke:m6g",
  );
  console.log("  ✓ package @r2a/web + smoke:m6g");
}

function checkI18n(): void {
  const en = readSrc("i18n/locales/en.ts");
  const bn = readSrc("i18n/locales/bn-BD.ts");
  for (const key of DASH_I18N_KEYS) {
    assert(
      en.includes(`"${key}"`) && bn.includes(`"${key}"`),
      `${key} must exist in en and bn-BD`,
    );
  }
  console.log("  ✓ dashboard i18n keys in en + bn-BD");
}

function checkDashboardFetch(): void {
  const dash = readSrc("features/dashboard/DashboardPage.tsx");
  const client = readSrc("lib/ownerDashboard.ts");
  const all = walkTs(SRC)
    .map((p) => readFileSync(p, "utf8"))
    .join("\n");

  assert(
    client.includes("/api/v1/owner/dashboard") &&
      client.includes("fetchOwnerDashboard"),
    "ownerDashboard must call GET /api/v1/owner/dashboard",
  );
  assert(
    dash.includes("fetchOwnerDashboard"),
    "DashboardPage must fetch owner dashboard",
  );
  assert(
    !/124,?850/.test(all) && !/22,?430/.test(all),
    "Must not hard-code mock ৳124,850 / ৳22,430",
  );
  assert(!/₺/.test(all), "Must use ৳, never ₺");
  assert(
    !/TXN-260814-1045/.test(all),
    "Must not hard-code mock TXN-260814-1045",
  );
  assert(
    readSrc("features/dashboard/SalesOverviewChart.tsx").includes("formatTaka"),
    "Sales overview chart must format amounts with formatTaka",
  );
  assert(
    dash.includes("mfsProvider") &&
      dash.includes("bKash") &&
      dash.includes("Nagad") &&
      dash.includes("Rocket") &&
      dash.includes("#E2136E") &&
      dash.includes("#ED1C24") &&
      dash.includes("#8C3494"),
    "MFS pills must use live mfsProvider + bKash/Nagad/Rocket brand colors",
  );
  console.log("  ✓ live /owner/dashboard; no mock ৳124,850");
}

function checkNavigation(): void {
  const dash = readSrc("features/dashboard/DashboardPage.tsx");
  const paths = readSrc("lib/ownerPath.ts");
  const provider = readSrc("lib/OwnerPathProvider.tsx");

  assert(
    dash.includes('navigate("/sales")') &&
      dash.includes("dashboard.viewAllSales"),
    "View All Sales must navigate to /sales",
  );
  assert(
    dash.includes("`/sales/${id}`") || dash.includes("`/sales/${row.id}`"),
    "Recent sale row must navigate to /sales/:id",
  );
  assert(
    paths.includes("isLiveOwnerUrl") &&
      paths.includes('pathname.startsWith("/sales/")'),
    "ownerPath must keep /sales/:id as a live URL",
  );
  assert(
    provider.includes("isLiveOwnerUrl"),
    "OwnerPathProvider must not rewrite /sales/:id down to /sales",
  );
  assert(
    !dash.includes("/purchasing"),
    "Dashboard must not invent Purchasing flows",
  );
  assert(
    dash.includes("dashboard.staff.viewReports") &&
      dash.includes("dashboard.attention.title"),
    "Bottom Attention Required + Staff & Shifts cards must exist",
  );
  assert(
    dash.includes("dashboard.fefo.viewAudit") &&
      dash.includes("cursor-not-allowed"),
    "View FEFO Audit button must exist and stay parked (Audit & FEFO is later)",
  );
  console.log("  ✓ View All Sales → /sales; row → /sales/:id");
}

function checkFormat(): void {
  const fmt = readSrc("lib/format.ts");
  assert(
    fmt.includes("formatTaka") && fmt.includes("৳") && fmt.includes("en-US"),
    "formatTaka must use ৳ and Latin digits (en-US)",
  );
  const dash = readSrc("features/dashboard/DashboardPage.tsx");
  assert(
    dash.includes("formatTaka") && dash.includes("t("),
    "Dashboard must format ৳ via helper and use t() for chrome",
  );
  console.log("  ✓ ৳ formatter + i18n chrome");
}

function main(): void {
  console.log("M6 Batch G smoke (@r2a/web)\n");
  checkPackage();
  checkI18n();
  checkDashboardFetch();
  checkNavigation();
  checkFormat();
  console.log("\nPASS");
}

try {
  main();
} catch (err) {
  console.error("\nFAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
}
