import { bnBD } from "./locales/bn-BD";
import { en, type MessageKey } from "./locales/en";
import type { UiLocale } from "./types";

const catalogs: Record<UiLocale, Record<MessageKey, string>> = {
  "bn-BD": bnBD,
  en,
};

export type { MessageKey };

export function translate(locale: UiLocale, key: MessageKey): string {
  return catalogs[locale][key] ?? catalogs.en[key] ?? key;
}
