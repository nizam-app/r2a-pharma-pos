/** M6 Batch S source smoke — Purchasing and Suppliers navigation shells. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function navItem(nav: string, id: string): string {
  const start = nav.indexOf(`id: "${id}"`);
  assert(start >= 0, `nav must include ${id}`);
  const next = nav.indexOf("  {", start + 1);
  return nav.slice(start, next >= 0 ? next : nav.length);
}

function main(): void {
  console.log("M6 Batch S smoke (@r2a/web)\n");
  const pkg = JSON.parse(read("package.json")) as {
    scripts?: Record<string, string>;
  };
  const nav = read("src/features/shell/nav.ts");
  const paths = read("src/lib/ownerPath.ts");
  const shell = read("src/features/shell/AppShell.tsx");
  const en = read("src/i18n/locales/en.ts");
  const bn = read("src/i18n/locales/bn-BD.ts");

  assert(
    pkg.scripts?.["smoke:m6s"]?.includes("smoke-m6s"),
    "package must define smoke:m6s",
  );

  for (const [id, path] of [
    ["purchasing", "/purchasing"],
    ["suppliers", "/suppliers"],
  ] as const) {
    const item = navItem(nav, id);
    assert(item.includes("live: true"), `${id} nav must be live`);
    assert(item.includes(`path: "${path}"`), `${id} nav must target ${path}`);
    assert(paths.includes(`"${path}"`), `${path} must be a live Owner path`);
  }

  for (const id of [
    "customers",
    "staff",
    "reports",
    "auditFefo",
    "settings",
    "help",
    "ownerProfile",
  ]) {
    const item = navItem(nav, id);
    assert(item.includes("live: false"), `${id} must remain disabled`);
    assert(!item.includes("path:"), `${id} must not have a route`);
  }
  assert(!paths.includes('"/customers"'), "Customers route must not exist");

  assert(
    shell.includes('path === "/purchasing"') &&
      shell.includes("PurchasingPage") &&
      shell.includes("PurchasingPlaceholder") &&
      shell.includes('path === "/suppliers"') &&
      shell.includes('section="suppliers"'),
    "AppShell must render Purchasing list + placeholder subroutes and Suppliers shell",
  );
  assert(!shell.includes("<table"), "AppShell must not inline list tables");

  for (const key of [
    "page.purchasingTitle",
    "page.purchasingHint",
    "page.suppliersTitle",
    "page.suppliersHint",
  ]) {
    assert(
      en.includes(`"${key}"`) && bn.includes(`"${key}"`),
      `${key} must exist in en and bn-BD`,
    );
  }

  console.log("  ✓ Purchasing and Suppliers nav are live");
  console.log("  ✓ Purchasing list + placeholder subroutes; Suppliers shell only");
  console.log("  ✓ Customers and remaining later nav stay disabled");
  console.log("\nPASS");
}

try {
  main();
} catch (error) {
  console.error("\nFAIL:", error instanceof Error ? error.message : error);
  process.exit(1);
}
