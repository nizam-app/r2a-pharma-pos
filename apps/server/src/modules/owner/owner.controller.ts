import type { Request, Response } from "express";
import type {
  OwnerDashboardQuery,
  OwnerExpiryQuery,
  OwnerInventoryQuery,
} from "@r2a/shared-types";
import { catchAsync, sendResponse } from "../../utils";
import { requireTenantContext } from "../../utils/tenant";
import * as ownerService from "./owner.service";

export const dashboard = catchAsync(async (req: Request, res: Response) => {
  const ctx = requireTenantContext(req);
  const data = await ownerService.getDashboard(
    ctx,
    req.query as unknown as OwnerDashboardQuery,
  );
  sendResponse(res, { statusCode: 200, message: "OK", data });
});

export const inventorySummary = catchAsync(
  async (req: Request, res: Response) => {
    const ctx = requireTenantContext(req);
    const data = await ownerService.getInventorySummary(ctx);
    sendResponse(res, { statusCode: 200, message: "OK", data });
  },
);

export const expiry = catchAsync(async (req: Request, res: Response) => {
  const ctx = requireTenantContext(req);
  const data = await ownerService.getExpiry(
    ctx,
    req.query as unknown as OwnerExpiryQuery,
  );
  sendResponse(res, { statusCode: 200, message: "OK", data });
});

export const productDetail = catchAsync(async (req: Request, res: Response) => {
  const ctx = requireTenantContext(req);
  const data = await ownerService.getProductDetail(
    ctx,
    req.params.productId!,
  );
  sendResponse(res, { statusCode: 200, message: "OK", data });
});

export const batchDetail = catchAsync(async (req: Request, res: Response) => {
  const ctx = requireTenantContext(req);
  const data = await ownerService.getBatchDetail(ctx, req.params.id!);
  sendResponse(res, { statusCode: 200, message: "OK", data });
});

export const inventory = catchAsync(async (req: Request, res: Response) => {
  const ctx = requireTenantContext(req);
  const result = await ownerService.getInventoryList(
    ctx,
    req.query as unknown as OwnerInventoryQuery,
  );
  sendResponse(res, {
    statusCode: 200,
    message: "OK",
    data: {
      items: result.items,
      tabs: result.tabs,
      attention: result.attention,
      summary: result.summary,
    },
    meta: {
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    },
  });
});
