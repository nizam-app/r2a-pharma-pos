import { Router } from "express";
import {
  batchCreateSchema,
  batchAdjustmentSchema,
  batchCorrectionSchema,
  batchLifecycleSchema,
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
  "/:id/corrections",
  restrictTo("OWNER", "MANAGER"),
  validate({ params: idParamSchema, body: batchCorrectionSchema }),
  batchController.correct,
);

batchRouter.post(
  "/:id/adjustments",
  restrictTo("OWNER", "MANAGER"),
  validate({ params: idParamSchema, body: batchAdjustmentSchema }),
  batchController.adjust,
);

batchRouter.post(
  "/:id/void",
  restrictTo("OWNER"),
  validate({ params: idParamSchema, body: batchLifecycleSchema }),
  batchController.voidBatch,
);

batchRouter.post(
  "/:id/retire",
  restrictTo("OWNER"),
  validate({ params: idParamSchema, body: batchLifecycleSchema }),
  batchController.retireBatch,
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

/** Legacy metadata/price PATCH only. Stock changes use signed /adjustments. */
batchRouter.patch(
  "/:id",
  restrictTo("OWNER", "MANAGER"),
  validate({ params: idParamSchema, body: batchUpdateSchema }),
  batchController.update,
);

export default batchRouter;
