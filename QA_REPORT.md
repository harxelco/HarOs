# QA_REPORT (2026-11-11)

## Automated (executed)
`npm install` then `npm test` (Node 22, jsdom): **27 tests, 27 pass, 0 fail** (smoke, theme, v2 core, and tests/v3.test.js covering PDF structure, routes and detail routes, dashboard figures vs dataset for every filter, health rules, approvals and roles, multi-line POs and stock, employee-task links, CRUD guards, double submit, sale validation, share messages and validation, completion dialog, quick actions, demo reset integrity).

## Browser run (executed, headless Chromium via Playwright, not committed)
30 scripted checks passed: Ctrl+K palette, form validation, supplier/customer/employee/task creation and edit, multi-line PO, dashboard approve and date filters, invoice creation to completion dialog, preview, real PDF download (valid, starts %PDF-), WhatsApp URL (wa.me/254712345678?text=...), mailto URL, invalid phone/email blocked, Escape closes, demo reset. No page errors or console errors.
Layout: no horizontal overflow on 19 routes at 390px, 768px (light) and 1280px (dark). Screenshots reviewed: dashboard, share dialog (dark), purchase-order sheet (mobile).

## Not tested
Real devices (iOS/Android share sheet), real WhatsApp/email apps, printing on paper, Safari/Firefox. The Web Share file path could only be reasoned about, not exercised. The Inter font loads from Google Fonts, so offline machines fall back to the system font.
