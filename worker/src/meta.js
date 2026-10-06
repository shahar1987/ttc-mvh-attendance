// 📣 פרסום לדף הפייסבוק ולאינסטגרם של המועדון, דרך אפליקציית Meta של שולה (אותה אפליקציה של הוואטסאפ).
// חיבור חד-פעמי: שולה שולחת לבעלים קישור /meta/start, הוא מאשר בפייסבוק, וטוקני הדפים נשמרים
// ב-agentReports/social (האוסף חסום לאפליקציה בחוקי Firestore). טוקן דף שמגיע מטוקן משתמש ארוך לא פג.
// מה מותר: לפרסם רק אחרי "כן" מפורש בהודעה האחרונה, על טקסט ותמונה שהוצגו לו. אין מחיקה ואין עריכה.
import { confirmed } from "./tools.js";
import { sign, issueKey, checkKey, dropKey } from "./google.js";
import { waConfig } from "../../agents/lib/whatsapp.mjs";
import { israelToUtc } from "./time.js";

const GRAPH = "https://graph.facebook.com/v24.0";
const SCOPES = "pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish,business_management";
export const metaLink = async (store, origin) => `${origin}/meta/start?k=${await issueKey(store, "meta")}`;
const mediaUrl = async (env, origin, id) => `${origin}/meta/media/${id}?t=${await sign(env, `media:${id}`)}`;

