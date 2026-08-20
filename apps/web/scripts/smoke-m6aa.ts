/**
 * M6 Batch AA smoke — Owner Expiry Returns queue.
 * Run: npm run smoke:m6aa -w @r2a/web
 *
 * Source guards only (no live API). The queue is live on GET /owner/returns/queue
 * (OWNER only). KPI cards, filters, table, and the selection bar are live.
 * Create Return Manifest navigates to /suppliers/returns/new (layout is Batch AB)
 * and is disabled for mixed-supplier or empty selection. Inventory Expiry
 * Prepare Supplier Return is enabled and routes here. Export / Print stay
 * disabled. No hard-coded ৳1,607 / Square Distribution sample rows.
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "src");
const SERVER_SERVICE = join(
  ROOT,
  "..",
  "server",
  "src",
  "modules",
  "purchasing",
  "purchasing.service.ts",
);
const SERVER_CONTROLLER = join(
  ROOT,
  "..",
  "server",
  "src",
  "modules",
  "purchasing",
  "purchasing.controller.ts",
);

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

const RETURNS_I18N_KEYS = [
  "suppliers.returns.title",
  "suppliers.returns.subtitle",
  "suppliers.returns.createManifest",
  "suppliers.returns.createDisabled",
  "suppliers.returns.mixedSupplier",
  "suppliers.returns.exportSoon",
  "suppliers.returns.printSoon",
  "suppliers.returns.loading",
  "suppliers.returns.error",
  "suppliers.returns.empty",
  "suppliers.returns.emptyFiltered",
  "suppliers.returns.kpi.eligible",
  "suppliers.returns.kpi.eligibleValue",
  "suppliers.returns.kpi.prepared",
  "suppliers.returns.kpi.review",
  "suppliers.returns.queueTitle",
  "suppliers.returns.searchPlaceholder",
  "suppliers.returns.filter.supplier",
  "suppliers.returns.filter.status",
  "suppliers.returns.col.medicine",
  "suppliers.returns.col.batch",
  "suppliers.returns.col.expiry",
  "suppliers.returns.col.quantity",
  "suppliers.returns.col.costValue",
  "suppliers.returns.col.supplier",
  "suppliers.returns.col.status",
  "suppliers.returns.status.eligible",
  "suppliers.returns.status.prepared",
  "suppliers.returns.status.notEligible",
  "suppliers.returns.footer",
  "inventory.expiry.prepareReturn",
  "inventory.expiry.prepareReturnHint",
] as const;

function checkPackage(): void {
  const pkg = JSON.parse(readRel("package.json")) as {
    name?: string;
    scripts?: Record<string, string>;
  };
  assert(pkg.name === "@r2a/web", `package name must be @r2a/web, got ${pkg.name}`);
  assert(
    pkg.scripts?.["smoke:m6aa"]?.includes("smoke-m6aa"),
    "package.json must define smoke:m6aa",
  );
  console.log("  ✓ package @r2a/web + smoke:m6aa");
}

function checkI18n(): void {
  const en = readSrc("i18n/locales/en.ts");
  const bn = readSrc("i18n/locales/bn-BD.ts");
  for (const key of RETURNS_I18N_KEYS) {
    assert(
      en.includes(`"${key}"`) && bn.includes(`"${key}"`),
      `${key} must exist in en and bn-BD`,
    );
  }
  console.log("  ✓ suppliers.returns i18n keys in en + bn-BD");
}

function checkClient(): void {
  const lib = readSrc("lib/returnQueue.ts");
  assert(
    lib.includes("fetchReturnQueue") &&
      lib.includes("/api/v1/owner/returns/queue") &&
      lib.includes("apiRequestEnvelope"),
    "returnQueue lib must fetch GET /api/v1/owner/returns/queue with an envelope",
  );
  assert(
    lib.includes("kpis") &&
      lib.includes("eligibleBatches") &&
      lib.includes("writeReturnManifestDraft") &&
      lib.includes("/suppliers/returns/new") === false,
    "Client must model kpis and persist a create-manifest draft without posting",
  );
  assert(
    lib.includes("writeReturnManifestDraft") &&
      lib.includes("RETURN_MANIFEST_DRAFT_KEY"),
    "Queue must hand selected lots to Batch AB via session draft",
  );
  console.log("  ✓ lib/returnQueue.ts live GET /owner/returns/queue + draft handoff");
}

function checkPage(): void {
  const page = readSrc("features/suppliers/ExpiryReturnsPage.tsx");
  const expiry = readSrc("features/inventory/ExpiryManagementPage.tsx");
  const shell = readSrc("features/shell/AppShell.tsx");
  const all = walkTs(SRC)
    .map((p) => readFileSync(p, "utf8"))
    .join("\n");

  assert(
    page.includes("fetchReturnQueue") &&
      page.includes("ExpiryReturnsPage") &&
      page.includes("suppliers.returns.kpi.eligible"),
    "Expiry Returns page must render live fetchReturnQueue with KPI cards",
  );
  assert(
    page.includes("formatTaka") &&
      page.includes("formatCount") &&
      page.includes("suppliers.returns.kpi.eligibleValue"),
    "KPI values must use live ৳/count formatting",
  );
  assert(
    page.includes("searchInput") &&
      page.includes("suppliers.returns.searchPlaceholder") &&
      page.includes("FilterDropdown") &&
      page.includes("suppliers.returns.filter.supplier") &&
      page.includes("suppliers.returns.filter.status"),
    "Queue must have search + supplier + return-status filters",
  );
  assert(
    page.includes("suppliers.returns.col.medicine") &&
      page.includes("suppliers.returns.col.batch") &&
      page.includes("suppliers.returns.col.expiry") &&
      page.includes("suppliers.returns.col.quantity") &&
      page.includes("suppliers.returns.col.costValue") &&
      page.includes("suppliers.returns.col.supplier") &&
      page.includes("suppliers.returns.col.status"),
    "Table must include medicine, batch, expiry, qty, cost, supplier, status",
  );
  assert(
    page.includes("mixedSupplier") &&
      page.includes("canCreate") &&
      page.includes("suppliers.returns.mixedSupplier"),
    "Mixed-supplier selection must block Create Return Manifest",
  );
  assert(
    page.includes('navigate("/suppliers/returns/new")') &&
      page.includes("writeReturnManifestDraft") &&
      !page.includes("/api/v1/owner/return-manifests"),
    "Create Manifest must navigate to /suppliers/returns/new and must not POST a manifest",
  );
  assert(
    page.includes("suppliers.returns.exportSoon") &&
      page.includes("suppliers.returns.printSoon") &&
      page.includes('aria-disabled="true"'),
    "Export and Print must stay disabled",
  );
  assert(
    expiry.includes('navigate("/suppliers/returns")') &&
      expiry.includes("inventory.expiry.prepareReturn") &&
      !/disabled\s*\n\s*aria-disabled/.test(expiry),
    "Inventory Expiry Prepare Supplier Return must navigate to /suppliers/returns",
  );
  assert(
    shell.includes("ExpiryReturnsPage") &&
      shell.includes('sub.kind === "returns"') &&
      shell.includes('sub.kind === "returnsNew"'),
    "AppShell must render ExpiryReturnsPage for /suppliers/returns and register /new",
  );
  assert(
    !page.includes("Square Distribution") &&
      !page.includes("ACME Distribution") &&
      !page.includes("Popular Medicine House") &&
      !/1,607/.test(all) &&
      !/1607/.test(page),
    "Must not hard-code sample supplier names or ৳1,607",
  );
  assert(
    !/₺/.test(all) && !/\$\d/.test(all),
    "Must not hard-code ₺ or mock dollar totals",
  );
  console.log("  ✓ live queue UI, mixed-supplier lock, Prepare Return wire, no Create Manifest layout");
}

function checkServer(): void {
  const service = readFileSync(SERVER_SERVICE, "utf8");
  const controller = readFileSync(SERVER_CONTROLLER, "utf8");
  assert(
    service.includes("export async function listReturnQueue") &&
      service.includes("eligibleBatches") &&
      service.includes("eligibleCostValue") &&
      service.includes("manifestsPrepared") &&
      service.includes("needsReview"),
    "listReturnQueue must compute additive queue KPIs",
  );
  assert(
    controller.includes("listReturnQueue") &&
      controller.includes("kpis: result.kpis") &&
      controller.includes("suppliers: result.suppliers"),
    "GET /owner/returns/queue meta must include kpis and suppliers",
  );
  console.log("  ✓ server return queue kpis + supplier filter options");
}

function main(): void {
  console.log("M6 Batch AA smoke (@r2a/web)\n");
  checkPackage();
  checkI18n();
  checkClient();
  checkPage();
  checkServer();
  console.log("\nPASS");
}

try {
  main();
} catch (err) {
  console.error("\nFAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
}
