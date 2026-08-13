# Milestone 2 — Cloud API Core (Batch Execution Plan)

**Document type:** Fresh-chat execution guide for Milestone 2 only  
**Source of truth:** [`PROJECT_MASTER_PLAN.md`](PROJECT_MASTER_PLAN.md)  
**Live progress context:** [`Current_Status.md`](Current_Status.md)  
**Status of M2:** PENDING  
**Prerequisite:** Milestone 0 + **Milestone 1 are DONE** (Prisma schema, Neon migrate/seed, `@r2a/shared-types` Zod)  
**Do not start:** Milestone 3+ (Tauri POS, SQLite, sync worker, n8n, owner web UI, RLS)

---

## How to use this file

1. Open a **fresh Cursor chat** for each batch.
2. Attach / `@` these files:
   - `PROJECT_MASTER_PLAN.md`
   - `Current_Status.md`
   - `MILESTONE_2_EXECUTION.md`
   - Specs under `docs/` when the batch says so (especially `Project_Handover.md`)
3. Paste **only** that batch’s “Agent prompt” (or authorize that batch by ID).
4. Agent starts the batch. If a design/flow/visual would lead to a better decision than inventing alone, the agent **asks you first** and **stops** until you provide or decline.
5. After that (or if no ask was needed), agent implements **only** that batch.
6. Mark the batch checkbox when its exit check passes.
7. Proceed to the next batch only after the previous one is green.

> **Hard rules:**
> - Implement **one batch per chat**. Do not collapse all batches into a single “do Milestone 2” run.
> - **Ask before inventing** on product/API/UX-sensitive decisions. Do not silently invent a flow when asking you would be better.

---

## Acknowledgement — Plan & Status Audit (read-only)

This section records that `PROJECT_MASTER_PLAN.md` and `Current_Status.md` were read before writing this plan. No application code was written for this document.

### Where we are

| Item | State |
|------|--------|
| M0 / M1 | **DONE** |
| Cloud DB | Neon PostgreSQL; migrate + seed applied |
| `@r2a/database` | Real Prisma client + schema |
| `@r2a/shared-types` | Real Zod: auth, product, sale, sync, enums |
| `@r2a/server` | **Placeholder stub only** — this milestone |
| Desktop / SQLite / sync worker | Not started (M3–M4) |

### Milestone 2 scope (from master plan §7)

- Express + TypeScript in `apps/server`; mount `/api/v1`
- Port patterns: `AppError`, `catchAsync`, `sendResponse`, `protect`, `restrictTo`
- JWT payload: `{ sub, role, tenantId, storeId }`
- Tenant context middleware on all domain routes
- CRUD: Products, Batches, Customers
- Sales ingest + FEFO helper in service layer
- Generic substitute lookup by active ingredient
- Health endpoint + structured logging

### Exit criteria (master plan)

- Authenticated sale ingest with FEFO
- Cashier cannot see margins

### Locked corrections from M1 / Current_Status (do not regress)

1. **Payments:** `CASH` \| `CARD` \| `MFS` only — **no Baki** as a tender type (master-plan M5 “Baki” is a future product change, not M2).
2. **Units:** quantities in lowest unit (`PIECE`); Box/Strip via `ProductUnit.factorToBase`.
3. **Sync identity on sales:** global unique `Sale.eventId` (camelCase in API DTOs).
4. **Roles:** `SUPER_ADMIN` \| `OWNER` \| `MANAGER` \| `CASHIER` (enum/JWT only for Super Admin — no platform admin routes in M2).
5. **Tenant safety:** never trust `tenantId` from request body; JWT only.
6. **Stack:** Express + Prisma + PostgreSQL only — no Mongo/Mongoose, no Fastify unless user re-authorizes.
7. **Prisma Batch field names (schema truth):** `expiryDate`, `quantityOnHand`, `costPerBase`, `sellPerBase` — never invent `expirationDate` or `quantityBase` as Batch columns.
8. **Online sales route:** `POST /api/v1/sales/ingest` only — do **not** build M4 `POST /api/v1/sync/ingest` in M2.

### Reuse (do not reinvent)