// /meta/start, /meta/callback, /meta/media/<id של תמונה מהוואטסאפ> (כדי שאינסטגרם תוכל להוריד אותה)
export async function metaRoute(req, env, store) {
  const url = new URL(req.url);
  if (url.pathname.startsWith("/meta/media/")) {
    const id = url.pathname.split("/").pop();
    if (url.searchParams.get("t") !== (await sign(env, `media:${id}`))) return new Response("forbidden", { status: 403 });
    // הזרמה ישירה מוואטסאפ (בלי base64 בזיכרון) — סרטון יכול להגיע ל-16MB
    const auth = { Authorization: `Bearer ${waConfig(env).token}` };
    const meta = await (await fetch(`${GRAPH}/${id}`, { headers: auth })).json();
    if (!meta.url) return new Response("not found", { status: 404 });
    const res = await fetch(meta.url, { headers: auth });
    return new Response(res.body, { status: res.status, headers: { "content-type": (meta.mime_type || "").split(";")[0] } });
  }
  const key = url.searchParams.get(url.pathname === "/meta/callback" ? "state" : "k");
  if (!(await checkKey(store, "meta", key))) return new Response("forbidden", { status: 403 });
  const redirect = `${url.origin}/meta/callback`;
  if (url.pathname === "/meta/start") {
    return Response.redirect(`https://www.facebook.com/v24.0/dialog/oauth?${new URLSearchParams({ client_id: env.META_APP_ID, redirect_uri: redirect, scope: SCOPES, state: key })}`, 302);
  }
  const get = async (path, q) => (await fetch(`${GRAPH}/${path}?${new URLSearchParams(q)}`)).json();
  const app = { client_id: env.META_APP_ID, client_secret: env.META_APP_SECRET };
  const short = await get("oauth/access_token", { ...app, redirect_uri: redirect, code: url.searchParams.get("code") || "" });
  const long = short.access_token && (await get("oauth/access_token", { ...app, grant_type: "fb_exchange_token", fb_exchange_token: short.access_token }));
  const pages = long?.access_token && (await get("me/accounts", { fields: "id,name,access_token,instagram_business_account{id,username}", access_token: long.access_token }));
  if (!pages?.data?.length) return html(`החיבור נכשל: ${short.error?.message || pages?.error?.message || "לא נמצא דף פייסבוק שאתה מנהל"}.`, 400);
  await store.merge("agentReports/social", {
    pages: pages.data.map((p) => ({ id: p.id, name: p.name, token: p.access_token, ig: p.instagram_business_account?.id || "", igName: p.instagram_business_account?.username || "" })),
    connectedAt: new Date().toISOString(),
  });
  await dropKey(store, "meta");
  return html(`✅ שולה מחוברת ל: ${pages.data.map((p) => p.name + (p.instagram_business_account ? ` + אינסטגרם @${p.instagram_business_account.username}` : "")).join(", ")}. אפשר לחזור לוואטסאפ.`);
}
const html = (msg, status = 200) => new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><body dir="rtl" style="font:20px system-ui;padding:24px">${msg}</body>`, { status, headers: { "content-type": "text/html; charset=utf-8" } });

export const META_TOOL_DEFS = [
  {
    name: "publish_post",
    description:
      "מפרסם (או מתזמן) פוסט בדף הפייסבוק ו/או באינסטגרם של המועדון. כשהבעלים מבקש לחבר את פייסבוק/אינסטגרם — לקרוא לכלי בלי לפרסם כדי לקבל את קישור החיבור. מפרסם רק אחרי שהבעלים ענה 'כן' על הנוסח המדויק, התמונה, הפלטפורמה והמועד שהצגת לו. text = נוסח הפייסבוק, בלי @ (בפייסבוק תיוג דרך ה-API לא עובד — כותבים את השמות במילים). instagram_text = נוסח האינסטגרם עם התיוגים (@); אם חסר — text. image = מזהה התמונה מהוואטסאפ (מופיע ב-[תמונה id=...]) או קישור ישיר לתמונה. video = מזהה הסרטון מהוואטסאפ (מופיע ב-[סרטון id=...]) או קישור ישיר. kind = post (ברירת מחדל) / story (סטורי: תמונה או סרטון, בלי טקסט) / reel (רילס: חייב video). פוסט באינסטגרם חייב תמונה. סרטונים עוברים עיבוד אצל Meta ולכן יוצאים בבדיקה של רבע השעה הקרובה. at = מועד פרסום בשעון ישראל YYYY-MM-DDTHH:MM; בלי at — מיד. טיוטות השבוע של סוכן הפרסום: get_agent_results עם agent=content.",
    input_schema: {
      type: "object",
      properties: {
        platform: { type: "string", enum: ["facebook", "instagram", "both"] },
        kind: { type: "string", enum: ["post", "story", "reel"] },
        text: { type: "string" },
        instagram_text: { type: "string" },
        image: { type: "string" },
        video: { type: "string" },
        at: { type: "string" },
      },
      required: ["platform"],
      additionalProperties: false,
    },
  },
];

// הדף של המועדון: זה שמחובר לאינסטגרם (@ttcmhr). קורטדו מחובר גם — אסור לפרסם אליו.
export const clubPage = (social) => { const ps = social?.pages || []; return ps.find((p) => p.ig) || ps[0]; };

// "2026-10-11T17:00" בשעון ישראל → Date (UTC). פונקציה אחת משותפת (time.js), נשארת מיוצאת גם מכאן.
export { israelToUtc };

async function graphPost(path, body) {
  const r = await fetch(`${GRAPH}/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error?.message || `Meta ${r.status}`);
  return j;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// סרטון באינסטגרם: Meta מעבדת אותו לפני שאפשר לפרסם. מחכים עד 5 דקות (רק מה-cron — ב-webhook אין זמן לזה).
async function igReady(id, token) {
  for (let i = 0; i < 60; i++) {
    const j = await (await fetch(`${GRAPH}/${id}?fields=status_code&access_token=${token}`)).json();
    if (j.status_code === "FINISHED") return;
    if (j.status_code === "ERROR" || j.error) throw new Error("אינסטגרם לא הצליחה לעבד את הסרטון");
    await sleep(5000);
  }
  throw new Error("אינסטגרם עוד מעבדת את הסרטון אחרי 5 דקות");
}

