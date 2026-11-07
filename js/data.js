"use strict";
const DAY = 864e5, KEY = "harxel-html-v1", DB_VERSION = 3;
const METHODS = ["M-Pesa", "Cash", "Bank transfer", "Card", "Other"];
const EXP_CATS = ["Rent", "Salaries", "Transport", "Utilities", "Marketing", "Maintenance", "Internet", "Miscellaneous"];
const CATS = ["Electronics", "Household", "Office supplies", "Food products", "Hardware"];
const STAGES = ["New Lead", "Contacted", "Qualified", "Proposal Sent", "Negotiation", "Won", "Lost"];
const PO_FLOW = ["Draft", "Submitted", "Approved", "Received", "Completed"];
const PO_TERMS = [0, 14, 30, 45, 60];
const CAN_APPROVE = ["Business Owner", "Administrator", "Finance Manager"];
const TASK_STATUS = ["To Do", "In Progress", "Under Review", "Completed"];
const ROLES = {
  "Business Owner": ["*"], Administrator: ["*"],
  "Finance Manager": ["/", "/finance", "/transactions", "/customers", "/purchases", "/reports", "/assistant", "/notifications"],
  "Sales Manager": ["/", "/sales", "/crm", "/customers", "/inventory", "/tasks", "/transactions", "/assistant", "/notifications"],
  "Inventory Manager": ["/inventory", "/purchases", "/tasks", "/notifications"], Employee: ["/tasks", "/notifications"],
};
function rng(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/* Deterministic seed for the fictional business (Apex General Supplies). Product, customer, supplier and employee ids are stable. */
const LOCS = ["Industrial Area", "Kilimani", "Westlands", "Embakasi", "Thika Road", "Kasarani", "Ngong Road", "South B", "Ruaraka", "Karen", "Eastleigh", "Lang'ata"];
function seed() {
  const r = rng(2026), now = Date.now(), L_ = L, ymd = L_.ymd, ph = () => `07${Math.floor(10 + r() * 89)} ${Math.floor(100 + r() * 899)} ${Math.floor(100 + r() * 899)}`, iso = (k) => new Date(now + k * DAY).toISOString();
  const sod = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), new Date(now).getDate()).getTime();
  const P = [["Samsung 32\" LED TV", "Electronics", 21500, 27900, 14, 5, "sp3"], ["Hotpoint Microwave 20L", "Electronics", 7800, 10500, 22, 6, "sp3"], ["Oraimo Power Bank 10000mAh", "Electronics", 1350, 1990, 60, 20, "sp3"], ["Ramtons Electric Kettle", "Household", 1450, 2150, 38, 10, "sp6"], ["Non-stick Sufuria Set (5pc)", "Household", 2600, 3600, 25, 8, "sp6"], ["Mattress 4x6 Medium", "Household", 7400, 9800, 11, 4, "sp6"], ["A4 Printing Paper (ream)", "Office supplies", 520, 720, 140, 40, "sp5"], ["Bic Pens (box of 50)", "Office supplies", 480, 700, 55, 15, "sp5"], ["Stapler Heavy Duty", "Office supplies", 650, 950, 9, 10, "sp5"], ["Unga Jogoo 2kg (carton of 12)", "Food products", 1380, 1620, 80, 25, "sp1"], ["Cooking Oil 5L Fresh Fri", "Food products", 1050, 1290, 46, 15, "sp4"], ["Pembe Sugar 2kg (carton of 10)", "Food products", 1750, 2050, 4, 12, "sp1"], ["Cement 50kg Bamburi", "Hardware", 690, 780, 210, 60, "sp2"], ["Iron Sheet Gauge 30 (3m)", "Hardware", 740, 920, 120, 40, "sp2"], ["Padlock 50mm", "Hardware", 260, 420, 0, 15, "sp8"], ["Paint 4L Crown White", "Hardware", 1650, 2300, 33, 10, "sp8"],
    ["Pishori Rice 5kg (carton of 4)", "Food products", 2480, 2890, 31, 12, "sp7"], ["Brookside Milk 500ml (tray of 12)", "Food products", 720, 840, 52, 20, "sp4"], ["Omo Detergent 1kg (carton of 12)", "Household", 1680, 2040, 27, 10, "sp6"], ["Extension Cable 5m", "Electronics", 480, 790, 11, 15, "sp3"], ["Wall Clock (analog)", "Household", 380, 620, 36, 10, "sp6"], ["Claw Hammer 16oz", "Hardware", 420, 650, 28, 10, "sp8"], ["Nails 4\" (25kg bag)", "Hardware", 3100, 3650, 8, 8, "sp2"], ["Spiral Notebooks (pack of 20)", "Office supplies", 560, 820, 75, 25, "sp5"]];
  const products = P.map((p, i) => ({ id: "p" + (i + 1), name: p[0], sku: "AGS-" + (1000 + i), category: p[1], cost: p[2], price: p[3], stock: p[4], reorder: p[5], supplierId: p[6] }));
  const C = [["Wanjiku Kamau", "Retail"], ["Otieno Ochieng", "Retail"], ["Mwangi & Sons Hardware", "Wholesale"], ["Achieng Akinyi", "Retail"], ["Kilimani Mini Mart", "Wholesale"], ["Juma Hassan", "Retail"], ["Naivasha Road Stores", "Wholesale"], ["Njeri Wambui", "Retail"], ["Rift Valley Caterers", "Wholesale"], ["Kiprop Cheruiyot", "Retail"], ["Starlight Academy", "Wholesale"], ["Amina Salim", "Retail"],
    ["Hillside Hotel & Lodge", "Wholesale"], ["Lakeview Contractors", "Wholesale"], ["Grace Mutheu", "Retail"], ["Peter Kibet", "Retail"], ["Fatuma Abdi", "Retail"], ["Ruaraka Mini Mart", "Wholesale"]];
  const reps = ["em2", "em5", "em7"];
  const customers = C.map((c, i) => { const w = c[1] === "Wholesale", name = c[0]; return { id: "c" + (i + 1), name, type: c[1], phone: ph(), email: w ? "accounts@" + name.toLowerCase().replace(/[^a-z]+/g, "").slice(0, 14) + ".example" : "", location: LOCS[i % LOCS.length], businessName: w ? name : "", category: w ? (i % 2 ? "Key account" : "Standard") : "Standard", salespersonId: reps[i % 3], terms: w ? 30 : 14, creditLimit: w ? 400000 + (i % 4) * 100000 : 150000, notes: "", created: i >= 16 ? iso(0) : iso(-(30 + Math.floor(r() * 330))) }; });
  const unitQty = (price) => (price > 8000 ? 1 + Math.floor(r() * 4) : price > 2000 ? 3 + Math.floor(r() * 9) : price > 900 ? 6 + Math.floor(r() * 16) : 10 + Math.floor(r() * 41));
  const sales = [], mkSale = (age, tOfDay) => {
    const items = Array.from({ length: 1 + Math.floor(r() * 3) }, () => { const p = products[Math.floor(r() * products.length)]; return { productId: p.id, qty: unitQty(p.price), price: p.price, cost: p.cost }; });
    const total = items.reduce((s, x) => s + x.qty * x.price, 0), roll = r(), w = age < 14 ? [0.3, 0.3, 0.4] : [0.4, 0.34, 0.26], x = r(), soldBy = reps[x < w[0] ? 0 : x < w[0] + w[1] ? 1 : 2];
    const paid = age < 30 && roll < 0.2 ? 0 : age >= 15 && age < 75 && roll > 0.9 ? Math.round(total * 0.5) : age > 90 && age < 200 && roll < 0.012 ? 0 : total;
    const day0 = sod - age * DAY, t = age === 0 ? sod + (now - sod) * (0.1 + 0.85 * tOfDay) : day0 + (8 + tOfDay * 10) * 36e5;
    sales.push({ id: "s" + (sales.length + 1), ref: "", date: new Date(t).toISOString(), customerId: customers[Math.floor(r() * customers.length)].id, items, method: METHODS[Math.floor(r() * 3)], paid, total, soldBy });
  };
  for (let age = 364; age >= 1; age--) {
    const dow = new Date(sod - age * DAY).getDay(), lam = (dow === 0 ? 0.25 : dow === 6 ? 0.65 : 0.95) * (age < 14 ? 1.75 : age < 60 ? 1.55 : 1.5) * (1 + 0.12 * Math.sin(age / 28));
    for (let n = Math.floor(lam + r()), k = 0; k < n; k++) mkSale(age, r());
  }
  for (let k = 0; k < 5; k++) mkSale(0, (k + r() * 0.6) / 5);
  sales.sort((a, b) => a.date.localeCompare(b.date)).forEach((s, i) => { s.ref = "INV-" + (1000 + i); });
  const expenses = [], cal = new Date(now);
  for (let m = 0; m < 12; m++) {
    const day = (dd) => new Date(cal.getFullYear(), cal.getMonth() - m, dd, 11).toISOString(), add = (k, dd, c, t, a, p, by) => { if (+new Date(day(dd)) <= now) expenses.push({ id: `e-${k}${m}`, date: day(dd), category: c, description: t, amount: a, method: p, status: "approved", by: by || "em3" }); };
    add("rent", 1, "Rent", "Warehouse rent, Industrial Area", 85000, "Bank transfer"); add("sal", 27, "Salaries", "Staff salaries", 190000 + Math.round(r() * 10000), "Bank transfer");
    add("util", 9, "Utilities", "KPLC and water", 18000 + Math.round(r() * 9000), "M-Pesa"); add("tr", 14, "Transport", "Delivery fuel and drivers", m === 1 ? 43000 : 22000 + Math.round(r() * 14000), "Cash", "em6");
    add("mk", 19, "Marketing", "Social media ads", 8000 + Math.round(r() * 9000), "M-Pesa"); add("in", 22, "Internet", "Fibre internet", 6500, "M-Pesa");
  }
  expenses.push({ id: "e-fuel-today", date: iso(0), category: "Transport", description: "Fuel for morning deliveries", amount: 4800, method: "Cash", status: "approved", by: "em6" },
    { id: "e-pend1", date: iso(-1), category: "Maintenance", description: "Warehouse roof repair", amount: 48000, method: "Bank transfer", status: "pending", by: "em4" },
    { id: "e-pend2", date: iso(-2), category: "Maintenance", description: "Delivery van service", amount: 27500, method: "M-Pesa", status: "pending", by: "em6" },
    { id: "e-pend3", date: iso(-3), category: "Miscellaneous", description: "Cashier till training", amount: 12000, method: "M-Pesa", status: "pending", by: "em1" });
  const S = [["Rift Distributors Ltd", "Food products", "Eldoret"], ["Mombasa Hardware Wholesalers", "Hardware", "Mombasa"], ["Nairobi Electronics Hub", "Electronics", "Nairobi"], ["Kisumu Foods Co.", "Food products", "Kisumu"], ["Eldoret Paper Mills", "Office supplies", "Eldoret"], ["Thika Household Imports", "Household", "Thika"], ["Nakuru Agro Supplies", "Food products", "Nakuru"], ["Coast Tools & Paints", "Hardware", "Mombasa"]];
  const suppliers = S.map((x, i) => ({ id: "sp" + (i + 1), name: x[0], category: x[1], phone: ph(), contact: ["Joseph Kiplagat", "Hassan Mwinyi", "Anne Wangari", "Dennis Owino", "Sarah Chepkoech", "Moses Karanja", "Ruth Njambi", "Ali Bakari"][i], email: "sales@" + x[0].toLowerCase().replace(/[^a-z]+/g, "").slice(0, 14) + ".example", location: x[2], pin: "P05" + (1000000 + i * 7919) + "X", terms: 30, opening: 0, notes: "" }));
  const poPlan = (i) => ({ i, status: PO_FLOW[i % 5], n: 1 + (i % 3) });
  const pos = Array.from({ length: 20 }, (_, i) => { const pl = poPlan(i), lines = Array.from({ length: pl.n }, (_, k) => { const p = products[(i * 3 + k * 5) % products.length]; return { productId: p.id, qty: p.cost > 5000 ? 3 + Math.floor(r() * 8) : p.cost > 1500 ? 8 + Math.floor(r() * 23) : 20 + Math.floor(r() * 100), unitCost: p.cost }; });
    const sup = products.find((p) => p.id === lines[0].productId).supplierId, date = iso(-(20 - i) * 13), tax = i % 4 === 0 ? 0 : 16, sub = lines.reduce((s, l) => s + l.qty * l.unitCost, 0), tot = sub + Math.round(sub * tax / 100);
    return { id: "po" + (i + 1), ref: "PO-" + (2000 + i), date, supplierId: sup, lines, productId: lines[0].productId, qty: lines[0].qty, unitCost: lines[0].unitCost, taxPct: tax, status: pl.status, paid: 0, notes: "", terms: 30, submittedBy: "em8", total: undefined, _tot: tot }; });
  const E = [["Grace Mwende", "Operations Manager", "Operations"], ["Peter Njoroge", "Sales Manager", "Sales"], ["Faith Chebet", "Accountant", "Finance"], ["Samuel Odhiambo", "Storekeeper", "Warehouse"], ["Mercy Wairimu", "Cashier", "Sales"], ["Brian Kiptoo", "Driver", "Logistics"], ["Lucy Atieno", "Sales Representative", "Sales"], ["Daniel Mutua", "Procurement Officer", "Procurement"]];
  const employees = E.map((x, i) => ({ id: "em" + (i + 1), name: x[0], title: x[1], department: x[2], phone: ph() }));
  const T = ["Count warehouse stock", "Follow up Kilimani Mini Mart invoice", "Reconcile M-Pesa payments", "Deliver order to Naivasha Road Stores", "Request quotes for cement", "Update price list", "Prepare monthly sales summary", "Service delivery van", "Call overdue customers", "Reorder padlocks", "Train cashier on new till", "Check supplier invoices", "Update customer credit limits", "Restock shelves in aisle 3", "Prepare delivery schedule", "Verify supplier statements", "Photograph new products", "Close daily cash register"];
  const tasks = T.map((t, i) => ({ id: "t" + (i + 1), title: t, assigneeId: employees[i % 8].id, priority: ["High", "Medium", "Low"][i % 3], due: iso((i % 7) - 2), status: TASK_STATUS[i % 4] }));
  const L2 = [["Karen Bistro Group", 450000], ["Westlands Offices Ltd", 280000], ["Green Valley School", 620000], ["Thika Road Mall Shops", 340000], ["Mombasa Road Builders", 910000], ["Kasarani Sacco", 150000], ["Lang'ata Clinic", 210000], ["Ngong Hardware", 380000], ["Ruiru Caterers", 120000], ["Eastleigh Traders", 530000]];
  const leads = L2.map((l, i) => ({ id: "l" + (i + 1), name: l[0], value: l[1], stage: STAGES[i % 7], followUp: iso((i % 9) - 1), ownerId: employees[1 + (i % 2) * 5].id }));
  const d = withV2({ products, customers, sales, expenses, suppliers, pos, employees, tasks, leads, read: [] });
  return typeof withV3 === "function" ? withV3(d) : d;
}
const money = (n) => (n < 0 ? "-" : "") + "KSh " + Math.round(Math.abs(n)).toLocaleString("en-KE");
const pct = (c, p) => (p ? ((c - p) / Math.abs(p)) * 100 : 0);
const fmtDate = (d) => new Date(String(d).length === 10 ? d + "T00:00:00" : d).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
const within = (d, a, b) => { const t = +new Date(d); return t >= a && t < b; };
const poTotal = (p) => L.poTotal(p);
/* Legacy API kept for existing pages and tests; everything delegates to the central ledger (js/ledger.js). */
const totals = (db, from, to) => L.range(db, L.dayOf(from), L.dayOf(to - 1));
const period = (db, d) => L.period(db, d);
const series = (db, d) => L.buckets(db, d <= 31 ? "day" : d <= 100 ? "week" : "month", d <= 31 ? d : d <= 100 ? Math.ceil(d / 7) : Math.ceil(d / 30));
const receivable = (db) => L.sumBal(L.receivables(db));
const inventoryValue = (db) => db.products.reduce((a, p) => a + p.cost * p.stock, 0);
const lowStock = (db) => L.lowStock(db).map((x) => x.p);
const payables = (db) => L.sumBal(L.payables(db));
const customerStats = (db, id) => L.customerStats(db, id);
function notices(db) {
  const now = Date.now(), n = [], t = L.today();
  L.lowStock(db).forEach(({ p }) => n.push({ id: `low-${p.id}-${p.stock}`, kind: "Low stock", text: `${p.name}: ${p.stock} left (reorder at ${p.reorder})`, href: "/inventory" }));
  L.receivables(db, t).filter((x) => x.overdue && x.kind !== "opening").forEach((x) => n.push({ id: `od-${x.id}-${x.balance}`, kind: "Overdue invoice", text: `${x.ref} has ${money(x.balance)} unpaid, ${x.daysOverdue} days overdue`, href: x.kind === "invoice" ? "/invoices" : "/finance" }));
  L.approvals(db).forEach((a) => n.push({ id: "ap-" + a.id, kind: "Approval needed", text: `${a.type}: ${a.title} is waiting for approval`, href: "/command" }));
  db.tasks.filter((x) => x.status !== "Completed" && +new Date(x.due) - now < 2 * DAY).forEach((x) => n.push({ id: `t-${x.id}-${x.status}`, kind: +new Date(x.due) < now ? "Task overdue" : "Task due soon", text: x.title, href: "/tasks" }));
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
  if (/overdue/.test(q)) { const o = L.receivables(db).filter((x) => x.overdue && x.kind !== "opening"); return o.length ? `${o.length} invoices are past their due date, totalling ${money(L.sumBal(o))}:\n` + o.slice(0, 8).map((x) => `${x.ref} · ${nm(x.customerId)}: ${money(x.balance)} (${x.daysOverdue} days overdue)`).join("\n") : "No invoices are overdue."; }
  if (/owe|receivable|debt|unpaid/.test(q)) { const d = db.customers.map((c) => ({ c, b: customerStats(db, c.id).balance })).filter((x) => x.b > 0).sort((a, b) => b.b - a.b); return `Customers owe ${money(receivable(db))} in total. Largest balances:\n` + d.slice(0, 5).map((x) => `${x.c.name}: ${money(x.b)}`).join("\n"); }
  if (/sell|top|best|popular/.test(q)) { const m = {}; db.sales.forEach((s) => s.items.forEach((i) => (m[i.productId] = (m[i.productId] || 0) + i.qty))); return "Best-selling products by units sold (all time):\n" + Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, n]) => `${(db.products.find((p) => p.id === id) || {}).name || "Deleted product"}: ${n} units`).join("\n"); }
  if (/summar|performance|weekly|report/.test(q)) { const t = totals(db, Date.now() - 30 * DAY, Date.now() + 1000), open = db.pos.filter((p) => p.status !== "Completed"); return `Last 30 days:\nRevenue ${money(t.revenue)} from ${t.orders} orders\nGross profit ${money(t.gross)}\nExpenses ${money(t.expenses)}\nNet profit ${money(t.net)}\nReceivables ${money(receivable(db))}, low-stock items ${lowStock(db).length}, open purchase orders ${open.length} (${money(open.reduce((a, p) => a + poTotal(p), 0))}).`; }
  if (/revenue|sales|income|turnover/.test(q)) return `Revenue this month so far: ${money(cur.revenue)} from ${cur.orders} orders. Last month: ${money(prev.revenue)}.`;
  return "I can't answer that from the business data. Try asking about revenue, expenses, low stock, who owes money, top products, overdue invoices, or a performance summary.";
}
