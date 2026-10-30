// 📊 הסיכום השבועי לשולה — שישי ב-14:00: נוכחות השבוע, מה חסר לסדר ואיך להשתפר.
// קריאה בלבד מ-Firestore; לא שולח שום דבר להורים. ביומן (ציבורי) מודפסים רק מספרים.
import { firestore, loadAll, heartbeat } from "./lib/firebase.mjs";
import { addDays, israelToday } from "./lib/analysis.mjs";
import { randomUUID } from "node:crypto";
import admin from "firebase-admin";
import { weeklySummary, coachMessages } from "./lib/weekly.mjs";
import { tellOwner } from "./lib/owner.mjs";

const db = firestore();
const today = israelToday();
// 13 שבועות — מספיק לסכנת נשירה (12 שבועות) ולהשוואה לחודש שלפני
const from = addDays(today, -91);
const [players, groups, attendance, cancellations, users, quiet] = await Promise.all([
  loadAll(db, "players"),
  loadAll(db, "groups"),
  loadAll(db, "attendance", (c) => c.where("date", ">=", from)),
  loadAll(db, "cancellations", (c) => c.where("date", ">=", from)),
  loadAll(db, "users"),
  db.collection("agentReports").doc("coaches").get().then((s) => s.data()?.quiet || []),
]);

const { text: summary, counts } = weeklySummary({ players, groups, attendance, cancellations, today });
// הודעה לכל מדריך על הקבוצה שלו. נכנסת לתור של ה-worker, שמוציא אחת אחרי השנייה ומעדכן את הבעלים כשהמדריך קרא (watchReads)
const coaches = coachMessages({ players, groups, users, attendance, cancellations, today, quiet });
const at = new Date().toISOString();
const items = coaches.map((c) => ({ id: randomUUID(), from: "weekly-coach", key: "weekly-coach", at, to: c.phone, who: c.name, uid: c.uid, text: c.text, template: "club_message", templateParam: c.param }));
// preview: ההודעות למדריכים מגיעות רק לבעלים, לבדיקה, ואף מדריך לא מקבל כלום
const preview = process.env.WEEKLY_PREVIEW === "1";
if (preview) for (const c of coaches) await tellOwner(db, { agent: "weekly-preview", text: `👀 תצוגה מקדימה — כך ${c.name} יקבל:\n\n${c.text}`, templateParam: `תצוגה מקדימה להודעה ל${c.name}` });
else if (items.length) await db.collection("agentReports").doc("bot").set({ outboxQueue: admin.firestore.FieldValue.arrayUnion(...items) }, { merge: true });
const text = preview ? `${summary}\n\n👀 זו תצוגה מקדימה — לא נשלח כלום למדריכים.` : coaches.length ? `${summary}\n\n📨 נשלח סיכום שבועי ל-${coaches.length} מדריכים: ${coaches.map((c) => c.name).join(", ")}. תקבל עדכון כשכל אחד קורא.` : summary;
console.log(`weekly: ${JSON.stringify(counts)}, coaches queued: ${items.length}`);
await db.collection("agentReports").doc("weekly").set({ date: today, createdAt: new Date().toISOString(), text, counts });
await tellOwner(db, { agent: "weekly", text, templateParam: "הסיכום השבועי של המועדון מחכה לך" });
await heartbeat(db, "weekly");
