// ☀️ דשבורד הגג: דף פרטי (קישור חתום, כמו dashboard.js) שנבנה מ-agentReports/solar. קריאה בלבד, בלי AI ובלי קרדיטים.
import { adjusted, analyze, addDays, hardFault } from "./solar.js";
import { esc } from "./dashboard.js";

const median = (xs) => {
  const s = xs.filter((x) => x != null).sort((a, b) => a - b);
  return s.length ? (s[Math.floor((s.length - 1) / 2)] + s[Math.ceil((s.length - 1) / 2)]) / 2 : null;
};
const heb = (day) => `${+day.slice(8)}.${+day.slice(5, 7)}`;
const num = (n, d = 0) => (n == null ? "לא זמין" : Number(n).toLocaleString("he-IL", { maximumFractionDigits: d }));
const MONTHS = ["ינו׳", "פבר׳", "מרץ", "אפר׳", "מאי", "יוני", "יולי", "אוג׳", "ספט׳", "אוק׳", "נוב׳", "דצמ׳"];
const sumKwh = (rows) => rows.reduce((t, d) => t + (d.kwh || 0), 0);
const pct = (a, b) => (a != null && b > 0 ? Math.round((a / b - 1) * 100) : null);
const span = (end, n) => Array.from({ length: n }, (_, i) => addDays(end, i - n + 1));

// גשם שבא אחרי שבוע יבש שוטף את הפאנלים: משווים ימים בהירים לפני ואחרי. זו הערכה ללכלוך, לא מדידה
export function rainWash(days, end) {
  const out = [];
  for (const k of span(end, 365)) {
    if (!(days[k]?.rain >= 5)) continue;
    if (span(addDays(k, -1), 7).some((x) => days[x]?.rain >= 1)) continue;
    const before = median(span(addDays(k, -1), 10).map((x) => adjusted(days[x])));
    const after = median(span(addDays(k, 7), 7).map((x) => adjusted(days[x])));
    if (before && after) out.push({ day: k, lift: Math.round((after / before - 1) * 100) });
  }
  return out;
}

export function heatBands(days) {
  const bands = [["מתחת ל-20°", -99, 20], ["20°-27°", 20, 27], ["27°-33°", 27, 33], ["מעל 33°", 33, 99]];
  return bands
    .map(([label, lo, hi]) => {
      const xs = Object.values(days).filter((d) => d.kwh != null && d.rad >= 8 && d.tmax >= lo && d.tmax < hi);
      return { label, n: xs.length, v: median(xs.map((d) => d.kwh / d.rad)) };
    })
    .filter((b) => b.n);
}

export function monthly(days, today) {
  const end = addDays(today, -1);
  const key = (y, m) => `${y}-${String(m).padStart(2, "0")}`;
  const totals = {};
  for (const [k, d] of Object.entries(days)) if (d.kwh != null) totals[k.slice(0, 7)] = (totals[k.slice(0, 7)] || 0) + d.kwh;
  let y = +end.slice(0, 4);
  let m = +end.slice(5, 7);
  const out = [];
  for (let i = 0; i < 12; i++) {
    out.unshift({ label: MONTHS[m - 1], now: totals[key(y, m)] ?? null, prev: totals[key(y - 1, m)] ?? null, part: i === 0 });
    if (--m === 0) { m = 12; y--; }
  }
  return out;
}

