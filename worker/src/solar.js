// ☀️ ניטור הגג הסולארי של הבעלים, בלי AI: SolarEdge API V2 (מסלול חינמי) ו-Open-Meteo.
// החיבור: הבעלים מבקש מקישור שולה (solar_link), מדביק Client ID ו-Secret בדף /solar/start ומאשר ב-SolarEdge.
// כל בוקר (wrangler.toml): 3 קרדיטים מתוך 2,000 בחודש, התראה רק על יום בלי ייצור. ביום ראשון דוח שבועי.
// SolarEdge מחליפה את ה-refresh token בכל שימוש, ולכן כל ריצה שומרת את החדש ב-agentReports/solar (האוסף חסום לאפליקציה).
import { israelToUtc } from "./time.js";
import { confirmed } from "./tools.js";
import { issueKey, checkKey, dropKey } from "./google.js";
import { sha256 } from "./inbox.js";
import { solarHtml } from "./solar-dashboard.js";
import { reportData, reportHtml, reportXlsx, reportFileName, validPeriod } from "./solar-report.js";
import { ICON_192, ICON_512 } from "./solar-icons.js";
// גרסה בכתובות של האייקונים והמניפסט: אייקון חדש מקבל כתובת חדשה, אחרת הטלפון מציג את הישן מהמטמון
export const ICON_V = ICON_192.length.toString(36) + ICON_512.length.toString(36);
import { esc } from "./dashboard.js";

const API = "https://monitoringapi.solaredge.com/v2";
const DOC = "agentReports/solar";
const GRANT_DAYS = 730; // 24 חודשים, המקסימום של SolarEdge
const LOCATION = { latitude: 33.22, longitude: 35.65 }; // אזור שאר ישוב. לחישוב קרינה מספיקה דיוק אזורי, והריפו ציבורי
const DAILY = "shortwave_radiation_sum,temperature_2m_max,precipitation_sum";
const KEEP_DAYS = 800;
const CLOUDY_MJ = 8; // יום מתחת לזה כמעט לא אומר כלום על הגג
const MIN_BASELINE = 10;
const YEAR_WINDOWS = 20; // כ-600 יום: שנה להשוואה, ועוד מספיק אחורה לחישוב החזר ההשקעה מיום ההפעלה
// משיכה שהסתיימה עם פחות חלונות (גרסה קודמת) ממשיכה מאיפה שנעצרה
const full = (s) => !!s.backfilled && (s.backfillIdx ?? YEAR_WINDOWS) >= YEAR_WINDOWS;
const BATCH = 6; // המסלול החינמי: 10 קריאות בדקה. שאר השנה נמשך בריצות הבאות

const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" });
export const isoDay = (d) => dayFmt.format(new Date(d));
export const addDays = (day, n) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const instant = (day) => israelToUtc(`${day}T00:00`).toISOString().replace(/\.\d+Z$/, "Z");
const heb = (day) => `${+day.slice(8)}.${+day.slice(5, 7)}`;
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s[Math.floor((s.length - 1) / 2)] + s[Math.ceil((s.length - 1) / 2)]) / 2 : null;
};
const sum = (rows) => rows.reduce((t, d) => t + d.kwh, 0);
const pct = (a, b) => (b > 0 ? Math.round((a / b - 1) * 100) : null);
const signed = (n) => (n > 0 ? `${n}% יותר` : n < 0 ? `${-n}% פחות` : "בדיוק כמו");

// תפוקה ביחס לקרינה, מתוקנת לחום. shortcut: מקדם קבוע של 0.4% למעלה לפי טמפרטורת אוויר; אם יופיעו התראות שווא בקיץ, לכייל מההיסטוריה
export function adjusted(d) {
  // ביום גשום העננים מעל הגג כבדים מממוצע הרשת של מודל מזג האוויר, אז היחס לא אומר כלום על הגג
  if (!d || d.kwh == null || !(d.rad >= CLOUDY_MJ) || d.tmax == null || d.rain >= 1) return null;
  return d.kwh / (d.rad * (1 - 0.004 * (d.tmax - 25)));
}

const range = (end, n) => Array.from({ length: n }, (_, i) => addDays(end, i - n + 1));

