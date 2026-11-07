// 📄 דוחות הגג: חודש או שנה מול אשתקד, ככסף וכקוט"ש. דף להדפסה (PDF מהדפדפן) וקובץ Excel אמיתי שנבנה כאן, בלי ספריות.
import { addDays } from "./solar.js";
import { why } from "./solar-dashboard.js";
import { esc } from "./web.js";

const MONTH = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
// מסלול ירוק עם מונה דו-כיווני: מה שהגג מזרים לרשת מזוכה בתעריף המובטח, ומה שהבית צורך ישירות מהגג חוסך את מחיר החשמל.
// ברירות המחדל: תעריף 48 אג׳ (2026, עד 15 קילוואט), תעריף ביתי 53.83 אג׳ ועוד מע״מ, ו-25% צריכה עצמית (ההנחה בתחזית של המתקין).
// הבעלים מעדכן דרך שולה (solar_rate). shortcut: הצריכה העצמית היא אחוז קבוע, עד שיהיה מונה צריכה או קריאה מחשבון החשמל
export const DEFAULT_RATE = 0.48;
export const SELF_RATE = 0.6352;
export const SELF_SHARE = 0.25;
// הצריכה העצמית מחשבונות החשמל: מה שהגג ייצר (SolarEdge) פחות מה שהמונה הדו-כיווני רשם שהוזרם לרשת, באותן תקופות קריאה.
// סופרים רק חשבון שיש עליו נתוני ייצור ל-95% מהימים מאז ההפעלה, כדי שחשבון חלקי לא יעוות
export function billShare(s) {
  const days = s.days || {};
  let made = 0;
  let sent = 0;
  let n = 0;
  for (const b of s.bills || []) {
    if (!(b.kwh >= 0) || !b.from || !b.to || b.to < b.from) continue;
    const keys = [];
    for (let k = b.from > (s.since || "") ? b.from : s.since; k <= b.to; k = addDays(k, 1)) keys.push(k);
    const have = keys.filter((k) => days[k]?.kwh != null);
    if (!keys.length || have.length < keys.length * 0.95) continue;
    made += have.reduce((t, k) => t + days[k].kwh, 0);
    sent += b.kwh;
    n++;
  }
  return made > 0 && n ? { share: Math.min(0.9, Math.max(0, 1 - sent / made)), bills: n, made, sent } : null;
}
export const money = (s) => {
  const exportRate = s.rate > 0 ? s.rate : DEFAULT_RATE;
  const selfRate = s.selfRate > 0 ? s.selfRate : SELF_RATE;
  const fromBills = billShare(s);
  const selfShare = fromBills ? fromBills.share : s.selfShare >= 0 && s.selfShare <= 1 ? s.selfShare : SELF_SHARE;
  return { exportRate, selfRate, selfShare, fromBills, rate: (1 - selfShare) * exportRate + selfShare * selfRate, fixed: s.fixed > 0 ? s.fixed : 0 };
};
const pct = (a, b) => (a != null && b > 0 ? Math.round((a / b - 1) * 100) : null);
const total = (xs, f) => (xs.some((x) => x[f] != null) ? xs.reduce((t, x) => t + (x[f] || 0), 0) : null);
const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const pad = (n) => String(n).padStart(2, "0");

export const validPeriod = (p, today) => /^\d{4}(-(0[1-9]|1[0-2]))?$/.test(p || "") && p <= today.slice(0, p.length) && +p.slice(0, 4) >= 2020;
export const periodName = (p) => (p.length === 4 ? `שנת ${p}` : `${MONTH[+p.slice(5) - 1]} ${p.slice(0, 4)}`);

