// ההתאמה של נרשמי לוח המועדון לשחקנים (scripts/match_board_members.mjs) — בלי רשת.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalisePhone,
  phoneIndex,
  needsCheck,
  matchMember,
  alreadyNotified,
  ownerText,
} from "../scripts/match_board_members.mjs";

test("normalisePhone is identical to the one in sync_payments.mjs", () => {
  const src = readFileSync(new URL("../scripts/sync_payments.mjs", import.meta.url), "utf8");
  const start = src.indexOf("export function normalisePhone(");
  const body = src.slice(start, src.indexOf("\n}\n", start) + 2).replace("export ", "");
  const orig = new Function(`${body}\nreturn normalisePhone;`)();
  for (const s of ["050-1234567", "+972 (0)50 123 4567", "972501234567", "0501234567", "", null, "123", "04-1234567", "05012345678901"])
    assert.equal(normalisePhone(s), orig(s), String(s));
});

const players = [
  { id: "p1", parentPhone: "050-1234567" },
  { id: "p2", parentPhone: "0501234567" }, // אח של p1 — אותו טלפון
  { id: "p3", phone: "+97252-7654321" },
  { id: "p4", mobile: "054-1111111" },
  { id: "p5", parentPhone: "053-1112222", deleted: true },
];
const idx = phoneIndex(players);

test("matches parentPhone, phone and mobile in any format; siblings both returned", () => {
  assert.deepEqual(matchMember({ phone: "+972 (0)50 123 4567" }, idx), { status: "matched", playerIds: ["p1", "p2"] });
  assert.deepEqual(matchMember({ phone: "0527654321" }, idx), { status: "matched", playerIds: ["p3"] });
  assert.deepEqual(matchMember({ phone: "054-1111111" }, idx).playerIds, ["p4"]);
});

test("unknown, empty or deleted-player phone is not-found", () => {
  assert.deepEqual(matchMember({ phone: "050-0000099" }, idx), { status: "not-found", playerIds: [] });
  assert.equal(matchMember({}, idx).status, "not-found");
  assert.equal(matchMember({ phone: "053-1112222" }, idx).status, "not-found");
});

test("needsCheck: missing result, or member updated after the last check", () => {
  const ts = (iso) => ({ toMillis: () => Date.parse(iso) });
  assert.equal(needsCheck({ updatedAt: ts("2026-10-20T10:00:00Z") }, undefined), true);
  assert.equal(needsCheck({ updatedAt: ts("2026-10-20T10:00:00Z") }, { checkedAt: ts("2026-10-20T11:00:00Z") }), false);
  assert.equal(needsCheck({ updatedAt: ts("2026-10-20T12:00:00Z") }, { checkedAt: ts("2026-10-20T11:00:00Z") }), true);
  assert.equal(needsCheck({ updatedAt: ts("2026-10-20T10:00:00Z") }, { checkedAt: new Date("2026-10-20T11:00:00Z") }), false);
});

test("owner is told once per not-found member", () => {
  const nf = { status: "not-found", playerIds: [] };
  assert.equal(alreadyNotified(undefined, nf), false);
  assert.equal(alreadyNotified({ status: "not-found", notified: true }, nf), true);
  assert.equal(alreadyNotified({ status: "not-found", notified: false }, nf), false);
  assert.equal(alreadyNotified({ status: "matched", notified: false }, nf), false);
  assert.equal(alreadyNotified({ status: "not-found", notified: true }, { status: "matched", playerIds: ["p1"] }), false);
});

test("owner message carries name and phone on its first line (the template parameter)", () => {
  const first = ownerText({ name: "גולש", phone: "050-1234567" }).split("\n")[0];
  assert.match(first, /גולש/);
  assert.match(first, /050-1234567/);
});
