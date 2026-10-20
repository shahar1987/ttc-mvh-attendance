// התראות דחיפה אוטומטיות ביום משחק של קבוצות המועדון, לכל המכשירים בלוח המועדון (pushTokens).
//
// הנתונים: data.json הציבורי של לוח המועדון (מתעדכן פעמיים בשבוע בריפו של הלוח).
//   1. בוקר (מ-08:00 שעון ישראל ועד המשחק הראשון): "היום משחקים! 🏓" — פוש אחד ליום, כל המשחקים יחד.
//   2. כל שעה: משחק שלנו שקיבל תוצאה ועוד לא הודענו עליו — "תוצאה: …".
// המצב ב-system/gamedayPush (Admin SDK בלבד) — { announcedDays, announcedResults } — כדי שלא יישלח פעמיים.
// בהרצה הראשונה כל התוצאות שכבר קיימות מסומנות כמודיעות, בלי שליחה (לא מציפים).
// ליומן — רק מספרים.
//   FIREBASE_SERVICE_ACCOUNT=... node scripts/gameday.mjs   (אחרי `cd agents && npm ci`)
import { pathToFileURL } from "node:url";
import { firestore } from "../agents/lib/firebase.mjs";
import { pushInput, sendPush } from "./send_push.mjs";

export const DATA_URL = "https://shahar1987.github.io/ttc-club-board/data.json";
const STATE = ["system", "gamedayPush"];
const MORNING_FROM = "08:00";
// תוצאה ישנה מזה (data.json מתעדכן באיחור) — מסומנת בלי פוש
const RESULT_MAX_AGE_DAYS = 7;

// אותו קיצור שמות כמו בלוח (ttc-club-board/app.js, short)
export const shortName = (teams, c) =>
  (teams[c] || c)
    .replace("הפועל מבואות חרמון", "מבואות חרמון")
    .replace("כרמל מרכזי טניס שולחן חיפה", "כרמל חיפה")
    .replace("עירוני מעלות תרשיחא", "מעלות תרשיחא")
    .replace("עמותת קריית מוצקין", "קריית מוצקין")
    .replace("הפועל עירוני ", "")
    .replace("אליצור ", "");

export function israelNow(now = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(now)
      .map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, hhmm: `${p.hour}:${p.minute}` };
}

// "20/10/26" -> "2026-10-20"
export const isoDate = (d) => {
  const [dd, mm, yy] = String(d).split("/");
  return `20${yy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
};
export const matchKey = (lg, m) => `${lg.id}_${m.r}_${m.h}_${m.a}_${isoDate(m.d)}`;

function ourMatches(data) {
  const ours = new Set(data.ours || []);
  return (data.leagues || []).flatMap((lg) =>
    (lg.matches || []).filter((m) => ours.has(m.h) || ours.has(m.a)).map((m) => ({ lg, m: { ...m, t: String(m.t || "20:00").padStart(5, "0") }, us: ours.has(m.h) ? m.h : m.a })),
  );
}

const daysBetween = (a, b) => (Date.parse(b) - Date.parse(a)) / 86400000;

// מחזיר את הפושים לשליחה ואת המצב החדש. state = null בהרצה הראשונה.
export function plan(data, state, now = new Date()) {
  const { date: today, hhmm } = israelNow(now); // כבר HH:MM, כמו m.t אחרי padStart
  const first = !state;
  const days = new Set(state?.announcedDays || []);
  const results = new Set(state?.announcedResults || []);
  const pushes = [];
  const all = ourMatches(data);
  const t = (c) => shortName(data.teams || {}, c);

  const todays = all.filter(({ m }) => !m.res && isoDate(m.d) === today).sort((x, y) => x.m.t.localeCompare(y.m.t));
  if (todays.length && !days.has(today) && hhmm >= MORNING_FROM && hhmm < todays[0].m.t) {
    const lines = todays.map(({ m, us }) => `${t(us)} נגד ${t(us === m.h ? m.a : m.h)} · ${m.t} · ${us === m.h ? "בית" : "חוץ"}`);
    pushes.push({ title: "היום משחקים! 🏓", body: `${lines.join(" | ")}. בואו לעודד!` });
    days.add(today);
  }

  for (const { lg, m, us } of all) {
    const key = matchKey(lg, m);
    if (!m.res || results.has(key)) continue;
    results.add(key);
    if (first || daysBetween(isoDate(m.d), today) > RESULT_MAX_AGE_DAYS) continue;
    const opp = us === m.h ? m.a : m.h;
    // res בפורמט בית:חוץ — מציגים מהצד שלנו
    const res = us === m.h ? m.res : m.res.split(":").reverse().join(":");
    const derby = (data.ours || []).includes(opp);
    pushes.push({
      title: `תוצאה: ${t(us)} ${res} ${t(opp)}`,
      body: derby ? "דרבי של המועדון 🏓" : m.w === us ? "ניצחון! 🎉" : "הפסד, ממשיכים 💪",
    });
  }

  // שומרים מראש: לכל היותר 3 פושים בהרצה; מה שנחתך כבר מסומן ולא יישלח
  pushes.splice(3);
  return {
    pushes,
    state: { announcedDays: [...days].sort().slice(-60), announcedResults: [...results].slice(-1000) },
  };
}

async function main() {
  const r = await fetch(DATA_URL, { cache: "no-store" });
  if (!r.ok) throw new Error(`data.json HTTP ${r.status}`);
  const data = await r.json();
  const db = firestore();
  const ref = db.collection(STATE[0]).doc(STATE[1]);
  const snap = await ref.get();
  const { pushes, state } = plan(data, snap.exists ? snap.data() : null);
  // המצב נשמר לפני השליחה — לכל היותר פעם אחת: שליחה שנכשלה לא חוזרת, אבל גם לא נשלח פעמיים
  await ref.set({ ...state, updatedAt: new Date() });
  for (const p of pushes) await sendPush(db, pushInput(p));
  console.log(`gameday: ${pushes.length} pushes${snap.exists ? "" : " (first run — existing results marked)"}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href)
  main().catch((err) => {
    console.error("gameday failed: " + (err.message || err));
    process.exit(1);
  });
