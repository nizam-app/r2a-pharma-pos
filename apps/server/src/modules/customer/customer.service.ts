import { prisma } from "@r2a/database";
import type {
  CustomerCreateInput,
  CustomerSearchInput,
  CustomerUpdateInput,
  CustomerStatus,
  CustomerSource,
  OwnerCustomerListQuery,
  OwnerCustomerApproveInput,
  OwnerCustomerRejectInput,
} from "@r2a/shared-types";
import { AppError } from "../../utils/AppError";
import type { TenantContext } from "../../types/tenant";

function serializeCustomer(c: {
  id: string;
  tenantId: string;
  name: string;
  phone: string;
  email: string | null;
  status: CustomerStatus;
  source: CustomerSource;
  dateOfBirth: Date | null;
  gender: string | null;
  address: string | null;
  storeId: string | null;
  loyaltyPoints: number;
  creditBalance: { toString(): string } | number;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  approvedAt: Date | null;
  approvedByUserId: string | null;
  rejectedAt: Date | null;
  rejectedByUserId: string | null;
  rejectionNote: string | null;
}) {
  return {
    id: c.id,
    tenantId: c.tenantId,
    name: c.name,
    phone: c.phone,
    email: c.email,
    status: c.status,
    source: c.source,
    dateOfBirth: c.dateOfBirth,
    gender: c.gender,
    address: c.address,
    storeId: c.storeId,
    loyaltyPoints: c.loyaltyPoints,
    creditBalance:
      typeof c.creditBalance === "number"
        ? c.creditBalance
        : Number(c.creditBalance.toString()),
    createdByUserId: c.createdByUserId,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    approvedAt: c.approvedAt,
    approvedByUserId: c.approvedByUserId,
    rejectedAt: c.rejectedAt,
    rejectedByUserId: c.rejectedByUserId,
    rejectionNote: c.rejectionNote,
  };
}

export async function createCustomer(
  ctx: TenantContext,
  input: CustomerCreateInput,
) {
  const isOwner = ctx.role === "OWNER";

  try {
    const customer = await prisma.customer.create({
      data: {
        tenantId: ctx.tenantId,
        name: input.name,
        phone: input.phone,
        email: input.email,
        status: isOwner ? "ACTIVE" : "PENDING_APPROVAL",
        source:
          isOwner && input.source ? input.source : isOwner ? "OWNER_CREATED" : "POS_REGISTRATION",
        ...(isOwner
          ? {
              dateOfBirth: input.dateOfBirth ?? undefined,
              gender: input.gender ?? undefined,
              address: input.address ?? undefined,
              storeId: input.storeId ?? (ctx.storeId ?? undefined),
            }
          : {
              storeId: ctx.storeId ?? undefined,
            }),
        createdByUserId: ctx.userId,
      },
    });
    return serializeCustomer(customer);
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      throw new AppError("Customer phone already exists in this tenant", 409);
    }
    throw err;
  }
}

export async function updateCustomer(
  ctx: TenantContext,
  customerId: string,
  input: CustomerUpdateInput,
) {
  const existing = await prisma.customer.findFirst({
    where: { id: customerId, tenantId: ctx.tenantId },
  });
  if (!existing) {
    throw new AppError("Customer not found", 404);
  }

  try {
    const customer = await prisma.customer.update({
      where: { id: customerId },
      data: {
        name: input.name,
        phone: input.phone,
        email: input.email,
      },
    });
    return serializeCustomer(customer);
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      throw new AppError("Customer phone already exists in this tenant", 409);
    }
    throw err;
  }
}

export async function getCustomer(ctx: TenantContext, customerId: string) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, tenantId: ctx.tenantId },
  });
  if (!customer) {
    throw new AppError("Customer not found", 404);
  }
  return serializeCustomer(customer);
}

