import type { Request, Response } from "express";
import { catchAsync, sendResponse } from "../../utils";
import { assertStoreAccess, requireTenantContext } from "../../utils/tenant";
import { getFefoBatchForProduct, resolveStoreId } from "../../utils/fefo";
import * as productService from "./product.service";
import * as substitutesService from "./substitutes.service";

export const create = catchAsync(async (req: Request, res: Response) => {
  const ctx = requireTenantContext(req);
  const data = await productService.createProduct(ctx, req.body);
  sendResponse(res, { statusCode: 201, message: "Product created", data });
});

export const update = catchAsync(async (req: Request, res: Response) => {
  const ctx = requireTenantContext(req);
  const data = await productService.updateProduct(ctx, req.params.id!, req.body);
  sendResponse(res, { statusCode: 200, message: "Product updated", data });
});

export const getById = catchAsync(async (req: Request, res: Response) => {
  const ctx = requireTenantContext(req);
  const data = await productService.getProduct(ctx, req.params.id!);
  sendResponse(res, { statusCode: 200, message: "OK", data });
});

export const search = catchAsync(async (req: Request, res: Response) => {
  const ctx = requireTenantContext(req);
  const result = await productService.searchProducts(ctx, req.query as never);
  sendResponse(res, {
    statusCode: 200,
    message: "OK",
    data: result.items,
    meta: {
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    },
  });
});

export const fefoBatch = catchAsync(async (req: Request, res: Response) => {
  const ctx = requireTenantContext(req);
  const storeId = resolveStoreId(
    ctx,
    (req.query as { storeId?: string }).storeId,
  );
  await assertStoreAccess(ctx, storeId);
  const data = await getFefoBatchForProduct(
    ctx,
    req.params.productId!,
    storeId,
  );
  sendResponse(res, { statusCode: 200, message: "OK", data });
});

export const substitutes = catchAsync(async (req: Request, res: Response) => {
  const ctx = requireTenantContext(req);
  const storeId = resolveStoreId(
    ctx,
    (req.query as { storeId?: string }).storeId,
  );
  await assertStoreAccess(ctx, storeId);
  const data = await substitutesService.listSubstitutes(
    ctx,
    req.params.productId!,
    storeId,
  );
  sendResponse(res, { statusCode: 200, message: "OK", data });
});
