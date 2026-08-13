import { Router } from "express";
import { syncIngestBatchSchema } from "@r2a/shared-types";
import { validate } from "../../middlewares/validate";
import * as syncController from "./sync.controller";

/**
 * One-way offline sync ingest (M4 Batch B).
 * POST /api/v1/sync/ingest — JWT + tenantContext required (mounted on domainRouter).
 * Body: snake_case envelope `{ events: [{ event_id, entity_type, action, payload }] }`.
 * Only `entity_type: "sale"` + `action: "create"` is processed; others are per-event `rejected`.
 * HTTP 200 + per-event results even when some events are rejected.
 * Does not replace POST /api/v1/sales/ingest (online happy path).
 */
const syncRouter = Router();

syncRouter.post(
  "/ingest",
  validate({ body: syncIngestBatchSchema }),
  syncController.ingest,
);

export default syncRouter;
