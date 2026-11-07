// "הבאת חבר" (scripts/referrals.mjs, match_board_members.mjs) — בלי רשת.
import { test } from "node:test";
import assert from "node:assert/strict";
import { leaderboard, publicName } from "../scripts/referrals.mjs";
import { referralJoins, referralText } from "../scripts/match_board_members.mjs";

const at = (iso) => new Date(iso);
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
