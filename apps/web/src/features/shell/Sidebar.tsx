import { useLocale } from "@/i18n";
import { useOwnerPath } from "@/lib/OwnerPathProvider";
import { X } from "lucide-react";
import { FOOTER_NAV, PRIMARY_NAV, type NavItem } from "./nav";

function NavButton({
  item,
  active,
  onLiveClick,
}: {
  item: NavItem;
  active: boolean;
  onLiveClick: () => void;
}) {
  const { t } = useLocale();
  const Icon = item.icon;
  const label = t(item.labelKey);

  if (!item.live) {
    return (
      <button
        type="button"
        disabled
        aria-disabled="true"
        title={t("nav.laterHint")}
        className="flex w-full cursor-not-allowed items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-medium text-muted/80"
      >
        <Icon className="size-4 shrink-0" strokeWidth={1.75} />
        <span>{label}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      onClick={onLiveClick}
      className={
        active
          ? "relative flex w-full items-center gap-2.5 rounded-md bg-primary/10 px-3 py-2 text-left text-sm font-semibold text-primary before:absolute before:inset-y-1 before:left-0 before:w-[3px] before:rounded-r before:bg-primary"
          : "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-medium text-foreground/80 transition-colors hover:bg-white/80 hover:text-foreground"
      }
    >
      <Icon className="size-4 shrink-0" strokeWidth={1.75} />
      <span>{label}</span>
    </button>
  );
}

/**
 * Admin Portal sidebar — Dashboard chrome lock (light grey, teal active).
 * Later nav is visible and disabled. Do not restyle per later mocks.
 */
export function Sidebar({
  className = "",
  onClose,
}: {
  className?: string;
  onClose?: () => void;
}) {
  const { t } = useLocale();
  const { path, navigate } = useOwnerPath();

  return (
    <aside
      className={`flex shrink-0 flex-col border-r border-border bg-shell ${className}`}
      style={{ width: "min(var(--r2a-sidebar-width), 85vw)" }}
    >
      <div className="flex items-center gap-2.5 border-b border-border px-3 py-3.5">
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground"
          aria-hidden
        >
          P
        </span>
        <p className="text-sm font-semibold leading-tight text-foreground">
          {t("brand.name")}
        </p>
        {onClose ? (
          <button
            type="button"
            aria-label={t("nav.closeMenu")}
            className="ml-auto rounded-md p-1.5 text-muted hover:bg-white hover:text-foreground"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      <nav
        className="flex flex-1 flex-col gap-0.5 p-2"
        aria-label={t("nav.primary")}
      >
        {PRIMARY_NAV.map((item) => (
          <NavButton
            key={item.id}
            item={item}
            active={item.live && item.path === path}
            onLiveClick={() => {
              if (item.live && item.path) {
                navigate(item.path);
                onClose?.();
              }
            }}
          />
        ))}
      </nav>

      <nav
        className="flex flex-col gap-0.5 border-t border-border p-2"
        aria-label={t("nav.account")}
      >
        {FOOTER_NAV.map((item) => (
          <NavButton
            key={item.id}
            item={item}
            active={false}
            onLiveClick={() => undefined}
          />
        ))}
      </nav>
    </aside>
  );
}
