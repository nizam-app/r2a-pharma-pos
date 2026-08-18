import {
  AlertCircle,
  Building2,
  ClipboardList,
  Loader2,
  PackageCheck,
  Phone,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocale } from "@/i18n";
import { ApiError } from "@/lib/api";
import { formatTaka } from "@/lib/format";
import { useOwnerPath } from "@/lib/OwnerPathProvider";
import {
  createOwnerSupplier,
  type SupplierPreferredContact,
} from "@/lib/suppliers";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type PreferredContact = "" | SupplierPreferredContact;

type SupplierFormState = {
  name: string;
  contactPerson: string;
  phone: string;
  secondaryPhone: string;
  email: string;
  address: string;
  city: string;
  registrationNumber: string;
  paymentTerms: string;
  leadTimeDays: string;
  minOrderValue: string;
  preferredContact: PreferredContact;
  expiryReturnsAccepted: boolean;
  minDaysBeforeExpiry: string;
  returnNotes: string;
  notes: string;
};

const EMPTY_FORM: SupplierFormState = {
  name: "",
  contactPerson: "",
  phone: "",
  secondaryPhone: "",
  email: "",
  address: "",
  city: "",
  registrationNumber: "",
  paymentTerms: "",
  leadTimeDays: "",
  minOrderValue: "",
  preferredContact: "",
  expiryReturnsAccepted: false,
  minDaysBeforeExpiry: "",
  returnNotes: "",
  notes: "",
};

function optionalOrNull(value: string): string | null {
  return value.trim() || null;
}

function optionalIntOrNull(value: string): number | null {
  const n = Math.floor(Number(value));
  return value.trim() !== "" && Number.isFinite(n) && n >= 0 ? n : null;
}

