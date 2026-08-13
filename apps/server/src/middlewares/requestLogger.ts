import type { NextFunction, Request, Response } from "express";
import { logger } from "../utils/logger";

/** Lightweight request log (structured JSON via pino). */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const start = Date.now();
  res.on("finish", () => {
    logger.info(
      {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Date.now() - start,
      },
      "request",
    );
  });
  next();
}
