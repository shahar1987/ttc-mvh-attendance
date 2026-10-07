// בדיקת החיבור ל-Meta (ensureWebhook): מחבר מחדש מה שנפל, ולא מציף בהתראות חוזרות.
// הרצה: cd worker && node test/webhook.test.mjs
import assert from "node:assert/strict";
import { ensureWebhook } from "../src/messages.js";

const env = { WHATSAPP_WABA_ID: "w1", META_APP_ID: "a1", META_APP_SECRET: "s", WHATSAPP_TOKEN: "t", WEBHOOK_VERIFY_TOKEN: "v" };
let state, posts;
globalThis.fetch = async (url, init = {}) => {
  url = String(url);
  const json = (o) => new Response(JSON.stringify(o));
  if (init.method === "POST") return posts.push([url.split("v24.0/")[1], init.body || ""]), json({ success: true });
  if (url.endsWith("w1/subscribed_apps")) return json({ data: state.apps.map((id) => ({ whatsapp_business_api_data: { id } })) });
  if (url.endsWith("a1/subscriptions")) return json({ data: state.hook ? [state.hook] : [] });
  throw new Error(url);
};
const doc = {};
const store = { get: async () => doc, merge: async (_, d) => Object.assign(doc, d) };
const hook = (fields) => ({ object: "whatsapp_business_account", active: true, callback_url: "https://x/webhook", fields: fields.map((name) => ({ name })) });

// הכל תקין — שקט, בלי כתיבות ל-Meta
state = { apps: ["a1"], hook: hook(["messages"]) }; posts = [];
assert.deepEqual(await ensureWebhook(env, store), []);
assert.equal(posts.length, 0);

// ה-WABA לא רשום לאפליקציה, ו-messages כבוי — מתקן את שניהם ומדווח
state = { apps: ["other"], hook: hook(["account_alerts"]) }; posts = [];
const fixed = await ensureWebhook(env, store);
assert.deepEqual(posts.map(([p]) => p), ["w1/subscribed_apps", "a1/subscriptions"]);
assert.match(posts[1][1], /"callback_url":"https:\/\/x\/webhook".*"fields":"messages"/);
assert.equal(fixed.length, 3);

// חתימה שגויה לאחרונה — מתריע פעם אחת, לא כל רבע שעה
state = { apps: ["a1"], hook: hook(["messages"]) }; posts = [];
doc.badSignatureAt = new Date().toISOString();
assert.match((await ensureWebhook(env, store)).join(), /App Secret/);
assert.deepEqual(await ensureWebhook(env, store), [], "אותה בעיה — לא שוב");

// בלי מזהים — לא עושה כלום
assert.deepEqual(await ensureWebhook({}, store), []);
console.log("webhook ok");

// 🔇 הודעה שהגיעה ולא נענתה
const { unanswered } = await import("../src/index.js");
const T = Date.parse("2026-10-07T09:38:00Z");
const got = "2026-10-07T09:38:00.000Z";
assert.equal(unanswered({}, T), null);
assert.equal(unanswered({ lastOwnerMsgAt: got }, T + 60e3), null, "עוד לא עברו 3 דקות");
assert.match(unanswered({ lastOwnerMsgAt: got }, T + 4 * 60e3), /12:38.*לא הצלחתי לענות/);
assert.equal(unanswered({ lastOwnerMsgAt: got, lastReplyAt: "2026-10-07T09:38:20.000Z" }, T + 4 * 60e3), null, "נענתה");
assert.equal(unanswered({ lastOwnerMsgAt: got, unansweredAlerted: got }, T + 4 * 60e3), null, "כבר דווח");
assert.match(unanswered({ lastOwnerMsgAt: got, lastError: { at: "2026-10-07T09:38:30.000Z", message: "boom" } }, T + 4 * 60e3), /boom/);
console.log("unanswered ok");
