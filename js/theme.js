(function (root) {
"use strict";
var KEY = "harxel-theme-v1";
var PRESETS = { orange: ["Burnt orange", "#C0391B"], blue: ["Blue", "#1D4ED8"], green: ["Green", "#15803D"], red: ["Red", "#B91C1C"], purple: ["Purple", "#7E22CE"], teal: ["Teal", "#0F766E"], pink: ["Pink", "#BE185D"], slate: ["Slate", "#475569"] };
var DEF = { mode: "auto", accent: "orange", custom: "", bg: "", surface: "", radius: "default", density: "comfortable" };
var PAL = { light: { bg: "#FAF8F3", card: "#FFFFFF", tx: "#202020", tx2: "#4A4A4A", mu: "#6B6B6B", bd: "#E2DDD4" }, dark: { bg: "#121212", card: "#1C1C1C", tx: "#F2F2F2", tx2: "#CFCFCF", mu: "#A3A3A3", bd: "#333333" } };
var STATUS = { light: { ok: "#2A7249", okt: "#E6F3EA", warn: "#8A5A10", warnt: "#FBF0D9", bad: "#B3261E", badt: "#F9E1DF", info: "#1D4ED8", infot: "#E3ECFD" }, dark: { ok: "#5CC98A", okt: "#14301F", warn: "#E3B04B", warnt: "#33270C", bad: "#F28B82", badt: "#3A1613", info: "#8FB4FF", infot: "#16233F" } };
var RADIUS = { sharp: "4px", default: "16px", round: "24px" };

function rgb(h) { h = h.replace("#", ""); if (h.length === 3) h = h.replace(/./g, "$&$&"); var n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function hex(c) { return "#" + c.map(function (v) { return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"); }).join("").toUpperCase(); }
function lum(h) { var c = rgb(h).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
function contrast(a, b) { var x = lum(a), y = lum(b); if (x < y) { var t = x; x = y; y = t; } return (x + 0.05) / (y + 0.05); }
function mix(a, b, t) { var x = rgb(a), y = rgb(b); return hex(x.map(function (v, i) { return v + (y[i] - v) * t; })); }
function readableOn(bg) { return contrast("#FFFFFF", bg) >= contrast("#111111", bg) ? "#FFFFFF" : "#111111"; }
function fix(fg, bg, min) { min = min || 4.5; var tgt = lum(bg) < 0.5 ? "#FFFFFF" : "#000000", c = fg, i = 0; while (contrast(c, bg) < min && i++ < 40) c = mix(c, tgt, 0.05); return c; }

function compute(t, dark) {
  t = Object.assign({}, DEF, t);
  var p = Object.assign({}, PAL[dark ? "dark" : "light"]), warn = [];
  if (t.bg) p.bg = t.bg;
  if (t.surface) p.card = t.surface;
  if (t.bg || t.surface) {
    var base = t.bg || p.card, light = lum(base) >= 0.5;
    p.tx = light ? "#202020" : "#F2F2F2"; p.tx2 = mix(p.tx, base, 0.2); p.mu = fix(mix(p.tx, base, 0.35), base); p.bd = mix(base, p.tx, 0.14);
    if (contrast(p.tx, p.card) < 4.5 || contrast(p.tx, p.bg) < 4.5) warn.push({ msg: "Text is hard to read on your custom background or surface.", fixLabel: "Use default backgrounds", patch: { bg: "", surface: "" } });
  }
  var accent = t.custom || (PRESETS[t.accent] || PRESETS.orange)[1], a = accent, bg2 = mix(p.bg, p.tx, 0.05);
  var legible = function (c) { for (var i = 0; i < 3; i++) { c = fix(c, p.card); c = fix(c, p.bg); c = fix(c, bg2); c = fix(c, mix(c, p.card, dark ? 0.8 : 0.88)); } return c; };
  if (!t.custom) a = legible(accent); // presets always auto-adjusted so accent text stays readable everywhere
  var pt = mix(a, p.card, dark ? 0.8 : 0.88), p2 = mix(a, dark ? "#FFFFFF" : "#000000", 0.14);
  var worst = Math.min(contrast(a, p.card), contrast(a, p.bg), contrast(a, bg2), contrast(a, pt));
  if (t.custom && worst < 4.5) warn.push({ msg: "This accent colour has low contrast (" + worst.toFixed(1) + ":1, AA needs 4.5:1) on your background.", fixLabel: "Adjust accent for readability", patch: { custom: legible(a) } });
  // text on accent buttons must be readable in both normal and hover state
  var on = ["#FFFFFF", "#111111"].sort(function (x, y) { return Math.min(contrast(y, a), contrast(y, p2)) - Math.min(contrast(x, a), contrast(x, p2)); })[0];
  var v = { "--bg": p.bg, "--card": p.card, "--bg2": bg2, "--tx": p.tx, "--tx2": p.tx2, "--mu": p.mu, "--bd": p.bd,
    "--p": a, "--p2": p2, "--pt": pt, "--on-p": on, "--r": RADIUS[t.radius] || RADIUS.default };
  var rgba = function (h, al) { var c = rgb(h); return "rgb(" + c[0] + " " + c[1] + " " + c[2] + " / " + al + ")"; };
  Object.assign(v, { "--bg-elev": dark ? mix(p.card, "#FFFFFF", 0.05) : mix(p.card, p.bg, 0.0), "--glass": rgba(p.card, dark ? 0.72 : 0.78), "--glass-bd": rgba(dark ? "#FFFFFF" : "#000000", dark ? 0.1 : 0.07),
    "--hover": mix(p.card, p.tx, 0.045), "--active": mix(p.card, p.tx, 0.09), "--focus": rgba(a, 0.35), "--dis-bg": mix(p.card, p.tx, 0.07), "--dis-tx": mix(p.card, p.tx, 0.45),
    "--sh1": dark ? "0 1px 2px rgb(0 0 0 / .5)" : "0 1px 2px rgb(32 32 32 / .06)", "--sh2": dark ? "0 6px 18px rgb(0 0 0 / .45)" : "0 6px 18px rgb(32 32 32 / .08)", "--sh3": dark ? "0 18px 50px rgb(0 0 0 / .6)" : "0 18px 50px rgb(32 32 32 / .18)",
    "--c-rev": a, "--c-exp": dark ? "#9AA7BD" : "#5B6B85", "--c-prof": STATUS[dark ? "dark" : "light"].ok, "--c-prev": p.mu });
  Object.assign(v, (function () { var o = {}, s = STATUS[dark ? "dark" : "light"]; for (var k in s) o["--" + k] = s[k]; return o; })());
  return { vars: v, warnings: warn, dark: dark };
}

var state = Object.assign({}, DEF);
function load() { try { state = Object.assign({}, DEF, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) { state = Object.assign({}, DEF); } }
function persist() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage blocked */ } }
function isDark() { return state.mode === "dark" || (state.mode === "auto" && root.matchMedia && root.matchMedia("(prefers-color-scheme: dark)").matches); }
var last = { warnings: [] };
function apply() {
  var d = isDark(), r = compute(state, d), h = document.documentElement; last = r;
  for (var k in r.vars) h.style.setProperty(k, r.vars[k]);
  h.setAttribute("data-theme", d ? "dark" : "light"); h.setAttribute("data-density", state.density); h.style.colorScheme = d ? "dark" : "light";
  var m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute("content", r.vars["--bg"]);
  if (typeof root.drawCharts === "function") { try { root.drawCharts(); } catch (e) { /* page without charts */ } }
  paintPanel();
}
function set(patch) { Object.assign(state, patch); if (patch.accent) state.custom = ""; persist(); apply(); }
function reset() { state = Object.assign({}, DEF); try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } apply(); }

var panel, btn;
function paintPanel() {
  if (!panel) return;
  var seg = function (key, items) { return '<div class="seg" role="group">' + items.map(function (i) { return '<button type="button" data-th="' + key + '" data-v="' + i[0] + '" aria-pressed="' + (state[key] === i[0]) + '">' + i[1] + "</button>"; }).join("") + "</div>"; };
  panel.innerHTML = '<h2>Appearance</h2><h3>Mode</h3>' + seg("mode", [["light", "Light"], ["dark", "Dark"], ["auto", "Auto"]]) +
    '<h3>Accent</h3><div class="sw">' + Object.keys(PRESETS).map(function (k) { return '<button type="button" class="swatch" data-th="accent" data-v="' + k + '" style="background:' + PRESETS[k][1] + '" aria-label="' + PRESETS[k][0] + '" aria-pressed="' + (!state.custom && state.accent === k) + '"></button>'; }).join("") + "</div>" +
    '<div class="row"><label>Custom accent <input type="color" data-col="custom" value="' + (state.custom || last.vars["--p"].slice(0, 7)) + '"></label><label>Background <input type="color" data-col="bg" value="' + (state.bg || last.vars["--bg"]) + '"></label><label>Surface <input type="color" data-col="surface" value="' + (state.surface || last.vars["--card"]) + '"></label></div>' +
    last.warnings.map(function (w, i) { return '<div class="warnbox" role="alert">' + w.msg + ' <button type="button" class="fixbtn" data-fix="' + i + '">' + w.fixLabel + "</button></div>"; }).join("") +
    '<h3>Corners</h3>' + seg("radius", [["sharp", "Sharp"], ["default", "Default"], ["round", "Round"]]) +
    '<h3>Density</h3>' + seg("density", [["comfortable", "Comfortable"], ["compact", "Compact"]]) +
    '<button type="button" class="fixbtn" data-th-reset>Reset appearance</button>';
}
function init() {
  btn = document.createElement("button"); btn.className = "icon-btn"; btn.id = "themebtn"; btn.setAttribute("aria-label", "Appearance"); btn.setAttribute("aria-expanded", "false");
  btn.innerHTML = '<svg class="ic" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3v18"/><path d="M12 3a9 9 0 0 1 0 18" fill="currentColor" stroke="none"/></svg>';
  var tr = document.querySelector(".top-r"); if (!tr) return; tr.insertBefore(btn, tr.querySelector(".demo") ? tr.querySelector(".demo").nextSibling : tr.firstChild);
  panel = document.createElement("div"); panel.className = "themepop hide"; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", "Appearance settings"); document.body.appendChild(panel); paintPanel();
  var toggle = function (o) { var open = o === undefined ? panel.classList.contains("hide") : o; panel.classList.toggle("hide", !open); btn.setAttribute("aria-expanded", String(open)); };
  btn.addEventListener("click", function () { toggle(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !panel.classList.contains("hide")) { toggle(false); btn.focus(); } });
  document.addEventListener("click", function (e) { if (!panel.classList.contains("hide") && !panel.contains(e.target) && !btn.contains(e.target)) toggle(false); });
  panel.addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    if (b.dataset.th) { var p = {}; p[b.dataset.th] = b.dataset.v; set(p); }
    else if (b.dataset.fix !== undefined) set(last.warnings[+b.dataset.fix].patch);
    else if (b.hasAttribute("data-th-reset")) reset();
  });
  panel.addEventListener("change", function (e) { var c = e.target.dataset.col; if (c) { var p = {}; p[c] = e.target.value; set(p); } });
  if (root.matchMedia) root.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () { if (state.mode === "auto") apply(); });
}
var api = { PRESETS: PRESETS, DEF: DEF, contrast: contrast, mix: mix, readableOn: readableOn, fix: fix, compute: compute, get: function () { return Object.assign({}, state); }, set: set, reset: reset };
if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }
root.HarxelTheme = api; load(); apply();
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})(typeof window !== "undefined" ? window : globalThis);
