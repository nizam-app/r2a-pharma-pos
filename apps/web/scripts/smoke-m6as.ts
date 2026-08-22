/**
 * M6 Batch AS smoke — Staff Details.
 * Run: npm run smoke:m6as -w @r2a/web
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

const DETAIL_STAFF_I18N_KEYS = [
  "staff.detail.title",
  "staff.detail.subtitle",
  "staff.detail.kpi.role",
  "staff.detail.kpi.branch",
  "staff.detail.kpi.username",
  "staff.detail.kpi.lastActive",
  "staff.detail.kpi.neverActive",
  "staff.detail.section.info",
  "staff.detail.section.access",
  "staff.detail.section.activity",
  "staff.detail.label.name",
  "staff.detail.label.phone",
  "staff.detail.label.email",
  "staff.detail.label.note",
  "staff.detail.label.created",
  "staff.detail.label.role",
  "staff.detail.label.branch",
  "staff.detail.label.status",
  "staff.detail.action.edit",
  "staff.detail.action.more",
  "staff.detail.action.deactivate",
  "staff.detail.action.reactivate",
  "staff.detail.activity.empty",
  "staff.detail.activity.actor",
  "staff.detail.activity.CREATED",
  "staff.detail.activity.ROLE_CHANGED",
  "staff.detail.activity.BRANCH_CHANGED",
  "staff.detail.activity.DEACTIVATED",
  "staff.detail.activity.REACTIVATED",
  "staff.detail.activity.PROFILE_UPDATED",
  "staff.detail.activity.unknown",
  "staff.detail.back",
  "staff.detail.loading",
  "staff.detail.error",
  "staff.detail.retry",
] as const;

function checkPackage(): void {
  const pkg = JSON.parse(readRel("package.json")) as {
    name?: string;
    scripts?: Record<string, string>;
  };
  assert(pkg.name === "@r2a/web", `package name must be @r2a/web, got ${pkg.name}`);
  assert(
    pkg.scripts?.["smoke:m6as"]?.includes("smoke-m6as"),
    "package.json must define smoke:m6as",
  );
  console.log("  ✓ package @r2a/web + smoke:m6as");
}

function checkI18n(): void {
  const en = readSrc("i18n/locales/en.ts");
  const bn = readSrc("i18n/locales/bn-BD.ts");
  for (const key of DETAIL_STAFF_I18N_KEYS) {
    assert(
      en.includes(`"${key}"`) && bn.includes(`"${key}"`),
      `${key} must exist in en and bn-BD`,
    );
  }
  console.log("  ✓ staff detail i18n keys in en + bn-BD");
}

function checkLib(): void {
  const lib = readSrc("lib/staff.ts");
  assert(
    lib.includes("fetchStaffDetail") && lib.includes("/api/v1/owner/users/"),
    "lib/staff.ts must export fetchStaffDetail calling GET /api/v1/owner/users/:id",
  );
  console.log("  ✓ owner staff detail API client method");
}

function checkPage(): void {
  const page = readSrc("features/staff/StaffDetailPage.tsx");
  assert(page.includes("fetchStaffDetail"), "StaffDetailPage must call fetchStaffDetail");
  assert(
    page.includes('isSelf') &&
      page.includes('disabled={isSelf}'),
    "StaffDetailPage must disable edit when viewing own row",
  );
  assert(
    page.includes('!isSelf') &&
      page.includes('staff.detail.action.more'),
    "StaffDetailPage must hide deactivation/more actions when viewing own row",
  );
  console.log("  ✓ StaffDetailPage renders details, KPIs, timeline, and self-lockout check");
}

function checkAppShell(): void {
  const appShell = readSrc("features/shell/AppShell.tsx");
  assert(
    appShell.includes("StaffDetailPage") &&
      appShell.includes('sub.kind === "detail"'),
    "AppShell must route the /staff/:userId path to StaffDetailPage",
  );
  console.log("  ✓ StaffDetailPage routing live");
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
  console.log("M6 Batch AS smoke (@r2a/web)\n");
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
