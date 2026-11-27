// הודעה קולית שחיכתה לחלון פתוח יוצאת ברגע שהבעלים עונה, והרשימה מתנקה
import assert from "node:assert/strict";
import { flushVoice } from "../src/index.js";

const docs = { "agentReports/voice_a": { b64: Buffer.from("x").toString("base64"), mime: "audio/ogg" }, "agentReports/bot": { pendingVoice: ["a", "gone"] } };
const store = {
  async get(p) { return docs[p] || null; },
  async merge(p, d) { docs[p] = { ...(docs[p] || {}), ...d }; },
};
const calls = [];
globalThis.fetch = async (url, init) => {
  calls.push(String(url));
  return new Response(JSON.stringify(String(url).endsWith("/media") ? { id: "m1" } : { messages: [{ id: "w1" }] }), { status: 200 });
};
const wa = { token: "t", phoneId: "p", owner: "o" };
assert.equal(await flushVoice(store, wa, []), 0);
assert.equal(await flushVoice(store, wa, ["a", "gone"]), 1);
assert.deepEqual(docs["agentReports/bot"].pendingVoice, []);
assert.equal(docs["agentReports/voice_a"].how, "voice");
assert.equal(calls.filter((u) => u.endsWith("/media")).length, 1);
console.log("voice ok");
