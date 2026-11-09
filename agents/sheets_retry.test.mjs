import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchRetry, isTransient } from "../scripts/sheets_retry.mjs";

const seq = (...codes) => {
  const calls = [];
  globalThis.fetch = async () => { calls.push(1); return { ok: codes[calls.length - 1] === 200, status: codes[calls.length - 1] }; };
  return calls;
};

test("503 is retried until it succeeds", async () => {
  const calls = seq(503, 503, 200);
  assert.equal((await fetchRetry("u", {}, "x", [0, 0, 0])).status, 200);
  assert.equal(calls.length, 3);
});

test("403 fails at once and is not transient", async () => {
  const calls = seq(403);
  await assert.rejects(fetchRetry("u", {}, "x", [0, 0]), (e) => !isTransient(e));
  assert.equal(calls.length, 1);
});

test("503 that persists stays transient", async () => {
  seq(503, 503);
  await assert.rejects(fetchRetry("u", {}, "x", [0]), (e) => isTransient(e));
});

test("Firestore unavailable is transient, quota and bugs are not", () => {
  assert.ok(isTransient({ code: 14 }));
  assert.ok(!isTransient({ code: 8 }));
  assert.ok(!isTransient(new Error("uniformConfig/roster missing")));
});
