/**
 * M6 Batch D smoke — desktop saleIngest wire-up (source + payload builder).
 * Run: npm run smoke:m6d -w @r2a/desktop
 *
 * Does not POST to the cloud API. Live ingest is `npm run smoke:m6d -w @r2a/server`.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CartLine } from "../src/features/pos/cartTypes";
import { buildSaleIngestPayload } from "../src/lib/saleIngest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "..", "src");

function readSrc(rel: string): string {
  return readFileSync(join(SRC, rel), "utf8");
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function dummyLine(overrides: Partial<CartLine> = {}): CartLine {
  return {
    id: "l1",
    productId: "p1",
    productName: "Napa",
    genericName: "Paracetamol",
    manufacturer: "Beximco",
    strength: "500 mg",
    form: "Tablet",
    batchId: "b1",
    batchNumber: "NP24031",
    expiryDate: "2026-10-31",
    batchQtyOnHand: 100,
    unitType: "PIECE",
    unitQty: 1,
    unitPrice: 1.2,
    lineTotal: 1.2,
    quantityBase: 1,
    factorToBase: 1,
    maxUnitQty: 100,
    sellPerBase: 1.2,
    fefo: false,
    ...overrides,
  };
}

function checkSourceGuards(): void {
  const ingest = readSrc("lib/saleIngest.ts");
  assert(
    ingest.includes("loyaltyUsed") && ingest.includes("loyaltyEarned"),
    "saleIngest must send loyaltyUsed / loyaltyEarned",
  );
  assert(
    ingest.includes("fefoOverride") && ingest.includes("fefoAuthorizedByName"),
    "saleIngest must send per-line FEFO flags",
  );
  assert(
    ingest.includes("settleLoyaltyForSale"),
    "saleIngest must use existing loyaltyCalc",
  );
  assert(
    ingest.includes("card:status=") && ingest.includes("mfs:provider="),
    "card/MFS notes must stay",
  );
  assert(
    !ingest.includes("pinHash"),
    "saleIngest must not touch FEFO pinHash",
  );

  const auth = readSrc("lib/fefoOverrideAuth.ts");
  assert(
    auth.includes("acceptStubManagerPin"),
    "FEFO PIN stub must remain",
  );

  const otp = readSrc("lib/loyaltyRedeem.ts");
  assert(
    otp.includes("isStubLoyaltyOtpComplete") &&
      otp.includes("any complete 6-digit OTP"),
    "Redeem OTP stub must remain",
  );

  console.log("  ✓ source: loyalty/FEFO fields + card/MFS notes; stubs unchanged");
}

function checkPayloadBuilder(): void {
  const withCustomer = buildSaleIngestPayload({
    eventId: "e-cust",
    storeId: "s1",
    customerId: "c1",
    lines: [
      dummyLine({
        fefoOverride: {
          authorizedById: "u1",
          authorizedByName: "Smoke Manager",
          authorizedAt: "2026-08-15T00:00:00.000Z",
          fefoBatchId: "fefo1",
          fefoBatchNumber: "NP23091",
          fefoExpiryDate: "2026-08-31",
        },
      }),
    ],
    cartSubtotal: 100,
    appliedLoyalty: {
      points: 10,
      taka: 10,
      verifiedAt: "2026-08-15T00:00:00.000Z",
    },
    paymentMethod: "CASH",
  });
  assert(withCustomer.loyaltyUsed === 10, "customer sale must send loyaltyUsed");
  assert(
    withCustomer.loyaltyEarned === 1,
    `customer sale earn from ৳100 expected 1, got ${withCustomer.loyaltyEarned}`,
  );
  assert(withCustomer.items[0]?.fefoOverride === true, "override line flag");
  assert(
    withCustomer.items[0]?.fefoAuthorizedByName === "Smoke Manager",
    "override authorizer name",
  );

  const walkIn = buildSaleIngestPayload({
    eventId: "e-walk",
    storeId: "s1",
    customerId: null,
    lines: [dummyLine()],
    cartSubtotal: 1.2,
    appliedLoyalty: null,
    paymentMethod: "CASH",
  });
  assert(
    walkIn.loyaltyUsed === undefined && walkIn.loyaltyEarned === undefined,
    "walk-in must omit loyalty fields",
  );
  assert(
    walkIn.items[0]?.fefoOverride === undefined,
    "non-override line must omit fefoOverride",
  );

  const card = buildSaleIngestPayload({
    eventId: "e-card",
    storeId: "s1",
    customerId: null,
    lines: [dummyLine()],
    cartSubtotal: 1.2,
    appliedLoyalty: null,
    paymentMethod: "CARD",
    cardMeta: { status: "Approved" },
  });
  assert(
    typeof card.notes === "string" && card.notes.includes("card:status=Approved"),
    "card notes must remain",
  );

  const mfs = buildSaleIngestPayload({
    eventId: "e-mfs",
    storeId: "s1",
    customerId: null,
    lines: [dummyLine()],
    cartSubtotal: 1.2,
    appliedLoyalty: null,
    paymentMethod: "MFS",
    mfsMeta: { provider: "BKASH", payerMobile: "01700000000", trxId: "trx1" },
  });
  assert(
    typeof mfs.notes === "string" &&
      mfs.notes.includes("mfs:provider=BKASH") &&
      mfs.notes.includes("trx=trx1"),
    "MFS notes must remain",
  );

  console.log("  ✓ payload: loyalty/FEFO on customer sale; walk-in omits; notes kept");
}

function main(): void {
  console.log("M6D desktop smoke (saleIngest wire-up)\n");
  checkSourceGuards();
  checkPayloadBuilder();
  console.log("\nAll checklist items passed.");
}

try {
  main();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
