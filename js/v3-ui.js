"use strict";
/* Shared UI layer: modals, drawers, confirmation dialogs, form builder with validation, double-submit protection, demo reset. */
(function () {
  let root, last = null, state = null;
  const mroot = () => root || (root = Object.assign(document.createElement("div"), { id: "modal-root" }), document.body.appendChild(root), root);
  const fid = (id) => "mf-" + id;
  function openModal(o) {
    closeModal(true); last = document.activeElement; state = { onClose: o.onClose, busy: false };
    mroot().innerHTML = `<div class="mscrim${o.drawer ? " drawer" : ""}" data-act="mscrim"><div class="modal glass ${o.size || ""}" role="dialog" aria-modal="true" aria-labelledby="mtitle" tabindex="-1"><div class="mhead"><h2 id="mtitle">${o.title}</h2><button class="icon-btn" data-act="mclose" aria-label="Close">${ic("x", 18)}</button></div><div class="mbody">${o.body}</div>${o.footer ? `<div class="mfoot">${o.footer}</div>` : ""}</div></div>`;
    document.body.classList.add("modal-open"); const m = mroot().querySelector(".modal"), f = m.querySelector("input:not([type=hidden]),select,textarea,button.primary") || m; setTimeout(() => f.focus(), 0); return m;
  }
  function closeModal(silent) {
    if (!root || !root.firstChild) return; const s = state; root.innerHTML = ""; document.body.classList.remove("modal-open"); state = null;
    if (!silent) { if (s && s.onClose) s.onClose(); if (last && last.isConnected) last.focus(); }
  }
  const isOpen = () => !!(root && root.firstChild);
  function field(f) {
    const id = fid(f.id), v = f.value === undefined || f.value === null ? "" : f.value, req = f.required ? " required" : "", ph = f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : "", ro = f.readonly ? " readonly" : "";
    let c;
    if (f.type === "select") c = `<select class="in" id="${id}"${req}>${f.blank !== undefined ? `<option value="">${esc(f.blank)}</option>` : ""}${opts(f.options, String(v), (x) => (Array.isArray(x) ? x : [x, x]))}</select>`;
    else if (f.type === "textarea") c = `<textarea class="in" id="${id}" rows="3"${ph}>${esc(v)}</textarea>`;
    else c = `<input class="in" id="${id}" type="${f.type || "text"}" value="${esc(v)}"${req}${ph}${ro}${f.min !== undefined ? ` min="${f.min}"` : ""}${f.max !== undefined ? ` max="${f.max}"` : ""}${f.step ? ` step="${f.step}"` : ""}${f.inputmode ? ` inputmode="${f.inputmode}"` : ""}>`;
    return `<label class="${f.wide ? "wide" : ""}">${esc(f.label)}${f.required ? ' <span class="mu">(required)</span>' : ""}${c}<small class="ferr" data-for="${f.id}" role="alert"></small>${f.help ? `<small class="mu">${esc(f.help)}</small>` : ""}</label>`;
  }
  function formModal(o) {
    const body = `<form id="mform" novalidate><div class="mgrid">${o.fields.map(field).join("")}</div>${o.extra || ""}<div class="ferr form-err" id="mf-err" role="alert"></div></form>`;
    const footer = `<button class="btn ghost" type="button" data-act="mclose">Cancel</button><button class="btn primary" type="submit" form="mform" id="msubmit">${esc(o.submit || "Save")}</button>`;
    const m = openModal({ title: esc(o.title), body, footer, size: o.size, drawer: o.drawer }); const form = m.querySelector("#mform");
    form.addEventListener("submit", (e) => {
      e.preventDefault(); if (!state || state.busy) return; const vals = {}, errs = {};
      o.fields.forEach((f) => { const el = form.querySelector("#" + fid(f.id)); let v = el ? el.value : ""; if (typeof v === "string" && f.type !== "textarea") v = v.trim(); if (f.type === "number") v = v === "" ? null : Number(v); vals[f.id] = v;
        if (f.required && (v === "" || v === null)) errs[f.id] = f.label + " is required."; else if (f.type === "number" && v !== null && (isNaN(v) || (f.min !== undefined && v < f.min) || (f.max !== undefined && v > f.max))) errs[f.id] = f.label + " must be " + (f.min !== undefined ? "at least " + f.min : "a valid number") + (f.max !== undefined ? " and at most " + f.max : "") + ".";
        else if (f.validate && v !== "" && v !== null) { const r = f.validate(v, vals); if (r) errs[f.id] = r; } });
      if (Object.keys(errs).length === 0 && o.check) { const r = o.check(vals); if (typeof r === "string") errs._form = r; else if (r) Object.assign(errs, r); }
      showErrs(form, errs); if (Object.keys(errs).length) { const first = form.querySelector(".ferr:not(:empty)"); const inp = first && first.closest("label") ? first.closest("label").querySelector("input,select,textarea") : null; if (inp) inp.focus(); return; }
      state.busy = true; const b = m.querySelector("#msubmit"); b.disabled = true; let r;
      try { r = o.onSubmit(vals); } catch (x) { r = x.message || "Something went wrong."; }
      if (typeof r === "string" || (r && typeof r === "object")) { state.busy = false; b.disabled = false; return showErrs(form, typeof r === "string" ? { _form: r } : r); }
      closeModal(true); document.body.classList.remove("modal-open");
    });
    return m;
  }
  function showErrs(form, errs) {
    form.querySelectorAll(".ferr[data-for]").forEach((e) => { e.textContent = errs[e.dataset.for] || ""; const i = e.closest("label").querySelector("input,select,textarea"); if (i) i.setAttribute("aria-invalid", errs[e.dataset.for] ? "true" : "false"); }); form.querySelector("#mf-err").textContent = errs._form || "";
  }
  function confirmModal(o) {
    const m = openModal({ title: esc(o.title), size: "sm", body: `<p>${o.message}</p>${o.extra || ""}<div class="ferr form-err" id="mf-err" role="alert"></div>`, footer: `<button class="btn ghost" type="button" data-act="mclose">Cancel</button><button class="btn${o.danger ? " danger-btn" : ""} primary" type="button" id="mok">${esc(o.ok || "Confirm")}</button>` });
    m.querySelector("#mok").addEventListener("click", () => { if (!state || state.busy) return; state.busy = true; m.querySelector("#mok").disabled = true; const r = o.onOk && o.onOk(m); closeModal(true); document.body.classList.remove("modal-open"); return r; });
  }
  document.addEventListener("click", (e) => { const el = e.target.closest("[data-act=mclose],[data-act=mscrim]"); if (!el) return; if (el.dataset.act === "mscrim" && e.target !== el) return; closeModal(); }, true);
  document.addEventListener("keydown", (e) => {
    if (!isOpen()) return; if (e.key === "Escape") { e.preventDefault(); return closeModal(); }
    if (e.key === "Tab") { const f = [...root.querySelectorAll("button,input,select,textarea,a[href],[tabindex]:not([tabindex='-1'])")].filter((x) => !x.disabled && x.offsetParent !== null || x.tagName === "A"); if (!f.length) return; const a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } }
  });
  Object.assign(ICONS, { x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>', "chevron-right": '<path d="m9 18 6-6-6-6"/>', mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-10 5L2 7"/>', "message-circle": '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>', eye: '<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>', "alert-triangle": '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>', check: '<path d="M20 6 9 17l-5-5"/>', "heart-pulse": '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"/>', "user-round": '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>', "arrow-left": '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>' });
  function resetDemo() {
    const th = !!window.HarxelTheme;
    confirmModal({ title: "Reset demo data?", message: "This restores the original Apex General Supplies dataset. Anything you added or changed during the demo is removed.", ok: "Reset demo data", danger: 1, extra: th ? '<label class="chk"><input type="checkbox" id="rst-th"> Also reset appearance (theme, accent, density)</label>' : "",
      onOk: (m) => { const wantTheme = th && m.querySelector("#rst-th").checked; db = seed(); Object.keys(ui).forEach((k) => { if (!["days", "fdays", "rtype", "rdays", "cat"].includes(k)) delete ui[k]; }); ui.q = ""; ui.chat = []; save(); if (wantTheme) HarxelTheme.reset(); toast("Demo data reset to the original."); location.hash = "/"; render(); } });
  }
  A.reset = resetDemo;
  window.UI = { openModal, closeModal, formModal, confirmModal, isOpen, field };
})();
