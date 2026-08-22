import type { Request, Response } from "express";
import type {
  ShiftOpenInput,
  ShiftCloseInput,
  ShiftResolveInput,
  OwnerShiftListQuery,
} from "@r2a/shared-types";
import { catchAsync, sendResponse } from "../../utils";
import { requireTenantContext } from "../../utils/tenant";
import * as shiftService from "./shift.service";

/* -------------------------------------------------------------------------- */
/*  Cashier                                                                    */
/* -------------------------------------------------------------------------- */

export const open = catchAsync(async (req: Request, res: Response) => {
  const ctx = requireTenantContext(req);
  const data = await shiftService.openShift(ctx, req.body as ShiftOpenInput);
  sendResponse(res, { statusCode: 201, message: "Shift opened", data });
});

export const close = catchAsync(async (req: Request, res: Response) => {
  const ctx = requireTenantContext(req);
  const data = await shiftService.closeShift(ctx, req.body as ShiftCloseInput);
  sendResponse(res, { statusCode: 200, message: "Shift closed", data });
});

export const active = catchAsync(async (req: Request, res: Response) => {
  const ctx = requireTenantContext(req);
  const data = await shiftService.getActiveShift(ctx);
  sendResponse(res, {
    statusCode: 200,
    message: "OK",
    data: data ?? null,
  });
});

/* -------------------------------------------------------------------------- */
/*  Owner                                                                      */
/* -------------------------------------------------------------------------- */

export const list = catchAsync(async (req: Request, res: Response) => {
  const ctx = requireTenantContext(req);
  const result = await shiftService.listShifts(
    ctx,
    req.query as unknown as OwnerShiftListQuery,
  );
  sendResponse(res, {
    statusCode: 200,
    message: "OK",
    data: { items: result.items },
    meta: {
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    },
  });
});

export const detail = catchAsync(async (req: Request, res: Response) => {
  const ctx = requireTenantContext(req);
  const data = await shiftService.getShiftDetail(ctx, req.params.shiftId!);
  sendResponse(res, { statusCode: 200, message: "OK", data });
});

export const resolve = catchAsync(async (req: Request, res: Response) => {
  const ctx = requireTenantContext(req);
  const data = await shiftService.resolveVariance(
    ctx,
    req.params.shiftId!,
    req.body as ShiftResolveInput,
  );
  sendResponse(res, { statusCode: 200, message: "Variance resolved", data });
});
