/**
 * M6 Batch AH smoke — Customers list.
 * Run: npm run smoke:m6ah -w @r2a/web
 *
 * Source guards only (no live API). Customers directory is a live page backed
 * by GET /owner/customers. Add Customer → /customers/new, Pending rows →
 * /customers/:id/review, Active/Inactive rows → /customers/:id. No hard-coded
 * 2,417 or mock ৳ totals. new/review/detail stay placeholder shells (AI–AK).
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

const CUSTOMERS_I18N_KEYS = [
  "page.customersTitle",
  "customers.subtitle",
  "customers.directory",
  "customers.addCustomer",
  "customers.loading",
  "customers.error",
  "customers.retry",
  "customers.empty",
  "customers.kpi.registered",
  "customers.kpi.pending",
  "customers.kpi.active90",
  "customers.kpi.loyalty",
  "customers.tab.all",
  "customers.tab.pending",
  "customers.tab.active",
  "customers.tab.inactive",
  "customers.filter.status",
  "customers.filter.source",
  "customers.filter.sort",
  "customers.source.ownerCreated",
  "customers.source.posRegistration",
  "customers.status.active",
  "customers.status.pending",
  "customers.status.inactive",
  "customers.col.customer",
  "customers.col.phone",
  "customers.col.source",
  "customers.col.loyaltyPoints",
  "customers.col.registered",
  "customers.col.status",
  "customers.showing",
  "customers.of",
  "customers.customers",
] as const;

function checkPackage(): void {
  const pkg = JSON.parse(readRel("package.json")) as {
    name?: string;
    scripts?: Record<string, string>;
  };
  assert(pkg.name === "@r2a/web", `package name must be @r2a/web, got ${pkg.name}`);
  assert(
    pkg.scripts?.["smoke:m6ah"]?.includes("smoke-m6ah"),
    "package.json must define smoke:m6ah",
  );
  console.log("  ✓ package @r2a/web + smoke:m6ah");
}

function checkI18n(): void {
  const en = readSrc("i18n/locales/en.ts");
  const bn = readSrc("i18n/locales/bn-BD.ts");
  for (const key of CUSTOMERS_I18N_KEYS) {
    assert(
      en.includes(`"${key}"`) && bn.includes(`"${key}"`),
      `${key} must exist in en and bn-BD`,
    );
  }
  console.log("  ✓ customers list i18n keys in en + bn-BD");
}

function checkLib(): void {
  const lib = readSrc("lib/customers.ts");
  assert(
    lib.includes("/api/v1/owner/customers"),
    "lib/customers.ts must call GET /api/v1/owner/customers",
  );
  assert(
    lib.includes("CustomerKpis") &&
      lib.includes("registered") &&
      lib.includes("pending") &&
      lib.includes("active90d") &&
      lib.includes("loyaltyPointsIssued"),
    "customers lib must map meta.kpis (registered/pending/active90d/loyaltyPointsIssued)",
  );
  console.log("  ✓ live owner customers client + KPI meta mapping");
}

function checkPage(): void {
  const page = readSrc("features/customers/CustomersPage.tsx");
  assert(page.includes("fetchCustomers"), "CustomersPage must call fetchCustomers");
  assert(
    page.includes('t("customers.tab.all")') &&
      page.includes('t("customers.tab.pending")') &&
      page.includes('t("customers.tab.active")') &&
      page.includes('t("customers.tab.inactive")'),
    "CustomersPage must render All/Pending/Active/Inactive tabs",
  );
  assert(
    page.includes('t("customers.filter.source")') &&
      page.includes('t("customers.filter.sort")'),
    "CustomersPage must render Source and Sort filters",
  );
  assert(
    page.includes('navigate("/customers/new")'),
    "Add Customer must navigate to /customers/new",
  );
  assert(
    page.includes("/review") &&
      page.includes('status === "PENDING_APPROVAL"'),
    "Pending rows must navigate to /customers/:id/review",
  );
  assert(
    page.includes("customerDetailPath") &&
      page.includes("formatSalesDateTime") &&
      page.includes("formatCount"),
    "CustomersPage must format dates/counts from live data",
  );
  console.log("  ✓ CustomersPage renders KPIs, tabs, filters, table, navigation");
}

function checkAppShell(): void {
  const appShell = readSrc("features/shell/AppShell.tsx");
  assert(
    appShell.includes("CustomersPage") &&
      appShell.includes('sub.kind === "list"'),
    "AppShell must route the /customers list to CustomersPage",
  );
  assert(
    appShell.includes("CustomersPlaceholder"),
    "new/review/detail must stay placeholder shells (AI–AK)",
  );
  console.log("  ✓ list live; new/review/detail still placeholder");
}

function checkNoMockData(): void {
  const files = walkTs(SRC);
  const customersOnly = files
    .filter((p) => p.includes("customers"))
    .map((p) => readFileSync(p, "utf8"))
    .join("\n");
  assert(
    !/2,?417/.test(customersOnly) && !/184,?600/.test(customersOnly),
    "Customers page must not hard-code directory totals (2,417 / 184,600)",
  );
  assert(
    !/৳\d/.test(customersOnly),
    "Customers page must not hard-code mock ৳ totals",
  );
  console.log("  ✓ no invented customer totals / mock ৳ in customers code");
}

function main(): void {
  console.log("M6 Batch AH smoke (@r2a/web)\n");
  checkPackage();
  checkI18n();
  checkLib();
  checkPage();
  checkAppShell();
  checkNoMockData();
  console.log("\nPASS");
}

try {
  main();
} catch (err) {
  console.error("\nFAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
}