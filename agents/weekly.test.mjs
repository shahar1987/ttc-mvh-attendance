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
  { id: "q1", name: "שחקן 3", groupId: "b", isActive: true, parentPhone: "0527654321" },
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

import { coachMessages } from "./lib/weekly.mjs";
test("coach messages: only the coach's own group, readable and one-line", () => {
  const g2 = [{ ...groups[0], coachId: "c1" }, { ...groups[1], coachId: "c2" }];
  const users = [
    { id: "c1", name: "מדריך א", phone: "0521111111" },
    { id: "c2", name: "מדריך ב", phone: "0521112222" },
    { id: "c3", name: "בלי קבוצה", phone: "0500000003" },
    { id: "adm", name: "מנהל", role: "admin", phone: "0500000004" },
  ];
  g2[1].coachIds = ["adm"];
  const msgs = coachMessages({ players, groups: g2, users, attendance: att, cancellations: [], today, quiet: ["c2"] });
  assert.deepEqual(msgs.map((m) => m.uid), ["c1"]); // c2 quiet, c3 no group, admin skipped
  const m = msgs[0];
  assert.equal(m.phone, "972521111111");
  assert.match(m.text, /\*קבוצה א — נוכחות השבוע 50%\*/);
  assert.match(m.text, /לא מולאה נוכחות: יום חמישי/);
  assert.match(m.text, /חסר טלפון: שחקן 2/);
  assert.match(m.text, /לא סומנו ימי אימון: שחקן 1, שחקן 2/);
  assert.doesNotMatch(m.text, /שחקן 3|ניסיון/);
  assert.doesNotMatch(m.param, /\n/);
  const ok = coachMessages({ players: [], groups: g2, users, attendance: [], cancellations: [{ date: "2026-10-25", groupId: "a" }, { date: "2026-10-29", groupId: "a" }], today });
  assert.match(ok.find((x) => x.uid === "c1").text, /הכל מסודר/);
});

import { weeklyHealth } from "./lib/weekly.mjs";
test("weekly health: finds what would stop a coach getting the message", () => {
  const now = new Date("2026-10-30T12:00:00Z");
  const g = [
    { id: "a", name: "א", coachId: "c1" },
    { id: "b", name: "ב" },
    { id: "c", name: "ג", coachIds: ["c2", "c3"] },
    { id: "d", name: "ד", coachId: "adm" },
  ];
  const users = [
    { id: "c1", name: "מדריך 1", phone: "0521234567" },
    { id: "c2", name: "מדריך 2", phone: "" },
    { id: "c3", name: "מדריך 3", phone: "0527654321" },
    { id: "adm", name: "מנהל", role: "admin" },
  ];
  const bot = {
    lastCronError: { at: "2026-10-30T11:30:00Z", message: "boom" },
    outboxQueue: [{ at: "2026-10-30T09:00:00Z" }, { at: "2026-10-30T11:55:00Z" }],
    failLog: [{ who: "מדריך 1", at: "2026-10-28T10:00:00Z" }, { who: "x", at: "2026-10-01T10:00:00Z" }],
  };
  const h = weeklyHealth({ groups: g, users, quiet: ["c3"], bot, now });
  assert.deepEqual(h.problems, [
    "לקבוצה ב לא משויך מדריך באפליקציה",
    "למדריך מדריך 2 (ג) אין טלפון תקין באפליקציה",
    "השרת של שולה נכשל בשעה האחרונה: boom",
    "1 הודעות תקועות בתור יותר משעה — השרת של שולה לא מוציא אותן",
    "1 הודעות לא נמסרו בשבוע האחרון (מדריך 1)",
  ]);
  assert.deepEqual(h.notes, ["מדריך 3 מושתק — לא יקבל הודעות", "ד: רק אתה מדריך — הנתונים שלה בסיכום שלך"]);
  assert.deepEqual(weeklyHealth({ groups: [g[0]], users, bot: {}, now }), { problems: [], notes: [] });
  assert.deepEqual(weeklyHealth({ groups: [g[0]], users, quiet: ["c1"], bot: {}, now }).problems, ["לקבוצה א אין מדריך פעיל שמקבל הודעות — לשייך מדריך באפליקציה"]);
});

import { weeklyChanges } from "./lib/weekly.mjs";
test("weekly changes: fixed, new and changed per coach", () => {
  const prev = { c1: { name: "דני", facts: ["א: חסר טלפון: x, y", "א: לא מולאה נוכחות: יום שני"] }, c2: { name: "רון", facts: [] } };
  const now = { c1: { name: "דני", facts: ["א: חסר טלפון: x"] }, c2: { name: "רון", facts: ["ב: הרבה חיסורים: z (3 היעדרויות ברצף)"] } };
  assert.deepEqual(weeklyChanges(prev, now), [
    "✅ דני סידר: א: לא מולאה נוכחות",
    "🔄 השתנה אצל דני: א: חסר טלפון: x",
    "🆕 חדש אצל רון: ב: הרבה חיסורים: z (3 היעדרויות ברצף)",
  ]);
  assert.deepEqual(weeklyChanges(now, now), []);
});
