# Milestone 3 — Desktop POS Shell (Batch Execution Plan)

**Document type:** Fresh-chat execution guide for Milestone 3 only  
**Source of truth:** [`PROJECT_MASTER_PLAN.md`](PROJECT_MASTER_PLAN.md)  
**Live progress context:** [`Current_Status.md`](Current_Status.md)  
**API catalog:** [`Completed_API_lists.md`](Completed_API_lists.md)  
**Status of M3:** **DONE** (2026-08-13) — user: all screens done; later finds → **Slice 7+** when authorized. Create Customer → **Owner web later**; M4 later  
**Prerequisite:** Milestone 0–2 **DONE**; Slice 1–6 exit verified; M3 full exit recorded  
**Do not start:** Milestone 4+ sync flush / `/sync/ingest` unless authorized; do not invent Slice 7+ until the user shares/authorizes; do not start hard reservation / cloud hold unless authorized

---

## How to use this file

1. Open a **fresh Cursor chat** for each batch.
2. Attach / `@` these files:
   - `PROJECT_MASTER_PLAN.md`
   - `Current_Status.md`
   - `MILESTONE_3_EXECUTION.md`
   - `Completed_API_lists.md` when wiring cloud APIs
   - Specs under `docs/` when the batch says so (`UX_Specification.md`)
3. Paste **only** that batch’s “Agent prompt” (or authorize that batch by ID).
4. If the batch says **Re-share screen**, the agent **asks you for that named screenshot**, then **stops** until you provide it (or say “use prior / invent”).
5. Agent implements **only** that batch after screen/decision is settled.
6. Mark the batch checkbox when its exit check passes.
7. Proceed to the next batch only after the previous one is green.

> **Hard rules:**
> - Implement **one batch per chat**. Do not collapse all batches into a single “do Milestone 3” run.
> - **Do not plan or build screens that are not yet in this document’s active slice.**
> - When the user shares more screens, **append a new Slice** + batches — do not invent ahead of unshared flows (except where this file already authorizes inventing).
> - **Chrome is locked** (see **Chrome consistency lock**). Per-screen mocks only drive *content* (main panel / modal / cart body). Do not reshuffle sidebar, header, or footer from later/earlier inconsistent mocks.

---

## Incremental slice protocol (mandatory)

M3 execution is written **in slices** as screens arrive.

| Rule | Behavior |
|------|----------|
| Active scope | **M3 DONE** (Slice 1–6). Later screens → **Slice 7+** when user shares/authorizes |
| More screens later | User shares → agent **appends Slice 7+** (M3 reopens IN PROGRESS for that slice only) |
| Slice complete signal | User said **“all screens done”** (2026-08-13) — M3 full exit recorded |
| Invent authorization (Slice 1) | Login + online/offline badge |
| Slice 2 stub authorization | Manager FEFO PIN + loyalty OTP (permissive) — TODOs documented |
| Slice 3 stub authorization | Receipt print UI stub; Card/MFS detail was gated (now Slice 4) |
| Slice 4 invent / stub | Card terminal stub; MFS invented confirm; Receipt Preview |
| Slice 5 invent | **All listed desktop screens invented** (no Figma required). Match PharmaSync teal / Search Results - Napa chrome. |
| Slice 6 invent | **Hold / Park Sale** invented (no Figma required). Soft hold, max 3 + 1 active. |
| Create Customer | **Deferred to `apps/web` (Owner only — not Manager).** Removed from POS UI. `POST /customers` = `restrictTo("OWNER")`. |
| Not inventable yet | Owner web Create Customer UI, real card SDK, real MFS APIs, real printer IPC, M4 flush — wait unless authorized |

---

## Acknowledgement — Plan & Status Audit (read-only)

This section records that `PROJECT_MASTER_PLAN.md` and `Current_Status.md` were read before writing this plan. No application code was written for this document alone.

### Where we are

| Item | State |
|------|--------|
| M0 / M1 / M2 | **DONE** |
| Cloud API | Real — auth, inventory, FEFO, sales ingest |
| `@r2a/desktop` | **Stub only** — this milestone |
| `@r2a/ui` | Stub — bootstrap in M3 as needed |
| Local SQLite / Tauri | Not started |

### Milestone 3 scope (from master plan §7) — full M3 (all slices combined)

- Tauri + Vite + React + TS + Tailwind + Shadcn (`@r2a/ui`)
- 3-panel layout per UX + shared designs
- Full keyboard map
- Online: Cloud API; Offline: SQLite + queue
- Header online/offline sync badge
- Thermal print stub (80mm) via Tauri IPC

**Master-plan exit (full M3, after all slices):** Keyboard checkout online; offline sale in SQLite + queue; local search snappy (&lt;50ms target).

**Slice 1 exit (this document only):** Login → Counter Ready → New Sale → search → batch → qty/packaging → line in cart; connectivity badge works; local SQLite + queue table exist; **stop before Payment**.

### Explicitly out of scope for every M3 batch (until a later slice / milestone says otherwise)

- `POST /api/v1/sync/ingest` cloud multi-entity pipeline + 15s flush worker (**M4**)
- Owner web (`apps/web`), n8n, Postgres RLS
- Payment gateway processors
- Super Admin platform console
- Baki tender
- Drive-by cloud API redesign (consume M2 APIs; ask before changing server contracts)

---

## Slice 1 — Active screen inventory

| # | Screen name (use this exact label when asking) | Source | In Slice 1? |
|---|-----------------------------------------------|--------|-------------|
| 0 | **Login** | Invented (user-authorized) | Yes |
| 1 | **Counter Ready - Terminal 01** | Shared screenshot | Yes |
| 2 | **Empty POS - New Sale started** | Shared screenshot | Yes |
| 3 | **Search Results - Napa** | Shared screenshot — **also chrome baseline** | Yes |
| 4 | **Select Batch** | Shared screenshot | Yes |
| 5 | **Quantity & Packaging** | Shared screenshot | Yes |
| 6 | **Current Sale - 1 item** | Shared screenshot | Yes |
| 7 | **Connectivity / sync badge states** | Invented (user-authorized) | Yes |
| — | Payment / Proceed complete | Not shared | **No — later slice** |
| — | Generic substitutes **F4** | Not shared | **No — later slice** |
| — | Customer picker **F8** | Affordance only (`Add [F8]`); no modal yet | Stub link only |
| — | Transactions / Shift / Settings | Nav items only | Stub routes / disabled destinations |
| — | Thermal receipt | Not shared | **No — later slice** |

---

## Design locks (Slice 1)

Use these when implementing. Prefer shared screens over UX draft when they conflict; prefer master-plan **business** rules over decorative mock details.

### Chrome consistency lock (user override — mandatory)

**Canonical chrome baseline:** screen **`Search Results - Napa`** (user-preferred; agents may **override** other mocks that disagree).

| Layer | Locked look (from Search Results - Napa) |
|-------|------------------------------------------|
| **Header** | White bar: brand **PharmaSync POS** (teal) · `TERMINAL 01` · `CASHIER: …` · green `Connected · Synced` pill · signal / sync / user icons |
| **Sidebar** | **Light grey** (not dark slate). Top: Terminal + Cashier. Nav: New Sale [F2] (solid teal active), Transactions, Shift, Settings. Bottom: Support, Help, **Logout** (red text) |
| **Main + cart frame** | White/light panels; “New Sale” title in main; right “Current Sale” column with item count, customer row, totals, Proceed |
| **Footer** | Light grey bar: `[F2] New Sale` · `[Ctrl+K] Search` · `[F8] Customer` · `[Esc] Cancel` · version right |

**Rule for every UI batch:**

1. Build **sidebar / header / footer once** to this baseline (Batch B); do not restyle them per screen.
2. When matching another named screen (Counter Ready, Empty POS, Batch modal, Qty modal, Cart 1 item, …), copy **only the content region** (center workspace and/or modal and/or cart *body*).
3. If a later screenshot shows dark sidebar, different brand string, purple window chrome, or footer shortcut typos (`Ctrl+F`, `F6`, etc.) → **ignore**; keep this lock.
4. Login (invented) should feel like the same family (teal + light grey + PharmaSync), not a separate theme.
5. Counter Ready may keep its *idle center* (icon + CTA + summary cards) but must sit inside **this** chrome.
6. **Active Cart width / table (Batch K Figma override):** search ~**40%** / cart ~**60%** + dense Active Cart **table** are locked (see Batch K design lock + `Current_Status.md` §12). If later Figma / screens show a narrow right column or stacked line cards → **ignore**; do **not** shrink the cart or revert to the old card layout unless the user explicitly re-authorizes.

**Re-share label for chrome:** `Search Results - Napa` (chrome baseline).

### Brand & chrome

| Topic | Lock |
|-------|------|
| Product name | **PharmaSync POS** — override “PharmaPOS Pro” and any other mock titles |
| Currency | **৳** (Bangladeshi Taka) — never `$` or `₺` |
| Terminal label | `Terminal 01` (display); store from JWT / config = seed `MAIN` / “Main Branch” when wired |
| Cashier label | From auth session (`users/me`), not hard-coded “Sarah W.” |
| Version footer | `v0.1.0-m3` (dev) until a release version is set — mocks may show `v2.4.1-stable`; do not treat that as product truth |
| Sidebar destinations | **New Sale [F2]** real; **Transactions / Shift / Settings** = visible stubs (toast or “Coming soon”); Support/Help = stubs; **Logout** real |
| Discount / Loyalty rows | Visible at **৳0.00**; **non-functional** until user authorizes (loyalty is Phase 2 / M6) |
| Chrome source | **Search Results - Napa** only (see lock above) |

### Colors (align chrome baseline + master plan / UX)

| Token | Value | Use |
|-------|-------|-----|
| Primary teal | `#0D9488` | Active nav, FEFO highlight, selected row, brand wordmark |
| Accent indigo | `#4F46E5` | TOTAL emphasis (as on baseline cart) |
| Background | `#F8FAFC` / light grey shell | App canvas + sidebar |
| Destructive | red (Tailwind red-600 class OK) | Logout, Cancel Sale, Expired |
| Expiry | red ≤30d / yellow ≤90d / green >90d | Badges (UX spec); “EXPIRED” blocks sell |

### Keyboard map (master plan wins over mock footer typos)

| Shortcut | Action | Slice 1 |
|----------|--------|---------|
| `Ctrl+K` or `/` | Focus product search | Yes |
| `F2` | New sale / Counter Ready → start sale | Yes |
| `F4` | Generic substitutes | **Defer** (stub hint in footer OK; no modal) |
| `F8` | Customer | Affordance only; modal later |
| `F10` | Proceed to payment | Button may show; **must not** open payment until later slice (disable or toast “Payment UI next”) |
| `Enter` | Confirm focused row / modal primary | Yes |
| `Esc` | Cancel modal / cancel sale (with confirm if cart non-empty) | Yes |
| `↑` `↓` | Navigate lists / batch rows | Yes |
| `←` `→` (or `↑` `↓` on CTAs) | Switch focused modal actions (Redeem / Continue, Keep / Remove, …) | Yes |
| `Tab` | **Not used** as a POS navigator anywhere — **ignore Figma Tab hints** | Never |

Ignore mock typos such as `Ctrl+F` search or `F6` customer. **Ignore Figma `Tab` Navigate** — arrows only.

### Sale add flow (from shared screens)

```text
Search → select product (Enter)
  → Select Batch modal (FEFO recommended = earliest sellable; expired visible, not sellable)
  → Quantity & Packaging modal (Piece / Strip / Box; stock-aware disabled units)
  → Add to Sale (Enter) → line appears in Current Sale
```

