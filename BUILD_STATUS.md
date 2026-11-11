# BUILD_STATUS (HTML prototype, 2026-11-11)

Demo business: Apex General Supplies Ltd, Nairobi, KES (unchanged). Frontend only: data lives in the browser (localStorage); there is no backend.

## Completed in this pass
- Inter used everywhere (`--font` token); light/dark tokens cleaned of hardcoded colours; restrained glass on top bar, sidebar, modals, popovers.
- One dashboard: the Overview is now the Command Centre (the separate `/command` page and its navigation entry were removed; `#/command` redirects to `#/`). Sections: KPIs with previous-period comparison, revenue vs expenses and profit trend (smooth area charts), outstanding invoices and expected payments, inventory alerts, pending approvals (purchase orders in "Submitted"), employee activity and workload, sales performance, business health (rule-based, five checks, no score), daily insights (rule-based, labelled as such), Action Centre. Filters: Today, 7, 30, 90 days, 6 and 12 months.
- Invoice and quotation sharing: completion dialog after saving, plus a "Share / PDF" button on each document. Preview, Download PDF (real PDF built in `js/pdf.js`, no library), WhatsApp and Email with validated Kenyan number / email, native share sheet where the browser can share files, otherwise PDF download plus instructions. Nothing is ever reported as sent.
- Employees: searchable directory (department, status filters) and a profile page `#/employee/<id>` with employment info, current work, performance, workload, activity; edit, add, assign task, change status (owner/administrator only).
- Customers, suppliers and products have detail pages. Supplier: contact fields, products supplied, balance owed, purchase orders.
- Purchase orders support multiple lines, drafts can be edited/deleted, approval needs an approver role, receiving adds stock per line, supplier payments can be partial.
- Floating forms (modal on desktop, bottom sheet on phones): customer, supplier, product, stock adjustment, sale, expense, payment, lead, task, employee, purchase order. Validation, inline errors, double-submit protection, confirmation dialogs for deletes.
- Quick actions: Ctrl/Cmd+K or the top-bar button, filtered by role.
- Seed data made more connected (employee IDs/emails, richer tasks, multi-line POs, sales for today, invoices counted in revenue, receivables and customer balances). Demo reset restores it.

## Decisions and limits
- Invoice and quotation builder stays a dedicated page (multi-line documents); the completion and share steps are floating.
- Invoices now count in revenue, cash received and receivables; the earlier model counted only sales.
- Not included: attendance, payroll, real email/WhatsApp delivery, delivery tracking, authentication, multi-user data, KRA eTIMS. These need a backend or third-party services.
- Sales records cannot be edited or deleted (financial history).
