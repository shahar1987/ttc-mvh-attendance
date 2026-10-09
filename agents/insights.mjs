// 📈 נתונים יומיים: לכל פוסט מ-30 הימים האחרונים בפייסבוק ובאינסטגרם — חשיפה, לייקים, תגובות, שיתופים ושמירות.
// קריאה בלבד מ-Meta (שום פרסום ושום שינוי בדף). נשמר ב-agentReports/insights, ומשם סוכן הפרסום בונה
// את הדוח של יום ראשון ולומד מה עבד. ביומן (ציבורי) מודפסים רק מספרים.
import { fileURLToPath } from "node:url";

const GRAPH = "https://graph.facebook.com/v24.0";
const DAYS = 30;

const getJson = async (url) => {
  const r = await fetch(url);
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error?.message || `Meta ${r.status}`);
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

export async function collect(page, now = new Date(), get = getJson) {
  const since = new Date(now.getTime() - DAYS * 864e5);
  const t = page.token;
  const posts = [];
  const base = "id,message,created_time,permalink_url,shares,reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0),attachments{media_type}";
  const fb = await firstOk(
    [`${base},insights.metric(post_impressions_unique)`, base].map((f) => `${GRAPH}/${page.id}/posts?fields=${f}&since=${Math.floor(since / 1000)}&limit=50&access_token=${t}`),
    get,
  );
  for (const p of fb.data || []) {
    posts.push({
      platform: "facebook", id: p.id, at: new Date(p.created_time).toISOString(), link: p.permalink_url || "",
      type: String(p.attachments?.data?.[0]?.media_type || "text").toLowerCase(),
      text: (p.message || "").slice(0, 80),
      reach: p.insights?.data?.[0]?.values?.[0]?.value ?? null,
      likes: p.reactions?.summary?.total_count || 0, comments: p.comments?.summary?.total_count || 0, shares: p.shares?.count || 0, saves: null,
    });
  }
  if (page.ig) {
    const ig = await get(`${GRAPH}/${page.ig}/media?fields=id,caption,timestamp,media_type,like_count,comments_count,permalink&limit=50&access_token=${t}`);
    for (const m of (ig.data || []).filter((m) => new Date(m.timestamp) >= since)) {
      const ins = await firstOk(["reach,saved,shares", "reach,saved"].map((x) => `${GRAPH}/${m.id}/insights?metric=${x}&access_token=${t}`), get).catch(() => ({ data: [] }));
      const v = (name) => ins.data?.find((d) => d.name === name)?.values?.[0]?.value ?? null;
      posts.push({
        platform: "instagram", id: m.id, at: new Date(m.timestamp).toISOString(), link: m.permalink || "",
        type: String(m.media_type || "").toLowerCase().replace("carousel_album", "album"),
        text: (m.caption || "").slice(0, 80),
        reach: v("reach"), likes: m.like_count || 0, comments: m.comments_count || 0, shares: v("shares") || 0, saves: v("saved"),
      });
    }
  }
  return posts.sort((a, b) => b.at.localeCompare(a.at));
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
    `הכי טוב: ${best.platform === "facebook" ? "פייסבוק" : "אינסטגרם"}, ${ilDay(best.at)} ${ilHour(best.at)}:00 — "${best.text.split("\n")[0].slice(0, 50)}" (${best.likes} לייקים, ${best.comments} תגובות${best.saves ? `, ${best.saves} שמירות` : ""}).`,
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

async function main() {
  const { firestore, heartbeat } = await import("./lib/firebase.mjs");
  const db = firestore();
  const social = (await db.collection("agentReports").doc("social").get()).data() || {};
  const page = (social.pages || []).find((p) => p.ig) || social.pages?.[0];
  if (!page?.token) return console.log("insights: page not connected");
  const posts = await collect(page);
  await db.collection("agentReports").doc("insights").set({ updatedAt: new Date().toISOString(), posts });
  console.log(`insights: ${posts.length} posts`);
  await heartbeat(db, "insights");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
