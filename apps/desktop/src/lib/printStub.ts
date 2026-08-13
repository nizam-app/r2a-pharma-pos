/**
 * Sale Completed print stub (Batch Y + AA).
 *
 * State machine (locked):
 *   idle → printing → printed
 *                 ↘ failed → retrying → printed | failed
 *
 * Auto-start after Sale Completed entry (loyalty zero-pay or cash).
 * Reprint / Retry → Receipt Preview → Print (same model).
 * This is UI-only — no real printer hardware.
 *
 * TODO(real printer IPC): replace `runPrintStub` with Tauri command that
 * sends ESC/POS (or driver) bytes built from `ReceiptPrintModel`
 * (80mm / 58mm from preview). Shared pilot sample historically noted **58mm**;
 * confirm width when wiring real IPC — Preview defaults to 80mm.
 */

import type { ReceiptPrintModel } from "@/lib/receiptModel";

export type PrintPhase =
  | "idle"
  | "printing"
  | "printed"
  | "failed"
  | "retrying";

export const PRINT_STUB_DELAY_MS = 1600;

/** Dev QA: next `runPrintStub` resolves as failure once, then clears. */
let failNextOnce = false;

export function armPrintStubFailOnce(): void {
  failNextOnce = true;
}

export function isPrintBusy(phase: PrintPhase): boolean {
  return phase === "printing" || phase === "retrying";
}

export function isPrintReady(phase: PrintPhase): boolean {
  return phase === "printed" || phase === "failed" || phase === "idle";
}

/**
 * Fake print job. Resolves `"printed"` after delay, or `"failed"` when
 * `armPrintStubFailOnce()` was called (or `forceFail` is true).
 *
 * Pass `receipt` so the stub / future IPC share one data model.
 */
export function runPrintStub(options?: {
  forceFail?: boolean;
  signal?: AbortSignal;
  /** Canonical receipt payload (Batch AA → future Tauri IPC). */
  receipt?: ReceiptPrintModel;
}): Promise<"printed" | "failed"> {
  const forceFail = Boolean(options?.forceFail) || failNextOnce;
  if (failNextOnce) failNextOnce = false;

  // Keep a reference so tree-shaking / lint don't drop the IPC contract.
  void options?.receipt;

  return new Promise((resolve, reject) => {
    const signal = options?.signal;
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    const timer = window.setTimeout(() => {
      // TODO(real printer IPC): invoke Tauri with `options.receipt`
      // (paperWidth 80mm|58mm + lines + Settings/live pharmacy header).
      resolve(forceFail ? "failed" : "printed");
    }, PRINT_STUB_DELAY_MS);

    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
