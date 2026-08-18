/**
 * M6 Batch V smoke — Owner Purchase Order Details.
 * Run: npm run smoke:m6v -w @r2a/web
 *
 * Source guards only (no live API). The detail page must load the order via
 * live GET /owner/purchase-orders/:poId and show header, KPIs, line
 * received/remaining, receiving progress and GRN history for this order.
 * Export / Print / More Actions stay disabled. Receive Stock (only while
 * remaining qty > 0 on a SENT / PARTIALLY_RECEIVED order) must navigate to
 * /purchasing/:poId/receive — it must NOT create the GRN form (Batch W). No
 * invented KPI/table values and no ₺/hard-coded mock totals.
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
  "purchasing.detail.crumb",
  "purchasing.detail.loading",
  "purchasing.detail.error",
  "purchasing.detail.notFound",
  "purchasing.detail.back",
  "purchasing.detail.export",
  "purchasing.detail.exportSoon",
  "purchasing.detail.print",
  "purchasing.detail.printSoon",
  "purchasing.detail.moreActions",
  "purchasing.detail.moreActionsSoon",
  "purchasing.detail.receive",
  "purchasing.detail.receiveFull",
  "purchasing.detail.kpi.orderValue",
  "purchasing.detail.kpi.receivedValue",
  "purchasing.detail.kpi.remainingValue",
  "purchasing.detail.kpi.receipts",
  "purchasing.detail.kpi.receiptsHint",
  "purchasing.detail.progress.title",
  "purchasing.detail.progress.received",
  "purchasing.detail.progress.of",
  "purchasing.detail.progress.pcs",
  "purchasing.detail.info.title",
  "purchasing.detail.info.supplier",
  "purchasing.detail.info.contact",
  "purchasing.detail.info.phone",
  "purchasing.detail.info.city",
  "purchasing.detail.info.reference",
  "purchasing.detail.info.expected",
  "purchasing.detail.info.branch",
  "purchasing.detail.info.createdBy",
  "purchasing.detail.info.createdAt",
  "purchasing.detail.info.updatedAt",
  "purchasing.detail.lines.title",
  "purchasing.detail.lines.hint",
  "purchasing.detail.lines.empty",
  "purchasing.detail.lines.col.product",
  "purchasing.detail.lines.col.ordered",
  "purchasing.detail.lines.col.received",
  "purchasing.detail.lines.col.remaining",
  "purchasing.detail.lines.col.cost",
  "purchasing.detail.lines.col.total",
  "purchasing.detail.lines.full",
  "purchasing.detail.receipts.title",
  "purchasing.detail.receipts.hint",
  "purchasing.detail.receipts.empty",
  "purchasing.detail.receipts.col.grn",
  "purchasing.detail.receipts.col.date",
  "purchasing.detail.receipts.col.by",
  "purchasing.detail.receipts.col.lines",
  "purchasing.detail.receipts.col.invoice",
  "purchasing.detail.receipts.col.delivery",
] as const;

function checkPackage(): void {
  const pkg = JSON.parse(readRel("package.json")) as {
    name?: string;
    scripts?: Record<string, string>;
  };
  assert(pkg.name === "@r2a/web", `package name must be @r2a/web, got ${pkg.name}`);
  assert(
    pkg.scripts?.["smoke:m6v"]?.includes("smoke-m6v"),
    "package.json must define smoke:m6v",
  );
  console.log("  ✓ package @r2a/web + smoke:m6v");
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
  console.log("  ✓ purchasing.detail i18n keys in en + bn-BD");
}

function checkDetailPage(): void {
  const page = readSrc("features/purchasing/PurchaseOrderDetailPage.tsx");
  const poLib = readSrc("lib/purchaseOrders.ts");
  const shell = readSrc("features/shell/AppShell.tsx");
  const all = walkTs(SRC)
    .map((p) => readFileSync(p, "utf8"))
    .join("\n");

  assert(
    poLib.includes("fetchPurchaseOrder") &&
      poLib.includes("/api/v1/owner/purchase-orders/"),
    "purchaseOrders lib must GET /api/v1/owner/purchase-orders/:poId",
  );
  assert(
    page.includes("PurchaseOrderDetailPage") && page.includes("fetchPurchaseOrder"),
    "PurchaseOrderDetailPage must load the order via fetchPurchaseOrder",
  );
  assert(
    page.includes("goodsReceipts") &&
      page.includes("grnNumber") &&
      page.includes("qtyOrdered") &&
      page.includes("qtyReceived"),
    "Detail must show line received/remaining and GRN history for this order",
  );
  assert(
    page.includes("purchasing.detail.exportSoon") &&
      page.includes("purchasing.detail.printSoon") &&
      page.includes("purchasing.detail.moreActionsSoon") &&
      page.includes('aria-disabled="true"'),
    "Export / Print / More Actions must render disabled",
  );
  assert(
    page.includes('purchasing.detail.receive') &&
      page.includes('navigate(`/purchasing/${encodeURIComponent(poId)}/receive`)'),
    "Receive Stock must navigate to /purchasing/:poId/receive",
  );
  assert(
    page.includes('purchaseOrder.status === "SENT"') &&
      page.includes('"PARTIALLY_RECEIVED"') &&
      page.includes("remainingPcs > 0"),
    "Receive Stock must be enabled only while remaining qty > 0 on a sent/partial order",
  );
  assert(
    page.includes("formatTaka") &&
      page.includes("formatCount") &&
      page.includes("formatDateTime") &&
      page.includes("formatUtcDate"),
    "Detail KPIs/values must be formatted with live format helpers",
  );
  assert(
    page.includes("useTenantChrome") && page.includes("storeName"),
    "Delivery branch fallback must come from the locked JWT store",
  );
  assert(
    shell.includes("PurchaseOrderDetailPage") &&
      shell.includes('sub.kind === "detail"'),
    "AppShell must render PurchaseOrderDetailPage for /purchasing/:poId",
  );
  assert(
    !/purchase-orders\/[^/]+\/receive.*method:|apiRequest.*receive/.test(page) &&
      !/\/owner\/batches/.test(page) &&
      !/goodsReceipt.*POST/.test(poLib) &&
      !/createGoodsReceipt|goodsReceiptForm/i.test(page),
    "Detail must not create GRN form / batch writes (Batch W is out of scope)",
  );
  assert(
    !/₺/.test(all) && !/\$\d/.test(all),
    "Must not hard-code ₺ or mock dollar totals",
  );
  console.log("  ✓ live GET :poId; disabled export/print/more; receive → /receive");
}

function main(): void {
  console.log("M6 Batch V smoke (@r2a/web)\n");
  checkPackage();
  checkI18n();
  checkDetailPage();
  console.log("\nPASS");
}

try {
  main();
} catch (err) {
  console.error("\nFAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
}
