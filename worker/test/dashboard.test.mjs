// דשבורד הפרסום: קישור חתום בלבד, טקסט של פוסט לא מוזרק ל-HTML, מספר לא ידוע הוא "לא זמין", ואזהרה כשהנתונים ישנים
import assert from "node:assert/strict";
import { dailyDashboard, dashboardHtml, dashboardRoute, dashboardUrl } from "../src/dashboard.js";

const NOW = new Date("2026-10-14T19:00:00Z");
const insights = {
  updatedAt: "2026-10-14T05:16:00Z",
  followers: { facebook: 584, instagram: null },
  scheduled: [{ at: "2026-10-15T09:00:00Z", text: "קבוצות הבוגרים" }, { at: "2026-10-01T09:00:00Z", text: "עבר" }],
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
assert.ok(!html.includes("עבר"), "פוסט מתוזמן שכבר עבר לא מוצג");
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
console.log("dashboard ok");
