// 📊 דשבורד פרסום: דף פרטי (קישור חתום, בלי התחברות) שמציג את מה שסוכן הנתונים (agents/insights.mjs) אסף
// מ-Meta הלילה: עוקבים, פוסטים מתוזמנים בפייסבוק, פוסט שמחכה ל"כן", חשיפה לכל פוסט וממוצע לפי סוג.
// קריאה בלבד: לא נוגע ב-Meta ולא בשום מסמך. מספר שלא ידוע מוצג "לא זמין", אף פעם לא 0.
import { sign } from "./google.js";
import { sha256 } from "./inbox.js";
import { notifyOwner } from "../../agents/lib/whatsapp.mjs";
import { outboxMap } from "./queue.js";

const TZ = "Asia/Jerusalem";
const STALE_MS = 36 * 3600 * 1000; // הסוכן רץ כל לילה; יותר מיום וחצי בלי עדכון = משהו נתקע
const TYPE = { photo: "תמונה", image: "תמונה", video: "סרטון", reels: "ריל", album: "אלבום", text: "טקסט", link: "קישור", carousel_album: "אלבום", share: "שיתוף" };
const NET = { facebook: "פייסבוק", instagram: "אינסטגרם" };

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fmt = (n) => (n == null ? "לא זמין" : Number(n).toLocaleString("he-IL"));
const when = (iso) => new Date(iso).toLocaleString("he-IL", { timeZone: TZ, weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
const day = (iso) => new Date(iso).toLocaleDateString("he-IL", { timeZone: TZ, day: "numeric", month: "numeric" });
const title = (t) => esc((t || "(בלי טקסט)").split("\n")[0].slice(0, 60));
const avg = (xs) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null);

export const dashboardUrl = async (env, origin) => `${origin}/dashboard?t=${await sign(env, "dashboard")}`;

// פעם ביום, אחרי שהסוכן הלילי עדכן את הנתונים: הקישור לדשבורד בוואטסאפ (שחר, 20.10.2026).
// נרשם כנשלח רק אחרי שליחה מוצלחת — כישלון ינסה שוב ברבע השעה הבאה.
export async function dailyDashboard(env, store, origin, send) {
  const updatedAt = ((await store.get("agentReports/insights")) || {}).updatedAt;
  const bot = (await store.get("agentReports/bot")) || {};
  if (!updatedAt || bot.dashboardSentFor === updatedAt) return "dashboard: nothing new";
  const o = origin || bot.workerUrl;
  if (!o) return "dashboard: no origin";
  await send(`📊 הדשבורד התעדכן מפייסבוק ומאינסטגרם:\n${await dashboardUrl(env, o)}`);
  await store.merge("agentReports/bot", { dashboardSentFor: updatedAt });
  return "dashboard: sent";
}

export async function dashboardRoute(req, env, store) {
  const url = new URL(req.url);
  if (url.searchParams.get("t") !== (await sign(env, "dashboard"))) return new Response("forbidden", { status: 403 });
  const [insights, bot, feed] = await Promise.all([store.get("agentReports/insights"), store.get("agentReports/bot"), store.get("agentReports/insightsFeed")]);
  return new Response(dashboardHtml(withFeed(insights || {}, feed), bot?.pending?.post || null), {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" },
  });
}

// 📥 /insights/feed — משימה לילית של קלוד שולפת מ-Meta דרך חיבורי Composio של הבעלים (שיש להם הרשאות החשיפה
// שאין לטוקן של שולה) ושולחת לכאן. נשמר במסמך נפרד, כדי שהריצה הלילית של insights.mjs לא תדרוס אותו.
// המפתח עצמו רק במשימה; כאן ובריפו רק ה-SHA-256. רק מספרים נשמרים — שום טקסט מבחוץ.
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const dayMap = (m) => Object.fromEntries(Object.entries(m && typeof m === "object" ? m : {}).filter(([k, v]) => /^\d{4}-\d{2}-\d{2}$/.test(k) && num(v) != null).slice(0, 1000));
export function cleanFeed(body = {}) {
  const ids = (m, f) => Object.fromEntries(Object.entries(m && typeof m === "object" ? m : {}).filter(([k]) => /^[\d_]{5,60}$/.test(k)).slice(0, 500).map(([k, v]) => [k, f(v)]));
  return {
    series: Object.fromEntries(["fbReach", "fbFollows", "igReach", "igFollows"].map((k) => [k, dayMap(body.series?.[k])]).filter(([, v]) => Object.keys(v).length)),
    reach: ids(body.reach, num),
    eng: ids(body.eng, (v) => ({ likes: num(v?.likes), comments: num(v?.comments), shares: num(v?.shares) })),
    fbHistory: Array.isArray(body.fbHistory) ? body.fbHistory.slice(0, 2000).filter((x) => !isNaN(Date.parse(x?.at)) && num(x?.e) != null).map((x) => ({ p: "f", at: new Date(x.at).toISOString(), e: x.e })) : null,
  };
}
export async function feedRoute(req, env, store) {
  const k = new URL(req.url).searchParams.get("k") || "";
  if (!env.FEED_KEY_SHA256 || (await sha256(k)) !== env.FEED_KEY_SHA256) return new Response("forbidden", { status: 403 });
  // בדיקה: מה נשמר ומה מזה באמת נכנס לדשבורד (מספרים בלבד)
  if (req.method === "GET") {
    const [ins, feed] = await Promise.all([store.get("agentReports/insights"), store.get("agentReports/insightsFeed")]);
    const m = withFeed(ins || {}, feed);
    const wk = Date.now() - 7 * DAY;
    const recent = (m.history || []).filter((x) => new Date(x.at) >= wk).map((x) => [x.p, x.at.slice(0, 10), x.e]);
    const hm = {};
    for (const x of m.history || []) { const k = x.at.slice(0, 7) + x.p; hm[k] = (hm[k] || 0) + 1; }
    return Response.json({ followers: m.followers || null, followersLog: Object.fromEntries(Object.entries(m.followersLog || {}).sort().slice(-15)), month: compare(m, PERIODS[1]), debug: { recent, historyByMonth: hm, trend: trends(m), week: compare(m, PERIODS[0]) }, dashboard: await dashboardUrl(env, new URL(req.url).origin), feedAt: feed?.at || null, series: Object.keys(feed?.series || {}), feedReach: Object.keys(feed?.reach || {}).length, posts: (m.posts || []).length, postsWithReach: (m.posts || []).filter((p) => p.reach != null).length, gaps: m.gaps, samplePostIds: (ins?.posts || []).slice(0, 3).map((p) => p.id), sampleFeedIds: Object.keys(feed?.reach || {}).slice(0, 3) });
  }
  if (req.method !== "POST") return new Response("forbidden", { status: 403 });
  const feed = cleanFeed(await req.json().catch(() => ({})));
  await store.merge("agentReports/insightsFeed", { ...feed, at: new Date().toISOString() });
  return Response.json({ ok: true, series: Object.keys(feed.series), reach: Object.keys(feed.reach).length });
}
// 📣 /insights/campaign — הקמפיין השבועי של קלוד (משימה מתוזמנת, ראשון בבוקר): דוח התקדמות + טיוטות לשבוע.
// הטיוטות נשמרות ב-agentReports/content (אותו מקום של סוכן הפרסום), ומשם שולה מפרסמת רק אחרי "כן" של הבעלים.
const str = (v, n) => (typeof v === "string" ? v.slice(0, n) : "");
const url = (v) => (typeof v === "string" && /^https:\/\/[^\s"<>]+$/.test(v) ? v.slice(0, 600) : "");
export function cleanDrafts(xs) {
  return (Array.isArray(xs) ? xs : []).slice(0, 25).map((d) => ({
    at: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(d?.at) ? d.at : "",
    kind: ["post", "reel", "story"].includes(d?.kind) ? d.kind : "post",
    topic: str(d?.topic, 120), goal: str(d?.goal, 200), training: str(d?.training, 200),
    facebook: str(d?.facebook, 2200), instagram: str(d?.instagram, 2200), tags: str(d?.tags, 300),
    image: url(d?.image), video: url(d?.video),
  })).filter((d) => d.at && d.facebook && (d.image || d.video));
}
export async function campaignRoute(req, env, store, wa) {
  const k = new URL(req.url).searchParams.get("k") || "";
  if (req.method !== "POST" || !env.FEED_KEY_SHA256 || (await sha256(k)) !== env.FEED_KEY_SHA256) return new Response("forbidden", { status: 403 });
  const body = await req.json().catch(() => ({}));
  const drafts = cleanDrafts(body.drafts);
  const at = new Date().toISOString();
  if (drafts.length) await store.merge("agentReports/content", { date: at.slice(0, 10), createdAt: at, drafts, by: "claude", goal: str(body.goal, 300) });
  const text = str(body.notify, 3500);
  if (text) {
    const bot = (await store.get("agentReports/bot")) || {};
    await store.update("agentReports/bot", (cur) => ({ outbox: { ...outboxMap(cur.outbox), content: { at, text } } }));
    await notifyOwner(wa, { lastOwnerMsgAt: bot.lastOwnerMsgAt, text, template: "agent_alert", templateParam: text.replace(/\s+/g, " ").slice(0, 900) });
  }
  return Response.json({ ok: true, drafts: drafts.length, notified: !!text });
}

// משלים מה-feed את מה שהטוקן של שולה לא קיבל (חשיפה, לייקים בפייסבוק, סדרות יומיות)
export function withFeed(insights, feed) {
  if (!feed?.at) return insights;
  const series = { ...(insights.series || {}), ...(feed.series || {}) };
  const posts = (insights.posts || []).map((p) => {
    const e = feed.eng?.[p.id];
    return { ...p, reach: p.reach ?? feed.reach?.[p.id] ?? null, likes: p.likes ?? e?.likes ?? null, comments: p.comments ?? e?.comments ?? null };
  });
  const history = feed.fbHistory?.length ? [...(insights.history || []).filter((x) => x.p !== "f"), ...feed.fbHistory] : insights.history;
  const gaps = { ...(insights.gaps || {}) };
  const covered = { fbReach: posts.some((p) => p.platform === "facebook" && p.reach != null), igReach: posts.some((p) => p.platform === "instagram" && p.reach != null), fbLikes: posts.every((p) => p.platform !== "facebook" || p.likes != null), fbFollows: !!series.fbFollows };
  for (const [k, ok] of Object.entries(covered)) if (ok) delete gaps[k];
  return { ...insights, series, posts, history, gaps };
}

function bars(rows, cls = "") {
  const max = Math.max(1, ...rows.map((r) => r.v));
  return rows
    .map(({ name, v, note }) => {
      const pct = (v / max) * 100;
      return `<div class="brow${cls}"><div class="name">${name}${note ? `<small>${note}</small>` : ""}</div><div class="track"><div class="bar" style="width:${pct.toFixed(1)}%"></div><span class="bval${pct > 70 ? " in" : ""}" style="inset-inline-start:${pct > 70 ? `calc(${pct.toFixed(1)}% - 52px)` : `calc(${pct.toFixed(1)}% + 8px)`}">${fmt(v)}</span></div></div>`;
    })
    .join("");
}

// 📈 השוואות: אותו מדד בתקופה הנוכחית מול תקופה קודמת. null = לא ידוע (אין נתון או כיסוי חלקי) — אף פעם לא 0 מומצא.
const DAY = 864e5;
const ymd = (ms) => new Date(ms).toISOString().slice(0, 10);
export const PERIODS = [
  { key: "week", title: "השבוע מול שבוע שעבר", now: "7 ימים", before: "שבוע שעבר", len: 7, back: 7 },
  { key: "month", title: "החודש מול חודש שעבר", now: "30 יום", before: "חודש שעבר", len: 30, back: 30 },
  { key: "year", title: "החודש מול אותו חודש אשתקד", now: "30 יום", before: "לפני שנה", len: 30, back: 365 },
];
// סכום יומי בטווח; פחות מ-80% מהימים מכוסים = לא ידוע
const sumDays = (series, from, to) => {
  if (!series) return null;
  let s = 0, n = 0, days = 0;
  for (let t = from; t < to; t += DAY, days++) {
    const v = series[ymd(t)];
    if (typeof v === "number") (s += v), n++;
  }
  return n >= days * 0.8 ? s : null;
};
// עוקבים ביום מסוים לפי היומן שלנו (עד 3 ימים אחורה)
const logAt = (log, t, net) => {
  for (let i = 0; i < 4; i++) {
    const v = log?.[ymd(t - i * DAY)]?.[net];
    if (v != null) return v;
  }
  return null;
};
const growth = (log, from, to, net) => {
  const a = logAt(log, from, net), b = logAt(log, to - DAY, net);
  return a == null || b == null ? null : b - a;
};

// 🎯 יעד שבועי לעוקבים חדשים בכל רשת (שחר, 24.10.2026)
export const WEEKLY_GOAL = 5;
export function goalProgress(insights, now = new Date()) {
  const end = now.getTime(), start = end - 7 * DAY, s = insights.series || {}, log = insights.followersLog;
  return [
    ["פייסבוק", sumDays(s.fbFollows, start, end) ?? growth(log, start, end, "facebook")],
    ["אינסטגרם", sumDays(s.igFollows, start, end) ?? growth(log, start, end, "instagram")],
  ].filter(([, v]) => v != null);
}
function goalHtml(insights, now) {
  const rows = goalProgress(insights, now);
  if (!rows.length) return "";
  return `<section><div class="sec-h"><h2>יעד השבוע: +${WEEKLY_GOAL} עוקבים בכל רשת</h2></div><div class="panel goal">${rows
    .map(([n, v]) => `<div class="grow"><span>${n}</span><div class="gtrack"><div class="gbar${v >= WEEKLY_GOAL ? " hit" : ""}" style="width:${Math.min(100, Math.max(0, (v / WEEKLY_GOAL) * 100)).toFixed(0)}%"></div></div><b>${v >= 0 ? "+" : ""}${v} / ${WEEKLY_GOAL}${v >= WEEKLY_GOAL ? " ✅" : ""}</b></div>`)
    .join("")}</div></section>`;
}

export function compare(insights, period, now = new Date()) {
  const end = now.getTime(), start = end - period.len * DAY;
  const pEnd = end - period.back * DAY, pStart = pEnd - period.len * DAY;
  const hist = insights.history;
  const s = insights.series || {}, log = insights.followersLog;
  const inRange = (from, to, p) => (hist || []).filter((x) => x.p === p && new Date(x.at) >= from && new Date(x.at) < to);
  // ההיסטוריה מכסה 400 יום אחורה — טווח שמתחיל לפני האיסוף הראשון לא ידוע
  const covered = (from) => hist && insights.updatedAt && from >= new Date(insights.updatedAt).getTime() - 400 * DAY;
  const posts = (from, to) => (covered(from) ? inRange(from, to, "f").length + inRange(from, to, "i").length : null);
  const eng = (from, to, p) => {
    if (!covered(from)) return null;
    const xs = inRange(from, to, p);
    return xs.some((x) => x.e == null) ? null : xs.reduce((a, x) => a + x.e, 0);
  };
  const perPost = (from, to, p) => {
    const e = eng(from, to, p), n = covered(from) ? inRange(from, to, p).length : null;
    return e == null || !n ? null : Math.round(e / n);
  };
  const fbNew = (from, to) => sumDays(s.fbFollows, from, to) ?? growth(log, from, to, "facebook");
  const row = (name, fn) => ({ name, now: fn(start, end), before: fn(pStart, pEnd) });
  return [
    row("פוסטים שעלו", posts),
    row("חשיפה בפייסבוק", (a, b) => sumDays(s.fbReach, a, b)),
    row("חשיפה באינסטגרם", (a, b) => sumDays(s.igReach, a, b)),
    row("עוקבים חדשים בפייסבוק", fbNew),
    row("עוקבים חדשים באינסטגרם", (a, b) => sumDays(s.igFollows, a, b) ?? growth(log, a, b, "instagram")),
    row("לייקים ותגובות בפייסבוק", (a, b) => eng(a, b, "f")),
    row("לייקים ותגובות באינסטגרם", (a, b) => eng(a, b, "i")),
    row("מעורבות לפוסט באינסטגרם", (a, b) => perPost(a, b, "i")),
  ];
}

// שינוי באחוזים: null כשאין עם מה להשוות
// תווית שינוי: בסיס קטן (מתחת ל-10) — "פי X" במקום אחוז מטורף
const times = (x) => `פי ${x >= 10 ? Math.round(x) : String(Math.round(x * 10) / 10)}`;
export function changeLabel(now, before) {
  const c = change(now, before);
  if (!c) return "";
  if (c.dir === "flat") return `<span class="flat">0%</span>`;
  const arrow = c.dir === "up" ? "▲" : "▼";
  let txt;
  if (before === 0) txt = "חדש";
  else if (now === 0) txt = "100%";
  else if (before < 10) txt = times(c.dir === "up" ? now / before : before / now);
  else txt = `${Math.abs(c.pct)}%`;
  return `<span class="${c.dir}">${arrow} ${txt}</span>`;
}
export const change = (now, before) => {
  if (now == null || before == null) return null;
  if (before === 0) return now === 0 ? { pct: 0, dir: "flat" } : { pct: null, dir: "up" };
  const pct = Math.round(((now - before) / before) * 100);
  return { pct, dir: pct > 0 ? "up" : pct < 0 ? "down" : "flat" };
};

// מה חסר ולמה — הרשאות שחסרות בטוקן של שולה, ואיזה מספרים הן פותחות
const PERM = {
  fbReach: ["read_insights", "חשיפה בפייסבוק"],
  fbFollows: ["read_insights", "עוקבים חדשים בפייסבוק"],
  igReach: ["instagram_manage_insights", "חשיפה באינסטגרם"],
  fbLikes: ["pages_read_user_content", "לייקים ותגובות בפייסבוק"],
};
function gapsHtml(gaps = {}) {
  const perms = {}, other = [];
  for (const [k, why] of Object.entries(gaps)) {
    if (PERM[k] && why === "permission") (perms[PERM[k][0]] ||= new Set()).add(PERM[k][1]);
    else if (PERM[k]) other.push(PERM[k][1]);
  }
  const lines = Object.entries(perms).map(([p, what]) => `<li><b>${[...what].join(", ")}</b> — חסרה ההרשאה <code dir="ltr">${p}</code></li>`);
  lines.push(...[...new Set(other)].map((w) => `<li><b>${w}</b> — Meta לא החזירה הלילה. נבדק שוב בריצה הבאה.</li>`));
  if (!lines.length) return "";
  const fix = Object.keys(perms).length ? `<p>לתיקון: לכתוב לשולה בוואטסאפ <b>"חיבור קבוע לפייסבוק"</b>, ולסמן ביצירת הטוקן את ההרשאות המודגשות בדף. המספרים יופיעו מהלילה שאחרי.</p>` : "";
  return `<section><div class="sec-h"><h2>מה חסר ולמה</h2></div><div class="panel gaps"><ul>${lines.join("")}</ul>${fix}</div></section>`;
}

function compareHtml(insights, now) {
  return PERIODS.map((p) => {
    const rows = compare(insights, p, now).filter((r) => r.now != null && r.before != null);
    if (!rows.length) return "";
    const ch = rows.map((r) => change(r.now, r.before));
    const up = ch.filter((c) => c?.dir === "up").length, down = ch.filter((c) => c?.dir === "down").length;
    // גרף: לכל מדד שני פסים — עכשיו (כהה) מול התקופה הקודמת (בהיר)
    const body = rows
      .map((r, i) => {
        const cell = changeLabel(r.now, r.before);
        const max = Math.max(1, r.now, r.before);
        const bar = (v, cls) => `<div class="pair ${cls}"><div class="pbar" style="width:${((v / max) * 100).toFixed(1)}%"></div><b>${fmt(v)}</b></div>`;
        return `<div class="crow"><div class="cname">${r.name}${cell}</div>${bar(r.now, "nowb")}${bar(r.before, "befb")}</div>`;
      })
      .join("");
    return `<div class="panel cmp"><div class="cmp-h"><h3>${p.title}</h3>${up || down ? `<span class="verdict"><span class="up">▲ ${up}</span> <span class="down">▼ ${down}</span></span>` : ""}</div>
<div class="legend"><span class="nowb">${p.now}</span><span class="befb">${p.before}</span></div>${body}</div>`;
  }).join("");
}

// 📈 מגמה שנתית: 12 חודשים, סכום לכל חודש. החודש הנוכחי חלקי — המגמה נמדדת בממוצע יומי, כדי שחודש חלקי לא ייראה כירידה.
const MONTHS = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יונ", "יול", "אוג", "ספט", "אוק", "נוב", "דצמ"];
const ilMonth = (iso) => new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ }).slice(0, 7); // חודש לפי שעון ישראל
export function trends(insights, now = new Date()) {
  const s = insights.series || {}, hist = insights.history;
  const today = new Date(now).toLocaleDateString("en-CA", { timeZone: TZ });
  const [y, m] = today.split("-").map(Number);
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 12 + i, 1));
    const key = d.toISOString().slice(0, 7);
    const full = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    const days = i === 11 ? Number(today.slice(8, 10)) : full;
    return { key, label: MONTHS[d.getUTCMonth()], days, partial: i === 11 && days < full };
  });
  // סדרות יומיות: המפתח הוא כבר תאריך יומי של Meta
  const bySeries = (ser) => ser && months.map(({ key }) => {
    const vs = Object.entries(ser).filter(([d]) => d.startsWith(key)).map(([, v]) => v);
    return vs.length ? vs.reduce((a, b) => a + b, 0) : null;
  });
  const byHist = (p, f) => hist?.length && months.map(({ key }) => {
    const xs = hist.filter((x) => (!p || x.p === p) && ilMonth(x.at) === key);
    return xs.some((x) => f(x) == null) ? null : xs.reduce((a, x) => a + f(x), 0);
  });
  return {
    months,
    rows: [
      ["חשיפה בפייסבוק", bySeries(s.fbReach)],
      ["חשיפה באינסטגרם", bySeries(s.igReach)],
      ["פוסטים שעלו", byHist(null, () => 1)],
      ["לייקים ותגובות בפייסבוק", byHist("f", (x) => x.e)],
      ["לייקים ותגובות באינסטגרם", byHist("i", (x) => x.e)],
      ["עוקבים חדשים בפייסבוק", bySeries(s.fbFollows)],
    ].filter(([, v]) => v && v.filter((x) => x != null).length >= 6),
  };
}
// מגמה: ממוצע יומי ב-3 החודשים האחרונים מול 3 הראשונים
export function trendChange(vals, months) {
  const perDay = (from, to) => {
    let sum = 0, days = 0;
    for (let i = from; i < to; i++) if (vals[i] != null) (sum += vals[i]), (days += months[i].days);
    return days ? sum / days : null;
  };
  const a = perDay(0, 3), b = perDay(9, 12);
  return a == null || b == null ? null : { now: b, before: a };
}
function trendHtml(insights, now) {
  const { months, rows } = trends(insights, now);
  if (!rows.length) return "";
  return rows.map(([name, vals]) => {
    const t = trendChange(vals, months);
    const c = t && change(t.now, t.before);
    const big = t && t.before > 0 && (t.now / t.before >= 2 || t.before / t.now >= 2);
    const tag = !c ? "" : c.dir === "flat" ? `<span class="flat">יציב</span>` : `<span class="${c.dir}">${c.dir === "up" ? "▲ במגמת עלייה" : "▼ במגמת ירידה"} ${t.before === 0 ? "" : big ? times(c.dir === "up" ? t.now / t.before : t.before / t.now) : Math.abs(c.pct) + "%"}</span>`;
    const max = Math.max(1, ...vals.filter((v) => v != null));
    const cols = vals.map((v, i) => {
      const mo = months[i];
      const val = v == null ? "" : v >= 10000 ? Math.round(v / 1000) + "K" : v.toLocaleString("he-IL"); // מספר מלא עד 10,000 — עיגול ל-K הסתיר הבדלים (2,252 מול 2,347)
      return `<div class="tcol${mo.partial ? " part" : ""}" title="${mo.label}: ${v ?? ""}"><span class="tv">${val}</span><div class="tb" style="height:${v == null ? 0 : Math.max(2, (v / max) * 100).toFixed(1)}%"></div><span class="tm">${mo.label}${mo.partial ? `<small>${mo.days} ימים</small>` : ""}</span></div>`;
    }).join("");
    return `<div class="panel trend"><div class="cmp-h"><h3>${name}</h3>${tag}</div><div class="tchart">${cols}</div></div>`;
  }).join("");
}

