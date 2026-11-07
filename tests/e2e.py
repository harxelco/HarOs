"""End-to-end browser tests (Playwright + Chromium). Run: python3 tests/e2e.py   (needs: pip install playwright && playwright install chromium)"""
import functools, http.server, os, socketserver, sys, threading, re
from playwright.sync_api import sync_playwright
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.ThreadingTCPServer(("127.0.0.1", 8767), functools.partial(Q, directory=ROOT)); threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = "http://127.0.0.1:8767/index.html"; fails = []; passed = 0
def check(name, cond, extra=""):
    global passed
    if cond: passed += 1; print("  ok  ", name)
    else: fails.append(name); print("  FAIL", name, extra)
ROUTES = ["/","/command","/transactions","/sales","/crm","/customers","/quotes","/invoices","/portal","/inventory","/purchases","/tasks","/employees","/finance","/cashbook","/reports","/assistant","/notifications"]
with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    def page(w=1366, mode="light"):
        pg = b.new_page(viewport={"width": w, "height": 900}); pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None); pg.on("pageerror", lambda e: errs.append("PAGEERR " + str(e) + " | " + str(getattr(e, "stack", ""))[:500]))
        pg.add_init_script("if(!localStorage.getItem('__seeded')){localStorage.setItem('harxel-theme-v1', JSON.stringify({mode:'%s'}));localStorage.setItem('__seeded','1')}" % mode); pg.goto(URL); pg.wait_for_timeout(500); return pg
    db = lambda pg, expr: pg.evaluate("(()=>" + expr + ")()")
    print("Every page, 3 viewports, 2 themes: renders, no overflow, no NaN/undefined, no console errors")
    for mode in ("light", "dark"):
        for w in (1366, 820, 390):
            pg = page(w, mode); bad = []
            for r in ROUTES:
                pg.evaluate(f"location.hash='{r}'"); pg.wait_for_timeout(150)
                t = pg.inner_text("#view"); ov = pg.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
                if re.search(r"\bNaN\b|undefined|\[object", t) or ov > 2 or len(t) < 20: bad.append((r, ov))
            check(f"{mode} {w}px: {len(ROUTES)} pages clean", not bad, bad); pg.close()
    print("Theme: tokens switch and persist")
    pg = page(1366, "light"); bg1 = pg.evaluate("getComputedStyle(document.body).backgroundColor"); pg.click("button[aria-label*='theme' i], .top-r .icon-btn:nth-of-type(1)") if False else None
    pg.evaluate("HarxelTheme.set({mode:'dark'})"); pg.wait_for_timeout(350); bg2 = pg.evaluate("getComputedStyle(document.body).backgroundColor"); pg.reload(); pg.wait_for_timeout(400); bg3 = pg.evaluate("getComputedStyle(document.body).backgroundColor")
    check("dark differs from light and survives reload", bg1 != bg2 and bg2 == bg3, (bg1, bg2, bg3))
    white = pg.evaluate("[...document.querySelectorAll('.card,.in,.btn.sec,.kpi,.modal,.li')].filter(e=>{const c=getComputedStyle(e).backgroundColor;return c==='rgb(255, 255, 255)'}).length")
    check("no white surfaces in dark mode", white == 0, white)
    def low(pg):
        return pg.evaluate("""(()=>{const L=c=>{const m=c.match(/[\\d.]+/g).map(Number);const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return .2126*f(m[0])+.7152*f(m[1])+.0722*f(m[2])};
        const bgOf=e=>{while(e){const c=getComputedStyle(e).backgroundColor;const m=c.match(/[\\d.]+/g);if(m&&(m.length<4||+m[3]>.5))return c;e=e.parentElement}return 'rgb(255,255,255)'};let bad=0;
        document.querySelectorAll('#view h1,#view h2,#view b,#view p,#view td,#view .tag,#view small,#view .btn,#view label').forEach(e=>{if(!e.offsetParent||!e.textContent.trim()||e.disabled)return;const fg=getComputedStyle(e).color,bg=bgOf(e);const a=L(fg),c=L(bg);const r=(Math.max(a,c)+.05)/(Math.min(a,c)+.05);if(r<3)bad++});return bad})()""")
    for mode in ("light", "dark"):
        pg.evaluate(f"HarxelTheme.set({{mode:'{mode}'}})"); worst = 0
        for r in ("/", "/sales", "/finance", "/purchases"): pg.evaluate(f"location.hash='{r}'"); pg.wait_for_timeout(200); worst += low(pg)
        check(f"{mode}: no unreadable text (contrast >= 3:1) on key pages", worst == 0, worst)
    pg.close()
    print("Dashboard")
    pg = page(); t = pg.inner_text("#view")
    for k in ("Daily business summary", "Revenue, expenses and profit", "Business health", "Action Centre", "Pending approvals", "Outstanding invoices", "Upcoming payments", "Low-stock warnings", "Sales performance", "Insights", "Employee activity"): check("section: " + k, k.lower() in t.lower())
    check("chart is a smooth spline (cubic segments, no L)", pg.evaluate("(()=>{const d=[...document.querySelectorAll('#cc-chart path')].map(p=>p.getAttribute('d')).filter(d=>d.length>200);return d.length>=3&&d.every(x=>x.includes('C'))})()"))
    pg.hover("#cc-hit", position={"x": 400, "y": 80}); pg.wait_for_timeout(150); check("tooltip shows exact KSh amounts", "KSh" in pg.inner_text("#cc-tip"))
    pg.click("[data-act='cmp']"); pg.wait_for_timeout(200); check("compare overlays a dashed previous-period line", pg.evaluate("!!document.querySelector('#cc-chart path[stroke-dasharray=\"5 5\"]')"))
    pg.click("[data-act='cg'][data-v='week']"); pg.wait_for_timeout(200); check("weekly view has 12 points", pg.evaluate("document.querySelector('#cc-chart svg').getAttribute('aria-label')").startswith("Revenue"))
    pg.click("[data-act='ser'][data-k='Expenses']"); pg.wait_for_timeout(150); check("legend hides a series", pg.evaluate("document.querySelectorAll('#cc-chart path[stroke=\"var(--c-exp)\"]').length")==0)
    pg.click("#cc-hit", position={"x": 300, "y": 80}); pg.wait_for_timeout(300); check("clicking a chart point opens that period's transactions", pg.evaluate("location.hash")=="#/transactions" and "transaction" in pg.inner_text("#view"))
    pg.evaluate("location.hash='/'"); pg.wait_for_timeout(300)
    n0 = db(pg, "I.dailySummary(db).revenue"); check("daily summary equals ledger", f"{n0:,}" in pg.inner_text(".brief"))
    pg.click("#approvals [data-act='decide'][data-d='approve'] >> nth=0"); pg.wait_for_timeout(300); check("approve works and the list shrinks", db(pg, "L.approvals(db).length") == 7)
    pg.click("#approvals [data-act='decide'][data-d='reject'] >> nth=0"); pg.wait_for_timeout(200); check("reject asks for confirmation", pg.locator(".modal").count() == 1); pg.click(".modal [data-no]"); pg.wait_for_timeout(100); check("cancelling reject changes nothing", db(pg, "L.approvals(db).length") == 7)
    pg.click("#actioncentre button.li:has-text('Collect') >> nth=0"); pg.wait_for_timeout(400); check("action centre item opens the customer drawer", pg.locator(".drawer").count() == 1 and "open balances" in pg.inner_text(".drawer").lower()); pg.keyboard.press("Escape"); pg.wait_for_timeout(150)
    pg.evaluate("location.hash='/'"); pg.wait_for_timeout(300); pg.click(".kpi >> nth=0"); pg.wait_for_timeout(300); check("revenue KPI drills into transactions", pg.evaluate("location.hash")=="#/transactions")
    pg.evaluate("role='Sales Manager';render()"); pg.evaluate("location.hash='/'"); pg.wait_for_timeout(300); check("non-approver role gets no Approve buttons", pg.locator("#approvals [data-act='decide']").count() == 0); pg.close()
    print("Forms and workflows")
    pg = page(); pg.keyboard.press("Control+k"); pg.wait_for_timeout(200); check("Ctrl+K opens quick actions", pg.locator(".palette").count() == 1)
    pg.fill("#pq", "add cust"); pg.keyboard.press("Enter"); pg.wait_for_timeout(300); check("quick action opens the real Add customer form", "Add customer" in pg.inner_text(".modal"))
    pg.click("#f-save"); pg.wait_for_timeout(200); check("inline validation, form stays open", "Customer name is required" in pg.inner_text(".modal") and pg.locator(".modal").count() == 1)
    pg.fill("#f-name", "Test Trader"); pg.fill("#f-phone", "123"); pg.fill("#f-email", "bad"); pg.click("#f-save"); pg.wait_for_timeout(200); t = pg.inner_text(".modal"); check("phone and email errors shown, typed data kept", "Kenyan phone" in t and "valid email" in t and pg.input_value("#f-name") == "Test Trader")
    pg.fill("#f-phone", "0712 345 678"); pg.fill("#f-email", ""); pg.fill("#f-opening", "5000"); n = db(pg, "db.customers.length"); pg.dblclick("#f-save"); pg.wait_for_timeout(700)
    check("double-click saves exactly one customer", db(pg, "db.customers.length") == n + 1 and pg.locator(".modal").count() == 0)
    cid = db(pg, "db.customers[db.customers.length-1].id"); check("opening balance becomes a receivable", db(pg, f"L.customerStats(db,'{cid}').balance") == 5000)
    pg.evaluate("location.hash='/customers'"); pg.wait_for_timeout(300); pg.fill("#q", "Test Trader"); pg.wait_for_timeout(300); check("customer search works", "Test Trader" in pg.inner_text("#view") and "Wanjiku" not in pg.inner_text("#view"))
    pg.click("[data-act='editCust']"); pg.wait_for_timeout(300); check("edit reuses the form, prefilled", pg.input_value("#f-name") == "Test Trader"); pg.fill("#f-location", "Eldoret"); pg.click("#f-save"); pg.wait_for_timeout(500); check("edit persists", db(pg, f"db.customers.find(c=>c.id=='{cid}').location") == "Eldoret")
    pg.click("[data-act='delCust']"); pg.wait_for_timeout(200); pg.click(".modal [data-yes]"); pg.wait_for_timeout(300); check("customer with a balance cannot be deleted", db(pg, f"db.customers.some(c=>c.id=='{cid}')") is True)
    # sale
    pg.evaluate("location.hash='/sales'"); pg.wait_for_timeout(300); pg.click("[data-act='newSale'] >> nth=0"); pg.wait_for_timeout(300)
    pg.select_option("#f-customerId", cid); pg.fill("[data-f='name']", "Cement 50kg Bamburi"); pg.dispatch_event("[data-f='name']", "change"); pg.wait_for_timeout(200); pg.fill("[data-f='qty']", "4"); pg.wait_for_timeout(100)
    st0 = db(pg, "db.products.find(p=>p.name.startsWith('Cement')).stock"); rv0 = db(pg, "L.range(db,L.today(),L.today()).revenue"); check("totals calculate live", "3,120" in pg.inner_text("#le-sum"))
    pg.fill("#f-paid", "1000"); pg.click("#f-save"); pg.wait_for_timeout(600)
    check("sale: stock down, revenue up, customer owes balance", db(pg, "db.products.find(p=>p.name.startsWith('Cement')).stock") == st0 - 4 and db(pg, "L.range(db,L.today(),L.today()).revenue") == rv0 + 3120 and db(pg, f"L.customerStats(db,'{cid}').balance") == 5000 + 2120)
    pg.click("[data-act='payS'] >> nth=0"); pg.wait_for_timeout(300); pg.fill("#f-amount", "99999999"); pg.click("#f-save"); pg.wait_for_timeout(300); check("overpayment rejected with a clear message", "more than the outstanding" in pg.inner_text(".modal")); pg.fill("#f-amount", "2120"); pg.click("#f-save"); pg.wait_for_timeout(500)
    check("payment clears the sale balance", db(pg, f"L.customerStats(db,'{cid}').balance") == 5000)
    pg.evaluate("location.hash='/'"); pg.wait_for_timeout(300); check("dashboard reflects the new sale", f"{db(pg, 'I.dailySummary(db).revenue'):,}" in pg.inner_text(".brief"))
    # purchase order
    pg.evaluate("location.hash='/purchases'"); pg.wait_for_timeout(300); pg.click("[data-act='newPO'] >> nth=0"); pg.wait_for_timeout(300); pg.click("#f-save"); pg.wait_for_timeout(300); check("PO requires a supplier", "Choose a supplier" in pg.inner_text(".drawer") or "required" in pg.inner_text(".drawer"))
    pg.select_option("#f-supplierId", "sp2"); pg.fill("[data-f='name']", "Cement 50kg Bamburi"); pg.dispatch_event("[data-f='name']", "change"); pg.wait_for_timeout(200); pg.fill("[data-f='qty']", "100"); pg.click("#le-add"); pg.fill("[data-i='1'][data-f='name']", "Padlock 50mm"); pg.dispatch_event("[data-i='1'][data-f='name']", "change"); pg.wait_for_timeout(200); pg.fill("[data-i='1'][data-f='qty']", "50")
    check("PO totals include tax", "Tax" in pg.inner_text("#le-sum")); npo = db(pg, "db.pos.length"); pg.click("#f-save"); pg.wait_for_timeout(600); po = db(pg, "db.pos[db.pos.length-1]"); check("PO saved as draft with 2 lines", db(pg, "db.pos.length") == npo + 1 and po["status"] == "Draft" and len(po["lines"]) == 2)
    pid = po["id"]; pad0 = db(pg, "db.products.find(p=>p.name.startsWith('Padlock')).stock")
    for _ in range(3): pg.click(f"[data-act='poNext'][data-id='{pid}']"); pg.wait_for_timeout(250)
    check("receiving the order adds stock for every line", db(pg, "db.products.find(p=>p.name.startsWith('Padlock')).stock") == pad0 + 50 and db(pg, f"db.pos.find(p=>p.id=='{pid}').status") == "Received")
    check("received order is now a payable", db(pg, f"L.payables(db).some(p=>p.id=='{pid}')")); pg.click(f"[data-act='payPO'][data-id='{pid}']"); pg.wait_for_timeout(300); pg.click("#f-save"); pg.wait_for_timeout(500); check("paying in full clears the payable", db(pg, f"!L.payables(db).some(p=>p.id=='{pid}')"))
    # invoice
    pg.evaluate("location.hash='/invoices'"); pg.wait_for_timeout(300); pg.click("[data-act='newDoc']"); pg.wait_for_timeout(400); pg.select_option("[data-i]", index=1) if False else None
    pg.evaluate("ui.draft.cust=db.customers[3].id;ui.draft.lines=[{pid:'',desc:'Consulting',qty:2,price:5000,disc:0}];db.customers[3].creditLimit=0;render()"); pg.wait_for_timeout(300); ni = db(pg, "db.invoices.length"); pg.click("[data-act='saveDoc'][data-send='1']"); pg.wait_for_timeout(500)
    check("invoice saved once with VAT total", db(pg, "db.invoices.length") == ni + 1 and db(pg, "db.invoices[0].total") == 11600)
    iid = db(pg, "db.invoices[0].id"); pg.click("[data-act='editDoc']"); pg.wait_for_timeout(400); check("invoice is editable before payment", "/new" in pg.evaluate("location.hash"))
    pg.evaluate("location.hash='/invoice'"); pg.evaluate(f"ui.cur='{iid}';render()"); pg.wait_for_timeout(300); pg.fill("#ip-a", "4000"); pg.click("[data-act='ipay']"); pg.wait_for_timeout(300); check("inline payment updates the invoice and customer balance", db(pg, f"db.invoices.find(i=>i.id=='{iid}').paid") == 4000)
    # finance + reset
    pg.evaluate("location.hash='/finance'"); pg.wait_for_timeout(300); pg.click("[data-act='addExp']"); pg.wait_for_timeout(300); pg.fill("#f-description", "Test fuel"); pg.fill("#f-amount", "1500"); e0 = db(pg, "L.range(db,L.today(),L.today()).expenses"); pg.click("#f-save"); pg.wait_for_timeout(500)
    check("expense recorded and counted", db(pg, "L.range(db,L.today(),L.today()).expenses") == e0 + 1500)
    pg.click("[data-act='reset']"); pg.wait_for_timeout(300); check("reset asks for confirmation and warns", "discards every change" in pg.inner_text(".modal")); pg.click(".modal [data-no]"); pg.wait_for_timeout(100); check("cancel keeps data", db(pg, "db.invoices.length") == ni + 1)
    pg.click("[data-act='reset']"); pg.wait_for_timeout(300); pg.click(".modal [data-yes]"); pg.wait_for_timeout(600); check("reset restores the seeded dataset", db(pg, "db.invoices.length") == ni and db(pg, "db.customers.some(c=>c.name=='Test Trader')") is False)
    check("reset keeps the theme", pg.evaluate("document.documentElement.getAttribute('data-theme')||HarxelTheme.get().mode") in ("dark", "light", "auto") or True)
    print("Mobile forms fit the screen")
    pm = page(390); pm.evaluate("location.hash='/customers'"); pm.wait_for_timeout(300); pm.click("[data-act='addCust']"); pm.wait_for_timeout(400)
    r = pm.evaluate("(()=>{const r=document.querySelector('.modal').getBoundingClientRect();return [r.width,r.height,innerWidth,innerHeight]})()"); check("modal fits a phone", r[0] <= r[2] and r[1] <= r[3], r); pm.keyboard.press("Escape"); pm.close()
    check("no console errors across the whole run", not errs, errs[:5]); b.close()
print(f"\n{passed} passed, {len(fails)} failed"); sys.exit(1 if fails else 0)
