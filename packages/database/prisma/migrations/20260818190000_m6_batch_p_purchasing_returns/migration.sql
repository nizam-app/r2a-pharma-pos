-- M6 Batch P: additive supplier, purchasing, GRN, and supplier-return foundation.

CREATE TYPE "SupplierStatus" AS ENUM ('ACTIVE', 'HOLD', 'DRAFT');
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED');
CREATE TYPE "GoodsReceiptStatus" AS ENUM ('CONFIRMED');
CREATE TYPE "ReturnManifestStatus" AS ENUM ('PREPARED', 'DISPATCHED', 'ACCEPTED', 'REJECTED', 'COMPLETED');

CREATE TABLE "Supplier" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "contactPerson" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "email" TEXT,
  "address" TEXT,
  "city" TEXT,
  "registrationNumber" TEXT,
  "notes" TEXT,
  "paymentTerms" TEXT,
  "leadTimeDays" INTEGER,
  "minOrderValue" DECIMAL(12,2),
  "status" "SupplierStatus" NOT NULL DEFAULT 'ACTIVE',
  "expiryReturnsAccepted" BOOLEAN NOT NULL DEFAULT false,
  "minDaysBeforeExpiry" INTEGER,
  "returnNotes" TEXT,
  "preferredContact" TEXT,
  "secondaryPhone" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Supplier_leadTimeDays_nonnegative" CHECK ("leadTimeDays" IS NULL OR "leadTimeDays" >= 0),
  CONSTRAINT "Supplier_minOrderValue_nonnegative" CHECK ("minOrderValue" IS NULL OR "minOrderValue" >= 0),
  CONSTRAINT "Supplier_minDaysBeforeExpiry_nonnegative" CHECK ("minDaysBeforeExpiry" IS NULL OR "minDaysBeforeExpiry" >= 0)
);

CREATE UNIQUE INDEX "Supplier_tenantId_name_key" ON "Supplier"("tenantId", "name");
CREATE UNIQUE INDEX "Supplier_tenantId_registrationNumber_key" ON "Supplier"("tenantId", "registrationNumber");
CREATE INDEX "Supplier_tenantId_idx" ON "Supplier"("tenantId");
CREATE INDEX "Supplier_tenantId_status_idx" ON "Supplier"("tenantId", "status");
CREATE INDEX "Supplier_tenantId_phone_idx" ON "Supplier"("tenantId", "phone");

ALTER TABLE "Batch" ADD COLUMN "supplierId" TEXT;
CREATE INDEX "Batch_supplierId_idx" ON "Batch"("supplierId");

CREATE TABLE "PurchaseOrder" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "poNumber" TEXT NOT NULL,
  "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
  "reference" TEXT,
  "expectedDelivery" DATE,
  "estimatedSubtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "estimatedTax" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "estimatedTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PurchaseOrder_estimatedSubtotal_nonnegative" CHECK ("estimatedSubtotal" >= 0),
  CONSTRAINT "PurchaseOrder_estimatedTax_nonnegative" CHECK ("estimatedTax" >= 0),
  CONSTRAINT "PurchaseOrder_estimatedTotal_nonnegative" CHECK ("estimatedTotal" >= 0)
);

CREATE UNIQUE INDEX "PurchaseOrder_tenantId_poNumber_key" ON "PurchaseOrder"("tenantId", "poNumber");
CREATE INDEX "PurchaseOrder_tenantId_idx" ON "PurchaseOrder"("tenantId");
CREATE INDEX "PurchaseOrder_tenantId_storeId_createdAt_idx" ON "PurchaseOrder"("tenantId", "storeId", "createdAt");
CREATE INDEX "PurchaseOrder_tenantId_supplierId_status_idx" ON "PurchaseOrder"("tenantId", "supplierId", "status");
CREATE INDEX "PurchaseOrder_createdByUserId_idx" ON "PurchaseOrder"("createdByUserId");

CREATE TABLE "PurchaseOrderLine" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "purchaseOrderId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "qtyOrdered" INTEGER NOT NULL,
  "qtyReceived" INTEGER NOT NULL DEFAULT 0,
  "costPerBase" DECIMAL(12,4) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PurchaseOrderLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PurchaseOrderLine_qtyOrdered_positive" CHECK ("qtyOrdered" > 0),
  CONSTRAINT "PurchaseOrderLine_qtyReceived_valid" CHECK ("qtyReceived" >= 0 AND "qtyReceived" <= "qtyOrdered"),
  CONSTRAINT "PurchaseOrderLine_costPerBase_nonnegative" CHECK ("costPerBase" >= 0)
);

CREATE UNIQUE INDEX "PurchaseOrderLine_purchaseOrderId_productId_key" ON "PurchaseOrderLine"("purchaseOrderId", "productId");
CREATE INDEX "PurchaseOrderLine_tenantId_idx" ON "PurchaseOrderLine"("tenantId");
CREATE INDEX "PurchaseOrderLine_productId_idx" ON "PurchaseOrderLine"("productId");

CREATE TABLE "GoodsReceipt" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "purchaseOrderId" TEXT NOT NULL,
  "receivedByUserId" TEXT NOT NULL,
  "grnNumber" TEXT NOT NULL,
  "supplierInvoiceRef" TEXT,
  "deliveryNote" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" "GoodsReceiptStatus" NOT NULL DEFAULT 'CONFIRMED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GoodsReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GoodsReceipt_tenantId_grnNumber_key" ON "GoodsReceipt"("tenantId", "grnNumber");
