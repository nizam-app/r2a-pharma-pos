import type { Request, Response } from "express";
import { catchAsync, sendResponse } from "../../utils";
import { requireTenantContext } from "../../utils/tenant";
import * as customerService from "./customer.service";

export const create = catchAsync(async (req: Request, res: Response) => {
  const ctx = requireTenantContext(req);
  const data = await customerService.createCustomer(ctx, req.body);
  sendResponse(res, { statusCode: 201, message: "Customer created", data });
});

export const update = catchAsync(async (req: Request, res: Response) => {
  const ctx = requireTenantContext(req);
  const data = await customerService.updateCustomer(
    ctx,
    req.params.id!,
    req.body,
  );
  sendResponse(res, { statusCode: 200, message: "Customer updated", data });
});

export const getById = catchAsync(async (req: Request, res: Response) => {
  const ctx = requireTenantContext(req);
  const data = await customerService.getCustomer(ctx, req.params.id!);
  sendResponse(res, { statusCode: 200, message: "OK", data });
});

export const search = catchAsync(async (req: Request, res: Response) => {
  const ctx = requireTenantContext(req);
  const result = await customerService.searchCustomers(ctx, req.query as never);
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
