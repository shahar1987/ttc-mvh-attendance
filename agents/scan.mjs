// 🔎 הסורק היומי — כל בוקר: מי לא הגיע, מי החסיר פעמיים ברצף, מי בסכנת נשירה.
//
// כותב את הדוח המלא ל-agentReports/latest (ועותק לפי תאריך), ושולח לשולה סיכום.
// לא שולח שום הודעה להורים — זה קורה רק אחרי "שלח" בוואטסאפ (worker/src/tools.js).
//
// פרטיות: הריפו ציבורי והיומן גלוי, ולכן מודפסים רק מספרים.
import { firestore, loadAll, heartbeat } from "./lib/firebase.mjs";
import { analyze, addDays, israelToday, oneLineSummary, fullReportText, registrationIssues, coachNotesText } from "./lib/analysis.mjs";
import { tellOwner } from "./lib/owner.mjs";

const db = firestore();
const today = israelToday();
// 13 שבועות אחורה מספיקים לכל החישובים (סכנת נשירה משווה ל-12 השבועות האחרונים)
const from = addDays(today, -91);

const [players, groups, attendance, sync, ignores, cancellations] = await Promise.all([
  loadAll(db, "players"),
  loadAll(db, "groups"),
  loadAll(db, "attendance", (c) => c.where("date", ">=", from)),
  db.collection("system").doc("paymentSync").get().then((s) => s.data() || null),
  db.collection("system").doc("paymentSyncIgnores").get().then((s) => s.data()?.keys || []),
  loadAll(db, "cancellations", (c) => c.where("date", ">=", from)),
]);
console.log(`loaded ${players.length} players, ${groups.length} groups, ${attendance.length} attendance records`);

const report = analyze({ players, groups, attendance, cancellations, today });
report.registration = registrationIssues({ sync, ignores, players, groups });
report.summary.registration = report.registration.items.length;
// 📝 מה המדריכים כתבו אתמול (worker/src/coaches.js שומר לפי תאריך)
// shortcut: מה שנכתב אחרי חצות ולפני הדוח מגיע רק בדוח של מחר; לאחד ימים אם זה מפריע
const notes = (await db.collection("agentReports").doc(`coachNotes-${addDays(today, -1)}`).get()).data()?.notes || [];
console.log("coach notes", notes.length);
const doc = { ...report, createdAt: new Date().toISOString(), text: fullReportText(report) + coachNotesText(notes) };
await db.collection("agentReports").doc("latest").set(doc);
await db.collection("agentReports").doc(`scan-${today}`).set(doc);
console.log("summary", JSON.stringify(report.summary));

await tellOwner(db, {
  agent: "scan",
  text: doc.text,
  template: "agent_daily_report",
  templateParam: oneLineSummary(report) + (notes.length ? ` · ${notes.length} סיכומי מדריכים` : ""),
});
await heartbeat(db, "scan", { summary: report.summary });
