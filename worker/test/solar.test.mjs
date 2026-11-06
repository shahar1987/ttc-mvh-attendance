import assert from "node:assert/strict";
import { adjusted, analyze, hardFault, weeklyText, solarRun, solarWatch, solarRoute, solarUrl, addDays, isoDay } from "../src/solar.js";
import { solarHtml, insights, rainWash, heatBands, monthly } from "../src/solar-dashboard.js";

const today = "2026-11-08"; // יום ראשון
const fill = (from, n, x) => Object.fromEntries(Array.from({ length: n }, (_, i) => [addDays(from, i), { ...x }]));

assert.equal(isoDay("2026-10-31T22:00:00Z"), "2026-11-01", "מסמן יום לפי שעון ישראל");
assert.equal(adjusted({ kwh: 10, rad: 2, tmax: 25 }), null, "יום מעונן לא נמדד");
assert.ok(adjusted({ kwh: 20, rad: 20, tmax: 35 }) > adjusted({ kwh: 20, rad: 20, tmax: 25 }), "חום לא נחשב תקלה");

// שבוע תקין מול 30 יום קודמים
{
  const days = { ...fill("2026-10-01", 31, { kwh: 30, rad: 15, tmax: 25 }), ...fill("2026-11-01", 7, { kwh: 30, rad: 15, tmax: 25 }) };
  const a = analyze(days, today);
  assert.equal(a.total, 210);
  assert.equal(a.vsPrev, 0);
  assert.equal(Math.round(a.ratio * 100), 100);
  assert.deepEqual(a.low, []);
  assert.deepEqual(a.missing, []);
  assert.match(weeklyText(a, [], 500), /תקין/);
}
// מחרוזת מתה: אותה שמש, 30% פחות → סימון, ויום אחד חריג נתפס
{
  const days = { ...fill("2026-10-01", 31, { kwh: 30, rad: 15, tmax: 25 }), ...fill("2026-11-01", 7, { kwh: 21, rad: 15, tmax: 25 }) };
  days["2026-11-04"].kwh = 12;
  const a = analyze(days, today);
  assert.ok(a.ratio < 0.8);
  assert.deepEqual(a.low, ["2026-11-04"]);
  assert.match(weeklyText(a, null, 500), /נמוך משמעותית/);
  assert.doesNotMatch(weeklyText(a, null, 500), /התראות ממיר/);
}
// שבוע מעונן הוא לא תקלה: פחות שמש, פחות ייצור, אותו יחס
{
  const days = { ...fill("2026-10-01", 31, { kwh: 30, rad: 15, tmax: 25 }), ...fill("2026-11-01", 7, { kwh: 18, rad: 9, tmax: 25 }) };
  assert.ok(analyze(days, today).ratio >= 0.9);
  assert.ok(analyze(days, today).vsPrev < 0);
}
assert.equal(analyze(fill("2026-11-01", 7, { kwh: 30, rad: 15, tmax: 25 }), today).ratio, null, "בלי בסיס לא שופטים");
assert.match(weeklyText(analyze({}, today), null, 30), /פג בעוד 30/);

assert.match(hardFault({}, today), /אין נתוני ייצור/);
assert.match(hardFault({ "2026-11-07": { kwh: 0, rad: 12 } }, today), /לא היה ייצור/);
assert.equal(hardFault({ "2026-11-07": { kwh: 0, rad: 1 } }, today), null, "יום חשוך לגמרי לא תקלה");
assert.equal(hardFault({ "2026-11-07": { kwh: 25, rad: 12 } }, today), null);

