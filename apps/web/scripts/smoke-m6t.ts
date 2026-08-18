/**
 * M6 Batch T smoke — Owner Purchasing list.
 * Run: npm run smoke:m6t -w @r2a/web
 *
 * Source guards only (no live API). Purchasing must call GET /owner/purchase-orders
 * for the list and status KPIs, use /owner/inventory-summary for replenishment
 * attention, keep View All Receipts + Review Reorder Suggestions disabled, must
 * not hard-code mock totals like ৳698,150, and must not build the Create PO form.
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

const PURCHASING_I18N_KEYS = [
  "purchasing.subtitle",
  "purchasing.createPo",
  "purchasing.viewAllReceipts",
  "purchasing.viewAllReceiptsSoon",
  "purchasing.loading",
  "purchasing.error",
  "purchasing.retry",
  "purchasing.empty",
  "purchasing.kpi.total",
  "purchasing.kpi.drafts",
  "purchasing.kpi.open",
  "purchasing.kpi.openHint",
  "purchasing.kpi.received",
  "purchasing.kpi.receivedHint",
  "purchasing.kpi.openValue",
  "purchasing.kpi.openValueHint",
  "purchasing.search",
  "purchasing.searchPlaceholder",
  "purchasing.filter.status",
  "purchasing.filter.all",
  "purchasing.status.draft",
  "purchasing.status.sent",
  "purchasing.status.partial",
  "purchasing.status.received",
  "purchasing.col.po",
  "purchasing.col.supplier",
  "purchasing.col.created",
  "purchasing.col.expected",
  "purchasing.col.lines",
  "purchasing.col.receipts",
  "purchasing.col.total",
  "purchasing.col.status",
  "purchasing.col.action",
  "purchasing.receive",
  "purchasing.receiveSoon",
  "purchasing.items",
  "purchasing.showing",
  "purchasing.of",
  "purchasing.orders",
  "purchasing.attention.title",
  "purchasing.attention.outOfStock",
  "purchasing.attention.outOfStockHint",
  "purchasing.attention.lowStock",
  "purchasing.attention.lowStockHint",
  "purchasing.attention.reorderSuggestions",
  "purchasing.attention.reorderSoon",
  "purchasing.placeholder.newTitle",
  "purchasing.placeholder.detailTitle",
  "purchasing.placeholder.receiveTitle",
  "purchasing.placeholder.editTitle",
  "purchasing.placeholder.new",
  "purchasing.placeholder.detail",
  "purchasing.placeholder.receive",
  "purchasing.placeholder.edit",
] as const;

function checkPackage(): void {
  const pkg = JSON.parse(readRel("package.json")) as {
    name?: string;
    scripts?: Record<string, string>;
  };
  assert(pkg.name === "@r2a/web", `package name must be @r2a/web, got ${pkg.name}`);
  assert(
    pkg.scripts?.["smoke:m6t"]?.includes("smoke-m6t"),
    "package.json must define smoke:m6t",
  );
  console.log("  ✓ package @r2a/web + smoke:m6t");
}

function checkI18n(): void {
  const en = readSrc("i18n/locales/en.ts");
  const bn = readSrc("i18n/locales/bn-BD.ts");
  for (const key of PURCHASING_I18N_KEYS) {
    assert(
      en.includes(`"${key}"`) && bn.includes(`"${key}"`),
      `${key} must exist in en and bn-BD`,
    );
  }
  console.log("  ✓ purchasing i18n keys in en + bn-BD");
}

function checkPurchasingFetch(): void {
  const page = readSrc("features/purchasing/PurchasingPage.tsx");
  const client = readSrc("lib/purchaseOrders.ts");
  const inv = readSrc("lib/ownerInventory.ts");
  const all = walkTs(SRC)
    .map((p) => readFileSync(p, "utf8"))
    .join("\n");

  assert(
    client.includes("/api/v1/owner/purchase-orders") &&
      client.includes("fetchPurchaseOrders"),
    "purchaseOrders lib must call GET /api/v1/owner/purchase-orders",
  );
  assert(
    page.includes("fetchPurchaseOrders") && page.includes("kpis"),
    "PurchasingPage must fetch the live PO list and its KPIs",
  );
  assert(
    inv.includes("/api/v1/owner/inventory-summary") &&
      page.includes("fetchInventorySummary"),
    "Replenishment attention must come from GET /api/v1/owner/inventory-summary",
  );
  assert(
    !/698,?150/.test(all),
    "Must not hard-code mock ৳698,150 or similar open value",
  );
  assert(!/₺/.test(all), "Must use ৳, never ₺");
  console.log("  ✓ live GET /owner/purchase-orders + inventory-summary; no mock totals");
}

function checkParkedAndNavigation(): void {
  const page = readSrc("features/purchasing/PurchasingPage.tsx");
  const shell = readSrc("features/shell/AppShell.tsx");
  const path = readSrc("lib/ownerPath.ts");

  assert(
    page.includes("purchasing.viewAllReceiptsSoon") &&
      page.includes("purchasing.viewAllReceipts") &&
      page.includes("preventDefault"),
    "View All Receipts must stay disabled",
  );
  assert(
    page.includes("purchasing.attention.reorderSoon") &&
      page.includes("purchasing.attention.reorderSuggestions"),
    "Review Reorder Suggestions must stay disabled",
  );
  assert(
    page.includes(`"/purchasing/new"`),
    "Create PO must navigate to /purchasing/new",
  );
  assert(
    page.includes("`/purchasing/${row.id}/receive`"),
    "Receive must navigate to /purchasing/:poId/receive",
  );
  assert(
    page.includes("`/purchasing/${row.id}`"),
    "PO number / row must navigate to /purchasing/:poId",
  );
  assert(
    path.includes("purchasingSubpath") && path.includes("/purchasing/"),
    "ownerPath must register purchasing subpaths as live",
  );
  assert(
    shell.includes("PurchasingPage") &&
      shell.includes("purchasingSubpath") &&
      shell.includes("PurchasingPlaceholder"),
    "AppShell must render PurchasingPage + localized placeholders",
  );
  assert(
    !/features\/purchasing\/\w+Form/.test(JSON.stringify(walkTs(join(SRC, "features/purchasing")))),
    "Create PO form must not be built in Batch T",
  );
  console.log("  ✓ disabled View All Receipts / Reorder Suggestions; navigation wired");
}

function main(): void {
  console.log("M6 Batch T smoke (@r2a/web)\n");
  checkPackage();
  checkI18n();
  checkPurchasingFetch();
  checkParkedAndNavigation();
  console.log("\nPASS");
}

try {
  main();
} catch (err) {
  console.error("\nFAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
}