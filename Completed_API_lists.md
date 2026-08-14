# R2A Pharmacy POS — Completed API Lists

**Document type:** Cloud API reference for engineers joining or extending the project  
**Package:** `@r2a/server` (`apps/server`)  
**Base URL (dev):** `http://localhost:8787` (override with `PORT` / `BASE_URL`)  
**API prefix:** `/api/v1`  
**Last updated:** 2026-08-14  
**Milestone coverage:** **M2 — Cloud API core** (Batches A–H) + **M3 desktop POS shell DONE** (§14–§18 / Slices 2–6) + **M4 one-way sync DONE** (§19) + **M5 MVP hardening DONE** (**§20 — M5**)

> **Source of truth for contracts:** Zod schemas in `@r2a/shared-types`.  
> **Live status:** [`Current_Status.md`](Current_Status.md).  
> **Execution history:** [`MILESTONE_2_EXECUTION.md`](MILESTONE_2_EXECUTION.md), [`MILESTONE_3_EXECUTION.md`](MILESTONE_3_EXECUTION.md).  
> **Desktop note (Slice 1 A–K):** Consumes existing M2 routes (auth, health, products, batches, FEFO). Cart is local UI state.  
> **Desktop note (Slice 2 M–T):** Still **no new cloud endpoints**. Adds Select Customer (`GET /customers`), zero-pay complete via `POST /sales/ingest` (loyalty → `discount`, CASH ৳0), and desktop-only stubs (manager FEFO PIN, loyalty OTP). See **§14**.  
> **Desktop note (Slice 3 V–Y):** Still **no new cloud endpoints**. Payment Select Method + Cash tender → `POST /sales/ingest` with `CASH` amount = due; shared Sale Completed + print **stub**. Card/MFS were gated in Slice 3 — **ungated in Slice 4** (§16).  
> **Desktop note (Slice 4 AA–AD):** Still **no new cloud endpoints**. Receipt Preview (dynamic lines); Card stub terminal → `CARD` ingest; MFS bKash/Nagad/Rocket + **invented** confirm/result → `MFS` ingest (+ provider meta in `notes`). See **§16**.  
> **Desktop note (Slice 5 AF–AL):** Still **no new cloud endpoints**. F4 substitutes (`GET /products/:id/substitutes`); Settings pharmacy header → Receipt Preview; Force Offline; Transactions list/detail/reprint from local log; Shift open/close local; Create Customer removed from POS; `POST /customers` **OWNER-only**. See **§17**.  
> **Desktop note (Slice 6 AM–AP):** Still **no new cloud endpoints**. Hold / Park Sale is **local** (`heldSaleStore`, max 3 soft holds); **F6** Hold + **F7** Held list (toggle); resume rechecks live stock/expiry (strip/clamp); mid-payment Hold aborts card/MFS stubs and does **not** ingest. **No** hard reservation / cloud hold / multi-terminal shared holds. See **§18**.  
> **M3 closed (2026-08-13):** Desktop POS shell complete. Later screens → Slice 7+. No new cloud routes in M3.  
> **M4 closed (2026-08-14):** One-way offline→cloud sync. New cloud route `POST /api/v1/sync/ingest` (reuses `ingestSale`). Desktop 15s worker + Sync Queue panel. See **§19**.  
> **M5 closed (2026-08-14):** **§20 — M5** — PATCH RBAC, desktop Receive stock (no new routes), Sync Queue 409 copy, paged catalog pull. Print / FEFO PIN stay stubs. See **§20**.  
> **M5 Batch A (2026-08-14):** `PATCH /customers/:id` and `PATCH /batches/:id` are **`OWNER`, `MANAGER`** (cashier `403`, including batch qty). No new routes.  
> **M5 Batch C (2026-08-14):** Desktop Settings → Receive stock (Owner/Manager, online only) uses existing `POST /api/v1/batches` and `PATCH /api/v1/batches/:id` (`quantityOnHand`). No new cloud routes.  
> **M5 Batch E (2026-08-14):** Desktop `catalogPull` pages `GET /products` and `GET /batches` (`limit=100` + `offset` until `meta.total`, cap 50 pages / 5000 rows). Still **no** `costPerBase` in the local cache. No new cloud routes. No CSV.  
> **FEFO display (desktop):** Search cards prefer the earliest **sellable** (non-expired) lot. Cloud `GET …/fefo-batch` still returns the earliest **in-stock** lot by expiry (may be expired). See §8.5.  
> **Demo seed:** Napa `NAPA-500` ships with **4 lots** for Select Batch UX (`NP23091` FEFO · `NP24031` · `NP24052` · `NP23010` expired). Customer **Karim** ships with **120** loyalty points. Re-run `npm run db:seed` after pull.

---

## 1. How to read this document

| Symbol | Meaning |
|--------|---------|
| Public | No `Authorization` header |
| Bearer | Requires `Authorization: Bearer <accessToken>` |
| Tenant | After auth, `tenantId` comes **only from JWT** (body `tenantId` is ignored/stripped) |
| RBAC | Extra role checks via `restrictTo(...)` |

**Stack:** Express + TypeScript → `router → controller → service` → Prisma (`@r2a/database`) → Neon PostgreSQL.

**Run locally**

```bash
# Terminal 1 — ensure repo-root `.env` has DATABASE_URL + JWT_SECRET (see `.env.example`)
npm run dev -w @r2a/server

# Terminal 2 — optional exit smoke
npm run smoke:m2 -w @r2a/server
```

**Seeded demo login**

| Field | Value |
|-------|--------|
| Owner email | `owner@demo.local` |
| Manager email | `manager@demo.local` |
| Cashier email | `cashier@demo.local` |
| Password (all three) | `ChangeMe123!` |
| Tenant slug | `demo-pharmacy` |

---

## 2. Conventions that apply to every endpoint

### 2.1 Success envelope (locked)

```json
{
  "status": "success",
  "message": "Human-readable message",
  "data": {},
  "meta": {}
}
```

- `data` and `meta` are optional (omitted when unused).
- Do **not** expect `{ "success": true }` — that shape is not used.

### 2.2 Error envelope (locked)

```json
{
  "status": "fail",
  "message": "Why it failed",
  "stack": "(development only)"
}
```

| `status` | Typical HTTP | Meaning |
|----------|--------------|---------|
| `fail` | 4xx | Operational / client error (`AppError`) |
| `error` | 5xx | Unexpected server error |

Common status codes: `400` validation, `401` auth, `403` forbidden, `404` not found, `409` conflict (duplicate / insufficient stock).

### 2.3 Authentication

1. **Access token (JWT)** — short-lived (default `JWT_EXPIRES_IN=15m`).  
   Header: `Authorization: Bearer <accessToken>`
2. **Refresh token** — opaque string; only a SHA-256 hash is stored in `RefreshToken`.  
   Rotate on every `/auth/refresh`. Reusing a revoked refresh token revokes **all** sessions for that user.

**JWT claims (payload)** — must match `jwtClaimsSchema`:

| Claim | Type | Meaning |
|-------|------|---------|
| `sub` | string | User id |
| `role` | `SUPER_ADMIN` \| `OWNER` \| `MANAGER` \| `CASHIER` | RBAC role |
| `tenantId` | string | Tenant scope for all domain queries |
| `storeId` | string \| null | Assigned store (cashiers are store-scoped) |

Never put email or password in the JWT. Never trust `tenantId` from the request body.

### 2.4 Domain middleware chain

Protected domain routes run:

1. `protect` — verify Bearer JWT → `req.auth`
2. `tenantContext` — set `req.ctx = { userId, tenantId, storeId, role }` from JWT; strip body `tenantId`

