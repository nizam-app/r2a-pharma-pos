# Milestone 6 — Growth / Owner Web (Batch Execution Plan)

**Document type:** Fresh-chat execution guide for Milestone 6  
**Source of truth:** [`PROJECT_MASTER_PLAN.md`](PROJECT_MASTER_PLAN.md)  
**Live progress context:** [`Current_Status.md`](Current_Status.md)  
**API catalog:** [`Completed_API_lists.md`](Completed_API_lists.md)  
**RBAC contract:** [`ROLES_AND_PERMISSIONS.md`](ROLES_AND_PERMISSIONS.md) (v2.0.0)  
**Authorized plan:** [`.cursor/plans/m6_slice_1_owner_33de6430.plan.md`](.cursor/plans/m6_slice_1_owner_33de6430.plan.md)  
**Status of M6:** **IN PROGRESS** — Slice 1 Batches **A–M DONE**; **N–O not started**. Later M6 slices (Purchasing, Manager web, n8n, RLS, bi-di) are **not** in this file yet.
**Prerequisite:** Milestone 0–**5** **DONE**.  
**Do not start:** Manager web, Purchasing/Suppliers/Customers/Staff/Reports/Audit/Settings screens, supplier return workflow, bi-di catalog sync, n8n, Postgres RLS, Slice 7+ POS, real printer IPC, card SDK, MFS APIs, FEFO `pinHash`, cloud shift, multi-branch switch, on-account tender — unless the user re-authorizes.

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
> - Implement **one batch per chat**. Do not collapse A–O into a single “do Milestone 6” run.
> - **Do not plan or build screens that are not in Slice 1.** When more Owner screens arrive, append Slice 2+.
> - **Mock inconsistency:** chrome is locked (same as M3). Per-screen mocks drive *content only*. The agent **handles** layout/theme/nav mismatches — do not restyle chrome to match a later/earlier mock.
> - **Missing next screen:** if a control implies a flow we do not have a screenshot for, the agent **asks and guides** — do not invent that screen, and do not silently skip without asking.
> - `apps/web` is **OWNER only**. Manager and Cashier must not use it.
> - No invented KPI/table rows. Live Prisma via Express. Shared APIs with POS (no second sales store).
> - Payments stay **`CASH` \| `CARD` \| `MFS` only**. No Baki / on-account. No sale void.
> - Localization: all new UI strings use `t("...")` + `apps/web` `en.ts` + `bn-BD.ts`. Do not translate medicine names, batch numbers, TXN ids, phones, barcodes, SKUs. Latin digits only. UI locale does **not** change receipt body.
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
| Parked controls (Export, bell, Supplier, Prepare Return, Edit Product) | This file’s parked table — disable/omit; do not invent backends |
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

- Edit Product, Create Customer, Staff detail, PO / Supplier pages, Settings, Help, Owner Profile
- Any new modal/page implied by a primary CTA that is **not** listed in Slice 1 routes

Examples that **must not** trigger an ask (already locked):

- Disabled later-nav items, Prepare Supplier Return, Export no-op, header bell/search, branch switch, Supplier/PO on Receive

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
| Cloud API | Real — auth, inventory, FEFO, `/sales/ingest`, `/sync/ingest`. **Batch E:** `GET /sales` + `GET /sales/:id`. **Batch F:** `GET /owner/dashboard` + inventory-summary + expiry. **Batch J:** `GET /owner/inventory`. **Batch K:** `GET /owner/products/:id` |
| `@r2a/desktop` | POS shell + one-way sync + Receive stock (Owner/Manager Settings) |
| `@r2a/web` | **Batch M DONE** — live Dashboard + Sales + Transaction Details + Inventory + Product Details + Add Product + Receive Stock |
| Schema | **Batch C DONE** — Sale/SaleItem/Product extras + `InventoryEvent` |
| Ingest | **Batch D DONE** — `receiptNo`, cost snapshot, loyalty, FEFO flags, `InventoryEvent` SALE/RECEIVE/ADJUST |
| Loyalty | Session calc on POS; **Batch D** snapshots `loyaltyUsed`/`loyaltyEarned` on ingest when present |
| FEFO override | POS PIN stub unchanged; ingest persists `fefoOverride` + `fefoAuthorizedByName` (notes still kept) |
| Supplier / PO / returns | **No** models |
| Print / FEFO PIN | Stubs — stay stubs |

