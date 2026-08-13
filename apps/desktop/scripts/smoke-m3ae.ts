/**
 * Batch AE — Slice 4 exit verification (automated checks).
 * Run: npm run smoke:m3ae -w @r2a/desktop
 *
 * Requires cloud API at BASE_URL (default http://127.0.0.1:8787).
 * Does not invent F4 / Create Customer / Settings / M4 flush worker.
 * Does not invoke real printer IPC, card SDK, or MFS provider APIs.
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
import {
  CARD_PROCESS_STUB_DELAY_MS,
  armCardStubDeclineOnce,
} from "../src/lib/cardPaymentStub";
import {
  MFS_PROCESS_STUB_DELAY_MS,
  MFS_PROVIDERS,
  armMfsStubFailOnce,
} from "../src/lib/mfsPaymentStub";

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
  notes?: string | null;
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

function checkCardMfsStubs(): void {
  assert(CARD_PROCESS_STUB_DELAY_MS > 0, "card process delay");
  assert(typeof armCardStubDeclineOnce === "function", "card QA decline arm");
  const cardStub = readSrc("lib/cardPaymentStub.ts");
  assert(
    cardStub.includes("TODO(real card terminal SDK)"),
    "card stub must document real SDK TODO",
  );
  assert(
    cardStub.includes("not_started") &&
      cardStub.includes("processing") &&
      cardStub.includes("declined") &&
      cardStub.includes("cancelling"),
    "card stub phases present",
  );

  assert(MFS_PROCESS_STUB_DELAY_MS > 0, "mfs process delay");
  assert(typeof armMfsStubFailOnce === "function", "mfs QA fail arm");
  assert(MFS_PROVIDERS.length === 3, "exactly 3 MFS providers");
  const ids = MFS_PROVIDERS.map((p) => p.id).sort().join(",");
  assert(ids === "BKASH,NAGAD,ROCKET", "providers = bKash/Nagad/Rocket only");
  const mfsStub = readSrc("lib/mfsPaymentStub.ts");
  assert(
    mfsStub.includes("TODO(real MFS APIs)"),
    "mfs stub must document real API TODO",
  );
  assert(
    mfsStub.includes("invented") || mfsStub.includes("desktop-invented"),
    "confirm/result documented as invented",
  );
  console.log("  ✓ card + MFS stub machines + TODOs");
}

function checkReceiptPreviewModel(): void {
  // Static only — receiptModel imports customerSearch/qtyPackaging → api → import.meta.env
  const receiptSrc = readSrc("lib/receiptModel.ts");
  assert(
    receiptSrc.includes("TODO(real printer IPC)"),
    "receiptModel printer IPC TODO",
  );
  assert(
    receiptSrc.includes("TODO(Settings)") ||
      receiptSrc.includes("STUB_PHARMACY_HEADER"),
    "pharmacy header stub until Settings",
  );
  assert(
    receiptSrc.includes("Never hardcode product names") ||
      receiptSrc.includes("never hardcode"),
    "dynamic lines lock documented",
  );
  assert(
    receiptSrc.includes('"80mm"') && receiptSrc.includes('"58mm"'),
    "80mm / 58mm paper widths",
  );
  assert(
    receiptSrc.includes("INV-") && receiptSrc.includes("formatInvoiceLabel"),
    "INV invoice label helper",
  );
  assert(
    receiptSrc.includes("MEDICARE PHARMACY") ||
      receiptSrc.includes("STUB_PHARMACY_HEADER"),
    "stub pharmacy header constant",
  );
  assert(
    receiptSrc.includes("kind: \"card\"") ||
      receiptSrc.includes('kind: "card"') ||
      receiptSrc.includes("cardSettlement"),
    "card payment block on receipt",
  );
  assert(
    receiptSrc.includes("kind: \"mfs\"") ||
      receiptSrc.includes('kind: "mfs"') ||
      receiptSrc.includes("mfsSettlement"),
    "mfs payment block on receipt",
  );
  assert(
    receiptSrc.includes("args.lines") || receiptSrc.includes("lines.map"),
    "receipt lines derived from sale lines",
  );

  const preview = readSrc("features/pos/ReceiptPreviewPanel.tsx");
  assert(
    preview.includes("80mm") && preview.includes("58mm"),
    "Receipt Preview UI width toggle",
  );
  assert(
    !preview.includes("Napa 500") && !preview.includes('"Napa"'),
    "Receipt Preview must not hardcode demo medicine names",
  );
  console.log("  ✓ Receipt Preview model 80/58 + dynamic lines + stub header");
}

function checkStaticSlice4Guards(): void {
  const posIndex = readSrc("features/pos/index.ts");
  for (const name of [
    "PaymentSelectMethodModal",
    "CashPaymentModal",
    "CardPaymentModal",
    "MfsPaymentModal",
    "SaleCompletedScreen",
    "ReceiptPreviewPanel",
    "CompleteSaleZeroPayModal",
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
    app.includes("CardPaymentModal") && app.includes("onCardPaymentApproved"),
    "Card tender wired",
  );
  assert(
    app.includes("MfsPaymentModal") && app.includes("onMfsPaymentCollected"),
    "MFS tender wired",
  );
  assert(
    app.includes('paymentMethod: "CARD"') || app.includes('method: "CARD"'),
    "CARD ingest path present",
  );
  assert(
    app.includes('paymentMethod: "MFS"') || app.includes('method: "MFS"'),
    "MFS ingest path present",
  );
  assert(
    app.includes("ReceiptPreviewPanel") ||
      readSrc("features/pos/SaleCompletedScreen.tsx").includes(
        "ReceiptPreviewPanel",
      ),
    "Sale Completed shows inline Receipt Preview",
  );
  assert(
    app.includes("startPrintCycle") && app.includes('"printing"'),
    "print stub auto-starts on Sale Completed",
  );
  assert(
    !app.includes("payment detail — next when screens are shared"),
    "Card/MFS must no longer toast-gate detail UI",
  );
  assert(!/sync\/ingest/.test(app), "App must not call M4 sync/ingest");

  const paymentSelect = readSrc("features/pos/PaymentSelectMethodModal.tsx");
  assert(
    paymentSelect.includes("CASH") &&
      paymentSelect.includes("CARD") &&
      paymentSelect.includes("MFS"),
    "Payment Select Method shows Cash / Card / MFS",
  );
  assert(
    paymentSelect.includes("onSelectCard") &&
      paymentSelect.includes("onSelectMfs"),
    "Card + MFS select callbacks (ungated)",
  );
  assert(
    paymentSelect.includes('event.key === "Tab"'),
    "Payment Select Method blocks Tab",
  );

  const cardModal = readSrc("features/pos/CardPaymentModal.tsx");
  assert(
    cardModal.includes("Not Started") ||
      cardModal.includes("not_started") ||
      cardModal.includes("Waiting"),
    "Card modal has not-started UX",
  );
  assert(
    cardModal.includes("Declined") || cardModal.includes("declined"),
    "Card decline path",
  );
  assert(
    cardModal.includes('event.key === "Tab"'),
    "Card Payment blocks Tab",
  );

  const mfsModal = readSrc("features/pos/MfsPaymentModal.tsx");
  assert(
    mfsModal.includes("bKash") &&
      mfsModal.includes("Nagad") &&
      mfsModal.includes("Rocket"),
    "MFS provider select labels",
  );
  assert(
    mfsModal.includes("invent") ||
      mfsModal.includes("Invent") ||
      readSrc("lib/mfsPaymentStub.ts").includes("invented"),
    "invented confirm/result documented",
  );
  assert(
    mfsModal.includes("payer") ||
      mfsModal.includes("Payer") ||
      mfsModal.includes("mobile") ||
      mfsModal.includes("Mobile"),
    "invented confirm collects payer mobile",
  );
  assert(mfsModal.includes('event.key === "Tab"'), "MFS Payment blocks Tab");

  const completed = readSrc("features/pos/SaleCompletedScreen.tsx");
  assert(
    completed.includes("cardSettlement") ||
      completed.includes("CardSettlement") ||
      completed.includes("Approved"),
    "Sale Completed Card settlement variant",
  );
  assert(
    completed.includes("mfsSettlement") ||
      completed.includes("MfsSettlement") ||
      completed.includes("MFS"),
    "Sale Completed MFS settlement variant",
  );
  assert(
    completed.includes("ReceiptPreviewPanel"),
    "inline Receipt Preview on Sale Completed",
  );

  const preview = readSrc("features/pos/ReceiptPreviewPanel.tsx");
  assert(
    preview.includes("80mm") && preview.includes("58mm"),
    "Receipt Preview width toggle",
  );

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
  assert(ingest.includes('"CARD"') || ingest.includes("'CARD'"), "CARD tender");
  assert(ingest.includes('"MFS"') || ingest.includes("'MFS'"), "MFS tender");
  assert(
    ingest.includes("mfs:provider=") || ingest.includes("mfsMeta"),
    "MFS provider meta in notes",
  );
  assert(
    ingest.includes("card:status=") || ingest.includes("cardMeta"),
    "card status meta in notes",
  );

  console.log(
    "  ✓ Slice 4 wiring: Card + MFS ungated + Receipt Preview + no Baki/M4",
  );
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

async function pickNapaLine(
  token: string,
): Promise<{ product: Product; batch: BatchRow; unitPrice: number }> {
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
  return {
    product,
    batch: sellable!,
    unitPrice: Number(sellable!.sellPerBase ?? 1.2),
  };
}

function newEventId(tag: string): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `smoke-m3ae-${tag}-${Date.now()}`;
}

async function checkCashIngestLive(
  token: string,
  storeId: string,
): Promise<void> {
  const { product, batch, unitPrice } = await pickNapaLine(token);
  const lineTotal = unitPrice;
  const eventId = newEventId("cash");

  const body = {
    eventId,
    storeId,
    soldAt: new Date().toISOString(),
    subtotal: lineTotal,
    discount: 0,
    total: lineTotal,
    notes:
      "smoke:m3ae walk-in cash;cash:recv=" +
      lineTotal.toFixed(2) +
      ";change=0.00",
    items: [
      {
        productId: product.id,
        batchId: batch.id,
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
  console.log(
    "  ✓ walk-in cash ingest still works",
    sale.eventId ?? eventId,
    meta?.idempotent ? "(idempotent)" : "created",
  );
}

async function checkCardIngestLive(
  token: string,
  storeId: string,
): Promise<void> {
  const { product, batch, unitPrice } = await pickNapaLine(token);
  const lineTotal = unitPrice;
  const eventId = newEventId("card");

  const body = {
    eventId,
    storeId,
    soldAt: new Date().toISOString(),
    subtotal: lineTotal,
    discount: 0,
    total: lineTotal,
    notes: "smoke:m3ae walk-in card;card:status=Approved",
    items: [
      {
        productId: product.id,
        batchId: batch.id,
        unitType: "PIECE" as const,
        unitQty: 1,
        quantityBase: 1,
        unitPrice,
        lineTotal,
      },
    ],
    payments: [{ method: "CARD" as const, amount: lineTotal }],
  };

  const { status, data: sale } = await api<SaleRow>("/api/v1/sales/ingest", {
    method: "POST",
    token,
    body,
  });
  assert(status === 201 || status === 200, `card ingest status ${status}`);
  assert(Number(sale.total) === lineTotal, "card ingest total = due");
  console.log("  ✓ walk-in CARD ingest", sale.eventId ?? eventId);
}

async function checkMfsIngestLive(
  token: string,
  storeId: string,
): Promise<void> {
  const { product, batch, unitPrice } = await pickNapaLine(token);
  const lineTotal = unitPrice;
  const eventId = newEventId("mfs");

  const body = {
    eventId,
    storeId,
    soldAt: new Date().toISOString(),
    subtotal: lineTotal,
    discount: 0,
    total: lineTotal,
    notes:
      "smoke:m3ae walk-in mfs;mfs:provider=BKASH;payer=01700000000;trx=SMOKEAE1",
    items: [
      {
        productId: product.id,
        batchId: batch.id,
        unitType: "PIECE" as const,
        unitQty: 1,
        quantityBase: 1,
        unitPrice,
        lineTotal,
      },
    ],
    payments: [{ method: "MFS" as const, amount: lineTotal }],
  };

  const { status, data: sale } = await api<SaleRow>("/api/v1/sales/ingest", {
    method: "POST",
    token,
    body,
  });
  assert(status === 201 || status === 200, `mfs ingest status ${status}`);
  assert(Number(sale.total) === lineTotal, "mfs ingest total = due");
  console.log("  ✓ walk-in MFS ingest", sale.eventId ?? eventId);
}

async function checkZeroPayStillWorks(
  token: string,
  storeId: string,
): Promise<void> {
  const { product, batch, unitPrice } = await pickNapaLine(token);
  const lineTotal = unitPrice;
  const eventId = newEventId("zero");

  const body = {
    eventId,
    storeId,
    soldAt: new Date().toISOString(),
    subtotal: lineTotal,
    discount: lineTotal,
    total: 0,
    notes: "smoke:m3ae loyalty-cover shape;loyaltyRedeem:pts=stub",
    items: [
      {
        productId: product.id,
        batchId: batch.id,
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
  console.log("  ✓ loyalty zero-pay ingest still works");
}

async function checkCustomerEligibility(token: string): Promise<void> {
  const { data } = await api<{ name: string; loyaltyPoints?: number }[]>(
    `/api/v1/customers?q=${encodeURIComponent("Karim")}&limit=20&offset=0`,
    { token },
  );
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
  console.log("smoke-m3ae — Slice 4 exit verification");
  console.log("BASE_URL=", BASE);

  checkLoyaltyEarnLock();
  checkPrintStubMachine();
  checkCardMfsStubs();
  checkReceiptPreviewModel();
  checkStaticSlice4Guards();

  await checkHealth();
  const { token, storeId } = await checkLogin();
  await checkCustomerEligibility(token);
  await checkCashIngestLive(token, storeId);
  await checkCardIngestLive(token, storeId);
  await checkMfsIngestLive(token, storeId);
  await checkZeroPayStillWorks(token, storeId);
  await checkDesktopDevServer();

  console.log("smoke-m3ae PASS — Slice 4 automated checks green");
  console.log(
    "Manual UI: Payment → Card happy/decline/cancel; Payment → MFS provider → invent confirm → complete; Receipt Preview 80/58; Cash + loyalty unbroken; single tender",
  );
}

main().catch((err) => {
  console.error("smoke-m3ae FAIL", err);
  process.exit(1);
});