CREATE INDEX "GoodsReceipt_tenantId_idx" ON "GoodsReceipt"("tenantId");
CREATE INDEX "GoodsReceipt_tenantId_storeId_receivedAt_idx" ON "GoodsReceipt"("tenantId", "storeId", "receivedAt");
CREATE INDEX "GoodsReceipt_purchaseOrderId_idx" ON "GoodsReceipt"("purchaseOrderId");
CREATE INDEX "GoodsReceipt_receivedByUserId_idx" ON "GoodsReceipt"("receivedByUserId");

CREATE TABLE "GoodsReceiptLine" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "goodsReceiptId" TEXT NOT NULL,
  "purchaseOrderLineId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "qty" INTEGER NOT NULL,
  "batchNumber" TEXT NOT NULL,
  "expiryDate" DATE NOT NULL,
  "costPerBase" DECIMAL(12,4) NOT NULL,
  "sellPerBase" DECIMAL(12,4) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GoodsReceiptLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GoodsReceiptLine_qty_positive" CHECK ("qty" > 0),
  CONSTRAINT "GoodsReceiptLine_costPerBase_nonnegative" CHECK ("costPerBase" >= 0),
  CONSTRAINT "GoodsReceiptLine_sellPerBase_nonnegative" CHECK ("sellPerBase" >= 0)
);

CREATE UNIQUE INDEX "GoodsReceiptLine_batchId_key" ON "GoodsReceiptLine"("batchId");
CREATE INDEX "GoodsReceiptLine_tenantId_idx" ON "GoodsReceiptLine"("tenantId");
CREATE INDEX "GoodsReceiptLine_goodsReceiptId_idx" ON "GoodsReceiptLine"("goodsReceiptId");
CREATE INDEX "GoodsReceiptLine_purchaseOrderLineId_idx" ON "GoodsReceiptLine"("purchaseOrderLineId");
CREATE INDEX "GoodsReceiptLine_productId_idx" ON "GoodsReceiptLine"("productId");

CREATE TABLE "ReturnManifest" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "preparedByUserId" TEXT NOT NULL,
  "dispatchedByUserId" TEXT,
  "decidedByUserId" TEXT,
  "completedByUserId" TEXT,
  "srmNumber" TEXT NOT NULL,
  "status" "ReturnManifestStatus" NOT NULL DEFAULT 'PREPARED',
  "preparedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "supplierReference" TEXT,
  "notes" TEXT,
  "dispatchOperationId" TEXT,
  "dispatchReference" TEXT,
  "dispatchNotes" TEXT,
  "dispatchedAt" TIMESTAMP(3),
  "decisionNotes" TEXT,
  "decidedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReturnManifest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReturnManifest_dispatchOperationId_key" ON "ReturnManifest"("dispatchOperationId");
CREATE UNIQUE INDEX "ReturnManifest_tenantId_srmNumber_key" ON "ReturnManifest"("tenantId", "srmNumber");
CREATE INDEX "ReturnManifest_tenantId_idx" ON "ReturnManifest"("tenantId");
CREATE INDEX "ReturnManifest_tenantId_storeId_preparedAt_idx" ON "ReturnManifest"("tenantId", "storeId", "preparedAt");
CREATE INDEX "ReturnManifest_tenantId_supplierId_status_idx" ON "ReturnManifest"("tenantId", "supplierId", "status");
CREATE INDEX "ReturnManifest_preparedByUserId_idx" ON "ReturnManifest"("preparedByUserId");
CREATE INDEX "ReturnManifest_dispatchedByUserId_idx" ON "ReturnManifest"("dispatchedByUserId");
CREATE INDEX "ReturnManifest_decidedByUserId_idx" ON "ReturnManifest"("decidedByUserId");
CREATE INDEX "ReturnManifest_completedByUserId_idx" ON "ReturnManifest"("completedByUserId");

CREATE TABLE "ReturnManifestLine" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "returnManifestId" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "returnQty" INTEGER NOT NULL,
  "costPerBase" DECIMAL(12,4) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReturnManifestLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReturnManifestLine_returnQty_positive" CHECK ("returnQty" > 0),
  CONSTRAINT "ReturnManifestLine_costPerBase_nonnegative" CHECK ("costPerBase" >= 0)
);

CREATE UNIQUE INDEX "ReturnManifestLine_returnManifestId_batchId_key" ON "ReturnManifestLine"("returnManifestId", "batchId");
CREATE INDEX "ReturnManifestLine_tenantId_idx" ON "ReturnManifestLine"("tenantId");
CREATE INDEX "ReturnManifestLine_batchId_idx" ON "ReturnManifestLine"("batchId");

ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_receivedByUserId_fkey" FOREIGN KEY ("receivedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_goodsReceiptId_fkey" FOREIGN KEY ("goodsReceiptId") REFERENCES "GoodsReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_purchaseOrderLineId_fkey" FOREIGN KEY ("purchaseOrderLineId") REFERENCES "PurchaseOrderLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReturnManifest" ADD CONSTRAINT "ReturnManifest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReturnManifest" ADD CONSTRAINT "ReturnManifest_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReturnManifest" ADD CONSTRAINT "ReturnManifest_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReturnManifest" ADD CONSTRAINT "ReturnManifest_preparedByUserId_fkey" FOREIGN KEY ("preparedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReturnManifest" ADD CONSTRAINT "ReturnManifest_dispatchedByUserId_fkey" FOREIGN KEY ("dispatchedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReturnManifest" ADD CONSTRAINT "ReturnManifest_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReturnManifest" ADD CONSTRAINT "ReturnManifest_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReturnManifestLine" ADD CONSTRAINT "ReturnManifestLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReturnManifestLine" ADD CONSTRAINT "ReturnManifestLine_returnManifestId_fkey" FOREIGN KEY ("returnManifestId") REFERENCES "ReturnManifest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReturnManifestLine" ADD CONSTRAINT "ReturnManifestLine_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
