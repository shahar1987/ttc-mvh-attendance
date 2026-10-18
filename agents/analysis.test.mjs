// הרצה: node --test agents/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { analyze, dropoutRisk, addDays, fullReportText, registrationIssues, topActions, coachNotesText } from "./lib/analysis.mjs";
import { absenceTemplate, renderTemplate, TEMPLATES } from "./templates.mjs";

const today = "2026-09-30";
const groups = [
  { id: "g1", name: "ילדים א" },
  { id: "g2", name: "מבוגרים" },
];
const P = (id, extra = {}) => ({ id, name: `שחקן ${id}`, groupId: "g1", isActive: true, parentPhone: "050-1234567", ...extra });
const A = (playerId, date, status, extra = {}) => ({ playerId, date, status, groupId: "g1", ...extra });

test("single absence yesterday is pending, not after message was sent", () => {
  const r = analyze({
    players: [P("a"), P("b")],
    groups,
    attendance: [A("a", "2026-09-29", "Absent"), A("b", "2026-09-29", "Absent", { msgSentAt: "x" })],
    today,
  });
  assert.equal(r.pending.length, 1);
  assert.equal(r.pending[0].playerId, "a");
  assert.equal(r.pending[0].kind, "absence");
  assert.equal(r.pending[0].whenText, "אתמול");
  assert.equal(r.pending[0].phone, "972501234567");
  assert.deepEqual(r.yesterday, { date: "2026-09-29", present: 0, absent: 2 });
});

test("two absences in a row become one repeat item, not two singles", () => {
  const r = analyze({
    players: [P("a")],
    groups,
    attendance: [A("a", "2026-09-29", "Absent"), A("a", "2026-09-27", "Absent")],
    today,
  });
  assert.equal(r.pending.length, 1);
  assert.equal(r.pending[0].kind, "repeat");
});

test("handled alert and inactive players are skipped", () => {
  const r = analyze({
    players: [P("a", { alertHandledDate: "2026-09-29" }), P("b", { isActive: false })],
    groups,
    attendance: [A("a", "2026-09-29", "Absent"), A("a", "2026-09-27", "Absent"), A("b", "2026-09-29", "Absent")],
    today,
  });
  assert.equal(r.pending.length, 0);
});

test("excused absence (sick etc.) is not counted: no message, no repeat, not in yesterday's absent", () => {
  const r = analyze({
    players: [P("a"), P("b")],
    groups,
    attendance: [
      A("a", "2026-09-29", "Absent", { excused: true }),
      A("a", "2026-09-27", "Absent"),
      A("b", "2026-09-29", "Absent", { excused: true }),
      A("b", "2026-09-27", "Absent", { excused: true }),
    ],
    today,
  });
  // a: רק ההיעדרות הלא מוצדקת (27.9) נשארת — הודעה רגילה ולא "פעמיים ברצף"; b: כלום
  assert.deepEqual(r.pending.map((x) => [x.playerId, x.kind]), [["a", "absence"]]);
  assert.deepEqual(r.yesterday, { date: "2026-09-29", present: 0, absent: 0 });
});

test("trial players get no absence message and no dropout alert", () => {
  const r = analyze({
    players: [P("t", { trial: true })],
    groups,
    attendance: [A("t", "2026-09-29", "Absent"), A("t", "2026-09-27", "Absent")],
    today,
  });
  assert.equal(r.pending.length, 0);
  assert.equal(r.atRisk.length, 0);
});

test("present on the same day in another group wins over absent", () => {
  const r = analyze({
    players: [P("a")],
    groups,
    attendance: [A("a", "2026-09-29", "Absent"), A("a", "2026-09-29", "Present", { groupId: "g2" }), A("a", "2026-09-27", "Absent")],
    today,
  });
  assert.equal(r.pending.filter((x) => x.kind === "repeat").length, 0);
});

test("dropout risk: streak, sharp drop, low rate", () => {
  const H = (arr) => arr.map(([d, s]) => ({ date: addDays(today, -d), status: s }));
  assert.equal(dropoutRisk(H([[1, "Absent"], [3, "Absent"], [6, "Absent"]]), today).level, "high");
  const drop = dropoutRisk(
    H([[2, "Absent"], [5, "Present"], [9, "Absent"], [40, "Present"], [45, "Present"], [50, "Present"]]),
    today,
  );
  assert.equal(drop.level, "high");
  assert.match(drop.reason, /ירידה חדה/);
  assert.equal(dropoutRisk(H([[2, "Present"], [5, "Present"], [9, "Absent"]]), today), null);
});

