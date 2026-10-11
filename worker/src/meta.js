// 📣 פרסום לדף הפייסבוק ולאינסטגרם של המועדון, דרך אפליקציית Meta של שולה (אותה אפליקציה של הוואטסאפ).
// חיבור חד-פעמי: שולה שולחת לבעלים קישור /meta/start, הוא מאשר בפייסבוק, וטוקני הדפים נשמרים
// ב-agentReports/social (האוסף חסום לאפליקציה בחוקי Firestore). טוקן דף שמגיע מטוקן משתמש ארוך לא פג.
// מה מותר: לפרסם רק אחרי "כן" מפורש בהודעה האחרונה, על טקסט ותמונה שהוצגו לו. אין מחיקה ואין עריכה.
import { confirmed } from "./tools.js";
import { sign, issueKey, checkKey, dropKey } from "./google.js";
import { waConfig } from "../../agents/lib/whatsapp.mjs";
import { israelToUtc } from "./time.js";
import { sensitiveDay } from "../../agents/lib/sensitive.mjs";
import { clubPage } from "../../agents/lib/club.mjs";

const GRAPH = "https://graph.facebook.com/v24.0";
const SCOPES = "pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish,business_management";
export const metaLink = async (store, origin) => `${origin}/meta/start?k=${await issueKey(store, "meta")}`;
export const metaPermanentLink = async (store, origin) => `${origin}/meta/permanent?k=${await issueKey(store, "metaperm")}`;
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
  if (url.pathname === "/meta/check") return metaCheck(env, store, url);
  if (url.pathname === "/meta/permanent") return permanentRoute(req, store, url);
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
  // דף שחובר בחיבור הקבוע (משתמש מערכת) לא נדרס בטוקן של המשתמש האישי, שמתנתק בכל החלפת סיסמה
  const kept = ((await store.get("agentReports/social")) || {}).pages?.filter((p) => p.permanent) || [];
  await store.merge("agentReports/social", {
    pages: mergePages(kept, pages.data.map(toPage)),
    connectedAt: new Date().toISOString(),
  });
  await dropKey(store, "meta");
  return html(`✅ שולה מחוברת ל: ${pages.data.map((p) => p.name + (p.instagram_business_account ? ` + אינסטגרם @${p.instagram_business_account.username}` : "")).join(", ")}. אפשר לחזור לוואטסאפ.`);
}
const toPage = (p) => ({ id: p.id, name: p.name, token: p.access_token, ig: p.instagram_business_account?.id || "", igName: p.instagram_business_account?.username || "" });
// הדפים הקבועים קודם; דף שכבר יש לו חיבור קבוע לא מוחלף
export const mergePages = (permanent, fresh) => [...permanent, ...fresh.filter((p) => !permanent.some((k) => k.id === p.id))];

