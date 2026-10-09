import { test } from "node:test";
import assert from "node:assert/strict";
import { collect, weeklyReport } from "./insights.mjs";

const NOW = new Date("2026-10-11T06:00:00Z");

test("collect: FB falls back when a metric is gone, IG keeps going without insights", async () => {
  const urls = [];
  const get = async (u) => {
    urls.push(u);
    if (u.includes("post_impressions_unique")) throw new Error("metric deprecated");
    if (u.includes("/pg/posts")) return { data: [{ id: "f1", message: "אימון", created_time: "2026-10-08T14:00:00+0000", reactions: { summary: { total_count: 9 } }, comments: { summary: { total_count: 2 } }, attachments: { data: [{ media_type: "photo" }] } }] };
    if (u.includes("/ig/media")) return { data: [{ id: "i1", caption: "ריל", timestamp: "2026-10-09T15:00:00+0000", media_type: "VIDEO", like_count: 20, comments_count: 1 }, { id: "old", timestamp: "2026-08-01T00:00:00+0000" }] };
    if (u.includes("/i1/insights?metric=reach,saved,shares")) throw new Error("shares unsupported");
    if (u.includes("/i1/insights")) return { data: [{ name: "reach", values: [{ value: 300 }] }, { name: "saved", values: [{ value: 4 }] }] };
    throw new Error("unexpected " + u);
  };
  const posts = await collect({ id: "pg", ig: "ig", token: "t" }, NOW, get);
  assert.deepEqual(posts.map((p) => [p.platform, p.reach, p.likes, p.saves]), [["instagram", 300, 20, 4], ["facebook", null, 9, null]]);
  assert.ok(urls.every((u) => !u.includes("/feed") && !u.includes("publish")), "קריאה בלבד");
});

test("weekly report", () => {
  const p = (at, likes, platform = "facebook", type = "photo") => ({ platform, at, likes, comments: 0, shares: 0, saves: null, reach: null, type, text: "פוסט " + likes });
  const posts = [p("2026-10-09T14:00:00Z", 30, "instagram", "video"), p("2026-10-08T14:00:00Z", 10), p("2026-09-20T14:00:00Z", 20), p("2026-09-15T09:00:00Z", 2)];
  const r = weeklyReport(posts, NOW);
  assert.match(r, /השבוע עלו 2 פוסטים \(פייסבוק 1, אינסטגרם 1\)/);
  assert.match(r, /הכי טוב: אינסטגרם.*"פוסט 30"/);
  assert.match(r, /17:00/, "שעון ישראל");
  assert.equal(weeklyReport([], NOW), "השבוע לא עלו פוסטים, אז אין מה למדוד.");
});
