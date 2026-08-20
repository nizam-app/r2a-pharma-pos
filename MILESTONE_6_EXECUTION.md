# Milestone 6 — Growth / Owner Web (Batch Execution Plan)

**Document type:** Fresh-chat execution guide for Milestone 6  
**Source of truth:** [`PROJECT_MASTER_PLAN.md`](PROJECT_MASTER_PLAN.md)  
**Live progress context:** [`Current_Status.md`](Current_Status.md)  
**API catalog:** [`Completed_API_lists.md`](Completed_API_lists.md)  
**RBAC contract:** [`ROLES_AND_PERMISSIONS.md`](ROLES_AND_PERMISSIONS.md) (v2.0.0)  
**Authorized plans:** [`.cursor/plans/m6_slice_1_owner_33de6430.plan.md`](.cursor/plans/m6_slice_1_owner_33de6430.plan.md) (Slice 1) · Slice 3 Customers plan (2026-08-19).
**Status of M6:** **IN PROGRESS** — Owner Web Slice 1 **A–O DONE**; W1–W6 **DONE**; Slice 2 **P–AB DONE**, **AC–AD DEFERRED**. Slice 3 **AE DONE**, **AF–AM planned** (Customers + POS registration approval). Staff/Reports/Audit/Settings, Manager web, n8n, RLS, bi-di stay unauthorized.
**Prerequisite:** Milestone 0–**5**, Owner Web Slice 1, W1–W6, and Slice 2 P–AB **DONE**.
**Do not start:** Slice 2 AC/AD (deferred), Manager web, Staff/Reports/Audit & FEFO/Settings/Help/Owner Profile, Edit Customer, Edit Supplier, GRN list, Review Reorder Suggestions extra page, bi-di sync, n8n, Postgres RLS, Slice 7+ POS, real printer IPC, card SDK, MFS APIs, FEFO `pinHash`, cloud shift, multi-branch switch, on-account tender — unless the user re-authorizes.

---

## How to use this file

1. Open a **fresh Cursor chat** for each batch.
2. Attach / `@` these files:
   - `PROJECT_MASTER_PLAN.md`
   - `Current_Status.md`
   - `ROLES_AND_PERMISSIONS.md`
   - `MILESTONE_6_EXECUTION.md` (this file)
   - `Completed_API_lists.md`
3. Paste **only** that batch’s **Agent prompt** (or say `Authorize M6 Batch X`).
4. If the batch says **Re-share screen**, the agent **asks for that named screenshot**, then **stops** until you provide it (or say **use prior upload** / **invent to match theme**).
5. Agent implements **only** that batch after the screen/decision is settled.
6. When the batch is done, the agent pastes the **short report** (template below). You review.
7. Mark the batch checkbox when its exit check passes.
8. Proceed to the next batch only after the previous one is green.

> **Hard rules:**
> - Implement **one batch per chat**. Do not collapse Slice 1 A–O, Slice 2 P–AB, or Slice 3 AE–AM into a single run.
> - **Build only the active slice.** Slice 1 is **DONE**. Slice 2 **P–AB DONE** (AC–AD **deferred**). Active scope is **Slice 3** (AE–AM). Later screens → Slice 4+.
> - **Mock inconsistency:** chrome is locked (same as M3). Per-screen mocks drive *content only*. The agent **handles** layout/theme/nav mismatches — do not restyle chrome to match a later/earlier mock.
> - **Missing next screen:** if a control implies a flow we do not have a screenshot for, the agent **asks and guides** — do not invent that screen, and do not silently skip without asking. Slice 3 invents only what this file authorizes (Reject modal, POS Create Customer).
> - `apps/web` is **OWNER only**. Manager and Cashier must not use it.
> - No invented KPI/table rows. Live Prisma via Express. Shared APIs with POS (no second sales store).
> - Payments stay **`CASH` \| `CARD` \| `MFS` only**. No Baki / on-account. No sale void.
> - Localization: Owner web strings use `t("...")` + `apps/web` `en.ts` + `bn-BD.ts`. POS Create (Batch AL) uses `apps/desktop` `en.ts` + `bn-BD.ts`. Do not translate medicine names, customer names, batch numbers, TXN ids, phones, barcodes, SKUs. Latin digits only. UI locale does **not** change receipt body.
> - Tab is never a POS navigator (desktop unchanged). Owner web may use normal web focus.

---

## Walkthrough + short-report protocol (mandatory)

| Kind | Who | What |
|------|-----|------|
| **Agent smoke** | Agent | Batch `smoke:m6*` when the batch lists one |
| **User review** | **You** | Short **YOU DO** list. If **None**, confirm smoke only |

**Agent must, at the end of every batch chat:**

1. Paste this **short report** (keep it short):

```text
## M6 Batch <ID> report
Done: <1–3 bullets>
Smoke: PASS | FAIL | n/a — <script name>
YOU DO: <numbered, or none>
Next: Authorize M6 Batch <next>
```

2. Do **not** start the next batch in the same chat.

**You should, after every batch:**

1. Run **YOU DO** (if any).
2. Reply **PASS** or **FAIL**.
3. Open a **new chat** for the next batch only after PASS (or after FAIL is fixed).

---

## Screen re-share protocol (UI batches)

If the batch table says **Re-share screen: \<Name\>**, the agent’s **first** message after authorize is:

```text
⏸ Batch X needs the visual for: "<Screen name>".
Please re-share that screenshot (or say "use prior upload" / "invent to match theme").
Stopping until you reply.
```

Then stop. After you share (or say use prior), implement that batch only.

**Slice 1 screen names (exact labels):**

| # | Screen name | Batch |
|---|-------------|-------|
| — | Owner Login | A — **invent** (not shared; match Admin Portal family) |
| 1 | **Dashboard** | G |
| 2 | **Sales Overview & Transactions** | H |
| 3 | **Transaction Details** | I |
| 4 | **Inventory** | J |
| 5 | **Product Details** | K |
| 6 | **Add Product** | L |
| 7 | **Receive Stock** | M |
| 8 | **Expiry Management** | N |

**Slice 2 screen names (exact labels):**

| # | Screen name | Batch |
|---|-------------|-------|
| 9 | **Purchasing** | T |
| 10 | **Create Purchase Order** | U |
| 11 | **Purchase Order Details** | V |
| 12 | **Receive Stock** (against PO — not Inventory Add Lot) | W |
| 13 | **Suppliers** | X |
| 14 | **Add Supplier** | Y |
| 15 | **Supplier Details** | Z |
| 16 | **Expiry Returns** | AA |
| 17 | **Create Return Manifest** | AB — **no screenshot yet; stop and ask** |
| 18 | **Return Manifest Details** | AC — **DEFERRED** (placeholder remains) |
| — | **Record Supplier Return Dispatch** | AC modal — **DEFERRED** |
| — | **Record Supplier Decision** | AC modal — **DEFERRED** |
| — | **Complete Return** | AC modal — **DEFERRED** |

**Slice 3 screen names (exact labels):**

| # | Screen name | Batch |
|---|-------------|-------|
| 19 | **Customers** | AH |
| 20 | **Add Customer** | AI |
| — | **Create Customer** (confirm modal) | AI |
| 21 | **Customer Details** | AJ |
| 22 | **Customer Registration Review** | AK |
| — | **Approve Customer** | AK modal — shared |
| — | **Reject Registration** | AK modal — invent from spec below |
| — | **POS Create Customer** | AL — **invent** (name + phone; match Select Customer family) |

Chrome baseline: **Dashboard** (first shared screen). Later mocks that use a dark sidebar → **ignore**; keep the chrome lock below.

Same family of rules as [`MILESTONE_3_EXECUTION.md`](MILESTONE_3_EXECUTION.md) (chrome lock + do not invent unshared flows). Owner-web extras: **handle inconsistent mocks**; **ask + guide** when the next relevant screen is missing.

---

## Mock inconsistency + missing-flow protocol (mandatory)

Owner screens will disagree with each other (sidebar light vs dark, brand string, extra header icons, different card order, purple vs teal). The agent **must handle this** — do not bounce every mismatch back to the user, and do not “fix” chrome to match the latest PNG.

### A. Inconsistent mocks — agent handles (do not ask)

Follow the **Chrome consistency lock**. Copy **only the content region** from the named screen.

| Conflict | What the agent does |
|----------|---------------------|
| Dark vs light sidebar, different brand, extra header widgets | **Ignore.** Keep Dashboard chrome (Batch B) |
| Branch switcher looks enabled | Show store **name**; keep **disabled** (M7) |
| Decorative sample numbers (৳124,850, TXN-260814-1045) | Live API data only |
| Parked controls (bell, Prepare Return) | This file’s parked table — disable/omit; do not invent backends. W2 made Edit Product live; Batch N made CSV Export and persisted batch supplier/return metadata live. |
| Copy that implies returns / Baki / due | Follow product locks, not the mock caption |

On conflict: **this file + chrome lock > individual screenshot > Figma.**

### B. Missing next screen / broken flow — agent asks and guides (must stop)

If a **live** control on the current Slice 1 screen needs a **destination we do not have** (no screenshot, not in this slice, not parked as disabled), the agent **does not invent** that screen and **does not ship a dead click** without asking.

**Ask (then stop):**

```text
⏸ Batch X: "<Current screen>" has "<control>" but I do not have the next screen.

That flow looks like: <one sentence>.
I need you to either:
  1. Share that next screenshot, or
  2. Say "park it" (disable / later slice), or
  3. Say "invent" (match Admin Portal chrome; I will describe what I will build).

Stopping until you reply.
```

**Guide** in the same message: name the likely next screen, which slice/backlog bucket it belongs in, and the default if they say nothing (default = **park / disable**, never invent).

Examples that **must** trigger this ask (unless already parked in this file):

- Create Customer, Staff detail, PO / Supplier pages, Settings, Help, Owner Profile
- Any new modal/page implied by a primary CTA that is **not** listed in Slice 1 routes

Examples that **must not** trigger an ask (already locked):

- Disabled later-nav items (Customers/Staff/…), header bell/search, branch switch. Slice 2 Inventory **Prepare Supplier Return** is wired in Batch AA (do not treat as parked after AA).

### C. When the agent may proceed without asking

- Scaffolding / APIs / ingest locked by this file
- Invent-authorized Owner Login (Batch A)
- Chrome mismatches (section A)
- Parked controls (section A + parked table)

---

## Standing setup

### Terminals

**Terminal 1 — cloud API**

```bash
npm run dev -w @r2a/server
```

Wait until listening (`http://127.0.0.1:8787`). Repo-root `.env`: `DATABASE_URL`, `JWT_SECRET`. `CORS_ORIGIN` already includes `http://localhost:5173` (web) and `http://localhost:1420` (desktop). Also allow `http://127.0.0.1:5173` if missing.

**Terminal 2 — Owner web (from Batch A onward)**

```bash
npm run dev -w @r2a/web
```

Open **http://localhost:5173/**  
`apps/web/.env`: `VITE_API_BASE_URL=http://127.0.0.1:8787`

**Terminal 3 — desktop** (Batch D POS ingest + any dual-path check)

```bash
npm run dev -w @r2a/desktop
```

Open **http://localhost:1420/**

### Seed login

| Role | Email | Password | `apps/web` |
|------|-------|----------|------------|
| Owner | `owner@demo.local` | `ChangeMe123!` | **Allowed** |
| Manager | `manager@demo.local` | `ChangeMe123!` | **Reject** |
| Cashier | `cashier@demo.local` | `ChangeMe123!` | **Reject** |

Demo drug: **Napa** / sku `NAPA-500`.

---

## Acknowledgement — Plan & Status Audit (read-only)

This section records that `PROJECT_MASTER_PLAN.md`, `Current_Status.md`, `Completed_API_lists.md`, `ROLES_AND_PERMISSIONS.md`, `MILESTONE_3_EXECUTION.md`, `MILESTONE_5_EXECUTION.md`, and the authorized M6 Slice 1 plan were read before writing this file. **No application code is written by this document alone.**

### Where we are

| Item | State |
|------|--------|
| M0–M5 | **DONE** |
| Cloud API | Real — prior Slice 1 routes plus Owner batch detail; audited/versioned corrections; signed adjustments; Owner-only void/retire. General batch PATCH is metadata/price only. |
| `@r2a/desktop` | POS shell + one-way sync + Receive stock; W6 signed/versioned/reasoned online stock adjustment with catalog refresh |
| `@r2a/web` | **Batch M + W2/W5 DONE** — live Dashboard, Sales, Inventory, Product Add/Edit/Receive, and Batch Management |
| Schema | Batch C plus W1 lifecycle/version/revision, sale display snapshots, and InventoryEvent idempotency/result metadata |
| Ingest | **Batch D DONE** — `receiptNo`, cost snapshot, loyalty, FEFO flags, `InventoryEvent` SALE/RECEIVE/ADJUST |
| Loyalty | Session calc on POS; **Batch D** snapshots `loyaltyUsed`/`loyaltyEarned` on ingest when present |
| FEFO override | POS PIN stub unchanged; ingest persists `fefoOverride` + `fefoAuthorizedByName` (notes still kept) |
| Supplier / PO / returns | **Batch R APIs live:** OWNER-only Supplier/PO, confirmed GRN, return queue, and manifest lifecycle APIs. No Slice 2 UI yet. Batch keeps denormalized `supplierName` + `returnStatus` and optional `supplierId`. |
| Print / FEFO PIN | Stubs — stay stubs |

### Milestone 6 (master plan §7) vs this file

Full M6: bi-di sync, loyalty persist, refill/n8n, supplier return, Owner web, RLS.

**This file = Slice 1 (DONE) + Slice 2 (P–AB DONE; AC–AD deferred) + Slice 3 (AE DONE; AF–AM planned).** Full M6 still needs later slices.

---

## Incremental slice protocol (mandatory)

