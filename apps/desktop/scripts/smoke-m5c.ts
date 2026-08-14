/**
 * M5 Batch C smoke — Receive stock UI (GRN).
 * Run: npm run smoke:m5c -w @r2a/desktop
 *
 * Settings → Receive stock: Add lot POST /batches + Adjust qty PATCH.
 * Owner/Manager only; online only; catalogPull after save.
 * This script does not hit the cloud API (walkthrough covers live POST).
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "..", "src");

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
  "settings.receiveStock",
  "settings.receiveStockModeAdd",
  "settings.receiveStockModeAdjust",
  "settings.receiveStockProduct",
  "settings.receiveStockBatchNumber",
  "settings.receiveStockExpiry",
  "settings.receiveStockQty",
  "settings.receiveStockCost",
  "settings.receiveStockSell",
  "settings.receiveStockSaveLot",
  "settings.receiveStockOffline",
  "settings.receiveStockDuplicate",
  "settings.receiveStockLotSaved",
  "settings.receiveStockQtySaved",
] as const;

function checkReceiveForm(): void {
  const helper = readSrc("lib/receiveStock.ts");
  const section = readSrc("features/inventory/ReceiveStockSection.tsx");
  const settings = readSrc("features/settings/SettingsPanel.tsx");

  assert(
    helper.includes('"/api/v1/batches"') &&
      helper.includes('method: "POST"') &&
      helper.includes("postReceiveLot"),
    "receiveStock must POST /api/v1/batches for Add lot",
  );
  assert(
    helper.includes('method: "PATCH"') &&
      helper.includes("quantityOnHand") &&
      helper.includes("patchReceiveQty"),
    "receiveStock must PATCH /api/v1/batches/:id with quantityOnHand",
  );
  assert(
    helper.includes("searchReceiveProducts") &&
      helper.includes("/api/v1/products?"),
    "receiveStock must search GET /products?q=",
  );
  assert(
    !helper.includes("enqueueSyncEvent") &&
      !section.includes("enqueueSyncEvent"),
    "GRN must not queue offline (no enqueueSyncEvent)",
  );

  assert(
    section.includes("postReceiveLot") &&
      section.includes("patchReceiveQty") &&
      section.includes("pullCacheNow"),
    "ReceiveStockSection must POST lot, PATCH qty, and catalogPull after save",
  );
  assert(
    section.includes('mode === "online"') &&
      section.includes("forcedOffline") &&
      section.includes('t("settings.receiveStockOffline")'),
    "Receive stock must block Force Offline / mode !== online with i18n toast",
  );
  assert(
    section.includes("isDuplicateBatchError") &&
      section.includes('t("settings.receiveStockDuplicate")'),
    "409 duplicate batch number must use i18n toast",
  );
  assert(
    section.includes('t("settings.receiveStockCost")') &&
      section.includes("costPerBase"),
    "Cost fields must be visible in Receive stock (Owner + Manager)",
  );
  assert(
    /event\.key === "Tab"/.test(section) &&
      section.includes("preventDefault") &&
      !section.includes("[Tab]"),
    "Receive stock must swallow Tab (not a POS navigator)",
  );
  assert(
    !/\bBaki\b/.test(section) && !/\bBaki\b/.test(helper),
    "Receive stock must not introduce Baki / on-account",
  );

  assert(
    settings.includes("ReceiveStockSection") &&
      settings.includes("function canReceiveStock") &&
      /(?:normalized|role) === "OWNER"[\s\S]*?(?:normalized|role) === "MANAGER"/.test(
        settings,
      ),
    "Settings must render ReceiveStockSection behind Owner/Manager canReceiveStock",
  );
  assert(
    settings.includes('"language", "pharmacy", "receive", "connectivity"') &&
      settings.includes('"language", "pharmacy", "connectivity"'),
    "sectionOrder must include receive only on the Owner/Manager list",
  );
  assert(
    !settings.includes('t("settings.receiveStockComing")'),
    "Batch B placeholder must be replaced by the Receive stock form",
  );

  console.log("  ✓ POST /batches + PATCH qty + catalogPull + online-only + role gate");
}

function checkNoSidebarInventory(): void {
  const sidebar = readSrc("features/shell/Sidebar.tsx");
  assert(
    !/Inventory/.test(sidebar),
    "Do not add a sidebar Inventory item",
  );
  assert(
    sidebar.includes("sidebar.newSale") &&
      sidebar.includes("sidebar.transactions") &&
      sidebar.includes("sidebar.shift") &&
      sidebar.includes("sidebar.settings"),
    "Sidebar must stay New Sale / Transactions / Shift / Settings",
  );
  console.log("  ✓ no sidebar Inventory");
}

function checkStubsUntouched(): void {
  const print = readSrc("lib/printStub.ts");
  const fefo = readSrc("lib/fefoOverrideAuth.ts");
  assert(
    print.includes("TODO(real printer IPC)"),
    "print stub TODO must remain",
  );
  assert(
    fefo.includes("STUB_MANAGER_PIN_LENGTH") &&
      fefo.includes("TODO(real integration)") &&
      !fefo.includes("pinHash"),
    "FEFO PIN stub must remain (no pinHash)",
  );
  console.log("  ✓ print stub + FEFO PIN stub untouched");
}

function checkI18n(): void {
  const en = readSrc("i18n/locales/en.ts");
  const bn = readSrc("i18n/locales/bn-BD.ts");
  for (const key of RECEIVE_I18N_KEYS) {
    assert(en.includes(`"${key}"`), `en.ts missing ${key}`);
    assert(bn.includes(`"${key}"`), `bn-BD.ts missing ${key}`);
  }
  assert(
    /"settings\.receiveStock":\s*"Receive stock"/.test(en),
    'en settings.receiveStock must be "Receive stock"',
  );
  assert(
    /"settings\.receiveStockModeAdd":\s*"Add lot"/.test(en),
    'en settings.receiveStockModeAdd must be "Add lot"',
  );
  console.log("  ✓ i18n receive-stock keys in en + bn-BD");
}

function checkNoPostCustomers(): void {
  const files = walkTs(SRC);
  const offenders: string[] = [];
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    if (
      /method:\s*["']POST["']/.test(src) &&
      /\/api\/v1\/customers/.test(src)
    ) {
      const hasPostCustomers =
        /\/api\/v1\/customers[\s\S]{0,200}method:\s*["']POST["']/.test(src) ||
        /method:\s*["']POST["'][\s\S]{0,200}\/api\/v1\/customers/.test(src);
      if (hasPostCustomers) offenders.push(file.slice(SRC.length + 1));
    }
  }
  assert(
    offenders.length === 0,
    `desktop src must not POST /customers (found: ${offenders.join(", ")})`,
  );
  console.log("  ✓ still no POST /customers from desktop");
}

function main(): void {
  console.log("smoke:m5c — M5 Batch C Receive stock UI\n");
  checkReceiveForm();
  checkNoSidebarInventory();
  checkStubsUntouched();
  checkI18n();
  checkNoPostCustomers();
  console.log("\nPASS — smoke:m5c");
}

main();
