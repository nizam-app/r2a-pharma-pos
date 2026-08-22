import {
  AlertCircle,
  CheckCircle2,
  Info,
  Loader2,
  UserPlus,
  Users,
  X,
  Copy,
  Check,
  SlidersHorizontal,
  Shield,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocale } from "@/i18n";
import { ApiError } from "@/lib/api";
import {
  createStaff,
  type CreateStaffResult,
  type StaffCreatePayload,
} from "@/lib/staff";
import { useOwnerPath } from "@/lib/OwnerPathProvider";
import { useTenantChrome } from "@/lib/TenantContextProvider";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type StaffFormState = {
  name: string;
  phone: string;
  email: string;
  role: "MANAGER" | "CASHIER" | "";
  internalNote: string;
};

const EMPTY_FORM: StaffFormState = {
  name: "",
  phone: "",
  email: "",
  role: "",
  internalNote: "",
};

type FieldErrors = Partial<Record<"name" | "phone" | "email" | "role", string>>;

export function AddStaffPage() {
  const { t } = useLocale();
  const { navigate, setNavigationBlocker } = useOwnerPath();
  const { storeId, storeName, tenantName } = useTenantChrome();

  const [form, setForm] = useState<StaffFormState>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const bypassNavigation = useRef(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  
  // State for success result (one-time password reveal)
  const [successResult, setSuccessResult] = useState<CreateStaffResult | null>(null);
  const [copied, setCopied] = useState(false);

  const confirmTriggerRef = useRef<HTMLButtonElement | null>(null);
  const confirmModalRef = useRef<HTMLElement | null>(null);

  const dirty =
    form.name.trim() !== "" ||
    form.phone.trim() !== "" ||
    form.email.trim() !== "" ||
    form.role !== "" ||
    form.internalNote.trim() !== "";

  // Derive Username from Email local-part (fallback to Full Name derived username if email empty)
  const emailValue = form.email.trim();
  const nameValue = form.name.trim();
  const derivedUsername = emailValue
    ? emailValue.split("@")[0]
    : nameValue
    ? nameValue.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")
    : "jdoe_pharma";

  // Unsaved changes navigation guard
  useEffect(() => {
    const blockNavigation = (to: string) => {
      if (bypassNavigation.current || !dirty || successResult !== null) return true;
      setPendingNavigation(to);
      return false;
    };
    setNavigationBlocker(blockNavigation);
    return () => setNavigationBlocker(null);
  }, [dirty, setNavigationBlocker, successResult]);

  useEffect(() => {
    if (!dirty || successResult !== null) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty, successResult]);

  // Trap focus & handle keyboard navigation inside modal
  useEffect(() => {
    if (!confirmOpen) return;
    const onKey = (event: KeyboardEvent) => {
      // Don't allow closing success screen with Esc
      if (event.key === "Escape" && !submitting && !successResult) {
        setConfirmOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmOpen, submitting, successResult]);

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

  function update<K extends keyof StaffFormState>(
    key: K,
    value: StaffFormState[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
    if (key === "name" || key === "phone" || key === "email" || key === "role") {
      setFieldErrors((current) => ({ ...current, [key]: undefined }));
    }
  }

  function blurField(key: "name" | "phone" | "email" | "role") {
    setFieldErrors((current) => {
      const next = { ...current };
      if (key === "name" && !form.name.trim()) {
        next.name = t("staff.add.nameRequired");
      } else if (key === "phone" && !form.phone.trim()) {
        next.phone = t("staff.add.phoneRequired");
      } else if (key === "email") {
        if (!form.email.trim()) {
          next.email = t("staff.add.emailRequired");
        } else if (!EMAIL_PATTERN.test(form.email.trim())) {
          next.email = t("staff.add.emailInvalid");
        }
      } else if (key === "role" && !form.role) {
        next.role = t("staff.add.roleRequired");
      } else {
        next[key] = undefined;
      }
      return next;
    });
  }

  function buildPayload(): StaffCreatePayload {
    return {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      role: form.role as "MANAGER" | "CASHIER",
      internalNote: form.internalNote.trim() || undefined,
      storeId: storeId || undefined,
    };
  }

  const canCreate =
    form.name.trim() !== "" &&
    form.phone.trim() !== "" &&
    form.email.trim() !== "" &&
    form.role !== "";

  function openConfirm() {
    const nextErrors: FieldErrors = {};
    if (!form.name.trim()) nextErrors.name = t("staff.add.nameRequired");
    if (!form.phone.trim()) nextErrors.phone = t("staff.add.phoneRequired");
    if (!form.email.trim()) {
      nextErrors.email = t("staff.add.emailRequired");
    } else if (!EMAIL_PATTERN.test(form.email.trim())) {
      nextErrors.email = t("staff.add.emailInvalid");
    }
    if (!form.role) nextErrors.role = t("staff.add.roleRequired");

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
      const res = await createStaff(buildPayload());
      setSuccessResult(res);
      setSubmitting(false);
    } catch (submitError: unknown) {
      setSubmitting(false);
      if (submitError instanceof ApiError) {
        setCreateError(submitError.message);
      } else if (submitError instanceof Error) {
        setCreateError(submitError.message);
      } else {
        setCreateError(t("staff.error"));
      }
    }
  }

  function cancel() {
    bypassNavigation.current = true;
    setNavigationBlocker(null);
    navigate("/staff");
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

  async function handleCopy() {
    if (!successResult) return;
    try {
      await navigator.clipboard.writeText(successResult.temporaryPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  }

  function proceedToProfile() {
    if (!successResult) return;
    bypassNavigation.current = true;
    setNavigationBlocker(null);
    setConfirmOpen(false);
    navigate(`/staff/${encodeURIComponent(successResult.user.id)}`);
  }

  const branchName = storeName || tenantName || "—";

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
            aria-labelledby="unsaved-staff-title"
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700">
                <AlertCircle className="size-5" />
              </span>
              <div>
                <h2
                  id="unsaved-staff-title"
                  className="text-lg font-semibold text-slate-950"
                >
                  {t("staff.add.unsavedTitle")}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  {t("staff.add.unsavedBody")}
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

      {/* breadcrumb & title area */}
      <div className="mb-6">
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <span className="cursor-pointer hover:underline text-slate-500" onClick={cancel}>Staff</span>
          <span className="text-slate-400">&gt;</span>
          <span className="font-medium text-foreground">{t("staff.placeholder.newTitle")}</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
          {t("staff.placeholder.newTitle")}
        </h1>
        <p className="mt-1 text-sm text-muted">{t("staff.add.subtitle")}</p>
      </div>

      <div className="flex flex-col gap-5">
        {/* Card 1: Staff Profile Information */}
        <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2 border-b border-border pb-3">
            <Users className="size-4 text-teal-600" strokeWidth={2} />
            <h2 className="text-sm font-semibold text-foreground">
              {t("staff.add.profileTitle")}
            </h2>
          </div>
          
          <div className="space-y-4">
            <Field
              label={t("staff.add.name")}
              required
              error={fieldErrors.name}
              errorId="staff-name-error"
            >
              <input
                type="text"
                value={form.name}
                onChange={(event) => update("name", event.target.value)}
                onBlur={() => blurField("name")}
                placeholder={t("staff.add.namePlaceholder")}
                aria-required="true"
                aria-invalid={Boolean(fieldErrors.name)}
                aria-describedby={fieldErrors.name ? "staff-name-error" : undefined}
                className={`w-full rounded-md border bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:ring-1 ${
                  fieldErrors.name
                    ? "border-red-400 focus:border-red-400 focus:ring-red-400"
                    : "border-border focus:border-teal-600 focus:ring-teal-600"
                }`}
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label={t("staff.col.phone")}
                required
                error={fieldErrors.phone}
                errorId="staff-phone-error"
              >
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(event) => update("phone", event.target.value)}
                  onBlur={() => blurField("phone")}
                  placeholder={t("staff.add.phonePlaceholder")}
                  aria-required="true"
                  aria-invalid={Boolean(fieldErrors.phone)}
                  aria-describedby={fieldErrors.phone ? "staff-phone-error" : undefined}
                  className={`w-full rounded-md border bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:ring-1 ${
                    fieldErrors.phone
                      ? "border-red-400 focus:border-red-400 focus:ring-red-400"
                      : "border-border focus:border-teal-600 focus:ring-teal-600"
                  }`}
                />
              </Field>

              <Field
                label={t("staff.add.emailLabel")}
                required
                error={fieldErrors.email}
                errorId="staff-email-error"
              >
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => update("email", event.target.value)}
                  onBlur={() => blurField("email")}
                  placeholder={t("staff.add.emailPlaceholder")}
                  aria-required="true"
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={fieldErrors.email ? "staff-email-error" : undefined}
                  className={`w-full rounded-md border bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:ring-1 ${
                    fieldErrors.email
                      ? "border-red-400 focus:border-red-400 focus:ring-red-400"
                      : "border-border focus:border-teal-600 focus:ring-teal-600"
                  }`}
                />
              </Field>
            </div>

            <Field label={t("staff.add.note")}>
              <textarea
                rows={3}
                value={form.internalNote}
                onChange={(event) => update("internalNote", event.target.value)}
                placeholder={t("staff.add.notePlaceholder")}
                className="w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
              />
            </Field>
          </div>
        </section>

        {/* Card 2: Account Configuration */}
        <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2 border-b border-border pb-3">
            <SlidersHorizontal className="size-4 text-teal-600" strokeWidth={2} />
            <h2 className="text-sm font-semibold text-foreground">
              {t("staff.add.accountTitle")}
            </h2>
          </div>

          <div className="space-y-4">
            <Field label={t("staff.add.username")} required>
              <div className="flex rounded-md border border-border bg-slate-50 focus-within:ring-1 focus-within:ring-teal-600 focus-within:border-teal-600">
                <span className="inline-flex items-center rounded-l-md bg-slate-100 px-3 text-sm text-slate-500 border-r border-border font-mono">
                  @
                </span>
                <input
                  type="text"
                  disabled
                  value={derivedUsername}
                  className="flex-1 bg-transparent px-3 py-2 text-sm text-slate-500 outline-none cursor-not-allowed rounded-r-md font-mono"
                />
              </div>
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label={t("staff.add.role")}
                required
                error={fieldErrors.role}
                errorId="staff-role-error"
              >
                <select
                  value={form.role}
                  onChange={(event) => update("role", event.target.value as "MANAGER" | "CASHIER" | "")}
                  onBlur={() => blurField("role")}
                  aria-required="true"
                  aria-invalid={Boolean(fieldErrors.role)}
                  aria-describedby={fieldErrors.role ? "staff-role-error" : undefined}
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
                  value={storeId || ""}
                  className="w-full rounded-md border border-border bg-slate-50 px-3 py-2 text-sm text-slate-500 outline-none cursor-not-allowed"
                >
                  <option value={storeId || ""}>{branchName}</option>
                </select>
              </Field>
            </div>
          </div>
        </section>

        {/* Card 3: Account Access & Security */}
        <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2 border-b border-border pb-3">
            <Shield className="size-4 text-teal-600" strokeWidth={2} />
            <h2 className="text-sm font-semibold text-foreground">
              {t("staff.add.securityTitle")}
            </h2>
          </div>

          <div className="rounded-md border border-blue-100 bg-blue-50/50 p-4">
            <div className="flex gap-2">
              <Info className="size-4 shrink-0 text-blue-600 mt-0.5" />
              <p className="text-xs leading-relaxed text-blue-800">
                {t("staff.add.securityHint")}
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Page Actions Footer */}
      <div className="mt-6 flex items-center justify-end gap-3 border-t border-border pt-4">
        <button
          type="button"
          onClick={cancel}
          className="rounded-md border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {t("staff.add.cancel")}
        </button>
        <button
          ref={confirmTriggerRef}
          type="button"
          disabled={!canCreate}
          onClick={openConfirm}
          className="inline-flex items-center gap-2 rounded-md bg-[#00766c] hover:bg-[#00635c] px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <UserPlus className="size-4" strokeWidth={1.75} />
          {t("staff.addStaff")}
        </button>
      </div>

      {/* Confirm & One-time password reveal Dialog */}
      {confirmOpen ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-3 backdrop-blur-[2px] sm:p-6 md:bg-black/40"
          role="presentation"
        >
          <section
            ref={confirmModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-staff-title"
            aria-describedby="create-staff-intro"
            className="max-h-[90vh] w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl sm:max-w-[500px]"
          >
            {!successResult ? (
              // 1. CONFIRMATION STEP
              <>
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                  <h2
                    id="create-staff-title"
                    className="text-lg font-semibold text-slate-900"
                  >
                    {t("staff.addStaff")}
                  </h2>
                  <button
                    type="button"
                    onClick={closeConfirm}
                    disabled={submitting}
                    aria-label={t("staff.add.cancel")}
                    className="inline-flex size-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                <div className="space-y-4 px-5 py-4">
                  <p
                    id="create-staff-intro"
                    className="text-xs leading-relaxed text-slate-600"
                  >
                    {t("staff.add.subtitle")}
                  </p>

                  <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                    <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      {t("staff.add.systemInfo")}
                    </p>
                    <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
                      <SummaryCell
                        label={t("staff.col.name")}
                        value={form.name.trim()}
                      />
                      <SummaryCell
                        label={t("staff.col.phone")}
                        value={form.phone.trim()}
                      />
                      <SummaryCell
                        label={t("staff.add.email")}
                        value={form.email.trim()}
                      />
                      <SummaryCell
                        label={t("staff.add.role")}
                        value={
                          form.role === "MANAGER"
                            ? t("staff.role.manager")
                            : t("staff.role.cashier")
                        }
                      />
                      <SummaryCell
                        label={t("staff.col.store")}
                        value={branchName}
                      />
                    </div>
                  </div>

                  <div className="rounded-md border border-teal-200 bg-teal-50 p-4">
                    <h3 className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-primary">
                      <Info className="size-3.5" />
                      {t("staff.add.statusActive")}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      {t("staff.add.statusActiveBody")}
                    </p>
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
                      {t("staff.add.unsaved")}
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
                    {t("staff.add.cancel")}
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
                      ? t("inventory.batch.confirm.processing")
                      : t("staff.addStaff")}
                  </button>
                </div>
              </>
            ) : (
              // 2. ONE-TIME PASSWORD REVEAL STEP (Not dismissible by cancel / close)
              <>
                <div className="flex items-center border-b border-slate-200 px-5 py-4 bg-teal-50">
                  <CheckCircle2 className="size-5 text-teal-600 mr-2" />
                  <h2 className="text-lg font-semibold text-teal-900">
                    {t("staff.add.successTitle")}
                  </h2>
                </div>

                <div className="space-y-4 px-5 py-4">
                  <div className="rounded-md border border-teal-200 bg-teal-50/50 p-4">
                    <p className="text-xs text-teal-800 leading-relaxed font-medium">
                      {t("staff.add.tempPasswordHint")}
                    </p>

                    <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-teal-200 bg-white p-3 font-mono">
                      <span className="text-lg font-semibold tracking-wider text-teal-950 select-all">
                        {successResult.temporaryPassword}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopy}
                        className="inline-flex items-center gap-1.5 rounded-md border border-teal-300 bg-teal-50 px-2.5 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-100"
                      >
                        {copied ? (
                          <>
                            <Check className="size-3 text-emerald-600" />
                            {t("staff.add.passwordCopied")}
                          </>
                        ) : (
                          <>
                            <Copy className="size-3" />
                            {t("staff.add.copyPassword")}
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-xs space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted">{t("staff.col.name")}:</span>
                      <span className="font-medium text-foreground">{successResult.user.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">{t("staff.add.email")}:</span>
                      <span className="font-mono font-medium text-foreground">{successResult.user.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">{t("staff.col.username")}:</span>
                      <span className="font-mono font-medium text-foreground">{successResult.user.username}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
                  <button
                    type="button"
                    onClick={proceedToProfile}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-[#00766c] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#00635c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00766c]"
                  >
                    {t("staff.add.continueToProfile")}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      ) : null}
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
    <div className="block">
      <span className="mb-1.5 block text-xs font-semibold text-foreground">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </span>
      {children}
      {error ? (
        <span id={errorId} role="alert" className="mt-1 block text-xs text-destructive">
          {error}
        </span>
      ) : null}
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
