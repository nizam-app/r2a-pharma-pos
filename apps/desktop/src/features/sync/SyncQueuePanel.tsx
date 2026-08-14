import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { RefreshCw, X } from "lucide-react";
import { useConnectivity } from "@/features/shell/ConnectivityProvider";
import { useLocalDb } from "@/features/shell/LocalDbProvider";
import { useLocale } from "@/i18n";
import { formatTaka } from "@/lib/format";
import {
  listSyncQueue,
  retrySyncEvent,
  type SyncQueueRow,
} from "@/lib/localDb";
import { formatTxnLabel } from "@/lib/saleIngest";
import { isSyncConflictLastError } from "@/lib/syncConflict";

export type SyncQueuePanelProps = {
  onClose: () => void;
};

type RowStatus = "pending" | "syncing" | "failed";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** HH:MM · YYYY-MM-DD — Latin digits only. */
function formatQueueAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())} · ${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function payloadTotal(payload: Record<string, unknown>): number {
  const raw = payload.total;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function payloadEventId(row: SyncQueueRow): string {
  const raw = row.payload.eventId;
  return typeof raw === "string" && raw.trim() ? raw : row.id;
}

function rowStatus(row: SyncQueueRow, flushSyncing: boolean): RowStatus {
  if (row.dead === 1) return "failed";
  if (flushSyncing && row.synced === 0) return "syncing";
  return "pending";
}

/**
 * Sync Queue overlay (M4 Batch E invent).
 * Teal Napa chrome. Failed first, then pending by created_at.
 * ↑/↓ rows · Enter Retry on Failed · Esc close · no Tab · no sidebar route.
 */
export function SyncQueuePanel({ onClose }: SyncQueuePanelProps) {
  const { t } = useLocale();
  const { pendingCount, syncing } = useConnectivity();
  const { refreshPendingCount, refreshQueueStats } = useLocalDb();
  const titleId = useId();
  const listId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  const [rows, setRows] = useState<SyncQueueRow[]>([]);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [retryBusy, setRetryBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      const next = await listSyncQueue();
      setRows(next);
    } catch {
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void reload();
    const id = window.setInterval(() => {
      void reload();
    }, 1_500);
    return () => window.clearInterval(id);
  }, [reload, pendingCount, syncing]);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  useEffect(() => {
    if (rows.length === 0) {
      setFocusedIndex(0);
      return;
    }
    setFocusedIndex((i) => Math.min(Math.max(0, i), rows.length - 1));
  }, [rows.length]);

  const failedCount = rows.filter((r) => r.dead === 1).length;
  const pendingShown = rows.filter((r) => r.dead !== 1).length;
  const focused = rows[focusedIndex] ?? null;
  const focusedStatus = focused ? rowStatus(focused, syncing) : null;

  const moveFocus = useCallback(
    (delta: number) => {
      if (rows.length === 0) return;
      setFocusedIndex((i) => (i + delta + rows.length) % rows.length);
    },
    [rows.length],
  );

  const runRetry = useCallback(
    async (row: SyncQueueRow) => {
      if (row.dead !== 1 || retryBusy) return;
      setRetryBusy(true);
      try {
        await retrySyncEvent(row.id);
        await refreshPendingCount();
        await refreshQueueStats();
        await reload();
        const flush = window.__r2aFlushSyncNow;
        if (flush) await flush();
        await refreshPendingCount();
        await refreshQueueStats();
        await reload();
      } finally {
        setRetryBusy(false);
        queueMicrotask(() => panelRef.current?.focus());
      }
    },
    [refreshPendingCount, refreshQueueStats, reload, retryBusy],
  );

  const onKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (retryBusy) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      event.stopPropagation();
      moveFocus(1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      moveFocus(-1);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      if (focused && focused.dead === 1) {
        void runRetry(focused);
      }
    }
  };

  const statusLabel = (status: RowStatus) => {
    if (status === "failed") return t("syncQueue.statusFailed");
    if (status === "syncing") return t("syncQueue.statusSyncing");
    return t("syncQueue.statusPending");
  };

  const statusPillClass = (status: RowStatus) => {
    if (status === "failed") {
      return "border-destructive/30 bg-destructive/10 text-destructive";
    }
    if (status === "syncing") {
      return "border-primary/30 bg-primary/10 text-primary";
    }
    return "border-pending/40 bg-pending/10 text-foreground";
  };

  const footerCopy =
    rows.length === 0
      ? t("syncQueue.footerEmpty")
      : focusedStatus === "failed"
        ? t("syncQueue.footer")
        : t("syncQueue.footerPending");

  return (
    <div
      ref={panelRef}
      className="absolute inset-0 z-40 flex flex-col bg-surface"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-busy={retryBusy}
      tabIndex={-1}
      data-sync-queue-panel="true"
      onKeyDownCapture={onKeyDownCapture}
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <RefreshCw
            className="size-5 shrink-0 text-primary"
            strokeWidth={1.75}
            aria-hidden
          />
          <div className="min-w-0">
            <h2
              id={titleId}
              className="truncate text-sm font-semibold text-foreground"
            >
              {t("syncQueue.title")}
            </h2>
            <p className="truncate text-xs tabular-nums text-muted">
              {t("syncQueue.subtitle")
                .replaceAll("{pending}", String(pendingShown))
                .replaceAll("{failed}", String(failedCount))}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="inline-flex size-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-shell hover:text-foreground"
          aria-label={t("syncQueue.close")}
          onClick={onClose}
        >
          <X className="size-4" strokeWidth={1.75} aria-hidden />
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 border-b border-border bg-shell/60 px-4 py-2">
          <div className="grid grid-cols-[7.5rem_minmax(0,1.4fr)_5.5rem_minmax(6.5rem,auto)] gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
            <span>{t("syncQueue.colTime")}</span>
            <span>{t("syncQueue.colTxn")}</span>
            <span className="text-right">{t("syncQueue.colTotal")}</span>
            <span className="text-right">{t("syncQueue.colStatus")}</span>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-12 text-center">
            <RefreshCw
              className="size-12 text-border"
              strokeWidth={1.25}
              aria-hidden
            />
            <p className="text-sm font-medium text-foreground">
              {t("syncQueue.empty")}
            </p>
            <p className="max-w-sm text-xs text-muted">
              {t("syncQueue.emptyHint")}
            </p>
          </div>
        ) : (
          <ul
            id={listId}
            role="listbox"
            aria-label={t("syncQueue.listLabel")}
            className="min-h-0 flex-1 overflow-auto"
          >
            {rows.map((entry, index) => {
              const active = index === focusedIndex;
              const status = rowStatus(entry, syncing);
              const txn = formatTxnLabel(entry.id, payloadEventId(entry));
              const total = payloadTotal(entry.payload);
              const error = entry.lastError?.trim() || "";
              const conflict =
                status === "failed" && isSyncConflictLastError(error);
              return (
                <li key={entry.id}>
                  <div
                    role="option"
                    aria-selected={active}
                    className={[
                      "grid w-full grid-cols-[7.5rem_minmax(0,1.4fr)_5.5rem_minmax(6.5rem,auto)] items-center gap-2 border-b border-border px-4 py-2.5 text-sm",
                      active
                        ? "bg-primary/10 text-foreground"
                        : "hover:bg-shell/80",
                    ].join(" ")}
                    onMouseEnter={() => setFocusedIndex(index)}
                    onClick={() => setFocusedIndex(index)}
                  >
                    <span className="truncate font-mono text-xs text-muted">
                      {formatQueueAt(entry.createdAt)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">
                        {txn}
                      </p>
                      {conflict ? (
                        <p className="line-clamp-2 text-[11px] text-destructive">
                          {t("syncQueue.conflictReason")}
                        </p>
                      ) : null}
                      {status === "failed" && error ? (
                        <p
                          className={[
                            "truncate font-mono text-[11px]",
                            conflict ? "text-muted" : "text-destructive",
                          ].join(" ")}
                        >
                          {error}
                        </p>
                      ) : null}
                    </div>
                    <span className="truncate text-right font-semibold tabular-nums text-foreground">
                      {formatTaka(total)}
                    </span>
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      <span
                        className={[
                          "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          statusPillClass(status),
                        ].join(" ")}
                      >
                        {statusLabel(status)}
                      </span>
                      {status === "failed" ? (
                        <button
                          type="button"
                          disabled={retryBusy}
                          className={[
                            "rounded-md px-2.5 py-1 text-xs font-semibold",
                            active
                              ? "bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/40"
                              : "border border-primary/40 bg-surface text-primary hover:bg-primary/5",
                            retryBusy ? "cursor-not-allowed opacity-60" : "",
                          ].join(" ")}
                          onClick={(e) => {
                            e.stopPropagation();
                            setFocusedIndex(index);
                            void runRetry(entry);
                          }}
                        >
                          {t("syncQueue.retry")}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <footer className="shrink-0 border-t border-border bg-shell/40 px-4 py-2 text-[11px] text-muted">
        {footerCopy}
      </footer>
    </div>
  );
}
