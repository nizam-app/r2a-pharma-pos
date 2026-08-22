/** M6 Slice 3 exit smoke. Requires the cloud API to be running. */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("npm_execpath is unavailable");

const steps = [
  ["@r2a/server", "smoke:m6af"],
  ["@r2a/web", "smoke:m6ag"],
  ["@r2a/web", "smoke:m6ah"],
  ["@r2a/web", "smoke:m6ai"],
  ["@r2a/web", "smoke:m6aj"],
  ["@r2a/web", "smoke:m6ak"],
  ["@r2a/desktop", "smoke:m6al"],
  ["@r2a/web", "smoke:m6s1"],
] as const;

console.log("M6 Slice 3 composed smoke\n");
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

console.log("\nPASS: M6 Slice 3 composed smoke");