| Rule | Behavior |
|------|----------|
| Active scope | **Slice 3** (batches AE–AM). **AE DONE.** Slice 1 A–O **DONE**. Slice 2 **P–AB DONE**; **AC–AD deferred** |
| More Owner screens later | User shares → agent **appends Slice 4+** |
| Slice 1 complete | Batch O exit — **DONE** 2026-08-18 |
| Slice 2 complete | **Paused.** P–AB DONE. AC–AD **deferred** (not cancelled). No Batch AD exit until AC is authorized later |
| Slice 3 complete | Batch AM exit + user walkthrough PASS |
| M6 milestone complete | **Not** Slice 3 — later slices still required |
| Invent authorization | Owner Login (Slice 1). Record Supplier Decision + Complete Return **modals** (Slice 2 — deferred with AC). Slice 3: **Reject Registration** modal + **POS Create Customer** (specs below). |
| Slice 3 re-share | UI batches AH–AK ask for the named Owner screen (or use prior). POS Create is invent-authorized — do not stop for a POS screenshot |
| Not inventable yet | Manager web, Staff, Reports, Audit & FEFO, Settings, Help, Owner Profile, Edit Customer, Edit Supplier page, View All Receipts, Review Reorder Suggestions page, n8n, RLS, bi-di, branch switch, Slice 2 AC/AD |

---

## Invented IA Map (Slice 1)

```text
Login (OWNER)
  → Dashboard
       → Sales (View all)
            → Transaction Details
       → Inventory
            → Product Details → Receive Stock
            → Add Product
            → Receive Stock (from list CTA)
            → Expiry Management (alerts / Review Inventory Alerts)

Sidebar (visible):
  LIVE (Slice 1):      Dashboard, Sales, Inventory
  LIVE (Slice 2):      Purchasing, Suppliers
  LIVE (Slice 3):      Customers  (from Batch AG)
  DISABLED: Staff, Reports, Audit & FEFO, Settings,
            Help, Owner Profile
```

### Slice 1 routes (`apps/web`)

| Screen | Route |
|--------|--------|
| Login | `/login` |
| Dashboard | `/` |
| Sales | `/sales` |
| Transaction Details | `/sales/:id` |
| Inventory | `/inventory` |
| Expiry Management | `/inventory/expiry` |
| Add Product | `/inventory/new` |
| Product Details | `/inventory/:productId` |
| Receive Stock | `/inventory/:productId/receive` |
| Edit Product | `/inventory/:productId/edit` |
| Manage Batch | `/inventory/:productId/batches/:batchId` |

Register `/inventory/expiry` and `/inventory/new` **before** `/:productId`.

### Slice 2 routes (`apps/web`) — planned

| Screen | Route |
|--------|--------|
| Purchasing | `/purchasing` |
| Create Purchase Order | `/purchasing/new` (draft resume: `/purchasing/:poId/edit` — **same form**) |
| Purchase Order Details | `/purchasing/:poId` |
| Receive against PO | `/purchasing/:poId/receive` |
| Suppliers | `/suppliers` |
| Add Supplier | `/suppliers/new` |
| Supplier Details | `/suppliers/:supplierId` |
| Expiry Returns | `/suppliers/returns` |
| Create Return Manifest | `/suppliers/returns/new` |
| Return Manifest Details | `/suppliers/returns/:manifestId` |

Register `/purchasing/new`, `/suppliers/new`, `/suppliers/returns`, `/suppliers/returns/new` **before** `/:id` params.

`/suppliers/returns/:manifestId` stays a **parked placeholder** while Batch AC is deferred.

### Slice 3 routes (`apps/web`) — planned

| Screen | Route |
|--------|--------|
| Customers | `/customers` |
| Add Customer | `/customers/new` |
| Customer Details | `/customers/:customerId` (Active / Inactive only) |
| Customer Registration Review | `/customers/:customerId/review` (Pending only) |

Register `/customers/new` **before** `/:customerId`. Pending directory rows navigate to **Review**, not Details. After approve, navigate to Details. Pending ids on Details redirect to Review. Active ids on Review redirect to Details.

---

## Design locks (Slice 1)

### Chrome consistency lock

**Canonical chrome:** screen **Dashboard**.

| Layer | Locked look |
|-------|-------------|
| **Brand** | **PharmaSync Admin Portal** (not POS, not other names) |
| **Sidebar** | Light grey; teal active item (`#0D9488`). Ignore later dark-sidebar mocks |
| **Header** | Page/breadcrumb · **store name** (not a working branch switch) · bell · search · avatar |
| **Canvas** | `#F8FAFC` · white cards · teal primary CTAs |
| **Currency** | **৳** — never `$` |

**Rule for every UI batch** (same idea as M3 Search Results - Napa):

1. Build **sidebar / header once** to this baseline (Batch B); do not restyle them per screen.
2. When matching a named screen, copy **only the content region** (main workspace / table / form / right rail).
3. If a later screenshot shows a dark sidebar, different brand string, purple accents, or a working branch switch → **ignore**; keep this lock.
4. Login (invented) should feel like the same family (teal + light grey + PharmaSync Admin Portal), not a separate theme.

**Re-share label for chrome:** `Dashboard` (chrome baseline).

### Owner web vs desktop

| Topic | Lock |
|-------|------|
| Who logs in | **OWNER only**. Manager/Cashier: same login API, client + optional server reject for web session |
| Store control | Show JWT / `GET /tenant/context` store **name**. Dropdown **disabled**. Multi-branch = **M7** |
| Receive stock | Web Add Lot uses `POST /api/v1/batches`. Desktop Add Lot stays; manual stock correction uses signed `/batches/:id/adjustments` and is never queued offline. |
| Cost / margin / net profit | Owner web **shows**. `GET /sales` redacts those fields for Manager/Cashier (POS may use list later) |
| Create Customer | **Slice 3.** Owner web Add = Active immediately. POS Cashier/Manager = Pending until Owner approves. `POST /customers` role rules land in Batch AF |
| Net Sales copy | Gross − discounts. **No returns.** Do not invent a returns ledger |
| Amount due | Always **৳0** (fully settled) |

### Parked controls (on Slice 1 screens — do not fake data)

| Mock control | Slice 1 |
|--------------|---------|
| Branch / store switch | Display only, disabled |
| Supplier on Receive | Live optional batch-level text; Batch P adds Supplier data but this ad-hoc Slice 1 flow has no Supplier selector |
| Link PO / supplier invoice on Receive | **Omit** |
| Prepare Supplier Return | **Slice 1:** disabled. **Slice 2 Batch AA:** enable → `/suppliers/returns` |
| Return eligibility | Live persisted Batch metadata; no reservation/workflow |
| Manifest workflow | Not built; `MANIFEST_PREPARED` is metadata only |
| Export | Live client-side CSV of selected or filtered expiry rows |
| Header search / bell | Chrome only; no search results / notification inbox |
| Edit Product | Live through W2 |
| More Actions, View Inventory History | Disabled |
| Card last-4 / receipt-print timeline | Show only if already on the sale (notes/reference). Do not invent |

### Colors

| Token | Value |
|-------|--------|
| Primary teal | `#0D9488` |
| Canvas | `#F8FAFC` |
| Expiry | red ≤30d / yellow ≤90d / green >90d (same as POS) |

---

## Locked product & engineering decisions

### 1. Stack

- `apps/web`: Vite + React + TypeScript + Tailwind v4 + Lucide. Shadcn primitives as needed (may live in `apps/web` first; `@r2a/ui` is still a stub).
- Port **5173** (CORS already lists it in `.env.example`).
- Reuse M2 auth: `POST /auth/login`, refresh, `GET /users/me`.
- Envelope: `{ status, message, data?, meta? }`.

### 2. Schema (Batch C — additive)

**`Sale`:** `receiptNo` (unique per tenant), `loyaltyPrevious` Int default 0, `loyaltyUsed` Int default 0, `loyaltyEarned` Int default 0.

**`receiptNo` format:** `TXN-YYMMDD-HHmm` from `soldAt` (UTC is OK) + last 2 chars of `eventId` if needed for uniqueness. Example: `TXN-260814-1045`. Store on insert; never client-supplied.

**`SaleItem`:** `fefoOverride` Boolean default false, `fefoAuthorizedByName` String?, `costPerBaseAtSale` Decimal(12,4) — **server-filled** from the batch at ingest. Never trust client cost.

**`Product`:** optional `category`, `requiresPrescription` Boolean default false, `coldChain` Boolean default false, `storageNotes`, `reorderLevel` Int?.

**`Batch` (Batch N repair):** optional `supplierName`; `returnStatus` = `ELIGIBLE` | `NOT_ELIGIBLE` | `MANIFEST_PREPARED`, default `NOT_ELIGIBLE`. Batch P later adds optional `supplierId` plus Supplier/return-manifest models; behavior remains gated to Q/R+.

**`InventoryEvent`** (append-only):

| Field | Notes |
|-------|--------|
| `type` | `RECEIVE` \| `ADJUST` \| `SALE` |
| `quantityBaseChange` | Signed PIECE delta |
| `productId`, `batchId?`, `storeId`, `tenantId` | Required scoping |
| `saleId?` | Set on SALE |
| `actorUserId?` | JWT `sub` for RECEIVE/ADJUST |
| `eventId?`, `reasonCode?`, `quantityAfter?`, `note?` | W1/W3 audit and idempotency metadata |

Current writers: `POST /batches` (RECEIVE), signed `/batches/:id/adjustments` and lifecycle compensation (ADJUST), sale ingest (SALE per line). The original Batch D absolute PATCH writer was removed in W6.

### 3. Ingest extensions (Batch D)

Optional on `saleIngestSchema` (old POS payloads still work):

- Sale: `loyaltyUsed`, `loyaltyEarned` (ints ≥ 0)
- Item: `fefoOverride`, `fefoAuthorizedByName`

Server: if `customerId` present, snapshot `loyaltyPrevious` from `Customer.loyaltyPoints`, apply used/earned, persist customer balance. If loyalty fields omitted → snapshots 0, **do not** change points (backward compatible until desktop is wired in the same batch).

`/sales/ingest` and `/sync/ingest` share `ingestSale`. Offline queue: extra fields optional JSON — old queued events still ingest.

### 4. New routes

| Route | Roles | Batch |
|-------|--------|-------|
| `GET /api/v1/sales` | Any authenticated. **Redact** cost/margin/COGS/net-profit unless `OWNER` | E |
| `GET /api/v1/sales/:id` | Same redaction | E |
| `GET /api/v1/owner/dashboard` | `OWNER` only | F |
| `GET /api/v1/owner/inventory-summary` | `OWNER` only | F |
| `GET /api/v1/owner/expiry` | `OWNER` only | F |
| `GET /api/v1/owner/inventory` | `OWNER` only | J |
| `GET /api/v1/owner/products/:id` | `OWNER` only | K |

`GET /sales` query: `q`, `paymentMethod`, `userId`, `from`, `to`, `limit` (max 100, default 25), `offset`. `meta.total` required.

**Low stock:** `reorderLevel != null` AND `0 < onHand <= reorderLevel`.  
**Out of stock:** active product, onHand = 0.  
**Expiry buckets:** qty > 0; 0–30 / 31–60 / 61–90 days; Expired = expiry < today.

**Net profit (Owner):** `sum(lineTotal) − sum(costPerBaseAtSale * quantityBase)` for the period (discount already in `Sale.total` vs lines — prefer **sale.total − period COGS** so discounts count). Document the formula in catalog.

### 5. Out of Slice 1

Manager web, n8n, RLS, bi-di sync, Supplier/PO models, return manifests, CSV import, terminal presence, Create Customer UI, branch switching, printer IPC, `pinHash`, sale void, `creditBalance`.

---

## Target web folder tree (locked)

```text
apps/web/
├── package.json          # @r2a/web
├── tsconfig.json
├── vite.config.ts        # port 5173
├── index.html
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── i18n/             # en.ts, bn-BD.ts, provider (default bn-BD)
│   ├── features/
│   │   ├── auth/
│   │   ├── shell/        # sidebar, header
│   │   ├── dashboard/
│   │   ├── sales/
│   │   └── inventory/
│   └── lib/              # api client, session, format ৳
└── .env.example          # VITE_API_BASE_URL
```

Keep workspace name `@r2a/web`. Do not add Next.js.

---

## Batch overview (Slice 1)

| Batch | Title | Primary area | Depends on | Re-share screen? |
|-------|-------|--------------|------------|------------------|
| **A** | Web scaffold + OWNER session | `apps/web` | M5 | Invent Login |
| **B** | Owner chrome lock | shell | A | Dashboard (chrome only) |
| **C** | Prisma + shared-types | database + types | A | No |
| **D** | Ingest + POS wire-up | server + desktop `saleIngest.ts` | C | No |
| **E** | `GET /sales` + `GET /sales/:id` | server | D | No |
| **F** | Owner dashboard / summary / expiry APIs | server | C | No |
| **G** | Dashboard screen | web | B + E + F | **Dashboard** |
| **H** | Sales list | web | G | **Sales Overview & Transactions** |
| **I** | Transaction Details | web | H | **Transaction Details** |
| **J** | Inventory list | web | B + F | **Inventory** |
| **K** | Product Details | web | J | **Product Details** |
| **L** | Add Product | web | J | **Add Product** |
| **M** | Receive Stock (web) | web | K | **Receive Stock** |
| **N** | Expiry Management | web | J + F | **Expiry Management** |
| **O** | Slice 1 exit | catalog + smoke + status | A–N | No |

Recommended chat order: **A → B → C → D → E → F → G → H → I → J → K → L → M → N → O**.

C may run after A even if B is in parallel **only if** the user authorizes it; default is strict A→O.

---

## Batch A — Web scaffold + OWNER session

**Goal:** Runnable `@r2a/web`. Owner can log in against M2. Manager/Cashier are rejected on the web app. **No chrome IA, no dashboard widgets.**

**Re-share screen:** none (invent Login to match teal / Admin Portal).

