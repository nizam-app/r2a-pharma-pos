import type { ReactNode } from "react";
import { useLocale } from "@/i18n";
import { HeldSalesPanel } from "@/features/hold";
import { SettingsPanel } from "@/features/settings";
import { ShiftPanel } from "@/features/shift";
import { SyncQueuePanel } from "@/features/sync";
import { TransactionsPanel } from "@/features/transactions";
import type { HeldSaleSnapshot } from "@/lib/heldSaleStore";
import type { SaleCustomer } from "@/lib/customerSearch";
import { CartPanel } from "./CartPanel";
import { Footer, type FooterStatus } from "./Footer";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

export type AppShellProps = {
  /** Center workspace — Counter Ready / POS content in later batches. */
  main?: ReactNode;
  /** Cart body outlet (lines / empty state) — later POS batches. */
  cartBody?: ReactNode;
  cartItemCount?: number;
  /** Sum of cart line totals (Batch K). */
  cartSubtotal?: number;
  /** Loyalty redeem discount (Batch S). */
  loyaltyDiscount?: number;
  /** Clear Active Cart lines (stay on New Sale). */
  onClearSale?: () => void;
  /** Attached sale customer (Batch R); null = walk-in. */
  saleCustomer?: SaleCustomer | null;
  /** Open Select Customer modal (F8). */
  onSelectCustomer?: () => void;
  /** Proceed / F10 — loyalty redeem or Payment Select Method (Batch V). */
  onProceed?: () => void;
  /** Hold / park active cart (Batch AN · F6). */
  onHold?: () => void;
  /** Held Sales list overlay (Batch AN). */
  heldOpen?: boolean;
  heldCount?: number;
  onOpenHeld?: () => void;
  onCloseHeld?: () => void;
  onResumeHeld?: (snapshot: HeldSaleSnapshot) => void | Promise<void>;
  onHeldListChanged?: () => void;
  /**
   * Hide Active Cart and let `main` fill the workspace
   * (Sale Completed — Batch T).
   */
  hideCartPanel?: boolean;
  /** Footer print/busy hints (Batch Y). */
  footerStatus?: FooterStatus | null;
  terminalLabel?: string;
  cashierLabel?: string;
  cashierDisplayName?: string;
  onLogout?: () => void;
  /** Sidebar New Sale [F2] → start sale (Batch F+). */
  onNewSale?: () => void;
  /** Transactions list surface (Batch AJ). */
  transactionsOpen?: boolean;
  onOpenTransactions?: () => void;
  onCloseTransactions?: () => void;
  /** Settings parent surface open. */
  settingsOpen?: boolean;
  onOpenSettings?: () => void;
  onCloseSettings?: () => void;
  /** Shift Open/Close surface (Batch AL). */
  shiftOpen?: boolean;
  onOpenShift?: () => void;
  onCloseShift?: () => void;
  onShiftChanged?: () => void;
  /** Sync Queue overlay (M4 Batch E) — no sidebar item. */
  syncQueueOpen?: boolean;
  onOpenSyncQueue?: () => void;
  onCloseSyncQueue?: () => void;
  /** Modals / overlays (e.g. Select Batch) — inside connectivity + local DB providers. */
  overlay?: ReactNode;
};

/**
 * Fixed chrome shell (Search Results - Napa).
 * Header / sidebar / footer / cart frame stay put; only outlets swap per screen.
 * ConnectivityProvider + LocalDbProvider wrap this shell from App.tsx
 * (so complete-sale can read isOnline / forcedOffline).
 */
export function AppShell({
  main,
  cartBody,
  cartItemCount = 0,
  cartSubtotal = 0,
  loyaltyDiscount = 0,
  onClearSale,
  saleCustomer = null,
  onSelectCustomer,
  onProceed,
  onHold,
  heldOpen = false,
  heldCount = 0,
  onOpenHeld,
  onCloseHeld,
  onResumeHeld,
  onHeldListChanged,
  hideCartPanel = false,
  footerStatus = null,
  cashierLabel = "—",
  cashierDisplayName = "—",
  onLogout,
  onNewSale,
  transactionsOpen = false,
  onOpenTransactions,
  onCloseTransactions,
  settingsOpen = false,
  onOpenSettings,
  onCloseSettings,
  shiftOpen = false,
  onOpenShift,
  onCloseShift,
  onShiftChanged,
  syncQueueOpen = false,
  onOpenSyncQueue,
  onCloseSyncQueue,
  overlay,
}: AppShellProps) {
  const { t } = useLocale();
  const terminalNumber = "01";
  const headerTerminal = `${t("sidebar.terminal")} ${terminalNumber}`;

  return (
        <div className="relative flex h-full min-h-0 flex-col bg-canvas">
          <Header
            terminalLabel={headerTerminal}
            cashierLabel={cashierLabel}
            onOpenSyncQueue={onOpenSyncQueue}
          />

          <div className="flex min-h-0 flex-1">
            <Sidebar
              terminalNumber={terminalNumber}
              cashierDisplayName={cashierDisplayName}
              onLogout={onLogout}
              onNewSale={onNewSale}
              onOpenTransactions={onOpenTransactions}
              transactionsOpen={transactionsOpen}
              onOpenSettings={onOpenSettings}
              settingsOpen={settingsOpen}
              onOpenShift={onOpenShift}
              shiftOpen={shiftOpen}
            />

            {/* Search ~40% · Active Cart ~60% — Sale Completed spans full workspace. */}
            <div className="relative flex min-h-0 min-w-0 flex-1">
              <main
                className={[
                  "relative min-w-0 overflow-auto bg-surface",
                  hideCartPanel ? "flex-1" : "flex-[2]",
                ].join(" ")}
              >
                {main}
                {transactionsOpen && onCloseTransactions ? (
                  <TransactionsPanel onClose={onCloseTransactions} />
                ) : null}
                {shiftOpen && onCloseShift ? (
                  <ShiftPanel
                    onClose={onCloseShift}
                    onShiftChanged={onShiftChanged}
                  />
                ) : null}
                {settingsOpen && onCloseSettings ? (
                  <SettingsPanel
                    onClose={onCloseSettings}
                    onOpenSyncQueue={onOpenSyncQueue}
                  />
                ) : null}
              </main>

              {hideCartPanel ? null : (
                <CartPanel
                  itemCount={cartItemCount}
                  subtotal={cartSubtotal}
                  loyaltyDiscount={loyaltyDiscount}
                  onClearSale={onClearSale}
                  saleCustomer={saleCustomer}
                  onSelectCustomer={onSelectCustomer}
                  onProceed={onProceed}
                  onHold={onHold}
                  onOpenHeld={onOpenHeld}
                  heldCount={heldCount}
                >
                  {cartBody}
                </CartPanel>
              )}

              {heldOpen && onCloseHeld && onResumeHeld ? (
                <HeldSalesPanel
                  onClose={onCloseHeld}
                  cartHasItems={cartItemCount > 0}
                  onResume={onResumeHeld}
                  onListChanged={onHeldListChanged}
                />
              ) : null}
              {syncQueueOpen && onCloseSyncQueue ? (
                <SyncQueuePanel onClose={onCloseSyncQueue} />
              ) : null}
            </div>
          </div>

          <Footer status={footerStatus} />
          {overlay}
        </div>
  );
}
