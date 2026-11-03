"use strict";
const assert = require("assert"), T = require("../js/theme.js");
let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; console.log("PASS", n); } catch (e) { fail++; console.log("FAIL", n, "-", e.message); } };
t("contrast black/white is 21", () => assert.ok(Math.abs(T.contrast("#000", "#fff") - 21) < 0.01));
t("readableOn picks white on dark, dark on light", () => { assert.strictEqual(T.readableOn("#101010"), "#FFFFFF"); assert.strictEqual(T.readableOn("#FFEB3B"), "#111111"); });
t("fix() reaches 4.5:1", () => assert.ok(T.contrast(T.fix("#FFEB3B", "#FFFFFF"), "#FFFFFF") >= 4.5));
const cfgs = [["light", false, {}], ["dark", true, {}], ["custom", false, { custom: "#7A3FF2", bg: "#F0F4FF", surface: "#FFFFFF" }], ["custom-dark", true, { custom: "#FFB020", bg: "#0B1220", surface: "#121C30" }]];
for (const [name, dark, extra] of cfgs) for (const k of Object.keys(T.PRESETS)) t(`AA contrast ${name}/${k}`, () => {
  const { vars: v } = T.compute({ accent: k, ...extra, custom: extra.custom && k === "orange" ? extra.custom : "" }, dark);
  const chk = (a, b, l, m = 4.5) => assert.ok(T.contrast(v[a], v[b]) >= m, `${l} ${T.contrast(v[a], v[b]).toFixed(2)}`);
  chk("--tx", "--bg", "text/bg"); chk("--tx", "--card", "text/card"); chk("--tx2", "--card", "text2/card"); chk("--mu", "--card", "muted/card");
  chk("--p", "--card", "accent/card"); chk("--p", "--bg", "accent/bg"); chk("--p", "--bg2", "accent/bg2"); chk("--p", "--pt", "accent/tint"); chk("--on-p", "--p", "on-accent/accent"); chk("--on-p", "--p2", "on-accent/hover");
  for (const s of ["ok", "warn", "bad"]) chk("--" + s, "--" + s + "t", s + " tag");
});
t("bad custom accent produces a warning with a working fix", () => {
  const r = T.compute({ custom: "#FFF176" }, false); assert.ok(r.warnings.length === 1);
  const r2 = T.compute({ ...{ custom: "#FFF176" }, ...r.warnings[0].patch }, false); assert.strictEqual(r2.warnings.length, 0);
});
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
