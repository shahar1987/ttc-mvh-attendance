// דשבורד הפרסום: קישור חתום בלבד, טקסט של פוסט לא מוזרק ל-HTML, מספר לא ידוע הוא "לא זמין", ואזהרה כשהנתונים ישנים
import assert from "node:assert/strict";
import { change, compare, dailyDashboard, dashboardHtml, dashboardRoute, dashboardUrl, PERIODS } from "../src/dashboard.js";

const NOW = new Date("2026-10-14T19:00:00Z");
const insights = {
  updatedAt: "2026-10-14T05:16:00Z",
  followers: { facebook: 584, instagram: null },
  scheduled: [{ at: "2026-10-15T09:00:00Z", text: "קבוצות הבוגרים" }, { at: "2026-10-01T09:00:00Z", text: "פוסט-ישן" }],
  posts: [
    { platform: "facebook", at: "2026-10-12T09:00:00Z", type: "photo", text: "<script>alert(1)</script>", reach: 1173 },
    { platform: "facebook", at: "2026-10-11T09:00:00Z", type: "video", text: "ריל", reach: null },
    { platform: "instagram", at: "2026-10-11T17:00:00Z", type: "video", text: "קו האימונים", reach: 125 },
  ],
};
const html = dashboardHtml(insights, { text: "פוסט לאישור", platform: "both", at: "2026-10-14T18:00:00Z" }, NOW);
assert.ok(!html.includes("<script>alert"), "טקסט פוסט עובר escape");
assert.match(html, /&lt;script&gt;/);
assert.match(html, /החיבור למטא עובד/);
assert.match(html, /לא זמין/, "עוקבי אינסטגרם לא ידועים");
assert.match(html, /קבוצות הבוגרים/);
assert.ok(!html.includes("פוסט-ישן"), "פוסט מתוזמן שכבר עבר לא מוצג");
assert.match(html, /מחכה ל"כן" שלך/);
assert.match(html, /1,173/);

const stale = dashboardHtml({ ...insights, updatedAt: "2026-10-12T05:00:00Z" }, null, NOW);
assert.match(stale, /לא מעדכן/, "יותר מ-36 שעות בלי עדכון = אזהרה");
const reconnect = dashboardHtml({ ...insights, reconnectToldAt: "2026-10-14T06:00:00Z" }, null, NOW);
assert.match(reconnect, /תחברי מחדש את פייסבוק/);
assert.match(dashboardHtml({}, null, NOW), /עוד לא נאספו נתונים/);

const env = { META_APP_SECRET: "s" };
const store = { get: async (p) => (p === "agentReports/insights" ? insights : {}) };
assert.equal((await dashboardRoute(new Request("https://w/dashboard?t=bad"), env, store)).status, 403, "בלי חתימה — אסור");
const ok = await dashboardRoute(new Request(await dashboardUrl(env, "https://w")), env, store);
assert.equal(ok.status, 200);
assert.match(await ok.text(), /דשבורד פרסום/);
// קישור יומי: נשלח פעם אחת לכל עדכון של הנתונים, ולא נרשם כשהשליחה נכשלה
const docs = { "agentReports/insights": { updatedAt: "2026-10-20T05:09:00Z" }, "agentReports/bot": {} };
const mem = { get: async (p) => docs[p], merge: async (p, v) => (docs[p] = { ...docs[p], ...v }) };
const sent = [];
assert.equal(await dailyDashboard(env, mem, "https://w", async (t) => { throw new Error("wa down"); }).catch(() => "failed"), "failed");
assert.equal(docs["agentReports/bot"].dashboardSentFor, undefined);
assert.equal(await dailyDashboard(env, mem, "https://w", async (t) => sent.push(t)), "dashboard: sent");
assert.match(sent[0], /https:\/\/w\/dashboard\?t=/);
assert.equal(await dailyDashboard(env, mem, "https://w", async (t) => sent.push(t)), "dashboard: nothing new");
assert.equal(sent.length, 1);