| Asset | Use in M2 |
|-------|-----------|
| `@r2a/database` `prisma` export | All DB access |
| `loginSchema` / `registerSchema` / `jwtClaimsSchema` | Auth validation + JWT shape |
| `productCreateSchema` / `productUpdateSchema` / `productSearchSchema` | Product CRUD |
| `saleIngestSchema` | Sales ingest body (extend minimally in F/G so `batchId` is optional for FEFO fill) |
| Seed user `owner@demo.local` / `ChangeMe123!` | Manual smoke login (unless env overrides) |

### Explicitly out of scope for every M2 batch

- Tauri, React POS UI, keyboard shortcuts, `@r2a/ui` implementation
- Local SQLite / `outbound_sync_queue` flush worker
- Full `POST /api/v1/sync/ingest` multi-entity sync pipeline (M4) — **online** `POST /api/v1/sales/ingest` is in M2; do not build the desktop queue worker
- **Super Admin platform console / platform-admin routes** — role may exist in JWT/enum; separate admin setup later
- n8n, owner web dashboard, Postgres RLS
- Payment gateway integrations (Card/MFS processors)
- Drive-by Prisma schema redesign unless a blocker is found (then stop and ask)

---

## Target server folder tree (locked)

Agents **must** use this modular layout (legacy Express pattern, TypeScript). Do not invent a flat or alternate structure.

```text
apps/server/
├── package.json
├── tsconfig.json
├── .env                 # gitignored; local secrets
└── src/
    ├── index.ts         # listen / process lifecycle
    ├── app.ts           # Express app: cors, json, mount /api/v1, errors
    ├── config/          # env loading, constants
    ├── middlewares/     # protect, restrictTo, tenantContext, notFound, globalError, validate
    ├── modules/
    │   ├── auth/        # auth.router / .controller / .service
    │   ├── user/        # staff create + /me (OWNER/MANAGER create CASHIER/MANAGER)
    │   ├── product/
    │   ├── batch/
    │   ├── customer/
    │   └── sale/        # sales ingest
    ├── routes/          # index router mounting modules under /api/v1
    └── utils/           # AppError, catchAsync, sendResponse, jwt helpers, logger
```

---

## Design decisions locked for M2 agents (defaults)

Use these when they already answer the question. **If a decision is ambiguous and a design/flow/visual from you would be better than inventing, ask first — do not invent silently.**

| Topic | Default for M2 |
|-------|----------------|
| Module layout | See **Target server folder tree** above; `router → controller → service` |
| API prefix | `/api/v1` |
| Response envelope | **Locked:** success `{ status: "success", message, data?, meta? }` via `sendResponse`; errors `{ status: "fail"\|"error", message, ... }` via `AppError` + global handler. Do **not** use `{ success: false, error: { code, message } }` unless re-authorized. |
| Auth | `POST /auth/register`, `POST /auth/login`; JWT Bearer on protected routes |
| Register behavior | Creates Tenant + Store + **OWNER** user only (matches `registerSchema`) |
| Staff users | Owner/Manager-only `POST /api/v1/users` creates `CASHIER` / `MANAGER` in the same tenant (needed for margin smoke). No open public cashier self-register. |
| Login | Email + password; optional `tenantSlug` when needed |
| Tenant guard | After `protect`, attach `req.auth` / `req.tenantId` from JWT; all domain queries filter by it |
| Super Admin | No platform-admin API surface in M2; if JWT role is `SUPER_ADMIN`, still do not build tenant-management console routes here |
| Margin fields | Batch `costPerBase` (and any derived margin/profit) **omitted** for `CASHIER`; visible to `OWNER` / `MANAGER` (and `SUPER_ADMIN` if present). Cashiers **may** read `sellPerBase` for checkout. |
| Product/batch price edits | Cashier **blocked** from mutating `costPerBase` / `sellPerBase` (and equivalent catalog economics). `restrictTo('OWNER', 'MANAGER')` on those mutations. |
| FEFO helper | Service picks nearest `expiryDate` with `quantityOnHand > 0` (tenant + store scoped); stable tie-break: earliest expiry, then batch id |
| Sale ingest route | `POST /api/v1/sales/ingest` |
| Sale ingest + FEFO | **Locked:** `batchId` **optional** on line items. If omitted → server FEFO-fills. If provided → validate stock + tenant/store ownership (manual override). Extend `@r2a/shared-types` `saleItemInputSchema` minimally in Batch F or G (`batchId` optional); document the change in the chat summary. |
| Generic substitutes | Lookup products sharing the same `genericName` (active ingredient), excluding the source product, tenant-scoped, in-stock preferred |
| Stock on sale | Decrement batch `quantityOnHand` inside a transaction with sale/items/payments |
| Idempotency | Re-ingest same `eventId` returns the existing sale (no duplicate); do not mutate |
| Delete sales | Not offered in M2 (append-only); cashiers must not get a delete route |
| Logging | Structured logs (pino or similar lightweight JSON logger) — pick one and stay consistent |
| Env | Server reads `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PORT`, `NODE_ENV`, `CORS_ORIGIN` (see `.env.example`) |

