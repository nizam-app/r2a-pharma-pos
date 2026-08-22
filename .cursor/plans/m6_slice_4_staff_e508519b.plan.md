---
name: M6 Slice 4 Staff
overview: "Plan Milestone 6 Slice 4 as Staff-only Owner web: list/add/details/edit + deactivate/reactivate, with email login (username = email local-part), server-generated temp password, MANAGER|CASHIER roles, single-store branch, and self-lockout guards. Reports/Audit/Settings/Help/Owner Profile stay disabled."
todos:
  - id: an-schema
    content: "Batch AN: User phone/note/lastLoginAt + StaffActivityEvent + Zod + seed"
    status: pending
  - id: ao-apis
    content: "Batch AO: OWNER /owner/users CRUD + deactivate/reactivate + self-guards + login lastLoginAt"
    status: pending
  - id: ap-nav
    content: "Batch AP: Enable Staff nav + /staff routes placeholders"
    status: pending
  - id: aq-list
    content: "Batch AQ: Staff list UI (KPIs, tabs, search, filters, pagination)"
    status: pending
  - id: ar-add
    content: "Batch AR: Add Staff + one-time temp password reveal"
    status: pending
  - id: as-details
    content: "Batch AS: Staff Details (Active/Inactive) + activity timeline"
    status: pending
  - id: at-edit
    content: "Batch AT: Edit Staff (username read-only; self-edit disabled)"
    status: pending
  - id: au-modals
    content: "Batch AU: Deactivate + Reactivate confirmation modals"
    status: pending
  - id: av-exit
    content: "Batch AV: Slice 4 exit — docs, catalog, smoke:m6av"
    status: pending
isProject: false
---

# M6 Slice 4 — Staff (Owner Web)

## Self-lockout rule (explained)

The signed-in Owner must not be able to **disable their own account** or **change their own role** in a way that locks them out of the Owner portal.

Concrete guards:
- On **Deactivate**: if `targetUserId === JWT.sub` → `400` / UI disables the action.
- On **Edit**: Owner cannot change **their own** `role` or `isActive` via this UI/API (profile fields like name/phone/email/note may still be editable for self, or we park self-edit entirely — **lock: park Edit for self**; use Details read-only for own row).
- Never allow creating/editing anyone to `OWNER` / `SUPER_ADMIN` via Staff flows (existing lock).
- List may include the Owner row (read-only View); Add Staff roles stay `MANAGER` | `CASHIER` only.

## Locked product decisions

| Topic | Lock |
|-------|------|
| Scope | **Staff only.** Reports / Audit & FEFO / Settings / Help / Owner Profile stay `live: false` until shared. |
| Slice 2 AC–AD | Still **deferred**. |
| Login | **Email + password** unchanged. Mock “Username” = **email local-part** (display only; read-only on Edit). |
| Create credentials | Server **generates** a temp password (min 8); return **once** in create response; Owner copies it. No password field on Add Staff form. |
| Roles | `MANAGER` \| `CASHIER` only. Mock “Inventory Staff” is **not** a role — omit from dropdown. |
| Branch | **Single store** (Phase 1). Assigned Branch = tenant’s current store (required; one option). Branch filter = that store or “All” with one store. No multi-branch switch. |
| More Actions | **Deactivate** (when Active) / **Reactivate** (when Inactive) only. |
| Chrome | Keep Dashboard chrome lock; ignore dark/purple mock sidebars. |
| Web RBAC | `apps/web` remains **OWNER-only**. Staff APIs used by web = `restrictTo("OWNER")`. Existing `POST /users` (OWNER\|MANAGER) may stay for desktop/API; Owner web uses owner staff routes. |
| Payments / Baki | Unchanged. No sale void. |

## Screen map (from shares)

```text
Staff (list)
  → Add Staff → Staff Details (Active)
  → View → Staff Details (Active | Inactive)
       → Edit Staff → Staff Details
       → More Actions → Deactivate Staff modal → Details (Inactive)
       → More Actions → Reactivate Staff modal → Details (Active)
```

Routes (proposed):
- `/staff` — list
- `/staff/new` — add
- `/staff/:userId` — details
- `/staff/:userId/edit` — edit

## Data model (additive)

Extend [`packages/database/prisma/schema.prisma`](packages/database/prisma/schema.prisma) `User`:
- `phone` `String?` (required in Owner Add/Edit UI; store E.164-ish free text like customers)
- `internalNote` `String?`
- `lastLoginAt` `DateTime?` — set on successful `POST /auth/login` (powers “Last Active”; honest `—` if null)
- Keep `isActive` for Active/Inactive badges
- **No** `username` column — derive display username = `email.split("@")[0]`

