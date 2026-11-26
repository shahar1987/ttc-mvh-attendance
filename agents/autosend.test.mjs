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
  const item = { adult: false, genderKnown: false, gender: "m", playerName: "יהב לוי", whenText: "היום" };
  const a = absenceTemplate({ ...item, kind: "absence" });
  assert.match(renderTemplate(a.name, a.params), /^שלום, לא ראינו את יהב לוי באימון היום\./);
  const r = absenceTemplate({ ...item, kind: "repeat" });
  assert.match(renderTemplate(r.name, r.params), /^שלום, לא ראינו את יהב לוי בשני האימונים האחרונים\./);
  const f = absenceTemplate({ ...item, kind: "absence", genderKnown: true, gender: "f" });
  assert.match(renderTemplate(f.name, f.params), /בתכם יהב לוי לא הגיעה/);
  assert.doesNotMatch(JSON.stringify(TEMPLATES), /neutral_/, "לא נשלח ל-Meta");
});

test("no welcome while on trial, welcome once moved to the group", () => {
  const data = { groups, attendance: [], cancellations: [] }, t = P("t", { joinDate: today, trial: true });
  assert.deepEqual(plan({ ...data, players: [t] }, today).messages, []);
  assert.deepEqual(plan({ ...data, players: [{ ...t, trial: false }] }, today).messages.map((m) => m.key), [`welcome:${today}:g1:t`]);
});

test("welcome text for a girl", () => {
  assert.match(welcomeText({ name: "נועה לוי", gender: "f" }, groups[0]), /שנועה לוי הצטרפה לקבוצת .*מחכה לה/);
});

