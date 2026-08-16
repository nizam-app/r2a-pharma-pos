# PharmaSync — User Roles, Management & Authorization

**Document type:** Canonical RBAC spec for the whole system (POS + future Owner/Manager surfaces)  
**Product:** PharmaSync POS — Multi-Tenant Pharmacy POS & Inventory SaaS  
**Version:** 2.0.0  
**Last updated:** 2026-08-16  
**Audience:** Engineering, product, Cursor agents

---

## How to use this file

This document is the **system-wide authorization contract**. Use it when building or extending Owner, Manager, and Cashier behavior.

| Layer | Source of truth |
|-------|-----------------|
| **Who may do what** (this file) | `ROLES_AND_PERMISSIONS.md` |
| **What is already built** | [`Current_Status.md`](Current_Status.md) |
| **Live cloud routes / RBAC** | [`Completed_API_lists.md`](Completed_API_lists.md) |
| **Milestones / stack / agent gating** | [`PROJECT_MASTER_PLAN.md`](PROJECT_MASTER_PLAN.md) |

**Precedence**

1. Do **not** start M5 / Owner web / Manager back-office / schema changes from this file alone. The user must authorize the milestone.
2. For **already-shipped** cashier POS and cloud API behavior, `Current_Status.md` + `Completed_API_lists.md` describe what runs today. This file must not be used to regress those locks.
3. When Owner/Manager work is authorized, **implement toward this matrix** — unless the user re-locks a cell.
4. Older specs under `docs/` (PRD, handover) that disagree with this file are **superseded** here for roles, payments, and customer-create.

**Payments (locked for the whole product):** `CASH` \| `CARD` \| `MFS` only. Every sale is **fully settled** at complete. There is no on-account tender, no customer due ledger, and no credit-limit workflow. Do not add one in any milestone.

---

## 1. Hierarchy and personas

```text
+-------------------------------------------------------------------------+
|                         HIERARCHY OF AUTHORITY                          |
|                                                                         |
|  [ SYSTEM SUPER ADMIN ]  -> SaaS platform (not tenant POS)              |
|          │                                                              |
|          ▼                                                              |
|  [ PHARMACY OWNER ]      -> Tenant executive (root tenant authority)    |
|          │                                                              |
|          ▼                                                              |
|  [ STORE MANAGER ]       -> Store operations lead                       |
|          │                                                              |
|          ▼                                                              |
|  [ CASHIER / PHARMACIST] -> Counter staff (checkout execution only)     |
+-------------------------------------------------------------------------+
```

Prisma / JWT roles (locked): `SUPER_ADMIN` \| `OWNER` \| `MANAGER` \| `CASHIER`.

### Pharmacy Owner

* **Access:** Root authority for one tenant.
* **Target UI:** Owner web (`apps/web`) — **M6**; login + chrome + live Dashboard + live Sales list + live Transaction Details + live Inventory + live Product Details (Slice 1 Batches A–B, G–K). Owner aggregate APIs live (Batch F / J / K).
* **Until web exists:** Owner may log into desktop POS (`apps/desktop`) with the same JWT role. Desktop remains a **cashier workstation**, not the executive suite.
* **Scope:** Financials and margins, staff, catalog/pricing, settings, audit, n8n (M6), multi-branch (M7).

### Store Manager

* **Access:** Operational admin at store level.
* **Target UI:** Receiving/stock = **desktop Settings** (M5). Owner/Manager web = **M6**.
* **Until then:** Manager may log into desktop POS like a cashier, plus live cloud rights already granted (catalog/batch create, staff create). See §3.
* **Scope:** GRN / batch receiving, stock adjust, FEFO override authorization, shift review, customer **search** (not create). Supervises cashiers.

### Cashier / Pharmacist

* **Access:** Strict transactional scope on Tauri desktop POS (`apps/desktop`).
* **Scope:** Search, FEFO checkout, cart, settled payments, loyalty lookup/redeem (session today), receipts, hold, shift open/close (local today).
* **Blocked:** Creating customers, seeing `costPerBase` / margins, mutating sell/cost prices, deleting sales, admin/financial reports.

### Super Admin

* **Access:** Platform SaaS (tenants, billing, health) — **M7**. Role exists on User / JWT only. **No** console or routes today. Super Admin does **not** operate a pharmacy POS.

---

## 2. Now vs later (so M5+ does not invent ahead)

