"use strict";
/* Harxel Business OS: domain layer.
   Every business workflow lives here as a plain function of `db`: validate, change every connected record in one step, log activity.
   The UI only collects input and renders. Because nothing here touches the DOM, workflows are unit-tested (tests/domain.test.js).
   Production note: these functions map one-to-one to server transactions (for example Supabase RPCs) when the demo is moved to a real backend. */
const D = (function () {
  const R = Math.round, uid = () => Math.random().toString(36).slice(2, 9);
  const fail = (m, code) => { const e = new Error(m); if (code) e.code = code; throw e; };
  const int = (v) => (v === "" || v == null ? NaN : Number(v));
  const rules = {
    phone: (v) => (/^(?:\+?254|0)[17]\d{8}$/.test(String(v).replace(/[\s-]/g, "")) ? "" : "Enter a Kenyan phone number, for example 0712 345 678."),
    email: (v) => (!v || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? "" : "Enter a valid email address, for example name@company.co.ke."),
    pin: (v) => (!v || /^[AP]\d{9}[A-Z]$/i.test(String(v).trim()) ? "" : "A KRA PIN looks like P051234567X."),
    date: (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v || "") && !isNaN(Date.parse(v)) ? "" : "Choose a valid date."),
  };
  const who = (o) => (o && o.by) || "Business Owner";
  const log = (db, by, act, ref, route, rid) => {
    db.activity = db.activity || []; db.activity.unshift({ id: "a" + Date.now().toString(36) + uid(), at: new Date().toISOString(), who: by, act, ref, route, rid });
    if (db.activity.length > 300) db.activity.length = 300;
  };
  const maxNo = (list, f, base) => Math.max(base, ...list.map((x) => Number(String(f(x)).split("-").pop()) || 0));
  const text = (v, label, max, req) => { v = String(v == null ? "" : v).trim(); if (req && !v) fail(`${label} is required.`); if (v.length > max) fail(`${label} must be ${max} characters or fewer.`); return v; };
  const money = (v, label, o) => { o = o || {}; const n = int(v); if (!Number.isFinite(n)) fail(`${label} must be a number.`); if (!Number.isInteger(n)) fail(`${label} must be a whole amount in KSh.`); if (o.min != null && n < o.min) fail(`${label} must be ${o.min === 0 ? "zero or more" : "at least " + o.min}.`); if (n > 1e9) fail(`${label} is too large.`); return n; };
  const emp = (db, id) => (db.employees.find((e) => e.id === id) || {}).name;
  const cust = (db, id) => (db.customers.find((c) => c.id === id) || { name: "Walk-in" }).name;
  const supName = (db, id) => (db.suppliers.find((s) => s.id === id) || { name: "Supplier" }).name;

  /* ---------- customers ---------- */
  function saveCustomer(db, d, id, o) {
    const c = { name: text(d.name, "Customer name", 80, true), businessName: text(d.businessName, "Business name", 80), type: ["Retail", "Wholesale"].includes(d.type) ? d.type : "Retail", phone: text(d.phone, "Phone", 20, true), email: text(d.email, "Email", 80), location: text(d.location, "Location", 60),
      category: text(d.category || "Standard", "Category", 30), notes: text(d.notes, "Notes", 300), salespersonId: d.salespersonId || "", terms: d.terms === "" || d.terms == null ? 14 : money(d.terms, "Payment terms", { min: 0 }), creditLimit: d.creditLimit === "" || d.creditLimit == null ? 0 : money(d.creditLimit, "Credit limit", { min: 0 }) };
    if (c.terms > 180) fail("Payment terms can be at most 180 days.");
    if (rules.phone(c.phone)) fail(rules.phone(c.phone)); if (rules.email(c.email)) fail(rules.email(c.email));
    if (c.salespersonId && !db.employees.some((e) => e.id === c.salespersonId)) fail("Choose a salesperson from the list.");
    const dupe = db.customers.find((x) => x.id !== id && x.name.toLowerCase() === c.name.toLowerCase() && x.phone.replace(/\s/g, "") === c.phone.replace(/\s/g, ""));
    if (dupe) fail("A customer with this name and phone number already exists.");
    const opening = id ? 0 : d.opening === "" || d.opening == null ? 0 : money(d.opening, "Opening balance", { min: 0 });
    if (id) { const x = db.customers.find((y) => y.id === id); if (!x) fail("Customer not found."); Object.assign(x, c); log(db, who(o), "Updated customer", x.name, "/customers", x.id); return x; }
    const x = { id: "c" + uid(), created: new Date().toISOString(), ...c }; db.customers.push(x);
    if (opening > 0) db.sales.push({ id: "ob" + uid(), kind: "opening", ref: "OB-" + (1000 + db.sales.length), date: new Date().toISOString(), customerId: x.id, items: [], method: "Other", paid: 0, total: opening, pays: [], due: L.addDays(L.today(), c.terms), soldBy: c.salespersonId || null });
    log(db, who(o), "Added customer", x.name, "/customers", x.id); return x;
  }
  function deleteCustomer(db, id, o) {
    const x = db.customers.find((c) => c.id === id); if (!x) fail("Customer not found.");
    const n = db.sales.filter((s) => s.customerId === id && !s.void && s.kind !== "opening").length + db.invoices.filter((i) => i.customerId === id).length + db.quotes.filter((q) => q.customerId === id).length;
    if (n) fail(`${x.name} has ${n} sale, invoice or quotation record${n === 1 ? "" : "s"}, so it cannot be deleted. Records stay linked to keep your accounts correct.`);
    if (L.customerStats(db, id).balance > 0) fail(`${x.name} still owes money. Record the payment first.`);
    db.customers = db.customers.filter((c) => c.id !== id); db.sales = db.sales.filter((s) => s.customerId !== id || s.kind === "opening" && false); log(db, who(o), "Deleted customer", x.name, "/customers"); return x;
  }

  /* ---------- suppliers ---------- */
  function saveSupplier(db, d, id, o) {
    const s = { name: text(d.name, "Supplier name", 80, true), contact: text(d.contact, "Contact person", 60), phone: text(d.phone, "Phone", 20, true), email: text(d.email, "Email", 80), location: text(d.location, "Location", 60), pin: text(d.pin, "Tax PIN", 11).toUpperCase(),
      category: text(d.category || "General", "Category", 40), notes: text(d.notes, "Notes", 300), terms: d.terms === "" || d.terms == null ? 30 : money(d.terms, "Payment terms", { min: 0 }) };
    if (s.terms > 180) fail("Payment terms can be at most 180 days.");
    if (rules.phone(s.phone)) fail(rules.phone(s.phone)); if (rules.email(s.email)) fail(rules.email(s.email)); if (rules.pin(s.pin)) fail(rules.pin(s.pin));
    if (db.suppliers.some((x) => x.id !== id && x.name.toLowerCase() === s.name.toLowerCase())) fail("A supplier with this name already exists.");
    const opening = id ? 0 : d.opening === "" || d.opening == null ? 0 : money(d.opening, "Opening balance", { min: 0 });
    if (id) { const x = db.suppliers.find((y) => y.id === id); if (!x) fail("Supplier not found."); Object.assign(x, s); log(db, who(o), "Updated supplier", x.name, "/purchases", x.id); return x; }
    const x = { id: "sp" + uid(), opening, ...s }; db.suppliers.push(x);
    if (opening > 0) db.pos.push({ id: "po" + uid(), kind: "opening", ref: "OB-S" + (1000 + db.pos.length), date: new Date().toISOString(), supplierId: x.id, lines: [], total: opening, status: "Received", paid: 0, pays: [], receivedAt: L.today(), due: L.addDays(L.today(), s.terms), terms: s.terms, taxPct: 0, notes: "Opening balance" });
    log(db, who(o), "Added supplier", x.name, "/purchases", x.id); return x;
  }
  function deleteSupplier(db, id, o) {
    const x = db.suppliers.find((s) => s.id === id); if (!x) fail("Supplier not found.");
    const n = db.pos.filter((p) => p.supplierId === id && p.kind !== "opening").length; if (n) fail(`${x.name} has ${n} purchase order${n === 1 ? "" : "s"}, so it cannot be deleted.`);
    if (L.supplierStats(db, id).balance > 0) fail(`${x.name} is still owed money. Record the payment first.`);
    db.suppliers = db.suppliers.filter((s) => s.id !== id); db.pos = db.pos.filter((p) => p.supplierId !== id); log(db, who(o), "Deleted supplier", x.name, "/purchases"); return x;
  }

  /* ---------- products ---------- */
  function saveProduct(db, d, id, o) {
    const p = { name: text(d.name, "Product name", 80, true), category: text(d.category, "Category", 40, true), cost: money(d.cost, "Cost price", { min: 0 }), price: money(d.price, "Selling price", { min: 1 }), stock: money(d.stock, "Stock", { min: 0 }), reorder: money(d.reorder, "Minimum stock", { min: 0 }), supplierId: d.supplierId || "" };
    if (p.supplierId && !db.suppliers.some((s) => s.id === p.supplierId)) fail("Choose a supplier from the list.");
    if (db.products.some((x) => x.id !== id && x.name.toLowerCase() === p.name.toLowerCase())) fail("A product with this name already exists.");
    if (id) { const x = db.products.find((y) => y.id === id); if (!x) fail("Product not found."); Object.assign(x, p); log(db, who(o), "Updated product", x.name, "/inventory", x.id); return x; }
    const x = { id: "p" + uid(), sku: "AGS-" + (maxNo(db.products, (q) => q.sku, 999) + 1), ...p }; db.products.push(x); log(db, who(o), "Added product", x.name, "/inventory", x.id); return x;
  }
  function deleteProduct(db, id, o) {
    const p = db.products.find((x) => x.id === id); if (!p) fail("Product not found.");
    const open = db.pos.filter((q) => !["Received", "Completed", "Rejected"].includes(q.status) && L.poLines(q).some((l) => l.productId === id));
    if (open.length) fail(`${p.name} is on open purchase order ${open[0].ref}. Cancel or receive it first.`);
    db.products = db.products.filter((x) => x.id !== id); log(db, who(o), "Deleted product", p.name, "/inventory"); return p;
  }
  function adjustStock(db, id, delta, o) { const p = db.products.find((x) => x.id === id); if (!p) fail("Product not found."); if (p.stock + delta < 0) fail("Stock cannot go below zero."); p.stock += delta; log(db, who(o), "Adjusted stock", `${p.name} (${delta > 0 ? "+" : ""}${delta})`, "/inventory", p.id); return p; }

  /* ---------- sales ---------- */
  function cleanLines(db, lines, o) {
    o = o || {}; if (!Array.isArray(lines) || !lines.length) fail("Add at least one product.");
    const seen = new Set(), out = lines.map((l, i) => { const p = db.products.find((x) => x.id === l.productId); if (!p) fail(`Line ${i + 1}: choose a product.`);
      if (seen.has(p.id)) fail(`${p.name} is added twice. Increase the quantity instead.`); seen.add(p.id);
      const qty = int(l.qty); if (!Number.isInteger(qty) || qty < 1) fail(`Line ${i + 1}: quantity must be a whole number of at least 1.`);
      const price = money(l[o.priceKey || "price"], `Line ${i + 1}: price`, { min: 1 }); return { productId: p.id, qty, price }; });
    return out;
  }
  function createSale(db, d, o) {
    o = o || {}; const lines = cleanLines(db, d.lines), by = who(o);
    lines.forEach((l) => { const p = db.products.find((x) => x.id === l.productId); if (l.qty > p.stock) fail(`Only ${p.stock} of ${p.name} in stock.`); });
    const total = lines.reduce((a, l) => a + l.qty * l.price, 0), cid = d.customerId || "", paid = d.paid === "" || d.paid == null ? total : money(d.paid, "Amount paid", { min: 0 });
    if (paid > total) fail("Amount paid cannot be more than the sale total.");
    if (!cid && paid < total) fail("Choose a customer to record a sale on credit. Walk-in sales must be paid in full.");
    if (cid && !db.customers.some((c) => c.id === cid)) fail("Customer not found.");
    const c = db.customers.find((x) => x.id === cid);
    if (c && c.creditLimit && !d.overrideCredit && L.customerStats(db, cid).balance + (total - paid) > c.creditLimit) fail(`This sale takes ${c.name} over their credit limit of KSh ${c.creditLimit.toLocaleString("en-KE")}.`, "CREDIT");
    const method = METHODS.includes(d.method) ? d.method : "Cash", now = new Date().toISOString(), id = "s" + uid();
    const sale = { id, ref: "INV-" + (maxNo(db.sales.filter((s) => /^INV-/.test(s.ref)), (s) => s.ref, 999) + 1), date: now, customerId: cid, items: lines.map((l) => { const p = db.products.find((x) => x.id === l.productId); return { productId: l.productId, qty: l.qty, price: l.price, cost: p.cost }; }), method, paid, total, soldBy: d.soldBy || o.soldBy || null, pays: paid > 0 ? [{ id: id + "-p0", date: L.today(), amount: paid, method, by }] : [], due: L.addDays(L.today(), c ? c.terms : 0), notes: text(d.notes, "Notes", 300) };
    lines.forEach((l) => { db.products.find((x) => x.id === l.productId).stock -= l.qty; }); db.sales.push(sale);
    log(db, sale.soldBy ? emp(db, sale.soldBy) || by : by, "Recorded sale", `${sale.ref} · ${cust(db, cid)}`, "/sales", sale.id); return sale;
  }
  function paySale(db, id, d, o) {
    const s = db.sales.find((x) => x.id === id); if (!s || s.void) fail("Sale not found."); const bal = s.total - L.salePaid(s), by = who(o);
    if (d.key && (s.pays || []).some((p) => p.key === d.key)) return { dup: true, sale: s };
    if (bal <= 0) fail("This sale is already fully paid.");
    const amount = money(d.amount, "Amount", { min: 1 }); if (amount > bal) fail(`Amount is more than the outstanding balance of KSh ${bal.toLocaleString("en-KE")}.`);
    s.pays = s.pays || []; s.pays.push({ id: "sp" + uid(), date: L.today(), amount, method: METHODS.includes(d.method) ? d.method : "Cash", by, key: d.key || uid(), ref: text(d.ref, "Reference", 40) }); s.paid = L.salePaid(s);
    log(db, by, "Recorded payment", `${s.ref} · ${cust(db, s.customerId)}`, "/sales", s.id); return { dup: false, sale: s, amount };
  }
  function voidSale(db, id, o) {
    const s = db.sales.find((x) => x.id === id); if (!s || s.void) fail("Sale not found."); if (s.kind === "opening") fail("Opening balances cannot be voided.");
    s.items.forEach((i) => { const p = db.products.find((x) => x.id === i.productId); if (p) p.stock += i.qty; }); s.void = true; s.voidedAt = L.today(); log(db, who(o), "Voided sale", s.ref, "/sales", s.id); return s;
  }

  /* ---------- expenses ---------- */
  function saveExpense(db, d, id, o) {
    o = o || {}; const e = { category: text(d.category, "Category", 40, true), description: text(d.description, "Description", 120, true), amount: money(d.amount, "Amount", { min: 1 }), method: METHODS.includes(d.method) ? d.method : "Cash" };
    const date = d.date || L.today(); if (rules.date(date)) fail(rules.date(date)); if (date > L.today()) fail("An expense cannot be dated in the future.");
    const isApprover = CAN_APPROVE.includes(who(o)), limit = (db.settings && db.settings.approvalLimit) || 25000, needs = !isApprover && e.amount > limit;
    if (id) { const x = db.expenses.find((y) => y.id === id); if (!x) fail("Expense not found."); Object.assign(x, e, { date: new Date(date + "T12:00:00").toISOString() }); if (needs) x.status = "pending"; log(db, who(o), "Updated expense", x.description, "/finance", x.id); return x; }
    const x = { id: "e" + uid(), date: date === L.today() ? new Date().toISOString() : new Date(date + "T12:00:00").toISOString(), ...e, status: needs ? "pending" : "approved", by: o.employeeId || null }; db.expenses.push(x);
    log(db, who(o), needs ? "Submitted expense for approval" : "Recorded expense", `${x.description} (KSh ${x.amount.toLocaleString("en-KE")})`, "/finance", x.id); return x;
  }
  function deleteExpense(db, id, o) { const x = db.expenses.find((e) => e.id === id); if (!x) fail("Expense not found."); db.expenses = db.expenses.filter((e) => e.id !== id); log(db, who(o), "Deleted expense", x.description, "/finance"); return x; }

  /* ---------- purchase orders ---------- */
  function savePO(db, d, id, o) {
    o = o || {}; if (!db.suppliers.some((s) => s.id === d.supplierId)) fail("Choose a supplier.");
    const lines = cleanLines(db, (d.lines || []).map((l) => ({ ...l, price: l.unitCost })), { priceKey: "price" }).map((l) => ({ productId: l.productId, qty: l.qty, unitCost: l.price }));
    const tax = d.taxPct === "" || d.taxPct == null ? 0 : int(d.taxPct); if (!Number.isFinite(tax) || tax < 0 || tax > 100) fail("Tax must be between 0 and 100 percent.");
    const terms = d.terms === "" || d.terms == null ? 30 : money(d.terms, "Payment terms", { min: 0 }); if (terms > 180) fail("Payment terms can be at most 180 days.");
    if (d.expected && rules.date(d.expected)) fail(rules.date(d.expected)); if (d.expected && d.expected < L.today()) fail("Expected delivery cannot be in the past.");
    const f = { supplierId: d.supplierId, lines, productId: lines[0].productId, qty: lines[0].qty, unitCost: lines[0].unitCost, taxPct: tax, terms, expected: d.expected || "", notes: text(d.notes, "Notes", 300) };
    if (id) { const p = db.pos.find((x) => x.id === id); if (!p) fail("Purchase order not found."); if (p.status !== "Draft") fail("Only draft purchase orders can be edited."); Object.assign(p, f); log(db, who(o), "Updated purchase order", p.ref, "/purchases", p.id); return p; }
    const p = { id: "po" + uid(), ref: "PO-" + (maxNo(db.pos.filter((x) => /^PO-/.test(x.ref)), (x) => x.ref, 1999) + 1), date: new Date().toISOString(), status: "Draft", paid: 0, pays: [], submittedBy: o.employeeId || null, ...f }; db.pos.push(p);
    log(db, who(o), "Created purchase order", `${p.ref} · ${supName(db, p.supplierId)}`, "/purchases", p.id); return p;
  }
  function advancePO(db, id, o) {
    o = o || {}; const p = db.pos.find((x) => x.id === id); if (!p) fail("Purchase order not found."); const next = { Draft: "Submitted", Submitted: "Approved", Approved: "Received", Received: "Completed" }[p.status], by = who(o);
    if (!next) fail(`A ${p.status.toLowerCase()} order cannot move forward.`);
    if (next === "Approved" && !CAN_APPROVE.includes(by)) fail(`The ${by} role cannot approve purchase orders.`);
    if (next === "Completed" && L.poPaid(p) < L.poTotal(p)) fail("Pay the supplier in full before completing this order.");
    if (next === "Submitted") { p.submittedAt = L.today(); p.submittedBy = o.employeeId || p.submittedBy || null; }
    if (next === "Approved") { p.approvedAt = L.today(); p.approvedBy = by; }
    if (next === "Received") { L.poLines(p).forEach((l) => { const pr = db.products.find((x) => x.id === l.productId); if (pr) pr.stock += l.qty; }); p.receivedAt = L.today(); p.due = L.addDays(p.receivedAt, p.terms || 30); }
    p.status = next; log(db, by, { Submitted: "Submitted purchase order", Approved: "Approved purchase order", Received: "Received stock", Completed: "Completed purchase order" }[next], p.ref, "/purchases", p.id); return p;
  }
  function deletePO(db, id, o) { const p = db.pos.find((x) => x.id === id); if (!p) fail("Purchase order not found."); if (!["Draft", "Rejected"].includes(p.status)) fail("Only draft or rejected purchase orders can be deleted."); db.pos = db.pos.filter((x) => x.id !== id); log(db, who(o), "Deleted purchase order", p.ref, "/purchases"); return p; }
  function paySupplier(db, id, d, o) {
    const p = db.pos.find((x) => x.id === id); if (!p) fail("Purchase order not found."); if (!["Received", "Completed"].includes(p.status)) fail("Receive the stock before paying the supplier."); const bal = L.poTotal(p) - L.poPaid(p), by = who(o);
    if (d.key && (p.pays || []).some((x) => x.key === d.key)) return { dup: true, po: p };
    if (bal <= 0) fail("This order is already fully paid.");
    const amount = d.amount === "" || d.amount == null ? bal : money(d.amount, "Amount", { min: 1 }); if (amount > bal) fail(`Amount is more than the outstanding balance of KSh ${bal.toLocaleString("en-KE")}.`);
    p.pays = p.pays || []; p.pays.push({ id: "pp" + uid(), date: L.today(), amount, method: METHODS.includes(d.method) ? d.method : "Bank transfer", by, key: d.key || uid() }); p.paid = L.poPaid(p);
    if (p.payReq && p.payReq.status === "pending") p.payReq.status = "paid";
    log(db, by, "Paid supplier", `${p.ref} · ${supName(db, p.supplierId)} (KSh ${amount.toLocaleString("en-KE")})`, "/purchases", p.id); return { dup: false, po: p, amount };
  }

  /* ---------- approvals ---------- */
  function decide(db, approvalId, decision, o) {
    o = o || {}; const by = who(o), ok = decision === "approve"; if (!CAN_APPROVE.includes(by)) fail(`The ${by} role cannot ${ok ? "approve" : "reject"} requests. Switch to Business Owner, Administrator or Finance Manager.`);
    const [kind, rid] = String(approvalId).split(":");
    if (kind === "po") { const p = db.pos.find((x) => x.id === rid); if (!p || p.status !== "Submitted") fail("This request is no longer pending."); p.status = ok ? "Approved" : "Rejected"; p[ok ? "approvedAt" : "rejectedAt"] = L.today(); p[ok ? "approvedBy" : "rejectedBy"] = by; log(db, by, ok ? "Approved purchase order" : "Rejected purchase order", p.ref, "/purchases", p.id); return p; }
    if (kind === "ex") { const e = db.expenses.find((x) => x.id === rid); if (!e || e.status !== "pending") fail("This request is no longer pending."); e.status = ok ? "approved" : "rejected"; e.decidedBy = by; log(db, by, ok ? "Approved expense" : "Rejected expense", e.description, "/finance", e.id); return e; }
    if (kind === "pp") { const p = db.pos.find((x) => x.id === rid); if (!p || !p.payReq || p.payReq.status !== "pending") fail("This request is no longer pending.");
      if (ok) { paySupplier(db, p.id, { amount: p.payReq.amount, method: "Bank transfer", key: "req-" + p.id }, o); p.payReq.status = "approved"; } else { p.payReq.status = "rejected"; log(db, by, "Rejected supplier payment", p.ref, "/purchases", p.id); } return p; }
    fail("Unknown approval.");
  }

  /* ---------- invoices and quotations ---------- */
  function saveDoc(db, d, o) {
    o = o || {}; const inv = d.kind === "inv", by = who(o), cid = d.cust; if (!db.customers.some((c) => c.id === cid)) fail("Choose a customer.");
    if (!d.lines || !d.lines.length) fail("Add at least one line.");
    const lines = d.lines.map((l, i) => { const desc = text(l.desc, `Line ${i + 1}: description`, 120, true), qty = int(l.qty), price = int(l.price), disc = l.disc === "" || l.disc == null ? 0 : int(l.disc);
      if (!Number.isInteger(qty) || qty < 1) fail(`Line ${i + 1}: quantity must be a whole number of at least 1.`); if (!Number.isFinite(price) || price <= 0) fail(`Line ${i + 1}: unit price must be above zero.`); if (!(disc >= 0 && disc <= 100)) fail(`Line ${i + 1}: discount must be between 0 and 100 percent.`);
      return { pid: l.pid || "", desc, qty, price, disc }; });
    if (rules.date(d.issue)) fail("Choose a valid issue date."); const days = int(d.days); if (!Number.isInteger(days) || days < 0 || days > 365) fail(inv ? "Payment terms must be between 0 and 365 days." : "Validity must be between 0 and 365 days.");
    const vat = int(d.vat); if (!(vat >= 0 && vat <= 100)) fail("VAT must be between 0 and 100 percent.");
    const dval = d.dval === "" || d.dval == null ? 0 : int(d.dval); if (!(dval >= 0)) fail("Discount cannot be negative."); if (d.dtype === "pct" && dval > 100) fail("Discount cannot be more than 100 percent.");
    const disc = dval ? { type: d.dtype === "fixed" ? "fixed" : "pct", v: dval } : null, t = V2.totals(lines, disc, vat); if (t.total <= 0) fail("The total must be above zero.");
    const notes = text(d.notes, "Notes", 300), terms = text(d.terms, "Terms", 400), send = !!d.send, due = L.addDays(d.issue, days), c = db.customers.find((x) => x.id === cid);
    if (inv && send && !d.overrideCredit && c.creditLimit) { const prior = d.editId ? (db.invoices.find((i) => i.id === d.editId) || {}) : {}; const cur = L.customerStats(db, cid).balance - (prior.status && prior.status !== "draft" ? V2.bal(prior) : 0); if (cur + t.total > c.creditLimit) fail(`This invoice takes ${c.name} over their credit limit of KSh ${c.creditLimit.toLocaleString("en-KE")}.`, "CREDIT"); }
    const day = L.today();
    if (d.editId) {
      const x = (inv ? db.invoices : db.quotes).find((y) => y.id === d.editId); if (!x) fail("Document not found.");
      if (inv ? !["draft", "sent", "viewed"].includes(x.status) || x.paid > 0 || x.credited > 0 : !["draft", "sent", "viewed"].includes(x.status)) fail(inv ? "Invoices with payments or credit notes cannot be edited. Issue a credit note instead." : "Only open quotations can be edited.");
      Object.assign(x, { customerId: cid, lines, disc, vat, issue: d.issue, notes, terms }); if (inv) { x.due = due; x.total = t.total; } else x.validUntil = due; if (send && x.status === "draft") { x.status = "sent"; x.history.push({ at: day, ev: "Marked sent (demo: no message was delivered)" }); }
      x.history.push({ at: day, ev: "Edited by " + by }); log(db, by, "Edited " + (inv ? "invoice" : "quotation"), x.number, inv ? "/invoice" : "/quote", x.id); return x;
    }
    const base = { id: (inv ? "inv" : "q") + uid(), customerId: cid, status: send ? "sent" : "draft", issue: d.issue, lines, disc, vat, token: uid() + uid(), notes, terms, history: [{ at: day, ev: "Created" }], soldBy: d.soldBy || c.salespersonId || null };
    if (send) base.history.push({ at: day, ev: "Marked sent (demo: no message was delivered)" });
    const list = inv ? db.invoices : db.quotes, num = (inv ? "AGS-INV-" : "AGS-QT-") + (maxNo(list, (x) => x.number, inv ? 2000 : 3000) + 1);
    const doc = inv ? { ...base, number: num, due, total: t.total, paid: 0, credited: 0, reminders: [] } : { ...base, number: num, validUntil: due, comment: "" }; list.unshift(doc);
    log(db, by, "Created " + (inv ? "invoice" : "quotation"), `${num} · ${c.name}`, inv ? "/invoice" : "/quote", doc.id); return doc;
  }
  function payInvoice(db, id, d, o) {
    const i = db.invoices.find((x) => x.id === id); if (!i) fail("Invoice not found."); const by = who(o);
    const r = V2.pay(i, db.payments, { id: "ipay" + uid(), amount: int(d.amount), key: d.key || uid(), method: METHODS.includes(d.method) ? d.method : "M-Pesa", ref: text(d.ref, "Reference", 40), note: text(d.note, "Notes", 200), by, date: L.today() });
    if (r.dup) return { dup: true, inv: i }; db.payments.push(r.payment); i.paid = r.inv.paid; i.history.push({ at: L.today(), ev: `Payment of KSh ${r.payment.amount.toLocaleString("en-KE")} recorded by ${by}` });
    log(db, by, "Recorded payment", `${i.number} · ${cust(db, i.customerId)}`, "/invoice", i.id); return { dup: false, inv: i, payment: r.payment };
  }

  /* ---------- tasks and leads ---------- */
  function saveTask(db, d, id, o) {
    const t = { title: text(d.title, "Title", 100, true), assigneeId: d.assigneeId, priority: ["Low", "Medium", "High"].includes(d.priority) ? d.priority : "Medium", due: d.due };
    if (!db.employees.some((e) => e.id === t.assigneeId)) fail("Choose who the task is for."); if (rules.date(t.due)) fail("Choose a valid deadline.");
    t.due = new Date(t.due + "T12:00:00").toISOString();
    if (id) { const x = db.tasks.find((y) => y.id === id); if (!x) fail("Task not found."); Object.assign(x, t); log(db, who(o), "Updated task", x.title, "/tasks", x.id); return x; }
    const x = { id: "t" + uid(), status: "To Do", ...t }; db.tasks.push(x); log(db, who(o), "Assigned task", x.title, "/tasks", x.id); return x;
  }
  function moveTask(db, id, status, o) { const x = db.tasks.find((t) => t.id === id); if (!x) fail("Task not found."); x.status = status; if (status === "Completed") { x.completedAt = new Date().toISOString(); log(db, who(o), "Completed task", x.title, "/tasks", x.id); } else delete x.completedAt; return x; }
  function saveLead(db, d, id, o) {
    const l = { name: text(d.name, "Lead name", 80, true), value: money(d.value, "Deal value", { min: 1 }), followUp: d.followUp, ownerId: d.ownerId }; if (rules.date(l.followUp)) fail("Choose a valid follow-up date.");
    if (!db.employees.some((e) => e.id === l.ownerId)) fail("Choose an owner."); l.followUp = new Date(l.followUp + "T12:00:00").toISOString();
    if (id) { const x = db.leads.find((y) => y.id === id); if (!x) fail("Lead not found."); Object.assign(x, l); return x; }
    const x = { id: "l" + uid(), stage: "New Lead", ...l }; db.leads.push(x); log(db, who(o), "Added lead", x.name, "/crm", x.id); return x;
  }

  return { rules, fail, log, saveCustomer, deleteCustomer, saveSupplier, deleteSupplier, saveProduct, deleteProduct, adjustStock, createSale, paySale, voidSale, saveExpense, deleteExpense, savePO, advancePO, deletePO, paySupplier, decide, saveDoc, payInvoice, saveTask, moveTask, saveLead };
})();
if (typeof module !== "undefined" && module.exports) module.exports = D;
