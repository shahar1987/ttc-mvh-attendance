// טבלת "הבאת חבר — קיבלת גביע" בלוח המועדון: מי הביא הכי הרבה חברים החודש.
//
// סופרים נרשמים (boardMembers) שנוצרו בחודש הנוכחי (שעון ישראל) עם ref — ה-uid של מי שהזמין —
// כשהמזמין עצמו עדיין רשום בלוח. עשרת הראשונים נכתבים למסמך הציבורי boardPublic/referrals:
//   { month: "YYYY-MM", top: [{ name: "דנה כ׳", count }], updatedAt }
// בשם רק שם פרטי ואות ראשונה של שם המשפחה — לעולם לא טלפון או אימייל.
// רץ כל שעה בתוך board-members.yml. ליומן — רק מספרים.
//   FIREBASE_SERVICE_ACCOUNT=... node scripts/referrals.mjs   (אחרי `cd agents && npm ci`)
import { pathToFileURL } from "node:url";
import { firestore, loadAll } from "../agents/lib/firebase.mjs";
import { israelNow } from "./gameday.mjs";

export const TOP = 10;
const ms = (v) => (!v ? 0 : typeof v.toMillis === "function" ? v.toMillis() : new Date(v).getTime() || 0);
export const israelMonth = (t) => israelNow(new Date(t)).date.slice(0, 7);

// "דנה כהן לוי" -> "דנה כ׳"
export function publicName(name) {
  const [first = "", last = ""] = String(name || "").trim().split(/\s+/);
  return last ? `${first} ${last[0]}׳` : first;
}

export function leaderboard(members, now = new Date()) {
  const month = israelMonth(now);
  const byId = new Map(members.map((m) => [m.id, m]));
  const counts = new Map();
  for (const m of members) {
    if (!m.ref || m.ref === m.id || !byId.has(m.ref)) continue;
    if (israelMonth(ms(m.createdAt)) !== month) continue;
    counts.set(m.ref, (counts.get(m.ref) || 0) + 1);
  }
  const top = [...counts]
    .map(([id, count]) => ({ name: publicName(byId.get(id).name), count }))
    .filter((x) => x.name)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "he"))
    .slice(0, TOP);
  return { month, top };
}

async function main() {
  const db = firestore();
  const { month, top } = leaderboard(await loadAll(db, "boardMembers"));
  await db.collection("boardPublic").doc("referrals").set({ month, top, updatedAt: new Date() });
  console.log(`referrals: ${top.length} inviters on the ${month} board`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href)
  main().catch((err) => {
    console.error("referrals failed: " + (err.message || err));
    process.exit(1);
  });
