# R2A Pharmacy POS — Current Status

**Last updated:** 2026-08-13  
**Purpose:** Single place to understand where the project stands when you return. Read this first in a new chat, then open the linked source-of-truth docs as needed.  
**Maintainer note:** Update this file at the end of every completed milestone (or significant mid-milestone change).

---

## 1. One-glance summary

| Item | Status |
|------|--------|
| **Product** | Offline-first, multi-tenant Pharmacy POS + Inventory SaaS (Bangladesh / emerging markets) |
| **Phase** | Phase 1 MVP — DB + cloud API + desktop **M3 POS shell DONE**; **M4 IN PROGRESS** (Batches A–D DONE; next Batch E Sync Queue UI) |
| **Latest completed milestone** | **M3 — Desktop POS shell** |
| **Next authorized work** | Authorize **M4 Batch E** (Sync Queue panel + i18n). Do not start F / M5 / Slice 7+ from status alone. |
| **Cloud database** | Neon PostgreSQL (Prisma migrate + seed applied; `RefreshToken` migration applied in M2) |
| **Cloud API** | Express + TypeScript in `apps/server` — **real** (auth, tenant guard, inventory, FEFO, sales ingest, **M4B** `POST /api/v1/sync/ingest`) |
| **Local desktop / SQLite / Tauri** | **Login + chrome + connectivity + SQLite + Counter Ready → … → Cash / Card / MFS + Receipt Preview + print stub + F4 + Settings pharmacy header + Force Offline + Transactions List/Detail/Reprint + Shift Open/Close + Hold [F6] / Held list [F7]** (M3 A–Z + AA–AE + AF–AL + AM–AP); **soft gate:** New Sale [F2] requires open shift (badge stays connectivity-only); Card = terminal stub; MFS = invented confirm |
| **MongoDB / Mongoose** | Removed; do not reintroduce |

**Bottom line:** Schema, shared Zod, and the cloud Express API are smoke-verified (`npm run smoke:m2 -w @r2a/server` — 13/13). Desktop **M3 POS shell DONE** (Slices 1–6; Hold F6 / Held list F7; `smoke:m3ap`). **M4 Batches A–D DONE** (queue IPC `smoke:m4a`; `POST /api/v1/sync/ingest` `smoke:m4b` 13/13; offline complete `smoke:m4c`; 15s flush `smoke:m4d`). Sync Queue UI = Batches E–F. Later screens → Slice 7+ when you share them — not invented ahead.
---

## 2. Milestone board (authoritative progress)

Source of truth for milestone status: [`PROJECT_MASTER_PLAN.md`](PROJECT_MASTER_PLAN.md) (update there when authorizing status changes). This file reflects live completion as of the date above.

| ID | Milestone | Status | What it means right now |
|----|-----------|--------|-------------------------|
| **M0** | Workspace hygiene | **DONE** | Turborepo monorepo, gitignore, docs relocated, old Mongo backend deleted |
| **M1** | Database foundation | **DONE** | Prisma schema, indexes, Neon migration, seed, `@r2a/shared-types` Zod |
| **M2** | Cloud API core | **DONE** | Express TS, JWT + refresh, tenant guard, inventory CRUD, FEFO, sales ingest |
| **M3** | Desktop POS shell | **DONE** | Slice 1–6 (A–AP). Later screens → Slice 7+ when authorized. See `MILESTONE_3_EXECUTION.md` |
| **M4** | One-way sync | **IN PROGRESS** | Batches **A–D DONE** (queue IPC + `/sync/ingest` + offline complete + 15s flush). **E–F pending.** |
| **M5** | MVP hardening | **PENDING** | RBAC E2E, payments polish, print stub, smoke tests, pilot runbook |
| **M6** | Growth (Phase 2) | **PENDING** | Bi-di sync, loyalty, n8n, owner web, RLS |
| **M7** | Scale (Phase 3) | **PENDING** | Multi-branch, transfers, enterprise RBAC |

### Milestone 1 execution batches (all green)

Detailed batch plan: [`MILESTONE_1_EXECUTION.md`](MILESTONE_1_EXECUTION.md).

| Batch | Title | Status | Date |
|-------|-------|--------|------|
| A | Package scaffolding & tooling | DONE | 2026-08-08 |
| B | Prisma schema (core models) | DONE | 2026-08-08 |
| C | Indexes, constraints, migrate | DONE | 2026-08-08 |
| D | Shared Zod contracts | DONE | 2026-08-08 |
| E | Seed (owner + sample catalog) | DONE | 2026-08-08 |
| F | Exit verification & wiring | DONE | 2026-08-08 |

### Milestone 2 execution batches (all green)

Detailed batch plan: [`MILESTONE_2_EXECUTION.md`](MILESTONE_2_EXECUTION.md).

| Batch | Title | Status | Date |
|-------|-------|--------|------|
| A | Server scaffolding & tooling | DONE | 2026-08-08 |
| B | API foundation (errors, envelope, logging, health) | DONE | 2026-08-08 |
| C | Auth (register / login / JWT / refresh / protect / restrictTo) | DONE | 2026-08-08 |
| D | Tenant context guard | DONE | 2026-08-08 |
| E | Inventory CRUD + cashier margin rules | DONE | 2026-08-08 |
| F | FEFO helper + generic substitutes | DONE | 2026-08-08 |
| G | Sales ingest (transactional, idempotent, FEFO-aware) | DONE | 2026-08-08 |
| H | Exit verification & smoke | DONE | 2026-08-09 |

**M2 exit (verified):** Authenticated sale ingest with FEFO; cashier cannot see `costPerBase` / margins (`sellPerBase` may appear).

### Milestone 3 execution batches (Slice 1)

Detailed batch plan: [`MILESTONE_3_EXECUTION.md`](MILESTONE_3_EXECUTION.md).

| Batch | Title | Status | Date |
|-------|-------|--------|------|
| A | Desktop scaffolding (Tauri + Vite + React + Tailwind) | **DONE** | 2026-08-09 |
| B | Design tokens + app chrome shell (Search Results - Napa) | **DONE** | 2026-08-09 |
| C | Login (invented) + session against M2 | **DONE** | 2026-08-09 |
| D | Connectivity badge + online/offline mode | **DONE** | 2026-08-09 |
| E | Local SQLite + catalog cache + outbound_sync_queue | **DONE** | 2026-08-09 |
| F | Counter Ready - Terminal 01 | **DONE** | 2026-08-09 |
| G | Empty POS - New Sale started | **DONE** | 2026-08-09 |
| H | Search Results - Napa | **DONE** | 2026-08-09 |
| I | Select Batch | **DONE** | 2026-08-09 |
| J | Quantity & Packaging | **DONE** | 2026-08-09 |
| K | Current Sale / Active Cart (stop before payment) | **DONE** | 2026-08-11 |
| L | Slice 1 exit verification | **DONE** | 2026-08-11 |

