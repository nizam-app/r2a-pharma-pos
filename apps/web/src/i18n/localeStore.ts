/**
 * Owner-web UI locale persistence (M6 Batch A).
 * Device-level key so the login page can switch language without a session,
 * and a post-login switch never requires re-login.
 *
 * Key: pharmasync.web.uiLocale
 */

import {
  DEFAULT_UI_LOCALE,
  isUiLocale,
  type UiLocale,
} from "./types";

const STORAGE_KEY = "pharmasync.web.uiLocale";

export const localeStore = {
  get(): UiLocale {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (isUiLocale(raw)) return raw;
    } catch {
      /* ignore quota / private mode */
    }
    return DEFAULT_UI_LOCALE;
  },

  set(locale: UiLocale): void {
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      /* ignore */
    }
  },
};
