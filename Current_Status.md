# R2A Pharmacy POS — Current Status

**Last updated:** 2026-08-20
**Purpose:** Single place to understand where the project stands when you return. Read this first in a new chat, then open the linked source-of-truth docs as needed.  
**Maintainer note:** Update this file at the end of every completed milestone (or significant mid-milestone change).

---

## 1. One-glance summary

| Item | Status |
|------|--------|
| **Product** | Offline-first, multi-tenant Pharmacy POS + Inventory SaaS (Bangladesh / emerging markets) |
| **Phase** | Phase 1 MVP — DB + cloud API + desktop **M3 POS shell DONE**; **M4 DONE** (one-way sync). **M5 DONE** (RBAC + Receive stock + 409 copy + paged catalog + runbook) |
| **Latest completed milestone** | **M5 — MVP hardening**; **M6 Owner Web Slice 1 A–O + W1–W6 DONE** and **Slice 2 P–AB DONE** (AC–AD **deferred**) while M6 remains in progress |
| **Next gated work** | Authorize **M6 Batch AL** (POS Create Customer — invent). Do not start Batch AL+ without explicit authorization. Do not start deferred Slice 2 AC/AD. |
| **Cloud database** | Neon PostgreSQL (Prisma migrate + seed applied; `RefreshToken` migration applied in M2) |
| **Cloud API** | Express + TypeScript in `apps/server` — **real** (auth, tenant guard, inventory, FEFO, sales/sync ingest, sales/owner reads, product/batch management, OWNER-only suppliers, purchase orders, confirmed GRNs, and return manifests). General batch PATCH no longer mutates quantity. |
| **Local desktop / SQLite / Tauri** | POS shell + one-way sync + Owner/Manager Receive Stock. Manual stock corrections are online-only signed deltas with required reason, expected version, idempotent event ID, 409 reload, and authoritative catalog refresh. |
| **MongoDB / Mongoose** | Removed; do not reintroduce |

**Bottom line:** M0–M5 remain DONE. **M6 IN PROGRESS** — Slice 1 **A–O DONE** + W1–W6 **DONE**. Slice 2 **P–AB DONE**, **AC–AD deferred**. Slice 3 **AE–AK DONE**, **AL–AM planned**. Next = **Authorize M6 Batch AL** (POS Create Customer).
---

## 2. Milestone board (authoritative progress)

Source of truth for milestone status: [`PROJECT_MASTER_PLAN.md`](PROJECT_MASTER_PLAN.md) (update there when authorizing status changes). This file reflects live completion as of the date above.

| ID | Milestone | Status | What it means right now |
|----|-----------|--------|-------------------------|
| **M0** | Workspace hygiene | **DONE** | Turborepo monorepo, gitignore, docs relocated, old Mongo backend deleted |
| **M1** | Database foundation | **DONE** | Prisma schema, indexes, Neon migration, seed, `@r2a/shared-types` Zod |
| **M2** | Cloud API core | **DONE** | Express TS, JWT + refresh, tenant guard, inventory CRUD, FEFO, sales ingest |
| **M3** | Desktop POS shell | **DONE** | Slice 1–6 (A–AP). Later screens → Slice 7+ when authorized. See `MILESTONE_3_EXECUTION.md` |
| **M4** | One-way sync | **DONE** | Batches A–F. Queue IPC + `/sync/ingest` + offline complete + 15s worker + Sync Queue panel + catalog §19. See `MILESTONE_4_EXECUTION.md` |
| **M5** | MVP hardening | **DONE** | Batches A–F. RBAC API + desktop Settings Receive stock + Sync Queue 409 copy + paged catalog pull + runbook + catalog §20. Print/PIN stay stubs. See `MILESTONE_5_EXECUTION.md`. |
| **M6** | Growth (Phase 2) | **IN PROGRESS** | Owner Web Slice 1 **A–O DONE** + W1–W6 **DONE**. Slice 2 **P–AB DONE**; **AC–AD deferred**. Slice 3 **AE–AK DONE**; **AL–AM planned**. |
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

### Milestone 4 execution batches (all green)

Detailed batch plan: [`MILESTONE_4_EXECUTION.md`](MILESTONE_4_EXECUTION.md).

| Batch | Title | Status | Date |
|-------|-------|--------|------|
| A | Queue schema + IPC + memory parity | **DONE** | 2026-08-13 |
| B | Cloud `POST /api/v1/sync/ingest` | **DONE** | 2026-08-13 |
| C | Offline complete → queue | **DONE** | 2026-08-13 |
| D | 15s flush worker + badge | **DONE** | 2026-08-13 |
| E | Sync Queue panel + i18n | **DONE** | 2026-08-14 |
| F | M4 exit + API catalog §19 | **DONE** | 2026-08-14 |

### Milestone 5 execution batches (all green)

Detailed batch plan: [`MILESTONE_5_EXECUTION.md`](MILESTONE_5_EXECUTION.md).

| Batch | Title | Status | Date |
|-------|-------|--------|------|
| A | RBAC API + docs lock | **DONE** | 2026-08-14 |
| B | Desktop RBAC shell | **DONE** | 2026-08-14 |
| C | Receive stock UI | **DONE** | 2026-08-14 |
| D | 409 conflict UX | **DONE** | 2026-08-14 |
| E | Paged catalog pull | **DONE** | 2026-08-14 |
| F | Runbook + M5 exit | **DONE** | 2026-08-14 |

**M5 exit (verified):** Owner/Manager receive stock on desktop; cashier sells online/offline with FEFO; cloud holds sales via ingest/sync; print/PIN stubs; `smoke:m5`. Owner UI = M6 Slice 1 (login + chrome + live Dashboard + live Sales list + live Transaction Details + live Inventory list + live Product Details).

### Milestone 6 execution batches (Slice 1)

Detailed batch plan: [`MILESTONE_6_EXECUTION.md`](MILESTONE_6_EXECUTION.md).

| Batch | Title | Status | Date |
|-------|-------|--------|------|
| A | Web scaffold + OWNER session | **DONE** | 2026-08-15 |
| B | Owner chrome lock | **DONE** | 2026-08-15 |
| C | Prisma + shared-types | **DONE** | 2026-08-15 |
| D | Ingest + POS wire-up | **DONE** | 2026-08-15 |
| E | `GET /sales` + `GET /sales/:id` | **DONE** | 2026-08-15 |
| F | Owner dashboard / summary / expiry APIs | **DONE** | 2026-08-16 |
| G | Dashboard screen | **DONE** | 2026-08-16 |
| H | Sales list | **DONE** | 2026-08-16 |
| I | Transaction Details | **DONE** | 2026-08-16 |
| J | Inventory list | **DONE** | 2026-08-16 |
| K | Product Details | **DONE** | 2026-08-16 |
| L | Add Product | **DONE** | 2026-08-16 |
| M | Receive Stock | **DONE** | 2026-08-16 |
| N | Expiry Management | **DONE** | 2026-08-18 |
| O | Slice 1 exit | **DONE** | 2026-08-18 |

### Milestone 6 execution batches (Slice 2)

Detailed batch plan: [`MILESTONE_6_EXECUTION.md`](MILESTONE_6_EXECUTION.md) (Slice 2 section). **Paused at P–AB. AC–AD deferred.**

| Batch | Title | Status | Date |
|-------|-------|--------|------|
| P | Prisma + Zod (Supplier, PO, GRN, Manifest) | **DONE** | 2026-08-18 |
| Q | Supplier + Purchase Order APIs | **DONE** | 2026-08-18 |
| R | GRN + Return APIs | **DONE** | 2026-08-18 |
| S | Enable Purchasing + Suppliers nav | **DONE** | 2026-08-18 |
| T | Purchasing list | **DONE** | 2026-08-18 |
| U | Create Purchase Order | **DONE** | 2026-08-18 |
| V | Purchase Order Details | **DONE** | 2026-08-19 |
| W | Receive Stock against PO | **DONE** | 2026-08-19 |
| X | Suppliers list | **DONE** | 2026-08-19 |
| Y | Add Supplier | **DONE** | 2026-08-19 |
| Z | Supplier Details | **DONE** | 2026-08-19 |
| AA | Expiry Returns queue | **DONE** | 2026-08-19 |
| AB | Create Return Manifest page | **DONE** | 2026-08-19 |
| AC | Manifest Details + 3 modals | **DEFERRED** | — |
| AD | Slice 2 exit | **DEFERRED** | — |

