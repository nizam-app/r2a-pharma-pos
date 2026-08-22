import { Router } from "express";
import {
  auditIdParamSchema,
  fefoViolationCorrectSchema,
  fefoViolationIdParamSchema,
  ownerAuditListQuerySchema,
  stockAuditLinesSubmitSchema,
  stockAuditReviewSchema,
  stockAuditStartSchema,
  stockAuditSubmitSchema,
} from "@r2a/shared-types";
import { restrictTo } from "../../middlewares/protect";
import { validate } from "../../middlewares/validate";
import * as auditController from "./audit.controller";

const auditRouter = Router();

auditRouter.post(
  "/start",
  restrictTo("OWNER", "MANAGER"),
  validate({ body: stockAuditStartSchema }),
  auditController.start,
);

auditRouter.post(
  "/:auditId/lines",
  restrictTo("OWNER", "MANAGER"),
  validate({ params: auditIdParamSchema, body: stockAuditLinesSubmitSchema }),
  auditController.lines,
);

auditRouter.post(
  "/:auditId/submit",
  restrictTo("OWNER", "MANAGER"),
  validate({ params: auditIdParamSchema, body: stockAuditSubmitSchema }),
  auditController.submit,
);

export default auditRouter;

export const ownerAuditRouter = Router();

ownerAuditRouter.get("/audit/dashboard", auditController.dashboard);

ownerAuditRouter.get(
  "/audits",
  validate({ query: ownerAuditListQuerySchema }),
  auditController.list,
);

ownerAuditRouter.get(
  "/audits/:auditId",
  validate({ params: auditIdParamSchema }),
  auditController.detail,
);

ownerAuditRouter.post(
  "/audits/:auditId/review",
  validate({ params: auditIdParamSchema, body: stockAuditReviewSchema }),
  auditController.review,
);

ownerAuditRouter.post(
  "/fefo-violations/:violationId/correct",
  validate({ params: fefoViolationIdParamSchema, body: fefoViolationCorrectSchema }),
  auditController.correctFefo,
);
