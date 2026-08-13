import { prisma } from "@r2a/database";
import type {
  ProductCreateInput,
  ProductSearchInput,
  ProductUpdateInput,
} from "@r2a/shared-types";
import { AppError } from "../../utils/AppError";
import type { TenantContext } from "../../types/tenant";

const productInclude = { units: true } as const;

export async function createProduct(ctx: TenantContext, input: ProductCreateInput) {
  try {
    return await prisma.product.create({
      data: {
        tenantId: ctx.tenantId,
        name: input.name,
        genericName: input.genericName,
        manufacturer: input.manufacturer,
        strength: input.strength,
        form: input.form,
        sku: input.sku,
        barcode: input.barcode,
        description: input.description,
        units: {
          create: input.units.map((u) => ({
            tenantId: ctx.tenantId,
            unitType: u.unitType,
            factorToBase: u.factorToBase,
            label: u.label,
          })),
        },
      },
      include: productInclude,
    });
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      throw new AppError("Product sku or barcode already exists in this tenant", 409);
    }
    throw err;
  }
}

export async function updateProduct(
  ctx: TenantContext,
  productId: string,
  input: ProductUpdateInput,
) {
  const existing = await prisma.product.findFirst({
    where: { id: productId, tenantId: ctx.tenantId },
  });
  if (!existing) {
    throw new AppError("Product not found", 404);
  }

  try {
    return await prisma.$transaction(async (tx) => {
      if (input.units) {
        await tx.productUnit.deleteMany({
          where: { productId, tenantId: ctx.tenantId },
        });
        await tx.productUnit.createMany({
          data: input.units.map((u) => ({
            tenantId: ctx.tenantId,
            productId,
            unitType: u.unitType,
            factorToBase: u.factorToBase,
            label: u.label,
          })),
        });
      }

      return tx.product.update({
        where: { id: productId },
        data: {
          name: input.name,
          genericName: input.genericName,
          manufacturer: input.manufacturer,
          strength: input.strength,
          form: input.form,
          sku: input.sku,
          barcode: input.barcode,
          description: input.description,
          isActive: input.isActive,
        },
        include: productInclude,
      });
    });
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      throw new AppError("Product sku or barcode already exists in this tenant", 409);
    }
    throw err;
  }
}

export async function getProduct(ctx: TenantContext, productId: string) {
  const product = await prisma.product.findFirst({
    where: { id: productId, tenantId: ctx.tenantId },
    include: productInclude,
  });
  if (!product) {
    throw new AppError("Product not found", 404);
  }
  return product;
}

export async function searchProducts(ctx: TenantContext, query: ProductSearchInput) {
  const where = {
    tenantId: ctx.tenantId,
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    ...(query.barcode ? { barcode: query.barcode } : {}),
    ...(query.sku ? { sku: query.sku } : {}),
    ...(query.genericName
      ? { genericName: { contains: query.genericName, mode: "insensitive" as const } }
      : {}),
    ...(query.manufacturer
      ? { manufacturer: { contains: query.manufacturer, mode: "insensitive" as const } }
      : {}),
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: "insensitive" as const } },
            { genericName: { contains: query.q, mode: "insensitive" as const } },
            { manufacturer: { contains: query.q, mode: "insensitive" as const } },
            { strength: { contains: query.q, mode: "insensitive" as const } },
            { form: { contains: query.q, mode: "insensitive" as const } },
            { sku: { contains: query.q, mode: "insensitive" as const } },
            { barcode: { contains: query.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: productInclude,
      orderBy: { name: "asc" },
      take: query.limit,
      skip: query.offset,
    }),
    prisma.product.count({ where }),
  ]);

  return { items, total, limit: query.limit, offset: query.offset };
}
