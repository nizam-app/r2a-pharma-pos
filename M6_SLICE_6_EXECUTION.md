# Milestone 6 — Slice 6+ (Batch Execution Plan)

**Document type:** Fresh-chat execution guide for M6 Slices **6–8** (continues after Slice 5)  
**Parent file (Slices 1–5):** [`MILESTONE_6_EXECUTION.md`](MILESTONE_6_EXECUTION.md) — **do not read the whole file** for Slice 6+ work; use **this file** instead.  
**Source of truth:** [`PROJECT_MASTER_PLAN.md`](PROJECT_MASTER_PLAN.md)  
**Live progress context:** [`Current_Status.md`](Current_Status.md)  
**API catalog:** [`Completed_API_lists.md`](Completed_API_lists.md)  
**RBAC contract:** [`ROLES_AND_PERMISSIONS.md`](ROLES_AND_PERMISSIONS.md)  
**Authorized plan:** [`.cursor/plans/m6_slice_6_execution.plan.md`](.cursor/plans/m6_slice_6_execution.plan.md) (2026-08-22)

**Status of Slices 6–8:** **IN PROGRESS** — Slice 6 **BE–BG DONE**; Slice 7 **BH–BI DONE**; **BJ–BQ not started**. Screens shared 2026-08-22.  
**Prerequisite:** Milestone 0–**5** DONE; M6 Slice 1 **A–O DONE**; W1–W6 **DONE**; Slice 2 **P–AB DONE** (AC–AD **deferred**); Slice 3 **AE–AM DONE**; Slice 4 **AN–AV DONE**; Slice 5 **AW–BD DONE**.  
**Do not start:** BJ+ until user says `Authorize M6 Batch BJ` (or the matching later batch). Slice 2 AC/AD, Manager web, n8n, RLS, bi-di, M7 multi-branch, Inventory/Purchase report detail pages (not shared), desktop stock-audit count UI (later batch) — unless re-authorized.

---

## How to use this file

1. Open a **fresh Cursor chat** for each batch.
2. Attach / `@` these files:
   - `PROJECT_MASTER_PLAN.md`
   - `Current_Status.md`
   - `ROLES_AND_PERMISSIONS.md`
   - **`M6_SLICE_6_EXECUTION.md`** (this file — **not** the full `MILESTONE_6_EXECUTION.md`)
   - `Completed_API_lists.md`
3. Paste **only** that batch’s **Agent prompt** (or say `Authorize M6 Batch X`).
4. **UI batches:** agent **must ask for the screen first** (see Re-share protocol below). **Do not implement UI until you reply.**
5. Agent implements **only** that batch after the screen/decision is settled.
6. When the batch is done, the agent pastes the **short report**. You review.
7. Mark the batch checkbox when its exit check passes.
8. Proceed to the next batch only after the previous one is green.

> **Hard rules:**
> - Implement **one batch per chat**. Do not collapse Slice 6 BE–BG, Slice 7 BH–BL, or Slice 8 BM–BQ into a single run.
> - **Build only the active slice/batch.** Batch BE is done; BF+ still require explicit one-batch authorization.
> - **Re-share gate (mandatory for UI batches):** the agent **never** assumes “prior upload” or inventing. It **asks you first** and **stops**. Only after you say **use prior upload**, **invent to match theme**, or **re-share a new screenshot** may it build UI.
> - **Scroll doubles:** mocks delivered as two screenshots of the **same page** (top + scrolled bottom) = **one route**, full vertical scroll. Do not split into sub-routes.
> - **Mock inconsistency:** chrome is locked (Dashboard chrome from Slice 1 Batch B). Per-screen mocks drive *content only*. Do not restyle chrome to match dark/purple sidebars in later mocks.
> - `apps/web` is **OWNER only**. Manager and Cashier must not use it.
> - No invented KPI/table rows. Live Prisma via Express.
> - Payments stay **`CASH` \| `CARD` \| `MFS` only**. No Baki / on-account.
> - Localization: `t("...")` + `apps/web` `en.ts` + `bn-BD.ts`. Do not translate domain/runtime data (names, SKUs, batch numbers, emails, phones, receipt IDs). Latin digits only.

---

## Walkthrough + short-report protocol (mandatory)

