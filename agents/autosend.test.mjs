import test from "node:test";
import assert from "node:assert/strict";
import { plan, parseMarks, welcomeText, CUTOFF } from "./autosend.mjs";

const groups = [
  { id: "g1", name: "מתחילים", days: [0, 4], startTime: "16:30" },
  { id: "g2", name: "מבוגרים דפנה", days: [1, 4], startTime: "19:30" },
];
const P = (id, extra = {}) => ({ id, name: `דני ${id}`, groupId: "g1", isActive: true, parentPhone: "050-1234567", joinDate: "2026-09-01", ...extra });
const A = (playerId, date, status, groupId = "g1") => ({ playerId, date, status, groupId });
const anchor = (date, groupId = "g1") => A("_anchor", date, "Present", groupId);
const today = "2026-10-29"; // חמישי

test("absence today: one message to the parent, in the app's wording", () => {
  const r = plan({ players: [P("a"), P("b", { parentPhone: "" })], groups, attendance: [A("a", today, "Absent"), A("b", today, "Absent"), anchor(today)], cancellations: [] }, today);
  assert.equal(r.messages.length, 1);
  assert.equal(r.messages[0].key, `absence:${today}:g1:a`);
  assert.equal(r.messages[0].to, "972501234567");
  assert.match(r.messages[0].text, /בנכם דני a לא הגיע לאימון היום/);
  assert.deepEqual(r.noPhone, ["דני b"]);
});

test("nothing before the cutoff, nothing already sent", () => {
  const old = "2026-10-25"; // ראשון, האימון הקודם של הקבוצה
  assert.ok(old < CUTOFF);
  const data = { players: [P("a")], groups, attendance: [A("a", old, "Absent"), anchor(old), A("a", today, "Absent"), anchor(today)], cancellations: [] };
  const r = plan(data, today);
  assert.deepEqual(r.messages.map((m) => m.key), [`absence:${today}:g1:a`]); // ה-25 לפני ההפעלה: רק היום
  assert.equal(plan(data, today, new Set([r.messages[0].key])).messages.length, 0);
});

test("welcome only for players who joined since the cutoff, adults addressed directly", () => {
  const r = plan({ players: [P("old"), P("new", { joinDate: today, parentName: "רונית כהן" }), P("ad", { groupId: "g2", name: "יעל לוי", joinDate: CUTOFF }), P("sent", { joinDate: today, welcomeSentAt: "x" })], groups, attendance: [], cancellations: [] }, today);
  assert.deepEqual(r.messages.map((m) => m.key), [`welcome:${today}:g1:new`, `welcome:${CUTOFF}:g2:ad`]);
  assert.match(r.messages[0].text, /^היי רונית, שמחים שדני new הצטרף לקבוצת מתחילים/);
  assert.match(r.messages[0].text, /בימי ראשון וחמישי ב-16:30/);
  assert.match(r.messages[1].text, /^היי יעל, שמחים שהצטרפת לקבוצת מבוגרים דפנה/);
});

test("welcome text for a girl", () => {
  assert.match(welcomeText({ name: "נועה לוי", gender: "f" }, groups[0]), /שנועה לוי הצטרפה/);
});

test("marks: only well-formed id keys pass", () => {
  assert.deepEqual(parseMarks(`absence:${today}:g1:a, welcome:${today}:g1:b`).map((m) => m.kind), ["absence", "welcome"]);
  assert.throws(() => parseMarks("absence:2026-10-29:g1:a;rm"), /לא תקינים/);
  assert.throws(() => parseMarks("note:2026-10-29:g1:a"));
});
