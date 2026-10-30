// 🩺 אבחון התור לוואטסאפ (הפעלה ידנית: Agents ⟵ diag). קריאה בלבד. מדפיס ליומן הציבורי רק ספירות,
// גילאים ושגיאות — כל רצף של 7 ספרות ומעלה מוסתר, ושמות לא מודפסים.
import { firestore } from "./lib/firebase.mjs";

const db = firestore();
const bot = (await db.collection("agentReports").doc("bot").get()).data() || {};
const now = Date.now();
const age = (iso) => (iso ? `${Math.round((now - new Date(iso)) / 60000)}m` : "-");
const clean = (s) => String(s || "").replace(/\d{7,}/g, "#").replace(/\s+/g, " ").slice(0, 300);
const q = Array.isArray(bot.outboxQueue) ? bot.outboxQueue : [];
console.log(`::notice::queue=${q.length} lastCronError=${age(bot.lastCronError?.at)} lastCoachError=${age(bot.lastCoachError?.at)} lastOwnerMsg=${age(bot.lastOwnerMsgAt)}`);
for (const x of q) console.log(`::notice::item from=${x.from} to=${x.to ? "yes" : "owner"} age=${age(x.at)} attempts=${x.attempts || 0} claimed=${age(x.claimedAt)} template=${x.template || "-"}`);
if (bot.lastCronError) console.log(`::notice::cronError ${clean(bot.lastCronError.message)}`);
if (bot.lastCoachError) console.log(`::notice::coachError ${clean(bot.lastCoachError.message)}`);
for (const f of (bot.failLog || []).slice(-5)) console.log(`::notice::fail age=${age(f.at)} ${clean(JSON.stringify(f.errors || ""))}`);
const t = bot.templates;
if (t) console.log(`::notice::templates age=${age(t.at)} ${clean((t.result || []).join(" | "))}`);
