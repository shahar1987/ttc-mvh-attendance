// 📊 הסיכום השבועי לשולה — שישי ב-14:00: נוכחות השבוע, מה חסר לסדר ואיך להשתפר.
// קריאה בלבד מ-Firestore; לא שולח שום דבר להורים. ביומן (ציבורי) מודפסים רק מספרים.
import { firestore, loadAll, heartbeat } from "./lib/firebase.mjs";
import { addDays, israelToday } from "./lib/analysis.mjs";
import { weeklySummary } from "./lib/weekly.mjs";
import { tellOwner } from "./lib/owner.mjs";

const db = firestore();
const today = israelToday();
// 13 שבועות — מספיק לסכנת נשירה (12 שבועות) ולהשוואה לחודש שלפני
const from = addDays(today, -91);
const [players, groups, attendance, cancellations] = await Promise.all([
  loadAll(db, "players"),
  loadAll(db, "groups"),
  loadAll(db, "attendance", (c) => c.where("date", ">=", from)),
  loadAll(db, "cancellations", (c) => c.where("date", ">=", from)),
]);

const { text, counts } = weeklySummary({ players, groups, attendance, cancellations, today });
console.log(`weekly: ${JSON.stringify(counts)}`);
await db.collection("agentReports").doc("weekly").set({ date: today, createdAt: new Date().toISOString(), text, counts });
await tellOwner(db, { agent: "weekly", text, templateParam: "הסיכום השבועי של המועדון מחכה לך" });
await heartbeat(db, "weekly");
