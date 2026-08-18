import { prisma, Prisma } from "@r2a/database";
import type {
  BatchAdjustmentInput,
  BatchCorrectionInput,
  BatchCreateInput,
  BatchLifecycleInput,
  BatchListInput,
  BatchUpdateInput,
} from "@r2a/shared-types";
import { AppError } from "../../utils/AppError";
import { assertStoreAccess } from "../../utils/tenant";
import { serializeBatch } from "../../utils/margin";
import type { TenantContext } from "../../types/tenant";

/** Editor PrismaClient can lag behind generate and omit `inventoryEvent` on `tx`. */
type InventoryEventWriter = {
  create: (args: {
    data: {
      tenantId: string;
      storeId: string;
      productId: string;
      batchId: string;
      actorUserId: string;
      type: "RECEIVE" | "ADJUST" | "SALE";
      quantityBaseChange: number;
      quantityAfter: number;
    };
  }) => Promise<unknown>;
};

function inventoryEventOf(tx: object): InventoryEventWriter {
  return (tx as { inventoryEvent: InventoryEventWriter }).inventoryEvent;
}

function batchSnapshot(batch: {
  batchNumber: string;
  expiryDate: Date;
  quantityOnHand: number;
  costPerBase: { toString(): string } | number;
  sellPerBase: { toString(): string } | number;
  supplierName: string | null;
  returnStatus: "ELIGIBLE" | "NOT_ELIGIBLE" | "MANIFEST_PREPARED";
  status: "ACTIVE" | "RETIRED" | "VOIDED";
  version: number;
}): Prisma.InputJsonObject {
  return {
    batchNumber: batch.batchNumber,
    expiryDate: batch.expiryDate.toISOString().slice(0, 10),
    quantityOnHand: batch.quantityOnHand,
    costPerBase: Number(batch.costPerBase.toString()),
    sellPerBase: Number(batch.sellPerBase.toString()),
    supplierName: batch.supplierName,
    returnStatus: batch.returnStatus,
    status: batch.status,
    version: batch.version,
  };
}

function revisionPublic(revision: {
  id: string;
  operationId: string;
  action: string;
  reason: string;
  before: unknown;
  after: unknown;
  actorUserId: string;
  createdAt: Date;
}) {
  return {
    id: revision.id,
    operationId: revision.operationId,
    action: revision.action,
    reason: revision.reason,
    before: revision.before,
    after: revision.after,
    actorUserId: revision.actorUserId,
    createdAt: revision.createdAt,
  };
}

async function revisionReplay(
  ctx: TenantContext,
  batchId: string,
  operationId: string,
  allowedActions: Array<"METADATA_CORRECTION" | "PRICE_CORRECTION" | "VOID" | "RETIRE">,
) {
  const revision = await prisma.batchRevision.findUnique({
    where: { operationId },
    include: { batch: true },
  });
  if (!revision) return null;
  if (
    revision.tenantId !== ctx.tenantId ||
    revision.batchId !== batchId ||
    !allowedActions.includes(revision.action)
  ) {
    throw new AppError("operationId is already used for another batch operation", 409);
  }
  return {
    batch: serializeBatch(revision.batch, ctx.role),
    revision: revisionPublic(revision),
    idempotent: true,
  };
}

async function adjustmentReplay(
  ctx: TenantContext,
  batchId: string,
  eventId: string,
  input: BatchAdjustmentInput,
) {
  const event = await prisma.inventoryEvent.findUnique({
    where: { eventId },
    include: { batch: true },
  });
  if (!event) return null;
  if (event.tenantId !== ctx.tenantId || event.batchId !== batchId || !event.batch) {
    throw new AppError("eventId is already used for another adjustment", 409);
  }
  if (
    event.type !== "ADJUST" ||
    event.quantityBaseChange !== input.quantityChange ||
    event.reasonCode !== input.reasonCode ||
    event.note !== (input.note ?? null)
  ) {
    throw new AppError("eventId is already used with a different adjustment", 409);
  }
  return {
    batch: serializeBatch(event.batch, ctx.role),
    event,
    idempotent: true,
  };
}

function isP2002(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "P2002",
  );
}

