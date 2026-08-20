/**
 * Deterministic local/dev seed for Milestone 1.
 *
 * Idempotency: upserts by stable business keys (tenant slug, store code,
 * user email, product sku, batch number). Safe to re-run without duplicates.
 * For a full wipe, reset the database then migrate + seed again.
 *
 * Default staff logins (override via env):
 *   SEED_OWNER_EMAIL=owner@demo.local
 *   SEED_OWNER_PASSWORD=ChangeMe123!
 *   SEED_MANAGER_EMAIL=manager@demo.local
 *   SEED_CASHIER_EMAIL=cashier@demo.local
 *   (manager/cashier share SEED_OWNER_PASSWORD unless SEED_STAFF_PASSWORD is set)
 */

import {
  BatchReturnStatus,
  CustomerSource,
  CustomerStatus,
  PrismaClient,
  Role,
  UnitType,
} from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const TENANT_SLUG = "demo-pharmacy";
const STORE_CODE = "MAIN";

type SeedBatch = {
  batchNumber: string;
  expiryDate: Date;
  quantityOnHand: number;
  costPerBase: number;
  sellPerBase: number;
  supplierName: string;
  returnStatus: BatchReturnStatus;
};

type SeedSupplier = {
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  city: string;
};

/** Active suppliers — names match the batch.supplierName demo values. */
const SUPPLIERS: SeedSupplier[] = [
  {
    name: "Beximco Distribution Ltd.",
    contactPerson: "Rafiq Chowdhury",
    phone: "01712000001",
    email: "sales@beximco-distribution.example",
    city: "Dhaka",
  },
  {
    name: "Square Distribution Ltd.",
    contactPerson: "Sabina Akter",
    phone: "01712000002",
    email: "sales@square-distribution.example",
    city: "Dhaka",
  },
  {
    name: "SMC Distribution",
    contactPerson: "Mahmudul Hasan",
    phone: "01712000003",
    email: "sales@smc-distribution.example",
    city: "Dhaka",
  },
];

type SeedProduct = {
  name: string;
  genericName: string;
  manufacturer: string;
  strength: string;
  form: string;
  sku: string;
  barcode: string;
  /** Optional Owner-web low-stock threshold (Napa only for later demo). */
  reorderLevel?: number;
  units: { unitType: UnitType; factorToBase: number }[];
  /** One or more lots — Napa matches Select Batch mock (FEFO + standard + expired). */
  batches: SeedBatch[];
};

