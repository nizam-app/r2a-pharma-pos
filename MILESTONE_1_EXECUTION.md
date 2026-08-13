# Milestone 1 — Database Foundation (Batch Execution Plan)

**Document type:** Fresh-chat execution guide for Milestone 1 only  
**Source of truth:** [`PROJECT_MASTER_PLAN.md`](PROJECT_MASTER_PLAN.md)  
**Status of M1:** **DONE** (Batches A–F complete; recorded in `PROJECT_MASTER_PLAN.md` and `Current_Status.md`)  
**Prerequisite:** Milestone 0 is **DONE** (Turborepo scaffold, placeholders, docs relocated, Mongo backend removed)  
**Do not start:** Milestone 2+ (Express API, Tauri POS, sync worker, etc.)

---

## How to use this file

1. Open a **fresh Cursor chat** for each batch.
2. Attach / `@` these files:
   - `PROJECT_MASTER_PLAN.md`
   - `MILESTONE_1_EXECUTION.md`
   - Relevant source specs under `docs/` when the batch says so
3. Paste **only** that batch’s “Agent prompt” (or authorize that batch by ID).
4. Mark the batch checkbox when its exit check passes.
5. Proceed to the next batch only after the previous one is green.

> **Hard rule:** Implement **one batch per chat**. Do not collapse all batches into a single “do Milestone 1” run.

---

## Acknowledgement — Master Plan Audit (read-only)

This section records that `PROJECT_MASTER_PLAN.md` was audited and understood before writing this plan. No code was written for this acknowledgement.

### Product & stack (locked)

| Item | Understanding |
|------|----------------|
| Product | Offline-first, multi-tenant Pharmacy POS + Inventory SaaS (BD / emerging markets) |
| Cloud | Express + TypeScript + **Prisma** + **PostgreSQL** |
| Local | Tauri + React + **SQLite** (`pos_local.db`) — **not** in M1 scope |
| Forbidden | MongoDB, Mongoose, competing backends, parallel frontends outside `apps/desktop` & `apps/web` |
| Tenancy | Shared Postgres; `tenant_id` on every domain table; JWT carries `tenantId` (enforced in M2) |
| Sync identity | Plan for `event_id` / idempotency fields now (ingest API is M4) |

### Milestone 1 scope (from master plan §7)

- Full `packages/database/prisma/schema.prisma`
- Entities: `Tenant`, `Store`, `User`, `Product`, `ProductUnit`, `Batch`, `Customer`, `Sale`, `SaleItem`, `Payment`
- Indexes on `tenantId`, search fields, batch expiry
- `packages/shared-types` Zod: auth, product, sale, sync event
- Seed: owner user + sample drug catalog / batches
- Env: `DATABASE_URL`, `JWT_SECRET` (template already started in `.env.example`)

### Exit criteria (master plan)

- `prisma migrate` applies cleanly
- Seed loads tenant / store / products / batches

### Current repo state (post-M0)

| Path | State |
|------|--------|
| Root Turborepo / workspaces | Present |
| `packages/database` | Placeholder `package.json` only (build stub) |
| `packages/shared-types` | Placeholder `package.json` only (build stub) |
| `.env.example` | Already has `DATABASE_URL`, `JWT_SECRET`, etc. |
| Prisma schema / migrations / seed | **Missing** — this milestone |
| Zod packages / exports | **Missing** — this milestone |
| `apps/server` routes / auth | Out of scope (M2) |

### Explicitly out of scope for every M1 batch

- Express API, JWT middleware, FEFO service logic
- Tauri, SQLite, POS UI, keyboard shortcuts
- Sync worker / `/sync/ingest` endpoint
- n8n, owner web dashboard, Postgres RLS
- Drive-by refactors outside `packages/database`, `packages/shared-types`, root env/docs wiring needed for DB

---

## Domain rules that must shape the schema (M1)

Carry these into Prisma + Zod even though APIs come later:

1. **Pharmacy roles (enum):** `SUPER_ADMIN` \| `OWNER` \| `MANAGER` \| `CASHIER` — not marketplace roles.
2. **Multi-unit pricing:** quantities stored in **lowest unit**; `ProductUnit` holds Box / Strip / Piece conversion factors.
3. **FEFO-ready batches:** each `Batch` has expiry + qty in base units + cost/retail as needed for later FEFO.
4. **Tenant safety:** every domain model includes `tenantId` (or belongs under a tenant-owned parent with cascade clarity).
5. **Phase 1 MVP:** tenant-ready schema; single-store-per-tenant operations are enough.
6. **Sync ingest identity:** include fields suitable for idempotent offline events (`eventId` / unique constraint path) on sales (and/or a dedicated sync audit model if justified — prefer minimal: unique `eventId` on `Sale` or a small `SyncEvent` table; pick one approach in Batch B and stick to it).
7. **Payments:** support cash / card / MFS (enum or equivalent) even if payment flows are hardened in M5. No Baki as a payment method.
8. **Sales:** append-only / immutable intent — no soft “overwrite sale” design.

---

## Batch overview

| Batch | Title | Primary packages | Depends on |
|-------|-------|------------------|------------|
| **A** | Package scaffolding & tooling | `@r2a/database`, `@r2a/shared-types` | M0 |
| **B** | Prisma schema (core models) | `@r2a/database` | A |
| **C** | Indexes, constraints, migrate | `@r2a/database` | B |
| **D** | Shared Zod contracts | `@r2a/shared-types` | A (align with B/C) |
| **E** | Seed data | `@r2a/database` | C |
| **F** | Exit verification & wiring | both + root env | D + E |

Recommended chat order: **A → B → C → D → E → F**.

---

## Batch A — Package scaffolding & tooling

**Goal:** Make `@r2a/database` and `@r2a/shared-types` real TypeScript packages with dependencies and scripts — still **no** full domain schema yet (minimal Prisma bootstrap only if required to install the CLI).

### Tasks

- [x] Add TypeScript config for both packages (extend `tsconfig.base.json`)
- [x] `@r2a/database`: add `prisma`, `@prisma/client`, scripts: `prisma:generate`, `prisma:migrate`, `prisma:seed`, `build`
- [x] `@r2a/shared-types`: add `zod`, `typescript` build/export setup (`main`/`types`/`exports` as appropriate)
- [x] Wire package `dependencies` / workspace references so later apps can import `@r2a/database` and `@r2a/shared-types`
- [x] Confirm `.env.example` still documents `DATABASE_URL` and `JWT_SECRET` (update only if paths/scripts need clarifying — do not invent secrets)
- [x] `npm install` at repo root succeeds

### Allowed files (typical)

- `packages/database/package.json`
- `packages/database/tsconfig.json`
- `packages/shared-types/package.json`
- `packages/shared-types/tsconfig.json`
- Root lockfile via install
- Optional: minimal `schema.prisma` datasource/generator stub **only** if needed to finish tooling (empty/minimal models OK until Batch B)

### Exit check

- Both packages resolve by name from the workspace
- Prisma CLI is invokable via package script
- No Express/Tauri code added

### Agent prompt (copy into a fresh chat)

```text
Implement ONLY Batch A from MILESTONE_1_EXECUTION.md
(Package scaffolding & tooling for @r2a/database and @r2a/shared-types).
Do not implement full Prisma domain models, seed data, Zod domain schemas, or Milestone 2+.
Follow PROJECT_MASTER_PLAN.md stack locks. Mark Batch A exit check when done.
```

---

## Batch B — Prisma schema (core models)

**Goal:** Author the full domain `schema.prisma` with relations and enums aligned to the master plan.

### Tasks

- [x] Create / complete `packages/database/prisma/schema.prisma`
- [x] Models: `Tenant`, `Store`, `User`, `Product`, `ProductUnit`, `Batch`, `Customer`, `Sale`, `SaleItem`, `Payment`
- [x] Role enum: `SUPER_ADMIN`, `OWNER`, `MANAGER`, `CASHIER`
- [x] Unit / payment enums as needed (Box/Strip/Piece; Cash/MFS/Baki or equivalent)
- [x] `tenantId` (or equivalent FK path) on all domain tables
- [x] Product fields suitable for search (name, generic/active ingredient, SKU/barcode as justified by docs)
- [x] Batch: expiry date, quantity in base units, cost/sell fields needed for FEFO later
- [x] ProductUnit: conversion factors to lowest unit
- [x] Sale / SaleItem / Payment relations; immutable-sale friendly design
- [x] Sync idempotency: unique `eventId` (or dedicated sync identity) for offline ingest readiness
- [x] User password hash field for later auth (no auth routes here)
- [x] Prefer PostgreSQL provider; `DATABASE_URL` env

