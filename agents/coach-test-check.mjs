// בדיקה חד-פעמית לקריאה בלבד: מה קרה בשליחת הבדיקה למאמנים (10.10.2026). הלוג ציבורי — רק מספרים והודעות שגיאה, בלי שמות.
import { firestore } from "./lib/firebase.mjs";
const bot = (await firestore().collection("agentReports").doc("bot").get()).data() || {};
const mask = (s) => String(s || "").replace(/\d{7,}/g, "<num>");
const t = bot.outbox?.["coach-test"];
const lines = (t?.text || "").split("\n").slice(1);
console.log("flag:", bot.coachReminderTest || "none");
console.log("summary at:", t?.at || "none", "how:", t?.how || "-");
console.log("sent:", lines.filter((l) => l.includes("נשלחה ✓")).length, "failed:", lines.filter((l) => l.includes("נכשלה")).length, "no phone:", lines.filter((l) => l.includes("אין טלפון")).length);
for (const e of new Set(lines.filter((l) => l.includes("נכשלה")).map((l) => mask(l.split("נכשלה")[1])))) console.log("error:", e);
console.log("lastCronError:", bot.lastCronError?.at, mask(bot.lastCronError?.message));
console.log("templates:", bot.templates?.at, mask(JSON.stringify(bot.templates?.result)));
console.log("lastOwnerMsgAt:", bot.lastOwnerMsgAt);
