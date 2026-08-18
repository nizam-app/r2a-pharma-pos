/**
 * M6 Batch J smoke — Owner Inventory list.
 * Run: npm run smoke:m6j -w @r2a/web
 *
 * Source guards only (no live API). Inventory must call GET /owner/inventory,
 * must not hard-code 2,486 products, cost columns for Owner, COLD CHAIN from
 * coldChain, tabs + pagination, Add → /inventory/new, alerts → /inventory/expiry.
 * Product detail is not built here (placeholder only).
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

const INV_I18N_KEYS = [
  "inventory.subtitle",
  "inventory.addProduct",
  "inventory.receiveStock",
  "inventory.kpi.totalProducts",
  "inventory.kpi.costValue",
  "inventory.tab.all",
  "inventory.tab.low",
  "inventory.tab.out",
  "inventory.tab.expiring30",
  "inventory.tab.expiring90",
  "inventory.tab.expired",
  "inventory.searchPlaceholder",
  "inventory.col.cost",
  "inventory.col.sell",
  "inventory.col.margin",
  "inventory.coldChain",
  "inventory.attention.review",
  "inventory.later.expiry",
] as const;

function checkPackage(): void {
  const pkg = JSON.parse(readRel("package.json")) as {
    name?: string;
    scripts?: Record<string, string>;
  };
  assert(pkg.name === "@r2a/web", `package name must be @r2a/web, got ${pkg.name}`);
  assert(
    pkg.scripts?.["smoke:m6j"]?.includes("smoke-m6j"),
    "package.json must define smoke:m6j",
  );
  console.log("  ✓ package @r2a/web + smoke:m6j");
}

function checkI18n(): void {
  const en = readSrc("i18n/locales/en.ts");
  const bn = readSrc("i18n/locales/bn-BD.ts");
  for (const key of INV_I18N_KEYS) {
    assert(
      en.includes(`"${key}"`) && bn.includes(`"${key}"`),
      `${key} must exist in en and bn-BD`,
    );
  }
  console.log("  ✓ inventory i18n keys in en + bn-BD");
}

function checkInventoryFetch(): void {
  const page = readSrc("features/inventory/InventoryPage.tsx");
  const client = readSrc("lib/ownerInventory.ts");
  const shell = readSrc("features/shell/AppShell.tsx");
  const all = walkTs(SRC)
    .map((p) => readFileSync(p, "utf8"))
    .join("\n");

  assert(
    client.includes("/api/v1/owner/inventory") &&
      client.includes("fetchOwnerInventory"),
    "ownerInventory must call GET /api/v1/owner/inventory",
  );
  assert(page.includes("fetchOwnerInventory"), "InventoryPage must fetch live list");
  assert(
    shell.includes("InventoryPage") && shell.includes("inventorySubpath"),
    "AppShell must render InventoryPage on /inventory",
  );
  assert(
    !/2,?486/.test(all) && !/2486/.test(all),
    "Must not hard-code 2,486 products",
  );
  assert(!/₺/.test(all), "Must use ৳, never ₺");
  console.log("  ✓ live GET /owner/inventory; no mock 2,486");
}

function checkLocks(): void {
  const page = readSrc("features/inventory/InventoryPage.tsx");
  const expiry = readSrc("features/inventory/ExpiryManagementPage.tsx");
  const picker = readSrc("features/inventory/ReceiveProductPicker.tsx");
  const paths = readSrc("lib/ownerPath.ts");

  assert(
    page.includes("inventory.tab.all") &&
      page.includes("inventory.tab.low") &&
      page.includes("inventory.tab.out") &&
      page.includes("inventory.tab.expiring30") &&
      page.includes("inventory.tab.expiring90") &&
      page.includes("inventory.tab.expired"),
    "Tabs All / Low / Out / Expiring 30d / 90d / Expired required",
  );
  assert(
    page.includes("inventory.searchPlaceholder") &&
      page.includes("inventory.col.cost") &&
      page.includes("inventory.col.sell") &&
      page.includes("inventory.col.margin") &&
      page.includes("formatTaka(row.costPerBase)"),
    "Owner cost/sell/margin columns required",
  );
  assert(
    page.includes("row.coldChain") && page.includes("inventory.coldChain"),
    "COLD CHAIN badge must use coldChain",
  );
  assert(
    page.includes('navigate("/inventory/new")') &&
      page.includes('navigate("/inventory/expiry")') &&
      page.includes("inventory.expiryManagement") &&
      page.includes("CalendarClock") &&
      page.includes("PackagePlus") &&
      page.includes("`/inventory/${row.productId}`"),
    "Expiry / Add / Receive and row actions must use Slice 1 routes with distinct icons",
  );
  assert(
    picker.includes("fetchOwnerInventory") &&
      page.includes("ReceiveProductPicker") &&
      page.includes("`/inventory/${productId}/receive`"),
    "Receive Stock header must pick a product then go to receive route",
  );
  assert(
    page.includes("Pagination") && page.includes("PAGE_SIZE"),
    "Pagination required",
  );
  assert(
    page.includes("inventory.filterSoon") &&
      page.includes("inventory.columnsSoon") &&
      page.includes("disabled"),
    "Filter / Columns stay parked",
  );
  assert(
    expiry.includes("fetchOwnerExpiry") && expiry.includes("/inventory/${row.productId}"),
    "Expiry Management must be live after Batch N",
  );
  assert(
    paths.includes('kind: "expiry"') &&
      paths.includes('kind: "new"') &&
      paths.includes('kind: "receive"'),
    "Register /inventory/expiry and /inventory/new before /:productId",
  );
  assert(
    page.includes("row.name") && !page.includes("t(row.name"),
    "Medicine names must stay untranslated",
  );
  assert(
    !page.includes("Baki") && !page.includes("on-account"),
    "No Baki / on-account",
  );
  console.log("  ✓ tabs / cost columns / CTAs / placeholders");
}

function main(): void {
  console.log("M6 Batch J smoke (@r2a/web)\n");
  checkPackage();
  checkI18n();
  checkInventoryFetch();
  checkLocks();
  console.log("\nPASS");
}

try {
  main();
} catch (err) {
  console.error("\nFAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
}
