import { RefreshCw, Signal, User } from "lucide-react";
import { useLocale } from "@/i18n";
import { ConnectivityBadge } from "./ConnectivityBadge";
import { useConnectivity } from "./ConnectivityProvider";

export type HeaderProps = {
  terminalLabel?: string;
  cashierLabel?: string;
  onOpenSyncQueue?: () => void;
};

/**
 * Chrome header locked to Search Results - Napa.
 * Connectivity badge + Force Offline menu (Batch AI); sync re-probe (Batch D).
 */
export function Header({
  terminalLabel = "TERMINAL 01",
  cashierLabel = "—",
  onOpenSyncQueue,
}: HeaderProps) {
  const { reprobe, syncing, forcedOffline } = useConnectivity();
  const { t } = useLocale();

  return (
    <header
      className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-surface px-4"
      style={{ height: "var(--r2a-header-height)" }}
    >
      <div className="flex min-w-0 items-center gap-3 text-sm">
        <span className="truncate font-semibold text-primary">PharmaSync POS</span>
        <span className="h-4 w-px shrink-0 bg-border" aria-hidden />
        <span className="truncate font-medium uppercase tracking-wide text-foreground">
          {terminalLabel}
        </span>
        <span className="h-4 w-px shrink-0 bg-border" aria-hidden />
        <span className="truncate text-muted">
          {t("header.cashier")}:{" "}
          <span className="font-medium text-foreground">{cashierLabel}</span>
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <ConnectivityBadge onOpenSyncQueue={onOpenSyncQueue} />
        <button
          type="button"
          className="rounded p-1 text-muted hover:bg-shell hover:text-foreground"
          aria-label={t("header.sync")}
          tabIndex={-1}
        >
          <Signal className="size-4" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          className="rounded p-1 text-muted hover:bg-shell hover:text-foreground disabled:opacity-50"
          aria-label={t("header.checkConnectivity")}
          title={
            forcedOffline
              ? t("header.checkConnectivityForcedTitle")
              : t("header.checkConnectivityTitle")
          }
          disabled={syncing || forcedOffline}
          onClick={() => {
            void reprobe();
          }}
        >
          <RefreshCw
            className={`size-4 ${syncing ? "animate-spin" : ""}`}
            strokeWidth={1.75}
          />
        </button>
        <button
          type="button"
          className="rounded p-1 text-muted hover:bg-shell hover:text-foreground"
          aria-label={t("header.userAccount")}
          tabIndex={-1}
        >
          <User className="size-4" strokeWidth={1.75} />
        </button>
      </div>
    </header>
  );
}
