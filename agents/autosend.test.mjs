import test from "node:test";
import assert from "node:assert/strict";
import { plan, parseMarks, welcomeText, CUTOFF, deliver, chunks, LIMIT } from "./autosend.mjs";
import { absenceTemplate, renderTemplate, TEMPLATES } from "./templates.mjs";

const groups = [
  { id: "g1", name: "מתחילים", days: [0, 4], startTime: "16:30" },
  { id: "g2", name: "מבוגרים דפנה", days: [1, 4], startTime: "19:30" },
];
const P = (id, extra = {}) => ({ id, name: `דני ${id}`, groupId: "g1", isActive: true, parentPhone: "050-1234567", joinDate: "2026-09-01", ...extra });
const A = (playerId, date, status, groupId = "g1") => ({ playerId, date, status, groupId });
const anchor = (date, groupId = "g1") => A("_anchor", date, "Present", groupId);
const today = "2026-10-29"; // חמישי

const prev = "2026-10-28"; // האימון הקודם של הקבוצה מול today (התאריך עצמו מותר על ידי CUTOFF)

test("one absence: no message at all", () => {
  const r = plan({ players: [P("a", { gender: "m" })], groups, attendance: [A("a", today, "Absent"), anchor(today)], cancellations: [] }, today);
  assert.deepEqual(r.messages, []);
  assert.deepEqual(r.noPhone, []);
});

test("second absence in a row: goes out that same evening, once", () => {
  const attendance = [A("a", prev, "Absent"), anchor(prev), A("a", today, "Absent"), A("b", prev, "Absent"), A("b", today, "Absent"), anchor(today)];
  const r = plan({ players: [P("a", { gender: "m" }), P("b", { parentPhone: "" })], groups, attendance, cancellations: [] }, today);
  assert.equal(r.messages.length, 1);
  assert.equal(r.messages[0].key, `repeat:${today}:g1:a`);
  assert.equal(r.messages[0].to, "972501234567");
  assert.match(r.messages[0].text, /בנכם דני a לא הגיע .*שני האימונים האחרונים/);
  assert.deepEqual(r.noPhone, ["דני b"]);
});

test("came back today: no message about the two before", () => {
  const before = "2026-10-26";
  const attendance = [A("a", before, "Absent"), anchor(before), A("a", prev, "Absent"), anchor(prev), A("a", today, "Present")];
  assert.deepEqual(plan({ players: [P("a")], groups, attendance, cancellations: [] }, today).messages, []);
});

test("third in a row is silent, fourth sends again", () => {
  const d3 = "2026-11-01", d4 = "2026-11-02";
  const attendance = [prev, today, d3, d4].flatMap((d) => [A("a", d, "Absent"), anchor(d)]);
  const data = { players: [P("a", { alertHandledDate: today })], groups, attendance: attendance.filter((x) => x.date <= d3), cancellations: [] };
  const log = new Set([`repeat:${today}:g1:a`]);
  assert.deepEqual(plan(data, d3, log).messages, []);
  const r = plan({ ...data, attendance }, d4, log);
  assert.deepEqual(r.messages.map((m) => m.key), [`repeat:${d4}:g1:a`]);
});

test("nothing before the cutoff, nothing already sent", () => {
  const old = "2026-10-25"; // ראשון, האימון הקודם של הקבוצה
  assert.ok(old < CUTOFF);
  const data = { players: [P("a")], groups, attendance: [A("a", old, "Absent"), anchor(old), A("a", today, "Absent"), anchor(today)], cancellations: [] };
  const r = plan(data, today);
  assert.deepEqual(r.messages.map((m) => m.key), [`repeat:${today}:g1:a`]);
  assert.equal(plan(data, today, new Set([r.messages[0].key])).messages.length, 0);
  assert.deepEqual(plan({ ...data, attendance: data.attendance.filter((x) => x.date === old) }, old).messages, []);
});

test("welcome only for players who joined since the cutoff, adults addressed directly", () => {
  const r = plan({ players: [P("old"), P("new", { joinDate: today, parentName: "רונית כהן", gender: "m" }), P("ad", { groupId: "g2", name: "יעל לוי", joinDate: CUTOFF }), P("sent", { joinDate: today, welcomeSentAt: "x" })], groups, attendance: [], cancellations: [] }, today);
  assert.deepEqual(r.messages.map((m) => m.key), [`welcome:${today}:g1:new`, `welcome:${CUTOFF}:g2:ad`]);
  assert.match(r.messages[0].text, /^היי רונית, איזה כיף! 🏓\nשמחים שדני new הצטרף לקבוצת מתחילים, והשולחן כבר מחכה לו/);
  assert.match(r.messages[0].text, /בימי ראשון וחמישי ב-16:30/);
  assert.match(r.messages[1].text, /^היי יעל, ברוכים הבאים למועדון! 🏓\nשמחים שהצטרפת לקבוצת מבוגרים דפנה/);
});

