import {
  AlertCircle,
  Boxes,
  Check,
  Info,
  Pill,
  ShieldCheck,
  Tags,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useLocale } from "@/i18n";
import { useOwnerPath } from "@/lib/OwnerPathProvider";
import type {
  OwnerProductDetail,
  ProductUnitInput,
} from "@/lib/ownerProduct";

export type ProductFormValues = {
  name: string;
  genericName: string;
  manufacturer: string;
  strength: string;
  form: string;
  sku: string;
  barcode: string;
  category: string;
  description: string;
  requiresPrescription: boolean;
  coldChain: boolean;
  storageNotes: string;
  reorderLevel: string;
  isActive: boolean;
  pieceLabel: string;
  stripEnabled: boolean;
  stripFactor: number;
  stripLabel: string;
  boxEnabled: boolean;
  boxFactor: number;
  boxLabel: string;
};

export type ProductFormSubmission = Omit<
  ProductFormValues,
  | "reorderLevel"
  | "pieceLabel"
  | "stripEnabled"
  | "stripFactor"
  | "stripLabel"
  | "boxEnabled"
  | "boxFactor"
  | "boxLabel"
> & {
  reorderLevel: number | null;
  units: ProductUnitInput[];
};

export const EMPTY_PRODUCT_FORM: ProductFormValues = {
  name: "",
  genericName: "",
  manufacturer: "",
  strength: "",
  form: "",
  sku: "",
  barcode: "",
  category: "",
  description: "",
  requiresPrescription: false,
  coldChain: false,
  storageNotes: "",
  reorderLevel: "",
  isActive: true,
  pieceLabel: "",
  stripEnabled: true,
  stripFactor: 10,
  stripLabel: "",
  boxEnabled: true,
  boxFactor: 100,
  boxLabel: "",
};

export function productToFormValues(
  product: OwnerProductDetail,
): ProductFormValues {
  const piece = product.units.find((unit) => unit.unitType === "PIECE");
  const strip = product.units.find((unit) => unit.unitType === "STRIP");
  const box = product.units.find((unit) => unit.unitType === "BOX");
  return {
    name: product.name,
    genericName: product.genericName ?? "",
    manufacturer: product.manufacturer ?? "",
    strength: product.strength ?? "",
    form: product.form ?? "",
    sku: product.sku ?? "",
    barcode: product.barcode ?? "",
    category: product.category ?? "",
    description: product.description ?? "",
    requiresPrescription: product.requiresPrescription ?? false,
    coldChain: product.coldChain,
    storageNotes: product.storageNotes ?? "",
    reorderLevel:
      product.reorderLevel == null ? "" : String(product.reorderLevel),
    isActive: product.isActive,
    pieceLabel: piece?.label ?? "",
    stripEnabled: Boolean(strip),
    stripFactor: strip?.factorToBase ?? 10,
    stripLabel: strip?.label ?? "",
    boxEnabled: Boolean(box),
    boxFactor: box?.factorToBase ?? 100,
    boxLabel: box?.label ?? "",
  };
}

const INPUT_CLASS =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-1 focus:ring-teal-600 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500";

function unitSignature(values: ProductFormValues): string {
  return JSON.stringify({
    pieceLabel: values.pieceLabel.trim(),
    stripEnabled: values.stripEnabled,
    stripFactor: values.stripFactor,
    stripLabel: values.stripLabel.trim(),
    boxEnabled: values.boxEnabled,
    boxFactor: values.boxFactor,
    boxLabel: values.boxLabel.trim(),
  });
}