### Tasks

- [x] Replace stub [`apps/web/package.json`](apps/web/package.json) with Vite + React 19 + TS + Tailwind v4 (mirror desktop deps: `@vitejs/plugin-react`, `@tailwindcss/vite`, `lucide-react`, `@r2a/shared-types`)
- [x] `vite.config.ts` port **5173**; alias `@` → `src`
- [x] `apps/web/.env.example` with `VITE_API_BASE_URL=http://127.0.0.1:8787`
- [x] i18n: `en.ts` + `bn-BD.ts` + provider; default **bn-BD**; locale switch must not require re-login
- [x] Login form: email + password → `POST /api/v1/auth/login` + store access/refresh like desktop session
- [x] After login: `GET /users/me`. If `role !== "OWNER"` → clear session, show i18n error, stay on login
- [x] Logged-in placeholder route `/` (“Owner portal” + Logout). No sidebar yet
- [x] `npm run smoke:m6a -w @r2a/web`: package name, vite port 5173, OWNER gate in source
- [x] Do **not** build sidebar. Do **not** add Prisma fields. Do **not** add `GET /sales`

### Allowed focus

- `apps/web/**` (scaffold)
- Root workspace already includes `apps/*`
- `apps/web/scripts/smoke-m6a.ts` + package.json script
- This file’s Batch A checkboxes

### Exit check

- `npm run dev -w @r2a/web` serves login
- Owner login lands on placeholder home
- Manager/Cashier login shows reject copy
- `smoke:m6a` PASS

### Ask-before-inventing

Low-ask. Do not invent dashboard cards.

### Agent prompt

```text
Implement ONLY Batch A from MILESTONE_6_EXECUTION.md
(Web scaffold + OWNER session).
Vite+React+TS+Tailwind on @r2a/web port 5173. i18n en + bn-BD.
Owner login via M2 auth; reject MANAGER and CASHIER.
No sidebar, no GET /sales, no schema.
When done, paste the short M6 Batch A report.
```

### User walkthrough (after Batch A)

**YOU DO**

1. API running. `npm run dev -w @r2a/web` → http://localhost:5173/
2. Login `cashier@demo.local` — must **fail** (stay on login).
3. Login `owner@demo.local` / `ChangeMe123!` — placeholder home + Logout.

**Next:** After PASS, new chat → `Authorize M6 Batch B`.

---

## Batch B — Owner chrome lock

**Goal:** Sidebar + header locked. Live nav: Dashboard, Sales, Inventory (placeholder pages OK). Later nav **visible and disabled**. Store name shown, **not** switchable.

**Re-share screen:** **Dashboard** (chrome only — ignore main widgets until G).

### Tasks

- [x] Ask for **Dashboard** screenshot first; stop until shared / “use prior upload”
- [x] Sidebar IA per this file; active state teal
- [x] Header: breadcrumb/title slot · store name from tenant/me · bell + search **non-functional** · avatar
- [x] Footer area of sidebar: Help + Owner Profile **disabled**
- [x] Routes exist for `/`, `/sales`, `/inventory` as empty shells (i18n titles)
- [x] Locale control somewhere accessible (header or later Settings — for Slice 1: header or login-already-has is OK; do not build Settings page)
- [x] i18n all chrome strings
- [x] `smoke:m6b`: sidebar labels include disabled later items; Purchasing remained disabled until Batch S
- [x] Do **not** fetch dashboard KPIs (Batch G)

### Exit check

- Owner sees Admin Portal chrome
- Disabled items do not route
- Store control does not change `storeId`

### Agent prompt

```text
Implement ONLY Batch B from MILESTONE_6_EXECUTION.md
(Owner chrome lock).
Re-share: Dashboard — stop until the user shares or says use prior.
Then build sidebar + header only. Later nav disabled.
No KPI data. No GET /sales UI tables.
When done, paste the short M6 Batch B report.
```

### User walkthrough

**YOU DO:** Open web as Owner. Confirm sidebar list + disabled later items + store name visible.

**Next:** `Authorize M6 Batch C`.

---

## Batch C — Prisma + shared-types

**Goal:** Additive schema + Zod. Migrate. **No** ingest behavior change yet (old ingest still works). **No** web screens.

**Re-share screen:** none.

### Tasks

- [x] Prisma fields/models per **Locked decisions §2** (`Sale`, `SaleItem`, `Product`, `InventoryEvent` enum+model). Tenant relations + indexes (`tenantId`, `saleId`, `productId`)
- [x] `receiptNo` unique with `tenantId` (`@@unique([tenantId, receiptNo])`)
- [x] Zod: extend product create/update; sale ingest optionals; new owner/sales query DTOs **stubs OK if unused until E/F** — prefer adding ingest + product schemas now
- [x] `prisma migrate` + generate. Existing seed still runs
- [x] Optional: seed `reorderLevel` on Napa only if needed for later low-stock demo — do **not** rewrite catalog
- [x] Do **not** change `ingestSale` logic yet (Batch D)
- [x] Do **not** add GET routes yet

### Allowed focus

- `packages/database/prisma/**`
- `packages/shared-types/**`
- This file’s Batch C checkboxes

### Exit check

- Migrate applies on Neon/local
- `npm run smoke:m2 -w @r2a/server` still PASS (ingest unchanged)

### Agent prompt

```text
Implement ONLY Batch C from MILESTONE_6_EXECUTION.md
(Prisma + shared-types).
Additive Sale/SaleItem/Product/InventoryEvent fields. Zod for new columns.
Do not change ingestSale behavior. Do not add GET /sales.
When done, paste the short M6 Batch C report.
```

### User walkthrough

**YOU DO:** Confirm migrate applied (agent should run it). Optional: `smoke:m2`.

**Next:** `Authorize M6 Batch D`.

---

## Batch D — Ingest extensions + POS wire-up

**Goal (historical Batch D):** New sales persist loyalty snapshots, FEFO flags, cost-at-sale, receiptNo, SALE inventory events. Batch D originally wrote ADJUST on absolute PATCH; W6 superseded that writer with signed adjustments. Desktop `saleIngest.ts` sends the new fields. **Cashier UX unchanged.**

**Re-share screen:** none.

### Tasks

- [x] `ingestSale`: generate `receiptNo`; fill `costPerBaseAtSale`; persist FEFO flags; loyalty snapshot + `Customer.loyaltyPoints` update when fields present; write `InventoryEvent` SALE rows
- [x] Idempotent replay: do **not** double-apply loyalty or events
- [x] `POST /batches` → RECEIVE event (`quantityBaseChange` = qty posted)
- [x] Historical Batch D PATCH qty → ADJUST event (superseded and removed by W6 signed `/adjustments`)
- [x] Desktop [`saleIngest.ts`](apps/desktop/src/lib/saleIngest.ts): send `loyaltyUsed` / `loyaltyEarned` from existing `loyaltyCalc`; send per-line `fefoOverride` + `fefoAuthorizedByName`. Keep notes for card/MFS as today
- [x] Do **not** change Redeem OTP stub / PIN stub
- [x] `smoke:m6d` (server and/or desktop source): ingest with override line + loyalty fields persists; old payload without them still 200
- [x] `smoke:m2` still PASS

### Exit check

- New POS completed sale (online) has `receiptNo` + cost snapshot in Postgres
- Old smoke ingest still works
- Desktop checkout looks the same

### Agent prompt

```text
Implement ONLY Batch D from MILESTONE_6_EXECUTION.md
(Ingest extensions + POS saleIngest wire-up).
Loyalty + FEFO + costPerBaseAtSale + receiptNo + InventoryEvent.
Cashier UX unchanged. Keep /sync/ingest on ingestSale.
When done, paste the short M6 Batch D report.
```

### User walkthrough

**YOU DO:** Optional: POS Owner or Cashier complete one Napa sale (open shift). Agent may verify via API.

**Next:** `Authorize M6 Batch E`.

---

## Batch E — GET sales list + detail

**Goal:** Cloud sales read API. Owner sees cost/COGS fields. Manager/Cashier get the same sale **without** cost/margin. **No** Owner web tables yet.

**Re-share screen:** none.

### Tasks

- [x] `GET /api/v1/sales` + `GET /api/v1/sales/:id` (id = Prisma `Sale.id`; also accept `receiptNo` **or** document id-only — **lock: `:id` is Sale.id**; list returns `id` + `receiptNo`)
- [x] Include customer name/phone, cashier name, items+product names, payments, loyalty snapshots, `fefoOverride` on lines
- [x] Redact `costPerBaseAtSale`, line/sale COGS, margins unless `OWNER`
- [x] Pagination `meta.total`
- [x] `restrictTo` not required (any authenticated) — redaction is the control
- [x] `smoke:m6e`: owner list 200 with cost; cashier list 200 without cost keys; 401 without token
- [x] Do **not** build `/sales` UI (Batch H)

### Exit check

- `smoke:m6e` PASS
- Envelope matches existing style

### Agent prompt

```text
Implement ONLY Batch E from MILESTONE_6_EXECUTION.md
(GET /sales and GET /sales/:id).
Owner sees cost fields; cashier/manager redacted.
No Owner web sales table.
When done, paste the short M6 Batch E report.
```

### User walkthrough

**YOU DO:** none required if smoke PASS (or curl with owner token if you want).

**Next:** `Authorize M6 Batch F`.

---

## Batch F — Owner dashboard / inventory-summary / expiry APIs

**Goal:** Three OWNER-only aggregate endpoints. Manager **403**. **No** web widgets yet.

**Re-share screen:** none.

### Tasks

- [x] `GET /api/v1/owner/dashboard?from&to` (default last 7 days). Payload enough for screen G: KPIs (today sales, net profit, txn count, avg sale + vs yesterday / steady), daily bars, inventory health counts, FEFO override counts today/week, expiring stock value (≤90d cost), recent sales (small list)
- [x] `GET /api/v1/owner/inventory-summary` — totals, cost value, low/out/expiring counts for screen J cards + attention panel
- [x] `GET /api/v1/owner/expiry?bucket=0_30|31_60|61_90|expired` + counts for all buckets. Rows: product name/generic, batchNumber, expiry, qty, cost value, FEFO rank in product. **No** supplier column (omit). **No** return eligibility
- [x] `restrictTo("OWNER")` on all three
- [x] `smoke:m6f`: owner 200; cashier 403
- [x] Do **not** build Dashboard UI (Batch G)

### Exit check

- `smoke:m6f` PASS

### Agent prompt

```text
Implement ONLY Batch F from MILESTONE_6_EXECUTION.md
(Owner dashboard, inventory-summary, expiry APIs).
OWNER only. No web widgets.
When done, paste the short M6 Batch F report.
```

### User walkthrough

**YOU DO:** none if smoke PASS.

**Next:** `Authorize M6 Batch G`.

---

## Batch G — Dashboard screen

**Goal:** Live Dashboard matching the shared screen, using Batch F + recent sales from E/F.

**Re-share screen:** **Dashboard**.

### Tasks

- [x] Ask for screenshot; stop until reply
- [x] Wire `/` to `GET /owner/dashboard`
- [x] KPI cards, 7-day bars, inventory health, FEFO oversight, recent sales table
- [x] Recent sale row click → `/sales/:id` (detail may be placeholder until I — **lock: navigate anyway**; I fills the page)
- [x] **View All Sales** → `/sales`
- [x] Date range control: at least Last 7 Days (match API `from`/`to`). Extra presets OK (Today / 30d)
- [x] Empty/error i18n. Latin digits. ৳
- [x] `smoke:m6g`: Dashboard feature calls owner dashboard URL; no hard-coded ৳124,850
- [x] Do **not** build full Sales table filters (Batch H)

### Exit check

- Owner Dashboard shows **seed/live** numbers, not mock ৳124,850 unless that happens to be real
- Manager still cannot log in

### Agent prompt

```text
Implement ONLY Batch G from MILESTONE_6_EXECUTION.md
(Dashboard screen).
Re-share: Dashboard — stop until the user shares or says use prior.
Live GET /owner/dashboard. No invented KPIs.
When done, paste the short M6 Batch G report.
```

### User walkthrough

**YOU DO:** Owner web → Dashboard. Confirm cards move with a POS sale (if you just sold).

**Next:** `Authorize M6 Batch H`.

---

## Batch H — Sales list

**Goal:** Sales Overview & Transactions, live `GET /sales` + dashboard payment mix / top cashier (from F dashboard or compute on client from list — **prefer server**: extend dashboard or sales summary). If F payload lacks payment mix / top cashier, **add those fields in this batch** on `GET /owner/dashboard` or a small `GET /owner/sales-summary` — keep OWNER-only.

**Re-share screen:** **Sales Overview & Transactions**.

### Tasks

- [x] Ask for screenshot; stop until reply
- [x] KPIs: Gross, Net (= gross − discounts; copy must **not** claim returns), txn count, avg sale
- [x] Payment breakdown Cash / Card / MFS
- [x] Top cashier card
- [x] Table: receiptNo (link), datetime, customer (or Walk-in), item count, payment pills
- [x] Search + payment/cashier filters + pagination
- [x] Export button: **no-op** or omit
- [x] Status filter: only Completed exists — hide or single value
- [x] `smoke:m6h`: no hard-coded TXN-260814-1045 as the only row
- [x] Do **not** build detail layout (Batch I)

### Exit check

- List matches Postgres sales for the store
- Click receiptNo goes to `/sales/:id`

### Agent prompt

```text
Implement ONLY Batch H from MILESTONE_6_EXECUTION.md
(Sales list).
Re-share: Sales Overview & Transactions — stop until shared or use prior.
Live GET /sales. Net sales = gross minus discounts (no returns).
When done, paste the short M6 Batch H report.
```

### User walkthrough

**YOU DO:** Open Sales. Confirm a known POS sale appears. Click it (detail may be thin until I).

**Next:** `Authorize M6 Batch I`.

---

## Batch I — Transaction Details

