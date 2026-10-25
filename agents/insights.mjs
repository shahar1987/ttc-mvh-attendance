// 📈 נתונים יומיים: לכל פוסט מ-30 הימים האחרונים בפייסבוק ובאינסטגרם — חשיפה, לייקים, תגובות, שיתופים ושמירות.
// קריאה בלבד מ-Meta (שום פרסום ושום שינוי בדף). נשמר ב-agentReports/insights, ומשם סוכן הפרסום בונה
// את הדוח של יום ראשון ולומד מה עבד. ביומן (ציבורי) מודפסים רק מספרים.
import { fileURLToPath } from "node:url";

const GRAPH = "https://graph.facebook.com/v24.0";
const DAYS = 30;

const getJson = async (url) => {
  const r = await fetch(url);
  const j = await r.json();
  if (!r.ok || j.error) throw Object.assign(new Error(j.error?.message || `Meta ${r.status}`), { code: j.error?.code });
  return j;
};

// מדדים ש-Meta משנה מדי פעם: מנסים כמה צירופים, ומה שנכשל פשוט חסר (לא מפיל את הריצה)
async function firstOk(urls, get) {
  let err;
  for (const u of urls) {
    try { return await get(u); } catch (e) { err = e; }
  }
  throw err;
}

// למה מספר חסר — כדי שהדשבורד יגיד מה לתקן, לא רק "לא זמין"
export const gapReason = (e) => {
  const m = `${e?.code ?? ""} ${e?.message || ""}`;
  if (/^(10|200|190)\b|permission|requires/i.test(m)) return "permission";
  if (/^100\b|invalid|metric|deprecat/i.test(m)) return "metric";
  return "error";
};

export async function collect(page, now = new Date(), get = getJson, gaps = {}) {
  const since = new Date(now.getTime() - DAYS * 864e5);
  const t = page.token;
  const posts = [];
  const base = "id,message,created_time,permalink_url,shares,attachments{media_type}";
  // לייקים ותגובות דורשים pages_read_user_content (נבדק 11.10: בלי ההרשאה Meta מחזירה #10 רק על שני השדות האלה).
  // כשההרשאה תתווסף באפליקציה ב-Meta — הצירוף המלא יעבוד מעצמו; עד אז נאספים הפוסטים והשיתופים.
  const full = `${base},reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0)`;
  // חשיפה (אנשים שונים) לכל פוסט. post_impressions_unique בוטל ב-15.6.2026 — המדד החדש קודם, הישן כגיבוי
  const reaches = ["post_total_media_view_unique", "post_impressions_unique"].map((m) => `insights.metric(${m}){values}`);
  const fields = [...reaches.flatMap((r) => [`${full},${r}`, `${base},${r}`]), full, base];
  let reachErr;
  const fb = await firstOk(
    fields.map((f) => `${GRAPH}/${page.id}/posts?fields=${f}&since=${Math.floor(since / 1000)}&limit=50&access_token=${t}`),
    async (u) => {
      try { return await get(u); } catch (e) { if (u.includes("insights.metric")) reachErr ||= e; throw e; }
    },
  ).catch((e) => {
    if (tokenDead(e)) throw e;
    // פייסבוק נכשל מסיבה אחרת (הרשאה/שינוי של Meta) — אינסטגרם עדיין נאסף, לא מפילים את הריצה
    console.error(`insights: facebook skipped (${e.code ?? "?"})`);
    return { data: [] };
  });
  for (const p of fb.data || []) {
    posts.push({
      platform: "facebook", id: p.id, at: new Date(p.created_time).toISOString(), link: p.permalink_url || "",
      type: String(p.attachments?.data?.[0]?.media_type || "text").toLowerCase(),
      text: (p.message || "").slice(0, 80),
      reach: p.insights?.data?.[0]?.values?.[0]?.value ?? null,
      // null = לא ידוע (חסרה הרשאה), לא אפס
      likes: p.reactions ? p.reactions.summary?.total_count || 0 : null, comments: p.comments ? p.comments.summary?.total_count || 0 : null, shares: p.shares?.count || 0, saves: null,
    });
  }
  const fbPosts = posts.filter((p) => p.platform === "facebook");
  if (fbPosts.length && fbPosts.every((p) => p.reach == null)) gaps.fbReach = reachErr ? gapReason(reachErr) : "metric";
  if (fbPosts.some((p) => p.likes == null)) gaps.fbLikes = "permission";
  if (page.ig) {
    const ig = await get(`${GRAPH}/${page.ig}/media?fields=id,caption,timestamp,media_type,like_count,comments_count,permalink&limit=50&access_token=${t}`).catch((e) => {
      if (tokenDead(e)) throw e;
      console.error(`insights: instagram skipped (${e.code ?? "?"})`);
      return { data: [] };
    });
    for (const m of (ig.data || []).filter((m) => new Date(m.timestamp) >= since)) {
      const ins = await firstOk(["reach,saved,shares,views", "reach,saved,shares", "reach,saved"].map((x) => `${GRAPH}/${m.id}/insights?metric=${x}&access_token=${t}`), get).catch((e) => {
        gaps.igReach ||= gapReason(e);
        return { data: [] };
      });
      const v = (name) => ins.data?.find((d) => d.name === name)?.values?.[0]?.value ?? null;
      posts.push({
        platform: "instagram", id: m.id, at: new Date(m.timestamp).toISOString(), link: m.permalink || "",
        type: String(m.media_type || "").toLowerCase().replace("carousel_album", "album"),
        text: (m.caption || "").slice(0, 80),
        reach: v("reach"), views: v("views"), likes: m.like_count || 0, comments: m.comments_count || 0, shares: v("shares") || 0, saves: v("saved"),
      });
    }
  }
  return posts.sort((a, b) => b.at.localeCompare(a.at));
}

