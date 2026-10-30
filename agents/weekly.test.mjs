import { test } from "node:test";
import assert from "node:assert/strict";
import { weeklySummary } from "./lib/weekly.mjs";

// שישי 30.10.2026; השבוע = ראשון 25.10 עד היום
const today = "2026-10-30";
const groups = [
  { id: "a", name: "קבוצה א", days: [0, 4] }, // ראשון+חמישי
  { id: "b", name: "קבוצה ב", days: [1] }, // שני
];
const players = [
  { id: "p1", name: "שחקן 1", groupId: "a", isActive: true, parentPhone: "0521234567" },
  { id: "p2", name: "שחקן 2", groupId: "a", isActive: true, parentPhone: "", notPaying: true },
  { id: "q1", name: "שחקן 3", groupId: "b", isActive: true, parentPhone: "0521234568" },
  { id: "t", name: "ניסיון", groupId: "a", isActive: true, trial: true },
];
const A = (date, groupId, playerId, status) => ({ date, groupId, playerId, status, msgSentAt: "x" });
// חודש קודם: קבוצה א מלאה; השבוע ראשון רק חצי, וחמישי לא סומן. קבוצה ב: שני סומן.
const att = [];
for (const d of ["2026-10-04", "2026-10-08", "2026-10-11", "2026-10-15", "2026-10-18", "2026-10-22"])
  att.push(A(d, "a", "p1", "Present"), A(d, "a", "p2", "Present"));
att.push(A("2026-10-25", "a", "p1", "Present"), A("2026-10-25", "a", "p2", "Absent"));
att.push(A("2026-10-26", "b", "q1", "Present"), A("2026-10-19", "b", "q1", "Present"));

test("weekly summary: what to fix and how to improve", () => {
  const { text, counts } = weeklySummary({ players, groups, attendance: att, cancellations: [], today });
  assert.match(text, /קבוצה א: 50% \(↓50\)/);
  assert.match(text, /קבוצה ב: 100%/);
  assert.match(text, /לא סומנה בהם נוכחות: קבוצה א \(חמישי\)/);
  assert.match(text, /בלי טלפון תקין באפליקציה: שחקן 2/);
  assert.match(text, /1 מסומנים כלא משלמים/);
  assert.match(text, /📉 קבוצה א: 50% השבוע מול 100%/);
  assert.doesNotMatch(text, /ניסיון/);
  assert.equal(counts.unmarked, 1);
});

test("weekly summary: a cancelled training is not 'unmarked'", () => {
  const { counts } = weeklySummary({ players, groups, attendance: att, cancellations: [{ date: "2026-10-29", groupId: "a" }], today });
  assert.equal(counts.unmarked, 0);
});

test("weekly summary: nothing to fix", () => {
  const ok = players.filter((p) => p.id === "q1");
  const { text } = weeklySummary({ players: ok, groups: [groups[1]], attendance: att.filter((a) => a.groupId === "b"), cancellations: [], today });
  assert.match(text, /הכל מסודר השבוע/);
});