export function analyze(days, today) {
  const end = addDays(today, -1);
  const rows = (d) => d.map((k) => ({ day: k, ...days[k] })).filter((x) => x.kwh != null);
  const week = rows(range(end, 7));
  const prev = rows(range(addDays(end, -7), 7));
  const lastYear = rows(range(addDays(end, -364), 7));
  const base = rows(range(addDays(end, -7), 30)).map(adjusted).filter((x) => x != null);
  const baseline = base.length >= MIN_BASELINE ? median(base) : null;
  const clear = week.map(adjusted).filter((x) => x != null);
  const ratio = baseline && clear.length ? median(clear) / baseline : null;
  // יום חלש נחשד רק כשהיה כמעט בהיר. ביום מעונן חלקית סכום הקרינה של המודל לא תופס ענן מקומי מעל הגג
  const sunny = 0.75 * Math.max(0, ...rows(range(end, 30)).map((d) => d.rad || 0));
  return {
    start: addDays(end, -6),
    end,
    total: sum(week),
    days: week.length,
    vsPrev: prev.length === 7 && week.length === 7 ? pct(sum(week), sum(prev)) : null,
    vsYear: lastYear.length === 7 && week.length === 7 ? pct(sum(week), sum(lastYear)) : null,
    ratio,
    low: baseline ? week.filter((d) => adjusted(d) != null && adjusted(d) < 0.6 * baseline && d.rad >= sunny).map((d) => d.day) : [],
    missing: range(end, 7).filter((k) => days[k]?.kwh == null),
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

export function weeklyText(a, alerts, grantDays) {
  const lines = [`☀️ *הגג השבוע* (${heb(a.start)}-${heb(a.end)})`, `ייצור: ${Math.round(a.total)} קוט"ש${a.days < 7 ? ` (נתונים מ-${a.days} ימים)` : ""}`];
  if (a.vsPrev != null) lines.push(`מול שבוע שעבר: ${signed(a.vsPrev)}`);
  if (a.vsYear != null) lines.push(`מול אותו שבוע אשתקד: ${signed(a.vsYear)}`);
  if (a.ratio == null) lines.push("מול השמש: עדיין אין מספיק ימים בהירים להשוואה");
  else lines.push(`מול השמש: ${Math.round(a.ratio * 100)}% מהרגיל של הגג${a.ratio < 0.8 ? ", נמוך משמעותית, לבדוק" : a.ratio < 0.9 ? ", קצת נמוך, לעקוב" : ", תקין"}`);
  if (a.low.length) lines.push(`ימים חריגים: ${a.low.map(heb).join(", ")}`);
  if (a.missing.length) lines.push(`ימים בלי נתונים: ${a.missing.map(heb).join(", ")}`);
  if (alerts) lines.push(alerts.length ? `התראות ממיר: ${alerts.length}` : "התראות ממיר: אין");
  if (grantDays <= 60) lines.push(`החיבור ל-SolarEdge פג בעוד ${Math.max(grantDays, 0)} ימים. לכתוב לשולה "חיבור סולארי".`);
  return lines.join("\n");
}

async function refresh(s, store) {
  const ask = () => fetch(`${API}/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ grant_type: "refresh_token", refresh_token: s.refreshToken, client_id: s.clientId, client_secret: s.clientSecret }),
  });
  let r = await ask();
  // תקלת שרת רגעית אצל SolarEdge: ניסיון נוסף אחד לפני שמוותרים על הריצה
  if (r.status >= 500) {
    await new Promise((ok) => setTimeout(ok, 3000));
    r = await ask();
  }
  const j = await r.json().catch(() => ({}));
  if (!j.access_token) {
    const e = new Error(`SolarEdge token ${r.status}: ${j.error_description || j.error || j.title || ""}`);
    e.reconnect = r.status >= 400 && r.status < 500 && r.status !== 429;
    throw e;
  }
  if (j.refresh_token) await store.merge(DOC, { refreshToken: j.refresh_token });
  return j.access_token;
}

async function energy(s, token, from, to) {
  const q = new URLSearchParams({ from: instant(from), to: to.includes("T") ? to.replace(/\.\d+Z$/, "Z") : instant(to), resolution: "DAY", unit: "KWH" });
  const r = await fetch(`${API}/sites/${s.siteId}/energy?${q}`, { headers: { authorization: `Bearer ${token}`, accept: "application/json" } });
  if (!r.ok) throw new Error(`SolarEdge energy ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  const factor = { WH: 0.001, KWH: 1, MWH: 1000 }[String(j.unit || "KWH").toUpperCase()] ?? 1;
  const out = {};
  for (const v of j.values || []) if (v.value != null) out[isoDay(v.timestamp)] = v.value * factor;
  return out;
}

// התראות הן בונוס: אם המסלול לא מאפשר (403), הדוח פשוט לא מציג אותן
async function openAlerts(s, token) {
  const r = await fetch(`${API}/sites/${s.siteId}/alerts?only-open=true`, { headers: { authorization: `Bearer ${token}`, accept: "application/json" } }).catch(() => null);
  if (!r?.ok) return null;
  const j = await r.json().catch(() => null);
  return Array.isArray(j) ? j : j?.alerts || [];
}

// כמה ממירים ופאנלים רשומים. SolarEdge לא נותנת ב-API ייצור לפי פאנל, רק את הרשימה
async function equipment(s, token) {
  const r = await fetch(`${API}/sites/${s.siteId}/devices?types=INVERTER&types=OPTIMIZER`, { headers: { authorization: `Bearer ${token}`, accept: "application/json" } }).catch(() => null);
  if (!r?.ok) return null;
  const j = await r.json().catch(() => null);
  const list = Array.isArray(j) ? j : j?.devices || [];
  const count = (t) => list.filter((d) => d.type === t).length;
  return list.length ? { panels: count("OPTIMIZER"), inverters: count("INVERTER") } : null;
}

async function weather(url, params) {
  const q = new URLSearchParams({ ...LOCATION, daily: DAILY, timezone: "Asia/Jerusalem", ...params });
  const j = await (await fetch(`${url}?${q}`)).json();
  const d = j.daily || {};
  return Object.fromEntries((d.time || []).map((t, i) => [t, { rad: d.shortwave_radiation_sum?.[i], tmax: d.temperature_2m_max?.[i], rain: d.precipitation_sum?.[i] }]));
}

async function collect(s, token, today) {
  const days = { ...(s.days || {}) };
  const from = s.backfillIdx || 0;
  const put = (k, x) => { if (k < today) days[k] = { ...days[k], ...Object.fromEntries(Object.entries(x).filter(([, v]) => v != null)) }; };
  const recent = [addDays(today, -9), today];
  const year = Array.from({ length: YEAR_WINDOWS }, (_, i) => [addDays(today, -30 * (i + 1)), addDays(today, -30 * i)]);
  const windows = full(s) ? [recent] : from ? [recent, ...year.slice(from, from + BATCH - 3)] : year.slice(0, BATCH);
  let ok = 0;
  for (const [a, b] of windows) {
    try {
      for (const [k, kwh] of Object.entries(await energy(s, token, a, b))) put(k, { kwh });
      ok++;
    } catch (e) {
      if (!ok) throw e; // מה שכבר נמשך נשמר, וההמשך בריצה הבאה
      break;
    }
  }
  let archived = !!s.archived;
  try {
    if (!archived) {
      for (const [k, w] of Object.entries(await weather("https://archive-api.open-meteo.com/v1/archive", { start_date: addDays(today, -390), end_date: addDays(today, -6) }))) put(k, w);
      archived = true;
    }
    for (const [k, w] of Object.entries(await weather("https://api.open-meteo.com/v1/forecast", { past_days: "9", forecast_days: "1" }))) put(k, w);
  } catch (e) {
    console.log("solar weather", e.message); // בלי קרינה מסתמכים על השוואת הייצור בלבד
  }
  return { days: Object.fromEntries(Object.entries(days).filter(([k]) => k >= addDays(today, -KEEP_DAYS))), next: from + ok - (from ? 1 : 0), archived };
}

// ייצור היום עד עכשיו. רץ גם בריצה היומית וגם בשעתית, כך שהמספר מתעדכן גם בימים שהריצה היומית חוזרת כל שעה.
// אם SolarEdge לא מקבלת "עד עכשיו", מנסים עד סוף היום. התקלה נשמרת ב-todayError כדי שהדשבורד יסביר במקום "ממתין"
async function todayUpdate(s, token, store, today, now) {
  let err = "אין חיבור ל-SolarEdge";
  if (token) for (const to of [now.toISOString(), addDays(today, 1)]) {
    try {
      const kwh = (await energy(s, token, today, to))[today];
      await store.merge(DOC, { today: { day: today, kwh: kwh ?? 0, at: now.toISOString() }, todayError: "" });
      return true;
    } catch (e) {
      err = String(e.message).slice(0, 200);
    }
  }
  console.log("solar today", err); // נתון נוחות: התקלות הקשות מדווחות מהריצה היומית
  await store.merge(DOC, { todayError: err, todayErrorAt: now.toISOString() });
  return false;
}

async function cpiUpdate(store, today) {
  const r = await fetch("https://api.cbs.gov.il/index/data/price?id=120010&format=json&download=false&last=36");
  const rows = (await r.json())?.month?.[0]?.date || [];
  const cpi = Object.fromEntries(rows.filter((d) => d.currBase?.value > 0).map((d) => [`${d.year}-${String(d.month).padStart(2, "0")}`, d.currBase.value]));
  // shortcut: אם הלמ"ס מחליפה בסיס, הסדרה החדשה מגיעה עם בסיס אחד ל-36 החודשים, ואז הכל מתעדכן יחד
  if (Object.keys(cpi).length) await store.merge(DOC, { cpi: { ...cpi, at: today.slice(0, 7) } });
}

// tell(key, text, templateParam) — אותה שליחה של כל ההתראות לבעלים
export async function solarRun(store, tell, now = new Date(), link = "") {
  const today = isoDay(now);
  const hour = now.toISOString().slice(11, 13);
  let s = null;
  let hourly = false;
  let quiet = false; // המשך משיכת השנה באותו יום: בלי דוח ובלי התראה כפולה
  // Cloudflare מריץ לפעמים cron פעמיים, ושתי ריצות היו שורפות את אותו refresh token
  await store.update(DOC, (cur) => {
    if (!cur.refreshToken) return null;
    const done = cur.lastRunDay === today && !cur.lastError;
    if (done && full(cur)) {
      if (cur.todayHour === hour) return null;
      s = cur;
      hourly = true;
      return { todayHour: hour };
    }
    s = cur;
    quiet = done;
    return { lastRunDay: today, lastError: "", todayHour: hour };
  });
  if (!s) return "solar: skip";
  if (hourly) return (await todayUpdate(s, await refresh(s, store).catch(() => null), store, today, now)) ? "solar: today" : "solar: today failed";
  try {
    const token = await refresh(s, store);
    const first = !s.backfilled && !s.backfillIdx;
    const from = s.backfillIdx || 0;
    const { days, next, archived } = await collect(s, token, today);
    const alerts = await openAlerts(s, token);
    const sunday = new Date(`${today}T12:00:00Z`).getUTCDay() === 0;
    const gear = sunday || s.panels == null ? await equipment(s, token) : null;
    await store.merge(DOC, { ...(gear || {}), days, archived, openAlerts: alerts ? alerts.length : null, backfillIdx: full(s) ? YEAR_WINDOWS : next, backfilled: full(s) || next >= YEAR_WINDOWS, lastOkAt: now.toISOString() });
    // ייצור היום תמיד, גם באמצע משיכת ההיסטוריה. בשביל זה ההמשך מושך 3 חלונות ישנים ולא 5, כדי להישאר מתחת ל-10 קריאות בדקה
    if (full(s) || from > 0) await todayUpdate(s, token, store, today, now);
    // מדד המחירים לצרכן מהלמ"ס, פעם בחודש, להחזר ההשקעה בשקלים של היום. בלי קרדיטים של SolarEdge
    if (s.cpi?.at !== today.slice(0, 7)) await cpiUpdate(store, today).catch((e) => console.log("solar cpi", e.message));
    const fault = hardFault(days, today);
    const sent = [];
    if (fault && !quiet) sent.push(await tell("solar-fault", fault, fault.replace(/[*⚠️]/g, "").trim()));
    if ((sunday && !quiet) || first) {
      const grantDays = Math.ceil((Date.parse(s.connectedAt) + GRANT_DAYS * 864e5 - now.getTime()) / 864e5);
      const report = weeklyText(analyze(days, today), alerts, grantDays);
      const text = link ? `${report}\n${link}` : report;
      sent.push(await tell("solar", text, report.replace(/[*☀️]/g, "").replace(/\n/g, " · ").trim().slice(0, 400)));
    }
    return `solar: ok ${sent.length}`;
  } catch (e) {
    // תקלה זמנית נשארת ב-lastError, והריצה של השעה הבאה מנסה שוב. על אותה תקלה מודיעים פעם ביום
    await store.merge(DOC, { lastError: e.reconnect ? "" : String(e.message).slice(0, 300), lastFailDay: today, reconnectNote: e.reconnect ? String(e.message).slice(0, 300) : "" });
    // תקלה זמנית: הודעה רק אם גם הריצה האחרונה של היום (16:10 UTC) נכשלה
    if (e.reconnect ? s.lastFailDay === today : quiet || hour < "16") throw e;
    const text = e.reconnect ? `☀️ החיבור ל-SolarEdge נפל, והגג לא נבדק. צריך לכתוב לשולה "חיבור סולארי" ולאשר שוב.` : `☀️ בדיקת הגג לא הצליחה כל היום: ${String(e.message).slice(0, 200)}`;
    await tell("solar-error", text, text);
    throw e;
  }
}

// השומר: רץ כל רבע שעה ב-cron הרגיל, בלי תלות בריצת הבוקר. אם היא לא רצה, הוא אומר את זה פעם ביום.
export async function solarWatch(store, tell, now = new Date()) {
  const s = await store.get(DOC);
  if (!s?.refreshToken || !s.lastOkAt || now - new Date(s.lastOkAt) < 30 * 3600 * 1000) return "solar watch: ok";
  const today = isoDay(now);
  if (s.lastWarnDay === today) return "solar watch: warned";
  await store.merge(DOC, { lastWarnDay: today });
  const text = "☀️ בדיקת הגג הסולארי לא רצה מעל יום. בודקים למה.";
  await tell("solar-watch", text, text);
  return "solar watch: warned now";
}

const html = (msg, status = 200) => new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><body dir="rtl" style="font:20px system-ui;padding:24px;max-width:640px;margin:auto">${msg}</body>`, { status, headers: { "content-type": "text/html; charset=utf-8" } });
const field = (name, label) => `<input name="${name}" placeholder="${label}" required dir="ltr" style="width:100%;box-sizing:border-box;font:16px system-ui;padding:10px;margin:6px 0">`;
const setupPage = (origin) => html(`<h2>חיבור הגג הסולארי</h2><ol style="line-height:1.7">
<li>ב-<a href="https://developer.solaredge.com" target="_blank">developer.solaredge.com</a> ליצור אפליקציה: Monitoring API, Site Access, עם SITE_DATA ו-DEVICE_DATA.</li>
<li>Origin URL:<br><code style="user-select:all;word-break:break-all">${esc(origin)}</code></li>
<li>Redirect URI:<br><code style="user-select:all;word-break:break-all">${esc(origin)}/solar/callback</code></li>
<li>Returned URL: להשאיר ריק.</li>
<li>להדביק כאן את שני הערכים:</li></ol>
<form method="post">${field("id", "Client ID")}${field("secret", "Client Secret")}<button style="font:18px system-ui;padding:10px 20px">המשך לאישור ב-SolarEdge</button></form>`);

// הדשבורד: קישור כניסה חד-פעמי שרק שולה שולחת למספר של הבעלים, ואז עוגייה לדפדפן הזה בלבד.
// הקישור נשרף רק בלחיצה על "כניסה" (POST), כדי שתצוגה מקדימה של קישור לא תשרוף אותו.
const AUTH = "agentReports/solarAuth";
const SESSION_DAYS = 14;
const MAX_SESSIONS = 3;
const COOKIE = "__Host-solar";
const SECURITY = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "no-store",
  "x-robots-tag": "noindex, nofollow",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
  "strict-transport-security": "max-age=63072000; includeSubDomains",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
};
const randomHex = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, "0")).join("");
const secure = (body, status = 200, extra = {}, csp = "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'") =>
  new Response(body, { status, headers: { ...SECURITY, "content-security-policy": csp, ...extra } });
const shell = (msg, status = 200) => secure(`<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="robots" content="noindex"><title>הגג שלי</title><body style="font:20px/1.5 system-ui;padding:24px;max-width:480px;margin:auto">${msg}</body></html>`, status);
const NO_ACCESS = `<h2>הכניסה רק מהוואטסאפ</h2><p>כתוב לשולה "הדשבורד של הגג", ופתח את הקישור שתקבל.</p>`;

// מזג האוויר עכשיו, רק לשמיים בדשבורד. Cloudflare שומר את התשובה 10 דקות, ובתקלה פשוט אין גשם בציור
export const skyKind = (c = {}) => {
  const w = c.weather_code;
  if (c.precipitation > 0 || (w >= 51 && w <= 67) || (w >= 71 && w <= 86) || w >= 95) return "rain";
  return w === 3 || w === 45 || w === 48 || c.cloud_cover >= 85 ? "overcast" : "";
};
async function nowWeather() {
  try {
    const q = new URLSearchParams({ ...LOCATION, current: "weather_code,precipitation,cloud_cover", timezone: "Asia/Jerusalem" });
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?${q}`, { cf: { cacheTtl: 600, cacheEverything: true }, signal: AbortSignal.timeout(1500) });
    return skyKind((await r.json()).current);
  } catch {
    return "";
  }
}

