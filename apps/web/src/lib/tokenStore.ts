/**
 * Owner-web token persistence (M6 Batch A).
 *
 * Keys are namespaced separately from POS (`r2a.pos.*`) so a shared browser
 * origin cannot mix cashier and owner sessions.
 */

const ACCESS_KEY = "r2a.web.accessToken";
const REFRESH_KEY = "r2a.web.refreshToken";

export type StoredTokens = {
  accessToken: string;
  refreshToken: string;
};

export const tokenStore = {
  getAccess(): string | null {
    try {
      return localStorage.getItem(ACCESS_KEY);
    } catch {
      return null;
    }
  },

  getRefresh(): string | null {
    try {
      return localStorage.getItem(REFRESH_KEY);
    } catch {
      return null;
    }
  },

  get(): StoredTokens | null {
    const accessToken = this.getAccess();
    const refreshToken = this.getRefresh();
    if (!accessToken || !refreshToken) return null;
    return { accessToken, refreshToken };
  },

  set(tokens: StoredTokens): void {
    localStorage.setItem(ACCESS_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  },

  clear(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};
