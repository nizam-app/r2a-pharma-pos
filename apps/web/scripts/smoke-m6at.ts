/**
 * M6 Batch AT smoke — Edit Staff.
 * Run: npm run smoke:m6at -w @r2a/web
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

const EDIT_STAFF_I18N_KEYS = [
  "staff.placeholder.editTitle",
  "staff.edit.subtitle",
  "staff.edit.loading",
  "staff.edit.loadError",
  "staff.edit.usernameHint",
  "staff.edit.accessImpactTitle",
  "staff.edit.accessImpactBody",
  "staff.edit.unsavedTitle",
  "staff.edit.unsavedBody",
  "staff.edit.save",
  "staff.edit.saving",
  "staff.edit.cancel",
  "staff.edit.submitError",
] as const;

function checkPackage(): void {
  const pkg = JSON.parse(readRel("package.json")) as {
    name?: string;
    scripts?: Record<string, string>;
  };
  assert(pkg.name === "@r2a/web", `package name must be @r2a/web, got ${pkg.name}`);
  assert(pkg.scripts?.["smoke:m6at"]?.includes("smoke-m6at"), "package.json must define smoke:m6at");
  console.log("  ✓ package @r2a/web + smoke:m6at");
}

function checkI18n(): void {
  const en = readSrc("i18n/locales/en.ts");
  const bn = readSrc("i18n/locales/bn-BD.ts");
  for (const key of EDIT_STAFF_I18N_KEYS) {
    assert(en.includes(`"${key}"`) && bn.includes(`"${key}"`), `${key} must exist in en and bn-BD`);
  }
  console.log("  ✓ edit staff i18n keys in en + bn-BD");
}

function checkLib(): void {
  const lib = readSrc("lib/staff.ts");
  assert(lib.includes("patchStaff") && lib.includes('method: "PATCH"'), "lib/staff.ts must export patchStaff using PATCH");
  assert(lib.includes("/api/v1/owner/users/"), "patchStaff must target /api/v1/owner/users/:id");
  console.log("  ✓ owner staff patch API client method");
}

function checkPage(): void {
  const page = readSrc("features/staff/EditStaffPage.tsx");
  assert(page.includes("fetchStaffDetail"), "EditStaffPage must prefill from fetchStaffDetail");
  assert(page.includes("patchStaff"), "EditStaffPage must save through patchStaff");
  assert(page.includes("usernameHint") && page.includes("disabled"), "EditStaffPage must render read-only username helper");
  assert(page.includes("sessionUser?.id === loaded.id"), "EditStaffPage must block self edit navigation");
  assert(page.includes("accessImpact"), "EditStaffPage must include access impact info callout");
  assert(!page.includes("deactivateStaff") && !page.includes("reactivateStaff"), "Batch AT must not wire AU deactivate/reactivate actions");
  console.log("  ✓ EditStaffPage prefill, save, self-block, read-only username, and no AU actions");
}

function checkRouting(): void {
  const shell = readSrc("features/shell/AppShell.tsx");
  const index = readSrc("features/staff/index.ts");
  assert(shell.includes("EditStaffPage") && shell.includes('sub.kind === "edit"'), "AppShell must route /staff/:userId/edit to EditStaffPage");
  assert(index.includes("EditStaffPage"), "features/staff index must export EditStaffPage");
  console.log("  ✓ EditStaffPage routing live");
}

function main(): void {
  console.log("M6 Batch AT smoke (@r2a/web)\n");
  checkPackage();
  checkI18n();
  checkLib();
  checkPage();
  checkRouting();
  console.log("\nPASS");
}

try {
  main();
} catch (err) {
  console.error("\nFAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
}
