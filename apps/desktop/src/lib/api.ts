import type { LoginInput } from "@r2a/shared-types";
import { API_BASE_URL } from "./env";
import { tokenStore } from "./tokenStore";

export type ApiEnvelope<T> = {
  status: string;
  message: string;
  data?: T;
  meta?: unknown;
};

export class ApiError extends Error {
  readonly statusCode: number;
  readonly envelopeStatus: string;

  constructor(message: string, statusCode: number, envelopeStatus = "fail") {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.envelopeStatus = envelopeStatus;
  }
}

/** Auth token pair from login / refresh (M2 envelope `data`). */
export type AuthTokenPair = {
  user: unknown;
  accessToken: string;
  refreshToken: string;
  expiresIn?: string;
};

type RequestOptions = {
  method?: string;
  body?: unknown;
  /** Skip Authorization header (login / refresh / logout). */
  auth?: boolean;
  /** Skip one-shot refresh retry (internal). */
  _retried?: boolean;
};

let onSessionInvalid: (() => void) | null = null;

/** AuthProvider registers this so 401-after-refresh clears the UI session. */
export function setOnSessionInvalid(handler: (() => void) | null): void {
  onSessionInvalid = handler;
}

async function parseEnvelope<T>(res: Response): Promise<ApiEnvelope<T>> {
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new ApiError(
      res.statusText || "Invalid server response",
      res.status,
      "error",
    );
  }
  return json as ApiEnvelope<T>;
}

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = tokenStore.getRefresh();
  if (!refreshToken) return false;

  const res = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  const envelope = await parseEnvelope<AuthTokenPair>(res);
  if (!res.ok || !envelope.data?.accessToken || !envelope.data?.refreshToken) {
    tokenStore.clear();
    return false;
  }

  tokenStore.set({
    accessToken: envelope.data.accessToken,
    refreshToken: envelope.data.refreshToken,
  });
  return true;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, auth = true, _retried = false } = options;
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (auth) {
    const access = tokenStore.getAccess();
    if (access) headers.Authorization = `Bearer ${access}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (res.status === 401 && auth && !_retried) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return apiRequest<T>(path, { ...options, _retried: true });
    }
    onSessionInvalid?.();
    const envelope = await parseEnvelope<T>(res);
    throw new ApiError(envelope.message || "Session expired", 401, envelope.status);
  }

  const envelope = await parseEnvelope<T>(res);
  if (!res.ok) {
    throw new ApiError(
      envelope.message || res.statusText || "Request failed",
      res.status,
      envelope.status,
    );
  }

  return envelope.data as T;
}

export async function loginRequest(input: LoginInput): Promise<AuthTokenPair> {
  return apiRequest<AuthTokenPair>("/api/v1/auth/login", {
    method: "POST",
    body: input,
    auth: false,
  });
}

export async function logoutRequest(refreshToken: string): Promise<void> {
  try {
    await apiRequest<unknown>("/api/v1/auth/logout", {
      method: "POST",
      body: { refreshToken },
      auth: false,
    });
  } catch {
    // Idempotent / offline logout — still clear local session.
  }
}

export async function fetchMe(): Promise<unknown> {
  return apiRequest<unknown>("/api/v1/users/me");
}
