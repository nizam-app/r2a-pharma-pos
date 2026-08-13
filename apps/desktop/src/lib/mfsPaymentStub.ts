/**
 * MFS Payment stub (Batch AD).
 *
 * Flow (locked):
 *   provider_select --Continue--> confirm --Confirm--> processing
 *       --ok--> completing (ingest MFS) → Sale Completed
 *       --fail--> failed --Retry--> confirm | Back → provider_select
 *
 * Confirm / fail / result UI = **desktop-invented** until design replaces them.
 * Provider Select = shared Slice 4 screen (bKash / Nagad / Rocket only).
 *
 * TODO(real MFS APIs): replace invented confirm + `runMfsCollectStub` with
 * backend → provider confirm/webhook → desktop shows real status only.
 * Cashier must not manually enter Trx IDs.
 */

export type MfsProviderId = "BKASH" | "NAGAD" | "ROCKET";

export type MfsPaymentPhase =
  | "provider_select"
  | "confirm"
  | "processing"
  | "failed"
  /** Collect stub succeeded; waiting for sale ingest. */
  | "completing";

/**
 * Official-ish brand accents (from provider logo assets — color visibility only).
 * Hex constants for reference; Tailwind classes below must stay as full literals
 * so JIT can detect them.
 */
export const MFS_BRAND = {
  BKASH: { primary: "#E2136E", hover: "#C4115F" },
  /** Nagad mark uses orange + red; header = OG vertical gradient. */
  NAGAD: { orange: "#F7941D", red: "#ED1C24", hover: "#D41920" },
  ROCKET: { primary: "#8C3494", hover: "#732B7A" },
} as const;

export type MfsProviderDef = {
  id: MfsProviderId;
  label: string;
  /** Short helper under the provider name. */
  description: string;
  /** Brand color cues for cards / header / amount (visibility only). */
  accent: {
    border: string;
    bg: string;
    text: string;
    iconBg: string;
    /** Header strip after provider chosen (solid or Nagad OG gradient). */
    header: string;
    amountBorder: string;
    amountBg: string;
    amountText: string;
    spinner: string;
    primaryBtn: string;
  };
};

export const MFS_PROVIDERS: readonly MfsProviderDef[] = [
  {
    id: "BKASH",
    label: "bKash",
    description: "Send money / payment",
    accent: {
      // OG bKash magenta/pink
      border: "border-[#E2136E]",
      bg: "bg-[#E2136E]/8",
      text: "text-[#E2136E]",
      iconBg: "bg-[#E2136E]/15 text-[#E2136E]",
      header: "bg-[#E2136E]",
      amountBorder: "border-[#E2136E]/35",
      amountBg: "bg-[#E2136E]/8",
      amountText: "text-[#E2136E]",
      spinner: "text-[#E2136E]",
      primaryBtn:
        "bg-[#E2136E] hover:bg-[#C4115F] focus-visible:ring-[#E2136E]/40",
    },
  },
  {
    id: "NAGAD",
    label: "Nagad",
    description: "Send money / payment",
    accent: {
      // OG Nagad: orange #F7941D → red #ED1C24
      border: "border-[#ED1C24]",
      bg: "bg-[#F7941D]/10",
      text: "text-[#ED1C24]",
      iconBg: "bg-[#F7941D]/20 text-[#ED1C24]",
      header: "bg-gradient-to-b from-[#F7941D] to-[#ED1C24]",
      amountBorder: "border-[#ED1C24]/40",
      amountBg: "bg-[#F7941D]/10",
      amountText: "text-[#ED1C24]",
      spinner: "text-[#ED1C24]",
      primaryBtn:
        "bg-[#ED1C24] hover:bg-[#D41920] focus-visible:ring-[#F7941D]/50",
    },
  },
  {
    id: "ROCKET",
    label: "Rocket",
    description: "Send money / payment",
    accent: {
      // OG Rocket / Dutch-Bangla purple
      border: "border-[#8C3494]",
      bg: "bg-[#8C3494]/8",
      text: "text-[#8C3494]",
      iconBg: "bg-[#8C3494]/15 text-[#8C3494]",
      header: "bg-[#8C3494]",
      amountBorder: "border-[#8C3494]/35",
      amountBg: "bg-[#8C3494]/8",
      amountText: "text-[#8C3494]",
      spinner: "text-[#8C3494]",
      primaryBtn:
        "bg-[#8C3494] hover:bg-[#732B7A] focus-visible:ring-[#8C3494]/40",
    },
  },
] as const;

export const MFS_PROCESS_STUB_DELAY_MS = 2000;

/** Dev QA: next Confirm → Processing resolves as failed once, then clears. */
let failNextOnce = false;

export function armMfsStubFailOnce(): void {
  failNextOnce = true;
}

export function getMfsProvider(id: MfsProviderId): MfsProviderDef {
  const found = MFS_PROVIDERS.find((p) => p.id === id);
  if (!found) {
    throw new Error(`Unknown MFS provider: ${id}`);
  }
  return found;
}

/** Digits-only BD mobile (11 chars starting with 01). */
export function normalizeBdMobile(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 11);
}

export function isValidBdMobile(digits: string): boolean {
  return /^01\d{9}$/.test(digits);
}

/**
 * Fake MFS collect acknowledgment.
 * Resolves `"collected"` after delay, or `"failed"` when armed / forced.
 */
export function runMfsCollectStub(options?: {
  forceFail?: boolean;
  signal?: AbortSignal;
}): Promise<"collected" | "failed"> {
  const forceFail = Boolean(options?.forceFail) || failNextOnce;
  if (failNextOnce) failNextOnce = false;

  return new Promise((resolve, reject) => {
    const signal = options?.signal;
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    const timer = window.setTimeout(() => {
      // TODO(real MFS APIs): await provider confirm / webhook
      resolve(forceFail ? "failed" : "collected");
    }, MFS_PROCESS_STUB_DELAY_MS);

    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