| Kind | Who | What |
|------|-----|------|
| **Agent smoke** | Agent | Batch `smoke:m6*` when the batch lists one |
| **User review** | **You** | Short **YOU DO** list. If **None**, confirm smoke only |

**Agent must, at the end of every batch chat:**

```text
## M6 Batch <ID> report
Done: <1–3 bullets>
Smoke: PASS | FAIL | n/a — <script name>
YOU DO: <numbered, or none>
Next: Authorize M6 Batch <next>
```

Do **not** start the next batch in the same chat.

---

## Screen re-share protocol (UI batches) — STRICT

**Problem this fixes:** agents must **not** silently use an old upload or guess layout when UI does not match the mock.

### Rule

For **every UI batch** (BF, BJ, BK, BN, BO, BP) and any batch whose table says **Re-share screen**:

1. Agent’s **first message** after `Authorize M6 Batch X` is **only** the ask below.
2. Agent **stops** — no schema reads for UI layout, no component code, no “I’ll use the prior upload”.
3. You reply with **one** of:
   - Re-share the screenshot(s) for that screen (include **scroll bottom** if the mock was split).
   - **`use prior upload`** — agent may use screenshots already shared in this project/chat history.
   - **`invent to match theme`** — agent may invent layout matching Admin Portal / Dashboard chrome family (document what was invented).
4. Only **after** your reply does the agent implement that batch.

### Ask template (agent must paste verbatim, fill `<ID>` and `<Screen name>`)

```text
⏸ Batch <ID> needs the visual for: "<Screen name>".
Please re-share that screenshot (include scroll-bottom sections if the mock was split),
or reply exactly: use prior upload | invent to match theme.
Stopping until you reply — no UI code until then.
```

### If UI still does not match after build

You reply **FAIL — UI mismatch** with what is wrong. Agent fixes in a **new chat** for the same batch (or a small fix batch if you authorize).

### Slice 6–8 screen names (exact labels)

| # | Screen name | Batch | Re-share? |
|---|-------------|-------|-----------|
| 33 | **Sales Report** (top + scroll: Recent Sales Transactions) | BF | **Yes — ask first** |
| 34 | **Audit & FEFO** (dashboard) | BJ | **Yes — ask first** |
| 35 | **Audit Detail** | BK | **Yes — ask first** |
| — | **Review Audit** (modal) | BK | **Not shared — ask; invent only if you say invent** |
| 36 | **Settings** (hub) | BN | **Yes — ask first** |
| 37 | **Business Profile** | BN | **Yes — ask first** |
| 38 | **Account Profile** | BO | **Yes — ask first** |
| 39 | **Help & Support** | BP | **Yes — ask first** |

Chrome baseline: **Dashboard** (Slice 1). Ignore dark/purple sidebars in new mocks.

---

## Scroll-page rule (critical)

| Screen | Route | Rule |
|--------|-------|------|
| **Sales Report** | `/reports/sales` | One page: KPIs → chart/payment/widgets → Top Selling Medicines → **Recent Sales Transactions** (scroll). Not two routes. |
| **Audit & FEFO** | `/audit` | One page: KPIs → Expiry + FEFO cards → Recent Stock Audits + Activity Log. |
| **Audit Detail** | `/audit/:auditId` | One page: summary cards → line table → FEFO card → timeline + notes. |

QA: bottom sections reachable by scroll on a short viewport.

---

## Incremental slice protocol

| Rule | Behavior |
|------|----------|
| Parent | Slices 1–5 live in [`MILESTONE_6_EXECUTION.md`](MILESTONE_6_EXECUTION.md). **This file** = Slices 6–8 only. |
| Active scope | **Slice 6 done.** Continue one batch at a time: BH → … → BQ. |
| Slice 6 complete | Batch BG exit + walkthrough PASS |
| Slice 7 complete | Batch BL exit + walkthrough PASS |
| Slice 8 complete | Batch BQ exit + walkthrough PASS |
| M6 milestone complete | **Not** Slice 8 — AC–AD, bi-di, n8n, RLS, Manager web still open |
| Parallel | Deferred Slice 2 **AC–AD** may be authorized separately — do not mix with BE+ in one chat |
| Invent authorization | **Review Audit modal** (BK) — invent **only** after you say `invent to match theme` |
| Desktop stock count | Manager start/submit count APIs in BI; **desktop UI** = later backlog (seed + Owner review for walkthrough) |