export function insights(s, today) {
  const days = s.days || {};
  const a = analyze(days, today);
  const end = addDays(today, -1);
  const week = span(end, 7).map((k) => ({ day: k, ...days[k] })).filter((d) => d.kwh != null);
  const sun = (keys) => keys.reduce((t, k) => t + (days[k]?.rad || 0), 0);
  const sunVs = pct(sun(span(end, 7)), sun(span(addDays(end, -7), 7)));
  const wash = rainWash(days, end);
  const lift = median(wash.slice(-5).map((w) => w.lift));
  const m30 = sumKwh(span(end, 30).map((k) => days[k] || {}));
  const m30y = sumKwh(span(addDays(end, -364), 30).map((k) => days[k] || {}));
  const yearOk = span(addDays(end, -364), 30).filter((k) => days[k]?.kwh != null).length >= 25;
  const vs30 = yearOk ? pct(m30, m30y) : null;
  const sun30 = yearOk ? pct(sun(span(end, 30)), sun(span(addDays(end, -364), 30))) : null;
  const more = (n) => `${Math.abs(n)}% ${n >= 0 ? "יותר" : "פחות"}`;
  const good = [];
  const bad = [];
  const fault = hardFault(days, today);
  if (fault) bad.push(fault.replace(/[*⚠️]/g, "").trim());
  if (s.lastError) bad.push("הריצה האחרונה נכשלה, ומנסים שוב בשעה הבאה");
  if (a.ratio != null) (a.ratio >= 0.9 ? good : bad).push(`ביחס לשמש הגג מפיק ${Math.round(a.ratio * 100)}% מהרגיל שלו`);
  if (a.low.length) bad.push(`ימים חריגים השבוע: ${a.low.map(heb).join(", ")}`);
  else if (a.ratio != null) good.push("אין ימים חריגים השבוע");
  if (a.missing.length && !fault) bad.push(`חסרים נתונים: ${a.missing.map(heb).join(", ")}`);
  const flags = bad.length; // השוואה לאשתקד תלויה במזג האוויר, אז היא לא מורידה את הסטטוס
  if (a.vsYear != null) (a.vsYear >= 0 ? good : bad).push(`מול אותו שבוע אשתקד: ${more(a.vsYear)}`);
  if (vs30 != null) (vs30 >= 0 ? good : bad).push(`30 יום מול אשתקד: ${more(vs30)}${sun30 != null ? `, עם ${more(sun30)} שמש` : ""}`);
  const year = bad.length - flags;
  if (s.openAlerts > 0) bad.push(`התראות פתוחות בממיר: ${s.openAlerts}`);
  else if (s.openAlerts === 0) good.push("אין התראות פתוחות בממיר");
  if (lift >= 5) bad.push(`אחרי גשם הייצור עולה בכ-${lift}%, כנראה מלכלוך על הפאנלים`);
  else if (lift != null) good.push("גשם כמעט לא משנה את הייצור, אז הפאנלים נקיים יחסית");
  const grantDays = s.connectedAt ? Math.ceil((Date.parse(s.connectedAt) + 730 * 864e5 - Date.parse(`${today}T12:00:00Z`)) / 864e5) : 999;
  if (grantDays <= 60) bad.push(`החיבור ל-SolarEdge פג בעוד ${Math.max(grantDays, 0)} ימים`);
  const best = week.reduce((x, d) => (!x || d.kwh > x.kwh ? d : x), null);
  const note = sunVs != null && a.vsPrev != null ? `השבוע היו ${Math.abs(sunVs)}% ${sunVs >= 0 ? "יותר" : "פחות"} שמש מהשבוע שעבר, והייצור ${a.vsPrev >= 0 ? "עלה" : "ירד"} ב-${Math.abs(a.vsPrev)}%.` : "";
  const status = !Object.keys(days).length ? "empty" : fault ? "fault" : bad.length > year ? "check" : "ok";
  return { a, good, bad, note, status, best, wash, lift, vs30, m30 };
}

