# Milestone 4 — One-way Sync (Batch Execution Plan)

**Document type:** Fresh-chat execution guide for Milestone 4 only  
**Source of truth:** [`PROJECT_MASTER_PLAN.md`](PROJECT_MASTER_PLAN.md)  
**Live progress context:** [`Current_Status.md`](Current_Status.md)  
**API catalog:** [`Completed_API_lists.md`](Completed_API_lists.md)  
**Authorized plan:** [`.cursor/plans/m4_one-way_sync_a1d2e18c.plan.md`](.cursor/plans/m4_one-way_sync_a1d2e18c.plan.md)  
**Status of M4:** **DONE** — user authorized 2026-08-13; Batches A–F complete 2026-08-14.  
**Prerequisite:** Milestone 0–**3** **DONE** (cloud API + desktop POS shell Slice 1–6). Queue table (M3 Batch E) + flush (M4 A–E) + catalog §19 (Batch F).  
**Do not start:** M5 hardening, M6 owner web / bi-di sync / n8n / RLS, Slice 7+ POS screens, real printer / card SDK / MFS APIs, hard reservation / cloud hold, Baki — unless the user re-authorizes.

---

## How to use this file

1. Open a **fresh Cursor chat** for each batch.
2. Attach / `@` these files:
   - `PROJECT_MASTER_PLAN.md`
   - `Current_Status.md`
   - `MILESTONE_4_EXECUTION.md` (this file)
   - `Completed_API_lists.md` (especially from Batch B onward)
3. Paste **only** that batch’s **Agent prompt** (or say `Authorize M4 Batch X`).
4. Agent implements **only** that batch.
5. When the batch is done, the agent **must paste the User walkthrough** for that batch into the chat summary (do not skip). Every **YOU DO** step must be called out.
6. You run the walkthrough (and any **YOU DO** commands). Tell the agent pass/fail.
7. Mark the batch checkbox when its exit check passes.
8. Proceed to the next batch only after the previous one is green.

> **Hard rules:**
> - Implement **one batch per chat**. Do not collapse A–F into a single “do Milestone 4” run.
> - Invented screens in this file are **authorized**. Do not invent extra screens (owner web, new sidebar items, queued Sale Completed variant).
> - Chrome stays **Search Results - Napa**. **Tab is never a POS navigator.**
> - Do not change `POST /api/v1/sales/ingest` happy-path behavior. M4 adds `POST /api/v1/sync/ingest` beside it.
> - Localization: all new UI strings go through `t("...")` + `en.ts` + `bn-BD.ts`. Do not translate medicine names, batch numbers, event IDs, phones, or ৳ amounts. Latin digits only.

---

## Walkthrough + manual-task protocol (mandatory)

This milestone has **two kinds of work after every batch**:

| Kind | Who | What |
|------|-----|------|
| **Agent smoke** | Agent | Scripted check (`smoke:m4a`, `smoke:m4b`, …) run in the batch chat when possible |
| **User walkthrough** | **You** | The numbered **YOU DO** list in that batch. If the list says **None**, you only confirm the agent smoke |

**Agent must, at the end of every batch chat:**

1. Report pass/fail for the batch **Exit check**.
2. Paste the batch’s **User walkthrough** section in full (or a faithful copy).
3. List **YOU DO** steps as a numbered checklist. If there are none, write `YOU DO: none this batch`.
4. Say what to authorize next (`Authorize M4 Batch X`).
5. **Do not** start the next batch in the same chat.

**You should, after every batch:**

1. Run every **YOU DO** step (commands, UI clicks, waits).
2. Compare what you see to **What you should see**.
3. Reply in chat: walkthrough **PASS** or **FAIL** (+ screenshot/error if fail).
4. Open a **new chat** for the next batch only after PASS (or after the agent fixes FAIL).

---

## Standing setup (you keep these running)

Use this for **every** walkthrough from Batch C onward. Batch A does not need the POS UI. Batch B needs the **server** only.

### Terminals (leave them open)

**Terminal 1 — cloud API**

```bash
npm run dev -w @r2a/server
```

Wait until it is listening (default `http://127.0.0.1:8787`). Repo-root `.env` must have `DATABASE_URL` + `JWT_SECRET` (see `.env.example`). `@r2a/server` loads **repo-root `.env` only**.

**Terminal 2 — desktop UI (browser is enough for M4 walkthroughs)**

```bash
npm run dev -w @r2a/desktop
```

Open **http://localhost:1420/**  
Browser uses the **memory/localStorage** SQLite fallback (queue survives refresh). That is the supported M4 walkthrough path.

**Optional Terminal 3 — native Tauri** (real `pos_local.db`; needs Rust on PATH)

```bash
npm run dev:tauri -w @r2a/desktop
```

Use this if you want to confirm IPC, not required for batch PASS unless a batch says so.

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

**Walkthrough default:** `cashier@demo.local` / `ChangeMe123!`  
Demo drug: type **Napa** (sku `NAPA-500`). FEFO lot on the search card should be `NP23091`.

### POS path you already know (M3)

1. Login → **Shift** → **Open Shift** (F2 is soft-gated on open shift).
2. **F2** / New Sale → type `Napa` → **Enter** → Select Batch → Quantity → Add to Sale.
3. **F10** / Proceed → Payment (or loyalty zero-pay if points cover).
4. Cash / Card stub / MFS invent → Sale Completed + Receipt Preview.

M4 changes **only** what happens when the terminal is Offline / Force Offline (or the ingest call dies as network/5xx): the sale still completes locally and waits in the queue.

### Connectivity (already in M3)

- Badge (header pill) → **Force Offline** / **Go Online**.
- Settings → Connectivity is the same override.
- While forced: health probes are ignored; badge shows **Offline · Forced**.

---

## Acknowledgement — Plan & Status Audit (read-only)

This section records that `PROJECT_MASTER_PLAN.md`, `Current_Status.md`, `Completed_API_lists.md`, `MILESTONE_3_EXECUTION.md`, and the authorized M4 plan were read before writing this file. **No application code is written by this document alone.**

### Where we are