### Milestone 6 execution batches (Slice 3)

Detailed batch plan: [`MILESTONE_6_EXECUTION.md`](MILESTONE_6_EXECUTION.md) (Slice 3 section). **AE–AK DONE.**

| Batch | Title | Status | Date |
|-------|-------|--------|------|
| AE | Prisma + Zod (Customer status/source/profile) | **DONE** | 2026-08-19 |
| AF | Customer APIs + ingest Active guard | **DONE** | 2026-08-20 |
| AG | Enable Customers nav | **DONE** | 2026-08-20 |
| AH | Customers list | **DONE** | 2026-08-20 |
| AI | Add Customer + create confirm | **DONE** | 2026-08-20 |
| AJ | Customer Details | **DONE** | 2026-08-20 |
| AK | Registration Review + Approve/Reject modals | **DONE** | 2026-08-20 |
| AL | POS Create Customer | **NOT STARTED** | — |
| AM | Slice 3 exit | **NOT STARTED** | — |

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
│   ├── server/          # REAL — Milestone 2 Express API + M6 extended products
│   ├── desktop/         # REAL — M3 POS shell DONE (A–AP; Hold F6 / Held list F7)
│   └── web/             # REAL — M6 Owner Web Slice 1 A–O DONE
├── packages/
│   ├── database/        # REAL — Prisma schema, migrations, seed, client export
│   ├── shared-types/    # REAL — Zod auth/product/batch/customer/sale/sync + enums
│   └── ui/              # REAL bootstrap — ShellPlaceholder (M3 Batch A); Shadcn later
├── docs/                # Specs (handover, PRD, architecture, UX) + DEV_RUNBOOK.md
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
| Web | `@r2a/web` | **M6 Slice 1 DONE + Slice 2 Batch T–AB** — OWNER login/chrome, Dashboard, Sales, Inventory, product and batch management, Receive Stock, Expiry Management, Purchasing list, Create Purchase Order, Purchase Order Details, Receive Stock against PO, Suppliers directory, Expiry Returns queue, Create Return Manifest. **Slice 3 AE–AK DONE** (Customer schema + Zod + role-aware APIs + enabled Customers nav + live Customers directory + Add Customer + Customer Details + Registration Review with Approve/Reject); AL–AM planned. Manifest Details deferred. |

---

## 5. What Milestone 1 delivered (detail)

### 5.1 Prisma schema (`packages/database/prisma/schema.prisma`)

**Enums**

- `Role`: `SUPER_ADMIN`, `OWNER`, `MANAGER`, `CASHIER`
- `UnitType`: `BOX`, `STRIP`, `PIECE`
- `PaymentMethod`: `CASH`, `CARD`, `MFS`
- `InventoryEventType`: `RECEIVE`, `ADJUST`, `SALE` (**M6 Batch C**)
- `SupplierStatus`: `ACTIVE`, `HOLD`, `DRAFT` (**M6 Batch P**)
- `PurchaseOrderStatus`: `DRAFT`, `SENT`, `PARTIALLY_RECEIVED`, `RECEIVED` (**M6 Batch P**)
- `GoodsReceiptStatus`: `CONFIRMED` (**M6 Batch P**)
- `ReturnManifestStatus`: `PREPARED`, `DISPATCHED`, `ACCEPTED`, `REJECTED`, `COMPLETED` (**M6 Batch P**)
- `CustomerStatus`: `ACTIVE`, `PENDING_APPROVAL`, `INACTIVE`, `REJECTED` (**M6 Batch AE**)
- `CustomerSource`: `OWNER_CREATED`, `POS_REGISTRATION` (**M6 Batch AE**)
- `CustomerGender`: `MALE`, `FEMALE`, `OTHER` (**M6 Batch AE**)

**Models**

| Model | Role in domain |
|-------|----------------|
| `Tenant` | Multi-tenant root |
| `Store` | Store under tenant (MVP: single-store ops enough) |
| `User` | Auth identity; `passwordHash`; optional `storeId` |
| `RefreshToken` | Opaque refresh tokens (SHA-256 hash only); rotate on use (**added M2**) |
| `Product` | Catalog; searchable `name`, `genericName`, `manufacturer`, `strength`, `form`, `sku`, `barcode`; **M6 C:** optional `category`, `requiresPrescription`, `coldChain`, `storageNotes`, `reorderLevel` |
| `ProductUnit` | Conversion factors to base unit (`factorToBase`) |
| `Batch` | FEFO-ready lot: expiry, qty in base units, cost/sell per base |
| `Customer` | Required phone; `status` / `source`; optional DOB/gender/address/store/createdBy; approval audit. Partial unique on non-rejected `(tenantId, phone)` (**M6 AE**). Keep unused `creditBalance`. |
| `Sale` | Immutable header; unique `eventId` for sync idempotency; **M6 D:** `receiptNo` (`@@unique([tenantId, receiptNo])`), loyalty snapshot ints |
| `SaleItem` | Line items tied to product + batch + unit; **M6 D:** `fefoOverride`, `fefoAuthorizedByName`, `costPerBaseAtSale` (server-filled) |
| `Payment` | Cash / Card / MFS lines on a sale |
| `InventoryEvent` | Append-only stock ledger — SALE on ingest, RECEIVE on `POST /batches`, ADJUST on signed `/batches/:id/adjustments` and lifecycle compensation |
| `Supplier` | Tenant supplier profile, purchasing terms, and expiry-return policy (**M6 Q API live**) |
| `PurchaseOrder`, `PurchaseOrderLine` | Tenant/store PO header and PIECE-quantity cost snapshots; no inventory effect (**M6 Q API live**) |
| `GoodsReceipt`, `GoodsReceiptLine` | Confirmed PO receipts linked to created batches (**M6 R API live**) |
| `ReturnManifest`, `ReturnManifestLine` | Supplier return lifecycle and batch cost snapshots (**M6 R API live**) |

**Important behaviors encoded in schema**

- Every domain table has `tenantId` (FK to `Tenant` where modeled).
- Sales / sale items / payments have **no `updatedAt`** (append-only intent).
- Sync approach chosen: **global unique `Sale.eventId`** (not a separate SyncEvent table).

### 5.2 Migration