### 2.5 Naming & units

- API DTOs: **camelCase** (Prisma-aligned).
- Quantities / batch prices: **base unit = PIECE**.
- Batch fields (locked names): `expiryDate`, `quantityOnHand`, `costPerBase`, `sellPerBase`.
- Payments: `CASH` \| `CARD` \| `MFS` only (**no Baki**).

### 2.6 Cashier margin rules

| Field | Cashier |
|-------|---------|
| `costPerBase` | **Omitted** from responses; cannot mutate |
| `sellPerBase` | **Allowed** (needed for checkout) |
| Derived margin/profit | Must not appear |

Owners / managers see `costPerBase` on batch payloads.

### 2.7 Not implemented (do not call)

| Path / feature | Why |
|----------------|-----|
| Sale delete / update | Sales are append-only |
| Super Admin platform routes | Role exists; no console API in M2 |
| Payment gateway charge APIs | Enum only; no Card/MFS processor integration yet |
| Manager FEFO override verify / audit | Desktop stub only (Slice 2) — see §15.3 |
| Loyalty OTP send / verify | Desktop stub only (Slice 2) — see §15.3 |
| Loyalty earn/redeem mutate on ingest | Not in M2 schema — mapped via `discount` + `notes` for now |

---

## 3. Quick route index

| Method | Path | Auth | Roles |
|--------|------|------|-------|
| GET | `/health` | Public | — |
| GET | `/api/v1/health` | Public | — |
| POST | `/api/v1/auth/register` | Public | — |
| POST | `/api/v1/auth/login` | Public | — |
| POST | `/api/v1/auth/refresh` | Public | — |
| POST | `/api/v1/auth/logout` | Public | — |
| GET | `/api/v1/tenant/context` | Bearer | Any authenticated |
| GET | `/api/v1/users/me` | Bearer | Any authenticated |
| POST | `/api/v1/users` | Bearer | `OWNER`, `MANAGER` |
| GET | `/api/v1/products` | Bearer | Any authenticated |
| POST | `/api/v1/products` | Bearer | `OWNER`, `MANAGER` |
| GET | `/api/v1/products/:id` | Bearer | Any authenticated |
| PATCH | `/api/v1/products/:id` | Bearer | `OWNER`, `MANAGER` |
| GET | `/api/v1/products/:productId/fefo-batch` | Bearer | Any authenticated |
| GET | `/api/v1/products/:productId/substitutes` | Bearer | Any authenticated |
| GET | `/api/v1/batches` | Bearer | Any authenticated |
| POST | `/api/v1/batches` | Bearer | `OWNER`, `MANAGER` |
| GET | `/api/v1/batches/:id` | Bearer | Any authenticated |
| PATCH | `/api/v1/batches/:id` | Bearer | `OWNER`, `MANAGER` (cashier `403`, including qty) |
| GET | `/api/v1/customers` | Bearer | Any authenticated |
| POST | `/api/v1/customers` | Bearer | **`OWNER` only** (not Manager; not on desktop POS — Owner web later) |
| GET | `/api/v1/customers/:id` | Bearer | Any authenticated |
| PATCH | `/api/v1/customers/:id` | Bearer | `OWNER`, `MANAGER` (cashier `403`) |
| POST | `/api/v1/sales/ingest` | Bearer | Any authenticated |
| POST | `/api/v1/sync/ingest` | Bearer | Any authenticated |

Cashier GET still omits `costPerBase`. Price-field `403` remains defense-in-depth on PATCH; the route itself is Owner/Manager only (M5 Batch A).

---

## 4. Health

### `GET /health` and `GET /api/v1/health`

**Auth:** Public  

**Success `200`**

```json
{
  "status": "success",
  "message": "OK",
  "data": {
    "ok": true,
    "service": "@r2a/server",
    "env": "development",
    "timestamp": "2026-08-09T08:00:00.000Z"
  }
}
```

No secrets are returned.

---

## 5. Auth (`/api/v1/auth`)

Shared safe user object (never includes `passwordHash`):

```json
{
  "id": "cuid...",
  "name": "Demo Owner",
  "email": "owner@demo.local",
  "role": "OWNER",
  "tenantId": "cuid...",
  "storeId": "cuid...",
  "isActive": true,
  "createdAt": "2026-08-08T00:00:00.000Z"
}
```

Token pair `data` shape (register / login / refresh):

```json
{
  "user": { "...safe user..." },
  "accessToken": "<jwt>",
  "refreshToken": "<opaque>",
  "expiresIn": "15m"
}
```

### 5.1 `POST /api/v1/auth/register`

Creates **Tenant + Store + OWNER** user in one transaction. No public cashier self-register.

**Body**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | string | yes | Owner display name |
| `email` | string (email) | yes | Unique per tenant |
| `password` | string | yes | Min 8 chars |
| `tenantName` | string | yes | Pharmacy / org name |
| `tenantSlug` | string | yes | Lowercase kebab-case (`^[a-z0-9]+(?:-[a-z0-9]+)*$`) |
| `storeName` | string | no | Defaults to `"Main Store"` |

**Success `201`** — message `"Account created"` + token pair.  
**Errors:** `409` slug taken; `400` validation.

### 5.2 `POST /api/v1/auth/login`

**Body**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `email` | string | yes | |
| `password` | string | yes | Min 8 |
| `tenantSlug` | string | no | Required when the same email exists in multiple tenants |

**Success `200`** — message `"Logged in"` + token pair.  
**Errors:** `401` invalid credentials; `400` if `tenantSlug` required; `403` inactive tenant.

### 5.3 `POST /api/v1/auth/refresh`

Rotates refresh token; issues new access + refresh.

**Body:** `{ "refreshToken": "<opaque>" }`  

**Success `200`** — message `"Token refreshed"` + token pair.  
**Errors:** `401` invalid/expired/reuse (reuse → all sessions revoked).

### 5.4 `POST /api/v1/auth/logout`

Revokes the presented refresh token (idempotent if already revoked/missing).

**Body:** `{ "refreshToken": "<opaque>" }`  

**Success `200`** — message `"Logged out"` (no `data` required).

---

## 6. Tenant context

### `GET /api/v1/tenant/context`

**Auth:** Bearer  

**Success `200`**

```json
{
  "status": "success",
  "message": "OK",
  "data": {
    "userId": "...",
    "tenantId": "...",
    "storeId": "...",
    "role": "OWNER"
  }
}
```

Use this to confirm JWT tenancy wiring. Domain queries always filter by `tenantId` from here / JWT — never from body.

---

## 7. Users (`/api/v1/users`)

### 7.1 `GET /api/v1/users/me`

**Auth:** Bearer  

**Success `200`** — `data` = safe user (no password hash).

### 7.2 `POST /api/v1/users`

Create staff in the **JWT tenant** only.

**Auth:** Bearer  
**RBAC:** `OWNER` \| `MANAGER` only (`CASHIER` → `403`)

**Body**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `email` | string | yes | Unique within tenant |
| `password` | string | yes | Min 8 |
| `name` | string | no | Defaults from email local-part |
| `role` | `CASHIER` \| `MANAGER` | yes | Cannot create `OWNER` / `SUPER_ADMIN` here |
| `storeId` | string | no | Must belong to tenant; cashiers with JWT store are store-scoped |

**Success `201`** — message `"Staff user created"` + safe user.  
**Errors:** `409` email exists; `400` bad `storeId`; `403` role denied.

Sending `tenantId` in the body has **no effect** (stripped).

---

## 8. Products (`/api/v1/products`)

### 8.1 `GET /api/v1/products` — search

**Auth:** Bearer  

