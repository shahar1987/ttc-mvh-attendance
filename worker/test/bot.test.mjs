// בדיקה מקצה לקצה של שולה בלי רשת: Firestore, Gemini ו-WhatsApp מדומים ב-fetch.
// הרצה: cd worker && npm test
import assert from "node:assert/strict";
import { generateKeyPairSync, createHmac } from "node:crypto";
import { toValue, fromValue } from "../src/firestore.js";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const SA = { project_id: "p", client_email: "x@p", private_key: privateKey.export({ type: "pkcs8", format: "pem" }) };
const env = {
  WHATSAPP_TOKEN: "t", WHATSAPP_PHONE_ID: "123", OWNER_PHONE: "972500000000", META_APP_SECRET: "s",
  WEBHOOK_VERIFY_TOKEN: "v", GEMINI_API_KEY: "g", FIREBASE_SERVICE_ACCOUNT: JSON.stringify(SA),
  GOOGLE_CLIENT_ID: "cid", GOOGLE_CLIENT_SECRET: "cs",
};

// Firestore בזיכרון
const docs = new Map();
const put = (path, obj) => docs.set(path, { ...(docs.get(path) || {}), ...obj });
put("groups/g1", { name: "מתחילים שאר ישוב" });
put("groups/g2", { name: "מתקדמים שאר ישוב" });
put("players/p1", { name: "דני כהן", groupId: "g1", isActive: true });
put("players/p2", { name: "נועה לוי", groupId: "g1", isActive: true });
put("players/p3", { name: "דני לוי", groupId: "g1", isActive: true });
put("attendance/2026-10-01_g1_p2", { date: "2026-10-01", groupId: "g1", playerId: "p2", status: "Absent", msgSentAt: "x" });
const out = (path, o) => ({ name: `projects/p/databases/(default)/documents/${path}`, fields: Object.fromEntries(Object.entries(o).map(([k, v]) => [k, toValue(v)])) });

