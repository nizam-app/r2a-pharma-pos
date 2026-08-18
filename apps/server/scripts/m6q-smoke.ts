/**
 * Milestone 6 Batch Q smoke — OWNER-only Supplier + Purchase Order APIs.
 *
 * Usage (server must already be running):
 *   npm run smoke:m6q -w @r2a/server
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { prisma } from "@r2a/database";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
dotenv.config({ path: path.join(repoRoot, ".env") });

const BASE = (process.env.BASE_URL || "http://localhost:8787").replace(
  /\/$/,
  "",
);
const API = `${BASE}/api/v1`;
const SEED = {
  ownerEmail: process.env.SEED_OWNER_EMAIL || "owner@demo.local",
  managerEmail: process.env.SEED_MANAGER_EMAIL || "manager@demo.local",
  cashierEmail: process.env.SEED_CASHIER_EMAIL || "cashier@demo.local",
  password: process.env.SEED_OWNER_PASSWORD || "ChangeMe123!",
  tenantSlug: "demo-pharmacy",
};

type Result = { name: string; ok: boolean; detail: string };
const results: Result[] = [];

function pass(name: string, detail = ""): void {
  results.push({ name, ok: true, detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name: string, detail = ""): void {
  results.push({ name, ok: false, detail });
  console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

async function req(
  pathname: string,
  opts: { method?: string; body?: unknown; token?: string } = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const response = await fetch(`${API}${pathname}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const text = await response.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: response.status, body: body as Record<string, unknown> };
}

async function login(email: string) {
  const response = await req("/auth/login", {
    method: "POST",
    body: {
      email,
      password: SEED.password,
      tenantSlug: SEED.tenantSlug,
    },
  });
  const data = asRecord(response.body.data);
  const user = asRecord(data?.user);
  return {
    status: response.status,
    body: response.body,
    token: typeof data?.accessToken === "string" ? data.accessToken : null,
    tenantId: typeof user?.tenantId === "string" ? user.tenantId : null,
    storeId: typeof user?.storeId === "string" ? user.storeId : null,
  };
}

async function stockFor(
  tenantId: string,
  productId: string,
  storeId: string | null,
): Promise<number> {
  const aggregate = await prisma.batch.aggregate({
    where: {
      tenantId,
      productId,
      ...(storeId ? { storeId } : {}),
    },
    _sum: { quantityOnHand: true },
  });
  return aggregate._sum.quantityOnHand ?? 0;
}

async function main(): Promise<void> {
  console.log(`M6Q smoke → ${API}\n`);
  const createdPoIds: string[] = [];
  let createdSupplierId: string | null = null;
  let foreignTenantId: string | null = null;

  try {
    const health = await req("/health");
    if (health.status === 200 && asRecord(health.body.data)?.ok === true) {
      pass("1. Health envelope");
    } else {
      fail("1. Health envelope", JSON.stringify(health.body));
      return;
    }

    const [owner, manager, cashier] = await Promise.all([
      login(SEED.ownerEmail),
      login(SEED.managerEmail),
      login(SEED.cashierEmail),
    ]);
    if (owner.status === 200 && owner.token && owner.tenantId) {
      pass("2a. Owner login");
    } else {
      fail("2a. Owner login", JSON.stringify(owner.body));
      return;
    }
    if (manager.status === 200 && manager.token) pass("2b. Manager login");
    else {
      fail("2b. Manager login", JSON.stringify(manager.body));
      return;
    }
    if (cashier.status === 200 && cashier.token) pass("2c. Cashier login");
    else {
      fail("2c. Cashier login", JSON.stringify(cashier.body));
      return;
    }

    const [managerSuppliers, cashierSuppliers, managerPo, cashierPo] =
      await Promise.all([
        req("/owner/suppliers", { token: manager.token }),
        req("/owner/suppliers", { token: cashier.token }),
        req("/owner/purchase-orders", { token: manager.token }),
        req("/owner/purchase-orders", { token: cashier.token }),
      ]);
    if (
      managerSuppliers.status === 403 &&
      cashierSuppliers.status === 403 &&
      managerPo.status === 403 &&
      cashierPo.status === 403
    ) {
      pass("3. Manager/Cashier supplier and PO access is 403");
    } else {
      fail(
        "3. Manager/Cashier supplier and PO access is 403",
        JSON.stringify({
          managerSuppliers: managerSuppliers.status,
          cashierSuppliers: cashierSuppliers.status,
          managerPo: managerPo.status,
          cashierPo: cashierPo.status,
        }),
      );
    }

    const productSearch = await req("/products?q=Napa&limit=1", {
      token: owner.token,
    });
    const product = Array.isArray(productSearch.body.data)
      ? asRecord(productSearch.body.data[0])
      : null;
    const productId = typeof product?.id === "string" ? product.id : null;
    if (!productId) {
      fail("4. Seed product available", JSON.stringify(productSearch.body));
      return;
    }
    pass("4. Seed product available", productId);
    const stockBefore = await stockFor(owner.tenantId, productId, owner.storeId);

    const stamp = Date.now();
    const supplierName = `M6Q Supplier ${stamp}`;
    const registrationNumber = `M6Q-${stamp}`;
    const createSupplier = await req("/owner/suppliers", {
      method: "POST",
      token: owner.token,
      body: {
        name: supplierName,
        contactPerson: "M6Q Contact",
        phone: `017${String(stamp).slice(-8)}`,
        email: `m6q-${stamp}@example.com`,
        city: "Dhaka",
        registrationNumber,
        paymentTerms: "Net 30",
        leadTimeDays: 5,
        minOrderValue: 100,
        status: "ACTIVE",
        expiryReturnsAccepted: true,
        minDaysBeforeExpiry: 90,
        preferredContact: "EMAIL",
      },
    });
    const supplier = asRecord(createSupplier.body.data);
    createdSupplierId = typeof supplier?.id === "string" ? supplier.id : null;
    if (
      createSupplier.status === 201 &&
      createdSupplierId &&
      supplier?.tenantId === owner.tenantId &&
      supplier?.minOrderValue === 100
    ) {
      pass("5a. Owner creates tenant supplier", createdSupplierId);
    } else {
      fail("5a. Owner creates tenant supplier", JSON.stringify(createSupplier.body));
      return;
    }

    const duplicateSupplier = await req("/owner/suppliers", {
      method: "POST",
      token: owner.token,
      body: {
        name: supplierName,
        contactPerson: "Duplicate",
        phone: "01700000000",
      },
    });
    if (duplicateSupplier.status === 409) {
      pass("5b. Duplicate tenant supplier is 409");
    } else {
      fail("5b. Duplicate tenant supplier is 409", `${duplicateSupplier.status}`);
    }

    const patchSupplier = await req(`/owner/suppliers/${createdSupplierId}`, {
      method: "PATCH",
      token: owner.token,
      body: { status: "HOLD", notes: "Batch Q smoke" },
    });
    const patchedSupplier = asRecord(patchSupplier.body.data);
    const supplierList = await req(
      `/owner/suppliers?q=${encodeURIComponent(supplierName)}&status=HOLD&limit=5`,
      { token: owner.token },
    );
    const listedSuppliers = Array.isArray(supplierList.body.data)
      ? supplierList.body.data.map(asRecord)
      : [];
    const supplierMeta = asRecord(supplierList.body.meta);
    if (
      patchSupplier.status === 200 &&
      patchedSupplier?.status === "HOLD" &&
      supplierList.status === 200 &&
      supplierMeta?.total === 1 &&
      listedSuppliers[0]?.id === createdSupplierId
    ) {
      pass("5c. Supplier get/patch/search/status/pagination");
    } else {
      fail(
        "5c. Supplier get/patch/search/status/pagination",
        JSON.stringify({ patch: patchSupplier.body, list: supplierList.body }),
      );
    }

    const supplierGet = await req(`/owner/suppliers/${createdSupplierId}`, {
      token: owner.token,
    });
    const foreignTenant = await prisma.tenant.create({
      data: {
        name: `M6Q Foreign ${stamp}`,
        slug: `m6q-foreign-${stamp}`,
        suppliers: {
          create: {
            name: `Foreign Supplier ${stamp}`,
            contactPerson: "Foreign Contact",
            phone: "01900000000",
          },
        },
        products: { create: { name: `Foreign Product ${stamp}` } },
      },
      include: {
        suppliers: { select: { id: true } },
        products: { select: { id: true } },
      },
    });
    foreignTenantId = foreignTenant.id;
    const foreignSupplierId = foreignTenant.suppliers[0]!.id;
    const foreignProductId = foreignTenant.products[0]!.id;
    const [foreignSupplierGet, foreignSupplierPo, foreignProductPo] =
      await Promise.all([
        req(`/owner/suppliers/${foreignSupplierId}`, { token: owner.token }),
        req("/owner/purchase-orders", {
          method: "POST",
          token: owner.token,
          body: {
            supplierId: foreignSupplierId,
            lines: [{ productId, qtyOrdered: 1, costPerBase: 1 }],
          },
        }),
        req("/owner/purchase-orders", {
          method: "POST",
          token: owner.token,
          body: {
            supplierId: createdSupplierId,
            lines: [{ productId: foreignProductId, qtyOrdered: 1, costPerBase: 1 }],
          },
        }),
      ]);
    if (
      supplierGet.status === 200 &&
      asRecord(supplierGet.body.data)?.id &&
      foreignSupplierGet.status === 404 &&
      foreignSupplierPo.status === 404 &&
      foreignProductPo.status === 400
    ) {
      pass("5d. Supplier and PO relations are tenant-scoped");
    } else {
      fail(
        "5d. Supplier and PO relations are tenant-scoped",
        JSON.stringify({
          own: supplierGet.status,
          foreignGet: foreignSupplierGet.status,
          foreignSupplierPo: foreignSupplierPo.status,
          foreignProductPo: foreignProductPo.status,
        }),
      );
    }

    const createDraft = await req("/owner/purchase-orders", {
      method: "POST",
      token: owner.token,
      body: {
        supplierId: createdSupplierId,
        status: "DRAFT",
        reference: `draft-${stamp}`,
        estimatedTax: 2.5,
        lines: [{ productId, qtyOrdered: 10, costPerBase: 1.25 }],
      },
    });
    const draft = asRecord(createDraft.body.data);
    const draftId = typeof draft?.id === "string" ? draft.id : null;
    const draftNumber =
      typeof draft?.poNumber === "string" ? draft.poNumber : null;
    if (draftId) createdPoIds.push(draftId);
    if (
      createDraft.status === 201 &&
      draftId &&
      draftNumber &&
      /^PO-\d{6}-\d{4}$/.test(draftNumber) &&
      draft?.status === "DRAFT" &&
      draft?.estimatedSubtotal === 12.5 &&
      draft?.estimatedTax === 2.5 &&
      draft?.estimatedTotal === 15
    ) {
      pass("6a. Save as Draft creates calculated PO", draftNumber);
    } else {
      fail("6a. Save as Draft creates calculated PO", JSON.stringify(createDraft.body));
      return;
    }

    const draftList = await req(
      `/owner/purchase-orders?q=${encodeURIComponent(draftNumber)}&status=DRAFT&supplierId=${createdSupplierId}&limit=5`,
      { token: owner.token },
    );
    const poRows = Array.isArray(draftList.body.data)
      ? draftList.body.data.map(asRecord)
      : [];
    const poMeta = asRecord(draftList.body.meta);
    const poKpis = asRecord(poMeta?.kpis);
    if (
      draftList.status === 200 &&
      poMeta?.total === 1 &&
      poRows[0]?.id === draftId &&
      poKpis &&
      typeof poKpis.openValue === "number"
    ) {
      pass("6b. PO list filters, meta.total, and KPIs");
    } else {
      fail("6b. PO list filters, meta.total, and KPIs", JSON.stringify(draftList.body));
    }

    const draftGet = await req(`/owner/purchase-orders/${draftId}`, {
      token: owner.token,
    });
    const draftDetail = asRecord(draftGet.body.data);
    const draftLines = Array.isArray(draftDetail?.lines)
      ? draftDetail.lines.map(asRecord)
      : [];
    if (
      draftGet.status === 200 &&
      draftLines.length === 1 &&
      asRecord(draftLines[0]?.product)?.id === productId
    ) {
      pass("6c. PO detail includes product lines");
    } else {
      fail("6c. PO detail includes product lines", JSON.stringify(draftGet.body));
    }

    const sendDraft = await req(`/owner/purchase-orders/${draftId}`, {
      method: "PATCH",
      token: owner.token,
      body: {
        status: "SENT",
        reference: `sent-${stamp}`,
        estimatedTax: 2,
        lines: [{ productId, qtyOrdered: 12, costPerBase: 1.5 }],
      },
    });
    const sentDraft = asRecord(sendDraft.body.data);
    if (
      sendDraft.status === 200 &&
      sentDraft?.status === "SENT" &&
      sentDraft?.estimatedSubtotal === 18 &&
      sentDraft?.estimatedTax === 2 &&
      sentDraft?.estimatedTotal === 20
    ) {
      pass("7a. Draft lines update and transition to SENT");
    } else {
      fail("7a. Draft lines update and transition to SENT", JSON.stringify(sendDraft.body));
    }

    const mutateSent = await req(`/owner/purchase-orders/${draftId}`, {
      method: "PATCH",
      token: owner.token,
      body: { reference: "must-not-change" },
    });
    if (mutateSent.status === 409) {
      pass("7b. Non-draft PO mutation is 409");
    } else {
      fail("7b. Non-draft PO mutation is 409", JSON.stringify(mutateSent.body));
    }

    const concurrentCreates = await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        req("/owner/purchase-orders", {
          method: "POST",
          token: owner.token!,
          body: {
            supplierId: createdSupplierId,
            reference: `primary-${stamp}-${index}`,
            lines: [{ productId, qtyOrdered: 3, costPerBase: 2 }],
          },
        }),
      ),
    );
    const concurrentRows = concurrentCreates.map((response) =>
      asRecord(response.body.data),
    );
    for (const row of concurrentRows) {
      if (typeof row?.id === "string") createdPoIds.push(row.id);
    }
    const concurrentNumbers = concurrentRows
      .map((row) => row?.poNumber)
      .filter((value): value is string => typeof value === "string");
    if (
      concurrentCreates.every((response) => response.status === 201) &&
      concurrentRows.every((row) => row?.status === "SENT") &&
      concurrentNumbers.length === 5 &&
      new Set(concurrentNumbers).size === 5 &&
      !concurrentNumbers.includes(draftNumber)
    ) {
      pass("7c. Concurrent primary creates default to unique SENT POs");
    } else {
      fail(
        "7c. Concurrent primary creates default to unique SENT POs",
        JSON.stringify(
          concurrentCreates.map((response) => ({
            status: response.status,
            body: response.body,
          })),
        ),
      );
    }

    const stockAfter = await stockFor(owner.tenantId, productId, owner.storeId);
    if (stockAfter === stockBefore) {
      pass("8. Supplier/PO operations do not change inventory", `${stockBefore}`);
    } else {
      fail("8. Supplier/PO operations do not change inventory", `${stockBefore} → ${stockAfter}`);
    }

    const [receiptCount, manifestCount] = await Promise.all([
      prisma.goodsReceipt.count({
        where: { purchaseOrderId: { in: createdPoIds } },
      }),
      prisma.returnManifest.count({
        where: { supplierId: createdSupplierId },
      }),
    ]);
    if (receiptCount === 0 && manifestCount === 0) {
      pass("9. Batch Q operations create no GRNs or return manifests");
    } else {
      fail(
        "9. Batch Q operations create no GRNs or return manifests",
        `receipts=${receiptCount} manifests=${manifestCount}`,
      );
    }
  } finally {
    if (createdPoIds.length > 0) {
      await prisma.purchaseOrder.deleteMany({ where: { id: { in: createdPoIds } } });
    }
    if (createdSupplierId) {
      await prisma.supplier.deleteMany({ where: { id: createdSupplierId } });
    }
    if (foreignTenantId) {
      await prisma.tenant.deleteMany({ where: { id: foreignTenantId } });
    }
  }
}

async function finish(): Promise<void> {
  const failed = results.filter((result) => !result.ok);
  console.log("\n--- Summary ---");
  console.log(`Passed: ${results.length - failed.length}/${results.length}`);
  if (failed.length > 0) {
    for (const result of failed) {
      console.log(`  - ${result.name}: ${result.detail}`);
    }
    process.exitCode = 1;
  } else {
    console.log("All checklist items passed.");
  }
}

main()
  .catch((error) => {
    fail("Unexpected smoke error", error instanceof Error ? error.message : String(error));
  })
  .finally(finish);
