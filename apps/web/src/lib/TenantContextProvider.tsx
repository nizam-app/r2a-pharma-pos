import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { fetchTenantContext, type TenantContextPayload } from "./api";

type TenantChrome = {
  storeId: string | null;
  storeName: string | null;
  tenantName: string | null;
};

const TenantChromeContext = createContext<TenantChrome | null>(null);

/**
 * Display labels for header chrome. storeId is read-only (no branch switch).
 */
export function TenantContextProvider({ children }: { children: ReactNode }) {
  const [payload, setPayload] = useState<TenantContextPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchTenantContext()
      .then((data) => {
        if (!cancelled) setPayload(data);
      })
      .catch(() => {
        if (!cancelled) setPayload(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<TenantChrome>(
    () => ({
      storeId: payload?.storeId ?? null,
      storeName: payload?.storeName ?? null,
      tenantName: payload?.tenantName ?? null,
    }),
    [payload],
  );

  return (
    <TenantChromeContext.Provider value={value}>
      {children}
    </TenantChromeContext.Provider>
  );
}

export function useTenantChrome(): TenantChrome {
  const ctx = useContext(TenantChromeContext);
  if (!ctx) {
    throw new Error("useTenantChrome must be used within TenantContextProvider");
  }
  return ctx;
}
