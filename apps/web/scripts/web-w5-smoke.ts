/** Owner Web Missing Features W5 smoke - Batch Management source guards. */

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
  assert(
    pkg.scripts?.["smoke:web-w5"]?.includes("web-w5-smoke"),
    "package must define smoke:web-w5",
  );
  const en = readSrc("i18n/locales/en.ts");
  const bn = readSrc("i18n/locales/bn-BD.ts");
  for (const key of [
    "inventory.detail.manage",
    "inventory.batch.title",
    "inventory.batch.correction.title",
    "inventory.batch.adjustment.title",
    "inventory.batch.lifecycle.void",
    "inventory.batch.lifecycle.retire",
    "inventory.batch.confirm.voidTitle",
    "inventory.batch.confirm.retireTitle",
    "inventory.batch.history.corrections",
    "inventory.batch.conflict",
    "inventory.batch.refreshError",
    "nav.openMenu",
    "nav.closeMenu",
  ]) {
    assert(
      en.includes(`"${key}"`) && bn.includes(`"${key}"`),
      `${key} must exist in both locales`,
    );
  }
  console.log("  OK W5 script and en/bn-BD translations");
}

function checkRouteAndEntryPoint(): void {
  const paths = readSrc("lib/ownerPath.ts");
  const shell = readSrc("features/shell/AppShell.tsx");
  const detail = readSrc("features/inventory/ProductDetailPage.tsx");
  assert(
      paths.includes('kind: "batch"') &&
      paths.includes('parts[1] === "batches"') &&
      paths.indexOf('parts[1] === "batches"') <
        paths.indexOf('return { kind: "detail"'),
    "batch route must parse before product detail",
  );
  assert(
    shell.includes("BatchManagementPage") && shell.includes('sub.kind === "batch"'),
    "AppShell must render BatchManagementPage",
  );
  assert(
    shell.includes('key={`${sub.productId}:${sub.batchId}`}'),
    "direct batch route changes must remount isolated form state",
  );
  assert(
    detail.includes("encodeURIComponent(product.id)") &&
      detail.includes("encodeURIComponent(batchId)") &&
      detail.includes("onManageBatch"),
    "Product Details must link each batch through encoded product and batch IDs",
  );
  assert(
    detail.includes("lifecycleStatus") &&
      detail.includes("inventory.detail.col.actions") &&
      detail.includes("inventory.detail.manage"),
    "Product Details must show lifecycle state and Manage actions",
  );
  console.log("  OK batch route, lifecycle badges, and Manage actions");
}

function checkApiAndMutationSafety(): void {
  const client = readSrc("lib/ownerBatch.ts");
  const page = readSrc("features/inventory/BatchManagementPage.tsx");
  for (const endpoint of ["/corrections", "/adjustments", "/void", "/retire"]) {
    assert(client.includes(endpoint), `ownerBatch client must include ${endpoint}`);
  }
  assert(
    client.includes('method: "POST"') && client.includes("fetchOwnerBatch"),
    "batch client must read detail and use POST mutation endpoints",
  );
  assert(
    page.includes("expectedVersion: batch.version") &&
      page.includes("quantityChange: adjustmentDelta") &&
      page.includes("operationId(") &&
      page.includes("eventId:"),
    "mutations must use current version, idempotency IDs, and signed quantity changes",
  );
  assert(
    !client.includes('method: "DELETE"') &&
      !client.includes('method: "PATCH"') &&
      !page.includes("quantityOnHand:"),
    "W5 must not delete, use legacy PATCH, or submit absolute stock",
  );
  assert(
    page.includes("error.statusCode === 409") &&
      page.includes("await loadBatch(true, false)") &&
      page.includes("inventory.batch.conflict") &&
      page.includes("inventory.batch.conflictRefreshError") &&
      page.includes("Boolean(loadError)"),
    "409 handling must show localized conflict copy and refetch without retry",
  );
  console.log("  OK versioned signed mutations and conflict-safe refetch");
}

function checkManagementExperience(): void {
  const page = readSrc("features/inventory/BatchManagementPage.tsx");
  const shell = readSrc("features/shell/AppShell.tsx");
  assert(
    page.includes("projectedQuantity") && page.includes("projectedRetail"),
    "adjustment UI must show projected quantity and value",
  );
  assert(
    page.includes('role="dialog"') &&
      page.includes("LifecycleModal") &&
      !page.includes("window.confirm"),
    "void/retire must use an in-app confirmation modal",
  );
  assert(
    page.includes("batch.revisions.map") && page.includes("batch.adjustments.map"),
    "batch page must render correction and adjustment history",
  );
  assert(
    page.includes('batch.status !== "ACTIVE"') &&
      page.includes("disabled={controlsDisabled}"),
    "retired and voided batches must remain inspectable but immutable",
  );
  assert(
    page.includes("100dvh") &&
      shell.includes('className="hidden md:flex"') &&
      shell.includes("navigationOpen"),
    "batch modal and owner navigation must remain usable on mobile",
  );
  console.log("  OK projections, lifecycle modal, history, inactive lock, and mobile shell");
}

function main(): void {
  console.log("Web missing features W5 smoke\n");
  checkPackageAndI18n();
  checkRouteAndEntryPoint();
  checkApiAndMutationSafety();
  checkManagementExperience();
  console.log("\nPASS");
}

try {
  main();
} catch (error) {
  console.error("\nFAIL:", error instanceof Error ? error.message : error);
  process.exit(1);
}
