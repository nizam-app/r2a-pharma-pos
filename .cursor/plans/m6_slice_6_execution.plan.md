---
name: M6 Slice 6 Execution
overview: Owner web Slices 6–8 (Sales Report, full StockAudit + FEFO, Settings/Help/Owner Profile) in M6_SLICE_6_EXECUTION.md batches BE–BQ. Strict re-share gate for all UI batches.
todos:
  - id: slice6-be-bg
    content: "Slice 6: BE API, BF Sales Report UI (ask re-share), BG exit §26"
    status: pending
  - id: slice7-bh-bl
    content: "Slice 7: BH schema, BI APIs, BJ/BK UI (ask re-share), BL exit §27"
    status: pending
  - id: slice8-bm-bq
    content: "Slice 8: BM APIs, BN/BO/BP UI (ask re-share), BQ exit §28"
    status: pending
isProject: false
---

# M6 Slices 6–8 — Authorized plan

**Execution file (use this in fresh chats):** [`M6_SLICE_6_EXECUTION.md`](../M6_SLICE_6_EXECUTION.md)

**Parent (Slices 1–5 only):** [`MILESTONE_6_EXECUTION.md`](../MILESTONE_6_EXECUTION.md)

## Re-share gate (user lock)

UI batches **must not** silently use prior uploads. Agent **asks and stops** until user replies:

- re-share screenshot(s), or
- `use prior upload`, or
- `invent to match theme`

## Slices

| Slice | Batches | Screens |
|-------|---------|---------|
| 6 Sales Report | BE–BG | Sales Report (scroll = one page) |
| 7 Audit & FEFO | BH–BL | Audit dashboard, Audit Detail, Review modal (invent if authorized) |
| 8 Settings + Help | BM–BQ | Settings hub, Business Profile, Account Profile, Help & Support |

## Gate

`Authorize M6 Batch BE` — after Slice 5 BD PASS.
