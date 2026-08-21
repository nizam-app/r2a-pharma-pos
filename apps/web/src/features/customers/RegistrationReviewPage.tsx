import {
  AlertCircle,
  CheckCircle2,
  Info,
  Loader2,
  ShieldCheck,
  UserCheck,
  UserRound,
  UserX,
  Users,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocale } from "@/i18n";
import { ApiError } from "@/lib/api";
import {
  approveCustomer,
  checkCustomerPhone,
  fetchCustomerDetail,
  rejectCustomer,
  type CustomerDetail,
  type CustomerGender,
  type PhoneCheckCustomer,
} from "@/lib/customers";
import { formatDateTime } from "@/lib/format";
import { useOwnerPath } from "@/lib/OwnerPathProvider";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PHONE_LENGTH = 10;

type GenderOption = "" | CustomerGender;

type ProfileFormState = {
  name: string;
  phone: string;
  email: string;
  dateOfBirth: string;
  gender: GenderOption;
  address: string;
};

type FieldErrors = Partial<Record<"name" | "phone" | "email", string>>;

type ReviewPhoneCheck =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "available" }
  | { status: "duplicate"; customer: PhoneCheckCustomer };

function formFromProfile(profile: CustomerDetail["profile"]): ProfileFormState {
  return {
    name: profile.name,
    phone: profile.phone,
    email: profile.email ?? "",
    dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.slice(0, 10) : "",
    gender: profile.gender ?? "",
    address: profile.address ?? "",
  };
}

function useDialogBehavior(
  open: boolean,
  modalRef: React.RefObject<HTMLElement | null>,
  close: () => void,
) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const modal = modalRef.current;
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
  }, [open, modalRef]);
}

/**
 * Customer Registration Review (Batch AK). Content region only — chrome is
 * Batch B. Live GET /owner/customers/:id (OWNER only). Shows the read-only
 * POS registration request (name/phone/source/submitted/branch/by) with a live
 * duplicate check plus an editable profile the Owner may correct before
 * approving. Approve (shared checkbox-gated modal) → POST .../approve →
 * Details. Reject (invented modal) → POST .../reject → list (row gone).
 * Cancel → list. A non-pending id redirects to Details (the detail API filters
 * out REJECTED rows, so those surface as the not-found state). No POS Create
 * (Batch AL).
 */
