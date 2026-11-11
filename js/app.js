"use strict";
let db, role = "Business Owner";
const ui = { days: 30, fdays: 90, q: "", cat: "", rtype: "Sales report", rdays: 30, chat: [] };
const charts = {};
try { const raw = localStorage.getItem(KEY); db = raw ? JSON.parse(raw) : seed(); role = localStorage.getItem(KEY + "-role") || role; } catch (e) { db = seed(); }
if (!db.invoices) db = withV2(db);
migrate(db);
if (!ROLES[role]) role = "Business Owner";
const $ = (s) => document.querySelector(s), esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const ICONS = {
  "layout-dashboard": '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
  "shopping-cart": '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
  package: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  briefcase: '<path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/>',
  "check-square": '<path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  "bar-chart": '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  sparkles: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  menu: '<path d="M4 12h16"/><path d="M4 6h16"/><path d="M4 18h16"/>',
  "panel-left": '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>',
  "rotate-ccw": '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  "trending-up": '<path d="M22 7 13.5 15.5 8.5 10.5 2 17"/><path d="M16 7h6v6"/>',
  "trending-down": '<path d="M22 17 13.5 8.5 8.5 13.5 2 7"/><path d="M16 17h6v-6"/>',
  receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>',
  "trash-2": '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  pencil: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  printer: '<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
  send: '<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/>',
};
const ic = (n, s = 18) => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ""}</svg>`;
const statIcon = (l) => /revenue|sales|income|collected/i.test(l) ? "trending-up" : /expense|payable/i.test(l) ? "receipt" : /profit/i.test(l) ? "wallet" : /order/i.test(l) ? "shopping-cart" : /receivable|customer|lead|supplier|win/i.test(l) ? "users" : /inventory|product|stock/i.test(l) ? "package" : "bar-chart";
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* storage blocked */ } };
const uid = () => Math.random().toString(36).slice(2, 9), val = (id) => ($("#" + id) || {}).value || "", num = (id) => Number(val(id)) || 0;
const nameOf = (list, id, d) => (db[list].find((x) => x.id === id) || { name: d || "—" }).name;
let tt; function toast(m, bad) { const t = $("#toast"); t.className = "toast" + (bad ? " err" : ""); t.textContent = m; t.setAttribute("role", bad ? "alert" : "status"); clearTimeout(tt); tt = setTimeout(() => (t.textContent = "", t.className = ""), 3000); }
function mut(fn, msg) { fn(); save(); toast(msg); render(); }
const opts = (list, sel, f) => list.map((x) => { const [v, l] = f ? f(x) : [x, x]; return `<option value="${esc(v)}"${v === sel ? " selected" : ""}>${esc(l)}</option>`; }).join("");
const head = (t, s, a = "") => `<div class="head"><div><h1>${t}</h1><p>${s}</p></div><div class="acts">${a}</div></div>`;
const stat = (l, v, c, h) => `<div class="card stat"><div class="stat-top"><span>${l}</span><div class="chip">${ic(statIcon(l), 18)}</div></div><b>${v}</b><div class="stat-foot">${c === undefined ? "" : `<em class="delta ${c >= 0 ? "up" : "down"}">${ic(c >= 0 ? "trending-up" : "trending-down", 14)}${Math.abs(c).toFixed(1)}%</em><span>vs previous period</span>`}${h ? `<span>${h}</span>` : ""}</div></div>`;
const rangeSel = (key) => `<select class="in" aria-label="Date range" data-set="${key}">${[[7, "7 days"], [30, "30 days"], [90, "90 days"], [180, "6 months"], [365, "12 months"]].map(([d, l]) => `<option value="${d}"${ui[key] == d ? " selected" : ""}>${l}</option>`).join("")}</select>`;
const table = (cols, rows, empty) => `<div class="scroll"><table><thead><tr>${cols.map((c) => `<th${c[0] === ">" ? ' class="r"' : ""}>${c.replace(/^>/, "")}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map((r) => `<tr>${r.map((c, i) => `<td${cols[i][0] === ">" ? ' class="r"' : ""}>${c}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${cols.length}" class="mu">${empty || "No records."}</td></tr>`}</tbody></table></div>`;
const tag = (t, k = "") => `<span class="tag ${k}">${esc(t)}</span>`;
const payTag = (s) => s.paid >= s.total ? tag("Paid", "ok") : s.paid > 0 ? tag("Partial", "warn") : tag("Unpaid", "bad");
const search = (ph) => `<div class="searchbox">${ic("search", 16)}<input class="in" id="q" data-set="q" placeholder="${ph}" value="${esc(ui.q)}" aria-label="${ph}"></div>`;
const futureDate = (d) => new Date(Date.now() + d * DAY).toISOString().slice(0, 10);

const PAGES = {
  "/reports": () => { const r = reportData(); return head("Reports", "Filtered records you can export. CSV opens in Excel; use Print for a PDF.", `<select class="in" aria-label="Report" data-set="rtype">${opts(REPORTS, ui.rtype)}</select>${r.range ? rangeSel("rdays") : ""}<button class="btn" data-act="csv">${ic("download", 16)}Export CSV</button><button class="btn ghost" data-act="print">${ic("printer", 16)}Print / save as PDF</button>`) +
    `<div class="printhead"><h2>Apex General Supplies Ltd. · ${ui.rtype}</h2><p>${r.range ? "Last " + ui.rdays + " days" : "As at today"} · Generated ${new Date().toLocaleDateString("en-KE")} · KES</p></div><div class="card"><p><b>${r.total}</b> · ${r.rows.length} records</p>${table(r.cols, r.rows.slice(0, 200).map((row) => row.map((c, j) => (typeof c === "number" && r.cols[j].includes("KSh") ? Math.round(c).toLocaleString("en-KE") : esc(c)))), "No records for this filter.")}</div>`; },
  "/assistant": () => head("AI Business Assistant", "Answers are calculated from your records. If it can't answer, it says so. This demo does not use an external AI service.") + `<div class="chips">${SUGGESTIONS.map((s) => `<button class="btn ghost sm" data-act="ask" data-q="${esc(s)}">${s}</button>`).join("")}</div><div class="card"><div class="chat">${ui.chat.length ? ui.chat.map((m) => `<div class="chat"><div class="msg u">${esc(m.u)}</div><div class="msg a">${esc(m.a)}</div></div>`).join("") : '<p class="mu">Pick a question above or type your own.</p>'}</div><div class="acts"><input class="in" id="aq" style="flex:1" placeholder="Ask about your business"><button class="btn" data-act="ask">${ic("send", 16)}Ask</button></div></div>`,
  "/notifications": () => { const l = notices(db); return head("Notifications", "Generated from your live data: stock, invoices, approvals and deadlines. No emails or SMS are sent in this demo.", '<button class="btn ghost" data-act="readall">Mark all as read</button>') + `<div class="card">${l.length ? l.map((n) => { const r = db.read.includes(n.id); return `<div class="row" style="opacity:${r ? 0.55 : 1}"><span>${tag(n.kind, r ? "" : "warn")} ${esc(n.text)}</span><a class="btn ghost sm" href="#${n.href}" data-act="read" data-id="${esc(n.id)}">Open</a></div>`; }).join("") : '<p class="mu">You are all caught up.</p>'}</div>`; },
};
const NAVMAP = { "/": ["Overview", "layout-dashboard"], "/notifications": ["Notifications", "bell"], "/sales": ["Sales", "shopping-cart"], "/crm": ["CRM Pipeline", "target"], "/customers": ["Customers", "users"], "/inventory": ["Products & Inventory", "package"], "/purchases": ["Purchases & Suppliers", "truck"], "/tasks": ["Tasks", "check-square"], "/employees": ["Employees", "briefcase"], "/finance": ["Finance", "wallet"], "/reports": ["Reports", "bar-chart"], "/assistant": ["AI Assistant", "sparkles"] };
const GROUPS = [["Workspace", ["/", "/notifications"]], ["Sales", ["/sales", "/crm", "/customers"]], ["Operations", ["/inventory", "/purchases", "/tasks", "/employees"]], ["Finance & insights", ["/finance", "/reports", "/assistant"]]];
const REPORTS = ["Sales report", "Expense report", "Inventory report", "Customer report", "Outstanding payments", "Supplier payables"];
function reportData() {
  const t = ui.rtype, from = Date.now() - ui.rdays * DAY, inR = (d) => +new Date(d) >= from, nm = (id) => nameOf("customers", id, "Walk-in"), sum = (a, f) => a.reduce((x, y) => x + f(y), 0);
  if (t === "Sales report") { const s = db.sales.filter((x) => inR(x.date)); return { range: 1, cols: ["Reference", "Date", "Customer", "Method", ">Total (KSh)", ">Paid (KSh)"], rows: s.map((x) => [x.ref, fmtDate(x.date), nm(x.customerId), x.method, x.total, x.paid]), total: "Total sales " + money(sum(s, (x) => x.total)) }; }
  if (t === "Expense report") { const e = db.expenses.filter((x) => inR(x.date)); return { range: 1, cols: ["Date", "Category", "Description", "Paid by", ">Amount (KSh)"], rows: e.map((x) => [fmtDate(x.date), x.category, x.description, x.method, x.amount]), total: "Total expenses " + money(sum(e, (x) => x.amount)) }; }
  if (t === "Inventory report") return { cols: ["SKU", "Product", "Category", ">Stock", ">Reorder level", ">Cost (KSh)", ">Value at cost (KSh)"], rows: db.products.map((p) => [p.sku, p.name, p.category, p.stock, p.reorder, p.cost, p.stock * p.cost]), total: "Inventory value " + money(inventoryValue(db)) };
  if (t === "Customer report") return { cols: ["Customer", "Type", ">Orders", ">Lifetime purchases (KSh)", ">Balance owed (KSh)"], rows: db.customers.map((c) => { const s = customerStats(db, c.id); return [c.name, c.type, s.orders, s.lifetime, s.balance]; }), total: db.customers.length + " customers" };
  if (t === "Outstanding payments") { const o = db.sales.filter((x) => x.total > x.paid); return { cols: ["Reference", "Date", "Customer", ">Total (KSh)", ">Balance (KSh)"], rows: o.map((x) => [x.ref, fmtDate(x.date), nm(x.customerId), x.total, x.total - x.paid]), total: "Outstanding " + money(sum(o, (x) => x.total - x.paid)) }; }
  const o = db.pos.filter((p) => (p.status === "Received" || p.status === "Completed") && poTotal(p) > p.paid);
  return { cols: ["Order", "Supplier", ">Total (KSh)", ">Paid (KSh)", ">Balance (KSh)"], rows: o.map((p) => [p.ref, nameOf("suppliers", p.supplierId), poTotal(p), p.paid, poTotal(p) - p.paid]), total: "Payables " + money(sum(o, (p) => poTotal(p) - p.paid)) };
}
const A = {
  menu: () => { $("#side").classList.toggle("open"); $("#scrim").classList.toggle("hide"); },
  collapse: () => document.body.classList.toggle("collapsed"),
  receipt: (el) => { const s = db.sales.find((x) => x.id === el.dataset.id), w = window.open("", "_blank"); if (!w) return toast("Allow pop-ups to open the receipt.", 1); const logo = new URL("assets/harxel-logo.jpg", location.href).href;
    w.document.write(`<title>${s.ref}</title><body style="font-family:sans-serif;max-width:480px;margin:24px auto"><div style="aspect-ratio:3.4/1;background:url(${logo}) center/132% auto no-repeat;width:200px"></div><h2>Apex General Supplies Ltd.</h2><p>Nairobi, Kenya · Receipt ${s.ref}<br>${fmtDate(s.date)} · ${esc(nameOf("customers", s.customerId, "Walk-in"))} · ${s.method}</p><table width="100%" cellpadding="6" style="border-collapse:collapse">${s.items.map((i) => `<tr style="border-bottom:1px solid #ddd"><td>${i.qty} × ${esc(nameOf("products", i.productId, "Deleted product"))}</td><td align="right">${money(i.qty * i.price)}</td></tr>`).join("")}<tr><td><b>Total</b></td><td align="right"><b>${money(s.total)}</b></td></tr><tr><td>Paid</td><td align="right">${money(s.paid)}</td></tr><tr><td>Balance</td><td align="right">${money(s.total - s.paid)}</td></tr></table><p style="color:#777;font-size:12px">Demo document. Generated by Harxel Business OS.</p><script>print()<\/script></body>`); w.document.close(); },
  ask: (el) => { const q = (el.dataset.q || val("aq")).trim(); if (!q) return; ui.chat.push({ u: q, a: answer(db, q) }); render(); },
  read: (el) => { db.read.push(el.dataset.id); save(); },
  readall: () => mut(() => (db.read = notices(db).map((n) => n.id)), "All notifications marked as read."),
  print: () => window.print(),
  csv: () => { const r = reportData(), head = [["Apex General Supplies Ltd. (Harxel Business OS demo)"], [ui.rtype], [r.range ? `Last ${ui.rdays} days` : "As at today"], ["Generated " + new Date().toLocaleString("en-KE")], ["Currency: KES"], [r.total], [], r.cols.map((c) => c.replace(/^>/, ""))];
    const csv = [...head, ...r.rows].map((x) => x.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n"), a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv" })); a.download = ui.rtype.toLowerCase().replace(/ /g, "-") + ".csv"; a.click(); URL.revokeObjectURL(a.href); },
};
function smooth(pts) {
  const n = pts.length; if (n < 2) return pts.length ? "M" + pts[0][0] + " " + pts[0][1] : ""; const dx = [], dy = [], m = [], t = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; dy[i] = pts[i + 1][1] - pts[i][1]; m[i] = dy[i] / dx[i]; }
  t[0] = m[0]; t[n - 1] = m[n - 2]; for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  for (let i = 0; i < n - 1; i++) { if (m[i] === 0) { t[i] = t[i + 1] = 0; continue; } const a = t[i] / m[i], b = t[i + 1] / m[i], h = Math.hypot(a, b); if (h > 3) { t[i] = (3 * a / h) * m[i]; t[i + 1] = (3 * b / h) * m[i]; } }
  let d = "M" + pts[0][0].toFixed(1) + " " + pts[0][1].toFixed(1); for (let i = 0; i < n - 1; i++) { const x1 = pts[i][0] + dx[i] / 3, x2 = pts[i + 1][0] - dx[i] / 3; d += `C${x1.toFixed(1)} ${(pts[i][1] + (t[i] * dx[i]) / 3).toFixed(1)} ${x2.toFixed(1)} ${(pts[i + 1][1] - (t[i + 1] * dx[i]) / 3).toFixed(1)} ${pts[i + 1][0].toFixed(1)} ${pts[i + 1][1].toFixed(1)}`; } return d;
}
function drawCharts() {
  document.querySelectorAll(".chart").forEach((el) => {
    const c = charts[el.dataset.chart]; if (!c) return; const cv = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), COL = { Revenue: cv("--p"), Expenses: cv("--mu"), Profit: cv("--ok"), "Cash flow": cv("--warn") }, W = Math.max(280, el.clientWidth), H = c.h || 260, m = { l: 48, r: 12, t: 12, b: 26 }, pw = W - m.l - m.r, ph = H - m.t - m.b, n = c.data.length;
    const all = c.data.flatMap((d) => c.keys.map((k) => d[k])), mn = Math.min(0, ...all), mx0 = Math.max(1, ...all), mx = mx0 === mn ? mn + 1 : mx0, X = (i) => m.l + (n > 1 ? i / (n - 1) : 0.5) * pw, Y = (v) => m.t + ph - ((v - mn) / (mx - mn)) * ph, f = (v) => (Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1) + "M" : Math.round(v / 1e3) + "k");
    let s = `<svg width="${W}" height="${H}" role="img" aria-label="${esc(c.label || "Area chart")}"><defs>${c.keys.map((k, j) => `<linearGradient id="g-${el.dataset.chart}-${j}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${COL[k]}" stop-opacity=".22"/><stop offset="1" stop-color="${COL[k]}" stop-opacity="0"/></linearGradient>`).join("")}</defs>`;
    for (let i = 0; i <= 4; i++) { const v = mn + ((mx - mn) * i) / 4; s += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="${cv('--bd')}" stroke-dasharray="3 4"/><text x="${m.l - 6}" y="${Y(v) + 4}" text-anchor="end" font-size="12" fill="${cv('--mu')}">${f(v)}</text>`; }
    const every = Math.ceil(n / Math.max(2, Math.floor(pw / 78))); c.data.forEach((d, i) => { if (i % every === 0) s += `<text x="${X(i)}" y="${H - 6}" text-anchor="middle" font-size="12" fill="${cv('--mu')}">${d.label}</text>`; });
    c.keys.forEach((k, j) => { const pts = c.data.map((d, i) => [X(i), Y(d[k])]), line = smooth(pts), base = Y(Math.max(mn, 0)); s += `<path d="${line}L${X(n - 1).toFixed(1)} ${base}L${X(0).toFixed(1)} ${base}Z" fill="url(#g-${el.dataset.chart}-${j})" stroke="none"/><path d="${line}" fill="none" stroke="${COL[k]}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${X(n - 1)}" cy="${Y(c.data[n - 1][k])}" r="3.5" fill="${cv('--card')}" stroke="${COL[k]}" stroke-width="2"/>`; });
    s += `<line id="cur" y1="${m.t}" y2="${m.t + ph}" stroke="${cv('--bd')}" visibility="hidden"/></svg><div class="legend">${c.keys.map((k) => `<span><i style="background:${COL[k]}"></i>${k}</span>`).join("")}</div><div class="tip hide"></div>`;
    el.innerHTML = s; const svg = el.querySelector("svg"), tip = el.querySelector(".tip"), cur = svg.querySelector("#cur");
    const move = (e) => { const x = e.clientX - svg.getBoundingClientRect().left, i = Math.max(0, Math.min(n - 1, Math.round(((x - m.l) / pw) * (n - 1)))), d = c.data[i]; cur.setAttribute("x1", X(i)); cur.setAttribute("x2", X(i)); cur.setAttribute("visibility", "visible");
      tip.innerHTML = `<b>${d.label}</b>` + c.keys.map((k) => `<br><i class="dot" style="background:${COL[k]}"></i> ${k}: ${money(d[k])}`).join(""); tip.classList.remove("hide"); tip.style.top = "8px"; tip.style.left = Math.min(Math.max(X(i) + 12, 0), W - tip.offsetWidth - 4) + "px"; };
    svg.addEventListener("pointermove", move); svg.addEventListener("pointerdown", move); svg.addEventListener("pointerleave", () => { tip.classList.add("hide"); cur.setAttribute("visibility", "hidden"); });
  });
}
const DMAP = { "/customer": "/customers", "/employee": "/employees", "/supplier": "/purchases", "/product": "/inventory", "/invoice": "/invoices", "/quote": "/quotes" };
const canOpen = (h) => ROLES[role].includes("*") || ROLES[role].includes(h) || ROLES[role].includes(DMAP[h]);
const DETAIL = ["/invoice", "/quote", "/employee", "/customer", "/supplier", "/product"];
function routePath() { const h = location.hash.slice(1) || "/", m = h.match(/^(\/[a-z]+)\/([^/]+)$/); if (m && DETAIL.includes(m[1])) { ui.cur = m[2]; return m[1]; } return h === "/command" ? "/" : h; }
function render(focus) {
  const path = routePath(), ok = canOpen(path);
  const unread = notices(db).filter((n) => !db.read.includes(n.id)).length, allow = (h) => ROLES[role].includes("*") || ROLES[role].includes(h);
  $("#nav").innerHTML = GROUPS.map(([g, hs]) => { const items = hs.filter(allow); return items.length ? `<div class="glabel">${g}</div>` + items.map((h) => `<a class="nav${h === path ? " on" : ""}" href="#${h}" title="${NAVMAP[h][0]}">${ic(NAVMAP[h][1], 18)}<span class="lbl">${NAVMAP[h][0]}</span>${h === "/notifications" && unread ? `<span class="badge">${unread}</span>` : ""}</a>`).join("") : ""; }).join("");
  $("#crumb").textContent = (NAVMAP[path] || NAVMAP["/"])[0]; $("#bdot").classList.toggle("hide", !unread); $("#whoname").textContent = role; $("#av").textContent = role.split(" ").map((w) => w[0]).join("").slice(0, 2);
  $("#role").innerHTML = opts(Object.keys(ROLES), role);
  $("#view").innerHTML = !ok ? `<div class="card"><h1>No access</h1><p class="mu">The ${role} role cannot open this page. Switch role in the sidebar to compare permissions.</p></div>` : (PAGES[path] || PAGES["/"] || (() => ""))();
  drawCharts(); if (focus) { const e = $("#" + focus.id); if (e) { e.focus(); try { e.setSelectionRange(focus.pos, focus.pos); } catch (x) { /* not text */ } } }
}
document.addEventListener("click", (e) => { const el = e.target.closest("[data-act]"); if (!el) return; if (el.dataset.act !== "menu" && $("#side").classList.contains("open") && el.tagName === "A") A.menu(); const f = A[el.dataset.act]; if (f) f(el); });
document.addEventListener("change", (e) => { const t = e.target; if (t.dataset.cact) return A[t.dataset.cact](t, t.value); if (t.id === "role") { role = t.value; try { localStorage.setItem(KEY + "-role", role); } catch (x) { /* ignore */ } if (!(ROLES[role].includes("*") || ROLES[role].includes(location.hash.slice(1) || "/"))) location.hash = ROLES[role][0]; return render(); } if (t.dataset.set && t.tagName === "SELECT") { ui[t.dataset.set] = isNaN(t.value) || t.value === "" ? t.value : Number(t.value); render(); } });
document.addEventListener("input", (e) => { const t = e.target; if (t.dataset.set && t.tagName === "INPUT") { ui[t.dataset.set] = t.value; render({ id: t.id, pos: t.selectionStart }); } });
document.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.id === "aq") A.ask(e.target); });
window.addEventListener("hashchange", () => { ui.q = ""; if ($("#side").classList.contains("open")) A.menu(); render(); window.scrollTo(0, 0); });
let rt; window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(drawCharts, 150); });
document.querySelectorAll("[data-ic]").forEach((e) => (e.innerHTML = ic(e.dataset.ic, +e.dataset.s || 18)));
render();
