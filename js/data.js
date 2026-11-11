"use strict";
const DAY = 864e5, KEY = "harxel-html-v1";
const METHODS = ["M-Pesa", "Cash", "Bank transfer", "Card", "Other"];
const EXP_CATS = ["Rent", "Salaries", "Transport", "Utilities", "Marketing", "Maintenance", "Internet", "Miscellaneous"];
const CATS = ["Electronics", "Household", "Office supplies", "Food products", "Hardware"];
const STAGES = ["New Lead", "Contacted", "Qualified", "Proposal Sent", "Negotiation", "Won", "Lost"];
const PO_FLOW = ["Draft", "Submitted", "Approved", "Received", "Completed"];
const TASK_STATUS = ["To Do", "In Progress", "Under Review", "Completed"];
const ROLES = {
  "Business Owner": ["*"], Administrator: ["*"],
  "Finance Manager": ["/", "/finance", "/customers", "/purchases", "/reports", "/assistant", "/notifications"],
  "Sales Manager": ["/", "/sales", "/crm", "/customers", "/inventory", "/tasks", "/assistant", "/notifications"],
  "Inventory Manager": ["/inventory", "/purchases", "/tasks", "/notifications"], Employee: ["/tasks", "/notifications"],
};
function rng(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function seed() {
  const r = rng(2026), now = Date.now(), ph = () => `07${Math.floor(10 + r() * 89)} ${Math.floor(100 + r() * 899)} ${Math.floor(100 + r() * 899)}`, iso = (k) => new Date(now + k * DAY).toISOString();
  const P = [["Samsung 32\" LED TV", "Electronics", 21500, 27900, 14, 5], ["Hotpoint Microwave 20L", "Electronics", 7800, 10500, 22, 6], ["Oraimo Power Bank 10000mAh", "Electronics", 1350, 1990, 60, 20], ["Ramtons Electric Kettle", "Household", 1450, 2150, 38, 10], ["Non-stick Sufuria Set (5pc)", "Household", 2600, 3600, 25, 8], ["Mattress 4x6 Medium", "Household", 7400, 9800, 11, 4], ["A4 Printing Paper (ream)", "Office supplies", 520, 720, 140, 40], ["Bic Pens (box of 50)", "Office supplies", 480, 700, 55, 15], ["Stapler Heavy Duty", "Office supplies", 650, 950, 9, 10], ["Unga Jogoo 2kg (carton of 12)", "Food products", 1380, 1620, 80, 25], ["Cooking Oil 5L Fresh Fri", "Food products", 1050, 1290, 46, 15], ["Pembe Sugar 2kg (carton of 10)", "Food products", 1750, 2050, 4, 12], ["Cement 50kg Bamburi", "Hardware", 690, 780, 210, 60], ["Iron Sheet Gauge 30 (3m)", "Hardware", 740, 920, 120, 40], ["Padlock 50mm", "Hardware", 260, 420, 0, 15], ["Paint 4L Crown White", "Hardware", 1650, 2300, 33, 10]];
  const products = P.map((p, i) => ({ id: "p" + (i + 1), name: p[0], sku: "AGS-" + (1000 + i), category: p[1], cost: p[2], price: p[3], stock: p[4], reorder: p[5] }));
  const C = [["Wanjiku Kamau", "Retail"], ["Otieno Ochieng", "Retail"], ["Mwangi & Sons Hardware", "Wholesale"], ["Achieng Akinyi", "Retail"], ["Kilimani Mini Mart", "Wholesale"], ["Juma Hassan", "Retail"], ["Naivasha Road Stores", "Wholesale"], ["Njeri Wambui", "Retail"], ["Rift Valley Caterers", "Wholesale"], ["Kiprop Cheruiyot", "Retail"], ["Starlight Academy", "Wholesale"], ["Amina Salim", "Retail"]];
  const slug = (n) => n.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "").slice(0, 18);
  const customers = C.map((c, i) => ({ id: "c" + (i + 1), name: c[0], type: c[1], phone: ph(), email: c[1] === "Wholesale" ? "accounts@" + slug(c[0]) + ".example" : "" }));
  const sales = [];
  for (let i = 0; i < 130; i++) {
    const age = Math.floor(Math.pow(r(), 0.85) * 365);
    const items = Array.from({ length: 1 + Math.floor(r() * 3) }, () => { const p = products[Math.floor(r() * products.length)]; return { productId: p.id, qty: 3 * (10 + Math.floor(r() * 30)), price: p.price, cost: p.cost }; });
    const total = items.reduce((s, x) => s + x.qty * x.price, 0), roll = r();
    const paid = age < 45 && roll < 0.2 ? 0 : age < 90 && roll < 0.3 ? Math.round(total * 0.5) : total;
    sales.push({ id: "s" + (i + 1), ref: "", date: new Date(now - age * DAY - r() * DAY * 0.5).toISOString(), customerId: customers[Math.floor(r() * customers.length)].id, items, method: METHODS[Math.floor(r() * 3)], paid, total });
  }
  [[0.05, 4, 2, 6, 0], [0.12, 1, 1, 12, 1], [0.3, 6, 3, 2, 1], [1.1, 2, 4, 13, 0], [1.4, 8, 6, 9, 0]].forEach(([ago, ci, pi, q, partial], k) => { const p = products[pi + 4 * (k % 2)], total = q * p.price; sales.push({ id: "s" + (131 + k), ref: "", date: new Date(now - ago * DAY).toISOString(), customerId: customers[ci].id, items: [{ productId: p.id, qty: q, price: p.price, cost: p.cost }], method: METHODS[k % 3], paid: partial ? Math.round(total * 0.4) : total, total }); });
  sales.sort((a, b) => a.date.localeCompare(b.date)).forEach((s, i) => { s.ref = "INV-" + (1000 + i); });
  const expenses = [];
  for (let m = 0; m < 12; m++) {
    const d = (o) => iso(-(m * 30 + o)), add = (k, o, c, t, a, p) => expenses.push({ id: `e-${k}${m}`, date: d(o), category: c, description: t, amount: a, method: p });
    add("rent", 2, "Rent", "Warehouse rent, Industrial Area", 70000, "Bank transfer"); add("sal", 5, "Salaries", "Staff salaries", 150000 + Math.round(r() * 10000), "Bank transfer");
    add("util", 9, "Utilities", "KPLC and water", 18000 + Math.round(r() * 9000), "M-Pesa"); add("tr", 14, "Transport", "Delivery fuel and drivers", 22000 + Math.round(r() * 14000), "Cash");
    add("mk", 19, "Marketing", "Social media ads", 8000 + Math.round(r() * 9000), "M-Pesa"); add("in", 22, "Internet", "Fibre internet", 6500, "M-Pesa");
  }
  const S = [["Rift Distributors Ltd", "Food products"], ["Mombasa Hardware Wholesalers", "Hardware"], ["Nairobi Electronics Hub", "Electronics"], ["Kisumu Foods Co.", "Food products"], ["Eldoret Paper Mills", "Office supplies"], ["Thika Household Imports", "Household"], ["Nakuru Agro Supplies", "Food products"], ["Coast Tools & Paints", "Hardware"]];
  const suppliers = S.map((x, i) => ({ id: "sp" + (i + 1), name: x[0], category: x[1], phone: ph(), email: "orders@" + slug(x[0]) + ".example", contact: "", address: "" }));
  const pos = Array.from({ length: 12 }, (_, i) => { const p = products[(i * 3) % products.length], qty = 20 + Math.floor(r() * 80), status = PO_FLOW[i % 5], lines = [{ productId: p.id, qty, unitCost: p.cost }];
    if (i % 4 === 0) { const p2 = products[(i * 3 + 1) % products.length]; lines.push({ productId: p2.id, qty: 10 + i, unitCost: p2.cost }); } const tot = lines.reduce((a, l) => a + l.qty * l.unitCost, 0);
    return { id: "po" + (i + 1), ref: "PO-" + (2000 + i), date: iso(-(12 - i) * 20), supplierId: suppliers[i % 8].id, lines, status, paid: status === "Completed" ? tot : status === "Received" && i % 2 ? Math.round(tot / 2) : 0 }; });
  const E = [["Grace Mwende", "Operations Manager", "Operations"], ["Peter Njoroge", "Sales Manager", "Sales"], ["Faith Chebet", "Accountant", "Finance"], ["Samuel Odhiambo", "Storekeeper", "Warehouse"], ["Mercy Wairimu", "Cashier", "Sales"], ["Brian Kiptoo", "Driver", "Logistics"], ["Lucy Atieno", "Sales Representative", "Sales"], ["Daniel Mutua", "Procurement Officer", "Procurement"]];
  const employees = E.map((x, i) => ({ id: "em" + (i + 1), empNo: "AGS-EMP-" + String(i + 1).padStart(3, "0"), name: x[0], title: x[1], department: x[2], phone: ph(), email: x[0].toLowerCase().replace(/[^a-z]+/g, ".") + "@apex-general.example", status: i === 4 ? "On leave" : "Active", joined: iso(-(1800 - i * 190)).slice(0, 10) }));
  const T = [["Count warehouse stock", "Full count of all 16 product lines against the stock register.", ""], ["Follow up Kilimani Mini Mart invoice", "Call the shop owner about the unpaid balance and agree a payment date.", "c5"], ["Reconcile M-Pesa payments", "Match this week's M-Pesa statement to recorded payments.", ""], ["Deliver order to Naivasha Road Stores", "Deliver the confirmed order and collect the signed delivery note.", "c7"], ["Request quotes for cement", "Get prices from two suppliers for 200 bags of cement.", ""], ["Update price list", "Review selling prices after the latest supplier cost changes.", ""], ["Prepare monthly sales summary", "Summarise sales, top products and outstanding balances for the owner.", ""], ["Service delivery van", "Book the van for its scheduled service.", ""], ["Call overdue customers", "Phone every customer with an overdue invoice and note their promised dates.", "c3"], ["Reorder padlocks", "Padlocks are out of stock. Raise a purchase order with Coast Tools & Paints.", ""], ["Train cashier on new till", "Walk the cashier through refunds and end-of-day closing.", ""], ["Check supplier invoices", "Compare supplier invoices with goods received before payment.", ""],
    ["Prepare Rift Valley Caterers delivery", "Pack and label the weekly food order.", "c9"], ["Reorder Pembe sugar", "Sugar is far below its reorder level. Request urgent stock.", ""], ["Update customer phone numbers", "Confirm phone numbers for retail customers.", ""], ["Send quotation to Starlight Academy", "Prepare and send the stationery quotation.", "c11"], ["Weekly cash count", "Count the till and bank the cash.", ""], ["Inspect warehouse roof", "Check for leaks before the rainy season.", ""]];
  const tasks = T.map((t, i) => { const status = TASK_STATUS[i % 4], due = iso((i % 7) - 2); return { id: "t" + (i + 1), title: t[0], description: t[1], customerId: t[2], assigneeId: employees[i % 8].id, priority: ["High", "Medium", "Low"][i % 3], assigned: iso((i % 7) - 2 - 5 - (i % 3)).slice(0, 10), due, status, completedAt: status === "Completed" ? iso((i % 7) - 3) : "" }; });
  const L = [["Karen Bistro Group", 450000], ["Westlands Offices Ltd", 280000], ["Green Valley School", 620000], ["Thika Road Mall Shops", 340000], ["Mombasa Road Builders", 910000], ["Kasarani Sacco", 150000], ["Lang'ata Clinic", 210000], ["Ngong Hardware", 380000], ["Ruiru Caterers", 120000], ["Eastleigh Traders", 530000]];
  const leads = L.map((l, i) => ({ id: "l" + (i + 1), name: l[0], value: l[1], stage: STAGES[i % 7], followUp: iso((i % 9) - 1), ownerId: employees[1 + (i % 2) * 5].id }));
  return migrate(withV2({ products, customers, sales, expenses, suppliers, pos, employees, tasks, leads, read: [], adjust: [] }));
}
const money = (n) => (n < 0 ? "-" : "") + "KSh " + Math.round(Math.abs(n)).toLocaleString("en-KE");
const pct = (c, p) => (p ? ((c - p) / Math.abs(p)) * 100 : 0);
const fmtDate = (d) => new Date(d).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
const within = (d, a, b) => { const t = +new Date(d); return t >= a && t < b; };
const poLines = (p) => p.lines || [{ productId: p.productId, qty: p.qty, unitCost: p.unitCost }];
const poTotal = (p) => poLines(p).reduce((a, l) => a + l.qty * l.unitCost, 0);
const poQty = (p) => poLines(p).reduce((a, l) => a + l.qty, 0);
const dms = (d) => (typeof d === "string" && d.length === 10 ? +new Date(d + "T12:00:00") : +new Date(d));
const dayKey = (d) => new Date(d).toISOString().slice(0, 10);
const taskOverdue = (t) => t.status !== "Completed" && dayKey(t.due) < dayKey(Date.now());
const liveInv = (db) => (db.invoices || []).filter((i) => i.status !== "draft" && i.status !== "cancelled");
const invNet = (i) => Math.max(0, i.total - (i.credited || 0));
function totals(db, from, to) {
  const s = db.sales.filter((x) => within(x.date, from, to)), inv = liveInv(db).filter((i) => within(dms(i.issue), from, to)), pays = (db.payments || []).filter((p) => within(dms(p.date), from, to));
  const pc = (id) => (db.products.find((p) => p.id === id) || {}).cost || 0;
  const revenue = s.reduce((a, x) => a + x.total, 0) + inv.reduce((a, i) => a + invNet(i), 0);
  const cogs = s.reduce((a, x) => a + x.items.reduce((b, i) => b + i.qty * i.cost, 0), 0) + inv.reduce((a, i) => a + i.lines.reduce((b, l) => b + (l.pid ? l.qty * pc(l.pid) : 0), 0), 0);
  const expenses = db.expenses.filter((e) => within(e.date, from, to)).reduce((a, e) => a + e.amount, 0);
  return { revenue, cogs, gross: revenue - cogs, expenses, net: revenue - cogs - expenses, orders: s.length + inv.length, collected: s.reduce((a, x) => a + x.paid, 0) + pays.reduce((a, p) => a + p.amount, 0) };
}
function period(db, d) {
  const now = Date.now() + 1000; let from = now - d * DAY, len = d * DAY;
  if (d === 1) { const m = new Date(); m.setHours(0, 0, 0, 0); from = +m; len = DAY; }
  return { cur: totals(db, from, now), prev: totals(db, from - len, from), from, to: now };
}
function series(db, d) {
  const span = Math.max(d, 7), now = Date.now() + 1000, from = now - span * DAY, step = span <= 30 ? 1 : span <= 90 ? 7 : 30;
  return Array.from({ length: Math.ceil(span / step) }, (_, i) => { const s = from + i * step * DAY, t = totals(db, s, s + step * DAY); return { label: new Date(s).toLocaleDateString("en-KE", { day: "numeric", month: "short" }), Revenue: t.revenue, Expenses: t.expenses, Profit: t.net, "Cash flow": t.collected - t.expenses }; });
}
const invBal = (i) => Math.max(0, i.total - (i.credited || 0) - i.paid);
const receivable = (db) => db.sales.reduce((a, s) => a + s.total - s.paid, 0) + liveInv(db).reduce((a, i) => a + invBal(i), 0);
const inventoryValue = (db) => db.products.reduce((a, p) => a + p.cost * p.stock, 0);
const lowStock = (db) => db.products.filter((p) => p.stock <= p.reorder);
const payables = (db) => db.pos.filter((p) => p.status === "Received" || p.status === "Completed").reduce((a, p) => a + poTotal(p) - p.paid, 0);
function customerStats(db, id) { const s = db.sales.filter((x) => x.customerId === id), iv = liveInv(db).filter((x) => x.customerId === id); return { lifetime: s.reduce((a, x) => a + x.total, 0) + iv.reduce((a, i) => a + invNet(i), 0), balance: s.reduce((a, x) => a + x.total - x.paid, 0) + iv.reduce((a, i) => a + invBal(i), 0), orders: s.length + iv.length }; }
function stockMoves(db, pid) {
  const m = [];
  db.sales.forEach((s) => s.items.forEach((i) => { if (i.productId === pid) m.push({ date: s.date, qty: -i.qty, type: "Sale", ref: s.ref }); }));
  db.pos.forEach((p) => { if (p.status === "Received" || p.status === "Completed") poLines(p).forEach((l) => { if (l.productId === pid) m.push({ date: p.date, qty: l.qty, type: "Purchase received", ref: p.ref }); }); });
  (db.adjust || []).forEach((a) => { if (a.productId === pid) m.push({ date: a.date, qty: a.qty, type: "Adjustment", ref: a.note || "" }); });
  return m.sort((a, b) => b.date.localeCompare(a.date));
}
function migrate(db) {
  db.adjust = db.adjust || []; db.pos.forEach((p) => { if (!p.lines) { p.lines = poLines(p); delete p.productId; delete p.qty; delete p.unitCost; } });
  db.employees.forEach((e, i) => { e.empNo = e.empNo || "AGS-EMP-" + String(i + 1).padStart(3, "0"); e.status = e.status || "Active"; e.email = e.email || ""; e.joined = e.joined || ""; });
  db.tasks.forEach((t) => { t.description = t.description || ""; t.customerId = t.customerId || ""; t.assigned = t.assigned || ""; t.completedAt = t.completedAt || ""; });
  db.suppliers.forEach((x) => { x.email = x.email || ""; x.contact = x.contact || ""; x.address = x.address || ""; }); db.customers.forEach((c) => { c.email = c.email || ""; });
  return db;
}