// השוואות: שבוע מול שבוע, חודש מול חודש, ומול שנה שעברה. חסר = לא זמין, לא 0
const days = (from, n, v) => Object.fromEntries(Array.from({ length: n }, (_, i) => [new Date(from - i * 864e5).toISOString().slice(0, 10), v]));
const T = NOW.getTime();
const rich = {
  updatedAt: NOW.toISOString(),
  history: [
    { p: "f", at: "2026-10-13T09:00:00Z", e: null }, { p: "i", at: "2026-10-12T09:00:00Z", e: 30 }, { p: "i", at: "2026-10-10T09:00:00Z", e: 10 },
    { p: "i", at: "2026-10-05T09:00:00Z", e: 10 },
  ],
  series: { fbReach: { ...days(T - 864e5, 7, 100), ...days(T - 8 * 864e5, 7, 50) } },
  followersLog: { "2026-10-07": { facebook: 580, instagram: 90 }, "2026-10-13": { facebook: 584, instagram: 93 } },
};
const wk = compare(rich, PERIODS[0], NOW);
const r = Object.fromEntries(wk.map((x) => [x.name, [x.now, x.before]]));
assert.deepEqual(r["פוסטים שעלו"], [3, 1]);
assert.deepEqual(r["חשיפה בפייסבוק"], [700, 350]);
assert.deepEqual(r["חשיפה באינסטגרם"], [null, null], "אין סדרה — לא זמין");
assert.deepEqual(r["לייקים ותגובות בפייסבוק"], [null, 0], "חסר לייק אחד — כל השבוע לא ידוע");
assert.deepEqual(r["לייקים ותגובות באינסטגרם"], [40, 10]);
assert.deepEqual(r["עוקבים חדשים באינסטגרם"], [3, null]);
assert.deepEqual(r["מעורבות לפוסט באינסטגרם"], [20, 10]);
assert.equal(compare(rich, PERIODS[2], NOW)[0].now, 4);
assert.equal(compare(rich, PERIODS[2], NOW)[1].before, null, "לפני שנה בלי נתונים");
assert.deepEqual(change(700, 350), { pct: 100, dir: "up" });
assert.deepEqual(change(5, 10), { pct: -50, dir: "down" });
assert.deepEqual(change(3, 0), { pct: null, dir: "up" });
assert.equal(change(null, 3), null);
assert.equal(compare({}, PERIODS[1], NOW)[0].now, null, "לפני האיסוף הראשון — לא זמין, לא 0");
const page = dashboardHtml({ ...insights, ...rich, gaps: { fbReach: "permission", igReach: "permission", fbLikes: "permission" } }, null, NOW);
assert.match(page, /השבוע מול שבוע שעבר/);
assert.match(page, /▲ 100%/);
assert.match(page, /read_insights/);
assert.match(page, /instagram_manage_insights/);
assert.match(page, /חיבור קבוע לפייסבוק/);
assert.ok(!dashboardHtml(insights, null, NOW).includes("מה חסר ולמה"), "בלי חוסרים — בלי הקטע");
console.log("dashboard ok");