- Path: `packages/database/prisma/migrations/20260808144500_init/`
- M2 add-on: `packages/database/prisma/migrations/20260808183000_refresh_tokens/`
- Catalog fields: `packages/database/prisma/migrations/20260811013000_product_catalog_fields/` (`manufacturer`, `strength`, `form`)
- **M6 Batch C:** `packages/database/prisma/migrations/20260815160000_m6_batch_c_schema/` (`receiptNo`, loyalty snapshots, FEFO/cost-at-sale, product extras, `InventoryEvent`)
- **M6 Batch P:** `packages/database/prisma/migrations/20260818190000_m6_batch_p_purchasing_returns/` (Supplier/PO/GRN/manifest models + optional `Batch.supplierId`)
- **M6 Batch AE:** `packages/database/prisma/migrations/20260819061500_m6_batch_ae_customer_registration/` (Customer status/source/profile + partial unique phone)
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
| Products | 5 BD-familiar OTCs with manufacturer / strength / form (e.g. Napa 500mg ? Beximco ? Tablet). **M6 C:** Napa `reorderLevel=50` only |
| Per product | Unit rows (Box/Strip/Piece as applicable) + batches |
| Napa lots | **4 demo lots** for Select Batch / FEFO UX (see table below). Re-seed zeros retired `NP-2408-A` |
| Customer | Karim Ahmed, phone `01700000000`, **120** loyalty pts (eligible redeem) — `ACTIVE` / `OWNER_CREATED` |
| Customer | Nusrat Jahan, phone `01811000000`, **25** loyalty pts (below 50 ? Not Eligible UI) — `ACTIVE` / `OWNER_CREATED` |
| Customer | Farhan Kabir, phone `01911000000`, **0** pts — `PENDING_APPROVAL` / `POS_REGISTRATION` (cashier actor; Slice 3 Review walkthrough) |
| Supplier | **3 ACTIVE** suppliers (names match `Batch.supplierName` demo values for future GRN consistency): Beximco Distribution Ltd. (01712000001), Square Distribution Ltd. (01712000002), SMC Distribution (01712000003). Upsert by `tenantId_name`. **M6 Batch U:** powers the Create PO supplier dropdown (GET suppliers `?isActive=true`) |

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
| `enums.ts` | Role, UnitType, PaymentMethod, **InventoryEventType**, purchasing enums, **CustomerStatus / CustomerSource / CustomerGender (M6 AE)** |
| `auth.ts` | login / register / staff create / refresh / JWT claims / safe user |
| `product.ts` | create / update / search + unit inputs + id params; **M6 C:** `category`, Rx, cold chain, storage, `reorderLevel` |
| `batch.ts` | create / update / list (M2) |
| `customer.ts` | create (required phone + optional profile extras) / update / search; **M6 AE:** owner list/approve/reject + phone-check stubs (unused until AF) |
| `sale.ts` | sale ingest; **`batchId` optional** for server FEFO fill; **M6 D:** optional `loyaltyUsed` / `loyaltyEarned` + line `fefoOverride` (persisted); `saleListQuerySchema` + **AE `customerId` stub** (filter in AF) |
| `owner.ts` | **M6 F:** owner dashboard / expiry query DTOs (wired on `GET /owner/*`) |
| `purchasing.ts` | **M6 P:** Supplier, PO, GRN, return queue/manifest create and lifecycle DTOs (routes begin in Q/R) |
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
| Batches | ACTIVE POS list; metadata/price PATCH; audited/versioned correction; signed adjustment; Owner-only void/retire; fields `expiryDate`, `quantityOnHand`, `costPerBase`, `sellPerBase`, `status`, `version` |
| Customers | CRUD/search by phone/name |
| FEFO | `GET /products/:productId/fefo-batch` (earliest in-stock; may be expired ? desktop search prefers sellable) |
| Substitutes | `GET /products/:productId/substitutes` (stock, sell, nearest expiry / expired) |
| Sales | `POST /sales/ingest` ? FEFO fill if `batchId` omitted; stock decrement txn; `eventId` idempotency |
| Margins | Cashiers never get `costPerBase`; may get `sellPerBase`; blocked from price mutations |

**Env strategy:** `@r2a/server` loads **repo-root `.env` only** (not `apps/server/.env`).

**Smoke:** `npm run smoke:m2 -w @r2a/server` (server must be running; default `http://localhost:8787`, or set `BASE_URL`). Last run **16/16 PASS** (2026-08-14, M5 Batch A cashier PATCH 403s) against seeded `owner@demo.local`.

### 6.2 Key API routes (all under `/api/v1` unless noted)

