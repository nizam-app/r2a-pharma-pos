/**
 * Terminal Force Offline persistence (M3 Batch AI).
 *
 * Choice: webview `localStorage` — sticky across reloads until explicit Go Online.
 * Key: pharmasync.forceOffline
 *
 * Terminal-scoped (not tenant/store): override applies to this POS register only.
 * While forced, ConnectivityProvider skips health probes and stays offline.
 */

const KEY = "pharmasync.forceOffline";

export const forceOfflineStore = {
  get(): boolean {
    try {
      return localStorage.getItem(KEY) === "1";
    } catch {
      return false;
    }
  },

  set(forced: boolean): void {
    try {
      if (forced) localStorage.setItem(KEY, "1");
      else localStorage.removeItem(KEY);
    } catch {
      /* ignore quota / private mode */
    }
  },
};