test("adult group and templates", () => {
  const r = analyze({
    players: [P("a", { groupId: "g2", name: "תמר" })],
    groups,
    attendance: [A("a", "2026-09-29", "Absent", { groupId: "g2" })],
    today,
  });
  const t = absenceTemplate(r.pending[0]);
  assert.equal(t.name, "club_absence_adult");
  assert.match(renderTemplate(t.name, t.params), /^שלום תמר, ראינו שלא הגעת לאימון אתמול/);
  const child = absenceTemplate({ ...r.pending[0], adult: false, gender: "f" });
  assert.match(renderTemplate(child.name, child.params), /בתכם תמר לא הגיעה לאימון אתמול/);
  for (const [name, t] of Object.entries(TEMPLATES)) {
    assert.ok(!/^\{\{|\}\}$/.test(t.body), `${name} starts/ends with a variable`);
    assert.equal((t.body.match(/\{\{\d\}\}/g) || []).length, t.example.length, name);
  }
  assert.match(fullReportText(r), /שלח הכל/);
});

import { dataChecks } from "./lib/checks.mjs";

test("data checks find contract breaks, orphans and unfilled sessions", () => {
  const out = dataChecks({
    today,
    players: [P("a"), P("b", { groupId: "nope", parentPhone: "" })],
    groups: [{ id: "g1", name: "ילדים א", coachId: "u1", days: [2] }, { id: "g2", name: "מבוגרים" }],
    attendance: [
      { id: "2026-09-27_g1_a", date: "2026-09-27", groupId: "g1", playerId: "a", status: "Present" },
      { id: "wrong", date: "2026-09-27", groupId: "g1", playerId: "a", status: "Present" },
    ],
    cancellations: [],
  });
  const ids = out.map((x) => x.id).sort();
  assert.deepEqual(ids, ["attendance-contract", "group-no-coach", "player-no-group", "player-no-phone", "unfilled-attendance"]);
  // 2026-09-29 is a Tuesday (day 2) and nothing was filled for g1
  assert.match(out.find((x) => x.id === "unfilled-attendance").text, /ילדים א \(1\)/);
});

// כמו באפליקציה (pendingAbsenceMsgs): מדלגים רק על שני התאריכים שבהתראה, לא על כל ההיעדרויות של השחקן
test("a player with a pending repeat alert: only the alert's two dates are folded into it", () => {
  const r = analyze({
    players: [P("a")],
    groups,
    attendance: [A("a", "2026-09-29", "Absent"), A("a", "2026-09-27", "Absent"), A("a", "2026-09-25", "Absent")],
    today,
  });
  assert.deepEqual(r.pending.map((x) => `${x.kind}:${x.date}`), ["repeat:2026-09-29", "absence:2026-09-25"]);
});

test("absence item carries the record's group, never the player's current group", () => {
  const r = analyze({
    players: [P("a", { groupId: "g2" }), P("b")],
    groups,
    attendance: [A("a", "2026-09-29", "Absent", { groupId: "g1" }), A("b", "2026-09-29", "Absent", { groupId: undefined })],
    today,
  });
  assert.equal(r.pending.length, 1, "a record without groupId is skipped");
  assert.equal(r.pending[0].playerId, "a");
  assert.equal(r.pending[0].groupId, "g1");
});

test("today's absence is pending (like the app)", () => {
  const r = analyze({ players: [P("a")], groups, attendance: [A("a", today, "Absent")], today });
  assert.deepEqual(r.pending.map((x) => `${x.kind}:${x.date}`), [`absence:${today}`]);
});

test("skipAbsenceMsg: not the player's day, or a player who almost never comes", async () => {
  const { skipAbsenceMsg } = await import("./lib/analysis.mjs");
  // קבוצה בשני (2026-09-07...) ובחמישי (2026-09-10...), 4 שבועות
  const mondays = ["2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28"];
  const thursdays = ["2026-09-10", "2026-09-17", "2026-09-24", "2026-10-01"];
  const R = (playerId, date, status) => ({ playerId, date, status, groupId: "g" });
  const att = [...mondays, ...thursdays].map((d) => R("other", d, "Present"));
  mondays.forEach((d) => att.push(R("mon", d, "Present")));
  thursdays.forEach((d) => att.push(R("mon", d, "Absent")));
  att.push(R("rare", mondays[0], "Present"));
  const p = (id, extra = {}) => ({ id, groupId: "g", ...extra });
  assert.equal(skipAbsenceMsg(p("mon"), "g", att, "2026-10-08"), true, "Thursday is not his day (inferred)");
  assert.equal(skipAbsenceMsg(p("mon"), "g", att, "2026-10-05"), false, "Monday is his day");
  assert.equal(skipAbsenceMsg(p("other"), "g", att, "2026-10-08"), false, "comes on both days");
  assert.equal(skipAbsenceMsg(p("rare"), "g", att, "2026-10-05"), true, "almost never comes");
  assert.equal(skipAbsenceMsg(p("other", { trainingDays: [1] }), "g", att, "2026-10-08"), true, "days the coach set win over inferred ones");
  assert.equal(skipAbsenceMsg(p("new"), "g", [], "2026-10-08"), false, "no data: keep the message");
});

