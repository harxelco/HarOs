"use strict";
/* Tests for the Command Centre, sharing, PDF, employee, supplier, PO and CRUD work. Run with: npm test */
const { test } = require("node:test"), assert = require("node:assert/strict"), fs = require("fs"), path = require("path"), { JSDOM, VirtualConsole } = require("jsdom");
const root = path.join(__dirname, ".."), errors = [];
function boot(hash) {
  let html = fs.readFileSync(path.join(root, "index.html"), "utf8").replace(/<link[^>]*>/g, "").replace(/<script src="([^"]+)"><\/script>/g, (_, f) => "<script>" + fs.readFileSync(path.join(root, f), "utf8").replace(/<\/script>/g, "<\\/script>") + "</script>");
  const vc = new VirtualConsole(); vc.on("jsdomError", (e) => errors.push("jsdomError: " + e.message)); vc.on("error", (...a) => errors.push("console.error: " + a.join(" ")));
  errors.length = 0;
  const dom = new JSDOM(html, { url: "http://localhost/" + (hash ? "#" + hash : ""), runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc, beforeParse(win) { win.scrollTo = () => {}; } }); return dom.window;
}
const go = async (w, h) => { w.location.hash = h; await new Promise((r) => setTimeout(r, 20)); };
const view = (w) => w.document.querySelector("#view").innerHTML, txt = (w) => w.document.querySelector("#view").textContent;
const click = (w, sel) => { const e = w.document.querySelector(sel); assert.ok(e, "missing " + sel); e.click(); };
const submit = (w, vals) => { Object.entries(vals).forEach(([k, v]) => { const e = w.document.querySelector("#mf-" + k); e.value = v; }); w.document.querySelector("#mform").dispatchEvent(new w.Event("submit", { cancelable: true, bubbles: true })); };

