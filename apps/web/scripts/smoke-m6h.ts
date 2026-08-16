/**
 * M6 Batch H smoke — Owner Sales list.
 * Run: npm run smoke:m6h -w @r2a/web
 *
 * Source guards only (no live API). Sales must call GET /sales, must not
 * hard-code mock TXN-260814-1045, Net Sales copy must not claim returns,
 * and receiptNo must navigate to /sales/:id.
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

const SALES_I18N_KEYS = [
  "sales.subtitle",
  "sales.kpi.gross",
  "sales.kpi.net",
  "sales.kpi.afterDiscounts",
  "sales.paymentBreakdown",
  "sales.topCashier",
  "sales.filter.date",
  "sales.date.today",
  "sales.date.yesterday",
  "sales.date.last7",
  "sales.date.thisMonth",
  "sales.date.custom",
  "sales.searchPlaceholder",
  "sales.empty",
] as const;

function checkPackage(): void {
  const pkg = JSON.parse(readRel("package.json")) as {
    name?: string;
    scripts?: Record<string, string>;
  };
  assert(pkg.name === "@r2a/web", `package name must be @r2a/web, got ${pkg.name}`);
  assert(
    pkg.scripts?.["smoke:m6h"]?.includes("smoke-m6h"),
    "package.json must define smoke:m6h",
  );
  console.log("  ✓ package @r2a/web + smoke:m6h");
}

function checkI18n(): void {
  const en = readSrc("i18n/locales/en.ts");
  const bn = readSrc("i18n/locales/bn-BD.ts");
  for (const key of SALES_I18N_KEYS) {
    assert(
      en.includes(`"${key}"`) && bn.includes(`"${key}"`),
      `${key} must exist in en and bn-BD`,
    );
  }
  assert(
    en.includes("After discounts") && !en.includes("After returns"),
    "Net Sales copy must be discounts only — no returns claim",
  );
  assert(
    !bn.includes("রিটার্ন") || bn.includes("ছাড়ের পর"),
    "bn-BD net sales hint must mention discounts",
  );
  console.log("  ✓ sales i18n keys; Net Sales = discounts (no returns)");
}

function checkSalesFetch(): void {
  const page = readSrc("features/sales/SalesPage.tsx");
  const client = readSrc("lib/salesList.ts");
  const dash = readSrc("lib/ownerDashboard.ts");
  const all = walkTs(SRC)
    .map((p) => readFileSync(p, "utf8"))
    .join("\n");

  assert(
    client.includes("/api/v1/sales") && client.includes("fetchSales"),
    "salesList must call GET /api/v1/sales",
  );
  assert(page.includes("fetchSales"), "SalesPage must fetch GET /sales");
  assert(
    dash.includes("fetchOwnerDashboardRange") &&
      page.includes("fetchOwnerDashboardRange"),
    "Sales KPIs / payment mix / top cashier must come from GET /owner/dashboard",
  );
  assert(
    !/TXN-260814-1045/.test(all),
    "Must not hard-code mock TXN-260814-1045",
  );
  assert(!/842,?450/.test(all) && !/826,?200/.test(all), "Must not hard-code mock KPI totals");
  assert(!/₺/.test(all), "Must use ৳, never ₺");
  assert(
    page.includes("sales.date.today") &&
      page.includes("sales.date.yesterday") &&
      page.includes("sales.date.last7") &&
      page.includes("sales.date.thisMonth") &&
      page.includes("sales.date.custom"),
    "Date filter must include Today / Yesterday / Last 7 days / This month / Custom range",
  );
  console.log("  ✓ live GET /sales; no mock TXN-260814-1045");
}

function checkNavigationAndParked(): void {
  const page = readSrc("features/sales/SalesPage.tsx");
  const shell = readSrc("features/shell/AppShell.tsx");

  assert(
    page.includes("`/sales/${row.id}`"),
    "receiptNo / row click must navigate to /sales/:id",
  );
  assert(
    shell.includes("SaleDetailPage"),
    "/sales/:id must render SaleDetailPage (Batch I)",
  );
  assert(
    page.includes("sales.exportSoon") && page.includes("preventDefault"),
    "Export must be a no-op",
  );
  assert(
    !page.includes("sales.filter.status") && !page.includes("Baki"),
    "Status filter hidden (only Completed); no Baki",
  );
  console.log("  ✓ receiptNo → /sales/:id; Export no-op; no Status/Baki");
}

function main(): void {
  console.log("M6 Batch H smoke (@r2a/web)\n");
  checkPackage();
  checkI18n();
  checkSalesFetch();
  checkNavigationAndParked();
  console.log("\nPASS");
}

try {
  main();
} catch (err) {
  console.error("\nFAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
}
