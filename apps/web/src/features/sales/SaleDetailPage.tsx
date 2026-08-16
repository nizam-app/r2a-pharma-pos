import {
  Banknote,
  Check,
  CreditCard,
  Gift,
  Printer,
  Smartphone,
  Store,
  TriangleAlert,
  UserRound,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocale, type MessageKey } from "@/i18n";
import { ApiError } from "@/lib/api";
import { buildSaleActivity, type SaleActivityEvent } from "@/lib/saleActivity";
import {
  formatCount,
  formatDetailDate,
  formatExpiryMonthYear,
  formatTaka,
  formatTime,
  initialsFromName,
} from "@/lib/format";
import { mfsProviderLabel, parseMfsProvider } from "@/lib/mfsProvider";
import { isLoyaltyOnlyTender } from "@/lib/loyaltyTender";
import { useOwnerPath } from "@/lib/OwnerPathProvider";
import { buildReceiptPreview } from "@/lib/receiptPreview";
import {
  amountPaid,
  fetchSale,
  loyaltyCurrent,
  primaryPaymentMethod,
  type SaleDetail,
} from "@/lib/saleDetail";
import { useTenantChrome } from "@/lib/TenantContextProvider";
import { ReprintReceiptModal } from "./ReprintReceiptModal";

const UNIT_KEYS: Record<string, MessageKey> = {
  BOX: "sales.detail.unit.box",
  STRIP: "sales.detail.unit.strip",
  PIECE: "sales.detail.unit.piece",
};

const PAYMENT_KEYS: Record<string, MessageKey> = {
  CASH: "dashboard.payment.cash",
  CARD: "dashboard.payment.card",
  MFS: "dashboard.payment.mfs",
};

/**
 * Live Transaction Details (Batch I). Content region only — chrome is Batch B.
 * GET /sales/:id. Reprint = on-screen preview from sale JSON. Fully settled.
 */
