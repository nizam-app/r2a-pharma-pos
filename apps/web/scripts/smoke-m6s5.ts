/** M6 Slice 5 exit smoke (Batch BD). Requires the cloud API + desktop to be running. */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("npm_execpath is unavailable");

const steps = [
  ["@r2a/server", "smoke:m6ax"],
  ["@r2a/desktop", "smoke:m6ay"],
  ["@r2a/web", "smoke:m6az"],
  ["@r2a/web", "smoke:m6ba"],
  ["@r2a/web", "smoke:m6bb"],
  ["@r2a/web", "smoke:m6bc"],
  ["@r2a/web", "smoke:m6s1"],
  ["@r2a/web", "smoke:m6s3"],
  ["@r2a/web", "smoke:m6av"],
] as const;

console.log("M6 Slice 5 (Batch BD) composed smoke\n");
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

console.log("\nPASS: M6 Slice 5 composed smoke");
