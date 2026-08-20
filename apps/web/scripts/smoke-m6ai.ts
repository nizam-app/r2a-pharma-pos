/**
 * M6 Batch AI smoke — Owner Add Customer form + create confirm modal.
 * Run: npm run smoke:m6ai -w @r2a/web
 *
 * Source guards only (no live API). The form posts live to POST /api/v1/customers
 * (OWNER only — always ACTIVE + OWNER_CREATED) with a debounced
 * GET /api/v1/customers/phone-check duplicate guard. Creating opens a checkbox-gated
 * Create Confirm modal and navigates to /customers/:id (Customer Details — Batch AJ).
 * No hard-coded ৳ totals or sample customer data.
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

const ADD_CUSTOMER_I18N_KEYS = [
  "customers.add.crumb",
  "customers.add.title",
  "customers.add.subtitle",
  "customers.add.cancel",
  "customers.add.createCustomer",
  "customers.add.customerInfo",
  "customers.add.customerInfoHint",
  "customers.add.name",
  "customers.add.namePlaceholder",
  "customers.add.nameRequired",
  "customers.add.phone",
  "customers.add.phonePlaceholder",
  "customers.add.phoneRequired",
  "customers.add.email",
  "customers.add.emailPlaceholder",
  "customers.add.emailInvalid",
  "customers.add.dateOfBirth",
  "customers.add.gender",
  "customers.add.genderSelect",
  "customers.add.gender.male",
  "customers.add.gender.female",
  "customers.add.gender.other",
  "customers.add.address",
  "customers.add.addressPlaceholder",
  "customers.add.phoneCheck.checking",
  "customers.add.phoneCheck.title",
  "customers.add.phoneCheck.available",
  "customers.add.phoneCheck.duplicate",
  "customers.add.phoneCheck.viewProfile",
  "customers.add.directTitle",
  "customers.add.directBody",
  "customers.add.systemTitle",
  "customers.add.systemSource",
  "customers.add.systemBranch",
  "customers.add.systemCreatedBy",
  "customers.add.systemNote",
  "customers.add.unsavedTitle",
  "customers.add.unsavedBody",
  "customers.add.keepEditing",
  "customers.add.discardChanges",
  "customers.add.validation",
  "customers.add.submitError",
  "customers.add.confirm.title",
  "customers.add.confirm.close",
  "customers.add.confirm.intro",
  "customers.add.confirm.summaryTitle",
  "customers.add.confirm.name",
  "customers.add.confirm.phone",
  "customers.add.confirm.branch",
  "customers.add.confirm.source",
  "customers.add.confirm.afterTitle",
  "customers.add.confirm.after1",
  "customers.add.confirm.after2",
  "customers.add.confirm.after3",
  "customers.add.confirm.after4",
  "customers.add.confirm.after5",
  "customers.add.confirm.confirmLabel",
  "customers.add.confirm.submit",
  "customers.add.confirm.submitting",
  "customers.add.confirm.cancel",
  "customers.add.confirm.error",
] as const;

function checkPackage(): void {
  const pkg = JSON.parse(readRel("package.json")) as {
    name?: string;
    scripts?: Record<string, string>;
  };
  assert(pkg.name === "@r2a/web", `package name must be @r2a/web, got ${pkg.name}`);
  assert(
    pkg.scripts?.["smoke:m6ai"]?.includes("smoke-m6ai"),
    "package.json must define smoke:m6ai",
  );
  console.log("  ✓ package @r2a/web + smoke:m6ai");
}

function checkI18n(): void {
  const en = readSrc("i18n/locales/en.ts");
  const bn = readSrc("i18n/locales/bn-BD.ts");
  for (const key of ADD_CUSTOMER_I18N_KEYS) {
    assert(
      en.includes(`"${key}"`) && bn.includes(`"${key}"`),
      `${key} must exist in en and bn-BD`,
    );
  }
  console.log("  ✓ customers.add i18n keys in en + bn-BD");
}

function checkAddCustomerPage(): void {
  const page = readSrc("features/customers/AddCustomerPage.tsx");
  const customersLib = readSrc("lib/customers.ts");
  const shell = readSrc("features/shell/AppShell.tsx");
  const all = walkTs(SRC)
    .map((p) => readFileSync(p, "utf8"))
    .join("\n");

  assert(
    customersLib.includes("createCustomer") &&
      customersLib.includes('"/api/v1/customers"') &&
      customersLib.includes("apiRequest") &&
      customersLib.includes('method: "POST"'),
    "customers lib must post createCustomer to /api/v1/customers",
  );
  assert(
    customersLib.includes("checkCustomerPhone") &&
      customersLib.includes("/api/v1/customers/phone-check"),
    "customers lib must expose checkCustomerPhone to /api/v1/customers/phone-check",
  );
  assert(
    page.includes("customers.add.customerInfo") &&
      page.includes("customers.add.phoneCheck.title") &&
      page.includes("customers.add.directTitle") &&
      page.includes("customers.add.systemTitle"),
    "Add Customer must include the form card, duplicate check, direct creation and system info cards",
  );
  assert(
    page.includes("customers.add.name") &&
      page.includes("customers.add.nameRequired") &&
      page.includes("customers.add.phone") &&
      page.includes("customers.add.phoneRequired"),
    "Customer name and phone must be required",
  );
  assert(
    page.includes("customers.add.gender") &&
      page.includes('value="MALE"') &&
      page.includes('value="FEMALE"') &&
      page.includes('value="OTHER"'),
    "Gender dropdown must offer MALE / FEMALE / OTHER",
  );
  assert(
    page.includes("checkCustomerPhone") &&
      page.includes('status: "duplicate"') &&
      page.includes("customers.add.phoneCheck.duplicate") &&
      page.includes("customers.add.phoneCheck.viewProfile"),
    "Phone field must run a debounced duplicate check with a view-profile link",
  );
  assert(
    page.includes("storeName") &&
      page.includes("customers.add.systemBranch") &&
      page.includes("customers.add.systemCreatedBy") &&
      page.includes("customers.source.ownerCreated"),
    "System Information must show live source / branch / created by",
  );
  assert(
    page.includes("createCustomer") &&
      page.includes("navigate(`/customers/${encodeURIComponent(created.id)}`)"),
    "Submit must create the customer then navigate to Customer Details",
  );
  assert(
    page.includes("setNavigationBlocker") &&
      page.includes("customers.add.unsavedTitle"),
    "Unsaved-changes guard must be present",
  );
  assert(
    page.includes("customers.add.confirm.confirmLabel") &&
      page.includes("disabled={!confirmed || submitting}") &&
      page.includes("bg-[#79b5ae]") &&
      page.includes("bg-[#00766c]") &&
      page.includes("hover:bg-[#00635c]"),
    "Create Confirm modal must gate creation behind the confirmation checkbox",
  );
  assert(
    page.includes('role="dialog"') &&
      page.includes('aria-modal="true"') &&
      page.includes("aria-labelledby=\"create-customer-title\"") &&
      page.includes("customers.add.confirm.afterTitle"),
    "Create Confirm modal must be a labelled, focus-trapped dialog with post-creation panel",
  );
  assert(
    shell.includes("AddCustomerPage") &&
      shell.includes('sub.kind === "new"'),
    "AppShell must render AddCustomerPage for /customers/new",
  );
  assert(
    !/EditCustomerPage/.test(all) &&
      !shell.includes("customers.edit"),
    "No Edit Customer route may exist",
  );
  const hardcoded = [
    "Create a customer profile directly",
    "Enter customer name",
    "Checking customer",
    "What Happens After Creation",
    "Customer Summary",
    "Select gender",
    "Ayesha Rahman",
    "+8801677",
    "Dhanmondi Branch",
    "Demo Owner",
  ];
  for (const h of hardcoded) {
    assert(!page.includes(h), `hard-coded UI string must be i18n: ${h}`);
  }
  assert(
    !/₺/.test(all) && !/\$\d/.test(all),
    "Must not hard-code ₺ or mock dollar totals",
  );
  console.log("  ✓ live POST /customers + phone-check; checkbox-gated create confirm modal");
}

function main(): void {
  console.log("M6 Batch AI smoke (@r2a/web)\n");
  checkPackage();
  checkI18n();
  checkAddCustomerPage();
  console.log("\nPASS");
}

try {
  main();
} catch (err) {
  console.error("\nFAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
}