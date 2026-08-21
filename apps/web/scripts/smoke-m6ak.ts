/**
 * M6 Batch AK smoke — Registration Review + Approve / Reject modals.
 * Run: npm run smoke:m6ak -w @r2a/web
 *
 * Source guards only (no live API — the server's m6af smoke already verifies
 * the live flow: approve → ACTIVE, POS GET /customers returns Active only,
 * reject → REJECTED and hidden from the directory). The page fetches live
 * GET /api/v1/owner/customers/:id (OWNER only) and renders the read-only POS
 * registration request (name/phone/source/submitted/branch/by) with a live
 * duplicate check plus an editable profile the Owner may correct before
 * approving. Approve (shared checkbox-gated modal) → POST .../approve →
 * Details. Reject (invented checkbox-gated modal) → POST .../reject → list
 * (row gone). Cancel → list. A non-pending id redirects to Details (the detail
 * API filters out REJECTED rows, so those surface as the not-found state). No
 * POS Create (Batch AL). No hard-coded sample data.
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

const REVIEW_I18N_KEYS = [
  "customers.review.crumb",
  "customers.review.title",
  "customers.review.subtitle",
  "customers.review.request.title",
  "customers.review.request.hint",
  "customers.review.request.name",
  "customers.review.request.phone",
  "customers.review.request.source",
  "customers.review.request.branch",
  "customers.review.request.submitted",
  "customers.review.request.by",
  "customers.review.profile.title",
  "customers.review.profile.hint",
  "customers.review.duplicate.available",
  "customers.review.duplicate.warning",
  "customers.review.rail.registration.title",
  "customers.review.rail.registration.source",
  "customers.review.rail.registration.branch",
  "customers.review.rail.registration.submitted",
  "customers.review.rail.registration.by",
  "customers.review.rail.registration.phone",
  "customers.review.rail.approval.title",
  "customers.review.rail.approval.body",
  "customers.review.approve",
  "customers.review.reject",
  "customers.review.cancel",
  "customers.review.approveModal.title",
  "customers.review.approveModal.intro",
  "customers.review.approveModal.summaryTitle",
  "customers.review.approveModal.corrections",
  "customers.review.approveModal.afterTitle",
  "customers.review.approveModal.after1",
  "customers.review.approveModal.after2",
  "customers.review.approveModal.after3",
  "customers.review.approveModal.after4",
  "customers.review.approveModal.confirmLabel",
  "customers.review.approveModal.submit",
  "customers.review.approveModal.submitting",
  "customers.review.approveModal.cancel",
  "customers.review.approveModal.close",
  "customers.review.approveModal.error",
  "customers.review.rejectModal.title",
  "customers.review.rejectModal.intro",
  "customers.review.rejectModal.summaryTitle",
  "customers.review.rejectModal.note",
  "customers.review.rejectModal.notePlaceholder",
  "customers.review.rejectModal.confirmLabel",
  "customers.review.rejectModal.submit",
  "customers.review.rejectModal.submitting",
  "customers.review.rejectModal.cancel",
  "customers.review.rejectModal.close",
  "customers.review.rejectModal.error",
  "customers.review.back",
] as const;

function checkPackage(): void {
  const pkg = JSON.parse(readRel("package.json")) as {
    name?: string;
    scripts?: Record<string, string>;
  };
  assert(pkg.name === "@r2a/web", `package name must be @r2a/web, got ${pkg.name}`);
  assert(
    pkg.scripts?.["smoke:m6ak"]?.includes("smoke-m6ak"),
    "package.json must define smoke:m6ak",
  );
  console.log("  ✓ package @r2a/web + smoke:m6ak");
}

function checkI18n(): void {
  const en = readSrc("i18n/locales/en.ts");
  const bn = readSrc("i18n/locales/bn-BD.ts");
  for (const key of REVIEW_I18N_KEYS) {
    assert(
      en.includes(`"${key}"`) && bn.includes(`"${key}"`),
      `${key} must exist in en and bn-BD`,
    );
  }
  console.log("  ✓ customers.review i18n keys in en + bn-BD");
}

function checkLib(): void {
  const lib = readSrc("lib/customers.ts");
  assert(
    lib.includes("approveCustomer") &&
      lib.includes("/api/v1/owner/customers/${encodeURIComponent(customerId)}/approve") &&
      lib.includes("method: \"POST\""),
    "customers lib must expose approveCustomer → POST /api/v1/owner/customers/:id/approve",
  );
  assert(
    lib.includes("rejectCustomer") &&
      lib.includes("/api/v1/owner/customers/${encodeURIComponent(customerId)}/reject"),
    "customers lib must expose rejectCustomer → POST /api/v1/owner/customers/:id/reject",
  );
  assert(
    lib.includes("CustomerApprovePayload") &&
      lib.includes("CustomerRejectPayload") &&
      lib.includes("rejectionNote"),
    "approve/reject payload types must be present (rejectionNote on reject)",
  );
  console.log("  ✓ live approve/reject clients + typed payloads");
}

function checkPage(): void {
  const page = readSrc("features/customers/RegistrationReviewPage.tsx");
  assert(
    page.includes("fetchCustomerDetail"),
    "RegistrationReviewPage must call fetchCustomerDetail",
  );
  assert(
    page.includes('status !== "PENDING_APPROVAL"') &&
      page.includes("navigate(`/customers/${encodeURIComponent(payload.profile.id)}`)"),
    "ACTIVE/INACTIVE id must redirect to Details",
  );
  assert(
    page.includes('t("customers.review.request.title")') &&
      page.includes('t("customers.review.request.name")') &&
      page.includes('t("customers.review.request.phone")') &&
      page.includes('t("customers.review.request.source")') &&
      page.includes('t("customers.review.request.submitted")') &&
      page.includes('t("customers.review.request.branch")') &&
      page.includes('t("customers.review.request.by")'),
    "Registration Request must show read-only name/phone/source/submitted/branch/by",
  );
  assert(
    page.includes("checkCustomerPhone") &&
      page.includes("duplicate") &&
      page.includes('t("customers.review.duplicate.warning")'),
    "Editable profile must run a live duplicate check on the phone",
  );
  assert(
    page.includes('t("customers.review.profile.title")') &&
      page.includes('t("customers.review.profile.hint")'),
    "Editable Review Profile must be present (Owner may correct before approve)",
  );
  assert(
    page.includes('t("customers.review.rail.registration.title")') &&
      page.includes('t("customers.review.rail.registration.by")') &&
      page.includes('t("customers.review.rail.approval.title")') &&
      page.includes('t("customers.review.rail.approval.body")'),
    "Right rail must show Registration Info + Approval Action copy",
  );
  assert(
    page.includes("approveCustomer") &&
      page.includes('t("customers.review.approveModal.confirmLabel")') &&
      page.includes("navigate(`/customers/${encodeURIComponent(customer.profile.id)}`)"),
    "Approve modal must be checkbox-gated and navigate to Details on success",
  );
  assert(
    page.includes("rejectCustomer") &&
      page.includes('t("customers.review.rejectModal.confirmLabel")') &&
      page.includes('t("customers.review.rejectModal.note")') &&
      page.includes('navigate("/customers")'),
    "Reject modal must be invented (checkbox-gated, optional note) and navigate to list on success",
  );
  assert(
    page.includes('t("customers.review.cancel")') &&
      page.includes('navigate("/customers")'),
    "Cancel must return to the customer list",
  );
  assert(
    !page.includes("createCustomer"),
    "Review must NOT build POS Create (Batch AL)",
  );
  assert(
    page.includes("formatDateTime"),
    "Review must format live submission dates",
  );
  console.log("  ✓ RegistrationReviewPage: request + profile + approve/reject modals + redirects");
}

function checkAppShell(): void {
  const appShell = readSrc("features/shell/AppShell.tsx");
  assert(
    appShell.includes("RegistrationReviewPage") &&
      appShell.includes('sub.kind === "review"'),
    "AppShell must route /customers/:id/review to RegistrationReviewPage",
  );
  assert(
    !appShell.includes("CustomersPlaceholder"),
    "CustomersPlaceholder must be removed now that Review is live",
  );
  console.log("  ✓ review route live in AppShell");
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
    "Review must not hard-code the sample customer (Sadia Akter / 2,417 / 01710)",
  );
  assert(
    !/৳\d/.test(customersOnly),
    "Review must not hard-code mock ৳ totals",
  );
  console.log("  ✓ no invented sample customer data / mock ৳ in customers code");
}

function main(): void {
  console.log("M6 Batch AK smoke (@r2a/web)\n");
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