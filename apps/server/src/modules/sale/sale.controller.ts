import type { Request, Response } from "express";
import { catchAsync, sendResponse } from "../../utils";
import { requireTenantContext } from "../../utils/tenant";
import * as saleService from "./sale.service";

export const ingest = catchAsync(async (req: Request, res: Response) => {
  const ctx = requireTenantContext(req);
  const result = await saleService.ingestSale(ctx, req.body);

  if (result.idempotent) {
    sendResponse(res, {
      statusCode: 200,
      message: "Sale already ingested",
      data: result.sale,
      meta: { idempotent: true },
    });
    return;
  }

  sendResponse(res, {
    statusCode: 201,
    message: "Sale ingested",
    data: result.sale,
    meta: { idempotent: false },
  });
});