**Query**

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `q` | string | — | Matches name / genericName / sku / barcode (insensitive contains) |
| `barcode` | string | — | Exact |
| `sku` | string | — | Exact |
| `genericName` | string | — | Contains |
| `isActive` | bool | — | `true`/`false`/`1`/`0` |
| `limit` | int | 20 | Max 100 |
| `offset` | int | 0 | |

**Success `200`** — `data`: product array (includes `units`); `meta`: `{ total, limit, offset }`.

### 8.2 `POST /api/v1/products`

**Auth:** Bearer · **RBAC:** `OWNER` \| `MANAGER`

**Body**

| Field | Type | Required |
|-------|------|----------|
| `name` | string | yes |
| `genericName` | string | no |
| `sku` | string | no |
| `barcode` | string | no |
| `description` | string | no |
| `units` | array | yes (min 1) |

Each unit:

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `unitType` | `BOX` \| `STRIP` \| `PIECE` | yes | |
| `factorToBase` | positive int | yes | e.g. STRIP=10, BOX=100, PIECE=1 |
| `label` | string | no | Display override |

**Success `201`**. **Errors:** `409` duplicate sku/barcode in tenant.

### 8.3 `GET /api/v1/products/:id`

**Auth:** Bearer · **Success `200`** — product + units. Tenant-scoped.

### 8.4 `PATCH /api/v1/products/:id`

**Auth:** Bearer · **RBAC:** `OWNER` \| `MANAGER`  

Partial update; if `units` provided, existing unit rows are replaced.

### 8.5 `GET /api/v1/products/:productId/fefo-batch`

Picks the batch with nearest `expiryDate` where `quantityOnHand > 0` (tie-break: earliest expiry, then batch id). Scoped to JWT tenant + store (`?storeId=` allowed when JWT has no store — owners).

**Auth:** Bearer  

**Success `200`** — single batch object (cashier: no `costPerBase`).  
**Errors:** `404` product missing or no in-stock batch; `400` if store cannot be resolved.

**Important — cloud vs desktop POS**

| Layer | Which lot is “FEFO”? |
|-------|----------------------|
| **This API** + sales ingest FEFO-fill | Earliest **in-stock** by `expiryDate` — **can be expired** if that lot still has qty |
| **Desktop search card** (`productSearch.enrichProductWithBatches`) | Earliest **sellable** lot (`expiryDate ≥ today`, qty > 0). Product shows EXPIRED / blocked only when **no** sellable stock remains |
| **Desktop Select Batch modal** | Lists all in-stock lots; highlights sellable FEFO; expired rows visible but **not confirmable** |

With the demo Napa seed, this API may return `NP23010` (expired) because it is the earliest in-stock expiry. The desktop **ignores that for the search card** and shows `NP23091` (FEFO Recommended) instead. Call `GET /batches?productId=` for the full lot list the modal uses.

### 8.6 `GET /api/v1/products/:productId/substitutes`

Other active products in the same tenant with the **same `genericName`** (active ingredient). Empty/missing generic → `data: []` (not an error).

**Auth:** Bearer · Optional `?storeId=`

**Each item in `data`**

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Product id |
| `name` | string | |
| `genericName` | string \| null | |
| `sku` | string \| null | |
| `barcode` | string \| null | |
| `inStock` | boolean | Any qty > 0 at store |
| `availableQuantityBase` | number | Sum of in-stock batch qty (PIECE) |
| `nearestSellPerBase` | number \| null | POS sell price signal |
| `nearestExpiryDate` | string \| null | `YYYY-MM-DD` |
| `isExpired` | boolean | Nearest lot already past today (UTC date) |

Sorted: in-stock first, then name. **No `costPerBase`.**

---

## 9. Batches (`/api/v1/batches`)

All prices/qty are in **PIECE** base units.

### 9.1 `GET /api/v1/batches`

**Auth:** Bearer  

**Query:** `productId?`, `storeId?`, `limit` (default 50), `offset` (default 0).  

Cashiers without an explicit `storeId` query are limited to their JWT store when set.

**Success `200`** — `data` array of batches; `meta` pagination. Cashier responses omit `costPerBase`.

### 9.2 `POST /api/v1/batches`

**Auth:** Bearer · **RBAC:** `OWNER` \| `MANAGER`

**Body**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `productId` | string | yes | Must be in tenant |
| `storeId` | string | no | Defaults to JWT `storeId` |
| `batchNumber` | string | yes | Unique per tenant+store+product |
| `expiryDate` | date | yes | Coerced from ISO / date string |
| `quantityOnHand` | int ≥ 0 | yes | |
| `costPerBase` | number ≥ 0 | yes | |
| `sellPerBase` | number ≥ 0 | yes | |

**Success `201`**.

### 9.3 `GET /api/v1/batches/:id`

**Auth:** Bearer · Tenant-scoped · Margin-redacted for cashiers.

### 9.4 `PATCH /api/v1/batches/:id`

**Auth:** Bearer · **`restrictTo("OWNER", "MANAGER")`** (M5 Batch A). Cashiers receive **`403`** for any PATCH, including `{ "quantityOnHand": … }`. Receiving / qty adjust is Owner/Manager only.

Updatable: `batchNumber`, `expiryDate`, `quantityOnHand`, `costPerBase`, `sellPerBase` (at least one required).

If body includes `costPerBase` or `sellPerBase` and role is `CASHIER` → **`403`** `"Cashiers cannot mutate costPerBase or sellPerBase"` (defense-in-depth; cashiers no longer reach this handler).

---

## 10. Customers (`/api/v1/customers`)

### 10.1 `GET /api/v1/customers`

**Auth:** Bearer  

**Query:** `q?` (name/phone/email contains), `phone?`, `name?`, `limit` (20), `offset` (0).

### 10.2 `POST /api/v1/customers`

**Auth:** Bearer · **`restrictTo("OWNER")` only** (2026-08-12). Managers and Cashiers receive `403`. Desktop POS has **no** Create Customer UI — Owner web deferred.

**Body:** `{ "name": string, "phone"?: string, "email"?: string }`  

**Success `201`**. **Errors:** `403` non-owner; `409` duplicate phone in tenant.

### 10.3 `GET /api/v1/customers/:id`

**Auth:** Bearer

### 10.4 `PATCH /api/v1/customers/:id`

**Auth:** Bearer · **`restrictTo("OWNER", "MANAGER")`** (M5 Batch A). Cashiers receive **`403`** (search-only at POS). Owner web edit UI is **M6**.

Partial: `name?`, `phone?` (nullable), `email?` (nullable).

**Not updatable via this PATCH:** `loyaltyPoints`, `creditBalance`. Slice 2 POS applies loyalty settlement in **session only** after zero-pay complete (display on Sale Completed). Authoritative cloud mutation is a planned gap (§15.3).

Response objects may include `loyaltyPoints` and `creditBalance`. Desktop Select Customer **must not** surface `creditBalance` as Baki (product lock: no Baki).

---

## 11. Sales ingest (`/api/v1/sales`)

### `POST /api/v1/sales/ingest`

**Auth:** Bearer  
**Purpose:** Online authenticated sale creation (append-only). Offline / Force Offline / network-5xx completes use **`POST /api/v1/sync/ingest`** instead (§19). Do **not** merge the two paths.

#### Request body

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `eventId` | string | yes | Global unique idempotency key → `Sale.eventId` |
| `storeId` | string | yes | Must belong to JWT tenant (cashiers: match assigned store) |
| `customerId` | string | no | Must be in tenant |
| `soldAt` | date | no | Defaults to now |
| `subtotal` | number ≥ 0 | yes | Must equal sum of `lineTotal`s |
| `discount` | number ≥ 0 | no | Default `0`; `total` must equal `subtotal − discount` |
| `total` | number ≥ 0 | yes | Must equal sum of payment `amount`s |
| `notes` | string | no | |
| `items` | array | yes | Min 1 |
| `payments` | array | yes | Min 1; methods `CASH`\|`CARD`\|`MFS` |