### Milestone 6 (master plan §7) vs this file

Full M6: bi-di sync, loyalty persist, refill/n8n, supplier return, Owner web, RLS.

**This file = Slice 1 only:** Owner Admin Portal screens 1–8 + the APIs those screens need, including minimal loyalty + FEFO fields on ingest so Transaction Details is live.

---

## Incremental slice protocol (mandatory)

| Rule | Behavior |
|------|----------|
| Active scope | **Slice 1** (batches A–O) |
| More Owner screens later | User shares → agent **appends Slice 2+** |
| Slice 1 complete | Batch O exit + user walkthrough PASS |
| M6 milestone complete | **Not** this slice — later slices still required |
| Invent authorization | Owner Login (Batch A). Chrome from Dashboard. |
| Not inventable yet | Manager web, Purchasing, Suppliers, Customers, Staff, Reports, Audit & FEFO, Settings, Help, Owner Profile, Edit Product, Create Customer UI, supplier return, n8n, RLS, bi-di, branch switch |

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
  LIVE:     Dashboard, Sales, Inventory
  DISABLED: Purchasing, Suppliers, Customers, Staff, Reports,
            Audit & FEFO, Settings, Help, Owner Profile
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

Register `/inventory/expiry` and `/inventory/new` **before** `/:productId`.

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
| Receive stock | Web uses existing `POST /api/v1/batches`. Desktop Settings Receive **stays**. Same API |
| Cost / margin / net profit | Owner web **shows**. `GET /sales` redacts those fields for Manager/Cashier (POS may use list later) |
| Create Customer | **Not** in Slice 1 (Customers nav disabled). `POST /customers` remains OWNER-only |
| Net Sales copy | Gross − discounts. **No returns.** Do not invent a returns ledger |
| Amount due | Always **৳0** (fully settled) |

### Parked controls (on Slice 1 screens — do not fake data)

| Mock control | Slice 1 |
|--------------|---------|
| Branch / store switch | Display only, disabled |
| Supplier, Link PO, supplier invoice on Receive | **Omit** |
| Prepare Supplier Return | **Disabled** |
| Return eligibility / Manifest | Hide or em dash |
| Export | No-op or hide until a later slice |
| Header search / bell | Chrome only; no search results / notification inbox |
| Edit Product, More Actions, View Inventory History | Disabled |
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

**`InventoryEvent`** (append-only):

| Field | Notes |
|-------|--------|
| `type` | `RECEIVE` \| `ADJUST` \| `SALE` |
| `quantityBaseChange` | Signed PIECE delta |
| `productId`, `batchId?`, `storeId`, `tenantId` | Required scoping |
| `saleId?` | Set on SALE |
| `actorUserId?` | JWT `sub` for RECEIVE/ADJUST |
| `note?` | Short reason (e.g. breakage) |

Write events from: `POST /batches` (RECEIVE), `PATCH /batches` qty (ADJUST = new − old), sale ingest (SALE per line). Desktop Receive gets history automatically.

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

Manager web, n8n, RLS, bi-di sync, Supplier/PO models, return manifests, CSV import, terminal presence, Edit Product screen, Create Customer UI, branch switching, printer IPC, `pinHash`, sale void, `creditBalance`.

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
- [x] `smoke:m6b`: sidebar labels include disabled later items; no `navigate` to Purchasing
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

**Goal:** New sales persist loyalty snapshots, FEFO flags, cost-at-sale, receiptNo, SALE inventory events. RECEIVE/ADJUST events on existing batch POST/PATCH. Desktop `saleIngest.ts` sends the new fields. **Cashier UX unchanged.**

**Re-share screen:** none.

### Tasks

