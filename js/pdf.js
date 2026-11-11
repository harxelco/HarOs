"use strict";
/* Minimal dependency-free PDF writer for invoices and quotations (A4, Helvetica, WinAnsi).
   HarxelPDF.build(model) returns a Uint8Array. Works in browsers and Node. No network, no libraries. */
(function (root) {
  const REG = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
  const BLD = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584];
  const MAP = { "·": 183, "—": 151, "–": 150, "×": 215, "’": 146, "‘": 145, "“": 147, "”": 148, "•": 149, "−": 45, "…": 133 };
  const code = (ch) => { const c = ch.charCodeAt(0); return MAP[ch] !== undefined ? MAP[ch] : c >= 32 && c < 127 ? c : c >= 161 && c <= 255 ? c : 63; };
  const wOf = (c, bold) => (c >= 32 && c < 127 ? (bold ? BLD : REG)[c - 32] : c === 151 ? 1000 : c === 150 ? 556 : c === 183 || c === 149 ? 350 : c === 215 ? 584 : 556);
  const width = (str, size, bold) => { let w = 0; for (const ch of String(str)) w += wOf(code(ch), bold); return (w * size) / 1000; };
  const esc = (str) => { let o = ""; for (const ch of String(str)) { const c = code(ch); o += c === 40 || c === 41 || c === 92 ? "\\" + String.fromCharCode(c) : c < 127 && c >= 32 ? String.fromCharCode(c) : "\\" + c.toString(8).padStart(3, "0"); } return o; };
  const wrap = (str, max, size, bold) => {
    const out = []; String(str == null ? "" : str).split(/\n/).forEach((para) => {
      let line = ""; para.split(/\s+/).filter(Boolean).forEach((word) => {
        const t = line ? line + " " + word : word;
        if (width(t, size, bold) <= max || !line) line = t; else { out.push(line); line = word; }
        while (width(line, size, bold) > max && line.length > 1) { let k = line.length - 1; while (k > 1 && width(line.slice(0, k), size, bold) > max) k--; out.push(line.slice(0, k)); line = line.slice(k); }
      }); out.push(line);
    }); return out;
  };
  const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => (v / 255).toFixed(3)).join(" "); };
  const W = 595.28, H = 841.89, M = 42, FOOT = 60;
  const INK = "#202020", GREY = "#666666", ACC = "#C0391B", BAND = "#F3EFE6", RULE = "#DDD7CC";

  function build(m) {
    const pages = []; let cur, y;
    const newPage = () => { cur = []; pages.push(cur); y = M; };
    const text = (x, yy, str, size, o) => { o = o || {}; const w = width(str, size, o.bold), px = o.align === "right" ? x - w : o.align === "center" ? x - w / 2 : x; cur.push(`BT /${o.bold ? "F2" : "F1"} ${size} Tf ${rgb(o.color || INK)} rg ${px.toFixed(2)} ${(H - yy).toFixed(2)} Td (${esc(str)}) Tj ET`); };
    const rect = (x, yy, w, h, fill) => cur.push(`${rgb(fill)} rg ${x.toFixed(2)} ${(H - yy - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
    const hline = (x1, x2, yy, col, lw) => cur.push(`${rgb(col || RULE)} RG ${lw || 0.6} w ${x1.toFixed(2)} ${(H - yy).toFixed(2)} m ${x2.toFixed(2)} ${(H - yy).toFixed(2)} l S`);
    const para = (x, str, size, max, o) => { o = o || {}; wrap(str, max, size, o.bold).forEach((l) => { text(x, y + size, l, size, o); y += size * 1.35; }); };
    const R = { qty: 330, price: 410, disc: 458, amt: W - M }, DW = 240;

    newPage();
    // Header
    text(M, y + 16, m.biz.name, 17, { bold: 1, color: ACC });
    let hy = y + 30; [m.biz.address, [m.biz.phone, m.biz.email].filter(Boolean).join("  ·  ")].filter(Boolean).forEach((l) => { text(M, hy, l, 9, { color: GREY }); hy += 12; });
    text(W - M, y + 22, m.title, 24, { bold: 1, color: INK, align: "right" });
    text(W - M, y + 38, m.number, 11, { bold: 1, color: GREY, align: "right" });
    y = Math.max(hy, y + 46) + 12; hline(M, W - M, y, ACC, 1.5); y += 20;
    // Bill to + meta
    const top = y; text(M, y + 9, "BILL TO", 8, { bold: 1, color: GREY }); y += 14;
    text(M, y + 12, m.billTo.name, 12, { bold: 1 }); y += 17;
    [m.billTo.phone, m.billTo.email].filter(Boolean).forEach((l) => { text(M, y + 10, l, 9.5, { color: GREY }); y += 13; });
    let my = top; m.meta.forEach(([k, v]) => { text(W - M - 150, my + 9, k, 9, { color: GREY }); text(W - M, my + 9, v, 9.5, { bold: 1, align: "right" }); my += 15; });
    y = Math.max(y, my) + 18;
    // Table
    const head = () => { rect(M, y, W - 2 * M, 22, BAND); const ty = y + 14.5; text(M + 8, ty, "Description", 8.5, { bold: 1, color: GREY }); text(R.qty, ty, "Qty", 8.5, { bold: 1, color: GREY, align: "right" }); text(R.price, ty, "Unit price", 8.5, { bold: 1, color: GREY, align: "right" }); text(R.disc, ty, "Disc.", 8.5, { bold: 1, color: GREY, align: "right" }); text(R.amt - 8, ty, "Amount", 8.5, { bold: 1, color: GREY, align: "right" }); y += 22; };
    head();
    m.lines.forEach((l) => {
      const d = wrap(l.desc, DW, 10), h = d.length * 13 + 12;
      if (y + h > H - FOOT - 20) { newPage(); head(); }
      d.forEach((t, i) => text(M + 8, y + 17 + i * 13, t, 10));
      text(R.qty, y + 17, String(l.qty), 10, { align: "right" }); text(R.price, y + 17, l.price, 10, { align: "right" }); text(R.disc, y + 17, l.disc, 10, { align: "right" }); text(R.amt - 8, y + 17, l.amount, 10, { bold: 1, align: "right" });
      y += h; hline(M, W - M, y);
    });
    // Totals
    y += 12; if (y + m.totals.length * 18 + 20 > H - FOOT) { newPage(); }
    m.totals.forEach(([k, v, strong]) => { if (strong) { rect(W - M - 210, y - 2, 210, 22, BAND); } text(W - M - 200, y + 13, k, strong ? 11 : 10, { bold: strong, color: strong ? INK : GREY }); text(W - M - 8, y + 13, v, strong ? 11 : 10, { bold: strong, align: "right" }); y += strong ? 26 : 18; });
    // Payment, notes, terms
    const block = (title, body) => { if (!body) return; const ls = wrap(body, W - 2 * M, 9).length; if (y + 22 + ls * 12.2 > H - FOOT) newPage(); y += 8; text(M, y + 9, title, 8, { bold: 1, color: GREY }); y += 14; para(M, body, 9, W - 2 * M, { color: INK }); };
    if (m.payment) { y += 6; const body = m.payment.join("\n"), ls = wrap(body, W - 2 * M - 24, 9.5).length, bh = ls * 13 + 30; if (y + bh > H - FOOT) newPage(); rect(M, y, W - 2 * M, bh, BAND); text(M + 12, y + 17, "PAYMENT INSTRUCTIONS", 8, { bold: 1, color: GREY }); const sy = y; y += 24; para(M + 12, body, 9.5, W - 2 * M - 24); y = sy + bh; }
    block("NOTES", m.notes); block("TERMS AND CONDITIONS", m.terms); if (m.disclaimer) { y += 6; para(M, m.disclaimer, 8, W - 2 * M, { color: GREY }); }
    // Footer + assemble
    const n = pages.length; pages.forEach((p, i) => { cur = p; hline(M, W - M, H - 44, RULE); text(M, H - 30, m.number + "  ·  " + m.biz.name, 8, { color: GREY }); text(W - M, H - 30, "Page " + (i + 1) + " of " + n, 8, { color: GREY, align: "right" }); });
    const objs = []; const add = (s) => (objs.push(s), objs.length);
    add("<< /Type /Catalog /Pages 2 0 R >>"); add(""); const f1 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"), f2 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
    const kids = pages.map((p) => { const body = p.join("\n"), c = add(`<< /Length ${body.length} >>\nstream\n${body}\nendstream`); return add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${c} 0 R >>`); });
    objs[1] = `<< /Type /Pages /Kids [${kids.map((k) => k + " 0 R").join(" ")}] /Count ${kids.length} >>`;
    const info = add(`<< /Title (${esc(m.title + " " + m.number)}) /Producer (Harxel Business OS) >>`);
    let out = "%PDF-1.4\n", offs = []; objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
    const xr = out.length; out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("") + `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info ${info} 0 R >>\nstartxref\n${xr}\n%%EOF\n`;
    const bytes = new Uint8Array(out.length); for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255; return bytes;
  }
  const api = { build, width, wrap };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.HarxelPDF = api;
})(typeof window !== "undefined" ? window : globalThis);