const geminiQueue = [];
const google = [];
const geminiCalls = [];
const sent = [];
const social = [];
const templatesPosted = [];
globalThis.fetch = async (url, init = {}) => {
  url = String(url);
  const json = (o, status = 200) => new Response(JSON.stringify(o), { status });
  if (url.startsWith("https://oauth2")) return json({ access_token: "a", expires_in: 3600, ...(String(init.body).includes("authorization_code") ? { refresh_token: "r" } : {}) });
  if (url.startsWith("https://geocoding-api.open-meteo.com")) return json(url.includes("xyzxyz") ? {} : { results: [{ name: "שאר ישוב", country: "ישראל", latitude: 33.2, longitude: 35.6 }] });
  if (url.startsWith("https://api.open-meteo.com")) return json({ current: { temperature_2m: 24, apparent_temperature: 25, weather_code: 1, wind_speed_10m: 10 }, daily: { time: ["2026-10-03"], weather_code: [61], temperature_2m_min: [15], temperature_2m_max: [26], precipitation_probability_max: [70], wind_speed_10m_max: [20] } });
  if (url.startsWith("https://gmail.googleapis.com")) {
    google.push({ url, method: init.method || "GET", body: init.body && JSON.parse(init.body) });
    if (url.includes("/messages?")) return json({ messages: [{ id: "e1" }] });
    if (url.includes("/messages/e1")) return json({ id: "e1", threadId: "t1", snippet: "שלום", labelIds: ["UNREAD"], payload: { headers: [{ name: "From", value: "matnas@x" }, { name: "Subject", value: "טורניר" }, { name: "Message-ID", value: "<m1@x>" }], mimeType: "text/plain", body: { data: Buffer.from("גוף המייל").toString("base64url") } } });
    return json({ id: "d1" });
  }
  if (url.startsWith("https://www.googleapis.com/drive")) {
    google.push({ url, method: init.method || "GET" });
    if (url.includes("/export?")) return new Response("שורה,ערך\nא,1");
    if (url.includes("/files/f1?")) return json({ name: "תשלומים", mimeType: "application/vnd.google-apps.spreadsheet", webViewLink: "https://d/f1" });
    if (url.includes("/files/f2?")) return json({ name: "פלאייר.pdf", mimeType: "application/pdf", webViewLink: "https://d/f2" });
    return json({ files: [{ id: "f1", name: "תשלומים", mimeType: "application/vnd.google-apps.spreadsheet", modifiedTime: "2026-10-01T10:00:00Z", webViewLink: "https://d/f1" }] });
  }
  if (url.startsWith("https://tasks.googleapis.com")) {
    if (globalThis.tasks403) return json({ error: { message: "insufficient scopes" } }, 403);
    google.push({ url, method: init.method || "GET", body: init.body && JSON.parse(init.body) });
    return init.method === "POST" ? json({ title: JSON.parse(init.body).title }) : json({ items: [{ title: "להזמין כדורים", due: "2026-10-05T00:00:00.000Z" }] });
  }
  if (url.startsWith("https://www.googleapis.com/calendar")) {
    google.push({ url, method: init.method || "GET", body: init.body && JSON.parse(init.body) });
    return init.method === "POST" ? json({ summary: JSON.parse(init.body).summary }) : json({ items: [{ summary: "אימון", start: { dateTime: "2026-10-04T16:30:00+03:00" }, end: { dateTime: "2026-10-04T17:30:00+03:00" } }] });
  }
  if (url.includes("generativelanguage")) {
    geminiCalls.push(JSON.parse(init.body));
    return json({ candidates: [{ content: { parts: geminiQueue.shift() } }] });
  }
  if (url.includes("/message_templates")) {
    if (init.method === "POST") { templatesPosted.push(JSON.parse(init.body).name); return json({ status: "PENDING" }); }
    return json({ data: [{ name: "agent_alert", language: "he" }] });
  }
  if (url.includes("graph.facebook.com/v24.0/oauth/access_token")) return json({ access_token: url.includes("fb_exchange_token") ? "long" : "short" });
  if (url.includes("graph.facebook.com/v24.0/me/accounts")) return json({ data: [{ id: "pg1", name: "המועדון", access_token: "ptok", instagram_business_account: { id: "ig1", username: "club" } }] });
  if (/graph\.facebook\.com\/v24\.0\/(pg1|ig1)\//.test(url)) {
    social.push({ url, body: JSON.parse(init.body) });
    return json(url.endsWith("/media") ? { id: "c1" } : { id: "x1", post_id: "pg1_1" });
  }
  if (url.includes("graph.facebook.com/v24.0/media")) return json({ url: "https://lookaside/" + url.split("/").pop(), mime_type: url.endsWith("aud") ? "audio/ogg; codecs=opus" : "image/jpeg" });
  if (url.startsWith("https://lookaside/")) return new Response(new Uint8Array([1, 2, 3]));
  if (url.includes("graph.facebook.com")) {
    sent.push(JSON.parse(init.body));
    return json({ messages: [{ id: "w" }] });
  }
  const path = decodeURIComponent(url.split("/documents")[1].split("?")[0]).replace(/^\//, "");
  if (path === ":runQuery") {
    const q = JSON.parse(init.body).structuredQuery;
    const col = q.from[0].collectionId, f = q.where.fieldFilter;
    return json([...docs].filter(([k, d]) => k.startsWith(col + "/") && d[f.field.fieldPath] === fromValue(f.value)).map(([k, d]) => ({ document: out(k, d) })));
  }
  if (init.method === "PATCH") {
    const fields = JSON.parse(init.body).fields;
    put(path, Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, fromValue(v)])));
    return json({});
  }
  if (!path.includes("/")) return json({ documents: [...docs].filter(([k]) => k.startsWith(path + "/")).map(([k, d]) => out(k, d)) });
  return docs.has(path) ? json(out(path, docs.get(path))) : new Response("", { status: 404 });
};

const { default: worker, review } = await import("../src/index.js");
const texts = () => sent.filter((b) => b.type === "text").map((b) => b.text.body);
const webhook = async (text, from = env.OWNER_PHONE, id = "m" + Math.random(), msg = { type: "text", text: { body: text } }) => {
  const raw = JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ id, from, ...msg }] } }] }] });
  const sig = "sha256=" + createHmac("sha256", env.META_APP_SECRET).update(raw).digest("hex");
  const waits = [];
  const res = await worker.fetch(new Request("https://x/webhook", { method: "POST", body: raw, headers: { "x-hub-signature-256": sig } }), env, { waitUntil: (p) => waits.push(p) });
  await Promise.all(waits);
  return res;
};

