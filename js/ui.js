"use strict";
/* Shared UI components: floating modal and side drawer, one form engine with consistent validation, confirm dialog, command palette (Ctrl/Cmd+K), smooth spline paths.
   Every create/edit screen in the app is built on UI.form, so validation, loading and error behaviour are identical everywhere. */
const UI = (function () {
  const FOCUSABLE = 'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  let stack = [];
  function open(o) {
    const prev = document.activeElement, ov = document.createElement("div"), drawer = o.size === "drawer";
    ov.className = "overlay" + (drawer ? " right" : ""); ov.setAttribute("role", "presentation");
    ov.innerHTML = `<div class="${o.cls || (drawer ? "drawer" : "modal")}" role="dialog" aria-modal="true" aria-label="${esc(o.title || "Dialog")}"><div class="mh"><div><h2>${esc(o.title || "")}</h2>${o.sub ? `<p>${esc(o.sub)}</p>` : ""}</div><button class="icon-btn" data-x aria-label="Close">${ic("x", 18)}</button></div><div class="mb">${o.body || ""}</div>${o.footer ? `<div class="mf">${o.footer}</div>` : ""}</div>`;
    document.body.appendChild(ov); document.body.style.overflow = "hidden";
    const h = { el: ov, box: ov.firstElementChild, close() { if (!ov.isConnected) return; ov.remove(); stack = stack.filter((x) => x !== h); if (!stack.length) document.body.style.overflow = ""; if (prev && prev.focus && prev.isConnected) prev.focus(); if (o.onClose) o.onClose(); } };
    ov.addEventListener("click", (e) => { if (e.target.closest("[data-x]") || (e.target === ov && o.dismissOnBackdrop)) h.close(); });
    ov.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); h.close(); } if (e.key === "Tab") { const f = [...h.box.querySelectorAll(FOCUSABLE)].filter((x) => x.offsetParent !== null); if (!f.length) return; const a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } } });
    stack.push(h); setTimeout(() => { const f = h.box.querySelector(o.focus || "input:not([type=hidden]),select,textarea") || h.box.querySelector("[data-x]"); if (f) f.focus(); }, 30); return h;
  }
  const closeAll = () => [...stack].forEach((h) => h.close());

  function confirmBox(o) {
    return new Promise((res) => { let done = false; const h = open({ title: o.title, size: "modal", cls: "modal", body: `<div style="font-size:14px;line-height:1.6">${o.body || ""}</div>${o.check ? `<label style="display:flex;gap:8px;align-items:center;margin-top:14px;font-size:13px"><input type="checkbox" id="cf-chk"> ${esc(o.check)}</label>` : ""}`, footer: `<button class="btn sec" data-no>Cancel</button><button class="btn ${o.danger ? "danger" : ""}" data-yes>${esc(o.label || "Confirm")}</button>`, focus: "[data-no]", onClose: () => { if (!done) res(false); } });
      h.box.querySelector("[data-no]").onclick = () => h.close(); h.box.querySelector("[data-yes]").onclick = () => { done = true; const c = h.box.querySelector("#cf-chk"); const v = c ? { checked: c.checked } : true; h.close(); res(v); }; });
  }

  /* ---------- form engine ---------- */
  const ERR = { req: (l) => `${l} is required.`, num: (l) => `${l} must be a number.`, min: (l, m) => `${l} must be ${m === 0 ? "zero or more" : "at least " + m}.`, max: (l, m) => `${l} must be ${m} or fewer.`, len: (l, m) => `${l} must be ${m} characters or fewer.` };
  function fieldHtml(f, v) {
    const id = "f-" + f.k, val = v == null ? "" : v, a = `id="${id}" name="${f.k}" class="in" ${f.ph ? `placeholder="${esc(f.ph)}"` : ""} ${f.max ? `maxlength="${f.max}"` : ""} aria-describedby="${id}-e"`;
    let input;
    if (f.type === "select") input = `<select ${a}>${(f.opts || []).map((o) => { const [ov, ol] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(ov)}"${String(ov) === String(val) ? " selected" : ""}>${esc(ol)}</option>`; }).join("")}</select>`;
    else if (f.type === "textarea") input = `<textarea ${a} rows="3">${esc(val)}</textarea>`;
    else input = `<input ${a} type="${f.type === "number" ? "number" : f.type === "tel" ? "tel" : f.type || "text"}" value="${esc(val)}" ${f.type === "number" ? `inputmode="decimal" step="${f.step || 1}" ${f.min != null ? `min="${f.min}"` : ""}` : ""} ${f.type === "date" && f.min ? `min="${f.min}"` : ""} ${f.type === "date" && f.maxDate ? `max="${f.maxDate}"` : ""} autocomplete="off">`;
    return `${f.section ? `<div class="fsec full">${esc(f.section)}</div>` : ""}<div class="fld${f.full || f.type === "textarea" ? " full" : ""}"><label for="${id}"${f.req ? ' class="req"' : ""}>${esc(f.label)}</label>${input}${f.help ? `<div class="fhelp">${esc(f.help)}</div>` : ""}<div class="ferr" id="${id}-e" role="alert"></div></div>`;
  }
  function check(f, raw) {
    const v = String(raw == null ? "" : raw).trim(), l = f.label;
    if (!v) return f.req ? ERR.req(l) : "";
    if (f.type === "number") { const n = Number(v); if (!Number.isFinite(n)) return ERR.num(l); if (f.int && !Number.isInteger(n)) return `${l} must be a whole number.`; if (f.min != null && n < f.min) return ERR.min(l, f.min); if (f.maxN != null && n > f.maxN) return ERR.max(l, f.maxN); }
    if (f.max && v.length > f.max) return ERR.len(l, f.max);
    if (f.type === "email" && D.rules.email(v)) return D.rules.email(v); if (f.type === "tel" && D.rules.phone(v)) return D.rules.phone(v); if (f.rule && D.rules[f.rule] && D.rules[f.rule](v)) return D.rules[f.rule](v);
    if (f.type === "date") { if (D.rules.date(v)) return D.rules.date(v); if (f.min && v < f.min) return `${l} cannot be before ${fmtDate(f.min)}.`; if (f.maxDate && v > f.maxDate) return `${l} cannot be after ${fmtDate(f.maxDate)}.`; }
    return "";
  }
  /** spec: { title, sub, size, fields[], values{}, submit, extra(html), bind(box), collect(box)->obj merged into values, onSubmit(values, handle) } */
  function form(spec) {
    const vals = spec.values || {}, body = `<div class="ferr" id="f-banner" role="alert" style="display:none;margin:0 0 12px;padding:10px 12px;background:var(--badt);border-radius:9px;font-size:13px"></div><form novalidate id="uiform"><div class="fgrid">${spec.fields.map((f) => fieldHtml(f, vals[f.k] !== undefined ? vals[f.k] : f.val)).join("")}</div>${spec.extra || ""}</form>`;
    let busy = false;
    const h = open({ title: spec.title, sub: spec.sub, size: spec.size || "modal", body, footer: `${spec.left || ""}<button class="btn sec" data-x>Cancel</button><button class="btn" id="f-save" type="button">${esc(spec.submit || "Save")}</button>`, onClose: spec.onClose }), box = h.box;
    const banner = (m) => { const b = box.querySelector("#f-banner"); b.textContent = m || ""; b.style.display = m ? "block" : "none"; };
    const show = (f, m) => { const e = box.querySelector(`#f-${f.k}-e`), i = box.querySelector(`#f-${f.k}`); if (e) e.textContent = m; if (i) i.classList.toggle("err", !!m); };
    const read = () => { const o = {}; spec.fields.forEach((f) => { const i = box.querySelector(`#f-${f.k}`); o[f.k] = i ? i.value : ""; }); return Object.assign(o, spec.collect ? spec.collect(box) : {}); };
    const validate = () => { let first = null; spec.fields.forEach((f) => { const m = check(f, (box.querySelector(`#f-${f.k}`) || {}).value); show(f, m); if (m && !first) first = f; }); if (first) box.querySelector(`#f-${first.k}`).focus(); return !first; };
    spec.fields.forEach((f) => { const i = box.querySelector(`#f-${f.k}`); if (i) { i.addEventListener("blur", () => show(f, check(f, i.value))); i.addEventListener("input", () => { if (i.classList.contains("err")) show(f, check(f, i.value)); if (spec.onChange) spec.onChange(f.k, i.value, box); }); } });
    if (spec.bind) spec.bind(box, h);
    const save = box.querySelector("#f-save");
    const go = async () => {
      if (busy) return; banner(""); const okf = validate(); if (!okf) return; busy = true; save.classList.add("loading"); save.disabled = true; const label = save.textContent; save.textContent = "Saving…";
      try { await new Promise((r) => setTimeout(r, 120)); const out = await spec.onSubmit(read(), h); if (out !== false) h.close(); }
      catch (e) { banner(e.message || "Something went wrong. Nothing was saved."); if (e.code && spec.onCode) spec.onCode(e, go); }
      finally { busy = false; save.classList.remove("loading"); save.disabled = false; save.textContent = label; }
    };
    save.addEventListener("click", go); box.querySelector("#uiform").addEventListener("submit", (e) => { e.preventDefault(); go(); });
    box.querySelector("#uiform").addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.tagName === "INPUT" && !e.target.list) { e.preventDefault(); go(); } });
    return h;
  }

  /* ---------- smooth monotone spline (Fritsch-Carlson), so curves never overshoot the data ---------- */
  function spline(pts) {
    const n = pts.length; if (!n) return ""; if (n === 1) return `M${pts[0][0]} ${pts[0][1]}`;
    const dx = [], m = [], t = new Array(n);
    for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; m[i] = (pts[i + 1][1] - pts[i][1]) / (dx[i] || 1); }
    t[0] = m[0]; t[n - 1] = m[n - 2];
    for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
    for (let i = 0; i < n - 1; i++) { if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; } const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b; if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; } }
    let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < n - 1; i++) { const h = dx[i] / 3; d += `C${(pts[i][0] + h).toFixed(1)} ${(pts[i][1] + t[i] * h).toFixed(1)} ${(pts[i + 1][0] - h).toFixed(1)} ${(pts[i + 1][1] - t[i + 1] * h).toFixed(1)} ${pts[i + 1][0].toFixed(1)} ${pts[i + 1][1].toFixed(1)}`; }
    return d;
  }

  /* ---------- command palette ---------- */
  function palette() {
    if (stack.some((h) => h.box.classList.contains("palette"))) return;
    const allow = (h) => ROLES[role].includes("*") || ROLES[role].includes(h);
    const acts = () => (window.QUICK || []).filter((a) => !a.route || allow(a.route));
    const records = () => [...db.customers.map((c) => ({ g: "Customers", t: c.name, s: c.phone, go: () => nav("/customers", { custOpen: c.id }) })), ...db.products.map((p) => ({ g: "Products", t: p.name, s: p.sku, go: () => nav("/inventory", { q: p.name }) })), ...db.invoices.map((i) => ({ g: "Invoices", t: i.number, s: nameOf("customers", i.customerId), go: () => nav("/invoice", { cur: i.id }) })), ...db.suppliers.map((s) => ({ g: "Suppliers", t: s.name, s: s.location, go: () => nav("/purchases", { q: s.name }) })), ...Object.keys(NAVMAP).filter((k) => allow(k) && !["/invoice", "/quote", "/new"].includes(k)).map((k) => ({ g: "Go to", t: NAVMAP[k][0], s: "", go: () => nav(k) }))];
    let items = [], idx = 0;
    const h = open({ title: "Quick actions", size: "modal", cls: "palette", body: "" }); const box = h.box; box.innerHTML = `<input id="pq" placeholder="Type an action or search records…" aria-label="Quick actions and search" autocomplete="off"><div class="plist" role="listbox" id="pl"></div>`;
    const draw = () => { const q = box.querySelector("#pq").value.trim().toLowerCase(); const A_ = acts().map((a) => ({ g: "Actions", t: a.label, s: a.hint || "", go: a.run, ic: a.ic })); const R_ = q ? records().filter((r) => (r.t + " " + r.s).toLowerCase().includes(q)) : [];
      items = (q ? A_.filter((a) => a.t.toLowerCase().includes(q) || (a.s || "").toLowerCase().includes(q)) : A_).concat(R_).slice(0, 30); idx = Math.min(idx, Math.max(0, items.length - 1)); let last = "";
      box.querySelector("#pl").innerHTML = items.length ? items.map((x, i) => { const hd = x.g !== last ? `<div class="pgrp">${x.g}</div>` : ""; last = x.g; return `${hd}<button class="pi${i === idx ? " on" : ""}" role="option" data-i="${i}">${x.ic ? ic(x.ic, 17) : ""}<span>${esc(x.t)}</span><small>${esc(x.s || "")}</small></button>`; }).join("") : `<div class="empty"><b>No matches</b>Try a customer, product, invoice or supplier name.</div>`; };
    const run = (i) => { const x = items[i]; if (!x) return; h.close(); setTimeout(x.go, 40); };
    box.addEventListener("input", () => { idx = 0; draw(); }); box.addEventListener("click", (e) => { const b = e.target.closest(".pi"); if (b) run(+b.dataset.i); });
    box.addEventListener("keydown", (e) => { if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); idx = (idx + (e.key === "ArrowDown" ? 1 : -1) + items.length) % Math.max(1, items.length); draw(); const on = box.querySelector(".pi.on"); if (on) on.scrollIntoView({ block: "nearest" }); } if (e.key === "Enter") { e.preventDefault(); run(idx); } });
    h.el.addEventListener("click", (e) => { if (e.target === h.el) h.close(); }); draw(); return h;
  }
  document.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); palette(); } });
  return { open, closeAll, confirm: confirmBox, form, spline, palette, check };
})();
