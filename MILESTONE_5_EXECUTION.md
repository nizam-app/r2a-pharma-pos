# Milestone 5 — MVP Hardening (Batch Execution Plan)

**Document type:** Fresh-chat execution guide for Milestone 5 only  
**Source of truth:** [`PROJECT_MASTER_PLAN.md`](PROJECT_MASTER_PLAN.md)  
**Live progress context:** [`Current_Status.md`](Current_Status.md)  
**API catalog:** [`Completed_API_lists.md`](Completed_API_lists.md)  
**RBAC contract:** [`ROLES_AND_PERMISSIONS.md`](ROLES_AND_PERMISSIONS.md) (v2.0.0)  
**Authorized plan:** [`.cursor/plans/m5_mvp_hardening_f0eaf968.plan.md`](.cursor/plans/m5_mvp_hardening_f0eaf968.plan.md)  
**Status of M5:** **DONE** — Batches **A–F DONE** (2026-08-14).  
**Prerequisite:** Milestone 0–**4** **DONE** (cloud API + desktop POS shell + one-way sync).  
**Do not start:** M6 owner web / bi-di sync / n8n / RLS / loyalty persist, Slice 7+ POS screens, real printer IPC, real FEFO `pinHash`, real card SDK / MFS APIs, cloud `GET /sales`, cloud shift, hard reservation / cloud hold, on-account tender — unless the user re-authorizes.

---

## How to use this file

1. Open a **fresh Cursor chat** for each batch.
2. Attach / `@` these files:
   - `PROJECT_MASTER_PLAN.md`
   - `Current_Status.md`
   - `ROLES_AND_PERMISSIONS.md`
   - `MILESTONE_5_EXECUTION.md` (this file)
   - `Completed_API_lists.md`
3. Paste **only** that batch’s **Agent prompt** (or say `Authorize M5 Batch X`).
4. Agent implements **only** that batch.
5. When the batch is done, the agent **must paste the User walkthrough** for that batch into the chat summary (do not skip). Every **YOU DO** step must be called out.
6. You run the walkthrough (and any **YOU DO** commands). Tell the agent pass/fail.
7. Mark the batch checkbox when its exit check passes.
8. Proceed to the next batch only after the previous one is green.

> **Hard rules:**
> - Implement **one batch per chat**. Do not collapse A–F into a single “do Milestone 5” run.
> - Invented screens in this file are **authorized**. Do not invent extra screens (owner web, new sidebar items, void/delete sale, Create Customer on POS).
> - Chrome stays **Search Results - Napa**. **Tab is never a POS navigator.**
> - Payments stay **`CASH` \| `CARD` \| `MFS` only**. There is no on-account / customer-due tender.
> - Keep **print stub** and **FEFO PIN stub** (user lock 2026-08-14). Do not wire printer IPC or `pinHash`.
> - Localization: all new UI strings go through `t("...")` + `en.ts` + `bn-BD.ts`. Do not translate medicine names, batch numbers, event IDs, phones, or ৳ amounts. Latin digits only.

---

## Walkthrough + manual-task protocol (mandatory)

This milestone has **two kinds of work after every batch**:

| Kind | Who | What |
|------|-----|------|
| **Agent smoke** | Agent | Scripted check (`smoke:m5a`, `smoke:m2`, …) run in the batch chat when possible |
| **User walkthrough** | **You** | The numbered **YOU DO** list in that batch. If the list says **None**, you only confirm the agent smoke |

**Agent must, at the end of every batch chat:**

1. Report pass/fail for the batch **Exit check**.
2. Paste the batch’s **User walkthrough** section in full (or a faithful copy).
3. List **YOU DO** steps as a numbered checklist. If there are none, write `YOU DO: none this batch`.
4. Say what to authorize next (`Authorize M5 Batch X`).
5. **Do not** start the next batch in the same chat.

**You should, after every batch:**

1. Run every **YOU DO** step (commands, UI clicks, waits).
2. Compare what you see to **What you should see**.
3. Reply in chat: walkthrough **PASS** or **FAIL** (+ screenshot/error if fail).
4. Open a **new chat** for the next batch only after PASS (or after the agent fixes FAIL).

---

## Standing setup (you keep these running)

Use this for **every** walkthrough from Batch B onward. Batch A needs the **server** (live `smoke:m2`). Batches C–F need desktop + server.

### Terminals (leave them open)

**Terminal 1 — cloud API**

```bash
npm run dev -w @r2a/server
```

Wait until it is listening (default `http://127.0.0.1:8787`). Repo-root `.env` must have `DATABASE_URL` + `JWT_SECRET` (see `.env.example`). `@r2a/server` loads **repo-root `.env` only**.

**Terminal 2 — desktop UI (browser is enough for M5 walkthroughs)**

```bash
npm run dev -w @r2a/desktop
```

Open **http://localhost:1420/**  
Browser uses the **memory/localStorage** SQLite fallback. That is the supported M5 walkthrough path unless a batch says otherwise.

**Optional Terminal 3 — native Tauri** (real `pos_local.db`; needs Rust on PATH)

```bash
npm run dev:tauri -w @r2a/desktop
```

Not required for batch PASS unless a batch says so.

### Desktop env

Copy `apps/desktop/.env.example` → `apps/desktop/.env` if missing:

```text
VITE_API_BASE_URL=http://127.0.0.1:8787
```

