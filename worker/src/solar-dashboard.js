// ☀️ דשבורד הגג: דף פרטי (הגישה ב-solar.js) שנבנה מ-agentReports/solar. קריאה בלבד, בלי AI ובלי קרדיטים.
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

// ימים בלי ייצור למרות שהיה אור, בשנה האחרונה
export const outages = (days, end) => span(end, 365).filter((k) => days[k]?.kwh != null && days[k].kwh < 0.1 && days[k].rad >= 3);

// אין ב-API ייצור לפי פאנל, אז מעריכים: פאנל שיצא מוריד את הגג בחלק אחד מתוך כמות הפאנלים, ולאורך זמן
export function panelScan(panels, ratio) {
  if (!panels || ratio == null) return { lost: 0 };
  const drop = 1 - ratio;
  const lost = drop >= Math.max(0.06, 0.7 / panels) ? Math.max(1, Math.round(drop * panels)) : 0;
  return { lost };
}

// למה הייצור השתנה: משווים לשינוי בשמש באותה תקופה
export function why(prod, sun) {
  if (prod == null) return "";
  if (sun == null) return Math.abs(prod) <= 3 ? "כמעט אותו דבר." : "אין עדיין נתוני שמש להשוואה.";
  if (Math.abs(prod) <= 3) return "כמעט אותו דבר.";
  const fromWeather = Math.abs(prod - sun) <= 6 && Math.sign(prod) === Math.sign(sun) && Math.abs(sun) >= 2;
  if (prod < 0) return fromWeather ? `בגלל מזג האוויר: היו ${Math.abs(sun)}% פחות שמש.` : sun < prod ? "הייתה פחות שמש, והגג התמודד טוב." : sun >= -2 ? "לא מזג האוויר: הייתה אותה שמש, וכדאי לבדוק." : `מזג האוויר מסביר רק חלק: היו ${Math.abs(sun)}% פחות שמש.`;
  return fromWeather ? `בזכות מזג האוויר: היו ${sun}% יותר שמש.` : "הגג עבד טוב יותר, לא רק בזכות השמש.";
}

export function comparisons(days, today) {
  const end = addDays(today, -1);
  const full = (keys) => keys.length && keys.filter((k) => days[k]?.kwh != null).length >= keys.length * 0.9;
  const kwh = (keys) => sumKwh(keys.map((k) => days[k] || {}));
  const sun = (keys) => (keys.filter((k) => days[k]?.rad != null).length >= keys.length * 0.9 ? keys.reduce((t, k) => t + (days[k]?.rad || 0), 0) : null);
  const row = (title, a, b) => {
    if (!full(a) || !full(b)) return null;
    const now = kwh(a);
    const then = kwh(b);
    const p = pct(now, then);
    return { title, now, then, pct: p, why: why(p, sun(a) != null && sun(b) ? pct(sun(a), sun(b)) : null) };
  };
  const back = (keys, n) => keys.map((k) => addDays(k, -n));
  const week = span(end, 7);
  const first = `${end.slice(0, 8)}01`;
  const month = span(end, +end.slice(8));
  const prevEnd = addDays(first, -1);
  const prev = span(prevEnd, +prevEnd.slice(8));
  const year = span(end, 365);
  return [
    row("השבוע מול שבוע שעבר", week, back(week, 7)),
    row("השבוע מול אשתקד", week, back(week, 364)),
    row("החודש מול אותם ימים אשתקד", month, back(month, 365)),
    row(`${MONTHS[+prevEnd.slice(5, 7) - 1]} מול אשתקד`, prev, back(prev, 365)),
    row("12 חודשים מול 12 שלפניהם", year, back(year, 365)),
  ].filter(Boolean);
}

