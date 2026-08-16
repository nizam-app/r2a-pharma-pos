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
 * Tiny path store for Slice 1 live nav. Does not implement later-nav routes.
 * `pathname` is the real URL so `/sales` → `/sales/:id` re-renders (chrome path stays `/sales`).
 */
export function OwnerPathProvider({ children }: { children: ReactNode }) {
  const [path, setPath] = useState<OwnerPath>(() => readPath());
  const [pathname, setPathname] = useState(() => window.location.pathname);

  useEffect(() => {
    setPath(syncUrl());
    setPathname(window.location.pathname);

    const onPop = () => {
      setPath(syncUrl());
      setPathname(window.location.pathname);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback((to: string) => {
    const next = isLiveOwnerUrl(to) ? to : "/";
    if (window.location.pathname !== next) {
      window.history.pushState({}, "", next);
    }
    setPath(matchOwnerPath(next));
    setPathname(next);
  }, []);

  const value = useMemo(
    () => ({ path, pathname, navigate }),
    [path, pathname, navigate],
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