### Seed login (all roles, same password)

| Role | Email | Password |
|------|-------|----------|
| Owner | `owner@demo.local` | `ChangeMe123!` |
| Manager | `manager@demo.local` | `ChangeMe123!` |
| Cashier | `cashier@demo.local` | `ChangeMe123!` |

**Walkthrough default for checkout:** `cashier@demo.local` / `ChangeMe123!`  
**Walkthrough default for Receive stock:** `owner@demo.local` / `ChangeMe123!` (also verify Manager).  
Demo drug: type **Napa** (sku `NAPA-500`). FEFO lot on the search card should be `NP23091` until you receive a nearer-expiry sellable lot.

### POS path you already know (M3 + M4)

1. Login → **Shift** → **Open Shift** (F2 is soft-gated on open shift).
2. **F2** / New Sale → type `Napa` → **Enter** → Select Batch → Quantity → Add to Sale.
3. **F10** / Proceed → Payment (or loyalty zero-pay if points cover).
4. Cash / Card stub / MFS invent → Sale Completed + Receipt Preview.
5. Offline / Force Offline complete → same Sale Completed; Sync Queue flushes via `/sync/ingest`.

M5 does **not** change that happy path. It closes RBAC holes, adds Owner/Manager receiving, conflict copy on Failed sync rows, and pages the catalog cache.

---

## Acknowledgement — Plan & Status Audit (read-only)

This section records that `PROJECT_MASTER_PLAN.md`, `Current_Status.md`, `Completed_API_lists.md`, `ROLES_AND_PERMISSIONS.md` v2, `MILESTONE_3_EXECUTION.md`, `MILESTONE_4_EXECUTION.md`, and the authorized M5 plan were read before writing this file. **No application code is written by this document alone.**

### Where we are

| Item | State |
|------|--------|
| M0 / M1 / M2 | **DONE** |
| M3 desktop POS shell | **DONE** (Slices 1–6 / A–AP) |
| M4 one-way sync | **DONE** (A–F; catalog §19) |
| Cloud API | Real — auth, inventory, FEFO, `/sales/ingest`, `/sync/ingest` |
| Live RBAC holes | Closed in Batch A — PATCH customers/batches = OWNER+MANAGER (cashier 403) |
| Receive stock UI | Settings **Receive stock** (Batch C) — Add lot `POST /batches` + Adjust qty `PATCH`; Owner/Manager; online only |
| 409 conflict UX | Failed Sync Queue row: i18n reason + raw `last_error`; Enter Retry; no void (Batch D) |
| Catalog pull | **Paged** (Batch E) — `limit=100` + `offset` until `meta.total`; cap 50 pages (5000); no `costPerBase` in cache |
| Print / FEFO PIN | **Stubs** — stay stubs in M5 (user lock) |
| Runbook / catalog | [`docs/DEV_RUNBOOK.md`](docs/DEV_RUNBOOK.md) + catalog **§20** (Batch F) |
| `@r2a/web` | Stub — **M6**, not M5 |

### Milestone 5 scope (from master plan §7 + authorized plan)

- Owner vs Cashier RBAC end-to-end
- Purchase / stock entry for batches (desktop Settings; Owner/Manager)
- Settled tenders **Cash / Card / MFS only** (no on-account)
- Receipt path: **keep print stub** (real IPC later)
- Drug master usable at counter: **page** catalog pull (no CSV)
- Smoke tests + dev runbook

**Master-plan exit:** Single-store pharmacy sells online/offline with FEFO; cloud holds sales. Owner UI waits for M6.

### User locks from M5 planning (2026-08-14)

| Topic | Lock |
|-------|------|
| Printer | **Keep stub.** Do not implement Tauri printer IPC |
| FEFO PIN | **Keep stub** (any 4-digit + local Authorized By). No `pinHash` |
| Receive stock | Invent in **Settings** (no new sidebar). Owner + Manager only |
| 409 | Friendly Failed-row copy + Retry. **No void / delete sale** |
| Owner web | **M6** |

---

## Locked product & engineering decisions

Use these. **Do not re-ask** unless a batch’s Ask-before-inventing section says the default is incomplete.

### 1. Payments

`CASH` \| `CARD` \| `MFS` only. Fully settled at complete. Do not add a fourth method. Do not surface `Customer.creditBalance`. Master-plan M5 must **not** mention an on-account tender (Batch A strips the stale wording).

### 2. RBAC (live API — Batch A)

| Route | After M5 A |
|-------|------------|
| `POST /api/v1/customers` | **`OWNER` only** (already) |
| `PATCH /api/v1/customers/:id` | **`OWNER`, `MANAGER`** — cashier `403` |
| `POST /api/v1/batches` | **`OWNER`, `MANAGER`** (already) |
| `PATCH /api/v1/batches/:id` | **`OWNER`, `MANAGER`** — cashier `403` (including qty). Receiving is the qty path |
| Price fields | Cashier still never sees `costPerBase`; existing price `403` remains correct (now via `restrictTo`) |

Do **not** allow Manager `POST /customers`. Do **not** add sale void.

### 3. Receive stock (GRN) — Batch C

