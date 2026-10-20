// מתאים את מי שנרשם בלוח המועדון (boardMembers, כניסה עם גוגל באתר הציבורי) לכרטיס שחקן לפי טלפון.
//
// לכל נרשם שאין לו תוצאה ב-boardMemberMatches, או שעדכן את הפרטים אחרי הבדיקה האחרונה:
//   1. מנרמלים את הטלפון באותה פונקציה של סנכרון התשלומים (normalisePhone, מועתקת —
//      agents/board-members.test.mjs משווה אותה למקור ב-sync_payments.mjs).
//   2. משווים לטלפונים של כל השחקנים (parentPhone, phone, mobile — כמו buildPhoneIndex שם).
//   3. כותבים boardMemberMatches/{uid} = { status: "matched"|"not-found", playerIds, checkedAt, notified }.
//   4. נרשמים חדשים שלא נמצאו — הודעה אחת לכל הרצה לבעלים בוואטסאפ דרך התור של הבוט (agentReports/bot.outboxQueue,
//      אותו מנגנון של agents/alert.mjs). ההודעה כוללת שם וטלפון — היא פרטית לבעלים.
// תוצאה של נרשם שנמחק (מחק את עצמו או נמחק במסך הניהול) נמחקת גם היא.
//
// הריפו ציבורי: ליומן ההרצה מודפסים רק מספרים.
// מריצים מתיקיית הריפו אחרי `cd agents && npm ci` (firebase-admin מותקן שם):
//   FIREBASE_SERVICE_ACCOUNT=... node scripts/match_board_members.mjs
import { pathToFileURL } from "node:url";
import { firestore, loadAll } from "../agents/lib/firebase.mjs";
import { enqueueOwner } from "../agents/lib/owner.mjs";

// העתק מדויק של normalisePhone ב-scripts/sync_payments.mjs (שם אי אפשר לייבא: הקובץ מריץ סנכרון בטעינה)
export function normalisePhone(s) {
  let d = (s || "").toString().replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("972")) d = d.slice(3);
  if (d.startsWith("0")) d = d.slice(1);
  if (d.length < 8 || d.length > 10) return "";
  return d;
}

export function phoneIndex(players) {
  const idx = new Map();
  for (const p of players) {
    if (p.deleted) continue;
    for (const raw of [p.parentPhone, p.phone, p.mobile]) {
      const key = normalisePhone(raw);
      if (!key) continue;
      if (!idx.has(key)) idx.set(key, []);
      if (!idx.get(key).includes(p.id)) idx.get(key).push(p.id);
    }
  }
  return idx;
}

// Timestamp של Firestore, Date או מחרוזת ISO
const ms = (v) => (!v ? 0 : typeof v.toMillis === "function" ? v.toMillis() : new Date(v).getTime() || 0);

export function needsCheck(member, match) {
  return !match || ms(match.checkedAt) < ms(member.updatedAt);
}

export function matchMember(member, index) {
  const key = normalisePhone(member.phone);
  const playerIds = (key && index.get(key)) || [];
  return { status: playerIds.length ? "matched" : "not-found", playerIds: [...playerIds] };
}

// מודיעים פעם אחת לכל נרשם שלא נמצא; שוב רק אם בינתיים הוא נמצא ואז שוב לא
export function alreadyNotified(prev, result) {
  return result.status === "not-found" && prev?.status === "not-found" && prev.notified === true;
}

// הודעה אחת לכל ההרצה (לא אחת לכל נרשם — הגנה מהצפה): עד 10 שמות ואז "…ועוד N"
export const OWNER_LIST_MAX = 10;
export function ownerText(members) {
  const list = members.slice(0, OWNER_LIST_MAX).map((m) => `${m.name || "בלי שם"} · ${m.phone || "בלי טלפון"}`);
  if (members.length > OWNER_LIST_MAX) list.push(`…ועוד ${members.length - OWNER_LIST_MAX}`);
  return (
    `🆕 ${members.length} נרשמו באפליקציית המועדון ולא נמצאו ברשימת השחקנים: ${list.join(", ")}` +
    `\nאפשר לראות ולמחוק באפליקציית הנוכחות ⟵ הרשאות ⟵ נרשמו באפליקציית המועדון.`
  );
}

async function main() {
  const db = firestore();
  const [members, matches, players] = await Promise.all([
    loadAll(db, "boardMembers"),
    loadAll(db, "boardMemberMatches"),
    loadAll(db, "players"),
  ]);
  const prevById = new Map(matches.map((m) => [m.id, m]));
  const index = phoneIndex(players);
  const n = { checked: 0, matched: 0, notFound: 0, notified: 0, removed: 0 };
  const toNotify = [];
  const writes = [];

  for (const m of members) {
    const prev = prevById.get(m.id);
    if (!needsCheck(m, prev)) continue;
    const result = matchMember(m, index);
    let notified = alreadyNotified(prev, result);
    if (result.status === "not-found" && !notified) {
      toNotify.push(m);
      notified = true;
      n.notified++;
    }
    writes.push([m.id, { ...result, checkedAt: new Date(), notified }]);
    n.checked++;
    result.status === "matched" ? n.matched++ : n.notFound++;
  }

  // קודם ההודעה ואז הסימון notified — אם התור נכשל, ההרצה הבאה תודיע שוב
  if (toNotify.length) await enqueueOwner(db, { agent: "board-members", text: ownerText(toNotify) });
  for (const [id, data] of writes) await db.collection("boardMemberMatches").doc(id).set(data);

  const live = new Set(members.map((m) => m.id));
  for (const x of matches)
    if (!live.has(x.id)) {
      await db.collection("boardMemberMatches").doc(x.id).delete();
      n.removed++;
    }

  // רק מספרים ליומן הציבורי
  console.log(
    `board members: ${members.length} total, ${n.checked} checked (${n.matched} matched, ${n.notFound} not found), ` +
      `${n.notified} not-found in one owner message, ${n.removed} stale results removed`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href)
  main().catch((err) => {
    console.error("board members match failed: " + (err.message || err));
    process.exit(1);
  });
