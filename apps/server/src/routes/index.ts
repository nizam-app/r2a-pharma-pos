import { Router } from "express";
import { env } from "../config";
import { protect, tenantContext } from "../middlewares";
import { catchAsync, sendResponse } from "../utils";
import { requireTenantContext } from "../utils/tenant";
import authRouter from "../modules/auth/auth.router";
import userRouter from "../modules/user/user.router";
import productRouter from "../modules/product/product.router";
import batchRouter from "../modules/batch/batch.router";
import customerRouter from "../modules/customer/customer.router";
import saleRouter from "../modules/sale/sale.router";
import syncRouter from "../modules/sync/sync.router";

/**
 * `/api/v1` mount — public auth + secured domain routes.
 */
const apiRouter = Router();

apiRouter.get(
  "/health",
  catchAsync(async (_req, res) => {
    sendResponse(res, {
      statusCode: 200,
      message: "OK",
      data: {
        ok: true,
        service: "@r2a/server",
        env: env.nodeEnv,
        timestamp: new Date().toISOString(),
      },
    });
  }),
);

// Public auth (no tenant guard — tokens establish tenant claims)
apiRouter.use("/auth", authRouter);

/**
 * Domain routes: JWT required + tenantId from JWT only.
 */
const domainRouter = Router();
domainRouter.use(protect, tenantContext);

domainRouter.get(
  "/tenant/context",
  catchAsync(async (req, res) => {
    const ctx = requireTenantContext(req);
    sendResponse(res, {
      statusCode: 200,
      message: "OK",
      data: {
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        storeId: ctx.storeId,
        role: ctx.role,
      },
    });
  }),
);

domainRouter.use("/users", userRouter);
domainRouter.use("/products", productRouter);
domainRouter.use("/batches", batchRouter);
domainRouter.use("/customers", customerRouter);
domainRouter.use("/sales", saleRouter);
domainRouter.use("/sync", syncRouter);

apiRouter.use(domainRouter);

export default apiRouter;
