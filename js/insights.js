"use strict";
/* Harxel Business OS: rule-based intelligence. Pure and deterministic: the same data always gives the same answers.
   No external AI is called. Every insight shows its numbers, why it matters and what to do next. */
(function (root) {
  const L = typeof require === "function" && typeof module !== "undefined" ? require("./ledger.js") : root.L;
  const R = Math.round, clamp = (n) => Math.max(0, Math.min(100, R(n)));
  const kes = (n) => (n < 0 ? "-" : "") + "KSh " + R(Math.abs(n)).toLocaleString("en-KE");
  const pctTxt = (a, b) => (b ? Math.abs(((a - b) / Math.abs(b)) * 100).toFixed(1) + "%" : "n/a");
  const growth = (a, b) => (b ? (a - b) / Math.abs(b) : a > 0 ? 1 : 0);
  const nameOf = (db, list, id, dflt) => ((db[list] || []).find((x) => x.id === id) || { name: dflt || "Unknown" }).name;
  const plural = (n, w, p) => n + " " + (n === 1 ? w : p || w + "s");

  /* ---------- daily business summary ---------- */
  function dailySummary(db) {
    const t = L.today(), y = L.addDays(t, -1), now = L.range(db, t, t), prev = L.range(db, y, y);
    const newCust = db.customers.filter((c) => c.created && L.dayOf(c.created) === t).length, tasksDone = db.tasks.filter((x) => x.completedAt && L.dayOf(x.completedAt) === t).length;
    const acts = (db.activity || []).filter((a) => L.dayOf(a.at) === t).length;
    const s = { date: t, revenue: now.revenue, orders: now.orders, collected: now.collected, expenses: now.expenses, newCustomers: newCust, tasksDone, activity: acts, yRevenue: prev.revenue, yOrders: prev.orders };
    const bits = [];
    if (s.orders === 0) bits.push("No sales or invoices have been recorded yet today" + (prev.orders ? ` (yesterday: ${kes(prev.revenue)} across ${plural(prev.orders, "order")})` : ""));
    else {
      const cmp = prev.revenue ? (now.revenue >= prev.revenue ? `, ${pctTxt(now.revenue, prev.revenue)} ahead of yesterday` : `, ${pctTxt(now.revenue, prev.revenue)} behind yesterday`) : "";
      bits.push(`Your business has generated ${kes(s.revenue)} today across ${plural(s.orders, "order")}${cmp}`);
    }
    if (s.collected) bits.push(`${kes(s.collected)} has been collected`);
    if (newCust) bits.push(`${plural(newCust, "new customer")} joined`);
    if (tasksDone) bits.push(`${plural(tasksDone, "task")} ${tasksDone === 1 ? "was" : "were"} completed`);
    s.text = bits.join(". ") + ".";
    return s;
  }

  /* ---------- business health: transparent weighted score, 0 to 100 ---------- */
  const status = (n) => (n >= 80 ? "Healthy" : n >= 65 ? "Good" : n >= 45 ? "Needs attention" : "Critical");
  const WEIGHTS = { cash: 20, receivables: 20, revenue: 20, expenses: 15, inventory: 15, sales: 10 };
  function health(db) {
    const p = L.period(db, 30), cur = p.cur, prev = p.prev, rec = L.receivables(db), recTotal = L.sumBal(rec), overdue = L.sumBal(rec.filter((r) => r.overdue));
    const low = L.lowStock(db), out = low.filter((x) => x.status === "out").length, total = Math.max(1, db.products.length);
    const comps = [];
    const cashRatio = cur.collected ? cur.cashNet / cur.collected : 0;
    comps.push({ key: "cash", name: "Cash flow", score: clamp(cashRatio * 100), value: `${kes(cur.cashNet)} net cash in the last 30 days`, rule: "Net cash kept as a share of cash collected. 100 means all collected cash was kept; 0 means none was.", href: "/cashbook" });
    const share = recTotal ? overdue / recTotal : 0;
    comps.push({ key: "receivables", name: "Outstanding receivables", score: clamp(100 - share * 80), value: `${kes(overdue)} of ${kes(recTotal)} outstanding is overdue (${R(share * 100)}%)`, rule: "100 minus 80 points multiplied by the overdue share of outstanding money.", href: "/invoices" });
    const g = growth(cur.revenue, prev.revenue);
    comps.push({ key: "revenue", name: "Revenue performance", score: clamp(70 + g * 150), value: `${kes(cur.revenue)} vs ${kes(prev.revenue)} in the previous 30 days (${g >= 0 ? "+" : "-"}${pctTxt(cur.revenue, prev.revenue)})`, rule: "70 for flat revenue, plus 1.5 points for each percent of growth (minus for decline).", href: "/transactions" });
    const ratio = cur.revenue ? cur.expenses / cur.revenue : 1, eg = growth(cur.expenses, prev.expenses);
    comps.push({ key: "expenses", name: "Expense trend", score: clamp(100 - Math.max(0, ratio - 0.15) * 400 - Math.max(0, eg - 0.05) * 100), value: `Expenses are ${R(ratio * 100)}% of revenue, ${eg >= 0 ? "up" : "down"} ${pctTxt(cur.expenses, prev.expenses)} on the previous 30 days`, rule: "100 minus 4 points per percent of revenue above 15%, minus 1 point per percent that expenses grew beyond 5%.", href: "/finance" });
    comps.push({ key: "inventory", name: "Inventory health", score: clamp(100 * (1 - (low.length + out) / total)), value: `${plural(low.length, "product")} at or below reorder level, ${out} out of stock`, rule: "Share of products above their reorder level; out-of-stock products count twice.", href: "/inventory" });
    const gm = cur.revenue ? cur.gross / cur.revenue : 0;
    comps.push({ key: "sales", name: "Sales performance", score: clamp((gm / 0.3) * 100), value: `Gross margin ${R(gm * 100)}% on ${plural(cur.orders, "order")}`, rule: "Gross margin measured against a 30% target (30% or more scores 100).", href: "/reports" });
    comps.forEach((c) => { c.weight = WEIGHTS[c.key]; c.status = status(c.score); });
    const score = clamp(comps.reduce((a, c) => a + c.score * c.weight, 0) / 100);
    return { score, label: status(score), components: comps, note: "A guide calculated from your own records using the rules shown. It is not a certified financial rating." };
  }

  /* ---------- AI-style insights (rule based) ---------- */
  function insights(db) {
    const out = [], p = L.period(db, 30), cur = p.cur, prev = p.prev, t = L.today();
    const add = (o) => out.push(o);
    const g = growth(cur.revenue, prev.revenue);
    if (prev.revenue || cur.revenue) add({ id: "rev", sev: g >= 0 ? "good" : g < -0.05 ? "bad" : "warn", title: `Revenue is ${g >= 0 ? "up" : "down"} ${pctTxt(cur.revenue, prev.revenue)} on the previous 30 days`, data: `${kes(cur.revenue)} vs ${kes(prev.revenue)} across ${plural(cur.orders, "order")} (previous: ${prev.orders})`, why: g >= 0 ? "Growth confirms current pricing and stock levels are working." : "A falling trend usually shows up in cash two to four weeks later.", action: g >= 0 ? "See which products and salespeople drove it." : "Review customers who stopped ordering.", href: "/transactions", ctx: { tt: "Sale,Invoice", tfrom: p.from, tto: p.to }, link: "View revenue" });
    // expense category that grew the most
    const cat = (f, to) => { const m = {}; db.expenses.filter((e) => L.expenseLive(e) && L.dayOf(e.date) >= f && L.dayOf(e.date) <= to).forEach((e) => (m[e.category] = (m[e.category] || 0) + e.amount)); return m; }, cc = cat(p.from, p.to), pc = cat(p.prevFrom, p.prevTo);
    const up = Object.keys(cc).filter((k) => pc[k] > 0 && cc[k] - pc[k] >= 5000).map((k) => ({ k, g: growth(cc[k], pc[k]), a: cc[k], b: pc[k] })).filter((x) => x.g >= 0.15).sort((a, b) => b.g - a.g)[0];
    if (up) add({ id: "exp-" + up.k, sev: "warn", title: `${up.k} costs are ${R(up.g * 100)}% higher than the previous 30 days`, data: `${kes(up.a)} vs ${kes(up.b)} (${kes(up.a - up.b)} more)`, why: "Costs that rise faster than sales cut your margin.", action: `Check what changed in ${up.k.toLowerCase()} and whether it is a one-off.`, href: "/transactions", ctx: { tt: "Expense", tcat: up.k, tfrom: p.from, tto: p.to }, link: "View expenses" });
    const low = L.lowStock(db), uncovered = low.filter((x) => !x.onOrder);
    if (low.length) add({ id: "low", sev: low.some((x) => x.status === "out") ? "bad" : "warn", title: `${plural(low.length, "product")} ${low.length === 1 ? "is" : "are"} at or below minimum stock`, data: low.slice(0, 3).map((x) => `${x.p.name} (${x.p.stock}/${x.p.reorder})`).join(", ") + (low.length > 3 ? ` and ${low.length - 3} more` : ""), why: uncovered.length ? `${plural(uncovered.length, "item")} ${uncovered.length === 1 ? "has" : "have"} no purchase order, so sales may be lost.` : "Open purchase orders already cover these items.", action: uncovered.length ? "Raise purchase orders for the uncovered items." : "Follow up the open purchase orders.", href: "/inventory", ctx: { stk: "low" }, link: "View products" });
    const rec = L.receivables(db, t).filter((r) => r.overdue && r.kind !== "opening");
    if (rec.length) { const by = {}; rec.forEach((r) => (by[r.customerId] = (by[r.customerId] || 0) + r.balance)); const [cid, amt] = Object.entries(by).sort((a, b) => b[1] - a[1])[0], tot = L.sumBal(rec);
      add({ id: "ovd", sev: "bad", title: `${kes(tot)} is overdue from ${plural(Object.keys(by).length, "customer")}`, data: `${nameOf(db, "customers", cid)} owes the most overdue (${kes(amt)}); oldest item is ${Math.max(...rec.map((r) => r.daysOverdue))} days late`, why: "The longer a debt ages, the less likely it is to be paid in full.", action: "Call the largest debtors today and agree a payment date.", href: "/customers", ctx: { custOpen: cid }, link: "Open " + nameOf(db, "customers", cid) }); }
    // salesperson movement
    const cs = L.salesBy(db, p.from, p.to).employees, ps = L.salesBy(db, p.prevFrom, p.prevTo).employees, pm = Object.fromEntries(ps.map((e) => [e.id, e.revenue]));
    const mv = cs.filter((e) => e.id !== "none" && pm[e.id] > 0).map((e) => ({ e, g: growth(e.revenue, pm[e.id]), prev: pm[e.id] })).sort((a, b) => b.g - a.g);
    if (mv.length && mv[0].g >= 0.1) add({ id: "rep-up", sev: "good", title: `${nameOf(db, "employees", mv[0].e.id)}'s sales are up ${R(mv[0].g * 100)}% on the previous 30 days`, data: `${kes(mv[0].e.revenue)} vs ${kes(mv[0].prev)}`, why: "Recognising improvement keeps momentum and shows which approach works.", action: "Ask what changed and share it with the team.", href: "/sales", ctx: { sBy: mv[0].e.id }, link: "View their sales" });
    const worst = mv.length > 1 ? mv[mv.length - 1] : null;
    if (worst && worst.g <= -0.1) add({ id: "rep-dn", sev: "warn", title: `${nameOf(db, "employees", worst.e.id)}'s sales are down ${R(-worst.g * 100)}% on the previous 30 days`, data: `${kes(worst.e.revenue)} vs ${kes(worst.prev)}`, why: "A drop can mean fewer leads, stock gaps or a customer lost.", action: "Check their open leads and customer follow-ups.", href: "/sales", ctx: { sBy: worst.e.id }, link: "View their sales" });
    const ap = L.approvals(db);
    if (ap.length) { const old = ap[0], days = L.diffDays(t, old.at); add({ id: "apr", sev: days > 7 ? "warn" : "info", title: `${plural(ap.length, "approval")} worth ${kes(L.sum(ap, (a) => a.amount))} ${ap.length === 1 ? "is" : "are"} waiting`, data: `Oldest: ${old.title}, waiting ${plural(Math.max(0, days), "day")}`, why: "Stalled approvals delay stock arriving and suppliers being paid.", action: "Approve or reject the oldest requests first.", href: "/command", ctx: {}, link: "Review approvals" }); }
    const due = L.upcoming(db, 7, t).filter((u) => u.dir === "out");
    if (due.length) add({ id: "sup", sev: "info", title: `${kes(L.sum(due, (u) => u.amount))} is due to suppliers in the next 7 days`, data: due.slice(0, 3).map((u) => `${u.party} ${kes(u.amount)} on ${fmt(u.due)}`).join("; "), why: "Paying on time protects your credit terms with suppliers.", action: "Make sure cash is available before the due dates.", href: "/purchases", ctx: {}, link: "View payables" });
    const top = L.salesBy(db, p.from, p.to).products[0];
    if (top && cur.revenue) { const sh = top.revenue / L.sum(L.salesBy(db, p.from, p.to).products, (x) => x.revenue); if (sh >= 0.1) add({ id: "top", sev: "info", title: `${nameOf(db, "products", top.id, "A product")} is your best seller this period`, data: `${kes(top.revenue)} from ${top.qty} units, ${R(sh * 100)}% of product sales`, why: "Strong sellers should never run out of stock.", action: "Check its stock level and supplier lead time.", href: "/inventory", ctx: { q: nameOf(db, "products", top.id, "") }, link: "View product" }); }
    const rank = { bad: 0, warn: 1, info: 2, good: 3 };
    return out.sort((a, b) => rank[a.sev] - rank[b.sev]);
  }
  const fmt = (k) => new Date(k + "T00:00:00").toLocaleDateString("en-KE", { day: "numeric", month: "short" });

  /* ---------- Action Centre: one consolidated, de-duplicated list ---------- */
  const SEV = { critical: 0, high: 1, medium: 2 };
  function actions(db) {
    const t = L.today(), out = [], seen = new Set(), add = (a) => { if (!seen.has(a.id)) { seen.add(a.id); out.push(a); } };
    // overdue money, grouped by customer so one customer is one task
    const by = {}; L.receivables(db, t).filter((r) => r.overdue && r.kind !== "opening").forEach((r) => ((by[r.customerId] = by[r.customerId] || []).push(r)));
    Object.entries(by).forEach(([cid, docs]) => { const amt = L.sumBal(docs), late = Math.max(...docs.map((d) => d.daysOverdue)), nm = nameOf(db, "customers", cid, "Customer");
      add({ id: "od:" + cid, kind: "Overdue", sev: late > 60 || amt >= 100000 ? "critical" : "high", title: `Collect ${kes(amt)} from ${nm}`, detail: `${plural(docs.length, "document")} overdue, oldest ${plural(late, "day")} late`, amount: amt, date: docs[0].due, route: "/customers", ctx: { custOpen: cid }, cta: "Open customer" }); });
    // stock: out of stock items individually, the rest grouped, nothing already covered by an open purchase order
    const low = L.lowStock(db).filter((x) => !x.onOrder), outs = low.filter((x) => x.status === "out"), rest = low.filter((x) => x.status !== "out");
    outs.forEach((x) => add({ id: "out:" + x.p.id, kind: "Stock", sev: "critical", title: `${x.p.name} is out of stock`, detail: x.supplier ? `Minimum ${x.p.reorder}. Supplier: ${x.supplier.name}` : `Minimum ${x.p.reorder}`, route: "/purchases", ctx: { newPO: x.p.id }, cta: "Create purchase order" }));
    if (rest.length) add({ id: "low", kind: "Stock", sev: "high", title: `${plural(rest.length, "product")} below minimum stock`, detail: rest.slice(0, 3).map((x) => x.p.name).join(", ") + (rest.length > 3 ? ` and ${rest.length - 3} more` : ""), route: "/inventory", ctx: { stk: "low" }, cta: "View products" });
    const ap = L.approvals(db); if (ap.length) add({ id: "approvals", kind: "Approvals", sev: ap.some((a) => L.diffDays(t, a.at) > 7) ? "high" : "medium", title: `${plural(ap.length, "approval")} waiting for a decision`, detail: ap.slice(0, 2).map((a) => a.title).join("; "), amount: L.sum(ap, (a) => a.amount), date: ap[0].at, route: "/command", ctx: { focus: "approvals" }, cta: "Review approvals" });
    L.payables(db, t).filter((p) => p.due <= L.addDays(t, 7)).forEach((p) => add({ id: "pay:" + p.id, kind: "Supplier payment", sev: p.overdue ? "critical" : "high", title: `${p.overdue ? "Overdue: pay" : "Pay"} ${nameOf(db, "suppliers", p.supplierId, "supplier")} ${kes(p.balance)}`, detail: `${p.ref} ${p.overdue ? `was due ${fmt(p.due)}` : `is due ${fmt(p.due)}`}`, amount: p.balance, date: p.due, route: "/purchases", ctx: { payPO: p.id }, cta: "Record payment" }));
    db.leads.filter((l) => l.stage !== "Won" && l.stage !== "Lost" && L.dayOf(l.followUp) <= t).forEach((l) => add({ id: "lead:" + l.id, kind: "Follow-up", sev: L.dayOf(l.followUp) < t ? "high" : "medium", title: `Follow up ${l.name}`, detail: `${l.stage}, deal value ${kes(l.value)}, follow-up ${L.dayOf(l.followUp) < t ? "was due " : "is due "}${fmt(L.dayOf(l.followUp))}`, amount: l.value, date: L.dayOf(l.followUp), route: "/crm", ctx: {}, cta: "Open pipeline" }));
    db.quotes.filter((q) => ["sent", "viewed"].includes(q.status) && L.diffDays(t, q.issue) >= 5).forEach((q) => add({ id: "quote:" + q.id, kind: "Follow-up", sev: "medium", title: `Quotation ${q.number} has had no answer for ${plural(L.diffDays(t, q.issue), "day")}`, detail: nameOf(db, "customers", q.customerId, "Customer"), date: q.validUntil, route: "/quote", ctx: { cur: q.id }, cta: "Open quotation" }));
    const od = db.tasks.filter((x) => x.status !== "Completed" && L.dayOf(x.due) < t); if (od.length) add({ id: "tasks", kind: "Tasks", sev: od.some((x) => x.priority === "High") ? "high" : "medium", title: `${plural(od.length, "task")} overdue`, detail: od.slice(0, 2).map((x) => x.title).join("; "), route: "/tasks", ctx: {}, cta: "View tasks" });
    return out.sort((a, b) => SEV[a.sev] - SEV[b.sev] || (b.amount || 0) - (a.amount || 0));
  }

  const api = { kes, status, WEIGHTS, dailySummary, health, insights, actions };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.I = api;
})(typeof window !== "undefined" ? window : globalThis);
