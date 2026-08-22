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
  FefoViolationStatus,
  PrismaClient,
  Role,
  ShiftStatus,
  ShiftVarianceDecision,
  StockAuditActivityType,
  StockAuditLineStatus,
  StockAuditStatus,
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
      phone: "01700000001",
    },
    create: {
      tenantId: tenant.id,
      storeId: store.id,
      email: ownerEmail,
      passwordHash,
      name: "Demo Owner",
      role: Role.OWNER,
      isActive: true,
      phone: "01700000001",
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
      phone: "01700000002",
    },
    create: {
      tenantId: tenant.id,
      storeId: store.id,
      email: managerEmail,
      passwordHash: staffPasswordHash,
      name: "Demo Manager",
      role: Role.MANAGER,
      isActive: true,
      phone: "01700000002",
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
      phone: "01700000003",
    },
    create: {
      tenantId: tenant.id,
      storeId: store.id,
      email: cashierEmail,
      passwordHash: staffPasswordHash,
      name: "Demo Cashier",
      role: Role.CASHIER,
      isActive: true,
      phone: "01700000003",
    },
  });

  const inactiveCashierEmail = "inactive-cashier@demo.local";
  const inactiveCashier = await prisma.user.upsert({
    where: {
      tenantId_email: { tenantId: tenant.id, email: inactiveCashierEmail },
    },
    update: {
      name: "Inactive Cashier",
      passwordHash: staffPasswordHash,
      role: Role.CASHIER,
      storeId: store.id,
      isActive: false,
      phone: "01722222222",
      internalNote: "Temporary inactive account for testing",
    },
    create: {
      tenantId: tenant.id,
      storeId: store.id,
      email: inactiveCashierEmail,
      passwordHash: staffPasswordHash,
      name: "Inactive Cashier",
      role: Role.CASHIER,
      isActive: false,
      phone: "01722222222",
      internalNote: "Temporary inactive account for testing",
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

  await seedShiftDemo({
    tenantId: tenant.id,
    storeId: store.id,
    cashierId: cashier.id,
    ownerId: owner.id,
  });

  await seedAuditDemo({
    tenantId: tenant.id,
    storeId: store.id,
    managerId: manager.id,
    ownerId: owner.id,
  });

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
  console.log(
    "  shifts: OPEN · CLOSED balanced · FLAGGED unresolved · FLAGGED resolved",
  );
  console.log(
    "  audits: IN_PROGRESS · COMPLETED · VARIANCE_FOUND + FEFO open/corrected",
  );
}

type SeedAuditDemo = {
  tenantId: string;
  storeId: string;
  managerId: string;
  ownerId: string;
};

/** Seed deterministic stock audits and FEFO records for the Slice 7 owner walkthrough. */
async function seedAuditDemo(opts: SeedAuditDemo) {
  const { tenantId, storeId, managerId, ownerId } = opts;

  const demoProducts = await prisma.product.findMany({
    where: { tenantId, sku: { in: ["NAPA-500", "SECLO-20", "ACE-500"] } },
  });
  const productBySku = new Map(demoProducts.map((p) => [p.sku, p]));
  const batches = await prisma.batch.findMany({
    where: {
      tenantId,
      storeId,
      batchNumber: { in: ["NP23091", "NP24031", "SC-2410-B", "ACE-2411-E"] },
    },
  });
  const batchByNumber = new Map(batches.map((b) => [b.batchNumber, b]));

  const napa = productBySku.get("NAPA-500");
  const seclo = productBySku.get("SECLO-20");
  const ace = productBySku.get("ACE-500");
  const napaFefo = batchByNumber.get("NP23091");
  const napaPicked = batchByNumber.get("NP24031");
  const secloBatch = batchByNumber.get("SC-2410-B");
  const aceBatch = batchByNumber.get("ACE-2411-E");
  if (!napa || !seclo || !ace || !napaFefo || !napaPicked || !secloBatch || !aceBatch) {
    return;
  }

  async function ensureAudit(input: {
    auditNo: string;
    status: StockAuditStatus;
    locationLabel: string;
    notes: string;
    startedAt: Date;
    completedAt?: Date;
    reviewedAt?: Date;
    reviewedByUserId?: string;
    lines: { product: typeof napa; batch: typeof napaFefo; countedQty: number }[];
    activity: { type: StockAuditActivityType; note: string; actorUserId?: string }[];
  }) {
    const itemsChecked = input.lines.length;
    const varianceAmount = input.lines.reduce((total, line) => {
      const differenceQty = line.countedQty - line.batch.quantityOnHand;
      return total + Math.abs(differenceQty) * Number(line.batch.costPerBase);
    }, 0);
    const audit = await prisma.stockAudit.upsert({
      where: { tenantId_auditNo: { tenantId, auditNo: input.auditNo } },
      update: {
        status: input.status,
        locationLabel: input.locationLabel,
        itemsChecked,
        varianceAmount,
        notes: input.notes,
        startedAt: input.startedAt,
        completedAt: input.completedAt ?? null,
        reviewedAt: input.reviewedAt ?? null,
        reviewedByUserId: input.reviewedByUserId ?? null,
      },
      create: {
        tenantId,
        storeId,
        auditNo: input.auditNo,
        status: input.status,
        locationLabel: input.locationLabel,
        itemsChecked,
        varianceAmount,
        notes: input.notes,
        startedAt: input.startedAt,
        completedAt: input.completedAt ?? null,
        reviewedAt: input.reviewedAt ?? null,
        createdByUserId: managerId,
        reviewedByUserId: input.reviewedByUserId ?? null,
      },
    });

    await prisma.stockAuditActivityEvent.deleteMany({ where: { auditId: audit.id } });
    await prisma.stockAuditLine.deleteMany({ where: { auditId: audit.id } });

    for (const line of input.lines) {
      const differenceQty = line.countedQty - line.batch.quantityOnHand;
      await prisma.stockAuditLine.create({
        data: {
          tenantId,
          auditId: audit.id,
          batchId: line.batch.id,
          productId: line.product.id,
          systemQty: line.batch.quantityOnHand,
          countedQty: line.countedQty,
          differenceQty,
          status:
            differenceQty === 0
              ? StockAuditLineStatus.MATCHES
              : StockAuditLineStatus.DISCREPANCY,
          productNameSnapshot: line.product.name,
          batchNumberSnapshot: line.batch.batchNumber,
          expiryDateSnapshot: line.batch.expiryDate,
          costPerBaseSnapshot: line.batch.costPerBase,
        },
      });
    }

    for (const event of input.activity) {
      await prisma.stockAuditActivityEvent.create({
        data: {
          tenantId,
          auditId: audit.id,
          actorUserId: event.actorUserId ?? managerId,
          type: event.type,
          note: event.note,
        },
      });
    }
    return audit;
  }

  await ensureAudit({
    auditNo: "AUD-260822-A",
    status: StockAuditStatus.IN_PROGRESS,
    locationLabel: "Front Counter Shelf A",
    notes: "Morning count in progress for high-turnover products.",
    startedAt: new Date("2026-08-22T04:30:00.000Z"),
    lines: [{ product: napa, batch: napaFefo, countedQty: napaFefo.quantityOnHand }],
    activity: [
      { type: StockAuditActivityType.CREATED, note: "Audit created for Front Counter Shelf A" },
      { type: StockAuditActivityType.COUNT_STARTED, note: "Physical count started" },
    ],
  });

  await ensureAudit({
    auditNo: "AUD-260821-B",
    status: StockAuditStatus.COMPLETED,
    locationLabel: "Cold Chain Cabinet",
    notes: "No variance found.",
    startedAt: new Date("2026-08-21T05:00:00.000Z"),
    completedAt: new Date("2026-08-21T05:25:00.000Z"),
    reviewedAt: new Date("2026-08-21T06:00:00.000Z"),
    reviewedByUserId: ownerId,
    lines: [{ product: seclo, batch: secloBatch, countedQty: secloBatch.quantityOnHand }],
    activity: [
      { type: StockAuditActivityType.CREATED, note: "Audit created for Cold Chain Cabinet" },
      { type: StockAuditActivityType.COMPLETED, note: "Audit completed with no discrepancy" },
      { type: StockAuditActivityType.REVIEWED, note: "Owner reviewed and closed audit", actorUserId: ownerId },
    ],
  });

  const varianceAudit = await ensureAudit({
    auditNo: "AUD-260821-C",
    status: StockAuditStatus.VARIANCE_FOUND,
    locationLabel: "Main Shelf Paracetamol",
    notes: "Variance requires owner review before adjustment.",
    startedAt: new Date("2026-08-21T07:10:00.000Z"),
    completedAt: new Date("2026-08-21T07:45:00.000Z"),
    lines: [
      { product: napa, batch: napaPicked, countedQty: Math.max(0, napaPicked.quantityOnHand - 6) },
      { product: ace, batch: aceBatch, countedQty: aceBatch.quantityOnHand + 3 },
    ],
    activity: [
      { type: StockAuditActivityType.CREATED, note: "Audit created for Main Shelf Paracetamol" },
      { type: StockAuditActivityType.VARIANCE_DETECTED, note: "Discrepancy detected on two batches" },
    ],
  });

  const seedIssues = [
    "Seed FEFO override: later Napa lot picked while FEFO lot remained available",
    "Seed FEFO correction: owner confirmed shelf coaching complete",
  ];
  await prisma.fefoViolationRecord.deleteMany({
    where: { tenantId, storeId, observedIssue: { in: seedIssues } },
  });
  await prisma.fefoViolationRecord.create({
    data: {
      tenantId,
      storeId,
      auditId: varianceAudit.id,
      productId: napa.id,
      skippedBatchId: napaFefo.id,
      pickedBatchId: napaPicked.id,
      observedIssue: seedIssues[0],
      recommendedAction: "Review shelf order and coach cashier to pick FEFO lot NP23091 first.",
      status: FefoViolationStatus.OPEN,
    },
  });
  await prisma.fefoViolationRecord.create({
    data: {
      tenantId,
      storeId,
      productId: napa.id,
      skippedBatchId: napaFefo.id,
      pickedBatchId: napaPicked.id,
      observedIssue: seedIssues[1],
      recommendedAction: "Correction recorded after shelf reorder.",
      status: FefoViolationStatus.CORRECTED,
      correctionNote: "Shelf reordered and team reminded about FEFO.",
      correctedAt: new Date("2026-08-21T08:15:00.000Z"),
      correctedByUserId: ownerId,
    },
  });
}

type SeedShiftDemo = {
  tenantId: string;
  storeId: string;
  cashierId: string;
  ownerId: string;
};

/** Seed four demonstration shifts with linked sales for the Owner Shift Management walkthrough. */
async function seedShiftDemo(opts: SeedShiftDemo) {
  const { tenantId, storeId, cashierId, ownerId } = opts;

  // Reuse an in-stock Napa lot for linked sales (minimal qty, no real stock decrement).
  const napa = await prisma.product.findFirst({
    where: { tenantId, sku: "NAPA-500" },
  });
  const napaBatch = napa
    ? await prisma.batch.findFirst({
        where: { tenantId, storeId, productId: napa.id, batchNumber: "NP24031" },
      })
    : null;

  async function linkSale(shiftId: string, shiftNo: string, seq: number, method: "CASH" | "CARD" | "MFS", amount: number, soldAt: Date) {
    if (!napa || !napaBatch) return;
    const eventId = `seed-shift-${shiftId}-${seq}`;
    const existing = await prisma.sale.findUnique({ where: { eventId } });
    if (existing) return;
    const unitPrice = Number(napaBatch.sellPerBase);
    const qty = Math.max(1, Math.round(amount / unitPrice));
    const receiptNo = `TXN-${shiftNo}-${seq}`;
    await prisma.sale.create({
      data: {
        tenantId,
        storeId,
        userId: cashierId,
        shiftId,
        customerId: null,
        eventId,
        receiptNo,
        soldAt,
        subtotal: amount,
        discount: 0,
        total: amount,
        items: {
          create: {
            tenantId,
            productId: napa.id,
            batchId: napaBatch.id,
            unitType: "PIECE",
            unitQty: qty,
            quantityBase: qty,
            unitPrice,
            lineTotal: amount,
            fefoOverride: false,
            productNameAtSale: napa.name,
            productGenericNameAtSale: napa.genericName,
            batchNumberAtSale: napaBatch.batchNumber,
            expiryDateAtSale: napaBatch.expiryDate,
          },
        },
        payments: { create: { tenantId, method, amount } },
      },
    });
  }

  async function ensureShift(shiftNo: string, data: {
    status: ShiftStatus;
    openingFloat: number;
    openedAt: Date;
    closedAt?: Date;
    countedCash?: number;
    expectedCash?: number;
    variance?: number;
    cashSales: number;
    cardSales: number;
    mfsSales: number;
    txnCount: number;
    varianceDecision?: ShiftVarianceDecision;
    varianceNote?: string;
    reviewedAt?: Date;
    reviewedByUserId?: string;
    sales: { method: "CASH" | "CARD" | "MFS"; amount: number }[];
  }) {
    const existing = await prisma.shift.findUnique({
      where: { tenantId_shiftNo: { tenantId, shiftNo } },
    });
    const created = await prisma.shift.upsert({
      where: { tenantId_shiftNo: { tenantId, shiftNo } },
      update: {},
      create: {
        tenantId,
        storeId,
        userId: cashierId,
        shiftNo,
        status: data.status,
        openingFloat: data.openingFloat,
        openedAt: data.openedAt,
        closedAt: data.closedAt ?? null,
        countedCash: data.countedCash ?? null,
        expectedCash: data.expectedCash ?? null,
        variance: data.variance ?? null,
        cashSales: data.cashSales,
        cardSales: data.cardSales,
        mfsSales: data.mfsSales,
        txnCount: data.txnCount,
        varianceDecision: data.varianceDecision ?? null,
        varianceNote: data.varianceNote ?? null,
        adjustmentReference: null,
        reviewedAt: data.reviewedAt ?? null,
        reviewedByUserId: data.reviewedByUserId ?? null,
      },
    });

    if (!existing) {
      await prisma.shiftActivityEvent.create({
        data: {
          tenantId,
          userId: cashierId,
          actorUserId: cashierId,
          shiftId: created.id,
          type: "OPENED",
          note: `Opening float ${data.openingFloat}`,
        },
      });
      if (data.closedAt) {
        await prisma.shiftActivityEvent.create({
          data: {
            tenantId,
            userId: cashierId,
            actorUserId: cashierId,
            shiftId: created.id,
            type: "CLOSE_SUBMITTED",
            note: `Counted cash ${data.countedCash}`,
          },
        });
      }
      if (data.varianceDecision) {
        await prisma.shiftActivityEvent.create({
          data: {
            tenantId,
            userId: cashierId,
            actorUserId: data.reviewedByUserId ?? ownerId,
            shiftId: created.id,
            type: "VARIANCE_REVIEWED",
            note: data.varianceNote ?? data.varianceDecision,
          },
        });
      }
    }

    if (!existing) {
      data.sales.forEach((s, i) =>
        linkSale(created.id, shiftNo, i + 1, s.method, s.amount, data.openedAt),
      );
    }
    return created;
  }

  const closedDate = new Date("2026-08-20T10:00:00.000Z");
  const flaggedDate = new Date("2026-08-21T11:00:00.000Z");
  const resolvedDate = new Date("2026-08-21T15:00:00.000Z");
  const openDate = new Date();

  await ensureShift("SH-260820-A", {
    status: ShiftStatus.CLOSED,
    openingFloat: 500,
    openedAt: closedDate,
    closedAt: closedDate,
    countedCash: 700,
    expectedCash: 700,
    variance: 0,
    cashSales: 200,
    cardSales: 100,
    mfsSales: 0,
    txnCount: 2,
    sales: [
      { method: "CASH", amount: 200 },
      { method: "CARD", amount: 100 },
    ],
  });

  await ensureShift("SH-260821-B", {
    status: ShiftStatus.FLAGGED,
    openingFloat: 300,
    openedAt: flaggedDate,
    closedAt: flaggedDate,
    countedCash: 470,
    expectedCash: 450,
    variance: 20,
    cashSales: 150,
    cardSales: 0,
    mfsSales: 0,
    txnCount: 1,
    sales: [{ method: "CASH", amount: 150 }],
  });

  await ensureShift("SH-260821-C", {
    status: ShiftStatus.CLOSED,
    openingFloat: 300,
    openedAt: resolvedDate,
    closedAt: resolvedDate,
    countedCash: 430,
    expectedCash: 450,
    variance: -20,
    cashSales: 150,
    cardSales: 0,
    mfsSales: 0,
    txnCount: 1,
    varianceDecision: ShiftVarianceDecision.ACCEPTED_DIFFERENCE,
    varianceNote: "Accepted difference after recount",
    reviewedAt: resolvedDate,
    reviewedByUserId: ownerId,
    sales: [{ method: "CASH", amount: 150 }],
  });

  await ensureShift("SH-260822-D", {
    status: ShiftStatus.OPEN,
    openingFloat: 200,
    openedAt: openDate,
    cashSales: 0,
    cardSales: 0,
    mfsSales: 0,
    txnCount: 0,
    sales: [],
  });
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