// 🔒 חיבור קבוע: טוקן של "משתמש מערכת" מהגדרות העסק ב-Meta. לא פג ולא תלוי בסיסמה של שחר.
// דף חד-פעמי (מפתח קישור, 30 דקות): מדביקים את הטוקן, נשמר רק טוקן הדף של המועדון. הטוקן עצמו לא נשמר.
async function permanentRoute(req, store, url) {
  if (!(await checkKey(store, "metaperm", url.searchParams.get("k")))) return new Response("forbidden", { status: 403 });
  if (req.method !== "POST") return html(PERMANENT_FORM);
  const tok = String((await req.formData()).get("token") || "").trim();
  const g = async (path, q) => (await fetch(`${GRAPH}/${path}?${new URLSearchParams({ ...q, access_token: tok })}`)).json();
  const acc = await g("me/accounts", { fields: "id,name,access_token,instagram_business_account{id,username}" });
  if (acc.error) return html(`הטוקן לא עבד: ${acc.error.message}. לחזור אחורה ולהדביק שוב.`, 400);
  const club = clubPage({ pages: (acc.data || []).map(toPage) });
  if (!club) return html("הטוקן תקין, אבל למשתמש המערכת אין גישה לדף של המועדון. בהגדרות העסק: משתמשי מערכת ← שולה ← הקצאת נכסים ← דפים ← הדף של המועדון (שליטה מלאה). ואז ליצור טוקן חדש.", 400);
  if (!club.ig) return html("הדף של המועדון נמצא, אבל בלי האינסטגרם. בהקצאת הנכסים להוסיף גם את חשבון האינסטגרם ttcmhr, וליצור טוקן חדש.", 400);
  const dbg = (await g("debug_token", { input_token: tok })).data || {};
  await store.update("agentReports/social", (cur) => ({
    pages: mergePages([{ ...club, permanent: true }], (cur.pages || []).filter((p) => p.id !== club.id)),
    permanentAt: new Date().toISOString(),
  }));
  await dropKey(store, "metaperm");
  const never = dbg.expires_at === 0;
  return html(`✅ חיבור קבוע: ${club.name} + אינסטגרם @${club.igName}.${never ? " הטוקן לא פג." : " ⚠️ הטוקן הזה כן פג — ביצירת הטוקן לבחור תוקף Never."} אפשר לחזור לוואטסאפ.`);
}
const PERMANENT_FORM = `<h2>חיבור קבוע של שולה לפייסבוק ולאינסטגרם</h2><p>חד-פעמי. אחרי זה החיבור לא נקטע גם כשמחליפים סיסמה.</p><ol style="line-height:1.7">
<li>לפתוח את <a href="https://business.facebook.com/settings/system-users" target="_blank">הגדרות העסק ← משתמשי מערכת</a> (במחשב או בטאבלט, במצב מחשב).</li>
<li>להוסיף משתמש מערכת בשם "שולה" בתפקיד מנהל (אם כבר יש — לבחור בו).</li>
<li><b>הקצאת נכסים</b>: הדף של המועדון (שליטה מלאה), חשבון האינסטגרם ttcmhr, והאפליקציה של שולה. <b>לא</b> את קפה קורטדו.</li>
<li><b>יצירת טוקן</b> ← האפליקציה של שולה ← תוקף <b>Never</b> ← לסמן: pages_show_list, pages_read_engagement, pages_manage_posts, pages_read_user_content (אם מופיע), instagram_basic, instagram_content_publish, business_management.</li>
<li>להעתיק את הטוקן ולהדביק כאן:</li></ol>
<form method="post"><input name="token" required dir="ltr" autocomplete="off" style="width:100%;font:16px system-ui;padding:8px;margin:6px 0"><button style="font:18px system-ui;padding:10px 20px">שמירה</button></form>`;
const html = (msg, status = 200) => new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><body dir="rtl" style="font:20px system-ui;padding:24px">${msg}</body>`, { status, headers: { "content-type": "text/html; charset=utf-8" } });

export const META_TOOL_DEFS = [
  {
    name: "publish_post",
    description:
      "מפרסם (או מתזמן) פוסט בדף הפייסבוק ו/או באינסטגרם של המועדון. כשהבעלים מבקש לחבר (או לחבר מחדש) את פייסבוק/אינסטגרם — לקרוא לכלי עם platform בלבד, בלי text/image/video, כדי לקבל את קישור החיבור. מפרסם רק אחרי שהבעלים ענה 'כן' על הנוסח המדויק, התמונה, הפלטפורמה והמועד שהצגת לו. text = נוסח הפייסבוק, בלי @ (בפייסבוק תיוג דרך ה-API לא עובד — כותבים את השמות במילים). instagram_text = נוסח האינסטגרם עם התיוגים (@); אם חסר — text. image = מזהה התמונה מהוואטסאפ (מופיע ב-[תמונה id=...]) או קישור ישיר לתמונה. video = מזהה הסרטון מהוואטסאפ (מופיע ב-[סרטון id=...]) או קישור ישיר. kind = post (ברירת מחדל) / story (סטורי: תמונה או סרטון, בלי טקסט) / reel (רילס: חייב video). פוסט באינסטגרם חייב תמונה. סרטונים עוברים עיבוד אצל Meta ולכן יוצאים בבדיקה של רבע השעה הקרובה. at = מועד פרסום בשעון ישראל YYYY-MM-DDTHH:MM; בלי at — מיד. kids = true כשרואים ילדים בתמונה או בסרטון (לסמן ⚠️ בטיוטה): מתפרסם רק אחרי שהבעלים כתב שיש הסכמת הורים. ב-7 באוקטובר, ביום כיפור וביום הזיכרון — רק פוסט זיכרון (memorial = true), בלי הזמנה לאימון. טיוטות השבוע של סוכן הפרסום: get_agent_results עם agent=content.",
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
        kids: { type: "boolean" },
        memorial: { type: "boolean" },
      },
      required: ["platform"],
      additionalProperties: false,
    },
  },
  {
    name: "save_post_rule",
    description: "שומר כלל קבוע לכתיבת פוסטים (נכנס לכל טיוטה מעכשיו, גם בטיוטות השבועיות). אחרי שהבעלים ביקש תיקון בפוסט — לשאול 'לשמור את זה ככלל קבוע?'. נשמר רק אחרי 'כן' בהודעה הבאה, עם אותו נוסח כלל בדיוק. rule = משפט אחד ברור.",
    input_schema: { type: "object", properties: { rule: { type: "string" } }, required: ["rule"], additionalProperties: false },
  },
];

// הדף של המועדון לפי מזהה קבוע (agents/lib/club.mjs). קורטדו מחובר גם, גם עם אינסטגרם — אסור לפרסם אליו.
export { clubPage };

// "2026-10-11T17:00" בשעון ישראל → Date (UTC). פונקציה אחת משותפת (time.js), נשארת מיוצאת גם מכאן.
export { israelToUtc };

async function graphPost(path, body) {
  const r = await fetch(`${GRAPH}/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error?.message || `Meta ${r.status}`);
  return j;
}