---

## Sidebar IA (after Slice 8 BQ)

```text
LIVE (prior slices):  Dashboard, Sales, Inventory, Purchasing, Suppliers, Customers, Staff, Reports
LIVE (Slice 6):       Reports → Sales Report (/reports/sales)
LIVE (Slice 7):       Audit & FEFO (/audit)
LIVE (Slice 8):       Settings (/settings), Help (/help), Owner Profile → /settings/account

DISABLED (not shared): Inventory Report, Purchase Report detail
DISABLED (Slice 8 hub): Branch Management, User Roles, System Preferences, Security, Audit & Data cards
DEFERRED:              Manifest Details (Slice 2 AC–AD)
```

---

## Slice 6 — Sales Report

User shared **Sales Report** 2026-08-22 (two scroll captures = **one page**). Enables **View Report** on Sales card in [`ReportsDashboardPage.tsx`](apps/web/src/features/reports/ReportsDashboardPage.tsx) (currently disabled).

### Locked product decisions

| Topic | Lock |
|-------|------|
| Scope | **Sales Report only.** Inventory/Purchase report pages stay disabled |
| Live data | No decorative sample KPIs or rows |
| Branch | Single store — selector shows current store; filter disabled |
| Date range | Default Last 30 Days; presets like Sales Overview |
| Payments | CASH \| CARD \| MFS; UI label “Mobile Payment” = MFS |
| Trends | Show +/- vs prior period only when computable |
| Export Report | **Disabled** + hint |

### IA

```text
Reports Dashboard (/reports)
  → Sales card "View Report" → Sales Report (/reports/sales)
       → Invoice No. row → /sales/:id
       → View All Staff Performance → /staff/shifts
```

### Routes

| Screen | Route |
|--------|--------|
| Sales Report | `/reports/sales` |

Breadcrumb: `Reports > Sales Report`.

### API (Batch BE)

**`GET /api/v1/owner/reports/sales`** (OWNER-only, query: `from`, `to`, optional `storeId`):

| Block | Source |
|-------|--------|
| KPIs | total sales, txn count, avg order, items sold (pieces) |
| Sales overview bars | daily totals in range (dashboard pattern) |
| Payment summary | tender mix CASH/CARD/MFS |
| Best-selling category | top category by units |
| Highest sales day | max daily total + txn count |
| Top cashiers | by `Sale.userId` |
| Top selling medicines | by product |
| Recent sales transactions | list: invoice, date, customer, item count, payment method, total, cashier |

Zod in `@r2a/shared-types`. Catalog **§26** at Batch BG.

### Batch overview (Slice 6)

| Batch | Title | Depends | Re-share? |
|-------|-------|---------|-----------|
| **BE** | Sales Report API + Zod | Slice 5 BD | No — **DONE** |
| **BF** | Sales Report UI + enable dashboard View Report | BE | **Sales Report — ask first** |
| **BG** | Slice 6 exit | BE–BF | No — **DONE** |

Order: **BE → BF → BG**. **BE–BG DONE**; next = **BH** when authorized.

---

## Batch BE — Sales Report API (Slice 6)

**Goal:** Live sales report aggregate API + Zod. **No** Owner web UI yet.

**Re-share screen:** none.

### Tasks

- [x] `GET /owner/reports/sales` with range filters
- [x] Prior-period comparison for trend fields when possible
- [x] Zod response in `@r2a/shared-types`
- [x] `smoke:m6be`
- [x] Do **not** build `/reports/sales` page or enable View Report yet

### Exit check

- `smoke:m6be` PASS. Reports dashboard Sales View Report still disabled

### Agent prompt

```text
Implement ONLY Batch BE from M6_SLICE_6_EXECUTION.md
(Sales Report API + Zod). No UI.
When done, paste the short M6 Batch BE report.
```

**YOU DO:** none (API smoke).

**Next:** `Authorize M6 Batch BF` — agent will **ask for Sales Report screen first**.

---

## Batch BF — Sales Report UI (Slice 6)

