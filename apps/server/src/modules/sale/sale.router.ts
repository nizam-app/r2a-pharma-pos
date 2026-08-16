import { Router } from "express";
import {
  saleIdParamSchema,
  saleIngestSchema,
  saleListQuerySchema,
} from "@r2a/shared-types";
import { validate } from "../../middlewares/validate";
import * as saleController from "./sale.controller";

/**
 * Sales routes — append-only ingest + authenticated reads (no delete).
 * Cost/COGS/margin redaction is by role in the service (OWNER only).
 */
const saleRouter = Router();

saleRouter.get(
  "/",
  validate({ query: saleListQuerySchema }),
  saleController.list,
);

saleRouter.get(
  "/:id",
  validate({ params: saleIdParamSchema }),
  saleController.getById,
);

saleRouter.post(
  "/ingest",
  validate({ body: saleIngestSchema }),
  saleController.ingest,
);

export default saleRouter;
