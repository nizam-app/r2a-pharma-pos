/**
 * Batch U — Slice 2 exit verification (automated checks).
 * Run: npm run smoke:m3u -w @r2a/desktop
 *
 * Requires cloud API at BASE_URL (default http://127.0.0.1:8787).
 * Does not invent Cash/Card/MFS detail tender modals or call M4 /sync/ingest.
 * Payment Select Method (Batch V) + Cash Payment (Batch W) allowed;
 * Card/MFS detail and Sale Completed cash shell (X+) stay gated.
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
  previewLoyaltyRedeem,
  settleLoyaltyForSale,
} from "../src/lib/loyaltyCalc";
import { acceptStubLoyaltyOtp } from "../src/lib/loyaltyRedeem";
import { acceptStubManagerPin } from "../src/lib/fefoOverrideAuth";

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

type Batch = {
  id: string;
  productId: string;
  batchNumber: string;
  expiryDate: string;
  quantityOnHand: number;
  sellPerBase: number;
};

type Customer = {
  id: string;
  name: string;
  phone?: string | null;
  loyaltyPoints?: number;
};

type SaleRow = {
  id?: string;
  eventId?: string;
  total?: number;
  subtotal?: number;
  discount?: number;
};

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "src");

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function readSrc(rel: string): string {
  return readFileSync(join(srcRoot, rel), "utf8");
}

async function api<T>(
  path: string,
  opts: { method?: string; body?: unknown; token?: string } = {},
): Promise<{ data: T; meta?: Envelope<T>["meta"]; status: number }> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const json = (await res.json()) as Envelope<T>;
  assert(res.ok, `${opts.method ?? "GET"} ${path} → ${res.status}: ${json.message}`);
  assert(json.data !== undefined, `${path}: missing data`);
  return { data: json.data, meta: json.meta, status: res.status };
}

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

function sellableFromExpiry(expiryDate: string, today: string): boolean {
  return expiryDate.slice(0, 10) >= today;
}

/** Mirrors buildZeroPayIngestPayload without importing saleIngest (avoids Vite env). */
function buildZeroPayBody(args: {
  eventId: string;
  storeId: string;
  customerId: string;
  productId: string;
  batchId: string;
  unitPrice: number;
  lineTotal: number;
  loyaltyPoints: number;
  loyaltyTaka: number;
}) {
  const discount = args.loyaltyTaka;
  const subtotal = args.lineTotal;
  const total = Math.max(0, subtotal - discount);
  return {
    eventId: args.eventId,
    storeId: args.storeId,
    customerId: args.customerId,
    subtotal,
    discount,
    total,
    notes: `loyaltyRedeem:${args.loyaltyPoints}pts=${args.loyaltyTaka.toFixed(2)}`,
    items: [
      {
        productId: args.productId,
        batchId: args.batchId,
        unitType: "PIECE" as const,
        unitQty: 1,
        quantityBase: 1,
        unitPrice: args.unitPrice,
        lineTotal: args.lineTotal,
      },
    ],
    payments: [{ method: "CASH" as const, amount: total }],
  };
}

function checkLoyaltyCalculator(): void {
  const low = previewLoyaltyRedeem(49, 200);
  assert(!low.eligible, "49 pts must be ineligible");
  assert(low.usablePoints === 0, "ineligible usable must be 0");

  const capped = previewLoyaltyRedeem(120, 85.9);
  assert(capped.eligible, "120 pts must be eligible");
  assert(capped.usablePoints === 85, "cap must floor sale total");
  assert(capped.usableTaka === 85, "1 pt = ৳1");

  const full = settleLoyaltyForSale({
    previousBalance: 120,
    applied: { points: 85, taka: 85, verifiedAt: new Date().toISOString() },
    cartSubtotal: 85,
  });
  assert(full.fullyCoveredByLoyalty, "full cover flag");
  assert(full.earned === 0, "full loyalty cover → earn 0");
  assert(full.used === 85, "used points");
  assert(full.currentBalance === 35, "120 − 85 + 0 = 35");

  const partial = calculateLoyaltySettlement({
    previousBalance: 200,
    redeemedPoints: 50,
    netPayableBeforeLoyaltyRedeem: 350,
    amountDue: 300,
  });
  assert(!partial.fullyCoveredByLoyalty, "partial not fully covered");
  assert(
    partial.earned === Math.floor(350 / LOYALTY_EARN_TAKA_PER_POINT),
    "earn = floor(merchandise/100)",
  );
  assert(partial.earned === 3, "350 → 3 pts earned");
  assert(partial.currentBalance === 200 - 50 + 3, "balance math");

  assert(LOYALTY_REDEEM_ELIGIBILITY_MIN === 50, "eligibility min locked at 50");
  assert(acceptStubLoyaltyOtp("123456"), "stub OTP any 6 digits");
  assert(!acceptStubLoyaltyOtp("12345"), "5 digits rejected");
  assert(acceptStubManagerPin("1234"), "stub manager PIN any 4 digits");
  assert(!acceptStubManagerPin("123"), "3-digit PIN rejected");

  console.log("  ✓ loyalty calculator (cap, threshold, earn, full-cover)");
}

