System Architecture & Technical Specification
Document Details
Project Name: Pharmacy POS & Multi-Tenant Inventory SaaS

Document Version: 1.0.0

Document Type: System Architecture & Data Flow Specification

Target Audience: Core Engineering Team, DevOps, Backend Developers

1. High-Level Architecture Overview
The system utilizes a Hybrid Offline-First Distributed Architecture. The desktop application acts as an independent execution node at each local cashier counter, while a multi-tenant cloud backend acts as the central system of record for inventory, reporting, and automation.

+-----------------------------------------------------------------------+
|                         LOCAL CASHIER NODE                            |
|                                                                       |
|  +------------------+     +-------------------+     +--------------+  |
|  | React + Tailwind | <-> | Tauri Rust Bridge | <-> | Local SQLite |  |
|  | (UI Layer)       |     | (IPC Layer)       |     | (Local DB)   |  |
|  +------------------+     +-------------------+     +--------------+  |
+-------------------------------------+---------------------------------+
                                      |
                       Bi-Directional Sync Queue (HTTP/WebSockets)
                                      |
+-------------------------------------v---------------------------------+
|                         CLOUD PLATFORM SYSTEM                         |
|                                                                       |
|  +------------------+     +-------------------+     +--------------+  |
|  | Node.js / Express| <-> | Prisma ORM Engine | <-> | PostgreSQL   |  |
|  | (Cloud API)      |     |                   |     | (Multi-Tenant)|  |
|  +------------------+     +-------------------+     +--------------+  |
|            |                                                           |
|            v                                                           |
|  +------------------+                                                  |
|  | n8n Workflows    | ---> [WhatsApp API / SMS Gateway / Email]        |
|  +------------------+                                                  |
+-----------------------------------------------------------------------+


2. Component Breakdown
2.1 Desktop Client (Local Cashier Counter)
Framework: Tauri (Rust runtime) wrapper hosting a React + TypeScript frontend.

Storage: Local SQLite Database running natively on the cashier's computer.

Responsibility: Executes search, cart updates, invoice generation, discount applications, and receipt printing without requiring active internet connectivity.

2.2 Cloud API Engine & Multi-Tenancy
Runtime: Node.js (TypeScript) with Express/Fastify.

ORM: Prisma ORM.

Database: PostgreSQL.

Multi-Tenant Isolation Strategy: Schema-per-Tenant or Isolated Tenant Tables with enforced tenant_id Row-Level Security (RLS) filters.

Every tenant receives a isolated logical boundary.

Every database query in the Cloud API automatically appends WHERE tenant_id = :tenant_id.

2.3 Async Automation Engine (n8n Integration)
Engine: Self-hosted n8n Workflow Instance.

Trigger Mechanism: Cloud Node.js API emits webhooks or writes events to a queue (Redis / RabbitMQ).

n8n Responsibilities:

Sending WhatsApp/SMS customer refill reminders.

Formatting and emailing purchase orders to suppliers.

Generating weekly AI executive summaries via LLM API nodes and sending them to pharmacy owners.

3. Offline Synchronization Protocol (Local SQLite ↔ Cloud Postgres)
To handle unreliable internet connections without creating duplicate data or losing sales, the sync engine operates on an Event-Sourced Queue with Vector Timestamps.

3.1 Sync Engine Mechanics
Local Writes (Offline):

When an invoice is finalized offline, it is written to the local SQLite sales table with synced = false.

An entry is added to a local outbound_sync_queue table:

{
  "event_id": "uuid-v4",
  "entity": "sale_invoice",
  "action": "CREATE",
  "payload": { ... },
  "created_at": "2026-08-07T16:00:00Z"
}


Network Detection & Pushing:

A background worker in Tauri ping-tests the Cloud API every 15 seconds.

Upon connection restoration, the queue processes events in Strict Chronological Sequence (FIFO) via HTTPS POST batches.

Conflict Resolution Strategy:

Sales/Transactions: Append-Only Rule. Sales transactions are immutable. They never overwrite existing records; they only append.

Stock Quantity Conflicts: Delta-Based Adjustment. Instead of syncing absolute stock count (e.g., stock = 10), local nodes push stock deltas (e.g., stock_change = -2). The Cloud DB applies the subtraction relative to its state.

4. Phase-Wise Engineering Execution Plan
To execute this architecture efficiently, development is split into 3 distinct engineering milestones:

Milestone / Phase 1: MVP & Core Cashier POS (Immediate Scope)
Focus: Build a stable, fast, offline-capable single-store checkout system.

Deliverables:

Tauri + React Desktop App setup with basic Local SQLite storage.

Core POS UI: Keyboard shortcuts, drug search, cart, receipt printing.

Basic Inventory & Batch Management (FEFO auto-selection).

Node.js + Prisma + Postgres Cloud Backend (Single Tenant API).

One-way sync queue: Local Sales → Cloud DB.

Milestone / Phase 2: Growth, Automation & Customer Retention
Focus: Differentiate the product with automation, credit ledgers, and loyalty.

Deliverables:

Full bi-directional sync (Cloud inventory updates → Local SQLite).

Customer Loyalty Points System & Customer Credit (Baki) Ledger.

n8n Workflow Infrastructure Setup:

WhatsApp / SMS Refill Reminder integration.

Supplier Purchase Order generation and auto-dispatch.

Supplier Return Bucket (Automated Expiry alerts 90 days prior).

Advanced Analytics Dashboard for Store Owners.

Milestone / Phase 3: Multi-Branch & Enterprise Scale
Focus: Support multi-location chain stores and enterprise integrations.

Deliverables:

Multi-Branch schema support (store_id isolation under 1 owner).

Inter-Branch Stock Transfer workflows.

Advanced AI forecasting for stock replenishment.

Enterprise Role-Based Access Control (RBAC) fine-tuning.






