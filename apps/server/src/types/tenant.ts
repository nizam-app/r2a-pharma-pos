import type { Role } from "@r2a/shared-types";

/**
 * Canonical tenant scope for domain routes.
 * Always sourced from JWT via `tenantContext` — never from client body.
 */
export type TenantContext = {
  userId: string;
  tenantId: string;
  storeId: string | null;
  role: Role;
};
