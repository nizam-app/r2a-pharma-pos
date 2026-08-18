/**
 * M6 Batch Z smoke — Owner Supplier Details page.
 * Run: npm run smoke:m6z -w @r2a/web
 *
 * Source guards only (no live API). The page is live on GET /owner/suppliers/:id
 * (OWNER only) and renders KPIs, info, performance, the purchase-order table and
 * the products-supplied table from computed values — never invented numbers.
 * View All POs / View All Products stay disabled (Purchasing/Inventory cannot
 * filter by supplier yet). No Edit Supplier.
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "src");
const SERVER_SERVICE = join(
  ROOT,
  "..",
  "server",
  "src",
  "modules",
  "purchasing",
  "purchasing.service.ts",
);

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

const DETAIL_I18N_KEYS = [
  "suppliers.detail.crumb",
  "suppliers.detail.loading",
  "suppliers.detail.error",
  "suppliers.detail.notFound",
  "suppliers.detail.back",
  "suppliers.detail.createPo",
  "suppliers.detail.kpi.purchases12m",
  "suppliers.detail.kpi.purchases12mHint",
  "suppliers.detail.kpi.expiryReturnRate",
  "suppliers.detail.kpi.expiryReturnRateHint",
  "suppliers.detail.kpi.activeProductsHint",
  "suppliers.detail.info.title",
  "suppliers.detail.info.supplier",
  "suppliers.detail.info.contact",
  "suppliers.detail.info.phone",
  "suppliers.detail.info.email",
  "suppliers.detail.info.lastPurchase",
  "suppliers.detail.info.openOrders",
  "suppliers.detail.info.paymentTerms",
  "suppliers.detail.info.status",
  "suppliers.detail.performance.title",
  "suppliers.detail.performance.onTime",
  "suppliers.detail.performance.shortSupply",
  "suppliers.detail.performance.expiryAccepted",
  "suppliers.detail.performance.avgCreditNote",
  "suppliers.detail.performance.noData",
  "suppliers.detail.performance.accepted",
  "suppliers.detail.performance.notAccepted",
  "suppliers.detail.po.title",
  "suppliers.detail.po.col.number",
  "suppliers.detail.po.col.created",
  "suppliers.detail.po.col.expected",
  "suppliers.detail.po.col.total",
  "suppliers.detail.po.col.status",
  "suppliers.detail.po.empty",
  "suppliers.detail.po.viewAll",
  "suppliers.detail.po.viewAllSoon",
  "suppliers.detail.products.title",
  "suppliers.detail.products.col.medicine",
  "suppliers.detail.products.col.stock",
  "suppliers.detail.products.col.cost",
  "suppliers.detail.products.col.status",
  "suppliers.detail.products.empty",
  "suppliers.detail.products.viewAll",
  "suppliers.detail.products.viewAllSoon",
  "suppliers.detail.products.status.inStock",
  "suppliers.detail.products.status.lowStock",
  "suppliers.detail.products.status.outOfStock",
] as const;

function checkPackage(): void {
  const pkg = JSON.parse(readRel("package.json")) as {
    name?: string;
    scripts?: Record<string, string>;
  };
  assert(pkg.name === "@r2a/web", `package name must be @r2a/web, got ${pkg.name}`);
  assert(
    pkg.scripts?.["smoke:m6z"]?.includes("smoke-m6z"),
    "package.json must define smoke:m6z",
  );
  console.log("  ✓ package @r2a/web + smoke:m6z");
}

function checkI18n(): void {
  const en = readSrc("i18n/locales/en.ts");
  const bn = readSrc("i18n/locales/bn-BD.ts");
  for (const key of DETAIL_I18N_KEYS) {
    assert(
      en.includes(`"${key}"`) && bn.includes(`"${key}"`),
      `${key} must exist in en and bn-BD`,
    );
  }
  assert(
    !en.includes('"suppliers.placeholder.detail"') &&
      !bn.includes('"suppliers.placeholder.detail"'),
    "superseded detail-placeholder keys must be removed",
  );
  console.log("  ✓ suppliers.detail i18n keys in en + bn-BD");
}

function checkClientLib(): void {
  const suppliersLib = readSrc("lib/suppliers.ts");
  assert(
    suppliersLib.includes("fetchSupplierDetail") &&
      suppliersLib.includes("/api/v1/owner/suppliers/") &&
      suppliersLib.includes("apiRequest"),
    "suppliers lib must fetch supplier detail from GET /owner/suppliers/:id",
  );
  assert(
    suppliersLib.includes("export type SupplierDetail") &&
      suppliersLib.includes("export type SupplierFull") &&
      suppliersLib.includes("purchases12m") &&
      suppliersLib.includes("onTimeDeliveryPct") &&
      suppliersLib.includes("purchaseOrders") &&
      suppliersLib.includes("products"),
    "SupplierDetail/SupplierFull must type KPIs, performance, POs and products",
  );
  console.log("  ✓ lib/suppliers.ts fetchSupplierDetail + SupplierDetail types");
}

function checkSupplierDetailsPage(): void {
  const page = readSrc("features/suppliers/SupplierDetailsPage.tsx");
  const shell = readSrc("features/shell/AppShell.tsx");
  const all = walkTs(SRC)
    .map((p) => readFileSync(p, "utf8"))
    .join("\n");

  assert(
    page.includes("fetchSupplierDetail") &&
      page.includes("suppliers.detail.notFound"),
    "Page must load the supplier live with a 404-aware error state",
  );
  assert(
    page.includes('onNavigate("/suppliers/returns")') &&
      page.includes("suppliers.expiryReturns"),
    "Header must include the Expiry Returns action",
  );
  assert(
    page.includes('onNavigate("/purchasing/new")') &&
      page.includes("suppliers.detail.createPo"),
    "Header must include the Create Purchase Order action",
  );
  assert(
    page.includes("suppliers.detail.kpi.purchases12m") &&
      page.includes("suppliers.kpi.avgDelivery") &&
      page.includes("suppliers.detail.kpi.expiryReturnRate") &&
      page.includes("suppliers.col.activeProducts"),
    "KPI row must include Purchases 12 Months, Avg. Delivery, Expiry Return Rate, Active Products",
  );
  assert(
    page.includes("suppliers.detail.info.title") &&
      page.includes("suppliers.detail.info.lastPurchase") &&
      page.includes("suppliers.detail.info.openOrders"),
    "Supplier Information card must include last purchase and open POs",
  );
  assert(
    page.includes("suppliers.detail.performance.title") &&
      page.includes("suppliers.detail.performance.onTime") &&
      page.includes("suppliers.detail.performance.shortSupply") &&
      page.includes("suppliers.detail.performance.expiryAccepted") &&
      page.includes("suppliers.detail.performance.avgCreditNote"),
    "Performance card must include on-time, short supply, expiry accepted and credit note time",
  );
  assert(
    page.includes("suppliers.detail.po.title") &&
      page.includes("suppliers.detail.po.col.number") &&
      page.includes("suppliers.detail.po.col.total") &&
      page.includes("purchasing.status.received"),
    "PO table must list PO number, created, expected, total and status",
  );
  assert(
    page.includes("suppliers.detail.products.title") &&
      page.includes("suppliers.detail.products.col.medicine") &&
      page.includes("suppliers.detail.products.col.stock") &&
      page.includes("suppliers.detail.products.col.cost") &&
      page.includes("suppliers.detail.products.status.inStock"),
    "Products Supplied table must list medicine, stock, cost and status",
  );
  assert(
    page.includes("suppliers.detail.po.viewAllSoon") &&
      page.includes("suppliers.detail.products.viewAllSoon") &&
      page.includes("disabled"),
    "View All POs and View All Products must stay disabled",
  );
  assert(
    page.includes("suppliers.detail.po.empty") &&
      page.includes("suppliers.detail.products.empty"),
    "Empty states must be present for POs and products",
  );
  assert(
    page.includes("formatTaka") &&
      page.includes("formatPct") &&
      page.includes("formatCount") &&
      page.includes("formatUtcDate"),
    "Values must render with ৳ / % / count / UTC-date formatters",
  );
  assert(
    shell.includes("SupplierDetailsPage") &&
      shell.includes('sub.kind === "detail"') &&
      shell.includes("suppliersSubpath"),
    "AppShell must render SupplierDetailsPage for /suppliers/:id via suppliersSubpath",
  );
  assert(
    !/EditSupplierPage/.test(all) && !page.includes("suppliers.edit"),
    "No Edit Supplier route may exist",
  );
  assert(
    !/₂|₺/.test(all) &&
      !/\$\d/.test(all) &&
      !/2,480,000/.test(all) &&
      !/2480000/.test(all) &&
      !/94%/.test(all) &&
      !/1\.8%/.test(all) &&
      !/2\.4 days/.test(all),
    "Must not hard-code ₺, mock dollar totals, or the decorative sample KPIs (৳2,480,000 / 94% / 1.8% / 2.4 days)",
  );
  console.log("  ✓ SupplierDetailsPage renders honest computed KPIs, tables + disabled View All");
}

function checkServer(): void {
  const service = readFileSync(SERVER_SERVICE, "utf8");
  assert(
    service.includes("async function supplierDetail") &&
      service.includes("detail: await supplierDetail"),
    "GET /owner/suppliers/:id must return an additive detail payload",
  );
  assert(
    service.includes("purchases12m") &&
      service.includes("avgDeliveryDays") &&
      service.includes("expiryReturnRatePct") &&
      service.includes("activeProducts") &&
      service.includes("openOrders") &&
      service.includes("lastPurchaseAt"),
    "Server detail KPIs must cover purchases 12m, delivery, return rate, active products, open orders, last purchase",
  );
  assert(
    service.includes("onTimeDeliveryPct") &&
      service.includes("shortSupplyPct") &&
      service.includes("expiryReturnsAcceptedPct") &&
      service.includes("avgCreditNoteDays"),
    "Server detail performance must cover on-time, short supply, expiry accepted and credit note time",
  );
  assert(
    service.includes("supplierBatches") &&
      service.includes("poSourceLines") &&
      service.includes("stockByProduct"),
    "Products supplied must come from batches + PO lines with live stock",
  );
  console.log("  ✓ server purchasing.service.ts supplierDetail payload");
}

function main(): void {
  console.log("M6 Batch Z smoke (@r2a/web)\n");
  checkPackage();
  checkI18n();
  checkClientLib();
  checkSupplierDetailsPage();
  checkServer();
  console.log("\nPASS");
}

try {
  main();
} catch (err) {
  console.error("\nFAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
}