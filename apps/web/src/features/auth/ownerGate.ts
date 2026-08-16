/**
 * apps/web is OWNER only (M6 Batch A).
 * MANAGER and CASHIER (and SUPER_ADMIN) must not receive a web session.
 */
export function isWebOwnerRole(role: string): boolean {
  return role === "OWNER";
}

/** Thrown after a successful M2 login when GET /users/me is not OWNER. */
export class OwnerOnlyError extends Error {
  constructor() {
    super("OWNER_ONLY");
    this.name = "OwnerOnlyError";
  }
}
