/**
 * M6 Batch W smoke — Owner Receive Stock against a Purchase Order.
 * Run: npm run smoke:m6w -w @r2a/web
 *
 * Source guards only (no live API). The receive page must load the order via
 * live GET /owner/purchase-orders/:poId and confirm a goods receipt via
 * POST /owner/purchase-orders/:poId/receipts (Batch R API) with per-lot batch,
 * expiry, qty, cost and sell. "+ Add Batch" adds lots per line; received pieces
 * cannot exceed the remaining ordered qty. Save as Draft stays disabled.
 * Inventory's ad-hoc Receive Stock (Inventory → Add Lot) is kept untouched.
 * No invented totals and no hard-coded currency symbols.
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

const RECEIVE_I18N_KEYS = [
  "purchasing.receive.crumb",
  "purchasing.receive.title",
  "purchasing.receive.subtitle",
  "purchasing.receive.loading",
  "purchasing.receive.error",
  "purchasing.receive.notFound",
  "purchasing.receive.retry",
  "purchasing.receive.back",
  "purchasing.receive.po",
  "purchasing.receive.supplier",
  "purchasing.receive.reference",
  "purchasing.receive.expected",
  "purchasing.receive.branch",
  "purchasing.receive.progress",
  "purchasing.receive.ordered",
  "purchasing.receive.received",
  "purchasing.receive.remaining",
  "purchasing.receive.noLines",
  "purchasing.receive.noLinesHint",
  "purchasing.receive.lines.title",
  "purchasing.receive.lines.hint",
  "purchasing.receive.addBatch",
  "purchasing.receive.lot.batchNumber",
  "purchasing.receive.lot.batchPlaceholder",
  "purchasing.receive.lot.expiry",
  "purchasing.receive.lot.qty",
  "purchasing.receive.lot.cost",
  "purchasing.receive.lot.sell",
  "purchasing.receive.lot.remove",
  "purchasing.receive.lot.exceeds",
  "purchasing.receive.details.title",
  "purchasing.receive.details.receivedDate",
  "purchasing.receive.details.invoice",
  "purchasing.receive.details.invoicePlaceholder",
  "purchasing.receive.details.deliveryNote",
  "purchasing.receive.details.deliveryPlaceholder",
  "purchasing.receive.summary.title",
  "purchasing.receive.summary.lines",
  "purchasing.receive.summary.pieces",
  "purchasing.receive.summary.costValue",
  "purchasing.receive.summary.sellValue",
  "purchasing.receive.summary.margin",
  "purchasing.receive.summary.empty",
  "purchasing.receive.cancel",
  "purchasing.receive.confirm",
  "purchasing.receive.confirming",
  "purchasing.receive.confirmHint",
  "purchasing.receive.validation",
  "purchasing.receive.submitError",
  "purchasing.receive.saveDraft",
  "purchasing.receive.saveDraftSoon",
] as const;

function checkPackage(): void {
  const pkg = JSON.parse(readRel("package.json")) as {
    name?: string;
    scripts?: Record<string, string>;
  };
  assert(pkg.name === "@r2a/web", `package name must be @r2a/web, got ${pkg.name}`);
  assert(
    pkg.scripts?.["smoke:m6w"]?.includes("smoke-m6w"),
    "package.json must define smoke:m6w",
  );
  console.log("  ✓ package @r2a/web + smoke:m6w");
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
  console.log("  ✓ purchasing.receive i18n keys in en + bn-BD");
}

function checkReceivePage(): void {
  const page = readSrc("features/purchasing/ReceiveAgainstPurchaseOrderPage.tsx");
  const poLib = readSrc("lib/purchaseOrders.ts");
  const shell = readSrc("features/shell/AppShell.tsx");
  const ownerPath = readSrc("lib/ownerPath.ts");
  const detail = readSrc("features/purchasing/PurchaseOrderDetailPage.tsx");
  const all = walkTs(SRC)
    .map((p) => readFileSync(p, "utf8"))
    .join("\n");

  assert(
    poLib.includes("confirmGoodsReceipt") &&
      poLib.includes("/api/v1/owner/purchase-orders/") &&
      poLib.includes("/receipts") &&
      poLib.includes('method: "POST"'),
    "purchaseOrders lib must POST /api/v1/owner/purchase-orders/:poId/receipts",
  );
  assert(
    page.includes("ReceiveAgainstPurchaseOrderPage") &&
      page.includes("fetchPurchaseOrder"),
    "Receive page must load the order via fetchPurchaseOrder",
  );
  assert(
    poLib.includes("purchaseOrderLineId") &&
      poLib.includes("batchNumber") &&
      poLib.includes("expiryDate") &&
      poLib.includes("costPerBase") &&
      poLib.includes("sellPerBase") &&
      poLib.includes("qty"),
    "GRN line payload must carry purchaseOrderLineId, productId, qty, batch, expiry, cost, sell",
  );
  assert(
    page.includes("confirmGoodsReceipt") && page.includes("supplierInvoiceRef"),
    "Confirm must call confirmGoodsReceipt with invoice / delivery / receivedAt",
  );
  assert(
    page.includes("onAddBatch") &&
      page.includes("purchasing.receive.addBatch") &&
      page.includes("purchaseOrderLineId"),
    "Receive page must support multiple lots per line ('+ Add Batch')",
  );
  assert(
    page.includes("line.remaining") && page.includes("lot.exceeds"),
    "Received pieces must be bounded by the remaining ordered qty",
  );
  assert(
    page.includes("purchasing.receive.saveDraftSoon") &&
      page.includes("aria-disabled=\"true\""),
    "Save as Draft must stay disabled (no resume flow yet)",
  );
  assert(
    page.includes("navigate(`/purchasing/${encodeURIComponent(purchaseOrder.id)}`)"),
    "Confirm must return to the PO details page",
  );
  assert(
    page.includes("formatTaka") &&
      page.includes("formatCount") &&
      page.includes("formatUtcDate") &&
      page.includes("useTenantChrome"),
    "Values must be formatted with live helpers; branch from locked JWT store",
  );
  assert(
    !/\/owner\/batches/.test(page),
    "Receive against PO must go through the PO receipts route, not ad-hoc /batches",
  );
  assert(
    shell.includes("ReceiveAgainstPurchaseOrderPage") &&
      shell.includes('sub.kind === "receive"'),
    "AppShell must render the receive page for /purchasing/:poId/receive",
  );
  assert(
    ownerPath.includes('{ kind: "receive"; poId: string }') &&
      ownerPath.includes('parts[1] === "receive"'),
    "ownerPath must route /purchasing/:poId/receive to the receive kind",
  );
  assert(
    detail.includes('navigate(`/purchasing/${encodeURIComponent(poId)}/receive`)'),
    "PO Details must still link Receive Stock to /purchasing/:poId/receive",
  );
  assert(
    !/purchasing\.placeholder\.receive/.test(shell),
    "AppShell must not fall back to a placeholder for the receive route",
  );
  assert(
    !/₺/.test(all) && !/\$\d/.test(all),
    "Must not hard-code ₺ or mock dollar totals",
  );
  console.log("  ✓ live GET :poId + POST :poId/receipts; +Add Batch; draft disabled");
}

function main(): void {
  console.log("M6 Batch W smoke (@r2a/web)\n");
  checkPackage();
  checkI18n();
  checkReceivePage();
  console.log("\nPASS");
}

try {
  main();
} catch (err) {
  console.error("\nFAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
}