New model `StaffActivityEvent` (tenant-scoped audit for Activity History):
- `id`, `tenantId`, `userId` (subject), `actorUserId`, `type` enum: `CREATED` | `ROLE_CHANGED` | `BRANCH_CHANGED` | `DEACTIVATED` | `REACTIVATED` | `PROFILE_UPDATED`
- `message` or structured `fromValue` / `toValue` JSON strings
- `note` optional (deactivation reason)
- `createdAt`

Seed: existing owner/manager/cashier remain; optionally one `isActive: false` cashier for Inactive tab walkthrough.

## API surface (new / extended)

Owner-only under `/api/v1/owner/users*` (mirror Customers):

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/owner/users` | Paged list + search + role/status tabs + KPIs (`total`, `active`, `inactive`, `cashiers`) |
| `GET` | `/owner/users/:id` | Detail + store name + activity timeline + derived username |
| `POST` | `/owner/users` | Create: name, phone, email (required), note?, role, storeId (default JWT store). Generate password; return `{ user, temporaryPassword }` once. Write `CREATED` activity. |
| `PATCH` | `/owner/users/:id` | Edit profile/role/store (not username). Self-edit blocked per lock. Activity on role/branch/profile changes. |
| `POST` | `/owner/users/:id/deactivate` | `isActive=false`; revoke refresh tokens; optional reason; activity. Block self. |
| `POST` | `/owner/users/:id/reactivate` | `isActive=true`; activity. |

Also: on login, set `lastLoginAt`. Inactive users already fail login — keep that.

Zod in [`packages/shared-types`](packages/shared-types): staff list/detail/create/patch/deactivate schemas; extend `safeUserSchema` with phone, note, lastLoginAt, derived username optional in API responses.

Catalog: append §24 (or next) in [`Completed_API_lists.md`](Completed_API_lists.md) at Slice 4 exit.

## UI batches (one batch per chat)

| Batch | Title | Notes |
|-------|-------|-------|
| **AN** | Prisma + Zod + seed | Schema + activity model + login `lastLoginAt`. No UI. |
| **AO** | Owner staff APIs | List/detail/create/patch/deactivate/reactivate + self-guards + smokes. |
| **AP** | Enable Staff nav | `nav.ts` `live: true` + `/staff` paths in [`ownerPath.ts`](apps/web/src/lib/ownerPath.ts) + placeholder shell in [`AppShell.tsx`](apps/web/src/features/shell/AppShell.tsx). Reports/… stay disabled. |
| **AQ** | Staff list | Match shared Staff screen: KPIs, tabs All/Active/Inactive, search, role filter, table, View → detail. Branch filter single-store. |
| **AR** | Add Staff | Form per mock; email required; no password field; after create show one-time temp password then → Details. |
| **AS** | Staff Details | Active + Inactive variants; Edit; More Actions wired in AU; Activity History live. |
| **AT** | Edit Staff | Username read-only; Save → Details. Self row: Edit disabled. |
| **AU** | Deactivate + Reactivate modals | Checkbox-gated confirm; reason optional on deactivate. |
| **AV** | Slice 4 exit | Docs (`MILESTONE_6_EXECUTION.md`, `Current_Status.md`, `PROJECT_MASTER_PLAN.md`, `ROLES_AND_PERMISSIONS.md`) + catalog + `smoke:m6av`. |

Order: **AN → AO → AP → AQ → AR → AS → AT → AU → AV**.

## Implementation leverage

- Nav enable pattern: Customers Batch AG ([`nav.ts`](apps/web/src/features/shell/nav.ts), [`ownerPath.ts`](apps/web/src/lib/ownerPath.ts)).
- List/detail/create UX: [`apps/web/src/features/customers/`](apps/web/src/features/customers/) and suppliers.
- Existing create: [`staffCreateSchema`](packages/shared-types/src/auth.ts) / `POST /users` — Owner web prefers new `/owner/users` create with generated password; do not require password in the Owner form.
- i18n: `apps/web` `en.ts` + `bn-BD.ts` for all Staff strings. Do not translate names, emails, phones, usernames.

## Explicitly out of Slice 4

- Reports, Audit & FEFO, Settings, Help, Owner Profile
- Manifest Details (AC), Edit Customer, Edit Supplier, Manager web
- Real password-reset email / invite email (temp password in UI is enough)
- Multi-branch, Inventory Staff role, n8n, RLS, bi-di sync

## Docs update (Batch AV + as batches complete)

Append a **Slice 4 — Staff** section to [`MILESTONE_6_EXECUTION.md`](MILESTONE_6_EXECUTION.md) with screen names, parked table, batch prompts, and exit protocol (same short-report format as Slice 3). Update status board so next gated work after AV = share next Owner screens or authorize deferred AC.

## Execution gate

Do **not** implement until you say **Authorize M6 Batch AN** in **Agent** mode (one batch per chat). Batch AN also appends the Slice 4 section into [`MILESTONE_6_EXECUTION.md`](MILESTONE_6_EXECUTION.md).

---

## Batch AN — Prisma + Zod + seed

**Goal:** Additive schema only. No Owner staff routes/UI yet.

**Tasks:**
- `User`: `phone String?`, `internalNote String?`, `lastLoginAt DateTime?`
- Enum `StaffActivityType` + model `StaffActivityEvent` (tenantId, userId, actorUserId, type, fromValue?, toValue?, note?, createdAt; indexes on tenantId+userId)
- Zod in `@r2a/shared-types` (staff DTOs stub OK if unused until AO); extend safe user fields
- Seed: keep demo owner/manager/cashier; add one **inactive** cashier for Inactive tab; backfill `CREATED` activity for seeded staff optional
- Append Slice 4 section skeleton to `MILESTONE_6_EXECUTION.md`; touch status “Slice 4 authorized / AN in progress” only if AN completes
- Do **not** change login to set `lastLoginAt` until AO (or do it in AN if tiny — prefer AO with APIs)

**Exit:** migrate applies; `smoke:m2` still PASS.

**Agent prompt:** `Authorize M6 Batch AN` — implement ONLY AN from this plan + MILESTONE_6 Slice 4 section.

---

## Batch AO — Owner staff APIs

**Goal:** Live `/api/v1/owner/users*` + login `lastLoginAt`.

**Tasks:**
- `restrictTo("OWNER")` on all owner staff routes
- List (q, role, isActive/tab, storeId, limit/offset) + `meta.kpis`
- Detail with storeName, derived username, activity newest-first
- Create: generate temp password; hash; return once; `CREATED` event; roles CASHIER|MANAGER only
- PATCH: block if `id === sub`; no username change; emit ROLE/BRANCH/PROFILE events
- Deactivate: block self; revoke refresh tokens; optional note; `DEACTIVATED`
- Reactivate: `REACTIVATED`
- Login success → update `lastLoginAt`
- `smoke:m6ao` covering create/list/detail/edit/deactivate/reactivate/self-guards/non-owner 403

**Exit:** smoke PASS. No web UI yet.

---

## Batch AP — Enable Staff nav

**Goal:** Staff sidebar live; placeholder shells for `/staff`, `/staff/new`, `/staff/:id`, `/staff/:id/edit`.

**Tasks:** Copy Customers AG pattern in `nav.ts`, `ownerPath.ts`, `AppShell.tsx`. Reports/Help/Owner Profile stay disabled. `smoke:m6ap`.

---

## Batch AQ — Staff list

**Re-share:** Staff (list screen already shared).

**Tasks:** Live list from `GET /owner/users`; KPIs; tabs All/Active/Inactive; search; Role filter; Branch = single store; View → details; + Add Staff → `/staff/new`. i18n en + bn-BD. `smoke:m6aq`.

---

## Batch AR — Add Staff

**Re-share:** Add Staff.

**Tasks:** Form: name, phone, email required; note optional; role; branch (one store). No password field. On success: show one-time temp password dialog/banner → navigate Details. `smoke:m6ar`.

---

## Batch AS — Staff Details

**Re-share:** Staff Details Active + Inactive.

**Tasks:** Header + KPIs + Staff Information + Account & Access + Activity History. Edit enabled unless self. More Actions opens in AU (placeholder menu OK until AU). Pending: none. `smoke:m6as`.

---

## Batch AT — Edit Staff

**Re-share:** Edit Staff.

**Tasks:** Prefill; username read-only; Save PATCH → Details; Cancel → Details. Self → redirect or disable entry. `smoke:m6at`.

---

## Batch AU — Deactivate + Reactivate modals

**Re-share:** both confirmation modals.

**Tasks:** Checkbox-gated; deactivate optional reason; wire More Actions; refresh Details status + activity. Self actions hidden. `smoke:m6au`.

---

## Batch AV — Slice 4 exit

**Tasks:** Catalog §24; update `Current_Status.md`, `PROJECT_MASTER_PLAN.md`, `ROLES_AND_PERMISSIONS.md`, `MILESTONE_6_EXECUTION.md`; `smoke:m6av`; mark Slice 4 Staff DONE; next = share Reports/… or authorize AC.

**Short report template (every batch):**
```text
## M6 Batch <ID> report
Done: <1–3 bullets>
Smoke: PASS | FAIL | n/a — <script>
YOU DO: <numbered, or none>
Next: Authorize M6 Batch <next>
```
