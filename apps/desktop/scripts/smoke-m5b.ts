/**
 * M5 Batch B smoke — Desktop RBAC shell.
 * Run: npm run smoke:m5b -w @r2a/desktop
 *
 * Receive stock Settings section is Owner/Manager only (form = Batch C).
 * Select Customer stays search/walk-in — no Create, no PATCH-customer UI.
 * This script does not hit the cloud API.
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
  "settings.receiveStockHelp",
] as const;

function checkSettingsReceiveGuard(): void {
  const settings = readSrc("features/settings/SettingsPanel.tsx");

  assert(
    settings.includes("function canReceiveStock"),
    "Settings must use canReceiveStock helper (same pattern as canEditPharmacyHeader)",
  );
  assert(
    /function canReceiveStock\([\s\S]*?(?:normalized|role) === "OWNER"[\s\S]*?(?:normalized|role) === "MANAGER"/.test(
      settings,
    ),
    "canReceiveStock must allow OWNER or MANAGER",
  );
  assert(
    settings.includes("function canEditPharmacyHeader"),
    "Pharmacy header Owner/Manager edit helper must remain",
  );

  assert(
    settings.includes('"receive"') &&
      settings.includes('sectionOrder') &&
      settings.includes('"language", "pharmacy", "receive", "connectivity"') &&
      settings.includes('"language", "pharmacy", "connectivity"'),
    "sectionOrder must include receive only on the Owner/Manager list",
  );
  assert(
    /canReceive \? \(/.test(settings) &&
      settings.includes('t("settings.receiveStock")'),
    "Receive stock nav must render only when canReceive",
  );
  assert(
    settings.includes("ReceiveStockSection") &&
      settings.includes('t("settings.receiveStock")'),
    "Receive stock body must be ReceiveStockSection (Batch C form)",
  );

  assert(
    !settings.includes("[Tab]") && !/Tab is NOT/.test(settings),
    "Settings must not introduce Tab as a POS navigator",
  );
  assert(
    !/sidebar.*[Ii]nventory|Inventory/.test(settings),
    "Do not add a sidebar Inventory item",
  );

  console.log("  ✓ Settings Receive stock Owner/Manager guard + form");
}

function checkSelectCustomerLock(): void {
  const modal = readSrc("features/pos/SelectCustomerModal.tsx");
  assert(
    modal.includes("No PATCH-customer UI on POS"),
    "Select Customer must keep the M5 no-PATCH lock comment",
  );

  const search = readSrc("lib/customerSearch.ts");
  assert(
    search.includes("GET /customers") || search.includes("/api/v1/customers?"),
    "customerSearch must remain GET search",
  );
  assert(
    !/method:\s*["']PATCH["']/.test(search),
    "customerSearch must not PATCH customers",
  );
  assert(
    search.includes("no PATCH /customers"),
    "customerSearch must document the M5 no-PATCH lock",
  );

  console.log("  ✓ Select Customer has no PATCH UI");
}

function checkNoPostCustomersFromApp(): void {
  const app = readSrc("App.tsx");
  assert(
    !app.includes("customer.createNew"),
    "App must not host Create Customer directly",
  );

  const files = walkTs(SRC);
  const offenders: string[] = [];
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    if (!src.includes("/api/v1/customers")) continue;
    if (/method:\s*["']POST["']/.test(src) && /\/api\/v1\/customers/.test(src)) {
      // Heuristic: POST near customers in the same file
      const hasPostCustomers =
        /\/api\/v1\/customers[\s\S]{0,200}method:\s*["']POST["']/.test(src) ||
        /method:\s*["']POST["'][\s\S]{0,200}\/api\/v1\/customers/.test(src);
      if (hasPostCustomers && !file.endsWith("SelectCustomerModal.tsx")) {
        offenders.push(file.slice(SRC.length + 1));
      }
    }
  }
  assert(
    offenders.length === 0,
    `desktop src must not POST /customers except in SelectCustomerModal (found: ${offenders.join(", ")})`,
  );

  console.log("  ✓ no unexpected POST /customers from desktop App / src");
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
  console.log("  ✓ i18n receive-stock keys in en + bn-BD");
}

function main(): void {
  console.log("smoke:m5b — M5 Batch B Desktop RBAC shell\n");
  checkSettingsReceiveGuard();
  checkSelectCustomerLock();
  checkNoPostCustomersFromApp();
  checkI18n();
  console.log("\nPASS — smoke:m5b");
}

main();
