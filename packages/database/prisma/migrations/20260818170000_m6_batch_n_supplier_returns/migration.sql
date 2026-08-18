CREATE TYPE "BatchReturnStatus" AS ENUM (
  'ELIGIBLE',
  'NOT_ELIGIBLE',
  'MANIFEST_PREPARED'
);

ALTER TABLE "Batch"
  ADD COLUMN "supplierName" TEXT,
  ADD COLUMN "returnStatus" "BatchReturnStatus" NOT NULL DEFAULT 'NOT_ELIGIBLE';