**Line item**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `productId` | string | yes | |
| `batchId` | string | **no** | Omit → server **FEFO**-fills for store+product |
| `unitType` | `BOX`\|`STRIP`\|`PIECE` | yes | Must exist on product units |
| `unitQty` | positive int | yes | Qty in that unit |
| `quantityBase` | positive int | yes | Must equal `unitQty × factorToBase` |
| `unitPrice` | number ≥ 0 | yes | Price per sold unit |
| `lineTotal` | number ≥ 0 | yes | Must equal `unitQty × unitPrice` (cent-rounded) |

**Payment line:** `{ "method": "CASH"|"CARD"|"MFS", "amount": number, "reference"?: string }`

#### Server behavior (transaction)

1. If `eventId` already exists for tenant → return existing sale (**no** stock change).
2. Validate store access, payment sum, math, product units.
3. Resolve each batch (explicit or FEFO); reject insufficient stock (`409`).
4. Create `Sale` + `SaleItem`s + `Payment`s; decrement each batch `quantityOnHand`.
5. No sale delete endpoint.

#### Responses

**Created `201`**

```json
{
  "status": "success",
  "message": "Sale ingested",
  "data": { "...sale with items + payments + nested batch..." },
  "meta": { "idempotent": false }
}
```

**Idempotent replay `200`**

```json
{
  "status": "success",
  "message": "Sale already ingested",
  "data": { "...same sale..." },
  "meta": { "idempotent": true }
}
```

Nested `items[].batch` is margin-safe for cashiers (`sellPerBase` ok; no `costPerBase`).

#### Zero-pay (loyalty full cover) — M3 Slice 2

M2 already accepts `total: 0` and payment `amount: 0` (`nonnegative`). Desktop maps:

| POS concept | Ingest field |
|-------------|--------------|
| Cart merchandise subtotal | `subtotal` |
| Loyalty redeem (1 pt = ৳1) + any cart discount | `discount` so `total = subtotal − discount` |
| Amount due ৳0 | `total: 0` |
| Tender | `payments: [{ "method": "CASH", "amount": 0 }]` (min 1 payment required) |
| Loyalty / FEFO override audit (stub) | `notes` strings (`loyaltyRedeem:…`, `fefoOverride:…`) — **not** first-class fields yet |

~~Online required for Slice 2 zero-pay complete~~ → **M4** queues Cash / Card / MFS / zero-pay when Offline, Force Offline, or ingest is network/5xx (§19). Online happy path is still this route.

#### Example (FEFO — omit `batchId`)

```json
{
  "eventId": "pos-offline-or-online-uuid-001",
  "storeId": "<store-cuid>",
  "subtotal": 12,
  "discount": 0,
  "total": 12,
  "items": [
    {
      "productId": "<product-cuid>",
      "unitType": "PIECE",
      "unitQty": 10,
      "quantityBase": 10,
      "unitPrice": 1.2,
      "lineTotal": 12
    }
  ],
  "payments": [{ "method": "CASH", "amount": 12 }]
}
```

---

## 12. Typical cashier POS flow (using these APIs)

```text
1. POST /auth/login                          → accessToken + refreshToken
2. GET  /products?q=Napa                     → pick product (desktop enriches from batches)
3. GET  /batches?productId=:id               → Select Batch list (FEFO + expired rows)
4. GET  /products/:id/fefo-batch             → optional; desktop prefers sellable FEFO for search card
5. GET  /products/:id/substitutes            → alternate brands (same generic) — wired M3 Batch AG (F4)
6. GET  /customers?q=…                       → Select Customer (F8); Create form = later slice
7. POST /sales/ingest                        → online complete (zero-pay · Cash · Card/MFS)
7b. POST /sync/ingest                        → M4 worker flush of queued offline sales (same payload / eventId)
8. On 401: POST /auth/refresh                → new tokens; retry
9. On logout: POST /auth/logout              → revoke refresh
```

**Demo seed — Napa 500mg (`sku: NAPA-500`, Beximco)** after `npm run db:seed`:

| Batch No. | Expiry | Qty | Select Batch status |
|-----------|--------|-----|---------------------|
| `NP23091` | 2026-08-31 | 14 pcs | **FEFO Recommended** (search card front) |
| `NP24031` | 2026-10-31 | 124 pcs | Standard |
| `NP24052` | 2027-03-31 | 86 pcs | Standard |
| `NP23010` | 2024-05-31 | 12 pcs | Expired - Not Sellable (detail only) |

Retired demo lot `NP-2408-A` is zeroed on re-seed (kept if referenced by `SaleItem`).

Owner catalog setup (before POS):

```text
POST /products → POST /batches → POST /users (cashier)
```

---

## 13. Where the code lives

| Concern | Path |
|---------|------|
| App mount | `apps/server/src/app.ts`, `src/routes/index.ts` |
| Auth | `apps/server/src/modules/auth/` |
| Users | `apps/server/src/modules/user/` |
| Products / FEFO / substitutes | `apps/server/src/modules/product/` |
| Batches | `apps/server/src/modules/batch/` |
| Customers | `apps/server/src/modules/customer/` |
| Sales ingest | `apps/server/src/modules/sale/` |
| Sync ingest | `apps/server/src/modules/sync/` |
| Zod contracts | `packages/shared-types/src/` |
| Prisma schema | `packages/database/prisma/schema.prisma` |
| Exit smoke | `apps/server/scripts/m2-smoke.mjs` |
| Slice 2 exit smoke | `apps/desktop/scripts/smoke-m3u.ts` (`npm run smoke:m3u -w @r2a/desktop`) |
| Slice 3 exit smoke | `apps/desktop/scripts/smoke-m3z.ts` (`npm run smoke:m3z -w @r2a/desktop`) |
| Slice 4 exit smoke | `apps/desktop/scripts/smoke-m3ae.ts` (`npm run smoke:m3ae -w @r2a/desktop`) |
| M4 cloud ingest smoke | `apps/server/scripts/m4b-smoke.mjs` (`npm run smoke:m4b -w @r2a/server`) |
| M4 desktop exit smoke | `apps/desktop/scripts/smoke-m4.ts` (`npm run smoke:m4 -w @r2a/desktop`; composes m4a/c/d/e + m3ap) |

---

## 14. M3 Slice 2 — desktop consumption & planned APIs (Batch U)

**No new Express routes** were added for Slice 2. Desktop (`@r2a/desktop`) reuses M2 and documents stubs / gaps below.

### 14.1 Cloud routes used by Slice 2

| Desktop capability | Route(s) | Notes |
|--------------------|----------|-------|
| Session / refresh | `POST /auth/login`, `POST /auth/refresh`, `GET /users/me` | Invented login UI; tokens in webview localStorage (MVP) |
| Connectivity badge | `GET /api/v1/health` | Online/offline flip |
| Catalog search / batches | `GET /products`, `GET /batches`, `GET /products/:id/fefo-batch` | Offline = SQLite cache |
| Select Customer (F8) | `GET /customers` | No Baki UI; Create **removed** (Owner web M6) |
| Zero-pay complete | `POST /sales/ingest` | Loyalty → `discount`; CASH ৳0; see §11 |

### 14.2 Desktop-only (no cloud)

