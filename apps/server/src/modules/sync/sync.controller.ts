import type { Request, Response } from "express";
import { catchAsync, sendResponse } from "../../utils";
import { requireTenantContext } from "../../utils/tenant";
import * as syncService from "./sync.service";

export const ingest = catchAsync(async (req: Request, res: Response) => {
  const ctx = requireTenantContext(req);
  const data = await syncService.ingestSyncBatch(ctx, req.body);

  sendResponse(res, {
    statusCode: 200,
    message: "Sync ingest processed",
    data,
  });
});