export function ProductForm({
  mode,
  initialValues,
  onSubmit,
  onSaved,
  onCancel,
}: {
  mode: "create" | "edit";
  initialValues: ProductFormValues;
  onSubmit: (values: ProductFormSubmission) => Promise<string>;
  onSaved: (productId: string) => void;
  onCancel: () => void;
}) {
  const { t } = useLocale();
  const { setNavigationBlocker } = useOwnerPath();
  const [values, setValues] = useState<ProductFormValues>(initialValues);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const bypassNavigation = useRef(false);
  const initialJson = useRef(JSON.stringify(initialValues));
  const initialUnits = useRef(unitSignature(initialValues));
  const dirty = JSON.stringify(values) !== initialJson.current;
  const unitsChanged = unitSignature(values) !== initialUnits.current;

  useEffect(() => {
    const blockNavigation = (to: string) => {
      if (bypassNavigation.current || !dirty) return true;
      setPendingNavigation(to);
      return false;
    };
    setNavigationBlocker(blockNavigation);
    return () => setNavigationBlocker(null);
  }, [dirty, setNavigationBlocker, t]);

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  const unitSummary = useMemo(() => {
    const labels = [t("inventory.add.unitPiece")];
    if (values.stripEnabled) labels.push(t("inventory.add.unitStrip"));
    if (values.boxEnabled) labels.push(t("inventory.add.unitBox"));
    return labels.join(" · ");
  }, [t, values.boxEnabled, values.stripEnabled]);

  function update<K extends keyof ProductFormValues>(
    key: K,
    value: ProductFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reorder = values.reorderLevel.trim();
    const reorderLevel = reorder === "" ? null : Number(reorder);
    if (!values.name.trim()) {
      setError(t("inventory.add.requiredName"));
      return;
    }
    if (
      (values.stripEnabled && values.stripFactor < 1) ||
      (values.boxEnabled && values.boxFactor < 1)
    ) {
      setError(t("inventory.add.invalidFactors"));
      return;
    }
    if (
      values.stripEnabled &&
      values.boxEnabled &&
      values.boxFactor % values.stripFactor !== 0
    ) {
      setError(t("inventory.productForm.invalidHierarchy"));
      return;
    }
    if (
      reorderLevel != null &&
      (!Number.isInteger(reorderLevel) || reorderLevel < 0)
    ) {
      setError(t("inventory.productForm.invalidReorder"));
      return;
    }

    const units: ProductUnitInput[] = [
      {
        unitType: "PIECE",
        factorToBase: 1,
        ...(values.pieceLabel.trim()
          ? { label: values.pieceLabel.trim() }
          : {}),
      },
    ];
    if (values.stripEnabled) {
      units.push({
        unitType: "STRIP",
        factorToBase: values.stripFactor,
        ...(values.stripLabel.trim()
          ? { label: values.stripLabel.trim() }
          : {}),
      });
    }
    if (values.boxEnabled) {
      units.push({
        unitType: "BOX",
        factorToBase: values.boxFactor,
        ...(values.boxLabel.trim() ? { label: values.boxLabel.trim() } : {}),
      });
    }

    setSubmitting(true);
    setError(null);
    try {
      const productId = await onSubmit({
        name: values.name.trim(),
        genericName: values.genericName.trim(),
        manufacturer: values.manufacturer.trim(),
        strength: values.strength.trim(),
        form: values.form.trim(),
        sku: values.sku.trim(),
        barcode: values.barcode.trim(),
        category: values.category.trim(),
        description: values.description.trim(),
        requiresPrescription: values.requiresPrescription,
        coldChain: values.coldChain,
        storageNotes: values.storageNotes.trim(),
        reorderLevel,
        isActive: values.isActive,
        units,
      });
      bypassNavigation.current = true;
      setNavigationBlocker(null);
      onSaved(productId);
    } catch (submitError: unknown) {
      setSubmitting(false);
      setError(
        submitError instanceof Error
          ? submitError.message
          : t(
              mode === "create"
                ? "inventory.add.error"
                : "inventory.edit.submitError",
            ),
      );
    }
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

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-5 xl:grid-cols-12">
      {pendingNavigation ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 px-4 backdrop-blur-sm" role="presentation" onMouseDown={() => setPendingNavigation(null)}>
          <section role="dialog" aria-modal="true" aria-labelledby="unsaved-product-title" className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700"><AlertCircle className="size-5" /></span>
              <div>
                <h2 id="unsaved-product-title" className="text-lg font-semibold text-slate-950">{t("inventory.productForm.unsavedTitle")}</h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{t("inventory.productForm.unsavedBody")}</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" autoFocus className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={() => setPendingNavigation(null)}>{t("inventory.productForm.keepEditing")}</button>
              <button type="button" className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700" onClick={discardChanges}>{t("inventory.productForm.discardChanges")}</button>
            </div>
          </section>
        </div>
      ) : null}
      <div className="space-y-5 xl:col-span-8">
        {error ? (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <Section icon={Pill} title={t("inventory.add.basicInfo")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("inventory.add.name")} required>
              <input className={INPUT_CLASS} value={values.name} onChange={(event) => update("name", event.target.value)} placeholder={t("inventory.add.namePlaceholder")} autoFocus required />
            </Field>
            <Field label={t("inventory.add.generic")}>
              <input className={INPUT_CLASS} value={values.genericName} onChange={(event) => update("genericName", event.target.value)} placeholder={t("inventory.add.genericPlaceholder")} />
            </Field>
            <Field label={t("inventory.add.manufacturer")}>
              <input className={INPUT_CLASS} value={values.manufacturer} onChange={(event) => update("manufacturer", event.target.value)} placeholder={t("inventory.add.manufacturerPlaceholder")} />
            </Field>
            <Field label={t("inventory.add.strength")}>
              <input className={INPUT_CLASS} value={values.strength} onChange={(event) => update("strength", event.target.value)} placeholder={t("inventory.add.strengthPlaceholder")} />
            </Field>
            <Field label={t("inventory.add.form")}>
              <input className={INPUT_CLASS} value={values.form} onChange={(event) => update("form", event.target.value)} placeholder={t("inventory.add.formPlaceholder")} />
            </Field>
            <Field label={t("inventory.add.category")}>
              <input className={INPUT_CLASS} value={values.category} onChange={(event) => update("category", event.target.value)} placeholder={t("inventory.add.categoryPlaceholder")} />
            </Field>
            <div className="sm:col-span-2">
              <Field label={t("inventory.add.description")}>
                <textarea className={`${INPUT_CLASS} min-h-20 resize-y`} value={values.description} onChange={(event) => update("description", event.target.value)} placeholder={t("inventory.add.descriptionPlaceholder")} />
              </Field>
            </div>
          </div>
        </Section>

        <Section icon={Tags} title={t("inventory.add.identification")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("inventory.add.sku")}>
              <input className={INPUT_CLASS} value={values.sku} onChange={(event) => update("sku", event.target.value)} placeholder={t("inventory.add.skuPlaceholder")} />
            </Field>
            <Field label={t("inventory.add.barcode")}>
              <input className={INPUT_CLASS} value={values.barcode} onChange={(event) => update("barcode", event.target.value)} placeholder={t("inventory.add.barcodePlaceholder")} />
            </Field>
          </div>
        </Section>

        <Section icon={Boxes} title={t("inventory.add.unitsSection")} hint={t("inventory.add.unitsHint")}>
          <div className="space-y-3">
            <UnitRow
              title={t("inventory.add.unitPiece")}
              enabled
              locked
              factor={1}
              label={values.pieceLabel}
              onLabelChange={(value) => update("pieceLabel", value)}
            />
            <UnitRow
              title={t("inventory.add.unitStrip")}
              enabled={values.stripEnabled}
              factor={values.stripFactor}
              label={values.stripLabel}
              onEnabledChange={(value) => update("stripEnabled", value)}
              onFactorChange={(value) => update("stripFactor", value)}
              onLabelChange={(value) => update("stripLabel", value)}
            />
            <UnitRow
              title={t("inventory.add.unitBox")}
              enabled={values.boxEnabled}
              factor={values.boxFactor}
              label={values.boxLabel}
              onEnabledChange={(value) => update("boxEnabled", value)}
              onFactorChange={(value) => update("boxFactor", value)}
              onLabelChange={(value) => update("boxLabel", value)}
            />
          </div>
        </Section>
      </div>

      <aside className="space-y-5 xl:col-span-4">
        <Section icon={ShieldCheck} title={t("inventory.add.additionalSection")}>
          <div className="space-y-4">
            <Toggle label={t("inventory.add.requiresRx")} hint={t("inventory.add.requiresRxHint")} checked={values.requiresPrescription} onChange={(value) => update("requiresPrescription", value)} />
            <Toggle label={t("inventory.add.coldChain")} hint={t("inventory.add.coldChainHint")} checked={values.coldChain} onChange={(value) => update("coldChain", value)} />
            {mode === "edit" ? (
              <Toggle label={t("inventory.add.isActive")} hint={t("inventory.add.isActiveHint")} checked={values.isActive} onChange={(value) => update("isActive", value)} />
            ) : null}
            <Field label={t("inventory.add.reorderLevel")}>
              <input className={INPUT_CLASS} type="number" min="0" step="1" value={values.reorderLevel} onChange={(event) => update("reorderLevel", event.target.value)} placeholder={t("inventory.add.reorderLevelPlaceholder")} />
            </Field>
            <Field label={t("inventory.add.storageNotes")}>
              <textarea className={`${INPUT_CLASS} min-h-20 resize-y`} value={values.storageNotes} onChange={(event) => update("storageNotes", event.target.value)} placeholder={t("inventory.add.storageNotesPlaceholder")} />
            </Field>
          </div>
        </Section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">{t("inventory.add.productSetup")}</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <Summary label={t("inventory.add.medicineLabel")} value={values.name || "—"} />
            <Summary label={t("inventory.add.sellingUnitsLabel")} value={unitSummary} />
            <Summary label={t("inventory.add.statusLabel")} value={values.isActive ? t("inventory.detail.active") : t("inventory.detail.inactive")} />
          </dl>
        </section>

        {mode === "create" ? (
          <InfoCard title={t("inventory.add.initialStockTitle")} text={t("inventory.add.initialStockHint")} />
        ) : unitsChanged ? (
          <InfoCard title={t("inventory.productForm.unitWarning")} text={t("inventory.productForm.unitWarningHint")} warning />
        ) : null}

        <InfoCard title={t("inventory.productForm.pricesManaged")} text={t("inventory.productForm.pricesManagedHint")} />
      </aside>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-4 xl:col-span-12">
        <button type="button" disabled={submitting} onClick={onCancel} className="rounded-md border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          {t("inventory.add.cancel")}
        </button>
        <button type="submit" disabled={submitting || !values.name.trim()} className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50">
          {submitting ? <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Check className="size-4" />}
          {t(
            submitting
              ? mode === "create"
                ? "inventory.add.submitting"
                : "inventory.edit.saving"
              : mode === "create"
                ? "inventory.add.submit"
                : "inventory.edit.save",
          )}
        </button>
      </div>
    </form>
  );
}

function Section({ icon: Icon, title, hint, children }: { icon: typeof Pill; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-2 border-b border-slate-100 pb-3">
        <Icon className="mt-0.5 size-4 text-teal-600" />
        <div><h2 className="text-sm font-semibold text-slate-900">{title}</h2>{hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}</div>
      </div>
      {children}
    </section>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-medium text-slate-700">{label}{required ? <span className="text-red-500"> *</span> : null}</span>{children}</label>;
}

function UnitRow({ title, enabled, locked = false, factor, label, onEnabledChange, onFactorChange, onLabelChange }: { title: string; enabled: boolean; locked?: boolean; factor: number; label: string; onEnabledChange?: (value: boolean) => void; onFactorChange?: (value: number) => void; onLabelChange: (value: string) => void }) {
  const { t } = useLocale();
  return (
    <div className={`rounded-lg border p-4 ${enabled ? "border-slate-200 bg-slate-50" : "border-dashed border-slate-200 bg-white opacity-70"}`}>
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <input type="checkbox" checked={enabled} disabled={locked} onChange={(event) => onEnabledChange?.(event.target.checked)} className="size-4 rounded border-slate-300 text-teal-600 focus:ring-teal-600" />
          {title}
        </label>
        {locked ? <span className="rounded bg-teal-50 px-2 py-1 text-[11px] font-medium text-teal-700">{t("inventory.productForm.requiredBase")}</span> : null}
      </div>
      {enabled ? (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t("inventory.add.factorToBase")}>
            <input className={INPUT_CLASS} type="number" min="1" step="1" value={factor} disabled={locked} onChange={(event) => onFactorChange?.(Math.max(1, Number(event.target.value) || 1))} />
          </Field>
          <Field label={t("inventory.add.customLabel")}>
            <input className={INPUT_CLASS} value={label} onChange={(event) => onLabelChange(event.target.value)} placeholder={t("inventory.productForm.customLabelPlaceholder")} />
          </Field>
        </div>
      ) : null}
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-slate-200 p-3">
      <span><span className="block text-sm font-medium text-slate-800">{label}</span><span className="mt-0.5 block text-xs text-slate-500">{hint}</span></span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 size-4 rounded border-slate-300 text-teal-600 focus:ring-teal-600" />
    </label>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2 last:border-0"><dt className="text-slate-500">{label}</dt><dd className="max-w-48 text-right font-medium text-slate-900">{value}</dd></div>;
}

function InfoCard({ title, text, warning = false }: { title: string; text: string; warning?: boolean }) {
  return (
    <section className={`rounded-xl border p-4 ${warning ? "border-amber-200 bg-amber-50" : "border-sky-200 bg-sky-50"}`}>
      <div className="flex items-start gap-2"><Info className={`mt-0.5 size-4 shrink-0 ${warning ? "text-amber-700" : "text-sky-700"}`} /><div><h3 className="text-sm font-semibold text-slate-900">{title}</h3><p className="mt-1 text-xs leading-relaxed text-slate-600">{text}</p></div></div>
    </section>
  );
}
