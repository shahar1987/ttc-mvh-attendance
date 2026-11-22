// 🏢 החיבור לאפליקציה "החברה של שולה": היסטוריה נקייה, דוחות הסוכנים, ותשובת קלוד שחוזרת לאפליקציה.
import assert from "node:assert/strict";
import { appHistory, reports } from "../src/company.js";
import { inboxRoute, sha256 } from "../src/inbox.js";

const fake = (docs) => ({
  get: async (p) => docs[p] ?? null,
  merge: async (p, o) => void (docs[p] = { ...(docs[p] || {}), ...o }),
  update: async (p, f) => { const v = f(docs[p] || {}); if (v) docs[p] = { ...(docs[p] || {}), ...v }; },
  where: async () => [],
});

// היסטוריה: רק user/assistant עם טקסט, 16 אחרונות, ומה שהבעלים כתב מסומן owner (בשביל שער ה"כן")
const h = appHistory([{ role: "system", text: "x" }, { role: "user", text: "שלח לדור" }, { role: "assistant", text: "לשלוח?" }, { role: "user", text: "" }, null]);
assert.deepEqual(h, [{ role: "user", text: "שלח לדור", owner: "שלח לדור" }, { role: "assistant", text: "לשלוח?" }]);
assert.equal(appHistory(Array.from({ length: 30 }, (_, i) => ({ role: "user", text: String(i) }))).length, 16);
assert.deepEqual(appHistory("x"), []);

// דוחות: מה שהסוכנים שלחו בשבוע האחרון, לפי זמן
const now = Date.parse("2026-11-15T12:00:00Z");
const r = await reports({}, fake({ "agentReports/bot": { outbox: { scan: { at: "2026-11-15T05:00:00Z", text: "דוח בוקר" }, ideas: { at: "2026-11-01T05:00:00Z", text: "ישן" }, bugcheck: { at: "2026-11-14T05:00:00Z", text: "באגים" }, bad: { at: "2026-11-15T05:00:00Z" } } } }), now);
assert.deepEqual(r.map((x) => x.agent), ["bugcheck", "scan"]);

// תשובת קלוד לבקשה מהאפליקציה חוזרת לאפליקציה ולא לוואטסאפ
const KEY = "k1";
const docs = { "agentReports/bot": {}, "agentReports/ask_abc": { inboxStatus: "open", request: "מה ביומן מחר?", channel: "app" } };
const said = [];
const env = { INBOX_KEY_SHA256: await sha256(KEY), COMPANY: { say: async (m) => void said.push(m) } };
const realFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error("no WhatsApp in this test"); };
const res = await inboxRoute(new Request(`https://x/inbox?k=${KEY}`, { method: "POST", body: JSON.stringify({ id: "abc", answer: "שתי פגישות" }) }), env, fake(docs), { token: "t", phoneId: "1" });
assert.equal(res.status, 200);
assert.equal(said.length, 1);
assert.match(said[0].text, /שתי פגישות/);
assert.equal(docs["agentReports/ask_abc"].inboxStatus, "done");
assert.match(docs["agentReports/bot"].log.at(-1).user, /באפליקציה/);
globalThis.fetch = realFetch;
// מהאפליקציה מערכת הנוכחות לקריאה בלבד: כל שם חסום הוא כלי אמיתי (שגיאת כתיב הייתה משאירה אותו פתוח)
const { APP_BLOCKED } = await import("../src/index.js");
const { TOOL_DEFS } = await import("../src/tools.js");
const { MESSAGE_TOOL_DEFS } = await import("../src/messages.js");
const { INBOX_TOOL_DEFS } = await import("../src/inbox.js");
const { COACH_ADMIN_TOOL_DEFS } = await import("../src/coaches.js");
const names = new Set([...TOOL_DEFS, ...MESSAGE_TOOL_DEFS, ...INBOX_TOOL_DEFS, ...COACH_ADMIN_TOOL_DEFS].map((d) => d.name));
for (const n of APP_BLOCKED) assert.ok(names.has(n), n);
for (const n of ["get_attendance", "list_groups", "find_player", "get_daily_report", "send_message", "ask_claude"]) assert.ok(!APP_BLOCKED.has(n), n);
// APP_BLOCKED היא רשימה שחורה: כלי חדש נפתח לערוץ הזה אוטומטית. לכן כל הכלים הפתוחים רשומים כאן, וכלי שנוסף ולא סווג מפיל את הבדיקה —
// מי שמוסיף כלי מחליט במפורש אם הוא פתוח באפליקציה (מוסיפים לרשימה) או חסום (מוסיפים ל-APP_BLOCKED).
const allDefs = [TOOL_DEFS, MESSAGE_TOOL_DEFS, INBOX_TOOL_DEFS, COACH_ADMIN_TOOL_DEFS, (await import("../src/meta.js")).META_TOOL_DEFS, (await import("../src/solar.js")).SOLAR_TOOL_DEFS, (await import("../src/inbox.js")).MEMORY_TOOL_DEFS].flat();
const OPEN_IN_APP = ["ask_claude", "claude_link", "find_player", "get_agent_results", "get_attendance", "get_daily_report", "get_weather", "list_groups", "preview_recipients", "publish_post", "recall", "remember", "remind_me", "run_agent_now", "save_post_rule", "scheduled_messages", "send_message", "solar_bills", "solar_dashboard", "solar_link", "solar_logout", "solar_rate"];
assert.deepEqual([...new Set(allDefs.map((d) => d.name))].filter((n) => !APP_BLOCKED.has(n)).sort(), OPEN_IN_APP, "כלי חדש לא סווג לערוץ האפליקציה");
console.log("company: ok");
