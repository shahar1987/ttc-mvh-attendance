// בחירת התראות יום המשחק (scripts/gameday.mjs) — בלי רשת.
import { test } from "node:test";
import assert from "node:assert/strict";
import { plan, israelNow, matchKey } from "../scripts/gameday.mjs";

const data = {
  teams: { MH1: "הפועל מבואות חרמון M1", KR2: "הישגי כרמיאל M2", HP2: "הפועל חיפה M2", MH4: "הפועל מבואות חרמון M4", MH5: "הפועל מבואות חרמון M5", NG6: "הפועל עירוני נוף הגליל M6" },
  ours: ["MH1", "MH4", "MH5"],
  leagues: [
    { id: "leumit", short: "לאומית", matches: [
      { r: 1, d: "13/10/26", t: "19:00", h: "HP2", a: "MH1", res: "1:4", w: "MH1" },
      { r: 2, d: "20/10/26", t: "19:00", h: "MH1", a: "KR2", res: "", w: "" },
      { r: 2, d: "20/10/26", t: "18:00", h: "HP2", a: "KR2", res: "", w: "" },
    ] },
    { id: "alef", short: "ליגה א'", matches: [{ r: 3, d: "20/10/26", t: "20:30", h: "NG6", a: "MH5", res: "", w: "" }] },
  ],
};
const at = (iso) => new Date(iso);
const morning = at("2026-10-20T06:07:00Z"); // 09:07 בישראל

test("Israel date/time (IDT and IST)", () => {
  assert.deepEqual(israelNow(morning), { date: "2026-10-20", hhmm: "09:07" });
  assert.deepEqual(israelNow(at("2026-12-31T22:30:00Z")), { date: "2027-01-01", hhmm: "00:30" });
});

test("first run: no flood — existing results only marked; morning push still goes", () => {
  const r = plan(data, null, morning);
  assert.equal(r.pushes.length, 1);
  assert.equal(r.pushes[0].title, "היום משחקים! 🏓");
  assert.equal(r.pushes[0].body, "מבואות חרמון M1 נגד הישגי כרמיאל M2 · 19:00 · בית | מבואות חרמון M5 נגד נוף הגליל M6 · 20:30 · חוץ. בואו לעודד!");
  assert.deepEqual(r.state.announcedDays, ["2026-10-20"]);
  assert.deepEqual(r.state.announcedResults, [matchKey(data.leagues[0], data.leagues[0].matches[0])]);
});

test("morning push once per day, only from 08:00 until the first game", () => {
  const s = { announcedDays: [], announcedResults: [matchKey(data.leagues[0], data.leagues[0].matches[0])] };
  assert.equal(plan(data, s, at("2026-10-20T04:30:00Z")).pushes.length, 0); // 07:30
  assert.equal(plan(data, s, at("2026-10-20T16:30:00Z")).pushes.length, 0); // 19:30 — כבר התחיל
  const r = plan(data, s, morning);
  assert.equal(plan(data, r.state, at("2026-10-20T07:37:00Z")).pushes.length, 0);
});

test("new result announced once, from our side; win/loss text", () => {
  const s = plan(data, null, morning).state;
  const d2 = structuredClone(data);
  d2.leagues[0].matches[1].res = "1:4";
  d2.leagues[0].matches[1].w = "KR2";
  d2.leagues[1].matches[0].res = "2:4";
  d2.leagues[1].matches[0].w = "MH5";
  d2.leagues[0].matches[2].res = "4:0"; // לא שלנו
  const r = plan(d2, s, at("2026-10-20T19:37:00Z"));
  assert.deepEqual(r.pushes, [
    { title: "תוצאה: מבואות חרמון M1 1:4 הישגי כרמיאל M2", body: "הפסד, ממשיכים 💪" },
    { title: "תוצאה: מבואות חרמון M5 4:2 נוף הגליל M6", body: "ניצחון! 🎉" },
  ]);
  assert.equal(plan(d2, r.state, at("2026-10-20T20:37:00Z")).pushes.length, 0);
});

test("times without a leading zero are compared correctly", () => {
  const d2 = structuredClone(data);
  d2.leagues[0].matches[1].t = "9:30"; // 09:30
  const s = { announcedDays: [], announcedResults: [matchKey(data.leagues[0], data.leagues[0].matches[0])] };
  assert.equal(plan(d2, s, at("2026-10-20T06:07:00Z")).pushes.length, 1); // 09:07 < 09:30
  assert.equal(plan(d2, s, at("2026-10-20T06:45:00Z")).pushes.length, 0); // 09:45 — כבר התחיל
});

test("at most 3 pushes per run; the rest are marked and never sent", () => {
  const d2 = structuredClone(data);
  d2.leagues[0].matches = Array.from({ length: 5 }, (_, i) => ({ r: i + 1, d: "19/10/26", t: "19:00", h: "MH1", a: "KR2", res: "4:0", w: "MH1" }));
  const r = plan(d2, { announcedDays: [], announcedResults: [] }, at("2026-10-20T10:00:00Z"));
  assert.equal(r.pushes.length, 3);
  assert.equal(r.state.announcedResults.length, 5);
});

test("a result older than a week is marked without a push", () => {
  const d2 = structuredClone(data);
  d2.leagues[0].matches[1].res = "4:0";
  d2.leagues[0].matches[1].w = "MH1";
  const r = plan(d2, { announcedDays: ["2026-10-20"], announcedResults: [] }, at("2026-11-01T10:00:00Z"));
  assert.equal(r.pushes.length, 0);
  assert.equal(r.state.announcedResults.length, 2);
});
