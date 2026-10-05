// 📣 פרסום לדף הפייסבוק ולאינסטגרם של המועדון, דרך אפליקציית Meta של שולה (אותה אפליקציה של הוואטסאפ).
// חיבור חד-פעמי: שולה שולחת לבעלים קישור /meta/start, הוא מאשר בפייסבוק, וטוקני הדפים נשמרים
// ב-agentReports/social (האוסף חסום לאפליקציה בחוקי Firestore). טוקן דף שמגיע מטוקן משתמש ארוך לא פג.
// מה מותר: לפרסם רק אחרי "כן" מפורש בהודעה האחרונה, על טקסט ותמונה שהוצגו לו. אין מחיקה ואין עריכה.
import { confirmed } from "./tools.js";
import { sign, issueKey, checkKey, dropKey } from "./google.js";
import { waConfig, downloadMedia } from "../../agents/lib/whatsapp.mjs";

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
    const m = await downloadMedia(waConfig(env), id);
    return new Response(Buffer.from(m.data, "base64"), { headers: { "content-type": m.mimeType } });
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
      "מפרסם (או מתזמן) פוסט בדף הפייסבוק ו/או באינסטגרם של המועדון. כשהבעלים מבקש לחבר את פייסבוק/אינסטגרם — לקרוא לכלי בלי לפרסם כדי לקבל את קישור החיבור. מפרסם רק אחרי שהבעלים ענה 'כן' על הנוסח המדויק, התמונה, הפלטפורמה והמועד שהצגת לו. text = נוסח הפייסבוק, בלי @ (בפייסבוק תיוג דרך ה-API לא עובד — כותבים את השמות במילים). instagram_text = נוסח האינסטגרם עם התיוגים (@); אם חסר — text. image = מזהה התמונה מהוואטסאפ (מופיע ב-[תמונה id=...]) או קישור ישיר לתמונה. אינסטגרם חייב תמונה. at = מועד פרסום בשעון ישראל YYYY-MM-DDTHH:MM; בלי at — מיד. טיוטות השבוע של סוכן הפרסום: get_agent_results עם agent=content.",
    input_schema: {
      type: "object",
      properties: {
        platform: { type: "string", enum: ["facebook", "instagram", "both"] },
        text: { type: "string" },
        instagram_text: { type: "string" },
        image: { type: "string" },
        at: { type: "string" },
      },
      required: ["platform", "text"],
      additionalProperties: false,
    },
  },
];

// "2026-10-11T17:00" בשעון ישראל → Date (UTC)
export function israelToUtc(local) {
  const d = new Date(`${local}:00Z`);
  const off = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Jerusalem" })) - new Date(d.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(d - off);
}

async function graphPost(path, body) {
  const r = await fetch(`${GRAPH}/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error?.message || `Meta ${r.status}`);
  return j;
}

// הפרסום עצמו. img כבר קישור מלא (גם לתזמון — ב-cron אין origin).
async function publishNow(page, { platform, text, igText, img }) {
  const done = [];
  if (platform !== "instagram") {
    const r = img ? await graphPost(`${page.id}/photos`, { url: img, caption: text, access_token: page.token }) : await graphPost(`${page.id}/feed`, { message: text, access_token: page.token });
    done.push(`פייסבוק (${page.name}) ✓ ${r.post_id || r.id}`);
  }
  if (platform !== "facebook") {
    if (!page.ig) done.push("אינסטגרם: אין חשבון אינסטגרם עסקי מקושר לדף");
    else if (!img) done.push("אינסטגרם: חייבים תמונה");
    else {
      const c = await graphPost(`${page.ig}/media`, { image_url: img, caption: igText, access_token: page.token });
      const r = await graphPost(`${page.ig}/media_publish`, { creation_id: c.id, access_token: page.token });
      done.push(`אינסטגרם (@${page.igName}) ✓ ${r.id}`);
    }
  }
  return done.join(" · ");
}

// מה-cron של כל רבע שעה: מפרסם פוסטים מתוזמנים שהגיע זמנם. מחזיר שורות לדיווח לבעלים.
export async function publishDue(store, now = new Date()) {
  const social = (await store.get("agentReports/social")) || {};
  const due = (social.queue || []).filter((q) => q.due <= now.toISOString());
  if (!due.length) return [];
  // קודם מוציאים מהתור — Cloudflare מריץ לפעמים cron פעמיים, ופוסט כפול גרוע מפוסט שנכשל ומדווח
  await store.merge("agentReports/social", { queue: social.queue.filter((q) => q.due > now.toISOString()) });
  const out = [];
  for (const q of due) out.push(`📣 ${q.at}: ${await publishNow(social.pages[0], q).catch((e) => `נכשל — ${e.message}`)}`);
  return out;
}

export function makeMetaTools({ env, store, lastOwnerText, origin, turn }) {
  return {
    async publish_post({ platform, text, instagram_text, image, at }) {
      const social = (await store.get("agentReports/social")) || {};
      const page = social.pages?.[0];
      if (!page) return `פייסבוק ואינסטגרם עוד לא מחוברים. לשלוח לבעלים את הקישור לחיבור: ${await metaLink(store, origin)}`;
      if (platform !== "instagram" && /@[\w.]+/.test(text)) return "לא פורסם: בפייסבוק @ נשאר טקסט מת. לכתוב בנוסח הפייסבוק את שמות השותפים במילים, בלי @, ואת התיוגים לשים ב-instagram_text.";
      if (at && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(at)) return "at צריך להיות בפורמט YYYY-MM-DDTHH:MM (שעון ישראל).";
      if ((at || new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" })).slice(5, 10) === "10-07") return "לא מפרסמים שיווק ב-7 באוקטובר. להציע לבעלים מועד אחר.";
      if (!(await confirmed(store, "post", { platform, text, instagram_text, image, at }, lastOwnerText, turn)))
        return "עוד לא פורסם. להציג לבעלים בדיוק את הנוסח (פייסבוק ואינסטגרם), התמונה, הפלטפורמה והמועד ולשאול \"לפרסם?\". אחרי \"כן\" — לקרוא שוב עם אותם פרטים בדיוק.";
      const img = image && (/^https?:\/\//.test(image) ? image : await mediaUrl(env, origin, image.replace(/\D/g, "")));
      const item = { platform, text, igText: instagram_text || text, img: img || "" };
      if (at && israelToUtc(at) > new Date(Date.now() + 10 * 60 * 1000)) {
        const due = israelToUtc(at).toISOString();
        await store.merge("agentReports/social", { queue: [...(social.queue || []), { ...item, at, due }] });
        return `מתוזמן ל-${at.replace("T", " ")} (${platform === "both" ? "פייסבוק + אינסטגרם" : platform}). יתפרסם אוטומטית ואעדכן.`;
      }
      return `פורסם: ${await publishNow(page, item)}`;
    },
  };
}
