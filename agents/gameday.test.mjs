// בחירת התראות יום המשחק (scripts/gameday.mjs) ו"הבאת חבר" (scripts/referrals.mjs, match_board_members.mjs) — בלי רשת.
import { test } from "node:test";
import assert from "node:assert/strict";
import { plan, israelNow, matchKey } from "../scripts/gameday.mjs";
import { leaderboard, publicName } from "../scripts/referrals.mjs";
import { referralJoins, referralText } from "../scripts/match_board_members.mjs";

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

const ts = (iso) => ({ toMillis: () => Date.parse(iso) });
const members = [
  { id: "inviterAAAA1", name: "דנה כהן לוי", phone: "051-1234567", createdAt: ts("2026-09-01T10:00:00Z") },
  { id: "inviterBBBB2", name: "יוסי", phone: "052-1234567", createdAt: ts("2026-09-01T10:00:00Z") },
  { id: "friend000001", name: "א ב", phone: "050-0000001", ref: "inviterAAAA1", createdAt: ts("2026-10-02T10:00:00Z") },
  { id: "friend000002", name: "ג ד", phone: "050-0000002", ref: "inviterAAAA1", createdAt: ts("2026-09-30T21:30:00Z") }, // 1.10 בישראל
  { id: "friend000003", name: "ה ו", phone: "050-0000003", ref: "inviterBBBB2", createdAt: ts("2026-10-05T10:00:00Z") },
  { id: "friend000004", name: "ז ח", phone: "050-0000004", ref: "inviterAAAA1", createdAt: ts("2026-09-29T10:00:00Z") }, // חודש קודם
  { id: "friend000005", name: "ט י", phone: "050-0000005", ref: "goneUser0001", createdAt: ts("2026-10-05T10:00:00Z") }, // מזמין לא קיים
  { id: "friend000006", name: "כ ל", phone: "050-0000006", ref: "friend000006", createdAt: ts("2026-10-05T10:00:00Z") },
];
const matched = (id, playerIds = [`p_${id}`]) => ({ id, status: "matched", playerIds });
const matches = members.map((m) => matched(m.id));
const oct = at("2026-10-20T10:00:00Z");

test("referrals leaderboard: this Israel month, existing inviter, public name only", () => {
  assert.deepEqual(leaderboard(members, matches, oct), {
    month: "2026-10",
    top: [{ name: "דנה כ׳", count: 2 }, { name: "יוסי", count: 1 }],
  });
  assert.equal(publicName("  נועה   בר  "), "נועה ב׳");
});

test("fake accounts (not matched to a player) are not counted", () => {
  const fakes = Array.from({ length: 5 }, (_, i) => ({ id: `fakeAccount0${i}`, name: "בוט", phone: `050-30000${i}0`, ref: "inviterBBBB2", createdAt: ts("2026-10-06T10:00:00Z") }));
  const all = [...members, ...fakes];
  const ms2 = [...matches, ...fakes.map((f, i) => (i % 2 ? { id: f.id, status: "not-found", playerIds: [] } : { id: f.id }))];
  assert.deepEqual(leaderboard(all, ms2, oct).top.find((x) => x.name === "יוסי"), { name: "יוסי", count: 1 });
});

test("self-referral through a second account with the inviter's phone is not counted", () => {
  const alt = { id: "altAccount01", name: "יוסי שני", phone: "+972521234567", ref: "inviterBBBB2", createdAt: ts("2026-10-07T10:00:00Z") };
  assert.equal(leaderboard([...members, alt], [...matches, matched(alt.id)], oct).top.find((x) => x.name === "יוסי").count, 1);
});

test("the same player is counted once across all inviters", () => {
  const dup = { id: "dupAccount01", name: "א ב", phone: "050-0000009", ref: "inviterBBBB2", createdAt: ts("2026-10-08T10:00:00Z") };
  const r = leaderboard([...members, dup], [...matches, matched(dup.id, ["p_friend000001"])], oct);
  assert.equal(r.top.find((x) => x.name === "יוסי").count, 1);
  assert.equal(r.top.find((x) => x.name === "דנה כ׳").count, 2);
});

test("public name: no phone numbers or URLs; empty first name is skipped", () => {
  assert.equal(publicName("0501234567 https://evil.example"), "");
  assert.equal(publicName("דנה https://evil.example/x"), "דנה h׳");
  assert.equal(publicName("דנה050 כהן"), "דנה כ׳");
  const spam = { id: "inviterCCCC3", name: "0501234567", phone: "053-1234567", createdAt: ts("2026-09-01T10:00:00Z") };
  const f = { id: "friend000010", name: "מ נ", phone: "050-0000010", ref: spam.id, createdAt: ts("2026-10-09T10:00:00Z") };
  const r = leaderboard([...members, spam, f], [...matches, matched(f.id)], oct);
  assert.equal(r.top.length, 2);
  assert.doesNotMatch(JSON.stringify(r), /[0-9]{5}|https?:|@/);
});

test("owner line for a referred join — only on the member's first check", () => {
  const prev = new Map(members.filter((m) => m.id !== "friend000003").map((m) => [m.id, {}]));
  const j = referralJoins(members, prev);
  assert.deepEqual(j, [{ name: "ה ו", by: "יוסי" }]);
  assert.equal(referralText(j), "🤝 ה ו הצטרף/ה דרך יוסי");
});