### Milestone 3 execution batches (Slice 2)

| Batch | Title | Status | Date |
|-------|-------|--------|------|
| M | Edit Sale Item | **DONE** | 2026-08-11 |
| N | Change Batch (edit) + FEFO override warn | **DONE** | 2026-08-11 |
| O | Manager Authorization stub | **DONE** | 2026-08-11 |
| P | Override staged + cart badge/toast | **DONE** | 2026-08-11 |
| Q | Remove Item confirm | **DONE** | 2026-08-11 |
| R | Select Customer (F8) — no Baki | **DONE** | 2026-08-11 |
| S | Redeem Loyalty + OTP stub | **DONE** | 2026-08-11 |
| T | Complete Sale zero-pay + Sale Completed | **DONE** | 2026-08-11 |
| U | Slice 2 exit + API catalog update | **DONE** | 2026-08-11 |

### Milestone 3 execution batches (Slice 3)

| Batch | Title | Status | Date |
|-------|-------|--------|------|
| V | Payment - Select Method | **DONE** | 2026-08-11 |
| W | Cash Payment | **DONE** | 2026-08-11 |
| X | Shared Sale Completed shell + cash settlement | **DONE** | 2026-08-11 |
| Y | Print stub states | **DONE** | 2026-08-11 |
| Z | Slice 3 exit + API catalog update | **DONE** | 2026-08-11 |

### Milestone 3 execution batches (Slice 4)

| Batch | Title | Status | Date |
|-------|-------|--------|------|
| AA | Receipt Preview (80/58) + dynamic lines | **DONE** | 2026-08-12 |
| AB | Card Payment stub | **DONE** | 2026-08-12 |
| AC | Sale Completed — Card settlement | **DONE** | 2026-08-12 |
| AD | MFS providers + invented confirm/result | **DONE** | 2026-08-12 |
| AE | Slice 4 exit + API catalog update | **DONE** | 2026-08-12 |

**M3:** **DONE** (2026-08-13). Later POS finds → Slice 7+. Real printer IPC / card SDK / MFS / cloud sales list / cloud shift remain TODOs. **No M4 unless authorized.**

### Milestone 3 execution batches (Slice 5)

| Batch | Title | Status | Date |
|-------|-------|--------|------|
| AF | Remove Create Customer from POS + OWNER-only POST | **DONE** | 2026-08-12 |
| AG | Generic Substitutes [F4] | **DONE** | 2026-08-12 |
| AH | Settings - Pharmacy / Receipt Header | **DONE** | 2026-08-12 |
| AI | Force Offline / Stay Offline | **DONE** | 2026-08-12 |
| AJ | Transactions - List | **DONE** | 2026-08-12 |
| AK | Transactions - Detail + Reprint | **DONE** | 2026-08-12 |
| AL | Shift Open/Close + Slice 5 exit + API catalog | **DONE** | 2026-08-12 |

### Milestone 3 execution batches (Slice 6)

| Batch | Title | Status | Date |
|-------|-------|--------|------|
| AM | Held-sale store + snapshot type | **DONE** | 2026-08-13 |
| AN | Hold action + Held Sales list UI | **DONE** | 2026-08-13 |
| AO | Soft resume recheck + payment-safety on Hold | **DONE** | 2026-08-13 |
| AP | Slice 6 exit + API catalog | **DONE** | 2026-08-13 |

## 3. Locked product & stack decisions

Do not drift from these unless the user explicitly changes them.

| Area | Decision |
|------|----------|
| Cloud API | Express + TypeScript |
| Cloud DB | Prisma + **PostgreSQL** (currently Neon) |
| Desktop | Tauri + React + **SQLite** (`pos_local.db`) — M3 Batch E **DONE** |
| UI packages | React, TypeScript, Tailwind, Shadcn (`@r2a/ui` bootstrapped M3A) |
| Shared contracts | Zod in `@r2a/shared-types` |
| Tenancy | Shared Postgres; `tenantId` on every domain table; **JWT-only** `tenantId` (enforced via `protect` + `tenantContext`) |
| Roles | `SUPER_ADMIN` \| `OWNER` \| `MANAGER` \| `CASHIER` (pharmacy RBAC — not marketplace roles) |
| Units | Box / Strip / Piece; quantities stored in **lowest unit (PIECE)** |
| Payments (current design) | **`CASH` \| `CARD` \| `MFS` only** — **no Baki** as a payment method |
| Sales | Append-only / immutable intent; online path `POST /api/v1/sales/ingest` |
| Sync identity | Unique `Sale.eventId` for offline ingest idempotency |
| Auth tokens | Short-lived access JWT + hashed rotatable **refresh** tokens (`RefreshToken` model) |
| Forbidden | MongoDB, Mongoose, parallel competing backends/frontends |

**Design correction already applied (post–M1 Batch B):** Payment method enum was changed from Cash/MFS/Baki → **Cash / Card / MFS**. Keep that unless re-authorized.

---

## 4. Repository layout (what exists vs placeholder)

```text
R2A-Pharmacy-POS/
├── apps/
│   ├── server/          # REAL — Milestone 2 Express API
│   ├── desktop/         # REAL — M3 POS shell DONE (A–AP; Hold F6 / Held list F7)
│   └── web/             # PLACEHOLDER only — Phase 2 / M6
├── packages/
│   ├── database/        # REAL — Prisma schema, migrations, seed, client export
│   ├── shared-types/    # REAL — Zod auth/product/batch/customer/sale/sync + enums
│   └── ui/              # REAL bootstrap — ShellPlaceholder (M3 Batch A); Shadcn later
├── docs/                # Specs (handover, PRD, architecture, UX)
├── workflows/           # Future n8n contracts (empty/placeholder era)
├── PROJECT_MASTER_PLAN.md
├── MILESTONE_1_EXECUTION.md
├── MILESTONE_2_EXECUTION.md
├── MILESTONE_3_EXECUTION.md
├── Completed_API_lists.md
├── Current_Status.md    # This file
├── .env.example
├── package.json         # Turborepo workspaces + db:* scripts
├── turbo.json
└── tsconfig.base.json
```

### Package names