**Goal:** Full-scroll **Sales Report** page + wire Reports dashboard Sales **View Report** → `/reports/sales`.

**Re-share screen:** **Sales Report** (top + scroll bottom = one page) — **agent must ask first**.

### Tasks

- [x] Register `/reports/sales` in `ownerPath.ts` + `AppShell.tsx`
- [x] **One page** with all sections (KPI row, chart, payment summary, side widgets, top medicines table, recent transactions table)
- [x] Date range control; branch display-only
- [x] Export Report disabled
- [x] Enable Sales card View Report on Reports dashboard
- [x] Inventory/Purchase View Report stay disabled
- [x] i18n en + bn-BD; `smoke:m6bf`

### Exit check

- `smoke:m6bf` PASS. Scroll reaches Recent Sales Transactions table

### Agent prompt

```text
Implement ONLY Batch BF from M6_SLICE_6_EXECUTION.md
(Sales Report UI). STOP and ask for Sales Report screenshot first (see re-share protocol).
When done, paste the short M6 Batch BF report.
```

**YOU DO:** Open `/reports/sales` from dashboard; scroll to Recent Sales Transactions; confirm layout vs mock.

**Next:** Batch BG, BH, and BI are complete; next gated batch is `Authorize M6 Batch BJ`.

---

## Batch BG — Slice 6 exit

**Goal:** Catalog §26, `smoke:m6s6`, status docs.

**Re-share screen:** none.

### Tasks

- [x] [`Completed_API_lists.md`](Completed_API_lists.md) **§26**
- [x] Composed smoke for BE–BF
- [x] [`Current_Status.md`](Current_Status.md): Slice 6 live
- [x] This file BE–BG checkboxes
- [x] Do **not** start Slice 7 BH

### Agent prompt

```text
Implement ONLY Batch BG from M6_SLICE_6_EXECUTION.md
(Slice 6 exit). Catalog §26, smoke:m6s6, status docs.
When done, paste the short M6 Batch BG report.
```

**YOU DO:** Reports → View Report (Sales) → full scroll page with live data.

**Next after PASS:** Batch BH and BI are complete; next gated batch is `Authorize M6 Batch BJ` (Audit & FEFO dashboard UI; ask for screen first).

---

## Slice 7 — Audit & FEFO (full StockAudit)

User shared **Audit & FEFO** dashboard + **Audit Detail** 2026-08-22. **Full cloud StockAudit** + **FefoViolationRecord** (locked). Desktop count UI deferred.

### Locked product decisions

| Topic | Lock |
|-------|------|
| Scope | Audit dashboard + detail + review + FEFO correction |
| StockAudit | Full model — create/submit via API; walkthrough uses seed + Owner review |
| FEFO violations | Record on sale `fefoOverride`; Owner can apply correction |
| Branch | Single store |
| Generate Report / Export | **Disabled** |
| Review Audit modal | **Not shared** — ask; invent only if user says invent |

### IA

```text
Audit & FEFO (/audit)
  → View → Audit Detail (/audit/:auditId)
       → Review Audit modal
       → Apply FEFO Correction (when linked violation OPEN)
```

### Routes

| Screen | Route |
|--------|--------|
| Audit & FEFO | `/audit` |
| Audit Detail | `/audit/:auditId` |

### Schema (Batch BH)

**Enums:** `StockAuditStatus` (`IN_PROGRESS` \| `UNDER_REVIEW` \| `COMPLETED` \| `VARIANCE_FOUND`); `StockAuditLineStatus` (`MATCHES` \| `DISCREPANCY`); `FefoViolationStatus` (`OPEN` \| `CORRECTED` \| `DISMISSED`); `StockAuditActivityType` (`CREATED` \| `COUNT_STARTED` \| `VARIANCE_DETECTED` \| `REVIEWED` \| `FEFO_CORRECTED` \| `COMPLETED`).

**`StockAudit`:** `id`, `tenantId`, `storeId`, `auditNo` (unique/tenant), `status`, `locationLabel`, `itemsChecked`, `varianceAmount`, `notes`, `startedAt`, `completedAt`, `reviewedAt`, `createdByUserId`, `reviewedByUserId`, timestamps.

**`StockAuditLine`:** `auditId`, `batchId`, `productId`, `systemQty`, `countedQty`, `differenceQty`, `status`, snapshots for display.