// לדשבורד: עוקבים בשתי הרשתות ופוסטים שמתוזמנים בדף הפייסבוק עצמו. קריאה בלבד; מה שנכשל נשאר null (לא ידוע, לא אפס).
export async function account(page, get = getJson) {
  const t = page.token;
  const safe = (u) => get(u).catch((e) => {
    if (tokenDead(e)) throw e;
    return null;
  });
  const fb = await safe(`${GRAPH}/${page.id}?fields=followers_count,fan_count&access_token=${t}`);
  const ig = page.ig ? await safe(`${GRAPH}/${page.ig}?fields=followers_count&access_token=${t}`) : null;
  const sched = await safe(`${GRAPH}/${page.id}/scheduled_posts?fields=id,message,scheduled_publish_time&limit=50&access_token=${t}`);
  return {
    followers: { facebook: fb?.followers_count ?? fb?.fan_count ?? null, instagram: ig?.followers_count ?? null },
    scheduled: sched
      ? (sched.data || []).map((s) => ({ at: new Date(Number(s.scheduled_publish_time) * 1000).toISOString(), text: (s.message || "").slice(0, 80) })).sort((a, b) => a.at.localeCompare(b.at))
      : null,
  };
}

// להשוואות (שבוע / חודש / שנה שעברה): 400 יום אחורה. כל מה שנכשל נשאר חסר ונרשם ב-gaps, לא מפיל את הריצה.
export const HISTORY_DAYS = 400;
const ymd = (d) => new Date(d).toISOString().slice(0, 10);
// Meta מחזירה ערך יומי עם end_time של סוף היום — היום עצמו הוא היום שלפניו
const dayOf = (endTime) => ymd(new Date(endTime).getTime() - 864e5);

// כל הפוסטים בשנה וחודש האחרונים, בגרסה קלה: מתי, איפה, לייקים+תגובות+שיתופים (null = לא ידוע)
export async function history(page, now = new Date(), get = getJson, gaps = {}) {
  const since = Math.floor((now.getTime() - HISTORY_DAYS * 864e5) / 1000);
  const t = page.token;
  const out = [];
  const pages = async (first, keep) => {
    let url = first;
    for (let i = 0; url && i < 20; i++) {
      const j = await get(url);
      const rows = j.data || [];
      out.push(...rows.filter(keep).map(keep.map));
      if (rows.length && !keep(rows[rows.length - 1])) break;
      url = j.paging?.next;
    }
  };
  const fbKeep = Object.assign(() => true, {
    map: (p) => ({ p: "f", at: new Date(p.created_time).toISOString(), e: p.reactions ? (p.reactions.summary?.total_count || 0) + (p.comments?.summary?.total_count || 0) + (p.shares?.count || 0) : null }),
  });
  const fbFields = ["created_time,shares,reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0)", "created_time,shares"];
  let fbDone = false;
  for (const f of fbFields) {
    try {
      await pages(`${GRAPH}/${page.id}/posts?fields=${f}&since=${since}&limit=100&access_token=${t}`, fbKeep);
      fbDone = true;
      break;
    } catch (e) {
      if (tokenDead(e)) throw e;
      out.length = 0;
    }
  }
  if (!fbDone) gaps.fbHistory = "error";
  if (page.ig) {
    const igKeep = Object.assign((m) => new Date(m.timestamp) >= since * 1000, {
      map: (m) => ({ p: "i", at: new Date(m.timestamp).toISOString(), e: (m.like_count || 0) + (m.comments_count || 0) }),
    });
    await pages(`${GRAPH}/${page.ig}/media?fields=timestamp,like_count,comments_count&limit=100&access_token=${t}`, igKeep).catch((e) => {
      if (tokenDead(e)) throw e;
      gaps.igHistory = gapReason(e);
    });
  }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}

