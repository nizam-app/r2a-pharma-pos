/**
 * M5 exit smoke — catalog §20 + status/master DONE + runbook + compose m5a–m5e + m4.
 * Run: npm run smoke:m5 -w @r2a/desktop
 *
 * Live cashier 403s / ingest: npm run smoke:m2 -w @r2a/server (server must be running).
 * Pilot UI path is the Batch F user walkthrough.
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DESKTOP = join(__dirname, "..");
const ROOT = join(DESKTOP, "..", "..");
const SRC = join(DESKTOP, "src");

function readSrc(rel: string): string {
  return readFileSync(join(SRC, rel), "utf8");
}

function readRepo(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function checkCatalogAndDocs(): void {
  const catalog = readRepo("Completed_API_lists.md");
  assert(
    catalog.includes("## 20. M5") || catalog.includes("§20 — M5"),
    "Completed_API_lists.md must have §20 M5",
  );
  assert(
    catalog.includes("OWNER") &&
      catalog.includes("MANAGER") &&
      catalog.includes("PATCH") &&
      catalog.includes("/customers/:id") &&
      catalog.includes("/batches/:id"),
    "§20 must document PATCH customers/batches OWNER+MANAGER",
  );
  assert(
    catalog.includes("Receive stock") &&
      (catalog.includes("desktop-only") || catalog.includes("desktop only") || catalog.includes("No new cloud routes")),
    "§20 must document Receive stock as desktop-only (no new routes)",
  );
  assert(
    catalog.includes("409") &&
      (catalog.includes("conflictReason") || catalog.includes("Sync Queue")),
    "§20 must document 409 Sync Queue copy",
  );
  assert(
    catalog.includes("paged") || catalog.includes("Paged catalog"),
    "§20 must document paged catalog pull",
  );
  assert(
    catalog.includes("costPerBase") &&
      (catalog.includes("never") || catalog.includes("drop") || catalog.includes("omit") || catalog.includes("not cache")),
    "§20 must say costPerBase is not cached",
  );
  assert(
    catalog.includes("print stub") || catalog.includes("Print stub") || catalog.includes("printer IPC"),
    "§20 must list print stub still out",
  );
  assert(
    catalog.includes("smoke:m5"),
    "§20 must list smoke:m5",
  );

  const status = readRepo("Current_Status.md");
  assert(
    /\|\s*\*\*M5\*\*\s*\|\s*MVP hardening\s*\|\s*\*\*DONE\*\*/.test(status),
    "Current_Status.md milestone board must mark M5 DONE",
  );
  assert(
    status.includes("M5 Batch F") && status.includes("DONE"),
    "Current_Status.md changelog must record Batch F DONE",
  );
  assert(
    status.includes("DEV_RUNBOOK.md"),
    "Current_Status.md doc map must include DEV_RUNBOOK.md",
  );

  const master = readRepo("PROJECT_MASTER_PLAN.md");
  assert(
    /\|\s*M5\s*\|\s*MVP hardening\s*\|\s*\*\*DONE\*\*/.test(master),
    "PROJECT_MASTER_PLAN.md must mark M5 DONE",
  );
  const m5Section = master.slice(
    master.indexOf("### Milestone 5"),
    master.indexOf("### Milestone 6"),
  );
  assert(m5Section.length > 80, "PROJECT_MASTER_PLAN.md M5 section missing");
  assert(
    /Cash/.test(m5Section) && /Card/.test(m5Section) && /MFS/.test(m5Section),
    "master-plan M5 must list Cash / Card / MFS",
  );
  assert(!/\bBaki\b/.test(m5Section), "master-plan M5 must not mention Baki as a tender");
  assert(
    !/on-account tender/.test(m5Section) || /\*\*no\*\* on-account tender/.test(m5Section),
    "master-plan M5 must not offer an on-account tender",
  );
  assert(
    master.includes("Do not start M6") ||
      master.includes("do not start M6") ||
      master.includes("unless the user authorizes"),
    "master plan next command must gate M6",
  );

  const exec = readRepo("MILESTONE_5_EXECUTION.md");
  assert(
    exec.includes("Batch F") &&
      /F Runbook \+ M5 exit\s*\|\s*\*\*DONE\*\*/.test(exec),
    "MILESTONE_5_EXECUTION.md progress tracker must mark F DONE",
  );
  assert(
    exec.includes("M5 Full Exit") && !exec.includes("_Not yet. Complete when Batch F PASS._"),
    "MILESTONE_5_EXECUTION.md Full Exit must be filled",
  );

  const runbook = readRepo("docs/DEV_RUNBOOK.md");
  assert(
    runbook.includes("Repo-root") || runbook.includes("repo-root") || runbook.includes("Repo-root `.env`") || runbook.includes("repo root"),
    "DEV_RUNBOOK.md must document repo-root .env",
  );
  assert(
    runbook.includes("packages/database/.env"),
    "DEV_RUNBOOK.md must document packages/database/.env",
  );
  assert(
    runbook.includes("Neon") && (runbook.includes("Docker") || runbook.includes("docker")),
    "DEV_RUNBOOK.md must document Neon or local Postgres Docker",
  );
  assert(
    runbook.includes("db:generate") &&
      runbook.includes("db:deploy") &&
      runbook.includes("db:seed") &&
      runbook.includes("npm install"),
    "DEV_RUNBOOK.md must list install + db scripts",
  );
  assert(
    runbook.includes("dev -w @r2a/server") && runbook.includes("dev -w @r2a/desktop"),
    "DEV_RUNBOOK.md must list server + desktop dev",
  );
  assert(
    runbook.includes("dev:tauri"),
    "DEV_RUNBOOK.md must mention optional dev:tauri",
  );
  assert(
    runbook.includes("owner@demo.local") &&
      runbook.includes("cashier@demo.local") &&
      runbook.includes("ChangeMe123!"),
    "DEV_RUNBOOK.md must list seed logins",
  );
  assert(
    runbook.includes("smoke:m2") &&
      runbook.includes("smoke:m4b") &&
      runbook.includes("smoke:m4") &&
      runbook.includes("smoke:m5"),
    "DEV_RUNBOOK.md must list smoke:m2 / m4b / m4 / m5",
  );
  assert(
    !/postgresql:\/\/[^:]+:[^@]+@(?!localhost|127\.0\.0\.1)/.test(runbook),
    "DEV_RUNBOOK.md must not contain a hosted DATABASE_URL secret",
  );
  assert(
    !/eyJ[A-Za-z0-9_-]{20,}/.test(runbook),
    "DEV_RUNBOOK.md must not contain a JWT-like secret",
  );
  assert(
    runbook.includes("M6") &&
      (runbook.includes("stub") || runbook.includes("not this runbook") || runbook.includes("Owner web")),
    "runbook must not invent Owner web as if it existed",
  );

  console.log("  ✓ catalog §20 + status/master plan/M5 execution DONE + runbook");
}