function checkStaticSlice2Guards(): void {
  const posIndex = readSrc("features/pos/index.ts");
  for (const name of [
    "EditSaleItemModal",
    "ChangeBatchModal",
    "ManagerAuthorizationModal",
    "ConfirmDialog",
    "SelectCustomerModal",
    "RedeemLoyaltyModal",
    "VerifyLoyaltyOtpModal",
    "CompleteSaleZeroPayModal",
    "PaymentSelectMethodModal",
    "CashPaymentModal",
    "SaleCompletedScreen",
  ]) {
    assert(posIndex.includes(name), `pos export missing ${name}`);
  }

  const app = readSrc("App.tsx");
  assert(
    app.includes("paymentSelectMethod") &&
      app.includes("PaymentSelectMethodModal"),
    "continue-without / tender must open Payment Select Method",
  );
  assert(
    app.includes("cashPayment") && app.includes("CashPaymentModal"),
    "Cash must open Cash Payment modal (Batch W)",
  );
  assert(
    app.includes("onCompleteCashPayment") &&
      (app.includes("buildSaleIngestPayload") ||
        app.includes("ingestSale")),
    "Cash complete must online-ingest CASH (= amount due) for Sale Completed",
  );
  assert(
    app.includes("cashSettlement"),
    "Sale Completed must carry cash settlement variant (Batch X)",
  );
  assert(
    app.includes("payment detail — next when screens are shared") ||
      app.includes("CardPaymentModal"),
    "Card/MFS tender path must exist (gated toast historically, or real modals later)",
  );
  const selectCustomer = readSrc("features/pos/SelectCustomerModal.tsx");
  assert(
    !app.includes("onCreateCustomerStub") &&
      !selectCustomer.includes("onCreateCustomerStub") &&
      !selectCustomer.includes("customer.createNew"),
    "Create Customer must be removed from POS (Owner web only)",
  );
  assert(!/sync\/ingest/.test(app), "App must not call M4 sync/ingest");
  // Card/MFS detail modals landed in Slice 4 — no longer forbidden here.

  const cashPayment = readSrc("features/pos/CashPaymentModal.tsx");
  assert(
    cashPayment.includes("Exact Amount") &&
      cashPayment.includes("Change Due") &&
      cashPayment.includes("Cash Received"),
    "Cash Payment modal must show Exact Amount / Due / Received / Change",
  );
  assert(
    cashPayment.includes('event.key === "Tab"'),
    "Cash Payment must block Tab navigation",
  );
  assert(
    cashPayment.includes("onBackToMethods") ||
      cashPayment.includes("Back to Payment Methods"),
    "Cash Payment must return to Payment Methods",
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
    "Payment Select Method must block Tab navigation",
  );

  const selectCustomer = readSrc("features/pos/SelectCustomerModal.tsx");
  // Allow doc comments that say "no Baki"; forbid Baki as user-visible label/copy.
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
    "Complete Sale must document no-Baki lock",
  );

  const redeem = readSrc("features/pos/RedeemLoyaltyModal.tsx");
  assert(
    /Continue without redeeming/i.test(redeem),
    "Redeem modal needs Continue without redeeming",
  );

  const header = readSrc("features/shell/Header.tsx");
  assert(header.includes("PharmaSync POS"), "chrome brand PharmaSync POS");

  const ingest = readSrc("lib/saleIngest.ts");
  assert(ingest.includes("/api/v1/sales/ingest"), "zero-pay uses sales/ingest");
  assert(ingest.includes('method: "CASH"'), "zero-pay maps to CASH ৳0 payment");

  const cartTypes = readSrc("features/pos/cartTypes.ts");
  assert(cartTypes.includes("fefoOverride"), "cart line carries fefoOverride");

  console.log("  ✓ Slice 2 wiring + Payment Select Method + no detail/Baki/M4 invent");
}

