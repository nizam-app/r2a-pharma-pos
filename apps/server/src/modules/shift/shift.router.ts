import { Router } from "express";
import {
  shiftOpenSchema,
  shiftCloseSchema,
  shiftResolveSchema,
  ownerShiftListQuerySchema,
  shiftIdParamSchema,
} from "@r2a/shared-types";
import { restrictTo } from "../../middlewares/protect";
import { validate } from "../../middlewares/validate";
import * as shiftController from "./shift.controller";

/**
 * Cashier shift routes — mounted under domainRouter so protect + tenantContext
 * are already applied by the parent.
 */
const cashierShiftRouter = Router();

cashierShiftRouter.post(
  "/",
  restrictTo("CASHIER", "MANAGER"),
  validate({ body: shiftOpenSchema }),
  shiftController.open,
);

cashierShiftRouter.post(
  "/active/close",
  restrictTo("CASHIER", "MANAGER"),
  validate({ body: shiftCloseSchema }),
  shiftController.close,
);

cashierShiftRouter.get(
  "/active",
  restrictTo("CASHIER", "MANAGER"),
  shiftController.active,
);

export default cashierShiftRouter;

/* -------------------------------------------------------------------------- */
/*  Owner-only shift sub-router (mounted on ownerRouter)                       */
/* -------------------------------------------------------------------------- */

export const ownerShiftRouter = Router({ mergeParams: true });

ownerShiftRouter.get(
  "/",
  validate({ query: ownerShiftListQuerySchema }),
  shiftController.list,
);

ownerShiftRouter.get(
  "/:shiftId",
  validate({ params: shiftIdParamSchema }),
  shiftController.detail,
);

ownerShiftRouter.post(
  "/:shiftId/resolve",
  validate({ params: shiftIdParamSchema, body: shiftResolveSchema }),
  shiftController.resolve,
);
