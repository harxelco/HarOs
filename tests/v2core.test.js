"use strict";
const { test } = require("node:test"), assert = require("node:assert/strict"), fs = require("fs"), vm = require("vm");
const V2 = require("../js/v2-core.js");
const inv = (o = {}) => ({ id: "i", status: "sent", total: 100000, paid: 0, credited: 0, due: "2026-12-01", ...o });
const P = (amount, key) => ({ amount, key, method: "M-Pesa", ref: "X", by: "u", date: "2026-11-03" });
test("totals with line discount, invoice discount, VAT", () => { const t = V2.totals([{ qty: 2, price: 50000, disc: 10 }, { qty: 1, price: 20000 }], { type: "fixed", v: 5000 }, 16); assert.deepEqual([t.sub, t.disc, t.tax, t.total], [110000, 5000, 16800, 121800]); });
test("KSh 100,000 paid 40,000 then 60,000", () => {
  const ps = []; let a = V2.pay(inv(), ps, P(40000, "a")); ps.push(a.payment); assert.equal(V2.dstatus(a.inv, "2026-11-03").status, "partially_paid");
  const b = V2.pay(a.inv, ps, P(60000, "b")); ps.push(b.payment); assert.equal(V2.dstatus(b.inv, "2026-11-03").status, "paid"); assert.equal(ps.length, 2);
});
test("duplicate key ignored; invalid payments rejected", () => {
  const a = V2.pay(inv(), [], P(10, "k")); assert.equal(V2.pay(a.inv, [a.payment], P(10, "k")).dup, true);
  assert.throws(() => V2.pay(inv(), [], P(100001, "o"))); assert.throws(() => V2.pay(inv(), [], P(0, "z"))); assert.throws(() => V2.pay(inv({ status: "draft" }), [], P(5, "d"))); assert.throws(() => V2.pay(inv({ status: "cancelled" }), [], P(5, "c")));
});
test("overdue and credited", () => { assert.equal(V2.dstatus(inv({ due: "2026-10-01" }), "2026-11-03").overdue, true); assert.equal(V2.dstatus(inv({ credited: 100000 }), "2026-11-03").status, "credited"); });
test("quotation converts once and only when accepted", () => {
  const q = { id: "q1", status: "accepted", customerId: "c1", lines: [{ qty: 1, price: 5 }], vat: 16 }; assert.equal(V2.convert(q, []).fromQuote, "q1");
  assert.throws(() => V2.convert(q, [{ fromQuote: "q1" }])); assert.throws(() => V2.convert({ ...q, status: "sent" }, []));
});
test("ageing buckets", () => assert.deepEqual(V2.age([inv({ due: "2026-12-01", total: 1 }), inv({ due: "2026-10-20", total: 2 }), inv({ due: "2026-09-20", total: 3 }), inv({ due: "2026-08-10", total: 4 }), inv({ due: "2026-01-01", total: 5 }), inv({ status: "draft", total: 9, due: "2026-01-01" })], "2026-11-03"), { current: 1, d1_30: 2, d31_60: 3, d61_90: 4, d90: 5 }));
test("cashbook running balance", () => { const c = V2.cashbook([{ date: "2026-11-02", in: 100 }, { date: "2026-11-01", out: 30 }, { date: "2026-11-02", out: 20 }], 50); assert.deepEqual(c.map((x) => x.close), [20, 100]); });
test("seed is internally consistent and deterministic in shape", () => {
  const load = () => { const c = { localStorage: {}, window: {}, console }; vm.createContext(c); vm.runInContext(fs.readFileSync("js/v2-core.js", "utf8").replace("typeof window !== \"undefined\" ? window : globalThis", "globalThis") + fs.readFileSync("js/data.js", "utf8") + fs.readFileSync("js/v2-data.js", "utf8") + ";this.D=seed();", c); return c.D; };
  const a = load(), b = load(); const sig = (x) => JSON.stringify(x.invoices.map((i) => [i.number, i.total, i.paid, i.status, i.customerId]).concat(x.payments.map((p) => [p.amount, p.invoiceId])));
  assert.equal(sig(a), sig(b));
  const cust = new Set(a.customers.map((x) => x.id)), prod = new Set(a.products.map((x) => x.id));
  a.invoices.forEach((i) => { assert.ok(cust.has(i.customerId)); i.lines.forEach((l) => assert.ok(prod.has(l.pid))); const sum = a.payments.filter((p) => p.invoiceId === i.id).reduce((x, p) => x + p.amount, 0); assert.equal(sum, i.paid); assert.ok(i.paid <= i.total); });
  a.payments.forEach((p) => assert.ok(a.invoices.some((i) => i.id === p.invoiceId)));
  a.quotes.filter((q) => q.status === "converted").forEach((q) => assert.equal(a.invoices.find((i) => i.id === q.invoiceId).fromQuote, q.id));
  assert.ok(a.invoices.length >= 14 && a.quotes.length >= 8 && a.payments.length >= 8);
});
