// שקילות מול האפליקציה: הפונקציות absenceAlerts / pendingAbsenceMsgs / lastTwoAbsences נשלפות
// כמו שהן מ-part-a.js (מקור האמת לפי CLAUDE.md) ורצות על אותם נתונים כמו analyze של הסוכן.
// אם מישהו ישנה את האפליקציה בלי לשנות את agents/lib/analysis.mjs (או להפך) — הבדיקה הזו תיכשל.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { analyze, addDays } from "./lib/analysis.mjs";

const APP = new URL("../part-a.js", import.meta.url);

// שולף את גוף הפונקציה לפי ספירת סוגריים מסולסלים
function extract(src, name) {
  const start = src.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} not found in part-a.js`);
  let i = src.indexOf("{", start), depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) break;
  }
  return src.slice(start, i + 1);
}

function appFunctions(today) {
  const src = readFileSync(APP, "utf8");
  const code = ["lastTwoAbsences", "absenceAlerts", "pendingAbsenceMsgs"].map((n) => extract(src, n)).join("\n");
  // E() באפליקציה מחזיר את התאריך של היום; groupCoachLabel לא משנה את הרשימה
  return new Function("E", "groupCoachLabel", `${code}\nreturn { absenceAlerts, pendingAbsenceMsgs };`)(() => today, () => null);
}

const today = "2026-09-30";
const d = (n) => addDays(today, -n);
const groups = [{ id: "g1", name: "ילדים א" }, { id: "g2", name: "מבוגרים" }, { id: "g3", name: "נבחרת" }];
const P = (id, extra = {}) => ({ id, name: `שחקן ${id}`, groupId: "g1", isActive: true, parentPhone: "050-1234567", ...extra });
const A = (playerId, date, status, extra = {}) => ({ playerId, date, status, groupId: "g1", ...extra });

const players = [
  P("single"),
  P("repeat3"), // שלוש היעדרויות: התראה על שתיים, השלישית בודדת
  P("handled", { alertHandledDate: d(3) }),
  P("handledOld", { alertHandledDate: d(9) }),
  P("moved", { groupId: "g2" }), // עבר קבוצה — ההיעדרות נשארת בקבוצה הישנה
  P("sameDay"), // נוכח ונעדר באותו יום בשתי קבוצות
  P("inactive", { isActive: false }),
  P("deleted", { deleted: true }),
  P("sent"),
  P("todayAbs"),
  P("todayPlusOld"), // היום + אתמול: היום לא נספר בהתראה
  P("old"), // מחוץ לחלון השבוע
  P("presentLast"),
];
const attendance = [
  A("single", d(1), "Absent"), A("single", d(4), "Present"),
  A("repeat3", d(1), "Absent"), A("repeat3", d(3), "Absent"), A("repeat3", d(5), "Absent"),
  A("handled", d(1), "Absent"), A("handled", d(3), "Absent"),
  A("handledOld", d(2), "Absent"), A("handledOld", d(4), "Absent"), A("handledOld", d(6), "Present"),
  A("moved", d(2), "Absent", { groupId: "g1" }), A("moved", d(1), "Present", { groupId: "g2" }),
  A("sameDay", d(2), "Absent"), A("sameDay", d(2), "Present", { groupId: "g3" }), A("sameDay", d(4), "Absent"),
  A("inactive", d(1), "Absent"), A("deleted", d(1), "Absent"),
  A("sent", d(1), "Absent", { msgSentAt: "x" }),
  A("todayAbs", today, "Absent"), A("todayAbs", d(2), "Present"),
  A("todayPlusOld", today, "Absent"), A("todayPlusOld", d(1), "Absent"), A("todayPlusOld", d(3), "Present"),
  A("old", d(8), "Absent"), A("old", d(10), "Present"),
  A("presentLast", d(1), "Present"), A("presentLast", d(3), "Absent"), A("presentLast", d(5), "Absent"),
];

test("agent pending list == app (absenceAlerts + pendingAbsenceMsgs)", { skip: !existsSync(APP) && "part-a.js not found" }, () => {
  const app = appFunctions(today);
  const appRepeat = app.absenceAlerts(players, groups, attendance, null).map((x) => `repeat:${x.dates[0]}:${x.player.id}:${x.dates.join(",")}`);
  const appSingle = app.pendingAbsenceMsgs(players, groups, [], attendance).map((x) => `absence:${x.record.date}:${x.player.id}:${x.record.groupId}`);
  const agent = analyze({ players, groups, attendance, today }).pending.map((x) =>
    x.kind === "repeat" ? `repeat:${x.date}:${x.playerId}:${x.dates.join(",")}` : `absence:${x.date}:${x.playerId}:${x.groupId}`,
  );
  assert.deepEqual([...agent].sort(), [...appRepeat, ...appSingle].sort());
  // וידוא שהנתונים באמת מכסים את שלושת ההבדלים שתוקנו
  assert.ok(agent.includes(`absence:${d(5)}:repeat3:g1`), "single next to a repeat alert");
  assert.ok(agent.includes(`absence:${today}:todayAbs:g1`), "today's absence");
  assert.ok(agent.includes(`absence:${d(2)}:moved:g1`), "record's group, not player's");
});