// שורה לכל יום בחודש, או לכל חודש בשנה. אשתקד נלקח על אותם ימים בדיוק, כך שחודש שעוד לא נגמר מושווה הוגן
export function reportData(s, period, today) {
  const days = s.days || {};
  const last = addDays(today, -1);
  const day = (k) => days[k] || {};
  const back = (k) => `${+k.slice(0, 4) - 1}${k.slice(4)}`;
  const pick = (keys) => {
    const now = keys.map(day);
    const then = keys.map((k) => day(back(k)));
    // אשתקד רק כשיש עליו נתונים כמעט לכל הימים, אחרת ההשוואה מטעה
    const covered = then.filter((d) => d.kwh != null).length >= Math.max(1, now.filter((d) => d.kwh != null).length * 0.9);
    return { kwh: total(now, "kwh"), prev: covered ? total(then, "kwh") : null, rad: total(now, "rad"), radPrev: total(then, "rad"), tmax: now.some((d) => d.tmax != null) ? Math.max(...now.filter((d) => d.tmax != null).map((d) => d.tmax)) : null, rain: total(now, "rain") };
  };
  const y = +period.slice(0, 4);
  const monthKeys = (m) => Array.from({ length: daysIn(y, m) }, (_, i) => `${y}-${pad(m)}-${pad(i + 1)}`).filter((k) => k <= last);
  const rows = period.length === 4
    ? Array.from({ length: 12 }, (_, i) => i + 1).filter((m) => `${y}-${pad(m)}-01` <= last).map((m) => ({ label: MONTH[m - 1], ...pick(monthKeys(m)) }))
    : monthKeys(+period.slice(5)).map((k) => ({ label: `${+k.slice(8)}.${+k.slice(5, 7)}`, date: k, ...pick([k]) }));
  const m$ = money(s);
  const { rate, fixed } = m$;
  const months = period.length === 4 ? rows.length : 1;
  const sumOf = (f) => total(rows, f);
  const kwh = sumOf("kwh");
  const prev = sumOf("prev");
  const rad = sumOf("rad");
  const radPrev = sumOf("radPrev");
  const paired = rows.filter((r) => r.kwh != null && r.prev != null);
  const change = paired.length ? pct(total(paired, "kwh"), total(paired, "prev")) : null; // רק שורות שיש להן גם אשתקד
  const scored = rows.filter((r) => r.kwh != null);
  const best = scored.reduce((a, r) => (!a || r.kwh > a.kwh ? r : a), null);
  const worst = scored.reduce((a, r) => (!a || r.kwh < a.kwh ? r : a), null);
  const open = period === today.slice(0, period.length);
  return {
    period, title: `דוח ייצור, ${periodName(period)}`, yearly: period.length === 4, open, rows, ...m$, months,
    kwh, prev, rad, radPrev, change, sunChange: pct(rad, radPrev), why: why(change, pct(rad, radPrev)),
    gross: kwh == null ? null : kwh * rate, net: kwh == null ? null : kwh * rate - fixed * months,
    netPrev: prev == null ? null : prev * rate - fixed * months, best, worst, withData: scored.length,
  };
}

// כמה כסף: היום, החודש עד אתמול, מתחילת השנה מול אותם ימים אשתקד. אותו חישוב כמו הדוחות
export function earnings(s, today) {
  const { rate, fixed, exportRate, selfShare, fromBills } = money(s);
  const m = reportData(s, today.slice(0, 7), today);
  const y = reportData(s, today.slice(0, 4), today);
  const t = s.today?.day === today && s.today.kwh != null ? s.today.kwh * rate : null;
  // החזר ההשקעה: כל הייצור מאז ההפעלה, וקצב השנה האחרונה לצפי
  let back = null;
  if (s.invest > 0 && s.since) {
    const all = Object.entries(s.days || {}).filter(([k, d]) => k >= s.since && k < today && d.kwh != null);
    const earned = all.reduce((x, [, d]) => x + d.kwh * rate, 0) - fixed * (all.length / 30.4);
    const yearAgo = addDays(today, -365);
    const lastYear = all.filter(([k]) => k >= yearAgo);
    const perDay = lastYear.length >= 60 ? (lastYear.reduce((x, [, d]) => x + d.kwh * rate, 0) - fixed * (lastYear.length / 30.4)) / lastYear.length : null;
    const left = s.invest - earned;
    back = { earned, invest: s.invest, share: earned / s.invest, done: perDay > 0 && left > 0 ? addDays(today, Math.ceil(left / perDay)) : null };
  }
  return { rate, fixed, exportRate, selfShare, fromBills, today: t, month: m.net, year: y.net, yearChange: y.change, back, expected: s.expectedKwh > 0 ? s.expectedKwh : null, yearKwh: y.kwh };
}