test("marks: only well-formed id keys pass", () => {
  assert.deepEqual(parseMarks(`absence:${today}:g1:a, welcome:${today}:g1:b`).map((m) => m.kind), ["absence", "welcome"]);
  assert.throws(() => parseMarks("absence:2026-10-29:g1:a;rm"), /לא תקינים/);
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

test("trial that started before the cutoff gets the welcome from the day it moved to the group", () => {
  const p = P("old", { joinDate: "2026-09-01", trial: false, registeredAt: today });
  const r = plan({ players: [p], groups, attendance: [], cancellations: [] }, today);
  assert.deepEqual(r.messages.map((m) => m.key), [`welcome:${today}:g1:old`]);
});

// 24.11 שלום: "אני רוצה שמי שלא מגיע יקבל הודעת וואטסאפ" — כל היעדרות מקבלת הודעה אחת
test("24.11: one absence gets a message that evening (child to parent, adult directly)", () => {
  const d = "2026-11-26"; // חמישי
  const attendance = [A("a", d, "Absent"), A("w", d, "Absent", "g2"), anchor(d), anchor(d, "g2")];
  const players = [P("a", { gender: "f" }), P("w", { groupId: "g2", gender: "m", name: "רון" })];
  const r = plan({ players, groups: [{ ...groups[0] }, { ...groups[1], adult: true, name: "מבוגרים דפנה" }], attendance, cancellations: [] }, d);
  const byKey = Object.fromEntries(r.messages.map((m) => [m.key, m.text]));
  assert.match(byKey[`absence:${d}:g1:a`], /בתכם דני a לא הגיעה לאימון היום/);
  assert.ok(byKey[`absence:${d}:g2:w`], "adult got a message too");
});

test("24.11: second in a row gets only the two-trainings text, not two messages", () => {
  const d1 = "2026-11-26", d2 = "2026-11-29";
  const attendance = [A("a", d1, "Absent"), anchor(d1), A("a", d2, "Absent"), anchor(d2)];
  const sent = new Set([`absence:${d1}:g1:a`]);
  const players = [P("a", { gender: "m", alertHandledDate: d1 })];
  const r = plan({ players, groups, attendance, cancellations: [] }, d2, sent);
  assert.deepEqual(r.messages.map((m) => m.key), [`repeat:${d2}:g1:a`]);
});

test("24.11: no single message for excused, trial, coach already sent, cancelled or not-held training, old absences", () => {
  const d = "2026-11-26";
  const attendance = [
    { ...A("e", d, "Absent"), excused: true }, A("t", d, "Absent"), { ...A("s", d, "Absent"), msgSentAt: "x" }, anchor(d),
    A("n", "2026-11-25", "Absent", "g2"), // אף אחד לא הגיע: אימון שלא התקיים
    A("o", "2026-11-23", "Absent"), anchor("2026-11-23"), // לפני SINGLE_FROM
  ];
  const players = ["e", "s", "n", "o"].map((id) => P(id, id === "n" ? { groupId: "g2" } : {})).concat(P("t", { trial: true }));
  assert.deepEqual(plan({ players, groups, attendance, cancellations: [] }, d).messages, []);
});

test("24.11: sent log stops a second send of the same absence", () => {
  const d = "2026-11-26";
  const attendance = [A("a", d, "Absent"), anchor(d)];
  assert.deepEqual(plan({ players: [P("a")], groups, attendance, cancellations: [] }, d, new Set([`absence:${d}:g1:a`])).messages, []);
});

// 24.11 שלום: אחרי שתי הודעות על שני אימונים נפרדים בלי שחזר — לא שולחים שוב ומעדכנים אותו
test("24.11: after two messages without coming back, no third message; owner told once", () => {
  const d1 = "2026-11-26", d2 = "2026-11-29", d3 = "2026-11-30";
  const attendance = [A("a", d1, "Absent"), anchor(d1), A("a", d2, "Absent"), anchor(d2), A("a", d3, "Absent"), anchor(d3)];
  const sent = new Set([`absence:${d1}:g1:a`, `repeat:${d2}:g1:a`]);
  const r = plan({ players: [P("a", { alertHandledDate: d2 })], groups, attendance, cancellations: [] }, d3, sent);
  assert.deepEqual(r.messages, []);
  assert.deepEqual(r.stopped, ["דני a"]);
  const again = plan({ players: [P("a", { alertHandledDate: d2 })], groups, attendance, cancellations: [] }, d3, new Set([...sent, ...r.stopKeys]));
  assert.deepEqual(again.stopped, []);
});

test("24.11: came back after two messages — counting starts over", () => {
  const d1 = "2026-11-26", d2 = "2026-11-29", d3 = "2026-11-30", d4 = "2026-12-03";
  const attendance = [A("a", d1, "Absent"), anchor(d1), A("a", d2, "Absent"), anchor(d2), A("a", d3, "Present"), A("a", d4, "Absent"), anchor(d4)];
  const sent = new Set([`absence:${d1}:g1:a`, `repeat:${d2}:g1:a`]);
  const r = plan({ players: [P("a", { alertHandledDate: d2 })], groups, attendance, cancellations: [] }, d4, sent);
  assert.deepEqual(r.messages.map((m) => m.key), [`absence:${d4}:g1:a`]);
});

test("24.11: deliver tells the owner about stopped players and logs it", async () => {
  const told = [], logged = [];
  await deliver({ today: "2026-11-30", messages: [], stopped: ["דני a"], stopKeys: ["stop:2026-11-29:a"] }, { tell: async (t) => told.push(t), log: async (k) => logged.push(...k) });
  assert.match(told[0], /דני a/);
  assert.deepEqual(logged, ["stop:2026-11-29:a"]);
});

test("deliver: a number blocked at the sender is logged so it is never retried, not marked, not reported", async () => {
  const [c, io] = fakeIo((m) => ({ sent: [], failed: [], blocked: [m[0].key] }));
  const r = await deliver({ today: day, messages: [msg(1)] }, io);
  assert.deepEqual([r.ok, r.sent], [true, 0]);
  assert.deepEqual(c.logged, [msg(1).key, `blocked:${msg(1).key}`]);
  assert.deepEqual(c.marked, []);
  assert.deepEqual(c.told, []);
});

test("plan: blocked messages do not count towards the two-messages stop notice", () => {
  const d1 = "2026-11-24", d2 = "2026-11-25", d3 = "2026-11-26";
  const attendance = [A("a", d3, "Absent"), anchor(d3)];
  const sent = new Set([`absence:${d1}:g1:a`, `blocked:absence:${d1}:g1:a`, `absence:${d2}:g1:a`, `blocked:absence:${d2}:g1:a`]);
  const r = plan({ players: [P("a", { gender: "m" })], groups, attendance, cancellations: [] }, d3, sent);
  assert.deepEqual(r.stopped, []);
});

test("26.11: trial player gets the trial message once, the evening he was added", () => {
  const day = "2026-11-26", next = "2026-11-27";
  const players = [
    P("b", { trial: true, joinDate: day, name: "יואב כהן", gender: "m" }),
    P("g", { trial: true, joinDate: day, name: "נועה לוי", gender: "f" }),
    P("u", { trial: true, joinDate: day, name: "טל אבן" }),
    P("ad", { trial: true, joinDate: day, groupId: "g2", name: "רון שמש" }),
    P("old", { trial: true, joinDate: "2026-11-20" }),
    P("done", { trial: true, joinDate: day, trialMsgSentAt: "x" }),
  ];
  const r = plan({ players, groups, attendance: [], cancellations: [] }, day);
  const byId = Object.fromEntries(r.messages.map((m) => [m.key.split(":")[3], m.text]));
  assert.deepEqual(Object.keys(byId).sort(), ["ad", "b", "g", "u"]);
  assert.match(byId.b, /^היי 🏓\nשמחים שהגעתם היום לאימון ניסיון!\nמקווים שיואב נהנה\. נתראה באימון הבא!/);
  assert.match(byId.g, /מקווים שנועה נהנתה\./);
  assert.match(byId.u, /מקווים שנהניתם\./);
  assert.match(byId.ad, /^היי רון 🏓\nשמח שהגעת היום לאימון ניסיון!\nמקווה שנהנית\./);
  assert.match(byId.b, /ע"ש רוני גלבוע$/);
  // נכנס אחרי חלון הערב: יוצא למחרת בלי "היום", ופעם אחת בלבד
  const r2 = plan({ players: [players[0]], groups, attendance: [], cancellations: [] }, next);
  assert.match(r2.messages[0].text, /שמחים שהגעתם לאימון ניסיון!/);
  assert.equal(plan({ players: [players[0]], groups, attendance: [], cancellations: [] }, next, new Set([r2.messages[0].key])).messages.length, 0);
  assert.equal(plan({ players: [players[0]], groups, attendance: [], cancellations: [] }, "2026-11-28").messages.length, 0);
  assert.deepEqual(parseMarks(`trial:${day}:g1:b`).map((m) => m.kind), ["trial"]);
});