// 📥 feed מהמשימה הלילית: רק עם המפתח, רק מספרים, ומשלים את מה שחסר
{
  const { feedRoute, withFeed, cleanFeed } = await import("../src/dashboard.js");
  const { sha256 } = await import("../src/inbox.js");
  const fenv = { FEED_KEY_SHA256: await sha256("sekret") };
  const saved = {};
  const fstore = { merge: async (p, v) => (saved[p] = v) };
  const body = { series: { igReach: { "2026-10-12": 115, "bad": 3, "2026-10-13": "x" } }, reach: { "i1": 1, "18076168262738598": 34 }, eng: { "129_152": { likes: 3, comments: 1 } }, fbHistory: [{ at: "2026-10-01T00:00:00Z", e: 4 }, { at: "nope", e: 1 }] };
  assert.equal((await feedRoute(new Request("https://w/insights/feed?k=bad", { method: "POST", body: "{}" }), fenv, fstore)).status, 403);
  assert.equal((await feedRoute(new Request("https://w/insights/feed?k=sekret", { method: "POST", body: JSON.stringify(body) }), fenv, fstore)).status, 200);
  const f = saved["agentReports/insightsFeed"];
  assert.deepEqual(f.series, { igReach: { "2026-10-12": 115 } }, "רק תאריכים ומספרים");
  assert.deepEqual(f.reach, { "18076168262738598": 34 });
  assert.equal(f.fbHistory.length, 1);
  const merged = withFeed({ posts: [{ platform: "instagram", id: "18076168262738598", reach: null }, { platform: "facebook", id: "129_152", reach: null, likes: null }], gaps: { igReach: "permission", fbLikes: "permission", fbReach: "permission" } }, f);
  assert.equal(merged.posts[0].reach, 34);
  assert.equal(merged.posts[1].likes, 3);
  assert.deepEqual(merged.gaps, { fbReach: "permission" }, "מה שהושלם יוצא מהרשימה");
  assert.deepEqual(cleanFeed({}).series, {});
  const noNA = dashboardHtml({ ...insights, followers: { facebook: 584, instagram: null } }, null, NOW);
  assert.ok(!noNA.includes("לא זמין</span>"), "כרטיס בלי מספר לא מוצג");
}
console.log("feed ok");
{
  const { trends } = await import("../src/dashboard.js");
  const N = new Date("2026-10-24T05:00:00Z");
  const fbReach = {};
  for (let i = 0; i < 365; i++) fbReach[new Date(N - i * 864e5).toISOString().slice(0, 10)] = 10;
  const t = trends({ series: { fbReach }, history: [] }, N);
  assert.equal(t.months.length, 12);
  assert.equal(t.months[11].key, "2026-10");
  assert.deepEqual(t.rows.map((r) => r[0]), ["חשיפה בפייסבוק"], "מדד בלי מספיק חודשים לא מוצג");
  assert.match(dashboardHtml({ ...insights, series: { fbReach } }, null, N), /מגמה שנתית/);
}
console.log("trends ok");
{
  const { changeLabel, trendChange, trends } = await import("../src/dashboard.js");
  assert.match(changeLabel(10, 1), /▲ פי 10/, "בסיס קטן — פי X, לא 900%");
  assert.match(changeLabel(147, 1), /▲ פי 147/);
  assert.match(changeLabel(3, 6), /▼ פי 2/);
  assert.match(changeLabel(15, 10), /▲ 50%/);
  assert.match(changeLabel(5, 0), /חדש/);
  assert.match(changeLabel(0, 4), /▼ 100%/);
  // חודש חלקי: אוקטובר עם 24 ימים לא נראה כירידה כשהממוצע היומי זהה
  const N = new Date("2026-10-24T05:00:00Z");
  const fbReach = {};
  for (let i = 0; i < 365; i++) fbReach[new Date(N - i * 864e5).toISOString().slice(0, 10)] = 10;
  const t = trends({ series: { fbReach } }, N);
  assert.equal(t.months[11].partial, true);
  assert.equal(t.months[11].days, 24);
  const c = trendChange(t.rows[0][1], t.months);
  assert.ok(Math.abs(c.now - c.before) < 0.01, "ממוצע יומי זהה = יציב");
  // חודש לפי שעון ישראל: פוסט ב-31.1 בשעה 23:30 UTC שייך לפברואר
  const h = trends({ history: Array.from({ length: 12 }, (_, i) => ({ p: "f", at: new Date(Date.UTC(2025, 10 + i, 10)).toISOString(), e: 1 })).concat([{ p: "f", at: "2026-01-31T23:30:00Z", e: 1 }]) }, N);
  const posts = h.rows.find((r) => r[0] === "פוסטים שעלו")[1];
  assert.equal(posts[2], 1, "ינואר");
  assert.equal(posts[3], 2, "פברואר כולל הפוסט של 1.2 בלילה");
  const html = dashboardHtml({ ...insights, series: { fbReach } }, null, N);
  assert.match(html, /24 ימים/, "החודש החלקי מסומן");
}
console.log("fixes ok");
{
  const { campaignRoute, cleanDrafts, goalProgress } = await import("../src/dashboard.js");
  const { sha256 } = await import("../src/inbox.js");
  const cenv = { FEED_KEY_SHA256: await sha256("sekret") };
  const docs = { "agentReports/bot": { outbox: {} } };
  const cs = { get: async (p) => docs[p], merge: async (p, v) => (docs[p] = { ...docs[p], ...v }), update: async (p, fn) => (docs[p] = { ...docs[p], ...fn(docs[p] || {}) }) };
  const sentWa = [];
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (u, o) => (sentWa.push(String(u)), new Response("{}"));
  const good = { at: "2026-10-26T17:00", kind: "post", topic: "בואו לעקוב", facebook: "טקסט", instagram: "טקסט @x", image: "https://drive.google.com/uc?export=download&id=abc" };
  assert.equal((await campaignRoute(new Request("https://w/insights/campaign?k=no", { method: "POST", body: "{}" }), cenv, cs, {})).status, 403);
  const r = await campaignRoute(new Request("https://w/insights/campaign?k=sekret", { method: "POST", body: JSON.stringify({ drafts: [good, { ...good, image: "javascript:x" }], notify: "דוח שבועי" }) }), cenv, cs, { token: "t", phoneId: "p", owner: "o" });
  globalThis.fetch = origFetch;
  assert.deepEqual(await r.json(), { ok: true, drafts: 1, notified: true }, "טיוטה בלי תמונה/סרטון תקינים נזרקת");
  assert.equal(docs["agentReports/content"].by, "claude");
  assert.equal(docs["agentReports/bot"].outbox.content.text, "דוח שבועי");
  assert.equal(cleanDrafts([{ ...good, at: "מחר" }]).length, 0);
  const N = new Date("2026-10-24T05:00:00Z");
  const fbFollows = {};
  for (let i = 1; i <= 7; i++) fbFollows[new Date(N - i * 864e5).toISOString().slice(0, 10)] = 1;
  assert.deepEqual(goalProgress({ series: { fbFollows } }, N), [["פייסבוק", 7]]);
  assert.match(dashboardHtml({ ...insights, series: { fbFollows } }, null, N), /\+7 \/ 5 ✅/);
}
console.log("campaign ok");