| Item | State |
|------|--------|
| M0 / M1 / M2 | **DONE** |
| M3 desktop POS shell | **DONE** (Slices 1–6 / A–AP) |
| Cloud API | Real — auth, inventory, FEFO, `POST /api/v1/sales/ingest`, **`POST /api/v1/sync/ingest` (M4)** |
| Local SQLite | Real — catalog cache + `outbound_sync_queue` (retry/dead columns + IPC) |
| Queue **flush** / 15s worker | **DONE (Batch D)** — pause on Force Offline; badge pending/syncing/error |
| Offline complete | **DONE (Batch C)** — Force Offline / offline / 5xx → `outbound_sync_queue`; same Sale Completed |
| Sync Queue panel | **DONE (Batch E)** — badge + Settings; no sidebar Sync |
| M4 exit / catalog §19 | **DONE (Batch F)** — `smoke:m4`; M4 closed |
| `@r2a/web` | Stub — not M4 |

### Milestone 4 scope (from master plan §7)

- Tauri/desktop worker every **15s** → flush `outbound_sync_queue` FIFO
- Cloud `POST /api/v1/sync/ingest` — append-only sales + stock **deltas**, idempotent by `event_id`
- Retry / backoff / dead-letter for poison events

**Master-plan exit:** Offline sale appears in Postgres after reconnect with **no duplicates**.

### User locks from M4 planning (2026-08-13)

| Topic | Lock |
|-------|------|
| Offline complete UX | **Same** Sale Completed + Receipt Preview as online. Badge shows Pending until flush. Optional info toast when queued. **No** distinct Queued Completed screen |
| Sync UI | Invent **Sync Queue panel** from the badge (and Settings → Connectivity). **No new sidebar nav.** No owner web |
| Invent | Agent invents cashier-needed sync UI; match PharmaSync teal / Search Results - Napa |

---

## Locked product & engineering decisions

Use these. **Do not re-ask** unless a batch’s Ask-before-inventing section says the default is incomplete.

### 1. Entities

M4 queue + cloud ingest handle **`entity_type: "sale"` + `action: "create"` only**.

- Payload = camelCase `SaleIngestInput` (`saleIngestSchema` in `@r2a/shared-types`).
- Cloud **reuses** `ingestSale` in `apps/server/src/modules/sale/sale.service.ts`.
- Stock is applied as **deltas inside that sale** (decrement `quantityOnHand`). Never overwrite absolute qty from the terminal.
- Zod may still list `stock_delta` / `product` / `customer` on `syncEntityTypeSchema`. Server **rejects** those per event (`status: "rejected"`). Do not implement them.

### 2. Two HTTP paths (do not merge)

| When | Route | Behavior |
|------|-------|----------|
| Online and **not** Force Offline | existing `POST /api/v1/sales/ingest` | Unchanged happy path |
| Offline, Force Offline, or ingest **network/5xx** | enqueue local → later `POST /api/v1/sync/ingest` | Same payload / same `eventId` |

If online ingest returns **4xx** (validation, 404, 409 insufficient stock): **do not enqueue**; stay on payment (today’s behavior). Cashier has not left the tender screen.

If online ingest fails as **network / 5xx / timeout**: enqueue the **same** `eventId` and still go to Sale Completed (cash may already have been taken).

### 3. Identity

- Client already generates `eventId` for ingest.
- Queue row **`id` = sale `eventId`**.
- Re-enqueue of the same id is **idempotent** (INSERT ignore / no duplicate row).
- Cloud duplicate `eventId` returns `status: "duplicate"` and **must not** decrement stock again (`ingestSale` already no-ops).

### 4. Envelope vs payload naming

| Layer | Names |
|-------|--------|
| Queue envelope + `POST /sync/ingest` **request** body | snake_case: `event_id`, `entity_type`, `action`, `payload`, `created_at` (`syncEventSchema`) |
| `payload` object | camelCase `SaleIngestInput` (`eventId`, `storeId`, `items`, …) |
| Success **response** `data.results[]` | camelCase: `eventId`, `status`, `message?` (API DTO convention) |

Map at the worker: queue `id` → request `event_id`. Payload JSON is stored as TEXT and parsed as the sale DTO.

### 5. FIFO, retry, dead-letter

| Case | Behavior |
|------|----------|
| Order | Oldest `created_at`, then `id`. Worker only takes `synced = 0 AND dead = 0` |
| Batch size | Up to **10** events per 15s tick |
| Poison **4xx** (400, 404, 409, 422, … except auth) | Mark **dead immediately**; continue FIFO with the next row |
| Transient **network / 5xx / timeout** | Increment `attempt_count`, store `last_error`, **stop the tick** (head-of-line). Next ticks retry |
| Backoff | Skip a row if `last_attempt_at` is newer than `min(15s * 2^(attempt_count-1), 240s)` |
| Max transient attempts | **8** then dead-letter |
| **401 / 403** | Attempt existing token refresh once. If still unauthorized: set badge `syncError`, **do not** dead-letter, stop the tick |
| Retry (UI) | Clears `dead`, `attempt_count`, `last_error`. Does **not** delete the sale |

**Known gap (document, do not invent void):** a later **409** (another terminal sold the lot) dead-letters the row; the local transaction log still shows the sale. Conflict UX is **M5**.

### 6. Worker location

**TypeScript in the desktop webview**, interval **15s**, using `apiRequest` + session tokens in localStorage.

- **Not** a Rust HTTP client (tokens are not in Tauri).
- SQLite I/O stays Tauri IPC when running native; Vite/browser uses `memoryBackend`.
- Pause while Force Offline **or** connectivity `mode !== "online"`.
- Also flush **immediately** on Go Online and on browser `online` (if not forced).
- After any `accepted`/`duplicate` result, optionally run existing `catalogPull` so cache matches cloud. That is **not** bi-directional sync (M6).

### 7. Local stock

On the **queue** complete path, decrement cached batch qty (`apply_cached_stock_delta`, negative `quantityChange`) so the next offline search/FEFO is honest. Clamp at **0**. Do not invent a second SQLite sales ledger — keep [`transactionLogStore`](apps/desktop/src/lib/transactionLogStore.ts).

### 8. Payments / product

- Tenders remain **CASH \| CARD \| MFS** only. **No Baki.**
- Card/MFS stay **stubs** (M3). Offline complete still queues the same ingest payload.
- Hold F6 / Held F7 unchanged. Mid-payment Hold still aborts stubs and must **not** enqueue a sale.

