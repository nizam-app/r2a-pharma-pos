/**
 * Cloud API base URL for M2 Express server.
 * Set via apps/desktop/.env (gitignored) or Vite env — never commit secrets.
 * Example: VITE_API_BASE_URL=http://localhost:8787
 */
export const API_BASE_URL =
  import.meta.env?.VITE_API_BASE_URL?.replace(/\/$/, "") || "http://localhost:8787";
