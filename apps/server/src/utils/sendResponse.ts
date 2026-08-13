import type { Response } from "express";

export type SuccessMeta = Record<string, unknown>;

export type SendResponseOptions<T> = {
  statusCode?: number;
  message: string;
  data?: T;
  meta?: SuccessMeta;
};

/**
 * Locked success envelope:
 * `{ status: "success", message, data?, meta? }`
 */
export function sendResponse<T>(
  res: Response,
  { statusCode = 200, message, data, meta }: SendResponseOptions<T>,
): void {
  const body: {
    status: "success";
    message: string;
    data?: T;
    meta?: SuccessMeta;
  } = {
    status: "success",
    message,
  };

  if (data !== undefined) {
    body.data = data;
  }
  if (meta !== undefined) {
    body.meta = meta;
  }

  res.status(statusCode).json(body);
}
