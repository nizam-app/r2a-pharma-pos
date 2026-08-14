import { Router } from "express";
import {
  batchCreateSchema,
  batchListSchema,
  batchUpdateSchema,
  idParamSchema,
} from "@r2a/shared-types";
import { restrictTo } from "../../middlewares/protect";
import { validate } from "../../middlewares/validate";
import * as batchController from "./batch.controller";

const batchRouter = Router();

batchRouter.get(
  "/",
  validate({ query: batchListSchema }),
  batchController.list,
);

batchRouter.post(
  "/",
  restrictTo("OWNER", "MANAGER"),
  validate({ body: batchCreateSchema }),
  batchController.create,
);

batchRouter.get(
  "/:id",
  validate({ params: idParamSchema }),
  batchController.getById,
);

/** Patch lot (incl. qty) — Owner/Manager only. Cashier cannot adjust on-hand. */
batchRouter.patch(
  "/:id",
  restrictTo("OWNER", "MANAGER"),
  validate({ params: idParamSchema, body: batchUpdateSchema }),
  batchController.update,
);

export default batchRouter;
