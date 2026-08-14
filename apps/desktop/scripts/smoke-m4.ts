/**
 * M4 exit smoke — catalog §19 + status DONE + compose m4a/c/d/e + m3ap.
 * Run: npm run smoke:m4 -w @r2a/desktop
 *
 * Live cloud reconnect is the user walkthrough. Cloud smokes:
 *   npm run smoke:m2 -w @r2a/server
 *   npm run smoke:m4b -w @r2a/server
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
    catalog.includes("## 19. M4 — One-way sync") ||
      catalog.includes("## 19. M4 —"),
    "Completed_API_lists.md must have §19 M4",
  );
  assert(
    catalog.includes("POST /api/v1/sync/ingest") ||
      catalog.includes("`POST /api/v1/sync/ingest`"),
    "§19 must document POST /api/v1/sync/ingest",
  );
  assert(
    catalog.includes("accepted") &&
      catalog.includes("duplicate") &&
      catalog.includes("rejected"),
    "§19 must document per-event accepted/duplicate/rejected",
  );
  assert(
    catalog.includes("outbound_sync_queue"),
    "§19 must document outbound_sync_queue",
  );
  assert(
    catalog.includes("15s") || catalog.includes("15 s"),
    "§19 must document 15s worker",
  );
  assert(
    catalog.includes("completeSaleOrQueue") ||
      catalog.includes("complete-or-queue"),
    "§19 must document complete-or-queue",
  );
  assert(
    catalog.includes("Sync Queue") || catalog.includes("Sync queue"),
    "§19 must document Sync Queue panel",
  );
  assert(
    catalog.includes("no new sidebar") ||
      catalog.includes("No new sidebar") ||
      catalog.includes("**No** new sidebar"),
    "§19 must state no new sidebar item",
  );
  assert(
    catalog.includes("409") && catalog.includes("M5"),
    "§19 must document 409 conflict UX as M5",
  );
  assert(
    catalog.includes("smoke:m4") && catalog.includes("smoke:m4b"),
    "§19 must list smoke:m4 / smoke:m4b",
  );

  const status = readRepo("Current_Status.md");
  assert(
    /\|\s*\*\*M4\*\*\s*\|\s*One-way sync\s*\|\s*\*\*DONE\*\*/.test(status),
    "Current_Status.md milestone board must mark M4 DONE",
  );
  assert(
    status.includes("M4 Batch F") && status.includes("DONE"),
    "Current_Status.md changelog must record Batch F DONE",
  );

  const master = readRepo("PROJECT_MASTER_PLAN.md");
  assert(
    /\|\s*M4\s*\|\s*One-way sync\s*\|\s*\*\*DONE\*\*/.test(master),
    "PROJECT_MASTER_PLAN.md must mark M4 DONE",
  );
  assert(
    master.includes("Do not start M5") ||
      master.includes("do not start M5") ||
      master.includes("unless the user authorizes"),
    "master plan next command must gate M5",
  );

  const exec = readRepo("MILESTONE_4_EXECUTION.md");
  assert(
    exec.includes("Batch F") && /F Exit \+ catalog\s*\|\s*\*\*DONE\*\*/.test(exec),
    "MILESTONE_4_EXECUTION.md progress tracker must mark F DONE",
  );

  console.log("  ✓ catalog §19 + status/master plan/M4 execution DONE");
}

function checkSourceGuards(): void {
  const worker = readSrc("lib/syncWorker.ts");
  const ingest = readSrc("lib/saleIngest.ts");
  const app = readSrc("App.tsx");
  const sidebar = readSrc("features/shell/Sidebar.tsx");
  const m3ap = readFileSync(join(__dirname, "smoke-m3ap.ts"), "utf8");

  assert(
    worker.includes("SYNC_FLUSH_INTERVAL_MS = 15_000") ||
      worker.includes("15_000"),
    "worker interval 15s",
  );
  assert(
    worker.includes('"/api/v1/sync/ingest"'),
    "worker POSTs /api/v1/sync/ingest",
  );
  assert(
    worker.includes("SYNC_MAX_TRANSIENT_ATTEMPTS = 8") ||
      worker.includes("= 8"),
    "max 8 transient attempts",
  );
  assert(
    ingest.includes("completeSaleOrQueue") &&
      ingest.includes("forcedOffline"),
    "completeSaleOrQueue uses forcedOffline",
  );
  assert(
    !/["'`]\/api\/v1\/sync\/ingest["'`]/.test(app),
    "App.tsx must not POST /sync/ingest (worker owns flush)",
  );
  assert(
    !sidebar.includes("sidebar.sync") && !sidebar.includes("Sync queue"),
    "no sidebar Sync nav item",
  );
  assert(
    m3ap.includes("worker owns flush") || m3ap.includes("syncWorker"),
    "smoke-m3ap must keep relaxed /sync/ingest guard",
  );
  assert(!/>\s*Baki\s*</.test(app) && !/["'`]Baki["'`]/.test(app), "no Baki");

  console.log("  ✓ source guards (worker, complete-or-queue, no sidebar Sync, m3ap)");
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
  console.log("smoke:m4 — M4 exit (Batch F)\n");
  checkCatalogAndDocs();
  checkSourceGuards();
  for (const script of [
    "smoke:m4a",
    "smoke:m4c",
    "smoke:m4d",
    "smoke:m4e",
    "smoke:m3ap",
  ]) {
    runWorkspaceScript(script);
  }
  console.log("\nPASS — smoke:m4");
}

main().catch((err) => {
  console.error("\nFAIL — smoke:m4");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
