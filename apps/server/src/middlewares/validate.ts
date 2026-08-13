import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { ZodTypeAny } from "zod";
import { AppError } from "../utils/AppError";

type ValidateSchemas = {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
};

function formatZodError(error: {
  issues: Array<{ path: (string | number)[]; message: string }>;
}): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
      return `${path}${issue.message}`;
    })
    .join("; ");
}

/**
 * Validate `body` / `query` / `params` with Zod.
 * On failure throws `AppError` (400) for the global error handler.
 */
export const validate =
  (schemas: ValidateSchemas): RequestHandler =>
  (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.body) {
        const parsed = schemas.body.safeParse(req.body);
        if (!parsed.success) {
          throw new AppError(formatZodError(parsed.error), 400);
        }
        req.body = parsed.data;
      }

      if (schemas.query) {
        const parsed = schemas.query.safeParse(req.query);
        if (!parsed.success) {
          throw new AppError(formatZodError(parsed.error), 400);
        }
        // Express typings treat query as IncomingHttpHeaders-like; assign parsed value.
        (req as Request & { query: unknown }).query = parsed.data as Request["query"];
      }

      if (schemas.params) {
        const parsed = schemas.params.safeParse(req.params);
        if (!parsed.success) {
          throw new AppError(formatZodError(parsed.error), 400);
        }
        req.params = parsed.data as Request["params"];
      }

      next();
    } catch (err) {
      next(err);
    }
  };
