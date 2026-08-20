-- M6 Batch AE: additive Customer status/source/profile + phone reuse after reject.

CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'PENDING_APPROVAL', 'INACTIVE', 'REJECTED');
CREATE TYPE "CustomerSource" AS ENUM ('OWNER_CREATED', 'POS_REGISTRATION');
CREATE TYPE "CustomerGender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

ALTER TABLE "Customer"
ADD COLUMN "storeId" TEXT,
ADD COLUMN "createdByUserId" TEXT,
ADD COLUMN "dateOfBirth" DATE,
ADD COLUMN "gender" "CustomerGender",
ADD COLUMN "address" TEXT,
ADD COLUMN "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "source" "CustomerSource" NOT NULL DEFAULT 'OWNER_CREATED',
ADD COLUMN "approvedAt" TIMESTAMP(3),
ADD COLUMN "approvedByUserId" TEXT,
ADD COLUMN "rejectedAt" TIMESTAMP(3),
ADD COLUMN "rejectedByUserId" TEXT,
ADD COLUMN "rejectionNote" TEXT;

UPDATE "Customer"
SET "phone" = 'UNSET-' || "id"
WHERE "phone" IS NULL OR btrim("phone") = '';

ALTER TABLE "Customer" ALTER COLUMN "phone" SET NOT NULL;

DROP INDEX "Customer_tenantId_phone_key";

CREATE UNIQUE INDEX "Customer_tenantId_phone_non_rejected_key"
ON "Customer"("tenantId", "phone")
WHERE "status" <> 'REJECTED';

CREATE INDEX "Customer_tenantId_status_idx" ON "Customer"("tenantId", "status");
CREATE INDEX "Customer_tenantId_source_idx" ON "Customer"("tenantId", "source");
CREATE INDEX "Customer_storeId_idx" ON "Customer"("storeId");
CREATE INDEX "Customer_createdByUserId_idx" ON "Customer"("createdByUserId");
CREATE INDEX "Customer_approvedByUserId_idx" ON "Customer"("approvedByUserId");
CREATE INDEX "Customer_rejectedByUserId_idx" ON "Customer"("rejectedByUserId");

ALTER TABLE "Customer"
ADD CONSTRAINT "Customer_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Customer"
ADD CONSTRAINT "Customer_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Customer"
ADD CONSTRAINT "Customer_approvedByUserId_fkey"
FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Customer"
ADD CONSTRAINT "Customer_rejectedByUserId_fkey"
FOREIGN KEY ("rejectedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
