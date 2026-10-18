// חד-פעמי (18.10.2026, שולה אישרה): משלים ימי אימון ותאריך הצטרפות לפי הנוכחות בפועל.
// הרשימה (מזהים בלבד) נבנתה מהגיבוי של 18.10. שדה שמישהו כבר מילא מאז — לא נוגעים בו.
import admin from "firebase-admin";
import { readFileSync } from "node:fs";

const patch = JSON.parse(readFileSync(new URL("./fill_player_data.json", import.meta.url)));
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = admin.firestore();
const n = { trainingDays: 0, joinDate: 0, skipped: 0, missing: 0 };
for (const [id, want] of Object.entries(patch)) {
  const ref = db.collection("players").doc(id);
  await db.runTransaction(async (t) => {
    const doc = await t.get(ref);
    if (!doc.exists) return n.missing++;
    const cur = doc.data(), upd = {};
    if (want.trainingDays && !(Array.isArray(cur.trainingDays) && cur.trainingDays.length)) upd.trainingDays = want.trainingDays;
    if (want.joinDate && String(cur.joinDate || "").slice(0, 10) > want.joinDate) upd.joinDate = want.joinDate;
    for (const k of Object.keys(want)) k in upd ? n[k]++ : n.skipped++;
    if (Object.keys(upd).length) t.update(ref, upd);
  });
}
console.log(JSON.stringify(n));