| Method | Path | Notes |
|--------|------|--------|
| GET | `/health`, `/api/v1/health` | Locked success envelope |
| POST | `/auth/register` \| `/login` \| `/refresh` \| `/logout` | Refresh tokens hashed in DB |
| GET | `/users/me` | Protected |
| POST | `/users` | OWNER/MANAGER only |
| * | `/products`, `/batches`, `/customers` | Tenant-scoped CRUD; **M5 A:** PATCH customers/batches = OWNER/MANAGER |
| GET | `/products/:productId/fefo-batch` | FEFO pick (cloud: earliest in-stock; see desktop sellable preference) |
| GET | `/products/:productId/substitutes` | Same `genericName` |
| POST | `/sales/ingest` | Online sale path only — **not** M4 `/sync/ingest` |
| GET | `/sales`, `/sales/:id` | **M6 E** — any authenticated; `:id` = `Sale.id`; Owner sees cost/COGS/netProfit; Manager/Cashier redacted |
| GET | `/owner/dashboard`, `/owner/inventory-summary`, `/owner/expiry` | **M6 F** — `OWNER` only (Manager/Cashier 403). Net profit = `sum(sale.total) − period COGS` |
| GET | `/owner/inventory` | **M6 J** — `OWNER` only paged inventory list (cost/sell/margin). Full catalog §21 at Slice 1 exit |
| GET | `/owner/products/:id` | **M6 K** — `OWNER` only product detail (lots, FEFO rank, units, InventoryEvents). Full catalog §21 at Slice 1 exit |
| GET | `/owner/batches/:id` | **W3** — `OWNER` only management context, sale references, revisions and adjustments |
| POST | `/batches/:id/corrections`, `/adjustments` | **W3/W6** — Owner/Manager; versioned + idempotent; adjustment is signed delta with reason |
| POST | `/batches/:id/void`, `/retire` | **W4** — Owner only; preserve row/history and remove remaining stock |
| GET/POST | `/owner/suppliers`, `/owner/purchase-orders` | **M6 Q** — `OWNER` only; paged list/create; PO create defaults `SENT` |
| GET/PATCH | `/owner/suppliers/:id`, `/owner/purchase-orders/:id` | **M6 Q** — `OWNER` only; no supplier delete; PO PATCH only while `DRAFT` |
| POST | `/owner/purchase-orders/:id/receipts` | **M6 R** — `OWNER` only; confirmed GRN, lots + RECEIVE events, PO progress |
| GET | `/owner/returns/queue` | **M6 R** — `OWNER` only; supplier-linked return candidates and status filters |
| POST/GET | `/owner/return-manifests`, `/owner/return-manifests/:id` | **M6 R** — `OWNER` only; prepare/get manifest |
| POST | `/owner/return-manifests/:id/dispatch`, `/decision`, `/complete` | **M6 R** — `OWNER` only; idempotent stock-out then lifecycle transitions |

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
- `smoke:m2`: health → seed login → cashier → search → FEFO → ingest → idempotent → margin RBAC + cashier PATCH 403s (**16/16**)

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
- ~~Cloud `POST /api/v1/sync/ingest` (M4 Batch B)~~ — **DONE** (`smoke:m4b`; reuses `ingestSale`; catalog §19)
- ~~Offline complete → queue (M4 Batch C)~~ — **DONE** (`smoke:m4c`; same Sale Completed; pending count; no 15s worker)
- ~~15s flush worker + badge (M4 Batch D)~~ — **DONE** (`smoke:m4d`; pause on Force Offline; `__r2aFlushSyncNow()`)
- ~~Sync Queue panel (M4 Batch E)~~ — **DONE** (`smoke:m4e`; badge + Settings Connectivity; Retry; no sidebar Sync)
- ~~M4 exit + API catalog §19 (M4 Batch F)~~ — **DONE** (`Completed_API_lists.md` §19; `smoke:m4`)
- ~~M5 Batch A RBAC PATCH (`customers` / `batches` OWNER+MANAGER)~~ — **DONE** (`smoke:m2` + `smoke:m5a`)
- ~~M5 Batch B desktop RBAC (Receive stock Owner/Manager only)~~ — **DONE** (`smoke:m5b`)
- ~~M5 Batch C Receive stock UI (POST/PATCH /batches)~~ — **DONE** (`smoke:m5c`)
- ~~M5 Batch D 409 Sync Queue copy~~ — **DONE** (`smoke:m5d`)
- ~~M5 Batch E paged catalog pull~~ — **DONE** (`smoke:m5e`)
- ~~M5 Batch F runbook + catalog §20 + M5 DONE~~ — **DONE** (`docs/DEV_RUNBOOK.md`; `smoke:m5`)
- ~~Owner Web Missing Features W1–W6~~ — **DONE** (data integrity, Edit Product, Batch Management APIs/UI, lifecycle, desktop signed adjustment; `WEB_MISSING_FEATURES_PLAN.md`)
- ~~M6 Batch T: Purchasing list~~ — **DONE** (live Purchasing dashboard; Create PO → `/purchasing/new`; `smoke:m6t`)
- ~~M6 Batch U: Create Purchase Order~~ — **DONE** (supplier dropdown from GET suppliers ACTIVE; Save as Draft / Create SENT / Cancel; no inventory effect; `smoke:m6u`)
- ~~M6 Batch V: Purchase Order Details~~ — **DONE** (live PO detail; header/KPIs/receiving progress/line received-remaining/GRN history; Export/Print/More disabled; Receive Stock → `/purchasing/:poId/receive`; `smoke:m6v`)
- ~~M6 Batch W: Receive Stock against PO~~ — **DONE** (live `/purchasing/:poId/receive`; Receipt Details + Received Items + Add Batch lots + Receipt Summary + Inventory Impact; Confirm → `POST /owner/purchase-orders/:poId/receipts`; Save as Draft disabled; `smoke:m6w`)
- ~~M6 Batch X: Suppliers list~~ — **DONE** (live `/suppliers` directory; 4 KPI cards + search/status filter + pagination + 194px attention rail; Expiry Returns → `/suppliers/returns`, Add Supplier → `/suppliers/new`; Review All Issues disabled; `GET /owner/suppliers` now returns per-item `stats` + `kpis` + `attention`; `smoke:m6x`)
- ~~M6 Batch Y: Add Supplier~~ — **DONE** (live Add Supplier form at `/suppliers/new` posting to `POST /owner/suppliers`; all `supplierCreateSchema` fields + setup summary rail; suppliers always created ACTIVE — Save as Draft disabled, no Edit route; unsaved-changes guard; create → `/suppliers/:supplierId` (Details — Batch Z); `suppliers.add.*` i18n en + bn-BD; `smoke:m6y`, `smoke:m6x` updated)
- ~~M6 Batch Z: Supplier Details~~ — **DONE** (live Supplier Details at `/suppliers/:supplierId`; header name + status badge + contact + Expiry Returns + Create Purchase Order; honest KPI row — Purchases 12 Months, Avg. Delivery Time, Expiry Return Rate, Active Products — computed from live data, zeros/— when none (no invented ৳2,480,000/94%/1.8%/2.4 days); Supplier Information 2-col grid + Performance card (on-time, short supply, expiry accepted, avg credit note time); Purchase Orders table → `/purchasing/:poId`; Products Supplied table from batches + PO lines with live stock; View All POs / View All Products disabled (Purchasing/Inventory cannot filter by supplier yet); `GET /owner/suppliers/:supplierId` additively returns `detail` (kpis/performance/purchaseOrders/products); superseded `suppliers.placeholder.detail*` removed; `suppliers.detail.*` i18n en + bn-BD; `smoke:m6z`, `smoke:m6x` updated)
- ~~M6 Batch AA: Expiry Returns queue~~ — **DONE** (live `/suppliers/returns`; 4 KPI cards + search/supplier/status filters + Eligible-only selection + mixed-supplier lock; Create Return Manifest → `/suppliers/returns/new` without building that layout; Inventory Prepare Supplier Return enabled; Export/Print disabled; `GET /owner/returns/queue` additive kpis + suppliers; `smoke:m6aa`)
- ~~M6 Batch AB: Create Return Manifest page~~ — **DONE** (live `/suppliers/returns/new`; reviews queue draft + supplier policy + editable return qty; `POST /owner/return-manifests`; Save as Draft disabled; no stock movement; `smoke:m6ab`)
- ~~M6 Batch AE: Prisma + Zod Customer status/source/profile~~ — **DONE** (partial unique phone; seed pending POS demo; `POST /customers` still OWNER-only)
- ~~M6 Batch AF: Customer APIs + ingest Active guard~~ — **DONE** (`smoke:m6af` 14/14)
- ~~M6 Batch AG: Enable Customers nav~~ — **DONE** (`smoke:m6ag` 5/5)
- ~~M6 Batch AH: Customers list~~ — **DONE** (live `/customers` directory from `GET /owner/customers`; KPIs/tabs/search/Status/Source/Sort/pagination; Pending → review, Active/Inactive → detail, Add → `/customers/new`; `smoke:m6ah`)
- ~~M6 Batch AJ: Customer Details~~ — **DONE** (live `/customers/:customerId` from `GET /owner/customers/:id`; header + KPIs (loyalty / total purchases / visits / last purchase) + Customer Information + Registration Information (Source/Branch/Submitted/Approved + Original Registration Values) + Purchase History rows → `/sales/:id` + Loyalty Activity with running balance + known-facts Timeline; Edit Customer + More Actions disabled; pending id redirects to Review; honest zeros/—; `GET /owner/customers/:id` additively returns `storeName` / `lastPurchaseAt` / `purchaseHistory.rows` / `loyaltyActivity.rows`; `smoke:m6aj`)
- ~~M6 Batch AK: Registration Review + Approve/Reject~~ — **DONE** (live `/customers/:customerId/review` from `GET /owner/customers/:id`; read-only Registration Request (name/phone/source/submitted/branch/by) + live duplicate check + editable Review Profile (Owner corrects before approve); right rail Registration Info + Approval Action; Approve checkbox-gated modal → `POST /owner/customers/:id/approve` → Details (Active); Reject invented checkbox-gated modal + optional note → `POST /owner/customers/:id/reject` → list (row gone); Cancel → list; Active/Inactive id → Details; unsaved-changes guard; no POS Create (AL); `smoke:m6ak`)
- Manifest Details (Slice 2 AC) and Slice 2 exit (AD) — **deferred**
- Owner web Customers Review approve flow + POS cashier create — **Slice 3 AL–AM planned** (next = Authorize Batch AL)
- Manager web, bi-directional sync, n8n workflows, and Postgres RLS (later authorized M6 batches)
- Real Card terminal SDK / real MFS provider APIs (backend-confirmed status; no cashier manual Trx) — later authorized work
- Super Admin platform console (role exists; no admin product surface yet)

---

## 10. Next step when you resume

