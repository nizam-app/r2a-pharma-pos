import { Router } from "express";
import {
  customerIdParamSchema,
  idParamSchema,
  ownerCustomerApproveSchema,
  ownerCustomerListQuerySchema,
  ownerCustomerRejectSchema,
  ownerDashboardQuerySchema,
  ownerExpiryQuerySchema,
  ownerInventoryQuerySchema,
  productIdParamSchema,
} from "@r2a/shared-types";
import { restrictTo } from "../../middlewares/protect";
import { validate } from "../../middlewares/validate";
import * as ownerController from "./owner.controller";
import * as customerController from "../customer/customer.controller";
import purchasingRouter from "../purchasing/purchasing.router";

/**
 * Owner aggregate reads — dashboard / inventory-summary / expiry / inventory list
 * / product detail. All are OWNER-only (Manager/Cashier 403).
 */
const ownerRouter = Router();

ownerRouter.use(restrictTo("OWNER"));

ownerRouter.use(purchasingRouter);

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
  "/batches/:id",
  validate({ params: idParamSchema }),
  ownerController.batchDetail,
);

ownerRouter.get(
  "/expiry",
  validate({ query: ownerExpiryQuerySchema }),
  ownerController.expiry,
);

/** Owner customer management — all OWNER-only. */
ownerRouter.get(
  "/customers",
  validate({ query: ownerCustomerListQuerySchema }),
  customerController.ownerList,
);

ownerRouter.get(
  "/customers/:customerId",
  validate({ params: customerIdParamSchema }),
  customerController.ownerDetail,
);

ownerRouter.post(
  "/customers/:customerId/approve",
  validate({ params: customerIdParamSchema, body: ownerCustomerApproveSchema }),
  customerController.ownerApprove,
);

ownerRouter.post(
  "/customers/:customerId/reject",
  validate({ params: customerIdParamSchema, body: ownerCustomerRejectSchema }),
  customerController.ownerReject,
);

export default ownerRouter;