| Capability | Now (M0–M4) | When to build |
|------------|-------------|---------------|
| Cashier POS checkout (Cash / Card stub / MFS invent) | **Live** | — |
| Margin redaction (`costPerBase` omitted for cashier) | **Live** | — |
| `POST /users` — Owner or Manager creates Cashier/Manager | **Live** | — |
| `POST /customers` — **Owner only** | **Live** | Owner web UI = **M6** |
| FEFO override on POS | **Stub PIN** (any 4-digit + local “Authorized By”). **M6 D:** ingest persists `fefoOverride` + authorizer name. | Real `pinHash` when **authorized** |
| Shift open/close | **Local** `shiftStore` (no cash count, no cloud) | Cloud shift + blind count when **authorized** |
| Purchase / GRN / stock entry UI | **Live** — desktop Settings Receive stock (Owner/Manager; online `POST`/`PATCH /batches`) | Owner web **Receive Stock** = **M6 Batch M** |
| Owner web dashboard | **Live** (M6 G — KPIs, bars, inventory health, FEFO, recent sales) | Sales list = **live** (M6 H). Transaction Details = **live** (M6 I). Inventory list = **live** (M6 J). Product Details = **live** (M6 K) |
| **Owner web Add Product** | **Live** (M6 L — `POST /products` with Piece→Strip→Box units, Rx, cold chain, reorder level, storage notes; 0 initial stock; redirect to Product Details) | Receive Stock (initial batch) = **M6 Batch M** |
| Loyalty earn/redeem persistence | **Live** on ingest snapshots (`loyaltyUsed` / `loyaltyEarned` + customer balance). POS session calc unchanged. OTP stub stays. | Owner web Transaction Details = **live** (M6 I) |
| n8n, RLS, bi-di sync | Not started | **M6** |
| Supplier return bucket, supplier ledger | Not started | **M6** |
| Super Admin console, multi-branch, transfers | Not started | **M7** |
| Sale void / delete | **Forbidden** (append-only) | Only if the user **re-authorizes** |
| On-account / customer due tender | **Forbidden** | Never |

---

## 3. Authorization matrix

Legend: ✅ allowed · ❌ denied · ⚠️ cashier may **request**; Owner/Manager **authorize** · *(later)* = do not build until the matching milestone is authorized.

| Domain / Feature | Super Admin | Owner | Manager | Cashier |
| --- | --- | --- | --- | --- |
| SaaS subscription & billing | ✅ *(M7)* | ❌ | ❌ | ❌ |
| View net profit / COGS / margins | ❌ | ✅ | ❌ | ❌ |
| View `sellPerBase` (POS sell price) | ❌ | ✅ | ✅ | ✅ |
| View / mutate `costPerBase` | ❌ | ✅ | ✅ *(API today)* | ❌ |
| Create / patch products | ❌ | ✅ | ✅ | ❌ |
| Create batches / receive stock (GRN) | ❌ | ✅ | ✅ | ❌ |
| Patch batch **prices** (`costPerBase`, `sellPerBase`) | ❌ | ✅ | ✅ *(API today)* | ❌ |
| Patch batch non-price fields | ❌ | ✅ | ✅ | ❌ |
| Create staff (`CASHIER` / `MANAGER` only) | ❌ | ✅ | ✅ | ❌ |
| Create `OWNER` / `SUPER_ADMIN` via `POST /users` | ❌ | ❌ | ❌ | ❌ |
| Assign / rotate FEFO override PIN | ❌ | ✅ *(later)* | ❌ | ❌ |
| **Create customer** | ❌ | ✅ | ❌ | ❌ |
| Edit customer profile (back-office) | ❌ | ✅ *(M6)* | ✅ *(M6; not create)* | ❌ |
| Search customer / loyalty at POS | ❌ | ✅ | ✅ | ✅ |
| POS checkout & settled billing | ❌ | ✅ | ✅ | ✅ |
| FEFO override (non-default batch) | ❌ | ✅ authorize | ✅ authorize | ⚠️ request only |
| Supplier expiry returns | ❌ | ✅ *(M6)* | ✅ *(M6)* | ❌ |
| n8n automation settings | ❌ | ✅ *(M6)* | ❌ | ❌ |
| Multi-branch / stock transfer | ❌ | ✅ *(M7)* | ⚠️ *(M7)* | ❌ |
| Void / delete a sale | ❌ | ❌ | ❌ | ❌ |

---

## 4. Live cloud RBAC (do not regress)

Matches `Completed_API_lists.md`. JWT claims: `{ sub, role, tenantId, storeId }`. `tenantId` from JWT only.