**Goal:** Live sale detail. OVERRIDE badge when `fefoOverride`. Loyalty grid from snapshots. Reprint = **on-screen receipt preview from sale JSON** (no Tauri IPC).

**Re-share screen:** **Transaction Details**.

### Tasks

- [x] Ask for screenshot; stop until reply
- [x] `GET /sales/:id` — header cards, customer, items, settlement, activity
- [x] Activity timeline: invent **only from known facts** (soldAt, payments, FEFO flags, inventory events if any). Do not fake “card ending 4242” unless `Payment.reference` has it
- [x] Amount Due ৳0. No Baki
- [x] More Actions **disabled**. Reprint opens preview modal/panel
- [x] i18n chrome; medicine names untranslated
- [x] `smoke:m6i`: detail route uses GET sales/:id
- [x] Do **not** add void

### Exit check

- Override line shows badge when ingest had FEFO override
- Walk-in sales have no loyalty grid (or empty / hidden)

### Agent prompt

```text
Implement ONLY Batch I from MILESTONE_6_EXECUTION.md
(Transaction Details).
Re-share: Transaction Details — stop until shared or use prior.
Live GET /sales/:id. Reprint = on-screen preview only.
When done, paste the short M6 Batch I report.
```

### User walkthrough

**YOU DO:** Open a sale with a customer; confirm loyalty numbers if that sale was after Batch D. Open a walk-in sale.

**Next:** `Authorize M6 Batch J`.

---

## Batch J — Inventory list

**Goal:** Live inventory table + summary cards + attention panel. Cost/sell/margin visible (Owner).

**Re-share screen:** **Inventory**.

### Tasks

- [x] Ask for screenshot; stop until reply
- [x] `GET /owner/inventory-summary` + paged `GET /products` + batches as needed (or one Owner list endpoint **if** product GET is too chatty — **prefer** a `GET /api/v1/owner/inventory` list in this batch rather than N+1 from the browser). If added, OWNER-only, document in catalog at O
- [x] Tabs: All / Low / Out / Expiring 30d / 90d / Expired
- [x] Search medicine, generic, SKU, barcode
- [x] Columns per mock except do not invent manufacturer if missing
- [x] COLD CHAIN badge when `coldChain`
- [x] CTAs: Add Product → `/inventory/new`; Receive Stock → needs a product: go to list selection **or** `/inventory` with hint — **lock:** Receive Stock on this page navigates to search/select product then `/inventory/:id/receive`, or disabled until a row is chosen. Prefer: button → `/inventory/new` is Add; Receive on **row** or after search. Header **Receive Stock** → simple product picker then receive route
- [x] Review Inventory Alerts → `/inventory/expiry`
- [x] Pagination
- [x] `smoke:m6j`: no hard-coded 2,486 products
- [x] Do **not** build product detail (Batch K)

### Exit check

- Napa from seed appears with live qty
- Cost columns show for Owner

### Agent prompt

```text
Implement ONLY Batch J from MILESTONE_6_EXECUTION.md
(Inventory list).
Re-share: Inventory — stop until shared or use prior.
Live summary + product/batch data. OWNER cost/margin.
When done, paste the short M6 Batch J report.
```

### User walkthrough

**YOU DO:** Open Inventory. Find Napa. Confirm qty matches POS/Select Batch.

**Next:** `Authorize M6 Batch K`.

---

## Batch K — Product Details

**Goal:** Live product page: summary, FEFO batch, units, batch table, recent `InventoryEvent`s.

**Re-share screen:** **Product Details**.

### Tasks

- [x] Ask for screenshot; stop until reply
- [x] `GET /products/:id` + batches + units + events (add `GET /api/v1/owner/products/:id` **only if** composing would leak extra round-trips or miss events — allowed, OWNER-only)
- [x] FEFO rank = sellable lots by expiry
- [x] Edit Product **disabled**. Receive Stock → receive route
- [x] View Inventory History **disabled** (recent list on-page is enough)
- [x] `smoke:m6k`: product details uses live product id
- [x] Do **not** build Add Product form (Batch L)

### Exit check

- Napa batches match cloud
- Recent activity shows SALE after a POS sale (and RECEIVE after desktop/web receive)

### Agent prompt

```text
Implement ONLY Batch K from MILESTONE_6_EXECUTION.md
(Product Details).
Re-share: Product Details — stop until shared or use prior.
Live product, batches, FEFO, InventoryEvent.
Edit Product stays disabled.
When done, paste the short M6 Batch K report.
```

### User walkthrough

**YOU DO:** Open Napa from Inventory. Confirm FEFO lot and stock.

**Next:** `Authorize M6 Batch L`.

---

## Batch L — Add Product

**Goal:** Create catalog row via `POST /products` (extended fields). Initial stock 0. No receive in this form.

**Re-share screen:** **Add Product**.

### Tasks

- [x] Ask for screenshot; stop until reply
- [x] Form: name (required), generic, manufacturer (text or datalist from existing manufacturers — **no** Supplier table), strength, form, SKU, barcode, category, units Piece→Strip→Box with factors, sell prices **per unit derived from sellPerBase on first batch — lock:** Add Product does **not** create a batch. Selling price fields: store as **default sell-per-base** only if we add `Product.defaultSellPerBase` — **do not** add another price table. **Lock:** Selling Prices on Add Product set `Product` description or skip until first Receive supplies `sellPerBase`. Prefer: persist **optional** `defaultSellPerBase` / `defaultCostPerBase` on Product in this batch if the form needs it; Receive pre-fills from them. If you skip defaults, hide Selling Prices and keep packaging units only (`ProductUnit`)
- [x] Additional: Rx toggle, cold chain, storage notes, reorder level, Active
- [x] Info: initial stock 0
- [x] Create → POST → navigate to Product Details
- [x] `smoke:m6l`: form posts `/api/v1/products`
- [x] Do **not** POST batches here

### Exit check

- New product shows in Inventory with 0 pcs
- POS catalog pull (after refresh) can find it when active

### Agent prompt

```text
Implement ONLY Batch L from MILESTONE_6_EXECUTION.md
(Add Product).
Re-share: Add Product — stop until shared or use prior.
POST /products + units + new optional fields. No initial stock.
When done, paste the short M6 Batch L report.
```

### User walkthrough

**YOU DO:** Create a throwaway product. Confirm it appears at 0 stock.

**Next:** `Authorize M6 Batch M`.

---

## Batch M — Receive Stock (web)

**Goal:** Owner receives a lot from the web using **`POST /api/v1/batches`** (same as desktop). Batch N repair adds optional supplier/return metadata. Omit PO / invoice.

**Re-share screen:** **Receive Stock**.

### Tasks

- [x] Ask for screenshot; stop until reply
- [x] Product context card from GET product
- [x] Fields: batchNumber, expiry, qty PIECE, costPerBase, sellPerBase, received date **display only** (server `createdAt`)
- [x] Optional batch-level supplier + return status; omit Link PO and invoice
- [x] Live packaging math + cost/retail/margin + stock impact from current on-hand
- [x] Confirm → POST batches → InventoryEvent RECEIVE (already D) → Product Details
- [x] i18n; duplicate batchNumber uses existing API error
- [x] `smoke:m6m`: receive page calls POST /batches
- [x] Do **not** queue offline GRN

### Exit check

- New lot appears on Product Details and POS after catalog pull
- Desktop Receive still works through the W6 signed adjustment contract

### Agent prompt

```text
Implement ONLY Batch M from MILESTONE_6_EXECUTION.md
(Receive Stock web).
Re-share: Receive Stock — stop until shared or use prior.
POST /batches only. Optional batch supplier/return metadata; omit PO/invoice.
When done, paste the short M6 Batch M report.
```

### User walkthrough

**YOU DO:** Receive a new Napa lot from web. Confirm POS search sees it after pull/reload.

**Next:** `Authorize M6 Batch N`.

---

## Batch N — Expiry Management

**Gate:** Owner Web Missing Features W1–W6 had to be green before authorization. **Met, authorized, and completed 2026-08-18.**

**Goal:** Live expiry buckets with persisted supplier/return metadata. Prepare Supplier Return remains **disabled**; no manifest workflow.

**Re-share screen:** **Expiry Management**.

### Tasks

- [x] Ask for screenshot; stop until reply
- [x] `GET /owner/expiry` — cards + table + tabs
- [x] Search medicine/batch/supplier
- [x] CSV Export for selected or filtered rows
- [x] Select-all/current-row checkboxes
- [x] Supplier + Return Eligibility display and dropdown filters
- [x] Prepare Supplier Return disabled
- [x] Row click → Product Details optional
- [x] `smoke:m6n`: expiry page calls owner expiry API
- [x] Do **not** create return manifests

### Exit check

- Expired/near-expiry seed lots appear in the right bucket
- Return button stays disabled

### Agent prompt

```text
Implement ONLY Batch N from MILESTONE_6_EXECUTION.md
(Expiry Management).
Re-share: Expiry Management — stop until shared or use prior.
Live expiry API. Return workflow stays disabled.
When done, paste the short M6 Batch N report.
```

### User walkthrough

**YOU DO:** Open Expiry. Confirm a known near-expiry or expired demo lot if present.

**Next:** `Authorize M6 Batch O`.

---

## Batch O — Slice 1 exit

**Goal:** Catalog, composed smoke, status/master-plan pointers. M6 stays **IN PROGRESS** (more slices later). Slice 1 marked done.

**Re-share screen:** none.

### Tasks

- [x] [`Completed_API_lists.md`](Completed_API_lists.md) **§21**: GET sales, owner dashboard/summary/expiry, ingest extras, InventoryEvent, product/batch extras, redaction rules
- [x] `npm run smoke:m6s1` composes durable m6a–m6n guards + `smoke:m2`; PASS 2026-08-18
- [x] [`Current_Status.md`](Current_Status.md): M6 Slice 1 screens live; later backlog listed; next = Slice 2 when screens shared
- [x] [`PROJECT_MASTER_PLAN.md`](PROJECT_MASTER_PLAN.md): M6 still not DONE; Owner Web Slice 1 noted as complete
- [x] [`ROLES_AND_PERMISSIONS.md`](ROLES_AND_PERMISSIONS.md): Owner web live for Slice 1; Manager web still later
- [x] This file: A–O checkboxes; Slice 1 status **DONE**
- [x] Did not start Purchasing or Manager web

### Exit check

- `smoke:m6s1` PASS
- Docs match live routes
- User Slice 1 walkthrough PASS (login → dashboard → sales → inventory → receive → expiry)

### Agent prompt

```text
Implement ONLY Batch O from MILESTONE_6_EXECUTION.md
(Slice 1 exit).
Catalog §21, smoke:m6s1, status + master plan + RBAC notes.
Do not build new screens.
When done, paste the short M6 Batch O report and the user walkthrough.
```

### User walkthrough (Slice 1)

**YOU DO**

1. Web: Owner login → Dashboard numbers look real.
2. Sales → open a transaction.
3. Inventory → Napa details → Receive a small lot.
4. Expiry page loads; Return stays disabled.
5. Cashier **cannot** use web login.
6. POS still checks out.

**Next after PASS:** Share the next Owner screens for **Slice 2**. Do not start n8n / RLS / bi-di unless authorized.

**Slice 2 P–AB DONE. AC–AD deferred.** Slice 3 **AE DONE**. Next implement: `Authorize M6 Batch AF`.

---

## Slice 2 — Purchasing, Suppliers, Expiry Returns

User shared screens 2026-08-18 (scroll bottoms are **not** extra pages). Locks from planning chat + correction: **keep dedicated Create Return Manifest page**.

### Slice 2 IA

```text
Purchasing
  → Create Purchase Order
  → PO Details
       → Receive Stock against this PO (GRN)
Inventory Receive (Slice 1) STAYS — ad-hoc lot, no PO

Suppliers
  → Add Supplier
  → Supplier Details
       → Create PO
       → Expiry Returns

Expiry Returns queue
  → Create Return Manifest          (dedicated page)
  → Manifest Details                (one page: Prepared | Dispatched | Accepted | Completed)
       → Record Dispatch            (modal — shared)
       → Record Supplier Decision   (modal — spec)
       → Complete Return            (modal — spec)

Inventory → Expiry → Prepare Supplier Return → /suppliers/returns
```

**10 unique pages + 3 modals.** Do **not** collapse Create Return Manifest into the queue.

### Dual receive (locked)

| Path | When | Implementation |
|------|------|----------------|
| Inventory → Receive | Ad-hoc / opening stock / no PO | Keep Slice 1 `POST /batches` |
| Purchasing → Receive against PO | Goods vs a PO | New GRN record + `POST /batches` (or internal shared create-lot) with `supplierId` + `purchaseOrderId`; update PO remaining qty |

Desktop Settings Receive stays ad-hoc. Same lot table. No offline GRN.

### Parked on Slice 2 mocks (do not invent extra screens)

| Control | Slice 2 |
|---------|---------|
| Review Reorder Suggestions | **Disabled** |
| View All Receipts / GRN list | **Disabled** |
| Edit Supplier | **No page.** Add Supplier only |
| Extra draft-resume screen | **None.** Save as Draft uses Create PO form; reopen `/purchasing/:poId/edit` |
| Export / Print / More Actions | **Disabled** unless a later slice shares them |
| Header search / bell / branch switch | Unchanged Slice 1 chrome |
| Save as Draft on Add Supplier / GRN | Add Supplier → **Disabled** (no Edit page; Batch Y). GRN → **Disabled** (Batch W). Persist only if the same page can reopen it |

**Keep live on shared Create PO:** **Add Suggested Items** (inline, not a new page).

### Domain numbers

| Kind | Format |
|------|--------|
| PO | `PO-YYMMDD-####` unique per tenant |
| GRN | `GRN-YYMM-####` unique per tenant |
| Return manifest | `SRM-YYMMDD-####` unique per tenant |

### Schema (Batch P — additive)

