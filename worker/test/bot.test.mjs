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
  if (url.startsWith("https://www.googleapis.com/calendar")) {
    google.push({ url, method: init.method || "GET", body: init.body && JSON.parse(init.body) });
    return init.method === "POST" ? json({ summary: JSON.parse(init.body).summary }) : json({ items: [{ summary: "אימון", start: { dateTime: "2026-10-04T16:30:00+03:00" }, end: { dateTime: "2026-10-04T17:30:00+03:00" } }] });
  }
  if (url.includes("generativelanguage")) {
    geminiCalls.push(JSON.parse(init.body));
    return json({ candidates: [{ content: { parts: geminiQueue.shift() } }] });
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
assert.equal(last[0].text, "📷 [תמונה] מה דעתך על הפלאייר?");
assert.equal(last[1].inlineData.mimeType, "image/jpeg");

// 7. המפקח: OK = שקט, בעיה = הודעה לבעלים + נכנס ל-outbox
geminiQueue.push([{ text: "OK" }]);
assert.equal(await review(env), "ok");
geminiQueue.push([{ text: "1. ביקש פלאייר — שולה לא החזירה טיוטה" }]);
assert.equal(await review(env), "sent");
assert.match(texts().at(-1), /המפקח על שולה[\s\S]*לא החזירה טיוטה/);
assert.match(docs.get("agentReports/bot").outbox.review.text, /לא החזירה טיוטה/);
assert.match(geminiCalls.at(-1).contents[0].parts[0].text, /הבעלים: 📷 \[תמונה\]/);

// 8. מייל ויומן: לפני חיבור — קישור; אחרי חיבור — קריאה, טיוטה (לא שליחה), אירוע רק באישור
const callTool = async (msg, call) => {
  geminiQueue.push([{ functionCall: call }], [{ text: "ok" }]);
  await webhook(msg);
  return geminiCalls.at(-1).contents.at(-1).parts[0].functionResponse.response.result;
};
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

// 9. מזג אוויר
const wx = JSON.parse(await callTool("מה מזג האוויר?", { name: "get_weather", args: { place: "שאר ישוב" } }));
assert.equal(wx.now.sky, "בהיר ברובו");
assert.deepEqual(wx.days[0], { date: "2026-10-03", sky: "גשם קל", min: 15, max: 26, rainChance: 70, windKmh: 20 });
assert.match(await callTool("מזג אוויר?", { name: "get_weather", args: { place: "xyzxyz" } }), /לא מצאתי/);

console.log("all bot tests passed");
