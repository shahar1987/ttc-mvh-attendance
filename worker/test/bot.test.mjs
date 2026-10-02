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
const geminiCalls = [];
const sent = [];
globalThis.fetch = async (url, init = {}) => {
  url = String(url);
  const json = (o, status = 200) => new Response(JSON.stringify(o), { status });
  if (url.startsWith("https://oauth2")) return json({ access_token: "a", expires_in: 3600 });
  if (url.includes("generativelanguage")) {
    geminiCalls.push(JSON.parse(init.body));
    return json({ candidates: [{ content: { parts: geminiQueue.shift() } }] });
  }
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

const worker = (await import("../src/index.js")).default;
const webhook = async (text, from = env.OWNER_PHONE, id = "m" + Math.random()) => {
  const raw = JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ id, from, type: "text", text: { body: text } }] } }] }] });
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
assert.equal(sent.at(-1).text.body, "סימנתי את נועה כנוכחת. 'דני' מתאים לשני שחקנים.");
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

console.log("all bot tests passed");
