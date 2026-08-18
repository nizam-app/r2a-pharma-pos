/**
 * Milestone 6 Batch R smoke — OWNER-only GRN and supplier return APIs.
 *
 * Usage (server must already be running):
 *   npm run smoke:m6r -w @r2a/server
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { prisma } from "@r2a/database";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
dotenv.config({ path: path.join(repoRoot, ".env") });

const BASE = (process.env.BASE_URL || "http://localhost:8787").replace(/\/$/, "");
const API = `${BASE}/api/v1`;
const SEED = {
  ownerEmail: process.env.SEED_OWNER_EMAIL || "owner@demo.local",
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
  };
}

async function main(): Promise<void> {
  console.log(`M6R smoke → ${API}\n`);
  const batchIds: string[] = [];
  let supplierId: string | null = null;
  let purchaseOrderId: string | null = null;
  let manifestId: string | null = null;

  try {
    const health = await req("/health");
    if (health.status === 200 && asRecord(health.body.data)?.ok === true) {
      pass("1. Health envelope");
    } else {
      fail("1. Health envelope", JSON.stringify(health.body));
      return;
    }

    const [owner, cashier] = await Promise.all([
      login(SEED.ownerEmail),
      login(SEED.cashierEmail),
    ]);
    if (owner.status === 200 && owner.token && owner.tenantId) {
      pass("2a. Owner login");
    } else {
      fail("2a. Owner login", JSON.stringify(owner.body));
      return;
    }
    if (cashier.status === 200 && cashier.token) pass("2b. Cashier login");
    else {
      fail("2b. Cashier login", JSON.stringify(cashier.body));
      return;
    }

    const productResponse = await req("/products?q=Napa&limit=1", {
      token: owner.token,
    });
    const product = Array.isArray(productResponse.body.data)
      ? asRecord(productResponse.body.data[0])
      : null;
    const productId = typeof product?.id === "string" ? product.id : null;
    if (!productId) {
      fail("3. Seed product available", JSON.stringify(productResponse.body));
      return;
    }
    pass("3. Seed product available", productId);

    const stamp = Date.now();
    const supplierResponse = await req("/owner/suppliers", {
      method: "POST",
      token: owner.token,
      body: {
        name: `M6R Supplier ${stamp}`,
        contactPerson: "M6R Contact",
        phone: `018${String(stamp).slice(-8)}`,
        expiryReturnsAccepted: true,
        minDaysBeforeExpiry: 90,
      },
    });
    const supplier = asRecord(supplierResponse.body.data);
    supplierId = typeof supplier?.id === "string" ? supplier.id : null;
    if (supplierResponse.status === 201 && supplierId) {
      pass("4. Return-enabled supplier created", supplierId);
    } else {
      fail("4. Return-enabled supplier created", JSON.stringify(supplierResponse.body));
      return;
    }

    const poResponse = await req("/owner/purchase-orders", {
      method: "POST",
      token: owner.token,
      body: {
        supplierId,
        reference: `m6r-${stamp}`,
        lines: [{ productId, qtyOrdered: 10, costPerBase: 1.5 }],
      },
    });
    const po = asRecord(poResponse.body.data);
    const poLines = Array.isArray(po?.lines) ? po.lines.map(asRecord) : [];
    purchaseOrderId = typeof po?.id === "string" ? po.id : null;
    const poLineId = typeof poLines[0]?.id === "string" ? poLines[0].id : null;
    if (poResponse.status === 201 && purchaseOrderId && poLineId) {
      pass("5. Sent purchase order created", String(po.poNumber));
    } else {
      fail("5. Sent purchase order created", JSON.stringify(poResponse.body));
      return;
    }

    const cashierChecks = await Promise.all([
      req(`/owner/purchase-orders/${purchaseOrderId}/receipts`, {
        method: "POST",
        token: cashier.token,
        body: { lines: [] },
      }),
      req("/owner/returns/queue", { token: cashier.token }),
      req("/owner/return-manifests", {
        method: "POST",
        token: cashier.token,
        body: { supplierId, lines: [] },
      }),
    ]);
    if (cashierChecks.every((response) => response.status === 403)) {
      pass("6. Cashier GRN and return access is 403");
    } else {
      fail(
        "6. Cashier GRN and return access is 403",
        cashierChecks.map((response) => response.status).join(","),
      );
    }

    const firstBatchNumber = `M6R-${stamp}-A`;
    const firstReceipt = await req(
      `/owner/purchase-orders/${purchaseOrderId}/receipts`,
      {
        method: "POST",
        token: owner.token,
        body: {
          supplierInvoiceRef: `INV-${stamp}`,
          lines: [
            {
              purchaseOrderLineId: poLineId,
              productId,
              qty: 6,
              batchNumber: firstBatchNumber,
              expiryDate: "2027-02-28",
              costPerBase: 1.5,
              sellPerBase: 2,
            },
          ],
        },
      },
    );
    const firstData = asRecord(firstReceipt.body.data);
    const firstReceiptData = asRecord(firstData?.receipt);
    const firstReceiptLines = Array.isArray(firstReceiptData?.lines)
      ? firstReceiptData.lines.map(asRecord)
      : [];
    const firstBatch = asRecord(firstReceiptLines[0]?.batch);
    const firstBatchId = typeof firstBatch?.id === "string" ? firstBatch.id : null;
    if (firstBatchId) batchIds.push(firstBatchId);
    const firstPo = asRecord(firstData?.purchaseOrder);
    if (
      firstReceipt.status === 201 &&
      firstBatchId &&
      /^GRN-\d{4}-\d{4}$/.test(String(firstReceiptData?.grnNumber)) &&
      firstPo?.status === "PARTIALLY_RECEIVED" &&
      firstBatch?.quantityOnHand === 6 &&
      firstBatch?.supplierId === supplierId &&
      firstBatch?.returnStatus === "ELIGIBLE"
    ) {
      pass("7. Partial GRN creates linked eligible lot and updates PO");
    } else {
      fail("7. Partial GRN creates linked eligible lot and updates PO", JSON.stringify(firstReceipt.body));
      return;
    }

    const overReceipt = await req(
      `/owner/purchase-orders/${purchaseOrderId}/receipts`,
      {
        method: "POST",
        token: owner.token,
        body: {
          lines: [
            {
              purchaseOrderLineId: poLineId,
              productId,
              qty: 5,
              batchNumber: `M6R-${stamp}-OVER`,
              expiryDate: "2027-03-31",
              costPerBase: 1.5,
              sellPerBase: 2,
            },
          ],
        },
      },
    );
    if (overReceipt.status === 409) pass("8. Over-receive is rejected");
    else fail("8. Over-receive is rejected", JSON.stringify(overReceipt.body));

    const secondReceipt = await req(
      `/owner/purchase-orders/${purchaseOrderId}/receipts`,
      {
        method: "POST",
        token: owner.token,
        body: {
          lines: [
            {
              purchaseOrderLineId: poLineId,
              productId,
              qty: 4,
              batchNumber: `M6R-${stamp}-B`,
              expiryDate: "2027-04-30",
              costPerBase: 1.5,
              sellPerBase: 2,
            },
          ],
        },
      },
    );
    const secondData = asRecord(secondReceipt.body.data);
    const secondPo = asRecord(secondData?.purchaseOrder);
    const secondReceiptData = asRecord(secondData?.receipt);
    const secondLines = Array.isArray(secondReceiptData?.lines)
      ? secondReceiptData.lines.map(asRecord)
      : [];
    const secondBatch = asRecord(secondLines[0]?.batch);
    if (typeof secondBatch?.id === "string") batchIds.push(secondBatch.id);
    if (secondReceipt.status === 201 && secondPo?.status === "RECEIVED") {
      pass("9. Final GRN moves PO to RECEIVED");
    } else {
      fail("9. Final GRN moves PO to RECEIVED", JSON.stringify(secondReceipt.body));
    }

    const receiveEvent = firstBatchId
      ? await prisma.inventoryEvent.findFirst({
          where: { batchId: firstBatchId, reasonCode: "PURCHASE_ORDER_RECEIPT" },
        })
      : null;
    if (
      receiveEvent?.type === "RECEIVE" &&
      receiveEvent.quantityBaseChange === 6 &&
      receiveEvent.quantityAfter === 6
    ) {
      pass("10. GRN writes RECEIVE inventory event");
    } else {
      fail("10. GRN writes RECEIVE inventory event", JSON.stringify(receiveEvent));
    }

    const queue = await req(
      `/owner/returns/queue?supplierId=${supplierId}&returnStatus=ELIGIBLE&limit=10`,
      { token: owner.token },
    );
    const queueRows = Array.isArray(queue.body.data)
      ? queue.body.data.map(asRecord)
      : [];
    const queueMeta = asRecord(queue.body.meta);
    if (
      queue.status === 200 &&
      Number(queueMeta?.total) >= 2 &&
      queueRows.some((row) => row?.id === firstBatchId)
    ) {
      pass("11. Return queue filters eligible supplier lots");
    } else {
      fail("11. Return queue filters eligible supplier lots", JSON.stringify(queue.body));
    }

    const manifestResponse = await req("/owner/return-manifests", {
      method: "POST",
      token: owner.token,
      body: {
        supplierId,
        notes: "M6R smoke manifest",
        lines: [{ batchId: firstBatchId, returnQty: 3 }],
      },
    });
    const manifest = asRecord(manifestResponse.body.data);
    manifestId = typeof manifest?.id === "string" ? manifest.id : null;
    const manifestLines = Array.isArray(manifest?.lines)
      ? manifest.lines.map(asRecord)
      : [];
    if (
      manifestResponse.status === 201 &&
      manifestId &&
      /^SRM-\d{6}-\d{4}$/.test(String(manifest?.srmNumber)) &&
      manifest?.status === "PREPARED" &&
      manifestLines[0]?.returnQty === 3
    ) {
      pass("12. Eligible lot prepares return manifest", String(manifest.srmNumber));
    } else {
      fail("12. Eligible lot prepares return manifest", JSON.stringify(manifestResponse.body));
      return;
    }

    const preparedBatch = await prisma.batch.findUnique({
      where: { id: firstBatchId! },
    });
    const manifestGet = await req(`/owner/return-manifests/${manifestId}`, {
      token: owner.token,
    });
    if (
      preparedBatch?.returnStatus === "MANIFEST_PREPARED" &&
      preparedBatch.quantityOnHand === 6 &&
      manifestGet.status === 200
    ) {
      pass("13. Prepare marks batch without changing stock");
    } else {
      fail(
        "13. Prepare marks batch without changing stock",
        JSON.stringify({ preparedBatch, manifestGet: manifestGet.body }),
      );
    }

    const operationId = `m6r-dispatch-${stamp}`;
    const dispatchBody = {
      operationId,
      dispatchReference: `DSP-${stamp}`,
      dispatchNotes: "M6R smoke dispatch",
    };
    const dispatch = await req(`/owner/return-manifests/${manifestId}/dispatch`, {
      method: "POST",
      token: owner.token,
      body: dispatchBody,
    });
    const dispatched = asRecord(dispatch.body.data);
    const dispatchMeta = asRecord(dispatch.body.meta);
    const stockAfterDispatch = await prisma.batch.findUnique({
      where: { id: firstBatchId! },
    });
    const dispatchEvent = await prisma.inventoryEvent.findFirst({
      where: {
        batchId: firstBatchId,
        reasonCode: "SUPPLIER_RETURN_DISPATCH",
      },
    });
    if (
      dispatch.status === 200 &&
      dispatched?.status === "DISPATCHED" &&
      dispatchMeta?.idempotent === false &&
      stockAfterDispatch?.quantityOnHand === 3 &&
      dispatchEvent?.quantityBaseChange === -3 &&
      dispatchEvent.quantityAfter === 3
    ) {
      pass("14. Dispatch posts one signed stock adjustment");
    } else {
      fail(
        "14. Dispatch posts one signed stock adjustment",
        JSON.stringify({ response: dispatch.body, stockAfterDispatch, dispatchEvent }),
      );
    }

    const replay = await req(`/owner/return-manifests/${manifestId}/dispatch`, {
      method: "POST",
      token: owner.token,
      body: dispatchBody,
    });
    const replayMeta = asRecord(replay.body.meta);
    const stockAfterReplay = await prisma.batch.findUnique({
      where: { id: firstBatchId! },
    });
    const dispatchEventCount = await prisma.inventoryEvent.count({
      where: {
        batchId: firstBatchId,
        reasonCode: "SUPPLIER_RETURN_DISPATCH",
      },
    });
    if (
      replay.status === 200 &&
      replayMeta?.idempotent === true &&
      stockAfterReplay?.quantityOnHand === 3 &&
      dispatchEventCount === 1
    ) {
      pass("15. Dispatch operationId replay is idempotent");
    } else {
      fail(
        "15. Dispatch operationId replay is idempotent",
        JSON.stringify({ response: replay.body, stockAfterReplay, dispatchEventCount }),
      );
    }

    const decision = await req(`/owner/return-manifests/${manifestId}/decision`, {
      method: "POST",
      token: owner.token,
      body: {
        decision: "ACCEPTED",
        supplierReference: `CN-${stamp}`,
        notes: "Accepted in M6R smoke",
      },
    });
    const decided = asRecord(decision.body.data);
    const complete = await req(`/owner/return-manifests/${manifestId}/complete`, {
      method: "POST",
      token: owner.token,
      body: {},
    });
    const completed = asRecord(complete.body.data);
    const finalBatch = await prisma.batch.findUnique({ where: { id: firstBatchId! } });
    const completedReplay = await req(
      `/owner/return-manifests/${manifestId}/dispatch`,
      {
        method: "POST",
        token: owner.token,
        body: dispatchBody,
      },
    );
    const completedReplayMeta = asRecord(completedReplay.body.meta);
    if (
      decision.status === 200 &&
      decided?.status === "ACCEPTED" &&
      complete.status === 200 &&
      completed?.status === "COMPLETED" &&
      finalBatch?.quantityOnHand === 3 &&
      completedReplay.status === 200 &&
      completedReplayMeta?.idempotent === true
    ) {
      pass("16. Completed return keeps dispatch replay idempotent");
    } else {
      fail(
        "16. Completed return keeps dispatch replay idempotent",
        JSON.stringify({
          decision: decision.body,
          complete: complete.body,
          finalBatch,
          completedReplay: completedReplay.body,
        }),
      );
    }
  } finally {
    if (manifestId) {
      await prisma.returnManifest.deleteMany({ where: { id: manifestId } });
    }
    if (batchIds.length > 0) {
      await prisma.inventoryEvent.deleteMany({ where: { batchId: { in: batchIds } } });
      await prisma.goodsReceiptLine.deleteMany({ where: { batchId: { in: batchIds } } });
      await prisma.batch.deleteMany({ where: { id: { in: batchIds } } });
    }
    if (purchaseOrderId) {
      await prisma.goodsReceipt.deleteMany({ where: { purchaseOrderId } });
      await prisma.purchaseOrder.deleteMany({ where: { id: purchaseOrderId } });
    }
    if (supplierId) {
      await prisma.supplier.deleteMany({ where: { id: supplierId } });
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