- **Online only.** If Force Offline or `mode !== "online"` → toast; do not queue a GRN.
- **Add lot:** `POST /api/v1/batches` with `productId`, `batchNumber`, `expiryDate`, `quantityOnHand` (PIECE), `costPerBase`, `sellPerBase`. Prisma field names locked.
- **Adjust qty** (damage / write-off): `PATCH /api/v1/batches/:id` with `quantityOnHand` (new absolute on-hand). Owner/Manager on the **cloud** API is allowed. This is not an offline-node absolute overwrite.
- After success: `catalogPull` so POS search/FEFO see the lot.
- No supplier-return bucket (M6). No CSV import.

### 4. 409 conflict UX — Batch D

| Path | Behavior (unchanged unless noted) |
|------|-----------------------------------|
| Online ingest **409** | Stay on payment; **do not** enqueue (already) |
| Sync flush poison **4xx** including 409 | Dead-letter that row; continue FIFO (already) |
| **M5** | Failed Sync Queue row shows a **mapped i18n reason** (insufficient stock / conflict) **plus** `last_error` as data. Enter still **Retry**. Never delete the local transaction log row or invent void |

### 5. Catalog paging — Batch E

- Page `GET /products` and `GET /batches` by `limit` + `offset` until `meta.total` is reached.
- Page size **100**. Hard cap **50** pages (5000 rows) per resource; toast if truncated.
- [`apiRequest`](apps/desktop/src/lib/api.ts) currently returns `envelope.data` only — extend a list helper so Batch E can read **`meta.total`**.
- Never write `costPerBase` into SQLite / memory cache (already dropped in `catalogPull`).
- This is **not** bi-directional sync (M6).

### 6. Stubs / out of M5

Print IPC, FEFO `pinHash`, real card SDK, real MFS APIs, loyalty persist, cloud `GET /sales`, cloud shift, bi-di catalog sync, n8n, RLS, Owner web, sale void, Slice 7+, CSV onboarding, hard holds.

### 7. Chrome / keyboard / i18n

| Lock | Rule |
|------|------|
| Chrome | Search Results - Napa (light sidebar/header/footer, teal `#0D9488`) |
| Sidebar | New Sale [F2] · Transactions · Shift · Settings — **no new item** |
| Cart | ~40% search / ~60% Active Cart **table** |
| Tab | Never a POS navigator |
| Shortcuts | F2 New Sale · F4 substitutes · F6 Hold · F7 Held list · F8 Customer · F10 Proceed · Esc back |
| Currency | ৳ |
| i18n | `t("…")` + `en.ts` + `bn-BD.ts`; default locale bn-BD |
| Locale switch | Must not reset cart, customer, loyalty, payment, hold, queue, or Settings |

---

## Invented screens (authorized)

No Figma. Invent to match Settings / Shift / Sync Queue family.

### Screen 1 — Settings → Receive stock (new section — Batch C)

Visible **only** when session role is `OWNER` or `MANAGER`. **Omitted** for Cashier (do not show a locked row).

| Piece | Spec |
|-------|------|
| Where | [`SettingsPanel.tsx`](apps/desktop/src/features/settings/SettingsPanel.tsx) — new section after Pharmacy / before or after Connectivity. **No new sidebar nav** |
| Modes | **Add lot** (default) · **Adjust qty** |
| Add lot fields | Product (search list) · `batchNumber` · `expiryDate` (`YYYY-MM-DD`) · qty PIECE · `costPerBase` · `sellPerBase` |
| Adjust qty | Product → existing batch list → new `quantityOnHand` |
| Cost fields | Owner **and** Manager may enter `costPerBase` here. Cashier never sees this section |
| Save | Online `POST` / `PATCH` → success toast → `catalogPull` |
| Offline | Info toast; no local GRN queue |
| Keys | Section list ↑/↓ like existing Settings · field list ↑/↓ · Enter save on primary · Esc close Settings · **no Tab** |
| Domain data | Product names, batch numbers, ৳ amounts **not** translated |

### Screen 2 — Sync Queue Failed conflict (extend — Batch D)

Not a new panel. Extend [`SyncQueuePanel.tsx`](apps/desktop/src/features/sync/SyncQueuePanel.tsx).

| Piece | Spec |
|-------|------|
| Failed subtitle | i18n reason when `last_error` looks like insufficient stock / 409 / conflict; always keep raw `last_error` as data (do not translate IDs) |
| Retry | Enter on Failed still `retry_sync_event`. **No** void / discard-sale action |
| Helper | Keep or add `__r2aMarkHeadSyncDead()` so the walkthrough can stage a Failed row without a second terminal |

### Not a new screen

Sale Completed, Receipt Preview, print stub, FEFO Manager Authorization stub, Select Customer (still no Create), Card/MFS stubs.

---

## Architecture

```text
Owner/Manager Settings → Receive stock (online)
        │
        ├─ Add lot ──► POST /api/v1/batches ──► catalogPull
        └─ Adjust  ──► PATCH /api/v1/batches/:id ──► catalogPull

Cashier checkout (unchanged)
        │
        ├─ online 4xx/409 ──► stay on payment
        └─ queued 409 on flush ──► mark_sync_dead
                                      │
                                      ▼
                         Sync Queue Failed + i18n conflict copy
                         Enter = Retry (no void)
```

---

## Target folder trees

### Cloud (Batch A)

| Area | Files |
|------|--------|
| Customer PATCH | [`apps/server/src/modules/customer/customer.router.ts`](apps/server/src/modules/customer/customer.router.ts) |
| Batch PATCH | [`apps/server/src/modules/batch/batch.router.ts`](apps/server/src/modules/batch/batch.router.ts) |
| M2 smoke | [`apps/server/scripts/m2-smoke.mjs`](apps/server/scripts/m2-smoke.mjs) |