// 1. סימון נוכחות: Gemini מפעיל כלי, ואז עונה
geminiQueue.push(
  [{ functionCall: { name: "mark_attendance", args: { group: "מתחילים", date: "2026-10-01", present: ["נועה", "דני"], absent: [] } } }],
  [{ text: "סימנתי את נועה כנוכחת. 'דני' מתאים לשני שחקנים." }],
);
await webhook("נועה ודני הגיעו אתמול למתחילים");
const rec = docs.get("attendance/2026-10-01_g1_p2");
assert.equal(rec.status, "Present");
assert.equal(rec.markedBy, "shula-whatsapp");
assert.equal(docs.has("attendance/2026-10-01_g1_p1"), false, "שם עמום לא נשמר");
const toolResult = geminiCalls[1].contents.at(-1).parts[0].functionResponse.response.result;
assert.match(toolResult, /נועה לוי: נוכח/);
assert.match(toolResult, /כמה שחקנים מתאימים/);
assert.equal(texts().at(-1), "סימנתי את נועה כנוכחת. 'דני' מתאים לשני שחקנים.");
assert.ok(sent.some((b) => b.status === "read" && b.typing_indicator?.type === "text"), "חיווי מקלידה");
assert.equal(geminiCalls[0].tools[0].functionDeclarations.some((d) => "additionalProperties" in d.parameters), false);

// 2. קריאת נוכחות + היסטוריה נשמרת ונשלחת בפעם הבאה
geminiQueue.push([{ functionCall: { name: "get_attendance", args: { group: "מתחילים", date: "2026-10-01" } } }], [{ text: "ok" }]);
await webhook("מי היה אתמול?");
const att = JSON.parse(geminiCalls.at(-1).contents.at(-1).parts[0].functionResponse.response.result);
assert.deepEqual(att, { group: "מתחילים שאר ישוב", date: "2026-10-01", present: ["נועה לוי"], absent: [], unmarked: ["דני כהן", "דני לוי"] });
assert.equal(geminiCalls.at(-2).contents.length, 3, "שתי הודעות היסטוריה + החדשה");

// 3. מספר זר — מתעלמים
const before = sent.length;
await webhook("היי", "972511111111");
assert.equal(sent.length, before);

// 4. חתימה לא תקינה
const bad = await worker.fetch(new Request("https://x/webhook", { method: "POST", body: "{}", headers: { "x-hub-signature-256": "sha256=00" } }), env, { waitUntil() {} });
assert.equal(bad.status, 401);

// 5. הודעה קולית: תמלול ואז תשובה רגילה
geminiQueue.push([{ text: "מי הגיע היום?" }], [{ text: "תשובה לקול" }]);
await webhook("", env.OWNER_PHONE, "a1", { type: "audio", audio: { id: "media/aud" } });
const tr = geminiCalls.at(-2).contents[0].parts[1].inlineData;
assert.deepEqual(tr, { mimeType: "audio/ogg", data: "AQID" });
assert.equal(geminiCalls.at(-1).contents.at(-1).parts[0].text, "🎤 מי הגיע היום?");
assert.equal(texts().at(-1), "תשובה לקול");

// 6. תמונה עם כיתוב — Gemini מקבל את התמונה עצמה
geminiQueue.push([{ text: "הלוגו קטן מדי" }]);
await webhook("", env.OWNER_PHONE, "i1", { type: "image", image: { id: "media/img", caption: "מה דעתך על הפלאייר?" } });
const last = geminiCalls.at(-1).contents.at(-1).parts;
assert.equal(last[0].text, "📷 [תמונה id=media/img] מה דעתך על הפלאייר?");
assert.equal(last[1].inlineData.mimeType, "image/jpeg");

