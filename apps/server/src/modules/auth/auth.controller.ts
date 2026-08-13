import type { Request, Response } from "express";
import * as authService from "./auth.service";
import { catchAsync, sendResponse } from "../../utils";

export const register = catchAsync(async (req: Request, res: Response) => {
  const data = await authService.register(req.body);
  sendResponse(res, {
    statusCode: 201,
    message: "Account created",
    data,
  });
});

export const login = catchAsync(async (req: Request, res: Response) => {
  const data = await authService.login(req.body);
  sendResponse(res, {
    statusCode: 200,
    message: "Logged in",
    data,
  });
});

export const refresh = catchAsync(async (req: Request, res: Response) => {
  const data = await authService.refresh(req.body);
  sendResponse(res, {
    statusCode: 200,
    message: "Token refreshed",
    data,
  });
});

export const logout = catchAsync(async (req: Request, res: Response) => {
  await authService.logout(req.body);
  sendResponse(res, {
    statusCode: 200,
    message: "Logged out",
  });
});