No new Express modules. No Prisma migration in M5 unless a batch later proves one is required (none planned).

### Desktop

| Area | Files |
|------|--------|
| Settings / GRN | [`SettingsPanel.tsx`](apps/desktop/src/features/settings/SettingsPanel.tsx) + optional `apps/desktop/src/features/inventory/` |
| Auth role | [`AuthProvider.tsx`](apps/desktop/src/features/auth/AuthProvider.tsx) / session user |
| Sync Queue | [`SyncQueuePanel.tsx`](apps/desktop/src/features/sync/SyncQueuePanel.tsx) |
| Catalog pull | [`catalogPull.ts`](apps/desktop/src/lib/localDb/catalogPull.ts), [`api.ts`](apps/desktop/src/lib/api.ts) |
| i18n | `apps/desktop/src/i18n/locales/en.ts`, `bn-BD.ts` |
| Smokes | `apps/desktop/scripts/smoke-m5a.ts` … `smoke-m5.ts` + `package.json` |

### Docs (Batch A + F)

| File | When |
|------|------|
| This file | Checkboxes as batches complete |
| `PROJECT_MASTER_PLAN.md` | A: drop on-account wording; F: M5 **DONE** |
| `Current_Status.md` | A: Roles + this file in doc map; F: M5 DONE |
| `Completed_API_lists.md` | A: PATCH role table; F: **§20**; fix stale Slice 2 Create-toast line |
| `ROLES_AND_PERMISSIONS.md` | A or C: GRN = desktop Settings (M5), not web |
| `docs/DEV_RUNBOOK.md` | **Batch F** (new) |

---

## Ask-before-inventing protocol

Ask and **stop** only if:

- You would add a new cloud route (M5 reuses `POST/PATCH /batches` and existing customers)
- You would add a sidebar item or Owner web screen
- You would implement printer IPC, `pinHash`, void, or an on-account tender
- You would queue GRN while offline
- Two qty-adjust semantics would change stock and this file does not pick one (default: **absolute** `quantityOnHand` on PATCH)

Otherwise implement the locks above. Invented Receive stock + conflict copy are **pre-authorized**.

**How to ask:**

```text
⏸ Batch X needs a decision: "<one sentence>".
Options: …
Stopping until you reply.
```

---

## Batch overview

| Batch | Title | Primary area | Depends on | User walkthrough? |
|-------|-------|--------------|------------|-------------------|
| **A** | RBAC API + docs lock | `apps/server` + master-plan wording | M4 | **Yes — `smoke:m2`** |
| **B** | Desktop RBAC shell | Settings visibility / no cashier edit | A | **Yes — cashier vs owner Settings** |
| **C** | Receive stock UI | Settings GRN + i18n + catalogPull | B | **Yes — owner receives a Napa lot** |
| **D** | 409 conflict UX | Sync Queue Failed copy | C (UI independent; after B OK) | **Yes — stage Failed row** |
| **E** | Paged catalog pull | `catalogPull` + meta | D not required; after A | Light — `smoke:m5e` |
| **F** | Runbook + M5 exit | `docs/DEV_RUNBOOK.md` + catalog §20 | A–E | **Yes — full pilot path** |

Recommended chat order: **A → B → C → D → E → F**.

---

## Batch A — RBAC API + docs lock

**Goal:** Close live cashier PATCH holes. Strip stale on-account wording from the master plan. **No desktop GRN UI, no Sync Queue copy, no catalog paging.**

### Tasks

- [x] `PATCH /api/v1/customers/:id` → `restrictTo("OWNER", "MANAGER")` in [`customer.router.ts`](apps/server/src/modules/customer/customer.router.ts)
- [x] `PATCH /api/v1/batches/:id` → `restrictTo("OWNER", "MANAGER")` in [`batch.router.ts`](apps/server/src/modules/batch/batch.router.ts)
- [x] Keep `POST /customers` **OWNER-only**; keep `POST /batches` OWNER/MANAGER
- [x] Extend [`m2-smoke.mjs`](apps/server/scripts/m2-smoke.mjs):
  - Cashier `PATCH /customers/:id` → **403**
  - Cashier `PATCH /batches/:id` with `{ "quantityOnHand": 1 }` → **403**
  - Existing cashier price-edit **403** still PASS
  - Owner `PATCH /customers/:id` still **200** (name-only is enough)
- [x] `npm run smoke:m5a -w @r2a/desktop` (or `-w @r2a/server` source script): assert both routers contain `restrictTo("OWNER", "MANAGER")` on PATCH
- [x] [`PROJECT_MASTER_PLAN.md`](PROJECT_MASTER_PLAN.md) M5 bullets: **verify** on-account wording is gone (stripped when this file was created); tenders = Cash / Card / MFS; this execution file linked; M5 stays **PENDING** until F
- [x] [`Completed_API_lists.md`](Completed_API_lists.md) route index: PATCH customers / batches roles; fix §14.1 “Create Customer = toast stub” → Create **removed** (Owner web M6)
- [x] [`Current_Status.md`](Current_Status.md) doc map: add this file + `ROLES_AND_PERMISSIONS.md`
- [x] [`ROLES_AND_PERMISSIONS.md`](ROLES_AND_PERMISSIONS.md) live table: PATCH customers / batches match Batch A
- [x] Do **not** invent Receive stock UI. Do **not** change Sync Queue. Do **not** page `catalogPull`.

