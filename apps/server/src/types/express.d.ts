import type { JwtClaims } from "@r2a/shared-types";
import type { TenantContext } from "../types/tenant";

declare global {
  namespace Express {
    interface Request {
      /** Set by `protect` — JWT claims only (never trust body tenantId). */
      auth?: JwtClaims;
      /**
       * Set by `tenantContext` after `protect`.
       * tenantId / storeId / role / userId are JWT-canonical for Prisma scoping.
       */
      ctx?: TenantContext;
    }
  }
}

export {};
