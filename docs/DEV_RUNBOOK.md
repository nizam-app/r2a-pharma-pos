# PharmaSync POS — Dev runbook

**Audience:** Next engineer spinning up the M0–M5 stack locally.  
**Status:** Milestone 5 **DONE** (pilot-ready POS). Owner web (`apps/web`) is still a stub — **M6**, not this runbook.  
**Do not commit secrets.** Copy from `*.example` files only. Never paste live Neon / JWT values into this document.

---

## 1. What you are running

| Piece | Package | Role |
|-------|---------|------|
| Cloud API | `@r2a/server` | Express + Prisma → PostgreSQL (Neon or local) |
| Desktop POS | `@r2a/desktop` | Vite + React (browser) or Tauri + SQLite |
| Schema / seed | `@r2a/database` | Prisma CLI only |
| Contracts | `@r2a/shared-types` | Zod DTOs |

Payments are **`CASH` \| `CARD` \| `MFS` only**. There is no on-account tender. Print and FEFO PIN are **stubs**.

---

## 2. Env files (two places — easy to mix up)

| File | Who reads it | How to create |
|------|----------------|---------------|
| **Repo-root** `.env` | **`@r2a/server` only** (not `apps/server/.env`) | Copy [`.env.example`](../.env.example) → `.env` |
| **`packages/database/.env`** | **Prisma CLI** (`db:generate` / `db:deploy` / `db:seed` / `db:migrate`) | Copy the **same** `DATABASE_URL` (and nothing secret in git) |
| `apps/desktop/.env` | Vite (`import.meta.env.VITE_API_BASE_URL`) | Copy [`apps/desktop/.env.example`](../apps/desktop/.env.example) |

Required in root `.env` (see `.env.example` for names and placeholders):

- `DATABASE_URL` — PostgreSQL (Neon pooler **or** local Docker / install)
- `JWT_SECRET` — access-token signing (use a local placeholder, not production)
- `JWT_EXPIRES_IN` (default `15m`), `REFRESH_TOKEN_EXPIRES_IN` (default `7d`)
- `PORT` (dev default `8787`), `NODE_ENV`, `CORS_ORIGIN`

Desktop `.env`:

```text
VITE_API_BASE_URL=http://127.0.0.1:8787
```

Prefer `127.0.0.1` over `localhost` on Windows (avoids slow IPv6 `::1`).

**Prisma vs server:** if migrate/seed work but the API cannot see rows (or vice versa), the two `.env` files disagree. Keep `DATABASE_URL` identical.

---

## 3. PostgreSQL — Neon **or** local Docker

Pick **one**. Point `DATABASE_URL` at it in **both** env files above.

### Option A — Neon (what M1/M2 used)

Create a project in the Neon console. Put the **pooler** connection string in `DATABASE_URL` (ssl required). Do not commit it.

### Option B — local Postgres Docker

Example (placeholders only — match `.env.example`):

```bash
docker run --name r2a-postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=r2a_pharmacy_pos -p 5432:5432 -d postgres:16
```

Then:

```text
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/r2a_pharmacy_pos?schema=public
```

A local Windows PostgreSQL service is also fine if you create the database yourself (`createdb` / pgAdmin). There is **no** `docker-compose.yml` in the repo.

---

## 4. First-time install

From the **repo root** (Node ≥ 20):

```bash
npm install
npm run db:generate
npm run db:deploy
npm run db:seed
```

| Script | What it does |
|--------|----------------|
| `db:generate` | `prisma generate` |
| `db:deploy` | `prisma migrate deploy` (CI / existing DB) |
| `db:migrate` | `prisma migrate dev` (when you author a new migration — not needed for M5) |
| `db:seed` | Idempotent upserts (`demo-pharmacy`, catalog, staff) |

Expected seed: tenant `demo-pharmacy`, store `MAIN`, **5** products (Napa sku `NAPA-500`), staff emails below.

Optional package builds if something fails to resolve:

```bash
npm run build -w @r2a/database
npm run build -w @r2a/shared-types
npm run build -w @r2a/server
```

