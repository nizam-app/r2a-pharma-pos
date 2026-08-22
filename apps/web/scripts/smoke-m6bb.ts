/**
 * M6 Batch BB smoke — Review Cash Variance modal + resolved shift details.
 * Run: npm run smoke:m6bb -w @r2a/web
 */

import { readFileSync } from "node:fs";
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

const BB_KEYS = [
  "shifts.action.review",
  "shifts.detail.generateReport",
  "shifts.detail.reviewCard.title",
  "shifts.detail.reviewCard.decision",
  "shifts.review.title",
  "shifts.review.selectDecision",
  "shifts.review.decision.ACCEPTED_DIFFERENCE",
  "shifts.review.decision.COUNT_CORRECTED",
  "shifts.review.decision.OTHER",
  "shifts.review.confirm",
  "shifts.review.resolve",
] as const;

function checkPackage(): void {
  const pkg = JSON.parse(readRel("package.json")) as { scripts?: Record<string, string> };
  assert(pkg.scripts?.["smoke:m6bb"]?.includes("smoke-m6bb"), "package.json must define smoke:m6bb");
  console.log("  ✓ smoke:m6bb script registered");
}

function checkI18n(): void {
  const en = readSrc("i18n/locales/en.ts");
  const bn = readSrc("i18n/locales/bn-BD.ts");
  for (const key of BB_KEYS) {
    assert(en.includes(`"${key}"`) && bn.includes(`"${key}"`), `${key} must exist in en and bn-BD`);
  }
  console.log("  ✓ Batch BB i18n keys in en + bn-BD");
}

function checkClient(): void {
  const lib = readSrc("lib/shifts.ts");
  assert(lib.includes("resolveShiftVariance"), "shift client must export resolveShiftVariance");
  assert(lib.includes("/api/v1/owner/shifts/${encodeURIComponent(shiftId)}/resolve"), "client must call shipped owner shift resolve endpoint");
  assert(lib.includes("ShiftVarianceDecision"), "client must type variance decisions");
  console.log("  ✓ typed resolve-variance client");
}

function checkModal(): void {
  const modal = readSrc("features/staff/ReviewCashVarianceModal.tsx");
  assert(modal.includes("role=\"dialog\"") && modal.includes("aria-modal=\"true\""), "review modal must be an accessible dialog");
  assert(modal.includes("resolveShiftVariance"), "review modal must submit resolveShiftVariance");
  assert(modal.includes("ACCEPTED_DIFFERENCE") && modal.includes("COUNT_CORRECTED") && modal.includes("OTHER"), "review modal must expose all decision categories");
  assert(modal.includes("adjustmentReference"), "review modal must include optional adjustment reference");
  assert(modal.includes("confirmed") && modal.includes("disabled={!decision || !confirmed || submitting}"), "review modal must checkbox-gate submit");
  console.log("  ✓ Review Cash Variance modal wired");
}

function checkListAndDetail(): void {
  const list = readSrc("features/staff/ShiftManagementPage.tsx");
  const detail = readSrc("features/staff/ShiftDetailPage.tsx");
  assert(list.includes("ReviewCashVarianceModal") && list.includes("setReviewShift(row)"), "flagged list rows must open review modal");
  assert(detail.includes("ReviewCashVarianceModal") && detail.includes("setReviewOpen(true)"), "flagged detail must open review modal");
  assert(detail.includes("hasUnresolvedVariance") && detail.includes("hasResolvedVariance"), "detail must distinguish unresolved vs resolved variance");
  assert(detail.includes('t("shifts.detail.reviewCard.title")'), "resolved detail must render Variance Review card");
  assert(detail.includes('t("shifts.detail.generateReport")') && detail.includes("disabled"), "Generate Shift Report must stay disabled");
  console.log("  ✓ list action and resolved detail guards");
}

function main(): void {
  console.log("M6 Batch BB smoke (@r2a/web)\n");
  checkPackage();
  checkI18n();
  checkClient();
  checkModal();
  checkListAndDetail();
  console.log("\nPASS");
}

try {
  main();
} catch (err) {
  console.error("\nFAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
}