### 9. Historical smoke

[`apps/desktop/scripts/smoke-m3ap.ts`](apps/desktop/scripts/smoke-m3ap.ts) currently asserts `App` must not call `/sync/ingest`. **Relax that guard in Batch C or D** when `App.tsx` / the worker starts calling it. Do not leave M3 exit smoke red.

---

## Invented screens (authorized — Batch E)

No Figma. Invent to match Shift / Held list family (overlay panel, not a route).

### Screen 1 — Sync Queue panel (new)

| Piece | Spec |
|-------|------|
| Open | Badge menu **Sync queue**; Settings → Connectivity **Open sync queue** |
| Close | **Esc**; click-outside optional (match Shift/Held) |
| Header | Sync queue · `Pending n` · `Failed n` (Latin digits) |
| Rows | Time · `TXN-` / `eventId` tail · ৳ total from payload · status pill `Pending` / `Syncing` / `Failed` |
| Failed subtitle | `last_error` as returned (do not translate event IDs / batch numbers) |
| Sort | **Failed first** (`dead = 1`), then pending by `created_at` |
| Empty | All synchronized |
| Keys | `↑` `↓` move · `Enter` Retry on Failed · `Esc` close · **no Tab** |
| Retry | Not shown / no-op on Pending. Never deletes a sale |

### Screen 2 — Badge menu (extend, not a new screen)

[`ConnectivityBadge.tsx`](apps/desktop/src/features/shell/ConnectivityBadge.tsx) already has Force Offline / Go Online. Add **Sync queue**. Keep existing badge states; **wire them to real flush** in Batch D (`online_pending`, `online_syncing`, `error` when `dead > 0` or last flush failed). Forced Offline still pauses the worker.

### Screen 3 — Settings → Connectivity (extend)

Show pending count, failed count, last flush time (or “Never”), and **Open sync queue**. Do not restyle Settings chrome. Do not add a sidebar **Sync** item.

### Not a new screen

Sale Completed + Receipt Preview stay as M3. Optional queued **toast** only (`t("…")`).

---

## Architecture

```text
Cashier completes sale
        │
        ├─ online AND not forced ──► POST /api/v1/sales/ingest
        │                                │
        │                                ├─ 2xx ──► Sale Completed (cloud id)
        │                                ├─ 4xx ──► stay on payment (no queue)
        │                                └─ network/5xx ──► enqueue (same eventId)
        │
        └─ offline OR forced ──► enqueue outbound_sync_queue
                                 apply local stock delta
                                 transactionLogStore
                                 same Sale Completed
                                         │
                         15s worker (online, not forced)
                                         │
                                         ▼
                         POST /api/v1/sync/ingest
                         { events: [{ event_id, entity_type: "sale", action: "create", payload }] }
                                         │
                                         ▼
                         ingestSale (idempotent by Sale.eventId)
                         Postgres sale + stock decrement
```

---

## Chrome, keyboard, i18n (do not regress)

| Lock | Rule |
|------|------|
| Chrome | Search Results - Napa (light sidebar/header/footer, teal `#0D9488`) |
| Cart | ~40% search / ~60% Active Cart **table** |
| Tab | Never a POS navigator |
| Shortcuts | F2 New Sale · F4 substitutes · F6 Hold · F7 Held list · F8 Customer · F10 Proceed · Esc back |
| Currency | ৳ |
| i18n | `t("…")` + `en.ts` + `bn-BD.ts` for all new UI; default locale bn-BD |
| Locale switch | Must not reset cart, customer, loyalty, payment, hold, or queue |

---

## Target folder trees

### Cloud (new module — Batch B)

```text
apps/server/src/modules/sync/
  sync.router.ts
  sync.controller.ts
  sync.service.ts
```

Mount on [`apps/server/src/routes/index.ts`](apps/server/src/routes/index.ts) **inside `domainRouter`** (after `protect` + `tenantContext`):

```text
domainRouter.use("/sync", syncRouter);
```

Route: `POST /api/v1/sync/ingest`  
Do **not** put it on `/sales`. Do not add Super Admin / public ingest.

### Desktop (touch these; do not invent a second DB layer)

| Area | Files |
|------|--------|
| SQLite schema | `apps/desktop/src-tauri/src/db/schema.rs` |
| IPC | `apps/desktop/src-tauri/src/db/commands.rs`, `lib.rs`, `permissions/local-db.toml` |
| JS backends | `apps/desktop/src/lib/localDb/{types,client,memoryBackend,tauriBackend,index}.ts` |
| Complete helper | `apps/desktop/src/lib/saleIngest.ts` + `App.tsx` (four TODO(M4) sites) |
| Worker | new `apps/desktop/src/lib/syncWorker.ts` (name may vary; keep under `lib/` or `features/shell/`) |
| Badge / settings | `ConnectivityBadge.tsx`, `ConnectivityProvider.tsx`, `SettingsPanel.tsx` |
| Sync panel | new `apps/desktop/src/features/sync/` (panel + index) |
| i18n | `apps/desktop/src/i18n/locales/en.ts`, `bn-BD.ts` |
| Zod | `packages/shared-types/src/sync.ts` (+ export from `index.ts` if new symbols) |

---

## Ask-before-inventing protocol

Ask and **stop** only if:

- You would add a new cloud route besides `POST /api/v1/sync/ingest`
- You would process `stock_delta` / `product` / `customer` events
- You would add a sidebar item or a second Sale Completed variant
- You would change Prisma `Sale` / payment enums
- Two retry policies would change money/stock and this file does not pick one

Otherwise implement the locks above. Invented Sync Queue visuals are **pre-authorized**.

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
| **A** | Queue schema + IPC + memory parity | desktop SQLite / localDb | M3 E | Light — run `smoke:m4a` |
| **B** | Cloud `POST /api/v1/sync/ingest` | `apps/server` + shared-types | A | **Yes — start server + `smoke:m4b`** |
| **C** | Offline complete → queue | `saleIngest.ts` + `App.tsx` | B | **Yes — Force Offline sale** |
| **D** | 15s flush worker + badge wiring | worker + ConnectivityProvider | C | **Yes — Go Online, wait ≤15s** |
| **E** | Sync Queue panel + i18n | badge / Settings / new panel | D | **Yes — open panel, Retry** |
| **F** | M4 exit + catalog + smokes | docs + `smoke:m4` | E | **Yes — full reconnect path** |

