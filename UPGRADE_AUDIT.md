# Harxel Business OS: Upgrade Audit (Phase 1)

Source inspected: `harxel-html/` (index.html, styles.css, js/app.js ~42 KB, js/data.js ~14 KB, assets/harxel-logo.jpg) plus the theme layer added in the previous pass (js/theme.js, css/theme.css, tests/theme.test.js).

## 1. Existing architecture
- Plain HTML/CSS/JS, no framework, no build step. Hash router (`#/route`), global `render()`, page functions in a `PAGES` object, actions in an `A` object dispatched via `data-act`.
- State: one `db` object in `localStorage` key `harxel-html-v1`. Deterministic seed (`rng(2026)`) so "Reset demo data" restores everything.
- UI is built with template strings and `innerHTML`; escaping via `esc()`. Charts are hand-drawn SVG lines (`drawCharts`). No external libraries apart from Google Fonts.
- Roles (`ROLES`) restrict visible routes only. This is frontend-only and is not a security boundary.

## 2. Existing pages (12)
Overview `/`, Notifications, Sales, CRM Pipeline, Customers, Products & Inventory, Purchases & Suppliers, Tasks, Employees, Finance, Reports, AI Assistant.

## 3. Existing actions that work against `db`
sale, receipt, product, stock, price, delete product, expense, delete expense, customer payment (`pay`), customer, lead (+move, delete), purchase order (+advance through Draft to Completed, pay supplier), supplier, task (+move, delete), notifications (read / read all), assistant `ask` (rule-based on local data), print, CSV export, role switch, sidebar collapse, reset.

## 4. Seed data today vs requested
| Entity | Now | V2 target |
|---|---|---|
| Products | 16 | ~50 |
| Customers | 12 | ~40 |
| Suppliers | 8 | 12 |
| Employees | 8 | 10 |
| Sales | 130 | 150 |
| Expenses | 72 | 80 |
| Purchase orders | 12 | 30 |
| Tasks / Leads | 12 / 10 | 30 |
| Invoices, quotations, payments, approvals | 0 (an invoice is a sale record with `ref` INV-xxxx, `paid`, `total`) | 25 / 15 / 50 / 10 |

## 5. Gaps (missing entirely)
Quotations; separate Invoice and Payment records (only `sale.paid` exists, so there are no per-payment references, no partial-payment history, no credit notes or refunds); share links and PDF; Customer 360; customer portal; cashbook, budgets, reconciliation, payables ledger; command centre; daily cash closing; attendance, leave, timesheets; approvals; document centre; business-health and profitability analysis; automations; branches/warehouses; industry modules; audit log; integrations layer; real authentication; any server or database.

## 6. Technical limitations of the prototype
1. No server: no real auth, no RLS, no secure share links, no customer isolation. These cannot be demonstrated honestly in a static page.
2. Payments are a field on the sale, so payment history, duplicate-payment protection and atomic multi-record updates have no model to attach to.
3. Business logic is mixed into render functions and not unit-testable.
4. `innerHTML` templating plus a single 42 KB file makes the large V2 scope hard to maintain.
5. Frontend-only roles, no audit trail.
6. Theme layer (previous pass) is new: ~10 hard-coded `#fff` values remain in styles.css; chart restyling not verified in a browser.

## 7. What must be preserved
Harxel logo (unaltered image), brand tokens (#C0391B etc.), fonts, grouped sidebar and line-icon set, the 12 working pages and their actions above, deterministic seed and reset, KES formatting, SVG line charts.

## 8. Recommended migration plan
Target: Next.js (App Router) + TypeScript + Supabase + Vercel.
1. **M0 Scaffold:** Next.js project, brand tokens as CSS variables (reuse theme.js palette logic as a TS module), port icon set, layout, sidebar and role-aware navigation.
2. **M1 Data layer:** Supabase migrations with `business_id` on every table, RLS policies, roles/permissions, audit-log triggers. TypeScript domain library (pure functions) for invoice totals, payment allocation, ageing, cashbook and closing maths, unit-tested first.
3. **M2 Port existing 12 pages** to the new data layer, with parity checked against this audit's section 3.
4. **M3 Invoices, payments, quotations:** `invoices`, `invoice_items`, `payments`, `payment_allocations`, `credit_notes` with a server-side RPC (single transaction) for recording payments. Share links use hashed tokens, and "Viewed" is set only on a real page open. PDF is generated server-side.
5. **M4 Customer 360 and portal:** a separate route group with its own auth and an ownership check by `customer_id`, and RLS tests proving cross-customer access is denied.
6. **M5 Finance centre, command centre, daily closing, approvals**, then employee workspace, documents, health/profitability, automations, industry modules.
7. **M6 Seed script** expanding to the V2 volumes with referential consistency, then Playwright and build checks, then deployment guide.
Integrations (Daraja, WhatsApp, email, eTIMS, n8n) are server-side adapters with a simulation adapter by default and a status of Not configured until credentials exist. No eTIMS compliance claim.
