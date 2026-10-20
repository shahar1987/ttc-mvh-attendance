// ניקוי הקלט של התראות הדחיפה (scripts/send_push.mjs) — בלי רשת.
import { test } from "node:test";
import assert from "node:assert/strict";
import { pushInput, boardUrl, BOARD_URL } from "../scripts/send_push.mjs";

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

test("url only under the club board (origin + normalised path, ≤300), otherwise the board itself", () => {
  assert.equal(pushInput({ title: "x", url: BOARD_URL + "#games" }).url, BOARD_URL + "#games");
  assert.equal(boardUrl(BOARD_URL + "games/?a=1"), BOARD_URL + "games/?a=1");
  for (const bad of [
    "https://evil.example/", "http://shahar1987.github.io/ttc-club-board/", "https://shahar1987.github.io/ttc-club-board.evil/",
    "https://shahar1987.github.io.evil.example/ttc-club-board/", "https://shahar1987.github.io/ttc-club-board/../other-repo/",
    "https://shahar1987.github.io/ttc-club-board/%2e%2e/other-repo/", "https://user@shahar1987.github.io.evil/ttc-club-board/",
    "https://shahar1987.github.io/other/", "javascript:alert(1)", "not a url", undefined, BOARD_URL + "a".repeat(300),
  ])
    assert.equal(boardUrl(bad), BOARD_URL, String(bad));
});
