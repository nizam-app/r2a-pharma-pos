import { Router } from "express";
import { saleIngestSchema } from "@r2a/shared-types";
import { validate } from "../../middlewares/validate";
import * as saleController from "./sale.controller";

/**
 * Sales routes — append-only ingest (no delete in M2).
 */
const saleRouter = Router();

saleRouter.post(
  "/ingest",
  validate({ body: saleIngestSchema }),
  saleController.ingest,
);

export default saleRouter;
