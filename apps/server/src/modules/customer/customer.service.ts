import { prisma } from "@r2a/database";
import type {
  CustomerCreateInput,
  CustomerSearchInput,
  CustomerUpdateInput,
} from "@r2a/shared-types";
import { AppError } from "../../utils/AppError";
import type { TenantContext } from "../../types/tenant";

function serializeCustomer(c: {
  id: string;
  tenantId: string;
  name: string;
  phone: string | null;
  email: string | null;
  loyaltyPoints: number;
  creditBalance: { toString(): string } | number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: c.id,
    tenantId: c.tenantId,
    name: c.name,
    phone: c.phone,
    email: c.email,
    loyaltyPoints: c.loyaltyPoints,
    creditBalance:
      typeof c.creditBalance === "number"
        ? c.creditBalance
        : Number(c.creditBalance.toString()),
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

export async function createCustomer(
  ctx: TenantContext,
  input: CustomerCreateInput,
) {
  try {
    const customer = await prisma.customer.create({
      data: {
        tenantId: ctx.tenantId,
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