---

## Ask-before-inventing protocol (mandatory)

**Intent:** The agent must **ask you** when a design, flow, or visual would lead to a better decision than inventing alone. It must **not** invent product/API behavior on its own when asking is better.

This is **not** “agent invents a full design doc for every batch and waits.”  
This **is** “agent pauses and asks you when inventing would be risky or preference-based.”

### When the agent MUST ask (and stop)

Ask before coding if any of these are true:

- Two+ valid approaches exist and the choice affects API contracts, RBAC, FEFO, cashier UX, or money/stock
- Defaults in this file are incomplete / conflicting / unclear for the decision at hand
- A response shape, route map, or cashier/owner flow would be clearer from your design than from guessing
- Changing `@r2a/shared-types` or Prisma would be needed and wasn’t pre-approved
- Anything that feels like inventing product behavior rather than implementing a locked rule

**How to ask (keep it short):**

1. State the decision in one sentence.
2. List 2–3 options (or say what you’d invent if forced).
3. Ask whether you have a design/flow/visual, or which option to take.
4. Stop with: `⏸ Waiting for your design/decision before continuing Batch X.`
5. Do **not** write code for that decision until you answer (provide design, pick an option, or say “use default / invent X”).

### When the agent may proceed without asking

- Pure scaffolding / wiring already constrained by this file + master plan + existing Zod/Prisma
- Mechanical implementation of a **locked** default with no meaningful alternative
- Bugfixes / typos inside an already-approved approach in the same batch

### High-ask batches (expect questions)

| Batch | Likely ask topics |
|-------|-------------------|
| A | Usually low-ask — folder tree is locked |
| B | Usually low-ask — response envelope is locked |
| C | Token response shape only if unclear; staff create via `POST /users` is locked |
| D | Usually low-ask if JWT tenancy defaults are enough |
| E | Route map details if unclear; margin/sell rules are locked |
| F | Substitute payload shape if unclear; FEFO field names + optional `batchId` are locked |
| G | Payment sum / idempotent response shape if unclear; ingest path + optional `batchId` are locked |
| H | Whether to reset DB / which accounts to use for smoke |

### UI / Figma

Not required for M2 unless **you** want to share an API/flow visual. Cashier POS screen designs belong to Milestone 3 (safe to share later for E–G only if a flow would change API behavior).

---

## Batch overview

| Batch | Title | Primary area | Depends on |
|-------|-------|--------------|------------|
| **A** | Server scaffolding & tooling | `apps/server` | M1 |
| **B** | API foundation (errors, envelope, logging, health) | `apps/server` | A |
| **C** | Auth (register / login / JWT / protect / restrictTo) | auth module | B |
| **D** | Tenant context guard | middleware | C |
| **E** | Inventory CRUD (Products, Batches, Customers) + margin rules | domain modules | D |
| **F** | FEFO helper + generic substitutes | services + routes | E |
| **G** | Sales ingest (transactional, idempotent) | sales module | F |
| **H** | Exit verification & smoke | whole server | G |

Recommended chat order: **A → B → C → D → E → F → G → H**.

---

## Batch A — Server scaffolding & tooling

**Goal:** Turn `@r2a/server` from a stub into a runnable TypeScript Express app skeleton wired to the monorepo — **no domain business logic yet**.

### Tasks