// 7. המפקח: OK = שקט, בעיה = הודעה לבעלים + נכנס ל-outbox
geminiQueue.push([{ text: "OK" }]);
assert.equal(await review(env), "ok");
geminiQueue.push([{ text: "1. ביקש פלאייר — שולה לא החזירה טיוטה" }]);
assert.equal(await review(env), "sent");
assert.match(texts().at(-1), /המפקח על שולה[\s\S]*לא החזירה טיוטה/);
assert.match(docs.get("agentReports/bot").outbox.review.text, /לא החזירה טיוטה/);
assert.match(geminiCalls.at(-1).contents[0].parts[0].text, /הבעלים: 📷 \[תמונה id=/);

// 8. מייל ויומן: לפני חיבור — קישור; אחרי חיבור — קריאה, טיוטה (לא שליחה), אירוע רק באישור
const callTool = async (msg, call) => {
  geminiQueue.push([{ functionCall: call }], [{ text: "ok" }]);
  await webhook(msg);
  return geminiCalls.at(-1).contents.at(-1).parts[0].functionResponse.response.result;
};
delete env.GOOGLE_CLIENT_ID;
assert.match(await callTool("יש מיילים?", { name: "search_email", args: { query: "is:unread" } }), /ask_claude/);
env.GOOGLE_CLIENT_ID = "cid";
const notConnected = await callTool("יש מיילים חדשים?", { name: "search_email", args: { query: "is:unread" } });
const link = notConnected.match(/https:\/\/x\/google\/start\?k=\w+/)?.[0];
assert.ok(link, notConnected);
assert.equal((await worker.fetch(new Request("https://x/google/start?k=wrong"), env, {})).status, 403);
const start = await worker.fetch(new Request(link), env, {});
assert.equal(start.status, 302);
assert.match(start.headers.get("location"), /gmail\.readonly.*calendar\.events/);
const k = new URL(link).searchParams.get("k");
assert.equal((await worker.fetch(new Request(`https://x/google/callback?code=c&state=bad`), env, {})).status, 403);
assert.equal((await worker.fetch(new Request(`https://x/google/callback?code=c&state=${k}`), env, {})).status, 200);
assert.equal(docs.get("agentReports/google").refreshToken, "r");

assert.match(await callTool("יש מיילים חדשים?", { name: "search_email", args: { query: "is:unread" } }), /טורניר/);
assert.match(await callTool("מה כתוב בו?", { name: "read_email", args: { id: "e1" } }), /גוף המייל/);
assert.match(await callTool("תנסחי תשובה", { name: "draft_email", args: { to: "matnas@x", subject: "תודה", body: "נגיע", reply_to_id: "e1" } }), /טיוטה/);
const draft = google.find((g) => g.url.endsWith("/drafts"));
assert.equal(draft.body.message.threadId, "t1");
const raw = Buffer.from(draft.body.message.raw, "base64url").toString();
assert.match(raw, /In-Reply-To: <m1@x>/);
assert.ok(raw.includes(Buffer.from("נגיע").toString("base64")));
assert.equal(google.some((g) => g.url.includes("/send")), false, "אף פעם לא שולחים מייל");

assert.match(await callTool("מה יש לי השבוע?", { name: "list_events", args: {} }), /אימון/);
const ev = { name: "create_event", args: { title: "פגישה", start: "2026-10-05T10:00", end: "2026-10-05T11:00" } };
assert.match(await callTool("תקבעי פגישה מחר ב-10", ev), /לא נוסף/);
assert.match(await callTool("כן", ev), /נוסף ליומן: פגישה/);
assert.equal(google.at(-1).body.start.dateTime, "2026-10-05T10:00:00");

// 8ב. דרייב: חיפוש, גיליון כ-CSV, PDF כקישור בלבד
const found = JSON.parse(await callTool("איפה טבלת התשלומים?", { name: "search_drive", args: { query: "תשלומים' or x" } }));
assert.equal(found[0].type, "spreadsheet");
assert.ok(decodeURIComponent(google.at(-1).url.replace(/\+/g, " ")).includes("name contains 'תשלומים  or x'"), "גרש בחיפוש לא שובר את השאילתה");
assert.match(await callTool("מה כתוב בה?", { name: "read_drive_file", args: { id: "f1" } }), /תשלומים\nשורה,ערך/);
assert.match(await callTool("ומה בפלאייר?", { name: "read_drive_file", args: { id: "f2" } }), /https:\/\/d\/f2/);
assert.match(start.headers.get("location"), /drive\.readonly/);

// 8ג. גוגל משימות (במקום קיפ)
assert.deepEqual(JSON.parse(await callTool("מה המשימות שלי?", { name: "list_tasks", args: {} })), [{ title: "להזמין כדורים", notes: "", due: "2026-10-05" }]);
assert.match(await callTool("תזכירי לי לקנות רשתות", { name: "add_task", args: { title: "לקנות רשתות", due: "2026-10-06" } }), /נוספה משימה: לקנות רשתות/);
assert.equal(google.at(-1).body.due, "2026-10-06T00:00:00.000Z");
assert.match(start.headers.get("location"), /auth%2Ftasks|auth\/tasks/);

globalThis.tasks403 = true;
assert.match(await callTool("מה המשימות?", { name: "list_tasks", args: {} }), /insufficient scopes — לשלוח לבעלים את הקישור לחיבור מחדש: https:\/\/x\/google\/start/);
globalThis.tasks403 = false;

// 9. מזג אוויר
const wx = JSON.parse(await callTool("מה מזג האוויר?", { name: "get_weather", args: { place: "שאר ישוב" } }));
assert.equal(wx.now.sky, "בהיר ברובו");
assert.deepEqual(wx.days[0], { date: "2026-10-03", sky: "גשם קל", min: 15, max: 26, rainChance: 70, windKmh: 20 });
assert.match(await callTool("מזג אוויר?", { name: "get_weather", args: { place: "xyzxyz" } }), /לא מצאתי/);

// 10. השמות הישנים מה-worker הידני עובדים
const oldEnv = { ...env, WA_TOKEN: env.WHATSAPP_TOKEN, WA_PHONE_ID: "999", ALLOWED_FROM: env.OWNER_PHONE, VERIFY_TOKEN: "old" };
for (const k of ["WHATSAPP_TOKEN", "WHATSAPP_PHONE_ID", "OWNER_PHONE", "WEBHOOK_VERIFY_TOKEN"]) delete oldEnv[k];
const health = await (await worker.fetch(new Request("https://x/health"), oldEnv, {})).json();
assert.deepEqual(health, { ok: true, missing: [] });
assert.equal(await (await worker.fetch(new Request("https://x/webhook?hub.mode=subscribe&hub.verify_token=old&hub.challenge=42"), oldEnv, {})).text(), "42");
geminiQueue.push([{ text: "שלום מהשמות הישנים" }]);
const rawOld = JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ id: "old1", from: env.OWNER_PHONE, type: "text", text: { body: "היי" } }] } }] }] });
const waits = [];
await worker.fetch(new Request("https://x/webhook", { method: "POST", body: rawOld, headers: { "x-hub-signature-256": "sha256=" + createHmac("sha256", env.META_APP_SECRET).update(rawOld).digest("hex") } }), oldEnv, { waitUntil: (p) => waits.push(p) });
await Promise.all(waits);
assert.equal(texts().at(-1), "שלום מהשמות הישנים");

