/**
 * M6 Batch AG smoke — Enable Customers nav.
 * Run: npm run smoke:m6ag -w @r2a/web
 *
 * Source guards only (no live API). Customers becomes a live chrome route
 * (placeholder shells); Staff / Help / Owner Profile stay disabled.
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

const NAV_I18N_KEYS = [
  "nav.dashboard",
  "nav.sales",
  "nav.inventory",
  "nav.purchasing",
  "nav.suppliers",
  "nav.customers",
  "nav.staff",
  "nav.reports",
  "nav.auditFefo",
  "nav.settings",
  "nav.help",
  "nav.ownerProfile",
  "nav.laterHint",
  "page.customersTitle",
  "page.customersHint",
  "customers.placeholder.hint",
] as const;

function checkPackage(): void {
  const pkg = JSON.parse(readRel("package.json")) as {
    name?: string;
    scripts?: Record<string, string>;
  };
  assert(pkg.name === "@r2a/web", `package name must be @r2a/web, got ${pkg.name}`);
  assert(
    pkg.scripts?.["smoke:m6ag"]?.includes("smoke-m6ag"),
    "package.json must define smoke:m6ag",
  );
  console.log("  ✓ package @r2a/web + smoke:m6ag");
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
  console.log("  ✓ customers chrome i18n keys in en + bn-BD");
}

function checkNavEnabled(): void {
  const nav = readSrc("features/shell/nav.ts");
  assert(
    /id:\s*"customers"[\s\S]*?live:\s*true/.test(nav),
    "Customers must be live in PRIMARY_NAV",
  );
  assert(
    /id:\s*"customers"[\s\S]*?path:\s*"\/customers"/.test(nav),
    "Customers must declare path /customers",
  );
  assert(
    /id:\s*"staff"[\s\S]*?live:\s*false/.test(nav) &&
      /id:\s*"help"[\s\S]*?live:\s*false/.test(nav) &&
      /id:\s*"ownerProfile"[\s\S]*?live:\s*false/.test(nav),
    "Staff / Help / Owner Profile must remain disabled",
  );
  console.log("  ✓ Customers nav live; Staff/Help/Owner Profile disabled");
}

function checkOwnerPath(): void {
  const ownerPath = readSrc("lib/ownerPath.ts");
  assert(
    ownerPath.includes('"/customers"'),
    "OWNER_PATHS must include /customers",
  );
  assert(
    ownerPath.includes("customersSubpath"),
    "ownerPath.ts must define customersSubpath",
  );
  assert(
    ownerPath.includes('return "/customers"'),
    "matchOwnerPath must map /customers/* to /customers",
  );
  assert(
    ownerPath.includes('"/customers"') &&
      ownerPath.includes('"nav.customers"'),
    "ownerPathTitleKey must map /customers to nav.customers",
  );
  const appShell = readSrc("features/shell/AppShell.tsx");
  assert(
    appShell.includes("customersSubpath") &&
      appShell.includes("CustomersPage"),
    "AppShell must route /customers to the live Customers directory",
  );
  console.log("  ✓ /customers registered, routed to live Customers directory");
}

function checkNoMockData(): void {
  const files = walkTs(SRC);
  const all = files.map((p) => readFileSync(p, "utf8")).join("\n");
  assert(
    !/2,?417/.test(all),
    "Customers placeholder must not hard-code directory totals (2,417)",
  );
  console.log("  ✓ no invented customer totals in placeholder");
}

function main(): void {
  console.log("M6 Batch AG smoke (@r2a/web)\n");
  checkPackage();
  checkI18n();
  checkNavEnabled();
  checkOwnerPath();
  checkNoMockData();
  console.log("\nPASS");
}

try {
  main();
} catch (err) {
  console.error("\nFAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
}
