/** Owner Web Missing Features W2 smoke — Edit Product source guards. */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "src");

function readRel(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

function readSrc(path: string): string {
  return readFileSync(join(SRC, path), "utf8");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function checkPackageAndI18n(): void {
  const pkg = JSON.parse(readRel("package.json")) as {
    scripts?: Record<string, string>;
  };
  assert(pkg.scripts?.["smoke:web-w2"]?.includes("web-w2-smoke"), "package must define smoke:web-w2");
  const en = readSrc("i18n/locales/en.ts");
  const bn = readSrc("i18n/locales/bn-BD.ts");
  for (const key of [
    "inventory.edit.title",
    "inventory.edit.save",
    "inventory.edit.saving",
    "inventory.productForm.unsavedTitle",
    "inventory.productForm.keepEditing",
    "inventory.productForm.discardChanges",
    "inventory.productForm.invalidHierarchy",
    "inventory.productForm.unitWarning",
    "inventory.productForm.pricesManaged",
  ]) {
    assert(en.includes(`"${key}"`) && bn.includes(`"${key}"`), `${key} must exist in both locales`);
  }
  console.log("  ✓ W2 script and en/bn-BD translations");
}

function checkRouteAndButton(): void {
  const paths = readSrc("lib/ownerPath.ts");
  const shell = readSrc("features/shell/AppShell.tsx");
  const detail = readSrc("features/inventory/ProductDetailPage.tsx");
  assert(paths.includes('kind: "edit"') && paths.includes('parts[1] === "edit"'), "edit route must parse before product detail");
  assert(shell.includes("EditProductPage") && shell.includes('sub.kind === "edit"'), "AppShell must render EditProductPage");
  assert(detail.includes("/edit`") && detail.includes("onClick={onEdit}"), "Product Details Edit button must be enabled");
  console.log("  ✓ /inventory/:productId/edit route and enabled button");
}

function checkEditFlow(): void {
  const client = readSrc("lib/ownerProduct.ts");
  const edit = readSrc("features/inventory/EditProductPage.tsx");
  const form = readSrc("features/inventory/ProductForm.tsx");
  const add = readSrc("features/inventory/AddProductPage.tsx");
  assert(client.includes("updateOwnerProduct") && client.includes('method: "PATCH"'), "client must PATCH /products/:id");
  assert(edit.includes("fetchOwnerProduct(productId)") && edit.includes("productToFormValues(product)"), "Edit page must load and prefill live product");
  assert(edit.includes("nullable(values.genericName)") && edit.includes("reorderLevel: values.reorderLevel"), "Edit page must send null when optional fields are cleared");
  assert(edit.includes("isActive: values.isActive") && edit.includes("units: values.units"), "Edit page must patch active state and complete units");
  assert(form.includes("setNavigationBlocker") && form.includes("beforeunload") && form.includes("pendingNavigation"), "ProductForm must protect dirty state");
  assert(form.includes('role="dialog"') && form.includes("discardChanges") && !form.includes("window.confirm"), "In-app navigation must use a professional modal, not window.confirm");
  assert(form.includes("boxFactor % values.stripFactor") && form.includes("unitWarning"), "ProductForm must validate and warn on unit changes");
  assert(add.includes("ProductForm") && edit.includes("ProductForm"), "Add and Edit must share ProductForm");
  assert(!form.includes("costPerBase") && !form.includes("sellPerBase"), "Product form must not edit batch prices");
  assert(!form.includes('name: "Napa 500mg"'), "Product form must not use demo defaults");
  console.log("  ✓ live prefill/PATCH/null clearing/units/dirty guard; no prices");
}

function main(): void {
  console.log("Web missing features W2 smoke\n");
  checkPackageAndI18n();
  checkRouteAndButton();
  checkEditFlow();
  console.log("\nPASS");
}

try {
  main();
} catch (error) {
  console.error("\nFAIL:", error instanceof Error ? error.message : error);
  process.exit(1);
}