| Feature | Behavior |
|---------|----------|
| Edit Sale Item / Change Batch / Active Cart | Local cart state |
| Manager FEFO Authorization | Stub: any **4-digit** PIN + local “Authorized By” list |
| Loyalty OTP verify | Stub: any **6-digit** OTP |
| Continue without redeeming | Opens **Payment - Select Method** (Slice 3 Batch V) |
| Loyalty calculator | `apps/desktop/src/lib/loyaltyCalc.ts` + `loyaltyRedeem.ts` — redeem 1:1 ৳, eligibility ≥50, cap `min(pts, floor(sale))`, earn `floor(net/100)` unless full cover → earn 0 |
| Sale Completed loyalty bal | Session display only (previous / earned / used / current) |
| Print receipt | See **§15** (print stub) + **§16** (Receipt Preview) |
| Chrome | Locked to **Search Results - Napa** |

### 14.3 Planned / TODO cloud endpoints (do not forget)

Recorded from Slice 2 locks — implement later (not in Batch U):

| Need | Suggested direction |
|------|---------------------|
| Real manager FEFO override | Verify MANAGER/OWNER PIN or password; role check; audit log; **FEFO override flag on sale line / ingest** |
| Real loyalty OTP | Send SMS/WhatsApp (n8n later); server-side verify; rate limit |
| Loyalty earn/redeem persistence | Authoritative mutation on sale ingest (or dedicated routes); extend `PATCH /customers` and/or ingest payload beyond `discount`/`notes` |
| ~~Offline completed sale → queue~~ | **Done in M4** (§19) — `outbound_sync_queue` + `POST /sync/ingest` |

~~Cash / Card / MFS tender~~ → Slice 3 Cash (§15) + Slice 4 Card/MFS (§16) done.

### 14.4 Slice 2 exit smoke

```bash
npm run smoke:m3u -w @r2a/desktop
```

Checks loyalty calculator units, static no-tender/Baki/M4 guards, and live zero-pay `POST /sales/ingest` (1 PIECE Napa, loyalty discount → total 0).

---

## 15. M3 Slice 3 — tender + print stub (Batch Z)

**No new Express routes** were added for Slice 3. Desktop reuses M2 `POST /sales/ingest` for Cash and keeps Card/MFS detail gated.

### 15.1 Cloud routes used by Slice 3

| Desktop capability | Route(s) | Notes |
|--------------------|----------|-------|
| Session / health / catalog | Same as §14.1 | Unchanged |
| Select Customer (F8) | `GET /customers` | Walk-in allowed on Payment (hide points row) |
| Loyalty zero-pay | `POST /sales/ingest` | Still CASH ৳0 + loyalty → `discount` (§11 / §14) |
| Cash tender complete | `POST /sales/ingest` | `payments: [{ method: "CASH", amount: due }]`; cash received / change go in `notes` only (`cash:recv=…;change=…`) — **not** payment amount |

### 15.2 Desktop-only (no cloud)

| Feature | Behavior |
|---------|----------|
| Payment - Select Method | Cash / Card / MFS cards; **single method** only; ←→ no Tab |
| Cash Payment | Exact Amount / change; Complete when received ≥ due |
| Card / MFS detail | ~~Gated~~ → **Slice 4** ungated (§16) |
| Shared Sale Completed | One shell for loyalty zero-pay + cash settlement variant |
| Print stub states | `idle → printing → printed` or `failed → retrying → …`; auto-start; footer **SYSTEM BUSY** / **READY** |
| Print QA fail | Dev: `window.__r2aArmPrintFailOnce()` then Reprint / Retry |
| Loyalty calculator | Reused (`loyaltyCalc`); earn **1 pt / ৳100** unchanged |
| Chrome | Static **Search Results - Napa** |

### 15.3 TODOs (Slice 3 exit — do not forget)

| Need | Notes |
|------|-------|
| Real Tauri **printer IPC** | Shared sample is **58mm** thermal; format ESC/POS from sale data — do not invent a full layout engine in UI. See `apps/desktop/src/lib/printStub.ts` + `apps/desktop/README.md`. **Still open** (Slice 4 Receipt Preview feeds same model). |
| ~~**Card** payment detail~~ | **Done in Slice 4** (§16) — stub terminal only |
| ~~**MFS** payment detail~~ | **Done in Slice 4** (§16) — providers + invented confirm |
| Loyalty earn/redeem persistence | Same gap as §14.3 — session display only today |
| ~~Offline cash/zero-pay → queue~~ | **Done in M4** (§19) |

### 15.4 Slice 3 exit smoke

```bash
npm run smoke:m3z -w @r2a/desktop
```

Checks earn lock, print stub helpers + IPC TODO, Payment/Cash/Sale Completed wiring, Card/MFS/Baki/M4 guards *(historical: Card/MFS were gated at Z)*, live walk-in cash ingest + zero-pay ingest.

**Manual UI path (Slice 3 era):** Continue without redeeming → Payment → Cash → change → Sale Completed → print states; Card/MFS were gated then. For Card/MFS + Receipt Preview see **§16**.

---

## 16. M3 Slice 4 — Card / MFS / Receipt Preview (Batch AE)

**No new Express routes** were added for Slice 4. Desktop reuses M2 `POST /sales/ingest` with `CARD` / `MFS` payment methods; provider / terminal meta go in `notes` only (schema has no payment-provider field).

### 16.1 Cloud routes used by Slice 4

| Desktop capability | Route(s) | Notes |
|--------------------|----------|-------|
| Session / health / catalog / customers | Same as §14.1 / §15.1 | Unchanged |
| Loyalty zero-pay | `POST /sales/ingest` | Still CASH ৳0 + loyalty → `discount` |
| Cash tender | `POST /sales/ingest` | `payments: [{ method: "CASH", amount: due }]`; recv/change in `notes` |
| Card tender complete | `POST /sales/ingest` | `payments: [{ method: "CARD", amount: due }]`; notes `card:status=Approved` |
| MFS tender complete | `POST /sales/ingest` | `payments: [{ method: "MFS", amount: due }]`; notes `mfs:provider=BKASH\|NAGAD\|ROCKET;payer=…;trx=…` (trx optional) |

**Single tender** still holds: one payment line per sale. Amount = amount due (not cash received).

### 16.2 Desktop-only (no cloud)

| Feature | Behavior |
|---------|----------|
| Receipt Preview | Inline beside Sale Completed; **80mm** default / **58mm** toggle; dynamic ITEM/QTY/RATE/AMT from completed sale; stub pharmacy header (`STUB_PHARMACY_HEADER`); `INV-…` + `TXN-…` |
| Print action | Stub states (Batch Y) run in parallel with preview; same `ReceiptPrintModel` for future IPC |
| Card Payment stub | Not Started → Processing → Approved (ingest) \| Declined \| Cancelling → Declined; Retry; sale stays active on decline |
| Card QA fail | Dev: `window.__r2aArmCardDeclineOnce()` then Start |
| MFS Provider Select | **bKash / Nagad / Rocket** only |
| MFS Confirm / Result | **Desktop-invented** (payer mobile + optional Trx ID → processing → success Sale Completed or fail/retry). Replace when Figma shared |
| MFS QA fail | Dev: `window.__r2aArmMfsFailOnce()` then Confirm |
| Sale Completed variants | Cash / Card (Approved) / MFS (+ provider) / loyalty zero-pay — shared shell |
| Loyalty calculator | Reused; walk-in hides points |
| Chrome | Static **Search Results - Napa** |

### 16.3 TODOs (Slice 4 exit — do not forget)

