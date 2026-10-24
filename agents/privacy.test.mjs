// שומר הפרטיות של ה-build, גם כאן: סשן שמריץ `npm test` לפני דחיפה רואה את הכישלון אצלו, לא אחרי המיזוג.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("no real phone numbers anywhere in the repo", () => {
  const r = spawnSync("bash", [new URL("../scripts/privacy-guard.sh", import.meta.url).pathname], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

// Metricool בוטל (24.10.2026) — הכל מתפרסם ישר לפייסבוק/אינסטגרם; שום קוד או הנחיה לא תלויים בו
test("no Metricool left in the repo", () => {
  const r = spawnSync("git", ["grep", "-il", "metri" + "cool", "--", ".", ":!**/node_modules/**", ":!agents/privacy.test.mjs"], { encoding: "utf8", cwd: new URL("..", import.meta.url).pathname });
  assert.equal(r.stdout.trim(), "", r.stdout);
});