- [x] Replace stub `apps/server/package.json` with real deps: `express`, TypeScript toolchain, `tsx`/`ts-node-dev` (or equivalent), `dotenv`, workspace deps on `@r2a/database` and `@r2a/shared-types`
- [x] Add `tsconfig.json` extending `tsconfig.base.json`
- [x] Scaffold locked folder tree: `src/index.ts`, `src/app.ts`, `config/`, `middlewares/`, `modules/`, `routes/`, `utils/` (empty module shells OK)
- [x] Scripts: `dev`, `build`, `start`, `lint` (no fake “echo stub” for core scripts)
- [x] Env loading strategy documented (root `.env` and/or `apps/server/.env`; never commit secrets). Align with `.env.example`
- [x] Ensure `DATABASE_URL` / `JWT_SECRET` are available to the server process
- [x] `npm install` at repo root succeeds; `npm run dev -w @r2a/server` boots (even if only a placeholder route)

### Allowed focus

- `apps/server/**`
- Root/workspace lockfile via install
- `.env.example` clarifications for server vars only

### Exit check

- Server package builds/starts
- Imports `@r2a/database` and `@r2a/shared-types` resolve
- Folder tree matches the locked layout
- No auth/domain CRUD yet (minimal hello/health stub OK if Batch B owns the polished health route)

### Ask-before-inventing

Usually low-ask. Folder tree is locked — do not invent an alternate layout.

### Agent prompt

```text
Implement ONLY Batch A from MILESTONE_2_EXECUTION.md (Server scaffolding & tooling).
Follow the ask-before-inventing protocol: if a design/flow/visual from me would be better
than inventing a decision, ask me and stop — do not invent on your own.
Do not implement auth, tenant guard, CRUD, FEFO, or sales ingest.
Follow PROJECT_MASTER_PLAN.md and Current_Status.md stack locks.
```

---

## Batch B — API foundation (errors, envelope, logging, health)

**Goal:** Port the legacy Express patterns into TypeScript and mount `/api/v1` with health + global error handling.

### Tasks

- [x] `AppError` (operational vs unknown)
- [x] `catchAsync` wrapper for async route handlers
- [x] `sendResponse` success envelope — **locked shape:** `{ status: "success", message, data?, meta? }`
- [x] Global error middleware — **locked shape:** `{ status: "fail"|"error", message, ... }` (no `{ success: false, error: { code, message } }`)
- [x] Zod request validation helper (body/query/params) that throws `AppError` on failure
- [x] Structured logger setup
- [x] `GET /api/v1/health` (and optionally `GET /health`) returning ok + basic meta (no secrets)
- [x] CORS from `CORS_ORIGIN`
- [x] Mount empty `/api/v1` router ready for modules

### Reference

- Master plan §2: patterns from deleted Mongo backend (`router → controller → service`, envelope helpers)
- Do **not** restore Mongoose

### Exit check

- Hitting health returns 200 with locked success envelope
- Invalid route / thrown `AppError` returns locked error JSON
- Logger emits on request or startup

### Ask-before-inventing

Envelope is locked. Ask only if logger choice is preference-sensitive.

### Agent prompt

```text
Implement ONLY Batch B from MILESTONE_2_EXECUTION.md
(API foundation: AppError, catchAsync, sendResponse, logging, health, /api/v1).
Follow ask-before-inventing: if design/flow from me is better than inventing, ask and stop.
Do not implement JWT auth or domain CRUD yet.
```

---

## Batch C — Auth (register / login / JWT / protect / restrictTo)

**Goal:** Working authentication using existing Zod schemas and Prisma `User` / `Tenant` / `Store`.

### Tasks

- [x] `POST /api/v1/auth/register` — validate `registerSchema`; create tenant + store + **OWNER only**; hash password (bcrypt); return safe user + tokens or login payload
- [x] `POST /api/v1/auth/login` — validate `loginSchema`; verify password; issue JWT with `{ sub, role, tenantId, storeId }` matching `jwtClaimsSchema`
- [x] `protect` middleware — verify Bearer JWT; attach claims to request
- [x] `restrictTo(...roles)` middleware
- [x] `GET /api/v1/auth/me` or `GET /api/v1/users/me` — protected; returns current user **without** password hash
- [x] `POST /api/v1/users` — **OWNER/MANAGER only**; create `CASHIER` or `MANAGER` in JWT tenant (no public cashier self-register). Minimal body: email, password, name?, role, optional storeId
- [x] Never return `passwordHash`
- [x] Use `@r2a/database` prisma client only
- [x] Do **not** add Super Admin platform / tenant-management routes

