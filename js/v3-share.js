"use strict";
/* One document model feeds the HTML view, the print view and the PDF. One share component serves invoices and quotations.
   Nothing here sends anything: WhatsApp and the email app are opened with the message prepared, and the user presses send. */
(function () {
  const V = window.V2, td = () => new Date().toISOString().slice(0, 10), S = () => db.settings;
  const LBL = { draft: "Draft", sent: "Sent", viewed: "Viewed", partially_paid: "Partially paid", paid: "Paid", cancelled: "Cancelled", credited: "Credited", accepted: "Accepted", rejected: "Rejected", expired: "Expired", converted: "Converted" };
  const kes = (n) => "KES " + Math.round(n).toLocaleString("en-KE");
  const bizShort = () => S().bizName.replace(/\.+$/, "");
  const find = (k, id) => (k === "inv" ? db.invoices : db.quotes).find((x) => x.id === id);

  function DocModel(kind, d) {
    const inv = kind === "inv", c = db.customers.find((x) => x.id === d.customerId) || { name: "—" }, t = V.totals(d.lines, d.disc, d.vat), s = S(), full = { ...d, total: t.total };
    const st = inv ? V.dstatus(full, td()) : { status: d.status, balance: 0, overdue: false }, label = (LBL[st.status] || st.status) + (st.overdue ? " (overdue)" : "");
    const totals = [["Subtotal", money(t.sub)]]; if (t.disc) totals.push(["Discount", "-" + money(t.disc)]); totals.push(["VAT " + (d.vat || 0) + "%", money(t.tax)], ["Total", money(t.total), 1]);
    if (inv) { if (d.credited) totals.push(["Credit notes", "-" + money(d.credited)]); totals.push(["Amount paid", money(d.paid || 0)], ["Balance due", money(st.balance), 1]); }
    return { kind, inv, number: d.number, title: inv ? "INVOICE" : "QUOTATION", word: inv ? "Invoice" : "Quotation", status: label, total: t.total, balance: st.balance, customer: c,
      biz: { name: s.bizName, address: s.address, phone: s.phone, email: s.email }, billTo: { name: c.name, phone: c.phone || "", email: c.email || "" },
      meta: [["Issue date", fmtDate(d.issue)], [inv ? "Due date" : "Valid until", fmtDate(inv ? d.due : d.validUntil)], ["Status", label]],
      lines: d.lines.map((l) => ({ desc: l.desc, qty: l.qty, price: money(l.price), disc: (l.disc || 0) + "%", amount: money(Math.round(l.qty * l.price * (1 - (l.disc || 0) / 100))) })), totals,
      payment: inv && st.balance > 0 ? ["Bank: " + s.bank, "M-Pesa: " + s.mpesa, "Please quote " + d.number + " as the payment reference."] : null, notes: d.notes || "", terms: d.terms || "", disclaimer: "Demo document. Not a KRA-validated tax invoice.", file: d.number + ".pdf" };
  }
  function DocHTML(kind, d) {
    const m = DocModel(kind, d), e = esc;
    return `<div class="doc"><h2>${e(m.biz.name)}</h2><small>${e(m.biz.address)} · ${e(m.biz.phone)} · ${e(m.biz.email)}</small><h3>${m.title} ${e(m.number)}</h3><p><b>Bill to:</b> ${e(m.billTo.name)}${m.billTo.phone ? " · " + e(m.billTo.phone) : ""}${m.billTo.email ? " · " + e(m.billTo.email) : ""}<br>${m.meta.map(([k, v]) => `<b>${k}:</b> ${e(v)}`).join(" · ")}</p>
      <div class="wrap"><table><thead><tr><th>Description</th><th class="r">Qty</th><th class="r">Unit price</th><th class="r">Disc.</th><th class="r">Amount</th></tr></thead><tbody>${m.lines.map((l) => `<tr><td>${e(l.desc)}</td><td class="r">${l.qty}</td><td class="r">${l.price}</td><td class="r">${l.disc}</td><td class="r">${l.amount}</td></tr>`).join("")}</tbody></table></div>
      <table class="tot" style="width:auto;margin-left:auto">${m.totals.map(([k, v, b]) => `<tr><td>${b ? "<b>" + k + "</b>" : k}</td><td class="r">${b ? "<b>" + v + "</b>" : v}</td></tr>`).join("")}</table>
      ${m.payment ? `<div class="box"><b>Payment instructions</b><br>${m.payment.map(e).join("<br>")}</div>` : ""}${m.notes ? `<p>${e(m.notes)}</p>` : ""}<p><small><b>Terms:</b> ${e(m.terms)}</small></p><p><small>${m.disclaimer}</small></p></div>`;
  }
  const pdfOf = (kind, d) => { const m = DocModel(kind, d), bytes = HarxelPDF.build(m); return { m, bytes, name: m.file, file: typeof File === "function" ? new File([bytes], m.file, { type: "application/pdf" }) : null }; };
  function download(p) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([p.bytes], { type: "application/pdf" })); a.download = p.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
  const canShareFile = (p) => { try { return !!(p.file && navigator.canShare && navigator.canShare({ files: [p.file] }) && navigator.share); } catch (e) { return false; } };
  const message = (m, forMail) => `Hello ${m.customer.name},\n\nPlease find your ${m.word} from ${bizShort()}.\n\nDocument Number: ${m.number}\nAmount: ${kes(m.total)}${m.inv && m.balance > 0 && m.balance !== m.total ? "\nBalance due: " + kes(m.balance) : ""}\n\nKindly review the document. Please contact us if you have any questions.\n\nThank you for your business.${forMail ? `\n\n${bizShort()}\n${S().phone} · ${S().email}` : ""}`;
  const subject = (m) => `${m.word} ${m.number} from ${bizShort()}`;

  let sh = null;
  const status = (kind, msg, tone) => { const el = $("#sh-status"); if (el) { el.className = "notice " + (tone || ""); el.textContent = msg; el.hidden = !msg; } };
  const head = (kind, d) => { const m = DocModel(kind, d); return `<div class="doc-sum"><div class="row"><span class="mu">Document number</span><b>${esc(m.number)}</b></div><div class="row"><span class="mu">Customer</span><b>${esc(m.customer.name)}</b></div><div class="row"><span class="mu">Total amount</span><b>${money(m.total)}</b></div><div class="row"><span class="mu">Status</span><b id="sh-st">${esc(m.status)}</b></div></div>`; };
  function open(kind, id, created) {
    const d = find(kind, id); if (!d) return toast("Document not found.", 1); sh = { kind, id }; const inv = kind === "inv";
    const m = UI.openModal({ title: created ? `${inv ? "Invoice" : "Quotation"} created` : `Share ${inv ? "invoice" : "quotation"} ${esc(d.number)}`, size: "md", onClose: () => { if (sh && sh.url) URL.revokeObjectURL(sh.url); sh = null; },
      body: `${created ? `<p class="done-line">${ic("check", 18)}<span>${esc(d.number)} was saved. Choose how to share it, or close this window to keep working.</span></p>` : ""}${head(kind, d)}<div class="sh-actions"><button class="btn ghost" data-act="shPreview">${ic("eye", 16)}Preview</button><button class="btn ghost" data-act="shDownload">${ic("download", 16)}Download PDF</button><button class="btn ghost" data-act="shWa">${ic("message-circle", 16)}Send via WhatsApp</button><button class="btn ghost" data-act="shMail">${ic("mail", 16)}Send via Email</button></div><div id="sh-panel"></div><div id="sh-status" class="notice" role="status" hidden></div>`,
      footer: `${d.status === "draft" ? '<button class="btn ghost" type="button" data-act="shMarkSent">Mark as sent</button>' : ""}<button class="btn primary" type="button" data-act="mclose">Done</button>` });
    return m;
  }
  const panel = (h) => { $("#sh-panel").innerHTML = h; status(null, ""); const i = $("#sh-panel input"); if (i) i.focus(); };
  const cur = () => { const d = find(sh.kind, sh.id); return { d, p: pdfOf(sh.kind, d) }; };
  Object.assign(A, {
    shareDoc: (el) => open(el.dataset.k, el.dataset.id),
    shPreview: () => { const { d, p } = cur(); if (sh.url) URL.revokeObjectURL(sh.url); let h;
      if (navigator.pdfViewerEnabled === true) { sh.url = URL.createObjectURL(new Blob([p.bytes], { type: "application/pdf" })); h = `<iframe class="pv" title="PDF preview" src="${sh.url}"></iframe>`; } else h = `<iframe class="pv" title="Document preview" srcdoc="${esc(`<!doctype html><meta charset=utf-8><style>${window.DOC_CSS}</style>${DocHTML(sh.kind, d)}`)}"></iframe>`;
      panel(`${h}<p class="mu small">This is the document that will be sent. Use Download PDF for the file.</p>`); },
    shDownload: () => { const { p } = cur(); download(p); status(null, `${p.name} downloaded.`, "ok"); },
    shMarkSent: () => { const d = find(sh.kind, sh.id); d.status = "sent"; d.history.push({ at: td(), ev: "Marked sent (demo: no message was delivered)" }); save(); render(); const b = $("[data-act=shMarkSent]"); if (b) b.remove(); const st = $("#sh-st"); if (st) st.textContent = DocModel(sh.kind, d).status; status(null, "Marked as sent. This only records the status.", "ok"); },
    shWa: () => { const { d } = cur(), m = DocModel(sh.kind, d), ph = Val.kePhone(m.customer.phone || "");
      panel(`<form id="sh-form" data-ch="wa" novalidate><label>Recipient WhatsApp number<input class="in" id="sh-to" type="tel" inputmode="tel" value="${esc(ph.ok ? ph.pretty : m.customer.phone || "")}" placeholder="0712 345 678 or +254 712 345 678" autocomplete="off"><small class="ferr" id="sh-err" role="alert"></small></label><label>Message<textarea class="in" id="sh-msg" rows="9">${esc(message(m))}</textarea></label><div class="acts"><button class="btn" type="submit">${ic("message-circle", 16)}Continue to WhatsApp</button></div><p class="mu small">A WhatsApp link can fill in the message but cannot attach a file by itself. The PDF is attached through your device share sheet where supported; otherwise it is downloaded and you attach it in WhatsApp before pressing send.</p></form>`); },
    shMail: () => { const { d } = cur(), m = DocModel(sh.kind, d);
      panel(`<form id="sh-form" data-ch="mail" novalidate><label>Recipient email<input class="in" id="sh-to" type="email" value="${esc(m.customer.email || "")}" placeholder="name@company.co.ke" autocomplete="off"><small class="ferr" id="sh-err" role="alert"></small></label><label>Subject<input class="in" id="sh-sub" value="${esc(subject(m))}"></label><label>Message<textarea class="in" id="sh-msg" rows="9">${esc(message(m, 1))}</textarea></label><div class="acts"><button class="btn" type="submit">${ic("mail", 16)}Continue to email</button></div><p class="mu small">This opens your default email app with the draft ready. The PDF is attached through your device share sheet where supported; otherwise it is downloaded and you attach it before sending. Nothing is sent by this demo.</p></form>`); },
  });
  document.addEventListener("submit", (e) => {
    const f = e.target; if (f.id !== "sh-form" || !sh) return; e.preventDefault(); const wa = f.dataset.ch === "wa", to = $("#sh-to").value.trim(), err = $("#sh-err"), msg = $("#sh-msg").value, { d, p } = cur(), m = p.m;
    let dest; if (wa) { const ph = Val.kePhone(to); if (!ph.ok) return (err.textContent = "Enter a valid Kenyan number, for example 0712 345 678 or +254 712 345 678."); dest = ph; } else if (!Val.validEmail(to)) return (err.textContent = "Enter a valid email address."); err.textContent = "";
    const sub = wa ? "" : $("#sh-sub").value.trim() || subject(m), url = wa ? `https://wa.me/${dest.e164}?text=${encodeURIComponent(msg)}` : `mailto:${encodeURIComponent(to).replace(/%40/g, "@")}?subject=${encodeURIComponent(sub)}&body=${encodeURIComponent(msg.replace(/\n/g, "\r\n"))}`, who = wa ? "+" + dest.e164.replace(/^(\d{3})(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3 $4") : to;
    if (canShareFile(p)) { try { navigator.share({ files: [p.file], title: wa ? m.number : sub, text: msg }).then(() => status(null, "Share sheet closed. Check your app: nothing is confirmed as sent from here.", "ok"), (x) => { if (x && x.name === "AbortError") return status(null, "Sharing was cancelled. Nothing was sent."); download(p); window.open(url, "_blank", "noopener"); status(null, `The share sheet failed, so ${p.name} was downloaded and ${wa ? "WhatsApp" : "your email app"} was opened for ${who}. Attach the downloaded PDF before sending.`, "warn"); });
        status(null, `Share sheet opened with ${p.name} attached. Choose ${wa ? "WhatsApp" : "your email app"} and then ${who}. The recipient cannot be pre-selected from the share sheet.`, "ok"); } catch (x) { status(null, "Could not open the share sheet: " + x.message, "bad"); } return; }
    download(p); const w = window.open(url, "_blank", "noopener"); if (!w && !wa) location.href = url;
    status(null, w || !wa ? `${wa ? "WhatsApp" : "Your email app"} was opened for ${who} with the message ready. ${p.name} was downloaded: attach it before you press send. Nothing has been sent yet.` : `The browser blocked the WhatsApp window. ${p.name} was downloaded; allow pop-ups and try again, or open ${url}.`, w || !wa ? "ok" : "warn");
  });
  window.DocModel = DocModel; window.DocHTML = DocHTML; window.ShareDoc = { complete: (k, id) => open(k, id, true), open, message, subject, pdfOf };
  document.querySelectorAll("[data-ic]").forEach((e) => (e.innerHTML = ic(e.dataset.ic, +e.dataset.s || 18))); render();
})();