### Allowed focus

- `apps/server/src/modules/customer/customer.router.ts`
- `apps/server/src/modules/batch/batch.router.ts`
- `apps/server/scripts/m2-smoke.mjs`
- Desktop `scripts/smoke-m5a.ts` + `package.json` script (source guards)
- The four markdown files listed above
- This execution file’s Batch A checkboxes only

### Exit check

- `npm run smoke:m2 -w @r2a/server` PASS (server running) including new cashier 403s
- `npm run smoke:m5a -w @r2a/desktop` PASS
- Master plan M5 has **no** on-account tender wording
- No Settings Receive stock section yet

### Ask-before-inventing

Low-ask. Role lists are locked. Do not add Manager to `POST /customers`.

### Agent prompt

```text
Implement ONLY Batch A from MILESTONE_5_EXECUTION.md
(RBAC API + docs lock).
restrictTo OWNER+MANAGER on PATCH /customers/:id and PATCH /batches/:id.
Extend smoke:m2 cashier 403s. Strip on-account wording from master-plan M5.
Do not invent Receive stock UI, 409 copy, or catalog paging.
Follow PROJECT_MASTER_PLAN.md, Current_Status.md, ROLES_AND_PERMISSIONS.md.
When done, paste the Batch A User walkthrough and list every YOU DO step.
```

### User walkthrough (after Batch A)

**YOU DO — manual**

1. Ensure the API is running (`npm run dev -w @r2a/server`).
2. Run:

```bash
npm run smoke:m2 -w @r2a/server
npm run smoke:m5a -w @r2a/desktop
```

3. Confirm both exit 0.
4. You do **not** need to open the POS for this batch.

**What you should see**

- M2 smoke still green; new cashier PATCH customer / batch-qty cases **403**.
- POS Settings looks like M4 (no Receive stock yet).

**If it fails**

- Paste smoke output in the Batch A chat. Do not start Batch B.

**Next:** After PASS, new chat → `Authorize M5 Batch B`.

---

## Batch B — Desktop RBAC shell

**Goal:** Cashier cannot reach Receive stock or edit customers. Owner/Manager **can** see a Receive stock **placeholder** section (real form = Batch C). Create Customer stays **off** POS.

### Tasks

- [x] Settings: add a **Receive stock** section id in the section list **only** when `role` is `OWNER` or `MANAGER` (same helper pattern as `canEditPharmacyHeader`)
- [x] Cashier: that section **absent** (not disabled). Pharmacy header stays view-only for cashier (already)
- [x] Select Customer: still **no** Create. No PATCH-customer UI on POS for any role in M5 (edit = Owner web M6). Source/comment lock if needed
- [x] Placeholder body for Receive stock: short i18n “coming in this milestone” **or** empty panel ready for C — **do not** POST batches yet
- [x] i18n keys for the new section label (en + bn-BD)
- [x] `npm run smoke:m5b -w @r2a/desktop`: Settings section order includes receive only behind Owner/Manager guard; Select Customer has no create; no `POST /customers` from desktop App
- [x] Do **not** implement Add lot form (Batch C). Do **not** change cloud routers (already A).

### Allowed focus

- `apps/desktop/src/features/settings/SettingsPanel.tsx`
- `apps/desktop/src/features/pos/SelectCustomerModal.tsx` (guards only)
- i18n locale files
- `apps/desktop/scripts/smoke-m5b.ts` + `package.json`
- This file’s Batch B checkboxes

### Exit check

- Cashier Settings: Language / Pharmacy (view) / Connectivity — **no** Receive stock
- Owner Settings: Receive stock section visible
- `smoke:m5b` PASS
- No `POST /batches` from Settings yet

### Ask-before-inventing

Low-ask. Do not add a sidebar Inventory item.

### Agent prompt

```text
Implement ONLY Batch B from MILESTONE_5_EXECUTION.md
(Desktop RBAC shell).
Owner/Manager see Settings → Receive stock (placeholder).
Cashier does not. Create Customer stays off POS.
Do not POST /batches yet. Do not build the GRN form (Batch C).
When done, paste the Batch B User walkthrough and list every YOU DO step.
```

### User walkthrough (after Batch B)

**YOU DO — manual**

1. Desktop + API running.
2. Login `cashier@demo.local` → Settings. Confirm **no** Receive stock.
3. Logout. Login `owner@demo.local` → Settings. Confirm **Receive stock** section exists (placeholder OK).
4. Optional: login `manager@demo.local` — same as owner for this section.

**What you should see**

- Cashier cannot discover receiving.
- Owner/Manager can open the section. Saving a lot still waits for Batch C.

**If it fails**

- Stay in the B chat. Do not start C.

**Next:** After PASS, new chat → `Authorize M5 Batch C`.

---

## Batch C — Receive stock UI (GRN)

**Goal:** Owner/Manager can add a lot and adjust qty from Settings → Receive stock. Cashier still cannot see it. Online only.

### Tasks

