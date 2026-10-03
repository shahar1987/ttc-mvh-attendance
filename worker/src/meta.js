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
      "מפרסם פוסט בדף הפייסבוק ו/או באינסטגרם של המועדון. כשהבעלים מבקש לחבר את פייסבוק/אינסטגרם — לקרוא לכלי בלי לפרסם כדי לקבל את קישור החיבור. מפרסם רק אחרי שהבעלים ענה 'כן' על הנוסח המדויק, התמונה והפלטפורמה שהצגת לו. image = מזהה התמונה מהוואטסאפ (מופיע ב-[תמונה id=...]) או קישור ישיר לתמונה. אינסטגרם חייב תמונה.",
    input_schema: {
      type: "object",
      properties: { platform: { type: "string", enum: ["facebook", "instagram", "both"] }, text: { type: "string" }, image: { type: "string" } },
      required: ["platform", "text"],
      additionalProperties: false,
    },
  },
];

export function makeMetaTools({ env, store, lastOwnerText, origin, turn }) {
  const post = async (path, body) => {
    const r = await fetch(`${GRAPH}/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok || j.error) throw new Error(j.error?.message || `Meta ${r.status}`);
    return j;
  };
  return {
    async publish_post({ platform, text, image }) {
      const page = (await store.get("agentReports/social"))?.pages?.[0];
      if (!page) return `פייסבוק ואינסטגרם עוד לא מחוברים. לשלוח לבעלים את הקישור לחיבור: ${await metaLink(store, origin)}`;
      if (!(await confirmed(store, "post", { platform, text, image }, lastOwnerText, turn)))
        return "עוד לא פורסם. להציג לבעלים בדיוק את הנוסח, התמונה והפלטפורמה ולשאול \"לפרסם?\". אחרי \"כן\" — לקרוא שוב עם אותם פרטים בדיוק.";
      const img = image && (/^https?:\/\//.test(image) ? image : await mediaUrl(env, origin, image.replace(/\D/g, "")));
      const done = [];
      if (platform !== "instagram") {
        const r = img ? await post(`${page.id}/photos`, { url: img, caption: text, access_token: page.token }) : await post(`${page.id}/feed`, { message: text, access_token: page.token });
        done.push(`פייסבוק (${page.name}) ✓ ${r.post_id || r.id}`);
      }
      if (platform !== "facebook") {
        if (!page.ig) done.push("אינסטגרם: אין חשבון אינסטגרם עסקי מקושר לדף");
        else if (!img) done.push("אינסטגרם: חייבים תמונה");
        else {
          const c = await post(`${page.ig}/media`, { image_url: img, caption: text, access_token: page.token });
          const r = await post(`${page.ig}/media_publish`, { creation_id: c.id, access_token: page.token });
          done.push(`אינסטגרם (@${page.igName}) ✓ ${r.id}`);
        }
      }
      return `פורסם: ${done.join(" · ")}`;
    },
  };
}
