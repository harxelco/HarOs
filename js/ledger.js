"use strict";
/* Harxel Business OS: central ledger.
   ONE source of truth for every financial figure. Pure functions of `db` (no DOM, no globals except V2 for invoice maths).
   Rules (also shown to users in the Business Health panel and the README):
   - Revenue is accrual, excluding VAT: sales at their total, issued invoices at (subtotal - discount) less credit notes.
   - Draft and cancelled invoices, voided sales and opening-balance records are never revenue.
   - Cash movements are payments actually recorded: sale payments, invoice payments, approved expenses, supplier payments.
   - COGS comes from items sold (qty x cost), never from purchase orders, so stock purchases are not counted twice.
   - Expenses that are pending or rejected do not count until approved.
   - Dates are local calendar days (YYYY-MM-DD) so "today" means the user's today. */
(function (root) {
  const DAY = 864e5, R = Math.round, pad = (n) => String(n).padStart(2, "0");
  const V = typeof require === "function" && typeof module !== "undefined" ? require("./v2-core.js") : root.V2;
  const ymd = (ms) => { const d = new Date(ms); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
  const today = () => ymd(Date.now());
  const dayOf = (x) => (typeof x === "number" ? ymd(x) : String(x).length === 10 ? String(x) : ymd(Date.parse(x)));
  const addDays = (k, n) => { const [y, m, d] = k.split("-").map(Number); return ymd(new Date(y, m - 1, d + n).getTime()); };
  const diffDays = (a, b) => { const p = (k) => { const [y, m, d] = k.split("-").map(Number); return Date.UTC(y, m - 1, d); }; return Math.round((p(a) - p(b)) / DAY); };
  const sum = (a, f) => a.reduce((x, y) => x + (f ? f(y) : y), 0);
  const inR = (k, from, to) => k >= from && k <= to;

  /* ---------- purchase orders ---------- */
  const poLines = (p) => (p.lines && p.lines.length ? p.lines : p.productId ? [{ productId: p.productId, qty: p.qty, unitCost: p.unitCost }] : []);
  const poSub = (p) => sum(poLines(p), (l) => R(l.qty * l.unitCost));
  const poTotal = (p) => (p.total != null ? p.total : poSub(p) + R((poSub(p) * (p.taxPct || 0)) / 100));
  const poPaid = (p) => (p.pays ? sum(p.pays, (x) => x.amount) : p.paid || 0);

  /* ---------- revenue documents ---------- */
  const isOpening = (x) => x.kind === "opening";
  const saleLive = (s) => !s.void && !isOpening(s);
  const invLive = (i) => i.status !== "draft" && i.status !== "cancelled";
  const salePaid = (s) => (s.pays ? sum(s.pays, (x) => x.amount) : s.paid || 0);
  function invNet(i) { const t = V.totals(i.lines, i.disc, i.vat), credit = i.total ? Math.min(1, (i.credited || 0) / i.total) : 0; return R((t.sub - t.disc) * (1 - credit)); }
  const lineCost = (db, l) => { const p = db.products.find((x) => x.id === l.pid); return p ? l.qty * p.cost : 0; };

  /** Every revenue document as { id, kind, ref, date, customerId, soldBy, net, gross, cogs, items:[{pid,qty,amount}] } */
  function revenueDocs(db) {
    const a = db.sales.filter(saleLive).map((s) => ({ id: s.id, kind: "sale", ref: s.ref, date: dayOf(s.date), customerId: s.customerId, soldBy: s.soldBy, net: s.total, gross: s.total,
      cogs: sum(s.items, (i) => i.qty * i.cost), items: s.items.map((i) => ({ pid: i.productId, qty: i.qty, amount: i.qty * i.price })) }));
    const b = db.invoices.filter(invLive).map((i) => ({ id: i.id, kind: "invoice", ref: i.number, date: i.issue, customerId: i.customerId, soldBy: i.soldBy, net: invNet(i), gross: i.total - (i.credited || 0),
      cogs: R(sum(i.lines, (l) => lineCost(db, { pid: l.pid, qty: l.qty })) * (i.total ? 1 - Math.min(1, (i.credited || 0) / i.total) : 1)), items: i.lines.filter((l) => l.pid).map((l) => ({ pid: l.pid, qty: l.qty, amount: Math.round(l.qty * l.price * (1 - (l.disc || 0) / 100)) })) }));
    return a.concat(b);
  }
  const expenseLive = (e) => e.status !== "pending" && e.status !== "rejected";

  /** All cash movements as { id, date, dir:'in'|'out', amount, method, desc, ref, type, rid } */
  function cashEntries(db) {
    const out = [], cn = (id) => (db.customers.find((c) => c.id === id) || { name: "Walk-in" }).name;
    db.sales.filter((s) => !s.void).forEach((s) => (s.pays || (s.paid > 0 ? [{ id: s.id + "-p0", date: dayOf(s.date), amount: s.paid, method: s.method }] : [])).forEach((p) =>
      out.push({ id: p.id, date: dayOf(p.date), dir: "in", amount: p.amount, method: p.method, desc: (isOpening(s) ? "Opening balance receipt " : "Sale ") + s.ref + " · " + cn(s.customerId), ref: s.ref, type: "receipt", rid: s.id, customerId: s.customerId })));
    db.payments.forEach((p) => { const i = db.invoices.find((x) => x.id === p.invoiceId); if (i) out.push({ id: p.id, date: p.date, dir: "in", amount: p.amount, method: p.method, desc: "Invoice payment " + i.number + " · " + cn(i.customerId), ref: p.ref, type: "receipt", rid: i.id, customerId: i.customerId }); });
    db.expenses.filter(expenseLive).forEach((e) => out.push({ id: e.id, date: dayOf(e.date), dir: "out", amount: e.amount, method: e.method, desc: e.category + ": " + e.description, ref: "", type: "expense", rid: e.id }));
    db.pos.forEach((p) => (p.pays || []).forEach((x) => out.push({ id: x.id, date: x.date, dir: "out", amount: x.amount, method: x.method, desc: "Supplier payment " + p.ref + " · " + ((db.suppliers.find((s) => s.id === p.supplierId) || {}).name || "Supplier"), ref: p.ref, type: "supplier_payment", rid: p.id })));
    return out;
  }

  /** Totals for an inclusive range of day keys. */
  function range(db, from, to) {
    const docs = revenueDocs(db).filter((d) => inR(d.date, from, to)), exp = db.expenses.filter((e) => expenseLive(e) && inR(dayOf(e.date), from, to)), cash = cashEntries(db).filter((c) => inR(c.date, from, to));
    const revenue = sum(docs, (d) => d.net), cogs = sum(docs, (d) => d.cogs), expenses = sum(exp, (e) => e.amount);
    return { revenue, cogs, gross: revenue - cogs, expenses, net: revenue - cogs - expenses, orders: docs.length, collected: sum(cash.filter((c) => c.dir === "in"), (c) => c.amount),
      paidOut: sum(cash.filter((c) => c.dir === "out"), (c) => c.amount), cashNet: sum(cash, (c) => (c.dir === "in" ? c.amount : -c.amount)) };
  }
  const lastDays = (n, end) => { end = end || today(); return [addDays(end, -(n - 1)), end]; };
  function period(db, n) { const [f, t] = lastDays(n), pt = addDays(f, -1), [pf] = [addDays(pt, -(n - 1))]; return { cur: range(db, f, t), prev: range(db, pf, pt), from: f, to: t, prevFrom: pf, prevTo: pt }; }

  /** Chart buckets. gran: "day" | "week" | "month"; count = number of buckets ending today. */
  function buckets(db, gran, count) {
    const t = today(), out = [], docs = revenueDocs(db), exp = db.expenses.filter(expenseLive), cash = cashEntries(db);
    const bounds = (i) => { // i = 0 is the newest bucket
      if (gran === "day") { const d = addDays(t, -i); return [d, d]; }
      if (gran === "week") { const to = addDays(t, -i * 7); return [addDays(to, -6), to]; }
      const [y, m] = t.split("-").map(Number), s = new Date(y, m - 1 - i, 1), e = new Date(y, m - i, 0), k = (d) => ymd(d.getTime());
      return [k(s), i === 0 ? t : k(e)];
    };
    for (let i = count - 1; i >= 0; i--) {
      const [from, to] = bounds(i), d = docs.filter((x) => inR(x.date, from, to)), e = exp.filter((x) => inR(dayOf(x.date), from, to)), c = cash.filter((x) => inR(x.date, from, to));
      const revenue = sum(d, (x) => x.net), cogs = sum(d, (x) => x.cogs), expenses = sum(e, (x) => x.amount), cin = sum(c.filter((x) => x.dir === "in"), (x) => x.amount), cout = sum(c.filter((x) => x.dir === "out"), (x) => x.amount);
      const lab = gran === "month" ? new Date(from + "T00:00:00").toLocaleDateString("en-KE", { month: "short", year: "2-digit" }) : new Date(from + "T00:00:00").toLocaleDateString("en-KE", { day: "numeric", month: "short" });
      out.push({ label: lab, from, to, Revenue: revenue, Expenses: expenses, Profit: revenue - cogs - expenses, "Cash flow": cin - cout, orders: d.length });
    }
    return out;
  }

  /* ---------- receivables and payables (one entry per open document, so nothing is listed twice) ---------- */
  function receivables(db, t) {
    t = t || today(); const out = [];
    db.sales.filter((s) => !s.void).forEach((s) => { const b = s.total - salePaid(s); if (b > 0) out.push({ id: s.id, kind: isOpening(s) ? "opening" : "sale", ref: s.ref, customerId: s.customerId, date: dayOf(s.date), due: s.due || addDays(dayOf(s.date), 30), total: s.total, balance: b }); });
    db.invoices.filter(invLive).forEach((i) => { const b = V.bal(i); if (b > 0) out.push({ id: i.id, kind: "invoice", ref: i.number, customerId: i.customerId, date: i.issue, due: i.due, total: i.total, balance: b }); });
    return out.map((r) => ({ ...r, overdue: r.due < t, daysOverdue: Math.max(0, diffDays(t, r.due)) })).sort((a, b) => a.due.localeCompare(b.due));
  }
  function payables(db, t) {
    t = t || today();
    return db.pos.filter((p) => p.status === "Received" || p.status === "Completed").map((p) => ({ id: p.id, ref: p.ref, supplierId: p.supplierId, total: poTotal(p), balance: poTotal(p) - poPaid(p), due: p.due || addDays(dayOf(p.receivedAt || p.date), 30) }))
      .filter((p) => p.balance > 0).map((p) => ({ ...p, overdue: p.due < t, daysOverdue: Math.max(0, diffDays(t, p.due)) })).sort((a, b) => a.due.localeCompare(b.due));
  }
  const sumBal = (a) => sum(a, (x) => x.balance);

  function customerStats(db, id) {
    const t = today(), s = db.sales.filter((x) => x.customerId === id && !x.void), i = db.invoices.filter((x) => x.customerId === id && invLive(x)), open = receivables(db, t).filter((r) => r.customerId === id);
    return { lifetime: sum(s.filter(saleLive), (x) => x.total) + sum(i, (x) => x.total - (x.credited || 0)), balance: sumBal(open), overdue: sumBal(open.filter((r) => r.overdue)), orders: s.filter(saleLive).length + i.length, open };
  }
  function supplierStats(db, id) { const p = db.pos.filter((x) => x.supplierId === id), open = payables(db).filter((x) => x.supplierId === id); return { orders: p.filter((x) => !isOpening(x)).length, balance: sumBal(open), spend: sum(p.filter((x) => !isOpening(x) && x.status !== "Draft" && x.status !== "Rejected"), poTotal) }; }
  const creditUsed = (db, id) => customerStats(db, id).balance;

  /* ---------- inventory ---------- */
  const onOrder = (db, pid) => sum(db.pos.filter((p) => ["Submitted", "Approved"].includes(p.status)), (p) => sum(poLines(p).filter((l) => l.productId === pid), (l) => l.qty));
  const stockStatus = (p) => (p.stock <= 0 ? "out" : p.stock <= p.reorder ? "low" : "ok");
  function lowStock(db) {
    return db.products.filter((p) => p.stock <= p.reorder).map((p) => ({ p, status: stockStatus(p), supplier: db.suppliers.find((s) => s.id === p.supplierId) || null, onOrder: onOrder(db, p.id) }))
      .sort((a, b) => a.p.stock / Math.max(1, a.p.reorder) - b.p.stock / Math.max(1, b.p.reorder));
  }

  /* ---------- sales performance ---------- */
  function salesBy(db, from, to) {
    const docs = revenueDocs(db).filter((d) => inR(d.date, from, to)), emp = {}, prod = {};
    docs.forEach((d) => { const e = (emp[d.soldBy || "none"] = emp[d.soldBy || "none"] || { id: d.soldBy || "none", revenue: 0, orders: 0 }); e.revenue += d.net; e.orders++;
      d.items.forEach((i) => { const p = (prod[i.pid] = prod[i.pid] || { id: i.pid, qty: 0, revenue: 0 }); p.qty += i.qty; p.revenue += i.amount; }); });
    return { employees: Object.values(emp).sort((a, b) => b.revenue - a.revenue), products: Object.values(prod).sort((a, b) => b.revenue - a.revenue), total: sum(docs, (d) => d.net), orders: docs.length };
  }

  /* ---------- unified transaction list (drill-downs and the Transactions page) ---------- */
  function transactions(db) {
    const cn = (id) => (db.customers.find((c) => c.id === id) || { name: "Walk-in" }).name, out = [];
    revenueDocs(db).forEach((d) => out.push({ id: "rev-" + d.id, date: d.date, type: d.kind === "sale" ? "Sale" : "Invoice", dir: "in", amount: d.net, desc: d.ref + " · " + cn(d.customerId), rid: d.id, route: d.kind === "sale" ? "/sales" : "/invoice", party: d.customerId, soldBy: d.soldBy, bucket: "revenue" }));
    cashEntries(db).forEach((c) => out.push({ id: "cash-" + c.id, date: c.date, type: c.type === "receipt" ? "Payment received" : c.type === "expense" ? "Expense" : "Supplier payment", dir: c.dir, amount: c.amount, desc: c.desc, rid: c.rid, route: c.type === "receipt" ? "/invoices" : c.type === "expense" ? "/finance" : "/purchases", method: c.method, bucket: c.type === "expense" ? "expense" : "cash" }));
    return out.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  }

  /* ---------- approvals: derived from the records themselves, so there is no second copy to drift ---------- */
  function approvals(db) {
    const out = [], emp = (id) => (db.employees.find((e) => e.id === id) || {}).name || id || "Unknown";
    db.pos.filter((p) => p.status === "Submitted").forEach((p) => out.push({ id: "po:" + p.id, type: "Purchase order", rid: p.id, title: p.ref + " · " + ((db.suppliers.find((s) => s.id === p.supplierId) || {}).name || "Supplier"), amount: poTotal(p), by: p.submittedBy ? emp(p.submittedBy) : "Procurement", at: p.submittedAt || dayOf(p.date), route: "/purchases", status: "Pending" }));
    db.expenses.filter((e) => e.status === "pending").forEach((e) => out.push({ id: "ex:" + e.id, type: "Expense", rid: e.id, title: e.category + ": " + e.description, amount: e.amount, by: e.by ? emp(e.by) : "Staff", at: dayOf(e.date), route: "/finance", status: "Pending" }));
    db.pos.filter((p) => p.payReq && p.payReq.status === "pending").forEach((p) => out.push({ id: "pp:" + p.id, type: "Supplier payment", rid: p.id, title: "Pay " + p.ref + " · " + ((db.suppliers.find((s) => s.id === p.supplierId) || {}).name || "Supplier"), amount: p.payReq.amount, by: emp(p.payReq.by), at: p.payReq.at, route: "/purchases", status: "Pending" }));
    return out.sort((a, b) => a.at.localeCompare(b.at));
  }

  /* ---------- upcoming money, each open document appears once; overdue items live in the overdue panels ---------- */
  function upcoming(db, days, t) {
    t = t || today(); const end = addDays(t, days || 30);
    const inc = receivables(db, t).filter((r) => !r.overdue && r.due <= end).map((r) => ({ key: "in:" + r.kind + r.id, dir: "in", ref: r.ref, party: (db.customers.find((c) => c.id === r.customerId) || {}).name || "Customer", amount: r.balance, due: r.due, status: r.kind === "invoice" ? "Expected" : "Expected", rid: r.id, route: r.kind === "invoice" ? "/invoice" : "/sales" }));
    const outg = payables(db, t).filter((r) => !r.overdue && r.due <= end).map((r) => ({ key: "out:" + r.id, dir: "out", ref: r.ref, party: (db.suppliers.find((s) => s.id === r.supplierId) || {}).name || "Supplier", amount: r.balance, due: r.due, status: "Due", rid: r.id, route: "/purchases" }));
    return inc.concat(outg).sort((a, b) => a.due.localeCompare(b.due));
  }

  const api = { DAY, ymd, today, dayOf, addDays, diffDays, sum, poLines, poSub, poTotal, poPaid, isOpening, saleLive, invLive, salePaid, invNet, expenseLive, revenueDocs, cashEntries, range, lastDays, period, buckets,
    receivables, payables, sumBal, customerStats, supplierStats, creditUsed, onOrder, stockStatus, lowStock, salesBy, transactions, approvals, upcoming };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.L = api;
})(typeof window !== "undefined" ? window : globalThis);
