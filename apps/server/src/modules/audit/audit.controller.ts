import type { Request, Response } from "express";
import type {
  FefoViolationCorrectInput,
  OwnerAuditListQuery,
  StockAuditLinesSubmitInput,
  StockAuditReviewInput,
  StockAuditStartInput,
  StockAuditSubmitInput,
} from "@r2a/shared-types";
import { catchAsync, sendResponse } from "../../utils";
import { requireTenantContext } from "../../utils/tenant";
import * as auditService from "./audit.service";

export const dashboard = catchAsync(async (req: Request, res: Response) => {
  const data = await auditService.getDashboard(requireTenantContext(req));
  sendResponse(res, { statusCode: 200, message: "OK", data });
});

export const list = catchAsync(async (req: Request, res: Response) => {
  const result = await auditService.listAudits(
    requireTenantContext(req),
    req.query as unknown as OwnerAuditListQuery,
  );
  sendResponse(res, {
    statusCode: 200,
    message: "OK",
    data: result.items,
    meta: { total: result.total, limit: result.limit, offset: result.offset },
  });
});

export const detail = catchAsync(async (req: Request, res: Response) => {
  const data = await auditService.getAudit(requireTenantContext(req), req.params.auditId!);
  sendResponse(res, { statusCode: 200, message: "OK", data });
});

export const review = catchAsync(async (req: Request, res: Response) => {
  const data = await auditService.reviewAudit(
    requireTenantContext(req),
    req.params.auditId!,
    req.body as StockAuditReviewInput,
  );
  sendResponse(res, { statusCode: 200, message: "OK", data });
});

export const correctFefo = catchAsync(async (req: Request, res: Response) => {
  const data = await auditService.correctFefoViolation(
    requireTenantContext(req),
    req.params.violationId!,
    req.body as FefoViolationCorrectInput,
  );
  sendResponse(res, { statusCode: 200, message: "OK", data });
});

export const start = catchAsync(async (req: Request, res: Response) => {
  const data = await auditService.startAudit(
    requireTenantContext(req),
    req.body as StockAuditStartInput,
  );
  sendResponse(res, { statusCode: 201, message: "Audit started", data });
});

export const lines = catchAsync(async (req: Request, res: Response) => {
  const data = await auditService.replaceAuditLines(
    requireTenantContext(req),
    req.params.auditId!,
    req.body as StockAuditLinesSubmitInput,
  );
  sendResponse(res, { statusCode: 200, message: "Audit lines saved", data });
});

export const submit = catchAsync(async (req: Request, res: Response) => {
  const data = await auditService.submitAudit(
    requireTenantContext(req),
    req.params.auditId!,
    req.body as StockAuditSubmitInput,
  );
  sendResponse(res, { statusCode: 200, message: "Audit submitted", data });
});
