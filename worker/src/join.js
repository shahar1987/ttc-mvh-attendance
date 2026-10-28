// 📝 טופס הצטרפות להורים (/join) ודף הדפסה עם ברקוד (/join/print).
// האפליקציה לא נפתחת לציבור: ההורה כותב רק לכאן, השרת בודק כל שדה ושומר ב-joinRequests
// (בחוקי Firestore — רק המנהל קורא, אף אחד לא כותב מהדפדפן). שום ילד לא נכנס לקבוצה בלי אישור המנהל באפליקציה.
// ההגדרות (קוד סודי, קבוצות, טלפון לשאלות) ב-joinConfig/main — נערכות רק במסך "בקשות הצטרפות" באפליקציה.
import qrcode from "qrcode-generator";
import { notifyOwner, waConfig } from "../../agents/lib/whatsapp.mjs";

export const GRADES = ["גן", "א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ז׳", "ח׳", "ט׳", "י׳ ומעלה"];
const DAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const PER_IP_HOUR = 5;
const PER_DAY = 60;
const LOGO = "https://shahar1987.github.io/ttc-mvh-attendance/logo.png";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const clean = (s, max) => String(s ?? "").replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
const NAME = /^[א-תa-zA-Z'"׳״\-. ]{2,40}$/;

export function normalisePhone(v) {
  let d = String(v ?? "").replace(/\D/g, "");
  if (d.startsWith("972")) d = "0" + d.slice(3);
  return /^05\d{8}$/.test(d) ? d : "";
}

// בדיקת הטופס. מחזיר { ok, data } או { ok:false, error } — בלי לגעת במסד
export function validate(body, cfg) {
  if (!body || typeof body !== "object") return { ok: false, error: "bad" };
  if (body.website) return { ok: false, error: "bot" }; // מלכודת: שדה מוסתר שרק רובוט ממלא
  if (!(Number(body.ms) >= 3000)) return { ok: false, error: "bot" }; // מילוי בפחות מ-3 שניות
  const child = clean(body.child, 40),
    parent = clean(body.parent, 40),
    phone = normalisePhone(body.phone),
    grade = clean(body.grade, 12),
    groupId = clean(body.groupId, 40),
    note = clean(body.note, 200);
  if (!NAME.test(child) || !child.includes(" ")) return { ok: false, error: "child" };
  if (!NAME.test(parent)) return { ok: false, error: "parent" };
  if (!phone) return { ok: false, error: "phone" };
  if (!GRADES.includes(grade)) return { ok: false, error: "grade" };
  if (!(cfg.groups || []).includes(groupId)) return { ok: false, error: "group" };
  if (body.consent !== true) return { ok: false, error: "consent" };
  return { ok: true, data: { child, parent, phone, grade, groupId, note } };
}

async function config(store, k) {
  const cfg = await store.get("joinConfig/main");
  return cfg && cfg.enabled && typeof cfg.code === "string" && cfg.code.length >= 12 && k === cfg.code ? cfg : null;
}

async function groupsOf(store, cfg) {
  const out = [];
  for (const id of cfg.groups || []) {
    const g = await store.get(`groups/${id}`);
    if (g) out.push({ id, name: g.name || "", when: [(g.days || []).map((d) => DAYS[d]).join(" ו"), g.startTime && g.endTime ? `\u2066${g.startTime}–${g.endTime}\u2069` : ""].filter(Boolean).join(" · ") });
  }
  return out;
}

const ipKey = async (req) => {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("join|" + (req.headers.get("CF-Connecting-IP") || "?")));
  return [...new Uint8Array(h)].slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("");
};

