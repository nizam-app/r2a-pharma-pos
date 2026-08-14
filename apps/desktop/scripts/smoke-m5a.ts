/**
 * M5 Batch A smoke — RBAC API source + docs lock.
 * Run: npm run smoke:m5a -w @r2a/desktop
 *
 * Live cashier 403s are in smoke:m2 (server must be running).
 * This script does not hit the cloud API.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DESKTOP = join(__dirname, "..");
const ROOT = join(DESKTOP, "..", "..");
const SERVER = join(ROOT, "apps", "server");

function readRepo(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function readServer(rel: string): string {
  return readFileSync(join(SERVER, rel), "utf8");
}

function readDesktop(rel: string): string {
  return readFileSync(join(DESKTOP, rel), "utf8");
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function extractCall(src: string, routerVar: string, method: string): string {
  const re = new RegExp(`${routerVar}\\.${method}\\(([\\s\\S]*?)\\);`);
  const match = src.match(re);
  assert(match?.[0], `${routerVar}.${method}(...) not found`);
  return match[0];
}

function checkRouters(): void {
  const customer = readServer("src/modules/customer/customer.router.ts");
  const batch = readServer("src/modules/batch/batch.router.ts");

  const customerPost = extractCall(customer, "customerRouter", "post");
  assert(
    customerPost.includes('restrictTo("OWNER")'),
    "POST /customers must stay OWNER-only",
  );
  assert(
    !customerPost.includes("MANAGER"),
    "POST /customers must not include MANAGER",
  );

  const customerPatch = extractCall(customer, "customerRouter", "patch");
  assert(
    customerPatch.includes('restrictTo("OWNER", "MANAGER")'),
    'PATCH /customers/:id must restrictTo("OWNER", "MANAGER")',
  );

  const batchPost = extractCall(batch, "batchRouter", "post");
  assert(
    batchPost.includes('restrictTo("OWNER", "MANAGER")'),
    "POST /batches must stay OWNER+MANAGER",
  );

  const batchPatch = extractCall(batch, "batchRouter", "patch");
  assert(
    batchPatch.includes('restrictTo("OWNER", "MANAGER")'),
    'PATCH /batches/:id must restrictTo("OWNER", "MANAGER")',
  );

  const smoke = readServer("scripts/m2-smoke.mjs");
  assert(
    smoke.includes("Cashier blocked from PATCH customer"),
    "m2-smoke must assert cashier PATCH /customers 403",
  );
  assert(
    smoke.includes("Cashier blocked from PATCH batch qty") &&
      smoke.includes("quantityOnHand"),
    "m2-smoke must assert cashier PATCH batch qty 403",
  );
  assert(
    smoke.includes("Cashier blocked from price edit"),
    "m2-smoke must keep cashier price-edit 403",
  );
  assert(
    smoke.includes("Owner PATCH customer"),
    "m2-smoke must assert owner PATCH /customers 200",
  );

  console.log("  ✓ routers + m2-smoke cashier 403s");
}

function checkNoReceiveStockForm(): void {
  const settings = readDesktop("src/features/settings/SettingsPanel.tsx");
  assert(
    !/\/api\/v1\/batches/.test(settings),
    "SettingsPanel must not inline /batches (GRN helper lives in lib/receiveStock)",
  );
  console.log("  ✓ SettingsPanel does not inline /batches calls");
}

function checkDocs(): void {
  const master = readRepo("PROJECT_MASTER_PLAN.md");
  const m5Section = master.slice(
    master.indexOf("### Milestone 5"),
    master.indexOf("### Milestone 6"),
  );
  assert(m5Section.length > 80, "PROJECT_MASTER_PLAN.md M5 section missing");
  assert(
    /Cash/.test(m5Section) && /Card/.test(m5Section) && /MFS/.test(m5Section),
    "master-plan M5 must list Cash / Card / MFS",
  );
  assert(
    !/\bBaki\b/.test(m5Section),
    "master-plan M5 must not mention Baki as a tender",
  );
  assert(
    !/on-account tender/.test(m5Section) ||
      /\*\*no\*\* on-account tender/.test(m5Section),
    "master-plan M5 must not offer an on-account tender",
  );
  assert(
    master.includes("MILESTONE_5_EXECUTION.md"),
    "master plan must link MILESTONE_5_EXECUTION.md",
  );
  assert(
    /\|\s*M5\s*\|\s*MVP hardening\s*\|\s*\*\*DONE\*\*\s*\|/.test(master) ||
      /\|\s*M5\s*\|\s*MVP hardening\s*\|\s*PENDING\s*\|/.test(master),
    "master plan M5 must be PENDING (until F) or **DONE** (after F)",
  );

  const catalog = readRepo("Completed_API_lists.md");
  assert(
    catalog.includes(
      "| PATCH | `/api/v1/customers/:id` | Bearer | `OWNER`, `MANAGER` (cashier `403`) |",
    ),
    "Completed_API_lists.md route index: PATCH customers OWNER+MANAGER",
  );
  assert(
    catalog.includes(
      "| PATCH | `/api/v1/batches/:id` | Bearer | `OWNER`, `MANAGER` (cashier `403`, including qty) |",
    ),
    "Completed_API_lists.md route index: PATCH batches OWNER+MANAGER",
  );
  assert(
    !catalog.includes("Cashier may patch non-price fields"),
    "route-index footnote must not allow cashier qty PATCH",
  );
  assert(
    catalog.includes("Create **removed** (Owner web M6)"),
    "§14.1 must say Create Customer is removed (Owner web M6)",
  );
  assert(
    !catalog.includes("Create Customer = toast stub"),
    "§14.1 must not still say Create Customer = toast stub",
  );

  const status = readRepo("Current_Status.md");
  assert(
    status.includes("MILESTONE_5_EXECUTION.md"),
    "Current_Status.md doc map must include MILESTONE_5_EXECUTION.md",
  );
  assert(
    status.includes("ROLES_AND_PERMISSIONS.md"),
    "Current_Status.md doc map must include ROLES_AND_PERMISSIONS.md",
  );

  const roles = readRepo("ROLES_AND_PERMISSIONS.md");
  const patchCust = roles.match(
    /`PATCH \/api\/v1\/customers\/:id`\s*\|\s*([^\n]+)/,
  );
  assert(patchCust?.[1], "ROLES_AND_PERMISSIONS.md live table missing PATCH customers");
  assert(
    /OWNER/.test(patchCust[1]) &&
      /MANAGER/.test(patchCust[1]) &&
      /403/.test(patchCust[1]),
    "roles live table: PATCH customers OWNER+MANAGER, cashier 403",
  );
  const patchBatch = roles.match(
    /`PATCH \/api\/v1\/batches\/:id`\s*\|\s*([^\n]+)/,
  );
  assert(patchBatch?.[1], "ROLES_AND_PERMISSIONS.md live table missing PATCH batches");
  assert(
    /OWNER/.test(patchBatch[1]) &&
      /MANAGER/.test(patchBatch[1]) &&
      /403/.test(patchBatch[1]),
    "roles live table: PATCH batches OWNER+MANAGER, cashier 403",
  );

  console.log("  ✓ docs lock (master plan, catalog, status, roles)");
}

function main(): void {
  console.log("smoke:m5a — M5 Batch A RBAC API + docs lock\n");
  checkRouters();
  checkNoReceiveStockForm();
  checkDocs();
  console.log("\nPASS — smoke:m5a");
}

main();