| Need | Notes |
|------|-------|
| Real Tauri **printer IPC** | Serialize `ReceiptPrintModel` (80/58) to ESC/POS / driver — see `printStub.ts` + `receiptModel.ts` |
| Real **card terminal** SDK / bridge | Replace `runCardTerminalStub` / cancel stub |
| Real **MFS** provider APIs / webhooks | Backend confirms real txn status → desktop shows result only; **no cashier manual Trx**. Replace invented confirm + `runMfsCollectStub`. First-class provider + Trx on Payment if schema extended |
| Settings → live pharmacy header | ~~Replace `STUB_PHARMACY_HEADER`~~ → **Done in Slice 5** (§17) |
| Replace invented MFS confirm/result | When user shares Figma |
| Loyalty earn/redeem persistence | Same gap as §14.3 |
| ~~Offline complete → queue~~ | **Done in M4** (§19) |

### 16.4 Slice 4 exit smoke

```bash
npm run smoke:m3ae -w @r2a/desktop
```

Checks earn lock, print + card + MFS stubs/TODOs, Receipt Preview 80/58 dynamic lines, Payment Card/MFS ungated wiring, no Baki/M4, live CASH + CARD + MFS + zero-pay ingest.

**Manual UI path:** Payment → Card (happy / decline / cancel); Payment → MFS provider → invent confirm → complete; Receipt Preview 80/58; Cash + loyalty paths unbroken; single tender; F2 New Sale.

---

## 17. M3 Slice 5 — F4 / Settings header / Force Offline / Transactions / Shift (Batch AL)

**No new Express routes** were added for Slice 5. Desktop consumes existing M2 routes and local invent surfaces. Create Customer is **gone from POS**; cloud create is **OWNER-only**.

### 17.1 Cloud routes used / tightened in Slice 5

| Desktop capability | Route(s) | Notes |
|--------------------|----------|-------|
| Session / health / catalog / customers search | Same as §14–§16 | Unchanged |
| Generic Substitutes [F4] | `GET /products/:productId/substitutes` | Online only; offline/empty invent states |
| Sale tenders (unchanged) | `POST /sales/ingest` | Cash / Card / MFS / loyalty zero-pay as before |
| Create customer | `POST /customers` | **`restrictTo("OWNER")` only** — not on desktop POS; Owner web later |

### 17.2 Desktop-only (no cloud)

| Feature | Behavior |
|---------|----------|
| F4 Generic Substitutes | Invent modal; focus rule: search row → cart line → else toast; Enter → Select Batch |
| Settings — Pharmacy / Receipt Header | localStorage `pharmacyHeaderStore` (tenant+store); Owner/Manager edit, Cashier view-only; Receipt Preview + print model resolve with stub fallback |
| Force Offline / Stay Offline | Sticky localStorage `forceOfflineStore`; badge menu + Settings Connectivity; probes ignored until Go Online |
| Transactions List | Local `transactionLogStore` (tenant+store) appended on completed sale; **no** cloud `GET /sales` (TODO) |
| Transactions Detail + Reprint | Items / totals / method / customer / loyalty; Receipt Preview reuse; Reprint → print stub |
| Shift Open / Close | Local `shiftStore` (tenant+store); Counter Ready Active Shift reads it; **soft gate:** New Sale [F2] requires open shift (toast + opens Shift panel); connectivity badge unchanged; **no** cloud shift API (TODO when authorized) |
| Create Customer on POS | **Removed** (AF) |

### 17.3 TODOs (Slice 5 exit — do not forget)

| Need | Notes |
|------|-------|
| Cloud sales **list** API | Prefer over local transaction log when authorized (ask before inventing) |
| Cloud **shift** open/close API | Replace local `shiftStore` when authorized |
| Owner web Create Customer | `apps/web` — not desktop |
| Real Tauri **printer IPC** | Still open (§16.3) |
| Real **card** SDK / **MFS** APIs | Still open (§16.3); MFS = backend-confirmed status, no cashier Trx |
| ~~M4 sync flush worker~~ | **Done in M4** (§19) |
| Loyalty earn/redeem persistence | Same gap as §14.3 |

### 17.4 Slice 5 exit smoke

```bash
npm run smoke:m3al -w @r2a/desktop
```

Checks shift store helpers, Shift UI + Counter Ready wiring, Slice 5 DoD source checklist (F4, pharmacy header→receipt, Force Offline, Transactions list/detail/reprint, Create Customer absent, POST customers OWNER-only, catalog §17, no M4).

**Manual UI path:** Sidebar Shift → Open/Close → Counter Ready Active Shift updates; F4 on search/cart; Settings header → Receipt Preview; Force Offline sticky; Transactions list → detail → Reprint; Create Customer absent from Select Customer.

---

## 18. M3 Slice 6 — Hold / Park Sale (Batch AP)

**No new Express routes** were added for Slice 6. Hold is a **desktop-only** invent: park the active cart on this terminal, ring another sale, resume later. Stock is **not** reserved.

### 18.1 Cloud routes used in Slice 6

| Desktop capability | Route(s) | Notes |
|--------------------|----------|-------|
| Session / health / catalog / customers / tenders | Same as §14–§17 | Unchanged |
| Resume stock/expiry recheck (online) | `GET /batches?productId=` (existing Select Batch list) | Live lots for strip/clamp; Force Offline / browser offline → local catalog cache |
| Sale tenders | `POST /sales/ingest` | **Unchanged.** Mid-payment Hold **aborts** card/MFS stubs and must **not** ingest / Sale Completed |
| Cloud hold / reserve | **None** | Do not invent a hold API until authorized |

### 18.2 Desktop-only (no cloud)

| Feature | Behavior |
|---------|----------|
| `heldSaleStore` | localStorage `pharmasync.heldSales.<tenantId>.<storeId>`; **max 3**; newest first; 4th Hold → toast, no overwrite |
| Snapshot | Cart lines (incl. FEFO override meta) + customer + loyalty. **Does not** persist cash-received / card-approved / MFS processing drafts |
| Hold [F6] | Sale view, cart ≥1 line — including while Payment / Cash / Card / MFS / loyalty modals are open. Lands **empty New Sale** (shift stays open; F2 soft gate unchanged) |
| Held Sales list | Cart **Held n/3 [F7]** (toggle); ↑/↓ · ←/→ Resume / Discard · Enter · Esc; Discard → ConfirmDialog; **no Tab** |
| Resume | Only if active cart empty; else toast. Soft recheck: strip missing/expired/unsellable; clamp short stock; if **none** remain sellable, **keep** the hold |
| Payment safety | `abortOpenTenders` + epoch guard: abort card/MFS stub controllers; close modals; skip in-flight ingest |
| Persistence | Survives reload on **that terminal** only — not shared across terminals |

### 18.3 TODOs (Slice 6 exit — do not forget)

| Need | Notes |
|------|-------|
| Hard stock **reservation** | Soft hold only today — not started |
| Cloud hold / multi-terminal shared holds | Replace local `heldSaleStore` when authorized |
| Cloud sales **list** / **shift** APIs | Still open (§17.3) |
| Owner web Create Customer | `apps/web` — not desktop |
| Real Tauri **printer IPC** / **card** SDK / **MFS** APIs | Still open (§16.3); MFS = backend-confirmed status, no cashier Trx |
| ~~M4 sync flush worker~~ | **Done in M4** (§19) |

### 18.4 Slice 6 exit smoke

```bash
npm run smoke:m3ap -w @r2a/desktop
```

Checks held-sale store max-3 + local TODO, soft resume recheck (strip/clamp / keep hold), App F6 Hold + F7 Held list + card/MFS abort wiring, i18n en + bn-BD, catalog §18, no M4 / no cloud hold route.

**Manual UI path:** Open shift → New Sale → add line(s) → Hold [F6] (empty New Sale; Held 1/3) → add another sale → **F7** Held list → Resume (soft recheck toast if stripped/clamped) / Discard confirm; Hold during Card/MFS processing → stubs abort, no Sale Completed; reload → held list persists; 4th Hold → capacity toast.

