// התור של התראות מדף הניהול (scripts/push_queue.mjs) — בלי רשת.
import { test } from "node:test";
import assert from "node:assert/strict";
import { plan, MAX_PER_RUN, BOARD_OWNER_HASH } from "../scripts/push_queue.mjs";

const now = Date.parse("2026-10-20T18:00:00Z");
const at = (h) => new Date(now - h * 36e5);

test("sends only pending requests, oldest first, at most MAX_PER_RUN", () => {
  const reqs = [
    { id: "a", createdAt: at(1) }, { id: "b", createdAt: at(3) }, { id: "c", createdAt: at(2) },
    { id: "d", createdAt: at(0.5) }, { id: "done", createdAt: at(4), sentAt: at(3) },
  ];
  const { send, expire } = plan(reqs, now);
  assert.deepEqual(send.map((r) => r.id), ["b", "c", "a"].slice(0, MAX_PER_RUN));
  assert.equal(expire.length, 0);
});

test("a request older than a day is expired, never sent", () => {
  const { send, expire } = plan([{ id: "old", createdAt: at(30) }, { id: "x", createdAt: at(30), expiredAt: at(1) }], now);
  assert.deepEqual(send, []);
  assert.deepEqual(expire.map((r) => r.id), ["old"]);
});

test("owner hash is a sha256 hex, not an email", () => {
  assert.match(BOARD_OWNER_HASH, /^[0-9a-f]{64}$/);
});
