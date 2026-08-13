/**
 * Batch C token persistence.
 *
 * Choice: webview `localStorage` (origin-scoped to the Tauri/Vite app).
 * Good enough for single-terminal desktop MVP; works in `npm run dev` and Tauri.
 * Later hardening can swap this module for Tauri Stronghold / OS keychain without
 * changing AuthProvider call sites.
 */

const ACCESS_KEY = "r2a.pos.accessToken";
const REFRESH_KEY = "r2a.pos.refreshToken";

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