| Package | npm name | State |
|---------|----------|--------|
| Database | `@r2a/database` | Implemented |
| Shared types | `@r2a/shared-types` | Implemented |
| UI | `@r2a/ui` | Bootstrap (M3A) |
| Server | `@r2a/server` | **Implemented (M2)** |
| Desktop | `@r2a/desktop` | **M3 DONE** — Slice 1–6 (Hold [F6] / Held list [F7]); later screens → Slice 7+ |
| Web | `@r2a/web` | Stub |

---

## 5. What Milestone 1 delivered (detail)

### 5.1 Prisma schema (`packages/database/prisma/schema.prisma`)

**Enums**

- `Role`: `SUPER_ADMIN`, `OWNER`, `MANAGER`, `CASHIER`
- `UnitType`: `BOX`, `STRIP`, `PIECE`
- `PaymentMethod`: `CASH`, `CARD`, `MFS`

**Models**

| Model | Role in domain |
|-------|----------------|
| `Tenant` | Multi-tenant root |
| `Store` | Store under tenant (MVP: single-store ops enough) |
| `User` | Auth identity; `passwordHash`; optional `storeId` |
| `RefreshToken` | Opaque refresh tokens (SHA-256 hash only); rotate on use (**added M2**) |
| `Product` | Catalog; searchable `name`, `genericName`, `manufacturer`, `strength`, `form`, `sku`, `barcode` |
| `ProductUnit` | Conversion factors to base unit (`factorToBase`) |
| `Batch` | FEFO-ready lot: expiry, qty in base units, cost/sell per base |
| `Customer` | Optional phone/email; loyalty/credit fields reserved for later |
| `Sale` | Immutable header; unique `eventId` for sync idempotency |
| `SaleItem` | Line items tied to product + batch + unit |
| `Payment` | Cash / Card / MFS lines on a sale |

**Important behaviors encoded in schema**

- Every domain table has `tenantId` (FK to `Tenant` where modeled).
- Sales / sale items / payments have **no `updatedAt`** (append-only intent).
- Sync approach chosen: **global unique `Sale.eventId`** (not a separate SyncEvent table).

### 5.2 Migration

- Path: `packages/database/prisma/migrations/20260808144500_init/`
- M2 add-on: `packages/database/prisma/migrations/20260808183000_refresh_tokens/`
- Catalog fields: `packages/database/prisma/migrations/20260811013000_product_catalog_fields/` (`manufacturer`, `strength`, `form`)
- Applied successfully to Neon (`prisma migrate deploy`).

### 5.3 Seed (`packages/database/prisma/seed.ts`)

Idempotent **upserts** by stable keys (tenant slug, store code, email, product sku, batch number). Safe to re-run. Full wipe = reset DB ? migrate ? seed.

**Seeded demo data**

| Entity | Value |
|--------|--------|
| Tenant | slug `demo-pharmacy`, name "Demo Pharmacy" |
| Store | code `MAIN`, "Main Counter", Dhaka |
| Owner | email `owner@demo.local`, role `OWNER` |
| Manager | email `manager@demo.local`, role `MANAGER` |
| Cashier | email `cashier@demo.local`, role `CASHIER` |
| Default password | `ChangeMe123!` (override with `SEED_OWNER_EMAIL` / `SEED_OWNER_PASSWORD`; staff emails via `SEED_MANAGER_EMAIL` / `SEED_CASHIER_EMAIL`; staff password via `SEED_STAFF_PASSWORD` or same as owner) |
| Products | 5 BD-familiar OTCs with manufacturer / strength / form (e.g. Napa 500mg ? Beximco ? Tablet) |
| Per product | Unit rows (Box/Strip/Piece as applicable) + batches |
| Napa lots | **4 demo lots** for Select Batch / FEFO UX (see table below). Re-seed zeros retired `NP-2408-A` |
| Customer | Karim Ahmed, phone `01700000000`, **120** loyalty pts (eligible redeem) |
| Customer | Nusrat Jahan, phone `01811000000`, **25** loyalty pts (below 50 ? Not Eligible UI) |

**Napa 500mg demo lots (`sku: NAPA-500`)**

| Batch No. | Expiry | Qty | Role in UI |
|-----------|--------|-----|------------|
| `NP23091` | 2026-08-31 | 14 pcs | **FEFO Recommended** ? search card front + modal default |
| `NP24031` | 2026-10-31 | 124 pcs | Standard |
| `NP24052` | 2027-03-31 | 86 pcs | Standard |
| `NP23010` | 2024-05-31 | 12 pcs | Expired ? Select Batch detail only; not sellable |

**Desktop FEFO display lock:** Search cards use earliest **sellable** lot (`pickSellableFefo`). Cloud `GET /products/:id/fefo-batch` may still return an expired in-stock lot; desktop does not put that on the search card when sellable stock exists.

### 5.4 Shared Zod (`packages/shared-types`)

| Module | Contents |
|--------|----------|
| `enums.ts` | Role, UnitType, PaymentMethod |
| `auth.ts` | login / register / staff create / refresh / JWT claims / safe user |
| `product.ts` | create / update / search + unit inputs + id params |
| `batch.ts` | create / update / list (M2) |
| `customer.ts` | create / update / search (M2) |
| `sale.ts` | sale ingest; **`batchId` optional** for server FEFO fill |
| `sync.ts` | queue envelope: `event_id`, `entity_type`, `action`, `payload` (snake_case) |

**Naming rule:** Domain API DTOs = camelCase (Prisma-aligned). Sync queue envelope = snake_case (desktop queue contract). Map at the sync boundary later.

### 5.5 Package wiring & scripts

**Root scripts**

- `npm run db:generate`
- `npm run db:migrate` ? `prisma migrate dev`
- `npm run db:deploy` ? `prisma migrate deploy`
- `npm run db:seed`

**`@r2a/database` exports**

- `prisma` singleton client
- `PrismaClient` and Prisma generated types/enums

**`@r2a/shared-types` exports**

- All Zod schemas/types from package entry `src/index.ts` ? `dist/`

---

## 6. What Milestone 2 delivered (detail)

Execution plan: [`MILESTONE_2_EXECUTION.md`](MILESTONE_2_EXECUTION.md).

### 6.1 Server layout (`apps/server`)

Locked modular tree: `router ? controller ? service` under `src/modules/*`; mount `/api/v1`.