**Search card FEFO lock:** Prefer earliest **sellable** lot on the result row (batch # + expiry). Do **not** put an expired lot “in front” when sellable stock exists. Expired lots remain in Select Batch detail only. Product is EXPIRED/blocked only when no sellable stock remains.

Default walk-in customer. Do not build payment completion in Slice 1.

### Online / offline (invented — authorized)

**Badge (header):**

| State | Visual | Meaning |
|-------|--------|---------|
| `checking` | Neutral · `Checking…` | First/settling health probe in flight (not Offline) |
| `online_synced` | Green dot · `Connected · Synced` | Reachable API; queue empty |
| `online_syncing` | Green/amber · `Connected · Syncing…` | Reachable; flush in progress (M4 will own real flush; Slice 1 may simulate or no-op if queue empty) |
| `online_pending` | Amber · `Connected · N pending` | Reachable; local queue has rows |
| `offline` | Grey/red · `Offline · Queued locally` | API unreachable; POS continues on SQLite |
| `error` | Red · `Sync error` | Last flush failed (detail later / M4) |

**Behavior (Slice 1):**

- Heartbeat / health ping to cloud (`GET /api/v1/health` or login-scoped lightweight call) to flip online/offline.
- Mount/login starts as **`checking`**, then settles to connected or offline (avoid false Offline flash). Prefer `VITE_API_BASE_URL=http://127.0.0.1:…` on Windows.
- **Online:** product search + batch list via M2 APIs; cart is local UI state; sale **completion** deferred (payment slice). Optionally prefetch/cache catalog into SQLite while online.
- **Offline:** search against local SQLite catalog cache; batch/qty still work from local data; if user somehow completes a sale later, write `outbound_sync_queue` — for Slice 1, at minimum create the queue table + badge pending count API in the desktop layer.
- Never trust client `tenantId`; use JWT claims from login.
- Stock deltas / absolute overwrite rules remain for M4; Slice 1 must not invent cloud sync ingest.

**Deferred (user-requested — do not build in Slice 1 E–L unless re-authorized):**

| Feature | Intent | Likely when |
|---------|--------|-------------|
| **Force Offline / Stay Offline** | Cashier overrides auto health on **this terminal**; sticky until “Go Online” | Later desktop batch / hardening |
| **Owner/Manager presence** | See each cashier/terminal online (green) / offline (red) | Cloud heartbeat + owner UI (**M6** or later slice) |

---

## Ask-before-inventing + screen re-share protocol

### When the agent MUST ask (and stop)

1. Batch lists **Re-share screen: \<Name\>** → ask for that screenshot by **exact name**, then stop.
2. Ambiguous money/stock/RBAC/offline behavior not locked above.
3. Need to change `@r2a/shared-types`, Prisma cloud schema, or Express routes.

**How to ask for a screen:**

```text
⏸ Batch X needs the visual for: "<Screen name>".
Please re-share that screenshot (or say "use prior upload" / "invent to match theme").
Stopping until you reply.
```

### When the agent may proceed without asking

- Scaffolding / wiring locked by this file
- Login + connectivity visuals (already invent-authorized)
- Mechanical API client against `Completed_API_lists.md`

---

## Target desktop folder tree (locked)

```text
apps/desktop/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── styles/
│   ├── features/
│   │   ├── auth/          # login, session
│   │   ├── shell/         # sidebar, header, footer, badge
│   │   ├── counter/       # Counter Ready
│   │   └── pos/           # New Sale, search, modals, cart
│   ├── lib/               # api client, keys, format ৳
│   └── shared/            # hooks, shortcuts
├── src-tauri/             # Tauri (Rust) — SQLite path, IPC stubs
└── ...
packages/ui/               # shared primitives as needed (Button, Badge, …)
```

Agents may refine internal `features/*` file names but must keep **Tauri + React + Vite** and workspace name `@r2a/desktop`.

---

## Batch overview (Slice 1)

| Batch | Title | Primary area | Depends on | Re-share screen? |
|-------|-------|--------------|------------|------------------|
| **A** | Desktop scaffolding (Tauri + Vite + React + Tailwind) | `apps/desktop`, `@r2a/ui` bootstrap | M2 | No |
| **B** | Design tokens + app chrome shell | shell layout | A | Optional: Counter Ready |
| **C** | Login (invented) + session | auth | B | No (invent) |
| **D** | Connectivity badge + online/offline mode | header / lib | C | No (invent) |
| **E** | Local SQLite + catalog cache + `outbound_sync_queue` | Tauri / SQLite | D | No |
| **F** | Counter Ready - Terminal 01 | counter | E | **Yes** |
| **G** | Empty POS - New Sale started | pos shell | F | **Yes** |
| **H** | Search Results - Napa | search | G | **Yes** |
| **I** | Select Batch | modal | H | **Yes** |
| **J** | Quantity & Packaging | modal | I | **Yes** |
| **K** | Current Sale - 1 item (stop before payment) | cart | J | **Yes** |
| **L** | Slice 1 exit verification | whole desktop | K | No |

Recommended chat order: **A → B → C → D → E → F → G → H → I → J → K → L**.

---

## Batch A — Desktop scaffolding (Tauri + Vite + React + Tailwind)

**Goal:** Turn `@r2a/desktop` from a stub into a runnable Tauri + Vite + React + TypeScript app with Tailwind; bootstrap `@r2a/ui` only as needed for primitives.

### Tasks

- [x] Replace stub `apps/desktop/package.json` with real scripts: `dev`, `build`, `tauri`/`desktop` entry — no echo stubs for core scripts
- [x] Vite + React + TS; Tailwind wired; path aliases consistent with monorepo
- [x] Tauri project under `apps/desktop` (`src-tauri`) builds on Windows
- [x] Minimal `App.tsx` hello shell renders inside Tauri webview
- [x] Workspace deps: `@r2a/shared-types` (and `@r2a/ui` when first components land)
- [x] Document env: cloud `VITE_API_BASE_URL` (or equivalent) pointing at M2 server; never commit secrets
- [x] Align root turbo/workspace if required for `@r2a/desktop` build

### Allowed focus

- `apps/desktop/**`
- `packages/ui/**` (minimal bootstrap only)
- Root workspace / turbo wiring for desktop

### Exit check

- `npm run dev` (or documented Tauri dev command) shows a blank/hello window
- TypeScript project compiles
- No POS screens yet

### Ask-before-inventing

Low-ask. If Tauri version or bundler choice is unclear, prefer current stable Tauri 2 + Vite; ask only if install blockers need a product decision.

### Agent prompt

```text
Implement ONLY Batch A from MILESTONE_3_EXECUTION.md
(Desktop scaffolding: Tauri + Vite + React + Tailwind).
Follow ask-before-inventing / screen re-share protocol in that file.
Do not build login, POS screens, or SQLite yet.
Follow PROJECT_MASTER_PLAN.md and Current_Status.md stack locks.
```

---

## Batch B — Design tokens + app chrome shell

**Goal:** Global CSS variables / Tailwind theme + empty chrome locked to **Search Results - Napa** (see **Chrome consistency lock**).

### Tasks

- [x] CSS variables for teal / indigo / light grey / destructive / expiry badges
- [x] Shell layout matching baseline: light sidebar, white header, light footer, main + right cart outlets
- [x] Header: PharmaSync POS · TERMINAL · CASHIER · Connected pill · icons
- [x] Sidebar: Terminal/Cashier · New Sale [F2] (teal active) · Transactions · Shift · Settings · Support · Help · Logout (red)
- [x] Footer shortcut strip per chrome lock (`F2` / `Ctrl+K` / `F8` / `Esc`)
- [x] No real routing to unimplemented screens (stubs OK)
- [x] Do **not** use dark sidebar or PharmaPOS Pro branding

### Re-share screen

**Preferred for chrome:** `Search Results - Napa`  
If not in chat, ask for it (or “use prior upload”) before inventing alternate chrome.

### Exit check

- Empty shell matches chrome baseline proportions/colors
- Outlet ready for Counter Ready / POS content only (chrome stays fixed)

### Agent prompt

```text
Implement ONLY Batch B from MILESTONE_3_EXECUTION.md
(Design tokens + app chrome shell).
Chrome lock = "Search Results - Napa". If that screenshot is not in this chat,
ask me to re-share "Search Results - Napa" and stop.
Do not implement login or POS flows yet. Do not use dark sidebar.
```

---

## Batch C — Login (invented) + session

**Goal:** Invent a clean login screen matching PharmaSync teal/slate vibe; authenticate against M2 `POST /api/v1/auth/login`; store access + refresh tokens securely enough for desktop MVP; load `GET /api/v1/users/me`.

### Tasks

- [x] Invent Login UI: email + password; primary teal CTA; brand **PharmaSync POS**; no purple-on-white generic AI look
- [x] Call M2 login; persist tokens (prefer Tauri secure storage or OS-appropriate store; document choice)
- [x] Refresh handling using M2 `/auth/refresh` when access expires (minimal)
- [x] On success → Counter Ready route (screen built in F; placeholder OK until F)
- [x] Logout clears session (wire sidebar Logout)
- [x] Cashier-safe: never display margin fields if any profile payload includes extras

### Re-share screen

None — **invent authorized**.

### Exit check

- Login with seed `owner@demo.local` / `ChangeMe123!` (or env overrides) works against running server
- Unauthenticated users cannot open POS routes

### Agent prompt

```text
Implement ONLY Batch C from MILESTONE_3_EXECUTION.md
(Login invented + session against M2 auth).
Invent login visuals to match PharmaSync teal/slate theme.
Do not build Counter Ready content or POS search yet.
```

---

## Batch D — Connectivity badge + online/offline mode

**Goal:** Implement invented header badge states and a desktop connectivity mode used by later batches.

### Tasks

- [x] Badge UI for: `online_synced` | `online_syncing` | `online_pending` | `offline` | `error` (labels locked above)
- [x] Health/connectivity probe to `VITE_API_BASE_URL`
- [x] Global mode flag/store: `online` vs `offline`
- [x] Manual sync icon may no-op or re-probe in Slice 1 (real flush = M4)
- [x] Pending count reads from local queue when E lands (stub `0` until then)

### Re-share screen

None — **invent authorized**. Match header placement from shared POS screens.

### Exit check

- Killing API flips badge to offline within a reasonable poll interval
- Restoring API returns to connected state

### Agent prompt

```text
Implement ONLY Batch D from MILESTONE_3_EXECUTION.md
(Connectivity badge + online/offline mode — invented).
Do not implement SQLite schema yet (Batch E) unless required for a pending-count stub.
```

---

## Batch E — Local SQLite + catalog cache + outbound_sync_queue

**Goal:** Create `pos_local.db` via Tauri with minimum tables for offline search cache and sync queue (queue flush = M4).

### Tasks

- [x] Open/create `pos_local.db` in app data dir
- [x] Table `outbound_sync_queue` per master plan (`id`, `entity_type`, `action`, `payload`, `synced`, `created_at`)
- [x] Minimal local catalog/batch tables **or** a documented cache shape sufficient for offline product search + batch list (keep lean)
- [x] IPC commands: run migrations, query products, enqueue event, count unsynced
- [x] While online, provide a simple “cache pull” hook (can be thin) so offline search is not empty after first login — ask if pull shape is unclear
- [x] Do **not** implement 15s background flush to cloud `/sync/ingest`

### Exit check

- DB file created; queue insert + pending count works
- Offline mode can read *some* cached products after a pull (even if seed-sized)

### Ask-before-inventing

Ask before inventing a large local schema that duplicates all of Prisma. Prefer lean cache tables.

### Agent prompt

```text
Implement ONLY Batch E from MILESTONE_3_EXECUTION.md
(Local SQLite + catalog cache + outbound_sync_queue).
Do not implement M4 sync worker or cloud /sync/ingest.
Ask before over-building local schema.
```

---

## Batch F — Counter Ready - Terminal 01

**Goal:** Idle “Counter Ready” screen with New Sale CTA and summary cards matching design.

### Tasks

- [x] Center: storefront icon, “Counter Ready”, “Ready to start a new sale.”
- [x] Primary CTA: `+ New Sale [F2]` → navigates to Empty POS
- [x] Cards: Active Shift (stub text OK), Today’s Sales (stub or API later), Local Sync (tie to badge/queue)
- [x] `F2` works from this screen
- [x] Header/sidebar consistent with shell

### Re-share screen (mandatory ask if not in chat)

**`Counter Ready - Terminal 01`** (content only — keep chrome baseline)

### Exit check

- [x] Idle center matches Counter Ready; **chrome still = Search Results - Napa**
- [x] F2 opens New Sale shell (G may land next)

### Agent prompt

```text
Implement ONLY Batch F from MILESTONE_3_EXECUTION.md
(Counter Ready - Terminal 01 — content only).
Chrome stays locked to "Search Results - Napa"; do not adopt Counter Ready mock chrome
(e.g. PharmaPOS Pro / different shell). Re-share ask: "Counter Ready - Terminal 01"
if screenshot not in this chat — then stop. Do not build search/cart yet.
```

---

## Batch G — Empty POS - New Sale started

**Goal:** 3-panel New Sale empty state: search panel + Current Sale empty cart + disabled Proceed.

### Tasks

- [x] Layout: center search + empty medicine prompt; right cart “0 Items”; Walk-in + `Add [F8]` stub; totals ৳0; Proceed disabled
- [x] `Cancel Sale` (Esc) returns to Counter Ready (confirm if needed)
- [x] Footer shortcuts per locked map
- [x] `Ctrl+K` focuses search

### Re-share screen (mandatory ask if not in chat)

**`Empty POS - New Sale started`**

### Exit check

- [x] Empty states match design; no items; Proceed disabled; F10 does not open payment

### Agent prompt

```text
Implement ONLY Batch G from MILESTONE_3_EXECUTION.md
(Empty POS - New Sale started — content only).
Keep chrome locked to "Search Results - Napa". Re-share ask:
"Empty POS - New Sale started" if screenshot not in this chat — then stop.
Do not implement search results or modals yet.
```

---

## Batch H — Search Results - Napa

**Goal:** Product search list with FEFO / expired presentation; keyboard select.

### Tasks

- [x] Search input placeholder: medicine / generic / barcode; `[Ctrl+K]`
- [x] Online: call M2 product search; Offline: SQLite cache
- [x] Result rows: name, generic, manufacturer if available, stock, price/unit, FEFO/expiry badge; expired row red + not selectable for sale
- [x] Search card FEFO = earliest **sellable** lot (not expired-in-front when sellable stock exists)
- [x] ↑↓ + Enter selects product → opens Select Batch (I)
- [x] Target snappy feel; debounce OK; aim &lt;50ms local path

### Re-share screen (mandatory ask if not in chat)

**`Search Results - Napa`**

### Exit check

- [x] Searching seeded “Napa” (online against demo seed) shows usable rows; expired cannot be sold
- [x] With multi-lot Napa seed: search shows `NP23091` (sellable FEFO), not expired `NP23010`
### Agent prompt

```text
Implement ONLY Batch H from MILESTONE_3_EXECUTION.md
(Search Results - Napa — this screen is also the chrome baseline).
Re-share ask: "Search Results - Napa" if screenshot not in this chat — then stop.
Match search-result content + confirm chrome still matches baseline.
Do not implement batch/qty modals yet (stub navigation to I OK).
```

---

## Batch I — Select Batch

**Goal:** Batch picker modal with FEFO recommended vs expired-not-sellable.

### Tasks

- [x] Modal title Select Batch; product identity line
- [x] Columns: Batch No., Expiry, Available Qty, Status
- [x] FEFO recommended row highlighted (use M2 FEFO helper online; local expiry sort offline)
- [x] Expired: not sellable / cannot confirm
- [x] ↑↓ navigate; Enter confirms → Quantity & Packaging (J); Esc closes

### Re-share screen (mandatory ask if not in chat)

**`Select Batch`**

### Exit check

- [x] Cannot confirm expired batch; FEFO row is default focus

### Agent prompt

```text
Implement ONLY Batch I from MILESTONE_3_EXECUTION.md
(Select Batch modal — modal content only; chrome stays Search Results - Napa).
Re-share ask: "Select Batch" if screenshot not in this chat — then stop.
Do not implement Quantity & Packaging UI yet.
```

---

## Batch J — Quantity & Packaging

**Goal:** Unit (Piece/Strip/Box) + qty modal; stock-aware disabled units; add to cart.

### Tasks

- [x] Show batch + FEFO badge when applicable
- [x] Unit cards from `ProductUnit` / cache; disable insufficient stock (e.g. Box)
- [x] Qty stepper; available breakdown text when possible
- [x] Subtotal in ৳; Enter Add to Sale; Esc back to batch
- [x] On add → cart updates (K may polish; line must appear)

### Re-share screen (mandatory ask if not in chat)

**`Quantity & Packaging`**

### Exit check

- [x] Can add 1 Strip of Napa-like seeded product to cart when stock allows

### Agent prompt

```text
Implement ONLY Batch J from MILESTONE_3_EXECUTION.md
(Quantity & Packaging modal — modal content only; chrome stays Search Results - Napa).
Re-share ask: "Quantity & Packaging" if screenshot not in this chat — then stop.
Payment screen is out of scope.
```

---

## Batch K — Current Sale - 1 item (stop before payment)

**Goal:** Cart line presentation + totals + Proceed button **without** payment flow.

### Tasks

- [x] Line presentation: name, generic, line total, unit price, batch #, exp, qty × unit, Edit / Remove
- [x] Subtotal / Discount / Loyalty / TOTAL (Discount & Loyalty stay ৳0)
- [x] `Proceed to Payment [F10]` visible but **disabled or toast**: payment UI not in Slice 1
- [x] Edit re-opens qty/batch path; Remove updates totals
- [x] Item count badge

### Design lock (user override after initial card mock — 2026-08-11)

**Figma override (mandatory for all later M3+ UI batches):** keep the **live** Active Cart proportions and table. Do **not** follow older or newer Figma that reverts to a narrow right cart or stacked line cards unless the user explicitly re-authorizes.

Final Batch K cart UI:

| Topic | Lock |
|-------|------|
| Layout | Search ~**40%** / Active Cart ~**60%** (flex) — **never shrink** to pre-override narrow cart |
| Cart header | **Active Cart · N ITEMS** + **Clear sale** (in-app ConfirmDialog) |
| Line UI | Dense **table**: Item (name + strength + form + generic) · Unit · Batch · Expiry · Qty stepper · Unit price · Disc. (—) · Total · **Edit** pencil |
| Remove | **Del** on selected row (no per-row ✕); ↑↓ select · +/− qty |
| Cancel sale | Esc → ConfirmDialog → Counter Ready (empty cart exits immediately) |
| Confirm dialogs | ←/→ (or ↑/↓) between buttons · Enter activates focused · Esc dismisses · **no Tab** |
| Chrome | Still **Search Results - Napa** (teal); ignore purple from denser mocks |
| Conflict rule | `Current_Status.md` §12 + this lock **>** conflicting Figma |
| Out of scope | Payment UI, sale ingest, F8 customer modal, print |

### Re-share screen (mandatory ask if not in chat)

**`Current Sale - 1 item`** (plus later Active Cart table mocks — applied)

### Exit check

- [x] One-item (or multi-line) cart matches design spirit; no payment screen; no sale ingest required yet (ingest lands with payment slice)

### Agent prompt

```text
Implement ONLY Batch K from MILESTONE_3_EXECUTION.md
(Current Sale - 1 item — cart content only; stop before payment).
Keep chrome locked to "Search Results - Napa"; ignore dark-sidebar variants on this mock.
Re-share ask: "Current Sale - 1 item" if screenshot not in this chat — then stop.
Do NOT build payment UI, sale ingest submit, or print.
```

---

## Batch L — Slice 1 exit verification

**Goal:** Prove Slice 1 path only; list follow-ups for next screens.

### Tasks

- [x] Checklist:
  1. App launches (Tauri) — `cargo check` green; Vite `localhost:1420` 200; prior `tauri build --debug` OK
  2. Login (seed owner or cashier) — `owner@demo.local` via `smoke:m3l`
  3. Badge shows connected when API up; offline when API down — Batch D probe + health OK in smoke
  4. Counter Ready → F2 New Sale — wired in `App.tsx` / CounterReady / Empty POS (Batches F–G)
  5. Search Napa (online) — `smoke:m3l` → Napa 500mg
  6. Select FEFO batch; reject expired — FEFO `NP23091`; modal blocks expired `NP23010`
  7. Quantity & Packaging → Add to Sale — units PIECE/STRIP/BOX; Batch J add path
  8. Cart shows 1 item; Proceed does not open payment — Proceed/F10 → `showComingSoon("Payment UI")`
  9. SQLite exists; queue table queryable; pending count sane — schema + `smoke:m3e` / `smoke:m3l` pending=1
- [x] Confirm stubs: Transactions/Shift/Settings/F4/F8 modal/Payment
- [x] Note next slice needs: Payment, F4, F8, print, etc.
- [ ] Update `Current_Status.md` / master plan **only if the user asks**

### Slice 1 Definition of Done

- [x] Tauri + React POS shell runs
- [x] Invented login works against M2
- [x] Counter Ready + Empty POS + Search + Batch + Qty + Cart line match shared designs
- [x] Online/offline badge behaves
- [x] Local SQLite + `outbound_sync_queue` present
- [x] No payment completion; no M4 sync worker; no Mongo

### Agent prompt

```text
Implement ONLY Batch L from MILESTONE_3_EXECUTION.md
(Slice 1 exit verification).
Do not start payment UI or Milestone 4. Report pass/fail for Slice 1 DoD.
```

---

## Suggested fresh-chat sequence (Slice 1)

1. A Scaffold  
2. B Chrome  
3. C Login  
4. D Connectivity  
5. E SQLite  
6. F Counter Ready — expect re-share ask  
7. G Empty POS — expect re-share ask  
8. H Search — expect re-share ask  
9. I Batch — expect re-share ask  
10. J Qty — expect re-share ask  
11. K Cart — expect re-share ask  
12. L Slice 1 verify  

---

## Progress tracker

| Batch | Status | Date | Notes |
|-------|--------|------|-------|
| A Scaffold | **DONE** | 2026-08-09 | Tauri 2 + Vite + React + Tailwind hello shell; `@r2a/ui` bootstrap |
| B Chrome / tokens | **DONE** | 2026-08-09 | Design tokens + AppShell chrome locked to Search Results - Napa; outlets empty |
| C Login | **DONE** | 2026-08-09 | Invented PharmaSync login; M2 session + refresh; localStorage tokens; Logout wired |
| D Connectivity | **DONE** | 2026-08-09 | Health probe + badge states; mode online/offline; sync icon re-probes; pending stub 0 |
| E SQLite + queue | **DONE** | 2026-08-09 | pos_local.db + lean catalog/queue; online cache pull; pending → badge; no M4 flush |
| F Counter Ready | **DONE** | 2026-08-09 | Idle CTA + summary cards; F2 → Empty POS placeholder; chrome = Search Results - Napa |
| G Empty POS | **DONE** | 2026-08-09 | Empty search + cart body; Ctrl+K focus; Esc/Cancel → Counter Ready; Proceed/F10 blocked |
| H Search Results | **DONE** | 2026-08-09 | Online M2 / offline cache search; sellable FEFO on card; EXPIRED only if no sellable stock; ↑↓ Enter |
| I Select Batch | **DONE** | 2026-08-09 | Select Batch modal; sellable FEFO highlight; expired blocked but listed; ↑↓ Enter; Qty stub |
| J Quantity & Packaging | **DONE** | 2026-08-09 | Qty modal; unit cards stock-aware; Esc→batch; Add→cart line; chrome = Search Results - Napa |
| K Current Sale - 1 item | **DONE** | 2026-08-11 | Active Cart table (~40/60); Edit + Del; Clear/Cancel ConfirmDialog (←/→ Enter); Proceed/F10 toast; chrome = Search Results - Napa |
| L Slice 1 verify | **DONE** | 2026-08-11 | `smoke:m3l` PASS; cargo check; Vite + API path; Slice 1 DoD met; next slice waits for screens |

---

## Slice 2 — Active screen inventory

Shared 2026-08-11 in sequence. **Chrome** remains **Search Results - Napa** (modals/content only).

| # | Screen name (use this exact label when asking) | In Slice 2? |
|---|-----------------------------------------------|-------------|
| 1 | **Edit Sale Item** | Yes |
| 2 | **Change Batch - Edit Flow** | Yes |
| 3 | **Change Batch - Manual FEFO Override** | Yes |
| 4 | **Manager Authorization - FEFO Override** | Yes (stub auth) |
| 5 | **Edit Sale Item - Override Authorized** | Yes |
| 6 | **Current Sale - Override Applied + Toast** | Yes |
| 7 | **Remove Item Confirm** | Yes |
| 8 | **Select Customer** | Yes (no Baki; no Create Customer form) |
| 9 | **Redeem Loyalty Points** | Yes (stub; see locks) |
| 10 | **Verify Loyalty Redemption OTP** | Yes (any 6 digits stub) |
| 11 | **Complete Sale - Zero Payable** | Yes (loyalty-covered path) |
| 12 | **Sale Completed** | Yes |
| — | Cash / Card / MFS tender | **No — Slice 3** (user will share) |
| — | F4 Generic / Create Customer / thermal receipt / Transactions / Shift / Settings | **No — later** |

---

## Design locks (Slice 2)

### Product locks (user 2026-08-11)

| Topic | Lock |
|-------|------|
| Chrome | **Search Results - Napa** shell; these mocks = **modal / cart content only** |
| Baki | **None.** Strip any “Baki” / outstanding-baki UI. Do not show `creditBalance` as Baki. (Field may remain in DB unused in POS.) |
| Manager FEFO override | Build UI; **stub authorize** (same spirit as loyalty OTP). **Document** real manager PIN + audit API for later (do not forget). |
| Loyalty OTP | Build UI; **any 6 digits** accept for now. **Document** real SMS/OTP + server verify for later. |
| Redeem UI CTA | **Continue without redeeming** = **default focus**, **colorful primary styling**, placed on the **right**. Redeem secondary/left (override mock if needed). |
| Modal CTA navigate | **`←` `→` (or `↑` `↓`)** between actions. **`Tab` is never a POS navigator** — ignore Figma Tab hints (Redeem / OTP / Confirm / later modals). |
| After “continue without redeeming” | **Do not invent** Cash/Card/MFS. Toast / gate: payment tender UI = **Slice 3**. |
| Loyalty-covered sale | When redeem reduces **Amount Due → ৳0**, use **Complete Sale - Zero Payable** → **Sale Completed**. |
| Loyalty math on every completed sale | **Mandatory:** calculate **redeem** (if applied) **and earn** on complete. See table below. Tender Slice 3 must reuse the same calculator. |
| No invent | F4, Create Customer screen, tender payment, receipt layout — wait for screens |

### Loyalty calculation (locked for Slice 2 + future tender)

From shared screens + PRD example; implement one shared helper used by Complete Sale and (later) Cash/Card/MFS:

| Rule | Value |
|------|--------|
| Redeem rate | **1 point = ৳1.00** |
| Redeem eligibility | Available points **≥ 50** |
| Redeem cap | `min(availablePoints, floor(saleTotalTaka))` — cannot exceed current sale total |
| Earn rate | **1 point per ৳100** merchandise paid/spent after discounts (PRD: e.g. 1 per 100 BDT). Use `floor(netPayableBeforeLoyaltyRedeem / 100)` unless user re-locks. On **full loyalty cover** (amount due 0), **earned = 0** matches Sale Completed mock. |
| Display | Previous bal → earned → used (−) → current bal on Sale Completed |
| Persistence (Slice 2) | Prefer updating customer via existing M2 customer APIs if fields allow; if API cannot persist points/audit, **local/session apply + TODO** and list required routes in `Completed_API_lists.md` at Slice 2 exit |

### Integration TODOs (must not be forgotten)

Record in code comments + Slice 2 exit notes + `Completed_API_lists.md` after Batch U:

1. **Real manager FEFO override** — PIN/password verify, role check (MANAGER/OWNER), audit log on sale line  
2. **Real loyalty OTP** — send SMS/WhatsApp (n8n later), server-side verify, rate limit  
3. **Loyalty earn/redeem persistence** — authoritative cloud mutation on sale ingest  
4. **FEFO override flag** on sale line / ingest payload  
5. **Cash/Card/MFS tender** — Slice 3 screens; must call same loyalty calculator before ingest  

### Sale ingest (Slice 2)

- **Zero-payable (loyalty full cover):** attempt `POST /api/v1/sales/ingest` with consistent totals/payments. If M2 rejects `total: 0` / empty payments, **ask** before inventing API changes; document outcome in API catalog.  
- **Continue without redeeming:** no ingest until Slice 3 tender.  
- Offline: enqueue local sale + loyalty intent in `outbound_sync_queue` only if completing zero-pay offline is in scope; otherwise require online for complete in Slice 2 and note gap.

---

## Batch overview (Slice 2)

| Batch | Title | Depends on | Re-share screen? |
|-------|-------|------------|------------------|
| **M** | Edit Sale Item | L | **Edit Sale Item** |
| **N** | Change Batch (edit) + FEFO override warn | M | **Change Batch - Edit Flow** + **Change Batch - Manual FEFO Override** |
| **O** | Manager Authorization stub | N | **Manager Authorization - FEFO Override** |
| **P** | Override staged + cart badge/toast | O | **Edit Sale Item - Override Authorized** + **Current Sale - Override Applied + Toast** |
| **Q** | Remove Item confirm | P | **Remove Item Confirm** |
| **R** | Select Customer (F8) — no Baki | Q | **Select Customer** |
| **S** | Redeem Loyalty + OTP stub | R | **Redeem Loyalty Points** + **Verify Loyalty Redemption OTP** |
| **T** | Complete Sale zero-pay + Sale Completed + loyalty calc | S | **Complete Sale - Zero Payable** + **Sale Completed** |
| **U** | Slice 2 exit + **update `Completed_API_lists.md`** | T | No |

Recommended order: **M → N → O → P → Q → R → S → T → U**.

---

## Batch M — Edit Sale Item

**Goal:** Replace toast-only Edit with **Edit Sale Item** modal (qty/unit/batch summary + Change Batch link).

### Tasks

- [x] Modal: product identity, IN STOCK, batch bar, unit radios, qty stepper, line total, Esc Cancel / Enter Save
- [x] Wire from Active Cart **Edit**
- [x] **Change Batch** navigates to Batch N flow (stub OK until N)
- [x] Chrome unchanged

### Re-share screen

**`Edit Sale Item`**

### Agent prompt

```text
Implement ONLY Batch M from MILESTONE_3_EXECUTION.md (Edit Sale Item).
Re-share ask: "Edit Sale Item" if not in chat — then stop.
Chrome = Search Results - Napa. No loyalty/payment/FEFO-auth yet.
```

---

## Batch N — Change Batch (edit) + Manual FEFO Override

**Goal:** Change Batch table from edit; non-FEFO selection shows override warning + **Request Authorization**.

### Tasks

- [x] Modal: required pieces banner; batch table (CURRENT-FEFO / AUTH REQUIRED / EXPIRED)
- [x] Expired not selectable; FEFO current default
- [x] Selecting later batch → Manual FEFO Override alert; primary CTA **Request Authorization**
- [x] Keep Current / Back / Esc
- [x] No real auth yet (Batch O)

### Re-share screens

**`Change Batch - Edit Flow`** and **`Change Batch - Manual FEFO Override`**

### Agent prompt

```text
Implement ONLY Batch N from MILESTONE_3_EXECUTION.md
(Change Batch edit + Manual FEFO Override warn).
Re-share those two screens if missing — then stop.
Do not build Manager PIN yet (Batch O).
```

---

## Batch O — Manager Authorization stub

**Goal:** Manager Authorization modal UI; **stub** accept (document real integration TODO).

### Tasks

- [x] UI: FEFO vs requested batch compare, reason, PIN entry, Authorized By select, audit note
- [x] Stub: accept permissive PIN (align with “any 6 digits” spirit — document exact stub rule in code)
- [x] On success → Batch P staged override state
- [x] Comment + TODO: real MANAGER/OWNER verify + audit API

### Re-share screen

**`Manager Authorization - FEFO Override`**

### Agent prompt

```text
Implement ONLY Batch O from MILESTONE_3_EXECUTION.md
(Manager Authorization stub for FEFO override).
Re-share ask: "Manager Authorization - FEFO Override" if missing — stop.
Stub only — document real auth TODO. No loyalty yet.
```

---

## Batch P — Override staged + cart badge/toast

**Goal:** Return to Edit with authorized banner; Save → cart shows override + success toast.

### Tasks

- [x] Edit Sale Item override-authorized state (badge, FEFO recommended note, audit line)
- [x] Cart line: Override affordance; toast **Item updated: Batch … authorized**
- [x] Persist override metadata on cart line for later ingest/audit

### Re-share screens

**`Edit Sale Item - Override Authorized`** and **`Current Sale - Override Applied + Toast`**

### Agent prompt

```text
Implement ONLY Batch P from MILESTONE_3_EXECUTION.md
(Override staged on edit + cart badge/toast).
Re-share those screens if missing — stop.
Keep Active Cart ~40/60 table lock. No customer/loyalty yet.
```

---

## Batch Q — Remove Item confirm

**Goal:** Dedicated **Remove Item?** modal (safe default = Keep Item).

### Tasks

- [x] Replace bare remove with confirm modal matching design
- [x] Safe default focus **Keep Item**; Remove destructive
- [x] Enter / ←→ / Esc per footer hints (**no Tab** — ignore Figma Tab)
- [x] Integrate with Del / Remove from cart
- [x] Reuse same ConfirmDialog for Clear Sale / Cancel Sale

### Re-share screen

**`Remove Item Confirm`**

### Agent prompt

```text
Implement ONLY Batch Q from MILESTONE_3_EXECUTION.md (Remove Item Confirm).
Re-share ask: "Remove Item Confirm" if missing — stop.
No customer/loyalty/payment.
```

---

## Batch R — Select Customer (F8)

**Goal:** F8 **Select Customer** modal; search phone/name; walk-in; **no Baki**; no Create Customer screen.

### Tasks

- [x] Modal search + results (name, phone, **points** OK)
- [x] **Strip Baki / outstanding credit UI entirely**
- [x] Enter select; Esc close; **Continue as Walk-in**
- [x] **Create New Customer** button: disabled or toast “Coming in a later slice” — **do not invent** create form
- [x] Attach `customerId` + points snapshot to sale state
- [x] Use M2 `GET /customers` (search) when online

### Re-share screen

**`Select Customer`**

### Agent prompt

```text
Implement ONLY Batch R from MILESTONE_3_EXECUTION.md (Select Customer F8).
Re-share ask: "Select Customer" if missing — stop.
NO Baki UI. Do not invent Create Customer form. No loyalty redeem yet.
```

---

## Batch S — Redeem Loyalty + OTP stub

**Goal:** Redeem modal + OTP verify stub; CTA layout per lock.

### Tasks

- [x] Redeem modal: available points, eligibility ≥50, usable capped to sale total, remaining points
- [x] **Continue without redeeming**: **right**, **colorful primary**, **default focus**
- [x] Redeem → OTP modal; **any 6 digits** succeed; resend timer cosmetic OK
- [x] Continue without → gate/toast toward tender (**Slice 3** — no Cash/Card/MFS invent)
- [x] After successful OTP redeem → amount due may be 0 → Batch T
- [x] TODO comments: real OTP send/verify API

### Re-share screens

**`Redeem Loyalty Points`** and **`Verify Loyalty Redemption OTP`**

### Agent prompt

```text
Implement ONLY Batch S from MILESTONE_3_EXECUTION.md
(Redeem Loyalty + OTP stub).
Re-share those screens if missing — stop.
Continue without redeeming = default, colorful, RIGHT. Any 6-digit OTP OK.
Do NOT invent Cash/Card/MFS. Document real OTP TODO.
```

---

## Batch T — Complete Sale (zero-pay) + Sale Completed + loyalty calc

**Goal:** Zero-payable confirm + Sale Completed; **loyalty redeem + earn calculated**; ingest when due is 0.

### Tasks

- [x] **Complete Sale?** modal when amount due is ৳0 after loyalty
- [x] Shared **loyalty calculator** (redeem + earn) — reuse later for tender Slice 3
- [x] **Sale Completed** summary (txn id, loyalty table, item summary, auth override note, print stub button OK no-op or toast)
- [x] New Sale [F2] clears and returns to empty POS / counter flow
- [x] Online: `POST /api/v1/sales/ingest` for completed zero-pay; ask if API blockers
- [x] Print Receipt = stub only (no invent thermal layout)

### Re-share screens

**`Complete Sale - Zero Payable`** and **`Sale Completed`**

### Agent prompt

```text
Implement ONLY Batch T from MILESTONE_3_EXECUTION.md
(Complete Sale zero-pay + Sale Completed + loyalty calculate).
Re-share those screens if missing — stop.
Must calculate loyalty redeem + earn. No Cash/Card/MFS UI.
Ask before breaking M2 ingest contracts.
```

---

## Batch U — Slice 2 exit verification + API catalog update

**Goal:** Prove Slice 2 path; **mandatory** update [`Completed_API_lists.md`](Completed_API_lists.md).

### Tasks

- [x] Checklist: Edit → Change Batch → override warn → manager stub → cart toast → Remove confirm → F8 customer (no Baki) → Redeem / OTP stub → zero-pay complete → Sale Completed; continue-without → blocked pending Slice 3
- [x] Confirm loyalty calculator unit behavior (cap, threshold, earn) — `smoke:m3u`
- [x] List stub TODOs (manager auth, OTP, persistence) — in `Completed_API_lists.md` §14.3 + code TODOs
- [x] **Update `Completed_API_lists.md`:** desktop consumption, stubs, planned loyalty/override endpoints, ingest zero-pay notes
- [x] Update `Current_Status.md` / master plan **only if user asks** (left unchanged)
- [x] Optional `smoke:m3u` — `npm run smoke:m3u -w @r2a/desktop`

### Slice 2 Definition of Done

- [x] Edit + FEFO override stub path works
- [x] Remove confirm + Select Customer (no Baki)
- [x] Loyalty redeem UI + OTP stub; continue-without does not invent tender
- [x] Zero-pay complete + Sale Completed; loyalty points calculated
- [x] **`Completed_API_lists.md` updated**
- [x] No M4 sync worker; no Cash/Card/MFS invent; chrome lock held

### Agent prompt

```text
Implement ONLY Batch U from MILESTONE_3_EXECUTION.md
(Slice 2 exit + update Completed_API_lists.md).
Do not start Slice 3 tender or M4. Report pass/fail for Slice 2 DoD.
```

---

## Progress tracker (Slice 2)

| Batch | Status | Date | Notes |
|-------|--------|------|-------|
| M Edit Sale Item | **DONE** | 2026-08-11 | Modal from Active Cart Edit; Change Batch → N |
| N Change Batch + FEFO warn | **DONE** | 2026-08-11 | Edit-flow Change Batch + Manual FEFO Override; Request Auth stub → O |
| O Manager auth stub | **DONE** | 2026-08-11 | Manager Authorization modal; stub any 4-digit PIN; stages override for P |
| P Override cart/toast | **DONE** | 2026-08-11 | Override Authorized Edit; cart Override badge; toast; `fefoOverride` on line |
| Q Remove Item confirm | **DONE** | 2026-08-11 | Reusable ConfirmDialog; Del → Keep Item default; Clear/Cancel migrated |
| R Select Customer | **DONE** | 2026-08-11 | F8 modal; M2 search; no Baki; Create stub toast; walk-in; `saleCustomer` on cart |
| S Loyalty + OTP stub | **DONE** | 2026-08-11 | Redeem + OTP stub; Continue without = right primary; any 6-digit OTP; ←→ navigate (no Tab); Slice 3 / Batch T gates |
| T Zero-pay complete + loyalty calc | **DONE** | 2026-08-11 | Complete Sale zero-pay modal (no Baki); Sale Completed; loyaltyCalc redeem+earn; ingest CASH ৳0 + loyalty→discount; teal pill toasts; Print stub |
| U Slice 2 verify + API catalog | **DONE** | 2026-08-11 | `smoke:m3u`; `Completed_API_lists.md` §14; Slice 2 DoD green; no tender/M4 |

---

## Slice 3 — Active screen inventory

Shared 2026-08-11 in sequence. **Chrome** = **Search Results - Napa** for now (**static**); may become dynamic later — do not redesign shell in Slice 3.

| # | Screen name (use this exact label when asking) | In Slice 3? |
|---|-----------------------------------------------|-------------|
| 1 | **Sale Completed - Printing** | Yes (print stub state) |
| 2 | **Sale Completed - Receipt Printed** | Yes |
| 3 | **Sale Completed - Print Failed** | Yes |
| 4 | **Sale Completed - Retry Printing** | Yes |
| 5 | **Sale Completed - Canonical Ready** | Yes (shared shell target) |
| 6 | **Payment - Select Method** | Yes (Cash/Card/MFS picker) |
| 7 | **Cash Payment - Empty** | Yes |
| 8 | **Cash Payment - With Change** | Yes |
| 9 | **Sale Completed - Cash Settlement** | Yes (cash variant content) |
| — | Card payment detail | **No — wait for screens** |
| — | MFS payment detail | **No — wait for screens** |

---

## Design locks (Slice 3)

| Topic | Lock |
|-------|------|
| Chrome | **Search Results - Napa** (static for now; content/modals only). Later may be dynamic — note only; do not build theme switcher here. |
| Tender | **Single method only** per sale (no split Cash+Card). |
| Methods on picker | Show **Cash / Card / MFS**. Only **Cash** completes in Slice 3. Card/MFS → toast/gate “detail UI next when screens shared” — **do not invent** Card/MFS modals. |
| Walk-in | Allowed on Payment. **Hide** customer points row when no customer; still allow Cash (and gated Card/MFS). |
| Loyalty | Reuse `loyaltyCalc` / redeem helpers. Earn remains **1 pt / ৳100** (`LOYALTY_EARN_TAKA_PER_POINT`). Ignore mock “Below ৳1k” as a new rule. |
| Sale Completed shell | **One shared shell** (Batch X). Vary settlement block: loyalty-covered vs cash (amount paid / change / method). |
| Print | **Stub only** (fake delay → success or fail). Wire **TODO** for real Tauri thermal printer IPC (80mm). Do not invent full receipt layout engine. |
| Continue without redeeming | Opens **Payment - Select Method** (replaces Slice 2 toast gate). |
| Zero-pay loyalty path | Keep Slice 2 complete; unify onto shared Sale Completed shell + print states. |
| Ingest | Cash complete → `POST /api/v1/sales/ingest` with `CASH`, amount = due; loyalty redeem still maps per existing Slice 2 rules. Ask before breaking M2 contracts. |
| API catalog | Batch **Z** **must** update [`Completed_API_lists.md`](Completed_API_lists.md) |
| No Baki | Still none |

### Print stub state machine (locked)

```text
idle → printing → printed
              ↘ failed → retrying → printed | failed
```

- Auto-start print stub after successful Sale Completed entry (loyalty or cash).
- **SYSTEM BUSY** / footer hints while printing/retrying; New Sale disabled or secondary until ready.
- Fail path: banner + **Retry Print [Enter]** + New Sale [F2].
- Success: Reprint Receipt + New Sale [F2].
- Document `TODO(real printer IPC)` in code + API/desktop notes.

### Integration TODOs (Slice 3 — do not forget)

1. Real Tauri **printer IPC** (80mm thermal)
2. **Card** payment detail UI + any acquirer stub (when screens shared)
3. **MFS** payment detail UI (bKash/Nagad/etc. when screens shared)
4. Persist loyalty earn on cash path via cloud (same as Slice 2 TODO)
5. Offline cash complete → `outbound_sync_queue` (M4 overlap — note if not in Slice 3)

---

## Batch overview (Slice 3)

| Batch | Title | Depends on | Re-share screen? |
|-------|-------|------------|------------------|
| **V** | Payment - Select Method | U | **Payment - Select Method** |
| **W** | Cash Payment | V | **Cash Payment - Empty** + **Cash Payment - With Change** |
| **X** | Shared Sale Completed shell + cash settlement | W | **Sale Completed - Cash Settlement** + **Sale Completed - Canonical Ready** |
| **Y** | Print stub states (printing / printed / fail / retry) | X | **Sale Completed - Printing** + **Receipt Printed** + **Print Failed** + **Retry Printing** |
| **Z** | Slice 3 exit + **update `Completed_API_lists.md`** | Y | No |

Order: **V → W → X → Y → Z**.

---

## Batch V — Payment - Select Method

**Goal:** Open Payment modal after **Continue without redeeming** (and F10/Proceed when amount due &gt; 0 and no pending loyalty gate).

### Tasks

- [x] Modal: Amount Due, optional customer+points row (hide if walk-in)
- [x] Three method cards: Cash / Card / MFS; keyboard ←/→ (no Tab nav — existing lock)
- [x] Enter on **Cash** → Batch W
- [x] Enter on **Card** or **MFS** → toast/gate only (no invent detail)
- [x] Esc / Back to Sale
- [x] Single-method selection only

### Re-share screen

**`Payment - Select Method`**

### Agent prompt

```text
Implement ONLY Batch V from MILESTONE_3_EXECUTION.md (Payment - Select Method).
Re-share ask: "Payment - Select Method" if missing — stop.
Cash proceeds to W; Card/MFS gated — do not invent detail modals.
Chrome = Search Results - Napa. No Tab navigation.
```

---

## Batch W — Cash Payment

**Goal:** Cash received / change due / Exact Amount / Complete when received ≥ due.

### Tasks

- [x] Modal: Amount Due, customer row or walk-in, Cash Received input
- [x] Summary: Due / Received / Change Due
- [x] **Exact Amount** fills received = due
- [x] Complete enabled only when received ≥ due; Enter completes
- [x] Back to Payment Methods
- [x] On complete → prepare settlement for Batch X (ingest may land in X)

### Re-share screens

**`Cash Payment - Empty`** and **`Cash Payment - With Change`**

### Agent prompt

```text
Implement ONLY Batch W from MILESTONE_3_EXECUTION.md (Cash Payment).
Re-share those screens if missing — stop.
Do not invent Card/MFS. Do not build print states yet (Y).
```

---

## Batch X — Shared Sale Completed shell + cash settlement

**Goal:** One **Sale Completed** shell; cash variant shows paid/change/method; loyalty zero-pay reuses same shell.

### Tasks

- [x] Refactor Slice 2 Sale Completed into shared shell (success header, txn id, customer/loyalty, items, financials, actions)
- [x] Cash settlement content: Amount Paid, Change Returned, Payment Method Cash, loyalty earn via `loyaltyCalc`
- [x] Wire Cash complete → online ingest (`CASH` payment = amount due) + navigate to Sale Completed
- [x] Walk-in: no loyalty grid / points
- [x] New Sale [F2]; Print entry point stubs until Y
- [x] Ask if ingest blockers

### Re-share screens

**`Sale Completed - Cash Settlement`** and **`Sale Completed - Canonical Ready`**

### Agent prompt

```text
Implement ONLY Batch X from MILESTONE_3_EXECUTION.md
(Shared Sale Completed shell + cash settlement).
Re-share those screens if missing — stop.
One shell for loyalty zero-pay and cash. Reuse loyaltyCalc. No Card/MFS invent.
```

---

## Batch Y — Print stub states

**Goal:** Printing / printed / failed / retrying UI on Sale Completed; stub only + TODO real IPC.

### Tasks

- [x] State machine per lock above
- [x] Printing: spinner, SYSTEM BUSY, New Sale secondary/disabled
- [x] Printed: success copy, Reprint Receipt, New Sale
- [x] Failed: error banner, Retry Print [Enter], New Sale
- [x] Retrying: same busy pattern
- [x] Stub: timeout/random or deterministic success after N ms; optional fail once for QA
- [x] `TODO(real printer IPC)` in code + short note in desktop README or catalog at Z
- [x] Apply to both cash and loyalty-completed sales

### Re-share screens

**`Sale Completed - Printing`**, **`Sale Completed - Receipt Printed`**, **`Sale Completed - Print Failed`**, **`Sale Completed - Retry Printing`**

### Agent prompt

```text
Implement ONLY Batch Y from MILESTONE_3_EXECUTION.md (Print stub states).
Re-share those four screens if missing — stop.
Stub only — document real Tauri printer IPC TODO. No Card/MFS.
```

---

## Batch Z — Slice 3 exit + API catalog update

**Goal:** Prove tender + print stub path; **mandatory** update `Completed_API_lists.md`.

### Tasks

- [x] Checklist: Continue without redeeming → Payment → Cash → change → Sale Completed → print states; Card/MFS gated; walk-in cash; loyalty zero-pay still works on shared shell; single tender; earn 1/100
- [x] Confirm no Baki; chrome lock held
- [x] List TODOs: printer IPC, Card/MFS detail, loyalty persist, offline queue
- [x] **Update `Completed_API_lists.md`**
- [x] Optional `smoke:m3z`
- [x] Status/master plan only if user asks

### Slice 3 Definition of Done

- [x] Payment picker + Cash complete + ingest
- [x] Shared Sale Completed + print stub states
- [x] Card/MFS not invented (gated)
- [x] Loyalty calculator reused; earn rule unchanged
- [x] **`Completed_API_lists.md` updated**
- [x] No M4 sync worker; chrome static Napa lock

### Agent prompt

```text
Implement ONLY Batch Z from MILESTONE_3_EXECUTION.md
(Slice 3 exit + update Completed_API_lists.md).
Do not invent Card/MFS detail or real printer IPC. Report Slice 3 DoD.
```

---

## Progress tracker (Slice 3)

| Batch | Status | Date | Notes |
|-------|--------|------|-------|
| V Payment Select Method | **DONE** | 2026-08-11 | Card/MFS gated; Cash → W |
| W Cash Payment | **DONE** | 2026-08-11 | Empty + With Change; Exact Amount; draft for X |
| X Sale Completed shell + cash | **DONE** | 2026-08-11 | Shared shell; cash ingest; walk-in OK |
| Y Print stub states | **DONE** | 2026-08-11 | Stub + 58mm sample TODO; real IPC deferred |
| Z Slice 3 verify + API catalog | **DONE** | 2026-08-11 | `Completed_API_lists.md` §15; `smoke:m3z` |

---

## Slice 4 — Active screen inventory

Shared 2026-08-11 in sequence. **Chrome shell** still **Search Results - Napa** (layout/tokens). **Sale/receipt line items are always dynamic** from the live cart / completed sale — never hardcode “Napa”.

| # | Screen name (use this exact label when asking) | In Slice 4? |
|---|-----------------------------------------------|-------------|
| 1 | **Receipt Preview** | Yes (80mm / 58mm) |
| 2 | **Card Payment - Not Started** | Yes |
| 3 | **Card Payment - Processing** | Yes |
| 4 | **Sale Completed - Card Settlement** | Yes (shared Sale Completed shell) |
| 5 | **Card Payment - Declined** | Yes |
| 6 | **Card Payment - Cancelling** | Yes |
| 7 | **MFS Payment - Provider Select** | Yes (bKash / Nagad / Rocket) |
| 8 | **MFS Payment - Confirm / Collect** | Yes (**invented** — professional) |
| 9 | **MFS Payment - Result** (success → Sale Completed / fail) | Yes (**invented**) |

---

## Design locks (Slice 4)

| Topic | Lock |
|-------|------|
| Chrome shell | Search Results - Napa tokens/layout (static shell for now) |
| **Dynamic sale data** | Cart / completed sale drives all item rows, qty, batch, totals, customer, loyalty, payment lines on Sale Completed **and** Receipt Preview. Mock “Napa” is example only. |
| Receipt Preview | Modal with **80mm** (default) / **58mm** toggle; monospace thermal layout; Back + Print |
| Print action | **Stub:** Print confirms / advances print state; **same rendered receipt model** must be what future Tauri IPC sends. `TODO(real printer IPC)`. |
| Pharmacy header on receipt | **Hardcoded stub** until Settings (user lock **B**). e.g. placeholder pharmacy name/address/phone — not live tenant yet. Document swap-to-Settings later. |
| IDs | Keep **both**: UI txn `TXN-…` and receipt invoice `INV-…` (derive consistently from sale / event) |
| Card | **Terminal-assisted stub** — no SDK. States: Not Started → Processing → Success (Sale Completed) \| Declined \| Cancelling → back/declined |
| MFS providers | **bKash / Nagad / Rocket** only |
| MFS after Continue | **Invent** confirm (wallet/phone + optional Trx ID) → processing stub → success Sale Completed (method MFS + provider) or fail/retry. Match Cash/Card professionalism; ←/→ nav; no Tab; no Baki |
| Single tender | Still one method per sale |
| Loyalty | Reuse `loyaltyCalc`; walk-in hides points |
| Ungate Payment picker | Card + MFS leave Slice 3 gate; open real flows |
| Ingest | Card/MFS success → `POST /sales/ingest` with `CARD` or `MFS`; ask if payload needs provider meta |
| API catalog | Batch **AE** **must** update `Completed_API_lists.md` (always) |
| No Baki | Still none |

### Invented MFS flow (authorized — own it)

```text
Provider Select (shared screens)
  → Continue
  → MFS Confirm (invented): show provider, amount due, customer phone prefill if any,
     editable payer mobile, optional Trx ID / reference, Confirm [Enter]
  → Processing stub (short delay)
  → Success → shared Sale Completed (MFS + provider badge) + print path
     OR Fail → retry / back to providers (invent clean error, parallel to Card Declined)
```

Document invented screens in execution notes + API catalog as desktop-invented until design replaces them.

### Card stub state machine

```text
not_started --Start--> processing --ok--> sale_completed (CARD)
                         |--decline--> declined --Retry--> not_started
                         |--Cancel--> cancelling --> declined or methods
```

Deterministic stub OK (e.g. succeed after timeout; optional QA fail flag).

### Integration TODOs (Slice 4 — do not forget)

1. Real **printer IPC** using Receipt Preview payload  
2. Real **card terminal** SDK / bridge  
3. Real **MFS** provider APIs / webhooks — **backend confirms** txn status → desktop shows result; **no cashier manual Trx** (invented confirm is temporary)  
4. Settings → live pharmacy header on receipt  
5. Replace invented MFS confirm/result if user later shares Figma  

---

## Batch overview (Slice 4)

| Batch | Title | Depends on | Re-share / invent |
|-------|-------|------------|-------------------|
| **AA** | Receipt Preview (80/58) + dynamic lines | Z | **Receipt Preview** |
| **AB** | Card Payment stub (start / process / decline / cancel) | AA | Card screens 2,3,5,6 |
| **AC** | Sale Completed — Card (+ wire success) | AB | **Sale Completed - Card Settlement** |
| **AD** | MFS providers + invented confirm/result | AC | Providers shared; confirm/result **invent** |
| **AE** | Slice 4 exit + **update `Completed_API_lists.md`** | AD | No |

Order: **AA → AB → AC → AD → AE**.

---

## Batch AA — Receipt Preview

**Goal:** Receipt Preview modal from Print / Reprint; 80mm default / 58mm; **dynamic line items** from completed sale.

### Tasks

- [x] Modal matching **Receipt Preview** screen → **revised:** inline panel beside Sale Completed (not modal)
- [x] Width toggle 80mm / 58mm
- [x] Body: stub pharmacy header (hardcoded B); invoice `INV-…`; date; cashier; customer; ITEM/QTY/RATE/AMT from **sale lines**; totals; payment method block; footer legal line
- [x] Wire Print / Reprint on Sale Completed → preview visible + stub print in parallel
- [x] Print button = stub + `TODO(real printer IPC)` with same data model
- [x] Never hardcode product names

### Re-share screen

**`Receipt Preview`**

### Agent prompt

```text
Implement ONLY Batch AA from MILESTONE_3_EXECUTION.md (Receipt Preview).
Re-share ask: "Receipt Preview" if missing — stop.
Dynamic cart/sale lines only. Stub pharmacy header. Print = stub + IPC TODO.
No Card/MFS yet.
```

---

## Batch AB — Card Payment stub

**Goal:** Ungate Card from Payment picker; implement Not Started / Processing / Declined / Cancelling.

### Tasks

- [x] Open from Payment → Card
- [x] Amount due + customer/points (hide walk-in points)
- [x] Start → Processing; Cancel → Cancelling; Decline path; Retry; Back to methods
- [x] ←/→ nav; no Tab; sale stays active on decline
- [x] Success handoff to Batch AC (or stub navigate)

### Re-share screens

**`Card Payment - Not Started`**, **`Card Payment - Processing`**, **`Card Payment - Declined`**, **`Card Payment - Cancelling`**

### Agent prompt

```text
Implement ONLY Batch AB from MILESTONE_3_EXECUTION.md (Card Payment stub).
Re-share those four screens if missing — stop.
Stub terminal only — TODO real SDK. No MFS yet.
```

---

## Batch AC — Sale Completed Card settlement

**Goal:** Card success → ingest `CARD` → shared Sale Completed with CARD approved + print/preview path.

### Tasks

- [x] Settlement summary method CARD + Approved
- [x] Reuse shared Sale Completed shell + loyaltyCalc
- [x] Ingest online; ask if blockers
- [x] Print → Receipt Preview (AA)

### Re-share screen

**`Sale Completed - Card Settlement`**

### Agent prompt

```text
Implement ONLY Batch AC from MILESTONE_3_EXECUTION.md
(Sale Completed Card settlement + ingest).
Re-share ask: "Sale Completed - Card Settlement" if missing — stop.
Reuse shared shell + loyaltyCalc. Dynamic lines. No MFS yet.
```

---

## Batch AD — MFS providers + invented confirm/result

**Goal:** MFS provider select (shared) + **professional invented** confirm/processing/fail + success Sale Completed.

### Tasks

- [x] Ungate MFS on Payment picker
- [x] Provider list: bKash / Nagad / Rocket; Continue
- [x] **Invent** confirm UI (provider, amount, mobile, optional Trx ID)
- [x] **Invent** processing + fail (parallel Card declined quality)
- [x] Success → ingest `MFS` (+ provider in meta/note if schema allows) → Sale Completed MFS variant
- [x] Document invented screens in chat summary + catalog at AE
- [x] Walk-in OK; no Baki; ←/→ only

### Re-share screens

**`MFS Payment - Provider Select`** (and selected state). Confirm/result = invent.

### Agent prompt

```text
Implement ONLY Batch AD from MILESTONE_3_EXECUTION.md
(MFS providers + invented confirm/result).
Re-share provider screens if missing — stop.
Invent confirm/fail professionally; document as invented. Ingest MFS on success.
```

---

## Batch AE — Slice 4 exit + API catalog update

**Goal:** Prove Card + MFS + Receipt Preview; **always** update `Completed_API_lists.md`.

### Tasks

- [x] Checklist: Payment → Card happy/decline/cancel; Payment → MFS provider → invent confirm → complete; Receipt Preview 80/58 dynamic lines; Cash + loyalty paths unbroken; single tender
- [x] List TODOs: printer IPC, card SDK, MFS APIs, Settings pharmacy header, replace invented MFS UI
- [x] **Update `Completed_API_lists.md`**
- [x] Optional `smoke:m3ae`
- [x] Status/master plan only if user asks

### Slice 4 Definition of Done

- [x] Receipt Preview dynamic + stub print
- [x] Card stub full state machine + Sale Completed
- [x] MFS providers + invented confirm/result + Sale Completed
- [x] **`Completed_API_lists.md` updated**
- [x] No hardcoding of demo medicine names; no Baki; no M4 flush worker

### Agent prompt

```text
Implement ONLY Batch AE from MILESTONE_3_EXECUTION.md
(Slice 4 exit + update Completed_API_lists.md).
Report Slice 4 DoD. Do not start F4/Create Customer/M4 unless authorized.
```

---

## Progress tracker (Slice 4)

| Batch | Status | Date | Notes |
|-------|--------|------|-------|
| AA Receipt Preview | **DONE** | 2026-08-12 | Dynamic lines; stub header; IPC TODO; 80/58 |
| AB Card Payment stub | **DONE** | 2026-08-12 | Not Started/Processing/Declined/Cancelling; MFS gated; success → AC toast |
| AC Sale Completed Card | **DONE** | 2026-08-12 | CARD ingest + Approved settlement; shared shell; print/preview; MFS still gated |
| AD MFS + invented confirm | **DONE** | 2026-08-12 | bKash/Nagad/Rocket; invent confirm/fail; MFS ingest + Sale Completed |
| AE Slice 4 verify + API catalog | **DONE** | 2026-08-12 | `Completed_API_lists.md` §16; `smoke:m3ae` |

---

## Slice 5 — Active screen inventory (invented)

User-authorized invent (2026-08-12). **No Create Customer on desktop.**

| # | Screen name | In Slice 5? |
|---|-------------|-------------|
| 1 | **Generic Substitutes [F4]** | Yes (invent) |
| 2 | Create Customer | **No** — Owner web later; removed from POS |
| 3 | **Settings - Pharmacy / Receipt Header** | Yes (invent; extend Settings) |
| 4 | **Force Offline / Stay Offline** | Yes (invent) |
| 5 | **Transactions - List** | Yes (invent) |
| 6 | **Transactions - Detail** | Yes (invent) |
| 7 | **Shift - Open / Close** | Yes (invent) |

---

## Design locks (Slice 5)

| Topic | Lock |
|-------|------|
| Chrome | Search Results - Napa shell; invent content only |
| Create Customer | **Gone from POS.** Owner-only later in `apps/web`. Not Manager. |
| API | `POST /api/v1/customers` → **`restrictTo("OWNER")`** only (applied with Slice 5 kickoff) |
| F4 | Use M2 `GET /products/:id/substitutes`; keyboard F4 from POS when a product context exists (focused search row or selected cart line — invent sensible rule; document it) |
| Pharmacy header | Settings fields drive Receipt Preview (replace hardcoded Medicare stub) |
| Force Offline | Sticky until Go Online; ignore health while forced (see deferred notes) |
| Transactions | List recent sales for store (online API if exists; else lean local/cache invent + TODO). Detail + Reprint → existing Receipt Preview path |
| Shift | Local/session shift open-close; Counter Ready “Active Shift” reads this; no cloud shift API invent unless needed — document TODO |
| API catalog | Final Slice 5 batch **must** update `Completed_API_lists.md` |
| No Baki | Still none |

### Deferred (not Slice 5)

- Owner web Create Customer UI (`apps/web`)
- Owner/Manager terminal presence (M6)
- Real printer IPC / card SDK / MFS provider APIs
- M4 sync flush worker

---

## Batch overview (Slice 5)

| Batch | Title | Depends on |
|-------|-------|------------|
| **AF** | Remove Create Customer from POS + OWNER-only POST (kickoff) | AE |
| **AG** | Generic Substitutes [F4] | AF |
| **AH** | Settings - Pharmacy / Receipt Header | AG |
| **AI** | Force Offline / Stay Offline | AH |
| **AJ** | Transactions - List | AI |
| **AK** | Transactions - Detail + Reprint | AJ |
| **AL** | Shift Open/Close + Slice 5 exit + API catalog | AK |

Order: **AF → AG → AH → AI → AJ → AK → AL**.

---

## Batch AF — Remove Create Customer from POS + API OWNER lock

**Goal:** No Create control/toast on POS; `POST /customers` Owner-only.

### Tasks

- [x] Remove Create button + stub handler from Select Customer / App
- [x] Remove unused create i18n keys (en / bn-BD)
- [x] `restrictTo("OWNER")` on `POST /api/v1/customers`
- [x] Adjust smoke that expected Create stub
- [x] Note in `Completed_API_lists.md` (POST customers OWNER-only)

### Agent prompt

```text
Implement ONLY Batch AF from MILESTONE_3_EXECUTION.md
(Remove Create Customer from POS + OWNER-only POST /customers).
Do not start F4 / Transactions / Shift yet.
```

---

## Batch AG — Generic Substitutes [F4]

**Goal:** Invent F4 modal — list substitutes from API; Enter add/select into sale flow.

### Tasks

- [x] Invent modal matching teal POS vibe
- [x] Wire F4 from POS (document focus rule)
- [x] Call substitutes endpoint online; empty/offline states
- [x] Selecting substitute continues into existing batch/qty path
- [x] ←/→ · Esc; no Tab; no Baki

**Focus rule:** Prefer focused search result while results are visible (including expired/blocked rows); else selected cart line; else toast — no modal.

### Agent prompt

```text
Implement ONLY Batch AG from MILESTONE_3_EXECUTION.md (Generic Substitutes F4 — invent).
Do not build Settings pharmacy / Transactions yet.
```

---

## Batch AH — Settings - Pharmacy / Receipt Header

**Goal:** Invent Settings section for pharmacy name, branch, address, phone; Receipt Preview reads it (persist local).

### Tasks

- [x] Extend SettingsPanel beyond Language
- [x] Persist header fields (localStorage or SQLite — pick one, document)
- [x] Receipt Preview uses saved header (fallback stub if empty)
- [x] OWNER/MANAGER may edit; Cashier read-only or hide edit — invent: **Owner+Manager edit**, Cashier view-only

### Agent prompt

```text
Implement ONLY Batch AH from MILESTONE_3_EXECUTION.md
(Settings Pharmacy / Receipt Header — invent).
Wire Receipt Preview. No Force Offline / Transactions yet.
```

---

## Batch AI — Force Offline / Stay Offline

**Goal:** Invent override UI + sticky offline mode (deferred intent from Batch D notes).

### Tasks

- [x] Control on badge menu or Settings Connectivity
- [x] Force Offline ignores health probes; Go Online clears override
- [x] Badge shows Offline while forced
- [x] Document behavior in connectivity module

### Agent prompt

```text
Implement ONLY Batch AI from MILESTONE_3_EXECUTION.md (Force Offline — invent).
Do not build Transactions/Shift yet.
```

---

## Batch AJ — Transactions - List

**Goal:** Invent Transactions nav screen — list recent sales; open detail.

### Tasks

- [x] Replace Transactions stub with list UI
- [x] Online: fetch sales if API exists; else invent from local completed-sale log / TODO cloud list endpoint
- [x] Keyboard navigate; Enter → Detail
- [x] Ask only if inventing a new cloud list API is required — prefer existing endpoints

**Decision:** No cloud `GET /sales` list exists — **did not invent a new route**. Local `transactionLogStore` (localStorage, tenant+store) appends on each completed sale; TODO cloud list when authorized.

### Agent prompt

```text
Implement ONLY Batch AJ from MILESTONE_3_EXECUTION.md (Transactions List — invent).
Ask before adding new cloud routes. No Shift yet.
```

---

## Batch AK — Transactions - Detail + Reprint

**Goal:** Invent detail view; Reprint opens Receipt Preview / print stub.

### Tasks

- [x] Detail: items, totals, method, customer, loyalty summary
- [x] Reprint → existing receipt model + preview/print stub
- [x] Back to list; Esc

### Agent prompt

```text
Implement ONLY Batch AK from MILESTONE_3_EXECUTION.md (Transactions Detail — invent).
Reuse Receipt Preview. No Shift yet.
```

---

## Batch AL — Shift Open/Close + Slice 5 exit + API catalog

**Goal:** Invent Shift screen; wire Counter Ready Active Shift; exit Slice 5; update catalog.

### Tasks

- [x] Shift Open / Close UI (invent); persist local shift window
- [x] Counter Ready card reads active shift
- [x] Checklist: F4, Settings header→receipt, Force Offline, Transactions list/detail, Shift; Create Customer absent from POS; POST customers OWNER-only
- [x] **Update `Completed_API_lists.md`**
- [x] Optional `smoke:m3al`
- [ ] Status/master plan only if user asks

### Slice 5 Definition of Done

- [x] F4 substitutes invented + wired
- [x] Pharmacy header in Settings → Receipt Preview
- [x] Force Offline sticky mode
- [x] Transactions list + detail + reprint
- [x] Shift open/close + Counter Ready
- [x] No Create Customer on POS; API create = OWNER only
- [x] **`Completed_API_lists.md` updated**
- [x] No M4 flush worker

### Agent prompt

```text
Implement ONLY Batch AL from MILESTONE_3_EXECUTION.md
(Shift invent + Slice 5 exit + Completed_API_lists.md).
Report Slice 5 DoD. Do not start M4 / owner web Create Customer.
```

---

## Progress tracker (Slice 5)

| Batch | Status | Date | Notes |
|-------|--------|------|-------|
| AF Remove Create + OWNER POST | **DONE** | 2026-08-12 | UI removed; `restrictTo("OWNER")`; smokes/i18n cleaned |
| AG Generic Substitutes F4 | **DONE** | 2026-08-12 | Invent modal; F4 focus rule; online GET substitutes → Select Batch |
| AH Settings Pharmacy header | **DONE** | 2026-08-12 | Settings invent; localStorage; Receipt Preview wired; Owner/Manager edit |
| AI Force Offline | **DONE** | 2026-08-12 | Badge menu + Settings Connectivity; sticky localStorage; probes ignored while forced |
| AJ Transactions List | **DONE** | 2026-08-12 | Local log invent; no new cloud route; Enter → lean detail shell (AK fills items/reprint) |
| AK Transactions Detail | **DONE** | 2026-08-12 | Full detail + Receipt Preview; Reprint → print stub; Esc/Back → list; no Shift |
| AL Shift + Slice 5 exit | **DONE** | 2026-08-12 | Shift invent + Counter Ready; `Completed_API_lists.md` §17; `smoke:m3al`; Slice 5 DoD green |

---

## Next slice / after Slice 5

- **Slice 6 — Hold / Park Sale** AM–AP **DONE** (`Completed_API_lists.md` §18; `smoke:m3ap`)
- **M3 FULL EXIT** recorded 2026-08-13 — see section below Slice 6
- Owner web Create Customer (`apps/web`) when authorized
- M4 sync worker when authorized
- Real printer IPC / card SDK / MFS APIs when authorized

---

## Slice 6 — Hold / Park Sale (invented)

User-authorized invent (2026-08-13). Busy-counter park: hold one sale, ring another, resume later.

**Problem:** Single active sale in `App.tsx` (`cartLines` + customer + loyalty + payment modals). `startNewSale` wipes state — cannot park Customer A at payment and serve Customer B.

| # | Screen / capability | In Slice 6? |
|---|---------------------|-------------|
| 1 | **Hold Sale** (park active cart) | Yes (invent) |
| 2 | **Held Sales list** (resume / discard) | Yes (invent) |
| 3 | Soft stock recheck on resume | Yes (logic + UX) |
| 4 | Hard stock reservation | **No** |
| 5 | Cloud hold / multi-terminal shared holds | **No** |
| 6 | M4 sync flush | **No** |

---

## Design locks (Slice 6)

| Topic | Lock |
|-------|------|
| Chrome | Search Results - Napa; invent Hold / Held content only |
| Capacity | **Up to 3 held + 1 active** on this terminal |
| Stock | **Soft hold** — no reservation; re-validate stock/expiry on resume |
| Persistence | localStorage `pharmasync.heldSales.<tenantId>.<storeId>` (same family as shift / transaction log); machine-local only |
| Hold when | `view === "sale"` and cart ≥1 line — **including** while Payment / Cash / Card / MFS / loyalty modals open |
| On Hold | Snapshot lines + customer + loyalty + FEFO override meta; **close all POS modals**; abort in-progress card/MFS stubs; **do not** save cash-received / card-approved / MFS processing drafts |
| After Hold | Empty New Sale (shift stays open; soft gate unchanged) |
| Resume | Only if active cart empty; else toast (hold or clear current first). Soft recheck → warn/block bad lines; cashier edits before pay |
| Discard | ConfirmDialog; 4th Hold attempt → toast, no overwrite |
| Shortcut | **F6** Hold (park). **F7** Held list (toggle). F2/F4/F8/F10 unchanged. |
| Keyboard | ←/→ · ↑/↓ · Enter · Esc; **no Tab**; no Baki |
| i18n | en + bn-BD; no hard-coded UI strings; do not translate domain names |
| API | **No new cloud routes** |
| API catalog | Final Slice 6 batch **AP must** update `Completed_API_lists.md` |
| Shift | Soft gate unchanged; Hold does not open/close shift |

### Deferred (not Slice 6)

- Hard stock reservation / cloud hold API / multi-terminal shared holds
- Owner web Create Customer; Owner/Manager terminal presence (M6)
- Real printer IPC / card SDK / MFS provider APIs
- M4 sync flush worker
- Chrome “Cashier:” role label / Today’s Sales stub (polish elsewhere)

---

## Batch overview (Slice 6)

| Batch | Title | Depends on |
|-------|-------|------------|
| **AM** | Held-sale store + snapshot type | AL |
| **AN** | Hold action + Held Sales list UI | AM |
| **AO** | Soft resume recheck + payment-safety on Hold | AN |
| **AP** | Slice 6 exit + API catalog | AO |

Order: **AM → AN → AO → AP**.

---

## Batch AM — Held-sale store + snapshot type

**Goal:** Local held-sale persistence + typed snapshot (no UI yet beyond what tests need).

### Tasks

- [x] Add `HeldSaleSnapshot` (id, heldAt, label, lines/`CartLine[]`, customer, loyalty, fefo override data as on lines)
- [x] Add `heldSaleStore` — localStorage key `pharmasync.heldSales.<tenantId>.<storeId>`; max **3**; list / add / get / remove / clear helpers
- [x] Document soft-hold + no cloud TODO in module header
- [x] Unit-friendly pure helpers OK; **no** Hold UI / F6 / App wiring yet
- [x] en / bn-BD keys only if needed for store errors (prefer UI keys in AN)

### Agent prompt

```text
Implement ONLY Batch AM from MILESTONE_3_EXECUTION.md
(heldSaleStore + HeldSaleSnapshot — max 3 soft holds, localStorage).
Do not build Hold UI / F6 / resume recheck yet.
```

---

## Batch AN — Hold action + Held Sales list UI

**Goal:** Invent Hold + Held list; park active sale and start empty New Sale.

### Tasks

- [x] Hold control: **F6** + invent cart/footer affordance; toast if cart empty or already at 3 held
- [x] On Hold: write snapshot via store; clear active sale state; close modals (payment abort may be thin until AO); land empty New Sale
- [x] Invent **Held Sales** list UI (teal Napa): ↑/↓ · Enter Resume · Discard → ConfirmDialog · Esc
- [x] Resume gate: active cart non-empty → toast; do not swap automatically
- [x] After resume: restore cart/customer/loyalty into active sale (stock recheck can be stub toast until AO)
- [x] i18n en + bn-BD; no Tab; no Baki
- [x] Held count badge invent OK (cart or footer)

### Agent prompt

```text
Implement ONLY Batch AN from MILESTONE_3_EXECUTION.md
(Hold F6 + Held Sales list invent — park/resume/discard).
Soft stock recheck detail is Batch AO. No M4.
```

---

## Batch AO — Soft resume recheck + payment-safety on Hold

**Goal:** Resume validates sellable stock/expiry; Hold aborts tenders cleanly.

### Tasks

- [x] On resume: soft recheck each line (batch exists, not expired, qty available vs `quantityBase`); toast warnings; block or strip unsellable lines per invent (document rule in code comment)
- [x] Holding while Cash/Card/MFS/loyalty/payment picker open: close modals; abort card/MFS stub controllers; do not ingest; do not keep tender drafts
- [x] Holding mid-card “processing” / MFS “processing”: cancel stub paths safely (no Sale Completed)
- [x] Shift soft gate + connectivity badge untouched
- [x] ←/→ · Esc; no Tab

### Agent prompt

```text
Implement ONLY Batch AO from MILESTONE_3_EXECUTION.md
(soft resume stock recheck + payment-safety on Hold).
Do not start Slice 6 exit / catalog yet.
```

---

## Batch AP — Slice 6 exit + API catalog

**Goal:** Verify Slice 6 DoD; update catalog; optional smoke.

### Tasks

- [x] Checklist: Hold ≤3; empty New Sale after hold; resume with soft recheck; discard confirm; reload persists held; mid-payment hold does not complete sale; F6; no Tab; no Baki
- [x] **Update `Completed_API_lists.md`** — no new cloud routes; desktop Hold invent note (new §18 or extend §17)
- [x] Optional `smoke:m3ap` (store max-3 + App Hold wiring guards)
- [x] Status/master plan only if user asks

### Slice 6 Definition of Done

- [x] Up to 3 soft holds + 1 active; park then ring another sale
- [x] Resume restores snapshot with soft stock/expiry recheck
- [x] Mid-payment Hold does not tender/ingest/double-charge stub
- [x] Held list survives reload on that terminal (localStorage)
- [x] F6 Hold; **F7** Held list (toggle); resume/discard; no Tab; localized en + bn-BD
- [x] **No** hard reserve; **no** cloud hold API; **no** M4 flush
- [x] **`Completed_API_lists.md` updated**

### Agent prompt

```text
Implement ONLY Batch AP from MILESTONE_3_EXECUTION.md
(Slice 6 exit + Completed_API_lists.md).
Report Slice 6 DoD. Do not start M4 / hard reservation / cloud hold.
```

---

## Progress tracker (Slice 6)

| Batch | Status | Date | Notes |
|-------|--------|------|-------|
| AM Held-sale store | **DONE** | 2026-08-13 | max 3; localStorage; soft hold; no UI |
| AN Hold + Held list UI | **DONE** | 2026-08-13 | F6; cart Hold + Held n/3; list resume/discard |
| AO Soft recheck + payment safety | **DONE** | 2026-08-13 | resume strip/clamp; Hold aborts card/MFS stubs; no Sale Completed |
| AP Slice 6 exit | **DONE** | 2026-08-13 | `Completed_API_lists.md` §18; `smoke:m3ap`; F7 Held list; status + master plan synced |

---

## Next slice / after Slice 6

M3 POS shell **closed** (2026-08-13). Later discoveries → **Slice 7+** when shared/authorized.

---

## M3 Full Exit (2026-08-13)

User: **“all screens done”** — if anything is found later, append a new slice; do not invent ahead.

### Desktop surface delivered (Slice 1–6)

Login · connectivity · SQLite catalog cache + outbound queue table · Counter Ready · New Sale search · Select Batch · Qty & Packaging · Active Cart · Edit / FEFO override stub · Remove · Select Customer F8 (no Baki; no Create on POS) · Loyalty OTP stub · Payment Cash / Card stub / MFS invent · Sale Completed + Receipt Preview + print stub · F4 substitutes · Settings pharmacy header · Force Offline · Transactions list/detail/reprint · Shift open/close + F2 soft gate · Hold **F6** / Held list **F7** (max 3 soft holds)

### Master-plan exit vs M4

| Criterion | Status |
|-----------|--------|
| Keyboard checkout **online** (Cash / Card / MFS ingest) | **Met** |
| Local catalog cache + `outbound_sync_queue` table | **Met** (Batch E) |
| Queue **flush** / `POST /sync/ingest` | **M4** — not M3 |
| Real printer IPC / card SDK / MFS APIs | Deferred (stubs in M3) |

### Still not M3 (do not start unless authorized)

- M4 sync worker
- Owner web Create Customer
- Hard stock reservation / cloud hold
- Cloud sales list / cloud shift API
- Real hardware integrations

---

## Change log

| Date | Change |
|------|--------|
| 2026-08-09 | Created Slice 1 from master plan + status + 6 shared POS screens; invent auth for Login + online/offline; incremental slice protocol; Batches A–L; payment/F4/F8 full pages deferred |
| 2026-08-09 | **Chrome consistency lock:** user override — canonical shell = `Search Results - Napa` (light sidebar/header/footer); other screens = content only; Batch B/F/G/H/K prompts updated |
| 2026-08-09 | **Batch A DONE:** `@r2a/desktop` Tauri 2 + Vite + React + TS + Tailwind hello shell; `@r2a/ui` bootstrap; `VITE_API_BASE_URL`; cargo/vite build verified on Windows |
| 2026-08-09 | **Batch B DONE:** design tokens + AppShell (Header/Sidebar/Footer/CartPanel frame); chrome = Search Results - Napa; cashier placeholder until Batch C; no login/POS/SQLite |
| 2026-08-09 | **Batch C DONE:** invented login + AuthProvider session; M2 login/refresh/me/logout; tokens in webview localStorage (documented MVP); Counter Ready placeholder; no POS/SQLite/Batch D |
| 2026-08-09 | **Batch D DONE:** ConnectivityProvider + health probe (`GET /api/v1/health`); badge states; sync icon re-probes; pending count stub 0; no SQLite (Batch E) |
| 2026-08-09 | Deferred: Force Offline override + Owner/Manager presence noted; Batch D probe Strict Mode fix + `Checking…` mount state |
| 2026-08-09 | **Batch E DONE:** pos_local.db + lean catalog/queue + cache pull; pending count wired to badge; no M4 flush |
| 2026-08-09 | **Batch F DONE:** Counter Ready content (storefront + CTA + 3 cards); F2/sidebar → Empty POS placeholder; ৳ stub sales; Local Sync tied to badge; chrome = Search Results - Napa |
| 2026-08-09 | **Batch G DONE:** Empty POS content (search + empty medicine prompt + Cancel Sale); EmptyCartBody; Ctrl+K/`/` focus; Esc → Counter Ready; Proceed disabled / F10 toast; no search results yet |
| 2026-08-09 | **Batch H DONE:** Search Results - Napa content; online M2 + offline cache; FEFO/EXPIRED presentation; ↑↓ Enter; Select Batch stub; fixed catalogPull list envelope (`data` array) |
| 2026-08-09 | **Batch I DONE:** Select Batch modal (FEFO highlight, expired blocked, ↑↓ Enter); confirm → Qty stub; chrome = Search Results - Napa |
| 2026-08-09 | **Batch J DONE:** Quantity & Packaging modal; Piece/Strip/Box stock-aware; Esc→batch; Enter Add→cart line; chrome = Search Results - Napa |
| 2026-08-11 | **Batch K DONE:** Current Sale line cards + Edit/Remove; subtotal/TOTAL; Proceed/F10 toast only; Ready for next item; no payment/ingest |
| 2026-08-11 | **Batch K polish:** user preferred Active Cart table (~40/60); Clear sale + Esc Cancel → ConfirmDialog; ↑↓/+/−/Del; drop per-row ✕; dialog ←/→ Enter |
| 2026-08-11 | **Active Cart Figma override documented:** chrome rule #6 + Batch K lock — later Figma must not shrink cart / revert to cards |
| 2026-08-11 | **Batch L DONE:** Slice 1 exit verification; `npm run smoke:m3l -w @r2a/desktop`; DoD green; no payment/M4; status docs left unchanged (ask to update) |
| 2026-08-11 | Demo seed: Napa 4 lots (`NP23091`/`NP24031`/`NP24052`/`NP23010`); search FEFO = sellable only; expired in Select Batch detail; docs + API catalog updated |
| 2026-08-11 | **Slice 2 planned (M–U):** Edit → FEFO override stub → Remove → Customer (no Baki) → Loyalty OTP stub → zero-pay complete; loyalty calc mandatory; Continue without redeeming = right primary; Cash/Card/MFS = Slice 3; Batch U must update `Completed_API_lists.md` |
| 2026-08-11 | **Batch M DONE:** Edit Sale Item modal (qty/unit/batch bar); Active Cart Edit wired; Change Batch stub; chrome = Search Results - Napa; next = Batch N |
| 2026-08-11 | **Batch N DONE:** Change Batch edit flow + Manual FEFO Override warn; Request Authorization stub → O; chrome = Search Results - Napa |
| 2026-08-11 | **Batch O DONE:** Manager Authorization stub (4-digit any PIN + Authorized By); stages `StagedFefoOverride` for P; real auth TODO; no Batch P banner/toast; chrome = Search Results - Napa |
| 2026-08-11 | **Batch P DONE:** Edit Override Authorized banner/badge/audit; Save → cart Override badge + toast; `fefoOverride` on cart line; Active Cart ~40/60 held; chrome = Search Results - Napa |
| 2026-08-11 | **Batch Q DONE:** Remove Item Confirm (reusable ConfirmDialog); Del → Keep Item default; Clear/Cancel Sale migrated to same design; chrome = Search Results - Napa; next = Batch R |
| 2026-08-11 | **Batch R DONE:** Select Customer F8; M2 `GET /customers`; no Baki UI; Create = toast later-slice; Walk-in; `saleCustomer` + points on cart; seed Karim 120 pts; chrome = Search Results - Napa; next = Batch S |
| 2026-08-11 | **Batch S DONE:** Redeem Loyalty + OTP stub; Continue without = right primary/default; any 6-digit OTP; cart Loyalty line; Slice 3 / Batch T gates; real OTP TODO; chrome = Search Results - Napa; next = Batch T |
| 2026-08-11 | **Keyboard lock:** **Tab is never a POS navigator** (ignore Figma Tab). Modal CTAs use **←/→** (or ↑/↓); ConfirmDialog + Redeem/OTP updated |
| 2026-08-11 | **Batch T DONE:** Complete Sale zero-pay (no Baki) + Sale Completed; `loyaltyCalc` redeem+earn; ingest maps loyalty→discount + CASH ৳0; teal pill toasts; Print stub; online required; chrome = Search Results - Napa; next = Batch U |
| 2026-08-11 | **Batch U DONE:** Slice 2 exit verify; `smoke:m3u`; `Completed_API_lists.md` §14 (stubs + planned APIs + zero-pay notes); DoD green; status/master plan left for user ask; next = Slice 3 Cash/Card/MFS when screens shared |
| 2026-08-11 | **Slice 3 planned (V–Z):** Payment picker + Cash only; Card/MFS gated; shared Sale Completed shell; print stub + real IPC TODO; single tender; earn 1/100; walk-in OK; chrome static Napa; Batch Z must update `Completed_API_lists.md` |
| 2026-08-11 | **Batch V DONE:** Payment - Select Method; Continue without / F10 due>0 → picker; Cash → Batch W gate; Card/MFS toast; walk-in hides points; ←→ no Tab; chrome = Search Results - Napa; next = Batch W |
| 2026-08-11 | **Batch W DONE:** Cash Payment Empty + With Change; Exact Amount; Complete when received ≥ due; Back to Methods; settlement draft for X (no ingest); Card/MFS still gated; chrome = Search Results - Napa; next = Batch X |
| 2026-08-11 | **Batch X DONE:** Shared Sale Completed shell (Canonical Ready) + cash settlement variant; Cash → ingest CASH=due → Sale Completed; walk-in hides loyalty; Print stub until Y; Card/MFS still gated; chrome = Search Results - Napa; next = Batch Y |
| 2026-08-11 | **Batch Y DONE:** Print stub states (printing / printed / failed / retrying); auto-start; footer SYSTEM BUSY; 58mm sample noted; TODO(real printer IPC); Card/MFS still gated; chrome = Search Results - Napa; next = Batch Z |
| 2026-08-11 | **Batch Z DONE:** Slice 3 exit; Completed_API_lists.md §15; smoke:m3z; Card/MFS gated; print stub + 58mm IPC TODO; no M4; chrome = Search Results - Napa; next = Slice 4 when screens shared |
| 2026-08-11 | **Slice 4 planned (AA–AE):** Receipt Preview (dynamic lines, stub pharmacy header, Print→future IPC); Card stub states; MFS bKash/Nagad/Rocket + invented confirm/result; INV+TXN; Batch AE always updates `Completed_API_lists.md` |
| 2026-08-12 | **Batch AA DONE:** Receipt Preview modal (80mm default / 58mm); dynamic sale lines; stub Medicare Pharmacy header; Print/Reprint → preview → stub print with `ReceiptPrintModel`; `TODO(real printer IPC)`; Card/MFS not started |
| 2026-08-12 | **Batch AA UX fix:** Receipt Preview is **inline** on the right of Sale Completed (not a modal); print stub runs in parallel with visible preview — same model for future printer IPC |
| 2026-08-12 | **Batch AB DONE:** Card Payment stub (Not Started / Processing / Declined / Cancelling); Payment → Card ungated; cancel→declined; Retry; sale stays active on decline; approved → AC toast handoff; `TODO(real card terminal SDK)`; MFS still gated; chrome = Search Results - Napa; next = Batch AC |
| 2026-08-12 | **Batch AC DONE:** Card approved → ingest `CARD` (+ `card:status=Approved` notes) → shared Sale Completed Card Settlement (method Card + Approved badge); loyaltyCalc + walk-in; Receipt Preview print path; completing phase on modal; MFS still gated; chrome = Search Results - Napa; next = Batch AD |
| 2026-08-12 | **Batch AD DONE:** MFS ungated; Provider Select bKash/Nagad/Rocket; **invented** Confirm (payer mobile + optional Trx ID) / Processing / Fail; success → ingest `MFS` (+ provider/payer/trx notes) → Sale Completed MFS settlement + receipt; walk-in OK; no Baki; `TODO(real MFS APIs)`; chrome = Search Results - Napa; next = Batch AE |
| 2026-08-12 | **Batch AE DONE:** Slice 4 exit; `Completed_API_lists.md` §16; `smoke:m3ae`; Card+MFS+Receipt Preview verified; Cash/loyalty unbroken; TODOs listed (printer IPC, card SDK, MFS APIs, Settings header, replace invented MFS); no F4/Create Customer/M4; status/master plan left for user ask |
| 2026-08-12 | **Status sync:** `Current_Status.md` + `PROJECT_MASTER_PLAN.md` updated through Slice 4; MFS real path locked = backend-confirmed status (no cashier Trx) |
| 2026-08-12 | **Slice 5 planned (AF–AL):** invent F4, Settings pharmacy header, Force Offline, Transactions list/detail, Shift; Create Customer deferred to Owner web; POS Create removed; `POST /customers` OWNER-only |
| 2026-08-12 | **Batch AF DONE:** Create Customer removed from Select Customer / App / i18n; `restrictTo("OWNER")` on POST customers; smoke-m3u guards updated |
| 2026-08-12 | **Batch AG DONE:** Generic Substitutes F4 invent; focus rule (search row → cart line); GET `/products/:id/substitutes`; Enter → Select Batch; offline/empty states; footer [F4]; no Settings/Transactions/Shift/M4 |
| 2026-08-12 | **Batch AH DONE:** Settings Pharmacy / Receipt Header invent; localStorage `pharmacyHeaderStore` (tenant+store); Owner/Manager edit, Cashier view-only; Receipt Preview + print model resolve with stub fallback; no Force Offline / Transactions / Shift |
| 2026-08-12 | **Batch AI DONE:** Force Offline / Stay Offline; badge menu + Settings Connectivity; `forceOfflineStore` localStorage sticky; probes / browser online / header re-probe ignored while forced; Go Online clears + re-probes; badge Offline · Forced; no Transactions / Shift |
| 2026-08-12 | **Batch AJ DONE:** Transactions List invent; sidebar stub → panel; `transactionLogStore` localStorage (tenant+store) on complete; no new cloud GET /sales (TODO); ↑/↓ · Enter lean detail · Esc; items/reprint deferred to AK; no Shift |
| 2026-08-12 | **Batch AK DONE:** Transactions Detail invent; items/totals/method/customer/loyalty; Receipt Preview reuse; Reprint → print stub; Esc/Back → list; ←/→ CTAs; no Shift / no new cloud routes |
| 2026-08-12 | **Batch AL DONE:** Shift Open/Close invent; `shiftStore` localStorage; Counter Ready Active Shift wired; Slice 5 exit; `Completed_API_lists.md` §17; `smoke:m3al`; no M4 / no owner web Create Customer |
| 2026-08-13 | **Shift soft gate:** New Sale [F2] requires open shift (toast + Shift panel); connectivity badge stays independent; status + master plan synced |
| 2026-08-13 | **Slice 6 planned (AM–AP):** Hold / Park Sale invent; max 3 soft holds + 1 active; localStorage; F6; soft resume recheck; no hard reserve / no cloud hold / no M4; docs only until Batch AM authorized |
| 2026-08-13 | **Batch AM DONE:** `heldSaleStore` + `HeldSaleSnapshot`; max 3 soft holds; localStorage `pharmasync.heldSales.<tenantId>.<storeId>`; no Hold UI / F6 / App wiring; next = Batch AN |
| 2026-08-13 | **Batch AN DONE:** Hold F6 + cart Hold / Held n/3; Held Sales list ↑/↓ · ←/→ Resume/Discard · Enter · Esc ConfirmDialog; empty New Sale after park; resume gate; stub recheck toast; next = Batch AO |
| 2026-08-13 | **Batch AO DONE:** soft resume recheck (strip unsellable / clamp short stock; keep hold if none sellable); Hold aborts card/MFS stubs + epoch-guards ingest (no Sale Completed); next = Batch AP |
| 2026-08-13 | **Batch AP DONE:** Slice 6 exit; `Completed_API_lists.md` §18; `smoke:m3ap`; no hard reserve / no cloud hold / no M4; **F7** Held list toggle; status + master plan synced |
| 2026-08-13 | **M3 FULL EXIT:** user all-screens-done; POS shell closed; later finds → Slice 7+; queue flush remains M4 |
