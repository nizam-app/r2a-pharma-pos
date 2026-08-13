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
import { pullCatalogCache } from "@/lib/localDb/catalogPull";
import {
  countUnsynced,
  ensureLocalDb,
  getLocalDbKind,
  getLocalDbPath,
} from "@/lib/localDb";
import {
  SYNC_FLUSH_INTERVAL_MS,
  bindFlushNowHelper,
  flushSyncQueue,
  shouldPauseSyncWorker,
} from "@/lib/syncWorker";
import { useConnectivity } from "./ConnectivityProvider";

type LocalDbContextValue = {
  ready: boolean;
  kind: "tauri" | "memory" | null;
  dbPath: string | null;
  lastPullAt: string | null;
  lastPullError: string | null;
  refreshPendingCount: () => Promise<number>;
  pullCacheNow: () => Promise<void>;
};

const LocalDbContext = createContext<LocalDbContextValue | null>(null);

export function LocalDbProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
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
  const pullInFlight = useRef(false);
  const pulledThisOnlineSession = useRef(false);

  const refreshPendingCount = useCallback(async () => {
    try {
      const n = await countUnsynced();
      setPendingCount(n);
      return n;
    } catch {
      return 0;
    }
  }, [setPendingCount]);

  const pullCacheNow = useCallback(async () => {
    if (pullInFlight.current) return;
    pullInFlight.current = true;
    try {
      await pullCatalogCache();
      setLastPullAt(new Date().toISOString());
      setLastPullError(null);
      pulledThisOnlineSession.current = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Catalog pull failed";
      setLastPullError(msg);
    } finally {
      pullInFlight.current = false;
    }
  }, []);

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
        setPendingCount(result.pendingCount);
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

    const unbind = bindFlushNowHelper(runTick);

    if (shouldPauseSyncWorker({ forcedOffline, mode })) {
      setFlushSyncing(false);
      return () => {
        cancelled = true;
        unbind();
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
      unbind();
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
  ]);

  const value = useMemo<LocalDbContextValue>(
    () => ({
      ready,
      kind,
      dbPath,
      lastPullAt,
      lastPullError,
      refreshPendingCount,
      pullCacheNow,
    }),
    [
      ready,
      kind,
      dbPath,
      lastPullAt,
      lastPullError,
      refreshPendingCount,
      pullCacheNow,
    ],
  );

  return (
    <LocalDbContext.Provider value={value}>{children}</LocalDbContext.Provider>
  );
}

export function useLocalDb(): LocalDbContextValue {
  const ctx = useContext(LocalDbContext);
  if (!ctx) {
    throw new Error("useLocalDb must be used within LocalDbProvider");
  }
  return ctx;
}
