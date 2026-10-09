import { test } from "node:test";
import assert from "node:assert/strict";
import { sensitiveDay, memorialDay } from "./lib/sensitive.mjs";

test("memorial day with the legal shifts", () => {
  assert.equal(memorialDay("2024"), "2024-05-13", "ד' אייר ביום ראשון → שני");
  assert.equal(memorialDay("2025"), "2025-04-30", "ד' אייר בשישי → רביעי");
  assert.equal(memorialDay("2026"), "2026-04-21");
  assert.equal(memorialDay("2027"), "2027-05-11");
});

test("sensitive days", () => {
  assert.equal(sensitiveDay("2026-10-07"), "7 באוקטובר");
  assert.equal(sensitiveDay("2026-09-21"), "יום כיפור");
  assert.equal(sensitiveDay("2027-10-11"), "יום כיפור");
  assert.equal(sensitiveDay("2026-04-21"), "יום הזיכרון");
  assert.equal(sensitiveDay("2026-10-11"), "");
  assert.equal(sensitiveDay("2026-04-22"), "");
});
