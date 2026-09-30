// הרצה: node --test agents/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { analyze, dropoutRisk, addDays, fullReportText } from "./lib/analysis.mjs";
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

test("a player with a pending repeat alert gets no extra single-absence item", () => {
  const r = analyze({
    players: [P("a")],
    groups,
    attendance: [A("a", "2026-09-29", "Absent"), A("a", "2026-09-27", "Absent"), A("a", "2026-09-25", "Absent")],
    today,
  });
  assert.deepEqual(r.pending.map((x) => x.kind), ["repeat"]);
});
