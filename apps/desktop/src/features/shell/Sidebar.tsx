import {
  CircleHelp,
  Clock3,
  Headset,
  LayoutList,
  LogOut,
  Settings,
  ShoppingCart,
} from "lucide-react";
import { useLocale } from "@/i18n";
import { showComingSoon } from "./stubToast";

export type SidebarProps = {
  terminalLabel?: string;
  /** Numeric / id suffix after translated Terminal word, e.g. "01". */
  terminalNumber?: string;
  cashierDisplayName?: string;
  onLogout?: () => void;
  /** New Sale [F2] — Counter Ready → Empty POS (Batch F+). */
  onNewSale?: () => void;
  /** Open Transactions list (Batch AJ). */
  onOpenTransactions?: () => void;
  /** When true, Transactions is the active primary nav item. */
  transactionsOpen?: boolean;
  /** Open Settings — parent settings surface. */
  onOpenSettings?: () => void;
  /** When true, Settings is the active primary nav item. */
  settingsOpen?: boolean;
  /** Open Shift Open/Close (Batch AL). */
  onOpenShift?: () => void;
  /** When true, Shift is the active primary nav item. */
  shiftOpen?: boolean;
};

const navBtnClass =
  "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-white/70";
const navActiveClass =
  "flex w-full items-center gap-2.5 rounded-md bg-primary px-3 py-2 text-left text-sm font-medium text-primary-foreground shadow-sm";
const stubLinkClass =
  "flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-left text-sm text-muted transition-colors hover:bg-white/70 hover:text-foreground";

/**
 * Light-grey sidebar locked to Search Results - Napa (never dark slate).
 * New Sale is active by default; Transactions / Shift / Settings take active while open.
 */
export function Sidebar({
  terminalNumber = "01",
  cashierDisplayName = "—",
  onLogout,
  onNewSale,
  onOpenTransactions,
  transactionsOpen = false,
  onOpenSettings,
  settingsOpen = false,
  onOpenShift,
  shiftOpen = false,
}: SidebarProps) {
  const { t } = useLocale();
  const newSaleActive = !settingsOpen && !transactionsOpen && !shiftOpen;

  return (
    <aside
      className="flex shrink-0 flex-col border-r border-border bg-shell"
      style={{ width: "var(--r2a-sidebar-width)" }}
    >
      <div className="border-b border-border px-4 py-3">
        <p className="text-sm font-semibold text-foreground">
          {t("sidebar.terminal")} {terminalNumber}
        </p>
        <p className="mt-0.5 text-xs text-muted">
          {t("sidebar.cashier")}: {cashierDisplayName}
        </p>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-2" aria-label={t("sidebar.primaryNav")}>
        <button
          type="button"
          className={newSaleActive ? navActiveClass : navBtnClass}
          aria-current={newSaleActive ? "page" : undefined}
          onClick={() => onNewSale?.()}
        >
          <ShoppingCart className="size-4 shrink-0" strokeWidth={1.75} />
          {t("sidebar.newSale")} [F2]
        </button>
        <button
          type="button"
          className={transactionsOpen ? navActiveClass : navBtnClass}
          aria-current={transactionsOpen ? "page" : undefined}
          onClick={() => {
            if (onOpenTransactions) onOpenTransactions();
            else
              showComingSoon(
                t("stub.comingSoon").replace(
                  "{feature}",
                  t("sidebar.transactions"),
                ),
              );
          }}
        >
          <LayoutList className="size-4 shrink-0" strokeWidth={1.75} />
          {t("sidebar.transactions")}
        </button>
        <button
          type="button"
          className={shiftOpen ? navActiveClass : navBtnClass}
          aria-current={shiftOpen ? "page" : undefined}
          onClick={() => {
            if (onOpenShift) onOpenShift();
            else
              showComingSoon(
                t("stub.comingSoon").replace("{feature}", t("sidebar.shift")),
              );
          }}
        >
          <Clock3 className="size-4 shrink-0" strokeWidth={1.75} />
          {t("sidebar.shift")}
        </button>
        <button
          type="button"
          className={settingsOpen ? navActiveClass : navBtnClass}
          aria-current={settingsOpen ? "page" : undefined}
          onClick={() => {
            if (onOpenSettings) onOpenSettings();
            else
              showComingSoon(
                t("stub.comingSoon").replace(
                  "{feature}",
                  t("sidebar.settings"),
                ),
              );
          }}
        >
          <Settings className="size-4 shrink-0" strokeWidth={1.75} />
          {t("sidebar.settings")}
        </button>
      </nav>

      <div className="mt-auto space-y-0.5 border-t border-border p-2">
        <button
          type="button"
          className={stubLinkClass}
          onClick={() =>
            showComingSoon(
              t("stub.comingSoon").replace("{feature}", t("sidebar.support")),
            )
          }
        >
          <Headset className="size-4 shrink-0" strokeWidth={1.75} />
          {t("sidebar.support")}
        </button>
        <button
          type="button"
          className={stubLinkClass}
          onClick={() =>
            showComingSoon(
              t("stub.comingSoon").replace("{feature}", t("sidebar.help")),
            )
          }
        >
          <CircleHelp className="size-4 shrink-0" strokeWidth={1.75} />
          {t("sidebar.help")}
        </button>
        <button
          type="button"
          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-medium text-destructive transition-colors hover:bg-white/70"
          onClick={() => {
            if (onLogout) onLogout();
            else
              showComingSoon(
                t("stub.comingSoon").replace(
                  "{feature}",
                  t("sidebar.logout"),
                ),
              );
          }}
        >
          <LogOut className="size-4 shrink-0" strokeWidth={1.75} />
          {t("sidebar.logout")}
        </button>
      </div>
    </aside>
  );
}
