# `@r2a/desktop` — PharmaSync POS (Tauri)

Offline-first pharmacy POS shell (Milestone 3).

## Print + Receipt Preview (Batch Y / AA)

Sale Completed shows the settlement card on the left and an **inline Receipt
Preview** on the right. Print stub auto-starts in parallel (same
`ReceiptPrintModel` will feed future Tauri IPC).

- Stub: `src/lib/printStub.ts`
- Model: `src/lib/receiptModel.ts` (dynamic lines; stub pharmacy header)
- Preview: `ReceiptPreviewPanel` beside Sale Completed (80mm / 58mm)
- QA fail path: `armPrintStubFailOnce()` / `__r2aArmPrintFailOnce()`

### TODO(real printer IPC)

Replace the stub with a Tauri command using the same `ReceiptPrintModel`
shown in the right-side preview. Pharmacy header is hardcoded until Settings.

## Card Payment stub (Batch AB / AC)

Payment → Card opens a terminal-assisted stub (no hardware SDK):

`not_started → processing → approved | declined`
`processing → cancelling → declined` · Retry → `not_started`

- Stub: `src/lib/cardPaymentStub.ts`
- UI: `CardPaymentModal`
- Approved → ingest `CARD` → Sale Completed Card Settlement
- QA decline: `__r2aArmCardDeclineOnce()` before Start

### TODO(real card terminal SDK)

Replace `runCardTerminalStub` / `runCardCancelStub` with a Tauri bridge to
the physical terminal.

## MFS Payment (Batch AD)

Payment → MFS opens provider select (**bKash / Nagad / Rocket**), then an
**invented** confirm (payer mobile + optional Trx ID) → processing stub →
Sale Completed MFS settlement (or fail / retry).

- Stub: `src/lib/mfsPaymentStub.ts`
- UI: `MfsPaymentModal` (confirm/fail invented until design replaces)
- Success → ingest `MFS` (+ provider/payer/trx in notes)
- QA fail: `__r2aArmMfsFailOnce()` before Confirm

### TODO(real MFS APIs)

Replace invented confirm/result with **backend-driven** flow:
provider API / webhook → server confirms txn status → desktop shows
real success/fail only. Cashier must **not** manually enter Trx IDs.
