"use strict";
/* Ledger, workflow, insight and chart-maths tests. Loads the real scripts in one VM context, exactly as the browser does. */
const { test } = require("node:test"), assert = require("node:assert/strict"), fs = require("fs"), vm = require("vm");
const load = () => { const c = { localStorage: {}, console }; vm.createContext(c);
  const src = (f) => fs.readFileSync("js/" + f, "utf8").replace('typeof window !== "undefined" ? window : globalThis', "globalThis");
  vm.runInContext(["v2-core.js", "ledger.js", "data.js", "v2-data.js", "v3-data.js", "insights.js", "domain.js", "ui.js"].map((f) => (f === "ui.js" ? "const UI = { spline: " + fs.readFileSync("js/ui.js", "utf8").match(/function spline[\s\S]*?\n  }\n/)[0].replace("function spline", "function") + " };" : src(f))).join("\n") + ";this.db=seed();this.D=D;this.L=L;this.I=I;this.UI=UI;this.seed=seed;this.CAN=CAN_APPROVE;this.V2=V2;", c); return c; };
const ctx = load(), { D, L, I, UI } = ctx; const fresh = () => ctx.seed(); const owner = { by: "Business Owner" };

test("seed: revenue, cash and receivables reconcile with no double counting", () => {
  const db = fresh(), t = L.today(), all = L.range(db, "2000-01-01", t);
  const saleRev = db.sales.filter((s) => L.saleLive(s)).reduce((a, s) => a + s.total, 0), invRev = db.invoices.filter(L.invLive).reduce((a, i) => a + L.invNet(i), 0);
  assert.equal(all.revenue, saleRev + invRev);
  const rec = L.receivables(db), ids = rec.map((r) => r.kind + r.id); assert.equal(new Set(ids).size, ids.length);
  assert.equal(L.sumBal(rec), db.sales.filter((s) => !s.void).reduce((a, s) => a + s.total - L.salePaid(s), 0) + db.invoices.filter(L.invLive).reduce((a, i) => a + ctx.V2.bal(i), 0));
  const up = L.upcoming(db, 30), keys = up.map((u) => u.key); assert.equal(new Set(keys).size, keys.length); assert.ok(up.every((u) => u.due >= t));
  assert.ok(L.receivables(db).filter((r) => r.overdue).every((r) => !up.some((u) => u.key === "in:" + r.kind + r.id)), "overdue items are never also upcoming");
});
test("pending expenses are excluded until approved", () => {
  const db = fresh(), before = L.range(db, "2000-01-01", L.today()).expenses, e = db.expenses.find((x) => x.status === "pending");
  D.decide(db, "ex:" + e.id, "approve", owner); assert.equal(L.range(db, "2000-01-01", L.today()).expenses, before + e.amount);
});
test("sales workflow: stock, invoice, balance, ledger and dashboard all move together", () => {
  const db = fresh(), p = db.products[2], c = db.customers[2], stock = p.stock, bal = L.customerStats(db, c.id).balance, rev = L.range(db, L.today(), L.today()).revenue, n = db.sales.length;
  const s = D.createSale(db, { customerId: c.id, lines: [{ productId: p.id, qty: 3, price: p.price }], method: "M-Pesa", paid: 1000, soldBy: "em2" }, owner);
  assert.equal(db.sales.length, n + 1); assert.equal(p.stock, stock - 3); assert.equal(s.total, 3 * p.price);
  assert.equal(L.customerStats(db, c.id).balance, bal + s.total - 1000); assert.equal(L.range(db, L.today(), L.today()).revenue, rev + s.total);
  assert.equal(db.activity[0].act, "Recorded sale");
  D.paySale(db, s.id, { amount: s.total - 1000, method: "Cash", key: "k1" }, owner); assert.equal(L.salePaid(s), s.total);
  assert.equal(D.paySale(db, s.id, { amount: 5, key: "k1" }, owner).dup, true, "duplicate key ignored");
  assert.throws(() => D.paySale(db, s.id, { amount: 5, key: "k2" }, owner), /already fully paid/);
});
test("sales validation: stock, quantity, walk-in credit, credit limit", () => {
  const db = fresh(), p = db.products[0];
  assert.throws(() => D.createSale(db, { lines: [{ productId: p.id, qty: p.stock + 1, price: p.price }] }, owner), /in stock/);
  assert.throws(() => D.createSale(db, { lines: [{ productId: p.id, qty: 0, price: p.price }] }, owner), /quantity/);
  assert.throws(() => D.createSale(db, { lines: [{ productId: p.id, qty: 1, price: p.price }], paid: 1 }, owner), /Walk-in/);
  const c = db.customers[0]; c.creditLimit = 1000; assert.throws(() => D.createSale(db, { customerId: c.id, lines: [{ productId: p.id, qty: 1, price: p.price }], paid: 0 }, owner), (e) => e.code === "CREDIT");
  assert.ok(D.createSale(db, { customerId: c.id, lines: [{ productId: p.id, qty: 1, price: p.price }], paid: 0, overrideCredit: true }, owner));
});
test("voiding a sale restores stock and removes it from revenue and cash", () => {
  const db = fresh(), p = db.products[3], s = D.createSale(db, { lines: [{ productId: p.id, qty: 2, price: p.price }] }, owner), st = p.stock, r = L.range(db, L.today(), L.today());
  D.voidSale(db, s.id, owner); assert.equal(p.stock, st + 2); const r2 = L.range(db, L.today(), L.today()); assert.equal(r2.revenue, r.revenue - s.total); assert.equal(r2.collected, r.collected - s.total);
});
test("purchase workflow: draft, submit, approve, receive adds stock, pay supplier, complete", () => {
  const db = fresh(), p1 = db.products[1], p2 = db.products[4], sup = db.suppliers[0], s1 = p1.stock, s2 = p2.stock;
  const po = D.savePO(db, { supplierId: sup.id, lines: [{ productId: p1.id, qty: 10, unitCost: 1000 }, { productId: p2.id, qty: 5, unitCost: 2000 }], taxPct: 16, terms: 30 }, null, owner);
  assert.equal(L.poTotal(po), Math.round(20000 * 1.16)); assert.equal(po.status, "Draft");
  D.advancePO(db, po.id, owner); assert.equal(po.status, "Submitted"); assert.ok(L.approvals(db).some((a) => a.id === "po:" + po.id));
  assert.throws(() => D.advancePO(db, po.id, { by: "Employee" }), /cannot approve/); D.advancePO(db, po.id, owner);
  assert.equal(p1.stock, s1); D.advancePO(db, po.id, owner); assert.equal(p1.stock, s1 + 10); assert.equal(p2.stock, s2 + 5);
  assert.ok(L.payables(db).some((x) => x.id === po.id)); assert.throws(() => D.advancePO(db, po.id, owner), /in full/);
  D.paySupplier(db, po.id, { amount: 10000, key: "a" }, owner); D.paySupplier(db, po.id, {}, owner); assert.equal(L.poPaid(po), L.poTotal(po)); D.advancePO(db, po.id, owner); assert.equal(po.status, "Completed");
  assert.ok(!L.payables(db).some((x) => x.id === po.id));
});
test("purchase order validation and draft-only editing", () => {
  const db = fresh(), p = db.products[0], sup = db.suppliers[0];
  assert.throws(() => D.savePO(db, { supplierId: sup.id, lines: [] }, null, owner), /at least one/); assert.throws(() => D.savePO(db, { supplierId: sup.id, lines: [{ productId: p.id, qty: 1, unitCost: 0 }] }, null, owner), /price/);
  assert.throws(() => D.savePO(db, { supplierId: sup.id, lines: [{ productId: p.id, qty: 1, unitCost: 5 }, { productId: p.id, qty: 1, unitCost: 5 }] }, null, owner), /twice/);
  const po = D.savePO(db, { supplierId: sup.id, lines: [{ productId: p.id, qty: 1, unitCost: 5 }] }, null, owner); D.advancePO(db, po.id, owner); assert.throws(() => D.savePO(db, { supplierId: sup.id, lines: [{ productId: p.id, qty: 2, unitCost: 5 }] }, po.id, owner), /draft/);
});
test("invoice workflow: create, payment updates invoice, customer balance and cash; editing rules", () => {
  const db = fresh(), c = db.customers[4], before = L.customerStats(db, c.id).balance, n = db.invoices.length;
  const inv = D.saveDoc(db, { kind: "inv", cust: c.id, lines: [{ desc: "Delivery", qty: 2, price: 1000, disc: 0 }], issue: L.today(), days: 14, vat: 16, dtype: "pct", dval: 0, send: true }, owner);
  assert.equal(db.invoices.length, n + 1); assert.equal(inv.total, 2320); assert.equal(L.customerStats(db, c.id).balance, before + 2320);
  D.payInvoice(db, inv.id, { amount: 1000, key: "x" }, owner); assert.equal(L.customerStats(db, c.id).balance, before + 1320); assert.equal(D.payInvoice(db, inv.id, { amount: 1000, key: "x" }, owner).dup, true); assert.equal(inv.paid, 1000);
  assert.throws(() => D.saveDoc(db, { kind: "inv", editId: inv.id, cust: c.id, lines: [{ desc: "x", qty: 1, price: 1, disc: 0 }], issue: L.today(), days: 14, vat: 16 }, owner), /cannot be edited/);
  assert.throws(() => D.saveDoc(db, { kind: "inv", cust: c.id, lines: [{ desc: "x", qty: -1, price: 5, disc: 0 }], issue: L.today(), days: 14, vat: 16 }, owner), /quantity/);
  const dr = D.saveDoc(db, { kind: "inv", cust: c.id, lines: [{ desc: "a", qty: 1, price: 500, disc: 0 }], issue: L.today(), days: 14, vat: 0 }, owner); D.saveDoc(db, { kind: "inv", editId: dr.id, cust: c.id, lines: [{ desc: "a", qty: 2, price: 500, disc: 0 }], issue: L.today(), days: 14, vat: 0 }, owner); assert.equal(dr.total, 1000);
});
test("customers and suppliers: validation, opening balance, delete protection", () => {
  const db = fresh(); assert.throws(() => D.saveCustomer(db, { name: "A", phone: "123" }), /Kenyan phone/); assert.throws(() => D.saveCustomer(db, { name: "", phone: "0712345678" }), /required/); assert.throws(() => D.saveCustomer(db, { name: "A", phone: "0712345678", email: "bad" }), /email/);
  const c = D.saveCustomer(db, { name: "Zed Traders", phone: "0712 345 678", type: "Wholesale", opening: 5000, creditLimit: 100000, terms: 30 }, null, owner); assert.equal(L.customerStats(db, c.id).balance, 5000);
  assert.throws(() => D.saveCustomer(db, { name: "zed traders", phone: "0712345678" }), /already exists/); assert.throws(() => D.deleteCustomer(db, c.id), /owes money/);
  const e = D.saveCustomer(db, { name: "Empty Co", phone: "0733111222" }, null, owner); D.deleteCustomer(db, e.id); assert.ok(!db.customers.some((x) => x.id === e.id));
  assert.throws(() => D.deleteCustomer(db, db.customers[0].id), /cannot be deleted/); assert.throws(() => D.saveSupplier(db, { name: "S", phone: "0712345678", pin: "bad" }), /PIN/);
  const s = D.saveSupplier(db, { name: "New Supplier", phone: "0712345678", opening: 9000 }, null, owner); assert.equal(L.supplierStats(db, s.id).balance, 9000);
});
test("approvals respect roles and expenses need approval above the limit", () => {
  const db = fresh(), n = L.approvals(db).length; assert.throws(() => D.decide(db, L.approvals(db)[0].id, "approve", { by: "Sales Manager" }), /cannot approve/); assert.equal(L.approvals(db).length, n);
  const x = D.saveExpense(db, { category: "Rent", description: "Big", amount: 90000, method: "Cash" }, null, { by: "Inventory Manager" }); assert.equal(x.status, "pending"); const y = D.saveExpense(db, { category: "Rent", description: "Big2", amount: 90000, method: "Cash" }, null, owner); assert.equal(y.status, "approved");
  assert.throws(() => D.saveExpense(db, { category: "Rent", description: "x", amount: 0 }, null, owner), /at least 1/); assert.throws(() => D.saveExpense(db, { category: "Rent", description: "x", amount: 5, date: "2999-01-01" }, null, owner), /future/);
  const a = L.approvals(db).find((z) => z.id.startsWith("pp:")); const po = db.pos.find((q) => q.id === a.rid), paid = L.poPaid(po); D.decide(db, a.id, "approve", owner); assert.equal(L.poPaid(po), paid + a.amount);
});
test("health score is deterministic, bounded and explainable; insights carry the required parts", () => {
  const db = fresh(), a = I.health(db), b = I.health(db); assert.deepEqual(a, b); assert.ok(a.score >= 0 && a.score <= 100); assert.equal(a.components.length, 6);
  assert.equal(Math.round(a.components.reduce((s, c) => s + c.score * c.weight, 0) / 100), a.score); a.components.forEach((c) => assert.ok(c.rule && c.value && c.status));
  const ins = I.insights(db); assert.ok(ins.length >= 4); ins.forEach((i) => { assert.ok(i.title && i.data && i.why && i.action && i.href); assert.ok(!/\bundefined|NaN\b/.test(JSON.stringify(i))); });
});
test("action centre: de-duplicated, sorted by severity, every item links somewhere", () => {
  const db = fresh(), acts = I.actions(db), ids = acts.map((a) => a.id); assert.equal(new Set(ids).size, ids.length); const rank = { critical: 0, high: 1, medium: 2 }; for (let i = 1; i < acts.length; i++) assert.ok(rank[acts[i - 1].sev] <= rank[acts[i].sev]);
  acts.forEach((a) => assert.ok(a.route && a.cta && a.title)); const lowP = db.products.find((p) => p.stock <= p.reorder && p.stock > 0); const po = D.savePO(db, { supplierId: lowP.supplierId, lines: [{ productId: lowP.id, qty: 50, unitCost: 10 }] }, null, owner); D.advancePO(db, po.id, owner);
  assert.ok(!I.actions(db).some((a) => a.id === "low" && a.detail.includes(lowP.name)), "stock already on order is not alerted again");
});
test("daily summary uses real numbers and handles an empty day", () => {
  const db = fresh(), s = I.dailySummary(db); assert.equal(s.revenue, L.range(db, L.today(), L.today()).revenue); assert.ok(/KSh/.test(s.text));
  db.sales = db.sales.filter((x) => L.dayOf(x.date) !== L.today()); db.invoices = db.invoices.filter((x) => x.issue !== L.today()); assert.match(I.dailySummary(db).text, /No sales or invoices/);
});
test("chart buckets are derived from transactions and add up", () => {
  const db = fresh(), b = L.buckets(db, "day", 30), tot = L.range(db, b[0].from, b[29].to); assert.equal(b.reduce((a, x) => a + x.Revenue, 0), tot.revenue); assert.equal(b.reduce((a, x) => a + x.Expenses, 0), tot.expenses);
  const m = L.buckets(db, "month", 12); assert.equal(m.length, 12); assert.equal(m.reduce((a, x) => a + x.Revenue, 0), L.range(db, m[0].from, m[11].to).revenue);
});
test("spline is smooth, passes through points and never overshoots", () => {
  const pts = [[0, 100], [10, 100], [20, 20], [30, 20], [40, 90]], d = UI.spline(pts); assert.ok(/C/.test(d) && !/L/.test(d)); const nums = d.match(/-?\d+\.\d/g).map(Number);
  assert.deepEqual(nums.slice(-2), [40, 90]); for (let i = 1; i < nums.length; i += 2) assert.ok(nums[i] <= 100.01 && nums[i] >= 19.99, "no overshoot: " + nums[i]);
});
test("legacy data (no v3 fields) migrates in place without losing records", () => {
  const db = fresh(); delete db.activity; delete db.v; db.sales.forEach((s) => { delete s.pays; delete s.due; delete s.soldBy; }); const n = db.sales.length, paid = db.sales.reduce((a, s) => a + s.paid, 0); const m = vm.runInContext("withV3", ctx)(db);
  assert.equal(m.sales.length, n); assert.equal(m.sales.reduce((a, s) => a + L.salePaid(s), 0), paid); assert.equal(m.v, 3); assert.ok(m.activity.length);
});
