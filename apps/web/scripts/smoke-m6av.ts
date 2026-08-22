/** M6 Batch AV / Slice 4 Staff composed web smoke. */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("npm_execpath is unavailable");

const steps = [
  ["@r2a/web", "smoke:m6ap"],
  ["@r2a/web", "smoke:m6aq"],
  ["@r2a/web", "smoke:m6ar"],
  ["@r2a/web", "smoke:m6as"],
  ["@r2a/web", "smoke:m6at"],
  ["@r2a/web", "smoke:m6au"],
] as const;

console.log("M6 Batch AV / Slice 4 Staff composed web smoke\n");

for (const [workspace, script] of steps) {
  console.log(`\n=== ${workspace} ${script} ===`);
  const result = spawnSync(process.execPath, [npmCli, "run", script, "-w", workspace], {
    cwd: repoRoot,
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    console.error(`\nFAIL: ${workspace} ${script}`);
    process.exit(result.status ?? 1);
  }
}

console.log("\nPASS: M6 Slice 4 Staff composed web smoke");