Recommended chat order: **A → B → C → D → E → F**.

---

## Batch A — Queue schema + IPC + memory backend

**Goal:** Extend `outbound_sync_queue` so later batches can list, retry, dead-letter, and apply local stock deltas. **No worker, no `/sync/ingest`, no POS complete-path change, no Sync Queue UI.**

### Tasks

- [x] Add columns via `add_column_if_missing` (existing installs) **and** `CREATE TABLE` for new DBs:
  - `attempt_count INTEGER NOT NULL DEFAULT 0`
  - `last_error TEXT`
  - `last_attempt_at TEXT`
  - `dead INTEGER NOT NULL DEFAULT 0`
- [x] `count_unsynced` / `countUnsynced` = `synced = 0 AND dead = 0` (dead rows are **not** pending)
- [x] New IPC (camelCase args, register in `lib.rs` + `permissions/local-db.toml`):
  - `list_sync_queue` — unsynced **and** dead, for UI; include parsed fields
  - `list_sync_pending` — FIFO `synced = 0 AND dead = 0` (worker; limit optional, default 10)
  - `mark_sync_synced(id)`
  - `mark_sync_attempt(id, lastError)` — increment attempts, set `last_attempt_at`
  - `mark_sync_dead(id, lastError)`
  - `retry_sync_event(id)` — `dead = 0`, `attempt_count = 0`, clear error
  - `count_sync_dead`
  - `apply_cached_stock_delta(batchId, quantityChange)` — add delta to `cached_batches.quantity_on_hand`, clamp ≥ 0
- [x] `enqueue_sync_event`: if `id` already exists, **no-op success** (idempotent)
- [x] Memory backend + `LocalDbBackend` + `client.ts` + `tauriBackend.ts` parity for every new method
- [x] `npm run smoke:m4a -w @r2a/desktop` (Node memory backend, like `smoke:m3e`): enqueue two sales → list FIFO → count 2 → mark one dead → count 1 / dead 1 → retry → count 2 → mark synced → count 0; stock delta 100 + (−3) = 97; clamp 2 + (−5) = 0; duplicate enqueue same id stays one row
- [x] Do **not** call `/sync/ingest`. Do **not** edit `App.tsx` complete handlers.

### Allowed focus

- `apps/desktop/src-tauri/src/db/**`
- `apps/desktop/src-tauri/src/lib.rs`
- `apps/desktop/src-tauri/permissions/local-db.toml`
- `apps/desktop/src/lib/localDb/**`
- `apps/desktop/scripts/smoke-m4a.ts` + `package.json` script
- This execution file’s Batch A checkboxes only

### Exit check

- Memory smoke `smoke:m4a` PASS
- Types compile (`npm run lint -w @r2a/desktop` or `tsc`)
- Existing `enqueue_sync_event` / `count_unsynced` still work
- No POS behavior change (offline complete still blocked until C)

### Ask-before-inventing

Low-ask. Column names are locked. Do not add a local `sales` table.

### Agent prompt

```text
Implement ONLY Batch A from MILESTONE_4_EXECUTION.md
(Queue schema + IPC + memory backend parity).
Do not implement /sync/ingest, the flush worker, App.tsx complete-path, or Sync Queue UI.
Follow PROJECT_MASTER_PLAN.md and Current_Status.md stack locks.
When done, paste the Batch A User walkthrough and list every YOU DO step.
```

### User walkthrough (after Batch A)

**YOU DO — manual**

1. In a terminal at the repo root, run:

```bash
npm run smoke:m4a -w @r2a/desktop
```

2. Confirm the script prints PASS (or equivalent success) and exits 0.
3. You do **not** need to open the POS for this batch.

**What you should see**

- Checks for enqueue, FIFO list, dead vs pending counts, retry, synced, duplicate id, stock delta + clamp.
- POS still behaves like M3: Force Offline + Complete Sale still toasts that online is required (Batch C not done).

**If it fails**

- Paste the smoke output in the Batch A chat. Do not start Batch B.

**Next:** After PASS, new chat → `Authorize M4 Batch B`.

---

## Batch B — Cloud `POST /api/v1/sync/ingest`

**Goal:** Authenticated, tenant-scoped batch ingest that **reuses** `ingestSale`. Partial success per event. No desktop worker yet.

### Tasks

- [x] Extend `@r2a/shared-types` `sync.ts`:
  - `syncIngestResultStatusSchema`: `accepted` \| `duplicate` \| `rejected`
  - `syncIngestEventResultSchema`: `{ eventId, status, message? }`
  - `syncIngestResultSchema`: `{ results: [...] }`
  - Rebuild shared-types if the package needs `dist/`
- [x] New module `apps/server/src/modules/sync/` (`router → controller → service`)
- [x] `POST /ingest` on that router; mount at `/sync` on `domainRouter`
- [x] `protect` + `tenantContext` already wrap domain routes — do not skip them
- [x] Validate body with `syncIngestBatchSchema`
- [x] Process `events` **in array order**:
  - `entity_type === "sale"` and `action === "create"`: parse `payload` with `saleIngestSchema`; on Zod fail → that event `rejected` (do not 500 the batch); on success call `ingestSale(ctx, input)` → `accepted` or `duplicate` from `idempotent`
  - anything else → `rejected` with a clear message (`unsupported entity_type/action`)
- [x] HTTP **200** with locked success envelope even when some events are `rejected` (partial success). Use **400** only when the **batch wrapper** is invalid (empty `events`, schema fail on the envelope itself)
- [x] `ingestSale` 4xx (`AppError`) for one event → that result `rejected` + `message`; continue the rest
- [x] Cashiers must not receive `costPerBase` on any nested batch in the sale payload (reuse existing serialize)
- [x] Do **not** change `POST /sales/ingest`
- [x] `npm run smoke:m4b -w @r2a/server` (server must already be running), modeled on `smoke:m2`:
  1. Health
  2. Login owner + cashier
  3. Owner POST one valid sale event → `accepted`; Postgres has the sale; stock down
  4. Repeat **same** `event_id` → `duplicate`; stock **unchanged**
  5. Unknown `entity_type` → `rejected`
  6. Poison payload (bad totals) → `rejected`; later valid event in **same** batch still `accepted`
  7. Cashier token: ingest works; response items/batches omit `costPerBase`
  8. No token → 401