| Route | Roles |
|-------|--------|
| `POST /api/v1/users` | `OWNER`, `MANAGER` — body role `CASHIER` \| `MANAGER` only |
| `POST /api/v1/products`, `PATCH /products/:id` | `OWNER`, `MANAGER` |
| `POST /api/v1/batches` | `OWNER`, `MANAGER` |
| `PATCH /api/v1/batches/:id` | `OWNER`, `MANAGER` — cashier `403` (including qty). Receiving is the qty path |
| `POST /api/v1/customers` | **`OWNER` only** (`403` for Manager and Cashier) |
| `GET /api/v1/customers` | Any authenticated |
| `PATCH /api/v1/customers/:id` | `OWNER`, `MANAGER` — cashier `403` (search-only at POS) |
| `POST /api/v1/sales/ingest`, `POST /api/v1/sync/ingest` | Any authenticated; sales **append-only** (no update/delete routes) |
| `GET /api/v1/sales`, `GET /api/v1/sales/:id` | Any authenticated. **Redact** `costPerBaseAtSale` / COGS / netProfit / margins unless `OWNER` (`:id` = `Sale.id`) |
| `GET /api/v1/owner/dashboard`, `/owner/inventory-summary`, `/owner/expiry` | **`OWNER` only** (`403` for Manager and Cashier) |
| `GET /api/v1/owner/inventory` | **`OWNER` only** (`403` for Manager and Cashier) |
| `GET /api/v1/owner/products/:id` | **`OWNER` only** — full product detail + batches + FEFO rank + InventoryEvent (M6K) |
| Batch payloads | Cashier: omit `costPerBase`; `sellPerBase` allowed |

> **M6L:** Owner web `POST /products` (via `apps/web` Add Product form) creates catalog-only rows — zero initial stock. Extended fields: `manufacturer`, `strength`, `form`, `category`, `requiresPrescription`, `coldChain`, `storageNotes`, `reorderLevel`. Cashier `403`.

---

## 5. Customer authority (locked)

* **Create** is **Owner only** — cloud `restrictTo("OWNER")`. Not Manager. Not Cashier. Not on desktop POS.
* **Owner web Create Customer** is **M6** (`apps/web`). Do not re-add a Create form on POS.
* **Fields (live schema):** `name`, `phone?`, `email?`. Do **not** add date of birth or gender unless the user authorizes a schema change.
* **Cashier at checkout:** search by phone/name (`GET /customers`); apply loyalty if eligible; if not found → **Walk-in**. Prompt the customer to register with the **Owner** (not the Manager).
* **`loyaltyPoints`:** display/redeem at POS (session settlement). Authoritative persist = **M6 Batch D** ingest snapshots when `loyaltyUsed`/`loyaltyEarned` are sent with a `customerId`.
* **`creditBalance`:** unused schema leftover. Do **not** expose in UI, mutate via POS, or build features on it.

---

## 6. Owner — target executive suite

Build in **M6** web unless a slice is authorized earlier. Do not invent these on cashier POS.

* Revenue, COGS, gross profit, net margin (Owner only — never Cashier, never Manager).
* Staff: create / deactivate Manager and Cashier; audit who changed prices or stock.
* Catalog and pricing; pharmacy / receipt header (desktop Settings already: Owner/Manager edit, Cashier view-only).
* Supplier payables and PO dispatch (**M6**, not a customer-due ledger).
* n8n: refill WhatsApp/SMS, PO rules (**M6**).
* Multi-branch analytics and transfer approval (**M7**).
* Optional later: cashier max-discount cap with Manager PIN — **authorize first**.

---

## 7. Manager — target operations suite

Build with **M5** stock/GRN and **M6** web as authorized.

* **GRN / receiving:** incoming lots — batch number, `expiryDate`, qty in PIECE, `costPerBase`, `sellPerBase`.
* **Stock adjust:** damage / write-off within threshold; above threshold → Owner.
* **Supplier return bucket (~90 days to expiry)** — **M6**.
* **Draft POs** from low-stock — **M6**.
* **FEFO override:** Manager/Owner PIN (real verify when authorized).
* **Shift review:** after cloud shift exists, see cashier close variance (see §10).
* **Customers:** search and (M6) edit. **Cannot create.**

---

## 8. Guardrails

### Price protection

Cashiers must not change `costPerBase` or `sellPerBase`. Live API already `403`s those fields for `CASHIER`. Owner and Manager may set catalog/batch prices via API today. Do not add a second “Manager needs Owner approval” price workflow unless the user asks.

### Stock vs shelf

POS recommends FEFO batch + expiry; cashiers match packs on the shelf. Cycle-count / discrepancy alerts to Owner are **M6+** — do not invent until authorized.

### Sales immutability

Sales are **append-only**. There is no void, edit, or delete invoice API. Do not add one for Owner or Manager unless the user re-authorizes.

---

## 9. FEFO override

### 9.1 Today (do not treat as production auth)

Desktop stub: any **4-digit** PIN + local “Authorized By” list. Audit is `notes` / cart `fefoOverride` only. **Do not ship this stub to pilot.** See `apps/desktop/src/lib/fefoOverrideAuth.ts`.

### 9.2 Target (when real FEFO auth is authorized)

Default pick = earliest **sellable** lot (`expiryDate` ≥ today, qty > 0). Choosing a later-expiring lot opens Manager/Owner PIN.

