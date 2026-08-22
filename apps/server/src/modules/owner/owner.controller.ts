import type { Request, Response } from "express";
import type {
  OwnerDashboardQuery,
  OwnerExpiryQuery,
  OwnerInventoryQuery,
  OwnerSalesReportQuery,
  StaffListQuery,
  OwnerStaffCreateInput,
  OwnerStaffPatchInput,
  StaffDeactivateInput,
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

export const salesReport = catchAsync(async (req: Request, res: Response) => {
  const ctx = requireTenantContext(req);
  const data = await ownerService.getSalesReport(
    ctx,
    req.query as unknown as OwnerSalesReportQuery,
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

export const listStaff = catchAsync(async (req: Request, res: Response) => {
  const ctx = requireTenantContext(req);
  const result = await ownerService.listStaff(
    ctx,
    req.query as unknown as StaffListQuery,
  );
  sendResponse(res, {
    statusCode: 200,
    message: "OK",
    data: {
      items: result.items,
      kpis: result.kpis,
    },
    meta: {
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    },
  });
});

export const getStaff = catchAsync(async (req: Request, res: Response) => {
  const ctx = requireTenantContext(req);
  const data = await ownerService.getStaffDetail(ctx, req.params.id!);
  sendResponse(res, { statusCode: 200, message: "OK", data });
});

export const createStaff = catchAsync(async (req: Request, res: Response) => {
  const ctx = requireTenantContext(req);
  const data = await ownerService.createStaff(
    ctx,
    req.body as OwnerStaffCreateInput,
  );
  sendResponse(res, { statusCode: 201, message: "OK", data });
});

export const patchStaff = catchAsync(async (req: Request, res: Response) => {
  const ctx = requireTenantContext(req);
  const data = await ownerService.patchStaff(
    ctx,
    req.params.id!,
    req.body as OwnerStaffPatchInput,
  );
  sendResponse(res, { statusCode: 200, message: "OK", data });
});

export const deactivateStaff = catchAsync(async (req: Request, res: Response) => {
  const ctx = requireTenantContext(req);
  const data = await ownerService.deactivateStaff(
    ctx,
    req.params.id!,
    req.body as StaffDeactivateInput,
  );
  sendResponse(res, { statusCode: 200, message: "OK", data });
});

export const reactivateStaff = catchAsync(async (req: Request, res: Response) => {
  const ctx = requireTenantContext(req);
  const data = await ownerService.reactivateStaff(ctx, req.params.id!);
  sendResponse(res, { statusCode: 200, message: "OK", data });
});
