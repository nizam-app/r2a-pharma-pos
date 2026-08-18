/**
 * M6 Batch M smoke — Owner web Receive Stock.
 * Run: npm run smoke:m6m -w @r2a/web
 *
 * Source guards only. The page must fetch live product context, submit a new
 * batch to POST /api/v1/batches, show packaging/financial/stock calculations,
 * capture optional supplier/return metadata, and omit PO, invoice, and offline GRN behavior.
 */

import { readFileSync } from "node:fs";
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

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const RECEIVE_I18N_KEYS = [
  "inventory.receive.crumb",
  "inventory.receive.title",
  "inventory.receive.subtitle",
  "inventory.receive.receivedDate",
  "inventory.receive.batchNumber",
  "inventory.receive.expiryDate",
  "inventory.receive.supplier",
  "inventory.receive.returnEligibility",
  "inventory.receive.quantity",
  "inventory.receive.costPerPiece",
  "inventory.receive.sellPerPiece",
  "inventory.receive.packagingReference",
  "inventory.receive.summary",
  "inventory.receive.stockImpact",
  "inventory.receive.submit",
  "inventory.receive.cancel",
] as const;

function checkPackage(): void {
  const pkg = JSON.parse(readRel("package.json")) as {
    name?: string;
    scripts?: Record<string, string>;
  };
  assert(pkg.name === "@r2a/web", `package name must be @r2a/web, got ${pkg.name}`);
  assert(
    pkg.scripts?.["smoke:m6m"]?.includes("smoke-m6m"),
    "package.json must define smoke:m6m",
  );
  console.log("  ✓ package @r2a/web + smoke:m6m");
}

function checkI18n(): void {
  const en = readSrc("i18n/locales/en.ts");
  const bn = readSrc("i18n/locales/bn-BD.ts");
  for (const key of RECEIVE_I18N_KEYS) {
    assert(
      en.includes(`"${key}"`) && bn.includes(`"${key}"`),
      `${key} must exist in en and bn-BD`,
    );
  }
  console.log("  ✓ receive-stock i18n keys in en + bn-BD");
}

function checkReceiveFlow(): void {
  const page = readSrc("features/inventory/ReceiveStockPage.tsx");
  const client = readSrc("lib/ownerProduct.ts");
  const shell = readSrc("features/shell/AppShell.tsx");

  assert(
    client.includes('"/api/v1/batches"') &&
      client.includes("receiveOwnerStock") &&
      client.includes('method: "POST"'),
    "ownerProduct must define receiveOwnerStock calling POST /api/v1/batches",
  );
  assert(
    page.includes("fetchOwnerProduct(productId)") &&
      page.includes("receiveOwnerStock(payload)"),
    "ReceiveStockPage must fetch live product context and submit the batch",
  );
  assert(
    shell.includes("ReceiveStockPage") &&
      shell.includes('sub.kind === "receive"') &&
      shell.includes("sub.productId"),
    "AppShell must render ReceiveStockPage on /inventory/:productId/receive",
  );
  for (const field of [
    "batchNumber",
    "expiryDate",
    "quantityOnHand",
    "costPerBase",
    "sellPerBase",
    "supplierName",
    "returnStatus",
  ]) {
    assert(page.includes(field), `Receive payload must include ${field}`);
  }
  assert(
    page.includes("product.kpis.currentStock") &&
      page.includes("product.kpis.activeBatchCount") &&
      page.includes("packagingBreakdown") &&
      page.includes("totalCost") &&
      page.includes("retailValue") &&
      page.includes("marginPct") &&
      page.includes("newStock"),
    "Receive page must show product, packaging, financial, and stock-impact calculations",
  );
  assert(
    page.includes("inventory.receive.receivedDate") &&
      page.includes("readOnly disabled") &&
      client.includes("createdAt: string"),
    "Received date must be display-only and server createdAt must remain represented",
  );
  assert(
    page.includes("inventory.receive.supplier") &&
      page.includes("inventory.receive.returnEligibility") &&
      !page.includes("Link PO") &&
      !page.includes("Invoice") &&
      !page.includes("outbound_sync_queue") &&
      !page.includes("offline"),
    "Receive Stock must persist supplier/return metadata and omit PO/invoice/offline GRN behavior",
  );
  assert(!/1,?280/.test(page) && !/NP25021/.test(page), "Must not hard-code mock stock or batch data");
  assert(page.includes("product.name") && !page.includes("t(product.name"), "Medicine names must remain untranslated");
  console.log("  ✓ live product context + POST /batches + calculations + scope locks");
}

function main(): void {
  console.log("M6 Batch M smoke (@r2a/web)\n");
  checkPackage();
  checkI18n();
  checkReceiveFlow();
  console.log("\nPASS");
}

try {
  main();
} catch (error) {
  console.error("\nFAIL:", error instanceof Error ? error.message : error);
  process.exit(1);
}
