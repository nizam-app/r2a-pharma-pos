/**
 * Boots local SQLite (or memory fallback), wires pending count to the badge,
 * pulls catalog cache while online, and starts the M4 Batch D 15s flush worker.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/features/auth";
import { useLocale } from "@/i18n";
import { pullCatalogCache } from "@/lib/localDb/catalogPull";
import {
  countSyncDead,
  countUnsynced,
  ensureLocalDb,
  getLocalDbKind,
  getLocalDbPath,
  listSyncPending,
  markSyncDead,
} from "@/lib/localDb";
import { QA_SYNC_CONFLICT_LAST_ERROR } from "@/lib/syncConflict";
import {
  SYNC_FLUSH_INTERVAL_MS,
  bindFlushNowHelper,
  flushSyncQueue,
  shouldPauseSyncWorker,
} from "@/lib/syncWorker";
import { useConnectivity } from "./ConnectivityProvider";
import { PosToast } from "./PosToast";

type LocalDbContextValue = {
  ready: boolean;
  kind: "tauri" | "memory" | null;
  dbPath: string | null;
  lastPullAt: string | null;
  lastPullError: string | null;
  /** Last outbound flush tick that ran (ISO). Null until the first tick. */
  lastFlushAt: string | null;
  /** Dead-letter rows (`dead = 1`). */
  deadCount: number;
  refreshPendingCount: () => Promise<number>;
  refreshQueueStats: () => Promise<void>;
  pullCacheNow: () => Promise<boolean>;
};

const LocalDbContext = createContext<LocalDbContextValue | null>(null);