export function RegistrationReviewPage({ customerId }: { customerId: string }) {
  const { t } = useLocale();
  const { navigate, setNavigationBlocker } = useOwnerPath();

  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  const [form, setForm] = useState<ProfileFormState | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [phoneCheck, setPhoneCheck] = useState<ReviewPhoneCheck>({
    status: "idle",
  });

  const [approveOpen, setApproveOpen] = useState(false);
  const [approveConfirmed, setApproveConfirmed] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);
  const approveTriggerRef = useRef<HTMLButtonElement | null>(null);
  const approveModalRef = useRef<HTMLElement | null>(null);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectConfirmed, setRejectConfirmed] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [rejectionNote, setRejectionNote] = useState("");
  const rejectTriggerRef = useRef<HTMLButtonElement | null>(null);
  const rejectModalRef = useRef<HTMLElement | null>(null);

  const [pendingNavigation, setPendingNavigation] = useState<string | null>(
    null,
  );
  const bypassNavigation = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetchCustomerDetail(customerId)
      .then((payload) => {
        if (cancelled) return;
        if (payload.profile.status !== "PENDING_APPROVAL") {
          navigate(`/customers/${encodeURIComponent(payload.profile.id)}`);
          return;
        }
        setCustomer(payload);
        setForm(formFromProfile(payload.profile));
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

  const dirty = Boolean(
    customer &&
      form &&
      (form.name.trim() !== customer.profile.name.trim() ||
        form.phone.trim() !== customer.profile.phone ||
        form.email.trim() !== (customer.profile.email ?? "") ||
        form.dateOfBirth !==
          (customer.profile.dateOfBirth
            ? customer.profile.dateOfBirth.slice(0, 10)
            : "") ||
        form.gender !== (customer.profile.gender ?? "") ||
        form.address.trim() !== (customer.profile.address ?? "")),
  );

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
    const phone = form?.phone.trim() ?? "";
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
          if (res.exists && res.customer && res.customer.id !== customerId) {
            setPhoneCheck({ status: "duplicate", customer: res.customer });
          } else {
            setPhoneCheck({ status: "available" });
          }
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
  }, [form?.phone, customerId]);

  const closeApprove = useCallback(() => {
    if (approving) return;
    setApproveOpen(false);
  }, [approving]);

  const closeReject = useCallback(() => {
    if (rejecting) return;
    setRejectOpen(false);
  }, [rejecting]);

  useDialogBehavior(approveOpen, approveModalRef, closeApprove);
  useDialogBehavior(rejectOpen, rejectModalRef, closeReject);

  function update<K extends keyof ProfileFormState>(
    key: K,
    value: ProfileFormState[K],
  ) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
    if (key === "name" || key === "phone" || key === "email") {
      setFieldErrors((current) => ({ ...current, [key]: undefined }));
    }
  }

  function blurField(key: "name" | "phone" | "email") {
    setFieldErrors((current) => {
      const next = { ...current };
      if (key === "name" && !(form?.name.trim() ?? "")) {
        next.name = t("customers.add.nameRequired");
      } else if (key === "phone" && !(form?.phone.trim() ?? "")) {
        next.phone = t("customers.add.phoneRequired");
      } else if (
        key === "email" &&
        (form?.email.trim() ?? "") &&
        !EMAIL_PATTERN.test(form?.email.trim() ?? "")
      ) {
        next.email = t("customers.add.emailInvalid");
      } else {
        next[key] = undefined;
      }
      return next;
    });
  }

  function buildApprovePayload() {
    return {
      name: form?.name.trim() ?? "",
      phone: form?.phone.trim() ?? "",
      email: form?.email.trim() || undefined,
      dateOfBirth: form?.dateOfBirth
        ? new Date(`${form.dateOfBirth}T00:00:00`)
        : undefined,
      gender: form?.gender || undefined,
      address: form?.address.trim() || undefined,
    };
  }

  const canApprove =
    (form?.name.trim() ?? "") !== "" &&
    (form?.phone.trim() ?? "") !== "" &&
    phoneCheck.status !== "duplicate";

  function openApprove() {
    if (!form) return;
    const nextErrors: FieldErrors = {};
    if (!form.name.trim()) nextErrors.name = t("customers.add.nameRequired");
    if (!form.phone.trim()) nextErrors.phone = t("customers.add.phoneRequired");
    if (form.email.trim() && !EMAIL_PATTERN.test(form.email.trim())) {
      nextErrors.email = t("customers.add.emailInvalid");
    }
    setFieldErrors(nextErrors);
    if (
      Object.keys(nextErrors).some((key) => nextErrors[key as keyof FieldErrors])
    ) {
      return;
    }
    setApproveConfirmed(false);
    setApproveError(null);
    setApproveOpen(true);
  }

  async function confirmApprove() {
    if (!approveConfirmed || approving || !customer) return;
    setApproving(true);
    setApproveError(null);
    try {
      await approveCustomer(customer.profile.id, buildApprovePayload());
      setApproveOpen(false);
      bypassNavigation.current = true;
      setNavigationBlocker(null);
      navigate(`/customers/${encodeURIComponent(customer.profile.id)}`);
    } catch (submitError: unknown) {
      setApproving(false);
      setApproveError(
        submitError instanceof Error
          ? submitError.message
          : t("customers.review.approveModal.error"),
      );
    }
  }

  function openReject() {
    setRejectConfirmed(false);
    setRejectError(null);
    setRejectOpen(true);
  }

  async function confirmReject() {
    if (!rejectConfirmed || rejecting || !customer) return;
    setRejecting(true);
    setRejectError(null);
    try {
      await rejectCustomer(customer.profile.id, {
        rejectionNote: rejectionNote.trim() || undefined,
      });
      setRejectOpen(false);
      bypassNavigation.current = true;
      setNavigationBlocker(null);
      navigate("/customers");
    } catch (submitError: unknown) {
      setRejecting(false);
      setRejectError(
        submitError instanceof Error
          ? submitError.message
          : t("customers.review.rejectModal.error"),
      );
    }
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

  const branchName = customer?.profile.storeName ?? "—";
  const submittedBy = customer?.audit.createdBy?.name ?? "—";

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
            aria-labelledby="review-unsaved-title"
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700">
                <AlertCircle className="size-5" />
              </span>
              <div>
                <h2
                  id="review-unsaved-title"
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

      <nav aria-label={t("header.breadcrumb")} className="mb-3 text-sm text-muted">
        <button
          type="button"
          className="hover:text-foreground hover:underline"
          onClick={() => navigate("/customers")}
        >
          {t("nav.customers")}
        </button>
        <span className="px-1.5">›</span>
        <span className="text-foreground">{t("customers.review.crumb")}</span>
      </nav>

      {loading && !customer ? (
        <div className="flex flex-col gap-4">
          <div className="h-7 w-1/3 animate-pulse rounded-md bg-slate-200" />
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(240px,1fr)]">
            <div className="flex flex-col gap-3">
              <div className="h-40 animate-pulse rounded-xl border border-border bg-surface" />
              <div className="h-64 animate-pulse rounded-xl border border-border bg-surface" />
            </div>
            <div className="h-72 animate-pulse rounded-xl border border-border bg-surface" />
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
            {t("customers.review.back")}
          </button>
        </div>
      ) : null}

      {customer && form ? (
        <>
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  {t("customers.review.title")}
                </h1>
                <PendingBadge />
              </div>
              <p className="mt-1 text-sm text-muted">
                {t("customers.review.subtitle")}
              </p>
            </div>
            <button
              type="button"
              onClick={cancel}
              className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-canvas"
            >
              {t("customers.review.cancel")}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2.4fr)_minmax(240px,1fr)]">
            <div className="flex flex-col gap-4">
              <section className="rounded-xl border border-border bg-surface p-5">
                <SectionHeader
                  icon={<Users className="size-4 text-primary" strokeWidth={1.75} />}
                  title={t("customers.review.request.title")}
                  hint={t("customers.review.request.hint")}
                />
                <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
                  <InfoRow
                    label={t("customers.review.request.name")}
                    value={customer.profile.name}
                    strong
                  />
                  <InfoRow
                    label={t("customers.review.request.phone")}
                    value={customer.profile.phone}
                    href={`tel:${customer.profile.phone}`}
                  />
                  <InfoRow
                    label={t("customers.review.request.source")}
                    value={t("customers.source.posRegistration")}
                  />
                  <InfoRow
                    label={t("customers.review.request.branch")}
                    value={branchName}
                  />
                  <InfoRow
                    label={t("customers.review.request.submitted")}
                    value={formatDateTime(customer.profile.createdAt)}
                  />
                  <InfoRow
                    label={t("customers.review.request.by")}
                    value={submittedBy}
                  />
                </dl>
              </section>

              <section className="rounded-xl border border-border bg-surface p-5">
                <SectionHeader
                  icon={<UserRound className="size-4 text-primary" strokeWidth={1.75} />}
                  title={t("customers.review.profile.title")}
                  hint={t("customers.review.profile.hint")}
                />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field
                    label={t("customers.add.name")}
                    required
                    error={fieldErrors.name}
                    errorId="review-name-error"
                  >
                    <input
                      type="text"
                      value={form.name}
                      onChange={(event) => update("name", event.target.value)}
                      onBlur={() => blurField("name")}
                      placeholder={t("customers.add.namePlaceholder")}
                      aria-required="true"
                      aria-invalid={Boolean(fieldErrors.name)}
                      aria-describedby={fieldErrors.name ? "review-name-error" : undefined}
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
                    errorId="review-phone-error"
                  >
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(event) => update("phone", event.target.value)}
                      onBlur={() => blurField("phone")}
                      placeholder={t("customers.add.phonePlaceholder")}
                      aria-required="true"
                      aria-invalid={Boolean(fieldErrors.phone)}
                      aria-describedby={fieldErrors.phone ? "review-phone-error" : undefined}
                      className={`w-full rounded-md border bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:ring-1 ${
                        fieldErrors.phone
                          ? "border-red-400 focus:border-red-400 focus:ring-red-400"
                          : "border-border focus:border-teal-600 focus:ring-teal-600"
                      }`}
                    />
                  </Field>
                </div>

                <div className="mt-2 max-w-full sm:max-w-[50%]" aria-live="polite">
                  <ReviewPhoneCheckPanel state={phoneCheck} />
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field
                    label={t("customers.add.email")}
                    error={fieldErrors.email}
                    errorId="review-email-error"
                  >
                    <input
                      type="email"
                      value={form.email}
                      onChange={(event) => update("email", event.target.value)}
                      onBlur={() => blurField("email")}
                      placeholder={t("customers.add.emailPlaceholder")}
                      aria-invalid={Boolean(fieldErrors.email)}
                      aria-describedby={fieldErrors.email ? "review-email-error" : undefined}
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
                  title={t("customers.review.rail.registration.title")}
                />
                <dl className="flex flex-col">
                  <InfoRow
                    label={t("customers.review.rail.registration.source")}
                    value={t("customers.source.posRegistration")}
                  />
                  <InfoRow
                    label={t("customers.review.rail.registration.branch")}
                    value={branchName}
                  />
                  <InfoRow
                    label={t("customers.review.rail.registration.submitted")}
                    value={formatDateTime(customer.profile.createdAt)}
                  />
                  <InfoRow
                    label={t("customers.review.rail.registration.by")}
                    value={submittedBy}
                  />
                  <InfoRow
                    label={t("customers.review.rail.registration.phone")}
                    value={customer.profile.phone}
                  />
                </dl>
              </section>

              <section className="rounded-xl border border-border bg-surface p-5">
                <SectionHeader
                  icon={<ShieldCheck className="size-4 text-primary" strokeWidth={1.75} />}
                  title={t("customers.review.rail.approval.title")}
                />
                <p className="text-sm leading-relaxed text-muted">
                  {t("customers.review.rail.approval.body")}
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
              {t("customers.review.cancel")}
            </button>
            <button
              ref={rejectTriggerRef}
              type="button"
              onClick={openReject}
              className="inline-flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-5 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
            >
              <UserX className="size-4" strokeWidth={1.75} />
              {t("customers.review.reject")}
            </button>
            <button
              ref={approveTriggerRef}
              type="button"
              disabled={!canApprove}
              onClick={openApprove}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <UserCheck className="size-4" strokeWidth={1.75} />
              {t("customers.review.approve")}
            </button>
          </div>

          {approveOpen ? (
            <div
              className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-3 backdrop-blur-[2px] sm:p-6 md:bg-black/40"
              role="presentation"
            >
              <section
                ref={approveModalRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="approve-customer-title"
                aria-describedby="approve-customer-intro"
                className="max-h-[90vh] w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl sm:max-w-[500px]"
              >
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                  <h2
                    id="approve-customer-title"
                    className="text-lg font-semibold text-slate-900"
                  >
                    {t("customers.review.approveModal.title")}
                  </h2>
                  <button
                    type="button"
                    onClick={closeApprove}
                    disabled={approving}
                    aria-label={t("customers.review.approveModal.close")}
                    className="inline-flex size-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                <div className="space-y-4 px-5 py-4">
                  <p
                    id="approve-customer-intro"
                    className="text-xs leading-relaxed text-slate-600"
                  >
                    {t("customers.review.approveModal.intro")}
                  </p>

                  <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                    <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      {t("customers.review.approveModal.summaryTitle")}
                    </p>
                    <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
                      <SummaryCell
                        label={t("customers.review.approveModal.name")}
                        value={form.name.trim() || "—"}
                      />
                      <SummaryCell
                        label={t("customers.review.approveModal.phone")}
                        value={form.phone.trim() || "—"}
                      />
                      <SummaryCell
                        label={t("customers.review.approveModal.branch")}
                        value={branchName}
                      />
                      <SummaryCell
                        label={t("customers.review.approveModal.source")}
                        value={t("customers.source.posRegistration")}
                      />
                    </div>
                  </div>

                  <div className="rounded-md border border-teal-200 bg-teal-50 p-4">
                    <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-primary">
                      <Info className="size-3.5" />
                      {t("customers.review.approveModal.afterTitle")}
                    </p>
                    <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-600">
                      <AfterItem text={t("customers.review.approveModal.after1")} />
                      <AfterItem text={t("customers.review.approveModal.after2")} />
                      <AfterItem text={t("customers.review.approveModal.after3")} />
                      <AfterItem text={t("customers.review.approveModal.after4")} />
                    </ul>
                    <p className="mt-3 flex items-start gap-1.5 text-xs text-primary">
                      <UserRound className="mt-0.5 size-3.5 shrink-0" />
                      {t("customers.review.approveModal.corrections")}
                    </p>
                  </div>

                  <label className="flex items-start gap-2 py-1">
                    <input
                      type="checkbox"
                      checked={approveConfirmed}
                      disabled={approving}
                      onChange={(event) => setApproveConfirmed(event.target.checked)}
                      className="mt-0.5 size-4 shrink-0 accent-teal-600"
                    />
                    <span className="text-xs leading-relaxed text-slate-600">
                      {t("customers.review.approveModal.confirmLabel")}
                    </span>
                  </label>

                  {approveError ? (
                    <div
                      role="alert"
                      className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700"
                    >
                      <AlertCircle className="mt-0.5 size-4 shrink-0" />
                      <span>{approveError}</span>
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
                  <button
                    type="button"
                    disabled={approving}
                    onClick={closeApprove}
                    className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {t("customers.review.approveModal.cancel")}
                  </button>
                  <button
                    type="button"
                    disabled={!approveConfirmed || approving}
                    onClick={() => void confirmApprove()}
                    aria-disabled={!approveConfirmed || approving}
                    className={`inline-flex items-center gap-2 rounded-md px-5 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00766c] focus-visible:ring-offset-2 ${
                      !approveConfirmed || approving
                        ? "cursor-not-allowed bg-[#79b5ae] opacity-70"
                        : "bg-[#00766c] hover:bg-[#00635c]"
                    }`}
                  >
                    {approving ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <UserCheck className="size-4" strokeWidth={1.75} />
                    )}
                    {approving
                      ? t("customers.review.approveModal.submitting")
                      : t("customers.review.approveModal.submit")}
                  </button>
                </div>
              </section>
            </div>
          ) : null}

          {rejectOpen ? (
            <div
              className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-3 backdrop-blur-[2px] sm:p-6 md:bg-black/40"
              role="presentation"
            >
              <section
                ref={rejectModalRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="reject-registration-title"
                aria-describedby="reject-registration-intro"
                className="max-h-[90vh] w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl sm:max-w-[500px]"
              >
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                  <h2
                    id="reject-registration-title"
                    className="text-lg font-semibold text-slate-900"
                  >
                    {t("customers.review.rejectModal.title")}
                  </h2>
                  <button
                    type="button"
                    onClick={closeReject}
                    disabled={rejecting}
                    aria-label={t("customers.review.rejectModal.close")}
                    className="inline-flex size-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                <div className="space-y-4 px-5 py-4">
                  <p
                    id="reject-registration-intro"
                    className="text-xs leading-relaxed text-slate-600"
                  >
                    {t("customers.review.rejectModal.intro")}
                  </p>

                  <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                    <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      {t("customers.review.rejectModal.summaryTitle")}
                    </p>
                    <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
                      <SummaryCell
                        label={t("customers.review.rejectModal.name")}
                        value={customer.profile.name}
                      />
                      <SummaryCell
                        label={t("customers.review.rejectModal.phone")}
                        value={customer.profile.phone}
                      />
                      <SummaryCell
                        label={t("customers.review.rejectModal.branch")}
                        value={branchName}
                      />
                      <SummaryCell
                        label={t("customers.review.rejectModal.source")}
                        value={t("customers.source.posRegistration")}
                      />
                    </div>
                  </div>

                  <Field label={t("customers.review.rejectModal.note")}>
                    <textarea
                      rows={3}
                      maxLength={1000}
                      value={rejectionNote}
                      disabled={rejecting}
                      onChange={(event) => setRejectionNote(event.target.value)}
                      placeholder={t("customers.review.rejectModal.notePlaceholder")}
                      className="w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                    />
                  </Field>

                  <label className="flex items-start gap-2 py-1">
                    <input
                      type="checkbox"
                      checked={rejectConfirmed}
                      disabled={rejecting}
                      onChange={(event) => setRejectConfirmed(event.target.checked)}
                      className="mt-0.5 size-4 shrink-0 accent-red-600"
                    />
                    <span className="text-xs leading-relaxed text-slate-600">
                      {t("customers.review.rejectModal.confirmLabel")}
                    </span>
                  </label>

                  {rejectError ? (
                    <div
                      role="alert"
                      className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700"
                    >
                      <AlertCircle className="mt-0.5 size-4 shrink-0" />
                      <span>{rejectError}</span>
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
                  <button
                    type="button"
                    disabled={rejecting}
                    onClick={closeReject}
                    className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {t("customers.review.rejectModal.cancel")}
                  </button>
                  <button
                    type="button"
                    disabled={!rejectConfirmed || rejecting}
                    onClick={() => void confirmReject()}
                    aria-disabled={!rejectConfirmed || rejecting}
                    className={`inline-flex items-center gap-2 rounded-md px-5 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 ${
                      !rejectConfirmed || rejecting
                        ? "cursor-not-allowed bg-red-200 opacity-70"
                        : "bg-red-600 hover:bg-red-700"
                    }`}
                  >
                    {rejecting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <UserX className="size-4" strokeWidth={1.75} />
                    )}
                    {rejecting
                      ? t("customers.review.rejectModal.submitting")
                      : t("customers.review.rejectModal.submit")}
                  </button>
                </div>
              </section>
            </div>
          ) : null}
        </>
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
    <a href={href} className="text-primary hover:text-primary hover:underline">
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

function PendingBadge() {
  const { t } = useLocale();
  return (
    <span className="rounded-sm bg-amber-100 px-2 py-1 text-[10px] font-medium text-amber-700">
      {t("customers.status.pending")}
    </span>
  );
}

function ReviewPhoneCheckPanel({ state }: { state: ReviewPhoneCheck }) {
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
          <p className="mt-0.5">{t("customers.review.duplicate.available")}</p>
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
        <p className="mt-0.5">{t("customers.review.duplicate.warning")}</p>
      </div>
    </div>
  );
}