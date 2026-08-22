import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { isLiveOwnerUrl, matchOwnerPath, type OwnerPath } from "./ownerPath";

type OwnerPathContextValue = {
  path: OwnerPath;
  pathname: string;
  navigate: (to: string) => void;
  setNavigationBlocker: (blocker: ((to: string) => boolean) | null) => void;
};

const OwnerPathContext = createContext<OwnerPathContextValue | null>(null);

function readPath(): OwnerPath {
  return matchOwnerPath(window.location.pathname);
}

function syncUrl(): OwnerPath {
  const raw = window.location.pathname;
  if (!isLiveOwnerUrl(raw)) {
    window.history.replaceState({}, "", "/");
    return "/";
  }
  return matchOwnerPath(raw);
}

/**
 * Tiny path store for live Owner navigation.
 * `pathname` is the real URL so `/sales` → `/sales/:id` re-renders (chrome path stays `/sales`).
 */
export function OwnerPathProvider({ children }: { children: ReactNode }) {
  const [path, setPath] = useState<OwnerPath>(() => readPath());
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const [navigationBlocker, setNavigationBlockerState] = useState<
    ((to: string) => boolean) | null
  >(null);
  const setNavigationBlocker = useCallback(
    (blocker: ((to: string) => boolean) | null) => {
      setNavigationBlockerState(() => blocker);
    },
    [],
  );

  useEffect(() => {
    setPath(syncUrl());
    setPathname(window.location.pathname);

    const onPop = () => {
      if (navigationBlocker && !navigationBlocker(window.location.pathname)) {
        window.history.pushState({}, "", pathname);
        return;
      }
      setPath(syncUrl());
      setPathname(window.location.pathname);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [navigationBlocker, pathname]);

  const navigate = useCallback((to: string) => {
    const pathOnly = to.split(/[?#]/, 1)[0] || "/";
    const next = isLiveOwnerUrl(pathOnly) ? to : "/";
    const nextPathOnly = next.split(/[?#]/, 1)[0] || "/";
    if (navigationBlocker && !navigationBlocker(next)) return;
    if (`${window.location.pathname}${window.location.search}` !== next) {
      window.history.pushState({}, "", next);
    }
    setPath(matchOwnerPath(nextPathOnly));
    setPathname(nextPathOnly);
  }, [navigationBlocker]);

  const value = useMemo(
    () => ({ path, pathname, navigate, setNavigationBlocker }),
    [path, pathname, navigate, setNavigationBlocker],
  );

  return (
    <OwnerPathContext.Provider value={value}>
      {children}
    </OwnerPathContext.Provider>
  );
}

export function useOwnerPath(): OwnerPathContextValue {
  const ctx = useContext(OwnerPathContext);
  if (!ctx) {
    throw new Error("useOwnerPath must be used within OwnerPathProvider");
  }
  return ctx;
}
