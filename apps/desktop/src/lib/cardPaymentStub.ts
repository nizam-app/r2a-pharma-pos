/**
 * Card Payment terminal stub (Batch AB + AC handoff).
 *
 * State machine (locked):
 *   not_started --Start--> processing --ok--> completing (ingest) → Sale Completed
 *                              |--decline--> declined --Retry--> not_started
 *                              |--Cancel--> cancelling --> declined
 *
 * Terminal-assisted UI only — no hardware SDK.
 *
 * TODO(real card terminal SDK): replace `runCardTerminalStub` /
 * `runCardCancelStub` with Tauri bridge to the physical terminal.
 */

export type CardPaymentPhase =
  | "not_started"
  | "processing"
  | "cancelling"
  | "declined"
  /** Terminal approved; waiting for sale ingest (Batch AC). */
  | "completing";

export const CARD_PROCESS_STUB_DELAY_MS = 2200;
export const CARD_CANCEL_STUB_DELAY_MS = 1200;

/** Dev QA: next Start → Processing resolves as declined once, then clears. */
let failNextOnce = false;

export function armCardStubDeclineOnce(): void {
  failNextOnce = true;
}

/**
 * Fake terminal authorize. Resolves `"approved"` after delay, or `"declined"`
 * when `armCardStubDeclineOnce()` was called (or `forceDecline` is true).
 */
export function runCardTerminalStub(options?: {
  forceDecline?: boolean;
  signal?: AbortSignal;
}): Promise<"approved" | "declined"> {
  const forceDecline = Boolean(options?.forceDecline) || failNextOnce;
  if (failNextOnce) failNextOnce = false;

  return new Promise((resolve, reject) => {
    const signal = options?.signal;
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    const timer = window.setTimeout(() => {
      // TODO(real card terminal SDK): await terminal authorize response
      resolve(forceDecline ? "declined" : "approved");
    }, CARD_PROCESS_STUB_DELAY_MS);

    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** Fake terminal cancel acknowledge. Always resolves after short delay. */
export function runCardCancelStub(options?: {
  signal?: AbortSignal;
}): Promise<"cancelled"> {
  return new Promise((resolve, reject) => {
    const signal = options?.signal;
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    const timer = window.setTimeout(() => {
      // TODO(real card terminal SDK): await cancel confirmation
      resolve("cancelled");
    }, CARD_CANCEL_STUB_DELAY_MS);

    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
