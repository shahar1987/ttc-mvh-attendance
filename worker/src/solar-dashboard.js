// ☀️ דשבורד הגג: דף פרטי (הגישה ב-solar.js) שנבנה מ-agentReports/solar. קריאה בלבד, בלי AI ובלי קרדיטים.
import { adjusted, analyze, addDays, hardFault, ICON_V } from "./solar.js";
import { esc } from "./dashboard.js";
import { earnings, reportLinks, periodName } from "./solar-report.js";

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

const heMonth = (k) => `${["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"][+k.slice(5, 7) - 1]} ${k.slice(0, 4)}`;
const HOME_KWH_DAY = 25; // בית ישראלי רגיל, בערך. רק כדי לתת למספר תחושה
const DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const dayName = (k) => DAYS[new Date(`${k}T12:00:00Z`).getUTCDay()];
const ICON = {
  sun: '<svg viewBox="0 0 24 24" class="ic"><circle cx="12" cy="12" r="5" fill="#ffc14d"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" stroke="#ffc14d" stroke-width="2" stroke-linecap="round"/></svg>',
  part: '<svg viewBox="0 0 24 24" class="ic"><circle cx="9" cy="9" r="4.5" fill="#ffc14d"/><path d="M8 20h9a4 4 0 0 0 .6-7.9A5.5 5.5 0 0 0 7 13.5 3.3 3.3 0 0 0 8 20Z" fill="#dbe3ec"/></svg>',
  cloud: '<svg viewBox="0 0 24 24" class="ic"><path d="M7 19h10a4.5 4.5 0 0 0 .7-8.9A6 6 0 0 0 6.1 11.6 3.8 3.8 0 0 0 7 19Z" fill="#dbe3ec"/></svg>',
  rain: '<svg viewBox="0 0 24 24" class="ic"><path d="M7 15h10a4 4 0 0 0 .6-7.9A5.5 5.5 0 0 0 7 8.6 3.3 3.3 0 0 0 7 15Z" fill="#dbe3ec"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3" stroke="#6cb8ff" stroke-width="2" stroke-linecap="round"/></svg>',
};
const TAB_ICON = {
  now: '<circle cx="12" cy="12" r="4.2"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/>',
  cmp: '<path d="M5 20V11M12 20V5M19 20v-6"/>',
  roof: '<path d="M3 11.5 12 4l9 7.5M6 10v10h12V10"/>',
  more: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
};
const cloud = (x, y, s, cls) => `<g class="cloud ${cls}" transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="0" rx="30" ry="9"/><ellipse cx="-10" cy="-6" rx="13" ry="9"/><ellipse cx="9" cy="-8" rx="16" ry="11"/></g>`;
const stars = [[30, 22], [72, 48], [118, 16], [160, 40], [206, 20], [250, 44], [296, 14], [338, 36], [380, 24], [52, 78], [226, 70], [368, 74]];
// הגג על הגבעה. השמש והירח זזים על הקשת לפי השעה, בסקריפט שבתחתית הדף
const scene = (status) => `<svg id="scene" class="${status === "fault" ? "off" : ""}" viewBox="0 0 400 190" preserveAspectRatio="xMidYMax slice" role="img" aria-label="בית עם פאנלים סולאריים">
<defs><radialGradient id="glow"><stop offset="0" stop-color="#ffe9a8" stop-opacity=".85"/><stop offset=".35" stop-color="#ffd76a" stop-opacity=".32"/><stop offset="1" stop-color="#ffd76a" stop-opacity="0"/></radialGradient><linearGradient id="pv" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2d6fc4"/><stop offset="1" stop-color="#123a78"/></linearGradient></defs>
<g id="stars">${stars.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 3 ? 0.9 : 1.4}" fill="#fff"/>`).join("")}</g>
${cloud(90, 52, 0.9, "c1")}${cloud(300, 30, 0.7, "c2")}
<path class="arc" d="M40 150A160 115 0 0 1 360 150"/>
<g id="orb" transform="translate(40 150)"><circle r="58" fill="url(#glow)"/><g id="rays" stroke="#ffd76a" stroke-width="2.4" stroke-linecap="round">${Array.from({ length: 8 }, (_, i) => `<path transform="rotate(${i * 45})" d="M0-22v-6"/>`).join("")}</g><circle id="disc" r="15" fill="#ffd25e"/></g>
${cloud(190, 86, 0.6, "c3")}
<path class="far" d="M0 150 62 112l44 24 58-38 62 44 58-30 56 24 60-14v68H0Z"/>
<path class="hill" d="M0 170C80 146 170 152 240 156S340 152 400 148v42H0Z"/>
<g class="tree"><path d="M222 158c-6-14-5-32 1-42 6 10 7 28 1 42ZM374 154c-5-12-4-27 1-36 5 9 6 24 1 36Z"/></g>
<g id="home"><rect x="250" y="106" width="104" height="52" class="wall"/><path d="M236 106 264 72h76l28 34Z" class="roof"/>
<g fill="url(#pv)" stroke="#a9cdf2" stroke-width=".6">${[0, 1].flatMap((r) => [0, 1, 2, 3, 4].map((c) => `<rect x="${262 + c * 16.4 - r * 4.5}" y="${76.5 + r * 13.5}" width="${15 + r * 1.8}" height="11.5" rx=".8"/>`)).join("")}</g>
<rect class="shine" x="256" y="74" width="16" height="28" transform="skewX(-22)"/>
<rect class="win" x="264" y="118" width="22" height="18" rx="2"/><rect class="win" x="320" y="118" width="22" height="18" rx="2"/><rect x="295" y="122" width="16" height="36" rx="2" class="door"/></g>
<path class="flow" d="M302 104V112H356V140"/>
</svg>`;

const ring = (ratio) => {
  const p = ratio == null ? 0 : Math.min(ratio, 1.1) / 1.1;
  const c = 2 * Math.PI * 52;
  const word = ratio == null ? "לומד את הגג" : ratio >= 0.95 ? "מצוין" : ratio >= 0.9 ? "טוב" : ratio >= 0.8 ? "קצת נמוך" : "נמוך";
  const tone = ratio == null ? "--t2" : ratio >= 0.9 ? "--ok" : ratio >= 0.8 ? "--warn" : "--bad";
  return `<div class="ringbox"><svg viewBox="0 0 120 120" class="ring"><circle cx="60" cy="60" r="52" class="rt"/><circle cx="60" cy="60" r="52" class="rv" data-c="${c.toFixed(1)}" data-o="${(c * (1 - p)).toFixed(1)}" style="stroke:var(${tone});stroke-dasharray:${c.toFixed(1)};stroke-dashoffset:${(c * (1 - p)).toFixed(1)}" transform="rotate(-90 60 60)"/><text x="60" y="60" text-anchor="middle" class="rn">${ratio == null ? "…" : `${Math.round(ratio * 100)}%`}</text><text x="60" y="79" text-anchor="middle" class="rw">${word}</text></svg><p>כמה הגג מפיק מהשמש שהייתה, לעומת הרגיל שלו. 100% זה בדיוק הרגיל.</p></div>`;
};

// שלוש טבעות בסגנון הכושר של אפל. הטבעות רק למראה: המספרים והשמות כתובים לידן במילים
const activity = (items) => {
  const arc = (it, i) => {
    const r = 60 - i * 17;
    const c = 2 * Math.PI * r;
    const o = c * (1 - Math.min(Math.max(it.p, 0), 1));
    return `<circle cx="70" cy="70" r="${r}" class="at" style="stroke:var(${it.c})"/>${it.p > 0 ? `<circle cx="70" cy="70" r="${r}" class="av" data-c="${c.toFixed(1)}" data-o="${o.toFixed(1)}" style="stroke:url(#g${i});stroke-dasharray:${c.toFixed(1)};stroke-dashoffset:${o.toFixed(1)}" transform="rotate(-90 70 70)"/>` : ""}`;
  };
  const stop = ([a, b], i) => `<linearGradient id="g${i}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="140" y2="140"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
  return `<section class="card rings r"><svg viewBox="0 0 140 140" class="act" aria-hidden="true"><defs>${items.map((it, i) => stop(it.g, i)).join("")}</defs>${items.map(arc).join("")}</svg><dl>${items.map((it) => `<div><dt><i style="background:${it.g[0]}"></i>${esc(it.label)}</dt><dd>${it.val}<small>${esc(it.sub)}</small></dd></div>`).join("")}</dl></section>`;
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

