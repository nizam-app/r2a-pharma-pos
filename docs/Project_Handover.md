Project Handover & Cursor AI Agent Context Contract
Document Details
Project Name: Multi-Tenant Pharmacy POS & Inventory SaaS

Document Version: 1.0.0

Document Type: Project Handover & AI Agent Context Instructions

Target Consumer: Cursor AI Agent / Lead Full-Stack Engineer

1. Executive Summary & Goal
You are acting as a Staff Software (SaaS) Engineer building a production-grade, multi-tenant Pharmacy Point of Sale (POS) and Inventory SaaS. The primary goal is to build a high-performance, offline-first application that handles local pharmacy sales in Bangladesh/emerging markets, featuring batch-wise expiry tracking (FEFO), loyalty points, n8n automation, and sub-50ms checkout speeds.

2. Tech Stack Blueprint
Plaintext
+-----------------------------------------------------------------------+
|                              TECH STACK                               |
+-----------------------------------------------------------------------+
| Monorepo Tooling   | Turborepo + npm workspaces                       |
| Desktop Runtime    | Tauri (Rust runtime + native WebView2)            |
| Web / Frontend UI  | React.js, TypeScript, Tailwind CSS, Shadcn UI    |
| Cloud Backend      | Node.js (TypeScript), Express           |
| Database Layer     | Prisma ORM, PostgreSQL (Cloud), SQLite (Desktop)  |
| Automation Engine  | Self-hosted n8n Workflows + Webhooks             |
| UI Icons / Design  | Lucide React, High-density clinical layout        |
+-----------------------------------------------------------------------+

4. Multi-Tenant & Database Strategy
Multi-Tenancy Isolation:

PostgreSQL acts as the Cloud System of Record.

Enforce tenant isolation via tenant_id column indexes and Row Level Security (RLS) policies on every domain table (users, products, batches, sales, customers).

Every incoming Cloud API request MUST extract tenant_id from the authenticated JWT context.

Offline Local SQLite Storage (Desktop Client):

The Tauri cashier client connects locally to SQLite (pos_local.db).

When internet connection drops, the React desktop app seamlessly switches to writing transactions to SQLite.

outbound_sync_queue table tracks unsynced sales locally:

SQL
CREATE TABLE outbound_sync_queue (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  action TEXT NOT NULL,
  payload TEXT NOT NULL, -- JSON string
  synced INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
Conflict-Free Synchronization Rules:

Sales/Invoices: Append-Only Rule. Sales are immutable once created.

Stock Quantities: Delta Syncing. Pushes stock adjustments (e.g., quantity_change: -2) rather than absolute counts to avoid race conditions.

5. Non-Negotiable Business Logic Rules
When generating code, Cursor MUST follow these strict business rules:

FEFO (First Expired, First Out) Auto-Selection:

When a cashier adds a medicine (e.g., Napa 500mg) to the cart, the system must automatically pick the batch with the nearest expiration date that has stock > 0 **and is not expired**. Expired lots may appear in the batch picker for visibility but must not be sellable. Search results should surface the sellable FEFO lot on the product card (not an expired lot “in front” when sellable stock exists).

Multi-Unit Pricing Logic:

A product can be sold as Box, Strip, or Individual Tablet/Piece.

Example: 1 Box = 10 Strips = 100 Tablets.

Database stores base quantities in the lowest unit (e.g., total tablets). Billing dynamically calculates fractional conversions.

Keyboard-First Shortcuts (POS Counter):

POS UI must be 100% operable without a mouse.

Binding Map: Ctrl + K (Focus Search), F2 (New Bill), F4 (Generic Substitution Modal), Enter (Submit & Print Thermal Invoice).

Role-Based Access Control (RBAC):

Cashier Role: BLOCKED from viewing profit margins, editing product base prices, deleting sales records, or accessing admin reports.

Owner Role: Full access to cloud reports, n8n automation settings, and financial analytics.

6. Execution Roadmap for Cursor Agent
Cursor AI Agent should build this system in sequential execution steps:

Step 1: Monorepo & Database Foundation (Immediate)
Initialize Turborepo structure with apps/desktop, apps/server, and packages/database.

Generate the full schema.prisma file incorporating Tenant, User, Store, Product, Batch, Customer, Sale, and SaleItem entities.

Step 2: Cloud API Core (apps/server)
Set up Express/Fastify API with TypeScript and Prisma Client.

Implement Auth JWT middleware with embedded tenant_id context.

Create CRUD endpoints for Inventory, Batches, Generic Substitutes, and Sales Ingest.

Step 3: Desktop POS Shell (apps/desktop)
Bootstrap React + Vite + Tailwind CSS + Shadcn UI wrapped with Tauri.

Build the 3-panel POS layout defined in UI_UX_SPEC.md (Ctrl+K search, cart, payment panel).

Integrate SQLite local driver via Tauri IPC for offline state handling.

Step 4: Sync & Automation Layer
Build background sync worker in Tauri (pings API every 15s to flush outbound_sync_queue).

Create webhook emission hooks in the Cloud API to connect with self-hosted n8n for WhatsApp/SMS refill alerts.