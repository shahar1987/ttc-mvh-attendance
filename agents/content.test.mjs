import { test } from "node:test";
import assert from "node:assert/strict";
import { tidy, weekSlots, localPhone, draft, IG_TAGS, CREDIT } from "./content.mjs";

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

test("tidy: model-written closing without a phone is replaced, default phone is the club's", () => {
  const { facebook } = tidy("בואו 🏓\n\nאימון ניסיון חינם לכולם, בכל מועד! לפרטים והצטרפות: \n" + CREDIT);
  assert.equal(facebook.match(/אימון ניסיון חינם/g).length, 1);
  assert.match(facebook, /לפרטים והצטרפות: 050-4999149\n/);
  assert.equal(facebook.split(CREDIT).length, 2);
});

test("draft: training only from tomorrow's schedule, no AI image, Korazim tags only for Korazim", () => {
  const [sun, tue, wed] = weekSlots("2026-10-11");
  const a = draft(sun, { topic: "x", text: "מחר", training: 1, image: "תמונת AI" });
  assert.equal(a.training, "מחר (שני): מתחילים ברמת כורזים 16:30-18:00");
  assert.equal(a.image, "פלייר מהתבנית בלי תמונה");
  assert.match(a.instagram, /@kiryat8 @galil\.elion$/);
  const b = draft(wed, { topic: "x", text: "מחר", training: 1, image: "תמונה אמיתית מהאימון" });
  assert.equal(b.training, "מחר (חמישי): מתחילים בשאר ישוב 16:30-17:30");
  assert.match(b.image, /אמיתית/);
  assert.ok(b.instagram.endsWith(IG_TAGS));
  assert.equal(draft(tue, { topic: "x", training: 99 }).training, "מחר (רביעי): מתחילים ברמת כורזים 16:30-18:00", "מספר לא קיים → הראשון");
});
