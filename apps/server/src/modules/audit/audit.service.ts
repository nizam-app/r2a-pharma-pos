import { prisma, Prisma } from "@r2a/database";
import type {
  FefoViolationCorrectInput,
  OwnerAuditListQuery,
  StockAuditLinesSubmitInput,
  StockAuditReviewInput,
  StockAuditStartInput,
  StockAuditSubmitInput,
} from "@r2a/shared-types";
import { AppError } from "../../utils/AppError";
import { assertStoreAccess } from "../../utils/tenant";
import type { TenantContext } from "../../types/tenant";

function toNumber(value: { toString(): string } | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === "number" ? value : Number(value.toString());
}

async function resolveStoreId(ctx: TenantContext, storeId?: string): Promise<string> {
  const resolved = storeId ?? ctx.storeId;
  if (resolved) {
    await assertStoreAccess(ctx, resolved);
    return resolved;
  }

  const store = await prisma.store.findFirst({
    where: { tenantId: ctx.tenantId, isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!store) throw new AppError("Store context required", 400);
  return store.id;
}

function todayPrefix(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
}

async function nextAuditNo(tenantId: string): Promise<string> {
  const prefix = `AUD-${todayPrefix()}`;
  const count = await prisma.stockAudit.count({
    where: { tenantId, auditNo: { startsWith: prefix } },
  });
  return `${prefix}-${String(count + 1).padStart(3, "0")}`;
}

const auditDetailInclude = {
  store: { select: { id: true, name: true, code: true } },
  createdBy: { select: { id: true, name: true, role: true } },
  reviewedBy: { select: { id: true, name: true, role: true } },
  lines: { orderBy: { createdAt: "asc" } },
  activity: {
    orderBy: { createdAt: "asc" },
    include: { actor: { select: { id: true, name: true, role: true } } },
  },
  fefoViolations: {
    orderBy: { createdAt: "desc" },
    include: {
      product: { select: { id: true, name: true, genericName: true, sku: true } },
      skippedBatch: { select: { id: true, batchNumber: true, expiryDate: true } },
      pickedBatch: { select: { id: true, batchNumber: true, expiryDate: true } },
    },
  },
} satisfies Prisma.StockAuditInclude;

type AuditDetail = Prisma.StockAuditGetPayload<{ include: typeof auditDetailInclude }>;

function serializeAudit(audit: AuditDetail) {
  return {
    ...audit,
    varianceAmount: toNumber(audit.varianceAmount),
    lines: audit.lines.map((line) => ({
      ...line,
      costPerBaseSnapshot: toNumber(line.costPerBaseSnapshot),
    })),
  };
}

export async function getDashboard(ctx: TenantContext) {
  const storeFilter = ctx.storeId ? { storeId: ctx.storeId } : {};
  const where = { tenantId: ctx.tenantId, ...storeFilter };
  const [statusRows, openFefo, correctedFefo, recentAudits, activity] = await Promise.all([
    prisma.stockAudit.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
      _sum: { varianceAmount: true, itemsChecked: true },
    }),
    prisma.fefoViolationRecord.count({ where: { ...where, status: "OPEN" } }),
    prisma.fefoViolationRecord.count({ where: { ...where, status: "CORRECTED" } }),
    prisma.stockAudit.findMany({
      where,
      include: {
        store: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { startedAt: "desc" },
      take: 5,
    }),
    prisma.stockAuditActivityEvent.findMany({
      where: {
        tenantId: ctx.tenantId,
        ...(ctx.storeId ? { audit: { is: { storeId: ctx.storeId } } } : {}),
      },
      include: { actor: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const statusCounts = Object.fromEntries(statusRows.map((row) => [row.status, row._count._all]));
  return {
    kpis: {
      totalAudits: statusRows.reduce((sum, row) => sum + row._count._all, 0),
      inProgress: statusCounts.IN_PROGRESS ?? 0,
      underReview: statusCounts.UNDER_REVIEW ?? 0,
      varianceFound: statusCounts.VARIANCE_FOUND ?? 0,
      completed: statusCounts.COMPLETED ?? 0,
      itemsChecked: statusRows.reduce((sum, row) => sum + (row._sum.itemsChecked ?? 0), 0),
      varianceAmount: statusRows.reduce((sum, row) => sum + toNumber(row._sum.varianceAmount), 0),
      openFefoViolations: openFefo,
      correctedFefoViolations: correctedFefo,
    },
    recentAudits: recentAudits.map((audit) => ({
      ...audit,
      varianceAmount: toNumber(audit.varianceAmount),
    })),
    activity,
  };
}

export async function listAudits(ctx: TenantContext, query: OwnerAuditListQuery) {
  const where: Prisma.StockAuditWhereInput = {
    tenantId: ctx.tenantId,
    ...(ctx.storeId ? { storeId: ctx.storeId } : {}),
  };
  if (query.status) where.status = query.status;
  if (query.from || query.to) {
    where.startedAt = {};
    if (query.from) where.startedAt.gte = query.from;
    if (query.to) where.startedAt.lte = query.to;
  }
  if (query.q) {
    where.OR = [
      { auditNo: { contains: query.q, mode: "insensitive" } },
      { locationLabel: { contains: query.q, mode: "insensitive" } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.stockAudit.findMany({
      where,
      include: {
        store: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
      orderBy: { startedAt: "desc" },
      take: query.limit,
      skip: query.offset,
    }),
    prisma.stockAudit.count({ where }),
  ]);

  return {
    items: items.map((audit) => ({ ...audit, varianceAmount: toNumber(audit.varianceAmount) })),
    total,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function getAudit(ctx: TenantContext, auditId: string) {
  const audit = await prisma.stockAudit.findFirst({
    where: {
      id: auditId,
      tenantId: ctx.tenantId,
      ...(ctx.storeId ? { storeId: ctx.storeId } : {}),
    },
    include: auditDetailInclude,
  });
  if (!audit) throw new AppError("Audit not found", 404);
  return serializeAudit(audit);
}

export async function reviewAudit(
  ctx: TenantContext,
  auditId: string,
  input: StockAuditReviewInput,
) {
  const audit = await prisma.stockAudit.findFirst({
    where: { id: auditId, tenantId: ctx.tenantId, ...(ctx.storeId ? { storeId: ctx.storeId } : {}) },
    select: { id: true, status: true },
  });
  if (!audit) throw new AppError("Audit not found", 404);
  if (audit.status !== "UNDER_REVIEW" && audit.status !== "VARIANCE_FOUND") {
    throw new AppError("Only submitted or variance audits can be reviewed", 409);
  }

  await prisma.$transaction(async (tx) => {
    await tx.stockAudit.update({
      where: { id: audit.id },
      data: {
        status: input.decision === "COMPLETE" ? "COMPLETED" : "VARIANCE_FOUND",
        reviewedAt: new Date(),
        reviewedByUserId: ctx.userId,
        notes: input.notes,
      },
    });
    await tx.stockAuditActivityEvent.create({
      data: {
        tenantId: ctx.tenantId,
        auditId: audit.id,
        actorUserId: ctx.userId,
        type: input.decision === "COMPLETE" ? "COMPLETED" : "REVIEWED",
        note: input.notes ?? `Owner review: ${input.decision}`,
      },
    });
  });

  return getAudit(ctx, audit.id);
}

export async function correctFefoViolation(
  ctx: TenantContext,
  violationId: string,
  input: FefoViolationCorrectInput,
) {
  const violation = await prisma.fefoViolationRecord.findFirst({
    where: {
      id: violationId,
      tenantId: ctx.tenantId,
      ...(ctx.storeId ? { storeId: ctx.storeId } : {}),
    },
    select: { id: true, status: true, auditId: true },
  });
  if (!violation) throw new AppError("FEFO violation not found", 404);
  if (violation.status !== "OPEN") {
    throw new AppError("Only OPEN FEFO violations can be corrected", 409);
  }

  const corrected = await prisma.$transaction(async (tx) => {
    const row = await tx.fefoViolationRecord.update({
      where: { id: violation.id },
      data: {
        status: "CORRECTED",
        correctionNote: input.correctionNote,
        correctedAt: new Date(),
        correctedByUserId: ctx.userId,
      },
    });
    if (violation.auditId) {
      await tx.stockAuditActivityEvent.create({
        data: {
          tenantId: ctx.tenantId,
          auditId: violation.auditId,
          actorUserId: ctx.userId,
          type: "FEFO_CORRECTED",
          note: input.correctionNote,
        },
      });
    }
    return row;
  });

  return corrected;
}

export async function startAudit(ctx: TenantContext, input: StockAuditStartInput) {
  const storeId = await resolveStoreId(ctx, input.storeId);
  const auditNo = await nextAuditNo(ctx.tenantId);
  const audit = await prisma.stockAudit.create({
    data: {
      tenantId: ctx.tenantId,
      storeId,
      auditNo,
      locationLabel: input.locationLabel,
      notes: input.notes,
      createdByUserId: ctx.userId,
      activity: {
        create: [
          {
            tenantId: ctx.tenantId,
            actorUserId: ctx.userId,
            type: "CREATED",
            note: `Audit created for ${input.locationLabel}`,
          },
          {
            tenantId: ctx.tenantId,
            actorUserId: ctx.userId,
            type: "COUNT_STARTED",
            note: "Physical count started",
          },
        ],
      },
    },
  });
  return audit;
}

export async function replaceAuditLines(
  ctx: TenantContext,
  auditId: string,
  input: StockAuditLinesSubmitInput,
) {
  const audit = await prisma.stockAudit.findFirst({
    where: { id: auditId, tenantId: ctx.tenantId, status: "IN_PROGRESS" },
    select: { id: true, storeId: true },
  });
  if (!audit) throw new AppError("In-progress audit not found", 404);
  await assertStoreAccess(ctx, audit.storeId);

  const batchIds = input.lines.map((line) => line.batchId);
  const batches = await prisma.batch.findMany({
    where: { id: { in: batchIds }, tenantId: ctx.tenantId, storeId: audit.storeId },
    include: { product: { select: { id: true, name: true } } },
  });
  if (batches.length !== new Set(batchIds).size) {
    throw new AppError("One or more batches were not found for this store", 404);
  }
  const countedByBatch = new Map(input.lines.map((line) => [line.batchId, line.countedQty]));

  await prisma.$transaction(async (tx) => {
    await tx.stockAuditLine.deleteMany({ where: { auditId: audit.id } });
    await tx.stockAuditLine.createMany({
      data: batches.map((batch) => {
        const countedQty = countedByBatch.get(batch.id) ?? 0;
        const differenceQty = countedQty - batch.quantityOnHand;
        return {
          tenantId: ctx.tenantId,
          auditId: audit.id,
          batchId: batch.id,
          productId: batch.productId,
          systemQty: batch.quantityOnHand,
          countedQty,
          differenceQty,
          status: differenceQty === 0 ? "MATCHES" : "DISCREPANCY",
          productNameSnapshot: batch.product.name,
          batchNumberSnapshot: batch.batchNumber,
          expiryDateSnapshot: batch.expiryDate,
          costPerBaseSnapshot: batch.costPerBase,
        };
      }),
    });
  });

  return getAudit(ctx, audit.id);
}

export async function submitAudit(
  ctx: TenantContext,
  auditId: string,
  input: StockAuditSubmitInput,
) {
  const audit = await prisma.stockAudit.findFirst({
    where: { id: auditId, tenantId: ctx.tenantId, status: "IN_PROGRESS" },
    include: { lines: true },
  });
  if (!audit) throw new AppError("In-progress audit not found", 404);
  await assertStoreAccess(ctx, audit.storeId);
  if (audit.lines.length === 0) throw new AppError("Audit must have at least one line", 400);

  const hasDiscrepancy = audit.lines.some((line) => line.differenceQty !== 0);
  const varianceAmount = audit.lines.reduce(
    (sum, line) => sum + line.differenceQty * toNumber(line.costPerBaseSnapshot),
    0,
  );

  await prisma.$transaction(async (tx) => {
    await tx.stockAudit.update({
      where: { id: audit.id },
      data: {
        status: hasDiscrepancy ? "VARIANCE_FOUND" : "UNDER_REVIEW",
        itemsChecked: audit.lines.length,
        varianceAmount,
        completedAt: new Date(),
        notes: input.notes ?? audit.notes,
      },
    });
    await tx.stockAuditActivityEvent.create({
      data: {
        tenantId: ctx.tenantId,
        auditId: audit.id,
        actorUserId: ctx.userId,
        type: hasDiscrepancy ? "VARIANCE_DETECTED" : "COMPLETED",
        note: input.notes ?? (hasDiscrepancy ? "Audit submitted with variance" : "Audit submitted for review"),
      },
    });
  });

  return getAudit(ctx, audit.id);
}