function optionalNumberOrNull(value: string): number | null {
  const n = Number(value);
  return value.trim() !== "" && Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Add Supplier (Batch Y). Content region only — chrome is Batch B.
 * Live POST /owner/suppliers (OWNER only). New suppliers are always ACTIVE;
 * Save as Draft is disabled because there is no Edit Supplier page.
 * Creating navigates to /suppliers/:supplierId (Supplier Details — Batch Z).
 */
export function AddSupplierPage() {
  const { t } = useLocale();
  const { navigate, setNavigationBlocker } = useOwnerPath();

  const [form, setForm] = useState<SupplierFormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(
    null,
  );
  const bypassNavigation = useRef(false);

  const dirty = Object.entries(form).some(
    ([key, value]) =>
      key !== "expiryReturnsAccepted" &&
      value !== EMPTY_FORM[key as keyof SupplierFormState],
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

  function update<K extends keyof SupplierFormState>(
    key: K,
    value: SupplierFormState[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function buildPayload() {
    return {
      name: form.name.trim(),
      contactPerson: form.contactPerson.trim(),
      phone: form.phone.trim(),
      secondaryPhone: optionalOrNull(form.secondaryPhone),
      email: optionalOrNull(form.email),
      address: optionalOrNull(form.address),
      city: optionalOrNull(form.city),
      registrationNumber: optionalOrNull(form.registrationNumber),
      notes: optionalOrNull(form.notes),
      paymentTerms: optionalOrNull(form.paymentTerms),
      leadTimeDays: optionalIntOrNull(form.leadTimeDays),
      minOrderValue: optionalNumberOrNull(form.minOrderValue),
      status: "ACTIVE" as const,
      expiryReturnsAccepted: form.expiryReturnsAccepted,
      minDaysBeforeExpiry: optionalIntOrNull(form.minDaysBeforeExpiry),
      returnNotes: optionalOrNull(form.returnNotes),
      preferredContact: form.preferredContact || null,
      isActive: true,
    };
  }

  async function handleSubmit() {
    if (!form.name.trim() || !form.contactPerson.trim() || !form.phone.trim()) {
      setError(t("suppliers.add.validation"));
      return;
    }
    if (form.email.trim() && !EMAIL_PATTERN.test(form.email.trim())) {
      setError(t("suppliers.add.emailInvalid"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const created = await createOwnerSupplier(buildPayload());
      bypassNavigation.current = true;
      setNavigationBlocker(null);
      navigate(`/suppliers/${encodeURIComponent(created.id)}`);
    } catch (submitError: unknown) {
      setSubmitting(false);
      setError(
        submitError instanceof ApiError
          ? submitError.message
          : submitError instanceof Error
            ? submitError.message
            : t("suppliers.add.submitError"),
      );
    }
  }

  function cancel() {
    bypassNavigation.current = true;
    setNavigationBlocker(null);
    navigate("/suppliers");
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

  const summary = {
    supplier: form.name.trim(),
    contact: form.contactPerson.trim(),
    phone: form.phone.trim(),
    city: form.city.trim(),
    paymentTerms: form.paymentTerms.trim(),
    leadTimeDays: optionalIntOrNull(form.leadTimeDays),
    minOrderValue: optionalNumberOrNull(form.minOrderValue),
    expiryReturnsAccepted: form.expiryReturnsAccepted,
    minDaysBeforeExpiry: optionalIntOrNull(form.minDaysBeforeExpiry),
  };

  const showExpiryWindow = summary.expiryReturnsAccepted;

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
            aria-labelledby="unsaved-supplier-title"
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700">
                <AlertCircle className="size-5" />
              </span>
              <div>
                <h2
                  id="unsaved-supplier-title"
                  className="text-lg font-semibold text-slate-950"
                >
                  {t("suppliers.add.unsavedTitle")}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  {t("suppliers.add.unsavedBody")}
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
                {t("suppliers.add.keepEditing")}
              </button>
              <button
                type="button"
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                onClick={discardChanges}
              >
                {t("suppliers.add.discardChanges")}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <div className="mb-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          {t("suppliers.add.crumb")}
        </p>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {t("suppliers.add.title")}
            </h1>
            <p className="mt-1 text-sm text-muted">{t("suppliers.add.subtitle")}</p>
          </div>
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="flex flex-col gap-4 xl:col-span-2">
          <section className="rounded-xl border border-border bg-surface p-5">
            <SectionHeader
              icon={<Building2 className="size-4 text-primary" strokeWidth={1.75} />}
              title={t("suppliers.add.company")}
              hint={t("suppliers.add.companyHint")}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t("suppliers.add.name")} required>
                <input
                  type="text"
                  value={form.name}
                  onChange={(event) => update("name", event.target.value)}
                  placeholder={t("suppliers.add.namePlaceholder")}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                />
              </Field>
              <Field label={t("suppliers.add.contactPerson")} required>
                <input
                  type="text"
                  value={form.contactPerson}
                  onChange={(event) => update("contactPerson", event.target.value)}
                  placeholder={t("suppliers.add.contactPersonPlaceholder")}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                />
              </Field>
              <Field label={t("suppliers.add.phone")} required>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(event) => update("phone", event.target.value)}
                  placeholder={t("suppliers.add.phonePlaceholder")}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                />
              </Field>
              <Field label={t("suppliers.add.secondaryPhone")}>
                <input
                  type="tel"
                  value={form.secondaryPhone}
                  onChange={(event) => update("secondaryPhone", event.target.value)}
                  placeholder={t("suppliers.add.secondaryPhonePlaceholder")}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                />
              </Field>
              <Field label={t("suppliers.add.email")}>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => update("email", event.target.value)}
                  placeholder={t("suppliers.add.emailPlaceholder")}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                />
              </Field>
              <Field label={t("suppliers.add.registrationNumber")}>
                <input
                  type="text"
                  value={form.registrationNumber}
                  onChange={(event) => update("registrationNumber", event.target.value)}
                  placeholder={t("suppliers.add.registrationNumberPlaceholder")}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                />
              </Field>
              <Field label={t("suppliers.add.address")}>
                <input
                  type="text"
                  value={form.address}
                  onChange={(event) => update("address", event.target.value)}
                  placeholder={t("suppliers.add.addressPlaceholder")}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                />
              </Field>
              <Field label={t("suppliers.add.city")}>
                <input
                  type="text"
                  value={form.city}
                  onChange={(event) => update("city", event.target.value)}
                  placeholder={t("suppliers.add.cityPlaceholder")}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                />
              </Field>
              <Field label={t("suppliers.add.paymentTerms")}>
                <input
                  type="text"
                  value={form.paymentTerms}
                  onChange={(event) => update("paymentTerms", event.target.value)}
                  placeholder={t("suppliers.add.paymentTermsPlaceholder")}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                />
              </Field>
            </div>
            <p className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-canvas px-4 py-3 text-xs text-muted">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={1.75} />
              <span>{t("suppliers.add.activeNote")}</span>
            </p>
          </section>

          <section className="rounded-xl border border-border bg-surface p-5">
            <SectionHeader
              icon={<ClipboardList className="size-4 text-primary" strokeWidth={1.75} />}
              title={t("suppliers.add.purchasingTitle")}
              hint={t("suppliers.add.purchasingHint")}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t("suppliers.add.leadTimeDays")}>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.leadTimeDays}
                  onChange={(event) => update("leadTimeDays", event.target.value)}
                  placeholder="0"
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                />
                <p className="mt-1 text-xs text-muted">{t("suppliers.add.leadTimeDaysHint")}</p>
              </Field>
              <Field label={t("suppliers.add.minOrderValue")}>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.minOrderValue}
                  onChange={(event) => update("minOrderValue", event.target.value)}
                  placeholder="0"
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                />
                <p className="mt-1 text-xs text-muted">{t("suppliers.add.minOrderValueHint")}</p>
              </Field>
              <div className="sm:col-span-2">
                <Field label={t("suppliers.add.preferredContact")}>
                  <select
                    value={form.preferredContact}
                    onChange={(event) =>
                      update("preferredContact", event.target.value as PreferredContact)
                    }
                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                  >
                    <option value="">{t("suppliers.add.preferredContactNone")}</option>
                    <option value="PHONE">{t("suppliers.add.preferredContact.phone")}</option>
                    <option value="EMAIL">{t("suppliers.add.preferredContact.email")}</option>
                    <option value="WHATSAPP">{t("suppliers.add.preferredContact.whatsapp")}</option>
                  </select>
                </Field>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-surface p-5">
            <SectionHeader
              icon={<PackageCheck className="size-4 text-primary" strokeWidth={1.75} />}
              title={t("suppliers.add.expiryTitle")}
              hint={t("suppliers.add.expiryHint")}
            />
            <label className="flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                checked={form.expiryReturnsAccepted}
                onChange={(event) =>
                  update("expiryReturnsAccepted", event.target.checked)
                }
                className="size-4 accent-teal-600"
              />
              <span className="text-sm font-medium text-foreground">
                {t("suppliers.add.expiryReturnsAccepted")}
              </span>
            </label>
            {showExpiryWindow ? (
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label={t("suppliers.add.minDaysBeforeExpiry")}>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.minDaysBeforeExpiry}
                    onChange={(event) => update("minDaysBeforeExpiry", event.target.value)}
                    placeholder="90"
                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                  />
                  <p className="mt-1 text-xs text-muted">{t("suppliers.add.minDaysBeforeExpiryHint")}</p>
                </Field>
                <Field label={t("suppliers.add.returnNotes")}>
                  <input
                    type="text"
                    value={form.returnNotes}
                    onChange={(event) => update("returnNotes", event.target.value)}
                    placeholder={t("suppliers.add.returnNotesPlaceholder")}
                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                  />
                </Field>
              </div>
            ) : null}
          </section>

          <section className="rounded-xl border border-border bg-surface p-5">
            <SectionHeader
              icon={<Phone className="size-4 text-primary" strokeWidth={1.75} />}
              title={t("suppliers.add.notesTitle")}
            />
            <Field label={t("suppliers.add.notes")}>
              <textarea
                rows={3}
                value={form.notes}
                onChange={(event) => update("notes", event.target.value)}
                placeholder={t("suppliers.add.notesPlaceholder")}
                className="w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
              />
            </Field>
          </section>
        </div>

        <div className="flex flex-col gap-4">
          <section className="rounded-xl border border-border bg-surface p-5">
            <SectionHeader
              icon={<UserPlus className="size-4 text-primary" strokeWidth={1.75} />}
              title={t("suppliers.add.summary.title")}
            />
            {!summary.supplier || !summary.contact || !summary.phone ? (
              <p className="text-xs text-muted">{t("suppliers.add.summary.empty")}</p>
            ) : (
              <dl className="mt-1 flex flex-col">
                <SummaryRow label={t("suppliers.add.summary.supplier")} value={summary.supplier} />
                <SummaryRow label={t("suppliers.add.summary.contact")} value={summary.contact} />
                <SummaryRow label={t("suppliers.add.summary.phone")} value={summary.phone} />
                <SummaryRow
                  label={t("suppliers.add.summary.city")}
                  value={summary.city || t("suppliers.add.summary.none")}
                />
                <SummaryRow
                  label={t("suppliers.add.summary.paymentTerms")}
                  value={summary.paymentTerms || t("suppliers.add.summary.none")}
                />
                <SummaryRow
                  label={t("suppliers.add.summary.leadTime")}
                  value={
                    summary.leadTimeDays != null
                      ? `${summary.leadTimeDays} ${t("suppliers.kpi.days")}`
                      : t("suppliers.add.summary.none")
                  }
                />
                <SummaryRow
                  label={t("suppliers.add.summary.minOrder")}
                  value={
                    summary.minOrderValue != null
                      ? formatTaka(summary.minOrderValue)
                      : t("suppliers.add.summary.none")
                  }
                />
                <SummaryRow
                  label={t("suppliers.add.summary.expiryReturns")}
                  value={
                    summary.expiryReturnsAccepted
                      ? t("suppliers.add.yes")
                      : t("suppliers.add.no")
                  }
                />
                <SummaryRow
                  label={t("suppliers.add.summary.expiryWindow")}
                  value={
                    summary.expiryReturnsAccepted && summary.minDaysBeforeExpiry != null
                      ? `${summary.minDaysBeforeExpiry} ${t("suppliers.kpi.days")}`
                      : t("suppliers.add.summary.none")
                  }
                />
              </dl>
            )}
          </section>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-border pt-4">
        <button
          type="button"
          disabled={submitting}
          onClick={cancel}
          className="rounded-md border border-border bg-surface px-5 py-2 text-sm font-medium text-foreground hover:bg-canvas disabled:opacity-50"
        >
          {t("suppliers.add.cancel")}
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={() => void handleSubmit()}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <UserPlus className="size-4" strokeWidth={1.75} />
          )}
          {submitting ? t("suppliers.add.creating") : t("suppliers.add.submit")}
        </button>
      </div>
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
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-foreground">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-b-0">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="max-w-[60%] truncate text-right font-medium text-foreground">
        {value}
      </dd>
    </div>
  );
}