// תיוג דרך ה-API בפייסבוק לא עובד (@ נשאר טקסט מת), אז אחרי פרסום שולה מזכירה את מי לתייג ידנית
export const FB_TAGS = 'מתנ"ס אזורי מבואות החרמון, המועצה האזורית מבואות החרמון, קריית שמונה, גליל עליון';
// "יש הסכמת הורים" / "ההורים אישרו" — לפרסום עם ילדים בתמונה
const CONSENT = /(יש|קיבלתי|קיבלנו|עם)\s+(את\s+)?(אישור|הסכמת|הסכמה)(\s+של)?\s+(ה)?הורים|ההורים\s+(אישרו|הסכימו|נתנו)/;

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
    if (kind !== "story") done.push(`לתייג ידנית בפייסבוק: ${FB_TAGS}`);
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
    async publish_post({ platform, kind = "post", text = "", instagram_text, image, video, at, kids = false, memorial = false }) {
      const social = (await store.get("agentReports/social")) || {};
      const page = clubPage(social);
      if (!page) return `פייסבוק ואינסטגרם עוד לא מחוברים. לשלוח לבעלים את הקישור לחיבור: ${await metaLink(store, origin)}`;
      // קריאה בלי תוכן = בקשה לחבר מחדש (למשל אחרי ש-Meta ביטלה את הטוקן)
      if (!text.trim() && !image && !video) return `קישור לחיבור מחדש של פייסבוק ואינסטגרם (בתוקף 30 דקות), לשלוח לבעלים: ${await metaLink(store, origin)}`;
      if (kind === "reel" && !video) return "לרילס צריך סרטון (video).";
      if (kind === "story" && !image && !video) return "לסטורי צריך תמונה או סרטון.";
      if (kind !== "story" && !text.trim()) return "חסר נוסח (text).";
      if (platform !== "instagram" && /@[\w.]+/.test(text)) return "לא פורסם: בפייסבוק @ נשאר טקסט מת. לכתוב בנוסח הפייסבוק את שמות השותפים במילים, בלי @, ואת התיוגים לשים ב-instagram_text.";
      if (at && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(at)) return "at צריך להיות בפורמט YYYY-MM-DDTHH:MM (שעון ישראל).";
      const day = sensitiveDay((at || new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" })).slice(0, 10));
      if (day && !memorial) return `לא מפרסמים תוכן פרסומי ב-${day}. אפשר רק פוסט זיכרון (memorial: true) באישור הבעלים, או מועד אחר.`;
      if (memorial && /אימון ניסיון|הצטרפות/.test(`${text} ${instagram_text || ""}`)) return "פוסט זיכרון בלי הזמנה לאימון ובלי שורת הסיום הקבועה. להסיר ולהציג לבעלים שוב.";
      const payload = { platform, kind, text, instagram_text, image, video, at, kids, memorial };
      const ok = await confirmed(store, "post", payload, lastOwnerText, turn);
      if (kids) {
        // ההסכמה נשמרת לפוסט הזה, כדי ש"כן" רגיל אחריה עדיין יעבוד
        const key = JSON.stringify(payload);
        if (CONSENT.test(lastOwnerText || "")) await store.merge("agentReports/bot", { kidsConsent: key });
        if ((await store.get("agentReports/bot"))?.kidsConsent !== key)
          return "⚠️ לא פורסם: יש ילדים בתמונה. להציג לבעלים את הפוסט ולשאול \"יש הסכמת הורים? לפרסם?\". מפרסמים רק אחרי שהוא כותב שיש הסכמת הורים (למשל \"כן, יש הסכמת הורים\").";
      }
      if (!ok) return "עוד לא פורסם. להציג לבעלים בדיוק את הנוסח (פייסבוק ואינסטגרם), התמונה, הפלטפורמה והמועד ולשאול \"לפרסם?\". אחרי \"כן\" — לקרוא שוב עם אותם פרטים בדיוק.";
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
    async save_post_rule({ rule }) {
      rule = String(rule || "").trim().slice(0, 300);
      if (!rule) return "חסר נוסח הכלל.";
      if (!(await confirmed(store, "rule", { rule }, lastOwnerText, turn))) return `עוד לא נשמר. לשאול את הבעלים: "לשמור ככלל קבוע: ${rule}?". אחרי "כן" — לקרוא שוב עם אותו נוסח בדיוק.`;
      await store.update("agentReports/bot", (bot) => ({ postRules: [...(bot.postRules || []).filter((r) => r.rule !== rule), { rule, at: new Date().toISOString() }].slice(-30) }));
      return `✅ נשמר ככלל קבוע: ${rule}`;
    },
  };
}

// כללי הכתיבה שהבעלים אישר — נכנסים להנחיות של שולה (ושל סוכן הפרסום השבועי, content.mjs)
export const rulesPrompt = (bot) => ((bot?.postRules || []).length ? `\n\nכללי פרסום קבועים שהבעלים אישר (גוברים על כל השאר):\n- ${bot.postRules.map((r) => r.rule).join("\n- ")}` : "");

// פוסט שמחכה ל"כן" יותר מ-24 שעות: תזכורת אחת. בלי "כן" הוא לא יוצא אף פעם (ראו confirmed).
export async function stalePost(store, now = new Date()) {
  let text = "";
  await store.update("agentReports/bot", (bot) => {
    const p = bot.pending?.post;
    if (!p?.at || p.reminded || now - new Date(p.at) < 24 * 3600 * 1000) return null;
    const { text: t = "", platform } = JSON.parse(p.key);
    text = `⏳ פוסט מחכה ל"כן" שלך כבר יותר מיום (${platform === "both" ? "פייסבוק + אינסטגרם" : platform}): "${t.split("\n")[0].slice(0, 60)}". בלי "כן" הוא לא יוצא.`;
    return { pending: { ...bot.pending, post: { ...p, reminded: true } } };
  });
  return text;
}

// 🧪 /meta/check?k=<מפתח התיבה>&img=<קישור>&vid=<קישור>: בדיקה מול Meta בלי לפרסם כלום.
// אינסטגרם: יוצר מכלי סטורי ורילס ומחכה לעיבוד, בלי media_publish (מכל שלא פורסם נמחק אחרי 24 שעות).
// פייסבוק: תמונה לא מפורסמת (השלב הראשון של סטורי) ופתיחת העלאה של רילס, בלי finish.
async function metaCheck(env, store, url) {
  const { sha256 } = await import("./inbox.js");
  if (!env.INBOX_KEY_SHA256 || (await sha256(url.searchParams.get("k") || "")) !== env.INBOX_KEY_SHA256) return new Response("forbidden", { status: 403 });
  const page = clubPage((await store.get("agentReports/social")) || {});
  if (!page) return Response.json({ ok: false, error: "not connected" });
  const img = url.searchParams.get("img"), vid = url.searchParams.get("vid"), t = page.token;
  const out = { page: page.name, ig: page.igName };
  const step = async (name, fn) => { try { out[name] = (await fn()) || "ok"; } catch (e) { out[name] = `ERROR: ${e.message}`; } };
  await step("fb_photo_unpublished", async () => (await graphPost(`${page.id}/photos`, { url: img, published: false, access_token: t })).id);
  await step("fb_reel_start", async () => (await graphPost(`${page.id}/video_reels`, { upload_phase: "start", access_token: t })).video_id);
  await step("ig_story_image", async () => { const c = await graphPost(`${page.ig}/media`, { media_type: "STORIES", image_url: img, access_token: t }); return `container ${c.id}`; });
  await step("ig_reel_video", async () => { const c = await graphPost(`${page.ig}/media`, { media_type: "REELS", video_url: vid, caption: "test", access_token: t }); await igReady(c.id, t); return `container ${c.id} FINISHED`; });
  await step("ig_publish_limit", async () => JSON.stringify((await (await fetch(`${GRAPH}/${page.ig}/content_publishing_limit?fields=quota_usage,config&access_token=${t}`)).json()).data?.[0] || {}));
  return Response.json(out);
}