- [x] Replace Batch B placeholder with the invent spec (§ Screen 1)
- [x] Product search: existing `GET /products?q=` (online). Show name as data (do not translate)
- [x] Add lot → `POST /api/v1/batches` (camelCase body matching `batchCreateSchema`)
- [x] Adjust qty → `PATCH /api/v1/batches/:id` `{ quantityOnHand }`
- [x] Success: i18n toast + `catalogPull()` (existing helper)
- [x] Errors: 4xx message toast; 409 duplicate batch number; do not invent a queue
- [x] Offline / Force Offline: block with i18n toast
- [x] Keyboard: arrows / Enter / Esc; **no Tab**
- [x] Cost fields visible in this section (Owner + Manager)
- [x] i18n en + bn-BD for labels, buttons, toasts, validation (Latin digits in qty/price)
- [x] `npm run smoke:m5c -w @r2a/desktop`: source guards (POST batches, PATCH qty, catalogPull, role gate, no Tab, no Baki, no sidebar Inventory, print/PIN stubs untouched)
- [x] Optional live check in smoke if cheap: skip if no server; walkthrough covers live POST

### Allowed focus

- Settings panel + optional `apps/desktop/src/features/inventory/`
- `catalogPull` **call sites** only (paging = E)
- i18n
- `smoke-m5c.ts` + `package.json`
- Roles one-liner: GRN = desktop Settings (M5)
- This file’s Batch C checkboxes

### Exit check

- Owner can receive a new Napa lot; cashier search (after pull) shows it
- Cashier still has no section
- `smoke:m5c` PASS
- Print stub / FEFO stub files unchanged in behavior

### Ask-before-inventing

Stop only if you would queue GRN offline or add `GET /sales`.

### Agent prompt

```text
Implement ONLY Batch C from MILESTONE_5_EXECUTION.md
(Receive stock UI).
Settings → Receive stock: Add lot (POST /batches) + Adjust qty (PATCH).
Owner/Manager only; online only; catalogPull after save; i18n en + bn-BD.
No new sidebar. No Tab. No printer IPC. No FEFO pinHash.
When done, paste the Batch C User walkthrough and list every YOU DO step.
```

### User walkthrough (after Batch C)

**YOU DO — manual**

1. API + desktop running. Login `owner@demo.local` → Open Shift not required for Settings.
2. Settings → **Receive stock** → Add lot: pick **Napa**, batch number `M5-RECV-1`, expiry `2026-09-30`, qty `20`, cost `0.80`, sell `1.20` (Latin digits). Save.
3. Logout. Login `cashier@demo.local` → Open Shift → F2 → type `Napa` → Select Batch. Confirm lot `M5-RECV-1` appears (sellable).
4. Login cashier → Settings: still **no** Receive stock.
5. Optional: Owner → Adjust qty on `M5-RECV-1` to `15` → cashier Select Batch shows 15.

**What you should see**

- New lot in the batch picker after receive.
- Cashier cannot open receiving.
- Search card FEFO may change if `2026-09-30` is the nearest sellable (today is 2026-08-14 — `NP23091` 2026-08-31 is still nearer). That is OK.

**If it fails**

- Stay in the C chat. Do not start D.

**Next:** After PASS, new chat → `Authorize M5 Batch D`.

---

## Batch D — 409 conflict UX

**Goal:** Failed Sync Queue rows explain stock conflict. Retry remains. No void.

### Tasks

- [x] Map `last_error` (case-insensitive contains `insufficient stock`, `409`, or equivalent ingest message) to i18n `syncQueue.conflictReason` (or similar)
- [x] Failed row still shows raw `last_error` as data under/beside the reason
- [x] Enter Retry unchanged (`retry_sync_event`)
- [x] **No** void / delete / discard-sale control
- [x] Dev helper remains: `__r2aMarkHeadSyncDead()` (or extend to set a 409-like `last_error` if today’s helper does not)
- [x] i18n en + bn-BD
- [x] `npm run smoke:m5d -w @r2a/desktop`: Sync Queue maps conflict; Retry present; no void string; catalog still says 409 UX is M5 until F
- [x] Do **not** change ingest 4xx-stay-on-payment behavior

### Allowed focus

- `SyncQueuePanel.tsx` + small helper in `lib/` if mapping is shared
- i18n
- `smoke-m5d.ts` + `package.json`
- This file’s Batch D checkboxes

### Exit check

- Staged Failed row shows conflict copy + Retry
- Local Transactions list still has the sale
- `smoke:m5d` PASS

### Ask-before-inventing

Stop if you would add void or a cloud reverse-sale API.

### Agent prompt

```text
Implement ONLY Batch D from MILESTONE_5_EXECUTION.md
(409 conflict UX on Sync Queue Failed rows).
i18n reason + raw last_error. Enter Retry. No void.
Do not change online 409 stay-on-payment. No printer / PIN / GRN changes.
When done, paste the Batch D User walkthrough and list every YOU DO step.
```

### User walkthrough (after Batch D)

**YOU DO — manual**

1. Desktop running (API optional for staging).
2. Login `cashier@demo.local` → Open Shift.
3. If you have no Failed row: Force Offline → complete 1 Napa Cash → open Sync Queue → in the browser console run `__r2aMarkHeadSyncDead()` (or the Batch D helper that sets a 409-style error).
4. Open **Sync queue**. Focus the Failed row.
5. Confirm conflict copy (i18n) and raw error. Press **Enter** = Retry (row may leave Failed).

**What you should see**

- Failed row is understandable without reading English-only API dumps.
- No button that deletes the sale.
- Transactions still lists the completed sale.

