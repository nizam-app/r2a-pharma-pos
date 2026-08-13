import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AuthProvider, LoginPage, useAuth } from "@/features/auth";
import { CounterReadyScreen } from "@/features/counter";
import { LocaleProvider, useLocale } from "@/i18n";
import {
  CartLinesBody,
  CardPaymentModal,
  CashPaymentModal,
  ChangeBatchModal,
  CompleteSaleZeroPayModal,
  ConfirmDialog,
  EditSaleItemModal,
  EmptyCartBody,
  EmptyPosScreen,
  GenericSubstitutesModal,
  ManagerAuthorizationModal,
  MfsPaymentModal,
  PaymentSelectMethodModal,
  QuantityPackagingModal,
  RedeemLoyaltyModal,
  SaleCompletedScreen,
  SelectBatchModal,
  SelectCustomerModal,
  VerifyLoyaltyOtpModal,
  type CartLine,
  type CashSettlementDraft,
  type CashSettlementView,
  type CardSettlementView,
  type MfsSettlementDraft,
  type MfsSettlementView,
} from "@/features/pos";
import {
  AppShell,
  ConnectivityProvider,
  LocalDbProvider,
  PosToast,
  useConnectivity,
  type PosToastTone,
} from "@/features/shell";
import type { PosBatchRow } from "@/lib/batchSelect";
import {
  armCardStubDeclineOnce,
} from "@/lib/cardPaymentStub";
import type { ChangeBatchDraft } from "@/lib/changeBatch";
import type { SaleCustomer } from "@/lib/customerSearch";
import type { StagedFefoOverride } from "@/lib/fefoOverrideAuth";
import { formatTaka } from "@/lib/format";
import {
  settleLoyaltyForSale,
  type LoyaltySettlement,
} from "@/lib/loyaltyCalc";
import { type AppliedLoyaltyRedeem } from "@/lib/loyaltyRedeem";
import {
  armMfsStubFailOnce,
} from "@/lib/mfsPaymentStub";
import {
  formatExpiryMonthYear,
  type PosSearchResult,
} from "@/lib/productSearch";
import type { SubstituteSourceProduct } from "@/lib/substitutes";
import {
  buildReceiptModel,
  formatInvoiceLabel,
  type ReceiptPaperWidth,
  type ReceiptPrintModel,
} from "@/lib/receiptModel";
import {
  buildSaleIngestPayload,
  buildZeroPayIngestPayload,
  completeSaleOrQueue,
  saleIngestErrorMessage,
} from "@/lib/saleIngest";
import {
  armPrintStubFailOnce,
  isPrintBusy,
  runPrintStub,
  type PrintPhase,
} from "@/lib/printStub";
import { transactionLogStore } from "@/lib/transactionLogStore";
import { shiftStore } from "@/lib/shiftStore";
import {
  heldSaleStore,
  MAX_HELD_SALES,
  type HeldSaleSnapshot,
} from "@/lib/heldSaleStore";
import {
  posCatalogOnline,
  recheckHeldSale,
} from "@/lib/heldSaleRecheck";

type PosView = "counter" | "sale" | "completed";

type PosModal =
  | { kind: "none" }
  | { kind: "batch"; product: PosSearchResult }
  | { kind: "qty"; product: PosSearchResult; batch: PosBatchRow }
  | { kind: "edit"; lineId: string; draft?: ChangeBatchDraft }
  | { kind: "changeBatch"; lineId: string; draft: ChangeBatchDraft }
  | {
      kind: "managerAuth";
      lineId: string;
      draft: ChangeBatchDraft;
      requestedBatch: PosBatchRow;
      fefoBatch: PosBatchRow | null;
    }
  | { kind: "selectCustomer" }
  | { kind: "substitutes"; source: SubstituteSourceProduct }
  | { kind: "redeemLoyalty" }
  | { kind: "verifyLoyaltyOtp"; redeemPoints: number }
  | { kind: "completeSaleZeroPay" }
  | { kind: "paymentSelectMethod" }
  | { kind: "cashPayment" }
  | { kind: "cardPayment" }
  | { kind: "mfsPayment" }
  | { kind: "removeConfirm"; lineId: string }
  | { kind: "clearConfirm" }
  | { kind: "cancelConfirm" };

type PosToastState = {
  message: string;
  tone?: PosToastTone;
};

type CompletedSaleState = {
  txnLabel: string;
  /** Receipt invoice INV-… (pairs with txnLabel TXN-…). */
  invoiceLabel: string;
  /** ISO timestamp when sale completed (receipt Date). */
  completedAt: string;
  cashierName: string;
  /** Null = walk-in (no loyalty grid on Sale Completed). */
  customer: SaleCustomer | null;
  lines: CartLine[];
  cartSubtotal: number;
  loyaltyTaka: number;
  settlement: LoyaltySettlement;
  /** Cash tender settlement; null when loyalty zero-pay / card / MFS. */
  cashSettlement: CashSettlementView | null;
  /** Card tender settlement (Batch AC); null when cash / loyalty / MFS. */
  cardSettlement: CardSettlementView | null;
  /** MFS tender settlement (Batch AD); null when cash / loyalty / card. */
  mfsSettlement: MfsSettlementView | null;
};

function clampCartQty(n: number, max: number): number {
  const maxSafe = Math.max(1, Math.trunc(max));
  return Math.min(maxSafe, Math.max(1, Math.trunc(n)));
}

/**
 * Milestone 3 · Batch AD — MFS providers + invented confirm/result + MFS ingest.
 * Chrome lock = Search Results - Napa.
 */
export default function App() {
  return (
    <AuthProvider>
      <LocaleProvider>
        <AppGate />
      </LocaleProvider>
    </AuthProvider>
  );
}

function AppGate() {
  const { status } = useAuth();
  const { t } = useLocale();

  if (status === "loading") {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-2 bg-canvas px-6 text-center">
        <p className="text-lg font-semibold text-primary">PharmaSync POS</p>
        <p className="text-sm text-muted">{t("auth.restoringSession")}</p>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <LoginPage />;
  }

  return (
    <ConnectivityProvider>
      <LocalDbProvider>
        <AuthenticatedPos />
      </LocalDbProvider>
    </ConnectivityProvider>
  );
}

