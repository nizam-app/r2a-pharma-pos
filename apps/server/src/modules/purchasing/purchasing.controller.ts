import type { Request, Response } from "express";
import type {
  GoodsReceiptCreateInput,
  PurchaseOrderCreateInput,
  PurchaseOrderDraftUpdateInput,
  PurchaseOrderListQuery,
  ReturnManifestCompleteInput,
  ReturnManifestCreateInput,
  ReturnManifestDecisionInput,
  ReturnManifestDispatchInput,
  ReturnQueueQuery,
  SupplierCreateInput,
  SupplierListQuery,
  SupplierUpdateInput,
} from "@r2a/shared-types";
import { catchAsync, sendResponse } from "../../utils";
import { requireTenantContext } from "../../utils/tenant";
import * as purchasingService from "./purchasing.service";

export const listSuppliers = catchAsync(async (req: Request, res: Response) => {
  const result = await purchasingService.listSuppliers(
    requireTenantContext(req),
    req.query as unknown as SupplierListQuery,
  );
  sendResponse(res, {
    statusCode: 200,
    message: "Suppliers retrieved",
    data: result.items,
    meta: {
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      kpis: result.kpis,
      attention: result.attention,
    },
  });
});

export const createSupplier = catchAsync(async (req: Request, res: Response) => {
  const supplier = await purchasingService.createSupplier(
    requireTenantContext(req),
    req.body as SupplierCreateInput,
  );
  sendResponse(res, {
    statusCode: 201,
    message: "Supplier created",
    data: supplier,
  });
});

export const getSupplier = catchAsync(async (req: Request, res: Response) => {
  const supplier = await purchasingService.getSupplier(
    requireTenantContext(req),
    req.params.supplierId!,
  );
  sendResponse(res, {
    statusCode: 200,
    message: "Supplier retrieved",
    data: supplier,
  });
});

export const updateSupplier = catchAsync(async (req: Request, res: Response) => {
  const supplier = await purchasingService.updateSupplier(
    requireTenantContext(req),
    req.params.supplierId!,
    req.body as SupplierUpdateInput,
  );
  sendResponse(res, {
    statusCode: 200,
    message: "Supplier updated",
    data: supplier,
  });
});

export const listPurchaseOrders = catchAsync(
  async (req: Request, res: Response) => {
    const result = await purchasingService.listPurchaseOrders(
      requireTenantContext(req),
      req.query as unknown as PurchaseOrderListQuery,
    );
    sendResponse(res, {
      statusCode: 200,
      message: "Purchase orders retrieved",
      data: result.items,
      meta: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        kpis: result.kpis,
      },
    });
  },
);

export const createPurchaseOrder = catchAsync(
  async (req: Request, res: Response) => {
    const purchaseOrder = await purchasingService.createPurchaseOrder(
      requireTenantContext(req),
      req.body as PurchaseOrderCreateInput,
    );
    sendResponse(res, {
      statusCode: 201,
      message: "Purchase order created",
      data: purchaseOrder,
    });
  },
);

export const getPurchaseOrder = catchAsync(
  async (req: Request, res: Response) => {
    const purchaseOrder = await purchasingService.getPurchaseOrder(
      requireTenantContext(req),
      req.params.poId!,
    );
    sendResponse(res, {
      statusCode: 200,
      message: "Purchase order retrieved",
      data: purchaseOrder,
    });
  },
);

export const updateDraftPurchaseOrder = catchAsync(
  async (req: Request, res: Response) => {
    const purchaseOrder = await purchasingService.updateDraftPurchaseOrder(
      requireTenantContext(req),
      req.params.poId!,
      req.body as PurchaseOrderDraftUpdateInput,
    );
    sendResponse(res, {
      statusCode: 200,
      message: "Purchase order updated",
      data: purchaseOrder,
    });
  },
);

export const createGoodsReceipt = catchAsync(
  async (req: Request, res: Response) => {
    const result = await purchasingService.createGoodsReceipt(
      requireTenantContext(req),
      req.params.poId!,
      req.body as GoodsReceiptCreateInput,
    );
    sendResponse(res, {
      statusCode: 201,
      message: "Goods receipt confirmed",
      data: result,
    });
  },
);

export const listReturnQueue = catchAsync(
  async (req: Request, res: Response) => {
    const result = await purchasingService.listReturnQueue(
      requireTenantContext(req),
      req.query as unknown as ReturnQueueQuery,
    );
    sendResponse(res, {
      statusCode: 200,
      message: "Supplier return queue retrieved",
      data: result.items,
      meta: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        kpis: result.kpis,
        suppliers: result.suppliers,
      },
    });
  },
);

export const createReturnManifest = catchAsync(
  async (req: Request, res: Response) => {
    const manifest = await purchasingService.createReturnManifest(
      requireTenantContext(req),
      req.body as ReturnManifestCreateInput,
    );
    sendResponse(res, {
      statusCode: 201,
      message: "Return manifest prepared",
      data: manifest,
    });
  },
);

export const getReturnManifest = catchAsync(
  async (req: Request, res: Response) => {
    const manifest = await purchasingService.getReturnManifest(
      requireTenantContext(req),
      req.params.manifestId!,
    );
    sendResponse(res, {
      statusCode: 200,
      message: "Return manifest retrieved",
      data: manifest,
    });
  },
);

export const dispatchReturnManifest = catchAsync(
  async (req: Request, res: Response) => {
    const result = await purchasingService.dispatchReturnManifest(
      requireTenantContext(req),
      req.params.manifestId!,
      req.body as ReturnManifestDispatchInput,
    );
    sendResponse(res, {
      statusCode: 200,
      message: result.idempotent
        ? "Return manifest already dispatched"
        : "Return manifest dispatched",
      data: result.manifest,
      meta: { idempotent: result.idempotent },
    });
  },
);

export const decideReturnManifest = catchAsync(
  async (req: Request, res: Response) => {
    const manifest = await purchasingService.decideReturnManifest(
      requireTenantContext(req),
      req.params.manifestId!,
      req.body as ReturnManifestDecisionInput,
    );
    sendResponse(res, {
      statusCode: 200,
      message: "Supplier decision recorded",
      data: manifest,
    });
  },
);

export const completeReturnManifest = catchAsync(
  async (req: Request, res: Response) => {
    const manifest = await purchasingService.completeReturnManifest(
      requireTenantContext(req),
      req.params.manifestId!,
      req.body as ReturnManifestCompleteInput,
    );
    sendResponse(res, {
      statusCode: 200,
      message: "Return manifest completed",
      data: manifest,
    });
  },
);