export async function createBatch(ctx: TenantContext, input: BatchCreateInput) {
  const storeId = input.storeId ?? ctx.storeId;
  if (!storeId) {
    throw new AppError("storeId is required (or assign a store on the user)", 400);
  }
  await assertStoreAccess(ctx, storeId);

  const product = await prisma.product.findFirst({
    where: { id: input.productId, tenantId: ctx.tenantId },
  });
  if (!product) {
    throw new AppError("Product not found", 404);
  }

  try {
    const batch = await prisma.$transaction(async (tx) => {
      const created = await tx.batch.create({
        data: {
          tenantId: ctx.tenantId,
          storeId,
          productId: input.productId,
          batchNumber: input.batchNumber,
          expiryDate: input.expiryDate,
          quantityOnHand: input.quantityOnHand,
          costPerBase: input.costPerBase,
          sellPerBase: input.sellPerBase,
          supplierName: input.supplierName,
          returnStatus: input.returnStatus,
        },
      });
      await inventoryEventOf(tx).create({
        data: {
          tenantId: ctx.tenantId,
          storeId,
          productId: input.productId,
          batchId: created.id,
          actorUserId: ctx.userId,
          type: "RECEIVE",
          quantityBaseChange: input.quantityOnHand,
          quantityAfter: input.quantityOnHand,
        },
      });
      return created;
    });
    return serializeBatch(batch, ctx.role);
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      throw new AppError("Batch number already exists for this product/store", 409);
    }
    throw err;
  }
}

export async function updateBatch(
  ctx: TenantContext,
  batchId: string,
  input: BatchUpdateInput,
) {
  const existing = await prisma.batch.findFirst({
    where: { id: batchId, tenantId: ctx.tenantId },
  });
  if (!existing) {
    throw new AppError("Batch not found", 404);
  }
  if (existing.status !== "ACTIVE") {
    throw new AppError(`Cannot update a ${existing.status.toLowerCase()} batch`, 409);
  }

  try {
    const batch = await prisma.$transaction(async (tx) => {
      const updatedCount = await tx.batch.updateMany({
        where: { id: batchId, tenantId: ctx.tenantId, status: "ACTIVE" },
        data: {
          batchNumber: input.batchNumber,
          expiryDate: input.expiryDate,
          costPerBase: input.costPerBase,
          sellPerBase: input.sellPerBase,
          supplierName: input.supplierName,
          returnStatus: input.returnStatus,
          version: { increment: 1 },
        },
      });
      if (updatedCount.count !== 1) {
        throw new AppError("Cannot update a non-active batch", 409);
      }
      const updated = await tx.batch.findUniqueOrThrow({ where: { id: batchId } });
      return updated;
    });
    return serializeBatch(batch, ctx.role);
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      throw new AppError("Batch number already exists for this product/store", 409);
    }
    throw err;
  }
}

export async function getBatch(ctx: TenantContext, batchId: string) {
  const batch = await prisma.batch.findFirst({
    where: { id: batchId, tenantId: ctx.tenantId },
  });
  if (!batch) {
    throw new AppError("Batch not found", 404);
  }
  return serializeBatch(batch, ctx.role);
}

