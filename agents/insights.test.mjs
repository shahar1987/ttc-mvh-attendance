import { test } from "node:test";
import assert from "node:assert/strict";
import { collect, account, weeklyReport, tokenDead, shouldRemind } from "./insights.mjs";

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

test("tokenDead: a revoked Meta token means reconnect, other errors do not", () => {
  assert.equal(tokenDead(Object.assign(new Error("Error validating access token: The session has been invalidated"), { code: 190 })), true);
  assert.equal(tokenDead(new Error("Error validating access token")), true);
  assert.equal(tokenDead(Object.assign(new Error("metric deprecated"), { code: 100 })), false);
});

test("collect: without pages_read_user_content, FB drops likes/comments (unknown, not 0); if FB fails entirely IG still comes through", async () => {
  const noUserContent = async (u) => {
    if (u.includes("/pg/posts") && /reactions|comments/.test(u)) throw Object.assign(new Error("(#10) requires pages_read_user_content"), { code: 10 });
    if (u.includes("/pg/posts")) return { data: [{ id: "f1", created_time: "2026-10-08T14:00:00+0000", shares: { count: 2 } }] };
    if (u.includes("/ig/media")) return { data: [] };
    throw new Error("unexpected " + u);
  };
  const a = await collect({ id: "pg", ig: "ig", token: "t" }, NOW, noUserContent);
  assert.deepEqual(a.map((p) => [p.platform, p.likes, p.comments, p.shares]), [["facebook", null, null, 2]]);

  const fbDown = async (u) => {
    if (u.includes("/pg/")) throw Object.assign(new Error("(#10) no access"), { code: 10 });
    if (u.includes("/ig/media")) return { data: [{ id: "i1", timestamp: "2026-10-09T15:00:00+0000", like_count: 3 }] };
    return { data: [] };
  };
  const b = await collect({ id: "pg", ig: "ig", token: "t" }, NOW, fbDown);
  assert.deepEqual(b.map((p) => p.platform), ["instagram"]);

  const dead = async () => { throw Object.assign(new Error("Error validating access token"), { code: 190 }); };
  await assert.rejects(collect({ id: "pg", ig: "ig", token: "t" }, NOW, dead), /access token/);
});

test("clubPage: picks the club by id/IG even when Cortado (with its own Instagram) comes first; never falls back to another page", async () => {
  const { clubPage } = await import("./lib/club.mjs");
  const cortado = { id: "1320814337776686", igName: "cortado_snir", ig: "c", token: "c" };
  const club = { id: "129474751033574", igName: "ttcmhr", ig: "k", token: "k" };
  assert.equal(clubPage({ pages: [cortado, club] }), club);
  assert.equal(clubPage({ pages: [club, cortado] }), club);
  assert.equal(clubPage({ pages: [cortado] }), null, "רק קורטדו מחובר — לא נוגעים בו");
  assert.equal(clubPage({}), null);
});

test("Meta problems don't fail the run: IG error is skipped, reconnect reminder at most every 3 days", async () => {
  const igDown = async (u) => {
    if (u.includes("/pg/")) return { data: [] };
    throw Object.assign(new Error("(#10) ig permission"), { code: 10 });
  };
  assert.deepEqual(await collect({ id: "pg", ig: "ig", token: "t" }, NOW, igDown), []);
  assert.equal(shouldRemind(undefined, NOW), true);
  assert.equal(shouldRemind("2026-10-10T06:00:00Z", NOW), false, "יום אחרי — לא שוב");
  assert.equal(shouldRemind("2026-10-08T06:00:00Z", NOW), true, "אחרי 3 ימים — מזכירים");
});

test("account: followers + FB scheduled posts, read-only; a missing field is null, a dead token throws", async () => {
  const urls = [];
  const get = async (u) => {
    urls.push(u);
    if (u.includes("/pg?fields=followers_count")) return { followers_count: 584 };
    if (u.includes("/ig?fields=followers_count")) throw Object.assign(new Error("no permission"), { code: 10 });
    if (u.includes("/pg/scheduled_posts")) return { data: [{ message: "ב", scheduled_publish_time: "1792400000" }, { message: "א", scheduled_publish_time: "1792300000" }] };
    throw new Error("unexpected " + u);
  };
  const a = await account({ id: "pg", ig: "ig", token: "t" }, get);
  assert.deepEqual(a.followers, { facebook: 584, instagram: null });
  assert.deepEqual(a.scheduled.map((s) => s.text), ["א", "ב"], "לפי הסדר");
  assert.ok(urls.every((u) => !u.includes("publish?") && !u.includes("/feed")), "קריאה בלבד");
  const dead = async () => { throw Object.assign(new Error("Error validating access token"), { code: 190 }); };
  await assert.rejects(account({ id: "pg", token: "t" }, dead));
});