export const solarUrl = async (env, origin) => `${origin}/solar/dashboard`;
export const loginUrl = async (store, origin) => `${origin}/solar/login?k=${await issueKey(store, "solar-login")}`;

const cookieOf = (req) => (req.headers.get("cookie") || "").split(/;\s*/).find((c) => c.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1) || "";
async function hasSession(req, store) {
  const token = cookieOf(req);
  if (!/^[0-9a-f]{64}$/.test(token)) return false;
  const hash = await sha256(token);
  const now = Date.now();
  return (((await store.get(AUTH)) || {}).sessions || []).some((x) => x.hash === hash && x.exp > now);
}
async function login(req, store) {
  if (req.method === "GET") {
    const k = new URL(req.url).searchParams.get("k") || "";
    if (!(await checkKey(store, "solar-login", k))) return shell(`<h2>הקישור כבר לא פעיל</h2><p>כתוב לשולה "הדשבורד של הגג" לקישור חדש.</p>`, 403);
    return shell(`<h2>כניסה לדשבורד הגג</h2><form method="post"><input type="hidden" name="k" value="${esc(k)}"><button style="font:20px system-ui;padding:12px 28px;border:0;border-radius:12px;background:#2a78d6;color:#fff">כניסה</button></form>`);
  }
  const k = String((await req.formData()).get("k") || "");
  if (!(await checkKey(store, "solar-login", k))) return shell(`<h2>הקישור כבר לא פעיל</h2><p>כתוב לשולה "הדשבורד של הגג" לקישור חדש.</p>`, 403);
  await dropKey(store, "solar-login");
  const token = randomHex(32);
  const hash = await sha256(token);
  const exp = Date.now() + SESSION_DAYS * 864e5;
  await store.update(AUTH, (cur) => ({ sessions: [...(cur.sessions || []).filter((x) => x.exp > Date.now()), { hash, exp }].slice(-MAX_SESSIONS) }));
  return secure("", 303, { location: "/solar/dashboard", "set-cookie": `${COOKIE}=${token}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}` });
}

