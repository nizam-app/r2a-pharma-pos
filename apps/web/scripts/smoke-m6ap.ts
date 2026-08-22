/**
 * M6 Batch AP smoke — Enable Staff nav.
 * Run: npm run smoke:m6ap -w @r2a/web
 *
 * Source guards only. Staff becomes a live chrome route
 * (placeholder shells); Reports / Help / Owner Profile stay disabled.
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

const NAV_I18N_KEYS = [
  "nav.staff",
  "page.staffTitle",
  "page.staffHint",
  "staff.placeholder.title",
  "staff.placeholder.hint",
] as const;

function checkPackage(): void {
  const pkg = JSON.parse(readRel("package.json")) as {
    name?: string;
    scripts?: Record<string, string>;
  };
  assert(pkg.name === "@r2a/web", `package name must be @r2a/web, got ${pkg.name}`);
  assert(
    pkg.scripts?.["smoke:m6ap"]?.includes("smoke-m6ap"),
    "package.json must define smoke:m6ap",
  );
  console.log("  ✓ package @r2a/web + smoke:m6ap");
}

function checkI18n(): void {
  const en = readSrc("i18n/locales/en.ts");
  const bn = readSrc("i18n/locales/bn-BD.ts");
  for (const key of NAV_I18N_KEYS) {
    assert(
      en.includes(`"${key}"`) && bn.includes(`"${key}"`),
      `${key} must exist in en and bn-BD`,
    );
  }
  console.log("  ✓ staff chrome i18n keys in en + bn-BD");
}

function checkNavEnabled(): void {
  const nav = readSrc("features/shell/nav.ts");
  assert(
    /id:\s*"staff"[\s\S]*?live:\s*true/.test(nav),
    "Staff must be live in PRIMARY_NAV",
  );
  assert(
    /id:\s*"staff"[\s\S]*?path:\s*"\/staff"/.test(nav),
    "Staff must declare path /staff",
  );
  assert(
    /id:\s*"reports"[\s\S]*?live:\s*false/.test(nav) &&
      /id:\s*"help"[\s\S]*?live:\s*false/.test(nav) &&
      /id:\s*"ownerProfile"[\s\S]*?live:\s*false/.test(nav),
    "Reports / Help / Owner Profile must remain disabled",
  );
  console.log("  ✓ Staff nav live; Reports/Help/Owner Profile disabled");
}

function checkOwnerPath(): void {
  const ownerPath = readSrc("lib/ownerPath.ts");
  assert(
    ownerPath.includes('"/staff"'),
    "OWNER_PATHS must include /staff",
  );
  assert(
    ownerPath.includes("staffSubpath"),
    "ownerPath.ts must define staffSubpath",
  );
  assert(
    ownerPath.includes('return "/staff"'),
    "matchOwnerPath must map /staff/* to /staff",
  );
  assert(
    ownerPath.includes('"/staff"') &&
      ownerPath.includes('"nav.staff"'),
    "ownerPathTitleKey must map /staff to nav.staff",
  );
  const appShell = readSrc("features/shell/AppShell.tsx");
  assert(
    appShell.includes("staffSubpath") &&
      appShell.includes("StaffPage"),
    "AppShell must route /staff to the Staff page family",
  );
  console.log("  ✓ /staff registered, routed to Staff page family");
}

function main(): void {
  console.log("M6 Batch AP smoke (@r2a/web)\n");
  checkPackage();
  checkI18n();
  checkNavEnabled();
  checkOwnerPath();
  console.log("\nPASS");
}

try {
  main();
} catch (err) {
  console.error("\nFAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
}
