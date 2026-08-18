/**
 * M6 Batch Y smoke — Owner Add Supplier form.
 * Run: npm run smoke:m6y -w @r2a/web
 *
 * Source guards only (no live API). The form posts live to POST /owner/suppliers
 * (OWNER only) and always creates an ACTIVE supplier — Save as Draft is disabled
 * because there is no Edit Supplier page. Creating navigates to /suppliers/:id
 * (Supplier Details — Batch Z). No hard-coded ৳ totals.
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

const ADD_SUPPLIER_I18N_KEYS = [
  "suppliers.add.crumb",
  "suppliers.add.title",
  "suppliers.add.subtitle",
  "suppliers.add.company",
  "suppliers.add.companyHint",
  "suppliers.add.name",
  "suppliers.add.namePlaceholder",
  "suppliers.add.contactPerson",
  "suppliers.add.contactPersonPlaceholder",
  "suppliers.add.phone",
  "suppliers.add.phonePlaceholder",
  "suppliers.add.secondaryPhone",
  "suppliers.add.secondaryPhonePlaceholder",
  "suppliers.add.email",
  "suppliers.add.emailPlaceholder",
  "suppliers.add.emailInvalid",
  "suppliers.add.address",
  "suppliers.add.addressPlaceholder",
  "suppliers.add.city",
  "suppliers.add.cityPlaceholder",
  "suppliers.add.registrationNumber",
  "suppliers.add.registrationNumberPlaceholder",
  "suppliers.add.paymentTerms",
  "suppliers.add.paymentTermsPlaceholder",
  "suppliers.add.activeNote",
  "suppliers.add.purchasingTitle",
  "suppliers.add.purchasingHint",
  "suppliers.add.leadTimeDays",
  "suppliers.add.leadTimeDaysHint",
  "suppliers.add.minOrderValue",
  "suppliers.add.minOrderValueHint",
  "suppliers.add.preferredContact",
  "suppliers.add.preferredContactNone",
  "suppliers.add.preferredContact.phone",
  "suppliers.add.preferredContact.email",
  "suppliers.add.preferredContact.whatsapp",
  "suppliers.add.expiryTitle",
  "suppliers.add.expiryHint",
  "suppliers.add.expiryReturnsAccepted",
  "suppliers.add.minDaysBeforeExpiry",
  "suppliers.add.minDaysBeforeExpiryHint",
  "suppliers.add.returnNotes",
  "suppliers.add.returnNotesPlaceholder",
  "suppliers.add.notesTitle",
  "suppliers.add.notes",
  "suppliers.add.notesPlaceholder",
  "suppliers.add.summary.title",
  "suppliers.add.summary.empty",
  "suppliers.add.summary.supplier",
  "suppliers.add.summary.contact",
  "suppliers.add.summary.phone",
  "suppliers.add.summary.city",
  "suppliers.add.summary.paymentTerms",
  "suppliers.add.summary.leadTime",
  "suppliers.add.summary.minOrder",
  "suppliers.add.summary.expiryReturns",
  "suppliers.add.summary.expiryWindow",
  "suppliers.add.summary.none",
  "suppliers.add.yes",
  "suppliers.add.no",
  "suppliers.add.validation",
  "suppliers.add.submit",
  "suppliers.add.creating",
  "suppliers.add.cancel",
  "suppliers.add.submitError",
  "suppliers.add.unsavedTitle",
  "suppliers.add.unsavedBody",
  "suppliers.add.keepEditing",
  "suppliers.add.discardChanges",
] as const;

function checkPackage(): void {
  const pkg = JSON.parse(readRel("package.json")) as {
    name?: string;
    scripts?: Record<string, string>;
  };
  assert(pkg.name === "@r2a/web", `package name must be @r2a/web, got ${pkg.name}`);
  assert(
    pkg.scripts?.["smoke:m6y"]?.includes("smoke-m6y"),
    "package.json must define smoke:m6y",
  );
  console.log("  ✓ package @r2a/web + smoke:m6y");
}

function checkI18n(): void {
  const en = readSrc("i18n/locales/en.ts");
  const bn = readSrc("i18n/locales/bn-BD.ts");
  for (const key of ADD_SUPPLIER_I18N_KEYS) {
    assert(
      en.includes(`"${key}"`) && bn.includes(`"${key}"`),
      `${key} must exist in en and bn-BD`,
    );
  }
  assert(
    !en.includes('"suppliers.placeholder.new"') &&
      !bn.includes('"suppliers.placeholder.new"'),
    "superseded new-placeholder keys must be removed",
  );
  console.log("  ✓ suppliers.add i18n keys in en + bn-BD");
}

function checkAddSupplierPage(): void {
  const page = readSrc("features/suppliers/AddSupplierPage.tsx");
  const suppliersLib = readSrc("lib/suppliers.ts");
  const shell = readSrc("features/shell/AppShell.tsx");
  const all = walkTs(SRC)
    .map((p) => readFileSync(p, "utf8"))
    .join("\n");

  assert(
    suppliersLib.includes("createOwnerSupplier") &&
      suppliersLib.includes("/api/v1/owner/suppliers") &&
      suppliersLib.includes("apiRequest"),
    "suppliers lib must post createOwnerSupplier to /api/v1/owner/suppliers",
  );
  assert(
    page.includes("suppliers.add.company") &&
      page.includes("suppliers.add.purchasingTitle") &&
      page.includes("suppliers.add.expiryTitle") &&
      page.includes("suppliers.add.notesTitle"),
    "Add Supplier form must include company, purchasing, expiry returns and notes sections",
  );
  assert(
    page.includes("suppliers.add.name") &&
      page.includes("suppliers.add.contactPerson") &&
      page.includes("suppliers.add.phone") &&
      page.includes("suppliers.add.validation"),
    "Name, contact person and primary phone must be required",
  );
  assert(
    page.includes("suppliers.add.preferredContact") &&
      page.includes("suppliers.add.expiryReturnsAccepted") &&
      page.includes("suppliers.add.minDaysBeforeExpiry") &&
      page.includes("suppliers.add.minOrderValue") &&
      page.includes("suppliers.add.leadTimeDays"),
    "Shared fields: preferred contact, expiry returns window, min order value, lead time",
  );
  assert(
    page.includes("suppliers.add.summary.title") &&
      page.includes("formatTaka") &&
      page.includes("suppliers.add.summary.minOrder"),
    "Setup summary card must render live values with ৳ formatting",
  );
  assert(
    page.includes('status: "ACTIVE"') &&
      !page.includes('"DRAFT"') &&
      !page.includes("saveDraft"),
    "Suppliers are always created ACTIVE; Save as Draft must stay disabled",
  );
  assert(
    page.includes("createOwnerSupplier") &&
      page.includes('navigate(`/suppliers/${encodeURIComponent(created.id)}`)'),
    "Submit must create the supplier then navigate to Supplier Details",
  );
  assert(
    page.includes("setNavigationBlocker") &&
      page.includes("suppliers.add.unsavedTitle"),
    "Unsaved-changes guard must be present",
  );
  assert(
    shell.includes("AddSupplierPage") &&
      shell.includes('sub.kind === "new"') &&
      shell.includes("suppliersSubpath"),
    "AppShell must render AddSupplierPage for /suppliers/new via suppliersSubpath",
  );
  assert(
    !shell.includes("suppliers.placeholder.new"),
    "AppShell must not use the superseded new placeholder",
  );
  assert(
    !/EditSupplierPage/.test(all) &&
      !shell.includes("suppliers.edit"),
    "No Edit Supplier route may exist",
  );
  assert(
    !/₺/.test(all) && !/\$\d/.test(all),
    "Must not hard-code ₺ or mock dollar totals",
  );
  console.log("  ✓ live POST /owner/suppliers; ACTIVE-only form + setup summary");
}

function main(): void {
  console.log("M6 Batch Y smoke (@r2a/web)\n");
  checkPackage();
  checkI18n();
  checkAddSupplierPage();
  console.log("\nPASS");
}

try {
  main();
} catch (err) {
  console.error("\nFAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
}