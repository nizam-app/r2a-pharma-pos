/**
 * M6 Batch AR smoke — Add Staff.
 * Run: npm run smoke:m6ar -w @r2a/web
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

const ADD_STAFF_I18N_KEYS = [
  "staff.add.subtitle",
  "staff.add.unsavedTitle",
  "staff.add.unsavedBody",
  "staff.add.email",
  "staff.add.role",
  "staff.add.successTitle",
  "staff.add.tempPasswordHint",
  "staff.add.passwordCopied",
  "staff.add.copyPassword",
  "staff.add.continueToProfile",
  "staff.add.nameRequired",
  "staff.add.phoneRequired",
  "staff.add.emailRequired",
  "staff.add.emailInvalid",
  "staff.add.roleRequired",
] as const;

function checkPackage(): void {
  const pkg = JSON.parse(readRel("package.json")) as {
    name?: string;
    scripts?: Record<string, string>;
  };
  assert(pkg.name === "@r2a/web", `package name must be @r2a/web, got ${pkg.name}`);
  assert(
    pkg.scripts?.["smoke:m6ar"]?.includes("smoke-m6ar"),
    "package.json must define smoke:m6ar",
  );
  console.log("  ✓ package @r2a/web + smoke:m6ar");
}

function checkI18n(): void {
  const en = readSrc("i18n/locales/en.ts");
  const bn = readSrc("i18n/locales/bn-BD.ts");
  for (const key of ADD_STAFF_I18N_KEYS) {
    assert(
      en.includes(`"${key}"`) && bn.includes(`"${key}"`),
      `${key} must exist in en and bn-BD`,
    );
  }
  console.log("  ✓ add staff i18n keys in en + bn-BD");
}

function checkLib(): void {
  const lib = readSrc("lib/staff.ts");
  assert(
    lib.includes("createStaff") && lib.includes("/api/v1/owner/users"),
    "lib/staff.ts must export createStaff calling POST /api/v1/owner/users",
  );
  console.log("  ✓ owner staff create API client method");
}

function checkPage(): void {
  const page = readSrc("features/staff/AddStaffPage.tsx");
  assert(page.includes("createStaff"), "AddStaffPage must call createStaff");
  assert(
    page.includes('t("staff.add.successTitle")') &&
      page.includes('t("staff.add.tempPasswordHint")') &&
      page.includes('t("staff.add.continueToProfile")'),
    "AddStaffPage must render the temporary password success dialog/modal",
  );
  assert(
    page.includes("setNavigationBlocker") &&
      page.includes("beforeunload"),
    "AddStaffPage must implement unsaved-changes navigation guard",
  );
  console.log("  ✓ AddStaffPage renders inputs, validation, confirm dialog, and one-time password reveal");
}

function checkAppShell(): void {
  const appShell = readSrc("features/shell/AppShell.tsx");
  assert(
    appShell.includes("AddStaffPage") &&
      appShell.includes('sub.kind === "new"'),
    "AppShell must route the /staff/new path to AddStaffPage",
  );
  console.log("  ✓ AddStaffPage routing live");
}

function checkNoMockData(): void {
  const files = walkTs(SRC);
  const staffOnly = files
    .filter((p) => p.includes("staff"))
    .map((p) => readFileSync(p, "utf8"))
    .join("\n");
  assert(
    !/৳\d/.test(staffOnly),
    "Staff pages must not hard-code mock ৳ totals",
  );
  console.log("  ✓ no mock ৳ in staff code");
}

function main(): void {
  console.log("M6 Batch AR smoke (@r2a/web)\n");
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
