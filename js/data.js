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
  const customers = C.map((c, i) => ({ id: "c" + (i + 1), name: c[0], type: c[1], phone: ph() }));
  const sales = [];
  for (let i = 0; i < 130; i++) {
    const age = Math.floor(Math.pow(r(), 0.85) * 365);
    const items = Array.from({ length: 1 + Math.floor(r() * 3) }, () => { const p = products[Math.floor(r() * products.length)]; return { productId: p.id, qty: 10 + Math.floor(r() * 30), price: p.price, cost: p.cost }; });
    const total = items.reduce((s, x) => s + x.qty * x.price, 0), roll = r();
    const paid = age < 45 && roll < 0.2 ? 0 : age < 90 && roll < 0.3 ? Math.round(total * 0.5) : total;
    sales.push({ id: "s" + (i + 1), ref: "", date: new Date(now - age * DAY - r() * DAY * 0.5).toISOString(), customerId: customers[Math.floor(r() * customers.length)].id, items, method: METHODS[Math.floor(r() * 3)], paid, total });
  }
  sales.sort((a, b) => a.date.localeCompare(b.date)).forEach((s, i) => { s.ref = "INV-" + (1000 + i); });
  const expenses = [];
  for (let m = 0; m < 12; m++) {
    const d = (o) => iso(-(m * 30 + o)), add = (k, o, c, t, a, p) => expenses.push({ id: `e-${k}${m}`, date: d(o), category: c, description: t, amount: a, method: p });
    add("rent", 2, "Rent", "Warehouse rent, Industrial Area", 85000, "Bank transfer"); add("sal", 5, "Salaries", "Staff salaries", 190000 + Math.round(r() * 10000), "Bank transfer");
    add("util", 9, "Utilities", "KPLC and water", 18000 + Math.round(r() * 9000), "M-Pesa"); add("tr", 14, "Transport", "Delivery fuel and drivers", 22000 + Math.round(r() * 14000), "Cash");
    add("mk", 19, "Marketing", "Social media ads", 8000 + Math.round(r() * 9000), "M-Pesa"); add("in", 22, "Internet", "Fibre internet", 6500, "M-Pesa");
  }
  const S = [["Rift Distributors Ltd", "Food products"], ["Mombasa Hardware Wholesalers", "Hardware"], ["Nairobi Electronics Hub", "Electronics"], ["Kisumu Foods Co.", "Food products"], ["Eldoret Paper Mills", "Office supplies"], ["Thika Household Imports", "Household"], ["Nakuru Agro Supplies", "Food products"], ["Coast Tools & Paints", "Hardware"]];
  const suppliers = S.map((x, i) => ({ id: "sp" + (i + 1), name: x[0], category: x[1], phone: ph() }));
  const pos = Array.from({ length: 12 }, (_, i) => { const p = products[(i * 3) % products.length], qty = 20 + Math.floor(r() * 80), status = PO_FLOW[i % 5], tot = qty * p.cost; return { id: "po" + (i + 1), ref: "PO-" + (2000 + i), date: iso(-(12 - i) * 20), supplierId: suppliers[i % 8].id, productId: p.id, qty, unitCost: p.cost, status, paid: status === "Completed" ? tot : status === "Received" && i % 2 ? Math.round(tot / 2) : 0 }; });
  const E = [["Grace Mwende", "Operations Manager", "Operations"], ["Peter Njoroge", "Sales Manager", "Sales"], ["Faith Chebet", "Accountant", "Finance"], ["Samuel Odhiambo", "Storekeeper", "Warehouse"], ["Mercy Wairimu", "Cashier", "Sales"], ["Brian Kiptoo", "Driver", "Logistics"], ["Lucy Atieno", "Sales Representative", "Sales"], ["Daniel Mutua", "Procurement Officer", "Procurement"]];
  const employees = E.map((x, i) => ({ id: "em" + (i + 1), name: x[0], title: x[1], department: x[2], phone: ph() }));
  const T = ["Count warehouse stock", "Follow up Kilimani Mini Mart invoice", "Reconcile M-Pesa payments", "Deliver order to Naivasha Road Stores", "Request quotes for cement", "Update price list", "Prepare monthly sales summary", "Service delivery van", "Call overdue customers", "Reorder padlocks", "Train cashier on new till", "Check supplier invoices"];
  const tasks = T.map((t, i) => ({ id: "t" + (i + 1), title: t, assigneeId: employees[i % 8].id, priority: ["High", "Medium", "Low"][i % 3], due: iso((i % 7) - 2), status: TASK_STATUS[i % 4] }));
  const L = [["Karen Bistro Group", 450000], ["Westlands Offices Ltd", 280000], ["Green Valley School", 620000], ["Thika Road Mall Shops", 340000], ["Mombasa Road Builders", 910000], ["Kasarani Sacco", 150000], ["Lang'ata Clinic", 210000], ["Ngong Hardware", 380000], ["Ruiru Caterers", 120000], ["Eastleigh Traders", 530000]];
  const leads = L.map((l, i) => ({ id: "l" + (i + 1), name: l[0], value: l[1], stage: STAGES[i % 7], followUp: iso((i % 9) - 1), ownerId: employees[1 + (i % 2) * 5].id }));
  return withV2({ products, customers, sales, expenses, suppliers, pos, employees, tasks, leads, read: [] });
}
const money = (n) => (n < 0 ? "-" : "") + "KSh " + Math.round(Math.abs(n)).toLocaleString("en-KE");
const pct = (c, p) => (p ? ((c - p) / Math.abs(p)) * 100 : 0);
const fmtDate = (d) => new Date(d).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
const within = (d, a, b) => { const t = +new Date(d); return t >= a && t < b; };
const poTotal = (p) => p.qty * p.unitCost;
function totals(db, from, to) {
  const s = db.sales.filter((x) => within(x.date, from, to)), revenue = s.reduce((a, x) => a + x.total, 0);
  const cogs = s.reduce((a, x) => a + x.items.reduce((b, i) => b + i.qty * i.cost, 0), 0), expenses = db.expenses.filter((e) => within(e.date, from, to)).reduce((a, e) => a + e.amount, 0);
  return { revenue, cogs, gross: revenue - cogs, expenses, net: revenue - cogs - expenses, orders: s.length, collected: s.reduce((a, x) => a + x.paid, 0) };
}
function period(db, d) { const now = Date.now() + 1000, from = now - d * DAY; return { cur: totals(db, from, now), prev: totals(db, from - d * DAY, from) }; }
function series(db, d) {
  const now = Date.now() + 1000, from = now - d * DAY, step = d <= 30 ? 1 : d <= 90 ? 7 : 30;
  return Array.from({ length: Math.ceil(d / step) }, (_, i) => { const s = from + i * step * DAY, t = totals(db, s, s + step * DAY); return { label: new Date(s).toLocaleDateString("en-KE", { day: "numeric", month: "short" }), Revenue: t.revenue, Expenses: t.expenses, Profit: t.net, "Cash flow": t.collected - t.expenses }; });
}
const receivable = (db) => db.sales.reduce((a, s) => a + s.total - s.paid, 0);
const inventoryValue = (db) => db.products.reduce((a, p) => a + p.cost * p.stock, 0);
const lowStock = (db) => db.products.filter((p) => p.stock <= p.reorder);
const payables = (db) => db.pos.filter((p) => p.status === "Received" || p.status === "Completed").reduce((a, p) => a + poTotal(p) - p.paid, 0);
function customerStats(db, id) { const s = db.sales.filter((x) => x.customerId === id); return { lifetime: s.reduce((a, x) => a + x.total, 0), balance: s.reduce((a, x) => a + x.total - x.paid, 0), orders: s.length }; }
function notices(db) {
  const now = Date.now(), n = [];
  db.products.filter((p) => p.stock <= p.reorder).forEach((p) => n.push({ id: `low-${p.id}-${p.stock}`, kind: "Low stock", text: `${p.name}: ${p.stock} left (reorder at ${p.reorder})`, href: "/inventory" }));
  db.sales.filter((s) => s.total > s.paid && now - +new Date(s.date) > 30 * DAY).forEach((s) => n.push({ id: `od-${s.id}-${s.paid}`, kind: "Overdue invoice", text: `${s.ref} has ${money(s.total - s.paid)} unpaid after 30+ days`, href: "/finance" }));
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
