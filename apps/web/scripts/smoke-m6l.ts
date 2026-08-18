/**
 * M6 Batch L smoke — Owner Add Product.
 * Run: npm run smoke:m6l -w @r2a/web
 *
 * Source guards only (no live API required for this test).
 * Add Product form must call POST /api/v1/products, use unit hierarchy
 * (Piece base, optional Strip/Box), support extended fields (Rx, cold chain,
 * reorder level, storage notes), have 0 initial stock notice, and route to
 * Product Details on success.
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

const ADD_I18N_KEYS = [
  "inventory.add.crumb",
  "inventory.add.title",
  "inventory.add.subtitle",
  "inventory.add.basicInfo",
  "inventory.add.name",
  "inventory.add.generic",
  "inventory.add.manufacturer",
  "inventory.add.strength",
  "inventory.add.form",
  "inventory.add.unitsSection",
  "inventory.add.unitPiece",
  "inventory.add.unitStrip",
  "inventory.add.unitBox",
  "inventory.add.additionalSection",
  "inventory.add.requiresRx",
  "inventory.add.coldChain",
  "inventory.add.isActive",
  "inventory.add.stockNoticeTitle",
  "inventory.add.unitPreviewTitle",
  "inventory.add.tipsTitle",
  "inventory.add.submit",
  "inventory.add.cancel",
] as const;

function checkPackage(): void {
  const pkg = JSON.parse(readRel("package.json")) as {
    name?: string;
    scripts?: Record<string, string>;
  };
  assert(pkg.name === "@r2a/web", `package name must be @r2a/web, got ${pkg.name}`);
  assert(
    pkg.scripts?.["smoke:m6l"]?.includes("smoke-m6l"),
    "package.json must define smoke:m6l",
  );
  console.log("  ✓ package @r2a/web + smoke:m6l");
}

function checkI18n(): void {
  const en = readSrc("i18n/locales/en.ts");
  const bn = readSrc("i18n/locales/bn-BD.ts");
  for (const key of ADD_I18N_KEYS) {
    assert(
      en.includes(`"${key}"`) && bn.includes(`"${key}"`),
      `${key} must exist in en and bn-BD`,
    );
  }
  console.log("  ✓ add-product i18n keys in en + bn-BD");
}

function checkAddProductForm(): void {
  const page = readSrc("features/inventory/AddProductPage.tsx");
  const form = readSrc("features/inventory/ProductForm.tsx");
  const client = readSrc("lib/ownerProduct.ts");
  const shell = readSrc("features/shell/AppShell.tsx");
  const all = walkTs(SRC)
    .map((p) => readFileSync(p, "utf8"))
    .join("\n");

  assert(
    client.includes("/api/v1/products") &&
      client.includes("createOwnerProduct") &&
      client.includes('method: "POST"'),
    "ownerProduct must define createOwnerProduct calling POST /api/v1/products",
  );
  assert(
    page.includes("createOwnerProduct"),
    "AddProductPage must submit via createOwnerProduct",
  );
  assert(
    shell.includes("AddProductPage") &&
      shell.includes('kind === "new"'),
    "AppShell must render AddProductPage on sub.kind === 'new' (/inventory/new)",
  );
  assert(
    form.includes("name") &&
      form.includes("genericName") &&
      form.includes("manufacturer") &&
      form.includes("strength") &&
      form.includes("form") &&
      form.includes("sku") &&
      form.includes("barcode") &&
      form.includes("category"),
    "AddProductPage must include core product catalog fields",
  );
  assert(
    form.includes("requiresPrescription") &&
      form.includes("coldChain") &&
      form.includes("reorderLevel") &&
      form.includes("storageNotes"),
    "AddProductPage must support extended fields (Rx, coldChain, reorderLevel, storageNotes)",
  );
  assert(
    form.includes("unitType: \"PIECE\"") &&
      form.includes("unitType: \"STRIP\"") &&
      form.includes("unitType: \"BOX\""),
    "AddProductPage must support packaging unit hierarchy (Piece, Strip, Box)",
  );
  assert(
    form.includes("initialStockTitle") ||
      form.includes("Initial Stock: 0") ||
      form.includes("0 pcs"),
    "Must clearly show 0 initial stock notice",
  );
  assert(
    !page.includes("/api/v1/batches") &&
      !page.includes("batchNumber") &&
      !form.includes("/api/v1/batches"),
    "Must not create stock batches in Add Product form",
  );
  assert(
    page.includes("ProductForm") && form.includes("EMPTY_PRODUCT_FORM"),
    "Add Product must use the reusable ProductForm with empty defaults",
  );
  assert(!form.includes('name: "Napa 500mg"'), "Add Product must not be demo-prefilled");
  assert(!/₺/.test(all), "Must use ৳, never ₺");
  console.log("  ✓ shared ProductForm + POST /api/v1/products + units + 0 stock");
}

function checkLocks(): void {
  const expiry = readSrc("features/inventory/ExpiryManagementPage.tsx");
  assert(
    expiry.includes("fetchOwnerExpiry"),
    "Expiry must be live after Batch N",
  );
  console.log("  ✓ Expiry is live after Batch N");
}

function main(): void {
  console.log("M6 Batch L smoke (@r2a/web)\n");
  checkPackage();
  checkI18n();
  checkAddProductForm();
  checkLocks();
  console.log("\nPASS");
}

try {
  main();
} catch (err) {
  console.error("\nFAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
}
