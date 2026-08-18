/** M6 Batch N source smoke — live, localized Expiry Management. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const KEYS = [
  "inventory.expiry.title",
  "inventory.expiry.subtitle",
  "inventory.expiry.bucket.0_30",
  "inventory.expiry.bucket.31_60",
  "inventory.expiry.bucket.61_90",
  "inventory.expiry.bucket.expired",
  "inventory.expiry.searchPlaceholder",
  "inventory.expiry.export",
  "inventory.expiry.filters",
  "inventory.expiry.filterMedicineAll",
  "inventory.expiry.filterFefoAll",
  "inventory.expiry.filterSupplierAll",
  "inventory.expiry.filterReturnAll",
  "inventory.expiry.col.returnEligibility",
  "inventory.expiry.col.selectAll",
  "inventory.expiry.prepareReturn",
] as const;

function main(): void {
  console.log("M6 Batch N smoke (@r2a/web)\n");
  const pkg = JSON.parse(read("package.json")) as { scripts?: Record<string, string> };
  const page = read("src/features/inventory/ExpiryManagementPage.tsx");
  const client = read("src/lib/ownerExpiry.ts");
  const shell = read("src/features/shell/AppShell.tsx");
  const inventory = read("src/features/inventory/InventoryPage.tsx");
  const en = read("src/i18n/locales/en.ts");
  const bn = read("src/i18n/locales/bn-BD.ts");

  assert(pkg.scripts?.["smoke:m6n"]?.includes("smoke-m6n"), "package must define smoke:m6n");
  assert(
    client.includes('"/api/v1/owner/expiry"') && page.includes("fetchOwnerExpiry()"),
    "Expiry page must call GET /api/v1/owner/expiry",
  );
  assert(
    shell.includes("ExpiryManagementPage") && shell.includes('sub.kind === "expiry"'),
    "AppShell must render ExpiryManagementPage for /inventory/expiry",
  );
  assert(
    page.includes("expiryBucketForDate") && page.includes("setBucket") && page.includes("setSearch"),
    "Expiry page must provide live bucket tabs and medicine/batch search",
  );
  assert(
    page.includes("FilterSelect") &&
      page.includes("setMedicine") &&
      page.includes("setFefo") &&
      page.includes("setSupplier") &&
      page.includes("setReturnStatus"),
    "Expiry page must provide Medicine, FEFO, Supplier, and Return dropdown filters",
  );
  assert(
    inventory.includes('navigate("/inventory/expiry")') &&
      inventory.includes("CalendarClock") &&
      inventory.includes("PackagePlus"),
    "Inventory must link to Expiry Management and use a Receive Stock package icon",
  );
  assert(
    page.includes("exportRows") &&
      page.includes("new Blob") &&
      page.includes("SelectAllCheckbox") &&
      page.includes('type="checkbox"'),
    "Expiry page must support CSV export and row selection",
  );
  assert(
    page.includes("inventory.expiry.prepareReturn") && /disabled\s*\n\s*aria-disabled/.test(page),
    "Prepare Supplier Return must remain disabled",
  );
  assert(
    client.includes("supplierName") &&
      client.includes("returnStatus") &&
      page.includes("row.supplierName") &&
      page.includes("ReturnStatusBadge"),
    "Supplier and return status must come from the live expiry response",
  );
  assert(!page.includes("Square Distribution") && !page.includes("ACME Distribution"), "Supplier rows must not be hard-coded in the UI");
  for (const key of KEYS) {
    assert(en.includes(`"${key}"`) && bn.includes(`"${key}"`), `${key} must exist in en and bn-BD`);
  }
  console.log("  ✓ live owner expiry API + route");
  console.log("  ✓ Inventory CTA, cards, tabs, search, export, and selection");
  console.log("  ✓ live Supplier/Return filters; return workflow remains disabled");
  console.log("  ✓ localized in en + bn-BD");
  console.log("\nPASS");
}

try {
  main();
} catch (error) {
  console.error("\nFAIL:", error instanceof Error ? error.message : error);
  process.exit(1);
}