export function forecast(days, today) {
  const end = addDays(today, -1);
  const month = span(end, +end.slice(8));
  const done = sumKwh(month.map((k) => days[k] || {}));
  const y = +end.slice(0, 4);
  const m = +end.slice(5, 7);
  const size = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lastMonth = span(`${y - 1}-${end.slice(5, 7)}-${String(size).padStart(2, "0")}`, size);
  const covered = lastMonth.filter((k) => days[k]?.kwh != null).length >= size * 0.9;
  const sameDays = month.map((k) => addDays(k, -365));
  const base = sumKwh(sameDays.map((k) => days[k] || {}));
  if (covered && base > 0) {
    const target = sumKwh(lastMonth.map((k) => days[k] || {}));
    const pace = pct(done, base);
    return { done, target, end: Math.round((target * done) / base), pace, onTrack: pace >= -3 };
  }
  const recent = span(end, 14).map((k) => days[k]?.kwh).filter((v) => v != null);
  if (recent.length < 5) return { done, target: null, end: null, pace: null };
  // shortcut: בלי נתוני אשתקד מניחים שהקצב של השבועיים האחרונים נמשך, עד שתיאסף היסטוריה
  return { done, target: null, end: Math.round(done + (size - month.length) * (recent.reduce((t, v) => t + v, 0) / recent.length)), pace: null };
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
  const grantDays = s.connectedAt ? Math.ceil((Date.parse(s.connectedAt) + 730 * 864e5 - Date.parse(`${today}T12:00:00Z`)) / 864e5) : 999;
  if (grantDays <= 60) bad.push(`החיבור ל-SolarEdge פג בעוד ${Math.max(grantDays, 0)} ימים`);
  const best = week.reduce((x, d) => (!x || d.kwh > x.kwh ? d : x), null);
  let note = "";
  if (a.vsPrev != null) {
    const healthy = a.ratio == null || a.ratio >= 0.9;
    if (Math.abs(a.vsPrev) <= 3) note = "הייצור דומה לשבוע שעבר.";
    else if (a.vsPrev < 0) note = healthy && sunVs < 0 ? `הייצור ירד ב-${-a.vsPrev}% כי הייתה פחות שמש. זו לא תקלה.` : `הייצור ירד ב-${-a.vsPrev}% מהשבוע שעבר.`;
    else note = sunVs > 0 ? `הייצור עלה ב-${a.vsPrev}% כי הייתה יותר שמש.` : `הייצור עלה ב-${a.vsPrev}% מהשבוע שעבר.`;
  }
  const dry = (() => {
    for (let i = 1; i <= 120; i++) if (days[addDays(today, -i)]?.rain >= 2) return i - 1;
    return null;
  })();
  const advice = [];
  if (fault && /אין נתוני/.test(fault)) advice.push(["בדוק את הממיר", "תסתכל על הנורה בממיר ועל חיבור האינטרנט שלו. אם הוא כבוי, בדוק את המפסק בלוח החשמל."]);
  else if (fault) advice.push(["בדוק את המפסק והממיר", "אם גם מחר לא יהיה ייצור, דבר עם המתקין."]);
  if (s.openAlerts > 0) advice.push(["פתח את mySolarEdge", "הממיר מדווח על התראה, ושם כתוב מה קרה."]);
  if (a.ratio != null && a.ratio < 0.9) advice.push(["בדוק מה השתנה על הגג", "צל חדש, אבק או לכלוך. אם זה נמשך עוד שבוע, דבר עם המתקין."]);
  if (panelScan(s.panels, a.ratio).lost) advice.push(["בקש מהמתקין בדיקת פאנלים", "הירידה מתאימה לפאנל שלא תורם, והוא יכול לראות כל פאנל בנפרד בפורטל של SolarEdge."]);
  if (lift >= 5) advice.push(["שטיפה תשתלם", `אחרי גשם הגג מפיק בערך ${lift}% יותר. שטיפה לפני עונה יבשה יכולה להחזיר חלק מזה.`]);
  if (dry >= 30 && lift >= 3) advice.push(["הגג לא נשטף הרבה זמן", `כבר ${dry} ימים בלי גשם, ואבק מצטבר.`]);
  if (grantDays <= 60) advice.push(["חדש את החיבור", "כתוב לשולה \"חיבור סולארי\" ואשר ב-SolarEdge."]);
  if (!advice.length && a.days) advice.push(["אין מה לעשות השבוע", "הגג מסתדר לבד. הדוח הבא יגיע ביום ראשון."]);
  if (a.days && +today.slice(8) <= 7) advice.push(["השווה לחשבון החשמל", "פעם בחודש כדאי לבדוק שהייצור כאן מתאים למה שרשום בחשבון."]);
  const status = !Object.keys(days).length ? "empty" : fault ? "fault" : bad.length > year ? "check" : "ok";
  return { a, good, bad, note, status, best, wash, lift, vs30, m30, advice };
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

const HOME_KWH_DAY = 25; // בית ישראלי רגיל, בערך. רק כדי לתת למספר תחושה
const DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const dayName = (k) => DAYS[new Date(`${k}T12:00:00Z`).getUTCDay()];
const ICON = {
  sun: '<svg viewBox="0 0 24 24" class="ic"><circle cx="12" cy="12" r="5" fill="#f5a524"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" stroke="#f5a524" stroke-width="2" stroke-linecap="round"/></svg>',
  part: '<svg viewBox="0 0 24 24" class="ic"><circle cx="9" cy="9" r="4.5" fill="#f5a524"/><path d="M8 20h9a4 4 0 0 0 .6-7.9A5.5 5.5 0 0 0 7 13.5 3.3 3.3 0 0 0 8 20Z" fill="#a9b4c2"/></svg>',
  cloud: '<svg viewBox="0 0 24 24" class="ic"><path d="M7 19h10a4.5 4.5 0 0 0 .7-8.9A6 6 0 0 0 6.1 11.6 3.8 3.8 0 0 0 7 19Z" fill="#a9b4c2"/></svg>',
  rain: '<svg viewBox="0 0 24 24" class="ic"><path d="M7 15h10a4 4 0 0 0 .6-7.9A5.5 5.5 0 0 0 7 8.6 3.3 3.3 0 0 0 7 15Z" fill="#a9b4c2"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3" stroke="#3b9ae1" stroke-width="2" stroke-linecap="round"/></svg>',
};
const scene = (status) => {
  const off = status === "fault";
  return `<svg class="scene" viewBox="0 30 360 130" preserveAspectRatio="xMidYMid slice" role="img" aria-label="בית עם פאנלים סולאריים">
<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${off ? "#7d8796" : "#6ec1ff"}"/><stop offset="1" stop-color="${off ? "#c9ced6" : "#e3f4ff"}"/></linearGradient><radialGradient id="glow"><stop offset="0" stop-color="#ffd76a" stop-opacity=".9"/><stop offset="1" stop-color="#ffd76a" stop-opacity="0"/></radialGradient></defs>
<rect width="360" height="190" fill="url(#sky)"/>
${off ? "" : `<circle cx="84" cy="58" r="70" fill="url(#glow)"/><g class="rays" stroke="#ffc53d" stroke-width="4" stroke-linecap="round">${Array.from({ length: 8 }, (_, i) => `<path transform="rotate(${i * 45} 84 58)" d="M84 18v-10"/>`).join("")}</g><circle cx="84" cy="58" r="26" fill="#ffc53d"/>`}
<ellipse cx="180" cy="196" rx="260" ry="34" fill="${off ? "#9aa39c" : "#8fd19e"}"/>
<path d="M190 96 262 52l74 44v70H190Z" fill="#fffdf8"/><path d="M178 102 262 50l86 52" fill="none" stroke="#b5533c" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
<g transform="translate(206 62) skewY(-31)" fill="#1f4e8c" stroke="#dbe9f7" stroke-width="1.5">${[0, 16, 32].flatMap((x) => [0, 12].map((y) => `<rect x="${x}" y="${y}" width="15" height="11"/>`)).join("")}</g>
<rect x="246" y="124" width="26" height="42" rx="3" fill="#b5533c"/><rect x="288" y="112" width="26" height="22" rx="3" fill="#bfe3ff" stroke="#7a8796"/>
${off ? "" : `<path class="flow" d="M110 76 C150 96 180 90 214 84" fill="none" stroke="#ffc53d" stroke-width="3" stroke-linecap="round" stroke-dasharray="2 12"/>`}
</svg>`;
};
const ring = (ratio) => {
  const p = ratio == null ? 0 : Math.min(ratio, 1.1) / 1.1;
  const c = 2 * Math.PI * 52;
  const word = ratio == null ? "לומד את הגג" : ratio >= 0.95 ? "מצוין" : ratio >= 0.9 ? "טוב" : ratio >= 0.8 ? "קצת נמוך" : "נמוך";
  const tone = ratio == null ? "--t2" : ratio >= 0.9 ? "--ok" : ratio >= 0.8 ? "--warn" : "--bad";
  return `<div class="ringbox"><svg viewBox="0 0 120 120" class="ring"><circle cx="60" cy="60" r="52" class="rt"/><circle cx="60" cy="60" r="52" class="rv" style="stroke:var(${tone});stroke-dasharray:${c.toFixed(1)};--off:${(c * (1 - p)).toFixed(1)}" transform="rotate(-90 60 60)"/><text x="60" y="58" text-anchor="middle" class="rn">${ratio == null ? "…" : `${Math.round(ratio * 100)}%`}</text><text x="60" y="78" text-anchor="middle" class="rw">${word}</text></svg><p>כמה הגג מפיק מהשמש שהייתה, לעומת הרגיל שלו. 100% זה בדיוק הרגיל.</p></div>`;
};
const scanCard = (s, a, days, end) => {
  const { lost } = panelScan(s.panels, a.ratio);
  const off = outages(days, end);
  const lines = [];
  if (s.panels) lines.push(`במערכת רשומים ${s.panels} פאנלים${s.inverters > 1 ? ` ו-${s.inverters} ממירים` : s.inverters === 1 ? " וממיר אחד" : ""}.`);
  if (a.ratio != null) lines.push(lost ? `הגג מפיק פחות מהרגיל, ומבחינת הכמות זה מתאים לבערך ${lost === 1 ? "פאנל אחד" : `${lost} פאנלים`} שלא תורמים. יכול להיות גם לכלוך או צל.` : "לא רואים סימן לפאנל שיצא מפעולה.");
  lines.push(off.length ? `בשנה האחרונה היו ${off.length} ימים בלי ייצור: ${off.slice(-4).map(heb).join(", ")}.` : "בשנה האחרונה לא נמצאו ימים של נפילה מלאה.");
  return `<section class="card r"><h2>סריקת הגג</h2>${lines.map((l) => `<p class="say2">${esc(l)}</p>`).join("")}<p class="small">זו הערכה לפי ייצור הגג כולו. SolarEdge לא מוסרת דרך החיבור הזה ייצור של כל פאנל בנפרד.</p></section>`;
};

export function solarHtml(s, today, nonce = "") {
  const n = nonce ? ` nonce="${nonce}"` : "";
  const days = s.days || {};
  const end = addDays(today, -1);
  const v = insights(s, today);
  const { a } = v;
  const last30 = span(end, 30).map((k) => ({ day: k, ...days[k] }));
  const months = monthly(days, today);
  const heat = heatBands(days);
  const week = span(end, 7).map((k) => ({ day: k, ...days[k] }));
  const weekMax = Math.max(...week.map((d) => d.kwh || 0), 1);
  const radMax = Math.max(...last30.map((d) => d.rad || 0), 1);
  const weather = (d) => (d.rain >= 1 ? ["rain", "גשם"] : d.rad == null ? ["cloud", ""] : d.rad >= radMax * 0.75 ? ["sun", "שמש"] : d.rad >= radMax * 0.45 ? ["part", "חלקית"] : ["cloud", "מעונן"]);
  const rows = comparisons(days, today);
  const f = forecast(days, today);
  const monthRow = rows.find((r) => r.title.startsWith("החודש"));
  const today_ = s.today?.day === today ? s.today : null;
  const tile = (label, value, sub) => `<div class="stat"><div class="sl">${label}</div><div class="sv">${value}</div><div class="ss">${sub}</div></div>`;
  const bestMonth = months.filter((m) => m.now != null && !m.part).reduce((x, m) => (!x || m.now > x.now ? m : x), null);
  const hottest = heat.at(-1);
  const heatDrop = heat.length > 1 ? Math.round((1 - hottest.v / heat[0].v) * 100) : null;
  const homeDays = Math.round(a.total / HOME_KWH_DAY);
  const HEAD = { ok: ["ok", "הגג עובד טוב"], check: ["warn", "הגג עובד, ויש משהו לבדוק"], fault: ["bad", "משהו לא תקין בגג"], empty: ["warn", "הנתונים בדרך"] }[v.status];
  const list = (xs, cls, icon) => xs.map((t) => `<li class="${cls}"><span aria-hidden="true">${icon}</span>${esc(t)}</li>`).join("");
  const eff = efficiency(days, end);
  const sc = scatter(days, end);
  const rowsTable = span(end, 14).reverse().map((k) => {
    const d = days[k] || {};
    const r = adjusted(d);
    return `<tr><td>${heb(k)}</td><td>${num(d.kwh, 1)}</td><td>${num(d.rad, 1)}</td><td>${d.tmax == null ? "לא זמין" : `${Math.round(d.tmax)}°`}</td><td>${d.rain ? num(d.rain, 1) : "0"}</td><td>${r == null ? "יום מעונן" : a.low.includes(k) ? "חריג" : "תקין"}</td></tr>`;
  }).join("");
  const dark = "color-scheme:dark;--bg:#000;--card:#1c1c1e;--line:#38383a;--t1:#f5f5f7;--t2:#a1a1a6;--s1:#3987e5;--s2:#d95926;--s3:#199e70;--s4:#636366;--past:#6d6c66;--ok:#30d158;--warn:#ffb340;--bad:#ff6961;--bar:rgba(28,28,30,.72);";
  return `<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>הגג שלי</title>
<link rel="manifest" href="/solar/manifest.webmanifest"><link rel="icon" href="/solar/icon-192.png"><link rel="apple-touch-icon" href="/solar/icon-192.png"><meta name="theme-color" content="#f5f5f7" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)">
<script${n}>document.documentElement.classList.add("js")</script>
<style>
:root{color-scheme:light;--bg:#f5f5f7;--card:#fff;--line:#e5e5ea;--t1:#1d1d1f;--t2:#6e6e73;--s1:#2a78d6;--s2:#eb6834;--s3:#1baf7a;--s4:#c7c7cc;--past:#c7c7cc;--ok:#1a8f3c;--warn:#b25f00;--bad:#d70015;--bar:rgba(255,255,255,.72);--ease:cubic-bezier(.22,1,.36,1)}
@media (prefers-color-scheme:dark){:root{${dark}}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--t1);font:100%/1.5 -apple-system,system-ui,"Segoe UI",Roboto,Arial,sans-serif}
.top{position:sticky;top:0;z-index:5;padding:10px 16px;background:var(--bar);-webkit-backdrop-filter:blur(20px) saturate(180%);backdrop-filter:blur(20px) saturate(180%)}
.bar{display:flex;justify-content:space-between;align-items:center;max-width:720px;margin:0 auto 8px}.bar b{font-size:1.05rem}
.seg{display:grid;grid-template-columns:repeat(4,1fr);gap:2px;max-width:720px;margin:auto;background:var(--line);padding:2px;border-radius:10px}.seg button{font:inherit;font-size:.9rem;font-weight:500;border:0;background:none;color:var(--t1);padding:7px 2px;border-radius:8px;cursor:pointer;transition:transform .1s ease-out}.seg button:active{transform:scale(.96)}.seg button[aria-selected=true]{background:var(--card);font-weight:600;box-shadow:0 1px 3px rgba(0,0,0,.14)}
.panel{display:grid;gap:12px;min-width:0}.js .panel{display:none}.js .panel.on{display:grid;animation:fade .28s var(--ease)}@keyframes fade{from{opacity:0;transform:translateY(6px)}}
.tiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.stat{background:var(--card);border-radius:18px;padding:14px;box-shadow:0 1px 2px rgba(0,0,0,.04)}.sl{color:var(--t2);font-size:.85rem}.sv{font-size:1.75rem;font-weight:700;line-height:1.2;letter-spacing:-.02em;font-variant-numeric:tabular-nums}.ss{color:var(--t2);font-size:.8rem}
.verdict{display:grid;gap:4px;padding:14px 16px}.row{display:grid;gap:4px;padding:14px 16px}.rt1{display:flex;justify-content:space-between;align-items:center;gap:8px}.rt1 h3{margin:0;font-size:.95rem}.delta{font-weight:700;font-size:.95rem;white-space:nowrap}.delta.up{color:var(--ok)}.delta.down{color:var(--warn)}.vals{display:flex;align-items:baseline;gap:8px}.vals b{font-size:1.5rem;letter-spacing:-.02em;font-variant-numeric:tabular-nums}.vals span{color:var(--t2);font-size:.9rem}.pill{font-size:.85rem;font-weight:600}.pill.ok{color:var(--ok)}.pill.warn{color:var(--warn)}.pill.bad{color:var(--bad)}
main{max-width:720px;margin:auto;padding:12px 16px 32px}
.card{background:var(--card);border-radius:18px;padding:16px;min-width:0;box-shadow:0 1px 2px rgba(0,0,0,.04)}
.hero{padding:0;overflow:hidden}.scene{display:block;width:100%;height:96px}.say{padding:12px 16px 14px}
h1{font-size:1.5rem;line-height:1.15;letter-spacing:-.02em;margin:0 0 4px;font-weight:700}.say p{margin:0;color:var(--t2)}
h2{font-size:1.3rem;letter-spacing:-.01em;line-height:1.2;margin:0 0 14px;font-weight:700}h3{font-size:1rem;margin:0 0 8px;font-weight:600}
.ringbox{display:flex;align-items:center;gap:18px}.ringbox p{margin:0;color:var(--t2)}.ring{width:132px;flex:none}.rt{fill:none;stroke:var(--line);stroke-width:10}.rv{fill:none;stroke-width:10;stroke-linecap:round;stroke-dashoffset:var(--off)}.rn{fill:var(--t1);font-size:26px;font-weight:700}.rw{fill:var(--t2);font-size:12px}
ul{list-style:none;margin:0;padding:0;display:grid;gap:10px}li{display:flex;gap:10px}li span{font-weight:700;flex:none}.g span{color:var(--ok)}.y span{color:var(--warn)}
.tip{display:flex;gap:12px;padding:12px 0;border-top:1px solid var(--line)}.tip:first-of-type{border-top:0;padding-top:0}.tip:last-child{padding-bottom:0}.tip b{display:block}.tip p{margin:0;color:var(--t2)}.num{width:28px;height:28px;flex:none;border-radius:50%;background:var(--s1);color:#fff;display:grid;place-items:center;font-weight:700;font-size:.9rem}
.day{display:grid;grid-template-columns:62px 24px 1fr 56px;gap:10px;align-items:center;padding:7px 0}.day b{text-align:start;font-weight:600;font-variant-numeric:tabular-nums}.ic{width:24px;height:24px;display:block}.track{height:12px;border-radius:6px;background:var(--line);overflow:hidden}.track i{display:block;height:100%;border-radius:6px;background:var(--s1)}.day.top1 span{font-weight:700}
.pair{margin-bottom:18px}.pair:last-child{margin-bottom:0}.cmp{display:grid;grid-template-columns:100px 1fr 56px;gap:10px;align-items:center;margin-bottom:6px}.cmp b{font-weight:600;font-variant-numeric:tabular-nums}
.small{margin:12px 0 0;color:var(--t2);font-size:.85rem}#install{font:inherit;font-weight:600;border:0;border-radius:14px;padding:12px 18px;background:var(--s1);color:#fff;width:100%;transition:transform .1s ease-out}#install:active{transform:scale(.98)}.installbox{display:none}.installbox.on{display:block}
.say2{margin:0;color:var(--t2)}.say2+.say2{margin-top:8px}
details{background:var(--card);border-radius:22px}summary{cursor:pointer;list-style:none;padding:18px 20px;font-weight:600;display:flex;justify-content:space-between;transition:transform .1s ease-out}summary:active{transform:scale(.985)}summary::-webkit-details-marker{display:none}summary::after{content:"＋";color:var(--t2)}details[open] summary::after{content:"－"}.more{padding:0 20px 20px;display:grid;gap:22px}
svg text{fill:var(--t2);font-size:13px}.more svg{display:block;width:100%;height:auto;direction:ltr}.axis{stroke:var(--line)}.dot{fill:var(--s1);opacity:.28}.past{fill:var(--past);opacity:.7}.now{fill:var(--s2);stroke:var(--card);stroke-width:2}.rain{stroke:var(--s3);stroke-width:3;stroke-linecap:round}
.key{display:flex;gap:14px;flex-wrap:wrap;color:var(--t2);font-size:.85rem;margin-bottom:8px}.key i{display:inline-block;width:12px;height:12px;border-radius:3px;margin-inline-end:6px;vertical-align:-1px}
table{width:100%;border-collapse:collapse;font-size:.92rem}th,td{padding:7px 6px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}th{color:var(--t2);font-weight:500}.scroll{overflow-x:auto}
#tip{position:fixed;display:none;z-index:9;background:var(--t1);color:var(--bg);padding:6px 10px;border-radius:8px;font-size:.85rem;pointer-events:none;max-width:80vw}
@media(max-width:480px){.more svg text{font-size:21px}.ringbox{flex-direction:column;text-align:center}}
.rays{transform-origin:84px 58px;animation:spin 90s linear infinite}.flow{animation:flow 1.6s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}@keyframes flow{to{stroke-dashoffset:-28}}
.js .r{opacity:0;transform:translateY(16px);transition:opacity .6s var(--ease),transform .6s var(--ease)}.js .r.in{opacity:1;transform:none}
.js .r .grow{transform:scaleX(0);transform-origin:right;transition:transform .9s var(--ease) .15s}.js .r.in .grow{transform:none}
.js .r .rv{stroke-dashoffset:${(2 * Math.PI * 52).toFixed(1)};transition:stroke-dashoffset 1.1s var(--ease) .15s}.js .r.in .rv{stroke-dashoffset:var(--off)}
@media (prefers-reduced-motion:reduce){.rays,.flow{animation:none}.js .r,.js .r .grow,.js .r .rv{transition:opacity .2s;transform:none;stroke-dashoffset:var(--off)}}
@media (prefers-reduced-transparency:reduce){.top{background:var(--card);-webkit-backdrop-filter:none;backdrop-filter:none}}
</style>
<div class="top"><div class="bar"><b>הגג שלי</b><span class="pill ${HEAD[0]}">${esc(HEAD[1])}</span></div>
<div class="seg" role="tablist">${[["now", "עכשיו"], ["cmp", "השוואות"], ["roof", "הגג"], ["more", "פרטים"]].map(([id, label], i) => `<button role="tab" data-p="${id}" aria-selected="${i === 0}">${label}</button>`).join("")}</div></div>
<main>
<div class="panel on" id="p-now">
<section class="card hero r">${scene(v.status)}<div class="say"><h1>${HEAD[1]}</h1>${v.note ? `<p>${esc(v.note)}</p>` : ""}</div></section>
<div class="tiles r">
${tile("היום עד עכשיו", today_ ? `<span data-count="${Math.round(today_.kwh)}">${num(today_.kwh)}</span>` : "ממתין", today_ ? `קוט״ש, נכון ל-${esc(new Date(today_.at).toLocaleTimeString("he-IL", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit" }))}` : "מתעדכן כל שעה ביום")}
${tile("7 הימים האחרונים", num(a.total), `קוט״ש${homeDays >= 1 ? `, כמו ${homeDays} ימים של בית` : ""}`)}
${tile("החודש עד אתמול", num(f.done), "קוט״ש")}
${tile("צפי לסוף החודש", f.end == null ? "לא זמין" : num(f.end), f.target ? `קוט״ש, מול ${num(f.target)} אשתקד` : "קוט״ש, לפי הקצב")}
</div>
${f.pace != null ? `<section class="card r verdict"><span class="pill ${f.onTrack ? "ok" : "warn"}">${f.onTrack ? "עומד בקצב של אשתקד" : "מאחורי הקצב של אשתקד"}</span><p class="say2">${f.pace >= 0 ? `${f.pace}% מעל` : `${-f.pace}% מתחת ל`}אותם ימים בשנה שעברה. ${esc(monthRow?.why || "")}</p></section>` : ""}
<section class="card r"><h2>מה כדאי לעשות</h2>${v.advice.map(([t, x], i) => `<div class="tip"><div class="num">${i + 1}</div><div><b>${esc(t)}</b><p>${esc(x)}</p></div></div>`).join("") || `<p class="say2">אחרי הדוח הראשון יופיעו כאן המלצות.</p>`}</section>
</div>
<div class="panel" id="p-cmp">
${rows.length ? rows.map((r) => `<section class="card row r"><div class="rt1"><h3>${esc(r.title)}</h3><span class="delta ${r.pct >= 0 ? "up" : "down"}">${r.pct >= 0 ? "▲" : "▼"} ${Math.abs(r.pct)}%</span></div><div class="vals"><b>${num(r.now)}</b><span>מול ${num(r.then)} קוט״ש</span></div><p class="say2">${esc(r.why)}</p></section>`).join("") : `<section class="card"><p class="say2">ההשוואות יופיעו כשתיאסף היסטוריה.</p></section>`}
</div>
<div class="panel" id="p-roof">
<section class="card r"><h2>מה מצב הגג</h2>${ring(a.ratio)}</section>
${scanCard(s, a, days, end)}
<section class="card r"><h2>מה טוב</h2><ul>${list(v.good, "g", "✓") || "<li>עדיין אין מספיק נתונים</li>"}</ul></section>
${v.bad.length ? `<section class="card r"><h2>מה פחות טוב</h2><ul>${list(v.bad, "y", "!")}</ul></section>` : ""}
<section class="card installbox" id="ib"><button id="install">התקן בטלפון</button><p class="small" id="ihow" hidden>בתפריט של Chrome (שלוש הנקודות) בחר "הוספה למסך הבית".</p></section>
</div>
<div class="panel" id="p-more">
${a.days ? `<section class="card r"><h2>השבוע, יום אחרי יום</h2>${week.map((d) => { const [ic] = weather(d); return `<div class="day"><span>${dayName(d.day)}</span>${ICON[ic]}<div class="track"><i class="grow" style="width:${Math.round(((d.kwh || 0) / weekMax) * 100)}%"></i></div><b>${d.kwh == null ? "אין" : num(d.kwh, 1)}</b></div>`; }).join("")}</section>` : ""}
${bestMonth || heatDrop != null || v.lift != null ? `<section class="card r"><h2>מה למדנו על הגג</h2>${bestMonth ? `<p class="say2">החודש הכי חזק בשנה האחרונה היה ${bestMonth.label}, עם ${num(bestMonth.now)} קוט״ש.</p>` : ""}${heatDrop > 0 ? `<p class="say2">בימים חמים מאוד הגג מפיק בערך ${heatDrop}% פחות. זה טבעי לפאנלים.</p>` : ""}${v.lift != null ? `<p class="say2">${v.lift >= 5 ? `גשם ראשון אחרי יובש מעלה את הייצור בערך ב-${v.lift}%, כי הוא שוטף את האבק.` : "גשם כמעט לא משנה את הייצור, אז הפאנלים נקיים יחסית."}</p>` : ""}</section>` : ""}
<details class="r"><summary>כל הגרפים והטבלה</summary><div class="more">
<div><h3>ייצור יומי, 30 יום (קוט״ש)</h3>${chartBars(last30, 170, "--s1", (d) => d.kwh, (d, i) => (i % 6 === 0 ? heb(d.day) : ""), (d) => `${heb(d.day)}: ${num(d.kwh, 1)} קוט״ש`)}</div>
<div><h3>שמש באותם ימים (מג׳ול למ״ר)</h3>${chartBars(last30, 130, "--s2", (d) => d.rad, (d, i) => (i % 6 === 0 ? heb(d.day) : ""), (d) => `${heb(d.day)}: ${num(d.rad, 1)} מג׳ול${d.rain ? `, גשם ${num(d.rain, 1)} מ״מ` : ""}`)}</div>
${eff ? `<div><h3>יעילות מול השמש, חצי שנה</h3><div class="key"><span><i style="background:var(--s1)"></i>יעילות</span><span><i style="background:var(--s3)"></i>גשם</span></div>${eff}</div>` : ""}
<div><h3>חודשים מול אשתקד (קוט״ש)</h3><div class="key"><span><i style="background:var(--s1)"></i>השנה</span><span><i style="background:var(--s2)"></i>אשתקד</span></div>${monthChart(months)}</div>
${sc ? `<div><h3>ייצור מול שמש, שנה</h3><div class="key"><span><i style="background:var(--s2)"></i>השבוע</span><span><i style="background:var(--past)"></i>שאר הימים</span></div>${sc}</div>` : ""}
<div><h3>14 הימים האחרונים</h3><div class="scroll"><table><tr><th>יום</th><th>קוט״ש</th><th>שמש</th><th>חום</th><th>גשם</th><th>מצב</th></tr>${rowsTable}</table></div></div>
</div></details>
</div>
</main><div id="tip" role="status"></div>
<script${n}>
const io=new IntersectionObserver((es)=>es.forEach((e)=>{if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target)}}),{threshold:.12});document.querySelectorAll(".r").forEach((x)=>io.observe(x));
if(!matchMedia("(prefers-reduced-motion: reduce)").matches)document.querySelectorAll("[data-count]").forEach((n)=>{const to=+n.dataset.count,t0=performance.now();const f=(t)=>{const p=Math.min((t-t0)/900,1);n.textContent=Math.round(to*(1-Math.pow(1-p,3))).toLocaleString("he-IL");if(p<1)requestAnimationFrame(f)};requestAnimationFrame(f)});
const tabs=[...document.querySelectorAll("[data-p]")];tabs.forEach((b)=>b.addEventListener("click",()=>{tabs.forEach((x)=>x.setAttribute("aria-selected",x===b));document.querySelectorAll(".panel").forEach((p)=>p.classList.toggle("on",p.id==="p-"+b.dataset.p));scrollTo(0,0)}));
const ib=document.getElementById("ib"),ibtn=document.getElementById("install");let ask=null;
if(!matchMedia("(display-mode: standalone)").matches){ib.classList.add("on");addEventListener("beforeinstallprompt",(e)=>{e.preventDefault();ask=e});ibtn.addEventListener("click",async()=>{if(ask){ask.prompt();await ask.userChoice;ask=null;ib.classList.remove("on")}else document.getElementById("ihow").hidden=false});addEventListener("appinstalled",()=>ib.classList.remove("on"))}
const t=document.getElementById("tip");const show=(e)=>{const m=e.target.closest("[data-t]");if(!m){t.style.display="none";return}t.textContent=m.dataset.t;t.style.display="block";t.style.left=Math.max(8,Math.min(innerWidth-t.offsetWidth-8,e.clientX-t.offsetWidth/2))+"px";t.style.top=Math.max(8,e.clientY-44)+"px"};document.addEventListener("pointermove",show);document.addEventListener("click",show);
</script></html>`;
}