function AuthenticatedPos() {
  const { status, user, cashierLabel, logout } = useAuth();
  const { t } = useLocale();
  const { isOnline, forcedOffline, setPendingCount } = useConnectivity();
  const [view, setView] = useState<PosView>("counter");
  const [modal, setModal] = useState<PosModal>({ kind: "none" });
  /** Transactions list (Batch AJ) — does not clear sale state. */
  const [transactionsOpen, setTransactionsOpen] = useState(false);
  /** Settings surface (language + pharmacy header) — does not clear sale state. */
  const [settingsOpen, setSettingsOpen] = useState(false);
  /** Shift Open/Close (Batch AL) — does not clear sale state. */
  const [shiftOpen, setShiftOpen] = useState(false);
  /** Held Sales list (Batch AN) — does not clear sale state until Resume. */
  const [heldOpen, setHeldOpen] = useState(false);
  const [heldCount, setHeldCount] = useState(0);
  /** Bumps Counter Ready Active Shift after local open/close. */
  const [shiftEpoch, setShiftEpoch] = useState(0);
  const [cartLines, setCartLines] = useState<CartLine[]>([]);
  const [selectedCartIndex, setSelectedCartIndex] = useState(0);
  /** Attached customer + points snapshot (null = walk-in). */
  const [saleCustomer, setSaleCustomer] = useState<SaleCustomer | null>(null);
  /** Loyalty redeem applied after stub OTP (Batch S → Batch T). */
  const [appliedLoyalty, setAppliedLoyalty] =
    useState<AppliedLoyaltyRedeem | null>(null);
  /** Authorized FEFO override not yet saved to cart (Edit banner). */
  const [stagedFefoOverride, setStagedFefoOverride] =
    useState<StagedFefoOverride | null>(null);
  /** Batch P / S / T toasts (teal pill). */
  const [posToast, setPosToast] = useState<PosToastState | null>(null);
  /** Snapshot after successful zero-pay or cash ingest (Batch T / X). */
  const [completedSale, setCompletedSale] =
    useState<CompletedSaleState | null>(null);
  /** Batch Y print stub phase on Sale Completed. */
  const [printPhase, setPrintPhase] = useState<PrintPhase>("idle");
  const printAbortRef = useRef<AbortController | null>(null);
  /**
   * Bumped on successful Hold so in-flight Cash/Card/MFS/zero-pay ingest
   * cannot land Sale Completed after the cart was parked (Batch AO).
   */
  const tenderEpochRef = useRef(0);
  const tenderAbortRef = useRef<AbortController>(new AbortController());
  const [completingSale, setCompletingSale] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  /** Focused search row while results visible — F4 context (Batch AG). */
  const [searchFocusedProduct, setSearchFocusedProduct] =
    useState<PosSearchResult | null>(null);

  const qtyOpen = modal.kind === "qty";
  const batchOpen = modal.kind === "batch";
  const editOpen = modal.kind === "edit";
  const changeBatchOpen = modal.kind === "changeBatch";
  const managerAuthOpen = modal.kind === "managerAuth";
  const selectCustomerOpen = modal.kind === "selectCustomer";
  const substitutesOpen = modal.kind === "substitutes";
  const redeemLoyaltyOpen = modal.kind === "redeemLoyalty";
  const verifyLoyaltyOtpOpen = modal.kind === "verifyLoyaltyOtp";
  const completeSaleZeroPayOpen = modal.kind === "completeSaleZeroPay";
  const paymentSelectMethodOpen = modal.kind === "paymentSelectMethod";
  const cashPaymentOpen = modal.kind === "cashPayment";
  const cardPaymentOpen = modal.kind === "cardPayment";
  const mfsPaymentOpen = modal.kind === "mfsPayment";
  const removeConfirmOpen = modal.kind === "removeConfirm";
  const clearConfirmOpen = modal.kind === "clearConfirm";
  const cancelConfirmOpen = modal.kind === "cancelConfirm";
  const confirmDialogOpen =
    removeConfirmOpen || clearConfirmOpen || cancelConfirmOpen;
  const loyaltyModalOpen = redeemLoyaltyOpen || verifyLoyaltyOtpOpen;
  const cartSubtotal = useMemo(
    () => cartLines.reduce((sum, line) => sum + line.lineTotal, 0),
    [cartLines],
  );
  const loyaltyDiscount = appliedLoyalty?.taka ?? 0;
  const amountDue = Math.max(0, cartSubtotal - loyaltyDiscount);
  const unitsDispensed = useMemo(
    () => cartLines.reduce((sum, line) => sum + line.quantityBase, 0),
    [cartLines],
  );
  const editingLine = useMemo(() => {
    if (
      modal.kind !== "edit" &&
      modal.kind !== "changeBatch" &&
      modal.kind !== "managerAuth"
    ) {
      return null;
    }
    return cartLines.find((l) => l.id === modal.lineId) ?? null;
  }, [modal, cartLines]);
  const editDraft =
    modal.kind === "edit" ||
    modal.kind === "changeBatch" ||
    modal.kind === "managerAuth"
      ? (modal.draft ?? null)
      : null;
  const otherSameBatchQuantityBase = useMemo(() => {
    if (!editingLine) return 0;
    const batchId =
      stagedFefoOverride?.lineId === editingLine.id
        ? stagedFefoOverride.requestedBatch.batchId
        : editingLine.batchId;
    return cartLines
      .filter((l) => l.id !== editingLine.id && l.batchId === batchId)
      .reduce((sum, l) => sum + l.quantityBase, 0);
  }, [cartLines, editingLine, stagedFefoOverride]);
  const removingLine = useMemo(() => {
    if (modal.kind !== "removeConfirm") return null;
    return cartLines.find((l) => l.id === modal.lineId) ?? null;
  }, [modal, cartLines]);

  const completedReceipt = useMemo((): ReceiptPrintModel | null => {
    if (!completedSale) return null;
    return buildReceiptModel({
      txnLabel: completedSale.txnLabel,
      invoiceLabel: completedSale.invoiceLabel,
      completedAt: completedSale.completedAt,
      cashierName: completedSale.cashierName,
      customer: completedSale.customer,
      lines: completedSale.lines,
      cartSubtotal: completedSale.cartSubtotal,
      loyaltyTaka: completedSale.loyaltyTaka,
      cashSettlement: completedSale.cashSettlement,
      cardSettlement: completedSale.cardSettlement,
      mfsSettlement: completedSale.mfsSettlement,
      paperWidth: "80mm",
      tenantId: user?.tenantId,
      storeId: user?.storeId ?? null,
    });
  }, [completedSale, user?.tenantId, user?.storeId]);

  const showToast = useCallback(
    (message: string, tone: PosToastTone = "success") => {
      setPosToast({ message, tone });
    },
    [],
  );

  /** Persist completed sale into local Transactions log (Batch AJ). */
  const recordTransaction = useCallback(
    (
      sale: CompletedSaleState,
      ids: { saleId: string; eventId: string },
    ) => {
      const tenantId = user?.tenantId;
      if (!tenantId) return;
      transactionLogStore.append(tenantId, user?.storeId ?? null, {
        saleId: ids.saleId,
        eventId: ids.eventId,
        txnLabel: sale.txnLabel,
        invoiceLabel: sale.invoiceLabel,
        completedAt: sale.completedAt,
        cashierName: sale.cashierName,
        customer: sale.customer,
        lines: sale.lines,
        cartSubtotal: sale.cartSubtotal,
        loyaltyTaka: sale.loyaltyTaka,
        settlement: sale.settlement,
        cashSettlement: sale.cashSettlement,
        cardSettlement: sale.cardSettlement,
        mfsSettlement: sale.mfsSettlement,
      });
    },
    [user?.tenantId, user?.storeId],
  );

  const abortPrintStub = useCallback(() => {
    printAbortRef.current?.abort();
    printAbortRef.current = null;
  }, []);

  const startPrintCycle = useCallback(
    async (
      mode: "printing" | "retrying",
      receipt?: ReceiptPrintModel,
    ) => {
      abortPrintStub();
      const ac = new AbortController();
      printAbortRef.current = ac;
      setPrintPhase(mode);
      try {
        const result = await runPrintStub({
          signal: ac.signal,
          receipt,
        });
        if (ac.signal.aborted) return;
        setPrintPhase(result === "printed" ? "printed" : "failed");
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setPrintPhase("failed");
      } finally {
        if (printAbortRef.current === ac) printAbortRef.current = null;
      }
    },
    [abortPrintStub],
  );

  const startNewSale = useCallback(() => {
    // Soft gate: New Sale [F2] requires an open local shift (connectivity badge unchanged).
    const tenantId = user?.tenantId;
    if (!tenantId || !shiftStore.get(tenantId, user?.storeId ?? null)) {
      showToast(t("shift.requiredForSale"), "info");
      setSettingsOpen(false);
      setTransactionsOpen(false);
      setHeldOpen(false);
      setShiftOpen(true);
      return;
    }

    abortPrintStub();
    setPrintPhase("idle");
    setModal({ kind: "none" });
    setCartLines([]);
    setSelectedCartIndex(0);
    setSaleCustomer(null);
    setAppliedLoyalty(null);
    setStagedFefoOverride(null);
    setCompletedSale(null);
    setCompletingSale(false);
    setTransactionsOpen(false);
    setSettingsOpen(false);
    setShiftOpen(false);
    setHeldOpen(false);
    setSearchFocusedProduct(null);
    setView("sale");
  }, [abortPrintStub, user?.tenantId, user?.storeId, showToast, t]);

  const returnToCounter = useCallback(() => {
    abortPrintStub();
    setPrintPhase("idle");
    setModal({ kind: "none" });
    setCartLines([]);
    setSelectedCartIndex(0);
    setSaleCustomer(null);
    setAppliedLoyalty(null);
    setStagedFefoOverride(null);
    setCompletedSale(null);
    setCompletingSale(false);
    setTransactionsOpen(false);
    setSettingsOpen(false);
    setShiftOpen(false);
    setHeldOpen(false);
    setView("counter");
  }, [abortPrintStub]);

  const requestCancelSale = useCallback(() => {
    if (cartLines.length > 0) {
      setModal({ kind: "cancelConfirm" });
      return;
    }
    returnToCounter();
  }, [cartLines.length, returnToCounter]);

  const confirmCancelSale = useCallback(() => {
    returnToCounter();
  }, [returnToCounter]);

  const refreshHeldCount = useCallback(() => {
    const tenantId = user?.tenantId;
    if (!tenantId) {
      setHeldCount(0);
      return;
    }
    setHeldCount(heldSaleStore.count(tenantId, user?.storeId ?? null));
  }, [user?.tenantId, user?.storeId]);

  /** Abort card/MFS stub controllers and invalidate in-flight ingest. */
  const abortOpenTenders = useCallback(() => {
    tenderEpochRef.current += 1;
    tenderAbortRef.current.abort();
    tenderAbortRef.current = new AbortController();
  }, []);

  /**
   * Hold / park the active sale (Batch AN + AO · F6).
   * Allowed on sale view with ≥1 line, including while payment/loyalty modals
   * are open. On success: abort card/MFS stubs, close modals, drop tender
   * drafts (cash received / card approved / MFS processing are not stored).
   * Lands on empty New Sale without the F2 shift gate (shift stays as-is).
   */
  const holdActiveSale = useCallback(() => {
    if (view !== "sale") return;
    if (completingSale) {
      showToast(t("hold.busy"), "info");
      return;
    }
    if (cartLines.length === 0) {
      showToast(t("hold.emptyCart"), "info");
      return;
    }
    const tenantId = user?.tenantId;
    if (!tenantId) return;

    const result = heldSaleStore.add(tenantId, user?.storeId ?? null, {
      lines: cartLines,
      customer: saleCustomer,
      loyalty: appliedLoyalty,
    });
    if (!result.ok) {
      if (result.reason === "at_capacity") {
        showToast(
          t("hold.atCapacity").replaceAll("{max}", String(MAX_HELD_SALES)),
          "info",
        );
        return;
      }
      if (result.reason === "empty_lines") {
        showToast(t("hold.emptyCart"), "info");
        return;
      }
      showToast(t("hold.storageFailed"), "error");
      return;
    }

    abortOpenTenders();
    setModal({ kind: "none" });
    setCartLines([]);
    setSelectedCartIndex(0);
    setSaleCustomer(null);
    setAppliedLoyalty(null);
    setStagedFefoOverride(null);
    setSearchFocusedProduct(null);
    setHeldOpen(false);
    setTransactionsOpen(false);
    setSettingsOpen(false);
    setShiftOpen(false);
    setView("sale");
    refreshHeldCount();
    showToast(t("hold.parked"), "success");
  }, [
    view,
    completingSale,
    cartLines,
    saleCustomer,
    appliedLoyalty,
    user?.tenantId,
    user?.storeId,
    abortOpenTenders,
    refreshHeldCount,
    showToast,
    t,
  ]);

  const openHeldList = useCallback(() => {
    setSettingsOpen(false);
    setTransactionsOpen(false);
    setShiftOpen(false);
    setHeldOpen(true);
  }, []);

  /**
   * Resume a held snapshot into the empty active cart.
   * Soft recheck (Batch AO): strip unsellable lines; clamp short stock;
   * if nothing remains sellable, keep the hold and toast.
   */
  const resumeHeldSale = useCallback(
    async (snapshot: HeldSaleSnapshot) => {
      if (cartLines.length > 0) {
        showToast(t("hold.resumeCartNotEmpty"), "info");
        return;
      }
      const tenantId = user?.tenantId;
      if (!tenantId) return;

      const checked = await recheckHeldSale(snapshot.lines, {
        online: posCatalogOnline(),
      });
      if (!checked.ok) {
        showToast(t("hold.resumeRecheckFailed"), "error");
        return;
      }
      if (checked.lines.length === 0) {
        showToast(t("hold.resumeAllUnsellable"), "error");
        return;
      }

      heldSaleStore.remove(tenantId, user?.storeId ?? null, snapshot.id);
      abortOpenTenders();
      setModal({ kind: "none" });
      setCartLines(checked.lines);
      setSelectedCartIndex(0);
      setSaleCustomer(snapshot.customer);
      setAppliedLoyalty(snapshot.loyalty);
      setStagedFefoOverride(null);
      setSearchFocusedProduct(null);
      setHeldOpen(false);
      setTransactionsOpen(false);
      setSettingsOpen(false);
      setShiftOpen(false);
      setView("sale");
      refreshHeldCount();

      const parts = [t("hold.resumed")];
      if (checked.stripped > 0) {
        parts.push(
          t("hold.resumeStripped").replaceAll(
            "{count}",
            String(checked.stripped),
          ),
        );
      }
      if (checked.clamped > 0) {
        parts.push(
          t("hold.resumeClamped").replaceAll(
            "{count}",
            String(checked.clamped),
          ),
        );
      }
      showToast(
        parts.join(" "),
        checked.stripped > 0 || checked.clamped > 0 ? "info" : "success",
      );
    },
    [
      cartLines.length,
      user?.tenantId,
      user?.storeId,
      abortOpenTenders,
      refreshHeldCount,
      showToast,
      t,
    ],
  );

  const focusSearch = useCallback(() => {
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, []);

  const closeModals = useCallback(() => {
    setModal({ kind: "none" });
  }, []);

  const closeEditModal = useCallback(() => {
    setStagedFefoOverride(null);
    setModal({ kind: "none" });
  }, []);

  const onConfirmBatch = useCallback((batch: PosBatchRow) => {
    setModal((prev) => {
      if (prev.kind !== "batch") return prev;
      return { kind: "qty", product: prev.product, batch };
    });
  }, []);

  const onBackToBatch = useCallback(() => {
    setModal((prev) => {
      if (prev.kind !== "qty") return prev;
      return { kind: "batch", product: prev.product };
    });
  }, []);

  const onAddToSale = useCallback((line: CartLine) => {
    setCartLines((prev) => {
      setSelectedCartIndex(prev.length);
      return [...prev, line];
    });
    setAppliedLoyalty(null);
    setModal({ kind: "none" });
  }, []);

  const onEditLine = useCallback(
    (line: CartLine) => {
      const idx = cartLines.findIndex((l) => l.id === line.id);
      if (idx >= 0) setSelectedCartIndex(idx);
      setModal({ kind: "edit", lineId: line.id });
    },
    [cartLines],
  );

  const onSaveEditLine = useCallback(
    (updated: CartLine) => {
      const appliedOverride =
        stagedFefoOverride?.lineId === updated.id
          ? stagedFefoOverride
          : null;
      setCartLines((prev) => {
        const next = prev.map((existing) =>
          existing.id === updated.id ? updated : existing,
        );
        const idx = next.findIndex((l) => l.id === updated.id);
        setSelectedCartIndex(idx >= 0 ? idx : 0);
        return next;
      });
      setStagedFefoOverride((prev) =>
        prev && prev.lineId === updated.id ? null : prev,
      );
      setAppliedLoyalty(null);
      setModal({ kind: "none" });
      if (appliedOverride) {
        showToast(
          `${t("edit.itemUpdatedBatchAuthorized")} ${appliedOverride.requestedBatch.batchNumber} ${t("edit.authorizedSuffix")}`,
        );
      }
    },
    [stagedFefoOverride, showToast, t],
  );

  const onOpenChangeBatch = useCallback(
    (draft: ChangeBatchDraft) => {
      if (modal.kind !== "edit") return;
      setModal({ kind: "changeBatch", lineId: modal.lineId, draft });
    },
    [modal],
  );

  const onBackFromChangeBatch = useCallback(() => {
    setModal((prev) => {
      if (prev.kind !== "changeBatch") return prev;
      return { kind: "edit", lineId: prev.lineId, draft: prev.draft };
    });
  }, []);

  /** Batch O — open Manager Authorization stub for non-FEFO pick. */
  const onRequestFefoAuthorization = useCallback(
    (requested: PosBatchRow, fefo: PosBatchRow | null) => {
      setModal((prev) => {
        if (prev.kind !== "changeBatch") return prev;
        return {
          kind: "managerAuth",
          lineId: prev.lineId,
          draft: prev.draft,
          requestedBatch: requested,
          fefoBatch: fefo,
        };
      });
    },
    [],
  );

  const onBackFromManagerAuth = useCallback(() => {
    setModal((prev) => {
      if (prev.kind !== "managerAuth") return prev;
      return {
        kind: "changeBatch",
        lineId: prev.lineId,
        draft: prev.draft,
      };
    });
  }, []);

  /** Stub authorize success → Edit Sale Item - Override Authorized. */
  const onFefoOverrideAuthorized = useCallback((staged: StagedFefoOverride) => {
    setStagedFefoOverride(staged);
    setModal((prev) => {
      if (prev.kind !== "managerAuth") return prev;
      return { kind: "edit", lineId: prev.lineId, draft: prev.draft };
    });
  }, []);

  /** Open Remove Item? confirm (Batch Q) — Del / Backspace. */
  const requestRemoveLine = useCallback((lineId: string) => {
    if (!cartLines.some((line) => line.id === lineId)) return;
    setModal({ kind: "removeConfirm", lineId });
  }, [cartLines]);

  const confirmRemoveLine = useCallback(() => {
    if (modal.kind !== "removeConfirm") return;
    const lineId = modal.lineId;
    setCartLines((prev) => {
      const idx = prev.findIndex((line) => line.id === lineId);
      const next = prev.filter((line) => line.id !== lineId);
      if (next.length === 0) {
        setSelectedCartIndex(0);
      } else if (idx >= 0) {
        setSelectedCartIndex(Math.min(idx, next.length - 1));
      }
      return next;
    });
    setStagedFefoOverride((prev) =>
      prev && prev.lineId === lineId ? null : prev,
    );
    setAppliedLoyalty(null);
    setModal({ kind: "none" });
  }, [modal]);

  const onChangeQty = useCallback((lineId: string, nextQty: number) => {
    setCartLines((prev) =>
      prev.map((line) => {
        if (line.id !== lineId) return line;
        const unitQty = clampCartQty(nextQty, line.maxUnitQty);
        return {
          ...line,
          unitQty,
          lineTotal: line.unitPrice * unitQty,
          quantityBase: line.factorToBase * unitQty,
        };
      }),
    );
    setAppliedLoyalty(null);
  }, []);

  /** Open Clear Sale confirmation (in-app modal). */
  const requestClearSale = useCallback(() => {
    if (cartLines.length === 0) return;
    setModal({ kind: "clearConfirm" });
  }, [cartLines.length]);

  const confirmClearSale = useCallback(() => {
    setModal({ kind: "none" });
    setCartLines([]);
    setSelectedCartIndex(0);
    setStagedFefoOverride(null);
    setAppliedLoyalty(null);
    // Keep attached customer on clear — only lines wiped.
  }, []);

  const openSelectCustomer = useCallback(() => {
    if (view !== "sale") return;
    setModal({ kind: "selectCustomer" });
  }, [view]);

  /**
   * F4 Generic Substitutes (Batch AG).
   * Focus rule: focused search row (results visible) → else selected cart line.
   */
  const openSubstitutes = useCallback(() => {
    if (view !== "sale") return;

    let source: SubstituteSourceProduct | null = null;
    if (searchFocusedProduct) {
      source = {
        productId: searchFocusedProduct.productId,
        name: searchFocusedProduct.name,
        genericName: searchFocusedProduct.genericName,
      };
    } else {
      const line = cartLines[selectedCartIndex];
      if (line) {
        source = {
          productId: line.productId,
          name: line.productName,
          genericName: line.genericName,
        };
      }
    }

    if (!source) {
      showToast(t("substitutes.needProduct"), "error");
      return;
    }

    setModal({ kind: "substitutes", source });
  }, [
    view,
    searchFocusedProduct,
    cartLines,
    selectedCartIndex,
    showToast,
    t,
  ]);

  const onSelectSubstitute = useCallback((product: PosSearchResult) => {
    setModal({ kind: "batch", product });
  }, []);

  const onSelectCustomer = useCallback((customer: SaleCustomer) => {
    setSaleCustomer(customer);
    setAppliedLoyalty(null);
    setModal({ kind: "none" });
    showToast(`${t("customer.attachedToast")}: ${customer.name}`);
  }, [showToast, t]);

  const onWalkInCustomer = useCallback(() => {
    setSaleCustomer(null);
    setAppliedLoyalty(null);
    setModal({ kind: "none" });
    showToast(t("customer.walkInToast"));
  }, [showToast, t]);

  /** Open Payment - Select Method (Batch V). */
  const openPaymentSelectMethod = useCallback(() => {
    setModal({ kind: "paymentSelectMethod" });
  }, []);

  /**
   * Proceed / F10 (Batch V):
   * - Customer attached (no loyalty yet) → Redeem Loyalty
   * - Continue without / walk-in / due > 0 after loyalty → Payment Select Method
   * - Loyalty applied & due 0 → Complete Sale zero-pay modal
   */
  const onProceedToPayment = useCallback(() => {
    if (view !== "sale" || cartLines.length === 0) return;

    if (appliedLoyalty) {
      if (amountDue <= 0) {
        setModal({ kind: "completeSaleZeroPay" });
        return;
      }
      openPaymentSelectMethod();
      return;
    }

    if (saleCustomer && cartSubtotal > 0) {
      setModal({ kind: "redeemLoyalty" });
      return;
    }

    openPaymentSelectMethod();
  }, [
    view,
    cartLines.length,
    appliedLoyalty,
    amountDue,
    saleCustomer,
    cartSubtotal,
    openPaymentSelectMethod,
  ]);

  const onContinueWithoutRedeeming = useCallback(() => {
    openPaymentSelectMethod();
  }, [openPaymentSelectMethod]);

  /** Cash → Cash Payment modal (Batch W). */
  const onSelectCashPayment = useCallback(() => {
    setModal({ kind: "cashPayment" });
  }, []);

  /** Card → Card Payment stub modal (Batch AB). */
  const onSelectCardPayment = useCallback(() => {
    setModal({ kind: "cardPayment" });
  }, []);

  /** MFS → Provider Select + invented confirm (Batch AD). */
  const onSelectMfsPayment = useCallback(() => {
    setModal({ kind: "mfsPayment" });
  }, []);

  const onBackToPaymentMethods = useCallback(() => {
    setModal({ kind: "paymentSelectMethod" });
  }, []);

  /**
   * Cash complete → online ingest, or queue while Offline / Force Offline.
   * Change is UI-only; payment line amount must equal sale total (M2).
   */
  const onCompleteCashPayment = useCallback(
    async (draft: CashSettlementDraft) => {
      const epoch = tenderEpochRef.current;
      if (completingSale || cartLines.length === 0) return;
      if (draft.cashReceived + 1e-9 < draft.amountDue) return;

      const storeId = user?.storeId;
      if (!storeId) {
        showToast(t("ops.noStoreAssigned"), "error");
        return;
      }

      const settlement = settleLoyaltyForSale({
        previousBalance: saleCustomer?.loyaltyPoints ?? 0,
        applied: appliedLoyalty,
        cartSubtotal,
      });

      const eventId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `pos-cash-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

      const payload = buildSaleIngestPayload({
        eventId,
        storeId,
        customerId: saleCustomer?.customerId ?? null,
        lines: cartLines,
        cartSubtotal,
        appliedLoyalty,
        paymentMethod: "CASH",
        cashMeta: {
          cashReceived: draft.cashReceived,
          changeDue: draft.changeDue,
        },
      });

      if (tenderEpochRef.current !== epoch) return;
      setCompletingSale(true);
      try {
        const ingested = await completeSaleOrQueue(payload, {
          isOnline,
          forcedOffline,
        });
        if (tenderEpochRef.current !== epoch) return;
        setPendingCount(ingested.pendingCount);
        // Session-only loyalty balance for Sale Completed display.
        // TODO(real integration): cloud mutate customer points on ingest.
        const nextSale: CompletedSaleState = {
          txnLabel: ingested.txnLabel,
          invoiceLabel: formatInvoiceLabel(ingested.id, ingested.eventId),
          completedAt: new Date().toISOString(),
          cashierName: cashierLabel,
          customer: saleCustomer,
          lines: cartLines,
          cartSubtotal,
          loyaltyTaka: appliedLoyalty?.taka ?? 0,
          settlement,
          cashSettlement: {
            amountPaid: draft.amountDue,
            cashReceived: draft.cashReceived,
            changeReturned: draft.changeDue,
          },
          cardSettlement: null,
          mfsSettlement: null,
        };
        setCompletedSale(nextSale);
        recordTransaction(nextSale, {
          saleId: ingested.id,
          eventId: ingested.eventId,
        });
        setModal({ kind: "none" });
        setView("completed");
        showToast(
          ingested.queued ? t("ops.saleQueued") : t("completed.saleToast"),
          ingested.queued ? "info" : "success",
        );
      } catch (err) {
        showToast(saleIngestErrorMessage(err, t("ops.saleSaveFailed")), "error");
      } finally {
        setCompletingSale(false);
      }
    },
    [
      completingSale,
      cartLines,
      user?.storeId,
      saleCustomer,
      appliedLoyalty,
      cartSubtotal,
      cashierLabel,
      isOnline,
      forcedOffline,
      setPendingCount,
      recordTransaction,
      showToast,
      t,
    ],
  );

  /**
   * Card stub approved → online ingest, or queue while Offline / Force Offline.
   * TODO(real card terminal SDK): void/refund if ingest fails after auth.
   * Throws on failure so Card Payment modal can reset to Start.
   */
  const onCardPaymentApproved = useCallback(async () => {
    const epoch = tenderEpochRef.current;
    if (completingSale || cartLines.length === 0) {
      throw new Error("Sale is not ready for card completion");
    }
    if (amountDue <= 0) {
      showToast(t("ops.nothingDueCard"), "error");
      throw new Error("Nothing due for card payment");
    }

    const storeId = user?.storeId;
    if (!storeId) {
      showToast(t("ops.noStoreAssigned"), "error");
      throw new Error("No store assigned");
    }

    const settlement = settleLoyaltyForSale({
      previousBalance: saleCustomer?.loyaltyPoints ?? 0,
      applied: appliedLoyalty,
      cartSubtotal,
    });

    const eventId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `pos-card-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    const payload = buildSaleIngestPayload({
      eventId,
      storeId,
      customerId: saleCustomer?.customerId ?? null,
      lines: cartLines,
      cartSubtotal,
      appliedLoyalty,
      paymentMethod: "CARD",
      cardMeta: { status: "Approved" },
    });

    if (tenderEpochRef.current !== epoch) {
      throw new Error("Tender aborted");
    }
    setCompletingSale(true);
    try {
      const ingested = await completeSaleOrQueue(payload, {
        isOnline,
        forcedOffline,
      });
      if (tenderEpochRef.current !== epoch) return;
      setPendingCount(ingested.pendingCount);
      // Session-only loyalty balance for Sale Completed display.
      // TODO(real integration): cloud mutate customer points on ingest.
      const nextSale: CompletedSaleState = {
        txnLabel: ingested.txnLabel,
        invoiceLabel: formatInvoiceLabel(ingested.id, ingested.eventId),
        completedAt: new Date().toISOString(),
        cashierName: cashierLabel,
        customer: saleCustomer,
        lines: cartLines,
        cartSubtotal,
        loyaltyTaka: appliedLoyalty?.taka ?? 0,
        settlement,
        cashSettlement: null,
        cardSettlement: {
          amountPaid: amountDue,
          status: "Approved",
        },
        mfsSettlement: null,
      };
      setCompletedSale(nextSale);
      recordTransaction(nextSale, {
        saleId: ingested.id,
        eventId: ingested.eventId,
      });
      setModal({ kind: "none" });
      setView("completed");
      showToast(
        ingested.queued ? t("ops.saleQueued") : t("completed.saleToast"),
        ingested.queued ? "info" : "success",
      );
    } catch (err) {
      showToast(saleIngestErrorMessage(err, t("ops.saleSaveFailed")), "error");
      throw err;
    } finally {
      setCompletingSale(false);
    }
  }, [
    completingSale,
    cartLines,
    amountDue,
    user?.storeId,
    saleCustomer,
    appliedLoyalty,
    cartSubtotal,
    cashierLabel,
    isOnline,
    forcedOffline,
    setPendingCount,
    recordTransaction,
    showToast,
    t,
  ]);

  /**
   * MFS stub collected → online ingest, or queue while Offline / Force Offline.
   * Provider / payer / trx stored in notes (no Payment.provider column yet).
   * TODO(real MFS APIs): reverse/void if ingest fails after collect.
   * Throws on failure so MFS modal can reset to Confirm.
   */
  const onMfsPaymentCollected = useCallback(
    async (draft: MfsSettlementDraft) => {
      const epoch = tenderEpochRef.current;
      if (completingSale || cartLines.length === 0) {
        throw new Error("Sale is not ready for MFS completion");
      }
      if (amountDue <= 0) {
        showToast(t("ops.nothingDueMfs"), "error");
        throw new Error("Nothing due for MFS payment");
      }

      const storeId = user?.storeId;
      if (!storeId) {
        showToast(t("ops.noStoreAssigned"), "error");
        throw new Error("No store assigned");
      }

      const settlement = settleLoyaltyForSale({
        previousBalance: saleCustomer?.loyaltyPoints ?? 0,
        applied: appliedLoyalty,
        cartSubtotal,
      });

      const eventId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `pos-mfs-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

      const payload = buildSaleIngestPayload({
        eventId,
        storeId,
        customerId: saleCustomer?.customerId ?? null,
        lines: cartLines,
        cartSubtotal,
        appliedLoyalty,
        paymentMethod: "MFS",
        mfsMeta: {
          provider: draft.providerId,
          payerMobile: draft.payerMobile,
          trxId: draft.trxId,
        },
      });

      if (tenderEpochRef.current !== epoch) {
        throw new Error("Tender aborted");
      }
      setCompletingSale(true);
      try {
        const ingested = await completeSaleOrQueue(payload, {
          isOnline,
          forcedOffline,
        });
        if (tenderEpochRef.current !== epoch) return;
        setPendingCount(ingested.pendingCount);
        // Session-only loyalty balance for Sale Completed display.
        // TODO(real integration): cloud mutate customer points on ingest.
        const nextSale: CompletedSaleState = {
          txnLabel: ingested.txnLabel,
          invoiceLabel: formatInvoiceLabel(ingested.id, ingested.eventId),
          completedAt: new Date().toISOString(),
          cashierName: cashierLabel,
          customer: saleCustomer,
          lines: cartLines,
          cartSubtotal,
          loyaltyTaka: appliedLoyalty?.taka ?? 0,
          settlement,
          cashSettlement: null,
          cardSettlement: null,
          mfsSettlement: {
            amountPaid: draft.amountPaid,
            providerLabel: draft.providerLabel,
            payerMobile: draft.payerMobile,
            trxId: draft.trxId,
          },
        };
        setCompletedSale(nextSale);
        recordTransaction(nextSale, {
          saleId: ingested.id,
          eventId: ingested.eventId,
        });
        setModal({ kind: "none" });
        setView("completed");
        showToast(
          ingested.queued ? t("ops.saleQueued") : t("completed.saleToast"),
          ingested.queued ? "info" : "success",
        );
      } catch (err) {
        showToast(saleIngestErrorMessage(err, t("ops.saleSaveFailed")), "error");
        throw err;
      } finally {
        setCompletingSale(false);
      }
    },
    [
      completingSale,
      cartLines,
      amountDue,
      user?.storeId,
      saleCustomer,
      appliedLoyalty,
      cartSubtotal,
      cashierLabel,
      isOnline,
      forcedOffline,
      setPendingCount,
      recordTransaction,
      showToast,
      t,
    ],
  );

  const onRedeemLoyalty = useCallback((usablePoints: number) => {
    setModal({ kind: "verifyLoyaltyOtp", redeemPoints: usablePoints });
  }, []);

  const onCancelLoyaltyOtp = useCallback(() => {
    setModal({ kind: "redeemLoyalty" });
  }, []);

  const onLoyaltyOtpVerified = useCallback(
    (applied: AppliedLoyaltyRedeem) => {
      setAppliedLoyalty(applied);
      setModal({ kind: "none" });
      showToast(
        `${t("loyalty.redeemedToastPrefix")} ${applied.points} ${t("loyalty.redeemedToastPoints")} ${formatTaka(applied.taka)} ${t("loyalty.redeemedToastApplied")}`,
      );
    },
    [showToast, t],
  );

  const onBackFromCompleteSale = useCallback(() => {
    if (completingSale) return;
    setModal({ kind: "none" });
  }, [completingSale]);

  /**
   * Confirm Complete Sale (zero-pay) → online ingest, or queue while Offline / Force Offline.
   */
  const onConfirmCompleteZeroPay = useCallback(async () => {
    const epoch = tenderEpochRef.current;
    if (
      completingSale ||
      !saleCustomer ||
      !appliedLoyalty ||
      cartLines.length === 0 ||
      amountDue > 0
    ) {
      return;
    }

    const storeId = user?.storeId;
    if (!storeId) {
      showToast(t("ops.noStoreAssigned"), "error");
      return;
    }

    const settlement = settleLoyaltyForSale({
      previousBalance: saleCustomer.loyaltyPoints,
      applied: appliedLoyalty,
      cartSubtotal,
    });

    const eventId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `pos-zero-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    const payload = buildZeroPayIngestPayload({
      eventId,
      storeId,
      customerId: saleCustomer.customerId,
      lines: cartLines,
      cartSubtotal,
      appliedLoyalty,
    });

    if (tenderEpochRef.current !== epoch) return;
    setCompletingSale(true);
    try {
      const ingested = await completeSaleOrQueue(payload, {
        isOnline,
        forcedOffline,
      });
      if (tenderEpochRef.current !== epoch) return;
      setPendingCount(ingested.pendingCount);
      // Session-only loyalty balance for Sale Completed display.
      // TODO(real integration): cloud mutate customer points on ingest.
      const nextSale: CompletedSaleState = {
        txnLabel: ingested.txnLabel,
        invoiceLabel: formatInvoiceLabel(ingested.id, ingested.eventId),
        completedAt: new Date().toISOString(),
        cashierName: cashierLabel,
        customer: saleCustomer,
        lines: cartLines,
        cartSubtotal,
        loyaltyTaka: appliedLoyalty.taka,
        settlement,
        cashSettlement: null,
        cardSettlement: null,
        mfsSettlement: null,
      };
      setCompletedSale(nextSale);
      recordTransaction(nextSale, {
        saleId: ingested.id,
        eventId: ingested.eventId,
      });
      setModal({ kind: "none" });
      setView("completed");
      showToast(
        ingested.queued ? t("ops.saleQueued") : t("completed.saleToast"),
        ingested.queued ? "info" : "success",
      );
    } catch (err) {
      showToast(saleIngestErrorMessage(err, t("ops.saleSaveFailed")), "error");
    } finally {
      setCompletingSale(false);
    }
  }, [
    completingSale,
    saleCustomer,
    appliedLoyalty,
    cartLines,
    amountDue,
    user?.storeId,
    cartSubtotal,
    cashierLabel,
    isOnline,
    forcedOffline,
    setPendingCount,
    recordTransaction,
    showToast,
    t,
  ]);

  const buildCompletedReceipt = useCallback(
    (paperWidth: ReceiptPaperWidth = "80mm"): ReceiptPrintModel | null => {
      if (!completedSale) return null;
      return buildReceiptModel({
        txnLabel: completedSale.txnLabel,
        invoiceLabel: completedSale.invoiceLabel,
        completedAt: completedSale.completedAt,
        cashierName: completedSale.cashierName,
        customer: completedSale.customer,
        lines: completedSale.lines,
        cartSubtotal: completedSale.cartSubtotal,
        loyaltyTaka: completedSale.loyaltyTaka,
        cashSettlement: completedSale.cashSettlement,
        cardSettlement: completedSale.cardSettlement,
        mfsSettlement: completedSale.mfsSettlement,
        paperWidth,
        tenantId: user?.tenantId,
        storeId: user?.storeId ?? null,
      });
    },
    [completedSale, user?.tenantId, user?.storeId],
  );

  const onRetryPrint = useCallback(
    (paperWidth: ReceiptPaperWidth = "80mm") => {
      if (view !== "completed" || !completedSale) return;
      if (isPrintBusy(printPhase)) return;
      const receipt = buildCompletedReceipt(paperWidth);
      if (!receipt) return;
      void startPrintCycle("retrying", receipt);
    },
    [view, completedSale, printPhase, buildCompletedReceipt, startPrintCycle],
  );

  const onReprintReceipt = useCallback(
    (paperWidth: ReceiptPaperWidth = "80mm") => {
      if (view !== "completed" || !completedSale) return;
      if (isPrintBusy(printPhase)) return;
      const receipt = buildCompletedReceipt(paperWidth);
      if (!receipt) return;
      void startPrintCycle("printing", receipt);
    },
    [view, completedSale, printPhase, buildCompletedReceipt, startPrintCycle],
  );

  // Auto-start print stub when entering Sale Completed — preview stays visible beside.
  useEffect(() => {
    if (view !== "completed" || !completedSale) return;
    const receipt = buildReceiptModel({
      txnLabel: completedSale.txnLabel,
      invoiceLabel: completedSale.invoiceLabel,
      completedAt: completedSale.completedAt,
      cashierName: completedSale.cashierName,
      customer: completedSale.customer,
      lines: completedSale.lines,
      cartSubtotal: completedSale.cartSubtotal,
      loyaltyTaka: completedSale.loyaltyTaka,
      cashSettlement: completedSale.cashSettlement,
      cardSettlement: completedSale.cardSettlement,
      mfsSettlement: completedSale.mfsSettlement,
      paperWidth: "80mm",
      tenantId: user?.tenantId,
      storeId: user?.storeId ?? null,
    });
    void startPrintCycle("printing", receipt);
    return () => {
      abortPrintStub();
    };
    // Only re-run when the completed txn identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional txn gate
  }, [view, completedSale?.txnLabel]);

  // Dev QA: print fail + card decline + MFS fail stubs.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as Window & {
      __r2aArmPrintFailOnce?: typeof armPrintStubFailOnce;
      __r2aArmCardDeclineOnce?: typeof armCardStubDeclineOnce;
      __r2aArmMfsFailOnce?: typeof armMfsStubFailOnce;
    };
    w.__r2aArmPrintFailOnce = armPrintStubFailOnce;
    w.__r2aArmCardDeclineOnce = armCardStubDeclineOnce;
    w.__r2aArmMfsFailOnce = armMfsStubFailOnce;
    return () => {
      delete w.__r2aArmPrintFailOnce;
      delete w.__r2aArmCardDeclineOnce;
      delete w.__r2aArmMfsFailOnce;
    };
  }, []);

  // Keep selection in range when lines change externally.
  useEffect(() => {
    if (cartLines.length === 0) {
      setSelectedCartIndex(0);
      return;
    }
    setSelectedCartIndex((i) =>
      Math.min(Math.max(0, i), cartLines.length - 1),
    );
  }, [cartLines.length]);

  useEffect(() => {
    refreshHeldCount();
  }, [refreshHeldCount]);

  useEffect(() => {
    if (status !== "authenticated") return;

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      const inEditable =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        Boolean(target?.isContentEditable);

      // Sale Completed — F2 New Sale; Enter retries print when failed.
      if (view === "completed") {
        if (event.key === "F2") {
          event.preventDefault();
          startNewSale();
          return;
        }
        if (event.key === "Enter" && printPhase === "failed") {
          event.preventDefault();
          onRetryPrint("80mm");
        }
        return;
      }

      // F7 Held list — toggle on sale view (Firefox caret-browse uses F7; always preventDefault).
      if (view === "sale" && event.key === "F7") {
        event.preventDefault();
        if (heldOpen) {
          setHeldOpen(false);
        } else if (!settingsOpen && !transactionsOpen && !shiftOpen) {
          openHeldList();
        }
        return;
      }

      // Settings / Transactions / Shift / Held list own Esc / ←→ / Enter — do not cancel sale or cart nav.
      if (settingsOpen || transactionsOpen || shiftOpen || heldOpen) {
        return;
      }

      // F6 Hold (Batch AN) — works while Payment / Cash / Card / MFS / loyalty modals are open.
      if (view === "sale" && event.key === "F6") {
        event.preventDefault();
        holdActiveSale();
        return;
      }

      // Qty modal: Esc = back to batch (handled in modal); block Cancel Sale.
      if (qtyOpen) {
        if (event.key === "Escape") {
          event.preventDefault();
          onBackToBatch();
        }
        return;
      }

      // Edit / Change Batch / Manager Auth / Select Batch / Select Customer / confirms.
      if (managerAuthOpen) {
        if (event.key === "Escape") {
          event.preventDefault();
          onBackFromManagerAuth();
        }
        return;
      }

      if (changeBatchOpen) {
        if (event.key === "Escape") {
          event.preventDefault();
          onBackFromChangeBatch();
        }
        return;
      }

      if (
        selectCustomerOpen ||
        substitutesOpen ||
        loyaltyModalOpen ||
        completeSaleZeroPayOpen ||
        paymentSelectMethodOpen ||
        cashPaymentOpen ||
        cardPaymentOpen ||
        mfsPaymentOpen
      ) {
        // Modal owns Enter / Esc / ←→ — do not cancel sale or open another modal.
        return;
      }

      if (editOpen || batchOpen || confirmDialogOpen) {
        if (event.key === "Escape") {
          event.preventDefault();
          if (editOpen) closeEditModal();
          else closeModals();
        }
        return;
      }

      // Ctrl+K / Cmd+K — focus search (even while typing elsewhere).
      if (
        view === "sale" &&
        (event.key === "k" || event.key === "K") &&
        (event.ctrlKey || event.metaKey)
      ) {
        event.preventDefault();
        focusSearch();
        return;
      }

      // F10 — Proceed (loyalty / zero-pay complete / Slice 3 gate).
      if (event.key === "F10") {
        event.preventDefault();
        onProceedToPayment();
        return;
      }

      // Esc — Cancel Sale → Counter Ready (confirm if cart non-empty).
      if (event.key === "Escape" && view === "sale") {
        event.preventDefault();
        requestCancelSale();
        return;
      }

      // Active Cart keys when lines exist and no modal.
      // Skip while typing in search/qty inputs (search owns ↑↓ there).
      if (
        view === "sale" &&
        !qtyOpen &&
        !batchOpen &&
        !editOpen &&
        !changeBatchOpen &&
        !managerAuthOpen &&
        !selectCustomerOpen &&
        !substitutesOpen &&
        !loyaltyModalOpen &&
        !completeSaleZeroPayOpen &&
        !paymentSelectMethodOpen &&
        !cashPaymentOpen &&
        !cardPaymentOpen &&
        !mfsPaymentOpen &&
        !confirmDialogOpen &&
        cartLines.length > 0 &&
        !inEditable
      ) {
        const selected = cartLines[selectedCartIndex];

        if (event.key === "ArrowDown") {
          event.preventDefault();
          setSelectedCartIndex((i) => (i + 1) % cartLines.length);
          return;
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          setSelectedCartIndex(
            (i) => (i - 1 + cartLines.length) % cartLines.length,
          );
          return;
        }
        if (
          (event.key === "+" || event.key === "=") &&
          selected
        ) {
          event.preventDefault();
          onChangeQty(selected.id, selected.unitQty + 1);
          return;
        }
        if ((event.key === "-" || event.key === "_") && selected) {
          event.preventDefault();
          onChangeQty(selected.id, selected.unitQty - 1);
          return;
        }
        if (
          (event.key === "Delete" || event.key === "Backspace") &&
          selected
        ) {
          event.preventDefault();
          requestRemoveLine(selected.id);
          return;
        }
      }

      // F4 — Generic Substitutes (Batch AG). Works while search is focused.
      if (view === "sale" && event.key === "F4") {
        event.preventDefault();
        openSubstitutes();
        return;
      }

      if (inEditable) return;

      if (event.key === "F2") {
        event.preventDefault();
        startNewSale();
        return;
      }

      // `/` focuses search on Empty POS (master-plan keyboard map).
      if (view === "sale" && event.key === "/") {
        event.preventDefault();
        focusSearch();
        return;
      }

      // F8 — Select Customer (Batch R). No Baki / create form / loyalty redeem.
      if (view === "sale" && event.key === "F8") {
        event.preventDefault();
        openSelectCustomer();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    status,
    view,
    settingsOpen,
    transactionsOpen,
    shiftOpen,
    heldOpen,
    qtyOpen,
    batchOpen,
    editOpen,
    changeBatchOpen,
    managerAuthOpen,
    selectCustomerOpen,
    substitutesOpen,
    loyaltyModalOpen,
    completeSaleZeroPayOpen,
    paymentSelectMethodOpen,
    cashPaymentOpen,
    cardPaymentOpen,
    mfsPaymentOpen,
    confirmDialogOpen,
    cartLines,
    selectedCartIndex,
    startNewSale,
    holdActiveSale,
    openHeldList,
    printPhase,
    onRetryPrint,
    requestCancelSale,
    focusSearch,
    closeModals,
    closeEditModal,
    onBackToBatch,
    onBackFromChangeBatch,
    onBackFromManagerAuth,
    onChangeQty,
    requestRemoveLine,
    openSelectCustomer,
    openSubstitutes,
    onProceedToPayment,
  ]);

  const onCounter = view === "counter";
  const onCompleted = view === "completed" && completedSale != null;

  return (
    <>
      <AppShell
        cashierLabel={cashierLabel}
        cashierDisplayName={cashierLabel}
        cartItemCount={onCounter || onCompleted ? 0 : cartLines.length}
        cartSubtotal={onCounter || onCompleted ? 0 : cartSubtotal}
        loyaltyDiscount={onCounter || onCompleted ? 0 : loyaltyDiscount}
        onClearSale={
          onCounter || onCompleted ? undefined : requestClearSale
        }
        saleCustomer={onCounter || onCompleted ? null : saleCustomer}
        onSelectCustomer={
          onCounter || onCompleted ? undefined : openSelectCustomer
        }
        onProceed={
          onCounter || onCompleted ? undefined : onProceedToPayment
        }
        onHold={onCounter || onCompleted ? undefined : holdActiveSale}
        heldOpen={heldOpen}
        heldCount={onCounter || onCompleted ? 0 : heldCount}
        onOpenHeld={
          onCounter || onCompleted
            ? undefined
            : openHeldList
        }
        onCloseHeld={() => setHeldOpen(false)}
        onResumeHeld={resumeHeldSale}
        onHeldListChanged={refreshHeldCount}
        hideCartPanel={onCompleted}
        footerStatus={
          onCompleted
            ? isPrintBusy(printPhase)
              ? {
                  hint:
                    printPhase === "retrying"
                      ? t("completed.retryingPrint")
                      : t("completed.printingReceipt"),
                  readiness: "busy",
                }
              : printPhase === "printed"
                ? { readiness: "ready" }
                : printPhase === "failed"
                  ? { readiness: "ready" }
                  : null
            : null
        }
        onLogout={() => {
          void logout();
        }}
        onNewSale={startNewSale}
        transactionsOpen={transactionsOpen}
        onOpenTransactions={() => {
          setSettingsOpen(false);
          setShiftOpen(false);
          setHeldOpen(false);
          setTransactionsOpen(true);
        }}
        onCloseTransactions={() => setTransactionsOpen(false)}
        shiftOpen={shiftOpen}
        onOpenShift={() => {
          setSettingsOpen(false);
          setTransactionsOpen(false);
          setHeldOpen(false);
          setShiftOpen(true);
        }}
        onCloseShift={() => setShiftOpen(false)}
        onShiftChanged={() => setShiftEpoch((n) => n + 1)}
        settingsOpen={settingsOpen}
        onOpenSettings={() => {
          setTransactionsOpen(false);
          setShiftOpen(false);
          setHeldOpen(false);
          setSettingsOpen(true);
        }}
        onCloseSettings={() => setSettingsOpen(false)}
        main={
          onCounter ? (
            <CounterReadyScreen
              onNewSale={startNewSale}
              shiftEpoch={shiftEpoch}
            />
          ) : onCompleted && completedSale && completedReceipt ? (
            <SaleCompletedScreen
              txnLabel={completedSale.txnLabel}
              customer={completedSale.customer}
              lines={completedSale.lines}
              cartSubtotal={completedSale.cartSubtotal}
              loyaltyTaka={completedSale.loyaltyTaka}
              settlement={completedSale.settlement}
              cashSettlement={completedSale.cashSettlement}
              cardSettlement={completedSale.cardSettlement}
              mfsSettlement={completedSale.mfsSettlement}
              receipt={completedReceipt}
              printPhase={printPhase}
              onRetryPrint={onRetryPrint}
              onReprintReceipt={onReprintReceipt}
              onNewSale={startNewSale}
            />
          ) : (
            <EmptyPosScreen
              searchInputRef={searchInputRef}
              onCancelSale={requestCancelSale}
              hasCartItems={cartLines.length > 0}
              onFocusedProductChange={setSearchFocusedProduct}
              onSelectProduct={(product) => {
                setModal({ kind: "batch", product });
              }}
            />
          )
        }
        cartBody={
          onCounter || onCompleted ? (
            <div className="flex h-full min-h-[8rem] flex-col items-center justify-center px-2 text-center">
              <p className="text-sm text-muted">{t("cart.noActiveSale")}</p>
              <p className="mt-1 text-xs text-muted">
                {t("cart.pressF2ToBegin")}
              </p>
            </div>
          ) : cartLines.length === 0 ? (
            <EmptyCartBody />
          ) : (
            <CartLinesBody
              lines={cartLines}
              selectedIndex={selectedCartIndex}
              onSelectIndex={setSelectedCartIndex}
              onEdit={onEditLine}
              onChangeQty={onChangeQty}
            />
          )
        }
        overlay={
          modal.kind === "batch" ? (
            <SelectBatchModal
              product={modal.product}
              onClose={closeModals}
              onConfirm={onConfirmBatch}
            />
          ) : modal.kind === "qty" ? (
            <QuantityPackagingModal
              product={modal.product}
              batch={modal.batch}
              onBack={onBackToBatch}
              onClose={closeModals}
              onAddToSale={onAddToSale}
            />
          ) : modal.kind === "edit" && editingLine ? (
            <EditSaleItemModal
              line={editingLine}
              otherSameBatchQuantityBase={otherSameBatchQuantityBase}
              initialDraft={editDraft}
              stagedFefoOverride={
                stagedFefoOverride?.lineId === editingLine.id
                  ? stagedFefoOverride
                  : null
              }
              onClose={closeEditModal}
              onSave={onSaveEditLine}
              onChangeBatch={onOpenChangeBatch}
            />
          ) : modal.kind === "changeBatch" && editingLine ? (
            <ChangeBatchModal
              line={editingLine}
              draft={modal.draft}
              onBack={onBackFromChangeBatch}
              onKeepCurrent={onBackFromChangeBatch}
              onRequestAuthorization={onRequestFefoAuthorization}
            />
          ) : modal.kind === "managerAuth" && editingLine ? (
            <ManagerAuthorizationModal
              line={editingLine}
              draft={modal.draft}
              requestedBatch={modal.requestedBatch}
              fefoBatch={modal.fefoBatch}
              onBack={onBackFromManagerAuth}
              onCancel={onBackFromManagerAuth}
              onAuthorized={onFefoOverrideAuthorized}
            />
          ) : modal.kind === "selectCustomer" ? (
            <SelectCustomerModal
              onClose={closeModals}
              onSelect={onSelectCustomer}
              onWalkIn={onWalkInCustomer}
            />
          ) : modal.kind === "substitutes" ? (
            <GenericSubstitutesModal
              source={modal.source}
              onClose={closeModals}
              onSelect={onSelectSubstitute}
            />
          ) : modal.kind === "redeemLoyalty" && saleCustomer ? (
            <RedeemLoyaltyModal
              customer={saleCustomer}
              saleTotalTaka={cartSubtotal}
              onClose={closeModals}
              onContinueWithout={onContinueWithoutRedeeming}
              onRedeem={onRedeemLoyalty}
            />
          ) : modal.kind === "verifyLoyaltyOtp" && saleCustomer ? (
            <VerifyLoyaltyOtpModal
              customer={saleCustomer}
              redeemPoints={modal.redeemPoints}
              saleTotalTaka={cartSubtotal}
              onCancelRedemption={onCancelLoyaltyOtp}
              onClose={closeModals}
              onVerified={onLoyaltyOtpVerified}
            />
          ) : modal.kind === "completeSaleZeroPay" &&
            saleCustomer &&
            appliedLoyalty ? (
            <CompleteSaleZeroPayModal
              customer={saleCustomer}
              lines={cartLines}
              cartSubtotal={cartSubtotal}
              loyaltyPointsUsed={appliedLoyalty.points}
              loyaltyTaka={appliedLoyalty.taka}
              loyaltyBalanceAfterRedeem={Math.max(
                0,
                saleCustomer.loyaltyPoints - appliedLoyalty.points,
              )}
              submitting={completingSale}
              onBack={onBackFromCompleteSale}
              onComplete={() => {
                void onConfirmCompleteZeroPay();
              }}
            />
          ) : modal.kind === "paymentSelectMethod" ? (
            <PaymentSelectMethodModal
              amountDue={amountDue}
              customer={saleCustomer}
              onClose={closeModals}
              onSelectCash={onSelectCashPayment}
              onSelectCard={onSelectCardPayment}
              onSelectMfs={onSelectMfsPayment}
            />
          ) : modal.kind === "cashPayment" ? (
            <CashPaymentModal
              amountDue={amountDue}
              customer={saleCustomer}
              submitting={completingSale}
              onClose={closeModals}
              onBackToMethods={onBackToPaymentMethods}
              onComplete={(draft) => {
                void onCompleteCashPayment(draft);
              }}
            />
          ) : modal.kind === "cardPayment" ? (
            <CardPaymentModal
              amountDue={amountDue}
              customer={saleCustomer}
              submitting={completingSale}
              abortSignal={tenderAbortRef.current.signal}
              onClose={closeModals}
              onBackToMethods={onBackToPaymentMethods}
              onApproved={onCardPaymentApproved}
            />
          ) : modal.kind === "mfsPayment" ? (
            <MfsPaymentModal
              amountDue={amountDue}
              customer={saleCustomer}
              submitting={completingSale}
              abortSignal={tenderAbortRef.current.signal}
              onClose={closeModals}
              onBackToMethods={onBackToPaymentMethods}
              onCollected={onMfsPaymentCollected}
            />
          ) : modal.kind === "removeConfirm" && removingLine ? (
            <ConfirmDialog
              title={t("remove.title")}
              description={t("remove.description")}
              detailCard={{
                title: removingLine.productName,
                subtitle:
                  removingLine.genericName?.trim() ||
                  [removingLine.strength, removingLine.form]
                    .filter(Boolean)
                    .join(" ") ||
                  null,
                highlight: formatTaka(removingLine.lineTotal),
                fields: [
                  { label: t("pos.batch"), value: removingLine.batchNumber },
                  {
                    label: t("pos.exp"),
                    value: formatExpiryMonthYear(removingLine.expiryDate),
                  },
                  {
                    label: t("pos.unit"),
                    value:
                      removingLine.unitType === "PIECE"
                        ? t("pos.piece")
                        : removingLine.unitType === "STRIP"
                          ? t("pos.strip")
                          : t("pos.box"),
                  },
                  {
                    label: t("edit.qty"),
                    value: String(removingLine.unitQty),
                  },
                ],
              }}
              warning={
                cartLines.length <= 1
                  ? t("remove.warningLast")
                  : t("remove.warning")
              }
              confirmLabel={t("remove.confirm")}
              cancelLabel={t("remove.keep")}
              escHint={t("remove.escHint")}
              destructive
              onConfirm={confirmRemoveLine}
              onCancel={closeModals}
            />
          ) : modal.kind === "clearConfirm" ? (
            <ConfirmDialog
              title={t("clear.title")}
              description={t("clear.description")}
              detailCard={{
                title: t("clear.currentSale"),
                subtitle: t("cart.activeCart"),
                highlight: formatTaka(cartSubtotal),
                fields: [
                  {
                    label: t("clear.lines"),
                    value: String(cartLines.length),
                  },
                  {
                    label: t("clear.units"),
                    value: String(unitsDispensed),
                  },
                  {
                    label: t("cart.subtotal"),
                    value: formatTaka(cartSubtotal),
                  },
                  {
                    label: t("clear.status"),
                    value: t("clear.notCharged"),
                  },
                ],
              }}
              warning={t("clear.warning")}
              confirmLabel={t("clear.confirm")}
              cancelLabel={t("clear.keepItems")}
              escHint={t("clear.escHint")}
              destructive
              onConfirm={confirmClearSale}
              onCancel={closeModals}
            />
          ) : modal.kind === "cancelConfirm" ? (
            <ConfirmDialog
              title={t("cancelSale.title")}
              description={t("cancelSale.description")}
              detailCard={{
                title: t("clear.currentSale"),
                subtitle: t("cancelSale.subtitle"),
                highlight: formatTaka(cartSubtotal),
                fields: [
                  {
                    label: t("clear.lines"),
                    value: String(cartLines.length),
                  },
                  {
                    label: t("clear.units"),
                    value: String(unitsDispensed),
                  },
                  {
                    label: t("cart.subtotal"),
                    value: formatTaka(cartSubtotal),
                  },
                  {
                    label: t("cancelSale.next"),
                    value: t("counter.readyTitle"),
                  },
                ],
              }}
              warning={t("cancelSale.warning")}
              confirmLabel={t("cancelSale.confirm")}
              cancelLabel={t("cancelSale.keepSelling")}
              escHint={t("cancelSale.escHint")}
              destructive
              onConfirm={confirmCancelSale}
              onCancel={closeModals}
            />
          ) : null
        }
      />
      {posToast ? (
        <PosToast
          message={posToast.message}
          tone={posToast.tone}
          onDismiss={() => setPosToast(null)}
        />
      ) : null}
    </>
  );
}