```text
[ Cashier selects non-FEFO batch ]
                 │
                 ▼
        FEFO override modal
        Owner/Manager 4-digit PIN
                 │
      ┌──────────┴──────────┐
      ▼                     ▼
[ Valid PIN ]         [ Invalid PIN ]
Batch updated +       Selection rejected
audit on sale line
```

**Storage (additive — do not replace `User`):**

* Never store a PIN in plain text.
* When authorized, add optional `pinHash` + `pinUpdatedAt` on the existing Prisma `User` (`cuid()`, camelCase `tenantId`, bcrypt/Argon2id).
* Desktop may cache **hashes only** in the local catalog for offline verify.
* Prefer an override **flag + authorizer id on the sale line / ingest payload** (already listed as a planned API). Do not add a separate `fefo_override_logs` table unless authorized.

Field names stay Prisma-locked: `expiryDate`, not `expirationDate` / `expiration_date`.

---

## 10. Shift close

**Today:** local `shiftStore` (tenant+store). Soft gate: New Sale requires an open shift. No cash count. No cloud shift API.

**Target (when cloud shift is authorized):**

1. Cashier Close Shift → enter **physical cash** in drawer.
2. Hide system expected total (opening float + cash sales) until after submit.
3. Log variance for Owner/Manager review.

Latin digits only in UI (e.g. ৳150).

---

## 11. Owner / Manager web blueprint (M6 — not current UI)

Brand: **PharmaSync**. Do not use other product names. No due/credit metric card.

```text
+---------------------------------------------------------------------------+
| SIDEBAR                 | MAIN CONTENT                                    |
|                         |                                                 |
| [Logo] PharmaSync       | HEADER: Store | Date filter | Alerts            |
| ----------------------- | ----------------------------------------------- |
| Executive Summary       | [Sales Today] [Net Profit] [Expiry Risk]        |
| Inventory Master        |                                                 |
| Purchase Orders         | Charts: sales trend                             |
| Batch & Expiry          |                                                 |
| Staff & Roles           | Recent: GRN | POs | Shift closures              |
| Supplier Ledger         |                                                 |
| Automation & Rules      |                                                 |
+---------------------------------------------------------------------------+
```

POS chrome stays the locked 3-panel cashier layout (search ~40% / cart ~60%). This blueprint is **web only**.

---

## 12. Forbidden (whole product, every milestone)

Do **not** implement:

* On-account sales, customer due, credit limits, or any unpaid remainder parked on a customer
* A fourth payment method beyond `CASH` \| `CARD` \| `MFS`
* Create Customer on desktop POS
* Manager (or Cashier) `POST /customers`
* Sale void / update / delete
* Super Admin POS or tenant-data console before M7
* Replacing Prisma `User` / snake_case schemas / `uuid()` ids (use `cuid()` + camelCase)
* Surfacing or mutating `Customer.creditBalance`
* Hard-coded UI strings on new Owner/Manager screens (use `t("...")` + `en.ts` / `bn-BD.ts`)
* Tab as a POS navigator (arrows + Enter + Esc)

---

## 13. Change log

| Date | Change |
|------|--------|
| 2026-08-14 | **v2.0.0** — Canonical RBAC for POS + future Owner/Manager. Removed on-account / due / credit tender. Create customer = Owner only. Sales append-only. Live API matrix + now-vs-later gating so M5+ cannot invent ahead. FEFO PIN and blind shift marked target-not-now. Prisma camelCase. PharmaSync web blueprint. |
| 2026-08-14 | **M5 Batch A** — live table: `PATCH /customers/:id` and `PATCH /batches/:id` = Owner/Manager (cashier `403`, including qty). GRN UI = desktop Settings (M5), not Owner web. |
| 2026-08-14 | **M5 Batch C** — GRN / receive stock is **live** on desktop Settings (Owner/Manager). Add lot `POST /batches`; adjust qty `PATCH /batches/:id`. Not Owner web. |
| 2026-08-15 | **M6 Batch E** — live table: `GET /sales` + `GET /sales/:id` any authenticated; cost/COGS/netProfit Owner-only. |
| 2026-08-16 | **M6 Batch F** — live table: `GET /owner/dashboard`, `/owner/inventory-summary`, `/owner/expiry` = **OWNER only** (Manager/Cashier 403). |
| 2026-08-16 | **M6 Batch G** — Owner web Dashboard live (KPIs, bars, inventory health, FEFO, recent sales). |
| 2026-08-16 | **M6 Batch H** — Owner web Sales list live. Transaction Details = Batch I. |
| 2026-08-16 | **M6 Batch I** — Owner web Transaction Details live (`GET /sales/:id`). Reprint = on-screen preview. No void. |
| 2026-08-16 | **M6 Batch J** — Owner web Inventory list live (`GET /owner/inventory`). OWNER cost/sell/margin. |
| 2026-08-16 | **M6 Batch K** — Owner web Product Details live (`GET /owner/products/:id`). Edit Product disabled. |