export async function solarRoute(req, env, store, tell) {
  const url = new URL(req.url);
  if (url.pathname === "/solar/login") return login(req, store);
  if (url.pathname === "/solar/manifest.webmanifest")
    return new Response(JSON.stringify({ name: "הגג שלי", short_name: "הגג שלי", lang: "he", dir: "rtl", start_url: "/solar/dashboard", scope: "/solar/", display: "standalone", background_color: "#071226", theme_color: "#071226", icons: [192, 512].map((n) => ({ src: `/solar/icon-${n}.png?v=${ICON_V}`, sizes: `${n}x${n}`, type: "image/png", purpose: "any" })) }), { headers: { "content-type": "application/manifest+json", "cache-control": "public, max-age=86400" } });
  if (url.pathname === "/solar/icon-192.png" || url.pathname === "/solar/icon-512.png")
    return new Response(Buffer.from(url.pathname.includes("192") ? ICON_192 : ICON_512, "base64"), { headers: { "content-type": "image/png", "cache-control": "public, max-age=604800" } });
  // פעולות מהדשבורד: רק עם העוגייה, ורק מאותו אתר (העוגייה SameSite=Lax, ובודקים גם Origin)
  if ((url.pathname === "/solar/refresh" || url.pathname === "/solar/settings") && req.method === "POST") {
    const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...SECURITY, "content-type": "application/json" } });
    if (!(await hasSession(req, store)) || req.headers.get("origin") !== url.origin) return json({ error: "אין גישה" }, 403);
    if (url.pathname === "/solar/settings") {
      const body = await req.json().catch(() => ({}));
      const num = (v) => (v === "" || v == null ? null : Number(v));
      const r = await saveMoney(store, { agorot: num(body.agorot), self_agorot: num(body.self_agorot), invest: num(body.invest), costs: num(body.costs) });
      return json(r, r.error ? 400 : 200);
    }
    const s = (await store.get(DOC)) || {};
    if (!s.refreshToken) return json({ error: "הגג לא מחובר" }, 400);
    // בדקות של הריצה השעתית (10 אחרי) לא נוגעים, כדי ששתי ריצות לא יחליפו את אותו אסימון של SolarEdge
    const min = new Date().getUTCMinutes();
    if (min >= 8 && min <= 14) return json({ error: "בדיוק עכשיו רץ עדכון אוטומטי. נסה שוב בעוד 5 דקות" }, 409);
    // לא יותר מפעם בשתי דקות: כל רענון עולה קרדיט של SolarEdge
    if (s.todayManualAt && Date.now() - Date.parse(s.todayManualAt) < 120000) return json({ ok: true, cached: true });
    const now = new Date();
    await store.merge(DOC, { todayManualAt: now.toISOString() });
    const ok = await todayUpdate(s, await refresh(s, store).catch(() => null), store, isoDay(now), now);
    return json(ok ? { ok: true } : { error: "SolarEdge לא ענה, נסה שוב בעוד כמה דקות" }, ok ? 200 : 502);
  }
  if (url.pathname === "/solar/dashboard") {
    if (!(await hasSession(req, store))) return shell(NO_ACCESS, 401);
    const nonce = randomHex(16);
    const [doc, wx] = await Promise.all([store.get(DOC), nowWeather()]);
    return secure(solarHtml(doc || {}, isoDay(new Date()), nonce, wx), 200, {}, `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; img-src 'self' data:; manifest-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`);
  }
  if (url.pathname === "/solar/report" || url.pathname === "/solar/report.xlsx") {
    if (!(await hasSession(req, store))) return shell(NO_ACCESS, 401);
    const today = isoDay(new Date());
    const p = url.searchParams.get("p") || "";
    if (!validPeriod(p, today)) return shell("<h2>אין דוח לתקופה הזו</h2>", 400);
    const r = reportData((await store.get(DOC)) || {}, p, today);
    if (url.pathname.endsWith(".xlsx"))
      return new Response(reportXlsx(r), { headers: { ...SECURITY, "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": `attachment; filename="${reportFileName(p)}"`, "content-security-policy": "default-src 'none'" } });
    const nonce = randomHex(16);
    return secure(reportHtml(r, nonce), 200, {}, `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`);
  }
  if (url.pathname === "/solar/callback") {
    // המדריך של SolarEdge מחזיר state, ולקוחות בשטח מדווחים על external_id בלבד. בלי שניהם מקבלים רק כשיש חיבור פתוח
    const live = ((await store.get("agentReports/bot")) || {}).keys?.solar?.key;
    const key = url.searchParams.get("state") || url.searchParams.get("external_id") || live;
    if (!(await checkKey(store, "solar", key))) return new Response("forbidden", { status: 403 });
    const code = url.searchParams.get("code");
    if (!code) return html(`החיבור בוטל: ${esc(url.searchParams.get("error") || "לא התקבל אישור")}. אפשר לנסות שוב מהקישור.`, 400);
    const s = (await store.get(DOC)) || {};
    const r = await fetch(`${API}/oauth2/token`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ grant_type: "authorization_code", code, client_id: s.clientId, client_secret: s.clientSecret, redirect_uri: `${url.origin}/solar/callback` }),
    });
    const j = await r.json().catch(() => ({}));
    if (!j.refresh_token) return html(`החיבור נכשל: ${esc(j.error_description || j.error || j.title || r.status)}. כדאי לבדוק את ה-Client ID וה-Secret ולנסות שוב.`, 400);
    const now = new Date().toISOString();
    await store.merge(DOC, { refreshToken: j.refresh_token, siteId: url.searchParams.get("site_id") || s.siteId || "", connectedAt: now, lastOkAt: now, lastRunDay: "", lastFailDay: "", backfilled: false, backfillIdx: 0, archived: false });
    await dropKey(store, "solar");
    try {
      await solarRun(store, tell, new Date(), await solarUrl(env, url.origin));
      return html("☀️ הגג מחובר. הדוח הראשון בדרך לוואטסאפ.");
    } catch (e) {
      return html(`החיבור נשמר, אבל משיכת הנתונים נכשלה: ${esc(e.message)}`, 500);
    }
  }
  const key = url.searchParams.get("k");
  if (!(await checkKey(store, "solar", key))) return new Response("forbidden", { status: 403 });
  if (req.method === "POST") {
    const f = await req.formData();
    const id = String(f.get("id") || "").trim();
    const secret = String(f.get("secret") || "").trim();
    if (!id || !secret) return html("חסר ערך. לחזור אחורה ולהדביק שוב.", 400);
    await store.merge(DOC, { clientId: id, clientSecret: secret });
  }
  const s = (await store.get(DOC)) || {};
  if (!s.clientId) return setupPage(url.origin);
  const q = new URLSearchParams({ client_id: s.clientId, scope: "SITE_DATA DEVICE_DATA", access_duration: "24", state: key, external_id: key, redirect_uri: `${url.origin}/solar/callback` });
  return Response.redirect(`https://connect.solaredge.com/authorize?${q}`, 302);
}