Desktop UI build (not required for Vite `dev`):

```bash
npm run build -w @r2a/desktop
```

---

## 5. Daily terminals

**Terminal 1 — cloud API**

```bash
npm run dev -w @r2a/server
```

Wait until it is listening (default `http://127.0.0.1:8787`). Health: `GET /health` or `GET /api/v1/health`.

**Terminal 2 — desktop UI** (browser is enough for M5)

```bash
npm run dev -w @r2a/desktop
```

Open **http://localhost:1420/**  
Browser uses the **memory / localStorage** SQLite fallback. That is the supported walkthrough path.

**Optional Terminal 3 — native Tauri** (real `pos_local.db`; Rust toolchain on PATH)

```bash
npm run dev:tauri -w @r2a/desktop
```

Not required for M5 batch PASS.

---

## 6. Seed logins

Same password for all three (override via `SEED_*` in `.env` — see `.env.example`):

| Role | Email | Password |
|------|-------|----------|
| Owner | `owner@demo.local` | `ChangeMe123!` |
| Manager | `manager@demo.local` | `ChangeMe123!` |
| Cashier | `cashier@demo.local` | `ChangeMe123!` |

Checkout walkthrough: cashier. Receive stock: owner (also verify manager). Demo drug: type **Napa**.

---

## 7. Smoke tests

Server must be running for cloud smokes (`BASE_URL` defaults to `http://localhost:8787`).

```bash
# Cloud (Terminal 1 up)
npm run smoke:m2 -w @r2a/server
npm run smoke:m4b -w @r2a/server

# Desktop (Node source / compose; no live cloud required except as noted)
npm run smoke:m4 -w @r2a/desktop
npm run smoke:m5 -w @r2a/desktop
```

| Script | Checks |
|--------|--------|
| `smoke:m2` | Health, seed login, FEFO, ingest, cashier margin + PATCH 403s (16/16) |
| `smoke:m4b` | `POST /api/v1/sync/ingest` accepted / duplicate / rejected |
| `smoke:m4` | Queue + worker + Sync Queue + catalog §19 |
| `smoke:m5` | Composes `m5a`–`m5e` + `smoke:m4` + catalog §20 / M5 DONE / runbook / stubs |

---

## 8. POS path (M3–M5)

1. Login → **Shift** → **Open Shift** (F2 is soft-gated on open shift).
2. **F2** / New Sale → type `Napa` → **Enter** → Select Batch → Quantity → Add to Sale.
3. **F10** / Proceed → Payment (Cash / Card stub / MFS invent). Loyalty zero-pay if points cover.
4. Sale Completed + Receipt Preview. Print is a **stub** (no Tauri printer IPC).
5. Offline / Force Offline complete → same Sale Completed; Sync Queue flushes via `/sync/ingest`.
6. Owner/Manager: **Settings → Receive stock** (online) → Add lot / Adjust qty → `catalogPull`. Cashier does **not** see this section.
7. Failed Sync Queue rows: i18n conflict copy + raw `last_error`; Enter = Retry. **No** void.

Keyboard: arrows / Enter / Esc. **Tab is never a POS navigator.** Shortcuts: F2 New Sale · F4 substitutes · F6 Hold · F7 Held list · F8 Customer · F10 Proceed.

---

## 9. Not in this runbook (do not invent)

- Owner web dashboard (`apps/web`) — **M6**
- Real printer IPC, real card SDK, real MFS APIs, FEFO `pinHash`
- Cloud `GET /sales`, cloud shift, bi-di catalog sync, n8n, RLS
- CSV catalog import, sale void, on-account tender, Slice 7+ POS screens

Canonical status: [`Current_Status.md`](../Current_Status.md). Milestones: [`PROJECT_MASTER_PLAN.md`](../PROJECT_MASTER_PLAN.md). APIs: [`Completed_API_lists.md`](../Completed_API_lists.md) (§20 = M5). RBAC: [`ROLES_AND_PERMISSIONS.md`](../ROLES_AND_PERMISSIONS.md).
