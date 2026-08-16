export type UiLocale = "bn-BD" | "en";

export const DEFAULT_UI_LOCALE: UiLocale = "bn-BD";

export const UI_LOCALES: readonly UiLocale[] = ["bn-BD", "en"] as const;

export function isUiLocale(value: unknown): value is UiLocale {
  return value === "bn-BD" || value === "en";
}
