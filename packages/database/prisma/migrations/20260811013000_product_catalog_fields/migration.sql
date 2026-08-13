-- AlterTable: Product catalog display fields (manufacturer / strength / form)
ALTER TABLE "Product" ADD COLUMN "manufacturer" TEXT;
ALTER TABLE "Product" ADD COLUMN "strength" TEXT;
ALTER TABLE "Product" ADD COLUMN "form" TEXT;

CREATE INDEX "Product_tenantId_manufacturer_idx" ON "Product"("tenantId", "manufacturer");
