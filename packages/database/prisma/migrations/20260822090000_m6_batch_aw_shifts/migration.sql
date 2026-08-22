-- M6 Batch AW: Shift + ShiftActivityEvent + Sale.shiftId.

CREATE TYPE "ShiftStatus" AS ENUM ('OPEN', 'CLOSED', 'FLAGGED');
CREATE TYPE "ShiftVarianceDecision" AS ENUM ('ACCEPTED_DIFFERENCE', 'COUNT_CORRECTED', 'OTHER');
CREATE TYPE "ShiftActivityType" AS ENUM ('OPENED', 'SALE_RECORDED', 'CLOSE_SUBMITTED', 'VARIANCE_REVIEWED', 'CLOSED');

CREATE TABLE "Shift" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "shiftNo" TEXT NOT NULL,
  "status" "ShiftStatus" NOT NULL DEFAULT 'OPEN',
  "openingFloat" DECIMAL(12,4) NOT NULL,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),
  "countedCash" DECIMAL(12,4),
  "expectedCash" DECIMAL(12,4),
  "variance" DECIMAL(12,4),
  "cashSales" DECIMAL(12,4) NOT NULL DEFAULT 0,
  "cardSales" DECIMAL(12,4) NOT NULL DEFAULT 0,
  "mfsSales" DECIMAL(12,4) NOT NULL DEFAULT 0,
  "txnCount" INTEGER NOT NULL DEFAULT 0,
  "varianceDecision" "ShiftVarianceDecision",
  "varianceNote" TEXT,
  "adjustmentReference" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShiftActivityEvent" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "shiftId" TEXT,
  "type" "ShiftActivityType" NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ShiftActivityEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Sale" ADD COLUMN "shiftId" TEXT;

ALTER TABLE "Shift" ADD CONSTRAINT "Shift_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ShiftActivityEvent" ADD CONSTRAINT "ShiftActivityEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShiftActivityEvent" ADD CONSTRAINT "ShiftActivityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShiftActivityEvent" ADD CONSTRAINT "ShiftActivityEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShiftActivityEvent" ADD CONSTRAINT "ShiftActivityEvent_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Sale" ADD CONSTRAINT "Sale_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Shift_tenantId_shiftNo_key" ON "Shift"("tenantId", "shiftNo");
CREATE INDEX "Shift_tenantId_idx" ON "Shift"("tenantId");
CREATE INDEX "Shift_tenantId_storeId_status_idx" ON "Shift"("tenantId", "storeId", "status");
CREATE INDEX "Shift_userId_idx" ON "Shift"("userId");
CREATE INDEX "ShiftActivityEvent_tenantId_idx" ON "ShiftActivityEvent"("tenantId");
CREATE INDEX "ShiftActivityEvent_tenantId_userId_idx" ON "ShiftActivityEvent"("tenantId", "userId");
CREATE INDEX "ShiftActivityEvent_shiftId_idx" ON "ShiftActivityEvent"("shiftId");
CREATE INDEX "Sale_shiftId_idx" ON "Sale"("shiftId");