**If it fails**

- Stay in the D chat. Do not start E.

**Next:** After PASS, new chat → `Authorize M5 Batch E`.

---

## Batch E — Paged catalog pull

**Goal:** Local cache can hold more than 100 products/batches. Neon remains source of truth. No bi-di sync.

### Tasks

- [x] Helper to GET list pages with `limit=100` + `offset`, reading **`meta.total`** (extend `apiRequest` or add `apiRequestEnvelope`)
- [x] Loop products (`isActive=true`) and batches until `offset >= total` or **50** pages
- [x] If truncated: i18n toast once; still replace cache with what was fetched
- [x] Still **drop** `costPerBase` in `mapBatch`
- [x] `replaceCatalogCache` once at the end (not per page)
- [x] `npm run smoke:m5e -w @r2a/desktop`: fake two pages (100 + remainder) concatenate; costPerBase never in mapped batch; cap documented
- [x] Do **not** add CSV import. Do **not** change `/sync/ingest`

### Allowed focus

- `apps/desktop/src/lib/api.ts`
- `apps/desktop/src/lib/localDb/catalogPull.ts`
- i18n if toast added
- `smoke-m5e.ts` + `package.json`
- This file’s Batch E checkboxes

### Exit check

- `smoke:m5e` PASS
- Demo seed (5 products) still pulls completely
- Cashier cache still has no `costPerBase`

### Ask-before-inventing

Low-ask. Do not invent a second local master DB.

### Agent prompt

```text
Implement ONLY Batch E from MILESTONE_5_EXECUTION.md
(Paged catalog pull).
Page GET /products and GET /batches using meta.total; cap 50 pages.
Never cache costPerBase. No CSV. No bi-di sync.
When done, paste the Batch E User walkthrough and list every YOU DO step.
```

### User walkthrough (after Batch E)

**YOU DO — manual**

1. Run:

```bash
npm run smoke:m5e -w @r2a/desktop
```

2. Confirm PASS / exit 0.
3. Optional: login cashier online → search Napa still works (cache refresh on connect).

**What you should see**

- Smoke proves multi-page merge.
- POS search unchanged for the demo seed.

**If it fails**

- Stay in the E chat. Do not start F.

**Next:** After PASS, new chat → `Authorize M5 Batch F`.

---

## Batch F — Runbook + M5 exit

**Goal:** Close M5. Runbook for the next engineer. Catalog §20. Status + master plan **DONE**. Compose `smoke:m5`.

### Tasks

- [x] Add [`docs/DEV_RUNBOOK.md`](docs/DEV_RUNBOOK.md):
  - Repo-root `.env` vs `packages/database/.env`
  - Neon **or** local Postgres Docker (`DATABASE_URL`)
  - `npm install` · `db:generate` · `db:deploy` · `db:seed`
  - `npm run dev -w @r2a/server` and `npm run dev -w @r2a/desktop`
  - Optional `dev:tauri`
  - Seed logins
  - Smokes: `smoke:m2`, `smoke:m4b`, `smoke:m4`, `smoke:m5`
  - **No secrets** in the file
- [x] [`Completed_API_lists.md`](Completed_API_lists.md) **§20** — M5: PATCH roles, Receive stock (desktop-only, no new routes), 409 Sync Queue copy, paged catalog pull, stubs still out
- [x] [`PROJECT_MASTER_PLAN.md`](PROJECT_MASTER_PLAN.md) M5 **DONE**; next = M6 when authorized
- [x] [`Current_Status.md`](Current_Status.md) M5 **DONE**; bottom line; §9/§10; changelog
- [x] This file: check F boxes; progress tracker; **M5 Full Exit** section
- [x] `npm run smoke:m5 -w @r2a/desktop` composes `m5a`–`m5e` + `smoke:m4` (or source-guard equivalent) + catalog §20 / status DONE checks
- [x] Confirm print stub TODO and FEFO stub TODO **still present**
- [x] Confirm no on-account tender in master plan M5

### Allowed focus

- `docs/DEV_RUNBOOK.md` (new)
- Catalog / status / master plan / this file
- `smoke-m5.ts` + `package.json`
- Do **not** start M6 or printer IPC

### Exit check

- `smoke:m5` PASS
- `smoke:m2` still PASS
- User walkthrough F **PASS**
- M5 marked DONE in status + master plan

### Ask-before-inventing

Do not invent Owner web in the runbook as if it existed.

### Agent prompt

```text
Implement ONLY Batch F from MILESTONE_5_EXECUTION.md
(Runbook + M5 exit).
Write docs/DEV_RUNBOOK.md. Catalog §20. Mark M5 DONE in status + master plan.
smoke:m5 composes A–E + m4 guards. Do not start M6 or hardware.
When done, paste the Batch F User walkthrough and list every YOU DO step.
```

### User walkthrough (after Batch F)

**A. Commands (YOU DO)**

```bash
npm run smoke:m2 -w @r2a/server
npm run smoke:m5 -w @r2a/desktop
```

**B. Pilot path (YOU DO)**

1. API + desktop running.
2. Login `owner@demo.local` → Settings → Receive stock → add or confirm a lot.
3. Login `cashier@demo.local` → Open Shift → sell 1 Napa **Cash** online → Sale Completed (print **stub** OK).
4. Cashier Settings: **no** Receive stock. FEFO override still accepts any 4-digit PIN (stub).
5. Force Offline → sell 1 Napa Cash → Sync queue. Go Online → flush. If you stage a dead 409 row, conflict copy still shows.