const PRODUCTS: SeedProduct[] = [
  {
    name: "Napa 500mg",
    genericName: "Paracetamol",
    manufacturer: "Beximco Pharmaceuticals",
    strength: "500 mg",
    form: "Tablet",
    sku: "NAPA-500",
    barcode: "8901001100011",
    reorderLevel: 50,
    units: [
      { unitType: UnitType.PIECE, factorToBase: 1 },
      { unitType: UnitType.STRIP, factorToBase: 10 },
      { unitType: UnitType.BOX, factorToBase: 100 },
    ],
    // Select Batch - Napa mock: FEFO NP23091, two standard, one expired.
    batches: [
      {
        batchNumber: "NP23091",
        expiryDate: new Date("2026-08-31"),
        quantityOnHand: 14,
        costPerBase: 0.8,
        sellPerBase: 1.2,
        supplierName: "Beximco Distribution Ltd.",
        returnStatus: BatchReturnStatus.ELIGIBLE,
      },
      {
        batchNumber: "NP24031",
        expiryDate: new Date("2026-10-31"),
        quantityOnHand: 124,
        costPerBase: 0.8,
        sellPerBase: 1.2,
        supplierName: "Beximco Distribution Ltd.",
        returnStatus: BatchReturnStatus.MANIFEST_PREPARED,
      },
      {
        batchNumber: "NP24052",
        expiryDate: new Date("2027-03-31"),
        quantityOnHand: 86,
        costPerBase: 0.8,
        sellPerBase: 1.2,
        supplierName: "Beximco Distribution Ltd.",
        returnStatus: BatchReturnStatus.NOT_ELIGIBLE,
      },
      {
        batchNumber: "NP23010",
        expiryDate: new Date("2024-05-31"),
        quantityOnHand: 12,
        costPerBase: 0.8,
        sellPerBase: 1.2,
        supplierName: "Beximco Distribution Ltd.",
        returnStatus: BatchReturnStatus.NOT_ELIGIBLE,
      },
    ],
  },
  {
    name: "Seclo 20mg",
    genericName: "Omeprazole",
    manufacturer: "Square Pharmaceuticals",
    strength: "20 mg",
    form: "Capsule",
    sku: "SECLO-20",
    barcode: "8901001100028",
    units: [
      { unitType: UnitType.PIECE, factorToBase: 1 },
      { unitType: UnitType.STRIP, factorToBase: 10 },
      { unitType: UnitType.BOX, factorToBase: 100 },
    ],
    batches: [
      {
        batchNumber: "SC-2410-B",
        expiryDate: new Date("2027-03-15"),
        quantityOnHand: 300,
        costPerBase: 2.5,
        sellPerBase: 4.0,
        supplierName: "Square Distribution Ltd.",
        returnStatus: BatchReturnStatus.NOT_ELIGIBLE,
      },
    ],
  },
  {
    name: "ORSaline-N",
    genericName: "Oral Rehydration Salts",
    manufacturer: "Social Marketing Company",
    strength: "1 sachet",
    form: "Powder",
    sku: "ORS-N",
    barcode: "8901001100035",
    units: [
      { unitType: UnitType.PIECE, factorToBase: 1 },
      { unitType: UnitType.BOX, factorToBase: 20 },
    ],
    batches: [
      {
        batchNumber: "ORS-2501-C",
        expiryDate: new Date("2028-01-31"),
        quantityOnHand: 200,
        costPerBase: 4.0,
        sellPerBase: 6.0,
        supplierName: "SMC Distribution",
        returnStatus: BatchReturnStatus.NOT_ELIGIBLE,
      },
    ],
  },
  {
    name: "Histacin",
    genericName: "Chlorpheniramine",
    manufacturer: "Beximco Pharmaceuticals",
    strength: "4 mg",
    form: "Tablet",
    sku: "HIST-4",
    barcode: "8901001100042",
    units: [
      { unitType: UnitType.PIECE, factorToBase: 1 },
      { unitType: UnitType.STRIP, factorToBase: 10 },
      { unitType: UnitType.BOX, factorToBase: 100 },
    ],
    batches: [
      {
        batchNumber: "HT-2409-D",
        expiryDate: new Date("2026-12-31"),
        quantityOnHand: 250,
        costPerBase: 0.5,
        sellPerBase: 1.0,
        supplierName: "Beximco Distribution Ltd.",
        returnStatus: BatchReturnStatus.NOT_ELIGIBLE,
      },
    ],
  },
  {
    name: "Ace 500mg",
    genericName: "Paracetamol",
    manufacturer: "Square Pharmaceuticals",
    strength: "500 mg",
    form: "Tablet",
    sku: "ACE-500",
    barcode: "8901001100059",
    units: [
      { unitType: UnitType.PIECE, factorToBase: 1 },
      { unitType: UnitType.STRIP, factorToBase: 10 },
      { unitType: UnitType.BOX, factorToBase: 200 },
    ],
    batches: [
      {
        batchNumber: "ACE-2411-E",
        expiryDate: new Date("2027-09-30"),
        quantityOnHand: 400,
        costPerBase: 0.7,
        sellPerBase: 1.1,
        supplierName: "Square Distribution Ltd.",
        returnStatus: BatchReturnStatus.NOT_ELIGIBLE,
      },
    ],
  },
];

