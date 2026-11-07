// ☀️ חישובי הגג — פונקציות טהורות בלי רשת ובלי HTML. solar.js, הדשבורד והדוחות מייבאים מכאן.
import { addDays } from "../../agents/lib/analysis.mjs";

export { addDays };
const CLOUDY_MJ = 8; // יום מתחת לזה כמעט לא אומר כלום על הגג
const MIN_BASELINE = 10;
export const heb = (day) => `${+day.slice(8)}.${+day.slice(5, 7)}`;
export const median = (xs) => {
  const s = xs.filter((x) => x != null).sort((a, b) => a - b);
  return s.length ? (s[Math.floor((s.length - 1) / 2)] + s[Math.ceil((s.length - 1) / 2)]) / 2 : null;
};
export const sumKwh = (rows) => rows.reduce((t, d) => t + (d.kwh || 0), 0);
export const pct = (a, b) => (a != null && b > 0 ? Math.round((a / b - 1) * 100) : null);
export const span = (end, n) => Array.from({ length: n }, (_, i) => addDays(end, i - n + 1));

// תפוקה ביחס לקרינה, מתוקנת לחום. shortcut: מקדם קבוע של 0.4% למעלה לפי טמפרטורת אוויר; אם יופיעו התראות שווא בקיץ, לכייל מההיסטוריה
export function adjusted(d) {
  if (!d || d.kwh == null || !(d.rad >= CLOUDY_MJ) || d.tmax == null) return null;
  return d.kwh / (d.rad * (1 - 0.004 * (d.tmax - 25)));
}

const range = (end, n) => Array.from({ length: n }, (_, i) => addDays(end, i - n + 1));

export function analyze(days, today) {
  const end = addDays(today, -1);
  const rows = (d) => d.map((k) => ({ day: k, ...days[k] })).filter((x) => x.kwh != null);
  const week = rows(span(end, 7));
  const prev = rows(span(addDays(end, -7), 7));
  const lastYear = rows(span(addDays(end, -364), 7));
  const base = rows(span(addDays(end, -7), 30)).map(adjusted).filter((x) => x != null);
  const baseline = base.length >= MIN_BASELINE ? median(base) : null;
  const clear = week.map(adjusted).filter((x) => x != null);
  const ratio = baseline && clear.length ? median(clear) / baseline : null;
  return {
    start: addDays(end, -6),
    end,
    total: sumKwh(week),
    days: week.length,
    vsPrev: prev.length === 7 && week.length === 7 ? pct(sumKwh(week), sumKwh(prev)) : null,
    vsYear: lastYear.length === 7 && week.length === 7 ? pct(sumKwh(week), sumKwh(lastYear)) : null,
    ratio,
    low: baseline ? week.filter((d) => adjusted(d) != null && adjusted(d) < 0.6 * baseline).map((d) => d.day) : [],
    missing: span(end, 7).filter((k) => days[k]?.kwh == null),
  };
}

// תקלה קשה: אתמול לא דווח ייצור, או שהיה כמעט אפס למרות שהיה אור
export function hardFault(days, today) {
  const y = addDays(today, -1);
  const d = days[y];
  if (d?.kwh == null) return `⚠️ *הגג הסולארי:* אין נתוני ייצור מ-${heb(y)}. כנראה הממיר לא מתקשר. כדאי לבדוק את הנורה בממיר ואת חיבור האינטרנט שלו.`;
  if (d.kwh < 0.1 && d.rad >= 3) return `⚠️ *הגג הסולארי:* ב-${heb(y)} לא היה ייצור בכלל, למרות שהיה אור. כדאי לבדוק את הממיר ואת המפסק.`;
  return null;
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

