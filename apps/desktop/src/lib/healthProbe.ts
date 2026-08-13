import { API_BASE_URL } from "./env";

const HEALTH_PATH = "/api/v1/health";
const DEFAULT_TIMEOUT_MS = 4_000;

/**
 * Lightweight cloud reachability probe (public M2 health).
 * Does not use auth tokens — connectivity is independent of session.
 */
export async function probeHealth(
  timeoutMs = DEFAULT_TIMEOUT_MS,
  externalSignal?: AbortSignal,
): Promise<boolean> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      window.clearTimeout(timer);
      return false;
    }
    externalSignal.addEventListener("abort", onExternalAbort, { once: true });
  }

  try {
    const res = await fetch(`${API_BASE_URL}${HEALTH_PATH}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
    externalSignal?.removeEventListener("abort", onExternalAbort);
  }
}