### Exit check

- Register + login work against Neon/seeded DB (or register-created tenant)
- Protected route rejects missing/invalid token
- Owner can create a cashier via `POST /users`; `restrictTo` blocks cashier from that route

### Ask-before-inventing

Staff-create path is locked. Ask only if token response shape or `/me` payload fields are unclear.

### Agent prompt

```text
Implement ONLY Batch C from MILESTONE_2_EXECUTION.md
(Auth: register, login, JWT, protect, restrictTo).
Follow ask-before-inventing: if design/flow from me is better than inventing, ask and stop.
Use @r2a/shared-types auth schemas and @r2a/database.
Do not build product/batch/customer/sale routes yet.
```

---

## Batch D — Tenant context guard

**Goal:** Enforce tenant isolation on every domain route going forward.

### Tasks

- [x] Tenant context middleware: after `protect`, set canonical `tenantId` (and `storeId`, `role`, `userId`) from JWT
- [x] Helper for Prisma queries: always pass `tenantId` from context — **ignore** client body `tenantId` if present
- [x] Apply guard to a domain router mount point (e.g. `/api/v1` domain routes)
- [x] Optional: reject cross-tenant `storeId` in body when it doesn’t match JWT (or isn’t under tenant)
- [x] Short code comment / README blurb in server only if needed: “tenantId from JWT only”

### Exit check

- A protected domain stub (or first real router shell) cannot run without tenant claims
- Documented rule is enforced in middleware, not “by convention” alone

### Ask-before-inventing

Usually low-ask if JWT tenancy defaults are enough. Ask only if store-matching / body `tenantId` rejection rules are ambiguous.

### Agent prompt

```text
Implement ONLY Batch D from MILESTONE_2_EXECUTION.md
(Tenant context guard middleware and wiring).
Follow ask-before-inventing: if design/flow from me is better than inventing, ask and stop.
Assume Batch C auth exists. Do not implement full inventory CRUD (Batch E) beyond proving the guard.
```

---

## Batch E — Inventory CRUD (Products, Batches, Customers) + margin rules

**Goal:** Tenant-scoped CRUD/search for inventory entities with cashier margin protection.

### Tasks

- [x] **Products:** create / update / get / search (use product Zod schemas); tenant-scoped; support units on create/update as schema allows (`factorToBase`)
- [x] **Batches:** create / update / list-by-product / get; tenant-scoped; use schema fields `expiryDate`, `quantityOnHand`, `costPerBase`, `sellPerBase`
- [x] **Customers:** create / update / get / search by phone/name; tenant-scoped
- [x] **RBAC:** cashiers blocked from mutating `costPerBase` / `sellPerBase` (and equivalent catalog economics); owners/managers allowed (`restrictTo`)
- [x] **Margin redaction:** responses for `CASHIER` strip `costPerBase` (and any margin/profit fields). **`sellPerBase` may remain** for checkout
- [x] All queries filtered by JWT `tenantId`
- [x] Controllers thin; business rules in services

### Reference docs

- `docs/Project_Handover.md` — cashier blocked from margins / base price edits
- `Current_Status.md` — payment/unit/role locks

### Exit check

- Owner token can create product + batch + customer
- Cashier token can read products needed for POS but **does not** receive `costPerBase` / margin fields; may receive `sellPerBase`
- Cashier cannot update cost / sell catalog price fields

### Ask-before-inventing

Margin/sell rules are locked. Ask only if route map details need a preference.

### Agent prompt

```text
Implement ONLY Batch E from MILESTONE_2_EXECUTION.md
(Products, Batches, Customers CRUD + cashier margin redaction).
Follow ask-before-inventing: if design/flow from me is better than inventing (routes, RBAC, margin fields), ask and stop.
Use tenant guard from Batch D. Do not implement FEFO, substitutes, or sales ingest yet.
Follow Current_Status.md payment/role locks.
```

---

## Batch F — FEFO helper + generic substitutes

**Goal:** Service-layer FEFO selection and generic substitute lookup endpoints.

### Tasks