function notices(db) {
  const now = Date.now(), n = [];
  db.products.filter((p) => p.stock <= p.reorder).forEach((p) => n.push({ id: `low-${p.id}-${p.stock}`, kind: "Low stock", text: `${p.name}: ${p.stock} left (reorder at ${p.reorder})`, href: "/inventory" }));
  db.sales.filter((s) => s.total > s.paid && now - +new Date(s.date) > 30 * DAY).forEach((s) => n.push({ id: `od-${s.id}-${s.paid}`, kind: "Overdue invoice", text: `${s.ref} has ${money(s.total - s.paid)} unpaid after 30+ days`, href: "/finance" }));
  (db.invoices || []).filter((i) => V2.dstatus(i, dayKey(now)).overdue).forEach((i) => n.push({ id: `inv-${i.id}-${i.paid}`, kind: "Overdue invoice", text: `${i.number} has ${money(invBal(i))} outstanding`, href: "/invoices" }));
  db.pos.filter((p) => p.status === "Submitted").forEach((p) => n.push({ id: "po-" + p.id, kind: "Approval needed", text: `${p.ref} is waiting for approval`, href: "/purchases" }));
  db.tasks.filter((t) => t.status !== "Completed" && +new Date(t.due) - now < 2 * DAY).forEach((t) => n.push({ id: `t-${t.id}-${t.status}`, kind: +new Date(t.due) < now ? "Task overdue" : "Task due soon", text: t.title, href: "/tasks" }));
  return n;
}
const monthRange = (o) => { const d = new Date(); return [+new Date(d.getFullYear(), d.getMonth() + o, 1), +new Date(d.getFullYear(), d.getMonth() + o + 1, 1)]; };
const SUGGESTIONS = ["How much revenue did we generate this month?", "Which products are running low?", "Who owes the business money?", "Which products sell the most?", "Compare this month with last month", "What are our largest expense categories?", "Which invoices are overdue?", "Summarize our business performance"];
function answer(db, question) {
  const q = question.toLowerCase(), [ts, te] = monthRange(0), [ls, le] = monthRange(-1), cur = totals(db, ts, te), prev = totals(db, ls, le);
  const nm = (id) => (db.customers.find((c) => c.id === id) || {}).name || "Walk-in", ch = (a, b) => (b ? (((a - b) / Math.abs(b)) * 100).toFixed(1) + "%" : "n/a");
  if (/compare|last month/.test(q)) return `This month vs last month:\nRevenue: ${money(cur.revenue)} vs ${money(prev.revenue)} (${ch(cur.revenue, prev.revenue)})\nExpenses: ${money(cur.expenses)} vs ${money(prev.expenses)} (${ch(cur.expenses, prev.expenses)})\nNet profit: ${money(cur.net)} vs ${money(prev.net)} (${ch(cur.net, prev.net)})\nThe month is still in progress, so this month's figures are partial.`;
  if (/categor/.test(q) && /expense|spend|cost/.test(q)) { const m = {}; db.expenses.filter((e) => +new Date(e.date) > Date.now() - 365 * DAY).forEach((e) => (m[e.category] = (m[e.category] || 0) + e.amount)); return "Largest expense categories, last 12 months:\n" + Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k}: ${money(v)}`).join("\n"); }
  if (/expense/.test(q)) return `Expenses this month so far: ${money(cur.expenses)}. Last month: ${money(prev.expenses)}.`;
  if (/low|running|reorder|out of stock/.test(q)) { const l = lowStock(db); return l.length ? "Products at or below reorder level:\n" + l.map((p) => `${p.name}: ${p.stock} left (reorder at ${p.reorder})`).join("\n") : "No products are at or below their reorder level."; }
  if (/overdue/.test(q)) { const o = db.sales.filter((s) => s.total > s.paid && Date.now() - +new Date(s.date) > 30 * DAY); return o.length ? `${o.length} invoices unpaid after 30+ days, totalling ${money(o.reduce((a, s) => a + s.total - s.paid, 0))}:\n` + o.slice(0, 8).map((s) => `${s.ref} · ${nm(s.customerId)}: ${money(s.total - s.paid)}`).join("\n") : "No invoices are overdue."; }
  if (/owe|receivable|debt|unpaid/.test(q)) { const d = db.customers.map((c) => ({ c, b: customerStats(db, c.id).balance })).filter((x) => x.b > 0).sort((a, b) => b.b - a.b); return `Customers owe ${money(receivable(db))} in total. Largest balances:\n` + d.slice(0, 5).map((x) => `${x.c.name}: ${money(x.b)}`).join("\n"); }
  if (/sell|top|best|popular/.test(q)) { const m = {}; db.sales.forEach((s) => s.items.forEach((i) => (m[i.productId] = (m[i.productId] || 0) + i.qty))); return "Best-selling products by units sold (all time):\n" + Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, n]) => `${(db.products.find((p) => p.id === id) || {}).name || "Deleted product"}: ${n} units`).join("\n"); }
  if (/summar|performance|weekly|report/.test(q)) { const t = totals(db, Date.now() - 30 * DAY, Date.now() + 1000), open = db.pos.filter((p) => p.status !== "Completed"); return `Last 30 days:\nRevenue ${money(t.revenue)} from ${t.orders} orders\nGross profit ${money(t.gross)}\nExpenses ${money(t.expenses)}\nNet profit ${money(t.net)}\nReceivables ${money(receivable(db))}, low-stock items ${lowStock(db).length}, open purchase orders ${open.length} (${money(open.reduce((a, p) => a + poTotal(p), 0))}).`; }
  if (/revenue|sales|income|turnover/.test(q)) return `Revenue this month so far: ${money(cur.revenue)} from ${cur.orders} orders. Last month: ${money(prev.revenue)}.`;
  return "I can't answer that from the business data. Try asking about revenue, expenses, low stock, who owes money, top products, overdue invoices, or a performance summary.";
}
