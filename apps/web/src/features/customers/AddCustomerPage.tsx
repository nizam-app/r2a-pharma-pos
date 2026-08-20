import {
  AlertCircle,
  CheckCircle2,
  Info,
  Loader2,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { displayNameFromUser, useAuth } from "@/features/auth";
import { useLocale } from "@/i18n";
import { ApiError } from "@/lib/api";
import {
  checkCustomerPhone,
  createCustomer,
  type CustomerGender,
  type PhoneCheckCustomer,
} from "@/lib/customers";
import { useOwnerPath } from "@/lib/OwnerPathProvider";
import { useTenantChrome } from "@/lib/TenantContextProvider";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PHONE_LENGTH = 10;

type GenderOption = "" | CustomerGender;

type CustomerFormState = {
  name: string;
  phone: string;
  email: string;
  dateOfBirth: string;
  gender: GenderOption;
  address: string;
};

const EMPTY_FORM: CustomerFormState = {
  name: "",
  phone: "",
  email: "",
  dateOfBirth: "",
  gender: "",
  address: "",
};

type FieldErrors = Partial<Record<"name" | "phone" | "email", string>>;

type PhoneCheckState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "available" }
  | { status: "duplicate"; customer: PhoneCheckCustomer };

export function AddCustomerPage() {
  const { t } = useLocale();
  const { navigate, setNavigationBlocker } = useOwnerPath();
  const { storeName, tenantName } = useTenantChrome();
  const { user } = useAuth();

  const [form, setForm] = useState<CustomerFormState>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(
    null,
  );
  const bypassNavigation = useRef(false);

  const [phoneCheck, setPhoneCheck] = useState<PhoneCheckState>({
    status: "idle",
  });

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const confirmTriggerRef = useRef<HTMLButtonElement | null>(null);
  const confirmModalRef = useRef<HTMLElement | null>(null);

  const dirty =
    form.name.trim() !== "" ||
    form.phone.trim() !== "" ||
    form.email.trim() !== "" ||
    form.dateOfBirth !== "" ||
    form.gender !== "" ||
    form.address.trim() !== "";

  useEffect(() => {
    const blockNavigation = (to: string) => {
      if (bypassNavigation.current || !dirty) return true;
      setPendingNavigation(to);
      return false;
    };
    setNavigationBlocker(blockNavigation);
    return () => setNavigationBlocker(null);
  }, [dirty, setNavigationBlocker]);

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  useEffect(() => {
    const phone = form.phone.trim();
    if (phone.length < MIN_PHONE_LENGTH) {
      setPhoneCheck({ status: "idle" });
      return;
    }
    let cancelled = false;
    const handle = window.setTimeout(() => {
      setPhoneCheck({ status: "checking" });
      void checkCustomerPhone(phone)
        .then((res) => {
          if (cancelled) return;
          setPhoneCheck(
            res.exists && res.customer
              ? { status: "duplicate", customer: res.customer }
              : { status: "available" },
          );
        })
        .catch(() => {
          if (cancelled) return;
          setPhoneCheck({ status: "idle" });
        });
    }, 450);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [form.phone]);

  useEffect(() => {
    if (!confirmOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) setConfirmOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmOpen, submitting]);

  useEffect(() => {
    if (!confirmOpen) return;
    const modal = confirmModalRef.current;
    if (!modal) return;
    const selector =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const first = modal.querySelector<HTMLElement>(selector);
    first?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const focusables = Array.from(
        modal.querySelectorAll<HTMLElement>(selector),
      ).filter((el) => el.offsetParent !== null);
      if (focusables.length === 0) return;
      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];
      if (!firstEl || !lastEl) return;
      if (event.shiftKey && document.activeElement === firstEl) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => document.removeEventListener("keydown", trap);
  }, [confirmOpen]);

  function update<K extends keyof CustomerFormState>(
    key: K,
    value: CustomerFormState[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
    if (key === "name" || key === "phone" || key === "email") {
      setFieldErrors((current) => ({ ...current, [key]: undefined }));
    }
  }

  function blurField(key: "name" | "phone" | "email") {
    setFieldErrors((current) => {
      const next = { ...current };
      if (key === "name" && !form.name.trim()) {
        next.name = t("customers.add.nameRequired");
      } else if (key === "phone" && !form.phone.trim()) {
        next.phone = t("customers.add.phoneRequired");
      } else if (key === "email" && form.email.trim() && !EMAIL_PATTERN.test(form.email.trim())) {
        next.email = t("customers.add.emailInvalid");
      } else {
        next[key] = undefined;
      }
      return next;
    });
  }

  function buildPayload() {
    return {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || undefined,
      dateOfBirth: form.dateOfBirth
        ? new Date(`${form.dateOfBirth}T00:00:00`)
        : undefined,
      gender: form.gender || undefined,
      address: form.address.trim() || undefined,
    };
  }

  const canCreate =
    form.name.trim() !== "" &&
    form.phone.trim() !== "" &&
    phoneCheck.status !== "duplicate";

  function openConfirm() {
    const nextErrors: FieldErrors = {};
    if (!form.name.trim()) nextErrors.name = t("customers.add.nameRequired");
    if (!form.phone.trim()) nextErrors.phone = t("customers.add.phoneRequired");
    if (form.email.trim() && !EMAIL_PATTERN.test(form.email.trim())) {
      nextErrors.email = t("customers.add.emailInvalid");
    }
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).some((key) => nextErrors[key as keyof FieldErrors])) {
      return;
    }
    setConfirmed(false);
    setCreateError(null);
    setConfirmOpen(true);
  }

  function closeConfirm() {
    setConfirmOpen(false);
    confirmTriggerRef.current?.focus();
  }

  async function confirmCreate() {
    if (!confirmed || submitting) return;
    setSubmitting(true);
    setCreateError(null);
    try {
      const created = await createCustomer(buildPayload());
      setConfirmOpen(false);
      bypassNavigation.current = true;
      setNavigationBlocker(null);
      navigate(`/customers/${encodeURIComponent(created.id)}`);
    } catch (submitError: unknown) {
      setSubmitting(false);
      setCreateError(
        submitError instanceof ApiError
          ? submitError.message
          : submitError instanceof Error
            ? submitError.message
            : t("customers.add.confirm.error"),
      );
    }
  }

  function viewExisting(customer: PhoneCheckCustomer) {
    const path =
      customer.status === "PENDING_APPROVAL"
        ? `/customers/${encodeURIComponent(customer.id)}/review`
        : `/customers/${encodeURIComponent(customer.id)}`;
    navigate(path);
  }

  function cancel() {
    bypassNavigation.current = true;
    setNavigationBlocker(null);
    navigate("/customers");
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

  const branchName = storeName || tenantName || "—";
  const createdByName = user ? displayNameFromUser(user) : "—";

  return (
    <div className="w-full px-5 py-4">
      {pendingNavigation ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 px-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={() => setPendingNavigation(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="unsaved-customer-title"
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700">
                <AlertCircle className="size-5" />
              </span>
              <div>
                <h2
                  id="unsaved-customer-title"
                  className="text-lg font-semibold text-slate-950"
                >
                  {t("customers.add.unsavedTitle")}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  {t("customers.add.unsavedBody")}
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
                {t("customers.add.keepEditing")}
              </button>
              <button
                type="button"
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                onClick={discardChanges}
              >
                {t("customers.add.discardChanges")}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted">
            {t("customers.add.crumb")}
          </p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-foreground">
            {t("customers.add.title")}
          </h1>
          <p className="mt-1 text-sm text-muted">{t("customers.add.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={cancel}
          className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-canvas"
        >
          {t("customers.add.cancel")}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2.4fr)_minmax(240px,1fr)]">
        <div className="flex flex-col gap-4">
          <section className="rounded-xl border border-border bg-surface p-5">
            <SectionHeader
              icon={<Users className="size-4 text-primary" strokeWidth={1.75} />}
              title={t("customers.add.customerInfo")}
              hint={t("customers.add.customerInfoHint")}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label={t("customers.add.name")}
                required
                error={fieldErrors.name}
                errorId="customer-name-error"
              >
                <input
                  type="text"
                  value={form.name}
                  onChange={(event) => update("name", event.target.value)}
                  onBlur={() => blurField("name")}
                  placeholder={t("customers.add.namePlaceholder")}
                  aria-required="true"
                  aria-invalid={Boolean(fieldErrors.name)}
                  aria-describedby={fieldErrors.name ? "customer-name-error" : undefined}
                  className={`w-full rounded-md border bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:ring-1 ${
                    fieldErrors.name
                      ? "border-red-400 focus:border-red-400 focus:ring-red-400"
                      : "border-border focus:border-teal-600 focus:ring-teal-600"
                  }`}
                />
              </Field>
              <Field
                label={t("customers.add.phone")}
                required
                error={fieldErrors.phone}
                errorId="customer-phone-error"
              >
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(event) => update("phone", event.target.value)}
                  onBlur={() => blurField("phone")}
                  placeholder={t("customers.add.phonePlaceholder")}
                  aria-required="true"
                  aria-invalid={Boolean(fieldErrors.phone)}
                  aria-describedby={fieldErrors.phone ? "customer-phone-error" : undefined}
                  className={`w-full rounded-md border bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:ring-1 ${
                    fieldErrors.phone
                      ? "border-red-400 focus:border-red-400 focus:ring-red-400"
                      : "border-border focus:border-teal-600 focus:ring-teal-600"
                  }`}
                />
              </Field>
            </div>

            <div className="mt-2 max-w-full sm:max-w-[50%]" aria-live="polite">
              <PhoneCheckPanel state={phoneCheck} onView={viewExisting} />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label={t("customers.add.email")}
                error={fieldErrors.email}
                errorId="customer-email-error"
              >
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => update("email", event.target.value)}
                  onBlur={() => blurField("email")}
                  placeholder={t("customers.add.emailPlaceholder")}
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={fieldErrors.email ? "customer-email-error" : undefined}
                  className={`w-full rounded-md border bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:ring-1 ${
                    fieldErrors.email
                      ? "border-red-400 focus:border-red-400 focus:ring-red-400"
                      : "border-border focus:border-teal-600 focus:ring-teal-600"
                  }`}
                />
              </Field>
              <Field label={t("customers.add.dateOfBirth")}>
                <input
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(event) => update("dateOfBirth", event.target.value)}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                />
              </Field>
              <Field label={t("customers.add.gender")}>
                <select
                  value={form.gender}
                  onChange={(event) =>
                    update("gender", event.target.value as GenderOption)
                  }
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                >
                  <option value="">{t("customers.add.genderSelect")}</option>
                  <option value="MALE">{t("customers.add.gender.male")}</option>
                  <option value="FEMALE">{t("customers.add.gender.female")}</option>
                  <option value="OTHER">{t("customers.add.gender.other")}</option>
                </select>
              </Field>
              <div className="sm:col-span-2">
                <Field label={t("customers.add.address")}>
                  <textarea
                    rows={3}
                    value={form.address}
                    onChange={(event) => update("address", event.target.value)}
                    placeholder={t("customers.add.addressPlaceholder")}
                    className="w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                  />
                </Field>
              </div>
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-4">
          <section className="rounded-xl border border-border bg-surface p-5">
            <SectionHeader
              icon={<Info className="size-4 text-primary" strokeWidth={1.75} />}
              title={t("customers.add.directTitle")}
            />
            <p className="text-sm leading-relaxed text-muted">
              {t("customers.add.directBody")}
            </p>
          </section>

          <section className="rounded-xl border border-border bg-surface p-5">
            <SectionHeader
              icon={<ShieldCheck className="size-4 text-primary" strokeWidth={1.75} />}
              title={t("customers.add.systemTitle")}
            />
            <dl className="flex flex-col">
              <InfoRow
                label={t("customers.add.systemSource")}
                value={t("customers.source.ownerCreated")}
              />
              <InfoRow label={t("customers.add.systemBranch")} value={branchName} />
              <InfoRow label={t("customers.add.systemCreatedBy")} value={createdByName} />
            </dl>
            <p className="mt-3 text-xs italic text-muted">
              {t("customers.add.systemNote")}
            </p>
          </section>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-border pt-4">
        <button
          type="button"
          onClick={cancel}
          className="rounded-md border border-border bg-surface px-5 py-2 text-sm font-medium text-foreground hover:bg-canvas"
        >
          {t("customers.add.cancel")}
        </button>
        <button
          ref={confirmTriggerRef}
          type="button"
          disabled={!canCreate}
          onClick={openConfirm}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <UserPlus className="size-4" strokeWidth={1.75} />
          {t("customers.add.createCustomer")}
        </button>
      </div>

      {confirmOpen ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-3 backdrop-blur-[2px] sm:p-6 md:bg-black/40"
          role="presentation"
        >
          <section
            ref={confirmModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-customer-title"
            aria-describedby="create-customer-intro"
            className="max-h-[90vh] w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl sm:max-w-[500px]"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2
                id="create-customer-title"
                className="text-lg font-semibold text-slate-900"
              >
                {t("customers.add.confirm.title")}
              </h2>
              <button
                type="button"
                onClick={closeConfirm}
                disabled={submitting}
                aria-label={t("customers.add.confirm.close")}
                className="inline-flex size-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              <p
                id="create-customer-intro"
                className="text-xs leading-relaxed text-slate-600"
              >
                {t("customers.add.confirm.intro")}
              </p>

              <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  {t("customers.add.confirm.summaryTitle")}
                </p>
                <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
                  <SummaryCell
                    label={t("customers.add.confirm.name")}
                    value={form.name.trim()}
                  />
                  <SummaryCell
                    label={t("customers.add.confirm.phone")}
                    value={form.phone.trim()}
                  />
                  <SummaryCell
                    label={t("customers.add.confirm.branch")}
                    value={branchName}
                  />
                  <SummaryCell
                    label={t("customers.add.confirm.source")}
                    value={t("customers.source.ownerCreated")}
                  />
                </div>
              </div>

              <div className="rounded-md border border-teal-200 bg-teal-50 p-4">
                <h3 className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-primary">
                  <Info className="size-3.5" />
                  {t("customers.add.confirm.afterTitle")}
                </h3>
                <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-600">
                  <AfterItem text={t("customers.add.confirm.after1")} />
                  <AfterItem text={t("customers.add.confirm.after2")} />
                  <AfterItem text={t("customers.add.confirm.after3")} />
                  <AfterItem text={t("customers.add.confirm.after4")} />
                  <AfterItem text={t("customers.add.confirm.after5")} />
                </ul>
              </div>

              <label className="flex items-start gap-2 py-1">
                <input
                  type="checkbox"
                  checked={confirmed}
                  disabled={submitting}
                  onChange={(event) => setConfirmed(event.target.checked)}
                  className="mt-0.5 size-4 shrink-0 accent-teal-600"
                />
                <span className="text-xs leading-relaxed text-slate-600">
                  {t("customers.add.confirm.confirmLabel")}
                </span>
              </label>

              {createError ? (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700"
                >
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{createError}</span>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                disabled={submitting}
                onClick={closeConfirm}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {t("customers.add.confirm.cancel")}
              </button>
              <button
                type="button"
                disabled={!confirmed || submitting}
                onClick={() => void confirmCreate()}
                aria-disabled={!confirmed || submitting}
                className={`inline-flex items-center gap-2 rounded-md px-5 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00766c] focus-visible:ring-offset-2 ${
                  !confirmed || submitting
                    ? "cursor-not-allowed bg-[#79b5ae] opacity-70"
                    : "bg-[#00766c] hover:bg-[#00635c]"
                }`}
              >
                {submitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <UserPlus className="size-4" strokeWidth={1.75} />
                )}
                {submitting
                  ? t("customers.add.confirm.submitting")
                  : t("customers.add.confirm.submit")}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  hint,
}: {
  icon: ReactNode;
  title: string;
  hint?: string;
}) {
  return (
    <div className="mb-4 flex items-start gap-2 border-b border-border pb-3">
      <span className="mt-0.5">{icon}</span>
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
      </div>
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
      <span className="mb-1.5 block text-xs font-medium text-foreground">
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-2 last:border-b-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="max-w-[60%] truncate text-right text-sm font-medium text-foreground">
        {value}
      </dd>
    </div>
  );
}

function PhoneCheckPanel({
  state,
  onView,
}: {
  state: PhoneCheckState;
  onView: (customer: PhoneCheckCustomer) => void;
}) {
  const { t } = useLocale();
  if (state.status === "idle") return null;
  if (state.status === "checking") {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-canvas px-3 py-2 text-xs text-muted">
        <Loader2 className="size-3.5 animate-spin" />
        <span>{t("customers.add.phoneCheck.checking")}</span>
      </div>
    );
  }
  if (state.status === "available") {
    return (
      <div className="flex items-start gap-2 rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-xs text-teal-900">
        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
        <div>
          <p className="font-semibold uppercase tracking-wide text-primary">
            {t("customers.add.phoneCheck.title")}
          </p>
          <p className="mt-0.5">{t("customers.add.phoneCheck.available")}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
      <div>
        <p className="font-semibold uppercase tracking-wide">
          {t("customers.add.phoneCheck.title")}
        </p>
        <p className="mt-0.5">{t("customers.add.phoneCheck.duplicate")}</p>
        <button
          type="button"
          onClick={() => onView(state.customer)}
          className="mt-1 font-medium text-amber-800 underline underline-offset-2 hover:text-amber-950"
        >
          {t("customers.add.phoneCheck.viewProfile")}
        </button>
      </div>
    </div>
  );
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-0.5 text-[10px] text-muted">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function AfterItem({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2">
      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
      <span>{text}</span>
    </li>
  );
}