import { useLocale } from "./LocaleProvider";

export function LocaleToggle() {
  const { locale, setLocale, t } = useLocale();

  return (
    <div
      className="inline-flex items-center gap-1"
      role="group"
      aria-label={t("locale.label")}
    >
      <button
        type="button"
        onClick={() => setLocale("bn-BD")}
        aria-pressed={locale === "bn-BD"}
        className={
          locale === "bn-BD"
            ? "border border-primary bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground"
            : "border border-border bg-surface px-2.5 py-1 text-xs font-medium text-muted hover:text-foreground"
        }
      >
        {t("locale.bn")}
      </button>
      <button
        type="button"
        onClick={() => setLocale("en")}
        aria-pressed={locale === "en"}
        className={
          locale === "en"
            ? "border border-primary bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground"
            : "border border-border bg-surface px-2.5 py-1 text-xs font-medium text-muted hover:text-foreground"
        }
      >
        {t("locale.en")}
      </button>
    </div>
  );
}