- [x] `ingestSale`: generate `receiptNo`; fill `costPerBaseAtSale`; persist FEFO flags; loyalty snapshot + `Customer.loyaltyPoints` update when fields present; write `InventoryEvent` SALE rows
- [x] Idempotent replay: do **not** double-apply loyalty or events
- [x] `POST /batches` → RECEIVE event (`quantityBaseChange` = qty posted)
- [x] `PATCH /batches` qty → ADJUST event (delta)
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

**Goal:** Owner receives a lot from the web using **`POST /api/v1/batches`** (same as desktop). Omit Supplier / PO / invoice.

**Re-share screen:** **Receive Stock**.

### Tasks

- [x] Ask for screenshot; stop until reply
- [x] Product context card from GET product
- [x] Fields: batchNumber, expiry, qty PIECE, costPerBase, sellPerBase, received date **display only** (server `createdAt`)
- [x] Omit supplier, Link PO, invoice
- [x] Live packaging math + cost/retail/margin + stock impact from current on-hand
- [x] Confirm → POST batches → InventoryEvent RECEIVE (already D) → Product Details
- [x] i18n; duplicate batchNumber uses existing API error
- [x] `smoke:m6m`: receive page calls POST /batches
- [x] Do **not** queue offline GRN

### Exit check

- New lot appears on Product Details and POS after catalog pull
- Desktop Receive still works

### Agent prompt

```text
Implement ONLY Batch M from MILESTONE_6_EXECUTION.md
(Receive Stock web).
Re-share: Receive Stock — stop until shared or use prior.
POST /batches only. Omit Supplier/PO/invoice.
When done, paste the short M6 Batch M report.
```

### User walkthrough

**YOU DO:** Receive a new Napa lot from web. Confirm POS search sees it after pull/reload.

**Next:** `Authorize M6 Batch N`.

---

## Batch N — Expiry Management

**Goal:** Live expiry buckets. Prepare Supplier Return **disabled**. No return eligibility column (or em dash).

**Re-share screen:** **Expiry Management**.

### Tasks

- [ ] Ask for screenshot; stop until reply
- [ ] `GET /owner/expiry` — cards + table + tabs
- [ ] Search medicine/batch (no supplier)
- [ ] Export no-op or omit
- [ ] Prepare Supplier Return disabled
- [ ] Row click → Product Details optional
- [ ] `smoke:m6n`: expiry page calls owner expiry API
- [ ] Do **not** create return manifests

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

- [ ] [`Completed_API_lists.md`](Completed_API_lists.md) **§21** (or next free section): GET sales, owner dashboard/summary/expiry, ingest extras, InventoryEvent, product extras, redaction rules
- [ ] `npm run smoke:m6s1` composing m6a–m6n guards that exist + `smoke:m2` ingest still green
- [ ] [`Current_Status.md`](Current_Status.md): M6 Slice 1 screens live; later backlog listed; next = Slice 2 when screens shared
- [ ] [`PROJECT_MASTER_PLAN.md`](PROJECT_MASTER_PLAN.md): M6 still not DONE; note Slice 1 Owner web
- [ ] [`ROLES_AND_PERMISSIONS.md`](ROLES_AND_PERMISSIONS.md): Owner web = live for Slice 1 screens; Manager web still later
- [ ] This file: A–O checkboxes; Slice 1 status **DONE**
- [ ] Do **not** start Purchasing or Manager web

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

---

## Later backlog (do not build in Slice 1)

| Track | Item |
|-------|------|
| Manager | Manager web screens + Manager authorization matrix |
| Nav | Purchasing, Suppliers, Customers, Staff, Reports, Audit & FEFO, Settings, Help, Owner Profile |
| Owner | Edit Product, Create Customer UI, Export, notifications inbox, branch switch |
| Domain | Supplier/PO, supplier return bucket, CSV import, terminal presence |
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
| 2026-08-16 | **Batch M DONE** — live Owner web Receive Stock (`GET /owner/products/:id` context + `POST /batches`); PIECE quantity and per-base prices; packaging, cost/retail/margin, and stock-impact calculations; Supplier/PO/invoice omitted; online-only; `smoke:m6m`. Expiry Management = Batch N. |
