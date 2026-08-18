import {
  Info,
  Plus,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocale } from "@/i18n";
import { ApiError } from "@/lib/api";
import { formatCount, formatTaka, formatUtcDate } from "@/lib/format";
import { fetchOwnerInventory } from "@/lib/ownerInventory";
import { useOwnerPath } from "@/lib/OwnerPathProvider";
import {
  confirmGoodsReceipt,
  fetchPurchaseOrder,
  type PurchaseOrderDetail,
  type PurchaseOrderStatus,
} from "@/lib/purchaseOrders";
import { useTenantChrome } from "@/lib/TenantContextProvider";

type ReceiveLot = {
  key: string;
  batchNumber: string;
  expiryDate: string;
  qty: string;
  costPerBase: string;
  sellPerBase: string;
};

type ReceiveLine = {
  lineId: string;
  productId: string;
  productName: string;
  genericName: string | null;
  sku: string | null;
  qtyOrdered: number;
  qtyReceived: number;
  remaining: number;
  costPerBase: number;
  lots: ReceiveLot[];
};

function newLotKey(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `lot-${Math.random().toString(36).slice(2)}`;
}

function todayYmd(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function parseNum(value: string): number {
  const n = Number(value.trim());
  return Number.isFinite(n) ? n : NaN;
}

function lotIsValid(lot: ReceiveLot): boolean {
  if (!lot.batchNumber.trim() || !lot.expiryDate) return false;
  const qty = parseNum(lot.qty);
  const cost = parseNum(lot.costPerBase);
  const sell = parseNum(lot.sellPerBase);
  if (!Number.isInteger(qty) || qty <= 0) return false;
  if (Number.isNaN(cost) || cost < 0) return false;
  if (Number.isNaN(sell) || sell < 0) return false;
  return true;
}

function buildDraftLines(po: PurchaseOrderDetail): ReceiveLine[] {
  return po.lines.map((line) => {
    const remaining = Math.max(0, line.qtyOrdered - line.qtyReceived);
    return {
      lineId: line.id,
      productId: line.product.id,
      productName: line.product.name,
      genericName: line.product.genericName,
      sku: line.product.sku,
      qtyOrdered: line.qtyOrdered,
      qtyReceived: line.qtyReceived,
      remaining,
      costPerBase: line.costPerBase,
      lots: [
        {
          key: newLotKey(),
          batchNumber: "",
          expiryDate: "",
          qty: String(remaining),
          costPerBase: line.costPerBase > 0 ? String(line.costPerBase) : "",
          sellPerBase: "",
        },
      ],
    };
  });
}

/**
 * Receive Stock against a Purchase Order (Batch W, Screen 12).
 * Form layout matched to restored specification design:
 * - Top header with Breadcrumbs, dynamic subtitle, top action buttons
 * - Receipt Details card with 2-column key-value layout
 * - Received Items card with inline editable table + "+ Add Batch"
 * - Receipt Summary card with metrics & PO confirmation status badge
 * - Inventory Impact card showing live On-Hand stock projections
 * - Sticky/Standard footer with confirmation notice & action buttons
 */
export function ReceiveAgainstPurchaseOrderPage({ poId }: { poId: string }) {
  const { t } = useLocale();
  const { navigate } = useOwnerPath();
  const { storeName } = useTenantChrome();

  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrderDetail | null>(
    null,
  );
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  const [draftLines, setDraftLines] = useState<ReceiveLine[]>([]);
  const [receivedDate, setReceivedDate] = useState(todayYmd);
  const [invoiceRef, setInvoiceRef] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchPurchaseOrder(poId)
      .then((payload) => {
        if (cancelled) return;
        setPurchaseOrder(payload);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setPurchaseOrder(null);
        setLoading(false);
        if (err instanceof ApiError && err.statusCode === 404) {
          setError(t("purchasing.receive.notFound"));
        } else if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError(t("purchasing.receive.error"));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [poId, reload, t]);

  useEffect(() => {
    let cancelled = false;
    void fetchOwnerInventory({ limit: 200 })
      .then((payload) => {
        if (cancelled) return;
        const map: Record<string, number> = {};
        for (const item of payload.items) {
          map[item.productId] = item.quantityOnHand;
        }
        setStockMap(map);
      })
      .catch(() => {
        // Fallback gracefully
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (purchaseOrder) {
      setDraftLines(buildDraftLines(purchaseOrder));
    }
  }, [purchaseOrder]);

  const summary = useMemo(() => {
    let lineItemsCount = 0;
    let batchesCreatedCount = 0;
    let unitsReceiving = 0;
    let actualStockCost = 0;
    let retailValue = 0;
    let unitsRemainingBefore = 0;
    let hasOverReceive = false;
    let hasValidLot = false;

    for (const line of draftLines) {
      unitsRemainingBefore += line.remaining;
      const validLotsForLine = line.lots.filter(lotIsValid);
      const plannedQtyForLine = line.lots.reduce((sum, lot) => {
        const q = parseNum(lot.qty);
        return sum + (Number.isInteger(q) && q > 0 ? q : 0);
      }, 0);

      if (plannedQtyForLine > line.remaining) {
        hasOverReceive = true;
      }

      if (validLotsForLine.length > 0) {
        lineItemsCount += 1;
        batchesCreatedCount += validLotsForLine.length;
        hasValidLot = true;
      }

      for (const lot of validLotsForLine) {
        const q = parseNum(lot.qty);
        const cost = parseNum(lot.costPerBase);
        const sell = parseNum(lot.sellPerBase);
        unitsReceiving += q;
        actualStockCost += q * cost;
        retailValue += q * sell;
      }
    }

    const unitsRemainingAfter = Math.max(0, unitsRemainingBefore - unitsReceiving);
    const margin =
      retailValue > 0 ? ((retailValue - actualStockCost) / retailValue) * 100 : null;

    return {
      lineItemsCount: lineItemsCount || draftLines.filter((l) => l.remaining > 0).length,
      batchesCreatedCount: batchesCreatedCount || draftLines.reduce((s, l) => s + l.lots.length, 0),
      unitsReceiving,
      actualStockCost,
      retailValue,
      margin,
      unitsRemainingBefore,
      unitsRemainingAfter,
      hasOverReceive,
      hasValidLot,
    };
  }, [draftLines]);

  function updateLot(
    lineIndex: number,
    lotKey: string,
    patch: Partial<ReceiveLot>,
  ) {
    setDraftLines((lines) =>
      lines.map((line, idx) =>
        idx !== lineIndex
          ? line
          : {
              ...line,
              lots: line.lots.map((lot) =>
                lot.key === lotKey ? { ...lot, ...patch } : lot,
              ),
            },
      ),
    );
  }

  function onAddBatch(lineIndex: number) {
    setDraftLines((lines) =>
      lines.map((line, idx) => {
        if (idx !== lineIndex) return line;
        const currentPlanned = line.lots.reduce((sum, l) => {
          const q = parseNum(l.qty);
          return sum + (Number.isInteger(q) && q > 0 ? q : 0);
        }, 0);
        const left = Math.max(0, line.remaining - currentPlanned);
        return {
          ...line,
          lots: [
            ...line.lots,
            {
              key: newLotKey(),
              batchNumber: "",
              expiryDate: "",
              qty: left > 0 ? String(left) : "0",
              costPerBase: line.costPerBase > 0 ? String(line.costPerBase) : "",
              sellPerBase: "",
            },
          ],
        };
      }),
    );
  }

  function removeLot(lineIndex: number, lotKey: string) {
    setDraftLines((lines) =>
      lines.map((line, idx) =>
        idx !== lineIndex
          ? line
          : { ...line, lots: line.lots.filter((lot) => lot.key !== lotKey) },
      ),
    );
  }

  async function handleConfirm() {
    if (!purchaseOrder || !summary.hasValidLot || summary.hasOverReceive) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await confirmGoodsReceipt(purchaseOrder.id, {
        supplierInvoiceRef: invoiceRef,
        deliveryNote,
        receivedAt: receivedDate
          ? new Date(`${receivedDate}T00:00:00.000Z`).toISOString()
          : undefined,
        lines: draftLines.flatMap((line) =>
          line.lots.filter(lotIsValid).map((lot) => ({
            purchaseOrderLineId: line.lineId,
            productId: line.productId,
            qty: parseNum(lot.qty),
            batchNumber: lot.batchNumber.trim(),
            expiryDate: lot.expiryDate,
            costPerBase: parseNum(lot.costPerBase),
            sellPerBase: parseNum(lot.sellPerBase),
          })),
        ),
      });
      navigate(`/purchasing/${encodeURIComponent(purchaseOrder.id)}`);
    } catch (err) {
      setSubmitError(
        err instanceof ApiError ? err.message : t("purchasing.receive.submitError"),
      );
      setSubmitting(false);
    }
  }

  const canSubmit = !submitting && summary.hasValidLot && !summary.hasOverReceive;
  const backToPo = () =>
    navigate(
      purchaseOrder
        ? `/purchasing/${encodeURIComponent(purchaseOrder.id)}`
        : "/purchasing",
    );

  return (
    <div className="w-full px-6 py-5">
      {/* Breadcrumb Nav */}
      <nav aria-label={t("header.breadcrumb")} className="mb-2 flex items-center gap-1.5 text-xs text-slate-500">
        <button
          type="button"
          className="hover:text-slate-900 hover:underline"
          onClick={() => navigate("/purchasing")}
        >
          {t("nav.purchasing")}
        </button>
        <span className="text-slate-400">›</span>
        {purchaseOrder ? (
          <>
            <button
              type="button"
              className="hover:text-slate-900 hover:underline"
              onClick={() => navigate(`/purchasing/${encodeURIComponent(purchaseOrder.id)}`)}
            >
              {purchaseOrder.poNumber}
            </button>
            <span className="text-slate-400">›</span>
          </>
        ) : null}
        <span className="font-semibold text-slate-800">{t("purchasing.receive.crumb")}</span>
      </nav>

      {/* Header with Title, Subtitle, and Top Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {t("purchasing.receive.title")}
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {purchaseOrder
              ? `${t("purchasing.receive.subtitleWithPo")} ${purchaseOrder.poNumber}.`
              : t("purchasing.receive.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled
            aria-disabled="true"
            title={t("purchasing.receive.saveDraftSoon")}
            className="rounded-md border border-slate-300/80 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t("purchasing.receive.saveDraft")}
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => void handleConfirm()}
            className="rounded-md bg-[#0D9488] px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting
              ? t("purchasing.receive.confirming")
              : t("purchasing.receive.confirm")}
          </button>
        </div>
      </div>

      {loading && !purchaseOrder ? (
        <p className="mt-6 text-sm text-slate-500">{t("purchasing.receive.loading")}</p>
      ) : null}

      {error && !purchaseOrder ? (
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50/50 p-4 text-sm">
          <p className="text-destructive font-medium">{error}</p>
          <button
            type="button"
            className="rounded-md border border-slate-300 bg-white px-3 py-1 text-slate-700 shadow-sm hover:bg-slate-50"
            onClick={() => setReload((n) => n + 1)}
          >
            {t("purchasing.receive.retry")}
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-300 bg-white px-3 py-1 text-slate-700 shadow-sm hover:bg-slate-50"
            onClick={() => navigate("/purchasing")}
          >
            {t("purchasing.receive.back")}
          </button>
        </div>
      ) : null}

      {purchaseOrder ? (
        <div className="mt-5 grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          {/* Left Column (Receipt Details + Received Items) */}
          <div className="flex flex-col gap-6 lg:col-span-8">
            {/* Card 1: Receipt Details */}
            <section className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
              <h2 className="mb-5 text-base font-bold text-slate-800">
                {t("purchasing.receive.details.title")}
              </h2>
              <div className="grid grid-cols-1 gap-x-10 gap-y-5 md:grid-cols-2">
                {/* Left Sub-column */}
                <div className="flex flex-col gap-4">
                  <div>
                    <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      {t("purchasing.receive.details.supplier")}
                    </span>
                    <p className="text-sm font-semibold text-slate-800">
                      {purchaseOrder.supplier?.name ?? "—"}
                    </p>
                  </div>
                  <div>
                    <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      {t("purchasing.receive.details.poStatus")}
                    </span>
                    <div>
                      <StatusBadge status={purchaseOrder.status} />
                    </div>
                  </div>
                  <div>
                    <label className="block">
                      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        {t("purchasing.receive.details.invoiceLabel")}{" "}
                        <span className="text-red-500">*</span>
                      </span>
                      <input
                        type="text"
                        value={invoiceRef}
                        onChange={(event) => setInvoiceRef(event.target.value)}
                        placeholder={t("purchasing.receive.details.invoicePlaceholder")}
                        className="w-full rounded-md border border-slate-200 bg-slate-50/40 px-3 py-2 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-teal-600 focus:bg-white focus:ring-1 focus:ring-teal-600"
                      />
                    </label>
                  </div>
                  <div>
                    <label className="block">
                      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        {t("purchasing.receive.details.deliveryLabel")}
                      </span>
                      <input
                        type="text"
                        value={deliveryNote}
                        onChange={(event) => setDeliveryNote(event.target.value)}
                        placeholder={t("purchasing.receive.details.deliveryPlaceholder")}
                        className="w-full rounded-md border border-slate-200 bg-slate-50/40 px-3 py-2 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-teal-600 focus:bg-white focus:ring-1 focus:ring-teal-600"
                      />
                    </label>
                  </div>
                </div>

                {/* Right Sub-column */}
                <div className="flex flex-col gap-4">
                  <div>
                    <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      {t("purchasing.receive.details.poNumber")}
                    </span>
                    <p
                      className="text-sm font-semibold text-slate-800"
                      title={
                        purchaseOrder.expectedDelivery
                          ? `${t("purchasing.receive.expected")}: ${formatUtcDate(purchaseOrder.expectedDelivery)}`
                          : undefined
                      }
                    >
                      {purchaseOrder.poNumber}
                    </p>
                  </div>
                  <div>
                    <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      {t("purchasing.receive.details.branch")}
                    </span>
                    <p className="text-sm font-semibold text-slate-800">
                      {purchaseOrder.store?.name ?? storeName ?? "Main Branch"}
                    </p>
                  </div>
                  <div>
                    <label className="block">
                      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        {t("purchasing.receive.details.receivedDateLabel")}{" "}
                        <span className="text-red-500">*</span>
                      </span>
                      <input
                        type="date"
                        value={receivedDate}
                        onChange={(event) => setReceivedDate(event.target.value)}
                        className="w-full rounded-md border border-slate-200 bg-slate-50/40 px-3 py-2 text-sm text-slate-800 outline-none transition-colors focus:border-teal-600 focus:bg-white focus:ring-1 focus:ring-teal-600"
                      />
                    </label>
                  </div>
                  <div>
                    <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      {t("purchasing.receive.details.receivedBy")}
                    </span>
                    <p className="text-sm font-semibold text-slate-800">
                      {purchaseOrder.createdBy?.name ?? "Demo Owner"}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Card 2: Received Items Table */}
            <section className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
              <h2 className="text-base font-bold text-slate-800">
                {t("purchasing.receive.items.title")}
              </h2>
              <p className="mt-0.5 mb-5 text-xs text-slate-500">
                {t("purchasing.receive.items.subtitle")}
              </p>

              {draftLines.length === 0 ? (
                <div className="py-6 text-center text-sm text-slate-500">
                  {t("purchasing.receive.noLines")}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <th className="pb-3 pr-3 font-bold">{t("purchasing.receive.col.medicine")}</th>
                        <th className="pb-3 px-2 text-right font-bold">{t("purchasing.receive.col.ordered")}</th>
                        <th className="pb-3 px-2 text-right font-bold">{t("purchasing.receive.col.prevRecv")}</th>
                        <th className="pb-3 px-2 text-center font-bold">{t("purchasing.receive.col.recvNow")}</th>
                        <th className="pb-3 px-2 text-right font-bold">{t("purchasing.receive.col.remAfter")}</th>
                        <th className="pb-3 px-2 font-bold">{t("purchasing.receive.col.batchNumber")}</th>
                        <th className="pb-3 px-2 font-bold">{t("purchasing.receive.col.expiry")}</th>
                        <th className="pb-3 px-2 font-bold">{t("purchasing.receive.col.unitCost")}</th>
                        <th className="pb-3 px-2 font-bold">{t("purchasing.receive.col.sellPrice")}</th>
                        <th className="pb-3 pl-2 text-center font-bold">{t("purchasing.receive.col.status")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {draftLines.map((line, lineIndex) => {
                        const totalPlannedForLine = line.lots.reduce((sum, lot) => {
                          const q = parseNum(lot.qty);
                          return sum + (Number.isInteger(q) && q > 0 ? q : 0);
                        }, 0);
                        const remAfterForLine = line.remaining - totalPlannedForLine;
                        const lineOverReceive = totalPlannedForLine > line.remaining;

                        return line.lots.map((lot, lotIndex) => {
                          const valid = lotIsValid(lot);
                          const isFirstLot = lotIndex === 0;

                          return (
                            <tr key={lot.key} className="group hover:bg-slate-50/50">
                              {/* Medicine Column */}
                              <td className="py-3.5 pr-3 align-top">
                                {isFirstLot ? (
                                  <div>
                                    <p className="font-semibold text-slate-900">
                                      {line.productName}
                                    </p>
                                    {line.genericName ? (
                                      <p className="text-[11px] text-slate-500">
                                        ({line.genericName})
                                      </p>
                                    ) : null}
                                    <button
                                      type="button"
                                      onClick={() => onAddBatch(lineIndex)}
                                      className="mt-1 inline-flex items-center gap-0.5 text-[11px] font-semibold text-teal-600 hover:text-teal-700"
                                    >
                                      <Plus className="size-3" strokeWidth={2.5} />
                                      {t("purchasing.receive.addBatch")}
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 pt-1 pl-2 text-[11px] text-slate-400">
                                    <span>Lot #{lotIndex + 1}</span>
                                    <button
                                      type="button"
                                      onClick={() => removeLot(lineIndex, lot.key)}
                                      aria-label={t("purchasing.receive.lot.remove")}
                                      className="text-slate-400 hover:text-red-500"
                                    >
                                      <X className="size-3" />
                                    </button>
                                  </div>
                                )}
                              </td>

                              {/* Ordered */}
                              <td className="py-3.5 px-2 text-right align-top font-medium text-slate-700">
                                {isFirstLot ? formatCount(line.qtyOrdered) : "—"}
                              </td>

                              {/* Prev Received */}
                              <td className="py-3.5 px-2 text-right align-top font-medium text-slate-700">
                                {isFirstLot ? formatCount(line.qtyReceived) : "—"}
                              </td>

                              {/* Recv. Now */}
                              <td className="py-3.5 px-2 text-center align-top">
                                <input
                                  type="number"
                                  min={0}
                                  value={lot.qty}
                                  onChange={(event) =>
                                    updateLot(lineIndex, lot.key, { qty: event.target.value })
                                  }
                                  className="w-16 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-center text-xs font-semibold text-slate-800 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                                />
                              </td>

                              {/* Rem. After */}
                              <td className="py-3.5 px-2 text-right align-top">
                                {isFirstLot ? (
                                  <span
                                    className={`font-semibold ${
                                      remAfterForLine < 0 ? "text-red-600" : "text-slate-700"
                                    }`}
                                  >
                                    {formatCount(remAfterForLine)}
                                  </span>
                                ) : (
                                  "—"
                                )}
                              </td>

                              {/* Batch Number */}
                              <td className="py-3.5 px-2 align-top">
                                <input
                                  type="text"
                                  value={lot.batchNumber}
                                  placeholder={t("purchasing.receive.lot.batchPlaceholder")}
                                  onChange={(event) =>
                                    updateLot(lineIndex, lot.key, { batchNumber: event.target.value })
                                  }
                                  className="w-28 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 placeholder:text-slate-400 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                                />
                              </td>

                              {/* Expiry */}
                              <td className="py-3.5 px-2 align-top">
                                <input
                                  type="date"
                                  value={lot.expiryDate}
                                  onChange={(event) =>
                                    updateLot(lineIndex, lot.key, { expiryDate: event.target.value })
                                  }
                                  className="w-28 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                                />
                              </td>

                              {/* Unit Cost */}
                              <td className="py-3.5 px-2 align-top">
                                <div className="flex w-24 items-center rounded-md border border-slate-200 bg-white focus-within:border-teal-600 focus-within:ring-1 focus-within:ring-teal-600">
                                  <span className="select-none pl-2 pr-0.5 text-xs font-medium text-slate-400">
                                    &#2547;
                                  </span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min={0}
                                    value={lot.costPerBase}
                                    onChange={(event) =>
                                      updateLot(lineIndex, lot.key, { costPerBase: event.target.value })
                                    }
                                    className="w-full bg-transparent py-1.5 pr-2 text-right text-xs font-medium text-slate-800 outline-none"
                                  />
                                </div>
                              </td>

                              {/* Sell Price */}
                              <td className="py-3.5 px-2 align-top">
                                <div className="flex w-24 items-center rounded-md border border-slate-200 bg-white focus-within:border-teal-600 focus-within:ring-1 focus-within:ring-teal-600">
                                  <span className="select-none pl-2 pr-0.5 text-xs font-medium text-slate-400">
                                    &#2547;
                                  </span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min={0}
                                    value={lot.sellPerBase}
                                    onChange={(event) =>
                                      updateLot(lineIndex, lot.key, { sellPerBase: event.target.value })
                                    }
                                    className="w-full bg-transparent py-1.5 pr-2 text-right text-xs font-medium text-slate-800 outline-none"
                                  />
                                </div>
                              </td>

                              {/* Status Badge */}
                              <td className="py-3.5 pl-2 text-center align-top">
                                {lineOverReceive ? (
                                  <span className="inline-block rounded border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">
                                    {t("purchasing.receive.status.exceeds")}
                                  </span>
                                ) : valid ? (
                                  <span className="inline-block rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
                                    {t("purchasing.receive.status.valid")}
                                  </span>
                                ) : (
                                  <span className="inline-block rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                                    {t("purchasing.receive.status.incomplete")}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        });
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          {/* Right Column (Receipt Summary + Inventory Impact) */}
          <div className="flex flex-col gap-6 lg:col-span-4">
            {/* Card 3: Receipt Summary */}
            <section className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
              <h2 className="mb-5 text-base font-bold text-slate-800">
                {t("purchasing.receive.summary.title")}
              </h2>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{t("purchasing.receive.summary.lineItems")}</span>
                  <span className="font-bold text-slate-900">{formatCount(summary.lineItemsCount)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{t("purchasing.receive.summary.batchesCreated")}</span>
                  <span className="font-bold text-slate-900">{formatCount(summary.batchesCreatedCount)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{t("purchasing.receive.summary.unitsReceiving")}</span>
                  <span className="font-bold text-slate-900">{formatCount(summary.unitsReceiving)} pcs</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{t("purchasing.receive.summary.actualStockCost")}</span>
                  <span className="font-bold text-slate-900">{formatTaka(summary.actualStockCost)}</span>
                </div>

                <div className="my-1 border-t border-slate-100" />

                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">{t("purchasing.receive.summary.poUnitsRemainingBefore")}</span>
                  <span className="font-medium text-slate-600">{formatCount(summary.unitsRemainingBefore)} pcs</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{t("purchasing.receive.summary.remainingAfterReceipt")}</span>
                  <span className="font-bold text-slate-900">{formatCount(summary.unitsRemainingAfter)} pcs</span>
                </div>
              </div>

              {/* PO After Confirmation Alert Box */}
              <div className="mt-5 flex items-center justify-between gap-2 rounded-lg border border-teal-200/60 bg-teal-50/70 p-3 text-xs text-teal-900">
                <span className="flex items-center gap-1.5 font-medium">
                  <Info className="size-4 shrink-0 text-teal-600" />
                  {t("purchasing.receive.summary.poAfterConfirmation")}
                </span>
                {summary.unitsRemainingAfter === 0 ? (
                  <span className="rounded border border-emerald-200/80 bg-emerald-100/90 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                    {t("purchasing.status.received")}
                  </span>
                ) : (
                  <span className="rounded border border-amber-200/80 bg-amber-100/90 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                    {t("purchasing.status.partial")}
                  </span>
                )}
              </div>

              {summary.hasOverReceive ? (
                <p className="mt-3 rounded-md bg-red-50 p-2.5 text-xs font-semibold text-red-600">
                  {t("purchasing.receive.lot.exceeds")}
                </p>
              ) : null}

              {submitError ? (
                <p className="mt-3 text-xs font-medium text-destructive">{submitError}</p>
              ) : null}
            </section>

            {/* Card 4: Inventory Impact */}
            <section className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-base font-bold text-slate-800">
                {t("purchasing.receive.impact.title")}
              </h2>
              <div className="flex flex-col">
                {draftLines.length === 0 ? (
                  <p className="text-xs text-slate-400">{t("purchasing.receive.impact.empty")}</p>
                ) : (
                  draftLines.map((line) => {
                    const currentStock = stockMap[line.productId] ?? 0;
                    const receivingForLine = line.lots.reduce((sum, lot) => {
                      const q = parseNum(lot.qty);
                      return sum + (lotIsValid(lot) && q > 0 ? q : 0);
                    }, 0);
                    const afterStock = currentStock + receivingForLine;

                    return (
                      <div
                        key={line.lineId}
                        className="flex items-center justify-between border-b border-slate-100 py-2.5 text-sm last:border-b-0"
                      >
                        <span className="font-medium text-slate-800">{line.productName}</span>
                        <span className="font-semibold text-slate-700">
                          {formatCount(currentStock)} → {formatCount(afterStock)}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </div>
        </div>
      ) : null}

      {/* Bottom Footer Notice & Action Bar */}
      {purchaseOrder ? (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200/70 pt-5">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Info className="size-4 shrink-0 text-slate-400" />
            <span>{t("purchasing.receive.footerNotice")}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={backToPo}
              className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              {t("purchasing.receive.cancel")}
            </button>
            <button
              type="button"
              disabled
              aria-disabled="true"
              title={t("purchasing.receive.saveDraftSoon")}
              className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t("purchasing.receive.saveDraft")}
            </button>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => void handleConfirm()}
              className="rounded-md bg-[#0D9488] px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting
                ? t("purchasing.receive.confirming")
                : t("purchasing.receive.confirm")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatusBadge({ status }: { status: PurchaseOrderStatus }) {
  const { t } = useLocale();
  const cls =
    status === "DRAFT"
      ? "bg-slate-100 text-slate-700 border-slate-200"
      : status === "SENT"
        ? "bg-sky-50 text-sky-700 border-sky-200"
        : status === "PARTIALLY_RECEIVED"
          ? "bg-amber-50 text-amber-700 border-amber-200"
          : "bg-emerald-50 text-emerald-700 border-emerald-200";
  const label =
    status === "DRAFT"
      ? "purchasing.status.draft"
      : status === "SENT"
        ? "purchasing.status.sent"
        : status === "PARTIALLY_RECEIVED"
          ? "purchasing.status.partial"
          : "purchasing.status.received";

  return (
    <span className={`inline-flex rounded-md border px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {t(label)}
    </span>
  );
}