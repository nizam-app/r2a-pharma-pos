/**
 * M6 Batch U smoke — Owner Create Purchase Order.
 * Run: npm run smoke:m6u -w @r2a/web
 *
 * Source guards only (no live API). Create PO must use live GET /owner/suppliers
 * for the supplier dropdown, GET /owner/inventory for product search + low/out
 * suggestions, GET /owner/inventory-summary for replenishment impact, and
 * POST /owner/purchase-orders to create. Delivery branch must come from the
 * locked JWT store (useTenantChrome). Must offer Save as Draft / Create / Cancel
 * with Add Suggested Items inline, must never change inventory (no GRN / batch
 * writes), and must not hard-code mock totals.
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

const CREATE_I18N_KEYS = [
  "purchasing.create.crumb",
  "purchasing.create.title",
  "purchasing.create.subtitle",
  "purchasing.create.loading",
  "purchasing.create.loadError",
  "purchasing.create.retry",
  "purchasing.create.orderDetails",
  "purchasing.create.supplier",
  "purchasing.create.supplierPlaceholder",
  "purchasing.create.supplierRequired",
  "purchasing.create.noActiveSuppliers",
  "purchasing.create.reference",
  "purchasing.create.referencePlaceholder",
  "purchasing.create.expectedDelivery",
  "purchasing.create.expectedDeliveryHint",
  "purchasing.create.tax",
  "purchasing.create.taxHint",
  "purchasing.create.branch",
  "purchasing.create.branchLocked",
  "purchasing.create.items",
  "purchasing.create.itemsHint",
  "purchasing.create.search",
  "purchasing.create.searchPlaceholder",
  "purchasing.create.searchLoading",
  "purchasing.create.searchEmpty",
  "purchasing.create.emptyLines",
  "purchasing.create.add",
  "purchasing.create.col.product",
  "purchasing.create.col.stock",
  "purchasing.create.col.qty",
  "purchasing.create.col.cost",
  "purchasing.create.col.total",
  "purchasing.create.col.action",
  "purchasing.create.lineStock",
  "purchasing.create.lineStockLow",
  "purchasing.create.lineStockOut",
  "purchasing.create.remove",
  "purchasing.create.suggestions.title",
  "purchasing.create.suggestions.addAll",
  "purchasing.create.suggestions.hint",
  "purchasing.create.suggestions.empty",
  "purchasing.create.suggestions.currentStock",
  "purchasing.create.suggestions.lastCost",
  "purchasing.create.summary.title",
  "purchasing.create.summary.items",
  "purchasing.create.summary.subtotal",
  "purchasing.create.summary.tax",
  "purchasing.create.summary.total",
  "purchasing.create.summary.empty",
  "purchasing.create.impact.title",
  "purchasing.create.impact.outOfStock",
  "purchasing.create.impact.lowStock",
  "purchasing.create.impact.hint",
  "purchasing.create.cancel",
  "purchasing.create.saveDraft",
  "purchasing.create.savingDraft",
  "purchasing.create.submit",
  "purchasing.create.submitting",
  "purchasing.create.validation",
  "purchasing.create.submitError",
  "purchasing.create.unsavedTitle",
  "purchasing.create.unsavedBody",
  "purchasing.create.keepEditing",
  "purchasing.create.discardChanges",
] as const;

function checkPackage(): void {
  const pkg = JSON.parse(readRel("package.json")) as {
    name?: string;
    scripts?: Record<string, string>;
  };
  assert(pkg.name === "@r2a/web", `package name must be @r2a/web, got ${pkg.name}`);
  assert(
    pkg.scripts?.["smoke:m6u"]?.includes("smoke-m6u"),
    "package.json must define smoke:m6u",
  );
  console.log("  ✓ package @r2a/web + smoke:m6u");
}

function checkI18n(): void {
  const en = readSrc("i18n/locales/en.ts");
  const bn = readSrc("i18n/locales/bn-BD.ts");
  for (const key of CREATE_I18N_KEYS) {
    assert(
      en.includes(`"${key}"`) && bn.includes(`"${key}"`),
      `${key} must exist in en and bn-BD`,
    );
  }
  console.log("  ✓ purchasing.create i18n keys in en + bn-BD");
}

function checkCreatePage(): void {
  const page = readSrc("features/purchasing/CreatePurchaseOrderPage.tsx");
  const suppliersLib = readSrc("lib/suppliers.ts");
  const poLib = readSrc("lib/purchaseOrders.ts");
  const shell = readSrc("features/shell/AppShell.tsx");
  const all = walkTs(SRC)
    .map((p) => readFileSync(p, "utf8"))
    .join("\n");

  assert(
    suppliersLib.includes("/api/v1/owner/suppliers") &&
      suppliersLib.includes("fetchActiveSuppliers"),
    "suppliers lib must call GET /api/v1/owner/suppliers",
  );
  assert(
    poLib.includes("createPurchaseOrder") &&
      poLib.includes('"/api/v1/owner/purchase-orders"') &&
      poLib.includes('method: "POST"'),
    "purchaseOrders lib must POST /api/v1/owner/purchase-orders",
  );
  assert(
    page.includes("CreatePurchaseOrderPage") &&
      page.includes("fetchActiveSuppliers"),
    "CreatePurchaseOrderPage must load suppliers for the dropdown",
  );
  assert(
    page.includes("fetchOwnerInventory") && page.includes("fetchInventorySummary"),
    "Create PO must use live inventory search + replenishment summary",
  );
  assert(
    page.includes("useTenantChrome") && page.includes("storeName"),
    "Delivery branch must come from the locked JWT store",
  );
  assert(
    page.includes('handleSubmit("DRAFT")') &&
      page.includes('handleSubmit("SENT")'),
    "Must offer Save as Draft (DRAFT) and Create (SENT)",
  );
  assert(
    page.includes("purchasing.create.cancel") && page.includes('navigate("/purchasing")'),
    "Cancel must return to the purchasing list",
  );
  assert(
    page.includes("purchasing.create.suggestions.title") &&
      page.includes("addLine") &&
      page.includes("suggestions"),
    "Add Suggested Items must be inline on the Create PO page",
  );
  assert(
    page.includes("purchasing.create.summary.total") && page.includes("formatTaka"),
    "Order summary must format totals live",
  );
  assert(
    shell.includes("CreatePurchaseOrderPage") &&
      shell.includes('sub.kind === "new"'),
    "AppShell must render CreatePurchaseOrderPage for /purchasing/new",
  );
  assert(
    !/purchase-orders\/[^/]+\/receipts/.test(page) &&
      !/\/owner\/batches/.test(page) &&
      !/receipts/.test(poLib),
    "Create PO must not write stock (no GRN or batch mutation)",
  );
  assert(
    !/698,?150/.test(all) && !/₺/.test(all),
    "Must not hard-code mock totals or use ₺",
  );
  console.log("  ✓ live suppliers + inventory + POST purchase-orders; no stock writes");
}

function main(): void {
  console.log("M6 Batch U smoke (@r2a/web)\n");
  checkPackage();
  checkI18n();
  checkCreatePage();
  console.log("\nPASS");
}

try {
  main();
} catch (err) {
  console.error("\nFAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
}