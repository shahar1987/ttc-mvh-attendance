// עזרים קטנים לעמודים ולקישורים של הבוט. מודול יציב: לא מייבא אף מודול אחר של הבוט.

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export const html = (body, status = 200) =>
  new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><body dir="rtl" style="font:20px system-ui;padding:24px;max-width:640px;margin:auto">${body}</body>`, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });

const toHex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
export const randomHex = (n) => toHex(crypto.getRandomValues(new Uint8Array(n)));
export const sha256 = async (s) => toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))));

// חתימה קבועה לכתובת אחת (למשל /meta/media/<id>): מאפשרת למשוך רק את מה שנחתם, לא לחבר כלום
export async function sign(env, label) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.META_APP_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(label))).slice(0, 12));
}

// מפתחות חיבור (מטא/קלוד/סולאר): אקראיים, נשמרים ב-agentReports/bot.keys, פגים אחרי 30 דקות ונמחקים אחרי שימוש מוצלח.
// ככה קישור ישן בוואטסאפ או בהיסטוריה לא שווה כלום.
const KEY_TTL = 30 * 60 * 1000;
export async function issueKey(store, label) {
  const bot = (await store.get("agentReports/bot")) || {};
  const key = randomHex(16);
  await store.merge("agentReports/bot", { keys: { ...(bot.keys || {}), [label]: { key, exp: Date.now() + KEY_TTL } } });
  return key;
}
export async function checkKey(store, label, k) {
  const e = ((await store.get("agentReports/bot")) || {}).keys?.[label];
  return !!k && !!e && e.key === k && e.exp > Date.now();
}
export async function dropKey(store, label) {
  const bot = (await store.get("agentReports/bot")) || {};
  await store.merge("agentReports/bot", { keys: { ...(bot.keys || {}), [label]: null } });
}
