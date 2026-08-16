-- Milestone 6 Batch C: Sale/SaleItem/Product extras + InventoryEvent ledger.
-- Additive only — ingest behavior unchanged (receiptNo / cost snapshot filled in Batch D).

-- CreateEnum
CREATE TYPE "InventoryEventType" AS ENUM ('RECEIVE', 'ADJUST', 'SALE');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "category" TEXT,
ADD COLUMN     "coldChain" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reorderLevel" INTEGER,
ADD COLUMN     "requiresPrescription" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "storageNotes" TEXT;

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "loyaltyEarned" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "loyaltyPrevious" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "loyaltyUsed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "receiptNo" TEXT;

-- AlterTable
ALTER TABLE "SaleItem" ADD COLUMN     "costPerBaseAtSale" DECIMAL(12,4),
ADD COLUMN     "fefoAuthorizedByName" TEXT,
ADD COLUMN     "fefoOverride" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "InventoryEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchId" TEXT,
    "saleId" TEXT,
    "actorUserId" TEXT,
    "type" "InventoryEventType" NOT NULL,
    "quantityBaseChange" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryEvent_tenantId_idx" ON "InventoryEvent"("tenantId");

-- CreateIndex
CREATE INDEX "InventoryEvent_saleId_idx" ON "InventoryEvent"("saleId");

-- CreateIndex
CREATE INDEX "InventoryEvent_productId_idx" ON "InventoryEvent"("productId");

-- CreateIndex
CREATE INDEX "InventoryEvent_storeId_idx" ON "InventoryEvent"("storeId");

-- CreateIndex
CREATE INDEX "InventoryEvent_batchId_idx" ON "InventoryEvent"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_tenantId_receiptNo_key" ON "Sale"("tenantId", "receiptNo");

-- AddForeignKey
ALTER TABLE "InventoryEvent" ADD CONSTRAINT "InventoryEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryEvent" ADD CONSTRAINT "InventoryEvent_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryEvent" ADD CONSTRAINT "InventoryEvent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryEvent" ADD CONSTRAINT "InventoryEvent_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryEvent" ADD CONSTRAINT "InventoryEvent_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryEvent" ADD CONSTRAINT "InventoryEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