- [x] Document the route in code comments only; catalog §19 is **Batch F**

### Allowed focus

- `packages/shared-types/src/sync.ts` (+ `index.ts` if needed)
- `apps/server/src/modules/sync/**`
- `apps/server/src/routes/index.ts`
- `apps/server/scripts/` smoke + `package.json` `smoke:m4b`
- Reuse `sale.service.ts` `ingestSale` — do not fork stock logic

### Exit check

- `smoke:m4b` all steps PASS against running server + seed DB
- `POST /api/v1/sales/ingest` still works (`smoke:m2` still green if you re-run it)
- No desktop worker / App.tsx queue complete yet

### Ask-before-inventing

Envelope + reuse of `ingestSale` are locked. Ask only if you believe a 207 Multi-Status is required instead of 200 + per-event results (**default: 200**).

### Agent prompt

```text
Implement ONLY Batch B from MILESTONE_4_EXECUTION.md
(Cloud POST /api/v1/sync/ingest reusing ingestSale).
Do not build the desktop worker, offline complete, or Sync Queue UI.
Do not process stock_delta/product/customer events.
When done, paste the Batch B User walkthrough and list every YOU DO step.
```

### User walkthrough (after Batch B)

**YOU DO — manual**

1. Make sure **Terminal 1** is running:

```bash
npm run dev -w @r2a/server
```

2. In a **second** terminal:

```bash
npm run smoke:m4b -w @r2a/server
```

If the API is not on 8787:

```bash
# PowerShell
$env:BASE_URL="http://127.0.0.1:8787"; npm run smoke:m4b -w @r2a/server
```

3. Optional but recommended: re-run M2 smoke to prove `/sales/ingest` is untouched:

```bash
npm run smoke:m2 -w @r2a/server
```

4. You do **not** need the desktop app for this batch.

**What you should see**

- `smoke:m4b` prints PASS for health, login, accepted, duplicate (no second stock hit), unsupported entity, poison + later accepted in one batch, cashier margin omit, 401.
- POS still requires online to complete a sale (Batch C not done).

**If it fails**

- Confirm the server is up and seed login works (`owner@demo.local` / `ChangeMe123!`).
- If Neon is asleep, wake it / check `DATABASE_URL` in repo-root `.env`.
- Paste smoke output in the Batch B chat. Do not start Batch C.

**Next:** After PASS, new chat → `Authorize M4 Batch C`.

---

## Batch C — Offline complete → queue

**Goal:** Cash / Card / MFS / zero-pay can finish while Offline or Force Offline. Same Sale Completed. Rows land in `outbound_sync_queue`. Online happy path still uses `/sales/ingest`. **No 15s worker yet** (queued sales stay pending until Batch D).

### Tasks

- [x] Add `completeSaleOrQueue` (or equivalent) in [`saleIngest.ts`](apps/desktop/src/lib/saleIngest.ts):
  1. Inputs: payload, `isOnline`, `forcedOffline`
  2. If `isOnline && !forcedOffline`: `try ingestSale(payload)`; on `ApiError` with **4xx** (except treat 408/429 as transient if you must — **default: 408/429 = transient**) rethrow; on **5xx / network / TypeError** enqueue and return `{ queued: true, summary from payload }`
  3. Else: enqueue
  4. Enqueue: `id = payload.eventId`, `entityType = "sale"`, `action = "create"`, `payload` = the ingest DTO
  5. For each line with `batchId`, `apply_cached_stock_delta(batchId, -quantityBase)`
  6. Refresh pending count via existing `setPendingCount` / `countUnsynced`
- [x] Replace the four `navigator.onLine === false` / `TODO(M4)` blocks in [`App.tsx`](apps/desktop/src/App.tsx) (cash, card, MFS, zero-pay). Use **connectivity** `isOnline` + `forcedOffline`, not only `navigator.onLine` (Force Offline must queue even if the browser thinks it is online)
- [x] On queued complete: still append `transactionLogStore`; still open **the same** Sale Completed + Receipt Preview
- [x] Optional info toast when queued (i18n keys in **this** batch if the toast is shown; panel copy can wait for E)
- [x] Do **not** start the 15s worker (D). Do **not** build Sync Queue panel (E)
- [x] Relax `smoke-m3ap.ts` `/sync/ingest` guard **only if** this batch already references that path; otherwise leave it for D. Prefer: this batch does **not** HTTP `/sync/ingest` yet
- [x] `npm run smoke:m4c -w @r2a/desktop`: static/source + memory — helper queues when offline/forced; does not call `/sales/ingest` in that branch; 4xx does not enqueue; stock delta applied; App.tsx has no remaining `TODO(M4)` online-required toasts for those four paths

### Allowed focus

- `apps/desktop/src/lib/saleIngest.ts`
- `apps/desktop/src/App.tsx` (complete handlers only — do not restyle POS)
- `apps/desktop/src/lib/localDb/**` only if a thin wrapper is missing
- i18n keys for the queued toast only
- `apps/desktop/scripts/smoke-m4c.ts` + `package.json`

### Exit check

- Forced Offline + Cash complete → Sale Completed (no “online required”)
- Badge pending count ≥ 1 (Batch D/E will make this obvious; C must at least `setPendingCount`)
- Online + not forced + API up → still `POST /sales/ingest` (no extra queue row)
- Hold during card/MFS still aborts and does **not** enqueue

### Ask-before-inventing

Complete UX is locked (same Sale Completed). Ask only if 408/429 classification is unclear (**default above**).

### Agent prompt

```text
Implement ONLY Batch C from MILESTONE_4_EXECUTION.md
(Offline/Force Offline complete → outbound_sync_queue + local stock delta + same Sale Completed).
Do not implement the 15s worker or Sync Queue panel.
Use connectivity isOnline + forcedOffline, not only navigator.onLine.
When done, paste the Batch C User walkthrough and list every YOU DO step.
```

