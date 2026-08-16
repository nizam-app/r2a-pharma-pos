/**
 * M6 Batch A smoke — Web scaffold + OWNER session.
 * Run: npm run smoke:m6a -w @r2a/web
 *
 * Source guards only (no live API). Checks package name, Vite port 5173,
 * OWNER gate, login/me wiring. Does not require the cloud server.
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

function checkPackageAndVite(): void {
  const pkg = JSON.parse(readRel("package.json")) as {
    name?: string;
    scripts?: Record<string, string>;
  };
  assert(pkg.name === "@r2a/web", `package name must be @r2a/web, got ${pkg.name}`);
  assert(
    pkg.scripts?.["smoke:m6a"]?.includes("smoke-m6a"),
    "package.json must define smoke:m6a",
  );
  assert(pkg.scripts?.dev === "vite", "dev script must be vite");

  const vite = readRel("vite.config.ts");
  assert(
    /port:\s*5173/.test(vite),
    "vite.config.ts must set server.port 5173",
  );
  assert(
    vite.includes('alias') && vite.includes('"./src"'),
    "vite.config.ts must alias @ → src",
  );

  const envExample = readRel(".env.example");
  assert(
    envExample.includes("VITE_API_BASE_URL=http://127.0.0.1:8787"),
    ".env.example must set VITE_API_BASE_URL=http://127.0.0.1:8787",
  );

  console.log("  ✓ package @r2a/web + vite port 5173 + env example");
}

function checkOwnerGate(): void {
  const gate = readSrc("features/auth/ownerGate.ts");
  assert(
    gate.includes("function isWebOwnerRole") &&
      /return role === ["']OWNER["']/.test(gate),
    "isWebOwnerRole must allow only OWNER",
  );
  assert(
    gate.includes("class OwnerOnlyError"),
    "OwnerOnlyError must exist for login reject copy",
  );

  const auth = readSrc("features/auth/AuthProvider.tsx");
  assert(
    auth.includes("isWebOwnerRole") && auth.includes("OwnerOnlyError"),
    "AuthProvider must use the OWNER gate",
  );
  assert(
    auth.includes("fetchMe") && auth.includes("/api/v1/auth/login") === false,
    "AuthProvider uses fetchMe; login path lives in api.ts",
  );
  assert(
    auth.includes("if (!isWebOwnerRole(next.role))"),
    "AuthProvider must reject non-OWNER after GET /users/me",
  );
  assert(
    auth.includes("tokenStore.clear()") && auth.includes("throw new OwnerOnlyError()"),
    "Non-OWNER login must clear session and throw OwnerOnlyError",
  );

  const api = readSrc("lib/api.ts");
  assert(
    api.includes("/api/v1/auth/login") && api.includes("/api/v1/users/me"),
    "api.ts must call POST /auth/login and GET /users/me",
  );

  const login = readSrc("features/auth/LoginPage.tsx");
  assert(
    login.includes("OwnerOnlyError") && login.includes('t("auth.ownerOnly")'),
    "LoginPage must show i18n owner-only error",
  );

  console.log("  ✓ OWNER gate in source (reject MANAGER/CASHIER)");
}

function checkI18n(): void {
  const en = readSrc("i18n/locales/en.ts");
  const bn = readSrc("i18n/locales/bn-BD.ts");
  const types = readSrc("i18n/types.ts");

  assert(
    types.includes('DEFAULT_UI_LOCALE: UiLocale = "bn-BD"'),
    "Default UI locale must be bn-BD",
  );
  assert(
    en.includes('"auth.ownerOnly"') && bn.includes('"auth.ownerOnly"'),
    "auth.ownerOnly must exist in en and bn-BD",
  );
  assert(
    en.includes('"home.ownerPortal"') && bn.includes('"home.ownerPortal"'),
    "home.ownerPortal must exist in en and bn-BD",
  );
  assert(
    en.includes('"home.logout"') && bn.includes('"home.logout"'),
    "home.logout must exist in en and bn-BD",
  );

  const provider = readSrc("i18n/LocaleProvider.tsx");
  assert(
    !/key=\{locale\}/.test(provider),
    "LocaleProvider must not key children by locale (would reset session)",
  );

  console.log("  ✓ i18n en + bn-BD (default bn-BD)");
}

function checkScope(): void {
  const files = walkTs(SRC);
  const all = files.map((p) => readFileSync(p, "utf8")).join("\n");

  assert(
    !/\/api\/v1\/sales/.test(all),
    "Must not add GET /sales (Batch E/H)",
  );
  assert(
    !/prisma/i.test(all) && !/InventoryEvent/.test(all),
    "Must not touch Prisma schema",
  );

  const app = readSrc("App.tsx");
  assert(
    app.includes("LoginPage") && app.includes("AppShell"),
    "AppGate must show LoginPage vs Owner AppShell",
  );

  console.log("  ✓ login + shell; no GET /sales / no schema");
}

function main(): void {
  console.log("M6 Batch A smoke (@r2a/web)\n");
  checkPackageAndVite();
  checkOwnerGate();
  checkI18n();
  checkScope();
  console.log("\nPASS");
}

try {
  main();
} catch (err) {
  console.error("\nFAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
}
