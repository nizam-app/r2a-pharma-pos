import { Router } from "express";
import {
  goodsReceiptCreateSchema,
  purchaseOrderCreateSchema,
  purchaseOrderDraftUpdateSchema,
  purchaseOrderIdParamSchema,
  purchaseOrderListQuerySchema,
  returnManifestCompleteSchema,
  returnManifestCreateSchema,
  returnManifestDecisionSchema,
  returnManifestDispatchSchema,
  returnManifestIdParamSchema,
  returnQueueQuerySchema,
  supplierCreateSchema,
  supplierIdParamSchema,
  supplierListQuerySchema,
  supplierUpdateSchema,
} from "@r2a/shared-types";
import { validate } from "../../middlewares/validate";
import * as purchasingController from "./purchasing.controller";

const purchasingRouter = Router();

purchasingRouter
  .route("/suppliers")
  .get(
    validate({ query: supplierListQuerySchema }),
    purchasingController.listSuppliers,
  )
  .post(
    validate({ body: supplierCreateSchema }),
    purchasingController.createSupplier,
  );

purchasingRouter
  .route("/suppliers/:supplierId")
  .get(
    validate({ params: supplierIdParamSchema }),
    purchasingController.getSupplier,
  )
  .patch(
    validate({ params: supplierIdParamSchema, body: supplierUpdateSchema }),
    purchasingController.updateSupplier,
  );

purchasingRouter
  .route("/purchase-orders")
  .get(
    validate({ query: purchaseOrderListQuerySchema }),
    purchasingController.listPurchaseOrders,
  )
  .post(
    validate({ body: purchaseOrderCreateSchema }),
    purchasingController.createPurchaseOrder,
  );

purchasingRouter
  .route("/purchase-orders/:poId")
  .get(
    validate({ params: purchaseOrderIdParamSchema }),
    purchasingController.getPurchaseOrder,
  )
  .patch(
    validate({
      params: purchaseOrderIdParamSchema,
      body: purchaseOrderDraftUpdateSchema,
    }),
    purchasingController.updateDraftPurchaseOrder,
  );

purchasingRouter.post(
  "/purchase-orders/:poId/receipts",
  validate({
    params: purchaseOrderIdParamSchema,
    body: goodsReceiptCreateSchema,
  }),
  purchasingController.createGoodsReceipt,
);

purchasingRouter.get(
  "/returns/queue",
  validate({ query: returnQueueQuerySchema }),
  purchasingController.listReturnQueue,
);

purchasingRouter.post(
  "/return-manifests",
  validate({ body: returnManifestCreateSchema }),
  purchasingController.createReturnManifest,
);

purchasingRouter.get(
  "/return-manifests/:manifestId",
  validate({ params: returnManifestIdParamSchema }),
  purchasingController.getReturnManifest,
);

purchasingRouter.post(
  "/return-manifests/:manifestId/dispatch",
  validate({
    params: returnManifestIdParamSchema,
    body: returnManifestDispatchSchema,
  }),
  purchasingController.dispatchReturnManifest,
);

purchasingRouter.post(
  "/return-manifests/:manifestId/decision",
  validate({
    params: returnManifestIdParamSchema,
    body: returnManifestDecisionSchema,
  }),
  purchasingController.decideReturnManifest,
);

purchasingRouter.post(
  "/return-manifests/:manifestId/complete",
  validate({
    params: returnManifestIdParamSchema,
    body: returnManifestCompleteSchema,
  }),
  purchasingController.completeReturnManifest,
);

export default purchasingRouter;
