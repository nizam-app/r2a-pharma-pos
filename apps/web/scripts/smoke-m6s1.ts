/** M6 Slice 1 exit smoke. Requires the cloud API to be running. */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("npm_execpath is unavailable");

const steps = [
  ["@r2a/web", "smoke:m6a"],
  ["@r2a/web", "smoke:m6b"],
  ["@r2a/web", "smoke:m6g"],
  ["@r2a/web", "smoke:m6h"],
  ["@r2a/web", "smoke:m6i"],
  ["@r2a/web", "smoke:m6j"],
  ["@r2a/web", "smoke:m6k"],
  ["@r2a/web", "smoke:m6l"],
  ["@r2a/web", "smoke:m6m"],
  ["@r2a/web", "smoke:m6n"],
  ["@r2a/server", "smoke:m6d"],
  ["@r2a/server", "smoke:m6e"],
  ["@r2a/server", "smoke:m6f"],
  ["@r2a/server", "smoke:m6j"],
  ["@r2a/server", "smoke:m6k"],
  ["@r2a/server", "smoke:m6l"],
  ["@r2a/server", "smoke:m2"],
] as const;

console.log("M6 Slice 1 composed smoke\n");
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

console.log("\nPASS: M6 Slice 1 composed smoke");