**`FefoViolationRecord`:** tenant/store, optional sale/saleItem/audit links, product + skipped/picked batch IDs, `observedIssue`, `recommendedAction`, status, correction audit fields.

**`StockAuditActivityEvent`:** timeline rows.

**Seed:** IN_PROGRESS, COMPLETED, VARIANCE_FOUND (detail walkthrough), FEFO open + corrected samples.

### API (Batch BI)

**Owner:**

| Method | Path |
|--------|------|
| `GET` | `/owner/audit/dashboard` |
| `GET` | `/owner/audits` |
| `GET` | `/owner/audits/:id` |
| `POST` | `/owner/audits/:id/review` |
| `POST` | `/owner/fefo-violations/:id/correct` |

**Manager (API only; desktop UI later):**

| Method | Path |
|--------|------|
| `POST` | `/audits/start` |
| `POST` | `/audits/:id/lines` |
| `POST` | `/audits/:id/submit` |

Sale ingest: create/link `FefoViolationRecord` when `fefoOverride === true`.

Catalog **§27** at Batch BL.

### Batch overview (Slice 7)

| Batch | Title | Depends | Re-share? |
|-------|-------|---------|-----------|
| **BH** | Prisma + Zod + seed | BG | No — **DONE** |
| **BI** | Audit + FEFO APIs + ingest hook | BH | No — **DONE** |
| **BJ** | Audit nav + Audit & FEFO dashboard | BI | **Audit & FEFO — ask first** |
| **BK** | Audit Detail + Review modal + Apply FEFO | BJ | **Audit Detail — ask first**; Review modal ask/invent |
| **BL** | Slice 7 exit | BH–BK | No |

Order: **BH → BI → BJ → BK → BL**.

---

## Batch BH — Prisma + seed (Slice 7)

**Goal:** StockAudit schema + seed. No routes/UI.

**Re-share screen:** none.

### Tasks

- [x] Models + enums per Slice 7 schema lock
- [x] Zod DTOs in `@r2a/shared-types`
- [x] Seed demo audits + FEFO violations
- [x] Migrate applies; `smoke:m2` still PASS
- [x] No audit routes or UI yet

### Exit check

- Migrate + seed OK. No UI

### Agent prompt

```text
Implement ONLY Batch BH from M6_SLICE_6_EXECUTION.md
(Audit Prisma + Zod + seed). No routes/UI.
When done, paste the short M6 Batch BH report.
```

**YOU DO:** none.

**Next:** Batch BI is complete; next gated batch is `Authorize M6 Batch BJ`.

---

## Batch BI — Audit + FEFO APIs (Slice 7)

**Goal:** Live audit/FEFO APIs + manager submit routes + sale ingest hook.

**Re-share screen:** none.

### Tasks

- [x] Owner dashboard/list/detail/review/correct routes
- [x] Manager start/lines/submit routes (MANAGER + OWNER)
- [x] FEFO violation on ingest when override
- [x] `smoke:m6bi`
- [x] No Owner web audit UI yet

### Exit check

- `smoke:m6bi` PASS

### Agent prompt

```text
Implement ONLY Batch BI from M6_SLICE_6_EXECUTION.md
(Audit + FEFO APIs). No web UI.
When done, paste the short M6 Batch BI report.
```

**YOU DO:** none (API smoke).

**Next:** `Authorize M6 Batch BJ` — agent will **ask for Audit & FEFO screen first**.

---

## Batch BJ — Audit & FEFO dashboard (Slice 7)

**Goal:** Enable Audit nav + live `/audit` dashboard.

**Re-share screen:** **Audit & FEFO** — **agent must ask first**.

### Tasks

- [ ] `nav.ts` `auditFefo` `live: true`, path `/audit`
- [ ] KPI cards, Expiry Monitoring, FEFO Compliance, Recent Stock Audits, Activity Log
- [ ] View → `/audit/:auditId`
- [ ] Generate Report disabled
- [ ] i18n en + bn-BD; `smoke:m6bj`

### Exit check

- `smoke:m6bj` PASS. Audit Detail not required until BK

### Agent prompt

