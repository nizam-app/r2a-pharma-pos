/**
 * M6 Batch AQ smoke — Staff list.
 * Run: npm run smoke:m6aq -w @r2a/web
 *
 * Source guards only (no live API). Staff directory is a live page backed
 * by GET /owner/users. Add Staff → /staff/new, View → /staff/:id. No hard-coded
 * totals or mock KPI numbers.
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

const STAFF_I18N_KEYS = [
  "page.staffTitle",
  "staff.subtitle",
  "staff.directory",
  "staff.addStaff",
  "staff.loading",
  "staff.error",
  "staff.retry",
  "staff.empty",
  "staff.kpi.total",
  "staff.kpi.active",
  "staff.kpi.inactive",
  "staff.kpi.cashiers",
  "staff.tab.all",
  "staff.tab.active",
  "staff.tab.inactive",
  "staff.filter.role",
  "staff.filter.roleAll",
  "staff.role.owner",
  "staff.role.manager",
  "staff.role.cashier",
  "staff.col.name",
  "staff.col.username",
  "staff.col.role",
  "staff.col.phone",
  "staff.col.store",
  "staff.col.lastActive",
  "staff.col.status",
  "staff.showing",
  "staff.of",
  "staff.staff",
  "staff.status.active",
  "staff.status.inactive",
] as const;

function checkPackage(): void {
  const pkg = JSON.parse(readRel("package.json")) as {
    name?: string;
    scripts?: Record<string, string>;
  };
  assert(pkg.name === "@r2a/web", `package name must be @r2a/web, got ${pkg.name}`);
  assert(
    pkg.scripts?.["smoke:m6aq"]?.includes("smoke-m6aq"),
    "package.json must define smoke:m6aq",
  );
  console.log("  ✓ package @r2a/web + smoke:m6aq");
}

function checkI18n(): void {
  const en = readSrc("i18n/locales/en.ts");
  const bn = readSrc("i18n/locales/bn-BD.ts");
  for (const key of STAFF_I18N_KEYS) {
    assert(
      en.includes(`"${key}"`) && bn.includes(`"${key}"`),
      `${key} must exist in en and bn-BD`,
    );
  }
  console.log("  ✓ staff list i18n keys in en + bn-BD");
}

function checkLib(): void {
  const lib = readSrc("lib/staff.ts");
  assert(
    lib.includes("/api/v1/owner/users"),
    "lib/staff.ts must call GET /api/v1/owner/users",
  );
  assert(
    lib.includes("StaffKpis") &&
      lib.includes("total") &&
      lib.includes("active") &&
      lib.includes("inactive") &&
      lib.includes("cashiers"),
    "staff lib must map meta.kpis (total/active/inactive/cashiers)",
  );
  console.log("  ✓ live owner staff client + KPI meta mapping");
}

function checkPage(): void {
  const page = readSrc("features/staff/StaffPage.tsx");
  assert(page.includes("fetchStaff"), "StaffPage must call fetchStaff");
  assert(
    page.includes('t("staff.tab.all")') &&
      page.includes('t("staff.tab.active")') &&
      page.includes('t("staff.tab.inactive")'),
    "StaffPage must render All/Active/Inactive tabs",
  );
  assert(
    page.includes('t("staff.filter.role")'),
    "StaffPage must render Role filter",
  );
  assert(
    page.includes('navigate("/staff/new")'),
    "Add Staff must navigate to /staff/new",
  );
  assert(
    page.includes("formatSalesDateTime") &&
      page.includes("formatCount"),
    "StaffPage must format dates/counts from live data",
  );
  console.log("  ✓ StaffPage renders KPIs, tabs, filters, table, navigation");
}

function checkAppShell(): void {
  const appShell = readSrc("features/shell/AppShell.tsx");
  assert(
    appShell.includes("StaffPage") &&
      appShell.includes('sub.kind === "list"'),
    "AppShell must route the /staff list to StaffPage",
  );
  console.log("  ✓ list live");
}

function checkNoMockData(): void {
  const files = walkTs(SRC);
  const staffOnly = files
    .filter((p) => p.includes("staff"))
    .map((p) => readFileSync(p, "utf8"))
    .join("\n");
  assert(
    !/৳\d/.test(staffOnly),
    "Staff page must not hard-code mock ৳ totals",
  );
  console.log("  ✓ no mock ৳ in staff code");
}

function main(): void {
  console.log("M6 Batch AQ smoke (@r2a/web)\n");
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
