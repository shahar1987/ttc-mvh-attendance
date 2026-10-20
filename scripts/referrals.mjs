// טבלת "הבאת חבר — קיבלת גביע" בלוח המועדון: מי הביא הכי הרבה חברים החודש.
//
// סופרים נרשמים (boardMembers) שנוצרו בחודש הנוכחי (שעון ישראל) עם ref — ה-uid של מי שהזמין —
// כשהמזמין עצמו עדיין רשום בלוח והחבר הותאם לשחקן (פעם אחת לכל שחקן). עשרת הראשונים נכתבים למסמך הציבורי boardPublic/referrals:
//   { month: "YYYY-MM", top: [{ name: "דנה כ׳", count }], updatedAt }
// בשם רק שם פרטי ואות ראשונה של שם המשפחה — לעולם לא טלפון או אימייל.
// רץ כל שעה בתוך board-members.yml. ליומן — רק מספרים.
//   FIREBASE_SERVICE_ACCOUNT=... node scripts/referrals.mjs   (אחרי `cd agents && npm ci`)
import { pathToFileURL } from "node:url";
import { firestore, loadAll } from "../agents/lib/firebase.mjs";
import { israelNow } from "./gameday.mjs";
import { normalisePhone } from "./match_board_members.mjs";

export const TOP = 10;
const ms = (v) => (!v ? 0 : typeof v.toMillis === "function" ? v.toMillis() : new Date(v).getTime() || 0);
export const israelMonth = (t) => israelNow(new Date(t)).date.slice(0, 7);

// "דנה כהן לוי" -> "דנה כ׳". רק אותיות, גרש ומקף — טלפון או קישור בשם לא עוברים לציבור
const c = (s) => s.replace(/[^\p{L}'׳-]/gu, "").slice(0, 20);
export function publicName(name) {
  const [first = "", last = ""] = String(name || "").trim().split(/\s+/);
  const f = c(first);
  if (!f) return "";
  return last ? `${f} ${c(last)[0] || ""}׳` : f;
}

// נספר רק חבר שהותאם לשחקן אמיתי (boardMemberMatches.status === "matched"), כל שחקן פעם אחת בין כל המזמינים,
// ולא כשלחבר אותו טלפון כמו למזמין — כך חשבונות גוגל מזויפים לא מנפחים את הטבלה
export function leaderboard(members, matches, now = new Date()) {
  const month = israelMonth(now);
  const byId = new Map(members.map((m) => [m.id, m]));
  const matchById = new Map(matches.map((x) => [x.id, x]));
  const counts = new Map();
  const seen = new Set();
  const friends = members
    .filter((m) => m.ref && m.ref !== m.id && byId.has(m.ref) && israelMonth(ms(m.createdAt)) === month)
    .sort((a, b) => ms(a.createdAt) - ms(b.createdAt));
  for (const m of friends) {
    const match = matchById.get(m.id);
    if (match?.status !== "matched") continue;
    const phone = normalisePhone(m.phone);
    if (phone && phone === normalisePhone(byId.get(m.ref).phone)) continue;
    const player = match.playerIds?.[0] || (phone && `phone:${phone}`);
    if (!player || seen.has(player)) continue;
    seen.add(player);
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
  const [members, matches] = await Promise.all([loadAll(db, "boardMembers"), loadAll(db, "boardMemberMatches")]);
  const { month, top } = leaderboard(members, matches);
  await db.collection("boardPublic").doc("referrals").set({ month, top, updatedAt: new Date() });
  console.log(`referrals: ${top.length} inviters on the ${month} board`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href)
  main().catch((err) => {
    console.error("referrals failed: " + (err.message || err));
    process.exit(1);
  });
