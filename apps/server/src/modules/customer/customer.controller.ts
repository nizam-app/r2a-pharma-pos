import type { Request, Response } from "express";
import type {
  OwnerCustomerApproveInput,
  OwnerCustomerListQuery,
  OwnerCustomerRejectInput,
} from "@r2a/shared-types";
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

export const phoneCheck = catchAsync(async (req: Request, res: Response) => {
  const ctx = requireTenantContext(req);
  const { phone } = req.query as { phone: string };
  const data = await customerService.phoneCheck(ctx, phone);
  sendResponse(res, { statusCode: 200, message: "OK", data });
});

export const ownerList = catchAsync(async (req: Request, res: Response) => {
  const ctx = requireTenantContext(req);
  const result = await customerService.ownerCustomerList(
    ctx,
    req.query as unknown as OwnerCustomerListQuery,
  );
  sendResponse(res, {
    statusCode: 200,
    message: "OK",
    data: result.items,
    meta: {
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      kpis: result.kpis,
    },
  });
});

export const ownerDetail = catchAsync(async (req: Request, res: Response) => {
  const ctx = requireTenantContext(req);
  const data = await customerService.ownerCustomerDetail(
    ctx,
    req.params.customerId!,
  );
  sendResponse(res, { statusCode: 200, message: "OK", data });
});

export const ownerApprove = catchAsync(async (req: Request, res: Response) => {
  const ctx = requireTenantContext(req);
  const data = await customerService.approveCustomer(
    ctx,
    req.params.customerId!,
    req.body as OwnerCustomerApproveInput,
  );
  sendResponse(res, {
    statusCode: 200,
    message: "Customer approved",
    data,
  });
});

export const ownerReject = catchAsync(async (req: Request, res: Response) => {
  const ctx = requireTenantContext(req);
  const data = await customerService.rejectCustomer(
    ctx,
    req.params.customerId!,
    req.body as OwnerCustomerRejectInput,
  );
  sendResponse(res, {
    statusCode: 200,
    message: "Customer rejected",
    data,
  });
});
