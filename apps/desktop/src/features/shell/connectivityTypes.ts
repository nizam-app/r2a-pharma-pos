/**
 * Header connectivity badge states (M3 Slice 1 — invented / locked).
 * M4 Batch D wires pending / syncing / error to the 15s flush worker.
 * `checking` = first probe in flight (not a false offline flash).
 *
 * ## Force Offline / Stay Offline (M3 Batch AI)
 *
 * Cashier may **force** this terminal offline (bad WAN, training, isolated register).
 * While forced:
 * - Effective mode is always `offline` (badge shows Offline).
 * - Health probes / browser `online` events / header re-probe are ignored.
 * - Sticky until explicit **Go Online** (clears override, then probes).
 * - Persisted in `forceOfflineStore` (localStorage) across reloads.
 *
 * Display labels are translated at the React boundary (ConnectivityBadge).
 * This module stays pure — no React / i18n hooks.
 */
export type ConnectivityBadgeState =
  | "checking"
  | "online_synced"
  | "online_syncing"
  | "online_pending"
  | "offline"
  | "error";

/**
 * Coarse mode for later POS batches.
 * - `checking` — probe in flight; do **not** treat as offline SQLite path yet
 * - `online` / `offline` — settled
 *
 * Forced offline always yields effective `offline` (see ConnectivityProvider).
 */
export type ConnectivityMode = "checking" | "online" | "offline";

export type ConnectivityBadgeVisual = {
  /** Semantic status for UI copy composition. */
  state: ConnectivityBadgeState;
  /** Tailwind classes for the status dot. */
  dotClassName: string;
  /** Tailwind classes for the pill chrome. */
  pillClassName: string;
};

export function badgeVisual(
  state: ConnectivityBadgeState,
  _pendingCount: number,
): ConnectivityBadgeVisual {
  switch (state) {
    case "checking":
      return {
        state,
        dotClassName: "bg-offline animate-pulse",
        pillClassName: "border-border bg-canvas text-muted",
      };
    case "online_synced":
      return {
        state,
        dotClassName: "bg-connected",
        pillClassName: "border-border bg-canvas text-foreground",
      };
    case "online_syncing":
      return {
        state,
        dotClassName: "bg-connected animate-pulse",
        pillClassName: "border-border bg-canvas text-foreground",
      };
    case "online_pending":
      return {
        state,
        dotClassName: "bg-pending",
        pillClassName: "border-border bg-canvas text-foreground",
      };
    case "offline":
      return {
        state,
        dotClassName: "bg-offline",
        pillClassName: "border-border bg-canvas text-muted",
      };
    case "error":
      return {
        state,
        dotClassName: "bg-destructive",
        pillClassName: "border-destructive/30 bg-canvas text-destructive",
      };
  }
}

export function deriveBadgeState(args: {
  mode: ConnectivityMode;
  pendingCount: number;
  syncing: boolean;
  syncError: boolean;
}): ConnectivityBadgeState {
  const { mode, pendingCount, syncing, syncError } = args;
  if (mode === "checking") return "checking";
  if (mode === "offline") return "offline";
  if (syncError) return "error";
  if (syncing) return "online_syncing";
  if (pendingCount > 0) return "online_pending";
  return "online_synced";
}

/** Compose connected · pending label parts; caller supplies translated words + Latin count. */
export function formatPendingCount(pendingCount: number): string {
  return String(Math.max(0, Math.trunc(pendingCount)));
}
