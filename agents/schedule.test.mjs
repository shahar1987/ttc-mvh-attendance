import { test } from "node:test";
import assert from "node:assert/strict";
import { scheduleProblems, lastWeeklyDue, alreadyToldOwner } from "./lib/schedule.mjs";

// 2026-10-05 is a Monday; Israel is UTC+3 (summer time) on these dates
const at = (iso) => new Date(iso);
const fresh = (now) => ({
  scan: { at: now }, bugcheck: { at: now }, ideas: { at: "2026-10-04T06:05:00Z" }, content: { at: "2026-10-04T06:06:00Z" },
});

test("all ran on time -> no problems", () => {
  assert.deepEqual(scheduleProblems(fresh("2026-10-05T05:10:00Z"), {}, at("2026-10-05T14:00:00Z")), []);
});

test("scan: alert only after 16:00 Israel and only when there is no scan from today", () => {
  const h = { ...fresh("2026-10-05T05:00:00Z"), scan: { at: "2026-10-04T05:10:00Z" } };
  assert.deepEqual(scheduleProblems(h, {}, at("2026-10-05T12:59:00Z")), [], "15:59 Israel — still waiting (GitHub can be hours late)");
  assert.deepEqual(scheduleProblems(h, {}, at("2026-10-05T13:00:00Z")), ["הסורק היומי לא רץ היום"]);
  // a late scan at 13:00 Israel counts
  assert.deepEqual(scheduleProblems({ ...h, scan: { at: "2026-10-05T10:00:00Z" } }, {}, at("2026-10-05T17:00:00Z")), []);
});

test("weekly agents: checked only after Sunday noon, and not when they never ran", () => {
  const base = { scan: { at: "2026-10-04T05:00:00Z" }, bugcheck: { at: "2026-10-04T00:40:00Z" } };
  // Sunday 10:00 Israel — not due yet this week; last week's runs exist
  const lastWeek = { ...base, ideas: { at: "2026-09-27T06:00:00Z" }, content: { at: "2026-09-27T06:00:00Z" } };
  assert.equal(lastWeeklyDue(at("2026-10-04T07:00:00Z")), "2026-09-27");
  assert.deepEqual(scheduleProblems(lastWeek, {}, at("2026-10-04T07:00:00Z")), []);
  // Sunday 12:30 Israel — due today, didn't run
  assert.deepEqual(scheduleProblems(lastWeek, {}, at("2026-10-04T09:30:00Z")), ["סוכן הרעיונות לא רץ השבוע", "סוכן הפרסום לא רץ השבוע"]);
  // never ran at all (no heartbeat) -> NOT reported (first Sunday after release)
  assert.deepEqual(scheduleProblems({ ...base, bugcheck: { at: "2026-10-05T00:40:00Z" } }, {}, at("2026-10-05T09:00:00Z")), []);
});

test("weekly agent that reported a missing key itself is not reported again (one message a week)", () => {
  const base = { scan: { at: "2026-10-05T05:00:00Z" }, bugcheck: { at: "2026-10-05T00:40:00Z" } };
  const now = at("2026-10-05T14:00:00Z");
  // never succeeded, reported missing key on Sunday
  assert.deepEqual(scheduleProblems({ ...base, ideas: { missingKey: "ANTHROPIC_API_KEY", missingKeyAt: "2026-10-04T06:01:00Z" } }, {}, now), []);
  // succeeded once long ago, missing key this Sunday
  assert.deepEqual(scheduleProblems({ ...base, ideas: { at: "2026-09-20T06:00:00Z", missingKeyAt: "2026-10-04T06:01:00Z" } }, {}, now), []);
  // key fixed later and it ran, then stale again with an old missing-key mark -> reported
  assert.deepEqual(
    scheduleProblems({ ...base, ideas: { at: "2026-09-27T06:00:00Z", missingKeyAt: "2026-09-20T06:01:00Z" }, content: { at: "2026-10-04T06:00:00Z" } }, {}, now),
    ["סוכן הרעיונות לא רץ השבוע"],
  );
});

test("alreadyToldOwner: skip the workflow alert only when every failed step is an agent that reported a missing key", () => {
  const now = at("2026-10-04T06:10:00Z");
  const health = { ideas: { missingKeyAt: "2026-10-04T06:01:00Z" } };
  assert.equal(alreadyToldOwner({ install: { outcome: "success" }, ideas: { outcome: "failure" }, content: { outcome: "success" } }, health, now), true);
  assert.equal(alreadyToldOwner({ ideas: { outcome: "failure" }, content: { outcome: "failure" } }, health, now), false);
  assert.equal(alreadyToldOwner({ ideas: { outcome: "failure" } }, health, at("2026-10-04T09:10:00Z")), false, "old mark");
  assert.equal(alreadyToldOwner({}, health, now), false);
});

test("bot cron error: only a recurring error (seen fresh by two supervisor runs) is reported", () => {
  const h = fresh("2026-10-05T05:10:00Z");
  const now = at("2026-10-05T14:00:00Z");
  const err = { lastCronError: { at: "2026-10-05T13:45:00Z", message: "boom" } };
  const MSG = "משימה מתוזמנת של הבוט נכשלת שוב ושוב (הפרטים ב-agentReports/bot.lastCronError)";
  assert.deepEqual(scheduleProblems(h, err, now), [], "first sighting");
  assert.deepEqual(scheduleProblems({ ...h, supervisor: { cronErrorAt: "2026-10-05T13:45:00Z" } }, err, now), [], "same one-off error");
  assert.deepEqual(scheduleProblems({ ...h, supervisor: { cronErrorAt: "2026-10-05T12:45:00Z" } }, err, now), [MSG], "failed again");
  assert.deepEqual(scheduleProblems({ ...h, supervisor: { cronErrorAt: "2026-10-05T09:00:00Z" } }, err, now), [], "previous one too old");
  assert.deepEqual(scheduleProblems({ ...h, supervisor: { cronErrorAt: "2026-10-05T11:00:00Z" } }, { lastCronError: { at: "2026-10-05T12:00:00Z" } }, now), [], "stale now");
});