New models (all `tenantId`-scoped): `Supplier`, `PurchaseOrder`, `PurchaseOrderLine`, `GoodsReceipt`, `GoodsReceiptLine`, `ReturnManifest`, `ReturnManifestLine`.

**`Supplier`:** name, contactPerson, phone, email?, address?, city?, registrationNumber?, notes?, paymentTerms?, leadTimeDays?, minOrderValue?, status `ACTIVE` \| `HOLD` \| `DRAFT`, expiryReturnsAccepted, minDaysBeforeExpiry?, returnNotes?, preferredContact?, secondaryPhone?, `isActive`.

**`PurchaseOrder`:** `poNumber`, `supplierId`, store from JWT, status `DRAFT` \| `SENT` \| `PARTIALLY_RECEIVED` \| `RECEIVED`, `reference?`, `expectedDelivery?`, createdBy, money totals (estimated). Creating a PO **does not** change inventory.

**`PurchaseOrderLine`:** `productId`, `qtyOrdered` PIECE, `qtyReceived` default 0, `costPerBase` snapshot.

**`GoodsReceipt`:** `grnNumber`, `purchaseOrderId`, `supplierInvoiceRef?`, `deliveryNote?`, `receivedAt`, `receivedByUserId`, status `CONFIRMED` (no draft GRN list). Confirm creates lots.

**`GoodsReceiptLine`:** `productId`, `qty` PIECE, `batchNumber`, `expiryDate`, `costPerBase`, `sellPerBase` → creates `Batch` + `InventoryEvent` RECEIVE; set `Batch.supplierId` (new optional FK) and keep `supplierName` denormalized from Supplier.name.

**`ReturnManifest`:** `srmNumber`, `supplierId`, status `PREPARED` \| `DISPATCHED` \| `ACCEPTED` \| `REJECTED` \| `COMPLETED`, preparedBy, preparedAt, supplierReference?, notes?, dispatch fields, decision fields, completedAt?.

**`ReturnManifestLine`:** `batchId`, `returnQty` PIECE, cost snapshot at prepare.

**`Batch.returnStatus`:** keep enum; creating a manifest sets lines to `MANIFEST_PREPARED`. Dispatch does **not** revert that; Eligible queue hides/disables those rows.

Optional `Batch.supplierId` FK — do not drop `supplierName` in Slice 2.

### Return lifecycle spec (one Manifest Details page)

Status stepper: **Prepared → Dispatched → Supplier Decision (Accepted) → Completed**.

| Current | Primary CTA | Effect |
|---------|-------------|--------|
| PREPARED | Record Dispatch | Shared modal. After confirm: signed `POST /batches/:id/adjustments` per line (`reasonCode` `SUPPLIER_RETURN_DISPATCH`, negative qty, `expectedVersion`, `eventId`). Stock leaves. Status **DISPATCHED**. |
| DISPATCHED | Record Supplier Decision | Invented modal (spec below). **Accepted** → **ACCEPTED**. **Rejected** → **REJECTED** (terminal). Stock already gone — **do not** auto-restore. |
| ACCEPTED | Complete Return | Invented modal. No further stock move. Status **COMPLETED**. |
| REJECTED / COMPLETED | none | Read-only. Dispatch/decision disabled |

**Inventory effect panel:** PREPARED = “Not yet posted” + projected deduction. After dispatch = posted / deducted.

#### Record Supplier Decision (invent — match Dispatch modal family)

- Title: Record Supplier Decision. Subtext: Record the supplier’s decision on this prepared dispatch.
- Manifest + supplier (read-only).
- Decision * : Accepted \| Rejected.
- Credit note / reference: optional; required-looking only when Accepted (optional in API).
- Notes.
- Confirm checkbox: “I confirm this is the supplier’s decision.”
- Cancel / Confirm Decision.

#### Complete Return (invent)

- Title: Complete Return. Subtext: Close this return. Inventory was already adjusted at dispatch.
- Manifest + supplier + units + cost (read-only).
- Checkbox: “I confirm this return is complete.”
- Cancel / Complete Return.

Do **not** create separate page components per status. Same details route; fields/CTAs/progress/activity/inventory effect switch on status.

### Create Return Manifest (dedicated page)

Not the queue. Queue selection (same supplier only) → `/suppliers/returns/new`. Page reviews batches, qtys, cost, supplier policy, Confirm → create SRM → details. Mixed-supplier selection blocked. Manifest Prepared rows not selectable.

**Re-share gate:** no screenshot in chat. Agent **stops** and asks before Batch AB.

---

## Batch overview (Slice 2)

| Batch | Title | Depends on | Re-share? |
|-------|-------|------------|-----------|
| **P** | Prisma + Zod (Supplier, PO, GRN, Manifest) | Slice 1 O | No |
| **Q** | Supplier + Purchase Order APIs | P | No |
| **R** | GRN + Return APIs | Q | No |
| **S** | Enable Purchasing + Suppliers nav | Q | No |
| **T** | Purchasing list | S + Q | **Purchasing** |
| **U** | Create Purchase Order | T | **Create Purchase Order** |
| **V** | Purchase Order Details | U | **Purchase Order Details** |
| **W** | Receive Stock against PO | V + R | **Receive Stock** (PO GRN) |
| **X** | Suppliers list | S + Q | **Suppliers** |
| **Y** | Add Supplier | X | **Add Supplier** |
| **Z** | Supplier Details | Y | **Supplier Details** |
| **AA** | Expiry Returns queue + Prepare Return wire | Z + R | **Expiry Returns** |
| **AB** | Create Return Manifest page | AA | **Create Return Manifest** — ask first |
| **AC** | Manifest Details + 3 modals | AB | **Return Manifest Details** + Dispatch; invent two modals |
| **AD** | Slice 2 exit | P–AC | No |

Order: **P → Q → R → S → T → U → V → W → X → Y → Z → AA → AB → AC → AD**.

---

## Batch P — Prisma + shared-types (Slice 2)

**Goal:** Additive schema only. Existing ingest / GET sales / owner inventory **unchanged**. No web screens.

**Re-share screen:** none.

### Tasks

- [x] Models + enums per Slice 2 schema lock
- [x] Relations on Tenant/Store/User/Product/Batch; `Batch.supplierId?`
- [x] Zod DTOs in `@r2a/shared-types`
- [x] Migrate. Seed remains unchanged (optional supplier seed deferred); drug catalog not rewritten
- [x] Do **not** add routes yet (Batch Q/R)

### Exit check

- Migrate applies. `smoke:m2` + `smoke:m6s1` still PASS

### Agent prompt

```text
Implement ONLY Batch P from MILESTONE_6_EXECUTION.md
(Slice 2 Prisma + Zod: Supplier, PO, GRN, ReturnManifest).
No new HTTP routes. No Owner web screens.
When done, paste the short M6 Batch P report.
```

**YOU DO:** Confirm migrate. Optional smokes.

**Next:** `Authorize M6 Batch Q`.

---

## Batch Q — Supplier + Purchase Order APIs

**Goal:** OWNER-only supplier CRUD + PO list/create/get/update-draft. **Create Purchase Order** primary action → status **SENT**. **Save as Draft** → **DRAFT**. No inventory change.

**Re-share screen:** none.

### Tasks

- [x] `GET/POST /api/v1/owner/suppliers`, `GET/PATCH /api/v1/owner/suppliers/:id` (`restrictTo("OWNER")`). No delete. HOLD status allowed. **No separate edit UI** until a later slice — PATCH exists for Add/create
- [x] `GET/POST /api/v1/owner/purchase-orders`, `GET /:id`, `PATCH` draft lines only while **DRAFT**
- [x] List query: `q`, `status`, `supplierId`, `limit`/`offset`, `meta.total`
- [x] PO KPIs for Purchasing header if cheap; else Batch T can compose
- [x] Cashier/Manager **403**
- [x] `smoke:m6q`
- [x] Do **not** confirm GRN or manifests

### Agent prompt

```text
Implement ONLY Batch Q from MILESTONE_6_EXECUTION.md
(Supplier + PO APIs, OWNER only).
No GRN/return routes. No web screens.
When done, paste the short M6 Batch Q report.
```

**YOU DO:** none if smoke PASS.

**Next:** `Authorize M6 Batch R`.

---

## Batch R — GRN + Return APIs

**Goal:** Confirm receipt against a PO; return queue; create manifest; get manifest; dispatch (stock out); decision; complete.

**Re-share screen:** none.

### Tasks

- [x] `POST /api/v1/owner/purchase-orders/:id/receipts` — confirm GRN: create lots via existing batch create path, RECEIVE events, increment line `qtyReceived`, PO status SENT→PARTIALLY_RECEIVED→RECEIVED. Reject over-receive
- [x] `GET /api/v1/owner/returns/queue` — eligible lots (+ filters). Include `MANIFEST_PREPARED` / `NOT_ELIGIBLE` for the table; selection rules on the client
- [x] `POST /api/v1/owner/return-manifests`, `GET /:id`
- [x] `POST /:id/dispatch` — signed adjustments; status DISPATCHED
- [x] `POST /:id/decision` — ACCEPTED \| REJECTED
- [x] `POST /:id/complete` — only from ACCEPTED
- [x] Idempotent operationIds on dispatch
- [x] `smoke:m6r`: happy GRN + manifest dispatch; cashier 403
- [x] Do **not** build UI

### Agent prompt

```text
Implement ONLY Batch R from MILESTONE_6_EXECUTION.md
(GRN confirm + return manifest APIs).
Dispatch uses signed batch adjustments. No web screens.
When done, paste the short M6 Batch R report.
```

**YOU DO:** none if smoke PASS.

**Next:** `Authorize M6 Batch S`.

---

## Batch S — Enable Purchasing + Suppliers nav

**Goal:** Sidebar items **Purchasing** and **Suppliers** become real routes (placeholder shells OK). Other later nav stays disabled.

**Re-share screen:** none (chrome lock).

### Tasks

- [x] Live nav + routes `/purchasing`, `/suppliers` shells with i18n titles
- [x] Help / Owner Profile / Customers / … still disabled
- [x] `smoke:m6s`: nav clickable; no Customers route
- [x] Do **not** build tables (T+)

### Agent prompt

```text
Implement ONLY Batch S from MILESTONE_6_EXECUTION.md
(Enable Purchasing + Suppliers sidebar).
Placeholder pages OK. Do not build list tables.
When done, paste the short M6 Batch S report.
```

**YOU DO:** Owner web — Purchasing and Suppliers open. Customers stay disabled until Slice 3 Batch AG.

**Next:** `Authorize M6 Batch T`.

---

## Batch T — Purchasing list

**Goal:** Live Purchasing dashboard from APIs. **Status:** DONE (2026-08-18, `smoke:m6t` PASS).

**Re-share screen:** **Purchasing**.

### Tasks

- [x] Ask for screenshot; stop until reply / use prior
- [x] KPI cards, PO table, search/status, pagination
- [x] Recent receipts **section** on this page if API can list GRNs for the PO table’s store — if not, hide or show PO-linked receipts from PO list only. **View All Receipts** disabled
- [x] Replenishment Attention from inventory-summary / low-stock; **Review Reorder Suggestions** disabled
- [x] CTAs: Create PO → `/purchasing/new`. Receive Stock → require a PO (picker or disable until a row). Prefer: Receive on a SENT/PARTIAL row → receive route
- [x] `smoke:m6t`: no hard-coded ৳698,150
- [x] Do **not** build Create PO form (U)

### Agent prompt

```text
Implement ONLY Batch T from MILESTONE_6_EXECUTION.md
(Purchasing list).
Re-share: Purchasing — stop until shared or use prior.
View All Receipts + Review Reorder Suggestions stay disabled.
When done, paste the short M6 Batch T report.
```

**YOU DO:** Open Purchasing. Empty or seed POs OK.

**Next:** `Authorize M6 Batch U`.

---

## Batch U — Create Purchase Order

**Goal:** Live create/draft PO. Inventory unchanged. **Status:** DONE (2026-08-18, `smoke:m6u` PASS). Seed now ships 3 ACTIVE suppliers (Beximco · Square · SMC).

**Re-share screen:** **Create Purchase Order**.

### Tasks

- [x] Ask; stop until reply (resolved: use prior upload)
- [x] Supplier dropdown from GET suppliers (ACTIVE). Delivery branch locked to JWT store name
- [x] Lines: search products, qty, last cost, totals. Stock/reorder highlight when below reorder
- [x] **Add Suggested Items** inline (low stock products; if no supplier-product link yet, use all low-stock — document)
- [x] Save as Draft / Create (SENT) / Cancel
- [x] Right rail: order summary + replenishment impact
- [x] `smoke:m6u`: POST purchase-orders
- [x] Do **not** receive stock here

### Agent prompt

```text
Implement ONLY Batch U from MILESTONE_6_EXECUTION.md
(Create Purchase Order).
Re-share: Create Purchase Order — stop until shared or use prior.
Creating a PO must not change inventory.
When done, paste the short M6 Batch U report.
```

**YOU DO:** Create a draft and a sent PO.

**Next:** `Authorize M6 Batch V`.

---

## Batch V — Purchase Order Details

**Goal:** Live PO detail + receiving progress. Receive Stock → GRN page.

**Re-share screen:** **Purchase Order Details**.

### Tasks

- [x] Ask; stop until reply
- [x] Header, KPIs, line remaining/received, GRN history for **this** PO
- [x] Export / Print / More Actions **disabled**
- [x] Receive Stock enabled when remaining qty > 0
- [x] `smoke:m6v`
- [x] Do **not** build GRN form (W)

### Agent prompt

```text
Implement ONLY Batch V from MILESTONE_6_EXECUTION.md
(Purchase Order Details).
Re-share: Purchase Order Details — stop until shared or use prior.
Export/Print/More Actions disabled.
When done, paste the short M6 Batch V report.
```

**YOU DO:** Open the sent PO.