```text
Implement ONLY Batch BJ from M6_SLICE_6_EXECUTION.md
(Audit & FEFO dashboard). STOP and ask for Audit & FEFO screenshot first.
When done, paste the short M6 Batch BJ report.
```

**YOU DO:** Audit nav opens; list links work; layout vs mock.

**Next:** `Authorize M6 Batch BK` — agent will **ask for Audit Detail (+ Review modal decision) first**.

---

## Batch BK — Audit Detail + modals (Slice 7)

**Goal:** Live Audit Detail + Review Audit modal + Apply FEFO Correction.

**Re-share screen:** **Audit Detail** — **ask first**. **Review Audit modal** — **not shared; ask** (invent only if you say invent).

### Tasks

- [ ] `/audit/:auditId` detail page (summary, line table, FEFO card, timeline, notes)
- [ ] Review Audit modal → `POST /owner/audits/:id/review`
- [ ] Apply FEFO Correction → `POST /owner/fefo-violations/:id/correct`
- [ ] Generate Report / Review Audit header actions per mock
- [ ] i18n en + bn-BD; `smoke:m6bk`

### Exit check

- `smoke:m6bk` PASS. VARIANCE_FOUND audit reviewable

### Agent prompt

```text
Implement ONLY Batch BK from M6_SLICE_6_EXECUTION.md
(Audit Detail + Review modal + FEFO correction). STOP and ask for screens first (see protocol).
When done, paste the short M6 Batch BK report.
```

**YOU DO:** Open seeded VARIANCE_FOUND audit → Review → Apply FEFO if shown.

**Next:** `Authorize M6 Batch BL`.

---

## Batch BL — Slice 7 exit

**Goal:** Catalog §27, `smoke:m6s7`, RBAC audit rows, status docs.

**Re-share screen:** none.

### Tasks

- [ ] [`Completed_API_lists.md`](Completed_API_lists.md) **§27**
- [ ] [`ROLES_AND_PERMISSIONS.md`](ROLES_AND_PERMISSIONS.md) audit/FEFO rows
- [ ] Composed smoke; `Current_Status.md` Slice 7 live
- [ ] Do **not** start Slice 8 BM

### Agent prompt

```text
Implement ONLY Batch BL from M6_SLICE_6_EXECUTION.md
(Slice 7 exit). Catalog §27, smoke:m6s7, RBAC, status docs.
When done, paste the short M6 Batch BL report.
```

**YOU DO:** Audit dashboard → detail → review variance audit.

**Next after PASS:** `Authorize M6 Batch BM` (Slice 8 Settings).

---

## Slice 8 — Settings + Help + Owner Profile

User shared **Settings** hub, **Business Profile**, **Account Profile**, **Help & Support** 2026-08-22.

### Locked product decisions

| Topic | Lock |
|-------|------|
| Scope | Settings hub + Business Profile + Account Profile + Help |
| Hub cards | Only **Business Profile** live; others **disabled** with hints |
| Account Profile | Footer **Owner Profile** → `/settings/account` |
| Help | Static FAQ i18n; tickets **disabled** (no external ticketing) |
| 2FA / sessions / notification toggles | **Disabled** or read-only hints |
| Branch Management | **Disabled** (M7) |

### IA

```text
Settings (/settings) → Business Profile (/settings/business)
                     → Account Profile (/settings/account)

Footer Help → /help
Footer Owner Profile → /settings/account
```

### Schema (Batch BM)

Extend **Tenant** + **Store** for business profile fields (legal name, license, contact, address, hours, timezone, tax/VAT; currency BDT locked).

**`ConfigurationActivityEvent`** for settings activity sidebar + business timeline.

### API (Batch BM)

| Method | Path |
|--------|------|
| `GET` / `PATCH` | `/owner/settings/business` |
| `GET` / `PATCH` | `/owner/settings/account` |
| `POST` | `/owner/settings/account/change-password` |
| `GET` | `/owner/settings/activity` |
| `GET` | `/owner/help/status` |

Catalog **§28** at Batch BQ.

### Batch overview (Slice 8)