async function main() {
  const ownerEmail =
    process.env.SEED_OWNER_EMAIL?.trim() || "owner@demo.local";
  const managerEmail =
    process.env.SEED_MANAGER_EMAIL?.trim() || "manager@demo.local";
  const cashierEmail =
    process.env.SEED_CASHIER_EMAIL?.trim() || "cashier@demo.local";
  const ownerPassword =
    process.env.SEED_OWNER_PASSWORD?.trim() || "ChangeMe123!";
  const staffPassword =
    process.env.SEED_STAFF_PASSWORD?.trim() || ownerPassword;
  const passwordHash = await bcrypt.hash(ownerPassword, 10);
  const staffPasswordHash =
    staffPassword === ownerPassword
      ? passwordHash
      : await bcrypt.hash(staffPassword, 10);

  const tenant = await prisma.tenant.upsert({
    where: { slug: TENANT_SLUG },
    update: { name: "Demo Pharmacy", isActive: true },
    create: {
      name: "Demo Pharmacy",
      slug: TENANT_SLUG,
      isActive: true,
    },
  });

  const store = await prisma.store.upsert({
    where: {
      tenantId_code: { tenantId: tenant.id, code: STORE_CODE },
    },
    update: {
      name: "Main Counter",
      address: "Dhaka, Bangladesh",
      isActive: true,
    },
    create: {
      tenantId: tenant.id,
      name: "Main Counter",
      code: STORE_CODE,
      address: "Dhaka, Bangladesh",
      isActive: true,
    },
  });

  const owner = await prisma.user.upsert({
    where: {
      tenantId_email: { tenantId: tenant.id, email: ownerEmail },
    },
    update: {
      name: "Demo Owner",
      passwordHash,
      role: Role.OWNER,
      storeId: store.id,
      isActive: true,
    },
    create: {
      tenantId: tenant.id,
      storeId: store.id,
      email: ownerEmail,
      passwordHash,
      name: "Demo Owner",
      role: Role.OWNER,
      isActive: true,
    },
  });

  const manager = await prisma.user.upsert({
    where: {
      tenantId_email: { tenantId: tenant.id, email: managerEmail },
    },
    update: {
      name: "Demo Manager",
      passwordHash: staffPasswordHash,
      role: Role.MANAGER,
      storeId: store.id,
      isActive: true,
    },
    create: {
      tenantId: tenant.id,
      storeId: store.id,
      email: managerEmail,
      passwordHash: staffPasswordHash,
      name: "Demo Manager",
      role: Role.MANAGER,
      isActive: true,
    },
  });

  const cashier = await prisma.user.upsert({
    where: {
      tenantId_email: { tenantId: tenant.id, email: cashierEmail },
    },
    update: {
      name: "Demo Cashier",
      passwordHash: staffPasswordHash,
      role: Role.CASHIER,
      storeId: store.id,
      isActive: true,
    },
    create: {
      tenantId: tenant.id,
      storeId: store.id,
      email: cashierEmail,
      passwordHash: staffPasswordHash,
      name: "Demo Cashier",
      role: Role.CASHIER,
      isActive: true,
    },
  });

  for (const item of PRODUCTS) {
    const product = await prisma.product.upsert({
      where: {
        tenantId_sku: { tenantId: tenant.id, sku: item.sku },
      },
      update: {
        name: item.name,
        genericName: item.genericName,
        manufacturer: item.manufacturer,
        strength: item.strength,
        form: item.form,
        barcode: item.barcode,
        isActive: true,
        ...(item.reorderLevel !== undefined
          ? { reorderLevel: item.reorderLevel }
          : {}),
      },
      create: {
        tenantId: tenant.id,
        name: item.name,
        genericName: item.genericName,
        manufacturer: item.manufacturer,
        strength: item.strength,
        form: item.form,
        sku: item.sku,
        barcode: item.barcode,
        isActive: true,
        reorderLevel: item.reorderLevel,
      },
    });

    for (const unit of item.units) {
      await prisma.productUnit.upsert({
        where: {
          productId_unitType: {
            productId: product.id,
            unitType: unit.unitType,
          },
        },
        update: {
          tenantId: tenant.id,
          factorToBase: unit.factorToBase,
        },
        create: {
          tenantId: tenant.id,
          productId: product.id,
          unitType: unit.unitType,
          factorToBase: unit.factorToBase,
        },
      });
    }

    const keepBatchNumbers = item.batches.map((b) => b.batchNumber);

    for (const batch of item.batches) {
      await prisma.batch.upsert({
        where: {
          tenantId_storeId_productId_batchNumber: {
            tenantId: tenant.id,
            storeId: store.id,
            productId: product.id,
            batchNumber: batch.batchNumber,
          },
        },
        update: {
          expiryDate: batch.expiryDate,
          quantityOnHand: batch.quantityOnHand,
          costPerBase: batch.costPerBase,
          sellPerBase: batch.sellPerBase,
          supplierName: batch.supplierName,
          returnStatus: batch.returnStatus,
        },
        create: {
          tenantId: tenant.id,
          storeId: store.id,
          productId: product.id,
          batchNumber: batch.batchNumber,
          expiryDate: batch.expiryDate,
          quantityOnHand: batch.quantityOnHand,
          costPerBase: batch.costPerBase,
          sellPerBase: batch.sellPerBase,
          supplierName: batch.supplierName,
          returnStatus: batch.returnStatus,
        },
      });
    }

    // Retire demo lots removed from seed (keep rows if SaleItem FKs exist).
    // Zero qty so they no longer appear in Select Batch (in-stock filter).
    await prisma.batch.updateMany({
      where: {
        tenantId: tenant.id,
        storeId: store.id,
        productId: product.id,
        batchNumber: { notIn: keepBatchNumbers },
      },
      data: { quantityOnHand: 0 },
    });
  }

  for (const supplier of SUPPLIERS) {
    await prisma.supplier.upsert({
      where: {
        tenantId_name: { tenantId: tenant.id, name: supplier.name },
      },
      update: {
        contactPerson: supplier.contactPerson,
        phone: supplier.phone,
        email: supplier.email,
        city: supplier.city,
        status: "ACTIVE",
        isActive: true,
      },
      create: {
        tenantId: tenant.id,
        name: supplier.name,
        contactPerson: supplier.contactPerson,
        phone: supplier.phone,
        email: supplier.email,
        city: supplier.city,
        status: "ACTIVE",
        isActive: true,
      },
    });
  }

  await upsertSeedCustomer({
    tenantId: tenant.id,
    phone: "01700000000",
    name: "Karim Ahmed",
    email: "karim@example.com",
    loyaltyPoints: 120,
    status: CustomerStatus.ACTIVE,
    source: CustomerSource.OWNER_CREATED,
  });

  // Below eligibility threshold (50) — Redeem Loyalty shows Not Eligible UI.
  await upsertSeedCustomer({
    tenantId: tenant.id,
    phone: "01811000000",
    name: "Nusrat Jahan",
    email: "nusrat@example.com",
    loyaltyPoints: 25,
    status: CustomerStatus.ACTIVE,
    source: CustomerSource.OWNER_CREATED,
  });

  // Slice 3 walkthrough: POS registration waiting for Owner review.
  await upsertSeedCustomer({
    tenantId: tenant.id,
    phone: "01911000000",
    name: "Farhan Kabir",
    email: null,
    loyaltyPoints: 0,
    status: CustomerStatus.PENDING_APPROVAL,
    source: CustomerSource.POS_REGISTRATION,
    storeId: store.id,
    createdByUserId: cashier.id,
  });

  const batchCount = PRODUCTS.reduce((n, p) => n + p.batches.length, 0);

  console.log("Seed complete:");
  console.log(`  tenant: ${tenant.slug} (${tenant.id})`);
  console.log(`  store:  ${store.code} (${store.id})`);
  console.log(`  owner:  ${owner.email} (${owner.role})`);
  console.log(`  manager: ${manager.email} (${manager.role})`);
  console.log(`  cashier: ${cashier.email} (${cashier.role})`);
  console.log(`  products: ${PRODUCTS.length}`);
  console.log(`  batches:  ${batchCount} (Napa: 4 lots for Select Batch demo)`);
  console.log(`  suppliers: ${SUPPLIERS.length} (Beximco · Square · SMC)`);
  console.log(
    "  customers: Karim 120 pts · Nusrat 25 pts · Farhan pending POS (01911000000)",
  );
}

type SeedCustomer = {
  tenantId: string;
  phone: string;
  name: string;
  email: string | null;
  loyaltyPoints: number;
  status: CustomerStatus;
  source: CustomerSource;
  storeId?: string;
  createdByUserId?: string;
};

async function upsertSeedCustomer(data: SeedCustomer) {
  const existing = await prisma.customer.findFirst({
    where: {
      tenantId: data.tenantId,
      phone: data.phone,
      status: { not: CustomerStatus.REJECTED },
    },
  });

  const shared = {
    name: data.name,
    email: data.email,
    loyaltyPoints: data.loyaltyPoints,
    status: data.status,
    source: data.source,
    storeId: data.storeId ?? null,
    createdByUserId: data.createdByUserId ?? null,
  };

  if (existing) {
    return prisma.customer.update({
      where: { id: existing.id },
      data: shared,
    });
  }

  return prisma.customer.create({
    data: {
      tenantId: data.tenantId,
      phone: data.phone,
      ...shared,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
