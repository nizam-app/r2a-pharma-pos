import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { Building2, ChevronRight, Languages, Wifi, X } from "lucide-react";
import { useAuth } from "@/features/auth";
import { useConnectivity } from "@/features/shell";
import { useLocale, type UiLocale } from "@/i18n";
import {
  pharmacyHeaderStore,
  type PharmacyHeader,
} from "@/lib/pharmacyHeaderStore";
import { resolvePharmacyHeader } from "@/lib/receiptModel";

export type SettingsPanelProps = {
  onClose: () => void;
};

type SettingsSection = "language" | "pharmacy" | "connectivity";

const SECTION_ORDER: SettingsSection[] = [
  "language",
  "pharmacy",
  "connectivity",
];
const LOCALE_ORDER: UiLocale[] = ["bn-BD", "en"];
const PHARMACY_FIELD_ORDER = [
  "name",
  "branch",
  "address",
  "phone",
] as const satisfies ReadonlyArray<keyof PharmacyHeader>;

function canEditPharmacyHeader(role: string | undefined): boolean {
  return role === "OWNER" || role === "MANAGER";
}

/**
 * Settings parent — Language + Pharmacy / Receipt Header (Batch AH)
 * + Connectivity / Force Offline (Batch AI).
 * Category list → section detail. ←/→ · ↑/↓ · Enter · Esc. No Tab nav.
 * Owner/Manager edit pharmacy header; Cashier (and others) view-only.
 * Force Offline available to all cashier roles on this terminal.
 */
