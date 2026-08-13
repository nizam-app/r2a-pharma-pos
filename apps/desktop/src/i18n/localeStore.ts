/**
 * Per-user UI locale persistence (Slice 1).
 * Key: pharmasync.uiLocale.<userId>
 * No shared device preference key.
 */

import {
  DEFAULT_UI_LOCALE,
  isUiLocale,
  type UiLocale,
} from "./types";

function storageKey(userId: string): string {
  return `pharmasync.uiLocale.${userId}`;
}

export const localeStore = {
  get(userId: string): UiLocale {
    if (!userId) return DEFAULT_UI_LOCALE;
    try {
      const raw = localStorage.getItem(storageKey(userId));
      if (isUiLocale(raw)) return raw;
    } catch {
      /* ignore quota / private mode */
    }
    return DEFAULT_UI_LOCALE;
  },

  set(userId: string, locale: UiLocale): void {
    if (!userId) return;
    try {
      localStorage.setItem(storageKey(userId), locale);
    } catch {
      /* ignore */
    }
  },
};