test("no recorded gender: neutral text, never a guess", () => {
  const t = welcomeText({ name: "יהב לוי" }, groups[0]);
  assert.match(t, /שמחים לקבל את יהב לוי לקבוצת מתחילים, והשולחן כבר מחכה\./);
  assert.doesNotMatch(t, /הצטרף|מחכה לו|מחכה לה/);
  const item = { kind: "repeat", adult: false, genderKnown: false, gender: "m", playerName: "יהב לוי" };
  const r = absenceTemplate(item);
  assert.match(renderTemplate(r.name, r.params), /^שלום, לא ראינו את יהב לוי בשני האימונים האחרונים\./);
  const f = absenceTemplate({ ...item, genderKnown: true, gender: "f" });
  assert.match(renderTemplate(f.name, f.params), /בתכם יהב לוי לא הגיעה/);
  assert.doesNotMatch(JSON.stringify(TEMPLATES), /neutral_/, "לא נשלח ל-Meta");
});

test("welcome text for a girl", () => {
  assert.match(welcomeText({ name: "נועה לוי", gender: "f" }, groups[0]), /שנועה לוי הצטרפה לקבוצת .*מחכה לה/);
});

test("marks: only well-formed id keys pass", () => {
  assert.deepEqual(parseMarks(`repeat:${today}:g1:a, welcome:${today}:g1:b`).map((m) => m.kind), ["repeat", "welcome"]);
  assert.throws(() => parseMarks("repeat:2026-10-29:g1:a;rm"), /לא תקינים/);
  assert.throws(() => parseMarks(`absence:${today}:g1:a`), "היעדרות אחת כבר לא נשלחת (5.11)");
  assert.throws(() => parseMarks("note:2026-10-29:g1:a"));
});

const msg = (i, kind = "absence") => ({ key: `${kind}:2026-11-03:g1:p${i}`, to: "972500000000", text: `נוסח ${i}`, who: `שחקן ${i}` });
function fakeIo(send) {
  const c = { sent: [], logged: [], marked: [], told: [], holds: 0 };
  return [c, {
    send: async (m) => { c.sent.push(m); return send ? send(m) : { sent: m.map((x) => x.key), failed: [] }; },
    log: async (k) => c.logged.push(...k), mark: async (k) => c.marked.push(...k), tell: async (t) => c.told.push(t), hold: async () => c.holds++,
  }];
}
const day = "2026-11-03";

test("deliver: goes out with no approval, then logs, marks and reports the exact text", async () => {
  const [c, io] = fakeIo();
  const r = await deliver({ today: day, messages: [msg(1, "welcome")] }, io);
  assert.equal(r.sent, 1);
  assert.equal(c.sent.length, 1);
  assert.deepEqual(c.logged, [msg(1, "welcome").key]);
  assert.deepEqual(c.marked, [msg(1, "welcome").key]);
  assert.match(c.told.join(), /נשלחו 1 הודעות:[\s\S]*שחקן 1 \(ברוך הבא\):\nנוסח 1/);
});

test("deliver: failed recipient is reported and neither logged nor marked", async () => {
  const [c, io] = fakeIo((m) => ({ sent: [m[0].key], failed: [{ key: m[1].key, reason: "אין וואטסאפ" }] }));
  const r = await deliver({ today: day, messages: [msg(1), msg(2)] }, io);
  assert.equal(r.ok, false);
  assert.deepEqual(c.logged, [msg(1).key]);
  assert.match(c.told.join(), /לא יצא: שחקן 2 — אין וואטסאפ/);
});

test("deliver: over the limit nothing goes out until he asks, and he is told once", async () => {
  const many = Array.from({ length: LIMIT + 1 }, (_, i) => msg(i));
  const [c, io] = fakeIo();
  await deliver({ today: day, messages: many }, io);
  await deliver({ today: day, messages: many, held: day }, io);
  assert.equal(c.sent.length, 0);
  assert.equal(c.holds, 1);
  assert.equal(c.told.length, 1);
  await deliver({ today: day, messages: many, requested: true }, io);
  assert.equal(c.sent.length, 0, "בקשה לפני שהוזהר לא עוקפת את התקרה");
  await deliver({ today: day, messages: many, held: day, requested: true }, io);
  assert.equal(c.sent.length, 1);
});

test("deliver: unknown send outcome holds further sends, so nothing goes twice", async () => {
  const [c, io] = fakeIo(() => { throw Object.assign(new Error("אין תוצאה"), { unknown: true }); });
  const r = await deliver({ today: day, messages: [msg(1)] }, io);
  assert.equal(r.ok, false);
  assert.equal(c.holds, 1);
  assert.equal(c.logged.length, 0);
  await deliver({ today: day, messages: [msg(1)], held: day }, io);
  assert.equal(c.sent.length, 1, "הריצה הבאה לא שולחת שוב");
});

test("deliver: nothing waiting is silent unless he asked; missing phones reported once a day", async () => {
  const [c, io] = fakeIo();
  await deliver({ today: day, messages: [] }, io);
  assert.equal(c.told.length, 0);
  await deliver({ today: day, messages: [], requested: true }, io);
  assert.match(c.told[0], /אין כרגע/);
  await deliver({ today: day, messages: [], noPhone: ["א"], noPhoneTold: true }, io);
  assert.equal(c.told.length, 1);
  await deliver({ today: day, messages: [], noPhone: ["א"] }, io);
  assert.equal(c.told.length, 2);
  assert.deepEqual(c.logged, [`nophone:${day}`]);
});

test("chunks split at item boundaries", () => {
  assert.deepEqual(chunks(["a".repeat(2000), "b".repeat(2000), "c"]), ["a".repeat(2000), `${"b".repeat(2000)}\n\nc`]);
});
