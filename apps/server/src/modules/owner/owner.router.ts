import { Router } from "express";
import {
  ownerDashboardQuerySchema,
  ownerExpiryQuerySchema,
  ownerInventoryQuerySchema,
  productIdParamSchema,
} from "@r2a/shared-types";
import { restrictTo } from "../../middlewares/protect";
import { validate } from "../../middlewares/validate";
import * as ownerController from "./owner.controller";

/**
 * Owner aggregate reads — dashboard / inventory-summary / expiry / inventory list
 * / product detail. All are OWNER-only (Manager/Cashier 403).
 */
const ownerRouter = Router();

ownerRouter.use(restrictTo("OWNER"));

ownerRouter.get(
  "/dashboard",
  validate({ query: ownerDashboardQuerySchema }),
  ownerController.dashboard,
);

ownerRouter.get("/inventory-summary", ownerController.inventorySummary);

ownerRouter.get(
  "/inventory",
  validate({ query: ownerInventoryQuerySchema }),
  ownerController.inventory,
);

ownerRouter.get(
  "/products/:productId",
  validate({ params: productIdParamSchema }),
  ownerController.productDetail,
);

ownerRouter.get(
  "/expiry",
  validate({ query: ownerExpiryQuerySchema }),
  ownerController.expiry,
);

export default ownerRouter;