### Reference docs (attach if helpful)

- `docs/Project_Handover.md` (schema expectations)
- `docs/System_Architecture_Technical_Specification.md` (tenancy / sync notes)
- `docs/Project_Requirement_Documents.md` (domain behaviors)

### Exit check

- Schema validates conceptually (relations clear; no Mongo leftovers)
- Still **no** requirement that migrate has been applied yet (that is Batch C)
- No API or UI code

### Agent prompt

```text
Implement ONLY Batch B from MILESTONE_1_EXECUTION.md
(Full Prisma domain schema for Milestone 1 entities).
Do not run production seed logic yet beyond what is required to keep the schema valid.
Do not start shared-types Zod domain modules (Batch D), API, or desktop work.
Follow PROJECT_MASTER_PLAN.md and MILESTONE_1_EXECUTION.md domain rules.
```

---

## Batch C — Indexes, constraints & migrate

**Goal:** Add indexes/constraints and apply the first migration successfully against local Postgres.

### Tasks

- [x] Indexes on `tenantId` for domain tables
- [x] Indexes for product search fields (name / generic / barcode as modeled)
- [x] Index on batch expiry (and preferably composite useful for FEFO: e.g. product + expiry + qty)
- [x] Unique constraints: tenant-scoped business keys where appropriate (e.g. email per tenant, eventId globally or per tenant — document choice in schema comments if non-obvious)
- [x] Create initial migration under `packages/database/prisma/migrations/`
- [x] Document local Postgres prerequisite (Docker or local install) briefly in this batch’s notes or existing runbook location **only if** needed to apply migrate — prefer updating `.env.example` comments over new markdown files
- [x] Run `prisma migrate` (or package script equivalent) successfully
- [x] Run `prisma generate`

### Exit check

- Migration applies cleanly on a fresh database using `DATABASE_URL`
- Client generates without errors
- Schema matches Batch B models (no silent model drops)

### Agent prompt

```text
Implement ONLY Batch C from MILESTONE_1_EXECUTION.md
(Indexes, constraints, and first Prisma migration).
Assume Batch B schema exists. Do not implement seed catalog (Batch E) or Zod packages (Batch D) unless a tiny fix is required for migrate.
Do not start Milestone 2+.
```

---

## Batch D — Shared Zod contracts (`@r2a/shared-types`)

**Goal:** Add Zod schemas / DTOs that mirror the cloud contracts M2+ will use. Types only — no HTTP handlers.

### Tasks

- [x] Package source layout (e.g. `src/index.ts` + modules)
- [x] Auth-related schemas: login/register payloads; JWT claim shape `{ sub, role, tenantId, storeId }` (types/schema only)
- [x] Product schemas (create/update/search DTOs as minimal contracts)
- [x] Sale schemas (sale ingest line items, units, payments)
- [x] Sync event schema: `event_id`, `entity_type`, `action`, `payload` aligned with master plan queue / ingest identity
- [x] Role / unit / payment enums mirrored from Prisma where practical
- [x] Export public API from package entrypoint
- [x] Build script produces usable types for workspace consumers

### Alignment rules

- Field naming should be intentional: DB may be camelCase via Prisma; API DTOs should stay consistent and documented in code
- Do **not** implement Express validation middleware here (M2)

### Exit check

- `@r2a/shared-types` builds
- Zod modules exist for **auth**, **product**, **sale**, **sync event**
- No server routes added

### Agent prompt

```text
Implement ONLY Batch D from MILESTONE_1_EXECUTION.md
(Zod schemas in @r2a/shared-types for auth, product, sale, sync event).
Align with the Prisma models from Batches B/C. Do not create Express routes or seed data.
Do not start Milestone 2+.
```

---

## Batch E — Seed (owner + sample catalog)

**Goal:** Deterministic seed that proves the schema supports a real pharmacy counter catalog.

### Tasks