export function SaleDetailPage({ saleId }: { saleId: string }) {
  const { t } = useLocale();
  const { navigate } = useOwnerPath();
  const chrome = useTenantChrome();
  const [sale, setSale] = useState<SaleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [reprintOpen, setReprintOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchSale(saleId)
      .then((payload) => {
        if (cancelled) return;
        setSale(payload);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setSale(null);
        setLoading(false);
        if (err instanceof ApiError && err.statusCode === 404) {
          setError(t("sales.detail.notFound"));
        } else if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError(t("sales.detail.error"));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [saleId, reload, t]);

  const receipt = useMemo(
    () =>
      sale
        ? buildReceiptPreview(sale, {
            storeName: chrome.storeName,
            tenantName: chrome.tenantName,
          })
        : null,
    [sale, chrome.storeName, chrome.tenantName],
  );

  return (
    <div className="w-full px-5 py-4">
      <nav aria-label={t("header.breadcrumb")} className="mb-3 text-sm text-muted">
        <button
          type="button"
          className="hover:text-foreground hover:underline"
          onClick={() => navigate("/sales")}
        >
          {t("nav.sales")}
        </button>
        <span className="px-1.5">›</span>
        <span className="text-foreground">{t("sales.detail.crumb")}</span>
      </nav>

      {loading && !sale ? (
        <p className="text-sm text-muted">{t("sales.detail.loading")}</p>
      ) : null}

      {error && !sale ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
          <p className="text-destructive">{error}</p>
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1 text-foreground hover:bg-canvas"
            onClick={() => setReload((n) => n + 1)}
          >
            {t("sales.retry")}
          </button>
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1 text-foreground hover:bg-canvas"
            onClick={() => navigate("/sales")}
          >
            {t("sales.detail.back")}
          </button>
        </div>
      ) : null}

      {sale ? (
        <SaleDetailBody
          sale={sale}
          storeName={chrome.storeName?.trim() || t("header.storeUnavailable")}
          onReprint={() => setReprintOpen(true)}
        />
      ) : null}

      {reprintOpen && receipt ? (
        <ReprintReceiptModal
          receipt={receipt}
          onClose={() => setReprintOpen(false)}
        />
      ) : null}
    </div>
  );
}

function SaleDetailBody({
  sale,
  storeName,
  onReprint,
}: {
  sale: SaleDetail;
  storeName: string;
  onReprint: () => void;
}) {
  const { t } = useLocale();
  const activity = useMemo(() => buildSaleActivity(sale), [sale]);
  const paid = amountPaid(sale);
  const method = primaryPaymentMethod(sale);
  const txn = sale.receiptNo || sale.id;
  const walkIn = sale.customer == null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {t("sales.detail.title")} {txn}
            </h1>
            <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
              {t("sales.detail.completed")}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">
            {formatDetailDate(sale.soldAt)} {t("sales.detail.at")}{" "}
            {formatTime(sale.soldAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled
            title={t("nav.laterHint")}
            className="cursor-not-allowed rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-muted"
          >
            {t("sales.detail.moreActions")}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            onClick={onReprint}
          >
            <Printer className="size-3.5" strokeWidth={1.75} />
            {t("sales.detail.reprint")}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <SummaryCard
          label={t("sales.detail.status")}
          value={t("sales.detail.completed")}
          icon={
            <span className="mt-0.5 size-2 rounded-full bg-emerald-500" />
          }
        />
        <SummaryCard
          label={t("sales.col.payment")}
          value={paymentLabel(t, sale, method)}
          icon={paymentMethodIcon(sale, method)}
        />
        <SummaryCard
          label={t("sales.detail.totalAmount")}
          value={formatTaka(sale.total)}
        />
        <SummaryCard
          label={t("dashboard.col.cashier")}
          value={sale.cashier.name}
          icon={<UserRound className="size-4 text-muted" strokeWidth={1.75} />}
        />
        <SummaryCard
          label={t("sales.detail.store")}
          value={storeName}
          icon={<Store className="size-4 text-muted" strokeWidth={1.75} />}
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-3">
        <div className="flex flex-col gap-4 xl:col-span-2">
          <CustomerCard sale={sale} walkIn={walkIn} />
          <ItemsCard sale={sale} />
          <ActivityCard events={activity} />
        </div>
        <div className="flex flex-col gap-4">
          <SettlementCard sale={sale} paid={paid} />
          <ReceiptHistoryCard onReprint={onReprint} />
        </div>
      </div>
    </div>
  );
}

function paymentMethodIcon(sale: SaleDetail, method: string | null) {
  if (isLoyaltyOnlyTender(sale)) {
    return <Gift className="size-4 text-muted" strokeWidth={1.75} />;
  }
  if (method === "CASH") {
    return <Banknote className="size-4 text-muted" strokeWidth={1.75} />;
  }
  if (method === "MFS") {
    return <Smartphone className="size-4 text-muted" strokeWidth={1.75} />;
  }
  return <CreditCard className="size-4 text-muted" strokeWidth={1.75} />;
}

function paymentLabel(
  t: (key: MessageKey) => string,
  sale: SaleDetail,
  method: string | null,
): string {
  if (isLoyaltyOnlyTender(sale)) return t("dashboard.payment.loyalty");
  if (!method) return "—";
  if (method === "MFS") {
    const brand = mfsProviderLabel(parseMfsProvider(sale.notes));
    return brand
      ? `${t("dashboard.payment.mfs")} · ${brand}`
      : t("dashboard.payment.mfs");
  }
  const key = PAYMENT_KEYS[method];
  return key ? t(key) : method;
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
}) {
  return (
    <article className="rounded-xl border border-border bg-surface p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
        {label}
      </p>
      <div className="mt-2 flex items-center gap-2">
        {icon}
        <p className="truncate text-lg font-semibold tracking-tight text-foreground">
          {value}
        </p>
      </div>
    </article>
  );
}

function CustomerCard({
  sale,
  walkIn,
}: {
  sale: SaleDetail;
  walkIn: boolean;
}) {
  const { t } = useLocale();
  const name = walkIn ? t("sales.walkIn") : sale.customer?.name || t("sales.walkIn");
  const phone = walkIn ? null : sale.customer?.phone;
  const current = loyaltyCurrent(sale);

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="mb-4 text-sm font-semibold text-foreground">
        {t("sales.detail.customer")}
      </h2>
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
          {walkIn ? "?" : initialsFromName(name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-foreground">{name}</p>
            {walkIn ? null : (
              <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                {t("sales.detail.loyaltyMember")}
              </span>
            )}
          </div>
          {phone ? (
            <p className="mt-0.5 text-sm text-muted">{phone}</p>
          ) : null}
        </div>
      </div>
      {walkIn ? null : (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <LoyaltyCell
            label={t("sales.detail.loyalty.previous")}
            value={formatCount(sale.loyaltyPrevious)}
          />
          <LoyaltyCell
            label={t("sales.detail.loyalty.used")}
            value={formatCount(sale.loyaltyUsed)}
          />
          <LoyaltyCell
            label={t("sales.detail.loyalty.earned")}
            value={`+${formatCount(sale.loyaltyEarned)}`}
            valueClass="text-emerald-600"
          />
          <LoyaltyCell
            label={t("sales.detail.loyalty.current")}
            value={formatCount(current)}
          />
        </div>
      )}
    </section>
  );
}

function LoyaltyCell({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-lg bg-canvas px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
        {label}
      </p>
      <p
        className={`mt-1 text-lg font-semibold tabular-nums ${valueClass ?? "text-foreground"}`}
      >
        {value}
      </p>
    </div>
  );
}

function ItemsCard({ sale }: { sale: SaleDetail }) {
  const { t } = useLocale();
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between px-5 py-4">
        <h2 className="text-sm font-semibold text-foreground">
          {t("sales.detail.itemsSold")}
        </h2>
        <span className="text-xs text-muted">
          {formatCount(sale.items.length)} {t("sales.items")}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead>
            <tr className="border-y border-border bg-slate-50 text-[11px] font-medium uppercase tracking-wide text-muted">
              <th className="px-5 py-2 font-medium">{t("sales.detail.col.item")}</th>
              <th className="px-3 py-2 font-medium">{t("sales.detail.col.batch")}</th>
              <th className="px-3 py-2 font-medium">{t("sales.detail.col.unit")}</th>
              <th className="px-3 py-2 text-right font-medium">
                {t("sales.detail.col.qty")}
              </th>
              <th className="px-3 py-2 text-right font-medium">
                {t("sales.detail.col.price")}
              </th>
              <th className="px-5 py-2 text-right font-medium">
                {t("sales.detail.col.total")}
              </th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((item) => {
              const unitKey = UNIT_KEYS[item.unitType];
              return (
                <tr key={item.id} className="border-b border-border last:border-0">
                  <td className="px-5 py-3">
                    <p className="font-medium text-foreground">{item.product.name}</p>
                    {item.product.genericName ? (
                      <p className="text-xs text-muted">{item.product.genericName}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-3">
                    <p
                      className={
                        item.fefoOverride
                          ? "font-medium text-destructive"
                          : "text-foreground"
                      }
                    >
                      {item.batch.batchNumber}
                    </p>
                    <p className="text-xs text-muted">
                      {t("sales.detail.exp")} {formatExpiryMonthYear(item.batch.expiryDate)}
                    </p>
                    {item.fefoOverride ? (
                      <span className="mt-1 inline-block rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                        {t("sales.detail.override")}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 text-foreground">
                    {unitKey ? t(unitKey) : item.unitType}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-foreground">
                    {formatCount(item.unitQty)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-foreground">
                    {formatTaka(item.unitPrice)}
                  </td>
                  <td className="px-5 py-3 text-right font-medium tabular-nums text-foreground">
                    {formatTaka(item.lineTotal)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ActivityCard({ events }: { events: SaleActivityEvent[] }) {
  const { t } = useLocale();
  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="mb-4 text-sm font-semibold text-foreground">
        {t("sales.detail.activity")}
      </h2>
      {events.length === 0 ? (
        <p className="text-sm text-muted">{t("sales.detail.activityEmpty")}</p>
      ) : (
        <ol className="flex flex-col">
          {events.map((event, i) => (
            <li key={event.id} className="flex gap-3">
              <div className="flex w-6 shrink-0 flex-col items-center">
                <ActivityDot kind={event.kind} />
                {i < events.length - 1 ? (
                  <span className="w-px flex-1 bg-border" />
                ) : null}
              </div>
              <div className={i < events.length - 1 ? "pb-4" : ""}>
                <p className="text-sm font-medium text-foreground">
                  {activityTitle(t, event)}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {formatDetailDate(event.at)} {t("sales.detail.at")}{" "}
                  {formatTime(event.at)}
                </p>
                <ActivityNote event={event} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function ActivityDot({ kind }: { kind: SaleActivityEvent["kind"] }) {
  if (kind === "fefo") {
    return (
      <span className="flex size-6 items-center justify-center rounded-full bg-amber-100 text-amber-700">
        <TriangleAlert className="size-3.5" strokeWidth={2} />
      </span>
    );
  }
  return (
    <span className="flex size-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
      <Check className="size-3.5" strokeWidth={2} />
    </span>
  );
}

function activityTitle(
  t: (key: MessageKey) => string,
  event: SaleActivityEvent,
): string {
  if (event.kind === "completed") return t("sales.detail.activity.completed");
  if (event.kind === "fefo") return t("sales.detail.activity.fefo");
  if (event.kind === "loyalty") return t("sales.detail.activity.loyalty");
  return t("sales.detail.activity.payment");
}

function ActivityNote({ event }: { event: SaleActivityEvent }) {
  const { t } = useLocale();
  if (event.kind === "payment") {
    const ref = event.payment?.reference?.trim();
    if (!ref) return null;
    return <p className="mt-1 text-xs text-muted">{ref}</p>;
  }
  if (event.kind === "fefo" && event.item) {
    const name = event.item.product.name;
    const batch = event.item.batch.batchNumber;
    const auth = event.item.fefoAuthorizedByName;
    return (
      <p className="mt-1 text-xs text-muted">
        {name} ({batch})
        {auth ? ` — ${t("sales.detail.activity.authBy")} ${auth}` : ""}
      </p>
    );
  }
  return null;
}

function SettlementCard({
  sale,
  paid,
}: {
  sale: SaleDetail;
  paid: number;
}) {
  const { t } = useLocale();
  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">
          {t("sales.detail.settlement")}
        </h2>
        <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
          <Wallet className="size-3" strokeWidth={2} />
          {t("sales.detail.approved")}
        </span>
      </div>
      <dl className="flex flex-col gap-2 text-sm">
        <SettleRow label={t("sales.detail.subtotal")} value={formatTaka(sale.subtotal)} />
        <SettleRow label={t("sales.detail.discount")} value={formatTaka(sale.discount)} />
        <SettleRow
          label={t("sales.detail.loyaltyApplied")}
          value={formatTaka(sale.loyaltyUsed)}
        />
        <SettleRow
          label={t("sales.detail.amountPaid")}
          value={formatTaka(paid)}
          strong
        />
        <SettleRow
          label={t("sales.detail.amountDue")}
          value={formatTaka(0)}
        />
      </dl>
    </section>
  );
}

function SettleRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className={strong ? "font-semibold text-foreground" : "text-muted"}>
        {label}
      </dt>
      <dd
        className={`tabular-nums ${strong ? "font-semibold text-foreground" : "text-foreground"}`}
      >
        {value}
      </dd>
    </div>
  );
}

function ReceiptHistoryCard({ onReprint }: { onReprint: () => void }) {
  const { t } = useLocale();
  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="mb-3 text-sm font-semibold text-foreground">
        {t("sales.detail.receiptHistory")}
      </h2>
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-canvas text-muted">
          <Printer className="size-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            {t("sales.detail.receiptAvailable")}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {t("sales.detail.receiptHint")}
          </p>
        </div>
      </div>
      <button
        type="button"
        className="mt-4 w-full rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-canvas"
        onClick={onReprint}
      >
        {t("sales.detail.reprint")}
      </button>
    </section>
  );
}