| Area | Delivered |
|------|-----------|
| Foundation | `AppError`, `catchAsync`, `sendResponse`, Zod `validate`, pino logger, CORS, `GET /health` + `GET /api/v1/health` |
| Auth | `POST /auth/register`, `/login`, `/refresh`, `/logout`; JWT claims `{ sub, role, tenantId, storeId }`; bcrypt passwords |
| Users | `GET /users/me`; `POST /users` (OWNER/MANAGER ? CASHIER/MANAGER) |
| Tenant | `protect` + `tenantContext`; body `tenantId` stripped/ignored; `assertStoreAccess` |
| Products | CRUD/search; units with `factorToBase` |
| Batches | CRUD/list; fields `expiryDate`, `quantityOnHand`, `costPerBase`, `sellPerBase` |
| Customers | CRUD/search by phone/name |
| FEFO | `GET /products/:productId/fefo-batch` (earliest in-stock; may be expired ? desktop search prefers sellable) |
| Substitutes | `GET /products/:productId/substitutes` (stock, sell, nearest expiry / expired) |
| Sales | `POST /sales/ingest` ? FEFO fill if `batchId` omitted; stock decrement txn; `eventId` idempotency |
| Margins | Cashiers never get `costPerBase`; may get `sellPerBase`; blocked from price mutations |

**Env strategy:** `@r2a/server` loads **repo-root `.env` only** (not `apps/server/.env`).

**Smoke:** `npm run smoke:m2 -w @r2a/server` (server must be running; default `http://localhost:8787`, or set `BASE_URL`). Last run **13/13 PASS** (2026-08-09) against seeded `owner@demo.local`.

### 6.2 Key API routes (all under `/api/v1` unless noted)

| Method | Path | Notes |
|--------|------|--------|
| GET | `/health`, `/api/v1/health` | Locked success envelope |
| POST | `/auth/register` \| `/login` \| `/refresh` \| `/logout` | Refresh tokens hashed in DB |
| GET | `/users/me` | Protected |
| POST | `/users` | OWNER/MANAGER only |
| * | `/products`, `/batches`, `/customers` | Tenant-scoped CRUD |
| GET | `/products/:productId/fefo-batch` | FEFO pick (cloud: earliest in-stock; see desktop sellable preference) |
| GET | `/products/:productId/substitutes` | Same `genericName` |
| POST | `/sales/ingest` | Online sale path only ? **not** M4 `/sync/ingest` |

### 6.3 Explicitly out of M2 (do not regress)

- Super Admin platform / tenant-management console routes
- M4 `POST /api/v1/sync/ingest` multi-entity sync pipeline
- Desktop queue worker / SQLite / Tauri
- Baki as a tender type

---

## 7. Environment & database (how to reconnect)

### 7.1 Env files

| File | Role |
|------|------|
| [`.env.example`](.env.example) | Template (committed): DB, JWT, refresh TTL, PORT, CORS, seed placeholders |
| Repo root `.env` | **Server runtime** (gitignored) ? `@r2a/server` loads this only |
| `packages/database/.env` | **Prisma CLI** (gitignored) ? Neon URL for migrate/seed |

### 7.2 Required variables (M2)

- `DATABASE_URL` ? PostgreSQL connection (Neon or local)
- `JWT_SECRET` ? access token signing
- `JWT_EXPIRES_IN` ? default `15m`
- `REFRESH_TOKEN_EXPIRES_IN` ? default `7d`
- `PORT`, `NODE_ENV`, `CORS_ORIGIN`
- Optional seed overrides: `SEED_OWNER_EMAIL`, `SEED_OWNER_PASSWORD`

### 7.3 Cloud DB used during M1/M2

- Provider: **Neon** (ap-southeast-1 pooler)
- Database name: `neondb`
- Migrations + seed applied; refresh-token migration applied in M2

**Security note:** A Neon connection string was pasted in chat during M1. Prefer rotating that Neon password when convenient, then update local `.env` files only (never commit secrets).

### 7.4 Local Postgres

A Windows PostgreSQL 18 service exists on the machine, but the default `postgres:postgres` credentials did **not** work during M1. Neon was used instead. Local Postgres remains optional.

---

## 8. How to verify the project is healthy (smoke)

From repo root (with env set):

```bash
npm install
npm run db:generate
npm run db:deploy
npm run db:seed
npm run build -w @r2a/database
npm run build -w @r2a/shared-types
npm run build -w @r2a/server
```

API smoke (separate terminal):

```bash
npm run dev -w @r2a/server
# other terminal:
npm run smoke:m2 -w @r2a/server
# or: set BASE_URL=http://localhost:8787 && npm run smoke:m2 -w @r2a/server
```

Expected:

- Deploy: schema up to date / migrations applied
- Seed: prints `demo-pharmacy`, `MAIN`, `owner@demo.local`, `products: 5`
- Builds succeed; packages resolve by workspace name
- `smoke:m2`: health ? seed login ? cashier ? search ? FEFO ? ingest ? idempotent ? margin RBAC (**13/13**)

---

## 9. Explicitly NOT done yet (avoid accidental scope creep)

Do **not** start these unless the user authorizes the matching milestone:

- ~~Express routes, JWT, tenant guard, FEFO, sales ingest (M2)~~ ? **DONE**
- ~~Tauri + Vite + React + Tailwind desktop scaffold (M3 Batch A)~~ ? **DONE**
- ~~Design tokens + app chrome shell (M3 Batch B)~~ ? **DONE**
- ~~Invented login + session against M2 (M3 Batch C)~~ ? **DONE**
- ~~Connectivity badge + online/offline mode (M3 Batch D)~~ ? **DONE**
- ~~Local SQLite / catalog cache / outbound_sync_queue (M3 Batch E)~~ ? **DONE**
- ~~Counter Ready - Terminal 01 (M3 Batch F)~~ ? **DONE**
- ~~Empty POS - New Sale started (M3 Batch G)~~ ? **DONE**
- ~~Keyboard POS search results (M3 Batch H)~~ ? **DONE**
- ~~Select Batch modal (M3 Batch I)~~ ? **DONE**
- ~~Quantity & Packaging modal (M3 Batch J)~~ ? **DONE**
- ~~Cart / Active Cart (M3 Batch K)~~ ? **DONE** (table UI; Proceed toast; no payment/ingest)
- ~~Slice 1 exit verification (M3 Batch L)~~ ? **DONE**
- ~~Edit Sale Item (M3 Batch M)~~ ? **DONE**
- ~~Change Batch + FEFO override warn (M3 Batch N)~~ ? **DONE**
- ~~Manager Authorization stub (M3 Batch O)~~ ? **DONE** (stages override for Batch P)
- ~~Override staged + cart badge/toast (M3 Batch P)~~ ? **DONE**
- ~~Remove Item confirm (M3 Batch Q)~~ ? **DONE**
- ~~Select Customer F8 (M3 Batch R)~~ — **DONE** (no Baki; Create removed in AF / Owner web later)
- ~~Redeem Loyalty + OTP stub (M3 Batch S)~~ ? **DONE** (Continue without = right primary; any 6-digit OTP; Slice 3 / Batch T gates)
- ~~Complete Sale zero-pay + Sale Completed (M3 Batch T)~~ ? **DONE** (loyaltyCalc; ingest CASH ?0 + loyalty?discount; Print stub; no Baki)
- ~~Slice 2 exit + API catalog (M3 Batch U)~~ ? **DONE**
- ~~Payment - Select Method (M3 Batch V)~~ — **DONE** (Cash / Card / MFS; walk-in hides points)
- ~~Cash Payment (M3 Batch W)~~ — **DONE** (Exact Amount / change; Complete → X ingest)
- ~~Shared Sale Completed shell + cash settlement (M3 Batch X)~~ — **DONE** (loyalty + cash variants; walk-in OK)
- ~~Print stub states (M3 Batch Y)~~ — **DONE** (auto-start; SYSTEM BUSY; fail/retry; 58mm sample TODO for real IPC)
- ~~Slice 3 exit + API catalog (M3 Batch Z)~~ — **DONE** (`Completed_API_lists.md` §15; `smoke:m3z`)
- ~~Receipt Preview (M3 Batch AA)~~ — **DONE** (inline 80/58; dynamic lines; stub pharmacy header)
- ~~Card Payment stub + Card Sale Completed (M3 Batches AB–AC)~~ — **DONE** (terminal stub; ingest `CARD`)
- ~~MFS providers + invented confirm + Sale Completed (M3 Batch AD)~~ — **DONE** (bKash/Nagad/Rocket; invent confirm; ingest `MFS`)
- ~~Slice 4 exit + API catalog (M3 Batch AE)~~ — **DONE** (`Completed_API_lists.md` §16; `smoke:m3ae`)
- ~~Remove Create Customer from POS + OWNER POST (M3 Batch AF)~~ — **DONE**
- ~~Generic Substitutes F4 (M3 Batch AG)~~ — **DONE**
- ~~Settings Pharmacy / Receipt Header (M3 Batch AH)~~ — **DONE**
- ~~Force Offline / Stay Offline (M3 Batch AI)~~ — **DONE**
- ~~Transactions List (M3 Batch AJ)~~ — **DONE** (local log; no cloud GET /sales)
- ~~Transactions Detail + Reprint (M3 Batch AK)~~ — **DONE** (Receipt Preview + print stub)
- ~~Shift Open/Close + Slice 5 exit (M3 Batch AL)~~ — **DONE** (`Completed_API_lists.md` §17; `smoke:m3al`; soft gate New Sale → open shift)
- ~~Held-sale store (M3 Batch AM)~~ — **DONE** (`heldSaleStore` + `HeldSaleSnapshot`; max 3; no UI)
- ~~Hold F6 + Held list UI (M3 Batch AN)~~ — **DONE** (park/resume/discard; stub recheck toast)
- ~~Soft resume recheck + payment-safety on Hold (M3 Batch AO)~~ — **DONE** (strip/clamp on resume; abort card/MFS stubs)
- ~~Slice 6 exit + API catalog (M3 Batch AP)~~ — **DONE** (`Completed_API_lists.md` §18; `smoke:m3ap`; **F7** Held list toggle)
- ~~Cloud `POST /api/v1/sync/ingest` (M4 Batch B)~~ — **DONE** (`smoke:m4b`; reuses `ingestSale`; catalog §19 = Batch F)
- ~~Offline complete → queue (M4 Batch C)~~ — **DONE** (`smoke:m4c`; same Sale Completed; pending count; no 15s worker)
- ~~15s flush worker + badge (M4 Batch D)~~ — **DONE** (`smoke:m4d`; pause on Force Offline; `__r2aFlushSyncNow()`)
- Sync Queue panel (M4 Batches E–F)
- n8n workflows, owner web dashboard, Postgres RLS (M6+)
- Real Card terminal SDK / real MFS provider APIs (backend-confirmed status; no cashier manual Trx) — later authorized work / M5 polish
- Super Admin platform console (role exists; no admin product surface yet)

---

## 10. Next step when you resume

1. Read this file (`Current_Status.md`).
2. Confirm M0–**M3** are **DONE**. M4 is **IN PROGRESS** (A–D DONE).
3. Authorize **M4 Batch E** (Sync Queue panel + badge/Settings entry). Do **not** start F / M5 / hardware / Slice 7+ unless authorized.
4. Attach/reference:
   - `PROJECT_MASTER_PLAN.md`
   - `Current_Status.md`
   - `MILESTONE_3_EXECUTION.md`
   - `Completed_API_lists.md` (§14–§18 desktop notes)
   - Specs under `docs/` as needed

### Desktop run (Batches A–AP)

```bash
# Terminal 1 — cloud API (required for login + Connected badge + catalog pull + online search)
npm run dev -w @r2a/server

# Terminal 2 — desktop UI (browser; uses memory/localStorage SQLite fallback)
npm run dev -w @r2a/desktop
# → http://localhost:1420/

# Native window (requires Rust toolchain on PATH) — real pos_local.db
npm run dev:tauri -w @r2a/desktop

# Env: copy apps/desktop/.env.example → apps/desktop/.env
# VITE_API_BASE_URL=http://127.0.0.1:8787
# Seed login: owner@demo.local / manager@demo.local / cashier@demo.local — password ChangeMe123!
# After login: Shift → Open Shift (required) → Counter Ready Active Shift updates
# F2 / New Sale without open shift → toast + Shift panel (soft gate); badge stays Connected/Offline
# Open shift → F2 / New Sale → type "Napa" → Enter → Select Batch
# Confirm batch → Quantity & Packaging → Add to Sale → Active Cart table
# Edit (pencil) → Edit Sale Item → Change Batch → FEFO override warn → Request Authorization
# Manager Authorization: any 4-digit PIN + Authorized By → Override Authorized Edit
# Save Changes → cart Override badge + toast
# Clear sale / Esc Cancel sale → in-app ConfirmDialog (←/→ Enter)
# F8 / + Add → Select Customer (search phone/name; no Baki; no Create on POS)
# F4 → Generic Substitutes (search row or cart line focus)
# Proceed/F10 with customer → Redeem Loyalty; Continue without = right primary → Payment Select Method
# Walk-in / due > 0 → Payment Select Method (Cash / Card / MFS); ←→ navigate; Esc Back
# Cash → Cash Payment (Exact Amount / change); Complete → online ingest CASH=due → Sale Completed
# Card → Card Payment stub (Start / decline / cancel); Approved → ingest CARD → Sale Completed Card
# MFS → Provider (bKash/Nagad/Rocket) → invented Confirm → ingest MFS → Sale Completed MFS
# Sale Completed: inline Receipt Preview 80/58 (Settings pharmacy header) + print stub; F2 New Sale
# Settings → Pharmacy header / Force Offline; badge Force Offline sticky until Go Online
# Transactions → list → detail → Reprint
# Hold [F6] parks cart (max 3); mid-payment Hold aborts card/MFS stubs (no Sale Completed)
# Held n/3 [F7] toggles Held list → Enter Resume (soft stock/expiry recheck) / Discard
# QA: __r2aArmPrintFailOnce() / __r2aArmCardDeclineOnce() / __r2aArmMfsFailOnce()
# Redeem → OTP (any 6 digits) → Loyalty line; Proceed at ৳0 → Complete Sale → zero-pay ingest
# Exit smokes: npm run smoke:m3ap -w @r2a/desktop  (also smoke:m4d / smoke:m4c / smoke:m4a / smoke:m3al / smoke:m3ae / smoke:m3z / smoke:m3u / smoke:m3e)
```

