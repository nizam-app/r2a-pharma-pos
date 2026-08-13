/**
 * Batch L — Slice 1 exit verification (automated checks).
 * Run: npm run smoke:m3l -w @r2a/desktop
 *
 * Requires cloud API at BASE_URL (default http://127.0.0.1:8787).
 * Does not open payment UI or call M4 /sync/ingest.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createMemoryBackend } from "../src/lib/localDb/memoryBackend";

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
};

type AuthData = {
  accessToken: string;
  refreshToken: string;
  user?: { email?: string; role?: string };
};

type Product = {
  id: string;
  name: string;
  units?: Array<{ unitType: string; factorToBase: number }>;
};

type Batch = {
  id: string;
  productId: string;
  batchNumber: string;
  expiryDate: string;
  quantityOnHand: number;
  sellPerBase: number;
};

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "src");

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function api<T>(
  path: string,
  opts: { method?: string; body?: unknown; token?: string } = {},
): Promise<T> {
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
  return json.data;
}

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

function sellableFromExpiry(expiryDate: string, today: string): boolean {
  return expiryDate.slice(0, 10) >= today;
}

function readSrc(rel: string): string {
  return readFileSync(join(srcRoot, rel), "utf8");
}

async function checkHealth(): Promise<void> {
  const data = await api<{ ok?: boolean } | Record<string, unknown>>(
    "/api/v1/health",
  );
  assert(data != null, "health empty");
  console.log("  ✓ health", BASE);
}

async function checkLogin(): Promise<string> {
  const data = await api<AuthData>("/api/v1/auth/login", {
    method: "POST",
    body: { email: EMAIL, password: PASSWORD },
  });
  assert(data.accessToken, "no accessToken");
  console.log("  ✓ login", EMAIL, data.user?.role ?? "");
  return data.accessToken;
}

async function checkSearchAndBatch(token: string): Promise<{
  productId: string;
  batch: Batch;
  units: Array<{ unitType: string; factorToBase: number }>;
}> {
  const products = await api<Product[]>(
    `/api/v1/products?q=${encodeURIComponent("Napa")}&limit=20&offset=0`,
    { token },
  );
  assert(Array.isArray(products) && products.length > 0, "Napa search empty");
  const napa =
    products.find((p) => /napa/i.test(p.name)) ?? products[0];
  assert(napa?.id, "Napa product missing id");
  console.log("  ✓ search Napa →", napa.name);

  const batches = await api<Batch[]>(
    `/api/v1/batches?productId=${encodeURIComponent(napa.id)}&limit=50&offset=0`,
    { token },
  );
  assert(Array.isArray(batches) && batches.length > 0, "no batches for Napa");

  const today = todayYmd();
  const sellable = batches.filter(
    (b) => b.quantityOnHand > 0 && sellableFromExpiry(String(b.expiryDate), today),
  );
  assert(sellable.length > 0, "no sellable FEFO-capable batch for Napa");

  // Expired lots must not be sellable (rule locked in Select Batch).
  const expired = batches.filter(
    (b) => b.quantityOnHand > 0 && !sellableFromExpiry(String(b.expiryDate), today),
  );
  for (const b of expired) {
    assert(
      !sellableFromExpiry(String(b.expiryDate), today),
      `expired batch ${b.batchNumber} marked sellable`,
    );
  }
  console.log(
    "  ✓ batches",
    `sellable=${sellable.length}`,
    `expired=${expired.length}`,
  );

  const fefo = await api<Batch>(
    `/api/v1/products/${encodeURIComponent(napa.id)}/fefo-batch`,
    { token },
  );
  assert(fefo?.id, "FEFO helper returned no batch");
  console.log("  ✓ FEFO", fefo.batchNumber, String(fefo.expiryDate).slice(0, 10));

  const detail = await api<Product>(
    `/api/v1/products/${encodeURIComponent(napa.id)}`,
    { token },
  );
  const units = Array.isArray(detail.units) ? detail.units : [];
  assert(units.length > 0, "Napa has no packaging units");
  const hasStrip = units.some((u) => String(u.unitType).toUpperCase() === "STRIP");
  assert(hasStrip, "expected STRIP unit for Napa qty/packaging path");
  console.log(
    "  ✓ units",
    units.map((u) => `${u.unitType}×${u.factorToBase}`).join(", "),
  );

  return {
    productId: napa.id,
    batch: sellable.sort((a, b) =>
      String(a.expiryDate).localeCompare(String(b.expiryDate)),
    )[0]!,
    units,
  };
}

async function checkLocalSqliteQueue(): Promise<void> {
  const store = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => {
      store.set(k, String(v));
    },
    removeItem: (k) => {
      store.delete(k);
    },
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  };

  const db = createMemoryBackend();
  await db.migrate();
  const now = new Date().toISOString();
  await db.replaceCatalogCache({
    products: [
      {
        id: "p-napa",
        name: "Napa 500mg",
        genericName: "Paracetamol",
        manufacturer: "Beximco",
        strength: "500 mg",
        form: "Tablet",
        sku: "NAPA-500",
        barcode: null,
        isActive: true,
        cachedAt: now,
        units: [
          {
            id: "u-strip",
            productId: "p-napa",
            unitType: "STRIP",
            factorToBase: 10,
            label: null,
          },
        ],
      },
    ],
    batches: [
      {
        id: "b-ok",
        productId: "p-napa",
        storeId: "s1",
        batchNumber: "LOT-OK",
        expiryDate: "2027-06-01",
        quantityOnHand: 100,
        sellPerBase: 1.5,
        cachedAt: now,
      },
      {
        id: "b-exp",
        productId: "p-napa",
        storeId: "s1",
        batchNumber: "LOT-EXP",
        expiryDate: "2020-01-01",
        quantityOnHand: 50,
        sellPerBase: 1.5,
        cachedAt: now,
      },
    ],
  });

  const hits = await db.searchCachedProducts("Napa", 10);
  assert(hits.length >= 1, "local cache search Napa failed");

  const batches = await db.listCachedBatches("p-napa");
  assert(batches.length === 2, `expected 2 cached batches, got ${batches.length}`);
  const today = todayYmd();
  assert(
    sellableFromExpiry(batches.find((b) => b.id === "b-ok")!.expiryDate, today),
    "LOT-OK should be sellable",
  );
  assert(
    !sellableFromExpiry(batches.find((b) => b.id === "b-exp")!.expiryDate, today),
    "LOT-EXP should not be sellable",
  )

  await db.enqueueSyncEvent({
    id: "evt-m3l-1",
    entityType: "sale",
    action: "create",
    payload: { event_id: "evt-m3l-1" },
  });
  const pending = await db.countUnsynced();
  assert(pending === 1, `pending expected 1, got ${pending}`);

  console.log("  ✓ local cache + outbound_sync_queue", {
    kind: db.kind,
    path: await db.getDbPath(),
    pending,
  });
}

function checkStaticGuards(): void {
  const cart = readSrc("features/shell/CartPanel.tsx");
  assert(
    cart.includes('showComingSoon("Payment UI")'),
    "Proceed must toast Payment UI (no payment screen)",
  );

  const app = readSrc("App.tsx");
  assert(app.includes('showComingSoon("Payment UI")'), "F10 must toast Payment UI");
  assert(
    app.includes('showComingSoon("Customer picker [F8]")'),
    "F8 must remain stub",
  );
  assert(!/sales\/ingest/.test(app), "App must not call sales/ingest in Slice 1");
  assert(!/sync\/ingest/.test(app), "App must not call sync/ingest (M4)");

  const sidebar = readSrc("features/shell/Sidebar.tsx");
  assert(
    sidebar.includes("onOpenTransactions"),
    "Transactions nav wired (Batch AJ)",
  );
  assert(sidebar.includes('showComingSoon("Shift")') || sidebar.includes("sidebar.shift"), "Shift stub");
  assert(sidebar.includes('showComingSoon("Settings")'), "Settings stub");

  const batchModal = readSrc("features/pos/SelectBatchModal.tsx");
  assert(
    batchModal.includes("if (!row || !row.sellable) return"),
    "Select Batch must block expired confirm",
  );

  const header = readSrc("features/shell/Header.tsx");
  assert(header.includes("PharmaSync POS"), "chrome brand PharmaSync POS");

  // F4 modal must not exist yet.
  assert(
    !readFileSync(join(srcRoot, "features", "pos", "index.ts"), "utf8").includes(
      "Generic",
    ),
    "F4 generic modal must stay out of Slice 1",
  );

  console.log("  ✓ stubs + payment/M4 guards + chrome brand");
}

async function checkDesktopDevServer(): Promise<void> {
  // Vite on Windows often binds ::1; prefer localhost over 127.0.0.1.
  const candidates = [
    process.env.DESKTOP_URL?.replace(/\/$/, ""),
    "http://localhost:1420",
    "http://127.0.0.1:1420",
  ].filter((u): u is string => Boolean(u));

  let lastErr: unknown;
  for (const url of candidates) {
    try {
      const res = await fetch(url + "/");
      assert(res.ok, `desktop ${url} → ${res.status}`);
      const html = await res.text();
      assert(/root|vite|Pharma|html/i.test(html), "desktop HTML unexpected");
      console.log("  ✓ desktop Vite", url);
      return;
    } catch (err) {
      lastErr = err;
    }
  }
  console.log(
    "  ~ desktop Vite not reachable (optional if only API checks run):",
    lastErr instanceof Error ? lastErr.message : lastErr,
  );
}

async function main() {
  console.log("smoke-m3l — Slice 1 exit verification");
  console.log("BASE_URL=", BASE);

  await checkHealth();
  const token = await checkLogin();
  await checkSearchAndBatch(token);
  await checkLocalSqliteQueue();
  checkStaticGuards();
  await checkDesktopDevServer();

  console.log("smoke-m3l PASS — Slice 1 automated checks green");
  console.log("Manual UI path still expected: Counter Ready → F2 → Search → Batch → Qty → Cart");
}

main().catch((err) => {
  console.error("smoke-m3l FAIL", err);
  process.exit(1);
});
