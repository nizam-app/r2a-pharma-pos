import type { Request, Response } from "express";
import { catchAsync, sendResponse } from "../../utils";
import { assertStoreAccess, requireTenantContext } from "../../utils/tenant";
import * as userService from "./user.service";

export const getMe = catchAsync(async (req: Request, res: Response) => {
  const ctx = requireTenantContext(req);
  const data = await userService.getMe(ctx.userId);
  sendResponse(res, {
    statusCode: 200,
    message: "OK",
    data,
  });
});

export const createStaff = catchAsync(async (req: Request, res: Response) => {
  const ctx = requireTenantContext(req);
  await assertStoreAccess(ctx, req.body.storeId);
  const data = await userService.createStaff(
    { tenantId: ctx.tenantId },
    req.body,
  );
  sendResponse(res, {
    statusCode: 201,
    message: "Staff user created",
    data,
  });
});
