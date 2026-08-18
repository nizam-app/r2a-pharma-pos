-- Web missing features W1: historical sale snapshots and batch integrity foundation.

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('ACTIVE', 'RETIRED', 'VOIDED');
CREATE TYPE "BatchRevisionAction" AS ENUM ('METADATA_CORRECTION', 'PRICE_CORRECTION', 'VOID', 'RETIRE');

-- AlterTable: lifecycle and optimistic concurrency.
ALTER TABLE "Batch"
ADD COLUMN "status" "BatchStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: add nullable snapshots, backfill from the currently referenced rows,
-- then make the required historical display fields non-null.
ALTER TABLE "SaleItem"
ADD COLUMN "productNameAtSale" TEXT,
ADD COLUMN "productGenericNameAtSale" TEXT,
ADD COLUMN "batchNumberAtSale" TEXT,
ADD COLUMN "expiryDateAtSale" DATE;

UPDATE "SaleItem" AS si
SET
  "productNameAtSale" = p."name",
  "productGenericNameAtSale" = p."genericName",
  "batchNumberAtSale" = b."batchNumber",
  "expiryDateAtSale" = b."expiryDate"
FROM "Product" AS p, "Batch" AS b
WHERE si."productId" = p."id"
  AND si."batchId" = b."id";

ALTER TABLE "SaleItem"
ALTER COLUMN "productNameAtSale" SET NOT NULL,
ALTER COLUMN "batchNumberAtSale" SET NOT NULL,
ALTER COLUMN "expiryDateAtSale" SET NOT NULL;

-- AlterTable: future manual-adjustment idempotency and audit context.
ALTER TABLE "InventoryEvent"
ADD COLUMN "eventId" TEXT,
ADD COLUMN "quantityAfter" INTEGER,
ADD COLUMN "reasonCode" TEXT;

CREATE UNIQUE INDEX "InventoryEvent_eventId_key" ON "InventoryEvent"("eventId");

-- Preserve batch identity in the append-only stock ledger.
ALTER TABLE "InventoryEvent" DROP CONSTRAINT "InventoryEvent_batchId_fkey";
ALTER TABLE "InventoryEvent"
ADD CONSTRAINT "InventoryEvent_batchId_fkey"
FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: immutable before/after batch revisions (written from W3/W4).
CREATE TABLE "BatchRevision" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "action" "BatchRevisionAction" NOT NULL,
  "reason" TEXT NOT NULL,
  "before" JSONB NOT NULL,
  "after" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BatchRevision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BatchRevision_operationId_key" ON "BatchRevision"("operationId");
CREATE INDEX "BatchRevision_tenantId_idx" ON "BatchRevision"("tenantId");
CREATE INDEX "BatchRevision_storeId_idx" ON "BatchRevision"("storeId");
CREATE INDEX "BatchRevision_batchId_createdAt_idx" ON "BatchRevision"("batchId", "createdAt");
CREATE INDEX "BatchRevision_actorUserId_idx" ON "BatchRevision"("actorUserId");

ALTER TABLE "BatchRevision"
ADD CONSTRAINT "BatchRevision_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BatchRevision"
ADD CONSTRAINT "BatchRevision_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BatchRevision"
ADD CONSTRAINT "BatchRevision_batchId_fkey"
FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BatchRevision"
ADD CONSTRAINT "BatchRevision_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Database-level nonnegative invariants for direct SQL/Prisma writes.
ALTER TABLE "Batch"
ADD CONSTRAINT "Batch_quantityOnHand_nonnegative" CHECK ("quantityOnHand" >= 0),
ADD CONSTRAINT "Batch_costPerBase_nonnegative" CHECK ("costPerBase" >= 0),
ADD CONSTRAINT "Batch_sellPerBase_nonnegative" CHECK ("sellPerBase" >= 0),
ADD CONSTRAINT "Batch_version_nonnegative" CHECK ("version" >= 0);
