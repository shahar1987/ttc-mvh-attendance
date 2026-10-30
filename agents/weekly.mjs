// 📊 הסיכום השבועי לשולה — שישי ב-14:00: נוכחות השבוע, מה חסר לסדר ואיך להשתפר.
// קריאה בלבד מ-Firestore; לא שולח שום דבר להורים. ביומן (ציבורי) מודפסים רק מספרים.
import { firestore, loadAll, heartbeat } from "./lib/firebase.mjs";
import { addDays, israelToday } from "./lib/analysis.mjs";
import { randomUUID } from "node:crypto";
import admin from "firebase-admin";
import { weeklySummary, coachMessages, weeklyHealth, weeklyChanges } from "./lib/weekly.mjs";
import { tellOwner } from "./lib/owner.mjs";

const db = firestore();
const today = israelToday();
// 13 שבועות — מספיק לסכנת נשירה (12 שבועות) ולהשוואה לחודש שלפני
const from = addDays(today, -91);
const [players, groups, attendance, cancellations, users, quiet, bot, last] = await Promise.all([
  loadAll(db, "players"),
  loadAll(db, "groups"),
  loadAll(db, "attendance", (c) => c.where("date", ">=", from)),
  loadAll(db, "cancellations", (c) => c.where("date", ">=", from)),
  loadAll(db, "users"),
  db.collection("agentReports").doc("coaches").get().then((s) => s.data()?.quiet || []),
  db.collection("agentReports").doc("bot").get().then((s) => s.data() || {}),
  db.collection("agentReports").doc("weekly").get().then((s) => s.data() || {}),
]);
const health = weeklyHealth({ groups, users, quiet, bot });

const { text: summary, counts } = weeklySummary({ players, groups, attendance, cancellations, today });
// הודעה לכל מדריך על הקבוצה שלו. נכנסת לתור של ה-worker, שמוציא אחת אחרי השנייה ומעדכן את הבעלים כשהמדריך קרא (watchReads)
const coaches = coachMessages({ players, groups, users, attendance, cancellations, today, quiet });
const at = new Date().toISOString();
const items = coaches.map((c) => ({ id: randomUUID(), from: "weekly-coach", key: "weekly-coach", at, to: c.phone, who: c.name, uid: c.uid, text: c.text, template: "club_message", templateParam: c.param }));
// preview: ההודעות למדריכים מגיעות רק לבעלים, לבדיקה, ואף מדריך לא מקבל כלום
const preview = process.env.WEEKLY_PREVIEW === "1";
if (preview) for (const c of coaches) await tellOwner(db, { agent: "weekly-preview", text: `👀 תצוגה מקדימה — כך ${c.name} יקבל:\n\n${c.text}`, templateParam: `תצוגה מקדימה להודעה ל${c.name}` });
else if (items.length) await db.collection("agentReports").doc("bot").set({ outboxQueue: admin.firestore.FieldValue.arrayUnion(...items) }, { merge: true });
// מה השתנה מול השבוע שעבר (בפעם הראשונה אין עם מה להשוות)
const nowFacts = Object.fromEntries(coaches.map((c) => [c.uid, { name: c.name, facts: c.facts }]));
const changes = last.coachFacts ? weeklyChanges(last.coachFacts, nowFacts) : [];
const changed = changes.length ? `\n\n🔄 מה השתנה אצל המדריכים מהשבוע שעבר:\n${changes.map((x) => `• ${x}`).join("\n")}` : "";
const check = health.problems.length || health.notes.length ? `\n\n🩺 בדיקת המערכת:\n${[...health.problems.map((x) => `❗ ${x}`), ...health.notes.map((x) => `• ${x}`)].join("\n")}` : "\n\n🩺 בדיקת המערכת: הכל תקין";
const text = (preview ? `${summary}\n\n👀 זו תצוגה מקדימה — לא נשלח כלום למדריכים.` : coaches.length ? `${summary}\n\n📨 נשלח סיכום שבועי ל-${coaches.length} מדריכים: ${coaches.map((c) => c.name).join(", ")}. אישור מסירה יגיע תוך כמה דקות.` : summary) + changed + check;
console.log(`::notice::weekly coaches=${coaches.length} problems=${health.problems.length} notes=${health.notes.length} preview=${preview}`);
console.log(`weekly: ${JSON.stringify(counts)}, coaches queued: ${items.length}`);
// תצוגה מקדימה לא מזיזה את נקודת ההשוואה של השבוע הבא
await db.collection("agentReports").doc("weekly").set({ date: today, createdAt: new Date().toISOString(), text, counts, ...(preview ? {} : { coachFacts: nowFacts }) }, { merge: true });
await tellOwner(db, { agent: "weekly", text, templateParam: "הסיכום השבועי של המועדון מחכה לך" });

// אישור מסירה: ה-worker מוציא את התור כל רבע שעה. מחכים עד 25 דקות שכל ההודעות יצאו, ומודיעים לבעלים בכל מקרה —
// "נשלח" או "לא יצא", כדי שלא יהיה ניחוש. ✓✓ קרא מגיע אחר כך מה-worker, לכל מדריך שפותח (אם אישורי קריאה פעילים אצלו).
if (!preview && items.length) {
  const ids = new Set(items.map((x) => x.id));
  let left = items.length;
  for (let i = 0; i < 25 && left; i++) {
    await new Promise((r) => setTimeout(r, 60_000));
    const q = (await db.collection("agentReports").doc("bot").get()).data()?.outboxQueue || [];
    left = q.filter((x) => ids.has(x.id)).length;
  }
  const sent = items.length - left;
  console.log(`::notice::weekly delivery sent=${sent} stuck=${left}`);
  await tellOwner(db, {
    agent: "weekly",
    text: left ? `❗ הסיכום השבועי למדריכים: ${sent} יצאו, ${left} עדיין לא יצאו אחרי 25 דקות — השרת של שולה לא מוציא את התור. אבדוק את זה.` : `✅ הסיכום השבועי נשלח לכל ${sent} המדריכים. תקבל עדכון כשכל אחד קורא.`,
    templateParam: left ? "הסיכום השבועי למדריכים לא יצא במלואו" : "הסיכום השבועי נשלח לכל המדריכים",
  });
  if (left) process.exitCode = 1;
}
await heartbeat(db, "weekly");