const W = 640;
const chartBars = (rows, h, color, value, label, tip) => {
  const max = Math.max(...rows.map(value).filter((v) => v != null), 1);
  const step = W / rows.length;
  const bar = Math.max(step - 2, 2);
  const marks = rows
    .map((r, i) => {
      const v = value(r);
      if (v == null) return "";
      const hh = Math.max((v / max) * (h - 24), 1);
      return `<rect x="${(i * step + 1).toFixed(1)}" y="${(h - 20 - hh).toFixed(1)}" width="${bar.toFixed(1)}" height="${hh.toFixed(1)}" rx="${Math.min(bar / 2, 3).toFixed(1)}" fill="var(${color})"/><rect class="hit" data-t="${esc(tip(r))}" x="${(i * step).toFixed(1)}" y="0" width="${step.toFixed(1)}" height="${h - 20}" fill="transparent"/>`;
    })
    .join("");
  const ticks = rows.map((r, i) => (label(r, i) ? `<text x="${(i * step + step / 2).toFixed(1)}" y="${h - 5}" text-anchor="middle">${esc(label(r, i))}</text>` : "")).join("");
  return `<svg viewBox="0 0 ${W} ${h}" role="img">${marks}<line x1="0" x2="${W}" y1="${h - 20}" y2="${h - 20}" class="axis"/>${ticks}</svg>`;
};

function efficiency(days, end) {
  const keys = span(end, 180);
  const ref = median(Object.values(days).map(adjusted));
  if (!ref) return "";
  const h = 190;
  const pts = keys.map((k, i) => ({ k, i, v: adjusted(days[k]) })).filter((p) => p.v != null).map((p) => ({ ...p, v: (p.v / ref) * 100 }));
  if (pts.length < 5) return "";
  const lo = Math.min(60, ...pts.map((p) => p.v));
  const hi = Math.max(130, ...pts.map((p) => p.v));
  const x = (i) => (i / (keys.length - 1)) * W;
  const y = (v) => 10 + (1 - (v - lo) / (hi - lo)) * (h - 40);
  const smooth = pts.map((p, j) => ({ ...p, s: median(pts.slice(Math.max(0, j - 3), j + 4).map((q) => q.v)) }));
  const line = smooth.map((p, j) => `${j ? "L" : "M"}${x(p.i).toFixed(1)} ${y(p.s).toFixed(1)}`).join(" ");
  const rains = keys.map((k, i) => (days[k]?.rain >= 5 ? `<path d="M${x(i).toFixed(1)} ${h - 22}v-8" class="rain" data-t="${esc(`${heb(k)}: גשם ${num(days[k].rain)} מ״מ`)}"/>` : "")).join("");
  const dots = pts.map((p) => `<circle cx="${x(p.i).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="2.5" class="dot" data-t="${esc(`${heb(p.k)}: ${Math.round(p.v)}%`)}"/>`).join("");
  const labels = [0, 60, 120, 179].map((i) => `<text x="${x(i).toFixed(1)}" y="${h - 5}" text-anchor="${i === 0 ? "start" : i === 179 ? "end" : "middle"}">${heb(keys[i])}</text>`).join("");
  return `<svg viewBox="0 0 ${W} ${h}" role="img"><line x1="0" x2="${W}" y1="${y(100)}" y2="${y(100)}" class="axis"/><text x="${W}" y="${y(100) - 5}" text-anchor="end">הרגיל: 100%</text>${dots}<path d="${line}" fill="none" stroke="var(--s1)" stroke-width="2" stroke-linejoin="round"/>${rains}${labels}</svg>`;
}

function scatter(days, end) {
  const keys = span(end, 365).filter((k) => days[k]?.kwh != null && days[k]?.rad != null);
  if (keys.length < 10) return "";
  const h = 240;
  const week = new Set(span(end, 7));
  const mx = Math.max(...keys.map((k) => days[k].rad), 1);
  const my = Math.max(...keys.map((k) => days[k].kwh), 1);
  const x = (v) => 8 + (v / mx) * (W - 16);
  const y = (v) => h - 30 - (v / my) * (h - 45);
  const dot = (k, cls, r) => `<circle cx="${x(days[k].rad).toFixed(1)}" cy="${y(days[k].kwh).toFixed(1)}" r="${r}" class="${cls}" data-t="${esc(`${heb(k)}: ${num(days[k].kwh, 1)} קוט״ש, ${num(days[k].rad, 1)} מג׳ול`)}"/>`;
  return `<svg viewBox="0 0 ${W} ${h}" role="img">${keys.filter((k) => !week.has(k)).map((k) => dot(k, "past", 3)).join("")}${keys.filter((k) => week.has(k)).map((k) => dot(k, "now", 5)).join("")}<line x1="0" x2="${W}" y1="${h - 30}" y2="${h - 30}" class="axis"/><text x="${W}" y="${h - 12}" text-anchor="end">הרבה שמש</text><text x="0" y="${h - 12}" text-anchor="start">מעט שמש</text></svg>`;
}

