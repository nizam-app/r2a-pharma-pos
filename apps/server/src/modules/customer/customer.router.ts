import { Router } from "express";
import {
  customerCreateSchema,
  customerSearchSchema,
  customerUpdateSchema,
  idParamSchema,
} from "@r2a/shared-types";
import { restrictTo } from "../../middlewares/protect";
import { validate } from "../../middlewares/validate";
import * as customerController from "./customer.controller";

const customerRouter = Router();

customerRouter.get(
  "/",
  validate({ query: customerSearchSchema }),
  customerController.search,
);

/** Create Customer — Owner only (not Manager; not on desktop POS). Owner web later. */
customerRouter.post(
  "/",
  restrictTo("OWNER"),
  validate({ body: customerCreateSchema }),
  customerController.create,
);

customerRouter.get(
  "/:id",
  validate({ params: idParamSchema }),
  customerController.getById,
);

/** Edit customer — Owner/Manager only (cashier is search-only at POS). */
customerRouter.patch(
  "/:id",
  restrictTo("OWNER", "MANAGER"),
  validate({ params: idParamSchema, body: customerUpdateSchema }),
  customerController.update,
);

export default customerRouter;
