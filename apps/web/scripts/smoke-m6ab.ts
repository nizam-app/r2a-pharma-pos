/**
 * M6 Batch AB smoke — Owner Create Return Manifest page.
 * Run: npm run smoke:m6ab -w @r2a/web
 *
 * Source guards only (no live API). Dedicated /suppliers/returns/new reviews
 * the Batch AA session draft, shows supplier policy, and posts
 * POST /owner/return-manifests. Save as Draft stays disabled (no DRAFT status).
 * Dispatch / decision / complete stay Batch AC. No invented SRM number or
 * sample lots. Preparing a manifest must not POST dispatch.
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

const MANIFEST_I18N_KEYS = [
  "suppliers.manifest.title",
  "suppliers.manifest.subtitle",
  "suppliers.manifest.cancel",
  "suppliers.manifest.loading",
  "suppliers.manifest.loadError",
  "suppliers.manifest.retry",
  "suppliers.manifest.emptyDraft",
  "suppliers.manifest.emptyDraftHint",
  "suppliers.manifest.backToQueue",
  "suppliers.manifest.emptyLines",
  "suppliers.manifest.missingLots",
  "suppliers.manifest.detailsTitle",
  "suppliers.manifest.autoNumber",
  "suppliers.manifest.autoNumberHint",
  "suppliers.manifest.supplier",
  "suppliers.manifest.branch",
  "suppliers.manifest.preparedBy",
  "suppliers.manifest.manifestDate",
  "suppliers.manifest.returnReason",
  "suppliers.manifest.returnReasonExpiry",
  "suppliers.manifest.supplierReference",
  "suppliers.manifest.supplierReferencePlaceholder",
  "suppliers.manifest.notes",
  "suppliers.manifest.notesPlaceholder",
  "suppliers.manifest.itemsTitle",
  "suppliers.manifest.col.medicine",
  "suppliers.manifest.col.batch",
  "suppliers.manifest.col.expiry",
  "suppliers.manifest.col.availableQty",
  "suppliers.manifest.col.returnQty",
  "suppliers.manifest.col.costValue",
  "suppliers.manifest.col.status",
  "suppliers.manifest.col.action",
  "suppliers.manifest.removeLine",
  "suppliers.manifest.summary.title",
  "suppliers.manifest.summary.supplier",
  "suppliers.manifest.summary.reason",
  "suppliers.manifest.summary.batches",
  "suppliers.manifest.summary.units",
  "suppliers.manifest.summary.cost",
  "suppliers.manifest.summary.status",
  "suppliers.manifest.summary.statusPrepared",
  "suppliers.manifest.summary.inventoryNote",
  "suppliers.manifest.policy.title",
  "suppliers.manifest.policy.expiryReturns",
  "suppliers.manifest.policy.accepted",
  "suppliers.manifest.policy.notAccepted",
  "suppliers.manifest.policy.minDays",
  "suppliers.manifest.policy.instructions",
  "suppliers.manifest.policy.none",
  "suppliers.manifest.policy.status",
  "suppliers.manifest.policy.eligible",
  "suppliers.manifest.policy.notEligible",
  "suppliers.manifest.policy.hint",
  "suppliers.manifest.footerNote",
  "suppliers.manifest.saveDraft",
  "suppliers.manifest.saveDraftSoon",
  "suppliers.manifest.prepare",
  "suppliers.manifest.preparing",
  "suppliers.manifest.validation",
  "suppliers.manifest.submitError",
  "suppliers.manifest.unsavedTitle",
  "suppliers.manifest.unsavedBody",
  "suppliers.manifest.keepEditing",
  "suppliers.manifest.discardChanges",
] as const;

function checkPackage(): void {
  const pkg = JSON.parse(readRel("package.json")) as {
    name?: string;
    scripts?: Record<string, string>;
  };
  assert(pkg.name === "@r2a/web", `package name must be @r2a/web, got ${pkg.name}`);
  assert(
    pkg.scripts?.["smoke:m6ab"]?.includes("smoke-m6ab"),
    "package.json must define smoke:m6ab",
  );
  console.log("  ✓ package @r2a/web + smoke:m6ab");
}

function checkI18n(): void {
  const en = readSrc("i18n/locales/en.ts");
  const bn = readSrc("i18n/locales/bn-BD.ts");
  for (const key of MANIFEST_I18N_KEYS) {
    assert(
      en.includes(`"${key}"`) && bn.includes(`"${key}"`),
      `${key} must exist in en and bn-BD`,
    );
  }
  assert(
    !en.includes('"suppliers.placeholder.returnsTitle"') &&
      !bn.includes('"suppliers.placeholder.returnsTitle"'),
    "superseded create-manifest placeholder keys must be removed",
  );
  assert(
    en.includes('"suppliers.placeholder.manifestTitle"') &&
      bn.includes('"suppliers.placeholder.manifestTitle"'),
    "Manifest Details placeholder keys must remain for Batch AC",
  );
  console.log("  ✓ suppliers.manifest i18n keys in en + bn-BD");
}

function checkPage(): void {
  const page = readSrc("features/suppliers/CreateReturnManifestPage.tsx");
  const lib = readSrc("lib/returnQueue.ts");
  const shell = readSrc("features/shell/AppShell.tsx");
  const all = walkTs(SRC)
    .map((p) => readFileSync(p, "utf8"))
    .join("\n");

  assert(
    lib.includes("createReturnManifest") &&
      lib.includes("/api/v1/owner/return-manifests") &&
      lib.includes("readReturnManifestDraft") &&
      lib.includes("fetchReturnLotsByIds") &&
      lib.includes("clearReturnManifestDraft"),
    "returnQueue lib must POST /owner/return-manifests from the Batch AA draft",
  );
  assert(
    page.includes("CreateReturnManifestPage") &&
      page.includes("createReturnManifest") &&
      page.includes("fetchReturnLotsByIds") &&
      page.includes("fetchSupplierDetail") &&
      page.includes("readReturnManifestDraft"),
    "Create page must load the session draft, live lots, and supplier policy",
  );
  assert(
    page.includes("suppliers.manifest.policy.title") &&
      page.includes("expiryReturnsAccepted") &&
      page.includes("minDaysBeforeExpiry"),
    "Page must render live supplier return policy",
  );
  assert(
    page.includes("suppliers.manifest.col.returnQty") &&
      page.includes("returnQty") &&
      page.includes("suppliers.manifest.removeLine"),
    "Return qty must be editable and lots removable",
  );
  assert(
    page.includes("encodeURIComponent(created.id)") &&
      page.includes("/suppliers/returns/") &&
      page.includes("clearReturnManifestDraft"),
    "Prepare must create then navigate to Manifest Details",
  );
  assert(
    page.includes("suppliers.manifest.saveDraftSoon") &&
      page.includes('aria-disabled="true"') &&
      !page.includes("/dispatch") &&
      !page.includes("/decision") &&
      !page.includes("/complete"),
    "Save as Draft must stay disabled; dispatch/decision/complete stay Batch AC",
  );
  assert(
    page.includes("mixedSupplier") &&
      page.includes("suppliers.returns.mixedSupplier"),
    "Mixed-supplier drafts must not prepare",
  );
  assert(
    shell.includes("CreateReturnManifestPage") &&
      shell.includes('sub.kind === "returnsNew"') &&
      shell.includes("suppliers.placeholder.manifest"),
    "AppShell must render CreateReturnManifestPage for /new and keep details placeholder",
  );
  assert(
    !page.includes("SRM-260815-0018") &&
      !page.includes("Square Distribution") &&
      !page.includes("Seclo") &&
      !page.includes("Amodis") &&
      !/৳335/.test(page) &&
      !/110 pcs/.test(page),
    "Must not hard-code sample SRM, supplier, medicine, or ৳335",
  );
  assert(
    !/₺/.test(all) && !/\$\d/.test(all),
    "Must not hard-code ₺ or mock dollar totals",
  );
  console.log("  ✓ live POST /owner/return-manifests; policy + qty review; no AC lifecycle");
}

function main(): void {
  console.log("M6 Batch AB smoke (@r2a/web)\n");
  checkPackage();
  checkI18n();
  checkPage();
  console.log("\nPASS");
}

try {
  main();
} catch (err) {
  console.error("\nFAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
}