### User walkthrough (after Batch C)

**YOU DO — manual** (desktop + server running — see Standing setup)

1. Open http://localhost:1420/ (or Tauri window).
2. Log in as `cashier@demo.local` / `ChangeMe123!`.
3. **Shift → Open Shift** if the shift is closed.
4. Click the header connectivity pill → **Force Offline**. Badge must show **Offline · Forced**.
5. **F2** → search `Napa` → Enter → confirm FEFO batch → add 1 piece → **F10** → **Cash** → Exact Amount → Complete.
6. Confirm **Sale Completed** + Receipt Preview appear (same screen as online). Note the `TXN-` / invoice labels.
7. **F2** to leave completed. Glance at the badge: it should show pending (or at least not pretend Synced if the worker is not running — pending count must be > 0 once wired).
8. Open **Transactions** — the sale should be in the **local** list.
9. **Do not** click Go Online yet if you want to keep the row queued for Batch D. If you already did, that is OK only after D exists; for C, staying Forced is the point.
10. Repeat once with **Card** stub (Start → Approved) and once with **MFS** (bKash → invented confirm) while still Forced — both must Complete, not toast online-required.
11. Click badge → **Go Online**. Sale still sits locally until Batch D (worker). You should **not** yet expect Postgres to have the offline sale.

**Control (online path still works)**

12. Stay online (not forced). Sell 1 Napa Cash. This should complete via cloud as in M3 (no new pending row for that sale).

**What you should see**

- No “online required” toast on Forced complete.
- Same Sale Completed shell / print stub / Receipt Preview.
- Transactions list has the offline sale.
- Search/FEFO local qty for that Napa lot dropped by the pieces you sold (next Select Batch / search card).

**If it fails**

- If complete still demands online: Batch C is not actually wired — stay in the C chat.
- If Sale Completed looks like a new “Queued” screen: reject it; lock is same screen + optional toast.
- If online Cash also queued while the server is healthy: ingest-vs-queue branch is wrong.

**Next:** After PASS, new chat → `Authorize M4 Batch D`. Leave the Forced sale in the queue if you still have one — D will flush it.

---

## Batch D — 15s flush worker + badge wiring

**Goal:** When the terminal is **online and not forced**, drain pending queue FIFO through `POST /api/v1/sync/ingest`. Badge reflects pending / syncing / error. Pause on Force Offline.

### Tasks

- [x] `syncWorker` started from shell (e.g. `ConnectivityProvider` or `LocalDbProvider`):
  - Interval **15_000 ms**
  - Immediate flush on start (if online), on **Go Online**, and on `window` `online`
  - No overlapping ticks (mutex / in-flight flag)
  - Pause if `forcedOffline` or `mode !== "online"`
  - `list_sync_pending` (max 10) → POST `{ events: [...] }` with snake_case envelope; `payload` already camelCase
  - For each result: `accepted`/`duplicate` → `mark_sync_synced`; `rejected` → `mark_sync_dead`
  - Transport/5xx: `mark_sync_attempt` for the **first** unacked pending row (or all in-flight — **default: mark the head row only**), then **break**
  - Honor backoff using `last_attempt_at` + attempt_count (see locks)
  - After 8 transient attempts on one row → `mark_sync_dead`
  - 401: rely on `apiRequest` refresh; if still failing, `syncError = true`, break, do not dead-letter
- [x] Set `syncing` true during a tick; refresh `pendingCount` + dead count after
- [x] `deriveBadgeState` already maps pending/syncing/error — feed **real** `syncError` (dead > 0 **or** last tick failed). Do not show `error` merely because pending > 0
- [x] After any accepted/duplicate, optional `catalogPull` (existing). Do not block the cashier UI for a long pull; fire-and-forget / await with timeout is OK
- [x] Dev helper optional: `window.__r2aFlushSyncNow()` for walkthroughs (document in README or this file only)
- [x] Relax `smoke-m3ap.ts` `/sync/ingest` assertion
- [x] `smoke:m4d`: source guards (interval 15000, pause when forced, POST `/api/v1/sync/ingest`, max 8, no Baki); do not require live cloud in the Node smoke if that is awkward — live check is the **user walkthrough**

### Allowed focus

- New worker module + provider wiring
- `ConnectivityProvider.tsx` / `connectivityTypes.ts` only as needed
- `smoke-m3ap.ts` guard
- `apps/desktop/scripts/smoke-m4d.ts` + `package.json`
- i18n only if badge strings are missing (they already exist)

### Exit check

- Forced sale from C (or a new Forced sale) appears in Neon/Postgres **once** after Go Online within ~15s (or immediate flush)
- Second flush of the same `eventId` is `duplicate` / already synced — stock not double-decremented
- Force Offline: worker does not POST
- Badge: `Connected · N pending` while waiting; `Syncing…` during tick; `Synced` when empty

### Ask-before-inventing

Worker-in-JS is locked. Do not add a Rust HTTP worker.

### Agent prompt

```text
Implement ONLY Batch D from MILESTONE_4_EXECUTION.md
(15s TypeScript flush worker + badge pending/syncing/error; pause on Force Offline).
Reuse POST /api/v1/sync/ingest from Batch B. Do not build the Sync Queue panel (Batch E).
When done, paste the Batch D User walkthrough and list every YOU DO step.
```

### User walkthrough (after Batch D)

**YOU DO — manual**

1. Server + desktop running. Log in as cashier. Open Shift.
2. Badge → **Force Offline**.
3. Sell 1 Napa **Cash** (Exact Amount) → Sale Completed. Note time and approximate ৳ total.
4. Badge should show Offline / pending locally. **Do not** expect cloud yet.
5. Badge → **Go Online**. Badge should leave Forced, then **Connected · N pending** and/or **Syncing…**.
6. Wait **up to 15 seconds** (or trigger `__r2aFlushSyncNow()` in the browser console if the agent added it: DevTools → Console → `__r2aFlushSyncNow()`).
7. Badge should become **Connected · Synced** (if nothing else is queued).
8. **Prove no duplicate** (pick one):
   - Wait another 15s — badge stays Synced; no error toast spam.
   - Optional: `npm run smoke:m4b -w @r2a/server` still passes; it uses its own event ids.