**Next:** `Authorize M6 Batch W`.

---

## Batch W — Receive Stock against PO

**Goal:** Confirm GRN. Creates lots (shared with Inventory Receive). Distinct route from `/inventory/:productId/receive`.

**Re-share screen:** **Receive Stock** (Purchasing / PO breadcrumb).

### Tasks

- [x] Ask; stop until reply. Do **not** restyle Inventory Add Lot
- [x] Lines from remaining PO qty; Recv now, batch, expiry, cost, sell; + Add Batch
- [x] Invoice / received date. Save as Draft: **disable** unless same page can resume (park extra draft screen)
- [x] Confirm → Batch R receipts API → PO details. Inventory + POS catalog after pull
- [x] `smoke:m6w`
- [x] Do **not** remove Inventory Receive

### Agent prompt

```text
Implement ONLY Batch W from MILESTONE_6_EXECUTION.md
(Receive Stock against PO).
Re-share: Receive Stock (PO GRN) — stop until shared or use prior.
Keep Inventory ad-hoc receive. Confirm creates batches + GRN.
When done, paste the short M6 Batch W report.
```

**YOU DO:** Receive a partial line. Confirm PO status Partial and a new lot on Product Details.

**Next:** `Authorize M6 Batch Y`.

---

## Batch X — Suppliers list

**Goal:** Live supplier directory + attention panel (disable Review All Issues if no page).

**Re-share screen:** **Suppliers**.

### Tasks

- [x] Ask; stop until reply
- [x] KPI cards, table, search, pagination
- [x] Expiry Returns CTA → `/suppliers/returns`. Add Supplier → `/suppliers/new`
- [x] Attention: overdue PO / open PO / expiry return / on hold — links to existing pages only
- [x] `smoke:m6x`
- [x] Do **not** build Add form (Y)

### Agent prompt

```text
Implement ONLY Batch X from MILESTONE_6_EXECUTION.md
(Suppliers list).
Re-share: Suppliers — stop until shared or use prior.
When done, paste the short M6 Batch X report.
```

**YOU DO:** Open Suppliers. Seed rows OK.

**Next:** `Authorize M6 Batch Y`.

---

## Batch Y — Add Supplier

**Goal:** Create ACTIVE supplier. No Edit Supplier page. **DONE 2026-08-19** — live form at `/suppliers/new` (see log).

**Re-share screen:** **Add Supplier**.

### Tasks

- [x] Ask; stop until reply
- [x] All shared fields + setup summary. Save as Draft: status DRAFT **or** disable
- [x] Create → Supplier Details
- [x] `smoke:m6y`
- [x] Do **not** add Edit route

### Agent prompt

```text
Implement ONLY Batch Y from MILESTONE_6_EXECUTION.md
(Add Supplier).
Re-share: Add Supplier — stop until shared or use prior.
No Edit Supplier page.
When done, paste the short M6 Batch Y report.
```

**YOU DO:** Create a throwaway supplier.

**Next:** `Authorize M6 Batch Z`.

---

## Batch Z — Supplier Details

**Goal:** Live supplier page. Create PO + Expiry Returns. No Edit. **DONE 2026-08-19** — live page at `/suppliers/:supplierId` (see log).

**Re-share screen:** **Supplier Details** (including the table bottoms).

### Tasks

- [x] Ask; stop until reply
- [x] KPIs, info, performance (compute what exists; honest zeros otherwise — do not fake 94%)
- [x] PO table (this supplier) → PO details. Products supplied from batches/PO lines
- [x] View All POs → Purchasing filtered if cheap; else disable. View All Products → Inventory search disable if no filter
- [x] `smoke:m6z`

### Agent prompt

```text
Implement ONLY Batch Z from MILESTONE_6_EXECUTION.md
(Supplier Details).
Re-share: Supplier Details — stop until shared or use prior.
No Edit Supplier.
When done, paste the short M6 Batch Z report.
```

**YOU DO:** Open Square (or seed) supplier.

**Next:** `Authorize M6 Batch AA`.

---

## Batch AA — Expiry Returns queue

**Goal:** Live queue. Inventory Expiry **Prepare Supplier Return** enabled → this page. Selection → Create Manifest page (not inline create). **Status:** DONE (2026-08-19, `smoke:m6aa` PASS).

**Re-share screen:** **Expiry Returns** (and scroll bottom).

### Tasks

- [x] Ask; stop until reply
- [x] Cards, filters, table, selection bar. Mixed supplier → cannot proceed
- [x] Top Create Return Manifest: enabled when valid selection, else disabled (as mock)
- [x] Enable Inventory expiry Prepare Return → `/suppliers/returns`
- [x] `smoke:m6aa`
- [x] Do **not** build Create Manifest layout (AB)

### Agent prompt

```text
Implement ONLY Batch AA from MILESTONE_6_EXECUTION.md
(Expiry Returns queue).
Re-share: Expiry Returns — stop until shared or use prior.
Wire Inventory Prepare Supplier Return here.
Do not collapse Create Manifest into the queue.
When done, paste the short M6 Batch AA report.
```

**YOU DO:** Open queue from Suppliers and from Inventory Expiry CTA.

**Next:** `Authorize M6 Batch AB`.

---

## Batch AB — Create Return Manifest page

**Goal:** Dedicated create page. **Not** the queue. **Status:** DONE (2026-08-19, `smoke:m6ab` PASS).

**Re-share screen:** **Create Return Manifest**.

### Tasks

- [x] **Stop first:**

```text
⏸ Batch AB needs the visual for: "Create Return Manifest".
Please re-share that screenshot (or say "use prior upload" / "invent to match theme").
Stopping until you reply.
```

- [x] After share/invent: review selected lots, supplier policy, confirm create → Manifest Details
- [x] `smoke:m6ab`
- [x] Do **not** build details lifecycle (AC)

### Agent prompt

```text
Implement ONLY Batch AB from MILESTONE_6_EXECUTION.md
(Create Return Manifest page).
STOP and ask for the Create Return Manifest screenshot first.
Do not collapse this into the queue.
When done, paste the short M6 Batch AB report.
```

**YOU DO:** Create a manifest from two Eligible lots of one supplier.

**Next:** Slice 2 AC–AD are **deferred**. Slice 3 **AE DONE**. `Authorize M6 Batch AF`. `/suppliers/returns/:manifestId` stays a parked placeholder.

---

## Batch AC — Manifest Details + lifecycle modals

**Status: DEFERRED** (2026-08-19). Do **not** implement until the user re-authorizes. `/suppliers/returns/:manifestId` stays the parked placeholder. Dispatch / decision / complete **APIs remain live** (Batch R). Continue at **Batch AE**.

**Goal:** One details page for all statuses. Dispatch modal from shared screen. Decision + Complete from spec above.

**Re-share screen:** **Return Manifest Details** (and scroll). Dispatch modal: use prior / re-share **Record Supplier Return Dispatch**.

### Tasks

- [ ] Ask for Manifest Details; stop until reply
- [ ] One component/route; UI switches on status
- [ ] Dispatch / Decision / Complete modals per spec. Dispatch posts stock
- [ ] Export/Print/More Actions disabled. Supplier Return Policy = data from Supplier record
- [ ] `smoke:m6ac`: PREPARED→DISPATCHED reduces qty; decision/complete transitions
- [ ] Do **not** add extra status pages

### Agent prompt

```text
Implement ONLY Batch AC from MILESTONE_6_EXECUTION.md
(Manifest Details + Dispatch / Decision / Complete modals).
One page for Prepared/Dispatched/Accepted/Completed.
Use the lifecycle spec in this file. Re-share Manifest Details (+ Dispatch if needed).
When done, paste the short M6 Batch AC report.
```

**YOU DO:** Dispatch (stock drops). Accept. Complete. Optional: second manifest → Reject (no restore).

**Next:** Deferred. Do not authorize AD until AC is done. Slice 3 **AE DONE**; next = `Authorize M6 Batch AF`.

---

## Batch AD — Slice 2 exit

**Status: DEFERRED** (2026-08-19). Do **not** implement until Batch AC is done. Slice 2 stays paused at P–AB. Catalog §22 remains in-progress notes until a later exit.

**Goal:** Catalog §22, `smoke:m6s2`, status/docs. M6 stays **IN PROGRESS**.

**Re-share screen:** none.

### Tasks

- [ ] [`Completed_API_lists.md`](Completed_API_lists.md) **§22**: suppliers, POs, GRNs, return manifests + dual-receive note
- [ ] `npm run smoke:m6s2` composing m6q–m6ac + `smoke:m6s1`
- [ ] Status + master plan + RBAC: Slice 2 live; Manager web still later
- [ ] This file P–AD checkboxes
- [ ] Do **not** start n8n / RLS

### Agent prompt

```text
Implement ONLY Batch AD from MILESTONE_6_EXECUTION.md
(Slice 2 exit). Catalog §22, smoke:m6s2, status docs.
No new screens. Skip unless Batch AC is no longer deferred.
When done, paste the short M6 Batch AD report.
```

**YOU DO:** Owner: create supplier → PO → partial GRN → expiry return → dispatch. POS still sells. Cashier still cannot use web.

**Next after PASS (when AC/AD are later authorized):** continue remaining M6. **Now:** `Authorize M6 Batch AF`.

---

## Slice 3 — Customers + POS registration approval

User shared Owner web Customers screens 2026-08-19 and locked: **skip remaining Slice 2 (AC–AD deferred)**; start Slice 3; cashier POS create is allowed but **Owner must approve** before the profile is Active. Owner-created customers skip approval. Email optional. `apps/web` stays OWNER-only.

Edit Customer, Reject screenshot, and POS Create screenshot were **not** shared. Locked invent/park:

| Missing control | Slice 3 |
|-----------------|---------|
| Edit Customer / More Actions | **Park / disable** |
| Reject Registration modal | **Invent** (match Approve modal family; spec below) |
| POS Create Customer | **Invent** (name + phone; Select Customer family; spec below) |

Staff / Reports / Audit & FEFO / Settings / Help / Owner Profile were **not** shared — stay disabled until Slice 4+.

### Slice 3 IA

```text
Customers
  → Add Customer
       → Create confirm modal → Customer Details (Active, Owner Created)
  → Customer Details            (Active / Inactive)
  → Pending row → Registration Review
       → Approve Customer modal → Customer Details (Active)
       → Reject Registration modal (invented) → directory (hidden)

POS Select Customer (F8)
  → Create Customer (invented; name + phone)
       Cashier / Manager → PENDING_APPROVAL (do not attach to sale)
       Owner             → ACTIVE immediately (may attach)
```

**4 unique pages + 3 modals** (Approve shared, Create confirm shared, Reject invented) **+ 1 POS modal**.

### Dual create (locked)

| Path | Who | Result |
|------|-----|--------|
| Owner web Add Customer | OWNER | `ACTIVE` + `OWNER_CREATED`. Optional email / DOB / gender / address. No approval. |
| POS Create | CASHIER or MANAGER | `PENDING_APPROVAL` + `POS_REGISTRATION`. Name + phone only. Not selectable until approved. |
| POS Create | OWNER | `ACTIVE` + `POS_REGISTRATION` (created at the counter). May attach to the current sale. |

Phone is **required**. POS `GET /customers` and sale ingest attach **Active** only. Pending / rejected never appear at F8.

### Parked on Slice 3 mocks

| Control | Slice 3 |
|---------|---------|
| Edit Customer | **Disabled** |
| More Actions | **Disabled** |
| Inactive mutation | **No UI.** Tab filters existing `INACTIVE` rows only |
| Header search / bell / branch switch | Unchanged chrome lock |
| Loyalty point adjust | **None.** Activity = sale snapshots only |
| `creditBalance` / Baki | **Forbidden** |

### Customer status / source

| Enum | Values |
|------|--------|
| `CustomerStatus` | `ACTIVE` \| `PENDING_APPROVAL` \| `INACTIVE` \| `REJECTED` |
| `CustomerSource` | `OWNER_CREATED` \| `POS_REGISTRATION` |
| `CustomerGender` | `MALE` \| `FEMALE` \| `OTHER` (optional) |

Rejected rows stay in the DB for audit, are **hidden** from the directory, and **release** the phone unique so the same number can register again (partial unique index `WHERE status <> REJECTED`).

### Schema (Batch AE — additive)

Extend `Customer` (all `tenantId`-scoped): required `phone`; `status` default `ACTIVE`; `source`; optional `storeId`, `createdByUserId`, `dateOfBirth`, `gender`, `address`; approval/reject audit fields (`approvedAt`, `approvedByUserId`, `rejectedAt`, `rejectedByUserId`, `rejectionNote`).

Keep `loyaltyPoints` and unused `creditBalance`. Do **not** drop `@@unique([tenantId, phone])` without replacing it with the partial unique for non-rejected rows.

**Seed:** Karim + Nusrat → `ACTIVE` + `OWNER_CREATED`. Add one **pending POS** demo (name + phone, cashier `createdByUserId`) so Review is walkthrough-ready.

### Return lifecycle analog — approval spec

| Current | Primary CTA | Effect |
|---------|-------------|--------|
| PENDING_APPROVAL | Approve Customer | Shared modal. Optional profile patch (name/phone/email/DOB/gender/address). Status **ACTIVE**. Then available at POS. |
| PENDING_APPROVAL | Reject Registration | Invented modal. Status **REJECTED**. Hidden from directory. **No** POS attach. Phone reusable. |
| ACTIVE / INACTIVE | none (this slice) | Details read-only. Edit parked. |
| REJECTED | none | Not listed |

### Reject Registration (invent — match Approve modal family)

- Title: Reject Registration. Subtext: This POS registration will not become an active customer.
- Manifest analog: customer name + phone + source + branch (read-only).
- Optional note.
- Confirm checkbox: “I confirm that I have reviewed this registration and want to reject it.”
- Cancel / Reject Registration (destructive). Checkbox gates the primary.

### POS Create Customer (invent — match Select Customer family)