// ערכים יומיים ברמת החשבון: { "2026-10-23": 412, ... }. Meta מגבילה טווח לבקשה (פייסבוק 90 יום, אינסטגרם 30) — מחלקים לחלונות.
async function daily(urlFor, metrics, windowDays, now, get) {
  let lastErr;
  for (const metric of metrics) {
    const out = {};
    try {
      for (let end = now.getTime(); end > now.getTime() - HISTORY_DAYS * 864e5; end -= windowDays * 864e5) {
        const until = Math.floor(end / 1000), since = until - windowDays * 86400;
        const j = await get(urlFor(metric, since, until));
        for (const v of j.data?.[0]?.values || []) if (typeof v.value === "number") out[dayOf(v.end_time)] = v.value;
      }
      if (Object.keys(out).length) return out;
    } catch (e) {
      if (tokenDead(e)) throw e;
      lastErr = e;
      // החלון הראשון עבד ורק ההיסטוריה העמוקה נחסמה — שומרים מה שיש
      if (Object.keys(out).length) return out;
    }
  }
  throw lastErr || new Error("no data");
}

export async function trends(page, now = new Date(), get = getJson, gaps = {}) {
  const t = page.token;
  const fbUrl = (m, s, u) => `${GRAPH}/${page.id}/insights?metric=${m}&period=day&since=${s}&until=${u}&access_token=${t}`;
  const igUrl = (m, s, u) => `${GRAPH}/${page.ig}/insights?metric=${m}&period=day&since=${s}&until=${u}&access_token=${t}`;
  const series = {};
  const take = async (key, fn) => {
    try { series[key] = await fn(); } catch (e) { if (tokenDead(e)) throw e; gaps[key] = gapReason(e); }
  };
  await take("fbReach", () => daily(fbUrl, ["page_total_media_view_unique", "page_impressions_unique"], 90, now, get));
  await take("fbFollows", () => daily(fbUrl, ["page_daily_follows_unique", "page_fan_adds_unique"], 90, now, get));
  if (page.ig) await take("igReach", () => daily(igUrl, ["reach"], 30, now, get));
  return series;
}

// יומן עוקבים משלנו: צילום אחד ליום. ככה ההשוואה לשנה שעברה תעבוד גם אם Meta לא מחזירה היסטוריה.
export function logFollowers(log = {}, followers = {}, now = new Date()) {
  const next = { ...log };
  if (followers.facebook != null || followers.instagram != null) next[ymd(now)] = { facebook: followers.facebook ?? null, instagram: followers.instagram ?? null };
  const cutoff = ymd(now.getTime() - 800 * 864e5);
  for (const d of Object.keys(next)) if (d < cutoff) delete next[d];
  return next;
}

const engagement = (p) => p.likes + p.comments + p.shares + (p.saves || 0);
const ilHour = (iso) => Number(new Date(iso).toLocaleString("en-US", { timeZone: "Asia/Jerusalem", hour: "2-digit", hour12: false })) % 24;
const ilDay = (iso) => new Date(iso).toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem", weekday: "long" });
const TYPE = { photo: "תמונה", image: "תמונה", video: "סרטון", reels: "רילס", album: "אלבום", text: "טקסט" };
const avg = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;