// הגדרות הכסף: אותו בדיקה לשולה ולטופס בדשבורד. מחזיר שגיאה או רשימת שדות שנשמרו
async function saveMoney(store, { agorot, self_agorot, self_share, fixed, invest, costs, since, expected_kwh }) {
  const ok = (v, lo, hi) => v == null || (typeof v === "number" && v >= lo && v <= hi);
  if (!ok(agorot, 1, 300) || !ok(self_agorot, 1, 300) || !ok(self_share, 0, 100) || !ok(fixed, 0, 1000) || !ok(invest, 1000, 2e6) || !ok(costs, 0, 1e6) || !ok(expected_kwh, 100, 1e6) || (since != null && !/^20\d\d-\d\d-\d\d$/.test(since)))
    return { error: "אחד המספרים לא נראה נכון. תעריפים באגורות לקוט\"ש, צריכה עצמית באחוזים, השקעה בשקלים ותאריך YYYY-MM-DD." };
  const patch = Object.fromEntries(Object.entries({ rate: agorot && agorot / 100, selfRate: self_agorot && self_agorot / 100, selfShare: self_share != null ? self_share / 100 : null, fixed, invest, costs, since, expectedKwh: expected_kwh }).filter(([, v]) => v != null));
  if (!Object.keys(patch).length) return { error: "לא נמסר שום נתון לעדכון." };
  await store.merge(DOC, patch);
  return { saved: Object.keys(patch) };
}

