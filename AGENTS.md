# PharmaSync POS — Project Guardrails & Rules

---
description: Milestone gating, stack lock, doc hierarchy, and safe agent ops for R2A Pharmacy POS.
alwaysApply: true
---

# Core Guardrails

## Source of truth
- Before large or architectural work, read `Current_Status.md` and `PROJECT_MASTER_PLAN.md`.
- Use `docs/Project_Requirement_Documents.md`, `docs/System_Architecture_Technical_Specification.md`, `docs/UX_Specification.md`, and `docs/Project_Handover.md` only as supporting context.
- On conflict, **status + master plan override** the older `docs/` drafts.

## Milestone gating
- Only implement the milestone the user explicitly authorizes.
- Do not start M2+ work (or later) from status alone without authorization.

## Stack lock
- Express + TypeScript, Prisma + PostgreSQL, Tauri + React + SQLite, Zod in `@r2a/shared-types`.
- Never reintroduce MongoDB, Mongoose, or a competing backend/frontend stack.

## Safety
- Never commit secrets (`.env`). Use `.env.example` only.
- Do not delete config roots (`.env`, `package.json`, `tsconfig.json`, `schema.prisma`) without explicit confirmation.
- No force-delete of trees or `git reset --hard` unless the user explicitly asks.
- Git commit / push only when the user explicitly asks.

## Efficiency
- Be concise; prefer targeted edits over rewriting large files.
- No drive-by refactors or unrelated docs unless asked.
- If a proposed edit matches existing code, say "No changes needed" and stop.
---



---
description: Prisma, Express API, multi-tenant isolation, FEFO, and shared Zod contracts.
globs: apps/server/**/*,packages/database/**/*,packages/shared-types/**/*,**/*.prisma,**/*.sql
alwaysApply: false
---

# Backend & Database

## Tenancy
- Every domain entity has `tenantId`. Scope every Prisma query by `tenantId` from the JWT — never from the client body alone.

## Contracts
- Reuse schemas from `@r2a/shared-types`. Do not invent parallel DTOs/Zod for the same payloads.
- Domain API DTOs: camelCase. Sync queue envelope: snake_case (map at the sync boundary).

## Domain rules
- FEFO: select batches with `expiryDate ASC` where `quantityOnHand > 0`; manual override needs permission.
- Prisma Batch fields (do not invent aliases): `expiryDate`, `quantityOnHand`, `costPerBase`, `sellPerBase`.
- ProductUnit conversion: `factorToBase`. Quantities stored in lowest unit (PIECE).
- Sales are append-only. Payments are `CASH` | `CARD` | `MFS` only (no Baki as a tender).
- Stock sync uses **deltas** (`quantity_change`), never absolute overwrite from offline nodes.
- Sale ingest idempotency via unique `eventId`. Online route: `POST /api/v1/sales/ingest` (not M4 `/sync/ingest`).
- Cashier responses omit `costPerBase` / margin; cashiers may read `sellPerBase` for checkout but cannot mutate cost/sell catalog prices.

## API shape
- Validate inputs with Zod. Do not swallow errors.
- Success envelope (legacy `sendResponse`): `{ status: "success", message, data?, meta? }`.
- Error envelope (via `AppError` + global handler): `{ status: "fail"|"error", message, ... }` — do not use `{ success: false, error: { code, message } }` unless docs are re-authorized.
- Layering: `router → controller → service` under `apps/server/src/modules/...`. Mount under `/api/v1`.
---


---
description: Tauri desktop POS, offline SQLite sync queue, and keyboard-first cashier UX.
globs: apps/desktop/**/*,packages/ui/**/*
alwaysApply: false
---

# Desktop POS & Offline Engine

## Scope
- Applies to `apps/desktop` and shared POS UI in `packages/ui` — not the owner web app.

## Offline
- Offline reads/writes go through local SQLite (`pos_local.db`) and `outbound_sync_queue` before cloud flush.
- Keep queue FIFO; cloud ingest must stay idempotent by `event_id` / `eventId`.

## UX
- Keyboard-first cashier flows (see `docs/UX_Specification.md` for the full shortcut map).
- Keep focus rings / keybindings clear for critical actions (`Ctrl+K`, `F2`, `F4`, `Enter` / `F10`, `Esc`).
- Product search autocomplete target: render in &lt; 50ms; avoid heavy re-renders on the cart table.
- Cashier must not see margins / base cost.
---


---
description: PharmaSync localization rules
alwaysApply: true
---

# PharmaSync Localization Rules

PharmaSync POS supports multiple UI locales.

Current locales:
- bn-BD
- en

Default UI locale:
- bn-BD

## Core rule

All new user-facing interface text MUST use the existing localization system.

Do NOT hard-code new UI strings directly inside React components.

Use the existing typed translation key system:

`t("...")`

and add matching entries to:

- `apps/desktop/src/i18n/locales/en.ts`
- `apps/desktop/src/i18n/locales/bn-BD.ts`

Any future locale must reuse the same keys and components.

## Translate

Translate static application/interface text:

- navigation
- headings
- buttons
- form labels
- placeholders/instructions
- modal copy
- validation messages
- frontend-owned errors/toasts
- status messages
- tooltips / aria labels
- keyboard shortcut descriptions

## Never translate runtime/domain data

Do NOT translate or transliterate:

- medicine/product names
- generic names
- manufacturer names
- customer/user names
- batch numbers
- transaction IDs
- phone numbers
- barcodes
- SKU/product codes
- MFS/provider names and references
- other stored/runtime business values

## Numbers

Use Latin digits 0-9 in all UI locales.

Do not automatically convert numbers into Bengali digits.

Keep values such as:

৳12.00
120
01712 345678

unchanged.

## Receipt

UI language does NOT control receipt language.

Do not localize or modify receipt body/template/model unless explicitly authorized.

## Components

Never create separate Bangla and English versions of a screen/component.

Use one component + translation keys.

## State safety

Changing locale must not reset:

- active sale
- cart
- selected customer
- loyalty state
- payment state
- modal/workflow state

## Keyboard

Tab is NOT a PharmaSync POS navigator.

POS navigation uses arrow keys.

- Arrow keys → navigate choices
- Enter → activate
- Esc → back/dismiss
- F6 → Hold / park the active sale
- F7 → Held sales list (toggle)

Do not introduce `[Tab] Navigate`.

## Product rule

There is no Baki / customer-credit payment feature in PharmaSync POS.

## New features

Every newly implemented UI feature must include localization entries for all currently supported locales in the same development task.

A feature is not considered UI-complete if new user-facing strings remain hard-coded.