function checkZeroPayPayloadShape(): void {
  const payload = buildZeroPayBody({
    eventId: "smoke-m3u-shape",
    storeId: "store-1",
    customerId: "cust-1",
    productId: "prod-1",
    batchId: "batch-1",
    unitPrice: 1.2,
    lineTotal: 1.2,
    loyaltyPoints: 2,
    loyaltyTaka: 1.2,
  });

  assert(payload.subtotal === 1.2, "subtotal");
  assert(payload.discount === 1.2, "loyalty → discount");
  assert(payload.total === 0, "zero-pay total");
  assert(payload.payments.length === 1, "min 1 payment");
  assert(payload.payments[0]?.method === "CASH", "CASH method");
  assert(payload.payments[0]?.amount === 0, "CASH amount 0");
  assert(
    payload.notes.includes("loyaltyRedeem:"),
    "notes carry loyalty redeem audit stub",
  );

  console.log("  ✓ zero-pay ingest payload (loyalty→discount + CASH ৳0)");
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

async function checkCustomerNoBakiSurface(token: string): Promise<Customer> {
  const { data } = await api<Customer[]>(
    `/api/v1/customers?q=${encodeURIComponent("Karim")}&limit=20&offset=0`,
    { token },
  );
  assert(Array.isArray(data) && data.length > 0, "Karim search empty — re-seed?");
  const karim = data.find((c) => /karim/i.test(c.name)) ?? data[0]!;
  assert(
    (karim.loyaltyPoints ?? 0) >= LOYALTY_REDEEM_ELIGIBILITY_MIN,
    "seed Karim should have ≥50 loyalty points",
  );
  console.log(
    "  ✓ customer Karim",
    karim.name,
    `pts=${karim.loyaltyPoints ?? "?"}`,
  );
  return karim;
}

async function checkZeroPayIngestLive(
  token: string,
  storeId: string,
  customer: Customer,
): Promise<void> {
  const { data: products } = await api<Product[]>(
    `/api/v1/products?q=${encodeURIComponent("Napa")}&limit=20&offset=0`,
    { token },
  );
  const napa =
    products.find((p) => /napa/i.test(p.name)) ?? products[0];
  assert(napa?.id, "Napa product missing");

  const { data: batches } = await api<Batch[]>(
    `/api/v1/batches?productId=${encodeURIComponent(napa.id)}&limit=50&offset=0`,
    { token },
  );
  const today = todayYmd();
  const sellable = batches
    .filter(
      (b) =>
        b.quantityOnHand > 0 &&
        sellableFromExpiry(String(b.expiryDate), today),
    )
    .sort((a, b) =>
      String(a.expiryDate).localeCompare(String(b.expiryDate)),
    );
  assert(sellable.length > 0, "no sellable Napa batch");
  const batch = sellable[0]!;
  assert(batch.quantityOnHand >= 1, "need ≥1 piece for smoke ingest");

  const unitPrice = Number(batch.sellPerBase);
  const lineTotal = unitPrice;
  const eventId = `smoke-m3u-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const redeemPts = Math.max(
    1,
    Math.min(Math.floor(lineTotal), customer.loyaltyPoints ?? 0),
  );

  const payload = buildZeroPayBody({
    eventId,
    storeId,
    customerId: customer.id,
    productId: napa.id,
    batchId: batch.id,
    unitPrice,
    lineTotal,
    loyaltyPoints: redeemPts,
    loyaltyTaka: lineTotal,
  });

  assert(payload.total === 0, "live payload total must be 0");

  const { data: sale, meta, status } = await api<SaleRow>(
    "/api/v1/sales/ingest",
    { method: "POST", token, body: payload },
  );

  assert(status === 201 || status === 200, `unexpected ingest status ${status}`);
  assert(Number(sale.total) === 0, "ingested total must be 0");
  assert(Number(sale.discount) === lineTotal, "discount = loyalty taka");
  console.log(
    "  ✓ zero-pay ingest",
    sale.eventId ?? eventId,
    meta?.idempotent ? "(idempotent)" : "created",
  );
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
  console.log("smoke-m3u — Slice 2 exit verification");
  console.log("BASE_URL=", BASE);

  checkLoyaltyCalculator();
  checkStaticSlice2Guards();
  checkZeroPayPayloadShape();

  await checkHealth();
  const { token, storeId } = await checkLogin();
  const customer = await checkCustomerNoBakiSurface(token);
  await checkZeroPayIngestLive(token, storeId, customer);
  await checkDesktopDevServer();

  console.log("smoke-m3u PASS — Slice 2 automated checks green");
  console.log(
    "Manual UI path: Edit → Change Batch → override → Remove → F8 → Redeem/OTP → zero-pay → Sale Completed; continue-without → Payment Select Method",
  );
}

main().catch((err) => {
  console.error("smoke-m3u FAIL", err);
  process.exit(1);
});
