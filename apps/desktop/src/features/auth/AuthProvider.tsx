import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { LoginInput } from "@r2a/shared-types";
import {
  ApiError,
  fetchMe,
  loginRequest,
  logoutRequest,
  setOnSessionInvalid,
} from "@/lib/api";
import { tokenStore } from "@/lib/tokenStore";
import {
  cashierLabelFromUser,
  toSessionUser,
  type SessionUser,
} from "./sessionUser";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  status: AuthStatus;
  user: SessionUser | null;
  cashierLabel: string;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<SessionUser | null>(null);

  const clearSession = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  useEffect(() => {
    setOnSessionInvalid(() => {
      clearSession();
    });
    return () => setOnSessionInvalid(null);
  }, [clearSession]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const tokens = tokenStore.get();
      if (!tokens) {
        if (!cancelled) {
          setStatus("unauthenticated");
          setUser(null);
        }
        return;
      }

      try {
        const me = await fetchMe();
        if (cancelled) return;
        setUser(toSessionUser(me));
        setStatus("authenticated");
      } catch {
        if (cancelled) return;
        tokenStore.clear();
        setUser(null);
        setStatus("unauthenticated");
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const data = await loginRequest(input);
    if (!data.accessToken || !data.refreshToken) {
      throw new ApiError("Login response missing tokens", 500, "error");
    }
    tokenStore.set({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    });
    // Prefer /users/me so profile is authoritative; fall back to login user.
    try {
      const me = await fetchMe();
      setUser(toSessionUser(me));
    } catch {
      setUser(toSessionUser(data.user));
    }
    setStatus("authenticated");
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = tokenStore.getRefresh();
    if (refreshToken) {
      await logoutRequest(refreshToken);
    }
    clearSession();
  }, [clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      cashierLabel: user ? cashierLabelFromUser(user) : "—",
      login,
      logout,
    }),
    [status, user, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