export const reportLinks = (today) => {
  const y = +today.slice(0, 4);
  const m = +today.slice(5, 7);
  const months = Array.from({ length: 4 }, (_, i) => { const d = new Date(Date.UTC(y, m - 1 - i, 1)); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`; });
  return [...months, String(y), String(y - 1)];
};

// ---------- דף הדוח (להדפסה ול-PDF) ----------
const n = (v, d = 0) => (v == null ? "—" : Number(v).toLocaleString("he-IL", { minimumFractionDigits: d, maximumFractionDigits: d }));
const ils = (v) => (v == null ? "—" : `₪${n(v, v >= 1000 ? 0 : 2)}`);
const delta = (p) => (p == null ? "" : `<span class="${p >= 0 ? "up" : "down"}">${p >= 0 ? "▲" : "▼"} ${Math.abs(p)}%</span>`);

export function reportHtml(r, nonce) {
  const head = r.yearly ? "חודש" : "יום";
  const body = r.rows.map((x) => `<tr><td>${esc(x.label)}</td><td>${n(x.kwh, 1)}</td><td>${n(x.prev, 1)}</td><td>${delta(pct(x.kwh, x.prev))}</td><td>${ils(x.kwh == null ? null : x.kwh * r.rate)}</td><td>${n(x.rad, 0)}</td><td>${x.tmax == null ? "—" : `${Math.round(x.tmax)}°`}</td><td>${x.rain ? n(x.rain, 0) : ""}</td></tr>`).join("");
  const csv = `/solar/report.xlsx?p=${r.period}`;
  return `<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(r.title)}</title>
<style>
@page{size:A4;margin:14mm}
*{box-sizing:border-box}body{margin:0;background:#eef1f6;color:#13213a;font:15px/1.5 -apple-system,system-ui,"Segoe UI",Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{max-width:820px;margin:16px auto;background:#fff;border-radius:18px;padding:28px 28px 22px;box-shadow:0 8px 30px rgba(10,30,70,.08)}
.bar{display:flex;gap:10px;justify-content:center;margin:18px auto 0;max-width:820px;padding:0 16px}
.bar a,.bar button{font:inherit;font-weight:600;border:0;border-radius:12px;padding:11px 18px;background:#0f5fbf;color:#fff;text-decoration:none;cursor:pointer}.bar a.ghost{background:#fff;color:#0f5fbf;box-shadow:inset 0 0 0 1.5px #0f5fbf}
header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #0f5fbf;padding-bottom:12px;margin-bottom:18px}
h1{margin:0;font-size:26px;letter-spacing:-.01em}header p{margin:2px 0 0;color:#5b6b85;font-size:13px}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
.k{background:#f4f7fc;border-radius:12px;padding:12px}.k small{display:block;color:#5b6b85;font-size:12px}.k b{display:block;font-size:22px;font-variant-numeric:tabular-nums;letter-spacing:-.01em}.k i{font-style:normal;font-size:12px;color:#5b6b85}
.say{background:#fff8e6;border-radius:12px;padding:12px 14px;margin-bottom:16px}.say b{display:block}
table{width:100%;border-collapse:collapse;font-size:13px;font-variant-numeric:tabular-nums}th{background:#0f5fbf;color:#fff;font-weight:600;padding:7px 6px;text-align:right}td{padding:6px;border-bottom:1px solid #e6ebf3}tr:nth-child(even) td{background:#f8fafd}
tfoot td{font-weight:700;border-top:2px solid #0f5fbf;background:#eef3fb!important}
.up{color:#15803d;font-weight:600}.down{color:#b45309;font-weight:600}
.note{color:#5b6b85;font-size:11.5px;margin-top:14px}
@media(max-width:600px){.kpis{grid-template-columns:repeat(2,1fr)}.page{padding:18px 14px;border-radius:0;margin:0}th:nth-child(6),td:nth-child(6),th:nth-child(8),td:nth-child(8){display:none}}
@media print{body{background:#fff}.page{box-shadow:none;margin:0;max-width:none;padding:0}.bar{display:none}}
</style>
<div class="bar"><button id="print">שמור כ-PDF</button><a class="ghost" href="${csv}">הורד Excel</a><a class="ghost" href="/solar/dashboard">חזרה</a></div>
<div class="page">
<header><div><h1>${esc(r.title)}</h1><p>הגג שלי · ${r.open ? "התקופה עוד לא נגמרה, ההשוואה על אותם ימים · " : ""}הופק ${esc(new Date().toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem" }))}</p></div></header>
<div class="kpis">
<div class="k"><small>ייצור</small><b>${n(r.kwh)}</b><i>קוט״ש</i></div>
<div class="k"><small>מול אשתקד</small><b>${r.change == null ? "—" : `${r.change > 0 ? "+" : ""}${r.change}%`}</b><i>${r.prev == null ? "אין נתונים מאשתקד" : `${n(r.prev)} קוט״ש אשתקד`}</i></div>
<div class="k"><small>הכנסה נקייה</small><b>${ils(r.net)}</b><i>${r.netPrev == null ? "" : `אשתקד ${ils(r.netPrev)}`}</i></div>
<div class="k"><small>שמש מול אשתקד</small><b>${r.sunChange == null ? "—" : `${r.sunChange > 0 ? "+" : ""}${r.sunChange}%`}</b><i>קרינה באזור</i></div>
</div>
<div class="say"><b>${r.change == null ? "אין עדיין השוואה לשנה שעברה." : r.change >= 0 ? `הגג ייצר ${r.change}% יותר מאשתקד.` : `הגג ייצר ${-r.change}% פחות מאשתקד.`}</b>${esc(r.why || "")}${r.best && r.worst && r.best !== r.worst ? ` ה${head} הכי חזק: ${esc(r.best.label)} (${n(r.best.kwh, 1)} קוט״ש). הכי חלש: ${esc(r.worst.label)} (${n(r.worst.kwh, 1)}).` : ""}</div>
<table><thead><tr><th>${head}</th><th>קוט״ש</th><th>אשתקד</th><th>שינוי</th><th>הכנסה</th><th>שמש</th><th>חום</th><th>גשם</th></tr></thead><tbody>${body}</tbody>
<tfoot><tr><td>סה״כ</td><td>${n(r.kwh, 1)}</td><td>${n(r.prev, 1)}</td><td>${delta(r.change)}</td><td>${ils(r.gross)}</td><td>${n(r.rad, 0)}</td><td></td><td></td></tr></tfoot></table>
<p class="note">הכנסה לפי ${n(r.rate * 100, 1)} אגורות לקוט״ש בממוצע: ${Math.round((1 - r.selfShare) * 100)}% מהייצור מוזרם לרשת ב-${n(r.exportRate * 100, 0)} אג׳, ו-${Math.round(r.selfShare * 100)}% נצרך בבית וחוסך ${n(r.selfRate * 100, 1)} אג׳ כולל מע״מ${r.fromBills ? ` (הצריכה העצמית מחושבת מ-${r.fromBills.bills} חשבונות חשמל)` : ""}${r.fixed ? `, פחות ניכוי קבוע של ${ils(r.fixed)} בחודש` : ""}. שמש: קרינה יומית במג׳ול למ״ר (Open-Meteo). ייצור: SolarEdge. השוואה לאשתקד על אותם תאריכים בדיוק.</p>
</div>
<script nonce="${nonce}">document.getElementById("print").addEventListener("click",()=>print())</script></html>`;
}

// ---------- Excel (.xlsx) ----------
// ZIP בלי דחיסה (stored): הקובץ קטן, ו-Excel, Google Sheets ו-Numbers פותחים אותו כרגיל
const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (b) => { let c = 0xffffffff; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
export function zip(files) {
  const enc = new TextEncoder();
  const parts = [];
  const dir = [];
  let off = 0;
  for (const [name, text] of files) {
    const nm = enc.encode(name);
    const data = enc.encode(text);
    const crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, 0, 2], [10, 0, 2], [12, 0x21, 2], [14, crc, 4], [18, data.length, 4], [22, data.length, 4], [26, nm.length, 2], [28, 0, 2]].forEach(([o, v, s]) => (s === 4 ? h.setUint32(o, v, true) : h.setUint16(o, v, true)));
    const c = new DataView(new ArrayBuffer(46));
    [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, 0, 2], [12, 0, 2], [14, 0x21, 2], [16, crc, 4], [20, data.length, 4], [24, data.length, 4], [28, nm.length, 2], [30, 0, 2], [32, 0, 2], [34, 0, 2], [36, 0, 2], [38, 0, 4], [42, off, 4]].forEach(([o, v, s]) => (s === 4 ? c.setUint32(o, v, true) : c.setUint16(o, v, true)));
    parts.push(new Uint8Array(h.buffer), nm, data);
    dir.push(new Uint8Array(c.buffer), nm);
    off += 30 + nm.length + data.length;
  }
  const size = dir.reduce((t, b) => t + b.length, 0);
  const e = new DataView(new ArrayBuffer(22));
  [[0, 0x06054b50, 4], [8, files.length, 2], [10, files.length, 2], [12, size, 4], [16, off, 4]].forEach(([o, v, s]) => (s === 4 ? e.setUint32(o, v, true) : e.setUint16(o, v, true)));
  const all = [...parts, ...dir, new Uint8Array(e.buffer)];
  const out = new Uint8Array(all.reduce((t, b) => t + b.length, 0));
  let p = 0;
  for (const b of all) { out.set(b, p); p += b.length; }
  return out;
}

const x = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const col = (i) => String.fromCharCode(65 + i);
// סגנונות (cellXfs): 1 כותרת, 2 כותרת טבלה, 3 טקסט, 4 קוט"ש, 5 אחוז, 6 שקלים, 7 תאריך, 8 תווית, 9 סה"כ קוט"ש, 10 סה"כ שקלים, 11 סה"כ אחוז, 12 הערה, 13 מספר שלם, 14 ערך גדול, 15 קלט, 16 סה"כ טקסט, 17 משפט
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="5"><numFmt numFmtId="164" formatCode="#,##0.0"/><numFmt numFmtId="165" formatCode="+0%;-0%;0%"/><numFmt numFmtId="166" formatCode="&quot;₪&quot;#,##0.00"/><numFmt numFmtId="167" formatCode="dd/mm/yyyy"/><numFmt numFmtId="168" formatCode="#,##0"/></numFmts>
<fonts count="7"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="18"/><color rgb="FF0F3D7A"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font><font><sz val="9"/><color rgb="FF6B7A90"/><name val="Arial"/></font><font><b/><sz val="14"/><color rgb="FF0F3D7A"/><name val="Arial"/></font><font><sz val="11"/><color rgb="FF13213A"/><name val="Arial"/></font></fonts>
<fills count="6"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0F5FBF"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEEF3FB"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF4D6"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF4F7FC"/></patternFill></fill></fills>
<borders count="3"><border/><border><bottom style="thin"><color rgb="FFE1E7F0"/></bottom></border><border><top style="medium"><color rgb="FF0F5FBF"/></top></border></borders>
<cellStyleXfs count="1"><xf/></cellStyleXfs>
<cellXfs count="19">
<xf/>
<xf fontId="1" applyFont="1"/>
<xf fontId="2" fillId="2" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf fontId="6" borderId="1" applyFont="1" applyBorder="1"/>
<xf numFmtId="164" borderId="1" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="165" borderId="1" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="166" borderId="1" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="167" borderId="1" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right"/></xf>
<xf fontId="3" fillId="5" borderId="1" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="164" fontId="3" fillId="3" borderId="2" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="166" fontId="3" fillId="3" borderId="2" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="165" fontId="3" fillId="3" borderId="2" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
<xf fontId="4" applyFont="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>
<xf numFmtId="168" borderId="1" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="164" fontId="5" borderId="1" applyNumberFormat="1" applyFont="1" applyBorder="1"/>
<xf numFmtId="166" fontId="3" fillId="4" borderId="1" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
<xf fontId="3" fillId="3" borderId="2" applyFont="1" applyFill="1" applyBorder="1"/>
<xf fontId="6" fillId="4" applyFont="1" applyFill="1" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf>
<xf numFmtId="9" fontId="3" fillId="4" borderId="1" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
<dxfs count="2"><dxf><font><b/><color rgb="FF15803D"/></font></dxf><dxf><font><b/><color rgb="FFB45309"/></font></dxf></dxfs>
</styleSheet>`;

// תא: מספר, טקסט, או נוסחה {f}
const cell = (ref, v, s) => {
  if (v == null || v === "") return s ? `<c r="${ref}" s="${s}"/>` : "";
  if (typeof v === "object") return `<c r="${ref}" s="${s}"><f>${x(v.f)}</f></c>`;
  if (typeof v === "number") return Number.isFinite(v) ? `<c r="${ref}" s="${s}"><v>${+v.toFixed(4)}</v></c>` : `<c r="${ref}" s="${s}"/>`;
  return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${x(v)}</t></is></c>`;
};
const sheet = (rows, { cols, merges = [], freeze, extra = "", heights = {}, wide = false }) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetViews><sheetView workbookViewId="0" rightToLeft="1" showGridLines="0">${freeze ? `<pane ySplit="${freeze - 1}" topLeftCell="A${freeze}" activePane="bottomLeft" state="frozen"/>` : ""}</sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="18"/>
<cols>${cols.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>
<sheetData>${rows.map((r, i) => `<row r="${i + 1}"${heights[i + 1] ? ` ht="${heights[i + 1]}" customHeight="1"` : ""}>${r.map(([v, s], j) => cell(`${col(j)}${i + 1}`, v, s)).join("")}</row>`).join("")}</sheetData>
${merges.length ? `<mergeCells count="${merges.length}">${merges.map((m) => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>` : ""}${extra}
<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="${wide ? "landscape" : "portrait"}"/>
</worksheet>`;
const serial = (day) => Date.parse(`${day}T00:00:00Z`) / 864e5 + 25569;

export function reportXlsx(r) {
  const D = "פירוט";
  const first = 5; // שורה 4 היא הכותרות
  const lastRow = first + r.rows.length - 1;
  const totalRow = lastRow + 1;
  const rng = (c) => `'${D}'!${c}${first}:${c}${lastRow}`;
  // פירוט: יום או חודש בכל שורה, עם נוסחאות שינוי והכנסה שמפנות לתעריף בגיליון הסיכום
  const detail = [
    [[`${r.title} — פירוט`, 1]],
    [[`השוואה לאותם תאריכים אשתקד. הכנסה לפי השווי לקוט״ש שבגיליון "סיכום" (תא B17).`, 12]],
    [],
    [[r.yearly ? "חודש" : "תאריך", 2], ["קוט״ש", 2], ["קוט״ש אשתקד", 2], ["שינוי", 2], ["הכנסה (₪)", 2], ["שמש (MJ/מ״ר)", 2], ["שמש אשתקד", 2], ["חום מרבי (°C)", 2], ["גשם (מ״מ)", 2]],
    ...r.rows.map((row, i) => {
      const n = first + i;
      return [[r.yearly ? row.label : serial(row.date), r.yearly ? 3 : 7], [row.kwh, 4], [row.prev, 4], [{ f: `IF(AND(ISNUMBER(B${n}),ISNUMBER(C${n}),C${n}>0),B${n}/C${n}-1,"")` }, 5], [{ f: `IF(ISNUMBER(B${n}),B${n}*'סיכום'!$B$17,"")` }, 6], [row.rad, 13], [row.radPrev, 13], [row.tmax, 4], [row.rain, 4]];
    }),
    [["סה״כ", 16], [{ f: `SUM(B${first}:B${lastRow})` }, 9], [{ f: `SUM(C${first}:C${lastRow})` }, 9], [{ f: `IF(C${totalRow}>0,SUMIF(C${first}:C${lastRow},"<>",B${first}:B${lastRow})/C${totalRow}-1,"")` }, 11], [{ f: `SUM(E${first}:E${lastRow})` }, 10], [{ f: `SUM(F${first}:F${lastRow})` }, 9], [{ f: `SUM(G${first}:G${lastRow})` }, 9], ["", 16], [{ f: `SUM(I${first}:I${lastRow})` }, 9]],
  ];
  const cf = `<conditionalFormatting sqref="D${first}:D${totalRow}"><cfRule type="cellIs" dxfId="0" priority="1" operator="greaterThanOrEqual"><formula>0</formula></cfRule><cfRule type="cellIs" dxfId="1" priority="2" operator="lessThan"><formula>0</formula></cfRule></conditionalFormatting><conditionalFormatting sqref="B${first}:B${lastRow}"><cfRule type="dataBar" priority="3"><dataBar><cfvo type="min"/><cfvo type="max"/><color rgb="FF8DB8EC"/></dataBar></cfRule></conditionalFormatting>`;
  // סיכום: הכל נוסחאות על גיליון הפירוט, כך ששינוי תעריף או תיקון יום מעדכן את כל הדוח
  const ifs = (a, b) => ({ f: `IF(${b}>0,${a}/${b}-1,"")` });
  const summary = [
    [[r.title, 1]],
    [[`הגג שלי · הופק ${new Date().toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem" })}${r.open ? " · התקופה עוד לא נגמרה, ההשוואה על אותם ימים בדיוק" : ""}`, 12]],
    [],
    [["", 2], ["התקופה", 2], ["אשתקד", 2], ["שינוי", 2]],
    [["ייצור (קוט״ש)", 8], [{ f: `SUM(${rng("B")})` }, 14], [{ f: `SUM(${rng("C")})` }, 4], [{ f: `'${D}'!D${totalRow}` }, 5]],
    [["שמש באזור (MJ/מ״ר)", 8], [{ f: `SUM(${rng("F")})` }, 13], [{ f: `SUM(${rng("G")})` }, 13], [ifs("B6", "C6"), 5]],
    [["הכנסה ברוטו (₪)", 8], [{ f: "B5*$B$17" }, 6], [{ f: "C5*$B$17" }, 6], [{ f: "D5" }, 5]],
    [["ניכויים קבועים (₪)", 8], [{ f: `$B$16*${r.months}` }, 6], [{ f: `$B$16*${r.months}` }, 6], ["", 3]],
    [["הכנסה נקייה (₪)", 16], [{ f: "B7-B8" }, 10], [{ f: "C7-C8" }, 10], [{ f: "D5" }, 11]],
    [[r.yearly ? "חודשים עם נתונים" : "ימים עם נתונים", 8], [r.yearly ? r.withData : { f: `COUNT(${rng("B")})` }, 13], ["", 3], ["", 3]],
    [],
    [["הנחות החישוב", 8], ["", 8], ["", 8], ["", 8]],
    [["תעריף הזנה לרשת (₪ לקוט״ש)", 3], [r.exportRate, 15], ["התעריף המובטח מחברת החשמל", 12]],
    [["חשמל שנחסך (₪ לקוט״ש)", 3], [r.selfRate, 15], ["מחיר החשמל הביתי כולל מע״מ", 12]],
    [["חלק הייצור שנצרך בבית", 3], [r.selfShare, 18], [r.fromBills ? `מ-${r.fromBills.bills} חשבונות חשמל: ייצור ${Math.round(r.fromBills.made)} פחות ${r.fromBills.sent} שהוזרמו` : "הערכה, עד שיהיו חשבונות חשמל", 12]],
    [["ניכוי קבוע לחודש (₪)", 3], [r.fixed, 15], ["אם יש בחשבון היצרן", 12]],
    [["שווי ממוצע לקוט״ש (₪)", 16], [{ f: "(1-B15)*B13+B15*B14" }, 10], ["משנים את התאים הצהובים, וכל הדוח מתעדכן", 12]],
    [],
    [[`${r.change == null ? "אין עדיין השוואה לשנה שעברה." : r.change >= 0 ? `הגג ייצר ${r.change}% יותר מאשתקד.` : `הגג ייצר ${-r.change}% פחות מאשתקד.`} ${r.why || ""}${r.best && r.worst && r.best !== r.worst ? ` הכי חזק: ${r.best.label} (${r.best.kwh.toFixed(1)} קוט״ש). הכי חלש: ${r.worst.label} (${r.worst.kwh.toFixed(1)}).` : ""}`, 17], ["", 17], ["", 17], ["", 17]],
  ];
  const sumCf = `<conditionalFormatting sqref="D5:D9"><cfRule type="cellIs" dxfId="0" priority="1" operator="greaterThanOrEqual"><formula>0</formula></cfRule><cfRule type="cellIs" dxfId="1" priority="2" operator="lessThan"><formula>0</formula></cfRule></conditionalFormatting>`;
  const files = [
    ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`],
    ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets><sheet name="סיכום" sheetId="1" r:id="rId1"/><sheet name="${D}" sheetId="2" r:id="rId2"/></sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`],
    ["xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ["xl/styles.xml", STYLES],
    ["xl/worksheets/sheet1.xml", sheet(summary, { cols: [26, 16, 16, 12], merges: ["A1:D1", "A2:D2", "A19:D19", "C13:D13", "C14:D14", "C15:D15", "C16:D16", "C17:D17"], extra: sumCf, heights: { 1: 30, 19: 64 } })],
    ["xl/worksheets/sheet2.xml", sheet(detail, { cols: [13, 11, 13, 10, 12, 13, 13, 13, 11], merges: ["A1:I1", "A2:I2"], freeze: first, extra: cf, wide: true, heights: { 1: 30, 4: 32 } })],
  ];
  return zip(files);
}

export const reportFileName = (p) => `solar-report-${p}.xlsx`;
