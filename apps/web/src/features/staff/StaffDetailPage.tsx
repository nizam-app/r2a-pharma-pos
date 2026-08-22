import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  CheckCircle2,
  Mail,
  Phone,
  UserRound,
  Shield,
  Clock,
  Home,
  FileText,
  AlertCircle,
  Loader2,
  X,
  Ban,
  Archive,
  History,
  RotateCcw,
  LogIn,
  ShieldCheck,
  FileCheck2
} from "lucide-react";
import { useEffect, useState, useRef, type ReactNode } from "react";
import { useLocale } from "@/i18n";
import { ApiError } from "@/lib/api";
import { useOwnerPath } from "@/lib/OwnerPathProvider";
import { useAuth } from "@/features/auth/AuthProvider";
import {
  fetchStaffDetail,
  deactivateStaff,
  reactivateStaff,
  type StaffActivityRow,
  type StaffListRow,
} from "@/lib/staff";
import { formatDateTime, formatSalesDateTime } from "@/lib/format";

export function StaffDetailPage({ userId }: { userId: string }) {
  const { t } = useLocale();
  const { navigate } = useOwnerPath();
  const { user: sessionUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [staffData, setStaffData] = useState<{
    user: StaffListRow;
    activities: StaffActivityRow[];
  } | null>(null);
  const [reload, setReload] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [modal, setModal] = useState<"deactivate" | "reactivate" | null>(null);
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const actionButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetchStaffDetail(userId)
      .then((res) => {
        if (cancelled) return;
        setStaffData(res);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoading(false);
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError(t("staff.detail.error"));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [userId, reload, t]);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  useEffect(() => {
    if (!modal) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !submitting) {
        closeModal();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal, submitting]);

  function openModal(kind: "deactivate" | "reactivate") {
    setModal(kind);
    setReason("");
    setConfirmed(false);
    setSubmitError(null);
  }

  function closeModal() {
    if (submitting) return;
    setModal(null);
    setReason("");
    setConfirmed(false);
    setSubmitError(null);
    window.setTimeout(() => actionButtonRef.current?.focus(), 0);
  }

  async function submitStatusChange() {
    if (!staffData || !modal || !confirmed || submitting) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      if (modal === "deactivate") {
        await deactivateStaff(staffData.user.id, reason.trim());
      } else {
        await reactivateStaff(staffData.user.id);
      }
      setModal(null);
      setReason("");
      setConfirmed(false);
      setReload((n) => n + 1);
    } catch (err: unknown) {
      setSubmitError(err instanceof ApiError ? err.message : t("staff.statusModal.submitError"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && !staffData) {
    return (
      <div className="w-full px-5 py-4">
        <p className="text-sm text-muted">{t("staff.detail.loading")}</p>
      </div>
    );
  }

  if (error && !staffData) {
    return (
      <div className="w-full px-5 py-4">
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
          <p className="text-destructive">{error}</p>
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1 text-foreground hover:bg-canvas"
            onClick={() => setReload((n) => n + 1)}
          >
            {t("staff.detail.retry")}
          </button>
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1 text-foreground hover:bg-canvas"
            onClick={() => navigate("/staff")}
          >
            {t("staff.detail.back")}
          </button>
        </div>
      </div>
    );
  }

  if (!staffData) return null;

  const { user, activities } = staffData;
  const isSelf = sessionUser?.id === user.id;

  const roleLabel =
    user.role === "OWNER"
      ? t("staff.role.owner")
      : user.role === "MANAGER"
      ? t("staff.role.manager")
      : t("staff.role.cashier");

  const statusLabel = t(
    user.isActive ? "staff.status.active" : "staff.status.inactive"
  );
  const statusBadgeClass = user.isActive
    ? "bg-teal-100 text-teal-800"
    : "bg-slate-100 text-slate-600";

  return (
    <div className="w-full px-5 py-4">
      {/* Breadcrumb Navigation */}
      <nav className="mb-3 flex items-center gap-1.5 text-xs text-muted">
        <button
          type="button"
          onClick={() => navigate("/staff")}
          className="hover:text-primary hover:underline"
        >
          {t("page.staffTitle")}
        </button>
        <span>/</span>
        <span className="font-medium text-foreground">{user.name}</span>
      </nav>

      {/* Header & Actions */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {user.name}
            </h1>
            <span className={`rounded-sm px-2 py-0.5 text-xs font-semibold ${statusBadgeClass}`}>
              {statusLabel}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">{t("staff.detail.subtitle")}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Back button */}
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground hover:bg-canvas"
            onClick={() => navigate("/staff")}
          >
            <ArrowLeft className="size-4" strokeWidth={1.75} />
            {t("staff.detail.back")}
          </button>

          {/* Edit button: disabled for self row */}
          <button
            type="button"
            disabled={isSelf}
            onClick={() => navigate(`/staff/${encodeURIComponent(user.id)}/edit`)}
            className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium ${
              isSelf
                ? "border-border bg-surface text-muted cursor-not-allowed opacity-60"
                : "border-border bg-surface text-foreground hover:bg-canvas"
            }`}
            title={isSelf ? "You cannot edit your own profile here" : undefined}
          >
            <UserRound className="size-4" strokeWidth={1.75} />
            {t("staff.detail.action.edit")}
          </button>

          {/* More Actions dropdown menu: hidden entirely for self row */}
          {!isSelf && (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                ref={actionButtonRef}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground hover:bg-canvas"
                onClick={() => setMenuOpen((prev) => !prev)}
              >
                {t("staff.detail.action.more")}
                <ChevronDown className="size-4" strokeWidth={1.75} />
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-1.5 z-10 w-48 rounded-md border border-border bg-surface py-1 shadow-lg">
                  {user.isActive ? (
                    <button
                      type="button"
                      className="w-full px-4 py-2 text-left text-sm text-destructive hover:bg-canvas font-medium"
                      onClick={() => {
                        setMenuOpen(false);
                        openModal("deactivate");
                      }}
                    >
                      {t("staff.detail.action.deactivate")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="w-full px-4 py-2 text-left text-sm text-primary hover:bg-canvas font-medium"
                      onClick={() => {
                        setMenuOpen(false);
                        openModal("reactivate");
                      }}
                    >
                      {t("staff.detail.action.reactivate")}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={t("staff.detail.kpi.role")}
          value={roleLabel}
          icon={<Shield className="size-4 text-primary" strokeWidth={1.75} />}
        />
        <KpiCard
          label={t("staff.detail.kpi.branch")}
          value={user.storeName || "—"}
          icon={<Home className="size-4 text-primary" strokeWidth={1.75} />}
        />
        <KpiCard
          label={t("staff.detail.kpi.username")}
          value={user.username}
          valueClass="font-mono text-lg"
          icon={<UserRound className="size-4 text-primary" strokeWidth={1.75} />}
        />
        <KpiCard
          label={t("staff.detail.kpi.lastActive")}
          value={
            user.lastLoginAt
              ? formatSalesDateTime(user.lastLoginAt)
              : t("staff.detail.kpi.neverActive")
          }
          icon={<Clock className="size-4 text-primary" strokeWidth={1.75} />}
        />
      </div>

      {/* Two Column Content Region */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1.2fr)]">
        <div className="flex flex-col gap-4">
          {/* Staff Information Card */}
          <section className="rounded-xl border border-border bg-surface p-5">
            <h2 className="mb-4 text-base font-semibold text-foreground border-b border-border pb-2 flex items-center gap-2">
              <UserRound className="size-4 text-muted" />
              {t("staff.detail.section.info")}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <InfoItem label={t("staff.detail.label.name")} value={user.name} />
              <InfoItem
                label={t("staff.detail.label.phone")}
                value={user.phone ? (
                  <a href={`tel:${user.phone}`} className="text-primary hover:underline flex items-center gap-1.5">
                    <Phone className="size-3.5" />
                    {user.phone}
                  </a>
                ) : "—"}
              />
              <InfoItem
                label={t("staff.detail.label.email")}
                value={(
                  <a href={`mailto:${user.email}`} className="text-primary hover:underline flex items-center gap-1.5">
                    <Mail className="size-3.5" />
                    {user.email}
                  </a>
                )}
              />
              <div className="sm:col-span-2">
                <InfoItem label={t("staff.detail.label.note")} value={user.internalNote || "—"} />
              </div>
            </div>
          </section>

          {/* Account & Access Details Card */}
          <section className="rounded-xl border border-border bg-surface p-5">
            <h2 className="mb-4 text-base font-semibold text-foreground border-b border-border pb-2 flex items-center gap-2">
              <Shield className="size-4 text-muted" />
              {t("staff.detail.section.access")}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <InfoItem label={t("staff.detail.label.role")} value={roleLabel} />
              <InfoItem label={t("staff.detail.label.branch")} value={user.storeName || "—"} />
              <InfoItem label={t("staff.detail.label.status")} value={statusLabel} />
              <InfoItem
                label={t("staff.detail.label.created")}
                value={formatDateTime(user.createdAt)}
              />
            </div>
          </section>
        </div>

        {/* Activity Timeline Card */}
        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="mb-4 text-base font-semibold text-foreground border-b border-border pb-2 flex items-center gap-2">
            <FileText className="size-4 text-muted" />
            {t("staff.detail.section.activity")}
          </h2>

          {activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted">
              <AlertCircle className="size-8 text-muted mb-2 opacity-50" />
              <p className="text-sm">{t("staff.detail.activity.empty")}</p>
            </div>
          ) : (
            <ol className="relative flex flex-col gap-5 border-l border-border pl-4">
              {activities.map((activity) => (
                <li key={activity.id} className="relative">
                  <span
                    aria-hidden="true"
                    className="absolute -left-[1.32rem] top-0.5 size-2.5 rounded-full border-2 border-teal-600 bg-surface"
                  />
                  <p className="text-sm font-semibold text-foreground">
                    {t(`staff.detail.activity.${activity.type}` as any) || activity.type}
                  </p>
                  {activity.note && (
                    <p className="mt-0.5 text-xs text-muted-foreground bg-slate-50 border border-slate-100 rounded px-2 py-1 max-w-full break-words">
                      {activity.note}
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-muted">
                    {t("staff.detail.activity.actor")}{" "}
                    <span className="font-medium text-foreground">{activity.actorName}</span>{" "}
                    ({activity.actorRole === "OWNER" ? t("staff.role.owner") : activity.actorRole === "MANAGER" ? t("staff.role.manager") : t("staff.role.cashier")})
                    {" · "}{formatSalesDateTime(activity.createdAt)}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {modal && !isSelf && (
        <StaffStatusModal
          kind={modal}
          staff={user}
          roleLabel={roleLabel}
          submitting={submitting}
          confirmed={confirmed}
          reason={reason}
          error={submitError}
          onReasonChange={setReason}
          onConfirmedChange={setConfirmed}
          onCancel={closeModal}
          onSubmit={submitStatusChange}
          t={t}
        />
      )}
    </div>
  );
}

function StaffStatusModal({
  kind,
  staff,
  roleLabel,
  submitting,
  confirmed,
  reason,
  error,
  onReasonChange,
  onConfirmedChange,
  onCancel,
  onSubmit,
  t,
}: {
  kind: "deactivate" | "reactivate";
  staff: StaffListRow;
  roleLabel: string;
  submitting: boolean;
  confirmed: boolean;
  reason: string;
  error: string | null;
  onReasonChange: (value: string) => void;
  onConfirmedChange: (value: boolean) => void;
  onCancel: () => void;
  onSubmit: () => void;
  t: ReturnType<typeof useLocale>["t"];
}) {
  const isDeactivate = kind === "deactivate";
  const title = t(isDeactivate ? "staff.statusModal.deactivateTitle" : "staff.statusModal.reactivateTitle");
  const description = t(
    isDeactivate
      ? "staff.statusModal.deactivateDescription"
      : "staff.statusModal.reactivateDescription",
  );
  const actionLabel = t(
    isDeactivate
      ? "staff.statusModal.deactivateAction"
      : "staff.statusModal.reactivateAction",
  );
  const currentStatus = t(isDeactivate ? "staff.status.active" : "staff.status.inactive");
  const nextStatus = t(isDeactivate ? "staff.status.inactive" : "staff.status.active");
  const currentClass = isDeactivate ? "bg-teal-100 text-teal-700" : "bg-red-100 text-red-700";
  const nextClass = isDeactivate ? "bg-red-100 text-red-700" : "bg-teal-100 text-teal-700";
  const actionClass = isDeactivate
    ? "bg-red-400 hover:bg-red-500 text-white"
    : "bg-teal-600 hover:bg-teal-700 text-white";
  const Icon = isDeactivate ? AlertTriangle : CheckCircle2;

  const bullets = isDeactivate
    ? [
        { key: "staff.statusModal.deactivateImpact1", icon: Ban },
        { key: "staff.statusModal.deactivateImpact2", icon: Archive },
        { key: "staff.statusModal.deactivateImpact3", icon: History },
        { key: "staff.statusModal.deactivateImpact4", icon: RotateCcw },
      ]
    : [
        { key: "staff.statusModal.reactivateImpact1", icon: LogIn },
        { key: "staff.statusModal.reactivateImpact2", icon: ShieldCheck },
        { key: "staff.statusModal.reactivateImpact3", icon: Archive },
        { key: "staff.statusModal.reactivateImpact4", icon: FileCheck2 },
      ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onMouseDown={onCancel}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="staff-status-modal-title"
        className="w-[calc(100%-32px)] max-w-md overflow-hidden rounded-[10px] border border-gray-200 bg-white shadow-xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <Icon className={`size-5 ${isDeactivate ? "text-red-600" : "text-teal-600"}`} strokeWidth={1.75} />
            <h2 id="staff-status-modal-title" className="text-sm font-semibold text-gray-900">
              {title}
            </h2>
          </div>
          <button
            type="button"
            className="rounded-[10px] p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            onClick={onCancel}
            disabled={submitting}
            aria-label={t("staff.statusModal.close")}
          >
            <X className="size-4" strokeWidth={1.75} />
          </button>
        </header>

        <p className="px-5 pt-4 text-xs text-gray-500">{description}</p>

        <div className="mx-5 mt-4 rounded-[10px] border border-gray-200 bg-gray-50 p-3">
          <div className="grid grid-cols-1 gap-y-4 sm:grid-cols-2">
            <ModalField label={t("staff.statusModal.staff")} value={staff.name} />
            <ModalField label={t("staff.statusModal.role")} value={roleLabel} />
            <ModalField label={t("staff.statusModal.branch")} value={staff.storeName || "—"} />
            <ModalField label={t("staff.statusModal.username")} value={staff.username} />
          </div>
          <div className="mt-4 flex items-center gap-2 border-t border-gray-200 pt-3 text-xs font-semibold">
            <span className={`rounded-[10px] px-2 py-1 ${currentClass}`}>{currentStatus}</span>
            <span className="text-gray-400">→</span>
            <span className={`rounded-[10px] px-2 py-1 ${nextClass}`}>{nextStatus}</span>
          </div>
        </div>

        <div className="mx-5 mt-4 rounded-[10px] border border-gray-200 bg-gray-50 p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            {t(isDeactivate ? "staff.statusModal.deactivateImpactTitle" : "staff.statusModal.reactivateImpactTitle")}
          </p>
          <ul className="space-y-1.5 text-xs text-gray-600">
            {bullets.map(({ key, icon: BulletIcon }) => (
              <li key={key} className="flex gap-2">
                <BulletIcon className={`mt-0.5 size-3.5 shrink-0 ${isDeactivate ? "text-red-500" : "text-teal-600"}`} strokeWidth={1.75} />
                <span>{t(key as any)}</span>
              </li>
            ))}
          </ul>
        </div>

        {isDeactivate && (
          <label className="mx-5 mt-4 block">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              {t("staff.statusModal.reasonLabel")}
            </span>
            <textarea
              className="min-h-[55px] w-full rounded-[10px] border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
              value={reason}
              onChange={(event) => onReasonChange(event.target.value)}
              placeholder={t("staff.statusModal.reasonPlaceholder")}
              disabled={submitting}
              maxLength={1000}
            />
          </label>
        )}

        <label className="mx-5 mt-3 flex items-start gap-2 rounded-[10px] border border-gray-200 bg-white p-2 text-xs text-gray-700">
          <input
            type="checkbox"
            className="mt-0.5 size-4 rounded border-gray-300 text-teal-600"
            checked={confirmed}
            onChange={(event) => onConfirmedChange(event.target.checked)}
            disabled={submitting}
          />
          <span>
            <span className="font-semibold text-red-600">{t("staff.statusModal.confirmPrefix")}</span>
            {" "}
            {t(isDeactivate ? "staff.statusModal.deactivateConfirmRest" : "staff.statusModal.reactivateConfirmRest")}
          </span>
        </label>

        {error && <p className="mx-5 mt-3 rounded-[10px] border border-gray-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

        <footer className="mt-4 flex flex-col-reverse gap-3 border-t border-gray-200 px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="rounded-[10px] border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            onClick={onCancel}
            disabled={submitting}
          >
            {t("staff.statusModal.cancel")}
          </button>
          <button
            type="button"
            className={`inline-flex items-center justify-center gap-2 rounded-[10px] px-4 py-2 text-sm font-medium ${actionClass} disabled:cursor-not-allowed disabled:opacity-50`}
            onClick={onSubmit}
            disabled={!confirmed || submitting}
          >
            {submitting && <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />}
            {submitting ? t("staff.statusModal.processing") : actionLabel}
          </button>
        </footer>
      </section>
    </div>
  );
}

function ModalField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{label}</p>
      <div className="mt-1 text-xs text-gray-800">{value}</div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  valueClass,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  valueClass?: string;
}) {
  return (
    <article className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
          {label}
        </p>
        <span className="text-muted opacity-75">{icon}</span>
      </div>
      <p
        className={`mt-2 text-xl font-semibold tracking-tight ${
          valueClass ?? "text-foreground"
        }`}
      >
        {value}
      </p>
    </article>
  );
}

function InfoItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">
        {label}
      </p>
      <div className="text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}
