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
import { forceOfflineStore } from "@/lib/forceOfflineStore";
import { probeHealth } from "@/lib/healthProbe";
import {
  deriveBadgeState,
  type ConnectivityBadgeState,
  type ConnectivityMode,
} from "./connectivityTypes";

/** Poll interval for online/offline heartbeat (Slice 1). */
export const CONNECTIVITY_POLL_MS = 5_000;

type ConnectivityContextValue = {
  /** Coarse mode for later batches: checking | online API | offline/local. */
  mode: ConnectivityMode;
  /** Derived header badge state. */
  badgeState: ConnectivityBadgeState;
  /** Unsynced outbound_sync_queue rows (Batch E). */
  pendingCount: number;
  /** True while a health re-probe or queue flush tick is in flight. */
  syncing: boolean;
  /** Dead-letter present or last flush tick failed (M4 Batch D). */
  syncError: boolean;
  /**
   * Terminal Force Offline override (Batch AI).
   * Sticky until Go Online; ignores health while true.
   */
  forcedOffline: boolean;
  isOnline: boolean;
  /** True only after a failed probe or while forced — not while checking. */
  isOffline: boolean;
  /** Force an immediate health re-probe (header sync icon). No-op while forced. */
  reprobe: () => Promise<void>;
  /** Stay Offline — ignore probes until Go Online. */
  forceOffline: () => void;
  /** Clear Force Offline override and re-probe cloud health. */
  goOnline: () => Promise<void>;
  /** LocalDbProvider refreshes this from count_unsynced. */
  setPendingCount: (count: number) => void;
  /** Queue flush worker (Batch D) — Syncing… during a POST tick. */
  setFlushSyncing: (syncing: boolean) => void;
  /** Queue flush worker — error when dead > 0 or last tick failed. */
  setSyncError: (error: boolean) => void;
  /** Clear sync-error presentation after a successful flush. */
  clearSyncError: () => void;
};

const ConnectivityContext = createContext<ConnectivityContextValue | null>(
  null,
);

export function ConnectivityProvider({ children }: { children: ReactNode }) {
  const [forcedOffline, setForcedOffline] = useState(() =>
    forceOfflineStore.get(),
  );
  const [mode, setMode] = useState<ConnectivityMode>(() =>
    forceOfflineStore.get() ? "offline" : "checking",
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [probeSyncing, setProbeSyncing] = useState(false);
  const [flushSyncing, setFlushSyncing] = useState(false);
  const [syncError, setSyncError] = useState(false);
  const syncing = probeSyncing || flushSyncing;
  /** Generation token — Strict Mode remount must not leave a stuck in-flight gate. */
  const probeGen = useRef(0);
  const forcedRef = useRef(forcedOffline);
  forcedRef.current = forcedOffline;

  const runProbe = useCallback(async (opts?: { showSyncing?: boolean }) => {
    if (forcedRef.current) {
      setMode("offline");
      if (opts?.showSyncing) setProbeSyncing(false);
      return;
    }
    const gen = ++probeGen.current;
    if (opts?.showSyncing) setProbeSyncing(true);

    try {
      const ok = await probeHealth();
      if (gen !== probeGen.current || forcedRef.current) {
        if (forcedRef.current) setMode("offline");
        return;
      }
      setMode(ok ? "online" : "offline");
    } finally {
      // Always clear probe Syncing… for this caller — even if probeGen was
      // superseded (e.g. effect remount). Leaving it gated on gen caused
      // sticky "Connected · Syncing…" after Go Online.
      if (opts?.showSyncing) setProbeSyncing(false);
    }
  }, []);

  useEffect(() => {
    if (forcedOffline) {
      setMode("offline");
      setProbeSyncing(false);
      // Invalidate any in-flight auto-probe so a late success cannot flip online.
      probeGen.current += 1;
      return;
    }

    const abort = new AbortController();
    let cancelled = false;

    async function tick(opts?: { clearSyncing?: boolean }) {
      if (cancelled || abort.signal.aborted || forcedRef.current) {
        if (opts?.clearSyncing) setProbeSyncing(false);
        return;
      }
      const gen = ++probeGen.current;
      try {
        const ok = await probeHealth(4_000, abort.signal);
        if (
          cancelled ||
          abort.signal.aborted ||
          gen !== probeGen.current ||
          forcedRef.current
        ) {
          if (forcedRef.current) setMode("offline");
          return;
        }
        setMode(ok ? "online" : "offline");
      } finally {
        // Clear Go Online probe Syncing… once the restarted poll settles.
        if (opts?.clearSyncing) setProbeSyncing(false);
      }
    }

    setMode("checking");
    void tick({ clearSyncing: true });
    const id = window.setInterval(() => {
      void tick();
    }, CONNECTIVITY_POLL_MS);

    const onOnline = () => {
      if (forcedRef.current) return;
      void tick();
    };
    const onOffline = () => {
      if (!cancelled) setMode("offline");
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      cancelled = true;
      abort.abort();
      // Invalidate in-flight results from the discarded Strict Mode pass.
      probeGen.current += 1;
      setProbeSyncing(false);
      window.clearInterval(id);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [forcedOffline]);

  const forceOffline = useCallback(() => {
    forceOfflineStore.set(true);
    forcedRef.current = true;
    setForcedOffline(true);
    setMode("offline");
    setProbeSyncing(false);
    probeGen.current += 1;
  }, []);

  const goOnline = useCallback(async () => {
    forceOfflineStore.set(false);
    forcedRef.current = false;
    setMode("checking");
    setProbeSyncing(true);
    setForcedOffline(false);
    // Effect owns the re-probe after un-force. Do not also runProbe here —
    // that raced probeGen and left Syncing… stuck until reload.
  }, []);

  const reprobe = useCallback(async () => {
    // Forced Stay Offline: header refresh must not clear the override.
    if (forcedRef.current) return;
    await runProbe({ showSyncing: true });
  }, [runProbe]);

  const clearSyncError = useCallback(() => {
    setSyncError(false);
  }, []);

  const badgeState = useMemo(
    () =>
      deriveBadgeState({
        mode,
        pendingCount,
        syncing,
        syncError,
      }),
    [mode, pendingCount, syncing, syncError],
  );

  const value = useMemo<ConnectivityContextValue>(
    () => ({
      mode,
      badgeState,
      pendingCount,
      syncing,
      syncError,
      forcedOffline,
      isOnline: mode === "online",
      isOffline: mode === "offline",
      reprobe,
      forceOffline,
      goOnline,
      setPendingCount,
      setFlushSyncing,
      setSyncError,
      clearSyncError,
    }),
    [
      mode,
      badgeState,
      pendingCount,
      syncing,
      syncError,
      forcedOffline,
      reprobe,
      forceOffline,
      goOnline,
      clearSyncError,
    ],
  );

  return (
    <ConnectivityContext.Provider value={value}>
      {children}
    </ConnectivityContext.Provider>
  );
}

export function useConnectivity(): ConnectivityContextValue {
  const ctx = useContext(ConnectivityContext);
  if (!ctx) {
    throw new Error("useConnectivity must be used within ConnectivityProvider");
  }
  return ctx;
}