// הלוגו: חצי שמש שעולה מעל פאנל בפרספקטיבה. אותו ציור משמש לפתיחה ולאייקון של האפליקציה
export const logoMark = () => {
  const rows = [0, 0.26, 0.58, 1];
  const pt = (u, v) => `${(100 + (u - 0.5) * (84 + 80 * v)).toFixed(1)} ${(114 + 64 * v).toFixed(1)}`;
  const cells = [0, 1, 2].flatMap((r) => [0, 1, 2, 3].map((c) => {
    const [u0, u1, v0, v1] = [c / 4 + 0.012, (c + 1) / 4 - 0.012, rows[r] + 0.018, rows[r + 1] - 0.018];
    return `<polygon class="cell" style="--d:${(2 - r) * 70 + Math.abs(c - 1.5) * 40 | 0}ms;--c:${r * 80 + 620}ms" points="${pt(u0, v0)} ${pt(u1, v0)} ${pt(u1, v1)} ${pt(u0, v1)}"/>`;
  })).join("");
  const rays = Array.from({ length: 7 }, (_, i) => `<g transform="rotate(${(i - 3) * 30} 100 110)"><path class="ray" style="--d:${Math.abs(i - 3) * 45 + 520}ms" d="M100 50V36"/></g>`).join("");
  return `<svg class="logo" viewBox="0 0 200 200" aria-hidden="true"><defs><linearGradient id="ls" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe680"/><stop offset="1" stop-color="#ff8f3a"/></linearGradient><radialGradient id="lg"><stop offset="0" stop-color="#ffc861" stop-opacity=".55"/><stop offset="1" stop-color="#ffc861" stop-opacity="0"/></radialGradient><clipPath id="lc"><rect width="200" height="110"/></clipPath></defs><circle class="lglow" cx="100" cy="110" r="96" fill="url(#lg)"/><g fill="none" stroke="#ffd25e" stroke-width="7" stroke-linecap="round">${rays}</g><g clip-path="url(#lc)"><circle id="lsun" class="lsun" cx="100" cy="110" r="44" fill="url(#ls)"/></g>${cells}</svg>`;
};

