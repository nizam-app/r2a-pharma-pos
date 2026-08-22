-- M6 Batch BH: StockAudit schema + FEFO violation records.

CREATE TYPE "StockAuditStatus" AS ENUM ('IN_PROGRESS', 'UNDER_REVIEW', 'COMPLETED', 'VARIANCE_FOUND');
CREATE TYPE "StockAuditLineStatus" AS ENUM ('MATCHES', 'DISCREPANCY');
CREATE TYPE "FefoViolationStatus" AS ENUM ('OPEN', 'CORRECTED', 'DISMISSED');
CREATE TYPE "StockAuditActivityType" AS ENUM ('CREATED', 'COUNT_STARTED', 'VARIANCE_DETECTED', 'REVIEWED', 'FEFO_CORRECTED', 'COMPLETED');

CREATE TABLE "StockAudit" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "auditNo" TEXT NOT NULL,
  "status" "StockAuditStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "locationLabel" TEXT NOT NULL,
  "itemsChecked" INTEGER NOT NULL DEFAULT 0,
  "varianceAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "notes" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "createdByUserId" TEXT NOT NULL,
  "reviewedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StockAudit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StockAuditLine" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "auditId" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "systemQty" INTEGER NOT NULL,
  "countedQty" INTEGER NOT NULL,
  "differenceQty" INTEGER NOT NULL,
  "status" "StockAuditLineStatus" NOT NULL,
  "productNameSnapshot" TEXT NOT NULL,
  "batchNumberSnapshot" TEXT NOT NULL,
  "expiryDateSnapshot" DATE NOT NULL,
  "costPerBaseSnapshot" DECIMAL(12,4) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StockAuditLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FefoViolationRecord" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "saleId" TEXT,
  "saleItemId" TEXT,
  "auditId" TEXT,
  "productId" TEXT NOT NULL,
  "skippedBatchId" TEXT NOT NULL,
  "pickedBatchId" TEXT NOT NULL,
  "observedIssue" TEXT NOT NULL,
  "recommendedAction" TEXT NOT NULL,
  "status" "FefoViolationStatus" NOT NULL DEFAULT 'OPEN',
  "correctionNote" TEXT,
  "correctedAt" TIMESTAMP(3),
  "correctedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FefoViolationRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StockAuditActivityEvent" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "auditId" TEXT,
  "actorUserId" TEXT,
  "type" "StockAuditActivityType" NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "StockAuditActivityEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "StockAudit" ADD CONSTRAINT "StockAudit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockAudit" ADD CONSTRAINT "StockAudit_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockAudit" ADD CONSTRAINT "StockAudit_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockAudit" ADD CONSTRAINT "StockAudit_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StockAuditLine" ADD CONSTRAINT "StockAuditLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockAuditLine" ADD CONSTRAINT "StockAuditLine_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "StockAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockAuditLine" ADD CONSTRAINT "StockAuditLine_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockAuditLine" ADD CONSTRAINT "StockAuditLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FefoViolationRecord" ADD CONSTRAINT "FefoViolationRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FefoViolationRecord" ADD CONSTRAINT "FefoViolationRecord_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FefoViolationRecord" ADD CONSTRAINT "FefoViolationRecord_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FefoViolationRecord" ADD CONSTRAINT "FefoViolationRecord_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "SaleItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FefoViolationRecord" ADD CONSTRAINT "FefoViolationRecord_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "StockAudit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FefoViolationRecord" ADD CONSTRAINT "FefoViolationRecord_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FefoViolationRecord" ADD CONSTRAINT "FefoViolationRecord_skippedBatchId_fkey" FOREIGN KEY ("skippedBatchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FefoViolationRecord" ADD CONSTRAINT "FefoViolationRecord_pickedBatchId_fkey" FOREIGN KEY ("pickedBatchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FefoViolationRecord" ADD CONSTRAINT "FefoViolationRecord_correctedByUserId_fkey" FOREIGN KEY ("correctedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StockAuditActivityEvent" ADD CONSTRAINT "StockAuditActivityEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockAuditActivityEvent" ADD CONSTRAINT "StockAuditActivityEvent_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "StockAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockAuditActivityEvent" ADD CONSTRAINT "StockAuditActivityEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "StockAudit_tenantId_auditNo_key" ON "StockAudit"("tenantId", "auditNo");
CREATE INDEX "StockAudit_tenantId_idx" ON "StockAudit"("tenantId");
CREATE INDEX "StockAudit_tenantId_storeId_status_idx" ON "StockAudit"("tenantId", "storeId", "status");
CREATE INDEX "StockAudit_createdByUserId_idx" ON "StockAudit"("createdByUserId");
CREATE INDEX "StockAudit_reviewedByUserId_idx" ON "StockAudit"("reviewedByUserId");

CREATE UNIQUE INDEX "StockAuditLine_auditId_batchId_key" ON "StockAuditLine"("auditId", "batchId");
CREATE INDEX "StockAuditLine_tenantId_idx" ON "StockAuditLine"("tenantId");
CREATE INDEX "StockAuditLine_auditId_idx" ON "StockAuditLine"("auditId");
CREATE INDEX "StockAuditLine_batchId_idx" ON "StockAuditLine"("batchId");
CREATE INDEX "StockAuditLine_productId_idx" ON "StockAuditLine"("productId");

CREATE INDEX "FefoViolationRecord_tenantId_idx" ON "FefoViolationRecord"("tenantId");
CREATE INDEX "FefoViolationRecord_tenantId_storeId_status_idx" ON "FefoViolationRecord"("tenantId", "storeId", "status");
CREATE INDEX "FefoViolationRecord_saleId_idx" ON "FefoViolationRecord"("saleId");
CREATE INDEX "FefoViolationRecord_saleItemId_idx" ON "FefoViolationRecord"("saleItemId");
CREATE INDEX "FefoViolationRecord_auditId_idx" ON "FefoViolationRecord"("auditId");
CREATE INDEX "FefoViolationRecord_productId_idx" ON "FefoViolationRecord"("productId");
CREATE INDEX "FefoViolationRecord_skippedBatchId_idx" ON "FefoViolationRecord"("skippedBatchId");
CREATE INDEX "FefoViolationRecord_pickedBatchId_idx" ON "FefoViolationRecord"("pickedBatchId");
CREATE INDEX "FefoViolationRecord_correctedByUserId_idx" ON "FefoViolationRecord"("correctedByUserId");

CREATE INDEX "StockAuditActivityEvent_tenantId_idx" ON "StockAuditActivityEvent"("tenantId");
CREATE INDEX "StockAuditActivityEvent_auditId_idx" ON "StockAuditActivityEvent"("auditId");
CREATE INDEX "StockAuditActivityEvent_actorUserId_idx" ON "StockAuditActivityEvent"("actorUserId");