1. Read this file (`Current_Status.md`).
2. Confirm M0–**M5** are **DONE**.
3. **M6 Owner Web Slice 1 A–O + W1–W6 DONE. Slice 2 P–AB DONE (AC–AD deferred).** Slice 3 **AE–AK DONE.** Next = **Authorize M6 Batch AL** (POS Create Customer). Do not start AL+, deferred AC/AD, later M6, hardware, or Slice 7+ from status alone.
4. Attach/reference:
   - `PROJECT_MASTER_PLAN.md`
   - `Current_Status.md`
   - `ROLES_AND_PERMISSIONS.md`
   - `docs/DEV_RUNBOOK.md`
    - `Completed_API_lists.md` (§14–§21)
    - `WEB_MISSING_FEATURES_PLAN.md`
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
# M4: Force Offline → complete sale → Sync queue Pending → Go Online → flush ≤15s (`__r2aFlushSyncNow()`)
# W6: Owner/Manager Settings → Receive stock → Adjust stock uses signed +/- PIECE + required reason; online only; 409 reloads current values
# Exit smokes: npm run smoke:m5 -w @r2a/desktop  (composes m5a–m5e + smoke:m4; also smoke:m2 / smoke:m4b on the server)
# Runbook: docs/DEV_RUNBOOK.md
```

### Milestone 3 — delivered (closed 2026-08-13)

- Keyboard checkout **online**: Cash / Card stub / MFS invent → `POST /sales/ingest` + Sale Completed + Receipt Preview
- Hold **F6** / Held list **F7**; Shift soft gate; Force Offline; Transactions; F4; Settings header
- Local SQLite catalog cache + `outbound_sync_queue` **table** (flush = **M4 DONE**)
- **Later screens:** append Slice 7+ when shared — do not invent ahead
- **Still later (not M3/M4/M5):** real printer IPC · real card SDK · real MFS APIs · cloud sales list / cloud shift · Owner web Create Customer · Slice 7+

### Milestone 4 — delivered (closed 2026-08-14)

- Offline / Force Offline checkout → **same** Sale Completed + Receipt Preview; row in `outbound_sync_queue`
- 15s TypeScript worker → `POST /api/v1/sync/ingest` (reuses `ingestSale`; idempotent `eventId`; stock deltas)
- Dead-letter + Retry UI (Sync Queue panel from badge / Settings Connectivity; **no** sidebar Sync)
- Online path still `POST /sales/ingest` when connected and not forced

### Milestone 5 — delivered (closed 2026-08-14)

- Owner vs Cashier RBAC: `PATCH /customers/:id` and `PATCH /batches/:id` = OWNER+MANAGER (cashier 403, including qty)
- Owner/Manager **Settings → Receive stock** (online Add lot / Adjust qty); cashier omitted
- Failed Sync Queue: i18n 409/stock copy + raw `last_error`; Enter Retry; **no** void
- Paged `catalogPull` (`meta.total`, cap 50 pages); never cache `costPerBase`
- Print stub + FEFO PIN stub unchanged
- [`docs/DEV_RUNBOOK.md`](docs/DEV_RUNBOOK.md) + catalog **§20** + `smoke:m5`

Current W6 amendment: Adjust stock now uses signed `POST /batches/:id/adjustments` with `expectedVersion`, idempotent `eventId`, and required reason. The M5 absolute PATCH flow is historical; general PATCH is metadata/price only.

---

## 11. Key documents map

| Document | Use it for |
|----------|------------|
| [`Current_Status.md`](Current_Status.md) | “Where are we now?” (this file) |
| [`Completed_API_lists.md`](Completed_API_lists.md) | Full cloud API catalog (M2) + M3 desktop §§14–18 + **M4 §19** + **M5 §20** |
| [`PROJECT_MASTER_PLAN.md`](PROJECT_MASTER_PLAN.md) | Locked stack, milestones, DoD, agent rules |
| [`MILESTONE_1_EXECUTION.md`](MILESTONE_1_EXECUTION.md) | How M1 was batched and verified |
| [`MILESTONE_3_EXECUTION.md`](MILESTONE_3_EXECUTION.md) | How M3 slices/batches were executed (Slice 1–6 **DONE**; M3 closed) |
| [`MILESTONE_4_EXECUTION.md`](MILESTONE_4_EXECUTION.md) | How M4 batches A–F were executed (**DONE**) |
| [`MILESTONE_5_EXECUTION.md`](MILESTONE_5_EXECUTION.md) | How M5 batches A–F were executed (**DONE**) |
| [`WEB_MISSING_FEATURES_PLAN.md`](WEB_MISSING_FEATURES_PLAN.md) | Owner web missing-feature W1–W6 execution and exit (**DONE**) |
| [`ROLES_AND_PERMISSIONS.md`](ROLES_AND_PERMISSIONS.md) | Canonical RBAC (v2). Owner web = M6. No on-account tender |
| [`docs/DEV_RUNBOOK.md`](docs/DEV_RUNBOOK.md) | Local setup: env files, Neon or Postgres Docker, seed, smokes |
| [`docs/Project_Handover.md`](docs/Project_Handover.md) | Agent context / non-negotiable business rules |
| [`docs/Project_Requirement_Documents.md`](docs/Project_Requirement_Documents.md) | Product requirements |
| [`docs/System_Architecture_Technical_Specification.md`](docs/System_Architecture_Technical_Specification.md) | Architecture / tenancy / sync notes |
| [`docs/UX_Specification.md`](docs/UX_Specification.md) | POS UX / layout / shortcuts |

---

## 12. Open corrections / future design notes

Tracked so returning chats don?t re-learn tribal knowledge:

1. **Payments:** No Baki / on-account tender — only Cash, Card, MFS (schema + Zod + master-plan M5). `Customer.creditBalance` is unused leftover; do not surface.
2. **Customer `creditBalance`:** Still on the model as optional account credit storage; **not** a POS tender type. May be refined later with requirements.
3. **Prisma 7 warning:** `package.json#prisma` seed config is deprecated toward `prisma.config.ts` ? fine for now; migrate when upgrading Prisma major.
4. **Prisma Batch field names (locked):** `expiryDate`, `quantityOnHand`, `costPerBase`, `sellPerBase` ? never invent `expirationDate` / `quantityBase` aliases.
5. **API response envelope (locked):** success `{ status, message, data?, meta? }`; errors via `AppError` + global handler ? not `{ success: false, error: { code, message } }` unless re-authorized.
6. **Super Admin:** Enum/JWT role only for now; separate platform admin setup later (not this POS product surface).
7. **Refresh tokens (M2):** Hashed in `RefreshToken`; rotate on refresh; reuse of revoked token revokes all user sessions.
8. **Sale `batchId`:** Optional on ingest ? omitted ? server FEFO; provided ? validate tenant/store/stock.
9. **Force Offline / Stay Offline (desktop) — DONE Batch AI:** Cashier can override auto health on this terminal (badge menu or Settings → Connectivity). Sticky via forceOfflineStore (localStorage) until explicit **Go Online**; health probes / browser online / header re-probe ignored while forced. Badge shows Offline · Forced. Owner/Manager **presence** across terminals remains deferred (note #10).
9b. **Transactions List + Detail (desktop) — DONE Batch AJ–AK:** Sidebar Transactions opens invented list from local `transactionLogStore` (localStorage, tenant+store; append on Cash/Card/MFS/loyalty complete). Cloud `GET /sales` + `GET /sales/:id` are **live (M6 E)**; Owner web Sales list is **live (M6 H)**; Owner web Transaction Details is **live (M6 I)**; desktop list stays local. ↑/↓ · Enter detail · Esc. Detail shows items/totals/method/customer/loyalty + Receipt Preview; Reprint → print stub.
9c. **Shift Open/Close (desktop) — DONE Batch AL + soft gate (2026-08-13):** Local `shiftStore` (tenant+store). Counter Ready Active Shift reads it. Connectivity badge stays **independent** (health / Force Offline only — do **not** couple badge to shift). **Soft gate:** New Sale [F2] (sidebar / Counter Ready / Sale Completed) requires an open shift → otherwise info toast + opens Shift panel. Closing shift mid-sale still allowed. No cloud shift API yet (TODO when authorized).
9d. **Hold / Park Sale (desktop) — Slice 6 AP DONE:** `heldSaleStore` + Hold **F6** + Held list **F7** (toggle; cart Held n/3) + resume / discard confirm. Soft hold — no reservation. Resume rechecks live batch/expiry/qty (strip unsellable, clamp short stock; keep hold if none remain). Mid-payment Hold aborts card/MFS stubs and does not ingest / Sale Completed. **No** cloud hold / multi-terminal shared holds. See `MILESTONE_3_EXECUTION.md` Slice 6 + `Completed_API_lists.md` §18.
10. **Deferred — Owner/Manager terminal presence:** Owner/Manager should see each cashier/terminal **online (green) / offline (red)** in real time. Needs cloud heartbeat/presence from desktop + owner/manager UI (likely **M6 owner web** or a later authorized slice). Do not invent presence APIs until authorized.
11. **Deferred ? catalog onboarding (CSV / Excel import):** Real pharmacies onboard hundreds?thousands of SKUs from supplier/Excel lists. Owner/manager bulk import into Neon is the expected path; **not designed or built yet**. Today: seed demo + product/batch APIs only. Do not invent import UI/API until authorized.
12. **Goods receiving / stock adjust UX — W6 current contract:** Owner/Manager **Settings → Receive stock** (online): Add lot `POST /api/v1/batches`; Adjust stock `POST /api/v1/batches/:id/adjustments` with signed `quantityChange`, required reason, `expectedVersion`, and idempotent `eventId`. Cashier does not see the section. A 409 reloads current values without auto-retry; success triggers authoritative `catalogPull`. No offline GRN queue. General batch PATCH cannot mutate quantity.
12b. **409 conflict UX — M5 Batch D DONE:** Failed Sync Queue rows map `last_error` (insufficient stock / 409 / conflict) to i18n `syncQueue.conflictReason` plus raw `last_error` as data. Enter still Retry. **No** void / delete sale. Online ingest 409 still stays on payment. Stage with `__r2aMarkHeadSyncDead()` (defaults to `409 Insufficient stock`). Catalog **§20**.
13. **Product catalog display fields (locked):** `manufacturer`, `strength`, `form` are optional on `Product` (schema + Zod + seed + desktop cache). Search UI shows them; free-text `q` also matches these fields. Do not invent from `description`.
14. **Pilot scale — catalog cache pull (M5 Batch E DONE):** Desktop `catalogPull` pages `GET /products` (`isActive=true`) and `GET /batches` with `limit=100` + `offset` until `meta.total`, cap **50 pages** (5000 rows) per resource; i18n toast if truncated. Local SQLite stays a lean cache (not a second master DB); Neon remains source of truth. Still drops `costPerBase`. No CSV. Bi-di sync remains **M6**.
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
| 2026-08-14 | **M4 Batch E DONE** — Sync Queue panel + badge/Settings entry; i18n en + bn-BD; `smoke:m4e`; next = authorize Batch F |
| 2026-08-14 | **M4 Batch F DONE** — catalog §19; `smoke:m4`; user reconnect walkthrough **PASS**; M4 **closed**; next = authorize M5 |
| 2026-08-14 | **M5 execution file created** — `MILESTONE_5_EXECUTION.md` A–F not started; Roles + M5 linked in doc map; next = Authorize M5 Batch A |
| 2026-08-14 | **M5 Batch A DONE** — `PATCH /customers/:id` + `PATCH /batches/:id` OWNER/MANAGER (cashier 403 incl. qty); `smoke:m2` + `smoke:m5a`; next = Authorize M5 Batch B |
| 2026-08-14 | **M5 Batch B DONE** — Settings Receive stock placeholder Owner/Manager only (cashier omitted); Create/PATCH customer still off POS; `smoke:m5b`; next = Authorize M5 Batch C |
| 2026-08-14 | **M5 Batch C DONE** — Settings Receive stock Add lot + Adjust qty (online POST/PATCH /batches); catalogPull; cashier still omitted; `smoke:m5c`; user walkthrough **PASS**; next = Authorize M5 Batch D |
| 2026-08-14 | **M5 Batch D DONE** — Sync Queue Failed i18n conflict copy + raw `last_error`; Enter Retry; no void; `__r2aMarkHeadSyncDead()` defaults to 409; `smoke:m5d`; user walkthrough **PASS**; next = Authorize M5 Batch E |
| 2026-08-14 | **M5 Batch E DONE** — paged `catalogPull` (`meta.total`, limit 100, cap 50 pages); `costPerBase` still dropped; truncated i18n toast; `smoke:m5e`; user walkthrough **PASS**; next = Authorize M5 Batch F |
| 2026-08-14 | **M5 Batch F DONE** — `docs/DEV_RUNBOOK.md`; catalog §20; `smoke:m5`; user pilot walkthrough **PASS**; M5 **closed**; next = authorize M6 |
| 2026-08-15 | **M6 Batch A DONE** — `@r2a/web` Vite scaffold + invented Owner Login; OWNER session; Manager/Cashier rejected; `smoke:m6a`; next = Authorize M6 Batch B |
| 2026-08-15 | **M6 Batch B DONE** — Owner chrome lock (sidebar + header); live Dashboard/Sales/Inventory shells; later nav disabled; store name from `GET /tenant/context`; `smoke:m6b`; next = Authorize M6 Batch C |
| 2026-08-15 | **M6 Batch C DONE** — Additive Prisma (`Sale.receiptNo` + loyalty snapshots, `SaleItem` FEFO/cost, `Product` extras, `InventoryEvent`); Zod ingest/product/owner query stubs; Napa `reorderLevel=50`; ingest unchanged; next = Authorize M6 Batch D |
| 2026-08-15 | **M6 Batch D DONE** — ingest `receiptNo` + `costPerBaseAtSale` + loyalty/FEFO persist + `InventoryEvent` SALE/RECEIVE/ADJUST; desktop `saleIngest` wired; `smoke:m6d` + `smoke:m2`; next = Authorize M6 Batch E |
| 2026-08-15 | **M6 Batch E DONE** — `GET /sales` + `GET /sales/:id`; Owner cost/COGS/netProfit; Manager/Cashier redacted; `smoke:m6e`; next = Authorize M6 Batch F |
| 2026-08-16 | **M6 Batch F DONE** — `GET /owner/dashboard` + inventory-summary + expiry; OWNER-only; `smoke:m6f`; next = Authorize M6 Batch G |
| 2026-08-16 | **M6 Batch G DONE** — live Owner Dashboard (KPIs / bars / inventory health / FEFO / recent sales); `smoke:m6g`; next = Authorize M6 Batch H |
| 2026-08-16 | **M6 Batch H DONE** — live Sales Overview & Transactions (`GET /sales` + dashboard salesKpis / paymentMix / topCashier); Date filter; `smoke:m6h`; next = Authorize M6 Batch I |
| 2026-08-16 | **M6 Batch I DONE** — live Transaction Details (`GET /sales/:id`); FEFO OVERRIDE badge; loyalty grid from snapshots (hidden for walk-in); Reprint = on-screen preview; `smoke:m6i`; next = Authorize M6 Batch J |
| 2026-08-16 | **M6 Batch J DONE** — live Inventory list (`GET /owner/inventory`); Owner cost/sell/margin; tabs + attention; `smoke:m6j`; next = Authorize M6 Batch K |
| 2026-08-16 | **M6 Batch K DONE** — live Product Details (`GET /owner/products/:id`); FEFO rank; InventoryEvent activity; `smoke:m6k`; next = Authorize M6 Batch L |
| 2026-08-16 | **M6 Batch L DONE** — live Add Product (`POST /products`); unit hierarchy + product extras; 0 initial stock; `smoke:m6l`; next = Authorize M6 Batch M |
| 2026-08-16 | **M6 Batch M DONE** — live web Receive Stock (`POST /batches`); packaging + financial + stock-impact calculations; no Supplier/PO/invoice or offline GRN; `smoke:m6m`; next = Authorize M6 Batch N |
| 2026-08-18 | **Owner Web Missing Features W1–W6 DONE** — data integrity + sale snapshots; Edit Product; batch correction/adjustment/lifecycle APIs; localized Batch Management UI; desktop signed adjustment migration; legacy absolute PATCH removed; next eligible = M6 Batch N when explicitly authorized |
| 2026-08-18 | **M6 Batch N DONE** — live localized Expiry Management with supplier/return metadata, filters, selection, CSV export, and disabled return workflow; `smoke:m6n` |
| 2026-08-18 | **M6 Batch O DONE / Owner Web Slice 1 DONE** — API catalog §21; `smoke:m6s1` PASS; M6 remains IN PROGRESS; next = separately authorized Slice 2 |
| 2026-08-18 | **M6 Slice 2 planned** — batches P–AD in `MILESTONE_6_EXECUTION.md` (not started). Next = Authorize M6 Batch P |
| 2026-08-18 | **M6 Batch P DONE** — deployed additive Supplier/PO/GRN/ReturnManifest schema + optional `Batch.supplierId`; shared Zod contracts; no routes/UI; `smoke:m2` and `smoke:m6s1` PASS; next = Authorize M6 Batch Q |
| 2026-08-18 | **M6 Batch Q DONE** — OWNER-only Supplier CRUD (no delete) + PO list/create/get/draft-update; PO number/totals/KPIs; no inventory effect; `smoke:m6q` 18/18 PASS; next = Authorize M6 Batch R |
| 2026-08-18 | **M6 Batch R DONE** — OWNER-only confirmed GRN + return queue/manifest lifecycle APIs; partial/final PO progress, over-receive protection, RECEIVE ledger entries, idempotent dispatch stock-out; `smoke:m6r` 17/17 PASS; next = Authorize M6 Batch S |
| 2026-08-18 | **M6 Batch S DONE** — Purchasing + Suppliers sidebar routes live as localized placeholder shells; later nav disabled; `smoke:m6s` PASS; next = Authorize M6 Batch T |
| 2026-08-18 | **M6 Batch T DONE** — live Purchasing list (`GET /owner/purchase-orders`): KPI cards, PO table, search/status, pagination, CTAs; Create PO → `/purchasing/new`; `smoke:m6t` PASS; next = Authorize M6 Batch U |
| 2026-08-18 | **M6 Batch U DONE** — live Create Purchase Order page: ACTIVE-supplier dropdown (new `lib/suppliers.ts`), product line search w/ low-stock hint, Add Suggested Items, Save as Draft / Create (SENT) / Cancel, order-summary right rail; no inventory effect; seed now ships **3 ACTIVE suppliers** (Beximco · Square · SMC) so the dropdown is usable; `smoke:m6u` PASS; next = Authorize M6 Batch V |
| 2026-08-19 | **M6 Batch V DONE** — live Purchase Order Details (`GET /owner/purchase-orders/:poId`): header + status badge, KPI cards (order/received/remaining value + receipts + progress), receiving progress bar, order-lines table with received/remaining per line, Goods Receipt history for this PO, Order Information rail; Export / Print / More Actions disabled; Receive Stock navigates to `/purchasing/:poId/receive` only while remaining qty > 0 on a SENT / PARTIALLY_RECEIVED order (GRN form itself is Batch W); full `purchasing.detail.*` i18n in en + bn-BD; `smoke:m6v` PASS; next = Authorize M6 Batch W |
| 2026-08-18 | **M6 Batch S DONE** — Purchasing and Suppliers sidebar routes now open localized placeholder shells; Customers and all other later nav remain disabled; no list tables; `smoke:m6s` PASS; next = Authorize M6 Batch T |
| 2026-08-19 | **M6 Batch W DONE** — live Receive Stock against PO at `/purchasing/:poId/receive` matching the shared screen: header actions (Save as Draft disabled + Confirm Receipt primary), Receipt Details (SUPPLIER, PO STATUS, PURCHASE ORDER, RECEIVING BRANCH, SUPPLIER INVOICE/REFERENCE, RECEIVED DATE, DELIVERY NOTE/REFERENCE, RECEIVED BY), Received Items table (MEDICINE, ORDERED, PREV. RECV., RECV. NOW, REM. AFTER, BATCH NUMBER, EXPIRY, ৳ UNIT COST, ৳ SELL PRICE, STATUS; + Add Batch / Lot #N rows with Valid / Incomplete / Exceeds badges), Receipt Summary (line items, batches created, units receiving, actual stock cost, PO units remaining before/after, PO after-confirmation status), Inventory Impact (live on-hand → projected via `GET /owner/inventory`); Confirm posts to the Batch R `POST /owner/purchase-orders/:poId/receipts` then returns to PO Details; Inventory ad-hoc Receive untouched; full `purchasing.receive.*` i18n en + bn-BD; `smoke:m6w` PASS; next = Authorize M6 Batch X |
| 2026-08-19 | **M6 Batch X DONE** — live Suppliers directory at `/suppliers` (shared Suppliers screen; UI_SPEC.md used — attached screenshot unreadable): 4 KPI cards (Active Suppliers, Open Purchase Orders, Purchases MTD with % vs last month, Avg. Delivery Time), Supplier Directory card (search + Status filter + SUPPLIER teal links / CONTACT / ACTIVE PRODUCTS / LAST PURCHASE / OPEN POs / PURCHASES MTD + pagination), 194px Supplier Attention rail (Overdue red / Open PO teal / Expiry Return orange / On Hold slate; Review links → existing pages only; Review All Issues disabled — Batch AA), Expiry Returns → `/suppliers/returns`, Add Supplier → `/suppliers/new` (form NOT built — Batch Y); `GET /owner/suppliers` extended additively with per-item `stats` + `kpis` + `attention` (`smoke:m6q` shape preserved); full `suppliers.*` i18n en + bn-BD; `smoke:m6x` PASS; smoke:m6s updated (Suppliers placeholder superseded); next = Authorize M6 Batch Y |
| 2026-08-19 | **M6 Batch Y DONE** — live Add Supplier form at `/suppliers/new` (Add Supplier is Batch Y; UI_SPEC.md shared Supplier Details screen is Batch Z, so the form is invented to match the Admin Portal family): all `supplierCreateSchema` fields (name, contact person, primary/secondary phone, email w/ client validation, address, city, registration number, payment terms, lead time days, ৳ min order value, preferred contact PHONE/EMAIL/WHATSAPP, expiry-returns accepted + min days window + return instructions, internal notes) + live Setup Summary rail; suppliers always created **ACTIVE** (Save as Draft disabled — no Edit Supplier page; no Edit route added); unsaved-changes guard; create → `POST /api/v1/owner/suppliers` → navigate to `/suppliers/:supplierId` (Supplier Details placeholder until Batch Z); new `createOwnerSupplier` in `lib/suppliers.ts`; full `suppliers.add.*` i18n en + bn-BD (default bn-BD; superseded `suppliers.placeholder.new*` removed); `smoke:m6y` PASS; smoke:m6x updated (`/suppliers/new` now AddSupplierPage); lint + build clean; next = Authorize M6 Batch Z |
| 2026-08-19 | **M6 Batch Z DONE** — live Supplier Details at `/suppliers/:supplierId` (shared Supplier Details screen; UI_SPEC.md used): header (name + status badge + contact line + Expiry Returns → `/suppliers/returns` + Create Purchase Order → `/purchasing/new`); honest KPI row — Purchases 12 Months (৳), Avg. Delivery Time, Expiry Return Rate, Active Products — all computed from live data, zeros / em dash when no data (NO invented ৳2,480,000 / 2.4 days / 1.8% / 148 / 94% / 3.2% / 86% / 9 days); Supplier Information 2-col grid (supplier/contact/phone/email | last purchase/open POs/payment terms/status; tel:+ mailto: links) + Performance card (On-time Delivery / Short Supply Rate / Expiry Returns Accepted progress bars + divider + Avg. Credit Note Time); Purchase Orders table (PO Number teal link → `/purchasing/:poId`, Created, Expected, Total, Status badge) + Products Supplied table (Medicine, Stock with low/out emphasis, Cost ৳, status badge) from **batches + PO lines** with live stock; View All POs + View All Products disabled (Purchasing list / Inventory search cannot filter by supplier yet); empty states w/ Create PO CTA; `GET /owner/suppliers/:supplierId` additively returns `detail` (kpis incl. openOrders + lastPurchaseAt, performance, purchaseOrders, products) — `smoke:m6q` shape preserved; superseded `suppliers.placeholder.detail*` removed; full `suppliers.detail.*` i18n en + bn-BD; `smoke:m6z` PASS; smoke:m6x updated (detail placeholder superseded); server + web lint/build clean; next = Authorize M6 Batch AA |
| 2026-08-19 | **M6 Batch AA DONE** — live Expiry Returns queue at `/suppliers/returns` (UI_SPEC.md used): 4 KPI cards from additive `GET /owner/returns/queue` meta (eligible batches / cost value / manifests prepared / needs review); search + Supplier + Return Status filters; Eligible-only checkboxes; teal selection bar; mixed-supplier selection cannot create; Create Return Manifest enabled only for one-supplier Eligible selection and navigates to `/suppliers/returns/new` (layout is Batch AB) with session draft of selected lots; Export / Print disabled; Inventory Expiry Prepare Supplier Return enabled → this page; full `suppliers.returns.*` i18n en + bn-BD; `smoke:m6aa` PASS; smoke:m6n + smoke:m6x updated; next = Authorize M6 Batch AB |
| 2026-08-19 | **M6 Batch AB DONE** — live Create Return Manifest at `/suppliers/returns/new` (shared screen): reviews Batch AA session draft + live Eligible lots + supplier policy; editable return qty; Prepare → `POST /owner/return-manifests` (optional `supplierReference`); SRM auto-generated; Save as Draft disabled; no stock movement; navigate to `/suppliers/returns/:manifestId` (Details still Batch AC); full `suppliers.manifest.*` i18n en + bn-BD; `smoke:m6ab` PASS; next was Batch AC |
| 2026-08-19 | **M6 Slice 2 AC–AD deferred. Slice 3 planned (AE–AM).** Owner web Customers + POS cashier/manager create pending Owner approval; Owner create Active immediately. Edit Customer parked. Reject + POS Create invented. Next = Authorize M6 Batch AE |
| 2026-08-19 | **M6 Batch AE DONE** — Customer Prisma status/source/profile + partial unique phone + Zod DTOs + pending POS seed; `POST /customers` still OWNER-only; no Owner web Customers routes. Next = Authorize M6 Batch AF |
| 2026-08-20 | **M6 Batch AF DONE** — §23 Customer APIs: role-aware `POST /customers` (Owner Active; Cashier/Manager Pending + extras stripped), Active-only `GET /customers`, `GET /customers/phone-check`, Owner `GET /owner/customers` + `/:id` + approve/reject, `GET /sales?customerId=`, ingest Active-only guard, 403 on `/owner/customers*` for non-owners; `smoke:m6af` 14/14. **M6 Batch AG DONE** — Customers sidebar is now a live chrome route (`/customers`, `/customers/new`, `/customers/:id`, `/customers/:id/review`); placeholder shells only; Staff/Help/Owner Profile stay disabled; `smoke:m6ag` 5/5, lint + build clean. Next = Authorize M6 Batch AH |
| 2026-08-20 | **M6 Batch AH DONE** — live Customers directory at `/customers` from `GET /owner/customers`: 4 KPI cards (registered / pending / active-90d / loyalty issued), tabs All/Pending/Active/Inactive, name-or-phone search, Status/Source/Sort filters, pagination; Pending row → `/customers/:id/review`, Active/Inactive → `/customers/:id`, Add Customer → `/customers/new` (form is AI); new/review/detail stay placeholder; no invented 2,417 / ৳ totals; `lib/customers.ts` + `customers.*` i18n en + bn-BD; `smoke:m6ah` PASS, `smoke:m6ag` still PASS, lint + build clean. Next = Authorize M6 Batch AI |
| 2026-08-20 | **M6 Batch AI DONE** — live Add Customer at `/customers/new` (UI_SPEC.md used; Add Customer not re-shared): Customer Information form (name + phone required w/ inline blur/submit errors, email format check, DOB, gender dropdown, address textarea) + debounced live `GET /customers/phone-check` Duplicate Check panel (checking / teal available / amber duplicate w/ view-profile link → `/customers/:id` or review); Direct Customer Creation info card + read-only System Information (Source Owner Created, Branch = live tenant store, Created By = live session user); Create Customer CTA opens a checkbox-gated **Create Confirm** modal (500px dialog, focus trap + Esc + focus return, Name/Phone/Branch/Source summary, teal "What Happens After Creation" panel, confirmation checkbox default unchecked, CTA `#00766c`/`hover:#00635c` enabled only when checked, `#79b5ae opacity-70` disabled, inline error keeps modal open + retry) → `POST /api/v1/customers` (OWNER → ACTIVE + OWNER_CREATED) → navigate to `/customers/:id` (Details is AJ); Cancel top+bottom → `/customers`; unsaved-changes guard; Create disabled while a confirmed duplicate exists; no sample data; `createCustomer` + `checkCustomerPhone` in `lib/customers.ts`; full `customers.add.*` i18n en + bn-BD; `smoke:m6ai` PASS, `smoke:m6ah` + `smoke:m6ag` still PASS, lint + build clean. Next = Authorize M6 Batch AJ |
| 2026-08-20 | **M6 Batch AJ DONE** — live Customer Details at `/customers/:customerId` from `GET /owner/customers/:id` (UI_SPEC.md used; Batch AH/AI pattern): breadcrumb Customers › name; header name + status badge + contact line + Edit Customer / More Actions disabled (parked); 4 KPI cards (Loyalty Points / Total Purchases ৳ / Visits / Last Purchase) — all live or honest zeros/—; Customer Information 2-col grid (name/phone `tel:`/email `mailto:`/DOB/gender/status badge/address/branch = live `storeName`); Registration Information card w/ teal audit notice + Source / Registration Branch / Submitted / Submitted By / Approved / Approved By + Original Registration Values mini-cards; Purchase History (live rows → `/sales/:id`; empty state) + Loyalty Activity (Current Balance + earn/redeem rows w/ running balance from snapshots; empty state); right rail known-facts Timeline (approved / submitted events, newest first); pending id → redirects to `/customers/:id/review` (Review stays AK placeholder); `GET /owner/customers/:id` additively returns `profile.storeName`, `purchaseHistory.lastPurchaseAt/rows`, `loyaltyActivity.rows` (shape preserved, `smoke:m6af` valid); `fetchCustomerDetail` + `CustomerDetail` types; full `customers.detail.*` i18n en + bn-BD; `smoke:m6aj` PASS, `smoke:m6ai` + `smoke:m6ah` + `smoke:m6ag` still PASS, server + web lint + web build clean. Next = Authorize M6 Batch AK |
| 2026-08-20 | **M6 Batch AK DONE** — live Customer Registration Review at `/customers/:customerId/review` (Review not re-shared; Admin Portal family used — Batch AH/AI pattern): breadcrumb Customers › Review Registration + Pending badge; read-only **Registration Request** card (Registered Name / Registered Phone `tel:` / Source POS Registration / Registration Branch = live `storeName` / Submitted date+time / Submitted By = live actor) + **Review Profile** card (editable — Owner may correct name/phone/email/DOB/gender/address before approve; debounced live `GET /customers/phone-check` duplicate check that ignores this same customer and blocks approve when another customer owns the phone); right rail **Registration Info** + **Approval Action** copy; footer Cancel → list + **Reject Registration** (red outline) + **Approve Customer** (teal primary, disabled on validation/duplicate); shared **Approve Customer** modal (500px dialog, focus trap + Esc + focus return, Name/Phone/Branch/Source summary, teal "What Happens After Approval" panel — becomes Active immediately, appears in POS search, recorded for audit, corrections saved; confirmation checkbox default unchecked, CTA enabled only when checked) → `POST /api/v1/owner/customers/:id/approve` (OWNER only, pending only) → navigate to `/customers/:id` (Details shows Active); invented **Reject Registration** modal matching the Approve family (Registration Summary, optional rejection note ≤1000 chars, red checkbox-gated CTA) → `POST /api/v1/owner/customers/:id/reject` → navigate to `/customers` (row gone; phone reusable); Active/Inactive id on Review → redirects to Details (REJECTED rows are 404 from the detail API → not-found state); unsaved-changes guard on profile edits; no POS Create (Batch AL); `approveCustomer` + `rejectCustomer` + payload types in `lib/customers.ts`; full `customers.review.*` i18n en + bn-BD; `CustomersPlaceholder` removed from AppShell; `smoke:m6ak` PASS (source guards — live pending→approve→POS Active-search flow already covered by `smoke:m6af`); `smoke:m6aj` + `smoke:m6ai` + `smoke:m6ah` + `smoke:m6ag` updated/still PASS; web lint + web build clean. Next = Authorize M6 Batch AL |