const fakeStore = (doc) => {
  const docs = { "agentReports/solar": doc, "agentReports/bot": {} };
  return {
    docs,
    get: async (p) => docs[p] || null,
    merge: async (p, x) => void (docs[p] = { ...docs[p], ...x }),
    update: async (p, f) => { const r = await f(docs[p] || {}); if (r) docs[p] = { ...docs[p], ...r }; return r; },
  };
};
const json = (x, status = 200) => new Response(JSON.stringify(x), { status });
const api = (log, tokenRes) => async (url, init) => {
  const u = String(url);
  log.push(u);
  if (u.endsWith("/oauth2/token")) return tokenRes(JSON.parse(init.body));
  if (u.includes("/energy?")) return json({ unit: "KWH", values: [{ timestamp: "2026-11-06T22:00:00Z", value: 25 }, { timestamp: "2026-11-05T22:00:00Z", value: null }] });
  if (u.includes("/alerts")) return json({}, 403);
  return json({ daily: { time: ["2026-11-07", "2026-11-08"], shortwave_radiation_sum: [14, 14], temperature_2m_max: [22, 22] } });
};
const at = new Date("2026-11-08T05:10:00Z");

// ריצה רגילה: אסימון מתחלף נשמר, פעמיים באותו יום לא נוגע בו, ויום ראשון שולח דוח
{
  const store = fakeStore({ refreshToken: "r1", clientId: "c", clientSecret: "s", siteId: "9", backfilled: true, connectedAt: "2026-11-01T00:00:00Z" });
  const log = [];
  const sent = [];
  globalThis.fetch = api(log, (b) => { assert.equal(b.refresh_token, "r1"); return json({ access_token: "a", refresh_token: "r2" }); });
  await solarRun(store, async (k, t) => sent.push([k, t]), at);
  const s = store.docs["agentReports/solar"];
  assert.equal(s.refreshToken, "r2");
  assert.equal(s.days["2026-11-07"].kwh, 25);
  assert.equal(s.days["2026-11-07"].rad, 14);
  assert.equal(s.days["2026-11-08"], undefined, "יום שלא נגמר לא נשמר");
  assert.equal(s.lastOkAt, at.toISOString());
  assert.deepEqual(sent.map((x) => x[0]), ["solar"]);
  assert.equal(log.filter((u) => u.includes("monitoringapi")).length, 3, "3 קרדיטים ביום");
  assert.equal(await solarRun(store, async () => assert.fail(), at), "solar: skip");
}
// אמצע שבוע בלי תקלה: שקט
{
  const store = fakeStore({ refreshToken: "r", clientId: "c", clientSecret: "s", siteId: "9", backfilled: true, connectedAt: "2026-11-01T00:00:00Z" });
  globalThis.fetch = api([], () => json({ access_token: "a" }));
  const sent = [];
  store.docs["agentReports/solar"].days = { "2026-11-08": { kwh: 20, rad: 14 } };
  await solarRun(store, async (k) => sent.push(k), new Date("2026-11-09T05:10:00Z"));
  assert.deepEqual(sent, []);
}
// אסימון שנדחה: בקשה לחבר מחדש, והשגיאה נרשמת
{
  const store = fakeStore({ refreshToken: "r", clientId: "c", clientSecret: "s", siteId: "9", backfilled: true, connectedAt: "2026-11-01T00:00:00Z" });
  globalThis.fetch = api([], () => json({ error: "invalid_grant" }, 400));
  const sent = [];
  await assert.rejects(solarRun(store, async (k, t) => sent.push(t), at));
  assert.match(sent[0], /חיבור סולארי/);
  assert.match(store.docs["agentReports/solar"].reconnectNote, /invalid_grant/);
  assert.equal(await solarRun(store, async () => assert.fail("לא מציקים שוב באותו יום"), at), "solar: skip");
}
// לא מחובר: לא נוגעים ברשת
{
  globalThis.fetch = async () => assert.fail("no network");
  assert.equal(await solarRun(fakeStore({}), async () => assert.fail(), at), "solar: skip");
}
// השומר: מתריע פעם ביום אחרי 30 שעות, ושותק אם הריצה טרייה
{
  const store = fakeStore({ refreshToken: "r", lastOkAt: "2026-11-06T05:10:00Z" });
  const sent = [];
  await solarWatch(store, async (k) => sent.push(k), at);
  await solarWatch(store, async (k) => sent.push(k), at);
  assert.deepEqual(sent, ["solar-watch"]);
  await solarWatch(fakeStore({ refreshToken: "r", lastOkAt: "2026-11-08T04:00:00Z" }), async () => assert.fail(), at);
}
// הדף: בלי מפתח תקף אין כניסה ואין שמירה
{
  const store = fakeStore({});
  assert.equal((await solarRoute(new Request("https://x.dev/solar/start?k=bad"), {}, store, null)).status, 403);
  assert.equal((await solarRoute(new Request("https://x.dev/solar/callback?code=1&external_id=bad"), {}, store, null)).status, 403);
  assert.equal(store.docs["agentReports/solar"].refreshToken, undefined);
}
// חיבור מלא: טופס → הפניה ל-SolarEdge → callback → backfill ודוח ראשון
{
  const store = fakeStore({});
  store.docs["agentReports/bot"] = { keys: { solar: { key: "abc", exp: Date.now() + 60000 } } };
  const page = await solarRoute(new Request("https://x.dev/solar/start?k=abc"), {}, store, null);
  assert.match(await page.text(), /https:\/\/x\.dev\/solar\/callback/);
  const body = new FormData();
  body.set("id", "cid");
  body.set("secret", "sec");
  const go = await solarRoute(new Request("https://x.dev/solar/start?k=abc", { method: "POST", body }), {}, store, null);
  const loc = new URL(go.headers.get("location"));
  assert.equal(loc.host, "connect.solaredge.com");
  assert.equal(loc.searchParams.get("external_id"), "abc");
  assert.equal(loc.searchParams.get("state"), "abc");
  assert.equal(loc.searchParams.get("access_duration"), "24");
  const log = [];
  globalThis.fetch = api(log, (b) => (b.grant_type === "authorization_code" ? (assert.equal(b.redirect_uri, "https://x.dev/solar/callback"), json({ access_token: "a", refresh_token: "r1" })) : json({ access_token: "a", refresh_token: "r2" })));
  const sent = [];
  const done = await solarRoute(new Request("https://x.dev/solar/callback?code=C&site_id=77&state=abc"), { META_APP_SECRET: "s" }, store, async (k) => sent.push(k));
  assert.equal(done.status, 200, await done.clone().text());
  const s = store.docs["agentReports/solar"];
  assert.equal(s.siteId, "77");
  assert.equal(s.refreshToken, "r2");
  assert.equal(log.filter((u) => u.includes("/energy?")).length, 6, "לא חורגים מ-10 קריאות בדקה");
  assert.ok(sent.includes("solar"), "הדוח הראשון יוצא מיד");
  assert.equal(s.backfilled, false);
  assert.equal(s.backfillIdx, 6);
  assert.equal(store.docs["agentReports/bot"].keys.solar, null, "הקישור נשרף");
}
// שאר השנה נמשך בשתי ריצות נוספות, ותמיד יחד עם הימים האחרונים. תקלה זמנית מנסה שוב, ומודיעים עליה פעם ביום
{
  const store = fakeStore({ refreshToken: "r", clientId: "c", clientSecret: "s", siteId: "9", connectedAt: "2026-11-01T00:00:00Z", backfilled: false, backfillIdx: 6, lastRunDay: "2026-11-05" });
  const log = [];
  globalThis.fetch = api(log, () => json({ access_token: "a", refresh_token: "r2" }));
  const quiet = async () => {};
  await solarRun(store, quiet, new Date("2026-11-06T05:10:00Z"));
  assert.equal(log.filter((u) => u.includes("/energy?")).length, 6, "הימים האחרונים ועוד 5 חלונות");
  assert.equal(store.docs["agentReports/solar"].backfillIdx, 11);
  store.docs["agentReports/solar"].lastRunDay = "";
  await solarRun(store, quiet, new Date("2026-11-07T05:10:00Z"));
  assert.equal(store.docs["agentReports/solar"].backfilled, true);
  assert.equal(store.docs["agentReports/solar"].backfillIdx, 13);

  let fail = true;
  const good = api([], () => json({ access_token: "a", refresh_token: "r3" }));
  globalThis.fetch = async (u, i) => (fail && String(u).includes("/energy?") ? json({ message: "API rate limit exceeded" }, 429) : good(u, i));
  const sent = [];
  const noon = new Date("2026-11-09T05:10:00Z");
  await assert.rejects(solarRun(store, async (k) => sent.push(k), noon));
  await assert.rejects(solarRun(store, async (k) => sent.push(k), new Date("2026-11-09T06:10:00Z")));
  assert.deepEqual(sent, ["solar-error"]);
  fail = false;
  assert.match(await solarRun(store, async () => {}, new Date("2026-11-09T07:10:00Z")), /ok/);
  assert.equal(store.docs["agentReports/solar"].lastError, "");
  assert.equal(await solarRun(store, async () => assert.fail(), new Date("2026-11-09T08:10:00Z")), "solar: skip");
}
// נפילה באמצע משיכת השנה: מה שנמשך נשמר
{
  const store = fakeStore({ refreshToken: "r", clientId: "c", clientSecret: "s", siteId: "9", connectedAt: "2026-11-01T00:00:00Z", backfilled: false });
  let n = 0;
  const good = api([], () => json({ access_token: "a", refresh_token: "r2" }));
  globalThis.fetch = async (u, i) => (String(u).includes("/energy?") && ++n > 2 ? json({}, 429) : good(u, i));
  await solarRun(store, async () => {}, at);
  assert.equal(store.docs["agentReports/solar"].backfillIdx, 2);
}
// 📊 הדשבורד: הצלבות, חוסר נתונים, ושום סוד לא מגיע לדף
{
  const today2 = "2026-11-08";
  const days = {};
  for (let i = 400; i >= 1; i--) days[addDays(today2, -i)] = { kwh: 30, rad: 15, tmax: 25, rain: 0 };
  for (const k of ["2026-10-25", "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31"].concat(Object.keys(days).filter((k) => k >= "2026-10-05" && k < "2026-10-25"))) days[k].kwh = 24;
  days["2026-10-20"].rain = 20;
  for (const k of Object.keys(days).filter((k) => k >= "2026-10-21")) days[k].kwh = 30;
  assert.equal(rainWash(days, "2026-11-07").at(-1).lift, 25, "גשם אחרי יובש שטף 25%");
  days["2026-08-01"].tmax = 36;
  assert.ok(heatBands(days).length >= 2);
  assert.equal(monthly(days, today2).length, 12);
  assert.equal(monthly(days, today2).at(-1).part, true);
  const v = insights({ days, openAlerts: 0, connectedAt: "2026-11-06T00:00:00Z" }, today2);
  assert.ok(v.good.some((x) => /התראות/.test(x)));
  assert.ok(v.bad.some((x) => /אחרי גשם/.test(x)), "לכלוך מסומן");
  assert.equal(v.status, "check");
  const html = solarHtml({ days, refreshToken: "TOKEN-SECRET", clientSecret: "CLIENT-SECRET", lastOkAt: "2026-11-08T05:10:00Z", connectedAt: "2026-11-06T00:00:00Z" }, today2);
  assert.ok(!/TOKEN-SECRET|CLIENT-SECRET/.test(html), "סודות לא בדף");
  assert.ok(!/NaN|undefined/.test(html.replace(/<script>[\s\S]*<\/script>/, "")), "בלי ערכים שבורים");
  const empty = solarHtml({}, today2);
  assert.match(empty, /הנתונים בדרך/);
  assert.ok(!/NaN|undefined/.test(empty.replace(/<script>[\s\S]*<\/script>/, "")));
  const env = { META_APP_SECRET: "s" };
  const store = fakeStore({ days });
  assert.equal((await solarRoute(new Request("https://x.dev/solar/dashboard?t=bad"), env, store, null)).status, 403);
  const ok = await solarRoute(new Request(await solarUrl(env, "https://x.dev")), env, store, null);
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("x-robots-tag"), "noindex");
}
console.log("solar ok");
