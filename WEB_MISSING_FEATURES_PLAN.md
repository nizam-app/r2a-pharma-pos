# Owner Web Missing Features Plan

Status: APPROVED — W1–W6 DONE; M6 Batch N is eligible for separate authorization
Execution order: Complete W1–W6 before resuming M6 Batch N
Scope: Edit Product, batch corrections, stock adjustment, void/retire
Out of scope: hard batch deletion, sale void, Supplier/PO, offline GRN

## 1. Web Architecture

### Routes

| Screen | Route |
|---|---|
| Product Details | `/inventory/:productId` |
| Edit Product | `/inventory/:productId/edit` |
| Receive Stock | `/inventory/:productId/receive` |
| Manage Batch | `/inventory/:productId/batches/:batchId` |

Update `apps/web/src/lib/ownerPath.ts` in this order:

1. `/inventory/expiry`
2. `/inventory/new`
3. `/:productId/edit`
4. `/:productId/receive`
5. `/:productId/batches/:batchId`
6. `/:productId`

`AppShell.tsx` renders `EditProductPage` and `BatchManagementPage`.

### Product Details Changes

- Enable Edit Product.
- Add an Actions column to Batch Inventory.
- Each batch gets a Manage action.
- Show ACTIVE, RETIRED, or VOIDED lifecycle status.
- Do not show a hard-delete action.

## 2. Product Edit

### API

Reuse:

`PATCH /api/v1/products/:id`

No new product mutation endpoint is required.

Add web helper:

`updateOwnerProduct(productId, payload)`

### Form

Extract a reusable product form from `AddProductPage.tsx`.

Editable fields:

- name
- genericName
- manufacturer
- strength
- dosage form
- SKU
- barcode
- category
- description
- requiresPrescription
- coldChain
- storageNotes
- reorderLevel
- isActive
- Piece/Strip/Box hierarchy and factors

Rules:

- Exactly one PIECE unit.
- PIECE `factorToBase` must equal 1.
- Unit types must be unique.
- BOX factor must be compatible with STRIP when both exist.
- Unit changes require a warning because they affect future checkout conversions.
- Product prices are not edited here; prices remain batch-level.
- Blank nullable fields are sent as `null`.
- Cancel returns to Product Details.
- Successful PATCH returns to Product Details and refetches live data.
- Add unsaved-change protection.

## 3. Batch Management

### Read API

Add:

`GET /api/v1/owner/batches/:id`

OWNER-only response:

- product context
- batch metadata and prices
- quantityOnHand
- lifecycle status
- version
- sale reference count
- `canVoid`
- recent adjustments and corrections

### Metadata and Price Correction

Add:

`POST /api/v1/batches/:id/corrections`

Body:

- `operationId`
- `expectedVersion`
- `reason`
- optional `batchNumber`
- optional `expiryDate`
- optional `costPerBase`
- optional `sellPerBase`

Behavior:

- JWT tenant/store scope only.
- OWNER/MANAGER API authorization.
- At least one correction field.
- Optimistic version check.
- Duplicate operation is idempotent.
- Duplicate batch number returns 409.
- Write an append-only correction revision.
- Never modify historical sale snapshots.

### Stock Adjustment

Add:

`POST /api/v1/batches/:id/adjustments`

Body:

- `eventId`
- `expectedVersion`
- signed `quantityChange`
- `reasonCode`
- optional `note`

Behavior:

- Apply signed delta atomically.
- Reject zero delta.
- Reject resulting quantity below zero.
- Increment batch version.
- Append one InventoryEvent.
- Store resulting quantity.
- Return 409 for stale versions or insufficient stock.
- Idempotent by `eventId`.

Do not use absolute stock overwrite in the new web UI.

## 4. Batch Lifecycle

### Void

Add:

`POST /api/v1/batches/:id/void`

OWNER-only.

Rules:

- Requires `operationId`, `expectedVersion`, and reason.
- Allowed only when no SaleItem references the batch.
- Atomically reduce remaining quantity to zero.
- Write compensating ADJUST event.
- Mark status VOIDED.
- Write correction revision.
- Preserve the batch row and RECEIVE history.

### Retire

Add:

`POST /api/v1/batches/:id/retire`

OWNER-only.

Rules:

- Used when the batch has sale/history references.
- Atomically remove remaining available stock.
- Mark status RETIRED.
- Preserve sales and inventory history.
- Retired batches are excluded from FEFO and POS batch lists.

### Explicitly Forbidden

Do not add:

`DELETE /api/v1/batches/:id`

## 5. Schema Changes

### Batch

Add:

- `status BatchStatus @default(ACTIVE)`
- `version Int @default(0)`

Enum:

- `ACTIVE`
- `RETIRED`
- `VOIDED`

### SaleItem Snapshots

Add and backfill:

- `productNameAtSale`
- `productGenericNameAtSale`
- `batchNumberAtSale`
- `expiryDateAtSale`

Sale ingest fills these from trusted Product and Batch rows.

Sales list/detail reads snapshots so later product or batch corrections do not rewrite historical transactions.

### InventoryEvent

Add:

- optional unique `eventId`
- optional `reasonCode`
- optional `quantityAfter`

Change Batch relation to `onDelete: Restrict`.

### BatchRevision

Add append-only model:

- id
- tenantId
- storeId
- batchId
- actorUserId
- operationId unique
- action
- reason
- before JSON
- after JSON
- createdAt

Actions:

- METADATA_CORRECTION
- PRICE_CORRECTION
- VOID
- RETIRE

### Database Constraints

Add checks for:

- `quantityOnHand >= 0`
- `costPerBase >= 0`
- `sellPerBase >= 0`
- `version >= 0`

## 6. Web State

### EditProductPage

Local state:

- loaded product
- editable form model
- original form model
- dirty flag
- loading/submitting/error state
- unit-change warning state

Locale changes must not reset the form.

### BatchManagementPage

Local state:

- product and batch context
- current version
- correction form
- signed adjustment form
- reason/note
- void/retire confirmation
- loading/submitting/error state

After successful mutation:

- update returned version
- refetch batch context
- refetch Product Details after navigation

On 409:

- show localized stale-data copy
- reload current server values
- do not retry mutation automatically

## 7. Execution Batches

### W1 — Data Integrity Foundation

- [x] Add Prisma lifecycle/version/revision fields.
- [x] Add SaleItem product/batch snapshots.
- [x] Extend InventoryEvent.
- [x] Backfill existing SaleItems.
- [x] Update ingest to populate snapshots.
- [x] Update sale serializers to read snapshots.
- [x] Add database constraints.
- [x] No web UI.

Exit:

- Existing sales still load.
- Product/batch edits cannot rewrite historical display.
- Prisma migration and server build pass.

### W2 — Edit Product

- [x] Extract reusable ProductForm.
- [x] Add `/inventory/:productId/edit`.
- [x] Add `updateOwnerProduct`.
- [x] Enable Product Details button.
- [x] Prefill and PATCH catalog fields and units.
- [x] Add en and bn-BD localization.
- [x] Invent UI from Add Product/Product Details visual language.

Exit:

- Product edits persist.
- Unit hierarchy updates safely.
- Historical sale display remains unchanged.

### W3 — Batch Correction and Adjustment APIs

- [x] Add owner batch detail endpoint.
- [x] Add corrections endpoint.
- [x] Add signed adjustments endpoint.
- [x] Add version/idempotency enforcement.
- [x] Add revision/event writes.
- [x] Extend owner product batch payload with status/version.

Exit:

- Wrong price can be corrected with reason.
- Concurrent sale/adjustment cannot overwrite stock.
- Cashier gets 403.
- Cross-tenant access returns 404.

### W4 — Void and Retire APIs

