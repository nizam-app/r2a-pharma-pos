import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/features/auth";
import { localeStore } from "./localeStore";
import { translate, type MessageKey } from "./messages";
import { DEFAULT_UI_LOCALE, type UiLocale } from "./types";

type LocaleContextValue = {
  locale: UiLocale;
  setLocale: (locale: UiLocale) => void;
  t: (key: MessageKey) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

/**
 * UI locale context. Must sit under AuthProvider and above AppGate.
 * Never key children by locale or userId — context re-render only.
 */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id?.trim() || "";
  const [locale, setLocaleState] = useState<UiLocale>(DEFAULT_UI_LOCALE);

  useEffect(() => {
    if (!userId) {
      setLocaleState(DEFAULT_UI_LOCALE);
      return;
    }
    setLocaleState(localeStore.get(userId));
  }, [userId]);

  const setLocale = useCallback(
    (next: UiLocale) => {
      setLocaleState(next);
      if (userId) {
        localeStore.set(userId, next);
      }
    },
    [userId],
  );

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
