import {
  CalendarDays,
  ChevronDown,
  Gift,
  ReceiptText,
  ShoppingBag,
  UserRound,
  Users,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useLocale, type MessageKey } from "@/i18n";
import { ApiError } from "@/lib/api";
import {
  fetchCustomerDetail,
  type CustomerDetail,
  type CustomerGender,
  type CustomerStatus,
} from "@/lib/customers";
import {
  formatCount,
  formatDateTime,
  formatSalesDateTime,
  formatTaka,
  formatUtcDate,
} from "@/lib/format";
import { useOwnerPath } from "@/lib/OwnerPathProvider";

/**
 * Customer Details (Batch AJ). Content region only — chrome is Batch B.
 * Live GET /owner/customers/:id (OWNER only). Header, KPIs (loyalty / total
 * purchases / visits / last purchase), profile grid, registration information,
 * purchase history, loyalty activity and a known-facts timeline are all honest
 * values from live data — zeros / em dashes when there is no data. Edit Customer
 * and More Actions stay disabled. A PENDING_APPROVAL id redirects to Review (AK).
 */
export function CustomerDetailsPage({ customerId }: { customerId: string }) {
  const { t } = useLocale();
  const { navigate } = useOwnerPath();

  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetchCustomerDetail(customerId)
      .then((payload) => {
        if (cancelled) return;
        if (payload.profile.status === "PENDING_APPROVAL") {
          navigate(`/customers/${encodeURIComponent(payload.profile.id)}/review`);
          return;
        }
        setCustomer(payload);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setCustomer(null);
        setLoading(false);
        if (err instanceof ApiError && err.statusCode === 404) {
          setError(t("customers.detail.notFound"));
        } else if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError(t("customers.detail.error"));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [customerId, reload, t, navigate]);

  return (
    <div className="w-full px-5 py-4">
      <nav
        aria-label={t("header.breadcrumb")}
        className="mb-3 text-sm text-muted"
      >
        <button
          type="button"
          className="hover:text-foreground hover:underline"
          onClick={() => navigate("/customers")}
        >
          {t("nav.customers")}
        </button>
        <span className="px-1.5">›</span>
        <span className="text-foreground">
          {customer?.profile.name ?? t("customers.detail.crumb")}
        </span>
      </nav>

      {loading && !customer ? (
        <div className="flex flex-col gap-4">
          <div className="h-7 w-1/3 animate-pulse rounded-md bg-slate-200" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-xl border border-border bg-surface"
              />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(240px,1fr)]">
            <div className="flex flex-col gap-3">
              <div className="h-48 animate-pulse rounded-xl border border-border bg-surface" />
              <div className="h-48 animate-pulse rounded-xl border border-border bg-surface" />
            </div>
            <div className="h-64 animate-pulse rounded-xl border border-border bg-surface" />
          </div>
        </div>
      ) : null}

      {error && !customer ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
          <p className="text-destructive">{error}</p>
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1 text-foreground hover:bg-canvas"
            onClick={() => setReload((n) => n + 1)}
          >
            {t("customers.detail.retry")}
          </button>
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1 text-foreground hover:bg-canvas"
            onClick={() => navigate("/customers")}
          >
            {t("customers.detail.back")}
          </button>
        </div>
      ) : null}

      {customer ? (
        <CustomerDetailBody customer={customer} onNavigate={navigate} />
      ) : null}
    </div>
  );
}