test("registration issues: suggestions to confirm, skipping ignored, inactive and duplicates", () => {
  const players = [P("a"), P("b", { groupId: "g2" }), P("c", { isActive: false })];
  const sync = {
    nameSuggestions: [
      { fileName: "שחקן א׳", groupId: "g1", candidates: [{ playerId: "a" }, { playerId: "c" }] },
      { fileName: "שחקן ב׳", groupId: "g1", candidates: [{ playerId: "b" }, { playerId: "b" }] },
      { fileName: "אחר", groupId: "g1", candidates: [{ playerId: "a" }] },
    ],
    unmatchedNames: ["x", "y"],
    sessionGaps: [{}],
  };
  const r = registrationIssues({ sync, ignores: ["a::אחר"], players, groups });
  assert.deepEqual(r.items.map((x) => x.key), ["a::שחקן א׳", "b::שחקן ב׳"]);
  assert.equal(r.items[1].group, "מבוגרים");
  assert.equal(r.items[1].fileGroup, "ילדים א");
  assert.equal(r.unmatched, 2);
  assert.equal(r.gaps, 1);
  assert.equal(r.stopped, false);
  const text = fullReportText({ date: today, yesterday: { present: 0, absent: 0 }, pending: [], atRisk: [], summary: { pending: 0, atRiskHigh: 0, atRiskMedium: 0 }, registration: r });
  assert.match(text, /ר1\. שחקן a \(ילדים א\) — בקובץ: "שחקן א׳"/);
  assert.match(text, /ר2\. שחקן b \(מבוגרים\) — בקובץ: "שחקן ב׳" בילדים א/);
  assert.match(text, /2 שמות בקובץ לא נמצאו/);
  assert.match(text, /אשר ר1,ר2/);
});

test("no sync document: registration is empty and the report has no registration section", () => {
  const r = registrationIssues({ sync: null, ignores: [], players: [P("a")], groups });
  assert.deepEqual(r, { items: [], unmatched: 0, gaps: 0, stopped: false });
  const text = fullReportText({ date: today, yesterday: { present: 0, absent: 0 }, pending: [], atRisk: [], summary: { pending: 0, atRiskHigh: 0, atRiskMedium: 0 }, registration: r });
  assert.doesNotMatch(text, /רישום ותשלום/);
});

test("top actions: at most 3, most urgent first, each with what to do", () => {
  const r = {
    date: today,
    yesterday: { present: 0, absent: 0 },
    summary: { pending: 3, atRiskHigh: 1, atRiskMedium: 1 },
    pending: [
      { kind: "absence", playerName: "א", phone: "972500000001" },
      { kind: "repeat", playerName: "ב", phone: "972500000002" },
      { kind: "repeat", playerName: "ג", phone: "" },
    ],
    atRisk: [
      { playerName: "ד", groupName: "ילדים א", level: "high", reason: "3 היעדרויות ברצף" },
      { playerName: "ה", groupName: "ילדים א", level: "medium", reason: "x" },
    ],
    registration: { items: [{}], unmatched: 2, gaps: 1, stopped: false },
  };
  const a = topActions(r);
  assert.equal(a.length, 3);
  assert.match(a[0], /^ד \(ילדים א\) — 3 היעדרויות ברצף\. כדאי להתקשר להורים היום/);
  assert.match(a[1], /^ב החסיר\/ה פעמיים ברצף — הודעה להורים: "שלח 2"/, "מספר כמו ברשימה, בלי מי שאין לו טלפון");
  assert.match(a[2], /התאמת שם אחת ברישום/);
  assert.equal(topActions({ ...r, registration: { ...r.registration, stopped: true } })[0].startsWith("סנכרון התשלומים נעצר"), true);
  assert.deepEqual(topActions({ date: today, pending: [], atRisk: [], registration: null }), []);
  // בוגרים: מדברים איתם ישירות, לא עם ההורים
  const adult = topActions({ ...r, atRisk: [{ ...r.atRisk[0], adult: true }], pending: [{ ...r.pending[1], adult: true }], registration: null });
  assert.match(adult[0], /כדאי להתקשר אליו\/אליה היום$/);
  assert.match(adult[1], /הודעה אישית: "שלח 1"/);
  assert.ok(!adult.join(" ").includes("להורים"));
  assert.match(fullReportText(r), /🎯 הכי חשוב היום:\n• ד \(ילדים א\)/);
});

test("coach notes text in the morning report", () => {
  // 📝 סיכומי מדריכים בדוח הבוקר
  assert.equal(coachNotesText([]), "");
  assert.match(coachNotesText([{ coach: "דני", groups: ["מתחילים"], text: "עבדנו על הגשה, היה מעולה" }]), /📝 מה המדריכים כתבו אתמול:\n• דני \(מתחילים\): עבדנו על הגשה/);
  assert.ok(coachNotesText([{ coach: "x", text: "א".repeat(2000) }]).length < 1300, "ארוך מדי נחתך");
});