function monthChart(rows) {
  const h = 200;
  const max = Math.max(...rows.flatMap((r) => [r.now, r.prev]).filter((v) => v != null), 1);
  const step = W / rows.length;
  const bw = step / 2 - 2;
  const bar = (v, x, c, t) => {
    if (v == null) return "";
    const hh = Math.max((v / max) * (h - 34), 1);
    return `<rect x="${x.toFixed(1)}" y="${(h - 20 - hh).toFixed(1)}" width="${bw.toFixed(1)}" height="${hh.toFixed(1)}" rx="3" fill="var(${c})"/><rect class="hit" data-t="${esc(t)}" x="${x.toFixed(1)}" y="0" width="${bw.toFixed(1)}" height="${h - 20}" fill="transparent"/>`;
  };
  const marks = rows.map((r, i) => bar(r.now, i * step + 1, "--s1", `${r.label}: ${num(r.now)} קוט״ש${r.part ? " עד עכשיו" : ""}`) + bar(r.prev, i * step + step / 2, "--s2", `${r.label} אשתקד: ${num(r.prev)} קוט״ש`)).join("");
  const ticks = rows.map((r, i) => `<text x="${(i * step + step / 2).toFixed(1)}" y="${h - 5}" text-anchor="middle">${r.label}</text>`).join("");
  return `<svg viewBox="0 0 ${W} ${h}" role="img">${marks}<line x1="0" x2="${W}" y1="${h - 20}" y2="${h - 20}" class="axis"/>${ticks}</svg>`;
}

