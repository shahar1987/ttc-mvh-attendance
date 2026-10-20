// ניקוי הקלט של התראות הדחיפה (scripts/send_push.mjs) — בלי רשת.
import { test } from "node:test";
import assert from "node:assert/strict";
import { pushInput, BOARD_URL } from "../scripts/send_push.mjs";

test("empty title is refused", () => {
  assert.throws(() => pushInput({ title: "   " }), /TITLE is empty/);
  assert.throws(() => pushInput({}), /TITLE is empty/);
});

test("title/body are trimmed, single-line and capped at 60/180", () => {
  const r = pushInput({ title: "  משחק\nהערב  " + "א".repeat(100), body: "ב".repeat(300) });
  assert.equal(r.title.length, 60);
  assert.ok(r.title.startsWith("משחק הערב "));
  assert.equal(r.body.length, 180);
  assert.equal(pushInput({ title: "x" }).body, "");
});

test("url only under the club board, otherwise the board itself", () => {
  assert.equal(pushInput({ title: "x", url: BOARD_URL + "#games" }).url, BOARD_URL + "#games");
  for (const bad of ["https://evil.example/", "http://shahar1987.github.io/ttc-club-board/", "https://shahar1987.github.io/ttc-club-board.evil/", "javascript:alert(1)", undefined, BOARD_URL + " x"])
    assert.equal(pushInput({ title: "x", url: bad }).url, BOARD_URL);
});