**C. What you do *not* need**

- Owner web, real printer, real card terminal, real bKash, `pinHash`, CSV import.

**What you should see**

- Owner can receive stock; cashier can sell online/offline with FEFO; cloud still holds sales via ingest/sync.
- Print and FEFO PIN remain stubs.

**If it fails**

- Stay in the F chat. Do not authorize M6.

**Next after F PASS:** M5 is **DONE**. Do **not** start M6 / Slice 7+ / hardware unless you authorize it in a new chat.

---

## Progress tracker

| Batch | Status | Date | Notes |
|-------|--------|------|-------|
| A RBAC API + docs lock | **DONE** | 2026-08-14 | `restrictTo` PATCH customers/batches; `smoke:m2` + `smoke:m5a` |
| B Desktop RBAC shell | **DONE** | 2026-08-14 | Settings Receive stock placeholder Owner/Manager only; `smoke:m5b` |
| C Receive stock UI | **DONE** | 2026-08-14 | Settings GRN Add lot + Adjust qty; `smoke:m5c`; user walkthrough **PASS** |
| D 409 conflict UX | **DONE** | 2026-08-14 | Failed-row i18n + raw `last_error`; Enter Retry; `__r2aMarkHeadSyncDead()` defaults to 409; `smoke:m5d`; user walkthrough **PASS** |
| E Paged catalog pull | **DONE** | 2026-08-14 | `apiRequestEnvelope` + page products/batches to `meta.total` (cap 50); drop `costPerBase`; `smoke:m5e`; user walkthrough **PASS** |
| F Runbook + M5 exit | **DONE** | 2026-08-14 | `docs/DEV_RUNBOOK.md`; catalog §20; `smoke:m5`; user walkthrough **PASS**; M5 closed |

---

## M5 Full Exit (filled on Batch F)

Batches A–F complete **2026-08-14**. Agent `smoke:m5` + `smoke:m2` **PASS**. User pilot walkthrough **PASS** (2026-08-14). M5 is **closed**.

### Delivered

- PATCH `/customers/:id` + `/batches/:id` = OWNER+MANAGER (cashier 403, including qty)
- Settings → Receive stock (Owner/Manager; online `POST`/`PATCH /batches`; cashier omitted)
- Sync Queue Failed: i18n conflict copy + raw `last_error`; Enter Retry; **no** void
- Paged `catalogPull` (`limit=100` + `offset` until `meta.total`, cap 50 pages); never cache `costPerBase`
- Print stub + FEFO PIN stub unchanged
- [`docs/DEV_RUNBOOK.md`](docs/DEV_RUNBOOK.md) + catalog **§20** + `smoke:m5`

### Still not M5 (do not start unless authorized)

- M6: Owner web, bi-di catalog sync, loyalty persist, n8n, RLS, supplier returns
- Real printer IPC / real card SDK / real MFS APIs
- Real FEFO PIN (`pinHash`) + ingest audit
- Cloud `GET /sales` / cloud shift / blind cash count
- Hard reservation / shared holds
- On-account tender
- Slice 7+ POS screens

---

## Change log

| Date | Change |
|------|--------|
| 2026-08-14 | **M5 execution plan created** from authorized plan `m5_mvp_hardening_f0eaf968`; Batches A–F; per-batch walkthrough + YOU DO; invent Settings Receive stock + Sync Queue conflict copy; print/PIN stubs kept; no application code yet |
| 2026-08-14 | **Batch A DONE** — PATCH `/customers/:id` + `/batches/:id` OWNER+MANAGER; cashier 403 incl. qty; docs lock; `smoke:m5a` |
| 2026-08-14 | **Batch B DONE** — Settings Receive stock placeholder for Owner/Manager (cashier omitted); Create/PATCH customer still off POS; `smoke:m5b` |
| 2026-08-14 | **Batch C DONE** — Settings Receive stock Add lot (`POST /batches`) + Adjust qty (`PATCH`); Owner/Manager; online only; `catalogPull`; `smoke:m5c`; user walkthrough **PASS** |
| 2026-08-14 | **Batch D DONE** — Sync Queue Failed rows: i18n `syncQueue.conflictReason` + raw `last_error`; Enter Retry; no void; `__r2aMarkHeadSyncDead()` defaults to `409 Insufficient stock`; `smoke:m5d`; user walkthrough **PASS** |
| 2026-08-14 | **Batch E DONE** — paged `catalogPull` (`limit=100` + `offset` until `meta.total`, cap 50 pages); `costPerBase` still dropped; truncated i18n toast; `smoke:m5e`; user walkthrough **PASS** |
| 2026-08-14 | **Batch F DONE** — `docs/DEV_RUNBOOK.md`; catalog §20; status + master plan M5 **DONE**; `smoke:m5`; user pilot walkthrough **PASS**; M5 **closed** |

---

## Suggested first message to the agent (Batch A)

```text
Implement ONLY Batch A from MILESTONE_5_EXECUTION.md
(RBAC API + docs lock).
Follow @PROJECT_MASTER_PLAN.md @Current_Status.md @ROLES_AND_PERMISSIONS.md @Completed_API_lists.md
Do not implement Batches B–F in this chat.
When done, paste the Batch A User walkthrough and list every YOU DO step.
```
