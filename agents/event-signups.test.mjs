// ייצוא הרשמות לאירועים לגיליון המארגנים (scripts/export_event_signups.mjs) — בלי רשת.
import { test } from "node:test";
import assert from "node:assert/strict";
import { EVENTS, israelTime, rowFor, pendingByEvent, ownerText } from "../scripts/export_event_signups.mjs";

const s = (id, extra = {}) => ({
  id, event: "crane-2026", uid: "u1", n: 1, firstName: "נועה", lastName: "כהן", heat: "5 ק\"מ", gender: "נ",
  birth: "1.2.2015", city: "שניר", phone: "050-1234567", email: "x@example.com", shirt: "ילדים 10", byName: "גולש",
  createdAt: new Date("2026-10-20T21:30:00Z"), ...extra,
});

test("israelTime: dd/mm/yyyy HH:MM in Israel time (crosses midnight)", () => {
  assert.equal(israelTime(new Date("2026-10-20T21:30:00Z")), "21/10/2026 00:30");
  assert.equal(israelTime({ toDate: () => new Date("2026-01-05T08:07:00Z") }), "05/01/2026 10:07");
});

test("rowFor follows the sheet's 15 columns, ID and handed-over left empty", () => {
  const row = rowFor(s("a"), EVENTS["crane-2026"]);
  assert.deepEqual(row, [
    "21/10/2026 00:30", "כהן", "נועה", "5 ק\"מ", "נ", "1.2.2015", "טניס שולחן מבואות חרמון",
    "050-1234567", "", "שניר", "ישראל", "x@example.com", "ילדים 10", "גולש", "",
  ]);
  assert.equal(rowFor(s("b", { email: undefined }), EVENTS["crane-2026"])[11], "");
});

test("pendingByEvent skips exported and unknown events, sorts by signup time", () => {
  const out = pendingByEvent(
    [s("late", { createdAt: new Date("2026-10-22") }), s("early", { createdAt: new Date("2026-10-21") }), s("done"), s("x", { event: "other-1" })],
    new Set(["done"]),
  );
  assert.deepEqual(Object.keys(out), ["crane-2026"]);
  assert.deepEqual(out["crane-2026"].map((x) => x.id), ["early", "late"]);
  assert.deepEqual(pendingByEvent([s("done")], new Set(["done"])), {});
});

test("ownerText: one line per event with names and heats", () => {
  const t = ownerText({ "crane-2026": [s("a"), s("b", { firstName: "דן", heat: "10 ק\"מ" })] });
  assert.match(t, /^🏃 2 נרשמו למרוץ העגור מהאפליקציה: נועה כהן – 5 ק"מ, דן כהן – 10 ק"מ · חסרות ת.ז/);
});