| Batch | Title | Depends | Re-share? |
|-------|-------|---------|-----------|
| **BM** | Business profile schema + settings APIs | BL | No |
| **BN** | Settings nav + hub + Business Profile | BM | **Settings hub + Business Profile — ask first** |
| **BO** | Account Profile + footer Owner Profile | BM | **Account Profile — ask first** |
| **BP** | Help & Support + footer Help | BM | **Help & Support — ask first** |
| **BQ** | Slice 8 exit | BM–BP | No |

Order: **BM → BN → BO → BP → BQ**.

---

## Batch BM — Settings schema + APIs (Slice 8)

**Goal:** Business profile fields + settings/account/activity APIs. No UI.

**Re-share screen:** none.

### Tasks

- [ ] Prisma Tenant/Store extensions + `ConfigurationActivityEvent`
- [ ] Zod + routes listed above
- [ ] Record activity on business save + password change
- [ ] `smoke:m6bm`
- [ ] No Settings/Help nav live yet

### Exit check

- `smoke:m6bm` PASS

### Agent prompt

```text
Implement ONLY Batch BM from M6_SLICE_6_EXECUTION.md
(Settings schema + APIs). No UI.
When done, paste the short M6 Batch BM report.
```

**YOU DO:** none.

**Next:** `Authorize M6 Batch BN` — agent will **ask for Settings + Business Profile screens first**.

---

## Batch BN — Settings hub + Business Profile (Slice 8)

**Goal:** Settings nav + hub + Business Profile form.

**Re-share screen:** **Settings** hub + **Business Profile** — **ask first** (may be two screenshots).

### Tasks

- [ ] `nav.ts` settings `live: true`, `/settings`, `/settings/business`
- [ ] Settings hub: 6 cards; only Business Profile clickable
- [ ] Business Profile form + timeline + Save
- [ ] Disabled cards with hints (Branch, Roles, Preferences, Security, Audit & Data)
- [ ] i18n en + bn-BD; `smoke:m6bn`

### Exit check

- `smoke:m6bn` PASS. Help/Owner Profile footer still disabled until BO/BP

### Agent prompt

```text
Implement ONLY Batch BN from M6_SLICE_6_EXECUTION.md
(Settings hub + Business Profile). STOP and ask for screenshots first.
When done, paste the short M6 Batch BN report.
```

**YOU DO:** Settings → Business Profile; save a field; confirm timeline updates.

**Next:** `Authorize M6 Batch BO`.

---

## Batch BO — Account Profile (Slice 8)

**Goal:** Account Profile page + footer Owner Profile live.

**Re-share screen:** **Account Profile** — **ask first**.

### Tasks

- [ ] `/settings/account` + footer `ownerProfile` live → same route
- [ ] Personal info edit; change password flow
- [ ] 2FA / sessions / notification toggles disabled with hints
- [ ] Activity timeline from known events
- [ ] i18n en + bn-BD; `smoke:m6bo`

### Exit check

- `smoke:m6bo` PASS

### Agent prompt

```text
Implement ONLY Batch BO from M6_SLICE_6_EXECUTION.md
(Account Profile). STOP and ask for Account Profile screenshot first.
When done, paste the short M6 Batch BO report.
```

**YOU DO:** Footer Owner Profile → account page; change password test.

**Next:** `Authorize M6 Batch BP`.

---

## Batch BP — Help & Support (Slice 8)

**Goal:** Help footer nav + Help & Support page.

**Re-share screen:** **Help & Support** — **ask first**.

### Tasks

- [ ] `nav.ts` help `live: true`, path `/help`
- [ ] Help Center / Contact Support / System Status cards
- [ ] FAQ accordion (static i18n)
- [ ] Recent Tickets static/disabled; Create Ticket disabled
- [ ] i18n en + bn-BD; `smoke:m6bp`

### Exit check

- `smoke:m6bp` PASS

### Agent prompt

```text
Implement ONLY Batch BP from M6_SLICE_6_EXECUTION.md
(Help & Support). STOP and ask for Help & Support screenshot first.
When done, paste the short M6 Batch BP report.
```

**YOU DO:** Help nav opens; FAQ expands; System Status shows live health.

**Next:** `Authorize M6 Batch BQ`.

---

## Batch BQ — Slice 8 exit

**Goal:** Catalog §28, `smoke:m6s8`, status/master/RBAC. M6 stays IN PROGRESS (AC–AD etc.).

**Re-share screen:** none.