- [x] FEFO service: given `productId` (+ tenant, store from JWT), return the batch with nearest `expiryDate` where `quantityOnHand > 0` (stable tie-break: earliest expiry, then batch id)
- [x] Route: `GET /api/v1/products/:productId/fefo-batch` — protected + tenant-scoped
- [x] Generic substitutes: `GET /api/v1/products/:productId/substitutes` — match `genericName`, same tenant, exclude self; include basic stock availability signal
- [x] Empty generic name → empty list (not error spam)
- [x] Cashier-safe responses (no `costPerBase` / margin leakage; `sellPerBase` OK)
- [x] **Shared-types (locked):** make `saleItemInputSchema.batchId` **optional** here or in Batch G — minimal Zod change; note in chat summary

### Exit check

- Against seed data, FEFO returns a sensible nearest-expiry in-stock batch for a known product (`quantityOnHand` / `expiryDate`)
- Substitute lookup returns other products sharing generic name when present (seed may have limited overlaps — add a tiny seed fixture **only if** user authorizes a seed change; otherwise test with a manually created pair via API)

### Ask-before-inventing

FEFO field names + optional `batchId` are locked. Ask only for substitute response shape or seed changes.

### Agent prompt

```text
Implement ONLY Batch F from MILESTONE_2_EXECUTION.md
(FEFO helper + generic substitute lookup).
Follow ask-before-inventing: if design/flow from me is better than inventing (FEFO/substitutes), ask and stop.
Assume inventory CRUD from Batch E exists. Do not implement sales ingest yet (Batch G).
```

---

## Batch G — Sales ingest (transactional, idempotent, FEFO-aware)

**Goal:** Authenticated sale creation that enforces stock, payments, idempotency, and FEFO rules.

### Tasks

- [x] `POST /api/v1/sales/ingest` (**locked path** — not `/sales`, not M4 `/sync/ingest`)
- [x] Validate with `saleIngestSchema` where `batchId` is **optional** (ensure shared-types change landed in F or here)
- [x] Resolve/validate each line’s batch: omitted → FEFO fill; provided → validate stock + tenant/store ownership
- [x] Convert/verify `unitQty` ↔ line `quantityBase` using `ProductUnit.factorToBase` when possible; reject inconsistent math
- [x] Transaction: create `Sale` + `SaleItem`s + `Payment`s; decrement batch `quantityOnHand`; reject insufficient stock
- [x] Idempotency: existing `eventId` returns prior sale (200/OK) without double-decrement
- [x] `storeId` must belong to JWT tenant (and match JWT store when present, per default rules)
- [x] Payments: allow `CASH` \| `CARD` \| `MFS` only; sum must match `total` exactly for M2
- [x] Cashier responses: no `costPerBase` / margin on nested batches; `sellPerBase` OK
- [x] No sale delete endpoint

### Exit check

- Authenticated ingest creates sale + decrements `quantityOnHand`
- Second ingest with same `eventId` does not double-sell
- FEFO path works (omitted `batchId` auto-pick and/or pre-resolved via helper)
- Cashier cannot see margins on sale-related payloads

### Ask-before-inventing

Ingest path + optional `batchId` are locked. Ask only if idempotent response shape needs a preference.

### Agent prompt

```text
Implement ONLY Batch G from MILESTONE_2_EXECUTION.md
(Sales ingest: transactional, idempotent, FEFO-aware).
Follow ask-before-inventing: if design/flow from me is better than inventing (ingest/FEFO/idempotency), ask and stop.
Reuse FEFO helper from Batch F and sale schemas from @r2a/shared-types.
Do not implement sync worker or Milestone 4 /sync/ingest pipeline.
```

---

## Batch H — Exit verification & smoke

**Goal:** Prove Milestone 2 exit criteria end-to-end; leave clear notes for M3.

### Tasks

- [x] Smoke script or documented curl/http checklist:
  1. Health (locked success envelope)
  2. Login as seeded owner
  3. `POST /api/v1/users` create a cashier
  4. Search products
  5. FEFO batch for a product (`quantityOnHand` / `expiryDate`)
  6. Ingest sale via `POST /api/v1/sales/ingest` with new `eventId` (with and/or without `batchId`)
  7. Re-ingest same `eventId` (idempotent)
  8. Login as cashier and confirm **no** `costPerBase`/margin fields; `sellPerBase` may appear
