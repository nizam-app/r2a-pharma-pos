import type { Role } from "@r2a/shared-types";

/**
 * Session user — only SafeUser fields. Never surface cost/margin if a payload
 * accidentally includes extras.
 */
export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  tenantId: string;
  storeId: string | null;
  isActive: boolean;
};

const ROLES = new Set(["SUPER_ADMIN", "OWNER", "MANAGER", "CASHIER"]);

export function toSessionUser(raw: unknown): SessionUser {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid user payload");
  }
  const o = raw as Record<string, unknown>;
  const role = String(o.role);
  if (!ROLES.has(role)) {
    throw new Error("Invalid user role");
  }
  return {
    id: String(o.id ?? ""),
    name: String(o.name ?? ""),
    email: String(o.email ?? ""),
    role: role as Role,
    tenantId: String(o.tenantId ?? ""),
    storeId: o.storeId == null || o.storeId === "" ? null : String(o.storeId),
    isActive: Boolean(o.isActive),
  };
}

export function displayNameFromUser(user: SessionUser): string {
  return user.name.trim() || user.email;
}

export function initialsFromUser(user: SessionUser): string {
  const name = user.name.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0];
    const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : parts[0]?.[1];
    const letters = `${first ?? ""}${last ?? ""}`.toUpperCase();
    if (letters) return letters;
  }
  const email = user.email.trim();
  if (email.length >= 2) return email.slice(0, 2).toUpperCase();
  return "?";
}