9. **Pause test:** Force Offline again, complete another sale, confirm **no** flush (pending stays). Go Online → it flushes.
10. Optional native: same path in `npm run dev:tauri -w @r2a/desktop` if you have Rust.

**What you should see**

- Offline complete still works (C).
- After Go Online, pending drains without a new Sale Completed popup (sale already completed).
- Transactions list still shows the sale (local log). Cloud now has the same `eventId`.

**If it fails**

- Pending never drops: worker not started, still forced, or `/sync/ingest` 401 (login/refresh). Check Terminal 1 logs.
- Pending drops but you suspect double stock: sell a lot with known qty (Napa `NP23091`) and compare Select Batch qty vs a second terminal/API `GET /batches`.
- Badge `error` with pending 0: `syncError` not cleared after success — stay in D chat.

**Next:** After PASS, new chat → `Authorize M4 Batch E`.

---

## Batch E — Sync Queue panel + badge/Settings entry

**Goal:** Invent the cashier Sync Queue UI. Keyboard-first. i18n en + bn-BD. No new sidebar item.

### Tasks

- [x] `features/sync/SyncQueuePanel.tsx` (+ `index.ts`) per **Invented screens**
- [x] Open from ConnectivityBadge menu (second action besides Force/Go Online — `↑`/`↓` or keep one-column menu: Force/Go Online **and** Sync queue; **←/→** or **↑/↓** between items, Enter activate, Esc close, **no Tab**)
- [x] Settings → Connectivity: pending, failed, last flush time, **Open sync queue**
- [x] Enter on a Failed row → `retry_sync_event` + optional immediate `__flush` / worker nudge
- [x] Empty state; live refresh when worker marks rows (poll on interval or after flush events)
- [x] All strings in `en.ts` + `bn-BD.ts` (including aria labels). Domain `eventId` / ৳ / errors stay as data
- [x] Chrome: teal pills, light panel, match Held/Shift density
- [x] `smoke:m4e`: i18n keys exist both locales; panel source has no Tab navigator; no sidebar Sync route; Retry/Esc present

### Allowed focus

- `apps/desktop/src/features/sync/**`
- `ConnectivityBadge.tsx`, `SettingsPanel.tsx`, `App.tsx` only to mount the panel
- i18n locale files
- `smoke-m4e.ts` + `package.json`

### Exit check

- Badge → Sync queue opens the panel; Esc closes
- Failed row: Enter retries (row leaves Failed or returns to Pending)
- Settings Connectivity can open the same panel
- Sidebar still only New Sale / Transactions / Shift / Settings
- Locale switch bn-BD ↔ en does not clear the queue or cart

### Ask-before-inventing

Layout is pre-authorized. Do not add a sidebar item. Do not add a Queued Sale Completed variant.

### Agent prompt

```text
Implement ONLY Batch E from MILESTONE_4_EXECUTION.md
(Invent Sync Queue panel + badge menu + Settings Connectivity; i18n en + bn-BD).
Chrome = Search Results - Napa. No Tab navigator. No new sidebar item.
When done, paste the Batch E User walkthrough and list every YOU DO step.
```

### User walkthrough (after Batch E)

**YOU DO — manual**

1. Server + desktop running. Login cashier. Open Shift.
2. **Force Offline** → sell 1 Napa Cash → Sale Completed → Esc/F2 back.
3. Click the **badge** → choose **Sync queue** (not only Force Offline).
4. Confirm the panel lists the pending sale (time, TXN/event tail, ৳, **Pending**). Esc closes. Re-open from **Settings → Connectivity → Open sync queue**.
5. **Go Online**, wait for flush (≤15s). Re-open Sync queue → **All synchronized** (empty).
6. **Failed / Retry (optional but recommended):**
   - Force Offline, complete a sale, stay Forced (so it cannot flush).
   - If the agent documented a QA helper to mark dead, use it. Otherwise skip to step 7.
   - If you can see a **Failed** row: focus it → **Enter** → it should become Pending. Then Go Online and let it flush.
7. Switch UI language (Settings → Language) to **English** and back to **Bangla**. Queue panel strings change; numbers and ৳ do not become Bengali digits. Cart/sale state must not reset.
8. Confirm **no** new sidebar row named Sync.

**What you should see**

- Panel matches teal POS, keyboard ↑↓ / Enter / Esc.
- Pending vs Failed counts in the header use Latin digits.
- Empty copy when synced.

**If it fails**

- Tab moves between buttons: reject — arrows only.
- New sidebar item: reject.
- bn-BD missing strings (raw keys): reject; stay in E chat.

**Next:** After PASS, new chat → `Authorize M4 Batch F`.

---

## Batch F — M4 exit verification + API catalog

**Goal:** Prove the master-plan exit; write down the API; sync status docs. **No new features.**

### Tasks

- [x] `Completed_API_lists.md` **§19** (M4):
  - `POST /api/v1/sync/ingest` contract (auth, body, per-event results)
  - Desktop worker 15s, FIFO, dead-letter, queue columns
  - Desktop complete-or-queue rules
  - Sync Queue panel (no new cloud list API)
  - TODOs still open (409 conflict UX, bi-di, hardware, …)
  - `smoke:m4` / `smoke:m4b` commands
- [x] `npm run smoke:m4 -w @r2a/desktop` (and/or compose m4a–m4e) + confirm `smoke:m4b` still PASS
- [x] `smoke:m2` still PASS
- [x] Update [`Current_Status.md`](Current_Status.md): M4 **DONE**, next = M5 when authorized; desktop line includes queue flush; §9/§10/changelog
- [x] Update [`PROJECT_MASTER_PLAN.md`](PROJECT_MASTER_PLAN.md): M4 status **DONE**, progress log, suggested next command → do not start M5 unless authorized
- [x] Tick all A–F checkboxes in **this** file; progress tracker + change log
- [x] Confirm `smoke-m3ap` still runs (guard relaxed)

### Allowed focus

- Docs listed above
- Smoke scripts only if a missing assertion blocks exit
- **No** product feature work

### Exit check (master plan)