---

## 19. M4 — One-way sync (Batch F)

One new Express route: **`POST /api/v1/sync/ingest`**. Desktop POS still uses `POST /sales/ingest` when online and not Force Offline. Offline / Force Offline / network-5xx completes enqueue locally; a 15s TypeScript worker flushes FIFO through this route. Reuses `ingestSale` (delta stock, `eventId` idempotency). **No** new cloud list API for the Sync Queue panel.

### 19.1 `POST /api/v1/sync/ingest`

**Auth:** Bearer (`protect` + `tenantContext`). JWT `tenantId` only — body `tenantId` is ignored.  
**Roles:** Any authenticated (`OWNER` / `MANAGER` / `CASHIER`). Cashiers still never receive `costPerBase` on nested batches.  
**Module:** `apps/server/src/modules/sync/` (`router → controller → service`). Mounted on `domainRouter` at `/sync`.  
**Does not** replace or change `POST /api/v1/sales/ingest`.

#### Request body (snake_case envelope)

Validate with `syncIngestBatchSchema`. Wrapper invalid (empty `events`, schema fail) → **400**. Per-event poison does **not** 400 the batch.

```json
{
  "events": [
    {
      "event_id": "<same as Sale.eventId / queue row id>",
      "entity_type": "sale",
      "action": "create",
      "payload": { "...camelCase SaleIngestInput..." },
      "created_at": "2026-08-14T08:00:00.000Z"
    }
  ]
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `events` | array | yes | Min 1. Processed **in array order** |
| `events[].event_id` | string | yes | Idempotency key; mapped onto `payload.eventId` before `ingestSale` |
| `events[].entity_type` | enum | yes | M4 processes **`sale` only**. `stock_delta` / `product` / `customer` → that event `rejected` |
| `events[].action` | enum | yes | M4 processes **`create` only** |
| `events[].payload` | object | yes | camelCase `saleIngestSchema` (`eventId`, `storeId`, `items`, `payments`, …) — same DTO as §11 |
| `events[].created_at` | date | no | Queue timestamp; unused by cloud stock logic |

#### Per-event processing

| Case | `data.results[].status` |
|------|-------------------------|
| `sale` + `create` + valid payload + new `eventId` | `accepted` — `ingestSale` commits sale + decrements `quantityOnHand` (delta, never absolute overwrite) |
| Same `eventId` already in Postgres | `duplicate` — **no** second stock hit (`ingestSale` idempotent no-op) |
| Payload fails `saleIngestSchema` | `rejected` + `message` (Zod). Batch continues |
| `ingestSale` 4xx (`AppError`) | `rejected` + `message`. Batch continues |
| Unsupported `entity_type` / `action` | `rejected` (`unsupported entity_type/action: …`) |
| 5xx inside `ingestSale` | Propagates — not converted to `rejected` |

**HTTP 200** with the locked success envelope even when some events are `rejected` (partial success). Earlier accepted rows stay committed.

```json
{
  "status": "success",
  "message": "Sync ingest processed",
  "data": {
    "results": [
      { "eventId": "evt-1", "status": "accepted", "sale": { } },
      { "eventId": "evt-1-again", "status": "duplicate", "sale": { } },
      { "eventId": "evt-bad", "status": "rejected", "message": "unsupported entity_type/action: product/create" }
    ]
  }
}
```

`results[]` is camelCase (`eventId`, `status`, `message?`, `sale?`). Nested `sale` omits `costPerBase` for cashiers.

**No token → 401.**

### 19.2 Desktop complete-or-queue

Helper: `completeSaleOrQueue` in `apps/desktop/src/lib/saleIngest.ts`. Wired on Cash / Card / MFS / zero-pay in `App.tsx`. Uses connectivity `isOnline` + `forcedOffline` (not only `navigator.onLine`).

| When | Path |
|------|------|
| Online **and** not Force Offline | `POST /api/v1/sales/ingest` (unchanged happy path) |
| Offline, Force Offline, or ingest **network / 5xx / 408 / 429** | Enqueue then **same** Sale Completed + Receipt Preview |
| Online ingest **4xx** (validation, 404, 409 stock, 401) | **Do not** enqueue; stay on payment |

Enqueue rules:

- Queue row **`id` = `payload.eventId`**. Re-enqueue of the same id is idempotent (no duplicate row).
- `entity_type: "sale"`, `action: "create"`, payload = camelCase `SaleIngestInput`.
- Local catalog: `apply_cached_stock_delta(batchId, −quantityBase)` per line with `batchId`; clamp ≥ 0.
- Still append `transactionLogStore`. Optional queued toast (i18n). **No** distinct Queued Completed screen.
- Hold during card/MFS still aborts stubs and **must not** enqueue.

### 19.3 Local queue + 15s worker

Table `outbound_sync_queue` (SQLite / memory backend parity):

| Column | Notes |
|--------|-------|
| `id` | = sale `eventId` |
| `entity_type`, `action`, `payload`, `created_at` | Envelope; payload JSON TEXT |
| `synced` | 1 after `accepted` / `duplicate` |
| `attempt_count` | Transient retries |
| `last_error`, `last_attempt_at` | Last flush error / time |
| `dead` | 1 = dead-letter (not pending) |

`countUnsynced` = `synced = 0 AND dead = 0`.

Worker (`apps/desktop/src/lib/syncWorker.ts`) runs in the **webview** (not Rust HTTP — tokens are in localStorage):

| Lock | Behavior |
|------|----------|
| Interval | **15s**; also flush on start (if online), **Go Online**, and browser `online` |
| Pause | Force Offline **or** connectivity `mode !== "online"` |
| FIFO | Oldest `created_at`, then `id`. Up to **10** events per tick (`list_sync_pending`) |
| POST | `{ events: [...] }` snake_case envelope; `payload` already camelCase |
| `accepted` / `duplicate` | `mark_sync_synced` |
| Poison **4xx** (`rejected`) | `mark_sync_dead` immediately; continue FIFO |
| Transient **network / 5xx / timeout** | `mark_sync_attempt` on the **head** row only; **stop the tick** |
| Backoff | Skip head if `last_attempt_at` newer than `min(15s × 2^(attempt_count−1), 240s)` |
| Max transient | **8** then dead-letter |
| **401 / 403** | Token refresh once via `apiRequest`; if still failing: badge `syncError`, **do not** dead-letter, stop tick |
| After accepted/duplicate | Optional fire-and-forget `catalogPull` (not bi-di sync) |

Dev helpers (browser console): `__r2aFlushSyncNow()` · `__r2aMarkHeadSyncDead()`.

### 19.4 Sync Queue panel (desktop-only — no cloud list API)

Opened from the connectivity **badge** menu (**Sync queue**) and **Settings → Connectivity → Open sync queue**. Overlay panel (Shift / Held family). **No** new sidebar item.

| Piece | Behavior |
|-------|----------|
| Header | Sync queue · Pending n · Failed n (Latin digits) |
| Rows | Time · `TXN-` / `eventId` tail · ৳ from payload · Pending / Syncing / Failed |
| Sort | Failed first (`dead = 1`), then pending by `created_at` |
| Keys | ↑/↓ · Enter Retry on Failed (`retry_sync_event`) · Esc close · **no Tab** |
| Retry | Clears `dead` / `attempt_count` / `last_error`. Does **not** delete the sale |
| Empty | All synchronized |

i18n: `en.ts` + `bn-BD.ts`. Domain `eventId` / ৳ / `last_error` stay as data.

### 19.5 TODOs (M4 exit — do not forget)

| Need | Notes |
|------|-------|
| **409 conflict UX** | **DONE** in M5 (**§20 — M5**). Failed Sync Queue rows show i18n copy + raw `last_error`; Enter Retry. Still **no** void — do not invent void here |
| Bi-directional catalog/stock sync | **M6** |
| Cloud `GET /sales` / cloud shift | Still open (§17.3) |
| Hard reservation / cloud hold | Still open (§18.3) |
| Real printer IPC / card SDK / MFS APIs | Still open (§16.3); MFS = backend-confirmed status, no cashier Trx |
| Baki tender | Not a payment method |
| Slice 7+ POS screens | When shared — not invented ahead |

### 19.6 M4 exit smokes

```bash
# Cloud (server must be running)
npm run smoke:m2 -w @r2a/server
npm run smoke:m4b -w @r2a/server

