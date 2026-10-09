import { test } from "node:test";
import assert from "node:assert/strict";
import { tidy, weekSlots, localPhone, IG_TAGS, CREDIT } from "./content.mjs";

test("phone formatting", () => assert.equal(localPhone("972501234567"), "050-1234567"));

test("week slots: Sun/Tue/Wed, 7 October skipped", () => {
  assert.deepEqual(weekSlots("2026-10-11").map((s) => s.date), ["2026-10-11", "2026-10-13", "2026-10-14"]);
  assert.deepEqual(weekSlots("2026-10-04").map((s) => s.date), ["2026-10-04", "2026-10-06"]);
  assert.deepEqual(weekSlots("2026-04-19").map((s) => s.date), ["2026-04-19", "2026-04-22"], "יום הזיכרון");
});

test("tidy: no @ on Facebook, closing + credit once, tags only on Instagram", () => {
  const { facebook, instagram } = tidy("בואו לאימון @matnas.mvhr 🏓", "972501234567");
  assert.doesNotMatch(facebook, /@/);
  assert.match(facebook, /אימון ניסיון חינם לכולם, בכל מועד! לפרטים והצטרפות: 050-1234567/);
  assert.ok(facebook.endsWith(CREDIT));
  assert.equal(instagram, `${facebook}\n\n${IG_TAGS}`);
  assert.equal(tidy(facebook, "972501234567").facebook, facebook, "לא מוסיף פעמיים");
});
