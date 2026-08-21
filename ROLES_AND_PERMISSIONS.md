# PharmaSync — User Roles, Management & Authorization

**Document type:** Canonical RBAC spec for the whole system (POS + future Owner/Manager surfaces)  
**Product:** PharmaSync POS — Multi-Tenant Pharmacy POS & Inventory SaaS  
**Version:** 2.0.0  
**Last updated:** 2026-08-20
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
* **Live UI:** Owner web (`apps/web`) — **M6 Slice 1 A–O DONE** + **Slice 2 P–AB DONE**. Slice 3 **AE–AK DONE**; AL–AM planned. Manager/Cashier rejected on web.
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
| `POST /customers` — **Owner Active; Cashier/Manager POS = Pending** | **Live (M6 AF).** Owner Active; Cashier/Manager POS Pending, extras stripped | Owner web UI + POS Create + Owner approve = **M6 Slice 3 AF–AM** |
| FEFO override on POS | **Stub PIN** (any 4-digit + local “Authorized By”). **M6 D:** ingest persists `fefoOverride` + authorizer name. | Real `pinHash` when **authorized** |
| Shift open/close | **Local** `shiftStore` (no cash count, no cloud) | Cloud shift + blind count when **authorized** |
| Purchase / GRN / stock entry UI | Add lot + signed adjustment live; **M6 R Supplier/PO/GRN/return APIs live (OWNER-only); M6 T–U Purchasing list + Create PO web UI live** | PO Details, Receive against PO, Suppliers screens, return workflow in later Slice 2 batches |
| Owner web dashboard | **Live** (M6 G — KPIs, bars, inventory health, FEFO, recent sales) | Sales list = **live** (M6 H). Transaction Details = **live** (M6 I). Inventory list = **live** (M6 J). Product Details = **live** (M6 K) |
| **Owner web Add Product** | **Live** (M6 L — `POST /products` with Piece→Strip→Box units, Rx, cold chain, reorder level, storage notes; 0 initial stock; redirect to Product Details) | Receive Stock is **live** (M6 M) |
| **Owner web Expiry Management** | **Live** (M6 N — OWNER-only expiry API, supplier/return metadata, filters/selection/CSV; **M6 AA** Prepare Supplier Return → `/suppliers/returns`; **M6 AB** Create Return Manifest) | Manifest Details = Batch AC **deferred** |
| Loyalty earn/redeem persistence | **Live** on ingest snapshots (`loyaltyUsed` / `loyaltyEarned` + customer balance). POS session calc unchanged. OTP stub stays. | Owner web Transaction Details = **live** (M6 I) |
| n8n, RLS, bi-di sync | Not started | **M6** |
| Supplier return bucket, supplier ledger | Supplier profiles, PO, GRN, return queue, and manifest create APIs/UI live; Purchasing/Suppliers/Expiry Returns/Create Manifest web UI live | Manifest Details + dispatch lifecycle **deferred** (Slice 2 AC) |
| Owner web Customers | Nav + live directory (`/customers`) + live Add Customer + live Customer Details + live Registration Review (Approve/Reject) enabled | **M6 Slice 3 AL–AM** — POS Create, Slice 3 exit |
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
| Signed stock adjustment with reason | ❌ | ✅ | ✅ | ❌ |
| Void / retire batch | ❌ | ✅ | ❌ | ❌ |
| Create staff (`CASHIER` / `MANAGER` only) | ❌ | ✅ | ✅ | ❌ |
| Create `OWNER` / `SUPER_ADMIN` via `POST /users` | ❌ | ❌ | ❌ | ❌ |
| Assign / rotate FEFO override PIN | ❌ | ✅ *(later)* | ❌ | ❌ |
| **Create customer** | ❌ | ✅ Active immediately (web or POS) | ⚠️ POS pending Owner approve *(Slice 3)* | ⚠️ POS pending Owner approve *(Slice 3)* |
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
| `PATCH /api/v1/batches/:id` | `OWNER`, `MANAGER` — cashier `403`; metadata/prices only; `quantityOnHand` rejected |
| `POST /api/v1/batches/:id/corrections` | `OWNER`, `MANAGER` — reason + expected version + idempotency key |
| `POST /api/v1/batches/:id/adjustments` | `OWNER`, `MANAGER` — signed delta + reason + expected version; cashier `403` |
| `POST /api/v1/batches/:id/void`, `/retire` | **`OWNER` only** |
| `POST /api/v1/customers` | `OWNER` (Active, `OWNER_CREATED`/`POS_REGISTRATION`) + `MANAGER`/`CASHIER` (Pending `POS_REGISTRATION`, names+phone only) — **M6 AF** live |
| `GET /api/v1/customers` | Any authenticated |
| `PATCH /api/v1/customers/:id` | `OWNER`, `MANAGER` — cashier `403` (search-only at POS) |
| `POST /api/v1/sales/ingest`, `POST /api/v1/sync/ingest` | Any authenticated; sales **append-only** (no update/delete routes) |
| `GET /api/v1/sales`, `GET /api/v1/sales/:id` | Any authenticated. **Redact** `costPerBaseAtSale` / COGS / netProfit / margins unless `OWNER` (`:id` = `Sale.id`). `customerId` additive filter (M6 AF) |
| `GET /api/v1/owner/dashboard`, `/owner/inventory-summary`, `/owner/expiry` | **`OWNER` only** (`403` for Manager and Cashier) |
| `GET /api/v1/owner/inventory` | **`OWNER` only** (`403` for Manager and Cashier) |
| `GET /api/v1/owner/products/:id` | **`OWNER` only** — full product detail + batches + FEFO rank + InventoryEvent (M6K) |
| `GET /api/v1/owner/batches/:id` | **`OWNER` only** — management context + revisions/adjustments |
| `GET /api/v1/owner/customers`, `GET /owner/customers/:id` | **`OWNER` only** (M6 AF) — Manager/Cashier 403 |
| `POST /api/v1/owner/customers/:id/approve`, `/reject` | **`OWNER` only** (M6 AF) — pending customers only |
| `GET/POST /api/v1/owner/suppliers`, `GET/PATCH /owner/suppliers/:id` | **`OWNER` only** — no delete |
| `GET/POST /api/v1/owner/purchase-orders`, `GET/PATCH /owner/purchase-orders/:id` | **`OWNER` only** — PO PATCH only while `DRAFT`; no inventory effect |
| `POST /api/v1/owner/purchase-orders/:id/receipts` | **`OWNER` only** — confirmed GRN creates batches + RECEIVE events and advances PO quantities/status |
| `GET /api/v1/owner/returns/queue` | **`OWNER` only** — supplier-linked return candidates |
| `POST /api/v1/owner/return-manifests`, `GET /owner/return-manifests/:id` | **`OWNER` only** — prepare/get supplier return |
| `POST /api/v1/owner/return-manifests/:id/dispatch`, `/decision`, `/complete` | **`OWNER` only** — dispatch stock delta is idempotent; decision/complete do not restore/move stock |
| Batch payloads | Cashier: omit `costPerBase`; `sellPerBase` allowed |