- [x] Prisma seed script wired in `package.json` (`prisma.seed` or package script)
- [x] Seed **one** tenant
- [x] Seed **one** store under that tenant
- [x] Seed **OWNER** user (bcrypt-hashed password; credentials only in local seed / `.env.example` comments — never commit real secrets)
- [x] Seed sample products (Bangladesh-familiar OTC examples are fine, e.g. common analgesics/antacids) with:
  - ProductUnit conversion rows (Box / Strip / Piece as applicable)
  - At least one Batch per product with expiry + qty in base units
- [x] Optional but useful: one sample customer; avoid large unused graphs
- [x] Seed is idempotent enough for re-run guidance (document: reset DB vs upsert strategy)

### Exit check

- `prisma db seed` (or package script) completes
- DB contains tenant, store, owner, products, units, batches
- No API/UI work

### Agent prompt

```text
Implement ONLY Batch E from MILESTONE_1_EXECUTION.md
(Prisma seed: tenant, store, owner user, sample drugs, units, batches).
Do not build the Express API or desktop app. Do not start Milestone 2+.
Follow PROJECT_MASTER_PLAN.md exit criteria for seed contents.
```

---

## Batch F — Exit verification & wiring

**Goal:** Prove Milestone 1 exit criteria end-to-end and leave the monorepo tidy for M2.

### Tasks

- [x] From a clean mental checklist, re-run: migrate (already applied) + generate + seed on a disposable DB if possible
- [x] Confirm package exports: `@r2a/database` exposes Prisma client entry; `@r2a/shared-types` exports Zod modules
- [x] Confirm root / package scripts documented in `package.json` are accurate (no stub-only lies for DB packages)
- [x] Confirm `.env.example` matches required vars for M1 (`DATABASE_URL`, `JWT_SECRET`, plus any seed-related non-secret placeholders)
- [x] Update progress in `PROJECT_MASTER_PLAN.md` **only if the user asks** in that chat; otherwise report “M1 ready to mark DONE” in the chat summary
- [x] List any follow-ups that belong to M2 (auth routes, tenant guard) without implementing them

### Milestone 1 Definition of Done (all must pass)

- [x] `prisma migrate` applies cleanly
- [x] Seed loads tenant / store / products / batches (and owner user)
- [x] `@r2a/shared-types` includes Zod for auth, product, sale, sync event
- [x] No MongoDB/Mongoose reintroduced
- [x] No Milestone 2+ features accidentally started

### Agent prompt

```text
Implement ONLY Batch F from MILESTONE_1_EXECUTION.md
(Exit verification & package wiring for Milestone 1).
Do not start Milestone 2. Run the verification steps, fix only wiring/export/script issues blocking the M1 exit criteria, and report a clear pass/fail checklist.
```

---

## Suggested fresh-chat sequence

1. Chat 1 → Batch A  
2. Chat 2 → Batch B  
3. Chat 3 → Batch C  
4. Chat 4 → Batch D  
5. Chat 5 → Batch E  
6. Chat 6 → Batch F  

After Batch F passes, authorize Milestone 2 from `PROJECT_MASTER_PLAN.md` in a new plan/execution file (do not invent M2 work inside this document’s implementation chats).

---

## Progress tracker

| Batch | Status | Date | Notes |
|-------|--------|------|-------|
| A Scaffolding | DONE | 2026-08-08 | TS + Prisma CLI + Zod package exports; stub schema only |
| B Prisma schema | DONE | 2026-08-08 | Full domain models; sync via unique Sale.eventId |
| C Migrate + indexes | DONE | 2026-08-08 | Init migration applied on Neon; PaymentMethod CASH/CARD/MFS |
| D Shared Zod types | DONE | 2026-08-08 | auth/product/sale/sync + enums; PaymentMethod CASH/CARD/MFS |
| E Seed | DONE | 2026-08-08 | demo-pharmacy + OWNER + 5 OTC products/units/batches |
| F Verification | DONE | 2026-08-08 | M1 DoD passed; packages wired; M1 ready to mark DONE |

---

## Change log

| Date | Change |
|------|--------|
| 2026-08-08 | Created from audited `PROJECT_MASTER_PLAN.md`; M1 split into Batches A–F for fresh-chat execution |
