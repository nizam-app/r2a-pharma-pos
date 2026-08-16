/**
 * M6 Batch B smoke — Owner chrome lock.
 * Run: npm run smoke:m6b -w @r2a/web
 *
 * Source guards only (no live API). Sidebar IA, disabled later nav,
 * no Purchasing route, store control display-only. Mock KPI totals stay forbidden.
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
  "header.storeLocked",
  "page.dashboardTitle",
  "page.salesTitle",
  "page.inventoryTitle",
] as const;

function checkPackage(): void {
  const pkg = JSON.parse(readRel("package.json")) as {
    name?: string;
    scripts?: Record<string, string>;
  };
  assert(pkg.name === "@r2a/web", `package name must be @r2a/web, got ${pkg.name}`);
  assert(
    pkg.scripts?.["smoke:m6b"]?.includes("smoke-m6b"),
    "package.json must define smoke:m6b",
  );
  console.log("  ✓ package @r2a/web + smoke:m6b");
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
  console.log("  ✓ chrome i18n keys in en + bn-BD");
}

function checkSidebar(): void {
  const nav = readSrc("features/shell/nav.ts");
  const sidebar = readSrc("features/shell/Sidebar.tsx");
  const all = walkTs(SRC)
    .map((p) => readFileSync(p, "utf8"))
    .join("\n");

  assert(nav.includes('id: "purchasing"'), "PRIMARY_NAV must include purchasing");
  assert(
    /id:\s*"purchasing"[\s\S]*?live:\s*false/.test(nav),
    "Purchasing must be live: false",
  );
  assert(
    !/path:\s*["']\/purchasing["']/.test(nav),
    "Purchasing must not have a path",
  );
  assert(
    nav.includes('id: "suppliers"') &&
      nav.includes('id: "customers"') &&
      nav.includes('id: "staff"') &&
      nav.includes('id: "reports"') &&
      nav.includes('id: "auditFefo"') &&
      nav.includes('id: "settings"') &&
      nav.includes('id: "help"') &&
      nav.includes('id: "ownerProfile"'),
    "Sidebar IA must include later nav items",
  );
  assert(
    /id:\s*"help"[\s\S]*?live:\s*false/.test(nav) &&
      /id:\s*"ownerProfile"[\s\S]*?live:\s*false/.test(nav),
    "Help and Owner Profile must be disabled",
  );

  assert(
    sidebar.includes("PRIMARY_NAV") && sidebar.includes("FOOTER_NAV"),
    "Sidebar must render primary + footer nav",
  );
  assert(
    sidebar.includes("disabled") && sidebar.includes('t("nav.laterHint")'),
    "Disabled nav must use disabled + later-slice hint",
  );
  assert(
    !/navigate\(\s*["'`]\/purchasing["'`]/.test(all),
    "Must not navigate to Purchasing",
  );
  assert(
    !/href=["'`]\/purchasing["'`]/.test(all),
    "Must not link to /purchasing",
  );
  assert(
    sidebar.includes("navigate(item.path)") && sidebar.includes("item.live"),
    "Sidebar must only navigate live items",
  );

  const ownerPath = readSrc("lib/ownerPath.ts");
  assert(
    ownerPath.includes('"/sales"') &&
      ownerPath.includes('"/inventory"') &&
      !ownerPath.includes("/purchasing"),
    "Live paths are /, /sales, /inventory only",
  );

  console.log("  ✓ sidebar IA + disabled later items; no Purchasing route");
}

function checkStoreControl(): void {
  const header = readSrc("features/shell/Header.tsx");
  const tenant = readSrc("lib/TenantContextProvider.tsx");

  assert(
    header.includes("disabled") && header.includes('t("header.storeLocked")'),
    "Store control must be disabled / display-only",
  );
  assert(
    !/setStoreId|onChangeStore|switchStore/.test(header),
    "Header must not change storeId",
  );
  assert(
    tenant.includes("fetchTenantContext") &&
      !/setStoreId/.test(tenant) &&
      tenant.includes("storeId: payload?.storeId ?? null"),
    "Tenant chrome must read storeId without a setter",
  );
  assert(
    readSrc("lib/api.ts").includes("/api/v1/tenant/context"),
    "api.ts must call GET /tenant/context",
  );

  console.log("  ✓ store name display-only (no storeId switch)");
}

function checkNoMockKpis(): void {
  const files = walkTs(SRC);
  const all = files.map((p) => readFileSync(p, "utf8")).join("\n");

  assert(
    !/124,?850/.test(all) && !/TXN-260814-1045/.test(all),
    "Must not hard-code Dashboard mock KPIs / TXN ids",
  );

  console.log("  ✓ no mock ৳124,850 / TXN-260814-1045");
}

function checkChrome(): void {
  const app = readSrc("App.tsx");
  assert(
    app.includes("AppShell") &&
      app.includes("OwnerPathProvider") &&
      app.includes("TenantContextProvider") &&
      app.includes("LoginPage"),
    "Authenticated app must wrap AppShell in path + tenant providers",
  );
  assert(
    readSrc("features/shell/Sidebar.tsx").includes('t("brand.name")'),
    "Sidebar brand must use i18n brand.name (PharmaSync Admin Portal)",
  );
  assert(
    readSrc("i18n/locales/en.ts").includes(
      '"brand.name": "PharmaSync Admin Portal"',
    ),
    "Brand string must be PharmaSync Admin Portal",
  );

  console.log("  ✓ AppShell chrome + Admin Portal brand");
}

function main(): void {
  console.log("M6 Batch B smoke (@r2a/web)\n");
  checkPackage();
  checkI18n();
  checkSidebar();
  checkStoreControl();
  checkNoMockKpis();
  checkChrome();
  console.log("\nPASS");
}

try {
  main();
} catch (err) {
  console.error("\nFAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
}