// 11. תזכורת נוכחות למאמנים: יום ראשון 18:00 בישראל, האימון נגמר ב-17:00
const { remindCoaches } = await import("../src/reminders.js");
const { db } = await import("../src/firestore.js");
const { waConfig } = await import("../../agents/lib/whatsapp.mjs");
put("groups/g3", { name: "נוער", days: [0], endTime: "17:00", coachIds: ["u1", "u2"] });
put("groups/g5", { name: "בוגרים", days: [0], endTime: "17:00", coachId: "u1" });
put("groups/g6", { name: "ערב", days: [0], endTime: "19:30", coachId: "u1" });
put("users/u1", { name: "יוסי", phone: "050-1234567" });
put("users/u2", { name: "רון" });
for (const [p, g] of [["p4", "g3"], ["p5", "g5"], ["p6", "g6"]]) put(`players/${p}`, { name: p, groupId: g, isActive: true });
put("attendance/2026-10-04_g5_p5", { date: "2026-10-04", groupId: "g5", playerId: "p5", status: "Present" });
const sunday = new Date("2026-10-04T15:00:00Z");
const n0 = sent.length;
const rem = await remindCoaches(env, db(env), waConfig(env), sunday);
const tpl = sent.slice(n0).filter((b) => b.type === "template");
assert.equal(tpl.length, 1, "רק המאמן של נוער (בוגרים מילאו, ערב עוד לא נגמר)");
assert.equal(tpl[0].to, "972501234567");
assert.deepEqual(tpl[0].template.components[0].parameters.map((p) => p.text), ["יוסי", "נוער"]);
assert.match(rem, /נוער — רון: אין טלפון שמור/);
assert.match(texts().at(-1), /נוכחות שלא מולאה היום/);
assert.equal(await remindCoaches(env, db(env), waConfig(env), sunday), "nothing due", "לא שולחים פעמיים");

