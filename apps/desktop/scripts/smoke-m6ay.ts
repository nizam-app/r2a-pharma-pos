/**
 * Batch AY — Desktop cloud shift exit verification (automated checks).
 * Run: npm run smoke:m6ay -w @r2a/desktop
 *
 * Static + source guards for cloud shift integration.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatShiftClock,
  formatShiftDuration,
  formatShiftOpenedAt,
  type ActiveShift,
} from "../src/lib/shiftStore";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..", "..");
const SRC = join(__dirname, "..", "src");

function readSrc(rel: string): string {
  return readFileSync(join(SRC, rel), "utf8");
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function checkShiftStoreCloudApi(): void {
  const storeSrc = readSrc("lib/shiftStore.ts");

  // ActiveShift type must have shiftId, shiftNo, openingFloat
  assert(
    storeSrc.includes("shiftId: string") ||
      storeSrc.includes("shiftId?:"),
    "ActiveShift must have shiftId",
  );
  assert(
    storeSrc.includes("shiftNo: string") ||
      storeSrc.includes("shiftNo?:"),
    "ActiveShift must have shiftNo",
  );
  assert(
    storeSrc.includes("openingFloat: number") ||
      storeSrc.includes("openingFloat?:"),
    "ActiveShift must have openingFloat",
  );

  // Must call cloud API endpoints
  assert(
    storeSrc.includes('/api/v1/shifts"') ||
      storeSrc.includes("/api/v1/shifts/active/close") ||
      storeSrc.includes("/api/v1/shifts/active"),
    "shiftStore must reference cloud shift API endpoints",
  );

  // Must use apiRequest
  assert(
    storeSrc.includes("apiRequest"),
    "shiftStore must use apiRequest for cloud calls",
  );

  // Must have open, close, fetchAndCache methods
  assert(
    storeSrc.includes("async open("),
    "shiftStore must have async open method",
  );
  assert(
    storeSrc.includes("async close("),
    "shiftStore must have async close method",
  );
  assert(
    storeSrc.includes("async fetchAndCache("),
    "shiftStore must have async fetchAndCache method",
  );

  // Helpers still present
  const iso = "2026-08-22T08:42:00.000Z";
  const opened = formatShiftOpenedAt(iso);
  assert(/\d{2}:\d{2}/.test(opened), "openedAt must use Latin HH:MM");
  const clock = formatShiftClock(iso);
  assert(/^\d{2}:\d{2}$/.test(clock), "clock HH:MM");
  const dur = formatShiftDuration(iso, new Date(iso).getTime() + 125 * 60_000);
  assert(dur === "2h 5m", `duration expected 2h 5m got ${dur}`);

  console.log("  ✓ shiftStore cloud API + helpers");
}

function checkShiftPanelCloudIntegration(): void {
  const panel = readSrc("features/shift/ShiftPanel.tsx");

  // Must have opening float input
  assert(
    panel.includes("opening-float") || panel.includes("openingFloat"),
    "ShiftPanel must have opening float input",
  );

  // Must have counted cash input for close
  assert(
    panel.includes("counted-cash") || panel.includes("countedCash"),
    "ShiftPanel must have counted cash input for close",
  );

  // Must show shift number
  assert(
    panel.includes("shiftNo") || panel.includes("shift.shiftNo"),
    "ShiftPanel must display shift number",
  );

  // Must show opening float in active shift view
  assert(
    panel.includes("shift.openingFloat") ||
      panel.includes("openingFloat"),
    "ShiftPanel must display opening float",
  );

  // Online required for open
  assert(
    panel.includes("shift.openingOnlineRequired") ||
      panel.includes("shift.closingOnlineRequired"),
    "ShiftPanel must indicate online requirement",
  );

  // ConfirmDialog for both open and close
  assert(
    panel.includes("confirmOpen") || panel.includes("confirmClose"),
    "ShiftPanel must have confirm dialogs",
  );

  // No Tab, arrow key navigation
  assert(
    panel.includes('event.key === "Tab"'),
    "ShiftPanel must block Tab",
  );
  assert(
    panel.includes("ArrowLeft") && panel.includes("ArrowRight"),
    "ShiftPanel must use ←/→ for CTA navigation",
  );

  // No Baki
  assert(
    !/>\s*Baki\s*</.test(panel) && !/["'`]Baki["'`]/.test(panel),
    "ShiftPanel must not mention Baki",
  );

  console.log("  ✓ ShiftPanel cloud integration");
}

function checkSaleIngestShiftId(): void {
  const ingest = readSrc("lib/saleIngest.ts");

  // SaleIngestBuildArgs must have shiftId
  assert(
    ingest.includes("shiftId") &&
      ingest.includes("SaleIngestBuildArgs"),
    "SaleIngestBuildArgs must include shiftId",
  );

  // buildSaleIngestPayload must include shiftId in output
  assert(
    ingest.includes("shiftId: args.shiftId") ||
      ingest.includes("shiftId: args.shiftId ??"),
    "buildSaleIngestPayload must pass shiftId in output",
  );

  console.log("  ✓ saleIngest shiftId wiring");
}

function checkAppShiftIdPassing(): void {
  const app = readSrc("App.tsx");

  // App must import shiftStore
  assert(
    app.includes("shiftStore") && app.includes("@/lib/shiftStore"),
    "App must import shiftStore",
  );

  // All buildSaleIngestPayload / buildZeroPayIngestPayload calls must pass shiftId
  // Check that shiftStore.get is used to obtain shiftId
  assert(
    app.includes("shiftStore.get") && app.includes("?.shiftId"),
    "App must pass shiftId from cached shift to sale ingest",
  );

  console.log("  ✓ App shiftId passing");
}

function checkCounterReadyShiftNo(): void {
  const counter = readSrc("features/counter/CounterReadyScreen.tsx");

  // Must display shift number
  assert(
    counter.includes("shiftNo") || counter.includes("shift.shiftNo"),
    "CounterReadyScreen must show shift number",
  );

  // Must still read from shiftStore
  assert(
    counter.includes("shiftStore") && counter.includes("get("),
    "CounterReadyScreen must read from shiftStore",
  );

  console.log("  ✓ CounterReadyScreen shift number");
}

function checkI18nKeys(): void {
  const en = readSrc("i18n/locales/en.ts");
  const bn = readSrc("i18n/locales/bn-BD.ts");

  const requiredKeys = [
    "shift.shiftNo",
    "shift.openingFloat",
    "shift.countedCash",
    "shift.expectedCash",
    "shift.variance",
    "shift.openingOnlineRequired",
    "shift.closingOnlineRequired",
    "shift.openFailed",
    "shift.closeFailed",
    "shift.fetchFailed",
    "shift.closeShiftBalanced",
    "shift.closeShiftFlagged",
  ];

  for (const key of requiredKeys) {
    assert(en.includes(`"${key}"`), `en missing ${key}`);
    assert(bn.includes(`"${key}"`), `bn-BD missing ${key}`);
  }

  console.log("  ✓ i18n keys present");
}

async function main(): Promise<void> {
  console.log("smoke:m6ay — Batch AY cloud shift exit\n");
  checkShiftStoreCloudApi();
  checkShiftPanelCloudIntegration();
  checkSaleIngestShiftId();
  checkAppShiftIdPassing();
  checkCounterReadyShiftNo();
  checkI18nKeys();
  console.log("\nPASS — smoke:m6ay");
}

main().catch((err) => {
  console.error("\nFAIL — smoke:m6ay");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
