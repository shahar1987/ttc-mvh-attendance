// חיבור ל-Firestore עם אותו service account שכבר משמש את Account tools ואת הגיבוי.
// ה-service account עוקף את חוקי Firestore, ולכן האוסף agentReports לא צריך כלל חדש:
// הכלל האחרון ב-firestore.rules חוסם אותו לגמרי מהאפליקציה, וזה בדיוק מה שרוצים
// (יש בו שמות וטלפונים).
import admin from "firebase-admin";

let db;
export function firestore() {
  if (db) return db;
  let sa;
  try {
    sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT is not valid JSON");
  }
  if (!sa.project_id) throw new Error("missing repository secret FIREBASE_SERVICE_ACCOUNT");
  admin.initializeApp({ credential: admin.credential.cert(sa) });
  db = admin.firestore();
  return db;
}

export async function loadAll(db, name, query) {
  const snap = await (query ? query(db.collection(name)) : db.collection(name)).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// סימן חיים לכל סוכן — המפקח בודק אותם כל שעה
// ריצה מוצלחת מוחקת את דגל "מפתח חסר": בלי זה שולה והמפקח ממשיכים לדווח על מפתח שכבר נוסף (2026-10-25: ANTHROPIC מ-11.10, META_TOKEN מ-10.10)
export async function heartbeat(db, agent, extra = {}) {
  const gone = admin.firestore.FieldValue.delete();
  await db
    .collection("agentReports")
    .doc("health")
    .set({ [agent]: { at: new Date().toISOString(), missingKey: gone, missingKeyAt: gone, ...extra } }, { merge: true });
}

// סוכן שלא רץ כי חסר לו מפתח: נרשם בנפרד מ-at (שנשאר זמן הריצה המוצלחת האחרונה), כדי שהמפקח
// וההתראה של ה-workflow ידעו שהסוכן כבר הודיע לבעלים בעצמו ולא ישלחו הודעה נוספת.
export async function reportMissingKey(db, agent, missingKey) {
  await db
    .collection("agentReports")
    .doc("health")
    .set({ [agent]: { missingKey, missingKeyAt: new Date().toISOString() } }, { merge: true });
}
