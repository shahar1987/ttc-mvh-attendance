import { test } from "node:test";
import assert from "node:assert/strict";
import { scheduleProblems, lastWeeklyDue } from "./lib/schedule.mjs";

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

test("weekly agents: checked even with no heartbeat, but only after Sunday noon", () => {
  const base = { scan: { at: "2026-10-04T05:00:00Z" }, bugcheck: { at: "2026-10-04T00:40:00Z" } };
  // Sunday 10:00 Israel — not due yet this week; last week's runs exist
  const lastWeek = { ...base, ideas: { at: "2026-09-27T06:00:00Z" }, content: { at: "2026-09-27T06:00:00Z" } };
  assert.equal(lastWeeklyDue(at("2026-10-04T07:00:00Z")), "2026-09-27");
  assert.deepEqual(scheduleProblems(lastWeek, {}, at("2026-10-04T07:00:00Z")), []);
  // Sunday 12:30 Israel — due today, didn't run
  assert.deepEqual(scheduleProblems(lastWeek, {}, at("2026-10-04T09:30:00Z")), ["סוכן הרעיונות לא רץ השבוע", "סוכן הפרסום לא רץ השבוע"]);
  // never ran at all (no heartbeat) -> reported
  assert.ok(scheduleProblems(base, {}, at("2026-10-05T09:00:00Z")).includes("סוכן הרעיונות לא רץ השבוע"));
});

test("bot cron error from the last hour is reported, older one is not", () => {
  const h = fresh("2026-10-05T05:10:00Z");
  const now = at("2026-10-05T14:00:00Z");
  assert.deepEqual(scheduleProblems(h, { lastCronError: { at: "2026-10-05T13:30:00Z", message: "boom" } }, now), ["שגיאה במשימה מתוזמנת של הבוט: boom"]);
  assert.deepEqual(scheduleProblems(h, { lastCronError: { at: "2026-10-05T10:00:00Z", message: "boom" } }, now), []);
});
