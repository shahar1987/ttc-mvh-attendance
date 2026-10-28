// 🤖 שליחה אוטומטית מהמספר של שלום (28.10, שלום: "מישהו לא יגיע לאימון, שולחים לו הודעה להורים... שלא תהיה תלויה בי").
// שלום בחר: הודעה אחרי כל היעדרות (ושתי היעדרויות ברצף — הנוסח של "שני האימונים האחרונים"), וברוך הבא למצטרף חדש.
// השליחה עצמה ב-shahar1987/wa-sender (מכשיר מקושר למספר שלו); המשימה המתוזמנת של קלוד מחברת בין השניים:
//   plan <backupDir> [today] [sentLog]  — מהגיבוי הטרי: מה לשלוח (JSON ל-stdout). רץ בסנדבוקס, לא ב-Actions.
//   mark                                — ב-Actions (autosend-mark.yml): MARKS=מפתחות שנשלחו → מסמן באפליקציה,
//                                         בדיוק כמו כשמאמן שולח (msgSentAt / alertHandledDate), כדי שלא יציקו למאמנים.
// הריפו ציבורי: mark מדפיס רק מספרים, והמפתחות הם מזהים בלבד.
import { readFileSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { analyze, israelToday, hebrewDay, isAdultGroup, isValidPhone, normalizePhone } from "./lib/analysis.mjs";
import { absenceTemplate, renderTemplate, CLUB } from "./templates.mjs";
import { playerGender } from "./lib/gender.mjs";

export const CUTOFF = "2026-10-28"; // לא שולחים על מה שקרה לפני שהאוטומציה הופעלה
const KEY = /^(absence|repeat|welcome):\d{4}-\d{2}-\d{2}:[A-Za-z0-9]{1,40}:[A-Za-z0-9_]{1,40}$/;

const DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
function daysText(days) {
  const d = [...new Set(days || [])].filter((x) => x >= 0 && x <= 6).sort().map((x) => DAYS[x]);
  return d.length ? `בימי ${d.length > 1 ? d.slice(0, -1).join(", ") + " ו" + d.at(-1) : d[0]}` : "";
}

export function welcomeText(p, g) {
  const name = (p.name || "").trim(), first = name.split(/\s+/)[0];
  const parent = String(p.parentName || "").trim().split(/\s+/)[0];
  const f = playerGender(p) === "f";
  const when = [daysText(g.days), g.startTime && `ב-${g.startTime}`].filter(Boolean).join(" ");
  const sched = when ? `האימונים ${when}. ` : "";
  return isAdultGroup(g)
    ? `היי ${first}, ${f ? "שמחים שהצטרפת" : "שמחים שהצטרפת"} לקבוצת ${g.name} 🏓\n${sched}כל שאלה, אפשר לכתוב לי כאן.\nנתראה באימון!\nשלום, ${CLUB}`
    : `היי${parent ? " " + parent : ""}, שמחים ש${name} ${f ? "הצטרפה" : "הצטרף"} לקבוצת ${g.name} 🏓\n${sched}כל שאלה, אפשר לכתוב לי כאן.\nנתראה באימון!\nשלום, ${CLUB}`;
}

const rows = (o) => Object.entries(o || {}).map(([id, v]) => ({ id, ...v }));

// data: {players, groups, attendance, cancellations} כמערכים. sent: מפתחות שכבר יצאו (יומן wa-sender).
export function plan(data, today, sent = new Set()) {
  const { players, groups } = data;
  const groupById = new Map(groups.map((g) => [g.id, g]));
  const messages = [], noPhone = [];
  const add = (key, phone, text, who) => {
    if (sent.has(key)) return;
    if (!phone) return noPhone.push(who);
    messages.push({ key, to: phone, text });
  };
  for (const it of analyze({ ...data, today }).pending) {
    if (it.date < CUTOFF) continue;
    const t = absenceTemplate(it);
    add(`${it.kind}:${it.date}:${it.groupId}:${it.playerId}`, it.phone, renderTemplate(t.name, t.params), it.playerName);
  }
  for (const p of players) {
    const g = groupById.get(p.groupId);
    if (!g || g.deleted || !p.isActive || p.deleted || p.welcomeSentAt) continue;
    if (!p.joinDate || p.joinDate < CUTOFF || p.joinDate > today) continue;
    add(`welcome:${p.joinDate}:${g.id}:${p.id}`, isValidPhone(p.parentPhone) ? normalizePhone(p.parentPhone) : "", welcomeText(p, g), (p.name || "").trim());
  }
  return { today, messages, noPhone };
}

export function parseMarks(raw) {
  const keys = String(raw || "").split(",").map((s) => s.trim()).filter(Boolean);
  const bad = keys.filter((k) => !KEY.test(k));
  if (bad.length) throw new Error(`${bad.length} מפתחות לא תקינים`);
  return keys.map((k) => { const [kind, date, groupId, playerId] = k.split(":"); return { kind, date, groupId, playerId }; });
}

// כמו markHandled ב-worker/src/tools.js: "נשלח" רק על רשומה קיימת שעדיין Absent, ו-alertHandledDate רק קדימה
async function mark(db, m, now) {
  const pref = db.collection("players").doc(m.playerId);
  if (m.kind === "welcome") return pref.set({ welcomeSentAt: now }, { merge: true }).then(() => "ok");
  if (m.kind === "absence") {
    const aref = db.collection("attendance").doc(`${m.date}_${m.groupId}_${m.playerId}`);
    const ok = await db.runTransaction(async (tx) => {
      const a = await tx.get(aref);
      if (!a.exists || a.data().status !== "Absent") return false;
      tx.update(aref, { msgSentAt: now, msgSentBy: "auto-send" });
      return true;
    });
    if (!ok) return "skipped";
  }
  await db.runTransaction(async (tx) => {
    const p = await tx.get(pref);
    const cur = p.exists && p.data().alertHandledDate;
    if (p.exists && !(cur && cur >= m.date)) tx.update(pref, { alertHandledDate: m.date });
  });
  return "ok";
}

async function main() {
  const [cmd, dir, todayArg, sentLog] = process.argv.slice(2);
  if (cmd === "plan") {
    const load = (n) => rows(JSON.parse(readFileSync(`${dir}/${n}.json`, "utf8")));
    const sent = new Set(sentLog && existsSync(sentLog) ? JSON.parse(readFileSync(sentLog, "utf8")).map((x) => x.key) : []);
    const data = { players: load("players"), groups: load("groups"), attendance: load("attendance"), cancellations: load("cancellations") };
    console.log(JSON.stringify(plan(data, todayArg || israelToday(), sent), null, 1));
  } else if (cmd === "mark") {
    const marks = parseMarks(process.env.MARKS);
    const { firestore } = await import("./lib/firebase.mjs");
    const db = firestore(), now = new Date().toISOString();
    const res = { ok: 0, skipped: 0 };
    for (const m of marks) res[await mark(db, m, now)]++;
    console.log(`::notice title=סומן::${res.ok} סומנו, ${res.skipped} דולגו (סומנו בינתיים כנוכח או לא קיימים)`);
  } else throw new Error("usage: autosend.mjs plan <dir> [today] [sentLog] | mark");
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