// סרטון לפייסבוק (סטורי או רילס): פתיחה, Meta מורידה את הקובץ מהקישור, סיום
async function fbVideo(page, edge, url, finish) {
  const { video_id } = await graphPost(`${page.id}/${edge}`, { upload_phase: "start", access_token: page.token });
  const r = await fetch(`https://rupload.facebook.com/video-upload/v24.0/${video_id}`, { method: "POST", headers: { authorization: `OAuth ${page.token}`, file_url: url } });
  if (!r.ok) throw new Error(`העלאת הסרטון לפייסבוק נכשלה (${r.status})`);
  return graphPost(`${page.id}/${edge}`, { upload_phase: "finish", video_id, access_token: page.token, ...finish });
}

// הפרסום עצמו. img/vid כבר קישורים מלאים (גם לתזמון — ב-cron אין origin).
async function publishNow(page, { platform, kind = "post", text, igText, img, vid }) {
  const done = [];
  const t = page.token;
  if (platform !== "instagram") {
    let r;
    if (kind === "story") r = vid ? await fbVideo(page, "video_stories", vid) : await graphPost(`${page.id}/photo_stories`, { photo_id: (await graphPost(`${page.id}/photos`, { url: img, published: false, access_token: t })).id, access_token: t });
    else if (kind === "reel") r = await fbVideo(page, "video_reels", vid, { video_state: "PUBLISHED", description: text });
    else r = img ? await graphPost(`${page.id}/photos`, { url: img, caption: text, access_token: t }) : await graphPost(`${page.id}/feed`, { message: text, access_token: t });
    done.push(`פייסבוק${kind === "post" ? "" : kind === "story" ? " סטורי" : " רילס"} (${page.name}) ✓ ${r.post_id || r.id || r.video_id || ""}`.trim());
  }
  if (platform !== "facebook") {
    if (!page.ig) done.push("אינסטגרם: אין חשבון אינסטגרם עסקי מקושר לדף");
    else if (kind === "post" && !img) done.push("אינסטגרם: חייבים תמונה");
    else {
      const body =
        kind === "story" ? { media_type: "STORIES", ...(vid ? { video_url: vid } : { image_url: img }) }
        : kind === "reel" ? { media_type: "REELS", video_url: vid, caption: igText, share_to_feed: true }
        : { image_url: img, caption: igText };
      const c = await graphPost(`${page.ig}/media`, { ...body, access_token: t });
      if (vid) await igReady(c.id, t);
      const r = await graphPost(`${page.ig}/media_publish`, { creation_id: c.id, access_token: t });
      done.push(`אינסטגרם${kind === "post" ? "" : kind === "story" ? " סטורי" : " רילס"} (@${page.igName}) ✓ ${r.id}`);
    }
  }
  return done.join(" · ");
}

// מה-cron של כל רבע שעה: מפרסם פוסטים מתוזמנים שהגיע זמנם. מחזיר שורות לדיווח לבעלים.
// נגד פוסט כפול (Cloudflare מריץ לפעמים cron פעמיים, ו-publish_post יכול לכתוב לתור באותו רגע):
// קודם "תופסים" את הפוסטים בכתיבה מותנית (status: publishing) — רק ריצה אחת מצליחה לתפוס כל פוסט.
// פוסט שנתפס ולא הסתיים (ה-worker נפל באמצע) לא מתפרסם שוב — אחרי שעה יוצא מהתור עם דיווח לבדוק בדף.
const qid = (q) => q.id || `${q.due}|${q.platform}|${String(q.text || "").slice(0, 40)}`;
export async function publishDue(store, now = new Date()) {
  const stamp = now.toISOString();
  const stale = new Date(now.getTime() - 3600 * 1000).toISOString();
  let claimed = [], stuck = [], page = null;
  await store.update("agentReports/social", (social) => {
    const queue = social.queue || [];
    claimed = queue.filter((q) => q.due <= stamp && q.status !== "publishing");
    stuck = queue.filter((q) => q.status === "publishing" && (q.claimedAt || "") < stale);
    page = clubPage(social);
    if (!claimed.length && !stuck.length) return null;
    const mine = new Set(claimed.map(qid)), gone = new Set(stuck.map(qid));
    // פוסט שנכשל לא חוזר לתור (פוסט כפול גרוע מפוסט שנכשל ומדווח) — כמו קודם
    return { queue: queue.filter((q) => !gone.has(qid(q))).map((q) => (mine.has(qid(q)) ? { ...q, status: "publishing", claimedAt: stamp } : q)) };
  });
  const out = stuck.map((q) => `📣 ${q.at}: ⚠️ לא ידוע אם פורסם (הפרסום נקטע באמצע) — לבדוק בדף ולא לפרסם שוב בלי לבדוק`);
  for (const q of claimed) {
    out.push(`📣 ${q.at}: ${await publishNow(page, q).catch((e) => `נכשל — ${e.message}`)}`);
    await store.update("agentReports/social", (social) => ({ queue: (social.queue || []).filter((x) => !(qid(x) === qid(q) && x.claimedAt === stamp)) }));
  }
  return out;
}