export async function searchCustomers(
  ctx: TenantContext,
  query: CustomerSearchInput,
) {
  const where = {
    tenantId: ctx.tenantId,
    status: "ACTIVE" as CustomerStatus,
    ...(query.phone ? { phone: query.phone } : {}),
    ...(query.name
      ? { name: { contains: query.name, mode: "insensitive" as const } }
      : {}),
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: "insensitive" as const } },
            { phone: { contains: query.q, mode: "insensitive" as const } },
            { email: { contains: query.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { name: "asc" },
      take: query.limit,
      skip: query.offset,
    }),
    prisma.customer.count({ where }),
  ]);

  return {
    items: items.map(serializeCustomer),
    total,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function phoneCheck(
  ctx: TenantContext,
  phone: string,
) {
  const customer = await prisma.customer.findFirst({
    where: { tenantId: ctx.tenantId, phone },
    select: {
      id: true,
      name: true,
      phone: true,
      status: true,
      source: true,
    },
  });

  return {
    exists: !!customer,
    customer: customer
      ? {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          status: customer.status,
          source: customer.source,
        }
      : null,
  };
}

export async function ownerCustomerList(
  ctx: TenantContext,
  query: OwnerCustomerListQuery,
) {
  const q = query.q?.trim();
  const sortMap: Record<string, string> = {
    name: "name",
    createdAt: "createdAt",
    loyaltyPoints: "loyaltyPoints",
  };
  const orderBy = { [sortMap[query.sort ?? "name"] ?? "name"]: "asc" } as Record<
    string,
    "asc" | "desc"
  >;

  const where: Record<string, unknown> = {
    tenantId: ctx.tenantId,
    ...(ctx.storeId ? { storeId: ctx.storeId } : {}),
    ...((query.status && query.status !== "REJECTED")
      ? { status: query.status }
      : { status: { not: "REJECTED" } }),
    ...(query.source ? { source: query.source } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total, kpis] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy,
      take: query.limit,
      skip: query.offset,
    }),
    prisma.customer.count({ where }),
    (async () => {
      const registered = await prisma.customer.count({
        where: { tenantId: ctx.tenantId, ...(ctx.storeId ? { storeId: ctx.storeId } : {}), status: { not: "REJECTED" } },
      });
      const pending = await prisma.customer.count({
        where: { tenantId: ctx.tenantId, ...(ctx.storeId ? { storeId: ctx.storeId } : {}), status: "PENDING_APPROVAL" },
      });
      const active90d = await prisma.customer.count({
        where: {
          tenantId: ctx.tenantId,
          ...(ctx.storeId ? { storeId: ctx.storeId } : {}),
          status: "ACTIVE",
          createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
        },
      });
      const loyaltyPoints = await prisma.customer.aggregate({
        where: { tenantId: ctx.tenantId, ...(ctx.storeId ? { storeId: ctx.storeId } : {}), status: "ACTIVE" },
        _sum: { loyaltyPoints: true },
      });
      return {
        registered,
        pending,
        active90d,
        loyaltyPointsIssued: loyaltyPoints._sum.loyaltyPoints ?? 0,
      };
    })(),
  ]);

  return {
    items: items.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      status: c.status,
      source: c.source,
      storeId: c.storeId,
      loyaltyPoints: c.loyaltyPoints,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      approvedAt: c.approvedAt,
      rejectedAt: c.rejectedAt,
    })),
    total,
    limit: query.limit,
    offset: query.offset,
    kpis,
  };
}

