/**
 * Batch Z — Slice 3 exit verification (automated checks).
 * Run: npm run smoke:m3z -w @r2a/desktop
 *
 * Requires cloud API at BASE_URL (default http://127.0.0.1:8787).
 * Does not invent Card/MFS detail UI or call M4 /sync/ingest.
 * Does not invoke real printer IPC (print stub only).
 *
 * Note: do not import modules that pull `import.meta.env` (e.g. saleIngest → api → env).
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  calculateLoyaltySettlement,
  LOYALTY_EARN_TAKA_PER_POINT,
  LOYALTY_REDEEM_ELIGIBILITY_MIN,
} from "../src/lib/loyaltyCalc";
import {
  PRINT_STUB_DELAY_MS,
  armPrintStubFailOnce,
  isPrintBusy,
  isPrintReady,
} from "../src/lib/printStub";

const BASE =
  process.env.BASE_URL?.replace(/\/$/, "") ||
  process.env.VITE_API_BASE_URL?.replace(/\/$/, "") ||
  "http://127.0.0.1:8787";

const EMAIL = process.env.SEED_OWNER_EMAIL?.trim() || "owner@demo.local";
const PASSWORD = process.env.SEED_OWNER_PASSWORD?.trim() || "ChangeMe123!";

type Envelope<T> = {
  status: string;
  message: string;
  data?: T;
  meta?: { idempotent?: boolean };
};

type AuthData = {
  accessToken: string;
  user?: { email?: string; role?: string; storeId?: string | null };
};

type Product = {
  id: string;
  name: string;
};

type BatchRow = {
  id: string;
  productId: string;
  batchNumber: string;
  quantityOnHand: number;
  expiryDate?: string;
  sellPerBase?: number;
};

type SaleRow = {
  id?: string;
  eventId?: string;
  total?: number;
  subtotal?: number;
  discount?: number;
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "..", "src");

function readSrc(rel: string): string {
  return readFileSync(join(SRC, rel), "utf8");
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function api<T>(
  path: string,
  opts?: { method?: string; body?: unknown; token?: string },
): Promise<{ status: number; data: T; meta?: Envelope<T>["meta"] }> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (opts?.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts?.body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE}${path}`, {
    method: opts?.method ?? "GET",
    headers,
    body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const json = (await res.json()) as Envelope<T>;
  if (!res.ok || json.status === "fail" || json.status === "error") {
    throw new Error(
      `${opts?.method ?? "GET"} ${path} → ${res.status}: ${json.message ?? res.statusText}`,
    );
  }
  assert(json.data !== undefined, `${path} missing data`);
  return { status: res.status, data: json.data, meta: json.meta };
}

function checkLoyaltyEarnLock(): void {
  assert(
    LOYALTY_EARN_TAKA_PER_POINT === 100,
    "earn lock must remain 1 pt / ৳100",
  );
  const covered = calculateLoyaltySettlement({
    previousBalance: 120,
    redeemedPoints: 12,
    netPayableBeforeLoyaltyRedeem: 12,
    amountDue: 0,
  });
  assert(covered.earned === 0, "full loyalty cover → earned 0");
  assert(covered.fullyCoveredByLoyalty, "fullyCoveredByLoyalty");

  const cashPath = calculateLoyaltySettlement({
    previousBalance: 120,
    redeemedPoints: 0,
    netPayableBeforeLoyaltyRedeem: 250,
    amountDue: 250,
  });
  assert(cashPath.earned === 2, "250 → 2 pts earned (floor/100)");
  console.log("  ✓ loyalty earn lock 1/100 (cash + full-cover)");
}

function checkPrintStubMachine(): void {
  assert(PRINT_STUB_DELAY_MS > 0, "print stub delay configured");
  assert(isPrintBusy("printing") && isPrintBusy("retrying"), "busy phases");
  assert(
    !isPrintBusy("printed") && !isPrintBusy("failed") && !isPrintBusy("idle"),
    "ready phases not busy",
  );
  assert(isPrintReady("printed") && isPrintReady("failed"), "ready when done");
  assert(typeof armPrintStubFailOnce === "function", "QA fail-once arm");

  const stub = readSrc("lib/printStub.ts");
  assert(
    stub.includes("TODO(real printer IPC)"),
    "printStub must document real Tauri printer IPC TODO",
  );
  assert(
    stub.includes("58mm") || stub.includes("58 mm"),
    "shared 58mm sample must be noted",
  );
  console.log("  ✓ print stub state helpers + IPC TODO");
}

function checkStaticSlice3Guards(): void {
  const posIndex = readSrc("features/pos/index.ts");
  for (const name of [
    "PaymentSelectMethodModal",
    "CashPaymentModal",
    "SaleCompletedScreen",
    "CompleteSaleZeroPayModal",
    "RedeemLoyaltyModal",
  ]) {
    assert(posIndex.includes(name), `pos export missing ${name}`);
  }

  const app = readSrc("App.tsx");
  assert(
    app.includes("paymentSelectMethod") &&
      app.includes("PaymentSelectMethodModal"),
    "Continue without / tender opens Payment Select Method",
  );
  assert(
    app.includes("cashPayment") && app.includes("CashPaymentModal"),
    "Cash opens Cash Payment modal",
  );
  assert(
    app.includes("onCompleteCashPayment") &&
      (app.includes("completeSaleOrQueue") || app.includes("ingestSale")),
    "Cash complete online-ingests CASH (= amount due)",
  );
  assert(
    app.includes("cashSettlement") && app.includes("printPhase"),
    "Sale Completed carries cash settlement + print phase",
  );
  assert(
    app.includes("ReceiptPreviewPanel") ||
      readSrc("features/pos/SaleCompletedScreen.tsx").includes(
        "ReceiptPreviewPanel",
      ),
    "Sale Completed shows inline Receipt Preview beside settlement",
  );
  assert(
    app.includes("startPrintCycle") && app.includes('"printing"'),
    "print stub auto-starts on Sale Completed (parallel with preview)",
  );
  assert(
    app.includes("payment detail — next when screens are shared"),
    "Card/MFS must toast-gate detail UI",
  );
  assert(!/sync\/ingest/.test(app), "App must not call M4 sync/ingest");
  assert(
    !/CardPaymentModal|MfsPaymentModal|CardTender|MfsTender/.test(app),
    "Card/MFS detail tender modals must not be invented",
  );

  const paymentSelect = readSrc("features/pos/PaymentSelectMethodModal.tsx");
  assert(
    paymentSelect.includes("CASH") &&
      paymentSelect.includes("CARD") &&
      paymentSelect.includes("MFS"),
    "Payment Select Method shows Cash / Card / MFS",
  );
  assert(
    paymentSelect.includes('event.key === "Tab"'),
    "Payment Select Method blocks Tab",
  );

  const cashPayment = readSrc("features/pos/CashPaymentModal.tsx");
  assert(
    cashPayment.includes("Exact Amount") &&
      cashPayment.includes("Change Due") &&
      cashPayment.includes("Cash Received"),
    "Cash Payment shows Exact Amount / Due / Received / Change",
  );

  const completed = readSrc("features/pos/SaleCompletedScreen.tsx");
  assert(
    completed.includes("Reprint Receipt") &&
      completed.includes("Retry Print") &&
      completed.includes("Printing"),
    "Sale Completed must render print stub states",
  );
  assert(
    completed.includes("Receipt could not be printed"),
    "print fail banner copy present",
  );

  const footer = readSrc("features/shell/Footer.tsx");
  assert(footer.includes("SYSTEM BUSY"), "footer SYSTEM BUSY while printing");
  assert(footer.includes("READY"), "footer READY when printed");

  const header = readSrc("features/shell/Header.tsx");
  assert(header.includes("PharmaSync POS"), "chrome brand PharmaSync POS");

  const shell = readSrc("features/shell/AppShell.tsx");
  assert(
    shell.includes("Search Results - Napa"),
    "chrome lock Search Results - Napa",
  );

  const selectCustomer = readSrc("features/pos/SelectCustomerModal.tsx");
  assert(
    !/>\s*Baki\s*</.test(selectCustomer) &&
      !/["'`]Baki["'`]/.test(selectCustomer) &&
      !/Outstanding.*Baki|Baki balance/i.test(selectCustomer),
    "Select Customer must not show Baki UI",
  );

  const completeZero = readSrc("features/pos/CompleteSaleZeroPayModal.tsx");
  assert(
    completeZero.includes("No Baki") ||
      completeZero.includes("Baki intentionally omitted"),
    "Complete Sale documents no-Baki lock",
  );

  const ingest = readSrc("lib/saleIngest.ts");
  assert(ingest.includes("/api/v1/sales/ingest"), "uses sales/ingest");
  assert(
    ingest.includes("amount due") || ingest.includes("not cash received"),
    "cash payment amount = due (not received)",
  );

  console.log("  ✓ Slice 3 wiring + print stub + no Card/MFS/Baki/M4 invent");
}

async function checkHealth(): Promise<void> {
  const { data } = await api<{ ok?: boolean }>("/api/v1/health");
  assert(data != null, "health empty");
  console.log("  ✓ health", BASE);
}

async function checkLogin(): Promise<{ token: string; storeId: string }> {
  const { data } = await api<AuthData>("/api/v1/auth/login", {
    method: "POST",
    body: { email: EMAIL, password: PASSWORD },
  });
  assert(data.accessToken, "no accessToken");
  assert(data.user?.storeId, "owner session missing storeId");
  console.log("  ✓ login", EMAIL, data.user?.role ?? "");
  return { token: data.accessToken, storeId: data.user!.storeId! };
}

async function checkCashIngestLive(
  token: string,
  storeId: string,
): Promise<void> {
  const { data: products } = await api<Product[]>(
    `/api/v1/products?q=${encodeURIComponent("Napa")}&limit=20&offset=0`,
    { token },
  );
  assert(Array.isArray(products) && products.length > 0, "Napa search empty");
  const product = products[0]!;

  const { data: batches } = await api<BatchRow[]>(
    `/api/v1/batches?productId=${encodeURIComponent(product.id)}&limit=50&offset=0`,
    { token },
  );
  assert(Array.isArray(batches) && batches.length > 0, "Napa batches empty");
  const sellable = batches.find((b) => Number(b.quantityOnHand) > 0);
  assert(sellable, "no in-stock Napa batch");

  const unitPrice = Number(sellable!.sellPerBase ?? 1.2);
  const qty = 1;
  const lineTotal = unitPrice * qty;
  const eventId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `smoke-m3z-cash-${Date.now()}`;

  const body = {
    eventId,
    storeId,
    soldAt: new Date().toISOString(),
    subtotal: lineTotal,
    discount: 0,
    total: lineTotal,
    notes: "smoke:m3z walk-in cash;cash:recv=" + lineTotal.toFixed(2) + ";change=0.00",
    items: [
      {
        productId: product.id,
        batchId: sellable!.id,
        unitType: "PIECE" as const,
        unitQty: 1,
        quantityBase: 1,
        unitPrice,
        lineTotal,
      },
    ],
    payments: [{ method: "CASH" as const, amount: lineTotal }],
  };

  const { status, data: sale, meta } = await api<SaleRow>(
    "/api/v1/sales/ingest",
    { method: "POST", token, body },
  );
  assert(status === 201 || status === 200, `unexpected ingest status ${status}`);
  assert(Number(sale.total) === lineTotal, "cash ingest total = due");
  assert(Number(sale.discount) === 0, "walk-in cash discount 0");
  console.log(
    "  ✓ walk-in cash ingest",
    sale.eventId ?? eventId,
    `total=${sale.total}`,
    meta?.idempotent ? "(idempotent)" : "created",
  );
}

async function checkZeroPayStillWorks(
  token: string,
  storeId: string,
): Promise<void> {
  const { data: products } = await api<Product[]>(
    `/api/v1/products?q=${encodeURIComponent("Napa")}&limit=20&offset=0`,
    { token },
  );
  const product = products[0]!;
  const { data: batches } = await api<BatchRow[]>(
    `/api/v1/batches?productId=${encodeURIComponent(product.id)}&limit=50&offset=0`,
    { token },
  );
  const sellable = batches.find((b) => Number(b.quantityOnHand) > 0);
  assert(sellable, "no in-stock batch for zero-pay");

  const unitPrice = Number(sellable!.sellPerBase ?? 1.2);
  const lineTotal = unitPrice;
  const eventId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `smoke-m3z-zero-${Date.now()}`;

  const body = {
    eventId,
    storeId,
    soldAt: new Date().toISOString(),
    subtotal: lineTotal,
    discount: lineTotal,
    total: 0,
    notes: "smoke:m3z loyalty-cover shape;loyaltyRedeem:pts=stub",
    items: [
      {
        productId: product.id,
        batchId: sellable!.id,
        unitType: "PIECE" as const,
        unitQty: 1,
        quantityBase: 1,
        unitPrice,
        lineTotal,
      },
    ],
    payments: [{ method: "CASH" as const, amount: 0 }],
  };

  const { status, data: sale } = await api<SaleRow>("/api/v1/sales/ingest", {
    method: "POST",
    token,
    body,
  });
  assert(status === 201 || status === 200, `zero-pay status ${status}`);
  assert(Number(sale.total) === 0, "zero-pay total 0");
  console.log("  ✓ loyalty zero-pay ingest still works on shared shell path");
}

async function checkCustomerEligibility(token: string): Promise<void> {
  const { data } = await api<
    { name: string; loyaltyPoints?: number }[]
  >(`/api/v1/customers?q=${encodeURIComponent("Karim")}&limit=20&offset=0`, {
    token,
  });
  assert(Array.isArray(data) && data.length > 0, "Karim search empty — re-seed?");
  const karim = data.find((c) => /karim/i.test(c.name)) ?? data[0]!;
  assert(
    (karim.loyaltyPoints ?? 0) >= LOYALTY_REDEEM_ELIGIBILITY_MIN,
    "seed Karim should have ≥50 loyalty points",
  );
  console.log("  ✓ customer Karim pts ok for redeem path");
}

async function checkDesktopDevServer(): Promise<void> {
  const candidates = [
    process.env.DESKTOP_URL?.replace(/\/$/, ""),
    "http://localhost:1420",
    "http://127.0.0.1:1420",
  ].filter((u): u is string => Boolean(u));

  let lastErr: unknown;
  for (const url of candidates) {
    try {
      const res = await fetch(`${url}/`);
      assert(res.ok, `desktop ${url} → ${res.status}`);
      console.log("  ✓ desktop Vite", url);
      return;
    } catch (err) {
      lastErr = err;
    }
  }
  console.log(
    "  ~ desktop Vite not reachable (optional):",
    lastErr instanceof Error ? lastErr.message : lastErr,
  );
}

async function main() {
  console.log("smoke-m3z — Slice 3 exit verification");
  console.log("BASE_URL=", BASE);

  checkLoyaltyEarnLock();
  checkPrintStubMachine();
  checkStaticSlice3Guards();

  await checkHealth();
  const { token, storeId } = await checkLogin();
  await checkCustomerEligibility(token);
  await checkCashIngestLive(token, storeId);
  await checkZeroPayStillWorks(token, storeId);
  await checkDesktopDevServer();

  console.log("smoke-m3z PASS — Slice 3 automated checks green");
  console.log(
    "Manual UI path: Continue without → Payment → Cash → change → Sale Completed → print states; Card/MFS gated; walk-in cash; loyalty zero-pay; F2 New Sale",
  );
}

main().catch((err) => {
  console.error("smoke-m3z FAIL", err);
  process.exit(1);
});
