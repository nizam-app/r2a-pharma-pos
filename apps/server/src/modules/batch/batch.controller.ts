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

export const correct = catchAsync(async (req: Request, res: Response) => {
  const ctx = requireTenantContext(req);
  const result = await batchService.correctBatch(ctx, req.params.id!, req.body);
  sendResponse(res, {
    statusCode: 200,
    message: result.idempotent ? "Batch correction already applied" : "Batch corrected",
    data: { batch: result.batch, revision: result.revision },
    meta: { idempotent: result.idempotent },
  });
});

export const adjust = catchAsync(async (req: Request, res: Response) => {
  const ctx = requireTenantContext(req);
  const result = await batchService.adjustBatch(ctx, req.params.id!, req.body);
  sendResponse(res, {
    statusCode: 200,
    message: result.idempotent ? "Batch adjustment already applied" : "Batch adjusted",
    data: { batch: result.batch, event: result.event },
    meta: { idempotent: result.idempotent },
  });
});

export const voidBatch = catchAsync(async (req: Request, res: Response) => {
  const ctx = requireTenantContext(req);
  const result = await batchService.voidBatch(ctx, req.params.id!, req.body);
  sendResponse(res, {
    statusCode: 200,
    message: result.idempotent ? "Batch void already applied" : "Batch voided",
    data: {
      batch: result.batch,
      event: result.event,
      revision: result.revision,
    },
    meta: { idempotent: result.idempotent },
  });
});

export const retireBatch = catchAsync(async (req: Request, res: Response) => {
  const ctx = requireTenantContext(req);
  const result = await batchService.retireBatch(ctx, req.params.id!, req.body);
  sendResponse(res, {
    statusCode: 200,
    message: result.idempotent ? "Batch retirement already applied" : "Batch retired",
    data: {
      batch: result.batch,
      event: result.event,
      revision: result.revision,
    },
    meta: { idempotent: result.idempotent },
  });
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
