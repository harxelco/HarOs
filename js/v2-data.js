"use strict";
/* Deterministic V2 seed: invoices, payments, quotations. All records reference existing customers and products. */
function withV2(d) {
  let s = 20260; const r = () => (s = (s * 16807) % 2147483647) / 2147483647, DAYMS = 864e5, now = Date.now();
  const dt = (o) => new Date(now + o * DAYMS).toISOString().slice(0, 10), pick = (a) => a[Math.floor(r() * a.length)];
  const code = () => "S" + Array.from({ length: 9 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789"[Math.floor(r() * 34)]).join("");
  const tok = () => Array.from({ length: 16 }, () => "abcdefghjkmnpqrstuvwxyz23456789"[Math.floor(r() * 31)]).join("");
  const mkLines = () => Array.from({ length: 1 + Math.floor(r() * 3) }, () => { const p = pick(d.products); return { pid: p.id, desc: p.name, qty: 1 + Math.floor(r() * 5), price: p.price, disc: r() < 0.25 ? 5 : 0 }; });
  // [base status, issued days ago, terms days, payment fractions]
  const plan = [["sent", 60, 30, [0.4, 0.6]], ["sent", 45, 14, [1]], ["sent", 40, 14, [0.4]], ["sent", 50, 14, [1]], ["sent", 75, 30, [0.6]], ["sent", 20, 30, [0.5]], ["viewed", 10, 14, []],
    ["sent", 3, 30, []], ["draft", 1, 14, []], ["draft", 0, 30, []], ["cancelled", 30, 14, []], ["sent", 25, 14, [1]], ["sent", 100, 30, [0.9]], ["sent", 130, 30, [0.85]]];
  d.invoices = []; d.payments = []; d.quotes = [];
  plan.forEach(([st, ago, terms, fr], i) => {
    const lines = mkLines(), vat = i % 3 === 0 ? 0 : 16, disc = i % 5 === 1 ? { type: "pct", v: 5 } : null, t = V2.totals(lines, disc, vat), id = "inv" + (i + 1);
    const inv = { id, number: "AGS-INV-" + (2001 + i), customerId: d.customers[(i * 3 + 1) % d.customers.length].id, status: st, issue: dt(-ago), due: dt(-ago + terms), lines, disc, vat, total: t.total, paid: 0, credited: 0,
      token: tok(), notes: "Thank you for your business.", terms: "Payment due within " + terms + " days. Goods remain the property of the seller until paid in full.", history: [{ at: dt(-ago), ev: "Created" }], reminders: [] };
    if (st !== "draft") inv.history.push({ at: dt(-ago), ev: "Marked sent (demo: no message was delivered)" });
    if (st === "viewed") inv.history.push({ at: dt(-ago + 2), ev: "Customer link opened" });
    let left = t.total; fr.forEach((f, k) => { const amt = k === fr.length - 1 && f === 1 || (k === fr.length - 1 && fr.reduce((a, b) => a + b, 0) >= 1) ? left : Math.round(t.total * f);
      d.payments.push({ id: "ipay" + (d.payments.length + 1), invoiceId: id, amount: amt, date: dt(-ago + 3 + k * 5), method: k % 2 ? "Bank transfer" : "M-Pesa", ref: code(), note: "", by: "Finance Manager", key: "seed-" + id + "-" + k }); inv.paid += amt; left -= amt; });
    d.invoices.push(inv);
  });
  [["draft", 2, 14], ["sent", 6, 14], ["viewed", 9, 14], ["accepted", 12, 14], ["converted", 20, 14], ["rejected", 18, 14], ["expired", 40, 14], ["sent", 1, 21]].forEach(([st, ago, valid], i) => {
    const lines = mkLines(), q = { id: "q" + (i + 1), number: "AGS-QT-" + (3001 + i), customerId: d.customers[(i * 2 + 4) % d.customers.length].id, status: st, issue: dt(-ago), validUntil: dt(-ago + valid), lines, vat: 16, disc: null, token: tok(),
      notes: "Prices valid for the stated period.", terms: "50% deposit on acceptance, balance on delivery.", history: [{ at: dt(-ago), ev: "Created" }], comment: "" };
    if (st !== "draft") q.history.push({ at: dt(-ago), ev: "Marked sent (demo: no message was delivered)" });
    if (["accepted", "converted"].includes(st)) q.history.push({ at: dt(-ago + 3), ev: "Accepted by customer" });
    if (st === "rejected") { q.history.push({ at: dt(-ago + 4), ev: "Rejected by customer" }); q.comment = "Found a lower price elsewhere."; }
    if (st === "converted") { const src = d.invoices[7]; src.fromQuote = q.id; src.customerId = q.customerId; src.lines = lines.map((l) => ({ ...l })); src.vat = 16; src.disc = null; src.total = V2.totals(lines, null, 16).total; q.invoiceId = src.id; }
    d.quotes.push(q);
  });
  d.settings = { opening: 250000, vat: 16, bizName: "Apex General Supplies Ltd.", address: "Industrial Area, Nairobi, Kenya", phone: "0700 000 000", email: "accounts@apex-general.example",
    bank: "Demo Bank, A/C 0000000000 (fictional)", mpesa: "Paybill 000000, account = invoice number (fictional)" };
  return d;
}
