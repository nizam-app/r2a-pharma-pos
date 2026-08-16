/**
 * Cloud API base URL for M2 Express server.
 * Set via apps/web/.env (gitignored) or Vite env — never commit secrets.
 * Example: VITE_API_BASE_URL=http://127.0.0.1:8787
 */
export const API_BASE_URL =
  import.meta.env?.VITE_API_BASE_URL?.replace(/\/$/, "") || "http://127.0.0.1:8787";
