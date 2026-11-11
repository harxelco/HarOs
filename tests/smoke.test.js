"use strict";
/* jsdom smoke test: opens every route, runs the new payment/quote flows, fails on any console error or empty page. */
const { test } = require("node:test"), assert = require("node:assert/strict"), fs = require("fs"), path = require("path"), { JSDOM, VirtualConsole } = require("jsdom");
const root = path.join(__dirname, ".."), errors = [];
function boot(hash) {
  let html = fs.readFileSync(path.join(root, "index.html"), "utf8").replace(/<link[^>]*>/g, "").replace(/<script src="([^"]+)"><\/script>/g, (_, f) => "<script>" + fs.readFileSync(path.join(root, f), "utf8").replace(/<\/script>/g, "<\\/script>") + "</script>");
  const vc = new VirtualConsole(); vc.on("jsdomError", (e) => errors.push("jsdomError: " + e.message)); vc.on("error", (...a) => errors.push("console.error: " + a.join(" ")));
  errors.length = 0;
  const dom = new JSDOM(html, { url: "http://localhost/" + (hash ? "#" + hash : ""), runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc, beforeParse(win) { win.scrollTo = () => {}; } }); return dom.window;
}
const go = async (w, h) => { w.location.hash = h; await new Promise((r) => setTimeout(r, 20)); };
const view = (w) => w.document.querySelector("#view").innerHTML;
const ROUTES = ["/", "/notifications", "/sales", "/crm", "/customers", "/quotes", "/invoices", "/portal", "/inventory", "/purchases", "/tasks", "/employees", "/finance", "/cashbook", "/reports", "/assistant", "/new"];
const SKIP = ["shareDoc", "quick", "printInv", "printQ", "pubPrint", "receipt", "invCsv", "cbCsv", "copy", "reset", "draftPrint", "csv", "print"];

test("every route renders content with no NaN/undefined and no console errors", async () => {
  const w = boot("/");
  for (const r of ROUTES) { await go(w, r); const v = view(w); assert.ok(v.length > 150, "empty page: " + r); assert.ok(!/NaN|undefined|\[object/.test(v), "bad text on " + r); }
  assert.deepEqual(errors, []);
});
test("click every primary button on the new module pages", async () => {
  const w = boot("/");
  for (const r of ["/", "/employees", "/purchases", "/inventory", "/quotes", "/invoices", "/portal", "/cashbook"]) { await go(w, r);
    for (const b of [...w.document.querySelectorAll("#view [data-act]")]) { if (SKIP.includes(b.dataset.act) || !b.isConnected) continue; b.click(); }
    await go(w, r); assert.ok(view(w).length > 150, "page emptied: " + r); }
  assert.deepEqual(errors, []);
});
test("partial payments, duplicate protection and paid status through the UI", async () => {
  const w = boot("/"), D = () => w.eval("db"), inv = () => D().invoices.find((i) => i.number === "AGS-INV-2008");
  assert.equal(inv().status, "sent");
  w.eval("ui.cur='" + inv().id + "';ui.payKey='k1'"); await go(w, "/invoice");
  const pay = (amt) => { w.document.querySelector("#ip-a").value = amt; w.document.querySelector('[data-act="ipay"]').click(); };
  const total = inv().total; pay(Math.round(total * 0.4)); assert.equal(w.eval("V2.dstatus(db.invoices.find(i=>i.number==='AGS-INV-2008'),'2099-01-01').status"), "partially_paid");
  w.eval("ui.payKey='k1'"); const before = D().payments.length; pay(5); assert.equal(D().payments.length, before, "duplicate key must not create a payment");
  w.eval("ui.payKey='k2'"); await go(w, "/invoice"); pay(total - inv().paid); assert.equal(w.eval("V2.dstatus(db.invoices.find(i=>i.number==='AGS-INV-2008'),'2099-01-01').status"), "paid");
  assert.equal(D().payments.filter((p) => p.invoiceId === inv().id).length, 2); assert.deepEqual(errors, []);
});
test("public link marks viewed only when opened; quotation accept then convert once", async () => {
  const w = boot("/"), D = () => w.eval("db"), i7 = D().invoices.find((i) => i.number === "AGS-INV-2008"), q = D().quotes.find((x) => x.status === "sent");
  assert.equal(D().invoices.find((i) => i.number === "AGS-INV-2005").status, "sent"); await go(w, "/p/i/" + D().invoices.find((i) => i.number === "AGS-INV-2005").token);
  assert.equal(D().invoices.find((i) => i.number === "AGS-INV-2005").status, "viewed"); assert.ok(view(w).includes("INVOICE"));
  await go(w, "/p/q/" + q.token); w.document.querySelector('[data-act="qResp"][data-v="accepted"]').click(); assert.equal(D().quotes.find((x) => x.id === q.id).status, "accepted");
  await go(w, "/quote"); w.eval("ui.cur='" + q.id + "'"); await go(w, "/quotes"); await go(w, "/quote"); const n = D().invoices.length; w.document.querySelector('[data-act="convert"]').click(); assert.equal(D().invoices.length, n + 1);
  assert.equal(D().quotes.find((x) => x.id === q.id).status, "converted"); await go(w, "/p/i/nonexistent"); assert.ok(view(w).includes("Link not found")); assert.deepEqual(errors, []);
});
test("builder saves an invoice and totals are correct", async () => {
  const w = boot("/"); await go(w, "/invoices"); w.document.querySelector('[data-act="newDoc"]').click(); await go(w, "/new");
  const D = () => w.eval("db"), dd = w.eval("ui.draft"); w.eval("db.customers[0].creditLimit=0;ui.draft.cust=db.customers[0].id;ui.draft.lines=[{pid:'',desc:'Delivery',qty:2,price:1000,disc:0}];ui.draft.vat=16"); await go(w, "/new");
  const n = D().invoices.length; w.document.querySelector('[data-act="saveDoc"][data-send="1"]').click(); assert.equal(D().invoices.length, n + 1); assert.equal(D().invoices[0].total, 2320); assert.equal(D().invoices[0].status, "sent"); assert.deepEqual(errors, []);
});