> **M6L:** Owner web `POST /products` (via `apps/web` Add Product form) creates catalog-only rows — zero initial stock. Extended fields: `manufacturer`, `strength`, `form`, `category`, `requiresPrescription`, `coldChain`, `storageNotes`, `reorderLevel`. Cashier `403`.

---

## 5. Customer authority (locked)

**Live today (Slice 3 AF DONE):** `POST /customers` is role-aware — Owner creates Active immediately; Cashier/Manager POS creates Pending (names + phone only). `GET /customers` returns Active-only. `GET /customers/phone-check` and `/owner/customers*` (list/detail/approve/reject) are live OWNER-only routes.

**Slice 3 lock (implement in AE–AL; do not invent ahead of the authorized batch):**

* **Owner create** (Admin Portal Add Customer, or Owner on POS) → **Active immediately**. Web source = `OWNER_CREATED`. POS source = `POS_REGISTRATION`.
* **Cashier / Manager POS create** → **Pending Approval**. Name + phone only. Not searchable at F8 and not attachable to a sale until the Owner approves.
* **Owner approve** on Registration Review → Active (Owner may add email / DOB / gender / address). **Reject** → hidden; phone may be reused.
* **Fields:** `name`, **required `phone`**, optional `email`, `dateOfBirth`, `gender`, `address`. Do **not** surface `creditBalance`.
* **Cashier at checkout:** search **Active** customers only (`GET /customers`); apply loyalty if eligible; if not found → **Walk-in** or POS Create (pending).
* **`loyaltyPoints`:** display/redeem at POS (session settlement). Authoritative persist = **M6 Batch D** ingest snapshots when `loyaltyUsed`/`loyaltyEarned` are sent with an **Active** `customerId`.
* **Edit Customer** stays parked in Slice 3. `PATCH /customers/:id` remains Owner/Manager API-only.
* **`creditBalance`:** unused schema leftover. Do **not** expose in UI, mutate via POS, or build features on it.