function CustomerDetailBody({
  customer,
  onNavigate,
}: {
  customer: CustomerDetail;
  onNavigate: (to: string) => void;
}) {
  const { t } = useLocale();
  const { profile, purchaseHistory } = customer;

  const contactLine = [profile.phone, profile.email].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {profile.name}
            </h1>
            <CustomerStatusBadge status={profile.status} />
          </div>
          {contactLine ? (
            <p className="mt-1 text-sm text-muted">{contactLine}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled
            aria-disabled="true"
            title={t("customers.detail.editSoon")}
            className="inline-flex cursor-not-allowed items-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-muted"
          >
            <UserRound className="size-4" strokeWidth={1.75} />
            {t("customers.detail.editCustomer")}
          </button>
          <button
            type="button"
            disabled
            aria-disabled="true"
            title={t("customers.detail.moreSoon")}
            className="inline-flex cursor-not-allowed items-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-muted"
          >
            {t("customers.detail.moreActions")}
            <ChevronDown className="size-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={t("customers.detail.kpi.loyalty")}
          value={formatCount(profile.loyaltyPoints)}
          hint={t("customers.detail.kpi.loyaltyHint")}
          icon={<Gift className="size-4 text-primary" strokeWidth={1.75} />}
        />
        <KpiCard
          label={t("customers.detail.kpi.totalPurchases")}
          value={formatTaka(purchaseHistory.totalSpent)}
          hint={t("customers.detail.kpi.totalPurchasesHint")}
          icon={<ShoppingBag className="size-4 text-primary" strokeWidth={1.75} />}
        />
        <KpiCard
          label={t("customers.detail.kpi.visits")}
          value={formatCount(purchaseHistory.saleCount)}
          hint={t("customers.detail.kpi.visitsHint")}
          icon={<Users className="size-4 text-primary" strokeWidth={1.75} />}
        />
        <KpiCard
          label={t("customers.detail.kpi.lastPurchase")}
          value={
            purchaseHistory.lastPurchaseAt
              ? formatSalesDateTime(purchaseHistory.lastPurchaseAt)
              : "—"
          }
          hint={t("customers.detail.kpi.lastPurchaseHint")}
          icon={<CalendarDays className="size-4 text-primary" strokeWidth={1.75} />}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(240px,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <CustomerInformationCard customer={customer} />
          <RegistrationInformationCard customer={customer} />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <PurchaseHistoryCard customer={customer} onNavigate={onNavigate} />
            <LoyaltyActivityCard customer={customer} />
          </div>
        </div>
        <TimelineCard customer={customer} />
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: ReactNode;
}) {
  return (
    <article className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          {label}
        </p>
        <span className="text-muted">{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </article>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-2 border-b border-border pb-3">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
    </div>
  );
}

function InfoRow({
  label,
  value,
  href,
  strong,
}: {
  label: string;
  value: ReactNode;
  href?: string | null;
  strong?: boolean;
}) {
  const content = href ? (
    <a
      href={href}
      className="text-primary hover:text-primary hover:underline"
    >
      {value}
    </a>
  ) : (
    <span className={strong ? "font-medium text-foreground" : "text-foreground"}>
      {value}
    </span>
  );
  return (
    <div>
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="mt-1 text-sm">{content}</dd>
    </div>
  );
}

function CustomerInformationCard({ customer }: { customer: CustomerDetail }) {
  const { t } = useLocale();
  const { profile } = customer;

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <SectionHeader title={t("customers.detail.info.title")} />
      <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
        <InfoRow
          label={t("customers.detail.info.name")}
          value={profile.name}
          strong
        />
        <InfoRow
          label={t("customers.detail.info.phone")}
          value={profile.phone}
          href={profile.phone ? `tel:${profile.phone}` : null}
        />
        <InfoRow
          label={t("customers.detail.info.email")}
          value={profile.email ?? "—"}
          href={profile.email ? `mailto:${profile.email}` : null}
        />
        <InfoRow
          label={t("customers.detail.info.dateOfBirth")}
          value={profile.dateOfBirth ? formatUtcDate(profile.dateOfBirth) : "—"}
        />
        <InfoRow
          label={t("customers.detail.info.gender")}
          value={genderLabel(profile.gender, t)}
        />
        <InfoRow
          label={t("customers.detail.info.status")}
          value={<CustomerStatusBadge status={profile.status} />}
        />
        <InfoRow
          label={t("customers.detail.info.address")}
          value={profile.address ?? "—"}
        />
        <InfoRow
          label={t("customers.detail.info.branch")}
          value={profile.storeName ?? "—"}
        />
      </dl>
    </section>
  );
}

function RegistrationInformationCard({ customer }: { customer: CustomerDetail }) {
  const { t } = useLocale();
  const { profile, audit } = customer;

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <SectionHeader title={t("customers.detail.registration.title")} />
      <p className="mb-4 rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-xs text-teal-800">
        {t("customers.detail.registration.notice")}
      </p>
      <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
        <InfoRow
          label={t("customers.detail.registration.source")}
          value={t(
            profile.source === "OWNER_CREATED"
              ? "customers.source.ownerCreated"
              : "customers.source.posRegistration",
          )}
        />
        <InfoRow
          label={t("customers.detail.registration.branch")}
          value={profile.storeName ?? "—"}
        />
        <InfoRow
          label={t("customers.detail.registration.submitted")}
          value={formatDateTime(profile.createdAt)}
        />
        <InfoRow
          label={t("customers.detail.registration.submittedBy")}
          value={audit.createdBy?.name ?? "—"}
        />
        <InfoRow
          label={t("customers.detail.registration.approved")}
          value={audit.approvedAt ? formatDateTime(audit.approvedAt) : "—"}
        />
        <InfoRow
          label={t("customers.detail.registration.approvedBy")}
          value={audit.approvedBy?.name ?? "—"}
        />
      </dl>
      <div className="mt-4 border-t border-border pt-4">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted">
          {t("customers.detail.registration.originalTitle")}
        </p>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="rounded-md border border-border bg-canvas px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted">
              {t("customers.detail.registration.originalName")}
            </p>
            <p className="mt-0.5 text-sm font-medium text-foreground">
              {profile.name}
            </p>
          </div>
          <div className="rounded-md border border-border bg-canvas px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted">
              {t("customers.detail.registration.originalPhone")}
            </p>
            <p className="mt-0.5 text-sm font-medium text-foreground">
              {profile.phone}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function PurchaseHistoryCard({
  customer,
  onNavigate,
}: {
  customer: CustomerDetail;
  onNavigate: (to: string) => void;
}) {
  const { t } = useLocale();
  const { rows } = customer.purchaseHistory;

  return (
    <section className="rounded-xl border border-border bg-surface">
      <div className="border-b border-border px-5 py-3">
        <h2 className="text-sm font-semibold text-foreground">
          {t("customers.detail.purchaseHistory.title")}
        </h2>
      </div>
      {rows.length === 0 ? (
        <div className="flex min-h-[130px] flex-col items-center justify-center gap-2 px-5 py-8 text-center">
          <ReceiptText className="size-5 text-muted" strokeWidth={1.5} />
          <p className="text-sm text-muted">
            {t("customers.detail.purchaseHistory.empty")}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-canvas text-xs uppercase tracking-wide text-muted">
                <th className="px-5 py-2.5 font-medium">
                  {t("customers.detail.purchaseHistory.col.date")}
                </th>
                <th className="px-4 py-2.5 font-medium">
                  {t("customers.detail.purchaseHistory.col.receipt")}
                </th>
                <th className="px-4 py-2.5 font-medium">
                  {t("customers.detail.purchaseHistory.col.amount")}
                </th>
                <th className="px-4 py-2.5 font-medium">
                  {t("customers.detail.purchaseHistory.col.branch")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="cursor-pointer border-b border-border last:border-b-0 hover:bg-canvas"
                  onClick={() =>
                    onNavigate(`/sales/${encodeURIComponent(row.id)}`)
                  }
                >
                  <td className="px-5 py-3 text-foreground">
                    {formatSalesDateTime(row.soldAt)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-primary hover:underline">
                      {row.receiptNo ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {formatTaka(row.total)}
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    {row.storeName ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function LoyaltyActivityCard({ customer }: { customer: CustomerDetail }) {
  const { t } = useLocale();
  const { rows } = customer.loyaltyActivity;
  const rowsWithBalance = rowsWithRunningBalance(rows);

  return (
    <section className="rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-3">
        <h2 className="text-sm font-semibold text-foreground">
          {t("customers.detail.loyalty.title")}
        </h2>
        <p className="text-xs text-muted">
          {t("customers.detail.loyalty.balance")}{" "}
          <span className="font-semibold text-foreground">
            {formatCount(customer.profile.loyaltyPoints)}
          </span>
        </p>
      </div>
      {rowsWithBalance.length === 0 ? (
        <div className="flex min-h-[130px] flex-col items-center justify-center gap-2 px-5 py-8 text-center">
          <Gift className="size-5 text-muted" strokeWidth={1.5} />
          <p className="text-sm text-muted">
            {t("customers.detail.loyalty.empty")}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-canvas text-xs uppercase tracking-wide text-muted">
                <th className="px-5 py-2.5 font-medium">
                  {t("customers.detail.loyalty.col.date")}
                </th>
                <th className="px-4 py-2.5 font-medium">
                  {t("customers.detail.loyalty.col.activity")}
                </th>
                <th className="px-4 py-2.5 font-medium">
                  {t("customers.detail.loyalty.col.points")}
                </th>
                <th className="px-4 py-2.5 font-medium">
                  {t("customers.detail.loyalty.col.balance")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rowsWithBalance.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border last:border-b-0 hover:bg-canvas"
                >
                  <td className="px-5 py-3 text-foreground">
                    {formatSalesDateTime(row.soldAt)}
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    {row.loyaltyEarned > 0
                      ? t("customers.detail.loyalty.earned")
                      : row.loyaltyUsed > 0
                        ? t("customers.detail.loyalty.used")
                        : "—"}
                  </td>
                  <td
                    className={`px-4 py-3 font-medium ${
                      row.loyaltyEarned > 0
                        ? "text-teal-700"
                        : row.loyaltyUsed > 0
                          ? "text-amber-700"
                          : "text-foreground"
                    }`}
                  >
                    {row.loyaltyEarned > 0
                      ? `+${formatCount(row.loyaltyEarned)}`
                      : row.loyaltyUsed > 0
                        ? `−${formatCount(row.loyaltyUsed)}`
                        : "—"}
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    {formatCount(row.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function TimelineCard({ customer }: { customer: CustomerDetail }) {
  const { t } = useLocale();
  const { profile, audit } = customer;

  const events: Array<{
    key: string;
    title: string;
    actor: string | null;
    date: string;
  }> = [];

  if (audit.approvedAt) {
    events.push({
      key: "approved",
      title: t("customers.detail.timeline.approved"),
      actor: audit.approvedBy?.name ?? null,
      date: audit.approvedAt,
    });
  }
  events.push({
    key: "submitted",
    title: t("customers.detail.timeline.submitted"),
    actor: audit.createdBy?.name ?? null,
    date: profile.createdAt,
  });
  events.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <SectionHeader title={t("customers.detail.timeline.title")} />
      <ol className="relative flex flex-col gap-5 border-l border-border pl-5">
        {events.map((event) => (
          <li key={event.key} className="relative">
            <span
              aria-hidden="true"
              className="absolute -left-[1.57rem] top-0.5 size-3 rounded-full border-2 border-teal-600 bg-surface"
            />
            <p className="text-sm font-medium text-foreground">{event.title}</p>
            <p className="mt-0.5 text-xs text-muted">
              {event.actor ?? "—"} · {formatDateTime(event.date)}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function rowsWithRunningBalance(
  rows: CustomerDetail["loyaltyActivity"]["rows"],
): Array<CustomerDetail["loyaltyActivity"]["rows"][number] & { balance: number }> {
  const chronological = [...rows].reverse();
  let balance = 0;
  const computed = chronological.map((row) => {
    balance = row.loyaltyPrevious + row.loyaltyEarned - row.loyaltyUsed;
    return { ...row, balance };
  });
  return computed.reverse();
}

function genderLabel(
  gender: CustomerGender | null,
  t: (key: MessageKey) => string,
): string {
  if (!gender) return "—";
  return t(
    gender === "MALE"
      ? "customers.detail.gender.male"
      : gender === "FEMALE"
        ? "customers.detail.gender.female"
        : "customers.detail.gender.other",
  );
}

function CustomerStatusBadge({ status }: { status: CustomerStatus }) {
  const { t } = useLocale();
  const label = t(
    status === "ACTIVE"
      ? "customers.status.active"
      : status === "PENDING_APPROVAL"
        ? "customers.status.pending"
        : "customers.status.inactive",
  );
  const tone =
    status === "ACTIVE"
      ? "bg-teal-200/70 text-teal-800"
      : status === "PENDING_APPROVAL"
        ? "bg-amber-100 text-amber-700"
        : "bg-slate-200 text-slate-500";
  return (
    <span className={`rounded-sm px-2 py-1 text-[10px] font-medium ${tone}`}>
      {label}
    </span>
  );
}