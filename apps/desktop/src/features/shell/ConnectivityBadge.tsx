import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useLocale, type MessageKey } from "@/i18n";
import { useConnectivity } from "./ConnectivityProvider";
import {
  badgeVisual,
  formatPendingCount,
  type ConnectivityBadgeState,
} from "./connectivityTypes";

function pendingSuffix(
  pendingCount: number,
  t: (key: MessageKey) => string,
): string {
  if (pendingCount <= 0) return "";
  return ` · ${formatPendingCount(pendingCount)} ${t("connectivity.pending")}`;
}

function badgeLabel(
  state: ConnectivityBadgeState,
  pendingCount: number,
  forcedOffline: boolean,
  t: (key: MessageKey) => string,
): string {
  if (forcedOffline && state === "offline") {
    return `${t("connectivity.offline")} · ${t("connectivity.forced")}${pendingSuffix(pendingCount, t)}`;
  }
  switch (state) {
    case "checking":
      return `${t("connectivity.checking")}${pendingSuffix(pendingCount, t)}`;
    case "online_synced":
      return `${t("connectivity.connected")} · ${t("connectivity.synced")}`;
    case "online_syncing":
      return `${t("connectivity.connected")} · ${t("connectivity.syncing")}…`;
    case "online_pending":
      return `${t("connectivity.connected")} · ${formatPendingCount(pendingCount)} ${t("connectivity.pending")}`;
    case "offline":
      return pendingCount > 0
        ? `${t("connectivity.offline")}${pendingSuffix(pendingCount, t)}`
        : `${t("connectivity.offline")} · ${t("connectivity.queuedLocally")}`;
    case "error":
      return t("connectivity.connectionError");
  }
}

function badgeTitle(
  state: ConnectivityBadgeState,
  forcedOffline: boolean,
  t: (key: MessageKey) => string,
): string {
  if (forcedOffline) {
    return t("connectivity.titleForcedOffline");
  }
  switch (state) {
    case "checking":
      return t("connectivity.titleChecking");
    case "online_synced":
      return t("connectivity.titleOnlineSynced");
    case "online_syncing":
      return t("connectivity.titleOnlineSyncing");
    case "online_pending":
      return t("connectivity.titleOnlinePending");
    case "offline":
      return t("connectivity.titleOffline");
    case "error":
      return t("connectivity.titleError");
  }
}

/**
 * Header connectivity pill + Force Offline / Go Online menu (Batch AI).
 * Click / Enter opens menu; Esc closes. No Tab nav.
 */
export function ConnectivityBadge() {
  const {
    badgeState,
    pendingCount,
    forcedOffline,
    forceOffline,
    goOnline,
  } = useConnectivity();
  const { t } = useLocale();
  const visual = badgeVisual(badgeState, pendingCount);
  const label = badgeLabel(badgeState, pendingCount, forcedOffline, t);
  const title = badgeTitle(badgeState, forcedOffline, t);
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!menuOpen) return;
    actionRef.current?.focus();
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      const el = rootRef.current;
      if (el && !el.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [menuOpen]);

  const closeMenu = () => {
    setMenuOpen(false);
    triggerRef.current?.focus();
  };

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" || event.key === "ArrowDown") {
      event.preventDefault();
      setMenuOpen(true);
      return;
    }
    if (event.key === "Escape" && menuOpen) {
      event.preventDefault();
      closeMenu();
    }
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeMenu();
      return;
    }
    if (event.key === "Enter" && document.activeElement === actionRef.current) {
      event.preventDefault();
      event.stopPropagation();
      void runPrimaryAction();
    }
  };

  const runPrimaryAction = async () => {
    if (forcedOffline) {
      setMenuOpen(false);
      await goOnline();
      triggerRef.current?.focus();
      return;
    }
    forceOffline();
    setMenuOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${visual.pillClassName}`}
        title={title}
        data-connectivity={badgeState}
        data-forced-offline={forcedOffline ? "true" : "false"}
        aria-live="polite"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-controls={menuOpen ? menuId : undefined}
        onClick={() => setMenuOpen((open) => !open)}
        onKeyDown={onTriggerKeyDown}
      >
        <span
          className={`inline-block size-2 shrink-0 rounded-full ${visual.dotClassName}`}
          aria-hidden
        />
        <span>{label}</span>
      </button>

      {menuOpen ? (
        <div
          id={menuId}
          role="menu"
          aria-label={t("connectivity.menuLabel")}
          className="absolute right-0 z-50 mt-1.5 min-w-[14rem] rounded-md border border-border bg-surface py-1 shadow-md"
          onKeyDown={onMenuKeyDown}
        >
          <p className="border-b border-border px-3 py-2 text-[11px] leading-snug text-muted">
            {forcedOffline
              ? t("connectivity.menuForcedHint")
              : t("connectivity.menuOnlineHint")}
          </p>
          <button
            ref={actionRef}
            type="button"
            role="menuitem"
            className="flex w-full px-3 py-2.5 text-left text-sm font-medium text-foreground hover:bg-shell focus-visible:bg-shell focus-visible:outline-none"
            onClick={() => {
              void runPrimaryAction();
            }}
          >
            {forcedOffline
              ? t("connectivity.goOnline")
              : t("connectivity.forceOffline")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