const TABS = [["now", "עכשיו"], ["cmp", "השוואות"], ["roof", "הגג"], ["more", "פרטים"]];

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
  const tile = (label, value, sub) => `<div class="card stat"><div class="sl">${label}</div><div class="sv">${value}</div><div class="ss">${sub}</div></div>`;
  const bestMonth = months.filter((m) => m.now != null && !m.part).reduce((x, m) => (!x || m.now > x.now ? m : x), null);
  const hottest = heat.at(-1);
  const heatDrop = heat.length > 1 ? Math.round((1 - hottest.v / heat[0].v) * 100) : null;
  const homeDays = Math.round(a.total / HOME_KWH_DAY);
  const HEAD = { ok: ["ok", "הגג עובד טוב", "✓"], check: ["warn", "הגג עובד, ויש משהו לבדוק", "!"], fault: ["bad", "משהו לא תקין בגג", "!"], empty: ["warn", "הנתונים בדרך", "…"] }[v.status];
  const list = (xs, cls, icon) => xs.map((t) => `<li class="${cls}"><span aria-hidden="true">${icon}</span>${esc(t)}</li>`).join("");
  const eff = efficiency(days, end);
  const sc = scatter(days, end);
  const rowsTable = span(end, 14).reverse().map((k) => {
    const d = days[k] || {};
    const r = adjusted(d);
    return `<tr><td>${heb(k)}</td><td>${num(d.kwh, 1)}</td><td>${num(d.rad, 1)}</td><td>${d.tmax == null ? "לא זמין" : `${Math.round(d.tmax)}°`}</td><td>${d.rain ? num(d.rain, 1) : "0"}</td><td>${r == null ? "יום מעונן" : a.low.includes(k) ? "חריג" : "תקין"}</td></tr>`;
  }).join("");
  const typical = median(span(end, 14).map((k) => days[k]?.kwh));
  const monthGoal = f.target ?? f.end;
  const at = today_ ? new Date(today_.at).toLocaleTimeString("he-IL", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit" }) : "";
  const circles = activity([
    { label: "היום", c: "--a1", g: ["#ff9a3d", "#ffd84d"], p: today_ && typical ? today_.kwh / typical : 0, val: today_ ? num(today_.kwh) : "ממתין", sub: typical ? `מתוך ${num(typical)} ביום רגיל` : "" },
    { label: "החודש עד אתמול", c: "--a2", g: ["#3f8cff", "#62e0ff"], p: monthGoal ? f.done / monthGoal : 0, val: num(f.done), sub: monthGoal ? `מתוך ${num(monthGoal)} ${f.target ? "אשתקד" : "לפי הקצב"}` : "קוט״ש" },
    { label: "יעילות מול השמש", c: "--a3", g: ["#2fd27f", "#b6f36a"], p: a.ratio ?? 0, val: a.ratio == null ? "לומד" : `${Math.round(a.ratio * 100)}%`, sub: a.ratio == null ? "" : "מהרגיל של הגג" },
  ]);
  const compare = (r) => {
    const top = Math.max(r.now, r.then, 1);
    const bar = (label, val, c) => `<div class="cmp"><span>${label}</span><div class="track"><i class="grow" style="width:${Math.round((val / top) * 100)}%;background:var(${c})"></i></div><b>${num(val)}</b></div>`;
    return `<section class="card row r"><div class="rt1"><h3>${esc(r.title)}</h3><span class="delta ${r.pct >= 0 ? "up" : "down"}">${r.pct >= 0 ? "▲" : "▼"} ${Math.abs(r.pct)}%</span></div>${bar("עכשיו", r.now, "--s1")}${bar("קודם", r.then, "--s4")}<p class="say2">${esc(r.why)}</p></section>`;
  };
  const cash = earnings(s, today);
  const ils = (x) => (x == null ? "—" : `₪${Number(x).toLocaleString("he-IL", { maximumFractionDigits: x >= 100 ? 0 : 2, minimumFractionDigits: x >= 100 ? 0 : 2 })}`);
  const moneyCard = a.days || today_ ? `<section class="card r"><h2>כמה הגג הכניס</h2><div class="cash">${[["היום", cash.today, "עד עכשיו"], ["החודש", cash.month, "נקי, עד אתמול"], [`שנת ${today.slice(0, 4)}`, cash.year, cash.yearChange == null ? "נקי, מינואר" : `${cash.yearChange >= 0 ? "▲" : "▼"} ${Math.abs(cash.yearChange)}% מול אשתקד`]].map(([l, val, sub]) => `<div><span>${l}</span><b>${ils(val)}</b><small>${sub}</small></div>`).join("")}</div>${cash.back ? `<div class="pay"><div class="pt"><span>החזר ההשקעה</span><b>${Math.min(100, Math.round(cash.back.share * 100))}%</b></div><div class="track"><i class="grow" style="width:${Math.min(100, Math.round(cash.back.share * 100))}%;background:linear-gradient(90deg,#2fd27f,#b6f36a)"></i></div><p class="say2">${cash.back.share >= 1 ? `המערכת כבר החזירה את עצמה, וכל שקל מעכשיו הוא רווח.` : `הגג החזיר ${ils(cash.back.earned)} מתוך ${ils(cash.back.invest)}.${cash.back.done ? ` בקצב של השנה האחרונה, ההשקעה תחזור בערך ב${heMonth(cash.back.done)}.` : ""}`}</p></div>` : ""}${cash.expected && cash.yearKwh != null ? `<p class="say2">תחזית המתקין לשנה: ${num(cash.expected)} קוט״ש. מינואר הגג ייצר ${num(cash.yearKwh)}.</p>` : ""}<p class="small">${Math.round(cash.rate * 1000) / 10} אגורות לקוט״ש בממוצע: ${Math.round((1 - cash.selfShare) * 100)}% מוזרם לרשת ב-${Math.round(cash.exportRate * 100)} אג׳, והשאר נצרך בבית וחוסך את מחיר החשמל${cash.fromBills ? `. הבית צורך ${Math.round(cash.selfShare * 100)}% מהייצור, לפי ${cash.fromBills.bills} חשבונות חשמל` : ""}${cash.fixed ? `, פחות ${ils(cash.fixed)} בחודש` : ""}.</p></section>` : "";
  const reports = `<section class="card r"><h2>דוחות להורדה</h2>${reportLinks(today).map((p) => `<div class="rep"><span>${periodName(p)}</span><a href="/solar/report?p=${p}">PDF</a><a href="/solar/report.xlsx?p=${p}" download>Excel</a></div>`).join("")}<p class="small">כל דוח משווה לאותה תקופה בשנה שעברה, בקוט״ש ובשקלים.</p></section>`;
  const panels = [
    `<header class="hero" id="hero"><div class="eye">היום עד עכשיו</div>${today_ ? `<div class="big" data-count="${Math.round(today_.kwh)}">${num(today_.kwh)}</div><div class="unit">קוט״ש, נכון ל-${esc(at)}${cash.today != null ? ` · ${ils(cash.today)}` : ""}</div>` : s.todayError ? `<div class="big wait">—</div><div class="unit">SolarEdge לא ענה, מנסים שוב בשעה הבאה</div>` : `<div class="big wait">ממתין</div><div class="unit">מתעדכן כל שעה, מ-7 בבוקר</div>`}<h1 class="${HEAD[0]}"><i aria-hidden="true">${HEAD[2]}</i>${HEAD[1]}</h1>${v.note ? `<p>${esc(v.note)}</p>` : ""}</header>
<div class="stage"></div>
${circles}
${moneyCard}
${f.pace != null ? `<section class="card r verdict"><span class="pill ${f.onTrack ? "ok" : "warn"}">${f.onTrack ? "עומד בקצב של אשתקד" : "מאחורי הקצב של אשתקד"}</span><p class="say2">${f.pace >= 0 ? `${f.pace}% מעל ` : `${-f.pace}% מתחת ל`}אותם ימים בשנה שעברה. ${esc(monthRow?.why || "")}</p></section>` : ""}
<div class="tiles r">${tile("7 הימים האחרונים", num(a.total), `קוט״ש${homeDays >= 1 ? `, כמו ${homeDays} ימים של בית` : ""}`)}${tile("צפי לסוף החודש", f.end == null ? "לא זמין" : num(f.end), f.target ? `קוט״ש, מול ${num(f.target)} אשתקד` : "קוט״ש, לפי הקצב")}</div>
<section class="card r"><h2>מה כדאי לעשות</h2>${v.advice.map(([t, x], i) => `<div class="tip"><div class="num">${i + 1}</div><div><b>${esc(t)}</b><p>${esc(x)}</p></div></div>`).join("") || `<p class="say2">אחרי הדוח הראשון יופיעו כאן המלצות.</p>`}</section>`,

    `<h2 class="lt">השוואות</h2>${rows.length ? rows.map(compare).join("") : `<section class="card r"><p class="say2">ההשוואות יופיעו כשתיאסף היסטוריה.</p></section>`}`,

    `<h2 class="lt">מצב הגג</h2><section class="card r">${ring(a.ratio)}</section>
${scanCard(s, a, days, end)}
<section class="card r"><h2>מה טוב</h2><ul>${list(v.good, "g", "✓") || "<li>עדיין אין מספיק נתונים</li>"}</ul></section>
${v.bad.length ? `<section class="card r"><h2>מה פחות טוב</h2><ul>${list(v.bad, "y", "!")}</ul></section>` : ""}
<section class="card installbox" id="ib"><button id="install">התקן בטלפון</button><p class="small" id="ihow" hidden>בתפריט של Chrome (שלוש הנקודות) בחר "הוספה למסך הבית".</p></section>`,

    `<h2 class="lt">פרטים</h2>${reports}${a.days ? `<section class="card r"><h2>השבוע, יום אחרי יום</h2>${week.map((d) => { const [ic] = weather(d); return `<div class="day"><span>${dayName(d.day)}</span>${ICON[ic]}<div class="track"><i class="grow" style="width:${Math.round(((d.kwh || 0) / weekMax) * 100)}%"></i></div><b>${d.kwh == null ? "אין" : num(d.kwh, 1)}</b></div>`; }).join("")}</section>` : ""}
${bestMonth || heatDrop != null || v.lift != null ? `<section class="card r"><h2>מה למדנו על הגג</h2>${bestMonth ? `<p class="say2">החודש הכי חזק בשנה האחרונה היה ${bestMonth.label}, עם ${num(bestMonth.now)} קוט״ש.</p>` : ""}${heatDrop > 0 ? `<p class="say2">בימים חמים מאוד הגג מפיק בערך ${heatDrop}% פחות. זה טבעי לפאנלים.</p>` : ""}${v.lift != null ? `<p class="say2">${v.lift >= 5 ? `גשם ראשון אחרי יובש מעלה את הייצור בערך ב-${v.lift}%, כי הוא שוטף את האבק.` : "גשם כמעט לא משנה את הייצור, אז הפאנלים נקיים יחסית."}</p>` : ""}</section>` : ""}
<details class="card flat r"><summary>כל הגרפים והטבלה</summary><div class="more">
<div><h3>ייצור יומי, 30 יום (קוט״ש)</h3>${chartBars(last30, 170, "--s1", (d) => d.kwh, (d, i) => (i % 6 === 0 ? heb(d.day) : ""), (d) => `${heb(d.day)}: ${num(d.kwh, 1)} קוט״ש`)}</div>
<div><h3>שמש באותם ימים (מג׳ול למ״ר)</h3>${chartBars(last30, 130, "--s2", (d) => d.rad, (d, i) => (i % 6 === 0 ? heb(d.day) : ""), (d) => `${heb(d.day)}: ${num(d.rad, 1)} מג׳ול${d.rain ? `, גשם ${num(d.rain, 1)} מ״מ` : ""}`)}</div>
${eff ? `<div><h3>יעילות מול השמש, חצי שנה</h3><div class="key"><span><i style="background:var(--s1)"></i>יעילות</span><span><i style="background:var(--s3)"></i>גשם</span></div>${eff}</div>` : ""}
<div><h3>חודשים מול אשתקד (קוט״ש)</h3><div class="key"><span><i style="background:var(--s1)"></i>השנה</span><span><i style="background:var(--s2)"></i>אשתקד</span></div>${monthChart(months)}</div>
${sc ? `<div><h3>ייצור מול שמש, שנה</h3><div class="key"><span><i style="background:var(--s2)"></i>השבוע</span><span><i style="background:var(--past)"></i>שאר הימים</span></div>${sc}</div>` : ""}
<div><h3>14 הימים האחרונים</h3><div class="scroll"><table><tr><th>יום</th><th>קוט״ש</th><th>שמש</th><th>חום</th><th>גשם</th><th>מצב</th></tr>${rowsTable}</table></div></div>
</div></details>`,
  ];
  const titles = [today_ ? `${num(today_.kwh)} קוט״ש היום` : HEAD[1], "השוואות", "מצב הגג", "פרטים"];
  return `<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex"><title>הגג שלי</title>
<link rel="manifest" href="/solar/manifest.webmanifest?v=${ICON_V}"><link rel="icon" href="/solar/icon-192.png?v=${ICON_V}"><link rel="apple-touch-icon" href="/solar/icon-192.png?v=${ICON_V}"><meta name="theme-color" id="tc" content="#0f5fbf"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<script${n}>const c=document.documentElement.classList;c.add("js");try{if(sessionStorage.seen)c.add("seen");sessionStorage.seen=1}catch(e){}</script>
<style>
:root{color-scheme:dark;--bg:#0d1b33;--card:#1a2740;--line:rgba(255,255,255,.16);--t1:#fff;--t2:rgba(255,255,255,.74);--s1:#6cb8ff;--s2:#ffaa5a;--s3:#55dcaa;--s4:rgba(255,255,255,.42);--past:rgba(255,255,255,.34);--ok:#62e08e;--warn:#ffc760;--bad:#ff9b92;--a1:rgba(255,170,70,.24);--a2:rgba(90,170,255,.24);--a3:rgba(80,220,130,.24);--g:#0a1a36;--st:250px}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html{background:#071226}
body{margin:0;color:var(--t1);font:100%/1.45 -apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,"Segoe UI",Roboto,Arial,sans-serif;-webkit-font-smoothing:antialiased}
#sky{position:fixed;inset:0;background:linear-gradient(#0f5fbf,#2a80d8 38%,#6fb6ee 62%)}
#world{position:fixed;inset:0 -48px;will-change:transform}
#world::after{content:"";position:absolute;left:0;right:0;bottom:-40px;top:calc(var(--st) + min(47vw,260px) - 2px);background:var(--g)}
#scene{position:absolute;left:0;top:var(--st);width:100%;height:min(47vw,260px);display:block;direction:ltr}
#scene.off{filter:saturate(.3) brightness(.85)}
#scrim{position:fixed;inset:0;background:#050c1c;opacity:0;pointer-events:none}
.arc{fill:none;stroke:#fff;stroke-opacity:.34;stroke-width:1.2;stroke-dasharray:2 6;stroke-linecap:round}
.far{fill:#0b2147;fill-opacity:.5}.hill,.tree{fill:var(--g)}
.wall{fill:#e8eef6}.roof{fill:#37475f}.door{fill:#51627c}.win{fill:#9fc6e6;transition:fill 1s}
.night .wall{fill:#7b8aa3}.night .roof{fill:#232f44}.night .win{fill:#ffd27a}
.shine{fill:#fff;fill-opacity:.32;animation:shine 7s ease-in-out infinite}
.flow{fill:none;stroke:#ffd25e;stroke-width:2;stroke-linecap:round;stroke-dasharray:1 9;animation:flow 1.5s linear infinite}
.night .flow,.night .shine,.off .flow,.off .shine,.off #rays{display:none}
#rays{transform-origin:0 0;animation:spin 70s linear infinite}
.cloud{fill:#fff;fill-opacity:.62}.night .cloud{fill-opacity:.1}
.c1{animation:drift 110s linear infinite}.c2{animation:drift 150s linear infinite reverse}.c3{animation:drift 190s linear infinite}
#stars{opacity:0;transition:opacity 1.5s}.night #stars{opacity:1}
@keyframes spin{to{rotate:360deg}}@keyframes flow{to{stroke-dashoffset:-20}}@keyframes shine{0%,62%{translate:-30px 0;opacity:0}70%{opacity:1}100%{translate:150px 0;opacity:0}}@keyframes drift{from{translate:-24px 0}to{translate:24px 0}}
.quiet .shine,.quiet .flow,.quiet .cloud,.quiet #rays{animation-play-state:paused}
#pager{position:relative}
.panel{padding:calc(env(safe-area-inset-top) + 64px) 16px 28px}
.inner{max-width:560px;margin:auto;display:grid;gap:12px;min-width:0}
.panel:first-child{padding-top:env(safe-area-inset-top)}
.hero{height:var(--st);display:flex;flex-direction:column;align-items:center;justify-content:flex-end;text-align:center;padding:calc(env(safe-area-inset-top) + 10px) 8px 8px;transform-origin:50% 40%;text-shadow:0 1px 14px rgba(0,30,80,.42)}
.eye{font-size:.95rem;font-weight:600;letter-spacing:.01em}
.big{font-size:clamp(84px,27vw,118px);font-weight:200;line-height:1;letter-spacing:-.04em;font-variant-numeric:tabular-nums;direction:ltr}.big.wait{font-size:56px;line-height:1.4;letter-spacing:0;direction:rtl}
.unit{font-size:.95rem;margin-top:2px}
.hero h1{display:flex;align-items:center;gap:6px;font-size:1.05rem;font-weight:600;margin:10px 0 0;line-height:1.3}
.hero h1 i{font-style:normal;width:20px;height:20px;border-radius:50%;display:grid;place-items:center;font-size:.72rem;font-weight:800;color:#06233f;background:var(--ok);text-shadow:none}.hero h1.warn i{background:var(--warn)}.hero h1.bad i{background:var(--bad)}
.hero p{margin:2px 0 0;font-size:.9rem}
.stage{height:calc(min(47vw,260px) - 28px)}
.card{background:rgba(9,18,38,.46);-webkit-backdrop-filter:blur(26px) saturate(170%);backdrop-filter:blur(26px) saturate(170%);border-radius:24px;padding:16px;min-width:0;box-shadow:inset 0 .5px 0 rgba(255,255,255,.26),inset 0 0 0 .5px rgba(255,255,255,.08),0 10px 28px rgba(0,8,24,.22)}
.lt{font-size:2.05rem;font-weight:700;line-height:1.15;margin:0 4px 6px}
h2{font-size:1.12rem;line-height:1.25;margin:0 0 10px;font-weight:700}h3{font-size:.98rem;margin:0 0 8px;font-weight:600}
.rings{display:flex;align-items:center;gap:16px}.act{width:132px;flex:none;display:block}
.at,.av{fill:none;stroke-width:13}.av{stroke-linecap:round}
dl{margin:0;flex:1;display:grid;gap:9px;min-width:0}dl div{min-width:0}dt{font-size:.82rem;color:var(--t2);display:flex;align-items:center;gap:6px}dt i{width:9px;height:9px;border-radius:50%;flex:none}dd{margin:0;font-size:1.2rem;font-weight:700;line-height:1.25;font-variant-numeric:tabular-nums}dd small{font-size:.76rem;font-weight:400;color:var(--t2);margin-inline-start:6px}
.tiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.stat{padding:14px}.sl{color:var(--t2);font-size:.84rem}.sv{font-size:1.8rem;font-weight:600;line-height:1.2;letter-spacing:-.02em;font-variant-numeric:tabular-nums}.ss{color:var(--t2);font-size:.78rem}
.verdict{display:grid;gap:3px;padding:13px 16px}.pill{font-size:.92rem;font-weight:700}.pill.ok{color:var(--ok)}.pill.warn{color:var(--warn)}.pill.bad{color:var(--bad)}
.row{display:grid;gap:6px;padding:13px 16px}.rt1{display:flex;justify-content:space-between;align-items:center;gap:8px}.rt1 h3{margin:0}.delta{font-weight:700;font-size:1rem;white-space:nowrap}.delta.up{color:var(--ok)}.delta.down{color:var(--warn)}
.cmp{display:grid;grid-template-columns:42px 1fr 54px;gap:8px;align-items:center;font-size:.84rem}.cmp span{color:var(--t2)}.cmp b{font-weight:600;font-variant-numeric:tabular-nums;text-align:end}.cmp .track{height:8px}
.say2{margin:0;color:var(--t2);font-size:.93rem}.say2+.say2{margin-top:8px}
.ringbox{display:flex;align-items:center;gap:18px}.ringbox p{margin:0;color:var(--t2)}.ring{width:132px;flex:none}.rt{fill:none;stroke:var(--line);stroke-width:11}.rv{fill:none;stroke-width:11;stroke-linecap:round}.rn{fill:var(--t1);font-size:26px;font-weight:600}.rw{fill:var(--t2);font-size:12px}
ul{list-style:none;margin:0;padding:0;display:grid;gap:10px}li{display:flex;gap:10px}li span{font-weight:700;flex:none}.g span{color:var(--ok)}.y span{color:var(--warn)}
.tip{display:flex;gap:12px;padding:11px 0;border-top:.5px solid var(--line)}.tip:first-of-type{border-top:0;padding-top:0}.tip:last-child{padding-bottom:0}.tip b{display:block}.tip p{margin:0;color:var(--t2);font-size:.93rem}.num{width:26px;height:26px;flex:none;border-radius:50%;background:rgba(255,255,255,.16);display:grid;place-items:center;font-weight:700;font-size:.82rem}
.day{display:grid;grid-template-columns:58px 24px 1fr 48px;gap:10px;align-items:center;padding:6px 0}.day b{text-align:end;font-weight:600;font-variant-numeric:tabular-nums}.ic{width:24px;height:24px;display:block}
.track{height:10px;border-radius:6px;background:rgba(255,255,255,.14);overflow:hidden}.track i{display:block;height:100%;border-radius:6px;background:var(--s1)}
.small{margin:12px 0 0;color:var(--t2);font-size:.82rem}
.cash{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.cash div{display:grid;gap:1px;min-width:0}.cash span{font-size:.82rem;color:var(--t2)}.cash b{font-size:1.45rem;font-weight:700;letter-spacing:-.02em;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cash small{font-size:.74rem;color:var(--t2)}
.pay{margin-top:14px;display:grid;gap:6px}.pt{display:flex;justify-content:space-between;align-items:baseline}.pt span{font-weight:600}.pt b{font-size:1.2rem;color:var(--ok)}.pay .track{height:12px}
.rep{display:flex;align-items:center;gap:8px;padding:8px 0;border-top:.5px solid var(--line)}.rep:first-of-type{border-top:0}.rep span{flex:1;font-weight:600}.rep a{color:#fff;text-decoration:none;font-size:.85rem;font-weight:600;padding:7px 14px;border-radius:999px;background:rgba(255,255,255,.14);box-shadow:inset 0 .5px 0 rgba(255,255,255,.3);transition:transform .1s ease-out}.rep a:active{transform:scale(.94)}
#install{font:inherit;font-weight:600;border:0;border-radius:14px;padding:13px 18px;background:#fff;color:#0d2a55;width:100%;transition:transform .1s ease-out}#install:active{transform:scale(.97)}.installbox{display:none}.installbox.on{display:block}
.flat{padding:0}summary{cursor:pointer;list-style:none;padding:16px;font-weight:600;display:flex;justify-content:space-between;transition:transform .1s ease-out}summary:active{transform:scale(.98)}summary::-webkit-details-marker{display:none}summary::after{content:"＋";color:var(--t2)}details[open] summary::after{content:"－"}
.more{padding:0 16px 16px;display:grid;gap:22px;animation:open .4s cubic-bezier(.2,.9,.25,1)}@keyframes open{from{opacity:0;transform:translateY(-8px)}}
svg text{fill:var(--t2);font-size:13px}.more svg{display:block;width:100%;height:auto;direction:ltr}.axis{stroke:var(--line)}.dot{fill:var(--s1);opacity:.32}.past{fill:var(--past);opacity:.7}.now{fill:var(--s2);stroke:var(--card);stroke-width:2}.rain{stroke:var(--s3);stroke-width:3;stroke-linecap:round}
.key{display:flex;gap:14px;flex-wrap:wrap;color:var(--t2);font-size:.85rem;margin-bottom:8px}.key i{display:inline-block;width:12px;height:12px;border-radius:3px;margin-inline-end:6px;vertical-align:-1px}
table{width:100%;border-collapse:collapse;font-size:.86rem}th,td{padding:7px 4px;border-bottom:.5px solid var(--line);text-align:right;white-space:nowrap}th{color:var(--t2);font-weight:500}.scroll{overflow-x:auto}
#tip{position:fixed;display:none;z-index:9;background:#fff;color:#0d1b33;padding:6px 10px;border-radius:10px;font-size:.85rem;pointer-events:none;max-width:80vw}
#tabs,#mini,#fade,#splash{display:none}
.js #splash{display:grid;position:fixed;inset:0;z-index:20;place-content:center;justify-items:center;gap:6px;background:radial-gradient(circle at 50% 42%,#15397a,#071226 72%);-webkit-mask-image:radial-gradient(circle at var(--cx,50%) var(--cy,44%),transparent calc(var(--r,0px) - 70px),#000 var(--r,0px));mask-image:radial-gradient(circle at var(--cx,50%) var(--cy,44%),transparent calc(var(--r,0px) - 70px),#000 var(--r,0px))}.js.seen #splash{display:none}
.logo{width:min(52vw,210px);display:block;overflow:visible;transition:transform .7s cubic-bezier(.2,.9,.25,1)}#splash.out .logo{transform:scale(1.22)}#splash.out{pointer-events:none}
#splash b{font-size:1.5rem;font-weight:600;color:#fff;animation:word .7s cubic-bezier(.2,.9,.25,1) .85s both}
.cell{fill:#17427f;stroke:#7fb4ec;stroke-width:.8;stroke-linejoin:round;transform-box:fill-box;transform-origin:center;animation:cell .5s cubic-bezier(.2,1.25,.4,1) var(--d) both,charge .7s ease-out var(--c) both}
.lsun{animation:rise .85s cubic-bezier(.2,1.12,.35,1) .3s both}.lglow{transform-origin:100px 110px;animation:glow 1s ease-out .45s both}.ray{animation:ray .5s cubic-bezier(.2,1.3,.4,1) var(--d) both}
@keyframes cell{from{opacity:0;transform:translateY(16px) scale(.72)}}@keyframes charge{35%{fill:#ffc861;stroke:#fff3c9}}@keyframes rise{from{transform:translateY(62px)}}@keyframes glow{from{opacity:0;transform:scale(.5)}}@keyframes ray{from{opacity:0;transform:translateY(16px)}}@keyframes word{from{opacity:0;transform:translateY(10px);letter-spacing:.12em}}
@media(max-width:480px){.more svg text{font-size:21px}}
.js body{position:fixed;inset:0;overflow:hidden;overscroll-behavior:none}
.js #pager{position:fixed;inset:0;overflow:hidden}
.js #track{position:absolute;inset:0;will-change:transform}
.js .panel{position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior-y:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;padding-bottom:calc(env(safe-area-inset-bottom) + 104px);scrollbar-width:none}.js .panel::-webkit-scrollbar{display:none}
.js #fade{display:block;position:fixed;left:0;right:0;bottom:0;height:130px;background:linear-gradient(transparent,rgba(4,10,24,.6));pointer-events:none}
.js #mini{display:grid;place-items:end center;position:fixed;top:0;left:0;right:0;height:calc(env(safe-area-inset-top) + 48px);padding-bottom:12px;font-weight:600;font-size:1rem;opacity:0;pointer-events:none;background:rgba(9,18,38,.5);-webkit-backdrop-filter:blur(24px) saturate(170%);backdrop-filter:blur(24px) saturate(170%);box-shadow:inset 0 -.5px 0 rgba(255,255,255,.14)}
.js #tabs{display:block;position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom) + 12px);transform:translateX(-50%);width:min(calc(100vw - 32px),420px);height:64px;padding:5px;border-radius:32px;background:rgba(14,26,52,.58);-webkit-backdrop-filter:blur(30px) saturate(190%);backdrop-filter:blur(30px) saturate(190%);box-shadow:inset 0 .5px 0 rgba(255,255,255,.34),inset 0 0 0 .5px rgba(255,255,255,.1),0 14px 34px rgba(0,6,20,.42);touch-action:none;user-select:none;-webkit-user-select:none}
#lens{position:absolute;top:5px;bottom:5px;right:5px;width:calc((100% - 10px)/4);border-radius:27px;background:rgba(255,255,255,.17);box-shadow:inset 0 .5px 0 rgba(255,255,255,.42);will-change:transform;transition:background .12s}#lens.press{background:rgba(255,255,255,.28)}
#tl{position:relative;display:grid;grid-template-columns:repeat(4,1fr);height:100%}
#tl button{font:inherit;font-size:.72rem;font-weight:600;color:#fff;background:none;border:0;padding:0;display:grid;justify-items:center;align-content:center;gap:1px;cursor:pointer;touch-action:none;border-radius:27px}#tl svg{width:23px;height:23px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round;display:block}
button:focus-visible,summary:focus-visible{outline:2px solid #fff;outline-offset:-3px}
.js .r{opacity:0;transform:translateY(22px) scale(.975);transition:opacity .55s cubic-bezier(.2,.9,.25,1),transform .7s cubic-bezier(.2,.9,.25,1)}.js .r.in{opacity:1;transform:none}
.js .r .grow{transform:scaleX(0);transform-origin:right;transition:transform .9s cubic-bezier(.2,.9,.25,1) .12s}.js .r.in .grow{transform:none}
.js .hero>*{opacity:0;transform:translateY(14px);transition:opacity .7s,transform .9s cubic-bezier(.2,.9,.25,1)}.js.ready .hero>*{opacity:1;transform:none}.hero>:nth-child(2){transition-delay:.06s}.hero>:nth-child(3){transition-delay:.12s}.hero>:nth-child(4){transition-delay:.2s}.hero>:nth-child(5){transition-delay:.26s}
@media (prefers-reduced-motion:reduce){.js #splash{display:none}.shine,.flow,#rays,.cloud{animation:none}.js .r,.js .r .grow,.js .hero>*{transition:opacity .2s;transform:none}.more{animation:none}}
@media (prefers-reduced-transparency:reduce){.card,.js #tabs,.js #mini{background:#15233f;-webkit-backdrop-filter:none;backdrop-filter:none}}
@media (prefers-contrast:more){.card,.js #tabs,.js #mini{background:#0a1428;-webkit-backdrop-filter:none;backdrop-filter:none;box-shadow:inset 0 0 0 1px #fff}}
</style>
<div id="splash">${logoMark()}<b>הגג שלי</b></div><div id="sky"></div><div id="world">${scene(v.status)}</div><div id="scrim"></div>
<main id="pager"><div id="track">${panels.map((p, i) => `<div class="panel" id="p-${TABS[i][0]}" data-title="${esc(titles[i])}" style="transform:translateX(${-i * 100}%)"><div class="inner">${p}</div></div>`).join("")}</div></main>
<div id="fade"></div><div id="mini" aria-hidden="true"></div>
<nav id="tabs"><div id="lens"></div><div id="tl" role="tablist">${TABS.map(([id, label], i) => `<button role="tab" data-p="${id}" aria-selected="${i === 0}"><svg viewBox="0 0 24 24" aria-hidden="true">${TAB_ICON[id]}</svg>${label}</button>`).join("")}</div></nav>
<div id="tip" role="status"></div>
<script${n}>
const $=(q)=>document.querySelector(q),$$=(q)=>[...document.querySelectorAll(q)],root=document.documentElement;
const still=matchMedia("(prefers-reduced-motion: reduce)").matches;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// קפיצים: כל אנימציה מתחילה מהערך ומהמהירות הנוכחיים, ולכן אפשר לתפוס אותה באמצע
const live=new Set();let clock=0;
const tick=(t)=>{const dt=Math.min((t-clock)/1e3,.05);clock=t;live.forEach((s)=>{for(let left=dt;left>0;left-=1/240){const h=Math.min(left,1/240),w=2*Math.PI/s.r;s.v+=(-w*w*(s.x-s.to)-2*s.z*w*s.v)*h;s.x+=s.v*h}if(Math.abs(s.x-s.to)<s.e&&Math.abs(s.v)<s.e*10){s.x=s.to;s.v=0;live.delete(s);s.done&&s.done()}s.f(s.x,s.v)});if(live.size)requestAnimationFrame(tick)};
const spring=(x,f,r=.4,z=1,e=.001)=>({x,v:0,to:x,f,r,z,e,go(to,v=0,r2,z2){this.to=to;this.v=v;if(r2)this.r=r2;if(z2)this.z=z2;if(still){this.x=to;this.v=0;live.delete(this);f(to,0);this.done&&this.done();return}if(!live.size){clock=performance.now();requestAnimationFrame(tick)}live.add(this)},stop(){live.delete(this);this.v=0}});
const rubber=(o,d)=>(o*d*.55)/(d+.55*Math.abs(o));

// השמיים לפי השעה: מיקום השמש מחושב מקו הרוחב והאורך של האזור
const SKY={night:[[9,14,36],[22,32,72],[44,52,100]],low:[[36,48,110],[186,92,122],[255,178,110]],day:[[15,95,191],[42,128,216],[111,182,238]]};
const mix=(a,b,t)=>a.map((c,i)=>c.map((v,j)=>Math.round(v+(b[i][j]-v)*t)));
const css=(c)=>"rgb("+c.join(",")+")";
const scene=$("#scene"),orb=$("#orb"),disc=$("#disc");
const place=(t)=>{const p=Math.PI*t;orb.setAttribute("transform","translate("+(200-160*Math.cos(p)).toFixed(1)+" "+(150-115*Math.sin(p)).toFixed(1)+")")};
const sun=spring(0,place,1.5,1,.0005);
const sky=()=>{const now=Date.now(),d=new Date(now),day=Math.floor((now-Date.UTC(d.getUTCFullYear(),0,0))/864e5),B=2*Math.PI*(day-81)/364,eot=9.87*Math.sin(2*B)-7.53*Math.cos(B)-1.5*Math.sin(B),decl=-.4091*Math.cos(2*Math.PI*(day+10)/365),half=Math.acos(-Math.tan(.5794)*Math.tan(decl))*720/Math.PI,noon=720-35.65*4-eot,rise=noon-half,set=noon+half,m=now%864e5/6e4,isDay=m>=rise&&m<=set,t=isDay?(m-rise)/(set-rise):((m<rise?m+1440:m)-set)/(rise+1440-set),a=Math.sin(Math.PI*t)*(isDay?1:-1);
const c=a<0?mix(SKY.low,SKY.night,clamp(-a/.3,0,1)):mix(SKY.low,SKY.day,clamp(a/.4,0,1));
$("#sky").style.background="linear-gradient("+css(c[0])+","+css(c[1])+" 34%,"+css(c[2])+" 60%)";
root.style.setProperty("--g",css(mix([c[0].map((v)=>v*.42)],[[10,26,54]],.45)[0]));
$("#tc").content=css(c[0]);scene.classList.toggle("night",!isDay);$("#rays").style.display=isDay?"":"none";disc.setAttribute("fill",isDay?"#ffd25e":"#e8edf7");disc.setAttribute("r",isDay?15:12);orb.firstChild.setAttribute("opacity",isDay?1:.3);sun.go(t)};

const panels=$$(".panel"),track=$("#track"),lens=$("#lens"),tabs=$$("[data-p]"),hero=$("#hero"),mini=$("#mini"),scrim=$("#scrim"),world=$("#world"),last=panels.length-1;
let W=innerWidth,iw=1,cur=0;
const scroll=(x)=>{const px=panels[Math.round(clamp(x,0,last))].scrollTop,p=clamp(panels[0].scrollTop/200,0,1),away=clamp(x,0,1);
hero.style.opacity=clamp(1-p*1.25,0,1);hero.style.transform="translateY("+panels[0].scrollTop*.32+"px) scale("+(1-.12*p)+")";
world.style.transform="translate3d("+(-x*14)+"px,"+(-panels[0].scrollTop*.22)+"px,0)";
scrim.style.opacity=Math.max(away*.42,p*.42);
root.classList.toggle("quiet",away>.5||p>.5);
mini.style.opacity=cur===0?clamp((p-.72)*5,0,1):clamp((px-24)/24,0,1)};
const paint=(x,v)=>{track.style.transform="translate3d("+x*W+"px,0,0)";const s=Math.min(Math.abs(v)*.05,.16);lens.style.transform="translate3d("+(-x*iw)+"px,0,0) scale("+(1+s)+","+(1-s*.6)+")";tabs.forEach((b,i)=>{b.style.opacity=.68+.32*(1-Math.min(Math.abs(x-i),1))});scroll(x)};
const pg=spring(0,paint,.38,1,.0008);
const select=()=>{tabs.forEach((b,i)=>b.setAttribute("aria-selected",i===cur));panels.forEach((p,i)=>{p.inert=i!==cur});mini.textContent=panels[cur].dataset.title;scroll(pg.x)};
const settle=(to,v,z)=>{if(to!==cur){cur=to;select();navigator.vibrate&&navigator.vibrate(8)}pg.go(to,v||0,.38,z||1)};
const size=()=>{W=innerWidth;iw=(lens.parentNode.offsetWidth-10)/(last+1);root.style.setProperty("--st",hero.offsetHeight+"px");paint(pg.x,0)};
addEventListener("resize",size);panels.forEach((p)=>p.addEventListener("scroll",()=>scroll(pg.x),{passive:true}));

// החלקה בין עמודים: עוקב אחרי האצבע 1:1, ובשחרור ממשיך באותה מהירות אל העמוד שאליו התנופה מובילה
const pager=$("#pager");let g=null;
pager.addEventListener("pointerdown",(e)=>{if(e.pointerType==="mouse"||e.target.closest(".scroll"))return;const moving=live.has(pg);g={id:e.pointerId,x0:e.clientX,y0:e.clientY,st:pg.x,on:moving,h:[]};if(moving){pg.stop();pager.setPointerCapture(e.pointerId)}});
pager.addEventListener("pointermove",(e)=>{if(!g||e.pointerId!==g.id)return;if(!g.on){const dx=e.clientX-g.x0,dy=e.clientY-g.y0;if(Math.hypot(dx,dy)<10)return;if(Math.abs(dy)>Math.abs(dx)){g=null;return}g.on=true;g.x0=e.clientX;g.st=pg.x;pager.setPointerCapture(e.pointerId);return}
let x=g.st+(e.clientX-g.x0)/W;if(x<0)x=-rubber(-x*W,W)/W;else if(x>last)x=last+rubber((x-last)*W,W)/W;pg.x=x;pg.v=0;paint(x,0);g.h.push([e.timeStamp,x]);if(g.h.length>6)g.h.shift()});
const release=(e)=>{if(!g||e.pointerId!==g.id)return;const u=g;g=null;if(!u.on)return;const h=u.h.filter((p)=>e.timeStamp-p[0]<120);const v=h.length>1?(h[h.length-1][1]-h[0][1])/(h[h.length-1][0]-h[0][0])*1e3:0;
const end=pg.x+v/1e3*499;settle(clamp(Math.round(clamp(end,cur-1,cur+1)),0,last),v,Math.abs(v)>.6?.84:1)};
pager.addEventListener("pointerup",release);pager.addEventListener("pointercancel",release);

// סרגל הלשוניות: לחיצה קופצת, וגרירה מזיזה את העדשה עם האצבע
const bar=$("#tabs");let b=null;
const pick=(cx)=>{const r=lens.parentNode.getBoundingClientRect();return clamp((r.right-5-cx)/iw-.5,0,last)};
bar.addEventListener("pointerdown",(e)=>{bar.setPointerCapture(e.pointerId);b={x0:e.clientX,on:false};lens.classList.add("press")});
bar.addEventListener("pointermove",(e)=>{if(!b)return;if(!b.on&&Math.abs(e.clientX-b.x0)<6)return;b.on=true;pg.stop();pg.x=pick(e.clientX);paint(pg.x,0)});
const lift=(e)=>{if(!b)return;const on=b.on;b=null;lens.classList.remove("press");if(e.type==="pointerup"||on)settle(Math.round(pick(e.clientX)),0,on?.84:1)};
bar.addEventListener("pointerup",lift);bar.addEventListener("pointercancel",lift);
tabs.forEach((t,i)=>t.addEventListener("click",(e)=>{if(!e.detail)settle(i)}));

// כניסת הכרטיסים והטבעות, כשהם נכנסים למסך
$$("[data-o]").forEach((c)=>{if(!still)c.style.strokeDashoffset=c.dataset.c});
const fill=(card)=>card.querySelectorAll("[data-o]").forEach((c,i)=>{const sp=spring(+c.dataset.c,(x)=>{c.style.strokeDashoffset=x},.75,1,.05);setTimeout(()=>sp.go(+c.dataset.o),120+i*130)});
const io=new IntersectionObserver((es)=>es.filter((e)=>e.isIntersecting).forEach((e,i)=>{e.target.style.transitionDelay=i*55+"ms";e.target.classList.add("in");fill(e.target);io.unobserve(e.target)}),{threshold:.06});
let begun=false;const start=()=>{if(begun)return;begun=true;$$(".r").forEach((x)=>io.observe(x));$$("[data-count]").forEach((c)=>{const to=+c.dataset.count;spring(0,(x)=>{c.textContent=Math.round(x).toLocaleString("he-IL")},.9,1,.3).go(to)});sky();setInterval(sky,6e4);requestAnimationFrame(()=>root.classList.add("ready"))};
size();select();
// הפתיח: הלוגו נבנה, ואז השמש פותחת חור שדרכו האפליקציה נחשפת. נגיעה מדלגת
const intro=$("#splash");
if(getComputedStyle(intro).display==="none"){intro.remove();start()}else{
const iris=spring(0,(r)=>intro.style.setProperty("--r",r+"px"),.6,1,2);iris.done=()=>intro.remove();
const open=()=>{clearTimeout(wait);if(begun)return;const s=$("#lsun").getBoundingClientRect(),x=s.left+s.width/2,y=s.top+s.height/2;intro.style.setProperty("--cx",x+"px");intro.style.setProperty("--cy",y+"px");intro.classList.add("out");start();iris.go(Math.hypot(Math.max(x,W-x),Math.max(y,innerHeight-y))+90)};
const wait=setTimeout(open,1650);intro.addEventListener("pointerdown",open)}
// באפליקציה מותקנת אין משיכה לרענון, אז חוזרים לנתונים טריים כשפותחים אחרי הפסקה
let away=0;document.addEventListener("visibilitychange",()=>{if(document.hidden)away=Date.now();else if(away&&Date.now()-away>18e5)location.reload()});

const ib=$("#ib"),ibtn=$("#install");let ask=null;
if(!matchMedia("(display-mode: standalone)").matches){ib.classList.add("on");addEventListener("beforeinstallprompt",(e)=>{e.preventDefault();ask=e});ibtn.addEventListener("click",async()=>{if(ask){ask.prompt();await ask.userChoice;ask=null;ib.classList.remove("on")}else $("#ihow").hidden=false});addEventListener("appinstalled",()=>ib.classList.remove("on"))}
const t=$("#tip");const show=(e)=>{const m=e.target.closest&&e.target.closest("[data-t]");if(!m){t.style.display="none";return}t.textContent=m.dataset.t;t.style.display="block";t.style.left=clamp(e.clientX-t.offsetWidth/2,8,innerWidth-t.offsetWidth-8)+"px";t.style.top=Math.max(8,e.clientY-44)+"px"};document.addEventListener("pointermove",show);document.addEventListener("click",show);
</script></html>`;
}
