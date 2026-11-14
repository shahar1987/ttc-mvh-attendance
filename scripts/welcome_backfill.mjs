// השלמה חד-פעמית (14.11): מי שעבר מאימון ניסיון לקבוצה דרך טופס הבקרה לפני שנוסף registeredAt,
// והתחיל לפני CUTOFF, לא קיבל ברוכים הבאים. מסמנים לו registeredAt=היום, וה-autosend של הערב שולח.
// מדפיס מספרים בלבד (הריפו ציבורי).
import { firestore } from "../agents/lib/firebase.mjs";
import { CUTOFF } from "../agents/autosend.mjs";

const MAX = 15;
const db = firestore();
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
const log = (await db.collection("system").doc("sheetChanges").get()).data()?.items || [];
const ids = [...new Set(log.filter((x) => x?.kind === "trial").map((x) => x.id))];
const fix = [];
for (const id of ids) {
  const p = (await db.collection("players").doc(id).get()).data();
  if (!p || p.trial || p.deleted || !p.isActive || p.welcomeSentAt || p.registeredAt) continue;
  if (p.joinDate && p.joinDate >= CUTOFF) continue; // אלה כבר זכאים לברוכים הבאים בלי השלמה
  fix.push(id);
}
if (fix.length > MAX) throw new Error(`refusing ${fix.length} players in one run`);
const b = db.batch();
fix.forEach((id) => b.update(db.collection("players").doc(id), { registeredAt: today }));
if (fix.length) await b.commit();
console.log(`welcome backfill: ${ids.length} moved out of trial in the log, ${fix.length} marked for tonight's welcome`);