- Open from Select Customer (F8). Fields: name *, phone * only.
- Online only. Offline → i18n toast; Walk-in still available.
- Live phone-check; 409 duplicate.
- Keyboard: arrows / Enter / Esc. **No Tab.**
- Cashier/Manager success: **do not attach**; toast that Owner must approve; stay on Select Customer.
- Owner success: Active; **may attach** to the current sale.
- No offline customer queue (M4 stays sales-only).

---

## Batch overview (Slice 3)

| Batch | Title | Depends on | Re-share? |
|-------|-------|------------|-----------|
| **AE** | Prisma + Zod (Customer status/source/profile) | Slice 2 AB | No |
| **AF** | Customer APIs + ingest Active guard | AE | No |
| **AG** | Enable Customers nav | AF | No |
| **AH** | Customers list | AG + AF | **Customers** |
| **AI** | Add Customer + create confirm | AH | **Add Customer** |
| **AJ** | Customer Details | AI | **Customer Details** |
| **AK** | Registration Review + Approve/Reject modals | AJ + AF | **Customer Registration Review** + Approve |
| **AL** | POS Create Customer | AF | Invent — no POS screenshot |
| **AM** | Slice 3 exit | AE–AL | No |

Order: **AE → AF → AG → AH → AI → AJ → AK → AL → AM**.

---

## Batch AE — Prisma + shared-types (Slice 3)

**Goal:** Additive Customer schema + Zod. Migrate. Seed Karim/Nusrat + one pending POS demo. **No** routes/UI. Existing `POST /customers` OWNER-only behavior **unchanged** until AF.

**Re-share screen:** none.

### Tasks

- [x] Enums + Customer fields per Slice 3 schema lock
- [x] Partial unique on `(tenantId, phone)` where status is not `REJECTED` (or equivalent that allows reuse after reject)
- [x] Zod DTOs in `@r2a/shared-types` (`customer.ts` + `saleListQuerySchema.customerId` stub OK if unused until AF)
- [x] Seed: existing customers `ACTIVE` + `OWNER_CREATED`; one `PENDING_APPROVAL` + `POS_REGISTRATION` (cashier actor)
- [x] Do **not** change `restrictTo("OWNER")` on create yet (Batch AF)
- [x] Do **not** add Owner web Customers routes

### Exit check

- Migrate applies. `smoke:m2` + `smoke:m6s1` still PASS

### Agent prompt

```text
Implement ONLY Batch AE from MILESTONE_6_EXECUTION.md
(Slice 3 Prisma + Zod: Customer status, source, profile extras, pending seed).
No new HTTP behavior. No Owner web Customers screens.
When done, paste the short M6 Batch AE report.
```

**YOU DO:** Confirm migrate. Optional smokes.

**Next:** `Authorize M6 Batch AF`.

---

## Batch AF — Customer APIs + ingest Active guard

**Goal:** Role-aware create; POS search Active-only; Owner list/detail/approve/reject; phone-check; `GET /sales?customerId=`. No web screens.

**Re-share screen:** none.

### Tasks

- [ ] `POST /api/v1/customers` — `OWNER` \| `MANAGER` \| `CASHIER`. Owner → Active (`OWNER_CREATED` from web body, or `POS_REGISTRATION` if POS). Cashier/Manager → Pending + `POS_REGISTRATION`; strip extras (name + phone only)
- [ ] `GET /api/v1/customers` — Active only (POS F8). Envelope unchanged
- [ ] `GET /api/v1/customers/phone-check?phone=` — any authenticated
- [ ] `GET /api/v1/owner/customers` — OWNER; tabs/filters/sort/pagination; KPIs (registered, pending, active-90d, loyalty points issued = sum of current `loyaltyPoints` on accepted profiles). Honest zeros
- [ ] `GET /api/v1/owner/customers/:id` — profile, creation/approval audit, purchase history, loyalty activity from sale snapshots
- [ ] `POST /api/v1/owner/customers/:id/approve` — pending only; optional profile patch → Active
- [ ] `POST /api/v1/owner/customers/:id/reject` — pending only; optional note → Rejected (hidden)
- [ ] `GET /api/v1/sales?customerId=` additive
- [ ] Ingest: `customerId` must be **ACTIVE** (else 400/404)
- [ ] Cashier/Manager **403** on `/owner/customers*`
- [ ] `PATCH /customers/:id` unchanged (Edit parked; no Inactive mutation)
- [ ] `smoke:m6af`
- [ ] Do **not** build UI

### Agent prompt

```text
Implement ONLY Batch AF from MILESTONE_6_EXECUTION.md
(Customer APIs + ingest Active guard).
Owner create is Active; cashier/manager POS create is Pending.
No Owner web screens. No POS Create modal.
When done, paste the short M6 Batch AF report.
```

**YOU DO:** none if smoke PASS.

**Next:** `Authorize M6 Batch AG`.

---

## Batch AG — Enable Customers nav

**Goal:** Sidebar **Customers** becomes a real route (placeholder shell OK). Staff / Reports / … stay disabled.

**Re-share screen:** none (chrome lock).

### Tasks

- [ ] Live nav + routes `/customers`, `/customers/new`, `/customers/:id`, `/customers/:id/review` shells with i18n titles
- [ ] Register `/customers/new` before `/:id`
- [ ] Help / Owner Profile / Staff / … still disabled
- [ ] `smoke:m6ag`: Customers clickable; no Staff route
- [ ] Do **not** build the directory table (AH)

### Agent prompt

```text
Implement ONLY Batch AG from MILESTONE_6_EXECUTION.md
(Enable Customers sidebar).
Placeholder pages OK. Do not build list tables.
When done, paste the short M6 Batch AG report.
```

**YOU DO:** Owner web — Customers opens. Staff still dead.

**Next:** `Authorize M6 Batch AH`.

---

## Batch AH — Customers list

**Goal:** Live Customers directory from `GET /owner/customers`.

**Re-share screen:** **Customers**.

### Tasks

- [ ] Ask for screenshot; stop until reply / use prior
- [ ] KPI cards, tabs (All / Pending / Active / Inactive), search name or phone, Status / Source / Sort, pagination
- [ ] Pending name → `/customers/:id/review`. Active/Inactive name → `/customers/:id`. Add Customer → `/customers/new`
- [ ] No hard-coded 2,417 / mock ৳ totals
- [ ] `smoke:m6ah`
- [ ] Do **not** build Add form (AI)

### Agent prompt

```text
Implement ONLY Batch AH from MILESTONE_6_EXECUTION.md
(Customers list).
Re-share: Customers — stop until shared or use prior.
Live GET /owner/customers. No invented KPIs.
When done, paste the short M6 Batch AH report.
```

**YOU DO:** Open Customers. Confirm seed Karim (Active) and the pending POS demo.

**Next:** `Authorize M6 Batch AI`.

---

## Batch AI — Add Customer + create confirm

**Goal:** Owner creates an Active profile immediately. Confirm modal as shared.

**Re-share screen:** **Add Customer**.

### Tasks

- [ ] Ask; stop until reply / use prior
- [ ] Form: name *, phone *, email optional, DOB, gender, address. Live phone-check
- [ ] Right rail: Direct Customer Creation copy + System Information (source Owner Created, branch, created by)
- [ ] Confirm modal: checkbox required; then `POST /customers` with `OWNER_CREATED`
- [ ] Success → Customer Details. Cancel → list
- [ ] `smoke:m6ai`
- [ ] Do **not** build Details layout (AJ)

### Agent prompt

```text
Implement ONLY Batch AI from MILESTONE_6_EXECUTION.md
(Add Customer + create confirm modal).
Re-share: Add Customer — stop until shared or use prior.
Owner create must be Active immediately. No approval.
When done, paste the short M6 Batch AI report.
```

**YOU DO:** Create a throwaway customer. Confirm it is Active and appears in the directory.

**Next:** `Authorize M6 Batch AJ`.

---

## Batch AJ — Customer Details

**Goal:** Live Active/Inactive detail. Edit + More Actions disabled.

**Re-share screen:** **Customer Details**.

### Tasks

- [ ] Ask; stop until reply / use prior
- [ ] Header, KPIs (loyalty / total purchases / visits / last purchase), profile grid, purchase history, loyalty activity from snapshots
- [ ] Creation Information rail from `source` / actor / dates. Activity timeline from known facts only
- [ ] Purchase row → `/sales/:id`. Empty states honest
- [ ] Edit Customer + More Actions **disabled**
- [ ] Pending id → redirect to Review
- [ ] `smoke:m6aj`
- [ ] Do **not** build Review (AK)

### Agent prompt

```text
Implement ONLY Batch AJ from MILESTONE_6_EXECUTION.md
(Customer Details).
Re-share: Customer Details — stop until shared or use prior.
Edit Customer and More Actions stay disabled.
When done, paste the short M6 Batch AJ report.
```

**YOU DO:** Open Karim and the Owner-created throwaway. Confirm loyalty/purchases are live or honest zeros.

**Next:** `Authorize M6 Batch AK`.

---

## Batch AK — Registration Review + Approve / Reject modals

**Goal:** One Review page for pending POS registrations. Approve as shared. Reject invented.

**Re-share screen:** **Customer Registration Review** (+ Approve modal).

### Tasks

- [ ] Ask; stop until reply / use prior
- [ ] Registration request (read-only POS name/phone/source/submitted/branch/by), duplicate check, editable profile (Owner may correct before approve)
- [ ] Right rail: Registration Info + Approval Action copy
- [ ] Approve modal as shared (checkbox gates primary) → `POST .../approve` → Details
- [ ] Reject modal invented per spec → `POST .../reject` → list (row gone)
- [ ] Cancel → list. Active id on Review → Details
- [ ] `smoke:m6ak`: pending → approve becomes Active and appears in POS Active search
- [ ] Do **not** build POS Create (AL)

### Agent prompt

```text
Implement ONLY Batch AK from MILESTONE_6_EXECUTION.md
(Registration Review + Approve / Reject modals).
Re-share: Customer Registration Review (+ Approve if needed).
Invent Reject to match the Approve modal family.
When done, paste the short M6 Batch AK report.
```

**YOU DO:** Approve the seed pending customer. Confirm it is Active. Optional: reject a second pending (phone reusable).

**Next:** `Authorize M6 Batch AL`.

---

## Batch AL — POS Create Customer

**Goal:** Re-open Create on Select Customer (F8). Invented modal. Update historical “no Create on POS” smokes.

**Re-share screen:** none (invent).

### Tasks

- [ ] Invent modal on `SelectCustomerModal` per spec (name + phone; online only; phone-check)
- [ ] `POST /customers`. Cashier/Manager: pending, do not attach, toast. Owner: Active, may attach
- [ ] Walk-in unchanged. No Tab. i18n `apps/desktop` en + bn-BD
- [ ] POS search remains Active-only
- [ ] Update `smoke-m5b` / `smoke-m3al` / `smoke-m3u` (and any catalog lines that still say Create is removed)
- [ ] `smoke:m6al`
- [ ] Do **not** queue customer create offline

### Agent prompt

```text
Implement ONLY Batch AL from MILESTONE_6_EXECUTION.md
(POS Create Customer — invent).
Name + phone. Cashier/Manager pending (do not attach). Owner Active.
Update old no-create smokes. No Tab. No offline customer queue.
When done, paste the short M6 Batch AL report.
```

**YOU DO:** Cashier F8 → Create → confirm pending does not appear in search. Owner web Review still works. Owner POS Create may attach immediately.

**Next:** `Authorize M6 Batch AM`.

---

## Batch AM — Slice 3 exit

**Goal:** Catalog §23, `smoke:m6s3`, status/docs. M6 stays **IN PROGRESS**. AC–AD remain deferred.

**Re-share screen:** none.

### Tasks

- [ ] [`Completed_API_lists.md`](Completed_API_lists.md) **§23**: customer status/source, role-aware POST, Owner approve/reject, POS Active-only search, ingest Active guard
- [ ] `npm run smoke:m6s3` composing m6af–m6al + `smoke:m6s1`
- [ ] Status + master plan + RBAC: Slice 3 live; Staff still later; AC–AD still deferred
- [ ] This file AE–AM checkboxes
- [ ] Do **not** start Staff / n8n / RLS / Batch AC

### Agent prompt

```text
Implement ONLY Batch AM from MILESTONE_6_EXECUTION.md
(Slice 3 exit). Catalog §23, smoke:m6s3, status docs.
No new screens. AC–AD stay deferred.
When done, paste the short M6 Batch AM report.
```

**YOU DO:** Owner web: list → add → details. POS cashier create → Owner approve → F8 can select. Cashier still cannot use web.

**Next after PASS:** Slice 4 when you share Staff/Reports/… screens.

---

## Later backlog (do not build in Slice 3)

| Track | Item |
|-------|------|
| Deferred Slice 2 | Batch AC Manifest Details + 3 modals; Batch AD Slice 2 exit |
| Manager | Manager web screens + Manager authorization matrix |
| Nav | Staff, Reports, Audit & FEFO, Settings, Help, Owner Profile |
| Owner | Edit Customer, Edit Supplier, View All Receipts, Review Reorder Suggestions page, notifications, branch switch, Inactive mutation, loyalty adjust |
| Slice 2 parked | Extra draft-resume pages; Export/Print/More Actions; auto-restore stock on rejected return |
| M6 rest | Bi-di sync, n8n, Postgres RLS, full loyalty/refill beyond ingest snapshots |
| POS / hardware | Printer IPC, card SDK, MFS APIs, FEFO `pinHash`, cloud shift, Slice 7+ |
| M7 | Multi-branch, transfers, Super Admin console |

---

## Change log