// הגרסה הקצרה לוואטסאפ: מה עבד השבוע, באיזו שעה ואיזה סוג (השעה והסוג לפי 30 יום — שבוע אחד קטן מדי)
export function weeklyReport(posts, now = new Date()) {
  const week = posts.filter((p) => now - new Date(p.at) < 7 * 864e5);
  if (!week.length) return "השבוע לא עלו פוסטים, אז אין מה למדוד.";
  const fb = week.filter((p) => p.platform === "facebook").length;
  const reach = week.filter((p) => p.reach != null).reduce((s, p) => s + p.reach, 0);
  const best = [...week].sort((a, b) => engagement(b) - engagement(a))[0];
  const lines = [
    `השבוע עלו ${week.length} פוסטים (פייסבוק ${fb}, אינסטגרם ${week.length - fb})${reach ? `, חשיפה כוללת ${reach}` : ""}.`,
    `הכי טוב: ${best.platform === "facebook" ? "פייסבוק" : "אינסטגרם"}, ${ilDay(best.at)} ${ilHour(best.at)}:00 — "${best.text.split("\n")[0].slice(0, 50)}" (${best.likes ?? "?"} לייקים, ${best.comments ?? "?"} תגובות${best.saves ? `, ${best.saves} שמירות` : ""}).`,
  ];
  const by = (key) => {
    const g = {};
    for (const p of posts) (g[key(p)] ||= []).push(engagement(p));
    return Object.entries(g).filter(([, xs]) => xs.length >= 2).sort((a, b) => avg(b[1]) - avg(a[1]))[0];
  };
  const hour = by((p) => ilHour(p.at));
  if (hour) lines.push(`השעה שעבדה הכי טוב בחודש האחרון: ${hour[0]}:00 (ממוצע ${Math.round(avg(hour[1]))} תגובות ולייקים).`);
  const type = by((p) => TYPE[p.type] || p.type);
  if (type) lines.push(`הסוג שעבד הכי טוב: ${type[0]}.`);
  return lines.join("\n");
}

// 190 = טוקן לא תקף (פג, בוטל, הוחלפה סיסמה)
export const tokenDead = (e) => e?.code === 190 || /access token/i.test(e?.message || "");
export const REMIND_EVERY_DAYS = 3;
export const shouldRemind = (lastIso, now = new Date()) => !lastIso || now - new Date(lastIso) >= REMIND_EVERY_DAYS * 864e5;
export const RECONNECT = "⚠️ החיבור של שולה לפייסבוק ולאינסטגרם נותק (Meta ביטלה אותו, למשל אחרי החלפת סיסמה). עד שמחברים מחדש שולה לא יכולה לפרסם ולא לאסוף נתוני פוסטים.\nלתיקון: לכתוב לשולה \"תחברי מחדש את פייסבוק\" ולפתוח את הקישור שתשלח (בתוקף 30 דקות).";

async function main() {
  const { firestore, heartbeat, reportMissingKey } = await import("./lib/firebase.mjs");
  const db = firestore();
  const social = (await db.collection("agentReports").doc("social").get()).data() || {};
  const { clubPage } = await import("./lib/club.mjs");
  const page = clubPage(social);
  if (!page?.token) return console.log("insights: club page not connected");
  let posts, acc, past, series;
  const gaps = {};
  try {
    posts = await collect(page, new Date(), getJson, gaps);
    acc = await account(page);
    past = await history(page, new Date(), getJson, gaps);
    series = await trends(page, new Date(), getJson, gaps);
  } catch (e) {
    if (!tokenDead(e)) throw e;
    // הטוקן מת (החלפת סיסמה / Meta ביטלה) — רק הבעלים יכול לחבר מחדש. אומרים לו מה לעשות, פעם אחת, וההתראה הכללית מדלגת
    // לא מכשילים את הריצה (אחרת מגיעה עוד התראת "סוכן נכשל" כל בוקר) ומזכירים לחבר מחדש לכל היותר פעם ב-3 ימים
    console.error("insights: Meta token invalid — owner must reconnect");
    const ref = db.collection("agentReports").doc("insights");
    const last = (await ref.get()).data()?.reconnectToldAt;
    if (shouldRemind(last)) {
      const { tellOwner } = await import("./lib/owner.mjs");
      await tellOwner(db, { agent: "insights", text: RECONNECT }).catch((err) => console.error(err.message));
      await ref.set({ reconnectToldAt: new Date().toISOString() }, { merge: true });
    }
    await heartbeat(db, "insights");
    await reportMissingKey(db, "insights", "META_TOKEN").catch((err) => console.error(err.message)); // אחרי heartbeat — הוא מוחק את הדגל
    return;
  }
  // reconnectToldAt: null — החיבור עובד, אז בפעם הבאה שיתנתק מזכירים מיד
  const ref = db.collection("agentReports").doc("insights");
  const followersLog = logFollowers((await ref.get()).data()?.followersLog, acc.followers);
  await ref.set({ updatedAt: new Date().toISOString(), posts, ...acc, history: past, series, followersLog, gaps, reconnectToldAt: null });
  console.log(`insights: ${posts.length} posts, ${past.length} in history, series ${Object.keys(series).join("+") || "none"}, gaps ${Object.keys(gaps).join("+") || "none"}`);
  await heartbeat(db, "insights");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
