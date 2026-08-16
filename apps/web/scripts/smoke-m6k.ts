/**
 * M6 Batch K smoke — Owner Product Details.
 * Run: npm run smoke:m6k -w @r2a/web
 *
 * Source guards only (no live API). Detail must call GET /owner/products/:id,
 * use the live product id from the route, disable Edit Product and View
 * Inventory History, Receive Stock → receive route. No Add Product form.
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

const DETAIL_I18N_KEYS = [
  "inventory.detail.crumb",
  "inventory.detail.summary",
  "inventory.detail.edit",
  "inventory.detail.fefoTitle",
  "inventory.detail.fefoHint",
  "inventory.detail.conversionDisplay",
  "inventory.detail.status.fefo",
  "inventory.detail.unitsHint",
  "inventory.detail.activity.receive",
  "inventory.detail.activity.sale",
  "inventory.detail.history",
  "inventory.receiveStock",
] as const;

function checkPackage(): void {
  const pkg = JSON.parse(readRel("package.json")) as {
    name?: string;
    scripts?: Record<string, string>;
  };
  assert(pkg.name === "@r2a/web", `package name must be @r2a/web, got ${pkg.name}`);
  assert(
    pkg.scripts?.["smoke:m6k"]?.includes("smoke-m6k"),
    "package.json must define smoke:m6k",
  );
  console.log("  ✓ package @r2a/web + smoke:m6k");
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
  console.log("  ✓ product-detail i18n keys in en + bn-BD");
}

function checkDetailFetch(): void {
  const page = readSrc("features/inventory/ProductDetailPage.tsx");
  const client = readSrc("lib/ownerProduct.ts");
  const shell = readSrc("features/shell/AppShell.tsx");
  const all = walkTs(SRC)
    .map((p) => readFileSync(p, "utf8"))
    .join("\n");

  assert(
    client.includes("/api/v1/owner/products/") &&
      client.includes("fetchOwnerProduct"),
    "ownerProduct must call GET /api/v1/owner/products/:id",
  );
  assert(
    page.includes("fetchOwnerProduct") && page.includes("productId"),
    "ProductDetailPage must fetch live product id",
  );
  assert(
    shell.includes("ProductDetailPage") &&
      shell.includes('kind === "detail"') &&
      shell.includes("sub.productId"),
    "AppShell must render ProductDetailPage on /inventory/:productId",
  );
  assert(
    !/1,?280/.test(all) && !/1280/.test(all),
    "Must not hard-code mock 1,280 stock",
  );
  assert(!/NP25018/.test(all), "Must not hard-code mock batch NP25018");
  assert(!/₺/.test(all), "Must use ৳, never ₺");
  console.log("  ✓ live GET /owner/products/:id; no mock stock");
}

function checkLocks(): void {
  const page = readSrc("features/inventory/ProductDetailPage.tsx");
  const later = readSrc("features/inventory/InventoryLaterPage.tsx");

  assert(
    page.includes("inventory.detail.edit") &&
      page.includes("disabled") &&
      page.includes("inventory.detail.editSoon"),
    "Edit Product must be disabled",
  );
  assert(
    page.includes("inventory.detail.history") &&
      page.includes("inventory.detail.historySoon"),
    "View Inventory History must be disabled",
  );
  assert(
    page.includes("`/inventory/${encodeURIComponent(product.id)}/receive`") &&
      page.includes("inventory.receiveStock"),
    "Receive Stock must navigate to the receive route",
  );
  assert(
    page.includes("fefoRank") && page.includes("inventory.detail.status.fefo"),
    "FEFO rank / Recommended badge required",
  );
  assert(
    page.includes("product.events") &&
      page.includes("inventory.detail.activity.sale") &&
      page.includes("inventory.detail.activity.receive"),
    "Recent InventoryEvents must render",
  );
  assert(
    !page.includes("POST /products") &&
      !page.includes("/api/v1/products") &&
      !page.includes("method: \"POST\""),
    "Do not build Add Product form in Batch K",
  );
  assert(
    page.includes("product.name") && !page.includes("t(product.name"),
    "Medicine names must stay untranslated",
  );
  assert(
    page.includes("lot.batchNumber") && !page.includes("t(lot.batch"),
    "Batch numbers must stay untranslated",
  );
  assert(
    later.includes("inventory.later.expiry") &&
      !later.includes("kind: \"detail\"") &&
      !later.includes("fetchOwnerProduct"),
    "Expiry stays a placeholder; Product Details does not",
  );
  assert(
    !page.includes("Baki") && !page.includes("on-account"),
    "No Baki / on-account",
  );
  console.log("  ✓ Edit disabled / Receive route / FEFO / events");
}

function main(): void {
  console.log("M6 Batch K smoke (@r2a/web)\n");
  checkPackage();
  checkI18n();
  checkDetailFetch();
  checkLocks();
  console.log("\nPASS");
}

try {
  main();
} catch (err) {
  console.error("\nFAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
}