export const SOLAR_TOOL_DEFS = [
  {
    name: "solar_link",
    description: "קישור חד-פעמי לחיבור הגג הסולארי של הבעלים ל-SolarEdge. כשהוא כותב \"חיבור סולארי\" או מבקש לחבר מחדש את הגג. להעביר את הקישור כמו שהוא.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "solar_dashboard",
    description: "קישור כניסה חד-פעמי לדשבורד הגג הסולארי של הבעלים, תקף 30 דקות. כשהוא שואל על הגג, הייצור או מבקש את הדשבורד. להעביר את הקישור כמו שהוא.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "solar_rate",
    description: "מעדכן את נתוני הכסף של הגג לדשבורד ולדוחות. כל שדה רשות, רק מה שהבעלים אמר. agorot: תעריף ההזנה לרשת באגורות לקוט\"ש (למשל 48). self_agorot: מחיר החשמל הביתי כולל מע\"מ באגורות. self_share: כמה אחוז מהייצור הבית צורך ישירות (0-100). fixed: ניכוי קבוע בשקלים לחודש. invest: מחיר המערכת בשקלים כולל מע\"מ, בלי תחזוקה ותיקונים. costs: סך ההוצאות אחרי הקנייה (תחזוקה, תיקונים, החלפת פאנל) בשקלים, שיורדות מההכנסה. since: תאריך ההפעלה YYYY-MM-DD. expected_kwh: תחזית ייצור שנתית מהמתקין.",
    input_schema: { type: "object", properties: { agorot: { type: "number" }, self_agorot: { type: "number" }, self_share: { type: "number" }, fixed: { type: "number" }, invest: { type: "number" }, costs: { type: "number" }, since: { type: "string" }, expected_kwh: { type: "number" } }, additionalProperties: false },
  },
  {
    name: "solar_bills",
    description: "שומר קריאות מחשבונות החשמל של הבית: לכל חשבון תקופת הקריאה (from, to בפורמט YYYY-MM-DD) וכמה קוט\"ש הוזרמו לרשת לפי \"זיכוי בגין יצור\" (kwh). מזה האפליקציה מחשבת כמה מהייצור הבית צורך בעצמו. חשבון עם אותו from מחליף את הקודם.",
    input_schema: { type: "object", properties: { bills: { type: "array", items: { type: "object", properties: { from: { type: "string" }, to: { type: "string" }, kwh: { type: "number" } }, required: ["from", "to", "kwh"], additionalProperties: false } } }, required: ["bills"], additionalProperties: false },
  },
  {
    name: "solar_logout",
    description: "מנתק את דשבורד הגג מכל המכשירים. רק כשהבעלים מבקש לנתק, למשל אם טלפון אבד.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
];
export const makeSolarTools = ({ store, origin, lastOwnerText, turn }) => ({
  async solar_link() {
    return `${origin}/solar/start?k=${await issueKey(store, "solar")} (תקף 30 דקות)`;
  },
  async solar_dashboard() {
    return `${await loginUrl(store, origin)} (קישור לכניסה אחת, תקף 30 דקות)`;
  },
  async solar_rate(fields) {
    if (!(await confirmed(store, "solar_rate", fields, lastOwnerText, turn))) return 'עוד לא נשמר. להציג לבעלים את הערכים ולשאול "לשמור?". אחרי "כן" — לקרוא שוב עם אותם ערכים בדיוק.';
    const r = await saveMoney(store, fields);
    return r.error || `עודכן: ${r.saved.join(", ")}. הדשבורד והדוחות מחושבים לפי זה.`;
  },
  async solar_bills({ bills }) {
    if (!(await confirmed(store, "solar_bills", { bills }, lastOwnerText, turn))) return 'עוד לא נשמר. להציג לבעלים את החשבונות ולשאול "לשמור?". אחרי "כן" — לקרוא שוב עם אותם חשבונות בדיוק.';
    const day = /^20\d\d-\d\d-\d\d$/;
    const good = (bills || []).filter((b) => day.test(b.from) && day.test(b.to) && b.from <= b.to && b.kwh >= 0 && b.kwh < 100000);
    if (!good.length) return "לא נמצאו חשבונות תקינים. לכל חשבון צריך from, to (YYYY-MM-DD) ו-kwh.";
    let total = 0;
    await store.update(DOC, (cur) => {
      const all = new Map((cur.bills || []).map((b) => [b.from, b]));
      for (const b of good) all.set(b.from, { from: b.from, to: b.to, kwh: b.kwh });
      total = all.size;
      return { bills: [...all.values()].sort((a, b) => a.from.localeCompare(b.from)) };
    });
    return `נשמרו ${good.length} חשבונות (סה"כ ${total}). הצריכה העצמית מחושבת מהם מעכשיו.`;
  },
  async solar_logout() {
    await store.merge(AUTH, { sessions: [] });
    await dropKey(store, "solar-login");
    return "הדשבורד נותק מכל המכשירים.";
  },
});
