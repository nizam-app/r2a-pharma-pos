/**
 * Owner Web Missing Features W1 smoke — data-integrity source guards.
 * Run: npm run smoke:web-w1 -w @r2a/server
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../../..");

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function checkSchema(): void {
  const schema = read("packages/database/prisma/schema.prisma");
  for (const fragment of [
    "enum BatchStatus",
    "ACTIVE",
    "RETIRED",
    "VOIDED",
    "version        Int",
    "productNameAtSale String",
    "productGenericNameAtSale String?",
    "batchNumberAtSale String",
    "expiryDateAtSale DateTime @db.Date",
    "eventId              String?             @unique",
    "quantityAfter        Int?",
    "reasonCode           String?",
    "model BatchRevision",
    "operationId String              @unique",
    "before      Json",
    "after       Json",
  ]) {
    assert(schema.includes(fragment), `Prisma schema missing: ${fragment}`);
  }
  assert(
    schema.includes("batch     Batch?  @relation(fields: [batchId], references: [id], onDelete: Restrict)"),
    "InventoryEvent → Batch must use onDelete: Restrict",
  );
  console.log("  ✓ Prisma lifecycle, snapshots, event metadata, and BatchRevision");
}

function checkMigration(): void {
  const migration = read(
    "packages/database/prisma/migrations/20260818120000_web_missing_w1_data_integrity/migration.sql",
  );
  for (const fragment of [
    'CREATE TYPE "BatchStatus"',
    'UPDATE "SaleItem" AS si',
    'ALTER COLUMN "productNameAtSale" SET NOT NULL',
    'CREATE TABLE "BatchRevision"',
    'ON DELETE RESTRICT',
    'CHECK ("quantityOnHand" >= 0)',
    'CHECK ("costPerBase" >= 0)',
    'CHECK ("sellPerBase" >= 0)',
    'CHECK ("version" >= 0)',
  ]) {
    assert(migration.includes(fragment), `Migration missing: ${fragment}`);
  }
  console.log("  ✓ additive migration backfills snapshots and adds DB constraints");
}

function checkWritersAndReaders(): void {
  const sale = read("apps/server/src/modules/sale/sale.service.ts");
  const batch = read("apps/server/src/modules/batch/batch.service.ts");

  for (const fragment of [
    "productNameAtSale: batch.product.name",
    "productGenericNameAtSale: batch.product.genericName",
    "batchNumberAtSale: batch.batchNumber",
    "expiryDateAtSale: batch.expiryDate",
    "name: line.productNameAtSale",
    "genericName: line.productGenericNameAtSale",
    "batchNumber: line.batchNumberAtSale",
    "expiryDate: line.expiryDateAtSale",
    "quantityAfter: batch.quantityOnHand",
    "version: { increment: 1 }",
  ]) {
    assert(sale.includes(fragment), `Sale ingest/read missing: ${fragment}`);
  }
  assert(
    batch.includes("quantityAfter: input.quantityOnHand") &&
      batch.includes("quantityAfter: updated.quantityOnHand") &&
      batch.includes("version: { increment: 1 }"),
    "Batch receive/adjust writers must store quantityAfter and increment version",
  );
  console.log("  ✓ ingest snapshots; sale reads snapshots; stock writers record resulting qty");
}

function main(): void {
  console.log("Web missing features W1 smoke\n");
  checkSchema();
  checkMigration();
  checkWritersAndReaders();
  console.log("\nPASS");
}

try {
  main();
} catch (error) {
  console.error("\nFAIL:", error instanceof Error ? error.message : error);
  process.exit(1);
}
