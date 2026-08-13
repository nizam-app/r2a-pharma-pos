import type { Request, Response } from "express";
import { catchAsync, sendResponse } from "../../utils";
import { assertCanMutatePrices } from "../../utils/margin";
import { requireTenantContext } from "../../utils/tenant";
import * as batchService from "./batch.service";

export const create = catchAsync(async (req: Request, res: Response) => {
  const ctx = requireTenantContext(req);
  const data = await batchService.createBatch(ctx, req.body);
  sendResponse(res, { statusCode: 201, message: "Batch created", data });
});

export const update = catchAsync(async (req: Request, res: Response) => {
  const ctx = requireTenantContext(req);
  assertCanMutatePrices(ctx, req.body);
  const data = await batchService.updateBatch(ctx, req.params.id!, req.body);
  sendResponse(res, { statusCode: 200, message: "Batch updated", data });
});

export const getById = catchAsync(async (req: Request, res: Response) => {
  const ctx = requireTenantContext(req);
  const data = await batchService.getBatch(ctx, req.params.id!);
  sendResponse(res, { statusCode: 200, message: "OK", data });
});

export const list = catchAsync(async (req: Request, res: Response) => {
  const ctx = requireTenantContext(req);
  const result = await batchService.listBatches(ctx, req.query as never);
  sendResponse(res, {
    statusCode: 200,
    message: "OK",
    data: result.items,
    meta: {
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    },
  });
});