export function makeMetaTools({ env, store, lastOwnerText, origin, turn }) {
  return {
    async publish_post({ platform, kind = "post", text = "", instagram_text, image, video, at }) {
      const social = (await store.get("agentReports/social")) || {};
      const page = clubPage(social);
      if (!page) return `פייסבוק ואינסטגרם עוד לא מחוברים. לשלוח לבעלים את הקישור לחיבור: ${await metaLink(store, origin)}`;
      if (kind === "reel" && !video) return "לרילס צריך סרטון (video).";
      if (kind === "story" && !image && !video) return "לסטורי צריך תמונה או סרטון.";
      if (kind !== "story" && !text.trim()) return "חסר נוסח (text).";
      if (platform !== "instagram" && /@[\w.]+/.test(text)) return "לא פורסם: בפייסבוק @ נשאר טקסט מת. לכתוב בנוסח הפייסבוק את שמות השותפים במילים, בלי @, ואת התיוגים לשים ב-instagram_text.";
      if (at && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(at)) return "at צריך להיות בפורמט YYYY-MM-DDTHH:MM (שעון ישראל).";
      if ((at || new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" })).slice(5, 10) === "10-07") return "לא מפרסמים שיווק ב-7 באוקטובר. להציע לבעלים מועד אחר.";
      if (!(await confirmed(store, "post", { platform, kind, text, instagram_text, image, video, at }, lastOwnerText, turn)))
        return "עוד לא פורסם. להציג לבעלים בדיוק את הנוסח (פייסבוק ואינסטגרם), התמונה, הפלטפורמה והמועד ולשאול \"לפרסם?\". אחרי \"כן\" — לקרוא שוב עם אותם פרטים בדיוק.";
      const link = async (m) => m && (/^https?:\/\//.test(m) ? m : await mediaUrl(env, origin, m.replace(/\D/g, "")));
      const vid = await link(video);
      const item = { platform, kind, text, igText: instagram_text || text, img: (await link(image)) || "", vid: vid || "" };
      // סרטון תמיד דרך התור: העיבוד אצל Meta לוקח יותר זמן ממה שמותר ל-webhook
      if (vid || (at && israelToUtc(at) > new Date(Date.now() + 10 * 60 * 1000))) {
        const due = (at ? israelToUtc(at) : new Date()).toISOString();
        const id = Math.random().toString(36).slice(2, 8);
        // קוראים את התור מחדש רגע לפני הכתיבה (כתיבה מותנית) — כדי לא לדרוס פוסט שה-cron תפס או הוציא בינתיים
        await store.update("agentReports/social", (cur) => ({ queue: [...(cur.queue || []), { ...item, at, due, id }] }));
        if (!at) return "בתור — הסרטון יעלה בבדיקה של רבע השעה הקרובה (Meta צריכה לעבד אותו), ואעדכן כשפורסם.";
        return `מתוזמן ל-${at.replace("T", " ")} (${platform === "both" ? "פייסבוק + אינסטגרם" : platform}). יתפרסם אוטומטית ואעדכן.`;
      }
      return `פורסם: ${await publishNow(page, item)}`;
    },
  };
}