export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { locale, setLocale, t } = useLocale();
  const { user } = useAuth();
  const {
    badgeState,
    forcedOffline,
    forceOffline,
    goOnline,
    syncing,
  } = useConnectivity();
  const canEdit = canEditPharmacyHeader(user?.role);
  const [section, setSection] = useState<SettingsSection | null>(null);
  const [draft, setDraft] = useState<PharmacyHeader>(() =>
    resolvePharmacyHeader(
      user
        ? pharmacyHeaderStore.get(user.tenantId, user.storeId)
        : null,
    ),
  );
  const [savedFlash, setSavedFlash] = useState(false);

  const languageNavRef = useRef<HTMLButtonElement>(null);
  const pharmacyNavRef = useRef<HTMLButtonElement>(null);
  const connectivityNavRef = useRef<HTMLButtonElement>(null);
  const bnRef = useRef<HTMLButtonElement>(null);
  const enRef = useRef<HTMLButtonElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const branchRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  const connectivityActionRef = useRef<HTMLButtonElement>(null);

  const fieldRefs: Record<
    (typeof PHARMACY_FIELD_ORDER)[number],
    RefObject<HTMLInputElement | null>
  > = {
    name: nameRef,
    branch: branchRef,
    address: addressRef,
    phone: phoneRef,
  };

  const sectionNavRef = (id: SettingsSection) => {
    if (id === "language") return languageNavRef;
    if (id === "pharmacy") return pharmacyNavRef;
    return connectivityNavRef;
  };

  useEffect(() => {
    if (!user) return;
    setDraft(
      resolvePharmacyHeader(
        pharmacyHeaderStore.get(user.tenantId, user.storeId),
      ),
    );
  }, [user]);

  useEffect(() => {
    if (section === null) {
      languageNavRef.current?.focus();
      return;
    }
    if (section === "language") {
      const target = locale === "en" ? enRef.current : bnRef.current;
      target?.focus();
      return;
    }
    if (section === "pharmacy") {
      if (canEdit) nameRef.current?.focus();
      else pharmacyNavRef.current?.focus();
      return;
    }
    if (section === "connectivity") {
      connectivityActionRef.current?.focus();
    }
  }, [section, locale, canEdit]);

  useEffect(() => {
    if (!savedFlash) return;
    const id = window.setTimeout(() => setSavedFlash(false), 2200);
    return () => window.clearTimeout(id);
  }, [savedFlash]);

  const openSection = (next: SettingsSection) => {
    setSection(next);
    setSavedFlash(false);
  };

  const backToCategories = () => {
    setSection(null);
    setSavedFlash(false);
  };

  const focusLocale = (next: UiLocale) => {
    if (next === "bn-BD") bnRef.current?.focus();
    else enRef.current?.focus();
  };

  const selectLocale = (next: UiLocale) => {
    setLocale(next);
  };

  const focusPharmacyField = (key: (typeof PHARMACY_FIELD_ORDER)[number]) => {
    fieldRefs[key].current?.focus();
  };

  const savePharmacyHeader = () => {
    if (!user || !canEdit) return;
    pharmacyHeaderStore.set(user.tenantId, user.storeId, draft);
    setDraft(resolvePharmacyHeader(draft));
    setSavedFlash(true);
  };

  const focusCategory = (id: SettingsSection) => {
    sectionNavRef(id).current?.focus();
  };

  const connectivityStatusLabel = (() => {
    if (forcedOffline) return t("settings.connectivityStatusForced");
    switch (badgeState) {
      case "checking":
        return t("connectivity.checking");
      case "online_synced":
        return `${t("connectivity.connected")} · ${t("connectivity.synced")}`;
      case "online_syncing":
        return `${t("connectivity.connected")} · ${t("connectivity.syncing")}…`;
      case "online_pending":
        return `${t("connectivity.connected")} · ${t("connectivity.pending")}`;
      case "offline":
        return t("connectivity.offline");
      case "error":
        return t("connectivity.connectionError");
    }
  })();

  const onKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (section !== null) {
        backToCategories();
        return;
      }
      onClose();
      return;
    }

    if (section === null) {
      if (
        event.key === "ArrowDown" ||
        event.key === "ArrowUp" ||
        event.key === "ArrowLeft" ||
        event.key === "ArrowRight"
      ) {
        event.preventDefault();
        event.stopPropagation();
        const active = document.activeElement;
        let idx = SECTION_ORDER.findIndex(
          (id) => active === sectionNavRef(id).current,
        );
        if (idx < 0) idx = 0;
        const delta =
          event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
        const nextIdx =
          (idx + delta + SECTION_ORDER.length) % SECTION_ORDER.length;
        focusCategory(SECTION_ORDER[nextIdx]!);
        return;
      }
      if (event.key === "Enter") {
        const active = document.activeElement;
        for (const id of SECTION_ORDER) {
          if (active === sectionNavRef(id).current) {
            event.preventDefault();
            event.stopPropagation();
            openSection(id);
            return;
          }
        }
      }
      return;
    }

    if (section === "language") {
      if (
        event.key === "ArrowLeft" ||
        event.key === "ArrowRight" ||
        event.key === "ArrowUp" ||
        event.key === "ArrowDown"
      ) {
        event.preventDefault();
        event.stopPropagation();
        const active = document.activeElement;
        let idx = LOCALE_ORDER.findIndex((id) =>
          id === "bn-BD" ? active === bnRef.current : active === enRef.current,
        );
        if (idx < 0) idx = locale === "en" ? 1 : 0;
        const delta =
          event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
        const nextIdx =
          (idx + delta + LOCALE_ORDER.length) % LOCALE_ORDER.length;
        focusLocale(LOCALE_ORDER[nextIdx]!);
        return;
      }

      if (event.key === "Enter") {
        const active = document.activeElement;
        if (active === bnRef.current) {
          event.preventDefault();
          event.stopPropagation();
          selectLocale("bn-BD");
          return;
        }
        if (active === enRef.current) {
          event.preventDefault();
          event.stopPropagation();
          selectLocale("en");
        }
      }
      return;
    }

    if (section === "pharmacy" && canEdit) {
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        const active = document.activeElement;
        const fieldIdx = PHARMACY_FIELD_ORDER.findIndex(
          (key) => active === fieldRefs[key].current,
        );
        const onSave = active === saveRef.current;
        if (fieldIdx < 0 && !onSave) return;

        event.preventDefault();
        event.stopPropagation();
        if (event.key === "ArrowDown") {
          if (onSave) {
            focusPharmacyField(PHARMACY_FIELD_ORDER[0]!);
            return;
          }
          if (fieldIdx === PHARMACY_FIELD_ORDER.length - 1) {
            saveRef.current?.focus();
            return;
          }
          focusPharmacyField(PHARMACY_FIELD_ORDER[fieldIdx + 1]!);
          return;
        }
        // ArrowUp
        if (onSave) {
          focusPharmacyField(
            PHARMACY_FIELD_ORDER[PHARMACY_FIELD_ORDER.length - 1]!,
          );
          return;
        }
        if (fieldIdx === 0) {
          saveRef.current?.focus();
          return;
        }
        focusPharmacyField(PHARMACY_FIELD_ORDER[fieldIdx - 1]!);
      }
      return;
    }

    if (section === "connectivity" && event.key === "Enter") {
      const active = document.activeElement;
      if (active === connectivityActionRef.current) {
        event.preventDefault();
        event.stopPropagation();
        if (forcedOffline) void goOnline();
        else forceOffline();
      }
    }
  };

  const optionClass = (id: UiLocale) =>
    [
      "min-w-[8rem] rounded-md border px-4 py-2.5 text-sm font-medium transition-colors",
      locale === id
        ? "border-primary bg-primary text-primary-foreground shadow-sm"
        : "border-border bg-surface text-foreground hover:bg-shell",
    ].join(" ");

  const categoryClass = (id: SettingsSection) =>
    [
      "flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-sm font-medium transition-colors",
      section === id
        ? "bg-primary text-primary-foreground shadow-sm"
        : "text-foreground hover:bg-shell",
    ].join(" ");

  const inputClass =
    "mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:bg-shell disabled:text-muted";

  return (
    <div
      className="absolute inset-0 z-40 flex flex-col bg-surface"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      tabIndex={-1}
      onKeyDownCapture={onKeyDownCapture}
    >
      <div className="flex items-center justify-between border-b border-border px-5 py-3 sm:px-6">
        <h1
          id="settings-title"
          className="text-lg font-semibold text-foreground"
        >
          {t("settings.title")}
        </h1>
        <button
          type="button"
          className="rounded p-1.5 text-muted hover:bg-shell hover:text-foreground"
          aria-label={t("settings.close")}
          onClick={onClose}
        >
          <X className="size-5" strokeWidth={1.75} />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <nav
          className="shrink-0 border-b border-border bg-shell/40 px-3 py-3 md:w-56 md:border-r md:border-b-0 md:px-3 md:py-4"
          aria-label={t("settings.categories")}
        >
          <div className="flex flex-col gap-1">
            <button
              ref={languageNavRef}
              type="button"
              className={categoryClass("language")}
              aria-current={section === "language" ? "page" : undefined}
              onClick={() => openSection("language")}
            >
              <Languages className="size-4 shrink-0" strokeWidth={1.75} />
              <span className="flex-1">{t("settings.language")}</span>
              <ChevronRight
                className="size-4 shrink-0 opacity-70"
                strokeWidth={1.75}
                aria-hidden
              />
            </button>
            <button
              ref={pharmacyNavRef}
              type="button"
              className={categoryClass("pharmacy")}
              aria-current={section === "pharmacy" ? "page" : undefined}
              onClick={() => openSection("pharmacy")}
            >
              <Building2 className="size-4 shrink-0" strokeWidth={1.75} />
              <span className="flex-1">{t("settings.pharmacy")}</span>
              <ChevronRight
                className="size-4 shrink-0 opacity-70"
                strokeWidth={1.75}
                aria-hidden
              />
            </button>
            <button
              ref={connectivityNavRef}
              type="button"
              className={categoryClass("connectivity")}
              aria-current={section === "connectivity" ? "page" : undefined}
              onClick={() => openSection("connectivity")}
            >
              <Wifi className="size-4 shrink-0" strokeWidth={1.75} />
              <span className="flex-1">{t("settings.connectivity")}</span>
              <ChevronRight
                className="size-4 shrink-0 opacity-70"
                strokeWidth={1.75}
                aria-hidden
              />
            </button>
          </div>
        </nav>

        <div className="min-h-0 flex-1 overflow-auto px-5 py-6 sm:px-8">
          {section === null ? (
            <p className="text-sm text-muted">{t("settings.selectCategory")}</p>
          ) : section === "language" ? (
            <div className="mx-auto w-full max-w-lg">
              <h2 className="text-base font-semibold text-foreground">
                {t("settings.interfaceLanguage")}
              </h2>
              <p className="mt-1.5 text-sm text-muted">
                {t("settings.interfaceLanguageHelp")}
              </p>

              <div
                className="mt-6 flex flex-wrap gap-3"
                role="group"
                aria-label={t("settings.interfaceLanguage")}
              >
                <button
                  ref={bnRef}
                  type="button"
                  className={optionClass("bn-BD")}
                  aria-pressed={locale === "bn-BD"}
                  onClick={() => selectLocale("bn-BD")}
                >
                  {t("settings.localeBn")}
                </button>
                <button
                  ref={enRef}
                  type="button"
                  className={optionClass("en")}
                  aria-pressed={locale === "en"}
                  onClick={() => selectLocale("en")}
                >
                  {t("settings.localeEn")}
                </button>
              </div>

              <p className="mt-8 text-xs text-muted">
                <kbd className="font-medium text-foreground">[Esc]</kbd>{" "}
                {t("settings.back")}
              </p>
            </div>
          ) : section === "pharmacy" ? (
            <div className="mx-auto w-full max-w-lg">
              <h2 className="text-base font-semibold text-foreground">
                {t("settings.pharmacyHeader")}
              </h2>
              <p className="mt-1.5 text-sm text-muted">
                {t("settings.pharmacyHeaderHelp")}
              </p>
              {!canEdit ? (
                <p className="mt-3 rounded-md border border-border bg-shell/60 px-3 py-2 text-sm text-muted">
                  {t("settings.pharmacyViewOnly")}
                </p>
              ) : null}

              <div className="mt-6 space-y-4">
                <label className="block text-sm font-medium text-foreground">
                  {t("settings.pharmacyName")}
                  <input
                    ref={nameRef}
                    type="text"
                    className={inputClass}
                    value={draft.name}
                    disabled={!canEdit}
                    placeholder={t("settings.pharmacyNamePlaceholder")}
                    autoComplete="organization"
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, name: e.target.value }))
                    }
                  />
                </label>
                <label className="block text-sm font-medium text-foreground">
                  {t("settings.pharmacyBranch")}
                  <input
                    ref={branchRef}
                    type="text"
                    className={inputClass}
                    value={draft.branch}
                    disabled={!canEdit}
                    placeholder={t("settings.pharmacyBranchPlaceholder")}
                    autoComplete="off"
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, branch: e.target.value }))
                    }
                  />
                </label>
                <label className="block text-sm font-medium text-foreground">
                  {t("settings.pharmacyAddress")}
                  <input
                    ref={addressRef}
                    type="text"
                    className={inputClass}
                    value={draft.address}
                    disabled={!canEdit}
                    placeholder={t("settings.pharmacyAddressPlaceholder")}
                    autoComplete="street-address"
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        address: e.target.value,
                      }))
                    }
                  />
                </label>
                <label className="block text-sm font-medium text-foreground">
                  {t("settings.pharmacyPhone")}
                  <input
                    ref={phoneRef}
                    type="text"
                    className={inputClass}
                    value={draft.phone}
                    disabled={!canEdit}
                    placeholder={t("settings.pharmacyPhonePlaceholder")}
                    autoComplete="tel"
                    inputMode="tel"
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, phone: e.target.value }))
                    }
                  />
                </label>
              </div>

              {canEdit ? (
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <button
                    ref={saveRef}
                    type="button"
                    className="rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    onClick={savePharmacyHeader}
                  >
                    {t("settings.pharmacySave")}
                  </button>
                  {savedFlash ? (
                    <p className="text-sm font-medium text-accent" role="status">
                      {t("settings.pharmacySaved")}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <p className="mt-8 text-xs text-muted">
                <kbd className="font-medium text-foreground">[Esc]</kbd>{" "}
                {t("settings.back")}
              </p>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-lg">
              <h2 className="text-base font-semibold text-foreground">
                {t("settings.connectivity")}
              </h2>
              <p className="mt-1.5 text-sm text-muted">
                {t("settings.connectivityHelp")}
              </p>

              <div className="mt-6 rounded-md border border-border bg-shell/40 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                  {t("settings.connectivityStatus")}
                </p>
                <p
                  className="mt-1 text-sm font-semibold text-foreground"
                  role="status"
                  data-forced-offline={forcedOffline ? "true" : "false"}
                >
                  {connectivityStatusLabel}
                </p>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  ref={connectivityActionRef}
                  type="button"
                  className="rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
                  disabled={syncing && !forcedOffline}
                  onClick={() => {
                    if (forcedOffline) void goOnline();
                    else forceOffline();
                  }}
                >
                  {forcedOffline
                    ? t("connectivity.goOnline")
                    : t("connectivity.forceOffline")}
                </button>
              </div>

              <p className="mt-4 text-sm text-muted">
                {forcedOffline
                  ? t("settings.connectivityForcedNote")
                  : t("settings.connectivityAutoNote")}
              </p>

              <p className="mt-8 text-xs text-muted">
                <kbd className="font-medium text-foreground">[Esc]</kbd>{" "}
                {t("settings.back")}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