export async function ownerCustomerDetail(
  ctx: TenantContext,
  customerId: string,
) {
  const customer = await prisma.customer.findFirst({
    where: {
      id: customerId,
      tenantId: ctx.tenantId,
      status: { not: "REJECTED" },
    },
  });
  if (!customer) {
    throw new AppError("Customer not found", 404);
  }

  const [createdByUser, approvedByUser, rejectedByUser, salesAgg, stores, sales] =
    await Promise.all([
      customer.createdByUserId
        ? prisma.user.findFirst({
            where: { id: customer.createdByUserId, tenantId: ctx.tenantId },
            select: { id: true, name: true, role: true },
          })
        : null,
      customer.approvedByUserId
        ? prisma.user.findFirst({
            where: { id: customer.approvedByUserId, tenantId: ctx.tenantId },
            select: { id: true, name: true, role: true },
          })
        : null,
      customer.rejectedByUserId
        ? prisma.user.findFirst({
            where: { id: customer.rejectedByUserId, tenantId: ctx.tenantId },
            select: { id: true, name: true, role: true },
          })
        : null,
      prisma.sale.aggregate({
        where: {
          customerId: customer.id,
          tenantId: ctx.tenantId,
        },
        _count: { _all: true },
        _sum: { total: true, loyaltyUsed: true, loyaltyEarned: true },
      }),
      prisma.store.findMany({
        where: { tenantId: ctx.tenantId },
        select: { id: true, name: true },
      }),
      prisma.sale.findMany({
        where: { customerId: customer.id, tenantId: ctx.tenantId },
        orderBy: { soldAt: "desc" },
        take: 25,
        select: {
          id: true,
          receiptNo: true,
          soldAt: true,
          total: true,
          storeId: true,
          loyaltyPrevious: true,
          loyaltyUsed: true,
          loyaltyEarned: true,
        },
      }),
    ]);

  const storeNameById = new Map(stores.map((s) => [s.id, s.name]));
  const purchaseRows = sales.map((s) => ({
    id: s.id,
    receiptNo: s.receiptNo,
    soldAt: s.soldAt,
    total: Number(s.total.toString()),
    storeName: storeNameById.get(s.storeId) ?? null,
  }));
  const loyaltyRows = sales.map((s) => ({
    id: s.id,
    soldAt: s.soldAt,
    loyaltyPrevious: s.loyaltyPrevious,
    loyaltyUsed: s.loyaltyUsed,
    loyaltyEarned: s.loyaltyEarned,
  }));

  return {
    profile: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      dateOfBirth: customer.dateOfBirth,
      gender: customer.gender,
      address: customer.address,
      status: customer.status,
      source: customer.source,
      storeId: customer.storeId,
      storeName: customer.storeId ? storeNameById.get(customer.storeId) ?? null : null,
      loyaltyPoints: customer.loyaltyPoints,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    },
    audit: {
      createdByUserId: customer.createdByUserId,
      createdBy: createdByUser
        ? { id: createdByUser.id, name: createdByUser.name, role: createdByUser.role }
        : null,
      approvedAt: customer.approvedAt,
      approvedByUserId: customer.approvedByUserId,
      approvedBy: approvedByUser
        ? { id: approvedByUser.id, name: approvedByUser.name, role: approvedByUser.role }
        : null,
      rejectedAt: customer.rejectedAt,
      rejectedByUserId: customer.rejectedByUserId,
      rejectedBy: rejectedByUser
        ? { id: rejectedByUser.id, name: rejectedByUser.name, role: rejectedByUser.role }
        : null,
      rejectionNote: customer.rejectionNote,
    },
    purchaseHistory: {
      saleCount: salesAgg._count._all,
      totalSpent: salesAgg._sum.total ?? 0,
      lastPurchaseAt: purchaseRows[0]?.soldAt ?? null,
      rows: purchaseRows,
    },
    loyaltyActivity: {
      pointsUsed: salesAgg._sum.loyaltyUsed ?? 0,
      pointsEarned: salesAgg._sum.loyaltyEarned ?? 0,
      rows: loyaltyRows,
    },
  };
}

export async function approveCustomer(
  ctx: TenantContext,
  customerId: string,
  input: OwnerCustomerApproveInput,
) {
  const customer = await prisma.customer.findFirst({
    where: {
      id: customerId,
      tenantId: ctx.tenantId,
      ...(ctx.storeId ? { storeId: ctx.storeId } : {}),
      status: "PENDING_APPROVAL",
    },
  });
  if (!customer) {
    throw new AppError("Customer not found or not pending approval", 404);
  }

  const updated = await prisma.customer.update({
    where: { id: customerId },
    data: {
      status: "ACTIVE",
      approvedAt: new Date(),
      approvedByUserId: ctx.userId,
      ...(input.name ? { name: input.name } : {}),
      ...(input.phone ? { phone: input.phone } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.dateOfBirth !== undefined ? { dateOfBirth: input.dateOfBirth ?? undefined } : {}),
      ...(input.gender !== undefined ? { gender: input.gender ?? undefined } : {}),
      ...(input.address !== undefined ? { address: input.address ?? undefined } : {}),
    },
  });

  return {
    id: updated.id,
    status: updated.status,
    approvedAt: updated.approvedAt,
  };
}

export async function rejectCustomer(
  ctx: TenantContext,
  customerId: string,
  input: OwnerCustomerRejectInput,
) {
  const customer = await prisma.customer.findFirst({
    where: {
      id: customerId,
      tenantId: ctx.tenantId,
      ...(ctx.storeId ? { storeId: ctx.storeId } : {}),
      status: "PENDING_APPROVAL",
    },
  });
  if (!customer) {
    throw new AppError("Customer not found or not pending approval", 404);
  }

  const updated = await prisma.customer.update({
    where: { id: customerId },
    data: {
      status: "REJECTED",
      rejectedAt: new Date(),
      rejectedByUserId: ctx.userId,
      rejectionNote: input.rejectionNote ?? null,
    },
  });

  return {
    id: updated.id,
    status: updated.status,
    rejectedAt: updated.rejectedAt,
  };
}