### Tasks

- [ ] [`Completed_API_lists.md`](Completed_API_lists.md) **§28**
- [ ] Composed smoke for BM–BP + spot-check prior M6 smokes
- [ ] Status + master plan + RBAC synchronized
- [ ] This file BE–BQ checkboxes
- [ ] Do **not** start n8n / RLS / bi-di / Batch AC without authorization

### Agent prompt

```text
Implement ONLY Batch BQ from M6_SLICE_6_EXECUTION.md
(Slice 8 exit). Catalog §28, smoke:m6s8, status docs.
When done, paste the short M6 Batch BQ report.
```

**YOU DO:** Settings (hub + business + account) + Help walkthrough.

**Next after PASS:** Authorize deferred **Slice 2 AC**, or share next Owner screens for Slice 9+.

---

## Later backlog (do not build in Slices 6–8)

| Track | Item |
|-------|------|
| Deferred Slice 2 | AC Manifest Details + modals; AD Slice 2 exit |
| Reports | Inventory Report / Purchase Report detail pages |
| Audit desktop | Manager stock-count UI on desktop (APIs exist after BI) |
| Settings | Branch Management, User Roles editor, System Preferences, Security policy, Audit & Data export |
| Owner | Edit Customer, Edit Supplier, notifications, branch switch |
| M6 rest | Bi-di sync, n8n, Postgres RLS, Manager web |
| M7 | Multi-branch, Super Admin console |

---

## Fresh-chat command templates

**Schema/API batch (BE, BH, BI, BM):**

```text
@PROJECT_MASTER_PLAN.md @Current_Status.md @ROLES_AND_PERMISSIONS.md
@M6_SLICE_6_EXECUTION.md @Completed_API_lists.md

Authorize M6 Batch BE.
Implement ONLY that batch. One batch only.
When done, paste the short M6 Batch report.
```

**UI batch (BF, BJ, BK, BN, BO, BP):**

```text
@PROJECT_MASTER_PLAN.md @Current_Status.md @ROLES_AND_PERMISSIONS.md
@M6_SLICE_6_EXECUTION.md @Completed_API_lists.md

Authorize M6 Batch BF.
Implement ONLY that batch. One batch only.
Follow the re-share protocol — ask for the screen before any UI code.
When done, paste the short M6 Batch report.
```

---

## Change log

| Date | Change |
|------|--------|
| 2026-08-22 | **Slices 6–8 planned (BE–BQ not started).** New execution file split from `MILESTONE_6_EXECUTION.md`. Screens: Sales Report (scroll), Audit & FEFO, Audit Detail, Settings hub, Business Profile, Account Profile, Help & Support. Full StockAudit + FEFO violations (Slice 7). **Strict re-share gate:** agent must ask before UI; no silent prior upload. Next was `Authorize M6 Batch BE` after Slice 5 BD PASS. |
| 2026-08-22 | **M6 Batch BE completed:** OWNER-only `GET /api/v1/owner/reports/sales` + shared Zod response; range and optional tenant-scoped `storeId`; prior-period trend fields; `smoke:m6be` PASS. No Owner web UI; Sales View Report remains disabled. Next = `Authorize M6 Batch BF` (ask for Sales Report screenshot first). |
| 2026-08-22 | **M6 Batch BG / Slice 6 completed:** `Completed_API_lists.md` §26 added; composed `smoke:m6s6` registered and PASS; Slice 6 complete. Next was `Authorize M6 Batch BH`. |
| 2026-08-22 | **M6 Batch BH completed:** StockAudit + StockAuditLine + StockAuditActivityEvent + FefoViolationRecord Prisma schema/migration, shared Zod `audit.ts`, deterministic audit/FEFO seed. `prisma migrate deploy`, `prisma db seed`, and `smoke:m2` PASS. No routes/UI. Next was `Authorize M6 Batch BI`. |
| 2026-08-22 | **M6 Batch BI completed:** live audit/FEFO APIs plus sale ingest hook. OWNER routes: dashboard/list/detail/review/correct; OWNER/MANAGER routes: audit start/lines/submit; `smoke:m6bi` PASS. No Owner web audit UI. Next = `Authorize M6 Batch BJ` (ask for Audit & FEFO screen first). |
