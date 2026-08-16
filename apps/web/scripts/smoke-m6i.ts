/**
 * M6 Batch I smoke — Owner Transaction Details.
 * Run: npm run smoke:m6i -w @r2a/web
 *
 * Source guards only (no live API). Detail must call GET /sales/:id, show
 * FEFO OVERRIDE from flags, hide walk-in loyalty grid, reprint on-screen
 * from sale JSON (no Tauri), Amount Due ৳0, More Actions disabled, no void.
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

const DETAIL_I18N_KEYS = [
  "sales.detail.crumb",
  "sales.detail.reprint",
  "sales.detail.moreActions",
  "sales.detail.override",
  "sales.detail.amountDue",
  "sales.detail.loyalty.previous",
  "sales.detail.activity.fefo",
  "sales.detail.activity.loyalty",
  "dashboard.payment.loyalty",
  "sales.detail.receiptAvailable",
] as const;

function checkPackage(): void {
  const pkg = JSON.parse(readRel("package.json")) as {
    name?: string;
    scripts?: Record<string, string>;
  };
  assert(pkg.name === "@r2a/web", `package name must be @r2a/web, got ${pkg.name}`);
  assert(
    pkg.scripts?.["smoke:m6i"]?.includes("smoke-m6i"),
    "package.json must define smoke:m6i",
  );
  console.log("  ✓ package @r2a/web + smoke:m6i");
}

function checkI18n(): void {
  const en = readSrc("i18n/locales/en.ts");
  const bn = readSrc("i18n/locales/bn-BD.ts");
  for (const key of DETAIL_I18N_KEYS) {
    assert(
      en.includes(`"${key}"`) && bn.includes(`"${key}"`),
      `${key} must exist in en and bn-BD`,
    );
  }
  assert(
    en.includes("Amount Due") && !en.toLowerCase().includes("baki"),
    "Amount Due copy must exist; no Baki",
  );
  console.log("  ✓ detail i18n keys in en + bn-BD");
}

function checkDetailFetch(): void {
  const page = readSrc("features/sales/SaleDetailPage.tsx");
  const client = readSrc("lib/saleDetail.ts");
  const shell = readSrc("features/shell/AppShell.tsx");
  const all = walkTs(SRC)
    .map((p) => readFileSync(p, "utf8"))
    .join("\n");

  assert(
    client.includes("/api/v1/sales/") && client.includes("fetchSale"),
    "saleDetail must call GET /api/v1/sales/:id",
  );
  assert(page.includes("fetchSale"), "SaleDetailPage must fetch GET /sales/:id");
  assert(
    shell.includes("SaleDetailPage") && shell.includes("salesDetailIdFromPath"),
    "AppShell must render SaleDetailPage on /sales/:id",
  );
  assert(
    !/TXN-260814-1045/.test(all),
    "Must not hard-code mock TXN-260814-1045",
  );
  assert(!/₺/.test(all), "Must use ৳, never ₺");
  assert(!/4242/.test(all), "Must not invent card ending 4242");
  console.log("  ✓ live GET /sales/:id; no mock TXN");
}

function checkLocks(): void {
  const page = readSrc("features/sales/SaleDetailPage.tsx");
  const activity = readSrc("lib/saleActivity.ts");
  const reprint = readSrc("features/sales/ReprintReceiptModal.tsx");
  const preview = readSrc("lib/receiptPreview.ts");
  const allDetail = `${page}\n${activity}\n${reprint}\n${preview}`;

  assert(
    page.includes("fefoOverride") && page.includes("sales.detail.override"),
    "Override badge must show when fefoOverride is true",
  );
  assert(
    page.includes("walkIn") &&
      page.includes("sales.detail.loyalty.previous") &&
      page.includes("walkIn ? null"),
    "Walk-in sales must hide the loyalty grid",
  );
  assert(
    page.includes("sales.detail.amountDue") && page.includes("formatTaka(0)"),
    "Amount Due must be ৳0",
  );
  assert(
    page.includes("sales.detail.moreActions") && page.includes("disabled"),
    "More Actions must be disabled",
  );
  assert(
    page.includes("ReprintReceiptModal") &&
      preview.includes("buildReceiptPreview") &&
      reprint.includes("role=\"dialog\""),
    "Reprint must open an on-screen preview from sale JSON",
  );
  assert(
    !allDetail.includes("@tauri-apps") && !allDetail.includes("invoke("),
    "Reprint must not use Tauri IPC",
  );
  assert(
    activity.includes("soldAt") &&
      activity.includes("fefoOverride") &&
      activity.includes("payments") &&
      !activity.includes("Receipt printed") &&
      !activity.includes("Sale started"),
    "Activity must come from soldAt / payments / FEFO flags only",
  );
  assert(
    !page.includes("sales.detail.void") &&
      !/\bBaki\b/.test(page) &&
      !page.includes("on-account"),
    "No sale-void action / Baki",
  );
  assert(
    page.includes("item.product.name") && !page.includes("t(item.product"),
    "Medicine names must stay untranslated",
  );
  const tender = readSrc("lib/loyaltyTender.ts");
  const list = readSrc("features/sales/SalesPage.tsx");
  assert(
    tender.includes("isLoyaltyOnlyTender") &&
      page.includes("dashboard.payment.loyalty") &&
      list.includes("isLoyaltyOnlyTender"),
    "Full points-cover must display Loyalty / Points, not dummy Cash",
  );
  console.log("  ✓ OVERRIDE / walk-in loyalty / reprint preview / ৳0 due");
}

function main(): void {
  console.log("M6 Batch I smoke (@r2a/web)\n");
  checkPackage();
  checkI18n();
  checkDetailFetch();
  checkLocks();
  console.log("\nPASS");
}

try {
  main();
} catch (err) {
  console.error("\nFAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
}
