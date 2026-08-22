import { Prisma } from "@prisma/client";
import type {
  ShiftOpenInput,
  ShiftCloseInput,
  ShiftResolveInput,
  OwnerShiftListQuery,
  ShiftPaymentBreakdown,
} from "@r2a/shared-types";
import { prisma } from "@r2a/database";
import { AppError } from "../../utils/AppError";
import type { TenantContext } from "../../types/tenant";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function storeScope(ctx: TenantContext): string {
  if (!ctx.storeId) throw new AppError("Store context required", 400);
  return ctx.storeId;
}

function todayPrefix(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

async function nextShiftNo(tenantId: string, storeId: string): Promise<string> {
  const prefix = todayPrefix();
  const count = await prisma.shift.count({
    where: {
      tenantId,
      storeId,
      shiftNo: { startsWith: prefix },
    },
  });
  return `${prefix}-${String(count + 1).padStart(3, "0")}`;
}

async function activeShift(
  tenantId: string,
  storeId: string,
  userId: string,
) {
  return prisma.shift.findFirst({
    where: { tenantId, storeId, userId, status: "OPEN" },
    orderBy: { openedAt: "desc" },
  });
}

/* -------------------------------------------------------------------------- */
/*  Cashier routes                                                             */
/* -------------------------------------------------------------------------- */

export async function openShift(
  ctx: TenantContext,
  input: ShiftOpenInput,
) {
  const storeId = storeScope(ctx);
  const existing = await activeShift(ctx.tenantId, storeId, ctx.userId);
  if (existing) {
    throw new AppError("You already have an open shift for this store", 409);
  }

  const shiftNo = await nextShiftNo(ctx.tenantId, storeId);

  const shift = await prisma.shift.create({
    data: {
      tenantId: ctx.tenantId,
      storeId,
      userId: ctx.userId,
      shiftNo,
      status: "OPEN",
      openingFloat: input.openingFloat,
      cashSales: 0,
      cardSales: 0,
      mfsSales: 0,
      txnCount: 0,
    },
  });

  await prisma.shiftActivityEvent.create({
    data: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      actorUserId: ctx.userId,
      shiftId: shift.id,
      type: "OPENED",
      note: `Shift opened with float ৳${input.openingFloat}`,
    },
  });

  return shift;
}

export async function closeShift(
  ctx: TenantContext,
  input: ShiftCloseInput,
) {
  const storeId = storeScope(ctx);
  const shift = await activeShift(ctx.tenantId, storeId, ctx.userId);
  if (!shift) {
    throw new AppError("No active shift found for your account", 404);
  }

  const variance = Number(
    (input.countedCash - (Number(shift.openingFloat) + Number(shift.cashSales))).toFixed(2),
  );

  const closed = await prisma.shift.update({
    where: { id: shift.id },
    data: {
      status: variance === 0 ? "CLOSED" : "FLAGGED",
      closedAt: new Date(),
      countedCash: input.countedCash,
      expectedCash: Number((Number(shift.openingFloat) + Number(shift.cashSales)).toFixed(2)),
      variance,
    },
  });

  await prisma.shiftActivityEvent.create({
    data: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      actorUserId: ctx.userId,
      shiftId: shift.id,
      type: "CLOSE_SUBMITTED",
      note: variance === 0
        ? "Shift closed — balanced"
        : `Shift closed — variance ৳${variance}`,
    },
  });

  return closed;
}

export async function getActiveShift(
  ctx: TenantContext,
) {
  const storeId = storeScope(ctx);
  return activeShift(ctx.tenantId, storeId, ctx.userId);
}

/* -------------------------------------------------------------------------- */
/*  Owner routes                                                               */
/* -------------------------------------------------------------------------- */

export async function listShifts(
  ctx: TenantContext,
  query: OwnerShiftListQuery,
) {
  const { q, status, userId, from, to, limit, offset } = query;

  const where: Prisma.ShiftWhereInput = {
    tenantId: ctx.tenantId,
    ...(ctx.storeId ? { storeId: ctx.storeId } : {}),
  };

  if (status) where.status = status;
  if (userId) where.userId = userId;
  if (from || to) {
    where.openedAt = {};
    if (from) where.openedAt.gte = from;
    if (to) where.openedAt.lte = to;
  }
  if (q) {
    where.OR = [
      { shiftNo: { contains: q, mode: "insensitive" } },
      { user: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.shift.findMany({
      where,
      include: { user: { select: { id: true, name: true } } },
      orderBy: { openedAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.shift.count({ where }),
  ]);

  return { items, total, limit, offset };
}

export async function getShiftDetail(
  ctx: TenantContext,
  shiftId: string,
) {
  const shift = await prisma.shift.findFirst({
    where: {
      id: shiftId,
      tenantId: ctx.tenantId,
      ...(ctx.storeId ? { storeId: ctx.storeId } : {}),
    },
    include: {
      user: { select: { id: true, name: true } },
      activity: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!shift) throw new AppError("Shift not found", 404);

  const paymentBreakdown = await prisma.payment.groupBy({
    by: ["method"],
    where: {
      sale: { shiftId: shift.id, tenantId: ctx.tenantId },
    },
    _sum: { amount: true },
  });

  const breakdown: ShiftPaymentBreakdown[] = paymentBreakdown.map((row: typeof paymentBreakdown[number]) => ({
    method: row.method as ShiftPaymentBreakdown["method"],
    amount: Number(row._sum?.amount ?? 0),
  }));

  return { ...shift, breakdown };
}

export async function resolveVariance(
  ctx: TenantContext,
  shiftId: string,
  input: ShiftResolveInput,
) {
  const shift = await prisma.shift.findFirst({
    where: {
      id: shiftId,
      tenantId: ctx.tenantId,
      ...(ctx.storeId ? { storeId: ctx.storeId } : {}),
      status: "FLAGGED",
    },
  });

  if (!shift) throw new AppError("Flagged shift not found", 404);

  const updated = await prisma.shift.update({
    where: { id: shiftId },
    data: {
      varianceDecision: input.varianceDecision,
      varianceNote: input.varianceNote ?? null,
      adjustmentReference: input.adjustmentReference ?? null,
      reviewedAt: new Date(),
      reviewedByUserId: ctx.userId,
      status: "CLOSED",
    },
  });

  await prisma.shiftActivityEvent.create({
    data: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      actorUserId: ctx.userId,
      shiftId,
      type: "VARIANCE_REVIEWED",
      note: `Variance ${input.varianceDecision}: ${input.varianceNote ?? "N/A"}`,
    },
  });

  return updated;
}
