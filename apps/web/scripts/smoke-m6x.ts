/**
 * M6 Batch X smoke — Owner Suppliers Directory.
 * Run: npm run smoke:m6x -w @r2a/web
 *
 * Source guards only (no live API). The directory must load via live
 * GET /owner/suppliers (server supplies kpis + attention in meta and per-item
 * stats). KPI cards + table + search + status filter + pagination + attention
 * panel are live. Expiry Returns and Add Supplier navigate to registered
 * subpaths. Review All Issues stays disabled (Batch AA). No hard-coded ৳ totals.
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

const SUPPLIERS_I18N_KEYS = [
  "suppliers.subtitle",
  "suppliers.expiryReturns",
  "suppliers.addSupplier",
  "suppliers.loading",
  "suppliers.error",
  "suppliers.retry",
  "suppliers.empty",
  "suppliers.kpi.active",
  "suppliers.kpi.activeHint",
  "suppliers.kpi.openOrders",
  "suppliers.kpi.openOrdersHint",
  "suppliers.kpi.purchasesMtd",
  "suppliers.kpi.purchasesMtdHint",
  "suppliers.kpi.vsLastMonth",
  "suppliers.kpi.avgDelivery",
  "suppliers.kpi.avgDeliveryHint",
  "suppliers.kpi.avgDeliveryNone",
  "suppliers.kpi.days",
  "suppliers.search",
  "suppliers.searchPlaceholder",
  "suppliers.filter.status",
  "suppliers.filter.all",
  "suppliers.status.active",
  "suppliers.status.hold",
  "suppliers.status.draft",
  "suppliers.col.supplier",
  "suppliers.col.contact",
  "suppliers.col.activeProducts",
  "suppliers.col.lastPurchase",
  "suppliers.col.openOrders",
  "suppliers.col.purchasesMtd",
  "suppliers.showing",
  "suppliers.of",
  "suppliers.suppliers",
  "suppliers.attention.title",
  "suppliers.attention.overdue",
  "suppliers.attention.overdueHint",
  "suppliers.attention.openOrders",
  "suppliers.attention.openOrdersHint",
  "suppliers.attention.expiryReturns",
  "suppliers.attention.expiryReturnsHint",
  "suppliers.attention.onHold",
  "suppliers.attention.onHoldHint",
  "suppliers.attention.review",
  "suppliers.attention.reviewAll",
  "suppliers.attention.reviewAllSoon",
  "suppliers.placeholder.manifestTitle",
  "suppliers.placeholder.manifest",
] as const;

function checkPackage(): void {
  const pkg = JSON.parse(readRel("package.json")) as {
    name?: string;
    scripts?: Record<string, string>;
  };
  assert(pkg.name === "@r2a/web", `package name must be @r2a/web, got ${pkg.name}`);
  assert(
    pkg.scripts?.["smoke:m6x"]?.includes("smoke-m6x"),
    "package.json must define smoke:m6x",
  );
  console.log("  ✓ package @r2a/web + smoke:m6x");
}

function checkI18n(): void {
  const en = readSrc("i18n/locales/en.ts");
  const bn = readSrc("i18n/locales/bn-BD.ts");
  for (const key of SUPPLIERS_I18N_KEYS) {
    assert(
      en.includes(`"${key}"`) && bn.includes(`"${key}"`),
      `${key} must exist in en and bn-BD`,
    );
  }
  console.log("  ✓ suppliers i18n keys in en + bn-BD");
}

function checkSuppliersPage(): void {
  const page = readSrc("features/suppliers/SuppliersPage.tsx");
  const suppliersLib = readSrc("lib/suppliers.ts");
  const shell = readSrc("features/shell/AppShell.tsx");
  const ownerPath = readSrc("lib/ownerPath.ts");
  const all = walkTs(SRC)
    .map((p) => readFileSync(p, "utf8"))
    .join("\n");

  assert(
    suppliersLib.includes("fetchSuppliers") &&
      suppliersLib.includes("/api/v1/owner/suppliers") &&
      suppliersLib.includes("apiRequestEnvelope"),
    "suppliers lib must fetch GET /api/v1/owner/suppliers with an envelope",
  );
  assert(
    suppliersLib.includes("kpis") &&
      suppliersLib.includes("attention") &&
      suppliersLib.includes("stats"),
    "suppliers lib must model kpis, attention, and per-item stats",
  );
  assert(
    page.includes("fetchSuppliers") &&
      page.includes("SuppliersPage"),
    "Suppliers page must render from live fetchSuppliers",
  );
  assert(
    page.includes("formatTaka") &&
      page.includes("formatCount") &&
      page.includes("suppliers.kpi.purchasesMtd"),
    "KPI values must use live ৳/count formatting (no hard-coded totals)",
  );
  assert(
    page.includes("suppliers.kpi.active") &&
      page.includes("suppliers.kpi.openOrders") &&
      page.includes("suppliers.kpi.avgDelivery"),
    "Four KPI cards: active suppliers, open POs, purchases MTD, avg delivery",
  );
  assert(
    page.includes("searchInput") &&
      page.includes("suppliers.searchPlaceholder") &&
      page.includes("FilterDropdown") &&
      page.includes("suppliers.filter.status"),
    "Directory must have search + status filter",
  );
  assert(
    page.includes("suppliers.col.supplier") &&
      page.includes("suppliers.col.activeProducts") &&
      page.includes("suppliers.col.lastPurchase") &&
      page.includes("suppliers.col.openOrders") &&
      page.includes("suppliers.col.purchasesMtd"),
    "Table must include supplier, contact, active products, last purchase, open POs, purchases MTD",
  );
  assert(
    page.includes('navigate(`/suppliers/${encodeURIComponent(row.id)}`)'),
    "Supplier names must link to /suppliers/:supplierId",
  );
  assert(
    page.includes('navigate("/suppliers/returns")') &&
      page.includes('navigate("/suppliers/new")'),
    "CTAs must navigate to /suppliers/returns and /suppliers/new",
  );
  assert(
    page.includes("suppliers.attention.title") &&
      page.includes("suppliers.attention.overdue") &&
      page.includes("suppliers.attention.openOrders") &&
      page.includes("suppliers.attention.expiryReturns") &&
      page.includes("suppliers.attention.onHold"),
    "Attention panel must surface overdue, open, expiry return, and on hold",
  );
  assert(
    page.includes("suppliers.attention.reviewAllSoon") &&
      page.includes('aria-disabled="true"'),
    "Review All Issues must stay disabled (Batch AA)",
  );
  assert(
    page.includes("Pagination") &&
      page.includes("suppliers.showing") &&
      page.includes("suppliers.of"),
    "Directory must paginate",
  );
  assert(
    shell.includes("SuppliersPage") &&
      shell.includes('sub.kind === "list"') &&
      shell.includes("suppliersSubpath"),
    "AppShell must render SuppliersPage for /suppliers via suppliersSubpath",
  );
  assert(
    shell.includes("AddSupplierPage") &&
      shell.includes("SupplierDetailsPage") &&
      shell.includes("ExpiryReturnsPage") &&
      shell.includes('sub.kind === "detail"') &&
      shell.includes('sub.kind === "returns"') &&
      shell.includes("CreateReturnManifestPage") &&
      shell.includes("suppliers.placeholder.manifest"),
    "AppShell must render Add Supplier, Supplier Details, Expiry Returns, Create Return Manifest, and a placeholder for manifest details",
  );
  assert(
    ownerPath.includes("suppliersSubpath") &&
      ownerPath.includes('parts[0] === "returns"') &&
      ownerPath.includes('parts[0] === "new"'),
    "ownerPath must route returns/new/detail/returns-new/returns-manifest suppliers subpaths",
  );
  assert(
    ownerPath.includes('pathname.startsWith("/suppliers/")'),
    "isLiveOwnerUrl must accept /suppliers/ subpaths",
  );
  assert(
    !/₺/.test(all) && !/\$\d/.test(all),
    "Must not hard-code ₺ or mock dollar totals",
  );
  console.log("  ✓ live GET /owner/suppliers; KPI cards, table, search, attention");
}

function main(): void {
  console.log("M6 Batch X smoke (@r2a/web)\n");
  checkPackage();
  checkI18n();
  checkSuppliersPage();
  console.log("\nPASS");
}

try {
  main();
} catch (err) {
  console.error("\nFAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
}