| Date | Change |
|------|--------|
| 2026-08-15 | Slice 1 execution created (A–O not started). Owner web screens 1–8 + shared live APIs. Re-share gate on UI batches. Short report after each batch. |
| 2026-08-15 | Mock inconsistency + missing-flow protocol (M3 chrome lock + ask/guide when the next screen is missing). |
| 2026-08-15 | **Batch A DONE** — `@r2a/web` Vite + React + Tailwind; invented Owner Login (teal / Admin Portal); OWNER session; Manager/Cashier rejected. |
| 2026-08-15 | **Batch B DONE** — Owner chrome lock (light sidebar + header); live Dashboard/Sales/Inventory shells; later nav disabled; store name display-only. |
| 2026-08-15 | **Batch C DONE** — Additive Prisma (`Sale`/`SaleItem`/`Product` extras + `InventoryEvent`); Zod ingest/product/owner query stubs; Napa `reorderLevel=50`; ingest unchanged. |
| 2026-08-15 | **Batch D DONE** — ingest `receiptNo` + cost snapshot + loyalty/FEFO + `InventoryEvent` SALE/RECEIVE/ADJUST; desktop `saleIngest` wired; Cashier UX unchanged. |
| 2026-08-15 | **Batch E DONE** — `GET /sales` + `GET /sales/:id`; Owner cost/COGS/netProfit; Manager/Cashier redacted; `smoke:m6e`. |
| 2026-08-16 | **Batch F DONE** — `GET /owner/dashboard` + inventory-summary + expiry; OWNER-only (Manager/Cashier 403); `smoke:m6f`. No Dashboard UI. |
| 2026-08-16 | **Batch G DONE** — live Owner Dashboard (KPIs, 7-day bars, inventory health, FEFO, recent sales); `smoke:m6g`. Sales table = Batch H. |
| 2026-08-16 | **Batch H DONE** — live Sales Overview & Transactions (`GET /sales` + dashboard salesKpis / paymentMix / topCashier); Date filter (Today / Yesterday / Last 7 days / This month / Custom); `smoke:m6h`. Detail = Batch I. |
| 2026-08-16 | **Batch I DONE** — live Transaction Details (`GET /sales/:id`); FEFO OVERRIDE badge; loyalty grid from snapshots (hidden for walk-in); Reprint = on-screen preview (no Tauri); `smoke:m6i`. Inventory = Batch J. |
| 2026-08-16 | **Batch J DONE** — live Inventory list (`GET /owner/inventory`); summary cards + tabs + attention; Owner cost/sell/margin; Receive picker; `smoke:m6j`. Product Details = Batch K. |
| 2026-08-16 | **Batch K DONE** — live Product Details (`GET /owner/products/:id`); FEFO rank (sellable lots); InventoryEvent activity; Edit Product / history disabled; `smoke:m6k`. Add Product = Batch L. |
| 2026-08-16 | **Batch L DONE** — live Add Product (`POST /api/v1/products`); name, generic, manufacturer, strength, form, SKU, barcode, category, unit hierarchy Piece→Strip→Box, Rx toggle, cold chain, reorder level, storage notes; 0 initial stock notice; navigate to Product Details; `smoke:m6l`. Receive Stock = Batch M. |
| 2026-08-16 | **Batch M DONE** — live Owner web Receive Stock (`GET /owner/products/:id` context + `POST /batches`); PIECE quantity and per-base prices; packaging, cost/retail/margin, and stock-impact calculations; PO/invoice omitted; online-only; `smoke:m6m`. Batch N repair later added optional batch supplier/return metadata. |
| 2026-08-18 | **Owner Web Missing Features W1–W6 DONE** — Edit Product + Batch Management; lifecycle/version/audit integrity; correction/signed-adjustment/void/retire APIs; desktop signed/versioned/reasoned adjustment migration; absolute quantity PATCH removed; Batch N gate met but still requires authorization. |
| 2026-08-18 | **Batch N DONE + repair** — live Expiry Management (`GET /owner/expiry`); Inventory CTA; risk cards/tabs; medicine/batch/supplier search; Medicine/FEFO/Supplier/Return filters; selection; CSV Export; persisted Batch `supplierName`/`returnStatus`; Product Details row navigation. Prepare Supplier Return remains disabled; no manifest model/workflow. `smoke:m6n`. Slice 1 exit = Batch O. |
| 2026-08-18 | **Batch O DONE / Owner Web Slice 1 DONE** — `Completed_API_lists.md` §21; composed `smoke:m6s1` PASS; status/master plan/RBAC synchronized. Overall M6 remains IN PROGRESS; next = separately authorized Slice 2. |
| 2026-08-18 | **Slice 2 planned (P–AD not started).** Purchasing + Suppliers + Expiry Returns. Dual receive. Dedicated Create Return Manifest page. One Manifest Details page + 3 modals. |
| 2026-08-18 | **Batch P DONE** — additive Supplier/PO/GRN/ReturnManifest Prisma models, tenant/store/actor/catalog relations, optional `Batch.supplierId`, shared Zod DTOs, and deployed migration; `smoke:m2` + `smoke:m6s1` PASS. No routes or UI; next = Batch Q. |
| 2026-08-18 | **Batch Q DONE** — OWNER-only Supplier CRUD (no delete) and PO list/create/get/draft-update; `PO-YYMMDD-####`, server totals, list KPIs, draft lock, no inventory effect; `smoke:m6q` 18/18 PASS. No GRN/return routes or UI; next = Batch R. |
| 2026-08-18 | **Batch R DONE** — OWNER-only confirmed GRN + return queue/manifest lifecycle APIs; partial/final PO receiving, over-receive protection, RECEIVE events, idempotent dispatch stock deltas, decision/complete transitions; `smoke:m6r` 17/17 PASS. No UI; next = Batch S. |
| 2026-08-18 | **Batch S DONE** — Purchasing and Suppliers sidebar items now open localized placeholder shells at `/purchasing` and `/suppliers`; all other later nav remains disabled; no list tables; `smoke:m6s` PASS; next = Batch T. |
| 2026-08-19 | **Batch V DONE** — live Purchase Order Details at `/purchasing/:poId` (GET `/api/v1/owner/purchase-orders/:poId`): header + status badge, KPI cards (order / received / remaining value, receipts, progress), receiving progress bar, order-lines table with received/remaining per line, Goods Receipt history for this PO, Order Information rail; Export / Print / More Actions disabled; Receive Stock enabled only while remaining qty > 0 on a SENT / PARTIALLY_RECEIVED order and navigates to `/purchasing/:poId/receive`; no GRN form (Batch W); full `purchasing.detail.*` i18n in en + bn-BD; `smoke:m6v` PASS; next = Batch W. |
| 2026-08-19 | **Batch W DONE** — live Receive Stock against PO at `/purchasing/:poId/receive` matching the shared Receive Stock (PO) screen: header actions (Save as Draft **disabled** + Confirm Receipt primary), Receipt Details (SUPPLIER, PO STATUS, PURCHASE ORDER, RECEIVING BRANCH, SUPPLIER INVOICE/REFERENCE, RECEIVED DATE, DELIVERY NOTE/REFERENCE, RECEIVED BY), Received Items table (MEDICINE, ORDERED, PREV. RECV., RECV. NOW, REM. AFTER, BATCH NUMBER, EXPIRY, UNIT COST, SELL PRICE, STATUS; `+ Add Batch` / `Lot #N` rows with Valid / Incomplete / Exceeds badges), Receipt Summary (line items, batches created, units receiving, actual stock cost, PO units remaining before/after, PO after-confirmation status), Inventory Impact (live on-hand → projected via `GET /owner/inventory`); Confirm posts to the Batch R `POST /owner/purchase-orders/:poId/receipts` then returns to PO Details; Inventory ad-hoc Receive untouched; full `purchasing.receive.*` i18n en + bn-BD; `smoke:m6w` PASS; next = Batch X. |
| 2026-08-19 | **Batch X DONE** — live Suppliers directory at `/suppliers` matching the shared Suppliers screen (UI_SPEC.md; attached screenshot unreadable, spec used): 4 KPI cards (Active Suppliers, Open Purchase Orders, Purchases MTD with `% vs last month` trend, Avg. Delivery Time), Supplier Directory card with search + Status filter + table (SUPPLIER teal links, CONTACT, ACTIVE PRODUCTS, LAST PURCHASE, OPEN POs, PURCHASES MTD) + pagination, 194px Supplier Attention rail (Overdue Delivery red / Open PO teal / Expiry Return orange / On Hold slate; per-issue Review links to existing pages only; Review All Issues disabled — Batch AA), Expiry Returns CTA → `/suppliers/returns`, Add Supplier → `/suppliers/new` (form NOT built, Batch Y); `GET /owner/suppliers` extended server-side with per-item `stats` + `kpis` + `attention` (additive; `smoke:m6q` shape preserved); `suppliers.*` i18n en + bn-BD; `smoke:m6x` PASS; smoke:m6s updated (Suppliers placeholder superseded); next = Batch Y. |
| 2026-08-19 | **Batch Y DONE** — live Add Supplier form at `/suppliers/new` (Add Supplier was not re-shared; the shared Supplier Details screen is Batch Z, so the form is invented to match the Admin Portal family / Create PO pattern): all `supplierCreateSchema` fields (name, contact person, primary/secondary phone, email w/ client validation, address, city, registration number, payment terms, lead time days, ৳ min order value, preferred contact PHONE/EMAIL/WHATSAPP, expiry-returns accepted + min-days window + return instructions, internal notes) + live Setup Summary rail; suppliers always created **ACTIVE** (Save as Draft disabled — no Edit Supplier page; no Edit route added); unsaved-changes guard; create → `POST /api/v1/owner/suppliers` → navigate to `/suppliers/:supplierId` (Supplier Details placeholder until Batch Z); new `createOwnerSupplier` in `lib/suppliers.ts`; full `suppliers.add.*` i18n en + bn-BD (default bn-BD; superseded `suppliers.placeholder.new*` keys removed); `smoke:m6y` PASS; smoke:m6x updated (`/suppliers/new` now AddSupplierPage); lint + build clean; next = Batch Z. |
| 2026-08-19 | **Batch Z DONE** — live Supplier Details at `/suppliers/:supplierId` (shared Supplier Details screen; UI_SPEC.md used): header (name + status badge + contact line; Expiry Returns → `/suppliers/returns`, Create Purchase Order → `/purchasing/new`); honest KPI row — Purchases 12 Months (৳), Avg. Delivery Time, Expiry Return Rate, Active Products — **computed from live data**; zeros / em dash when no data; the decorative sample values (৳2,480,000 / 2.4 days / 1.8% / 148 / 94% / 3.2% / 86% / 9 days) are NOT invented; Supplier Information 2-col grid (supplier / contact person / phone / email | last purchase / open POs / payment terms / status; `tel:` + `mailto:` links) + Performance card (On-time Delivery, Short Supply Rate, Expiry Returns Accepted progress bars + divider + Avg. Credit Note Time); Purchase Orders table (this supplier) with PO Number teal link → `/purchasing/:poId`, Created, Expected, Total, Status badge; Products Supplied table from **batches + PO lines** with live stock (Medicine, Stock w/ low/out emphasis, Cost ৳, status badge); View All POs + View All Products **disabled** (Purchasing list and Inventory search cannot filter by supplier yet — the cheap route doesn't exist); empty states w/ Create PO CTA; `GET /owner/suppliers/:supplierId` additively returns `detail` (`kpis` incl. openOrders + lastPurchaseAt, `performance`, `purchaseOrders`, `products`); `smoke:m6q` shape preserved; superseded `suppliers.placeholder.detail*` keys removed; full `suppliers.detail.*` i18n en + bn-BD; `smoke:m6z` PASS; smoke:m6x updated (detail placeholder superseded); server + web lint/build clean; next = Batch AA. |
| 2026-08-19 | **Batch AA DONE** — live Expiry Returns queue at `/suppliers/returns` (UI_SPEC.md used): 4 KPI cards (Eligible Batches, Eligible Cost Value, Manifests Prepared, Needs Review) from additive `GET /owner/returns/queue` meta; search + Supplier + Return Status filters; table (medicine/batch/expiry/qty/cost/supplier/status) with Eligible-only selection; teal selection bar; mixed-supplier selection cannot create; header Create Return Manifest enabled only on a valid one-supplier Eligible selection and navigates to `/suppliers/returns/new` (layout NOT built — Batch AB) with session draft of selected lot ids; Export / Print disabled; Inventory Expiry Prepare Supplier Return enabled → this page; full `suppliers.returns.*` i18n en + bn-BD; `smoke:m6aa` PASS; smoke:m6n + smoke:m6x updated; next = Batch AB. |
| 2026-08-19 | **Batch AB DONE** — live Create Return Manifest at `/suppliers/returns/new` (shared Create Return Manifest screen): reviews Batch AA session draft, live Eligible lots, supplier policy, editable return qty, Confirm → `POST /owner/return-manifests` (optional `supplierReference`); SRM number generated on create; Save as Draft disabled (no DRAFT status); preparing does not move stock; navigates to `/suppliers/returns/:manifestId` (Details still Batch AC); full `suppliers.manifest.*` i18n en + bn-BD; `smoke:m6ab` PASS; next = Batch AC. |
| 2026-08-19 | **Slice 2 AC–AD DEFERRED.** Manifest Details + Slice 2 exit paused (placeholder remains). **Slice 3 planned (AE–AM not started):** Owner web Customers + POS cashier/manager registration pending Owner approval; Owner create Active immediately. Edit Customer parked. Reject + POS Create invented. Next = Authorize M6 Batch AE. |
| 2026-08-19 | **Batch AE DONE** — additive Customer Prisma (`CustomerStatus` / `CustomerSource` / `CustomerGender`, required phone, profile extras, approval audit) + partial unique `(tenantId, phone) WHERE status <> REJECTED`; Zod DTOs + `saleListQuerySchema.customerId` stub; seed Karim/Nusrat ACTIVE OWNER_CREATED + Farhan pending POS; `POST /customers` still OWNER-only; no Owner web Customers routes. Next = Authorize M6 Batch AF. |
