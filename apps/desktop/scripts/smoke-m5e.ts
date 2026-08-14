/**
 * M5 Batch E smoke — paged catalog pull.
 * Run: npm run smoke:m5e -w @r2a/desktop
 *
 * Fake two pages concatenate; costPerBase never mapped; 50-page cap.
 * Does not hit the cloud API. Demo seed (5 products) still fits in one page.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CATALOG_MAX_PAGES,
  CATALOG_PAGE_SIZE,
  collectPagedList,
  mapBatch,
  parseMetaTotal,
} from "../src/lib/localDb/catalogPages";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DESKTOP = join(__dirname, "..");
const SRC = join(DESKTOP, "src");
const ROOT = join(DESKTOP, "..", "..");

function readSrc(rel: string): string {
  return readFileSync(join(SRC, rel), "utf8");
}

function readRepo(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function checkCaps(): void {
  assert(CATALOG_PAGE_SIZE === 100, "page size must be 100");
  assert(CATALOG_MAX_PAGES === 50, "hard cap must be 50 pages (5000 rows)");
  console.log("  ✓ page size 100; cap 50 pages documented");
}

async function checkTwoPageMerge(): Promise<void> {
  const page1 = Array.from({ length: 100 }, (_, i) => ({ id: `p${i}` }));
  const page2 = Array.from({ length: 23 }, (_, i) => ({ id: `p${100 + i}` }));
  const calls: Array<{ limit: number; offset: number }> = [];

  const result = await collectPagedList(async (limit, offset) => {
    calls.push({ limit, offset });
    if (offset === 0) return { items: page1, total: 123 };
    if (offset === 100) return { items: page2, total: 123 };
    throw new Error(`unexpected offset ${offset}`);
  });

  assert(calls.length === 2, `expected 2 page fetches, got ${calls.length}`);
  assert(calls[0]?.limit === 100 && calls[0]?.offset === 0, "page 1 offset 0");
  assert(calls[1]?.limit === 100 && calls[1]?.offset === 100, "page 2 offset 100");
  assert(result.items.length === 123, `concat length ${result.items.length}`);
  assert(result.items[0]?.id === "p0" && result.items[122]?.id === "p122", "order");
  assert(result.truncated === false, "123 rows must not truncate");
  assert(result.total === 123, "total from meta");
  console.log("  ✓ fake two pages (100 + 23) concatenate");
}

async function checkCapTruncates(): Promise<void> {
  let fetches = 0;
  const result = await collectPagedList(async (limit, offset) => {
    fetches += 1;
    return {
      items: Array.from({ length: limit }, (_, i) => ({ id: `${offset + i}` })),
      total: 5001,
    };
  });
  assert(fetches === 50, `cap must stop at 50 pages, fetched ${fetches}`);
  assert(result.items.length === 5000, `capped length ${result.items.length}`);
  assert(result.truncated === true, "5001 total must truncate after 5000");
  console.log("  ✓ 50-page cap truncates (5000 of 5001)");
}

function checkMapBatchDropsCost(): void {
  const mapped = mapBatch(
    {
      id: "b1",
      productId: "p1",
      storeId: "s1",
      batchNumber: "LOT-COST",
      expiryDate: "2026-09-30",
      quantityOnHand: 10,
      sellPerBase: 1.2,
      costPerBase: 0.8,
    },
    "2026-08-14T00:00:00.000Z",
  );
  assert(mapped != null, "mapBatch must return a row");
  assert(!("costPerBase" in mapped), "mapped batch must not include costPerBase");
  assert(mapped.sellPerBase === 1.2, "sellPerBase still cached");
  assert(mapped.batchNumber === "LOT-COST", "batch number is data");
  console.log("  ✓ costPerBase never in mapped batch");
}

function checkMetaTotal(): void {
  assert(parseMetaTotal({ total: 5, limit: 100, offset: 0 }) === 5, "meta.total");
  assert(parseMetaTotal({ total: "12" }) === 12, "numeric string total");
  assert(parseMetaTotal(undefined) == null, "missing meta");
  assert(parseMetaTotal({ limit: 100 }) == null, "meta without total");
  console.log("  ✓ parseMetaTotal reads meta.total");
}

function checkSourceGuards(): void {
  const api = readSrc("lib/api.ts");
  const pull = readSrc("lib/localDb/catalogPull.ts");
  const pages = readSrc("lib/localDb/catalogPages.ts");
  const provider = readSrc("features/shell/LocalDbProvider.tsx");
  const ingest = readSrc("lib/syncWorker.ts");
  const receive = readSrc("lib/receiveStock.ts");

  assert(
    api.includes("export async function apiRequestEnvelope") &&
      api.includes("meta: envelope.meta"),
    "apiRequestEnvelope must return envelope meta",
  );
  assert(
    pull.includes("apiRequestEnvelope") &&
      pull.includes("resolvePageTotal") &&
      pull.includes("collectPagedList") &&
      pull.includes('isActive: "true"'),
    "catalogPull must page products (isActive) and batches via envelope meta",
  );
  assert(
    (pull.match(/replaceCatalogCache\(/g) ?? []).length === 1,
    "replaceCatalogCache must run once at the end, not per page",
  );
  assert(
    pull.indexOf("await collectPagedList") >= 0 &&
      pull.indexOf("await replaceCatalogCache") >
        pull.indexOf("await collectPagedList"),
    "replaceCatalogCache must follow paging, not sit inside the page loop",
  );
  assert(
    pages.includes("void raw.costPerBase") && pages.includes("CATALOG_MAX_PAGES = 50"),
    "mapBatch must drop costPerBase; cap documented in source",
  );
  assert(
    provider.includes('t("catalog.truncated")') &&
      provider.includes("result.truncated"),
    "truncated pull must toast catalog.truncated once",
  );
  assert(
    pull.includes("No bi-di / CSV") &&
      !/text\/csv/.test(pull) &&
      !/papaparse|Papa\.parse/i.test(pull + pages + provider),
    "must not add CSV import",
  );
  assert(
    ingest.includes("/api/v1/sync/ingest"),
    "sync ingest path must remain unchanged",
  );
  assert(
    receive.includes("postReceiveLot") && receive.includes("patchReceiveQty"),
    "Receive stock helpers must be unchanged in this batch",
  );
  console.log("  ✓ source: envelope meta, one cache replace, no CSV, ingest untouched");
}

function checkI18n(): void {
  const en = readSrc("i18n/locales/en.ts");
  const bn = readSrc("i18n/locales/bn-BD.ts");
  assert(en.includes('"catalog.truncated"'), "en.ts missing catalog.truncated");
  assert(bn.includes('"catalog.truncated"'), "bn-BD.ts missing catalog.truncated");
  assert(/5000/.test(en) && /5000/.test(bn), "truncation copy uses Latin digits 5000");
  console.log("  ✓ i18n catalog.truncated in en + bn-BD");
}

function checkCatalogStillNoSection20(): void {
  const catalog = readRepo("Completed_API_lists.md");
  assert(
    catalog.includes("§20 waits for Batch F") ||
      catalog.includes("§20 — M5") ||
      catalog.includes("## 20. M5"),
    "catalog must mention §20 M5 (pending F) or include the §20 heading (after F)",
  );
  assert(
    catalog.includes("paged") || catalog.includes("Paged catalog"),
    "catalog should note paged catalog pull (Batch E)",
  );
  console.log("  ✓ catalog notes paging + §20");
}

async function main(): Promise<void> {
  console.log("smoke:m5e — M5 Batch E paged catalog pull\n");
  checkCaps();
  checkMetaTotal();
  await checkTwoPageMerge();
  await checkCapTruncates();
  checkMapBatchDropsCost();
  checkSourceGuards();
  checkI18n();
  checkCatalogStillNoSection20();
  console.log("\nPASS — smoke:m5e");
}

void main();
