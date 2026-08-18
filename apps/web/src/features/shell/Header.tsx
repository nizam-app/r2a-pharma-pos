import { Bell, ChevronDown, MapPin, Menu, Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { displayNameFromUser, initialsFromUser, useAuth } from "@/features/auth";
import { LocaleToggle, useLocale } from "@/i18n";
import { ownerPathTitleKey } from "@/lib/ownerPath";
import { useOwnerPath } from "@/lib/OwnerPathProvider";
import { useTenantChrome } from "@/lib/TenantContextProvider";

/**
 * Admin Portal header — breadcrumb, disabled store control, chrome-only
 * bell/search, locale, avatar + logout. No KPI widgets.
 */
export function Header({ onOpenNavigation }: { onOpenNavigation?: () => void }) {
  const { t } = useLocale();
  const { user, logout } = useAuth();
  const { path } = useOwnerPath();
  const { storeName } = useTenantChrome();
  const menuId = useId();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const title = t(ownerPathTitleKey(path));
  const storeLabel = storeName?.trim() || t("header.storeUnavailable");
  const initials = user ? initialsFromUser(user) : "?";
  const displayName = user ? displayNameFromUser(user) : "";

  useEffect(() => {
    if (!menuOpen) return;
    function onDocMouseDown(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-surface px-3 py-2.5 sm:gap-3 sm:px-5">
      <nav aria-label={t("header.breadcrumb")} className="flex min-w-0 items-center gap-2">
        {onOpenNavigation ? (
          <button
            type="button"
            aria-label={t("nav.openMenu")}
            className="rounded-md p-2 text-muted hover:bg-canvas hover:text-foreground md:hidden"
            onClick={onOpenNavigation}
          >
            <Menu className="size-4" />
          </button>
        ) : null}
        <p className="truncate text-sm text-muted">{title}</p>
      </nav>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled
          aria-disabled="true"
          title={t("header.storeLocked")}
          className="hidden max-w-[14rem] cursor-not-allowed items-center gap-1.5 rounded-md border border-border bg-canvas px-2.5 py-1.5 text-sm text-foreground lg:inline-flex"
        >
          <MapPin className="size-3.5 shrink-0 text-muted" strokeWidth={1.75} />
          <span className="truncate">{storeLabel}</span>
          <ChevronDown
            className="size-3.5 shrink-0 text-muted"
            strokeWidth={1.75}
          />
        </button>

        <button
          type="button"
          aria-label={t("header.notifications")}
          title={t("header.notificationsSoon")}
          className="hidden rounded-md p-2 text-muted hover:bg-canvas hover:text-foreground sm:block"
        >
          <Bell className="size-4" strokeWidth={1.75} />
        </button>

        <button
          type="button"
          aria-label={t("header.search")}
          title={t("header.searchSoon")}
          className="hidden rounded-md p-2 text-muted hover:bg-canvas hover:text-foreground sm:block"
        >
          <Search className="size-4" strokeWidth={1.75} />
        </button>

        <LocaleToggle />

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            aria-label={t("header.accountMenu")}
            title={displayName || t("header.accountMenu")}
            onClick={() => setMenuOpen((v) => !v)}
            className="flex size-8 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary"
          >
            {initials}
          </button>
          {menuOpen ? (
            <div
              id={menuId}
              role="menu"
              className="absolute right-0 z-20 mt-1.5 min-w-[10rem] border border-border bg-surface py-1 shadow-sm"
            >
              {displayName ? (
                <p className="truncate px-3 py-1.5 text-xs text-muted">
                  {displayName}
                </p>
              ) : null}
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-1.5 text-left text-sm text-foreground hover:bg-canvas"
                onClick={() => {
                  setMenuOpen(false);
                  void logout();
                }}
              >
                {t("home.logout")}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
