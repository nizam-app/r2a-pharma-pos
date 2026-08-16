import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { localeStore } from "./localeStore";
import { translate, type MessageKey } from "./messages";
import type { UiLocale } from "./types";

type LocaleContextValue = {
  locale: UiLocale;
  setLocale: (locale: UiLocale) => void;
  t: (key: MessageKey) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

/**
 * UI locale context. Independent of auth so login-page language switch
 * never requires a session, and a post-login switch never logs the owner out.
 * Never key children by locale — context re-render only.
 */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<UiLocale>(() => localeStore.get());

  useEffect(() => {
    document.documentElement.lang = locale === "bn-BD" ? "bn" : "en";
  }, [locale]);

  const setLocale = useCallback((next: UiLocale) => {
    setLocaleState(next);
    localeStore.set(next);
  }, []);

  const t = useCallback(
    (key: MessageKey) => translate(locale, key),
    [locale],
  );

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return ctx;
}