export async function listBatches(ctx: TenantContext, query: BatchListInput) {
  if (query.storeId) {
    await assertStoreAccess(ctx, query.storeId);
  }

  const where = {
    tenantId: ctx.tenantId,
    status: "ACTIVE" as const,
    ...(query.productId ? { productId: query.productId } : {}),
    ...(query.storeId
      ? { storeId: query.storeId }
      : ctx.role === "CASHIER" && ctx.storeId
        ? { storeId: ctx.storeId }
        : {}),
  };

  const [items, total] = await Promise.all([
    prisma.batch.findMany({
      where,
      orderBy: [{ expiryDate: "asc" }, { id: "asc" }],
      take: query.limit,
      skip: query.offset,
    }),
    prisma.batch.count({ where }),
  ]);

  return {
    items: items.map((b) => serializeBatch(b, ctx.role)),
    total,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function correctBatch(
  ctx: TenantContext,
  batchId: string,
  input: BatchCorrectionInput,
) {
  const correctionActions = [
    "METADATA_CORRECTION",
    "PRICE_CORRECTION",
  ] as const;
  const replay = await revisionReplay(ctx, batchId, input.operationId, [
    ...correctionActions,
  ]);
  if (replay) return replay;

  const scoped = await prisma.batch.findFirst({
    where: { id: batchId, tenantId: ctx.tenantId },
    select: { storeId: true },
  });
  if (!scoped) throw new AppError("Batch not found", 404);
  await assertStoreAccess(ctx, scoped.storeId);

  try {
    return await prisma.$transaction(async (tx) => {
      const current = await tx.batch.findFirst({
        where: { id: batchId, tenantId: ctx.tenantId },
      });
      if (!current) throw new AppError("Batch not found", 404);
      if (current.status !== "ACTIVE") {
        throw new AppError(`Cannot correct a ${current.status.toLowerCase()} batch`, 409);
      }
      if (current.version !== input.expectedVersion) {
        throw new AppError("Batch changed since it was loaded", 409);
      }

      const expiryChanged =
        input.expiryDate !== undefined &&
        input.expiryDate.getTime() !== current.expiryDate.getTime();
      const batchNumberChanged =
        input.batchNumber !== undefined && input.batchNumber !== current.batchNumber;
      const costChanged =
        input.costPerBase !== undefined &&
        input.costPerBase !== Number(current.costPerBase.toString());
      const sellChanged =
        input.sellPerBase !== undefined &&
        input.sellPerBase !== Number(current.sellPerBase.toString());
      const supplierChanged =
        input.supplierName !== undefined && input.supplierName !== current.supplierName;
      const returnStatusChanged =
        input.returnStatus !== undefined && input.returnStatus !== current.returnStatus;
      if (
        !expiryChanged &&
        !batchNumberChanged &&
        !costChanged &&
        !sellChanged &&
        !supplierChanged &&
        !returnStatusChanged
      ) {
        throw new AppError("Correction does not change any batch field", 400);
      }

      const updatedCount = await tx.batch.updateMany({
        where: {
          id: batchId,
          tenantId: ctx.tenantId,
          version: input.expectedVersion,
        },
        data: {
          batchNumber: input.batchNumber,
          expiryDate: input.expiryDate,
          costPerBase: input.costPerBase,
          sellPerBase: input.sellPerBase,
          supplierName: input.supplierName,
          returnStatus: input.returnStatus,
          version: { increment: 1 },
        },
      });
      if (updatedCount.count !== 1) {
        throw new AppError("Batch changed since it was loaded", 409);
      }
      const updated = await tx.batch.findUniqueOrThrow({ where: { id: batchId } });
      const revision = await tx.batchRevision.create({
        data: {
          tenantId: ctx.tenantId,
          storeId: current.storeId,
          batchId,
          actorUserId: ctx.userId,
          operationId: input.operationId,
          action:
            expiryChanged || batchNumberChanged || supplierChanged || returnStatusChanged
              ? "METADATA_CORRECTION"
              : "PRICE_CORRECTION",
          reason: input.reason,
          before: batchSnapshot(current),
          after: batchSnapshot(updated),
        },
      });
      return {
        batch: serializeBatch(updated, ctx.role),
        revision: revisionPublic(revision),
        idempotent: false,
      };
    });
  } catch (error: unknown) {
    if (isP2002(error)) {
      const raced = await revisionReplay(ctx, batchId, input.operationId, [
        ...correctionActions,
      ]);
      if (raced) return raced;
      throw new AppError("Batch number already exists for this product/store", 409);
    }
    throw error;
  }
}

export async function adjustBatch(
  ctx: TenantContext,
  batchId: string,
  input: BatchAdjustmentInput,
) {
  const scoped = await prisma.batch.findFirst({
    where: { id: batchId, tenantId: ctx.tenantId },
    select: { storeId: true },
  });
  if (!scoped) throw new AppError("Batch not found", 404);
  await assertStoreAccess(ctx, scoped.storeId);

  const replay = await adjustmentReplay(ctx, batchId, input.eventId, input);
  if (replay) return replay;

  try {
    return await prisma.$transaction(async (tx) => {
      const current = await tx.batch.findFirst({
        where: { id: batchId, tenantId: ctx.tenantId },
      });
      if (!current) throw new AppError("Batch not found", 404);
      if (current.status !== "ACTIVE") {
        throw new AppError(`Cannot adjust a ${current.status.toLowerCase()} batch`, 409);
      }
      if (current.version !== input.expectedVersion) {
        throw new AppError("Batch changed since it was loaded", 409);
      }

      const updatedCount = await tx.batch.updateMany({
        where: {
          id: batchId,
          tenantId: ctx.tenantId,
          version: input.expectedVersion,
          ...(input.quantityChange < 0
            ? { quantityOnHand: { gte: -input.quantityChange } }
            : {}),
        },
        data: {
          quantityOnHand: { increment: input.quantityChange },
          version: { increment: 1 },
        },
      });
      if (updatedCount.count !== 1) {
        const latest = await tx.batch.findFirst({
          where: { id: batchId, tenantId: ctx.tenantId },
          select: { version: true, quantityOnHand: true },
        });
        if (!latest || latest.version !== input.expectedVersion) {
          throw new AppError("Batch changed since it was loaded", 409);
        }
        throw new AppError("Adjustment would make stock negative", 409);
      }

      const updated = await tx.batch.findUniqueOrThrow({ where: { id: batchId } });
      const event = await tx.inventoryEvent.create({
        data: {
          tenantId: ctx.tenantId,
          storeId: current.storeId,
          productId: current.productId,
          batchId,
          actorUserId: ctx.userId,
          eventId: input.eventId,
          type: "ADJUST",
          quantityBaseChange: input.quantityChange,
          quantityAfter: updated.quantityOnHand,
          reasonCode: input.reasonCode,
          note: input.note,
        },
      });
      return {
        batch: serializeBatch(updated, ctx.role),
        event,
        idempotent: false,
      };
    });
  } catch (error: unknown) {
    if (
      isP2002(error) ||
      (error instanceof AppError && error.statusCode === 409)
    ) {
      const raced = await adjustmentReplay(ctx, batchId, input.eventId, input);
      if (raced) return raced;
    }
    throw error;
  }
}

type LifecycleAction = "VOID" | "RETIRE";
type LifecycleStatus = "VOIDED" | "RETIRED";

async function changeBatchLifecycle(
  ctx: TenantContext,
  batchId: string,
  input: BatchLifecycleInput,
  action: LifecycleAction,
  status: LifecycleStatus,
) {
  const replay = await revisionReplay(ctx, batchId, input.operationId, [action]);
  if (replay) {
    const event = await prisma.inventoryEvent.findUnique({
      where: { eventId: input.operationId },
    });
    if (!event || event.tenantId !== ctx.tenantId || event.batchId !== batchId) {
      throw new AppError("Lifecycle inventory event is missing", 409);
    }
    return { ...replay, event };
  }

  const usedEvent = await prisma.inventoryEvent.findUnique({
    where: { eventId: input.operationId },
    select: { id: true },
  });
  if (usedEvent) {
    throw new AppError("operationId is already used for another inventory event", 409);
  }

  const scoped = await prisma.batch.findFirst({
    where: { id: batchId, tenantId: ctx.tenantId },
    select: { storeId: true },
  });
  if (!scoped) throw new AppError("Batch not found", 404);
  await assertStoreAccess(ctx, scoped.storeId);

  try {
    return await prisma.$transaction(async (tx) => {
      const current = await tx.batch.findFirst({
        where: { id: batchId, tenantId: ctx.tenantId },
        include: { _count: { select: { saleItems: true } } },
      });
      if (!current) throw new AppError("Batch not found", 404);
      if (current.version !== input.expectedVersion) {
        throw new AppError("Batch changed since it was loaded", 409);
      }
      if (current.status !== "ACTIVE") {
        throw new AppError(`Batch is already ${current.status.toLowerCase()}`, 409);
      }
      if (action === "VOID" && current._count.saleItems > 0) {
        throw new AppError("A sold batch cannot be voided; retire it instead", 409);
      }

      const updatedCount = await tx.batch.updateMany({
        where: {
          id: batchId,
          tenantId: ctx.tenantId,
          status: "ACTIVE",
          version: input.expectedVersion,
        },
        data: {
          quantityOnHand: 0,
          status,
          version: { increment: 1 },
        },
      });
      if (updatedCount.count !== 1) {
        throw new AppError("Batch changed since it was loaded", 409);
      }

      const updated = await tx.batch.findUniqueOrThrow({ where: { id: batchId } });
      const event = await tx.inventoryEvent.create({
        data: {
          tenantId: ctx.tenantId,
          storeId: current.storeId,
          productId: current.productId,
          batchId,
          actorUserId: ctx.userId,
          eventId: input.operationId,
          type: "ADJUST",
          quantityBaseChange: -current.quantityOnHand,
          quantityAfter: 0,
          reasonCode: action === "VOID" ? "BATCH_VOID" : "BATCH_RETIRE",
          note: input.reason,
        },
      });
      const revision = await tx.batchRevision.create({
        data: {
          tenantId: ctx.tenantId,
          storeId: current.storeId,
          batchId,
          actorUserId: ctx.userId,
          operationId: input.operationId,
          action,
          reason: input.reason,
          before: batchSnapshot(current),
          after: batchSnapshot(updated),
        },
      });
      return {
        batch: serializeBatch(updated, ctx.role),
        event,
        revision: revisionPublic(revision),
        idempotent: false,
      };
    });
  } catch (error: unknown) {
    if (isP2002(error)) {
      const raced = await revisionReplay(ctx, batchId, input.operationId, [action]);
      if (raced) {
        const event = await prisma.inventoryEvent.findUniqueOrThrow({
          where: { eventId: input.operationId },
        });
        return { ...raced, event };
      }
      throw new AppError("operationId is already used for another batch operation", 409);
    }
    throw error;
  }
}

export function voidBatch(
  ctx: TenantContext,
  batchId: string,
  input: BatchLifecycleInput,
) {
  return changeBatchLifecycle(ctx, batchId, input, "VOID", "VOIDED");
}

export function retireBatch(
  ctx: TenantContext,
  batchId: string,
  input: BatchLifecycleInput,
) {
  return changeBatchLifecycle(ctx, batchId, input, "RETIRE", "RETIRED");
}