### Milestone 3 — delivered (closed 2026-08-13)

- Keyboard checkout **online**: Cash / Card stub / MFS invent → `POST /sales/ingest` + Sale Completed + Receipt Preview
- Hold **F6** / Held list **F7**; Shift soft gate; Force Offline; Transactions; F4; Settings header
- Local SQLite catalog cache + `outbound_sync_queue` **table** (flush = **M4**)
- **Later screens:** append Slice 7+ when shared — do not invent ahead
- **Still later (not M3):** real printer IPC · real card SDK · real MFS APIs · cloud sales list / cloud shift · Owner web Create Customer · M4 Sync Queue panel (Batch E)

---

## 11. Key documents map

| Document | Use it for |
|----------|------------|
| [`Current_Status.md`](Current_Status.md) | “Where are we now?” (this file) |
| [`Completed_API_lists.md`](Completed_API_lists.md) | Full cloud API catalog (M2) + M3 desktop §§14–18 |
| [`PROJECT_MASTER_PLAN.md`](PROJECT_MASTER_PLAN.md) | Locked stack, milestones, DoD, agent rules |
| [`MILESTONE_1_EXECUTION.md`](MILESTONE_1_EXECUTION.md) | How M1 was batched and verified |
| [`MILESTONE_3_EXECUTION.md`](MILESTONE_3_EXECUTION.md) | How M3 slices/batches were executed (Slice 1–6 **DONE**; M3 closed) |
| [`docs/Project_Handover.md`](docs/Project_Handover.md) | Agent context / non-negotiable business rules |
| [`docs/Project_Requirement_Documents.md`](docs/Project_Requirement_Documents.md) | Product requirements |
| [`docs/System_Architecture_Technical_Specification.md`](docs/System_Architecture_Technical_Specification.md) | Architecture / tenancy / sync notes |
| [`docs/UX_Specification.md`](docs/UX_Specification.md) | POS UX / layout / shortcuts |

---

## 12. Open corrections / future design notes

Tracked so returning chats don?t re-learn tribal knowledge:

1. **Payments:** No Baki payment method ? only Cash, Card, MFS (schema + Zod already updated). Master-plan M5 ?Baki? wording is a future product change, not current scope.
2. **Customer `creditBalance`:** Still on the model as optional account credit storage; **not** a POS tender type. May be refined later with requirements.
3. **Prisma 7 warning:** `package.json#prisma` seed config is deprecated toward `prisma.config.ts` ? fine for now; migrate when upgrading Prisma major.
4. **Prisma Batch field names (locked):** `expiryDate`, `quantityOnHand`, `costPerBase`, `sellPerBase` ? never invent `expirationDate` / `quantityBase` aliases.
5. **API response envelope (locked):** success `{ status, message, data?, meta? }`; errors via `AppError` + global handler ? not `{ success: false, error: { code, message } }` unless re-authorized.
6. **Super Admin:** Enum/JWT role only for now; separate platform admin setup later (not this POS product surface).
7. **Refresh tokens (M2):** Hashed in `RefreshToken`; rotate on refresh; reuse of revoked token revokes all user sessions.
8. **Sale `batchId`:** Optional on ingest ? omitted ? server FEFO; provided ? validate tenant/store/stock.
9. **Force Offline / Stay Offline (desktop) — DONE Batch AI:** Cashier can override auto health on this terminal (badge menu or Settings → Connectivity). Sticky via forceOfflineStore (localStorage) until explicit **Go Online**; health probes / browser online / header re-probe ignored while forced. Badge shows Offline · Forced. Owner/Manager **presence** across terminals remains deferred (note #10).
9b. **Transactions List + Detail (desktop) — DONE Batch AJ–AK:** Sidebar Transactions opens invented list from local `transactionLogStore` (localStorage, tenant+store; append on Cash/Card/MFS/loyalty complete). No cloud `GET /sales` yet (TODO — ask before inventing). ↑/↓ · Enter detail · Esc. Detail shows items/totals/method/customer/loyalty + Receipt Preview; Reprint → print stub.
9c. **Shift Open/Close (desktop) — DONE Batch AL + soft gate (2026-08-13):** Local `shiftStore` (tenant+store). Counter Ready Active Shift reads it. Connectivity badge stays **independent** (health / Force Offline only — do **not** couple badge to shift). **Soft gate:** New Sale [F2] (sidebar / Counter Ready / Sale Completed) requires an open shift → otherwise info toast + opens Shift panel. Closing shift mid-sale still allowed. No cloud shift API yet (TODO when authorized).
9d. **Hold / Park Sale (desktop) — Slice 6 AP DONE:** `heldSaleStore` + Hold **F6** + Held list **F7** (toggle; cart Held n/3) + resume / discard confirm. Soft hold — no reservation. Resume rechecks live batch/expiry/qty (strip unsellable, clamp short stock; keep hold if none remain). Mid-payment Hold aborts card/MFS stubs and does not ingest / Sale Completed. **No** cloud hold / multi-terminal shared holds. See `MILESTONE_3_EXECUTION.md` Slice 6 + `Completed_API_lists.md` §18.
10. **Deferred — Owner/Manager terminal presence:** Owner/Manager should see each cashier/terminal **online (green) / offline (red)** in real time. Needs cloud heartbeat/presence from desktop + owner/manager UI (likely **M6 owner web** or a later authorized slice). Do not invent presence APIs until authorized.
11. **Deferred ? catalog onboarding (CSV / Excel import):** Real pharmacies onboard hundreds?thousands of SKUs from supplier/Excel lists. Owner/manager bulk import into Neon is the expected path; **not designed or built yet**. Today: seed demo + product/batch APIs only. Do not invent import UI/API until authorized.
12. **Deferred ? goods receiving / stock adjust UX:** Day-to-day FEFO depends on **new lots** (batch #, expiry, qty) after the initial load. Batch CRUD exists on the API; there is **no receiving / GRN / purchase / stock-adjust POS or owner UI** yet. Without that, catalog + FEFO go stale after first seed/import.
13. **Product catalog display fields (locked):** `manufacturer`, `strength`, `form` are optional on `Product` (schema + Zod + seed + desktop cache). Search UI shows them; free-text `q` also matches these fields. Do not invent from `description`.
14. **Pilot scale ? catalog cache pull:** Desktop `catalogPull` is thin (`limit=100` products/batches). Fine for demo seed; **thousands of SKUs need paged / full sync** before a real pilot. Local SQLite stays a lean cache (not a second master DB); Neon remains source of truth.
15. **Physical FEFO is ops, not GPS:** App recommends batch # + expiry; cashiers match packs on the shelf. Shelf discipline (older expiry in front) is training/process ? do not invent bin/location features unless authorized.
16. **Search FEFO vs expired (locked):** Search card shows earliest **sellable** FEFO lot (not an expired lot ?in front?). Expired lots stay visible in **Select Batch** detail and are not confirmable. Product row is EXPIRED/blocked only when **no** sellable stock remains. Cloud FEFO helper may still return earliest in-stock (including expired) ? see `Completed_API_lists.md` ?8.5.
17. **Search card UX:** Denser catalog cards (teal PharmaSync, not purple mocks). Unit chips on search are **display-only**; sale flow stays Search ? Select Batch ? Quantity & Packaging.
18. **Active Cart UX (Batch K lock — Figma override):** **Do not revert** to older / later Figma that shows a narrow right cart or stacked line cards. Keep **live app layout**: search ~**40%** / Active Cart ~**60%** (flex). Dense **table** (Item · Unit · Batch · Expiry · Qty stepper · Unit price · Disc. · Total · Edit). Remove via **Del** → **Remove Item Confirm** (safe default Keep Item). Clear sale + Esc Cancel sale use the same reusable `ConfirmDialog`. **F8 Select Customer** (Batch R / AF): no Baki; **Create Customer removed from POS** (Owner web later; POST OWNER-only). Ignore purple accents from denser mocks; keep teal chrome. On conflict: **status + this lock > Figma**.
19. **POS keyboard — no Tab navigator (locked 2026-08-11):** **`Tab` is never used** to switch modal actions or lists — **ignore Figma `Tab` Navigate** hints. Use **`←` `→`** (or `↑` `↓` on CTAs / lists as already mapped). Enter activates focused · Esc dismisses. Applies to ConfirmDialog, Redeem Loyalty, OTP verify, Payment, Card, MFS, and all later POS modals unless the user re-locks.
20. **MFS real integration (locked intent 2026-08-12):** Slice 4 invented confirm (cashier mobile + optional Trx) is **temporary**. Real MFS = **backend** talks to provider → confirms txn → desktop shows **real status only**. Cashier must **not** manually enter/confirm Trx IDs. Tracked as `TODO(real MFS APIs)` — do not build until authorized.
21. Expect further schema/API/DTO corrections as design and requirements evolve — update this file when they land.
22. Localization: bn-BD + en UI infrastructure complete. bn-BD is default.
All future desktop UI must use the existing typed i18n system; no hard-coded
user-facing strings. Runtime/domain data and receipt content remain untranslated.



---

## 13. Change log for this status document

| Date | Change |
|------|--------|
| 2026-08-08 | Created after M0 + M1 completion; M2 is next pending milestone |
| 2026-08-08 | Linked `MILESTONE_2_EXECUTION.md`; recorded M2 locked decisions (fields, envelope, staff, FEFO, Super Admin out of scope) |
| 2026-08-09 | **M2 marked DONE** ? Batches A?H complete; smoke 13/13; documented API surface, refresh tokens, next = M3 |
| 2026-08-09 | **M3 Batch A DONE** ? `@r2a/desktop` Tauri 2 + Vite + React + Tailwind hello shell; `@r2a/ui` bootstrap; next = Batch B |
| 2026-08-09 | **M3 Batch B DONE** ? design tokens + AppShell chrome (Search Results - Napa); next = Batch C login |
| 2026-08-09 | **M3 Batch C DONE** ? invented login + session (M2 auth/refresh/me); localStorage tokens; Logout wired; next = Batch D connectivity |
| 2026-08-09 | **M3 Batch D DONE** ? connectivity badge + health probe + online/offline mode; pending stub 0; next = Batch E SQLite |
| 2026-08-09 | Deferred notes: Force Offline override + Owner/Manager presence; Batch D Strict Mode probe fix + Checking? badge |
| 2026-08-09 | **M3 Batch E DONE** ? pos_local.db (rusqlite) + lean catalog/queue; online cache pull; pending count; `smoke:m3e`; next = Batch F |
| 2026-08-09 | **M3 Batch F DONE** ? Counter Ready idle (CTA + summary cards); F2 ? Empty POS placeholder; chrome = Search Results - Napa; next = Batch G |
| 2026-08-09 | **M3 Batch G DONE** ? Empty POS New Sale (search + empty prompt + Cancel Sale); EmptyCartBody; Ctrl+K focus; Esc ? Counter Ready; Proceed/F10 blocked; next = Batch H |
| 2026-08-09 | **M3 Batch H DONE** ? Search Results (online M2 / offline cache); FEFO + expired rows; ?? Enter; Select Batch stub; catalogPull list envelope fix; next = Batch I |
| 2026-08-09 | **M3 Batch I DONE** ? Select Batch modal (FEFO recommended + expired blocked); ?? Enter; Qty stub; next = Batch J |
| 2026-08-11 | Seed: Napa has 4 Select Batch demo lots (FEFO + standard + expired); retired old `NP-2408-A` qty?0 |
| 2026-08-11 | Search FEFO lock: sellable lot on card (`NP23091`); expired only in Select Batch detail; docs + `Completed_API_lists.md` ?8.5 |
| 2026-08-09 | ?12 notes: CSV/Excel catalog onboarding; receiving/stock-adjust UX; manufacturer field decision; paged catalog pull for pilot scale; physical FEFO = ops |
| 2026-08-11 | Product `manufacturer` / `strength` / `form` added (migration + seed + cache); search cards remade (teal denser layout); ?12 manufacturer decision closed |
| 2026-08-11 | **M3 Batch K DONE** ? Active Cart table (~40/60); Edit + Del remove; Clear/Cancel ConfirmDialog; Proceed toast; no payment/ingest; next = Batch L |
| 2026-08-11 | ?12 Active Cart lock strengthened: Figma override ? keep ~40/60 + table; do not shrink to older/later narrow-cart mocks |
| 2026-08-11 | **M3 Batch M DONE** ? Edit Sale Item modal; Active Cart Edit wired; Change Batch stub; chrome lock held; next = Batch N |
| 2026-08-11 | **M3 Batch N DONE** ? Change Batch edit flow + Manual FEFO Override; Request Authorization stub; chrome lock held; next = Batch O |
| 2026-08-11 | **M3 Batch O DONE** ? Manager Authorization stub (any 4-digit PIN + Authorized By); stages override for P; real auth TODO; chrome lock held; next = Batch P |
| 2026-08-11 | **M3 Batch P DONE** ? Override Authorized Edit banner/badge/audit; cart Override badge + toast; `fefoOverride` on cart line; chrome lock held; next = Batch Q |
| 2026-08-11 | **M3 Batch Q DONE** ? Remove Item Confirm (reusable ConfirmDialog); Clear/Cancel migrated; Del ? confirm; Keep Item default focus; chrome lock held; next = Batch R |
| 2026-08-11 | **M3 Batch R DONE** ? Select Customer F8 (M2 search; no Baki; Create stub toast; walk-in); seed Karim 120 pts; chrome lock held; next = Batch S |
| 2026-08-11 | **M3 Batch S DONE** ? Redeem Loyalty + OTP stub; Continue without = right primary; any 6-digit OTP; cart Loyalty; Slice 3 / Batch T gates; chrome lock held; next = Batch T |
| 2026-08-11 | **Keyboard lock:** Tab never a POS navigator (ignore Figma); modal CTAs use ?/?; ConfirmDialog + Redeem/OTP updated; ?12 note #19 |
| 2026-08-11 | **M3 Batch T DONE** ? Complete Sale zero-pay (no Baki) + Sale Completed; loyaltyCalc; ingest CASH ?0 + loyalty?discount; teal pill toasts; Print stub; chrome lock held; next = Batch U |
| 2026-08-11 | **M3 Batch V DONE** ? Payment Select Method; Continue without / F10 due>0 ? picker; Cash ? W gate; Card/MFS toast; walk-in hides points; ?? no Tab; chrome lock held; next = Batch W |
| 2026-08-11 | **M3 Batch W DONE** ? Cash Payment Empty + With Change; Exact Amount; Complete when received ? due; Back to Methods; settlement draft for X (no ingest); Card/MFS gated; chrome lock held; next = Batch X |
| 2026-08-11 | **M3 Batch X DONE** ? Shared Sale Completed shell + cash settlement; Cash ? ingest CASH=due; walk-in hides loyalty; Print stub until Y; Card/MFS gated; chrome lock held; next = Batch Y |
| 2026-08-11 | **M3 Batch Y DONE** — Print stub states (printing / printed / failed / retrying); auto-start; SYSTEM BUSY footer; 58mm sample + real IPC TODO; Card/MFS gated; chrome lock held; next = Batch Z |
| 2026-08-11 | **M3 Batch Z DONE** — Slice 3 exit; `Completed_API_lists.md` §15; `smoke:m3z` |
| 2026-08-12 | **M3 Slice 4 AA–AE DONE** — Receipt Preview; Card stub + CARD ingest; MFS invent + MFS ingest; §16 + `smoke:m3ae`; next = Slice 5+ when screens shared |
| 2026-08-12 | Status/master plan synced to Slice 4 exit; MFS real-API intent locked (§12 #20: backend confirms; no cashier Trx) |
| 2026-08-12 | **M3 Batch AH DONE** — Settings Pharmacy / Receipt Header; localStorage persist; Owner/Manager edit, Cashier view-only; Receipt Preview uses saved header (stub fallback); next = AI+ |
| 2026-08-12 | **M3 Batch AI DONE** — Force Offline / Stay Offline; badge menu + Settings Connectivity; sticky localStorage; probes ignored while forced; Go Online clears + re-probes; next = AJ+ |
| 2026-08-12 | **M3 Batch AK DONE** — Transactions Detail + Reprint; items/totals/method/customer/loyalty; Receipt Preview reuse; print stub; Esc/Back → list; next = AL |
| 2026-08-12 | **M3 Batch AL DONE** — Shift Open/Close invent; Counter Ready Active Shift; Slice 5 exit; `Completed_API_lists.md` §17; `smoke:m3al` |
| 2026-08-13 | **Shift soft gate:** New Sale [F2] requires open shift (toast + Shift panel); connectivity badge unchanged; status + master plan synced through Slice 5 |
| 2026-08-13 | **M3 Slice 6 planned** — Hold / Park Sale (AM–AP); max 3 soft holds; see `MILESTONE_3_EXECUTION.md`; next = authorize AM |
| 2026-08-13 | **M3 Batch AM DONE** — `heldSaleStore` + `HeldSaleSnapshot`; max 3 soft holds; localStorage; no Hold UI / F6; next = authorize AN |
| 2026-08-13 | **M3 Batch AN DONE** — Hold F6 + Held Sales list (resume/discard); empty New Sale after park; stub recheck toast; next = authorize AO |
| 2026-08-13 | **M3 Batch AO DONE** — soft resume recheck (strip/clamp); Hold aborts card/MFS stubs + epoch-guards ingest; next = authorize AP |
| 2026-08-13 | **M3 Batch AP DONE** — Slice 6 exit; `Completed_API_lists.md` §18; `smoke:m3ap`; **F7** Held list toggle; status + master plan synced |
| 2026-08-13 | **M3 FULL EXIT** — user all-screens-done; POS shell closed; later finds → Slice 7+; next = authorize M4 |
| 2026-08-13 | **M4 Batch A DONE** — `outbound_sync_queue` retry/dead columns + IPC + memory parity; `smoke:m4a`; next = authorize Batch B |
| 2026-08-13 | **M4 Batch B DONE** — `POST /api/v1/sync/ingest` reuses `ingestSale`; per-event accepted/duplicate/rejected; `smoke:m4b` 13/13; `smoke:m2` still 13/13; next = authorize Batch C |
| 2026-08-13 | **M4 Batch C DONE** — offline/Force Offline complete → queue + local stock delta + same Sale Completed; `smoke:m4c`; next = authorize Batch D |
| 2026-08-13 | **M4 Batch D DONE** — 15s TS flush worker + badge pending/syncing/error; pause on Force Offline; `smoke:m4d`; next = authorize Batch E |

