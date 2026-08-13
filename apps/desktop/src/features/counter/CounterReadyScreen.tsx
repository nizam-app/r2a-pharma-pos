import type { ReactNode } from "react";
import {
  BarChart3,
  CalendarDays,
  Cloud,
  CloudOff,
  CloudUpload,
  Plus,
  Store,
} from "lucide-react";
import { useAuth } from "@/features/auth";
import { useLocale, type MessageKey } from "@/i18n";
import { formatTaka } from "@/lib/format";
import { formatShiftClock, shiftStore } from "@/lib/shiftStore";
import {
  useConnectivity,
  type ConnectivityBadgeState,
} from "@/features/shell";

export type CounterReadyScreenProps = {
  onNewSale: () => void;
  /**
   * Bumps when Shift open/close changes (Batch AL) so Active Shift re-reads
   * localStorage without a full remount.
   */
  shiftEpoch?: number;
};

/** Stub today totals until sales API wiring is authorized. */
const TODAY_TXNS_STUB = 42;
const TODAY_AMOUNT_STUB = 1240.5;

/**
 * Idle Counter Ready center (Batch F + AL Active Shift).
 * Content only — chrome stays Search Results - Napa (no PharmaPOS Pro / purple shell).
 */
export function CounterReadyScreen({
  onNewSale,
  shiftEpoch = 0,
}: CounterReadyScreenProps) {
  const { badgeState, pendingCount } = useConnectivity();
  const { user } = useAuth();
  const { t } = useLocale();
  const sync = localSyncVisual(badgeState);
  const syncLabel = localSyncLabel(badgeState, pendingCount, t);

  // shiftEpoch forces re-read after Shift panel mutates localStorage.
  void shiftEpoch;
  const activeShift =
    user?.tenantId != null
      ? shiftStore.get(user.tenantId, user.storeId ?? null)
      : null;
  const activeShiftValue = activeShift
    ? t("counter.shiftOpenSince").replace(
        "{time}",
        formatShiftClock(activeShift.openedAt),
      )
    : t("counter.noActiveShift");

  return (
    <div className="flex h-full min-h-[20rem] flex-col items-center justify-center px-6 py-10">
      <div className="flex w-full max-w-3xl flex-col items-center text-center">
        <Store
          className="size-16 text-border"
          strokeWidth={1.25}
          aria-hidden
        />
        <h1 className="mt-5 text-2xl font-bold tracking-tight text-foreground">
          {t("counter.readyTitle")}
        </h1>
        <p className="mt-2 text-sm text-muted">{t("counter.readySubtitle")}</p>

        <button
          type="button"
          onClick={onNewSale}
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <Plus className="size-4" strokeWidth={2.25} aria-hidden />
          {t("sidebar.newSale")} [F2]
        </button>

        <div className="mt-10 grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
          <SummaryCard
            label={t("counter.activeShift")}
            icon={
              <CalendarDays
                className="size-4 text-muted"
                strokeWidth={1.75}
                aria-hidden
              />
            }
            value={activeShiftValue}
          />
          <SummaryCard
            label={t("counter.todaysSales")}
            icon={
              <BarChart3
                className="size-4 text-muted"
                strokeWidth={1.75}
                aria-hidden
              />
            }
            value={`${TODAY_TXNS_STUB} ${t("counter.txns")} | ${formatTaka(TODAY_AMOUNT_STUB)}`}
          />
          <SummaryCard
            label={t("counter.localSync")}
            icon={sync.icon}
            value={syncLabel}
          />
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  icon,
  value,
}: {
  label: string;
  icon: ReactNode;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3 text-left shadow-sm">
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
          {label}
        </p>
      </div>
      <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

/** Pure visual chrome for Local Sync card — labels composed at call site. */
function localSyncVisual(
  badgeState: ConnectivityBadgeState,
): { icon: ReactNode } {
  switch (badgeState) {
    case "checking":
      return {
        icon: (
          <Cloud
            className="size-4 animate-pulse text-muted"
            strokeWidth={1.75}
            aria-hidden
          />
        ),
      };
    case "online_synced":
      return {
        icon: (
          <Cloud className="size-4 text-connected" strokeWidth={1.75} aria-hidden />
        ),
      };
    case "online_syncing":
      return {
        icon: (
          <CloudUpload
            className="size-4 animate-pulse text-connected"
            strokeWidth={1.75}
            aria-hidden
          />
        ),
      };
    case "online_pending":
      return {
        icon: (
          <CloudUpload
            className="size-4 text-pending"
            strokeWidth={1.75}
            aria-hidden
          />
        ),
      };
    case "offline":
      return {
        icon: (
          <CloudOff className="size-4 text-offline" strokeWidth={1.75} aria-hidden />
        ),
      };
    case "error":
      return {
        icon: (
          <CloudOff
            className="size-4 text-destructive"
            strokeWidth={1.75}
            aria-hidden
          />
        ),
      };
  }
}

function localSyncLabel(
  badgeState: ConnectivityBadgeState,
  pendingCount: number,
  t: (key: MessageKey) => string,
): string {
  switch (badgeState) {
    case "checking":
      return `${t("connectivity.checking")}…`;
    case "online_synced":
      return t("counter.allDataSynchronized");
    case "online_syncing":
      return `${t("connectivity.syncing")}…`;
    case "online_pending":
      return `${Math.max(0, Math.trunc(pendingCount))} ${t("connectivity.pending")}`;
    case "offline":
      return t("connectivity.queuedLocally");
    case "error":
      return t("counter.syncError");
  }
}