| Criterion | Must be true |
|-----------|----------------|
| Offline sale → Postgres after reconnect | Yes, one row per `eventId` |
| No duplicates | Second flush duplicate / synced no-op |
| Stock | Delta via `ingestSale`, not absolute overwrite |
| Online path | `/sales/ingest` unchanged when connected |
| UI | Sync Queue panel + badge; no new sidebar |
| Docs | Catalog §19 + status + master plan |

### Agent prompt

```text
Implement ONLY Batch F from MILESTONE_4_EXECUTION.md
(M4 exit: Completed_API_lists.md §19, Current_Status.md, PROJECT_MASTER_PLAN.md, smoke:m4).
Do not add features. Do not start M5.
When done, paste the Batch F User walkthrough (full reconnect path) and list every YOU DO step.
```

### User walkthrough (after Batch F) — full M4 exit

**YOU DO — manual** (this is the milestone acceptance path)

**A. Automated**

1. Terminal 1: `npm run dev -w @r2a/server`
2. Other terminal:

```bash
npm run smoke:m2 -w @r2a/server
npm run smoke:m4b -w @r2a/server
npm run smoke:m4a -w @r2a/desktop
npm run smoke:m4c -w @r2a/desktop
npm run smoke:m4d -w @r2a/desktop
npm run smoke:m4e -w @r2a/desktop
npm run smoke:m4 -w @r2a/desktop
```

(If Batch F folded a–e into `smoke:m4`, run what the agent documents.)

**B. Cashier path (must do)**

3. Desktop http://localhost:1420/ → `cashier@demo.local` / `ChangeMe123!` → Open Shift.
4. **Force Offline**.
5. Sell 1 Napa, **Cash**, Exact Amount → **Sale Completed** (same as online).
6. Open **Sync queue** from the badge — row is **Pending**.
7. **Go Online**. Wait ≤15s (or flush helper).
8. Sync queue empty / **All synchronized**. Badge **Connected · Synced**.
9. Transactions still shows the sale. You may sell **another** Napa **online** (not forced) to prove `/sales/ingest` still works.

**C. What you do *not* need**

- Owner web, printer hardware, real card terminal, real bKash API, Neon SQL viewer (optional). Cloud presence is proven by: pending cleared + `smoke:m4b` + a successful online sale after reconnect.

**What you should see**

- One local complete while forced, then a quiet sync. No second receipt popup on flush.
- No duplicate toast loop.

**If it fails**

- Stay in the F chat (or reopen the failing batch). Do not authorize M5.

**Next after F PASS:** M4 is **DONE**. Do **not** start M5 / Slice 7+ / hardware unless you authorize it in a new chat.

---

## Progress tracker

| Batch | Status | Date | Notes |
|-------|--------|------|-------|
| A Queue schema + IPC | **DONE** | 2026-08-13 | memory `smoke:m4a`; no worker / ingest / POS complete change |
| B `POST /sync/ingest` | **DONE** | 2026-08-13 | `smoke:m4b` 13/13; `smoke:m2` still 13/13; no desktop worker |
| C Offline complete → queue | **DONE** | 2026-08-13 | `smoke:m4c`; same Sale Completed; no 15s worker |
| D 15s worker + badge | **DONE** | 2026-08-13 | `smoke:m4d`; pause on Force Offline; `__r2aFlushSyncNow()`; no Sync Queue panel |
| E Sync Queue panel | **DONE** | 2026-08-14 | `smoke:m4e`; badge + Settings entry; Retry; `__r2aMarkHeadSyncDead()`; no sidebar Sync |
| F Exit + catalog | **DONE** | 2026-08-14 | `Completed_API_lists.md` §19; `smoke:m4`; user reconnect walkthrough **PASS**; M4 closed |

---

## M4 Full Exit (filled on Batch F)

User authorized M4 on **2026-08-13**. Batch F catalog + smokes **2026-08-14**. User reconnect walkthrough **PASS** (2026-08-14). M4 is **closed**.

### Delivered

- Offline / Force Offline checkout → same Sale Completed
- `outbound_sync_queue` flush every 15s via `POST /api/v1/sync/ingest`
- Idempotent `eventId`
- Dead-letter + Retry UI
- Badge pending / syncing / error wired for real
- Catalog §19 + `smoke:m4`

### Still not M4 (do not start unless authorized)

- M5: RBAC E2E, receiving/stock entry, real printer, conflict UX for 409, runbook
- Real card SDK / real MFS (backend-confirmed; no cashier Trx)
- Cloud `GET /sales`, cloud shift, hard reservation / shared holds
- Owner web Create Customer, bi-di sync, n8n, RLS
- Baki tender
- Slice 7+ POS screens

---

## Change log

| Date | Change |
|------|--------|
| 2026-08-13 | **M4 execution plan created** from authorized plan `m4_one-way_sync_a1d2e18c`; Batches A–F; per-batch walkthrough + YOU DO; invent Sync Queue panel; no code yet |
| 2026-08-13 | **M4 Batch A DONE** — queue retry/dead columns + IPC + memory parity; `smoke:m4a`; next = Batch B |
| 2026-08-13 | **M4 Batch B DONE** — `POST /api/v1/sync/ingest` reuses `ingestSale`; per-event accepted/duplicate/rejected; `smoke:m4b`; next = Batch C |
| 2026-08-13 | **M4 Batch C DONE** — offline/Force Offline complete → queue + local stock delta + same Sale Completed; `smoke:m4c`; next = Batch D |
| 2026-08-13 | **M4 Batch D DONE** — 15s TS flush worker + badge pending/syncing/error; pause on Force Offline; `smoke:m4d`; next = Batch E |
| 2026-08-14 | **M4 Batch E DONE** — Sync Queue panel + badge/Settings entry; i18n en + bn-BD; `smoke:m4e`; next = Batch F |
| 2026-08-14 | **M4 Batch F DONE** — catalog §19; `smoke:m4`; user reconnect walkthrough **PASS**; M4 **closed**; next = authorize M5 |

---

## Suggested first message to the agent (Batch A)

```text
Follow @PROJECT_MASTER_PLAN.md @Current_Status.md @MILESTONE_4_EXECUTION.md @Completed_API_lists.md
Authorize M4 Batch A only (queue schema + IPC + memory parity).
Do not start Batches B–F.
When done, paste the Batch A User walkthrough and list every YOU DO step.
```
