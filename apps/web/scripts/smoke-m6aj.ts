/**
 * M6 Batch AJ smoke — Owner Customer Details.
 * Run: npm run smoke:m6aj -w @r2a/web
 *
 * Source guards only (no live API). The page fetches live
 * GET /api/v1/owner/customers/:id (OWNER only) and renders header, KPIs,
 * customer information, registration information, purchase history,
 * loyalty activity and a known-facts timeline from live data. Purchase rows
 * navigate to /sales/:id. A PENDING_APPROVAL id redirects to the Review page.
 * Edit Customer + More Actions are disabled. No hard-coded sample data
 * (no Sadia Akter / ৳2,417 / mock totals).
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

const CUSTOMER_DETAIL_I18N_KEYS = [
  "customers.detail.crumb",
  "customers.detail.editCustomer",
  "customers.detail.moreActions",
  "customers.detail.editSoon",
  "customers.detail.moreSoon",
  "customers.detail.kpi.loyalty",
  "customers.detail.kpi.loyaltyHint",
  "customers.detail.kpi.totalPurchases",
  "customers.detail.kpi.totalPurchasesHint",
  "customers.detail.kpi.visits",
  "customers.detail.kpi.visitsHint",
  "customers.detail.kpi.lastPurchase",
  "customers.detail.kpi.lastPurchaseHint",
  "customers.detail.info.title",
  "customers.detail.info.name",
  "customers.detail.info.phone",
  "customers.detail.info.email",
  "customers.detail.info.dateOfBirth",
  "customers.detail.info.gender",
  "customers.detail.info.status",
  "customers.detail.info.address",
  "customers.detail.info.branch",
  "customers.detail.gender.male",
  "customers.detail.gender.female",
  "customers.detail.gender.other",
  "customers.detail.registration.title",
  "customers.detail.registration.notice",
  "customers.detail.registration.source",
  "customers.detail.registration.branch",
  "customers.detail.registration.submitted",
  "customers.detail.registration.submittedBy",
  "customers.detail.registration.approved",
  "customers.detail.registration.approvedBy",
  "customers.detail.registration.originalTitle",
  "customers.detail.registration.originalName",
  "customers.detail.registration.originalPhone",
  "customers.detail.purchaseHistory.title",
  "customers.detail.purchaseHistory.empty",
  "customers.detail.purchaseHistory.col.date",
  "customers.detail.purchaseHistory.col.receipt",
  "customers.detail.purchaseHistory.col.amount",
  "customers.detail.purchaseHistory.col.branch",
  "customers.detail.loyalty.title",
  "customers.detail.loyalty.balance",
  "customers.detail.loyalty.empty",
  "customers.detail.loyalty.col.date",
  "customers.detail.loyalty.col.activity",
  "customers.detail.loyalty.col.points",
  "customers.detail.loyalty.col.balance",
  "customers.detail.loyalty.earned",
  "customers.detail.loyalty.used",
  "customers.detail.timeline.title",
  "customers.detail.timeline.submitted",
  "customers.detail.timeline.approved",
  "customers.detail.loading",
  "customers.detail.error",
  "customers.detail.notFound",
  "customers.detail.back",
  "customers.detail.retry",
] as const;

function checkPackage(): void {
  const pkg = JSON.parse(readRel("package.json")) as {
    name?: string;
    scripts?: Record<string, string>;
  };
  assert(pkg.name === "@r2a/web", `package name must be @r2a/web, got ${pkg.name}`);
  assert(
    pkg.scripts?.["smoke:m6aj"]?.includes("smoke-m6aj"),
    "package.json must define smoke:m6aj",
  );
  console.log("  ✓ package @r2a/web + smoke:m6aj");
}

function checkI18n(): void {
  const en = readSrc("i18n/locales/en.ts");
  const bn = readSrc("i18n/locales/bn-BD.ts");
  for (const key of CUSTOMER_DETAIL_I18N_KEYS) {
    assert(
      en.includes(`"${key}"`) && bn.includes(`"${key}"`),
      `${key} must exist in en and bn-BD`,
    );
  }
  console.log("  ✓ customers.detail i18n keys in en + bn-BD");
}

function checkLib(): void {
  const lib = readSrc("lib/customers.ts");
  assert(
    lib.includes("fetchCustomerDetail") &&
      lib.includes("api/v1/owner/customers/${encodeURIComponent(customerId)}"),
    "customers lib must expose fetchCustomerDetail → GET /api/v1/owner/customers/:id",
  );
  assert(
    lib.includes("CustomerDetail") &&
      lib.includes("purchaseHistory") &&
      lib.includes("loyaltyActivity") &&
      lib.includes("lastPurchaseAt") &&
      lib.includes("storeName"),
    "CustomerDetail must map profile + purchaseHistory rows + loyaltyActivity rows",
  );
  console.log("  ✓ live owner customer detail client + typed payload");
}

function checkPage(): void {
  const page = readSrc("features/customers/CustomerDetailsPage.tsx");
  assert(
    page.includes("fetchCustomerDetail"),
    "CustomerDetailsPage must call fetchCustomerDetail",
  );
  assert(
    page.includes('t("customers.detail.kpi.loyalty")') &&
      page.includes('t("customers.detail.kpi.totalPurchases")') &&
      page.includes('t("customers.detail.kpi.visits")') &&
      page.includes('t("customers.detail.kpi.lastPurchase")'),
    "Header must render the four KPIs (loyalty / total purchases / visits / last purchase)",
  );
  assert(
    page.includes('t("customers.detail.info.title")') &&
      page.includes('t("customers.detail.info.name")') &&
      page.includes('t("customers.detail.info.branch")'),
    "Customer Information grid must be present (name / phone / branch …)",
  );
  assert(
    page.includes('t("customers.detail.registration.title")') &&
      page.includes('t("customers.detail.registration.source")') &&
      page.includes('t("customers.detail.registration.submittedBy")') &&
      page.includes('t("customers.detail.registration.originalTitle")'),
    "Registration Information + Original Registration Values must be present",
  );
  assert(
    page.includes('t("customers.detail.purchaseHistory.title")') &&
      page.includes('t("customers.detail.purchaseHistory.col.receipt")') &&
      page.includes('/sales/${encodeURIComponent(row.id)}'),
    "Purchase History rows must render and navigate to /sales/:id",
  );
  assert(
    page.includes('t("customers.detail.loyalty.title")') &&
      page.includes('t("customers.detail.loyalty.balance")') &&
      page.includes("loyaltyEarned") &&
      page.includes("loyaltyUsed") &&
      page.includes("balance"),
    "Loyalty Activity must show current balance + earn/redeem rows with running balance",
  );
  assert(
    page.includes('t("customers.detail.timeline.title")') &&
      page.includes('t("customers.detail.timeline.submitted")') &&
      page.includes('t("customers.detail.timeline.approved")'),
    "Timeline Activity must render known facts (submitted / approved)",
  );
  assert(
    page.includes('t("customers.detail.editCustomer")') &&
      page.includes('t("customers.detail.moreActions")') &&
      page.includes('disabled') &&
      page.includes('aria-disabled="true"'),
    "Edit Customer + More Actions must be disabled",
  );
  assert(
    page.includes('status === "PENDING_APPROVAL"') &&
      page.includes("/review"),
    "A PENDING_APPROVAL id must redirect to /customers/:id/review",
  );
  assert(
    page.includes("formatTaka") &&
      page.includes("formatCount") &&
      page.includes("formatSalesDateTime"),
    "Detail must format live currency/counts/dates",
  );
  assert(
    page.includes("purchaseHistory.lastPurchaseAt") &&
      page.includes('"—"'),
    "Last purchase / missing values must render live or an em dash",
  );
  console.log("  ✓ CustomerDetailsPage: header, KPIs, info, registration, history, loyalty, timeline");
}

function checkAppShell(): void {
  const appShell = readSrc("features/shell/AppShell.tsx");
  assert(
    appShell.includes("CustomerDetailsPage") &&
      appShell.includes('sub.kind === "detail"'),
    "AppShell must route /customers/:id to CustomerDetailsPage",
  );
  assert(
    appShell.includes("CustomersPlaceholder") &&
      appShell.includes('sub.kind === "review"'),
    "Review must stay the placeholder shell (Batch AK)",
  );
  console.log("  ✓ detail live; review still placeholder");
}

function checkNoMockData(): void {
  const files = walkTs(SRC);
  const customersOnly = files
    .filter((p) => p.includes("customers"))
    .map((p) => readFileSync(p, "utf8"))
    .join("\n");
  assert(
    !/Sadia Akter/.test(customersOnly) &&
      !/2,?417/.test(customersOnly) &&
      !/01710/.test(customersOnly),
    "Customer details must not hard-code the sample customer (Sadia Akter / 2,417 / 01710)",
  );
  assert(
    !/৳\d/.test(customersOnly),
    "Customer details must not hard-code mock ৳ totals",
  );
  console.log("  ✓ no invented sample customer data / mock ৳ in customers code");
}

function main(): void {
  console.log("M6 Batch AJ smoke (@r2a/web)\n");
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