import type { RequestHandler } from "express";
import { AppError } from "../utils/AppError";
import { stripClientTenantId } from "../utils/tenant";

/**
 * After `protect`: attach canonical tenant scope from JWT only.
 * tenantId from JWT only — client body/query tenantId is ignored/stripped.
 */
export const tenantContext: RequestHandler = (req, _res, next) => {
  if (!req.auth) {
    next(new AppError("Authentication required", 401));
    return;
  }

  if (!req.auth.tenantId || !req.auth.sub) {
    next(new AppError("Invalid token: missing tenant claims", 401));
    return;
  }

  req.ctx = {
    userId: req.auth.sub,
    tenantId: req.auth.tenantId,
    storeId: req.auth.storeId,
    role: req.auth.role,
  };

  stripClientTenantId(req.body);

  next();
};