- [x] Confirm `restrictTo` blocks cashier from forbidden price edits and from creating users
- [x] Confirm server scripts in `package.json` are accurate (no stub lies)
- [x] Confirm `.env.example` lists server-needed vars
- [x] Confirm no Super Admin platform routes and no `/sync/ingest`
- [x] Report pass/fail against master plan exit: **Authenticated sale ingest with FEFO; cashier cannot see margins**
- [x] List M3 follow-ups without implementing them
- [x] Update `Current_Status.md` / master plan status **only if the user asks** in that chat

### Milestone 2 Definition of Done (all must pass)

- [x] Express TS API mounted at `/api/v1` with locked modular folder tree
- [x] Auth JWT with `{ sub, role, tenantId, storeId }`
- [x] Staff create via `POST /api/v1/users` (OWNER/MANAGER)
- [x] Tenant guard on domain routes
- [x] Products / Batches / Customers CRUD (tenant-scoped; schema field names)
- [x] FEFO helper + generic substitutes (`quantityOnHand`, `expiryDate`)
- [x] `POST /api/v1/sales/ingest` with stock decrement + `eventId` idempotency + optional `batchId` FEFO fill
- [x] Cashier cannot see margins (`costPerBase` stripped); may see `sellPerBase`
- [x] Locked response envelope; health + structured logging present
- [x] No MongoDB/Mongoose; no Super Admin platform; no M3+/M4 sync worker features started

### Ask-before-inventing

Ask before destructive DB resets or if smoke accounts/credentials are unclear. Otherwise run the locked exit checklist.

### Agent prompt

```text
Implement ONLY Batch H from MILESTONE_2_EXECUTION.md
(Exit verification & smoke for Milestone 2).
Follow ask-before-inventing: if a design/decision from me is better than inventing (e.g. DB reset), ask and stop.
Fix only blockers to M2 exit criteria. Do not start Milestone 3. Report clear pass/fail.
```

---

## Suggested fresh-chat sequence

1. Chat 1 → Batch A  
2. Chat 2 → Batch B  
3. Chat 3 → Batch C  
4. Chat 4 → Batch D  
5. Chat 5 → Batch E *(expect asks on routes/RBAC/margins)*  
6. Chat 6 → Batch F *(expect asks on FEFO/substitutes)*  
7. Chat 7 → Batch G *(expect asks on ingest flow)*  
8. Chat 8 → Batch H  

In every chat: agent implements the batch, but **asks you and stops** when inventing would be worse than using your design/flow/decision.

After Batch H passes, create `MILESTONE_3_EXECUTION.md` before desktop work (recommended), and authorize Milestone 3 explicitly.

---

## Progress tracker

| Batch | Status | Date | Notes |
|-------|--------|------|-------|
| A Server scaffolding | DONE | 2026-08-08 | Root `.env` only; Express+TS skeleton |
| B API foundation | DONE | 2026-08-08 | AppError, envelope, pino, health |
| C Auth | DONE | 2026-08-08 | JWT + hashed rotatable refresh tokens |
| D Tenant guard | DONE | 2026-08-08 | `protect` + `tenantContext` domain mount |
| E Inventory CRUD + margins | DONE | 2026-08-08 | Products/batches/customers; cashier redaction |
| F FEFO + substitutes | DONE | 2026-08-08 | Optional `batchId`; POS substitute shape |
| G Sales ingest | DONE | 2026-08-08 | FEFO fill, idempotent meta, stock txn |
| H Verification | DONE | 2026-08-09 | `npm run smoke:m2 -w @r2a/server` 13/13 |

---

## Change log

| Date | Change |
|------|--------|
| 2026-08-08 | Created from `PROJECT_MASTER_PLAN.md` + `Current_Status.md`; M2 split into Batches A–H for fresh-chat execution |
| 2026-08-08 | Clarified protocol: agent **asks the user** when design/flow/visual is better than inventing — does not invent designs unilaterally |
| 2026-08-08 | Applied locked decisions: Prisma field names (`quantityOnHand`/`expiryDate`), response envelope, folder tree, staff `POST /users`, optional FEFO `batchId`, `POST /sales/ingest`, Super Admin out of M2 product surface, no Baki tender |
