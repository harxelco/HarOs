"use strict";
/* Data model v3. One idempotent function used both for a fresh seed and to migrate older localStorage data in place.
   Adds: payment records on sales and purchase orders, due dates, multi-line purchase orders, salesperson on sales and invoices,
   expense approval status, activity log, customer and supplier profile fields. Never deletes or rewrites existing amounts. */
function withV3(d) {
  const sod = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime(), now = Date.now(), DAYMS = 864e5;
  const t = L.today(), ago = (n) => L.addDays(t, -n), isoAgo = (n) => new Date(sod - n * DAYMS + 12 * 36e5).toISOString();
  const frac = (s) => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 1009; return (h % 100) / 100; };
  const at = (day, k) => (day === t ? new Date(sod + (now - sod) * (0.12 + 0.76 * frac(k))).toISOString() : new Date(Date.parse(day + "T00:00:00") + (8 + frac(k) * 9) * 36e5).toISOString());
  const reps = d.employees.filter((e) => e.department === "Sales").map((e) => e.id), pickRep = (k) => reps[Math.floor(frac(k) * reps.length) % Math.max(1, reps.length)] || null;
  const catSup = { Electronics: "sp3", Household: "sp6", "Office supplies": "sp5", "Food products": "sp1", Hardware: "sp2" };
  const emp = (id) => (d.employees.find((e) => e.id === id) || {}).name || "Staff";

  d.products.forEach((p) => { if (!p.supplierId) p.supplierId = catSup[p.category] || (d.suppliers[0] || {}).id; });
  d.customers.forEach((c, i) => {
    if (c.created === undefined) c.created = isoAgo(40 + ((i * 37) % 320));
    if (c.terms === undefined) c.terms = c.type === "Wholesale" ? 30 : 14;
    if (c.creditLimit === undefined) c.creditLimit = c.type === "Wholesale" ? 400000 : 150000;
    ["email", "location", "businessName", "notes"].forEach((k) => { if (c[k] === undefined) c[k] = ""; });
    if (c.category === undefined) c.category = "Standard";
    if (c.salespersonId === undefined) c.salespersonId = pickRep("c" + c.id);
  });
  d.suppliers.forEach((s) => { ["contact", "email", "location", "pin", "notes"].forEach((k) => { if (s[k] === undefined) s[k] = ""; }); if (s.terms === undefined) s.terms = 30; if (s.opening === undefined) s.opening = 0; });
  const terms = (cid) => ((d.customers.find((c) => c.id === cid) || {}).terms) || 30;
  d.sales.forEach((s) => {
    if (!s.soldBy) s.soldBy = pickRep(s.id);
    if (!s.due) s.due = L.addDays(L.dayOf(s.date), terms(s.customerId));
    if (!s.pays) s.pays = s.paid > 0 ? [{ id: s.id + "-p0", date: L.dayOf(s.date), amount: s.paid, method: s.method }] : [];
    s.paid = L.salePaid(s);
  });
  d.invoices.forEach((i, k) => { if (!i.soldBy) i.soldBy = pickRep(i.id); });
  d.expenses.forEach((e) => { if (!e.status) e.status = "approved"; if (!e.by) e.by = "em3"; });
  d.tasks.forEach((x) => { if (x.status === "Completed" && !x.completedAt) { const n = Number(String(x.id).replace(/\D/g, "")); x.completedAt = n === 4 || n === 8 ? new Date(sod + (now - sod) * (n === 4 ? 0.35 : 0.6)).toISOString() : isoAgo(1 + (n % 9)); } });

  /* purchase orders: lines, tax, payment records and dates (seeded orders carry _tot; older saved orders are migrated) */
  const plan = { 0: [2, 0], 5: [1, 0], 10: [6, 0], 15: [0, 0], 1: [9, 8], 6: [4, 3], 11: [2, 1], 16: [1, 0], 2: [12], 7: [7], 12: [5], 17: [3], 3: [70, 62, -32, 1], 8: [48, 40, -6, 0.5], 13: [36, 30, 5, 0.5], 18: [20, 14, 9, 0], 4: [200], 9: [170], 14: [140], 19: [110] };
  d.pos.forEach((p, i) => {
    if (!p.lines) p.lines = [{ productId: p.productId, qty: p.qty, unitCost: p.unitCost }];
    if (p.taxPct === undefined) p.taxPct = 0; if (p.notes === undefined) p.notes = ""; if (p.terms === undefined) p.terms = 30;
    const seeded = p._tot !== undefined, pl = seeded ? plan[i] : null, tot = L.poTotal({ ...p, total: undefined });
    if (seeded) {
      p.date = new Date(sod - pl[0] * DAYMS + 10 * 36e5).toISOString();
      if (p.status === "Submitted") { p.submittedAt = ago(pl[1]); }
      if (p.status === "Received") { p.receivedAt = ago(pl[1]); p.due = L.addDays(t, pl[2]); p.terms = Math.max(1, L.diffDays(p.due, p.receivedAt)); p.paid = Math.round(tot * pl[3]); }
      if (p.status === "Completed") { p.paid = tot; p.receivedAt = ago(Math.max(0, pl[0] - 10)); p.due = L.addDays(p.receivedAt, 30); }
      if (p.status === "Approved") p.approvedAt = ago(pl[0] - 1);
      delete p._tot;
    }
    if (!p.pays) p.pays = p.paid > 0 ? [{ id: p.id + "-pay0", date: p.receivedAt || L.dayOf(p.date), amount: p.paid, method: i % 2 ? "Bank transfer" : "M-Pesa", by: "Finance Manager" }] : [];
    p.paid = L.poPaid(p);
    if (!p.due && (p.status === "Received" || p.status === "Completed")) p.due = L.addDays(L.dayOf(p.receivedAt || p.date), p.terms || 30);
    if (!p.submittedBy) p.submittedBy = "em8";
    if (seeded && i === 13 && !p.payReq) p.payReq = { amount: tot - p.paid, by: "em8", at: ago(2), status: "pending" };
  });
  d.invoices.forEach((i) => { i.history = i.history || []; });
  d.settings = d.settings || {}; if (d.settings.approvalLimit === undefined) d.settings.approvalLimit = 25000;

  if (!d.activity) {
    const a = [], add = (day, k, who, act, ref, route, rid) => a.push({ id: "a" + a.length, at: at(day, k), who, act, ref, route, rid });
    d.sales.filter((s) => L.saleLive(s) && L.dayOf(s.date) >= ago(10)).forEach((s) => a.push({ id: "a" + a.length, at: s.date, who: emp(s.soldBy), act: "Recorded sale", ref: s.ref, route: "/sales", rid: s.id }));
    d.invoices.filter((i) => i.status !== "draft").forEach((i) => { if (i.issue >= ago(21)) add(i.issue, i.id, emp(i.soldBy || "em3"), "Created invoice", i.number, "/invoice", i.id); });
    d.payments.forEach((p) => { const i = d.invoices.find((x) => x.id === p.invoiceId); if (i && p.date >= ago(21)) add(p.date, p.id, "Faith Chebet", "Recorded payment", i.number, "/invoice", i.id); });
    d.expenses.filter((e) => L.dayOf(e.date) >= ago(10)).forEach((e) => add(L.dayOf(e.date), e.id, emp(e.by), "Submitted expense", e.description, "/finance", e.id));
    d.pos.forEach((p) => { const day = L.dayOf(p.date); if (day >= ago(30)) add(day, p.id, "Daniel Mutua", "Created purchase order", p.ref, "/purchases", p.id); if (p.approvedAt && p.approvedAt >= ago(30)) add(p.approvedAt, p.id + "ap", "Grace Mwende", "Approved purchase order", p.ref, "/purchases", p.id); if (p.receivedAt && p.receivedAt >= ago(30)) add(p.receivedAt, p.id + "rc", "Samuel Odhiambo", "Received stock", p.ref, "/purchases", p.id); });
    d.tasks.filter((x) => x.completedAt).forEach((x) => a.push({ id: "a" + a.length, at: x.completedAt, who: emp(x.assigneeId), act: "Completed task", ref: x.title, route: "/tasks", rid: x.id }));
    d.customers.filter((c) => L.dayOf(c.created) >= ago(14)).forEach((c) => a.push({ id: "a" + a.length, at: c.created, who: emp(c.salespersonId), act: "Added customer", ref: c.name, route: "/customers", rid: c.id }));
    d.activity = a.filter((x) => Date.parse(x.at) <= now + 6e4).sort((x, y) => y.at.localeCompare(x.at)).slice(0, 60).map((x, k) => ({ ...x, id: "a" + k }));
  }
  d.v = 3; return d;
}
