import {
  AlertCircle,
  ArrowLeft,
  Info,
  Loader2,
  Save,
  Shield,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/features/auth";
import { useLocale } from "@/i18n";
import { ApiError } from "@/lib/api";
import { useOwnerPath } from "@/lib/OwnerPathProvider";
import { fetchStaffDetail, patchStaff, type StaffListRow } from "@/lib/staff";
import { useTenantChrome } from "@/lib/TenantContextProvider";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type EditStaffFormState = {
  name: string;
  phone: string;
  email: string;
  role: "MANAGER" | "CASHIER" | "";
  internalNote: string;
};

type FieldErrors = Partial<Record<"name" | "phone" | "email" | "role", string>>;

export function EditStaffPage({ userId }: { userId: string }) {
  const { t } = useLocale();
  const { navigate, setNavigationBlocker } = useOwnerPath();
  const { user: sessionUser } = useAuth();
  const { storeId, storeName, tenantName } = useTenantChrome();

  const [staff, setStaff] = useState<StaffListRow | null>(null);
  const [form, setForm] = useState<EditStaffFormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const bypassNavigation = useRef(false);
  const navigateRef = useRef(navigate);

  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    void fetchStaffDetail(userId)
      .then((result) => {
        if (cancelled) return;
        const loaded = result.user;
        if (sessionUser?.id === loaded.id || loaded.role === "OWNER") {
          navigateRef.current(`/staff/${encodeURIComponent(loaded.id)}`);
          return;
        }
        setStaff(loaded);
        setForm({
          name: loaded.name,
          phone: loaded.phone ?? "",
          email: loaded.email,
          role: loaded.role === "MANAGER" || loaded.role === "CASHIER" ? loaded.role : "",
          internalNote: loaded.internalNote ?? "",
        });
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoading(false);
        setLoadError(error instanceof ApiError ? error.message : t("staff.edit.loadError"));
      });

    return () => {
      cancelled = true;
    };
  }, [reload, sessionUser?.id, t, userId]);

  const dirty = Boolean(
    staff &&
      form &&
      (form.name.trim() !== staff.name ||
        form.phone.trim() !== (staff.phone ?? "") ||
        form.email.trim().toLowerCase() !== staff.email ||
        form.role !== staff.role ||
        form.internalNote.trim() !== (staff.internalNote ?? "")),
  );

  useEffect(() => {
    const blockNavigation = (to: string) => {
      if (bypassNavigation.current || !dirty || submitting) return true;
      setPendingNavigation(to);
      return false;
    };
    setNavigationBlocker(blockNavigation);
    return () => setNavigationBlocker(null);
  }, [dirty, setNavigationBlocker, submitting]);

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  function update<K extends keyof EditStaffFormState>(
    key: K,
    value: EditStaffFormState[K],
  ) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
    if (key === "name" || key === "phone" || key === "email" || key === "role") {
      setFieldErrors((current) => ({ ...current, [key]: undefined }));
    }
    setSubmitError(null);
  }

  function validate(nextForm = form): nextForm is EditStaffFormState {
    if (!nextForm) return false;
    const nextErrors: FieldErrors = {};
    if (!nextForm.name.trim()) nextErrors.name = t("staff.add.nameRequired");
    if (!nextForm.phone.trim()) nextErrors.phone = t("staff.add.phoneRequired");
    if (!nextForm.email.trim()) {
      nextErrors.email = t("staff.add.emailRequired");
    } else if (!EMAIL_PATTERN.test(nextForm.email.trim())) {
      nextErrors.email = t("staff.add.emailInvalid");
    }
    if (!nextForm.role) nextErrors.role = t("staff.add.roleRequired");
    setFieldErrors(nextErrors);
    return !Object.values(nextErrors).some(Boolean);
  }

  async function save() {
    if (!staff || !validate() || submitting || !form) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await patchStaff(staff.id, {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        role: form.role as "MANAGER" | "CASHIER",
        internalNote: form.internalNote.trim(),
        storeId: storeId || staff.storeId || undefined,
      });
      bypassNavigation.current = true;
      setNavigationBlocker(null);
      navigate(`/staff/${encodeURIComponent(staff.id)}`);
    } catch (error: unknown) {
      setSubmitting(false);
      setSubmitError(error instanceof ApiError ? error.message : t("staff.edit.submitError"));
    }
  }

  function goToDetails() {
    if (!staff) {
      navigate("/staff");
      return;
    }
    navigate(`/staff/${encodeURIComponent(staff.id)}`);
  }

  function discardChanges() {
    const target = pendingNavigation;
    bypassNavigation.current = true;
    setPendingNavigation(null);
    setNavigationBlocker(null);
    if (target) {
      window.history.pushState({}, "", target);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  }

  const branchName = storeName || tenantName || staff?.storeName || "—";
  const username = staff?.username ?? "";
  const canSave = dirty && !submitting && Boolean(form?.name.trim() && form.phone.trim() && form.email.trim() && form.role);
  const statusLabel = staff?.isActive ? t("staff.status.active") : t("staff.status.inactive");
  const statusClass = staff?.isActive ? "bg-teal-100 text-teal-800" : "bg-slate-100 text-slate-600";

  if (loading && !form) {
    return (
      <div className="w-full px-5 py-4">
        <p className="text-sm text-muted">{t("staff.edit.loading")}</p>
      </div>
    );
  }

  if (loadError && !form) {
    return (
      <div className="w-full px-5 py-4">
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
          <p className="text-destructive">{loadError}</p>
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1 text-foreground hover:bg-canvas"
            onClick={() => setReload((current) => current + 1)}
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

  if (!form || !staff) return null;

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-4">
      {pendingNavigation ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 px-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={() => setPendingNavigation(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="unsaved-edit-staff-title"
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700">
                <AlertCircle className="size-5" />
              </span>
              <div>
                <h2 id="unsaved-edit-staff-title" className="text-lg font-semibold text-slate-950">
                  {t("staff.edit.unsavedTitle")}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  {t("staff.edit.unsavedBody")}
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                autoFocus
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => setPendingNavigation(null)}
              >
                {t("staff.add.keepEditing")}
              </button>
              <button
                type="button"
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                onClick={discardChanges}
              >
                {t("staff.add.discardChanges")}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <div className="mb-6">
        <nav className="flex items-center gap-1.5 text-xs text-muted">
          <button type="button" className="hover:text-primary hover:underline" onClick={() => navigate("/staff")}>
            {t("page.staffTitle")}
          </button>
          <span>/</span>
          <button type="button" className="hover:text-primary hover:underline" onClick={goToDetails}>
            {staff.name}
          </button>
          <span>/</span>
          <span className="font-medium text-foreground">{t("staff.placeholder.editTitle")}</span>
        </nav>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {t("staff.placeholder.editTitle")}
              </h1>
              <span className={`rounded-sm px-2 py-0.5 text-xs font-semibold ${statusClass}`}>
                {statusLabel}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted">{t("staff.edit.subtitle")}</p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground hover:bg-canvas"
            onClick={goToDetails}
          >
            <ArrowLeft className="size-4" strokeWidth={1.75} />
            {t("staff.edit.cancel")}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <CardTitle icon={<Users className="size-4 text-teal-600" />} title={t("staff.add.profileTitle")} />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label={t("staff.add.name")} required error={fieldErrors.name} errorId="edit-staff-name-error">
              <TextInput
                value={form.name}
                onChange={(value) => update("name", value)}
                onBlur={() => validate(form)}
                placeholder={t("staff.add.namePlaceholder")}
                error={Boolean(fieldErrors.name)}
                ariaDescribedBy={fieldErrors.name ? "edit-staff-name-error" : undefined}
              />
            </Field>
            <Field label={t("staff.col.phone")} required error={fieldErrors.phone} errorId="edit-staff-phone-error">
              <TextInput
                type="tel"
                value={form.phone}
                onChange={(value) => update("phone", value)}
                onBlur={() => validate(form)}
                placeholder={t("staff.add.phonePlaceholder")}
                error={Boolean(fieldErrors.phone)}
                ariaDescribedBy={fieldErrors.phone ? "edit-staff-phone-error" : undefined}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label={t("staff.add.email")} required error={fieldErrors.email} errorId="edit-staff-email-error">
                <TextInput
                  type="email"
                  value={form.email}
                  onChange={(value) => update("email", value)}
                  onBlur={() => validate(form)}
                  placeholder={t("staff.add.emailPlaceholder")}
                  error={Boolean(fieldErrors.email)}
                  ariaDescribedBy={fieldErrors.email ? "edit-staff-email-error" : undefined}
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label={t("staff.add.note")}>
                <textarea
                  rows={3}
                  value={form.internalNote}
                  onChange={(event) => update("internalNote", event.target.value)}
                  placeholder={t("staff.add.notePlaceholder")}
                  className="w-full min-h-[80px] resize-y rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                />
              </Field>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="size-4 text-teal-600" strokeWidth={2} />
              <h2 className="text-sm font-semibold text-foreground">{t("staff.add.accountTitle")}</h2>
            </div>
            <span className={`rounded-sm px-2 py-0.5 text-xs font-semibold ${statusClass}`}>
              {statusLabel}
            </span>
          </div>
          <div className="space-y-4">
            <Field label={t("staff.add.username")} required>
              <input
                type="text"
                disabled
                value={username}
                aria-describedby="staff-edit-username-helper"
                className="w-full cursor-not-allowed rounded-md border border-border bg-slate-100 px-3 py-2 font-mono text-sm text-slate-500 outline-none"
              />
              <p id="staff-edit-username-helper" className="mt-1 text-xs text-muted">
                {t("staff.edit.usernameHint")}
              </p>
            </Field>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label={t("staff.add.role")} required error={fieldErrors.role} errorId="edit-staff-role-error">
                <select
                  value={form.role}
                  onChange={(event) => update("role", event.target.value as EditStaffFormState["role"])}
                  onBlur={() => validate(form)}
                  aria-invalid={Boolean(fieldErrors.role)}
                  aria-describedby={fieldErrors.role ? "edit-staff-role-error" : undefined}
                  className={`w-full rounded-md border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:ring-1 ${
                    fieldErrors.role
                      ? "border-red-400 focus:border-red-400 focus:ring-red-400"
                      : "border-border focus:border-teal-600 focus:ring-teal-600"
                  }`}
                >
                  <option value="">{t("staff.add.rolePlaceholder")}</option>
                  <option value="MANAGER">{t("staff.role.manager")}</option>
                  <option value="CASHIER">{t("staff.role.cashier")}</option>
                </select>
              </Field>
              <Field label={t("staff.add.branch")} required>
                <select
                  disabled
                  value={storeId || staff.storeId || ""}
                  className="w-full cursor-not-allowed rounded-md border border-border bg-slate-50 px-3 py-2 text-sm text-slate-500 outline-none"
                >
                  <option value={storeId || staff.storeId || ""}>{branchName}</option>
                </select>
              </Field>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <CardTitle icon={<Shield className="size-4 text-teal-600" />} title={t("staff.edit.accessImpactTitle")} />
          <div className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <Info className="mt-0.5 size-4 shrink-0 text-teal-600" />
            <p className="text-xs leading-relaxed text-slate-600">{t("staff.edit.accessImpactBody")}</p>
          </div>
        </section>
      </div>

      {submitError ? (
        <div role="alert" className="mt-5 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{submitError}</span>
        </div>
      ) : null}

      <div className="sticky bottom-0 mt-6 flex justify-end gap-3 border-t border-border bg-canvas/95 py-4 backdrop-blur">
        <button
          type="button"
          onClick={goToDetails}
          disabled={submitting}
          className="rounded-md border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {t("staff.edit.cancel")}
        </button>
        <button
          type="button"
          disabled={!canSave}
          onClick={() => void save()}
          className="inline-flex items-center gap-2 rounded-md bg-[#00766c] px-5 py-2 text-sm font-semibold text-white hover:bg-[#00635c] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" strokeWidth={1.75} />}
          {submitting ? t("staff.edit.saving") : t("staff.edit.save")}
        </button>
      </div>
    </div>
  );
}

function CardTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="mb-4 flex items-center gap-2 border-b border-border pb-3">
      {icon}
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
    </div>
  );
}

function Field({
  label,
  required,
  error,
  errorId,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  errorId?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-foreground">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </span>
      {children}
      {error ? (
        <span id={errorId} role="alert" className="mt-1 block text-xs text-destructive">
          {error}
        </span>
      ) : null}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  onBlur,
  placeholder,
  error,
  type = "text",
  ariaDescribedBy,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  placeholder: string;
  error: boolean;
  type?: string;
  ariaDescribedBy?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      aria-invalid={error}
      aria-describedby={ariaDescribedBy}
      className={`h-10 w-full rounded-md border bg-surface px-3 text-sm text-foreground outline-none placeholder:text-muted focus:ring-1 ${
        error
          ? "border-red-400 focus:border-red-400 focus:ring-red-400"
          : "border-border focus:border-teal-600 focus:ring-teal-600"
      }`}
    />
  );
}
