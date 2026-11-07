# Harxel Business OS: premium UI, Command Centre and functionality upgrade

Business identity (Apex General Supplies Ltd.), navigation, page names and the Harxel accent are preserved.
Run: `python3 -m http.server 8080` then open `http://localhost:8080`. Tests: `npm install && npm test` (unit) and `python3 tests/e2e.py` (browser, needs Playwright + Chromium).

## What the inspection found
- Vanilla HTML/JS, hash router, one `localStorage` database, no build step. Kept as is (no new framework or runtime dependency).
- **Two parallel revenue systems.** `sales` and V2 `invoices` were never combined: the Overview, receivables and customer balances ignored invoices. Supplier payments had no dates, so cash flow and "upcoming payments" were impossible. Fixed by a single ledger (below).
- `npm test` failed on Node 22 (`node --test tests/` treats the folder as a module). Script fixed; all 14 original tests pass.
- Theme tokens already existed in `js/theme.js` (good). Fonts were two competing families; remaining hard-coded whites were removed.
- The original seed produced a loss-making 30 days with 4 orders and a spiky chart. The seed was rebalanced (see data section).

## Architecture added
| File | Role |
|---|---|
| `js/ledger.js` | Single source of truth for every financial figure (pure, tested). Revenue (accrual, excl. VAT), cash movements, receivables, payables, upcoming, sales-by, transactions, approvals. |
| `js/domain.js` | Every workflow as a validated function: sale, payments, voids, purchase orders, receiving stock, approvals, invoices (create/edit), CRUD. Maps 1:1 to future server transactions. |
| `js/insights.js` | Daily summary, Business Health, rule-based insights, Action Centre. Deterministic, no external AI. |
| `js/v3-data.js` | Idempotent migration: payment records, due dates, multi-line POs, salesperson, expense approval status, activity log. Old saved data upgrades in place. |
| `js/ui.js` | Modal and side drawer, one form/validation engine, confirm dialog, Ctrl/Cmd+K palette, monotone spline maths. |
| `js/dash.js`, `js/forms.js` | Command Centre, Action Centre, Transactions; forms and upgraded list pages. |
| `css/system.css`, `assets/fonts/` | Design system. Inter is bundled locally (works offline). |

Financial rules (also what the dashboard shows): revenue is excl. VAT; draft/cancelled invoices, voided sales and opening balances are never revenue; COGS comes from items sold, never from purchase orders; pending/rejected expenses do not count until approved; each open document appears once in receivables/upcoming, and overdue items are never also "upcoming".

## What was delivered
**Visual foundation:** Inter everywhere (tabular numerals for money); extended semantic tokens in `theme.js` (elevated, glass, hover/active/focus/disabled, shadows, chart colours, info); light/dark both audited; glass only on modals, drawers, palette, brief panel; responsive layouts with mobile card-style tables.
**Command Centre (all 10 + Action Centre):** daily summary, spline revenue/expenses/profit chart (daily/weekly/monthly, previous-period compare, legend toggles, exact tooltips, click-through to the transactions of that period), outstanding/overdue invoices, low stock, pending approvals with working Approve/Reject (role-checked), employee activity, sales performance (people/products/weeks), upcoming payments (in vs out), Business Health, insights, Action Centre. Every widget opens a real record or filtered list.
**Business Health (0-100):** cash flow 20%, receivables 20%, revenue 20%, expense trend 15%, inventory 15%, sales (gross margin vs 30% target) 10%. Each has a status (Healthy >= 80, Good 65-79, Needs attention 45-64, Critical < 45) and its rule is shown on tap. Labelled as a guide, not a certified rating.
**Forms:** Add/Edit customer, supplier, product, expense, task; record payment (sales, invoices, suppliers); New sale and Create purchase order as side drawers with multi-line items, live totals and tax; invoice builder now validated by the domain layer, editable before payment, with a credit-limit check. Inline validation, no data loss on error, loading state, double-submit protection, Esc/focus-trap, mobile bottom-sheet.
**Quick Actions:** header button and Ctrl/Cmd+K: add customer/supplier, create invoice, create PO, new sale, record expense/payment, add task, search records. They open the real forms.
**Connected workflows (tested):** sale -> stock, invoice number, customer balance, ledger, dashboard; invoice payment -> invoice status, customer balance, cash; PO -> approve -> receive (stock) -> pay supplier -> complete; payment requests; void sale restores stock.
**Demo reset:** confirmation that states changes will be discarded; theme kept unless ticked.

## Testing performed
- `npm test`: 30 tests pass (14 original, updated only for the new loader and credit-limit seed; 16 new covering ledger reconciliation, workflows, validation, approvals/roles, health determinism, action de-duplication, chart sums, spline shape, migration).
- `python3 tests/e2e.py`: 65 browser checks pass in Chromium: all 18 routes x 3 viewports (1366/820/390) x 2 themes render with no NaN/undefined, no horizontal overflow and no console errors; theme switch and persistence; no white surfaces in dark; contrast of key pages >= 3:1; chart spline, tooltip, compare, legend, click-through; approve/reject; role gating; Ctrl+K; every form's validation and double-click safety; sale, payment, PO, invoice, expense workflows against the database; reset.
- No bundler exists, so there is no build step; the app loads statically with zero errors.

## Known limitations (please read)
- **No "Yearly" chart filter and no previous-period compare on the monthly view:** the dataset spans 12 months, so those would be fabricated.
- **No sales-by-branch or branch insights:** the business data has no branch concept; not invented.
- The invoice and quotation builder stays a full page (it is the most complex form); it uses the new tokens and domain validation but not the modal engine. Quotations have no Edit button yet. Supplier payment requests exist as seeded approvals; there is no screen to raise a new one.
- Contrast was checked automatically at 3:1 on key pages, not a full WCAG AA audit. I reviewed screenshots of the Overview, forms, drawer, palette, Finance and mobile; not every page was inspected by eye.
- Notifications badge is high (about 38) because every overdue document produces a notice.
- Seed figures are relative to today's date, so numbers shift daily but stay internally consistent.

## Still mock / demo only
localStorage is a single-browser demo store, not a multi-user database. M-Pesa, email/WhatsApp sending, reminders, the customer portal and payment links are simulated and labelled as such. "AI" insights and the assistant are rule-based.