function checkStubsAndNoOnAccount(): void {
  const print = readSrc("lib/printStub.ts");
  const fefo = readSrc("lib/fefoOverrideAuth.ts");
  const app = readSrc("App.tsx");

  assert(
    print.includes("TODO(real printer IPC)"),
    "print stub TODO(real printer IPC) must still be present",
  );
  assert(
    fefo.includes("TODO(real integration)") &&
      fefo.includes("STUB_MANAGER_PIN_LENGTH") &&
      !fefo.includes("pinHash"),
    "FEFO PIN stub TODO must still be present (no pinHash)",
  );
  assert(!/>\s*Baki\s*</.test(app) && !/["'`]Baki["'`]/.test(app), "no Baki tender in App");

  console.log("  ✓ print stub TODO + FEFO stub TODO still present; no Baki");
}

function runWorkspaceScript(script: string): void {
  console.log(`\n→ npm run ${script}\n`);
  const result = spawnSync(`npm run ${script}`, {
    cwd: DESKTOP,
    stdio: "inherit",
    shell: true,
    env: process.env,
  });
  const code = result.status ?? 1;
  if (code !== 0) {
    throw new Error(`${script} failed with status ${code}`);
  }
}

async function main(): Promise<void> {
  console.log("smoke:m5 — M5 exit (Batch F)\n");
  checkCatalogAndDocs();
  checkStubsAndNoOnAccount();
  for (const script of [
    "smoke:m5a",
    "smoke:m5b",
    "smoke:m5c",
    "smoke:m5d",
    "smoke:m5e",
    "smoke:m4",
  ]) {
    runWorkspaceScript(script);
  }
  console.log("\nPASS — smoke:m5");
}

main().catch((err) => {
  console.error("\nFAIL — smoke:m5");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
