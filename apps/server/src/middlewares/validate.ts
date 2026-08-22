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
 *
 * Replaces `req.query` via defineProperty so coerced values (e.g. limit/offset
 * numbers) stick even when Express exposes query as a getter.
 * Uses `in` checks so a stale/undefined schema import fails loudly instead of
 * silently skipping validation.
 */
export const validate =
  (schemas: ValidateSchemas): RequestHandler =>
  (req: Request, _res: Response, next: NextFunction) => {
    try {
      if ("body" in schemas) {
        if (!schemas.body) {
          throw new AppError(
            "validate: body schema is missing (rebuild @r2a/shared-types?)",
            500,
          );
        }
        const parsed = schemas.body.safeParse(req.body);
        if (!parsed.success) {
          throw new AppError(formatZodError(parsed.error), 400);
        }
        req.body = parsed.data;
      }

      if ("query" in schemas) {
        if (!schemas.query) {
          throw new AppError(
            "validate: query schema is missing (rebuild @r2a/shared-types?)",
            500,
          );
        }
        const parsed = schemas.query.safeParse(req.query);
        if (!parsed.success) {
          throw new AppError(formatZodError(parsed.error), 400);
        }
        Object.defineProperty(req, "query", {
          value: parsed.data,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      }

      if ("params" in schemas) {
        if (!schemas.params) {
          throw new AppError(
            "validate: params schema is missing (rebuild @r2a/shared-types?)",
            500,
          );
        }
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
