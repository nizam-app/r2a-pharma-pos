import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/AppError";
import { env } from "../config";
import { logger } from "../utils/logger";

type ErrorBody = {
  status: "fail" | "error";
  message: string;
  stack?: string;
};

/**
 * Locked error envelope: `{ status: "fail"|"error", message, ... }`
 * Do not use `{ success: false, error: { code, message } }`.
 */
export function globalError(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : 500;
  const status: "fail" | "error" = isAppError ? err.status : "error";
  const message = isAppError
    ? err.message
    : env.nodeEnv === "production"
      ? "Internal server error"
      : err instanceof Error
        ? err.message
        : "Internal server error";

  if (!isAppError || statusCode >= 500) {
    logger.error({ err }, "request failed");
  } else {
    logger.warn({ err: { message: err.message, statusCode } }, "operational error");
  }

  const body: ErrorBody = { status, message };

  if (env.nodeEnv !== "production" && err instanceof Error && err.stack) {
    body.stack = err.stack;
  }

  res.status(statusCode).json(body);
}