---

## 6. Owner — executive suite

Slice 1 Owner screens are live. Remaining items below require their matching later M6/M7 authorization and must not be invented on cashier POS.

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
* Create Customer on desktop POS **except** Slice 3 Batch AL (name + phone; Cashier/Manager pending; Owner Active)
* Manager or Cashier `POST /customers` **as Active** — pending only until Owner approves
* Attaching a pending/rejected customer to a sale (ingest must require Active)
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
| 2026-08-16 | **M6 Batch M** — Owner web Receive Stock live using existing OWNER/MANAGER `POST /batches`; Owner web remains OWNER-only. Supplier/PO/invoice omitted. |
| 2026-08-18 | **Owner Web W1–W6** — Edit Product + Batch Management live; correction/adjustment Owner/Manager APIs; lifecycle Owner-only; desktop stock adjustment migrated to signed/versioned/reasoned online POST; absolute quantity PATCH removed. |
| 2026-08-18 | **M6 Owner Web Slice 1 A–O DONE** — Expiry Management live; catalog §21 and composed `smoke:m6s1` pass. Manager web remains later. |
| 2026-08-18 | **M6 Batch Q** — Supplier and Purchase Order cloud APIs are OWNER-only; Manager/Cashier 403; no supplier delete, GRN/return API, or Slice 2 UI yet. |
| 2026-08-18 | **M6 Batch R** — confirmed GRN, return queue, and return-manifest lifecycle APIs are OWNER-only; dispatch writes idempotent signed stock-out events; no Slice 2 UI yet. |
| 2026-08-18 | **M6 Batch S** — Owner web Purchasing and Suppliers navigation is live with localized placeholder shells; management tables remain deferred. |
| 2026-08-18 | **M6 Batch T** — Owner web Purchasing list live (OWNER-only GET purchase-orders; KPI cards, PO table, search/status, pagination); Create PO → `/purchasing/new`. |
| 2026-08-18 | **M6 Batch U** — Owner web Create Purchase Order live (ACTIVE-supplier dropdown, product line search, Save as Draft / Create SENT / Cancel; no inventory effect). Seed ships 3 ACTIVE suppliers for the dropdown. |
| 2026-08-19 | **M6 Batch AA** — Owner web Expiry Returns queue live (`GET /owner/returns/queue`); Prepare Supplier Return on Expiry Management enabled; Create Return Manifest page still later. |
| 2026-08-19 | **M6 Batch AB** — Owner web Create Return Manifest live (`POST /owner/return-manifests`); Save as Draft disabled; stock unchanged until dispatch (Batch AC). |
| 2026-08-19 | **M6 Slice 3 planned** — Customer create re-lock: Owner Active immediately; Cashier/Manager POS create pending Owner approval. DOB/gender/address authorized as optional. Edit Customer parked. Not live until Batches AE–AL. |
| 2026-08-19 | **M6 Batch AE** — Customer schema + Zod landed. `POST /customers` remains OWNER-only until AF. |
| 2026-08-20 | **M6 Batch AF** — Customer APIs live (role-aware POST, Active-only GET, phone-check, Owner list/detail/approve/reject, ingest Active guard). **M6 Batch AG** — Owner web Customers nav enabled as a live chrome route with placeholder shells (`/customers`, `/customers/new`, `/customers/:id`, `/customers/:id/review`); Staff/Help/Owner Profile remain disabled. **M6 Batch AH** — live Customers directory at `/customers` (`GET /owner/customers`): KPIs, tabs, search, Status/Source/Sort, pagination; Pending → `/customers/:id/review`, Active/Inactive → `/customers/:id`, Add → `/customers/new` (AI). Next = Authorize M6 Batch AI. |
| 2026-08-20 | **M6 Batch AI** — live Add Customer at `/customers/new` (`POST /api/v1/customers`; OWNER → ACTIVE + OWNER_CREATED): Customer Information form (name + phone required, optional email/DOB/gender/address) + debounced live phone-check Duplicate panel; Direct Customer Creation card + read-only System Information (live branch + created-by); checkbox-gated Create Confirm modal (focus trap, customer summary, "What Happens After Creation"); unsaved-changes guard; redirects to `/customers/:id` (Details = AJ). Full `customers.add.*` i18n en + bn-BD; `smoke:m6ai` PASS, `smoke:m6ah` + `smoke:m6ag` still PASS, lint + build clean. Next = Authorize M6 Batch AJ. |
| 2026-08-20 | **M6 Batch AJ** — live Customer Details at `/customers/:customerId` (`GET /api/v1/owner/customers/:id`): header + status badge + Edit Customer / More Actions disabled; KPIs (loyalty / total purchases / visits / last purchase); Customer Information + Registration Information (Source/Branch/Submitted/Approved + Original Registration Values); Purchase History rows → `/sales/:id`; Loyalty Activity with running balance; known-facts Timeline; pending id → Review redirect; honest zeros/—. `GET /owner/customers/:id` additively returns `storeName`, `lastPurchaseAt`, `purchaseHistory.rows`, `loyaltyActivity.rows`. Full `customers.detail.*` i18n en + bn-BD; `smoke:m6aj` PASS, `smoke:m6ai` + `smoke:m6ah` + `smoke:m6ag` still PASS, server + web lint + web build clean. Next = Authorize M6 Batch AK. |
| 2026-08-20 | **M6 Batch AK** — live Customer Registration Review at `/customers/:customerId/review` (OWNER only; Review not re-shared, Admin Portal family used): read-only Registration Request (name/phone/source/submitted/branch/by) + live phone-check duplicate panel (ignores the same customer, blocks approve on a different owner) + editable Review Profile (Owner corrects before approve); right rail Registration Info + Approval Action; Approve modal (checkbox-gated teal, corrections saved) → `POST /api/v1/owner/customers/:id/approve` → Details (Active); Reject modal (invented to match the Approve family — checkbox-gated red, optional rejection note) → `POST /api/v1/owner/customers/:id/reject` → list (row gone, phone reusable); Cancel → list; Active/Inactive id → Details redirect; unsaved-changes guard; no POS Create (AL). Full `customers.review.*` i18n en + bn-BD; `approveCustomer` + `rejectCustomer` clients; `CustomersPlaceholder` removed; `smoke:m6ak` PASS (live pending→approve→POS Active-search covered by `smoke:m6af`), `smoke:m6aj` + `smoke:m6ai` + `smoke:m6ah` + `smoke:m6ag` updated/still PASS, web lint + web build clean. Next = Authorize M6 Batch AL. |
