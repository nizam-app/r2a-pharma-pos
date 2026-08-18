/** Owner Web Missing Features W6 smoke - desktop signed adjustment source guards. */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DESKTOP = join(__dirname, "..");
const ROOT = join(DESKTOP, "..", "..");

function readDesktop(path: string): string {
  return readFileSync(join(DESKTOP, path), "utf8");
}

function readRepo(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function checkPackageAndI18n(): void {
  const pkg = JSON.parse(readDesktop("package.json")) as {
    scripts?: Record<string, string>;
  };
  assert(
    pkg.scripts?.["smoke:web-w6"]?.includes("web-w6-smoke"),
    "desktop package must define smoke:web-w6",
  );
  const en = readDesktop("src/i18n/locales/en.ts");
  const bn = readDesktop("src/i18n/locales/bn-BD.ts");
  for (const key of [
    "settings.receiveStockQtyChange",
    "settings.receiveStockProjectedQty",
    "settings.receiveStockAdjustmentReason",
    "settings.receiveStockReasonCount",
    "settings.receiveStockReasonDamage",
    "settings.receiveStockReasonBreakage",
    "settings.receiveStockReasonReturn",
    "settings.receiveStockReasonReceiveCorrection",
    "settings.receiveStockReasonOther",
    "settings.receiveStockAdjustmentConflict",
    "settings.receiveStockConflictRefreshFailed",
    "settings.receiveStockSavedRefreshFailed",
    "settings.receiveStockRetryRefresh",
  ]) {
    assert(
      en.includes(`"${key}"`) && bn.includes(`"${key}"`),
      `${key} must exist in both desktop locales`,
    );
  }
  console.log("  OK W6 script and desktop en/bn-BD translations");
}

function checkSignedDesktopFlow(): void {
  const helper = readDesktop("src/lib/receiveStock.ts");
  const section = readDesktop("src/features/inventory/ReceiveStockSection.tsx");
  assert(
    helper.includes("adjustReceiveQty") &&
      helper.includes("/adjustments") &&
      helper.includes('method: "POST"') &&
      helper.includes("BatchAdjustmentInput") &&
      helper.includes("version:"),
    "desktop helper must POST typed signed adjustments and map version",
  );
  assert(
    !helper.includes('method: "PATCH"') && !helper.includes("patchReceiveQty"),
    "desktop must not retain absolute quantity PATCH",
  );
  assert(
    section.includes("expectedVersion: selectedBatch.version") &&
      section.includes("quantityChange") &&
      section.includes("reasonCode: adjustmentReason") &&
      section.includes("pendingAdjustmentRef") &&
      section.includes("createAdjustmentEventId"),
    "desktop adjustment must be versioned, reasoned, and retry-idempotent",
  );
  assert(
    section.includes("parseSignedInt") &&
      section.includes("receiveStockWouldBeNegative") &&
      section.includes("receiveStockProjectedQty"),
    "desktop must reject zero/negative-result changes and show projected stock",
  );
  assert(
    section.includes("isAdjustmentConflict") &&
      section.includes("listReceiveBatches(product.id)") &&
      section.includes("receiveStockAdjustmentConflict") &&
      section.includes("receiveStockConflictRefreshFailed"),
    "409 must reload live batches and require manual confirmation",
  );
  assert(
    section.includes("await pullCacheNow()") &&
      !section.includes("enqueueSyncEvent") &&
      section.includes('mode === "online"') &&
      section.includes("forcedOffline"),
    "adjustment must refresh catalog and remain online-only without queueing",
  );
  assert(
    section.includes("catalogRefreshRequired") &&
      section.includes("receiveStockSavedRefreshFailed") &&
      section.includes("selectionGenerationRef") &&
      section.includes("<fieldset disabled={saving}"),
    "refresh failure must lock stock changes and in-flight selection must stay isolated",
  );
  console.log("  OK signed/versioned/reasoned online adjustment and conflict flow");
}

function checkAuthoritativeRefresh(): void {
  const provider = readDesktop("src/features/shell/LocalDbProvider.tsx");
  assert(
    provider.includes("pullQueued") &&
      provider.includes("await pullInFlight.current") &&
      provider.includes("while (pullQueued.current)") &&
      provider.includes("return lastPullSucceeded"),
    "catalog refresh requests during a pull must receive a trailing authoritative pull",
  );
  console.log("  OK post-mutation catalog refresh cannot be skipped by an in-flight pull");
}

function checkLegacyPatchRemoved(): void {
  const contracts = readRepo("packages/shared-types/src/batch.ts");
  const service = readRepo("apps/server/src/modules/batch/batch.service.ts");
  const updateBlock = contracts.slice(
    contracts.indexOf("export const batchUpdateSchema"),
    contracts.indexOf("const operationIdSchema"),
  );
  const serviceBlock = service.slice(
    service.indexOf("export async function updateBatch"),
    service.indexOf("export async function getBatch"),
  );
  assert(
    !updateBlock.includes("quantityOnHand") && updateBlock.includes(".strict()"),
    "general batch PATCH schema must strictly reject quantityOnHand",
  );
  assert(
    !serviceBlock.includes("input.quantityOnHand") &&
      !serviceBlock.includes('type: "ADJUST"'),
    "general batch PATCH service must not mutate quantity or write ADJUST events",
  );
  console.log("  OK legacy absolute quantity PATCH removed from contract and service");
}

function checkExitDocuments(): void {
  const plan = readRepo("WEB_MISSING_FEATURES_PLAN.md");
  const catalog = readRepo("Completed_API_lists.md");
  const roles = readRepo("ROLES_AND_PERMISSIONS.md");
  const status = readRepo("Current_Status.md");
  const master = readRepo("PROJECT_MASTER_PLAN.md");
  const m5 = readRepo("MILESTONE_5_EXECUTION.md");
  const m6 = readRepo("MILESTONE_6_EXECUTION.md");
  assert(
    plan.includes("W1–W6 DONE") && plan.includes("M6 Batch N is eligible"),
    "W1-W6 plan must be complete while Batch N remains separately authorized",
  );
  assert(
    catalog.includes("/batches/:id/adjustments") &&
      catalog.includes("general PATCH cannot mutate quantity"),
    "API catalog must document signed adjustment and PATCH removal",
  );
  assert(
    roles.includes("Signed stock adjustment with reason") &&
      roles.includes("`POST /api/v1/batches/:id/adjustments`"),
    "RBAC document must authorize Owner/Manager signed adjustment",
  );
  assert(
    status.includes("Owner Web Missing Features **W1–W6 DONE**") &&
      master.includes("W1–W6 are DONE"),
    "status and master plan must record W1-W6 completion",
  );
  assert(
    m5.includes("W6 compatibility amendment") &&
      m6.includes("Owner Web Slice 1 Batches **A–O DONE**"),
    "milestone histories must preserve M5 and record the later Slice 1 exit",
  );
  console.log("  OK API/RBAC/status/milestone W1-W6 exit documents");
}

function main(): void {
  console.log("Web missing features W6 desktop smoke\n");
  checkPackageAndI18n();
  checkSignedDesktopFlow();
  checkAuthoritativeRefresh();
  checkLegacyPatchRemoved();
  checkExitDocuments();
  console.log("\nPASS");
}

try {
  main();
} catch (error) {
  console.error("\nFAIL:", error instanceof Error ? error.message : error);
  process.exit(1);
}