export function solarHtml(s, today) {
  const days = s.days || {};
  const end = addDays(today, -1);
  const v = insights(s, today);
  const { a } = v;
  const last30 = span(end, 30).map((k) => ({ day: k, ...days[k] }));
  const months = monthly(days, today);
  const heat = heatBands(days);
  const heatMax = Math.max(...heat.map((b) => b.v), 0.01);
  const STATUS = { ok: ["ok", "✓", "הגג תקין"], check: ["warn", "!", "יש מה לבדוק"], fault: ["bad", "✕", "תקלה"], empty: ["warn", "…", "הנתונים בדרך"] }[v.status];
  const stat = (label, value, sub) => `<div class="stat"><div class="sl">${label}</div><div class="sv">${value}</div>${sub ? `<div class="ss">${sub}</div>` : ""}</div>`;
  const vs = (n, what) => (n == null ? "" : `${Math.abs(n)}% ${n >= 0 ? "יותר" : "פחות"} ${what}`);
  const list = (xs, cls, icon) => xs.map((t) => `<li class="${cls}"><span>${icon}</span>${esc(t)}</li>`).join("");
  const eff = efficiency(days, end);
  const sc = scatter(days, end);
  const hasRain = last30.some((d) => d.rain >= 1);
  const rowsTable = span(end, 14).reverse().map((k) => {
    const d = days[k] || {};
    const r = adjusted(d);
    return `<tr><td>${heb(k)}</td><td>${num(d.kwh, 1)}</td><td>${num(d.rad, 1)}</td><td>${d.tmax == null ? "לא זמין" : `${Math.round(d.tmax)}°`}</td><td>${d.rain ? num(d.rain, 1) : "0"}</td><td>${r == null ? "יום מעונן" : a.low.includes(k) ? "חריג" : "תקין"}</td></tr>`;
  }).join("");
  const dark = "color-scheme:dark;--bg:#141413;--card:#1f1f1d;--line:#3a3a36;--t1:#f0efec;--t2:#c3c2b7;--s1:#3987e5;--s2:#d95926;--s3:#199e70;--past:#6d6c66;--ok:#5ac48a;--warn:#e5a53a;--bad:#f07f7a;";
  return `<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>הגג הסולארי</title>
<style>
:root{color-scheme:light;--bg:#f6f5f1;--card:#fcfcfb;--line:#dddcd5;--t1:#0b0b0b;--t2:#52514e;--s1:#2a78d6;--s2:#eb6834;--s3:#1baf7a;--past:#bdbcb4;--ok:#0a7d3f;--warn:#9a5b00;--bad:#b3261e}
@media (prefers-color-scheme:dark){:root{${dark}}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--t1);font:16px/1.5 system-ui,"Segoe UI",Arial,sans-serif}
main{max-width:980px;margin:auto;padding:16px;display:grid;gap:14px;grid-template-columns:repeat(2,minmax(0,1fr))}
.full{grid-column:1/-1}.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px;min-width:0}
header.card{display:flex;align-items:center;gap:14px}.badge{width:48px;height:48px;flex:none;border-radius:50%;display:grid;place-items:center;font-size:24px;font-weight:700;color:#fff}
.b-ok{background:var(--ok)}.b-warn{background:var(--warn)}.b-bad{background:var(--bad)}h1{font-size:24px;margin:0}header p{margin:2px 0 0;color:var(--t2)}
h2{font-size:17px;margin:0 0 10px}.stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.stat{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px}
.sl{color:var(--t2);font-size:14px}.sv{font-size:28px;font-weight:700;line-height:1.25}.ss{color:var(--t2);font-size:14px}
ul{list-style:none;margin:0;padding:0;display:grid;gap:8px}li{display:flex;gap:8px}li span{font-weight:700}.g span{color:var(--ok)}.y span{color:var(--warn)}
svg{display:block;width:100%;height:auto;direction:ltr}svg text{fill:var(--t2);font-size:13px}.axis{stroke:var(--line)}.dot{fill:var(--s1);opacity:.28}.past{fill:var(--past);opacity:.7}.now{fill:var(--s2);stroke:var(--card);stroke-width:2}.rain{stroke:var(--s3);stroke-width:3;stroke-linecap:round}
.key{display:flex;gap:14px;flex-wrap:wrap;color:var(--t2);font-size:14px;margin-bottom:8px}.key i{display:inline-block;width:12px;height:12px;border-radius:3px;margin-inline-end:6px;vertical-align:-1px}
.band{display:grid;grid-template-columns:96px 1fr 44px;gap:8px;align-items:center;margin-bottom:8px}.band div{height:12px;border-radius:4px;background:var(--s1)}
table{width:100%;border-collapse:collapse;font-size:15px}th,td{padding:7px 6px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}th{color:var(--t2);font-weight:500}.scroll{overflow-x:auto}
#tip{position:fixed;display:none;z-index:9;background:var(--t1);color:var(--bg);padding:6px 10px;border-radius:8px;font-size:14px;pointer-events:none;max-width:80vw}
@media(max-width:720px){svg text{font-size:21px}main{grid-template-columns:minmax(0,1fr)}.stats{grid-template-columns:repeat(2,minmax(0,1fr))}.sv{font-size:24px}}
</style>
<main>
<header class="card full"><div class="badge b-${STATUS[0]}" aria-hidden="true">${STATUS[1]}</div><div><h1>${STATUS[2]}</h1><p>${s.lastOkAt ? `עודכן ${esc(new Date(s.lastOkAt).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }))}` : ""}</p></div></header>
<div class="stats full">
${stat("השבוע", `${num(a.total)} קוט״ש`, vs(a.vsPrev, "מול שבוע שעבר"))}
${stat("30 יום", `${num(v.m30)} קוט״ש`, vs(v.vs30, "מול אשתקד"))}
${stat("מול השמש", a.ratio == null ? "לא זמין" : `${Math.round(a.ratio * 100)}%`, "מהרגיל של הגג")}
${stat("היום הכי טוב", v.best ? `${num(v.best.kwh, 1)} קוט״ש` : "לא זמין", v.best ? heb(v.best.day) : "")}
</div>
<section class="card"><h2>מה טוב</h2><ul>${list(v.good, "g", "✓") || "<li>עדיין אין מספיק נתונים</li>"}</ul></section>
<section class="card"><h2>מה פחות טוב</h2><ul>${list(v.bad, "y", "!") || `<li class="g"><span>✓</span>אין כרגע</li>`}</ul></section>
${v.note ? `<section class="card full">${esc(v.note)}</section>` : ""}
<section class="card full"><h2>ייצור יומי, 30 יום (קוט״ש)</h2>${chartBars(last30, 170, "--s1", (d) => d.kwh, (d, i) => (i % 5 === 0 ? heb(d.day) : ""), (d) => `${heb(d.day)}: ${num(d.kwh, 1)} קוט״ש`)}</section>
<section class="card full"><h2>שמש באותם ימים (מג׳ול למ״ר)</h2>${chartBars(last30, 130, "--s2", (d) => d.rad, (d, i) => (i % 5 === 0 ? heb(d.day) : ""), (d) => `${heb(d.day)}: ${num(d.rad, 1)} מג׳ול${hasRain && d.rain ? `, גשם ${num(d.rain, 1)} מ״מ` : ""}`)}</section>
${eff ? `<section class="card full"><h2>יעילות מול השמש, חצי שנה</h2><div class="key"><span><i style="background:var(--s1)"></i>יעילות</span><span><i style="background:var(--s3)"></i>גשם</span></div>${eff}</section>` : ""}
<section class="card full"><h2>חודשים מול אשתקד (קוט״ש)</h2><div class="key"><span><i style="background:var(--s1)"></i>השנה</span><span><i style="background:var(--s2)"></i>אשתקד</span></div>${monthChart(months)}</section>
${sc ? `<section class="card"><h2>ייצור מול שמש, שנה</h2><div class="key"><span><i style="background:var(--s2)"></i>השבוע</span><span><i style="background:var(--past)"></i>שאר הימים</span></div>${sc}</section>` : ""}
${heat.length ? `<section class="card"><h2>השפעת החום</h2>${heat.map((b) => `<div class="band"><span>${b.label}</span><div style="width:${Math.round((b.v / heatMax) * 100)}%"></div><span>${Math.round((b.v / heatMax) * 100)}%</span></div>`).join("")}</section>` : ""}
${v.wash.length ? `<section class="card full"><h2>מה גשם עושה לגג</h2><div class="scroll"><table><tr><th>גשם ראשון אחרי יובש</th><th>שינוי ביעילות</th></tr>${v.wash.slice(-6).reverse().map((w) => `<tr><td>${heb(w.day)}</td><td><bdi dir="ltr">${w.lift > 0 ? "+" : ""}${w.lift}%</bdi></td></tr>`).join("")}</table></div></section>` : ""}
<section class="card full"><h2>14 הימים האחרונים</h2><div class="scroll"><table><tr><th>יום</th><th>קוט״ש</th><th>שמש</th><th>חום</th><th>גשם</th><th>מצב</th></tr>${rowsTable}</table></div></section>
</main><div id="tip" role="status"></div>
<script>const t=document.getElementById("tip");const show=(e)=>{const m=e.target.closest("[data-t]");if(!m){t.style.display="none";return}t.textContent=m.dataset.t;t.style.display="block";const x=e.clientX,y=e.clientY;t.style.left=Math.max(8,Math.min(innerWidth-t.offsetWidth-8,x-t.offsetWidth/2))+"px";t.style.top=Math.max(8,y-44)+"px"};document.addEventListener("pointermove",show);document.addEventListener("click",show);</script></html>`;
}
