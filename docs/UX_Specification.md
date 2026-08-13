UI/UX Specification & AI Wireframe Prompts
Document Details
Project Name: Pharmacy POS & Multi-Tenant Inventory SaaS

Document Version: 1.0.0

Document Type: UI/UX Specification & AI Generation Contract

Target Audience: Frontend Developers, UI/UX Designers, Product Managers

1. Design System & Style Guidelines
1.1 Color Palette & Typography
Design Philosophy: Clean, high-density, high-contrast, medical/clinical feel. Optimized for reduced eye-strain during 10+ hour cashier shifts.

Primary Color: Medical Emerald/Teal (#0D9488 / Tailwind Teal-600) — Represents trust and health.

Accent Color: Deep Indigo (#4F46E5 / Tailwind Indigo-600) — Primary action buttons, cart submit.

Background Color: Light Slate Neutral (#F8FAFC / Tailwind Slate-50) — Clean background.

Dark Mode Base: Slate-900 (#0F172A) — For night shifts.

Typography: Inter or Plus Jakarta Sans — Crisp sans-serif fonts for numerical legibility.

1.2 Layout Principles
High Information Density: Minimal whitespace; cashiers need to view full cart metrics without scrolling.

Keyboard-First Focus: Clear visual focus rings (ring-2 ring-indigo-500) indicating active text inputs for zero-mouse operations.

Status Indicators: Color-coded badges for batch expiry:

Red Badge (#EF4444): Expires within 30 days.

Yellow Badge (#F59E0B): Expires within 90 days.

Green Badge (#10B981): Good stock (90+ days).



2. Global Keyboard Shortcut Mapping
Shortcut
Action
Scope
Ctrl + K or /
Focus Global Drug Search Bar
Main POS Screen
F2
Open New Checkout Session
Main POS Screen
F4
Open Generic Alternative Modal
Active Item / Cart
F8
Select Customer / Loyalty Input
Right Sidebar
F10 or Enter
Complete Sale & Print Receipt
Checkout Panel
Esc
Clear Cart / Cancel Modal
Global



3. Screen Layout Breakdown
3.1 Screen 1: Primary POS Counter (The Core Cashier Interface)
Split into 3 distinct functional zones:

HEADER: Pharmacy Name | Shift Status | Offline/Online Sync Badge | Quick Help    |
+------------------------------------------+----------------------------------------+
| LEFT PANEL (40% Width)                   | RIGHT PANEL (60% Width)                |
|                                          |                                        |
| 1. [Search Bar: Name/Barcode/Generic]    | ACTIVE CART TABLE                      |
|                                          | Item | Unit | Batch | Qty | Price | Total  |
| 2. SEARCH RESULTS LIST                   | -------------------------------------- |
|    - Product Card 1 (In Stock, FEFO)     | Napa 500mg (Box) [B-102]   2  $10   $20   |
|    - Product Card 2 (Low Stock, Alt BTN) | Seclo 20mg (Pcs) [B-88]   10  $2    $20   |
|                                          |                                        |
| 3. GENERIC ALTERNATIVE CARD (Collapsible)| -------------------------------------- |
|                                          | BILL SUMMARY & CHECKOUT                |
|                                          | Subtotal: $40.00                       |
|                                          | Discount: [ Input ]                    |
|                                          | Loyalty Points: [ Redeem 10 pts (-$1) ]|
|                                          | Payment: [ Cash | MFS | Baki ]        |
|                                          |                                        |
|                                          | [ BIG BUTTON: COMPLETE & PRINT (Enter) ]|
+------------------------------------------+----------------------------------------+