# Desktop (Node; no live cloud required)
npm run smoke:m4 -w @r2a/desktop
```

`smoke:m4` composes `smoke:m4a` (queue IPC) · `smoke:m4c` (complete-or-queue) · `smoke:m4d` (15s worker) · `smoke:m4e` (Sync Queue panel) · `smoke:m3ap` (Hold guard: App still does not POST `/sync/ingest`; worker owns flush) + catalog §19 / status DONE checks.

**Manual reconnect path:** Force Offline → sell Napa Cash → Sale Completed → Sync queue Pending → Go Online → wait ≤15s (or `__r2aFlushSyncNow()`) → All synchronized / badge Synced. No second receipt popup. Online (not forced) Cash still uses `/sales/ingest`.

---

## 20. M5 — MVP hardening (Batch F)

**§20 — M5** closes Milestone 5. **No new cloud routes.** Desktop POS + existing M2/M4 APIs. Print stub and FEFO PIN stub stay. Owner web remains a stub (**M6**).

### 20.1 PATCH roles (Batch A)

| Method | Path | Roles after M5 |
|--------|------|----------------|
| `PATCH` | `/api/v1/customers/:id` | **`OWNER`, `MANAGER`** — cashier `403` (search-only at POS) |
| `PATCH` | `/api/v1/batches/:id` | **`OWNER`, `MANAGER`** — cashier `403` (including qty). Receiving is the qty path |
| `POST` | `/api/v1/customers` | **`OWNER` only** (unchanged; not on desktop POS) |
| `POST` | `/api/v1/batches` | **`OWNER`, `MANAGER`** (unchanged) |

Cashier GET still omits `costPerBase`. Price-field `403` remains defense-in-depth. `smoke:m2` includes cashier PATCH 403s.

### 20.2 Receive stock (desktop-only — Batches B–C)

**No new cloud routes.** Owner/Manager **Settings → Receive stock** (cashier: section omitted, not a locked row). Online only — Force Offline / `mode !== "online"` → toast; **no** GRN queue.

| Mode | Call |
|------|------|
| Add lot | `POST /api/v1/batches` (`productId`, `batchNumber`, `expiryDate`, `quantityOnHand` PIECE, `costPerBase`, `sellPerBase`) |
| Adjust qty | `PATCH /api/v1/batches/:id` `{ quantityOnHand }` (absolute on-hand) |

Success → i18n toast + `catalogPull`. Cost fields visible here (Owner + Manager). No new sidebar item. No CSV. Supplier-return bucket = **M6**.

### 20.3 409 Sync Queue copy (Batch D)

Failed `outbound_sync_queue` rows (`dead = 1`): i18n `syncQueue.conflictReason` when `last_error` looks like insufficient stock / `409` / conflict, **plus** raw `last_error` as data. Enter still **Retry** (`retry_sync_event`). **No** void / delete sale. Online ingest **4xx/409** still stays on payment (does not enqueue). Stage with `__r2aMarkHeadSyncDead()` (defaults to `409 Insufficient stock`).

### 20.4 Paged catalog pull (Batch E)

Desktop `catalogPull` pages `GET /products` (`isActive=true`) and `GET /batches` with `limit=100` + `offset` until `meta.total`. Hard cap **50** pages (5000 rows) per resource; i18n toast if truncated; still replace cache with what was fetched. `replaceCatalogCache` once at the end. **Never** cache `costPerBase` (`mapBatch` drops it). No CSV. Not bi-directional sync (**M6**).

### 20.5 Stubs still out (not M5)

Print stub (`TODO(real printer IPC)`), FEFO PIN stub (any 4-digit + local Authorized By; **no** `pinHash`), real card SDK, real MFS APIs, loyalty persist, cloud `GET /sales`, cloud shift, Owner web, sale void, on-account tender, Slice 7+, CSV onboarding, hard holds.

### 20.6 M5 exit smokes

```bash
# Cloud (server must be running)
npm run smoke:m2 -w @r2a/server
npm run smoke:m4b -w @r2a/server

# Desktop (Node; composes m5a–m5e + smoke:m4 + §20 / DONE / runbook)
npm run smoke:m5 -w @r2a/desktop
```

Dev runbook: [`docs/DEV_RUNBOOK.md`](docs/DEV_RUNBOOK.md).

**Manual pilot path:** Owner Receive stock → cashier sells Napa Cash online → cashier has no Receive stock → Force Offline sale + Sync queue (409 copy if staged). Print / FEFO PIN remain stubs.

---

## 21. Change log

| Date | Change |
|------|--------|
| 2026-08-09 | Initial API catalog after M2 Batches A–H completion |
| 2026-08-11 | Confirmed: M3 Batch K (Active Cart) adds **no** new cloud routes; sale ingest still payment-slice only |
| 2026-08-11 | Documented cloud vs desktop FEFO (sellable preferred on search); Napa 4-lot demo seed; POS flow uses `GET /batches?productId=` for Select Batch |
| 2026-08-11 | **M3 Batch U (Slice 2 exit):** §14 desktop consumption + stubs + planned routes; zero-pay ingest notes; customer PATCH loyalty gap; Karim 120 pts seed note |
| 2026-08-11 | **M3 Batch Z (Slice 3 exit):** §15 Cash tender + print stub; Card/MFS gated; 58mm printer IPC TODO; `smoke:m3z` |
| 2026-08-12 | **M3 Batch AE (Slice 4 exit):** §16 Receipt Preview + Card stub + MFS invent + CARD/MFS ingest notes; `smoke:m3ae` |
| 2026-08-12 | MFS real-API intent: backend confirms txn → desktop shows status; no cashier manual Trx |
| 2026-08-12 | **M3 Batch AL (Slice 5 exit):** §17 F4 + pharmacy header + Force Offline + Transactions + Shift; POST customers OWNER-only; `smoke:m3al` |
| 2026-08-13 | Shift soft gate documented: New Sale [F2] requires open shift; connectivity badge independent |
| 2026-08-13 | **M3 Batch AP (Slice 6 exit):** §18 Hold / Park Sale (max 3 soft holds, F6 Hold, F7 Held list, resume recheck, payment abort); no new cloud routes; `smoke:m3ap` |
| 2026-08-13 | **M3 FULL EXIT:** desktop POS shell closed; no new cloud routes; later screens → Slice 7+; M4 flush not started |
| 2026-08-14 | **M4 Batch F (M4 exit):** §19 `POST /api/v1/sync/ingest` + desktop queue/worker/Sync Queue panel; `smoke:m4`; M4 DONE |
| 2026-08-14 | **M5 Batch F (M5 exit):** §20 PATCH RBAC + desktop Receive stock + 409 copy + paged catalog pull; `docs/DEV_RUNBOOK.md`; `smoke:m5`; user pilot walkthrough **PASS**; M5 DONE |