- [x] Add void endpoint.
- [x] Add retire endpoint.
- [x] Exclude non-ACTIVE batches from FEFO/POS lists.
- [x] Reject explicit sale ingest against retired/voided batches.
- [x] Add compensating inventory events.

Exit:

- Never-sold batch can be voided.
- Sold batch cannot be voided.
- Sold batch can be retired.
- No DELETE route exists.

### W5 — Batch Management Web UI

- [x] Add `/inventory/:productId/batches/:batchId`.
- [x] Add Manage action to batch rows.
- [x] Build metadata/price correction form.
- [x] Build signed stock-adjustment form.
- [x] Build void/retire confirmations.
- [x] Add correction history.
- [x] Add en and bn-BD localization.
- [x] Invent UI from Product Details/Receive Stock visual language.

Exit:

- Owner can correct the newly entered wrong price.
- Owner sees projected quantity/value before confirmation.
- Stale-version conflict refreshes safely.

### W6 — Desktop Compatibility and Exit

- [x] Move desktop absolute quantity adjustment to signed adjustment API.
- [x] Require adjustment reason.
- [x] Keep operation online-only.
- [x] Refresh catalog after success.
- [x] Remove quantity mutation from general batch PATCH after desktop migration.
- [x] Update smokes, API catalog, RBAC, status, and milestone plans.
- [x] Resume M6 Batch N only after W1–W6 PASS.

## 8. Required Tests

- Product PATCH Owner success and Cashier 403.
- Product/unit duplicate and hierarchy validation.
- Product edit does not change historical sale names.
- Batch correction does not change historical batch number/expiry.
- Historical `costPerBaseAtSale` and `unitPrice` remain unchanged.
- Correction reason and actor are recorded.
- Positive/negative adjustments are atomic.
- Concurrent sale and adjustment produce the correct final stock.
- Duplicate adjustment event is idempotent.
- Stale version returns 409.
- Void fails when a SaleItem exists.
- Retire preserves SaleItems and InventoryEvents.
- Retired/voided batches are excluded from FEFO.
- Offline queued sale against retired batch receives actionable 409.
- No hard-delete endpoint exists.
- All new UI strings exist in en and bn-BD.

## 9. Progress Log

| Date | Batch | Result |
|---|---|---|
| 2026-08-18 | W1 | DONE — migration deployed; sale snapshots + Batch lifecycle/version/revision foundation + InventoryEvent result metadata; `smoke:web-w1`, `smoke:m6d`, and `smoke:m6e` PASS |
| 2026-08-18 | W2 | DONE — shared Add/Edit Product form; live `/inventory/:productId/edit`; PATCH catalog/active/unit hierarchy; localized in-app unsaved-changes modal; historical snapshot regression; `smoke:web-w2` + live `smoke:m6l` PASS |
| 2026-08-18 | W3 | DONE — OWNER batch-management detail; audited/idempotent corrections; signed atomic/idempotent adjustments; version conflicts + negative-stock protection; concurrent sale/adjustment verified; `smoke:web-w3` 15/15 PASS |
| 2026-08-18 | W4 | DONE — OWNER-only idempotent void/retire transitions; sold-batch void guard; atomic stock removal + revisions/compensating events; ACTIVE-only FEFO/POS lists; actionable online/offline sale rejection; `smoke:web-w4` 19/19 PASS |
| 2026-08-18 | W5 | DONE — live localized Batch Management route; Product Details lifecycle badges + Manage actions; correction/adjustment forms with projected quantity/value; void/retire modals; audit history; route-isolated state + conflict refetch locks; responsive mobile drawer/modal; `smoke:web-w5` PASS |
| 2026-08-18 | W6 | DONE — desktop signed/versioned/idempotent online adjustment with required reason, projected stock, 409 reload, refresh-failure lock/retry, and authoritative catalog refresh; absolute quantity PATCH removed; API/RBAC/status/milestone docs updated; server `smoke:web-w6` 12/12 + desktop `smoke:web-w6` PASS |