test("reach: new Meta metric first; missing permission is recorded as the reason", async () => {
  const { gapReason } = await import("./insights.mjs");
  const gaps = {};
  const get = async (u) => {
    if (u.includes("insights.metric")) throw Object.assign(new Error("(#10) requires read_insights"), { code: 10 });
    if (u.includes("/pg/posts")) return { data: [{ id: "f1", created_time: "2026-10-08T14:00:00+0000" }] };
    if (u.includes("/ig/media")) return { data: [{ id: "i1", timestamp: "2026-10-09T15:00:00+0000", like_count: 1 }] };
    if (u.includes("/insights?metric=")) throw Object.assign(new Error("(#10) instagram_manage_insights"), { code: 10 });
    throw new Error("unexpected " + u);
  };
  const urls = [];
  await collect({ id: "pg", ig: "ig", token: "t" }, NOW, async (u) => (urls.push(u), get(u)), gaps);
  assert.ok(urls[0].includes("post_total_media_view_unique"), "המדד החדש קודם");
  assert.deepEqual(gaps, { fbReach: "permission", fbLikes: "permission", igReach: "permission" });
  assert.equal(gapReason(Object.assign(new Error("(#100) invalid metric"), { code: 100 })), "metric");
});

test("history pages back a year+, trends split into windows, followers log keeps one snapshot a day", async () => {
  const { history, trends, logFollowers } = await import("./insights.mjs");
  const get = async (u) => {
    if (u.includes("/pg/posts") && !u.includes("p2")) return { data: [{ created_time: "2026-10-01T10:00:00+0000", reactions: { summary: { total_count: 5 } }, comments: { summary: { total_count: 1 } } }], paging: { next: "https://x/pg/posts?p2" } };
    if (u.includes("p2")) return { data: [{ created_time: "2025-10-05T10:00:00+0000", reactions: { summary: { total_count: 2 } }, comments: { summary: { total_count: 0 } }, shares: { count: 1 } }] };
    if (u.includes("/ig/media")) return { data: [{ timestamp: "2026-10-02T10:00:00+0000", like_count: 7, comments_count: 1 }, { timestamp: "2024-01-01T00:00:00+0000", like_count: 99 }] };
    if (u.includes("/pg/insights") && u.includes("page_total_media_view_unique")) return { data: [{ values: [{ value: 40, end_time: "2026-10-10T07:00:00+0000" }] }] };
    if (u.includes("/pg/insights")) throw Object.assign(new Error("(#100) invalid metric"), { code: 100 });
    if (u.includes("/ig/insights")) throw Object.assign(new Error("(#10) instagram_manage_insights"), { code: 10 });
    throw new Error("unexpected " + u);
  };
  const gaps = {};
  const h = await history({ id: "pg", ig: "ig", token: "t" }, NOW, get, gaps);
  assert.deepEqual(h.map((x) => [x.p, x.e]), [["f", 3], ["f", 6], ["i", 8]], "פוסט מלפני 400 יום לא נכנס");
  const s = await trends({ id: "pg", ig: "ig", token: "t" }, NOW, get, gaps);
  assert.deepEqual(s.fbReach, { "2026-10-09": 40 });
  assert.deepEqual(gaps, { fbFollows: "metric", igReach: "permission" });
  const log = logFollowers({ "2023-01-01": { facebook: 1 } }, { facebook: 584, instagram: 93 }, NOW);
  assert.deepEqual(log, { "2026-10-11": { facebook: 584, instagram: 93 } }, "צילום של היום, ישנים מ-800 יום נמחקים");
  await assert.rejects(trends({ id: "pg", token: "t" }, NOW, async () => { throw Object.assign(new Error("Error validating access token"), { code: 190 }); }), /access token/);
});
