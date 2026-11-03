"use strict";
/* Pure business logic for invoices, payments, quotations, ageing and cashbook. Whole KES integers. */
(function (root) {
  const R = Math.round;
  function totals(lines, disc, vat) {
    const nets = lines.map((l) => { const g = R(l.qty * l.price); return g - R((g * (l.disc || 0)) / 100); });
    const sub = nets.reduce((a, b) => a + b, 0);
    const d = !disc ? 0 : disc.type === "pct" ? R((sub * (disc.v || 0)) / 100) : Math.min(disc.v || 0, sub);
    const tax = R(((sub - d) * (vat || 0)) / 100);
    return { sub, disc: d, tax, total: sub - d + tax, nets };
  }
  const bal = (i) => Math.max(0, i.total - (i.credited || 0) - i.paid);
  function dstatus(i, today) {
    const b = bal(i); let s = i.status;
    if (s !== "draft" && s !== "cancelled") { if (i.total > 0 && (i.credited || 0) >= i.total) s = "credited"; else if (b === 0 && i.total > 0) s = "paid"; else if (i.paid > 0) s = "partially_paid"; }
    return { status: s, balance: b, overdue: !["draft", "cancelled", "paid", "credited"].includes(s) && b > 0 && i.due < today };
  }
  function pay(inv, payments, p) {
    const dup = payments.find((x) => x.invoiceId === inv.id && x.key === p.key);
    if (dup) return { dup: true, payment: dup, inv };
    if (inv.status === "draft" || inv.status === "cancelled") throw new Error("Payments are not allowed on draft or cancelled invoices.");
    if (!Number.isInteger(p.amount) || p.amount <= 0) throw new Error("Enter a positive whole amount.");
    if (p.amount > bal(inv)) throw new Error("Amount is more than the outstanding balance.");
    return { dup: false, payment: { ...p, invoiceId: inv.id }, inv: { ...inv, paid: inv.paid + p.amount } };
  }
  function age(invs, today) {
    const b = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90: 0 }, t = Date.parse(today);
    invs.forEach((i) => { const s = dstatus(i, today); if (!s.balance || ["draft", "cancelled"].includes(s.status)) return; const d = Math.floor((t - Date.parse(i.due)) / 864e5);
      b[d <= 0 ? "current" : d <= 30 ? "d1_30" : d <= 60 ? "d31_60" : d <= 90 ? "d61_90" : "d90"] += s.balance; });
    return b;
  }
  function convert(q, invoices) {
    if (q.status !== "accepted") throw new Error("Only accepted quotations can be converted.");
    if (invoices.some((i) => i.fromQuote === q.id)) throw new Error("This quotation was already converted.");
    return { fromQuote: q.id, customerId: q.customerId, lines: q.lines.map((l) => ({ ...l })), disc: q.disc, vat: q.vat, notes: q.notes, terms: q.terms };
  }
  function cashbook(entries, opening) {
    const m = {}; entries.forEach((e) => { const d = (m[e.date] = m[e.date] || { date: e.date, in: 0, out: 0 }); d.in += e.in || 0; d.out += e.out || 0; });
    let c = opening; return Object.values(m).sort((a, b) => a.date.localeCompare(b.date)).map((d) => ({ ...d, open: c, close: (c = c + d.in - d.out) }));
  }
  const api = { totals, bal, dstatus, pay, age, convert, cashbook };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.V2 = api;
})(typeof window !== "undefined" ? window : globalThis);
