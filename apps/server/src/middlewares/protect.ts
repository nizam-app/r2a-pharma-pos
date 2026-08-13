import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { Role } from "@r2a/shared-types";
import { AppError } from "../utils/AppError";
import { verifyAccessToken } from "../utils/jwt";

export const protect: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    next(new AppError("Authentication required", 401));
    return;
  }

  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    next(new AppError("Authentication required", 401));
    return;
  }

  try {
    req.auth = verifyAccessToken(token);
    next();
  } catch (err) {
    next(err);
  }
};

export const restrictTo =
  (...roles: Role[]): RequestHandler =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) {
      next(new AppError("Authentication required", 401));
      return;
    }
    if (!roles.includes(req.auth.role)) {
      next(new AppError("You do not have permission to perform this action", 403));
      return;
    }
    next();
  };