// מגבלת קצב: 5 שליחות לשעה מאותה כתובת, 60 ביום בסך הכל. נשמר ב-joinConfig/rate (מנהל בלבד)
async function allow(store, key, now) {
  let ok = false;
  await store.update("joinConfig/rate", (cur) => {
    const hour = now - 3600e3,
      day = now - 86400e3;
    const hits = Object.fromEntries(Object.entries(cur.hits || {}).map(([k, v]) => [k, (v || []).filter((t) => t > day)]).filter(([, v]) => v.length));
    const mine = hits[key] || [];
    const total = Object.values(hits).reduce((a, v) => a + v.length, 0);
    ok = mine.filter((t) => t > hour).length < PER_IP_HOUR && total < PER_DAY;
    if (!ok) return null;
    hits[key] = [...mine, now];
    return { hits };
  });
  return ok;
}

const html = (body, title = "הצטרפות למועדון") =>
  new Response(
    `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title><style>${CSS}</style></head><body>${body}</body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-frame-options": "DENY", "referrer-policy": "no-referrer", "content-security-policy": "default-src 'none'; img-src https://shahar1987.github.io data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'none'" } },
  );

const CSS = `:root{--bg:#F2F2F7;--ink:#0B1F3A;--muted:#5B6670;--blue:#3B82D6;--blue2:#2F6DB5;--green:#5E9E8C;--line:#E4E4EA;--red:#A0423A}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:17px/1.5 -apple-system,BlinkMacSystemFont,"Assistant","Segoe UI",Arial,sans-serif;-webkit-font-smoothing:antialiased}
.wrap{max-width:480px;margin:0 auto;padding:20px 16px 40px}
.hero{position:relative;overflow:hidden;border-radius:24px;padding:22px 20px;background:linear-gradient(135deg,#EAF1FA,#E7F1ED);margin-bottom:16px}
.hero:before{content:"";position:absolute;left:-40px;top:-60px;width:180px;height:180px;border-radius:50%;background:radial-gradient(circle,rgba(124,196,255,.55),rgba(124,196,255,0) 70%)}
.hero img{width:64px;height:64px;border-radius:18px;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.08);position:relative}
.hero h1{font-size:28px;font-weight:800;letter-spacing:-.02em;margin:14px 0 4px;position:relative}.hero p{margin:0;color:var(--muted);position:relative}
.card{background:#fff;border-radius:20px;padding:6px 16px;box-shadow:0 1px 2px rgba(0,0,0,.04),0 2px 8px rgba(0,0,0,.04);margin-bottom:14px}
label.f{display:block;padding:12px 0;border-bottom:1px solid var(--line)}label.f:last-child{border-bottom:0}
label.f span{display:block;font-size:14px;font-weight:600;color:var(--muted);margin-bottom:4px}
input,select,textarea{width:100%;border:0;background:transparent;font:inherit;color:var(--ink);padding:4px 0;outline:none}textarea{resize:none;min-height:56px}
.groups{display:grid;gap:10px;margin-bottom:14px}.g{display:flex;gap:12px;align-items:center;background:#fff;border-radius:18px;padding:14px 16px;box-shadow:0 1px 2px rgba(0,0,0,.04),0 2px 8px rgba(0,0,0,.04);cursor:pointer;border:2px solid transparent}
.g input{width:22px;height:22px;accent-color:var(--blue);flex:none}.g b{display:block}.g small{color:var(--muted)}.g:has(input:checked){border-color:var(--blue)}
.ok{display:flex;gap:10px;align-items:flex-start;font-size:15px;color:var(--muted);margin:4px 2px 18px}.ok input{width:22px;height:22px;flex:none;accent-color:var(--green)}
button{width:100%;border:0;border-radius:999px;background:var(--blue);color:#fff;font:inherit;font-weight:700;font-size:18px;padding:16px;box-shadow:0 4px 12px -6px rgba(27,42,65,.35)}button:disabled{opacity:.6}
.err{color:var(--red);font-weight:600;min-height:24px;margin:10px 2px}.hp{position:absolute;left:-9999px;height:0;overflow:hidden}
.done{text-align:center;padding:30px 10px}.done .big{font-size:56px}.done h2{font-size:26px;margin:8px 0}
h3{font-size:20px;font-weight:800;margin:20px 4px 10px}`;

function formPage(cfg, groups) {
  const one = groups.length === 1;
  return html(`<main class="wrap">
<header class="hero"><img src="${LOGO}" alt=""><h1>מצטרפים לשולחן 🏓</h1><p>${esc(cfg.title || "מועדון טניס שולחן מבואות החרמון")}</p></header>
<form id="f" novalidate>
<h3>${one ? "הקבוצה" : "באיזו קבוצה?"}</h3>
<div class="groups">${groups.map((g, i) => `<label class="g"><input type="radio" name="groupId" value="${esc(g.id)}"${one || i === 0 ? " checked" : ""}><div><b>${esc(g.name)}</b><small>${esc(g.when)}</small></div></label>`).join("")}</div>
<h3>הילד/ה</h3>
<div class="card"><label class="f"><span>שם מלא</span><input name="child" autocomplete="off" maxlength="40" required></label>
<label class="f"><span>כיתה</span><select name="grade" required><option value="">בחירה</option>${GRADES.map((g) => `<option>${esc(g)}</option>`).join("")}</select></label></div>
<h3>ההורה</h3>
<div class="card"><label class="f"><span>שם</span><input name="parent" autocomplete="name" maxlength="40" required></label>
<label class="f"><span>טלפון נייד</span><input name="phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="16" dir="ltr" style="text-align:right" required></label>
<label class="f"><span>משהו שחשוב שנדע? (לא חובה)</span><textarea name="note" maxlength="200"></textarea></label></div>
<div class="hp" aria-hidden="true"><input name="website" tabindex="-1" autocomplete="off"></div>
<label class="ok"><input type="checkbox" name="consent"><span>מאשר/ת שהמועדון ישמור את הפרטים לצורך הרישום ויצור איתי קשר</span></label>
<button id="b">שליחה</button><div class="err" id="e" role="alert"></div>
</form></main>
<script>
const t0=Date.now(),f=document.getElementById("f"),b=document.getElementById("b"),e=document.getElementById("e");
const M={child:"נא לכתוב שם פרטי ושם משפחה",parent:"נא לכתוב את שם ההורה",phone:"נא לכתוב מספר נייד תקין",grade:"נא לבחור כיתה",group:"נא לבחור קבוצה",consent:"נא לאשר את שמירת הפרטים",rate:"נשלחו הרבה בקשות. נסו שוב בעוד שעה",closed:"הטופס סגור כרגע"};
f.addEventListener("submit",async(ev)=>{ev.preventDefault();e.textContent="";b.disabled=true;
const d=Object.fromEntries(new FormData(f));d.consent=f.consent.checked;d.ms=Date.now()-t0;d.k=new URLSearchParams(location.search).get("k")||"";
try{const r=await fetch("/join",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(d)});const j=await r.json().catch(()=>({}));
if(r.ok&&j.ok){document.querySelector("main").innerHTML='<div class="done"><div class="big">🎉</div><h2>תודה! קיבלנו</h2><p>ניצור איתכם קשר בקרוב.</p></div>';return}
e.textContent=M[j.error]||"משהו השתבש. נסו שוב";}catch(_){e.textContent="אין חיבור. נסו שוב"}b.disabled=false;});
</script>`);
}

function printPage(cfg, url) {
  const qr = qrcode(0, "M");
  qr.addData(url);
  qr.make();
  const svg = qr.createSvgTag({ cellSize: 5, margin: 0, scalable: true });
  const contact = cfg.contactPhone ? `<p class="c">שאלות? ${esc(cfg.contactName || "")} <b dir="ltr">${esc(cfg.contactPhone)}</b></p>` : "";
  const card = `<section class="p"><img class="l" src="${LOGO}" alt=""><h2>מצטרפים לשולחן 🏓</h2><p class="s">${esc(cfg.title || "מועדון טניס שולחן מבואות החרמון")}</p><div class="q">${svg}</div><p class="i">סורקים, ממלאים דקה,<br>ואנחנו חוזרים אליכם</p>${contact}</section>`;
  return new Response(
    `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>הדפסה — טופס הצטרפות</title><style>
@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;font-family:-apple-system,"Assistant","Segoe UI",Arial,sans-serif;color:#0B1F3A;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.sheet{width:210mm;height:297mm;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr}
.p{border:1px dashed #C9CED6;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:10mm;background:linear-gradient(160deg,#EAF1FA,#fff 55%,#E7F1ED)}
.l{width:20mm;height:20mm;border-radius:6mm;background:#fff}h2{font-size:22pt;margin:4mm 0 1mm;font-weight:800}.s{margin:0;color:#5B6670;font-size:10pt}
.q{width:52mm;height:52mm;margin:6mm 0 4mm;background:#fff;padding:3mm;border-radius:4mm}.q svg{width:100%;height:100%}.i{margin:0;font-size:12pt;font-weight:600}.c{margin:3mm 0 0;font-size:11pt;color:#2F6DB5}
@media screen{body{background:#F2F2F7}.sheet{margin:10px auto;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.1)}}
</style></head><body><div class="sheet">${card.repeat(4)}</div><script>onload=()=>setTimeout(()=>print(),400)</script></body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-frame-options": "DENY", "referrer-policy": "no-referrer" } },
  );
}

const closed = () => html(`<main class="wrap"><header class="hero"><img src="${LOGO}" alt=""><h1>הטופס סגור כרגע</h1><p>לפרטים אפשר לפנות למאמן הקבוצה.</p></header></main>`, "הטופס סגור");
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export async function joinRoute(req, env, store, { now = Date.now(), wa = waConfig(env) } = {}) {
  const url = new URL(req.url);
  if (req.method === "GET") {
    const cfg = await config(store, url.searchParams.get("k") || "");
    if (!cfg) return closed();
    if (url.pathname === "/join/print") return printPage(cfg, `${url.origin}/join?k=${encodeURIComponent(cfg.code)}`);
    return formPage(cfg, await groupsOf(store, cfg));
  }
  if (req.method !== "POST" || url.pathname !== "/join") return json({ ok: false, error: "bad" }, 405);
  if (!(req.headers.get("content-type") || "").startsWith("application/json")) return json({ ok: false, error: "bad" }, 415);
  const raw = await req.text();
  if (raw.length > 4000) return json({ ok: false, error: "bad" }, 413);
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: "bad" }, 400);
  }
  const cfg = await config(store, String(body?.k || ""));
  if (!cfg) return json({ ok: false, error: "closed" }, 403);
  const v = validate(body, cfg);
  if (v.error === "bot") return json({ ok: true }); // לא מגלים לרובוט שנתפס
  if (!v.ok) return json(v, 400);
  if (!(await allow(store, await ipKey(req), now))) return json({ ok: false, error: "rate" }, 429);
  const id = `${now}_${crypto.randomUUID().slice(0, 8)}`;
  const at = new Date(now).toISOString();
  await store.merge(`joinRequests/${id}`, { ...v.data, createdAt: at, source: "form" });
  const g = (await store.get(`groups/${v.data.groupId}`)) || {};
  const text = `📝 בקשת הצטרפות חדשה: ${v.data.child} (${v.data.grade}) — ${g.name || "קבוצה"}.\nלאישור: באפליקציה ← בקשות הצטרפות`;
  try {
    const bot = (await store.get("agentReports/bot")) || {};
    await notifyOwner(wa, { lastOwnerMsgAt: bot.lastOwnerMsgAt, text, template: "agent_alert", templateParam: "בקשת הצטרפות חדשה מחכה לאישור באפליקציה" });
  } catch (_) {
    /* ההודעה לבעלים לא חוסמת את השמירה */
  }
  return json({ ok: true });
}