// 12. פרסום לפייסבוק ולאינסטגרם: רק אחרי "כן", ותמונה מהוואטסאפ עוברת דרך /meta/media
const notMeta = await callTool("תחברי את פייסבוק", { name: "publish_post", args: { platform: "both", text: "אימון", image: "777" } });
const metaLink = notMeta.match(/https:\/\/x\/meta\/start\?k=\w+/)?.[0];
assert.ok(metaLink, "בלי חיבור — שולחים קישור");
const mk = new URL(metaLink).searchParams.get("k");
assert.notEqual(mk, k, "מפתח נפרד מגוגל");
assert.match((await worker.fetch(new Request(metaLink), env, {})).headers.get("location"), /instagram_content_publish/);
assert.equal((await worker.fetch(new Request("https://x/meta/callback?code=c&state=bad"), env, {})).status, 403);
assert.match(await (await worker.fetch(new Request(`https://x/meta/callback?code=c&state=${mk}`), env, {})).text(), /@club/);
assert.equal(docs.get("agentReports/social").pages[0].token, "ptok");
assert.match(await callTool("כן תפרסמי", { name: "publish_post", args: { platform: "both", text: "אימון מחר", image: "777" } }), /עוד לא פורסם/, "כן בתוך הבקשה עצמה לא מפרסם");
assert.equal(social.length, 0);
assert.match(await callTool("כן", { name: "publish_post", args: { platform: "both", text: "אימון מחר", image: "777" } }), /פייסבוק.*✓.*אינסטגרם \(@club\) ✓/);
assert.equal(social[0].body.url, `https://x/meta/media/777?k=${mk}`);
assert.deepEqual(social.map((x) => x.url.split("/v24.0/")[1]), ["pg1/photos", "ig1/media", "ig1/media_publish"]);
assert.equal((await worker.fetch(new Request("https://x/meta/media/777?k=bad"), env, {})).status, 403);