export function dashboardHtml(insights, pending, now = new Date()) {
  const posts = insights.posts || [];
  const updated = insights.updatedAt ? new Date(insights.updatedAt) : null;
  const down = !updated || now - updated > STALE_MS || (insights.reconnectToldAt && (!updated || new Date(insights.reconnectToldAt) > updated));
  const net = (n) => posts.filter((p) => p.platform === n);
  const withReach = (xs) => xs.filter((p) => p.reach != null);
  const fb = net("facebook"), ig = net("instagram");
  const week = posts.filter((p) => now - new Date(p.at) < 7 * 864e5);

  // לוח: מה שמתוזמן בדף הפייסבוק + הפוסט ששולה מחכה לו ל"כן"
  const sched = (insights.scheduled || []).filter((s) => new Date(s.at) > now).map((s) => ({ at: s.at, text: s.text, net: "פייסבוק", chip: ["ok", "מתוזמן בפייסבוק"] }));
  if (pending?.text) sched.unshift({ at: pending.at, text: pending.text, net: pending.platform === "both" ? "פייסבוק + אינסטגרם" : NET[pending.platform] || "", chip: ["warn", "מחכה ל\"כן\" שלך"], waiting: true });
  const schedRows = sched.length
    ? sched.map((s) => `<div class="item"><span class="t">${s.waiting ? "עכשיו" : esc(when(s.at))}</span><div class="what"><b>${title(s.text)}</b><div class="sub">${esc(s.net)}</div></div><span class="chip ${s.chip[0]}">${s.chip[1]}</span></div>`).join("")
    : `<p class="empty">אין כרגע פוסטים מתוזמנים בדף הפייסבוק ואין פוסט שמחכה לאישור. פוסטים שמתוזמנים ב-Metricool לא מופיעים כאן.</p>`;

  const top = (xs) => withReach(xs).sort((a, b) => b.reach - a.reach).slice(0, 6).map((p) => ({ name: `${title(p.text)} · ${day(p.at)}`, v: p.reach, note: TYPE[p.type] || esc(p.type) }));
  const byType = (xs) => {
    const g = {};
    for (const p of withReach(xs)) (g[TYPE[p.type] || p.type] ||= []).push(p.reach);
    return Object.entries(g).map(([k, rs]) => ({ name: esc(k), v: avg(rs), note: rs.length === 1 ? "פוסט אחד" : `${rs.length} פוסטים` })).sort((a, b) => b.v - a.v);
  };
  const chart = (head, rows, cls) => `<div class="panel chart${cls}"><h3>${head}</h3>${rows.length ? `<div class="bars">${bars(rows)}</div>` : `<p class="empty">אין עדיין נתוני חשיפה. הם יופיעו אחרי הריצה הלילית הבאה.</p>`}</div>`;

  const kpi = (lbl, v, note, cls = "") => v === "לא זמין" ? "" : `<div class="panel kpi${cls}"><span class="lbl">${lbl}</span><span class="val">${esc(v)}</span><span class="note">${note}</span></div>`;
  const f = insights.followers || {};
  const g = insights.gaps || {};
  const reachNote = (xs, gap) => (withReach(xs).length ? `לפוסט, ${withReach(xs).length} פוסטים ב-30 יום` : gap === "permission" ? "חסרה הרשאה — פירוט למטה" : "Meta לא החזירה חשיפה");
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>דשבורד פרסום</title>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;700;800;900&family=Assistant:wght@400;600;700&display=swap" rel="stylesheet">
<style>${CSS}</style></head><body>
<header class="band"><div class="wrap">
  <div><div class="eyebrow">מועדון טניס שולחן מבואות החרמון ע"ש רוני גלבוע</div><h1>דשבורד פרסום</h1><p>נתונים ישירות מפייסבוק ומאינסטגרם</p></div>
  <div class="stamp"><span>נשלף מ-Meta</span><b>${updated ? esc(when(updated.toISOString())) : "עוד לא"}</b><span>מתעדכן כל לילה</span></div>
</div></header>
<main><div class="wrap">
${down ? `<div class="alert" role="alert"><div class="ico">!</div><div><h3>החיבור לפייסבוק ולאינסטגרם לא מעדכן</h3><p>${updated ? `העדכון האחרון היה ב-${esc(when(updated.toISOString()))}.` : "עוד לא נאספו נתונים."} כדי לחבר מחדש, לכתוב לשולה בוואטסאפ "תחברי מחדש את פייסבוק". המספרים כאן ישנים עד שזה מתוקן.</p></div></div>` : `<div class="ok-line"><span class="chip ok">החיבור למטא עובד</span> עודכן ${esc(when(updated.toISOString()))}</div>`}
<section><div class="sec-h"><h2>תמונת מצב</h2></div><div class="kpis">
${kpi("עוקבים בפייסבוק", fmt(f.facebook), "מספר העוקבים בדף")}
${kpi("עוקבים באינסטגרם", fmt(f.instagram), "מספר העוקבים בחשבון")}
${kpi("פוסטים השבוע", week.length, `פייסבוק ${week.filter((p) => p.platform === "facebook").length}, אינסטגרם ${week.filter((p) => p.platform === "instagram").length}`)}
${kpi("חשיפה ממוצעת בפייסבוק", fmt(avg(withReach(fb).map((p) => p.reach))), reachNote(fb, g.fbReach))}
${kpi("חשיפה ממוצעת באינסטגרם", fmt(avg(withReach(ig).map((p) => p.reach))), reachNote(ig, g.igReach))}
</div></section>
${goalHtml(insights, now)}
<section><div class="sec-h"><h2>איך אנחנו לעומת קודם</h2></div><div class="cmps">${compareHtml(insights, now)}</div></section>
<section><div class="sec-h"><h2>מגמה שנתית</h2><span class="meta">12 החודשים האחרונים</span></div><div class="cmps">${trendHtml(insights, now)}</div></section>
<section><div class="sec-h"><h2>מה עולה ומתי</h2><span class="meta">שום דבר לא עולה בלי "כן" שלך</span></div><div class="panel items">${schedRows}</div></section>
<section><div class="sec-h"><h2>הפוסטים החזקים</h2><span class="meta">חשיפה = כמה אנשים שונים ראו, 30 הימים האחרונים</span></div>
<div class="two">${chart("פייסבוק", top(fb), "")}${chart("אינסטגרם", top(ig), " ig")}</div></section>
<section><div class="sec-h"><h2>מה עובד: חשיפה ממוצעת לפי סוג</h2></div>
<div class="two">${chart("פייסבוק", byType(fb), "")}${chart("אינסטגרם", byType(ig), " ig")}</div></section>
${gapsHtml(g)}
</div></main>
<footer><div class="wrap">מקור: Meta (פייסבוק ואינסטגרם), דרך החיבור של שולה. "לא זמין" = Meta לא החזירה את המספר.</div></footer>
</body></html>`;
}

const CSS = `:root{--olive:#3D4617;--lime:#AEC048;--gold:#B79440;--bg:#F7F6EE;--panel:#fff;--panel-2:#F1F0E5;--line:#E4E2D3;--ink:#23280E;--ink-2:#4E5436;--ink-3:#7A7F63;--bar:#3D4617;--bar-ig:#8EA035;--track:#EEEDE2;--ok:#2E7D32;--ok-bg:#E4F1E2;--warn:#8F5B00;--warn-bg:#FAEDD0;--bad:#B3261E;--bad-bg:#FBE4E1}
@media (prefers-color-scheme:dark){:root{--bg:#13160A;--panel:#1C2110;--panel-2:#232914;--line:#2F3619;--ink:#F0F0E4;--ink-2:#C8CBB2;--ink-3:#979C7E;--bar:#AEC048;--bar-ig:#D7E39A;--track:#262C15;--ok:#86CF8A;--ok-bg:#1B301D;--warn:#E8B860;--warn-bg:#382B10;--bad:#F3958D;--bad-bg:#3C1916;color-scheme:dark}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 Assistant,Heebo,system-ui,sans-serif}
.wrap{max-width:1100px;margin:0 auto;padding-inline:max(16px,env(safe-area-inset-left,0px))}
h1,h2,h3{font-family:Heebo,system-ui,sans-serif;margin:0}
.band{position:relative;color:#fff;padding-bottom:30px}.band:before{content:"";position:absolute;inset:0 0 -10px;background:linear-gradient(90deg,#9C7C30,var(--gold));clip-path:polygon(0 0,100% 0,100% 88%,0 100%)}.band:after{content:"";position:absolute;inset:0;background:var(--olive);clip-path:polygon(0 0,100% 0,100% 82%,0 100%)}
.band .wrap{position:relative;z-index:1;display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:16px;padding-block:24px 8px}
.eyebrow{font:700 13px Heebo,sans-serif;color:var(--lime)}.band h1{font-weight:900;font-size:clamp(30px,5vw,42px)}.band p{margin:4px 0 0;opacity:.85}
.stamp{display:flex;flex-direction:column;gap:2px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.22);border-radius:10px;padding:8px 14px;font-size:13px}.stamp b{font:800 17px Heebo,sans-serif}
main .wrap{display:flex;flex-direction:column;gap:28px;padding-block:26px 30px}section{display:flex;flex-direction:column;gap:12px;min-width:0}
.sec-h{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:10px}.sec-h h2{font-size:21px;display:flex;align-items:center;gap:10px}.sec-h h2:before{content:"";width:6px;height:20px;border-radius:2px;background:var(--lime)}.meta{font-size:13px;color:var(--ink-3)}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:14px;min-width:0}
.alert{display:flex;gap:14px;padding:16px 18px;border-radius:14px;background:var(--bad-bg);border-inline-start:6px solid var(--bad)}.alert .ico{flex:none;width:36px;height:36px;border-radius:50%;background:var(--bad);color:var(--bad-bg);display:grid;place-items:center;font:900 20px Heebo}.alert h3{color:var(--bad);font-size:18px}.alert p{margin:4px 0 0}
.ok-line{font-size:14px;color:var(--ink-3);display:flex;gap:10px;align-items:center}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}.kpi{padding:16px;display:flex;flex-direction:column;gap:4px}.kpi .lbl{font-size:14px;font-weight:600;color:var(--ink-2)}.kpi .val{font:900 34px/1.1 Heebo,sans-serif;font-variant-numeric:tabular-nums}.kpi .note{font-size:13px;color:var(--ink-3)}
.chip{display:inline-flex;align-items:center;gap:5px;font-weight:700;font-size:12.5px;padding:3px 10px;border-radius:999px;white-space:nowrap}.chip:before{content:"";width:7px;height:7px;border-radius:50%;background:currentColor}.ok{background:var(--ok-bg);color:var(--ok)}.warn{background:var(--warn-bg);color:var(--warn)}
.items{display:flex;flex-direction:column}.item{display:grid;grid-template-columns:110px 1fr auto;gap:12px;align-items:center;padding:12px 16px;border-top:1px solid var(--line)}.item:first-child{border-top:0}.item .t{font:700 14px Heebo,sans-serif;color:var(--ink-2)}.item .what{min-width:0}.item .sub{font-size:13px;color:var(--ink-3)}
.empty{margin:0;padding:16px;color:var(--ink-3);font-size:14px}
.two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.chart{padding:18px;display:flex;flex-direction:column;gap:12px}.chart h3{font-size:16px}
.bars{display:flex;flex-direction:column;gap:10px}.brow{display:grid;grid-template-columns:minmax(120px,44%) 1fr;gap:12px;align-items:center;font-size:14px}.brow .name{color:var(--ink-2);line-height:1.25;min-width:0;overflow-wrap:anywhere}.brow small{display:block;color:var(--ink-3);font-size:12px}
.track{position:relative;height:24px;background:var(--track);border-radius:4px}.bar{position:absolute;inset-inline-start:0;top:0;bottom:0;background:var(--bar);border-radius:4px;min-width:3px}.ig .bar{background:var(--bar-ig)}.bval{position:absolute;top:50%;transform:translateY(-50%);font:800 13px Heebo,sans-serif;font-variant-numeric:tabular-nums}.bval.in{color:var(--panel)}
.cmps{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.cmps>:last-child:nth-child(odd){grid-column:1/-1}@media (max-width:720px){.cmps{grid-template-columns:minmax(0,1fr)}}.cmp{padding:16px;display:flex;flex-direction:column;gap:10px}.cmp-h{display:flex;justify-content:space-between;align-items:baseline;gap:8px}.cmp h3{font-size:16px}.verdict{font:800 13px Heebo,sans-serif;display:flex;gap:8px}
.cmp table{width:100%;border-collapse:collapse;font-size:14px;font-variant-numeric:tabular-nums}.cmp th,.cmp td{padding:7px 4px;border-top:1px solid var(--line);text-align:start}.cmp thead th{border-top:0;font-size:12px;color:var(--ink-3);font-weight:600}.cmp tbody th{font-weight:600;color:var(--ink-2)}.cmp td{font-weight:700;white-space:nowrap}
.up{color:var(--ok)}.down{color:var(--bad)}.flat,.na{color:var(--ink-3)}
.gaps{padding:14px 18px}.gaps ul{margin:0;padding-inline-start:18px;display:flex;flex-direction:column;gap:6px}.gaps p{margin:10px 0 0;font-size:14px}.gaps code{font-size:13px;background:var(--panel-2);padding:1px 6px;border-radius:4px}
.legend{display:flex;gap:14px;font-size:12px;color:var(--ink-3)}.legend span:before{content:"";display:inline-block;width:10px;height:10px;border-radius:2px;margin-inline-end:5px;vertical-align:-1px}.legend .nowb:before{background:var(--bar)}.legend .befb:before{background:var(--lime);opacity:.55}
.crow{display:flex;flex-direction:column;gap:3px;padding-top:8px;border-top:1px solid var(--line)}.cname{display:flex;justify-content:space-between;gap:8px;font-size:14px;font-weight:600;color:var(--ink-2)}.cname span{font:800 13px Heebo,sans-serif;white-space:nowrap}
.pair{display:flex;align-items:center;gap:8px;height:18px}.pbar{height:100%;border-radius:3px;min-width:3px}.nowb .pbar{background:var(--bar)}.befb .pbar{background:var(--lime);opacity:.55}.pair b{font:800 12.5px Heebo,sans-serif;font-variant-numeric:tabular-nums}
.trend{padding:16px;display:flex;flex-direction:column;gap:10px}.trend h3{font-size:15px}.trend .cmp-h span{font:800 12.5px Heebo,sans-serif}
.tchart{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:4px;height:130px;align-items:end}.tcol{display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:100%;gap:3px;min-width:0}.tb{width:100%;background:var(--bar);opacity:.8;border-radius:3px 3px 0 0}.part .tb{background:repeating-linear-gradient(135deg,var(--bar-ig) 0 4px,transparent 4px 7px);border:1.5px dashed var(--bar-ig);border-bottom:0;opacity:1}.tm small{display:block;font-size:9px;line-height:1}.tv{font:700 9.5px Heebo,sans-serif;color:var(--ink-3);letter-spacing:-.3px;white-space:nowrap}.tm{font-size:10.5px;color:var(--ink-3)}
.goal{padding:14px 18px;display:flex;flex-direction:column;gap:10px}.grow{display:grid;grid-template-columns:70px 1fr auto;gap:10px;align-items:center;font-weight:600}.gtrack{height:14px;background:var(--track);border-radius:7px;overflow:hidden}.gbar{height:100%;background:var(--bar)}.gbar.hit{background:var(--ok)}.grow b{font:800 14px Heebo,sans-serif;font-variant-numeric:tabular-nums}
footer{background:var(--olive);color:#E9ECD6;font-size:13px}footer .wrap{padding-block:14px}
@media (max-width:720px){.two{grid-template-columns:minmax(0,1fr)}.item{grid-template-columns:1fr}.item .chip{justify-self:start}}`;
