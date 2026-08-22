/**
 * M6 Batch AU smoke — Staff deactivate/reactivate modals.
 * Run: npm run smoke:m6au -w @r2a/web
 */

import { readFileSync } from "node:fs";
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

const STATUS_MODAL_I18N_KEYS = [
  "staff.statusModal.deactivateTitle",
  "staff.statusModal.reactivateTitle",
  "staff.statusModal.deactivateDescription",
  "staff.statusModal.reactivateDescription",
  "staff.statusModal.deactivateImpactTitle",
  "staff.statusModal.reactivateImpactTitle",
  "staff.statusModal.reasonLabel",
  "staff.statusModal.reasonPlaceholder",
  "staff.statusModal.deactivateConfirm",
  "staff.statusModal.reactivateConfirm",
  "staff.statusModal.deactivateAction",
  "staff.statusModal.reactivateAction",
  "staff.statusModal.processing",
  "staff.statusModal.submitError",
] as const;

function checkPackage(): void {
  const pkg = JSON.parse(readRel("package.json")) as {
    name?: string;
    scripts?: Record<string, string>;
  };
  assert(pkg.name === "@r2a/web", `package name must be @r2a/web, got ${pkg.name}`);
  assert(pkg.scripts?.["smoke:m6au"]?.includes("smoke-m6au"), "package.json must define smoke:m6au");
  console.log("  ✓ package @r2a/web + smoke:m6au");
}

function checkI18n(): void {
  const en = readSrc("i18n/locales/en.ts");
  const bn = readSrc("i18n/locales/bn-BD.ts");
  for (const key of STATUS_MODAL_I18N_KEYS) {
    assert(en.includes(`"${key}"`) && bn.includes(`"${key}"`), `${key} must exist in en and bn-BD`);
  }
  console.log("  ✓ staff status modal i18n keys in en + bn-BD");
}

function checkLib(): void {
  const lib = readSrc("lib/staff.ts");
  assert(lib.includes("deactivateStaff") && lib.includes("/deactivate"), "lib/staff.ts must export deactivateStaff using the deactivate endpoint");
  assert(lib.includes("reactivateStaff") && lib.includes("/reactivate"), "lib/staff.ts must export reactivateStaff using the reactivate endpoint");
  assert(lib.includes("body: { reason }"), "deactivateStaff must send optional reason");
  console.log("  ✓ owner staff deactivate/reactivate API client methods");
}

function checkPage(): void {
  const page = readSrc("features/staff/StaffDetailPage.tsx");
  assert(page.includes("deactivateStaff") && page.includes("reactivateStaff"), "StaffDetailPage must wire deactivate/reactivate clients");
  assert(page.includes("StaffStatusModal"), "StaffDetailPage must render the shared status modal");
  assert(page.includes("confirmed") && page.includes("disabled={!confirmed || submitting}"), "status actions must be checkbox gated");
  assert(page.includes("reason.trim()"), "deactivation must submit the optional reason");
  assert(page.includes("!isSelf") && page.includes("{modal && !isSelf"), "self actions must never show status modals");
  assert(page.includes("setReload((n) => n + 1)"), "successful status changes must refresh details");
  console.log("  ✓ StaffDetailPage wires checkbox-gated deactivate/reactivate modals and self-lockout");
}

function main(): void {
  console.log("M6 Batch AU smoke (@r2a/web)\n");
  checkPackage();
  checkI18n();
  checkLib();
  checkPage();
  console.log("\nPASS");
}

try {
  main();
} catch (err) {
  console.error("\nFAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
}