// 13. הודעות בשם המועדון: מאמנים לפי תפקיד, שם, מתוזמן, ביטול
put("users/u1", { role: "coach" });
put("users/u3", { name: "מנהלת", role: "admin", phone: "0527654321" });
const prev = JSON.parse(await callTool("תשלחי למאמנים", { name: "preview_recipients", args: { to: ["מאמנים", "דני"] } }));
assert.deepEqual(prev.recipients, ["יוסי (…4567)", "מנהלת (…4321)"]);
assert.match(prev.problems.join(), /"דני" מתאים לכמה/);
const n0m = sent.length;
assert.match(await callTool("תשלחי למאמנים ישיבה מחר", { name: "send_message", args: { to: ["מאמנים"], text: "ישיבה מחר\nב-20:00" } }), /עוד לא נשלח/, "\"תשלחי\" בבקשה עצמה הוא לא אישור");
assert.equal(sent.slice(n0m).filter((b) => b.type === "template").length, 0);
assert.match(await callTool("כן", { name: "send_message", args: { to: ["מאמנים"], text: "ישיבה אחרת" } }), /עוד לא נשלח/, "אישור על נוסח אחר לא שולח");
await callTool("תשלחי", { name: "send_message", args: { to: ["מאמנים"], text: "ישיבה מחר\nב-20:00" } });
const n1 = sent.length;
assert.match(await callTool("שלח", { name: "send_message", args: { to: ["מאמנים"], text: "ישיבה מחר\nב-20:00" } }), /נשלח: יוסי ✓ · מנהלת ✓/);
const m1 = sent.slice(n1).filter((b) => b.type === "template");
assert.deepEqual(m1.map((b) => [b.to, b.template.name, b.template.components[0].parameters[0].text]), [["972501234567", "club_message", "ישיבה מחר · ב-20:00"], ["972527654321", "club_message", "ישיבה מחר · ב-20:00"]]);
assert.match(await callTool("כן", { name: "send_message", args: { to: ["נועה"], text: "תזכורת", at: "2099-01-01T18:00" } }), /לא נשלח: אין נמענים.*אין טלפון/);
put("players/p2", { parentPhone: "0541112222" });
await callTool("תתזמני", { name: "send_message", args: { to: ["נועה", "מנהלת"], text: "תזכורת", at: "2099-01-01T18:00" } });
const sch = await callTool("כן", { name: "send_message", args: { to: ["נועה", "מנהלת"], text: "תזכורת", at: "2099-01-01T18:00" } });
const sid = sch.match(/מזהה (\w+)/)[1];
assert.equal(docs.get("agentReports/bot").scheduled[0].due, "2099-01-01T16:00:00.000Z", "18:00 בחורף בישראל = 16:00 UTC");
await callTool("ועוד אחת", { name: "send_message", args: { to: ["מנהלת"], text: "שנייה", at: "2099-01-02T18:00" } });
await callTool("כן", { name: "send_message", args: { to: ["מנהלת"], text: "שנייה", at: "2099-01-02T18:00" } });
assert.match(await callTool("תבטלי", { name: "scheduled_messages", args: { cancel: sid } }), /בוטלה/);
assert.equal(JSON.parse(await callTool("מה מתוזמן?", { name: "scheduled_messages", args: {} })).length, 1);
const { sendDue, ensureTemplates } = await import("../src/messages.js");
const n2 = sent.length;
assert.deepEqual(await sendDue(db(env), waConfig(env), new Date("2099-01-02T17:00:00Z")), ["• 2099-01-02 18:00: מנהלת ✓"]);
assert.equal(sent.slice(n2).filter((b) => b.type === "template").length, 1);
assert.equal(docs.get("agentReports/bot").scheduled.length, 0, "לא נשלח פעמיים");
const tres = await ensureTemplates({ ...env, WHATSAPP_WABA_ID: "w1" });
assert.ok(templatesPosted.includes("club_message") && templatesPosted.includes("coach_attendance_reminder") && !templatesPosted.includes("agent_alert"));
assert.match(tres.join(), /club_message: PENDING/);

assert.match(await (await worker.fetch(new Request("https://x/privacy"), env, {})).text(), /מדיניות פרטיות/);

// 14. תיבת בקשות לקלוד
const { createHash } = await import("node:crypto");
const ienv = { ...env, INBOX_KEY_SHA256: createHash("sha256").update("sekret").digest("hex") };
assert.match(await callTool("מה יש לי ביומן מחר?", { name: "ask_claude", args: { request: "מה יש ביומן מחר" } }), /נרשם/);
assert.equal((await worker.fetch(new Request("https://x/inbox?k=bad"), ienv, {})).status, 403);
const open1 = await (await worker.fetch(new Request("https://x/inbox?k=sekret"), ienv, {})).json();
assert.equal(open1.at(-1).request, "מה יש ביומן מחר");
const n3 = sent.length;
const ans = await worker.fetch(new Request("https://x/inbox?k=sekret", { method: "POST", body: JSON.stringify({ id: open1.at(-1).id, answer: "אימון ב-17:00" }) }), ienv, {});
assert.equal(ans.status, 200);
assert.match(sent.slice(n3).map((b) => b.text?.body || "").join(), /תשובה מקלוד.*אימון ב-17:00/s);
assert.equal((await (await worker.fetch(new Request("https://x/inbox?k=sekret"), ienv, {})).json()).length, 0);
assert.equal((await worker.fetch(new Request("https://x/inbox?k=sekret", { method: "POST", body: JSON.stringify({ id: open1.at(-1).id, answer: "שוב" }) }), ienv, {})).status, 404, "לא עונים פעמיים");

console.log("all bot tests passed");
