// התראות שבעל הלוח ביקש מדף הניהול בפורטל (pushRequests, נכתב רק על ידו — firestore.rules).
// כל בקשה בלי sentAt נשלחת פעם אחת ומסומנת (sentAt, sent, failed). לכל היותר 3 בהרצה,
// ובקשה ישנה מ-24 שעות מסומנת כפגת תוקף בלי שליחה. רץ ב-board-members.yml. ליומן — רק מספרים.
//
// גם: system/boardOwner.hash — מי בעל הלוח לפי החוקים. רק SHA-256 של האימייל (באותיות קטנות),
// אותו hash שכבר ב-app.js של הלוח. אין אימייל בקוד או במסד.
import { pathToFileURL } from "node:url";
import { firestore } from "../agents/lib/firebase.mjs";
import { pushInput, sendPush } from "./send_push.mjs";

export const BOARD_OWNER_HASH = "01729b4d5d3e455f8bacc0637897aa134b9fb122fc148113f0d0180dfab464f4";
export const MAX_PER_RUN = 3;
const DAY = 864e5;
const ms = (v) => (!v ? 0 : typeof v.toMillis === "function" ? v.toMillis() : new Date(v).getTime() || 0);

// מה לעשות עם כל בקשה: send / expire / skip (כבר טופלה). now — לבדיקות.
export function plan(requests, now = Date.now()) {
  const pending = requests.filter((r) => !r.sentAt && !r.expiredAt).sort((a, b) => ms(a.createdAt) - ms(b.createdAt));
  const expire = pending.filter((r) => now - ms(r.createdAt) > DAY);
  const send = pending.filter((r) => now - ms(r.createdAt) <= DAY).slice(0, MAX_PER_RUN);
  return { send, expire };
}

async function main() {
  const db = firestore();
  await db.doc("system/boardOwner").set({ hash: BOARD_OWNER_HASH }, { merge: true });
  const snap = await db.collection("pushRequests").orderBy("createdAt", "desc").limit(50).get();
  const { send, expire } = plan(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  for (const r of expire) await db.doc(`pushRequests/${r.id}`).update({ expiredAt: new Date() });
  for (const r of send) {
    // מסמנים לפני השליחה: הרצה שנקטעה באמצע לא שולחת פעמיים
    await db.doc(`pushRequests/${r.id}`).update({ sentAt: new Date() });
    const n = await sendPush(db, pushInput(r));
    await db.doc(`pushRequests/${r.id}`).update({ sent: n.sent, failed: n.failed });
  }
  console.log(`push queue: ${send.length} sent, ${expire.length} expired`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href)
  main().catch((err) => {
    console.error("push queue failed: " + (err.message || err));
    process.exit(1);
  });