test("PDF generator output is a structurally valid PDF containing the document text", () => {
  const P = require("../js/pdf.js"), b = P.build({ biz: { name: "Apex", address: "Nairobi", phone: "1", email: "a@b.c" }, title: "INVOICE", number: "AGS-INV-1", billTo: { name: "Jo (Test)" }, meta: [["Status", "Sent"]], lines: Array.from({ length: 40 }, (_, i) => ({ desc: "Item " + i, qty: 1, price: "KSh 1", disc: "0%", amount: "KSh 1" })), totals: [["Total", "KSh 40", 1]], payment: ["Bank"], notes: "n", terms: "t" });
  const s = Buffer.from(b).toString("latin1"); assert.ok(s.startsWith("%PDF-1.4") && s.trim().endsWith("%%EOF"));
  const off = Number(s.match(/startxref\n(\d+)/)[1]); assert.ok(s.slice(off).startsWith("xref"));
  [...s.matchAll(/(\d{10}) 00000 n/g)].forEach((m, i) => assert.ok(s.slice(Number(m[1])).startsWith(i + 1 + " 0 obj"), "xref offset " + i));
  assert.ok(/\/Count 2/.test(s), "40 lines must paginate"); assert.ok(s.includes("AGS-INV-1") && s.includes("Jo \\(Test\\)"));
});
test("every route and detail route renders without errors", async () => {
  const w = boot("/"), D = w.eval("db"); assert.equal(w.document.querySelector("#view").textContent.includes("Command Centre"), true);
  for (const r of ["/command", "/employee/" + D.employees[0].id, "/customer/" + D.customers[0].id, "/supplier/" + D.suppliers[0].id, "/product/" + D.products[0].id, "/invoice/" + D.invoices[0].id, "/quote/" + D.quotes[0].id, "/employee/nope", "/customer/nope"]) { await go(w, r); const v = view(w); assert.ok(v.length > 100, r); assert.ok(!/NaN|undefined|\[object/.test(v), "bad text " + r); }
  assert.ok(!w.document.querySelector(".nav[href='#/command']"), "no second dashboard in navigation"); assert.deepEqual(errors, []);
});
test("dashboard figures equal the dataset and every filter changes them", async () => {
  const w = boot("/"), out = {};
  for (const d of [1, 7, 30, 90, 365]) { w.eval("ui.days=" + d + ";render()"); await go(w, "/"); const p = w.eval("period(db," + d + ")").cur; out[d] = p.revenue; assert.ok(txt(w).includes(w.eval("money(" + p.revenue + ")")), "revenue shown for " + d); assert.equal(w.document.querySelectorAll(".chart").length, 2); assert.ok(w.document.querySelector(".chart svg path[fill^='url(#g-']"), "area fill"); }
  assert.ok(out[7] < out[30] && out[30] < out[365]);
  const recv = w.eval("receivable(db)"), sales = w.eval("db.sales.reduce((a,s)=>a+s.total-s.paid,0)"), inv = w.eval("db.invoices.filter(i=>!['draft','cancelled'].includes(i.status)).reduce((a,i)=>a+invBal(i),0)"); assert.equal(recv, sales + inv);
  assert.deepEqual(errors, []);
});
test("business health follows the data and explains itself", async () => {
  const w = boot("/"); w.eval("db.tasks.forEach(t=>t.status='Completed');db.products.forEach(p=>p.stock=p.reorder+50);db.invoices.forEach(i=>{i.paid=i.total;});db.sales.forEach(s=>s.paid=s.total);ui.days=365"); await go(w, "/"); assert.ok(/Healthy/.test(txt(w)), "all good data should be healthy");
  w.eval("db.tasks.slice(0,3).forEach(t=>{t.status='To Do';t.due=new Date(Date.now()-5*864e5).toISOString()});db.products.slice(0,3).forEach(p=>p.stock=0)"); await go(w, "/"); assert.ok(/At risk/.test(txt(w))); assert.ok(/not from a score/.test(txt(w))); assert.ok(/No external AI service/.test(txt(w)));
});
test("approvals: approver can approve from dashboard, other roles cannot", async () => {
  const w = boot("/"), po = () => w.eval("db.pos.filter(p=>p.status==='Submitted')"); const n = po().length; assert.ok(n > 0);
  click(w, "#view [data-act=advance]"); assert.equal(po().length, n - 1);
  w.eval("role='Sales Manager'"); const id = po()[0].id; w.eval("A.advance({dataset:{id:'" + id + "'}})"); assert.equal(po().length, n - 1, "still submitted"); assert.deepEqual(errors, []);
});
test("purchase order with several lines: totals, receiving updates stock per line, payment is partial-safe", async () => {
  const w = boot("/"); await go(w, "/purchases"); const before = w.eval("db.products.map(p=>p.stock)"); w.eval("A.poForm({dataset:{}})"); w.eval("ui.po.lines=[{productId:db.products[0].id,qty:5,unitCost:100},{productId:db.products[1].id,qty:7,unitCost:200}]"); w.eval("A.poPaint()"); click(w, "#msubmit");
  const po = w.eval("db.pos.at(-1)"); assert.equal(po.lines.length, 2); assert.equal(w.eval("poTotal(db.pos.at(-1))"), 1900); assert.equal(po.status, "Draft");
  for (let i = 0; i < 3; i++) w.eval("A.advance({dataset:{id:db.pos.at(-1).id}})"); const after = w.eval("db.products.map(p=>p.stock)"); assert.equal(after[0], before[0] + 5); assert.equal(after[1], before[1] + 7);
  w.eval("A.paysup({dataset:{id:db.pos.at(-1).id}})"); submit(w, { amount: 500 }); assert.equal(w.eval("db.pos.at(-1).paid"), 500); w.eval("A.paysup({dataset:{id:db.pos.at(-1).id}})"); submit(w, { amount: 9999 }); assert.equal(w.eval("db.pos.at(-1).paid"), 500, "overpayment rejected");
  assert.equal(w.eval("stockMoves(db,db.products[0].id).filter(m=>m.type==='Purchase received').length>0"), true); assert.deepEqual(errors, []);
});
test("employee profile: tasks link by id, edit and assign update the same records", async () => {
  const w = boot("/"), em = w.eval("db.employees[1]"); await go(w, "/employee/" + em.id); const t = txt(w); for (const x of [em.empNo, "Completion rate", "Workload", "Recent activity", "Current work"]) assert.ok(t.includes(x), x);
  const s = w.eval("PageHelpers.empStats('" + em.id + "')"); assert.equal(s.total, w.eval("db.tasks.filter(t=>t.assigneeId==='" + em.id + "').length")); assert.equal(s.done + s.pending, s.total);
  w.eval("A.taskForm({dataset:{emp:'" + em.id + "'}})"); submit(w, { title: "Linked task", description: "d", due: "2099-01-01", priority: "High" }); assert.ok(w.eval("db.tasks.some(t=>t.title==='Linked task'&&t.assigneeId==='" + em.id + "')")); assert.ok(txt(w).includes("Linked task"));
  w.eval("A.employeeForm({dataset:{id:'" + em.id + "'}})"); submit(w, { name: em.name, title: "Senior Role", department: em.department, phone: "0733 000 111", email: "bad" }); assert.ok(w.document.querySelector("#mform"), "invalid email keeps form open"); submit(w, { name: em.name, title: "Senior Role", department: em.department, phone: "0733 000 111", email: "ok@x.example" });
  assert.equal(w.eval("db.employees[1].title"), "Senior Role"); w.eval("role='Sales Manager'"); w.eval("A.employeeForm({dataset:{id:'" + em.id + "'}})"); assert.ok(!w.document.querySelector("#mform"), "non-owner cannot edit"); assert.deepEqual(errors, []);
});
test("CRUD guards, confirmations and double-submit protection", async () => {
  const w = boot("/"), c = w.eval("db.customers[0].id"); w.eval("A.delCustomer({dataset:{id:'" + c + "'}})"); assert.ok(!w.document.querySelector("#mok"), "customer with records cannot be deleted");
  w.eval("A.customerForm({dataset:{}})"); const n = w.eval("db.customers.length"); const f = w.document.querySelector("#mform"); ["name", "phone"].forEach((k, i) => (w.document.querySelector("#mf-" + k).value = ["New Co", "0711222333"][i])); f.dispatchEvent(new w.Event("submit", { cancelable: true, bubbles: true })); f.dispatchEvent(new w.Event("submit", { cancelable: true, bubbles: true })); assert.equal(w.eval("db.customers.length"), n + 1, "submitted once");
  const id = w.eval("db.customers.at(-1).id"); w.eval("A.delCustomer({dataset:{id:'" + id + "'}})"); assert.ok(w.document.querySelector("#mok")); click(w, "#mok"); assert.equal(w.eval("db.customers.length"), n);
  w.eval("A.delSupplier({dataset:{id:db.suppliers[0].id}})"); assert.ok(!w.document.querySelector("#mok")); assert.deepEqual(errors, []);
});
test("sale form validates stock, updates stock and dashboard figures", async () => {
  const w = boot("/"), p = JSON.parse(JSON.stringify(w.eval("db.products[0]"))); w.eval("A.saleForm()"); const f = () => w.document.querySelector("#mform");
  submit(w, { customer: w.eval("db.customers[0].id"), product: p.id, qty: p.stock + 5, method: "Cash", paid: "" }); assert.ok(/in stock/.test(f().textContent), "stock error"); const rev = w.eval("period(db,30).cur.revenue");
  submit(w, { customer: w.eval("db.customers[0].id"), product: p.id, qty: 1, method: "Cash", paid: "" }); assert.equal(w.eval("db.products[0].stock"), p.stock - 1); assert.equal(w.eval("period(db,30).cur.revenue"), rev + p.price); assert.deepEqual(errors, []);
});
test("sharing: invoice and quotation use one component; messages, phone and email validation are correct", async () => {
  const w = boot("/"); const V = w.eval("Val"); for (const [i, e] of [["0712345678", "254712345678"], ["+254 712 345 678", "254712345678"], ["254112345678", "254112345678"], ["712345678", "254712345678"]]) assert.equal(V.kePhone(i).e164, e);
  for (const bad of ["12345", "0812345678", "+255712345678", ""]) assert.equal(V.kePhone(bad).ok, false, bad); assert.ok(V.validEmail("a@b.co") && !V.validEmail("a@b") && !V.validEmail("a b@c.com"));
  for (const k of ["inv", "q"]) { const d = w.eval(k === "inv" ? "db.invoices[1]" : "db.quotes[1]"); const m = w.eval("ShareDoc.message(DocModel('" + k + "', " + JSON.stringify(d) + "))"); assert.ok(m.includes("Document Number: " + d.number) && m.includes("Apex General Supplies Ltd.") && /Amount: KES [\d,]+/.test(m) && m.startsWith("Hello "), k);
    await go(w, k === "inv" ? "/invoice/" + d.id : "/quote/" + d.id); click(w, "[data-act=shareDoc]"); const t = w.document.querySelector(".modal").textContent; for (const x of [d.number, "Preview", "Download PDF", "WhatsApp", "Email"]) assert.ok(t.includes(x), x); w.document.querySelector("[data-act=mclose]").click(); }
  const pdf = w.eval("Array.from(ShareDoc.pdfOf('inv', db.invoices[1]).bytes)"); assert.equal(Buffer.from(pdf).toString("latin1").slice(0, 5), "%PDF-");
  await go(w, "/invoice/" + w.eval("db.invoices[1].id")); click(w, "[data-act=shareDoc]"); click(w, "[data-act=shWa]"); w.document.querySelector("#sh-to").value = "99"; w.document.querySelector("#sh-form").dispatchEvent(new w.Event("submit", { cancelable: true, bubbles: true })); assert.ok(/valid Kenyan/.test(w.document.querySelector("#sh-err").textContent));
  click(w, "[data-act=shMail]"); w.document.querySelector("#sh-to").value = "nope"; w.document.querySelector("#sh-form").dispatchEvent(new w.Event("submit", { cancelable: true, bubbles: true })); assert.ok(/valid email/.test(w.document.querySelector("#sh-err").textContent)); assert.deepEqual(errors, []);
});
test("saving an invoice opens the completion dialog without leaving the document", async () => {
  const w = boot("/"); await go(w, "/invoices"); click(w, "#view [data-act=newDoc]"); await go(w, "/new"); w.eval("ui.draft.cust=db.customers[0].id;ui.draft.lines=[{pid:'',desc:'Delivery',qty:2,price:1000,disc:0}];ui.draft.vat=16"); await go(w, "/new"); click(w, "[data-act=saveDoc][data-send='1']");
  const t = w.document.querySelector(".modal").textContent; assert.ok(/Invoice created/.test(t) && t.includes(w.eval("db.invoices[0].number")) && t.includes(w.eval("db.customers[0].name")) && t.includes("2,320"));
  assert.ok(w.location.hash.startsWith("#/invoice/")); assert.deepEqual(errors, []);
});
test("quick actions list respects role and opens the right form", async () => {
  const w = boot("/"); w.eval("A.quick()"); assert.equal(w.document.querySelectorAll(".qa-item").length, 9); click(w, ".qa-item:nth-child(1)"); await new Promise((r) => setTimeout(r, 10)); assert.ok(w.document.querySelector("#mf-phone"), "customer form");
  w.eval("UI.closeModal()"); w.eval("role='Employee'"); w.eval("A.quick()"); assert.ok(w.document.querySelectorAll(".qa-item").length <= 2); assert.deepEqual(errors, []);
});
test("demo reset restores the seeded relationships with no duplicates", async () => {
  const w = boot("/"), ids = () => JSON.stringify(w.eval("[db.customers.length,db.invoices.length,db.sales.length,db.pos.length,db.tasks.length,db.employees.length,db.suppliers.length,db.products.length]"));
  const base = ids(); w.eval("A.customerForm({dataset:{}})"); submit(w, { name: "Temp", phone: "0711222333" }); w.eval("db.tasks.pop();db.sales.pop();db.pos.push({id:'x',ref:'PO-X',supplierId:'nope',lines:[],status:'Draft',paid:0,date:''})"); assert.notEqual(ids(), base);
  w.eval("A.reset()"); click(w, "#mok"); assert.equal(ids(), base);
  const D = w.eval("db"); assert.ok(D.tasks.every((t) => D.employees.some((e) => e.id === t.assigneeId))); assert.ok(D.pos.every((p) => D.suppliers.some((s) => s.id === p.supplierId) && p.lines.every((l) => D.products.some((x) => x.id === l.productId)))); assert.ok(D.invoices.every((i) => D.customers.some((c) => c.id === i.customerId))); assert.ok(D.sales.every((s) => D.customers.some((c) => c.id === s.customerId)));
  assert.equal(new Set(D.employees.map((e) => e.empNo)).size, D.employees.length); assert.equal(new Set(D.pos.map((p) => p.ref)).size, D.pos.length); assert.deepEqual(errors, []);
});