export function LocalDbProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const { t } = useLocale();
  const {
    mode,
    isOnline,
    forcedOffline,
    pendingCount,
    setPendingCount,
    setFlushSyncing,
    setSyncError,
  } = useConnectivity();
  const pendingCountRef = useRef(pendingCount);
  pendingCountRef.current = pendingCount;
  const [ready, setReady] = useState(false);
  const [kind, setKind] = useState<"tauri" | "memory" | null>(null);
  const [dbPath, setDbPath] = useState<string | null>(null);
  const [lastPullAt, setLastPullAt] = useState<string | null>(null);
  const [lastPullError, setLastPullError] = useState<string | null>(null);
  const [lastFlushAt, setLastFlushAt] = useState<string | null>(null);
  const [deadCount, setDeadCount] = useState(0);
  const pullInFlight = useRef<Promise<boolean> | null>(null);
  const pullQueued = useRef(false);
  const pulledThisOnlineSession = useRef(false);
  const [truncToast, setTruncToast] = useState<string | null>(null);

  const refreshPendingCount = useCallback(async () => {
    try {
      const n = await countUnsynced();
      setPendingCount(n);
      return n;
    } catch {
      return 0;
    }
  }, [setPendingCount]);

  const refreshQueueStats = useCallback(async () => {
    try {
      const dead = await countSyncDead();
      setDeadCount(dead);
      await refreshPendingCount();
    } catch {
      /* keep last known counts */
    }
  }, [refreshPendingCount]);

  const pullCacheNow = useCallback(async () => {
    if (pullInFlight.current) {
      pullQueued.current = true;
      return await pullInFlight.current;
    }

    const run = async () => {
      let lastPullSucceeded = false;
      do {
        pullQueued.current = false;
        try {
          const result = await pullCatalogCache();
          setLastPullAt(new Date().toISOString());
          setLastPullError(null);
          pulledThisOnlineSession.current = true;
          if (result.truncated) {
            setTruncToast(t("catalog.truncated"));
          }
          lastPullSucceeded = true;
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Catalog pull failed";
          setLastPullError(msg);
          lastPullSucceeded = false;
        }
      } while (pullQueued.current);
      return lastPullSucceeded;
    };

    const pending = run();
    pullInFlight.current = pending;
    try {
      return await pending;
    } finally {
      if (pullInFlight.current === pending) {
        pullInFlight.current = null;
      }
    }
  }, [t]);

  // Open / migrate when authenticated.
  useEffect(() => {
    if (status !== "authenticated") {
      setReady(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        await ensureLocalDb();
        if (cancelled) return;
        setKind(await getLocalDbKind());
        setDbPath(await getLocalDbPath());
        setReady(true);
        await refreshPendingCount();
        try {
          setDeadCount(await countSyncDead());
        } catch {
          setDeadCount(0);
        }
      } catch (err) {
        console.error("[localDb] init failed", err);
        if (!cancelled) setReady(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, refreshPendingCount]);

  // Pull catalog once per online stretch after DB is ready.
  useEffect(() => {
    if (!ready || status !== "authenticated") return;
    if (mode === "checking") return;
    if (!isOnline) {
      pulledThisOnlineSession.current = false;
      return;
    }
    if (pulledThisOnlineSession.current) return;
    void pullCacheNow();
  }, [ready, status, mode, isOnline, pullCacheNow]);

  // M4 Batch D — 15s FIFO flush. Pause while Force Offline or mode !== online.
  useEffect(() => {
    if (!ready || status !== "authenticated") return;

    let cancelled = false;
    let inFlight = false;

    const runTick = async () => {
      if (cancelled) return;
      if (shouldPauseSyncWorker({ forcedOffline, mode })) return;
      if (inFlight) return;
      inFlight = true;
      let posted = false;
      if (pendingCountRef.current > 0) {
        posted = true;
        setFlushSyncing(true);
      }
      try {
        const result = await flushSyncQueue({
          onWillPost: () => {
            posted = true;
            setFlushSyncing(true);
          },
        });
        if (cancelled) return;
        setLastFlushAt(new Date().toISOString());
        setPendingCount(result.pendingCount);
        setDeadCount(result.deadCount);
        setSyncError(result.deadCount > 0 || result.lastTickFailed);
        if (
          result.accepted + result.duplicate > 0 &&
          result.pendingCount === 0
        ) {
          void pullCacheNow();
        }
      } catch {
        if (!cancelled) setSyncError(true);
      } finally {
        inFlight = false;
        if (posted) setFlushSyncing(false);
      }
    };

    const unbindFlush = bindFlushNowHelper(runTick);
    const markHeadDead = async (lastError?: string) => {
      const pending = await listSyncPending(1);
      const head = pending[0];
      if (!head) return null;
      await markSyncDead(
        head.id,
        lastError?.trim() || QA_SYNC_CONFLICT_LAST_ERROR,
      );
      await refreshQueueStats();
      return head.id;
    };
    if (typeof window !== "undefined") {
      window.__r2aMarkHeadSyncDead = markHeadDead;
    }

    if (shouldPauseSyncWorker({ forcedOffline, mode })) {
      setFlushSyncing(false);
      return () => {
        cancelled = true;
        unbindFlush();
        if (window.__r2aMarkHeadSyncDead === markHeadDead) {
          delete window.__r2aMarkHeadSyncDead;
        }
      };
    }

    void runTick();
    const id = window.setInterval(() => {
      void runTick();
    }, SYNC_FLUSH_INTERVAL_MS);

    const onOnline = () => {
      if (shouldPauseSyncWorker({ forcedOffline, mode })) return;
      void runTick();
    };
    window.addEventListener("online", onOnline);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener("online", onOnline);
      unbindFlush();
      if (window.__r2aMarkHeadSyncDead === markHeadDead) {
        delete window.__r2aMarkHeadSyncDead;
      }
      setFlushSyncing(false);
    };
  }, [
    ready,
    status,
    mode,
    forcedOffline,
    setPendingCount,
    setFlushSyncing,
    setSyncError,
    pullCacheNow,
    refreshQueueStats,
  ]);

  const value = useMemo<LocalDbContextValue>(
    () => ({
      ready,
      kind,
      dbPath,
      lastPullAt,
      lastPullError,
      lastFlushAt,
      deadCount,
      refreshPendingCount,
      refreshQueueStats,
      pullCacheNow,
    }),
    [
      ready,
      kind,
      dbPath,
      lastPullAt,
      lastPullError,
      lastFlushAt,
      deadCount,
      refreshPendingCount,
      refreshQueueStats,
      pullCacheNow,
    ],
  );

  return (
    <LocalDbContext.Provider value={value}>
      {children}
      {truncToast ? (
        <PosToast
          message={truncToast}
          tone="info"
          onDismiss={() => setTruncToast(null)}
        />
      ) : null}
    </LocalDbContext.Provider>
  );
}

export function useLocalDb(): LocalDbContextValue {
  const ctx = useContext(LocalDbContext);
  if (!ctx) {
    throw new Error("useLocalDb must be used within LocalDbProvider");
  }
  return ctx;
}
