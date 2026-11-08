import assert from "node:assert/strict";
import { adjusted, analyze, hardFault, weeklyText, solarRun, solarWatch, solarRoute, solarUrl, loginUrl, makeSolarTools, addDays, isoDay, skyKind } from "../src/solar.js";
import { solarHtml, insights, rainWash, heatBands, monthly, panelScan, outages, why, comparisons, forecast } from "../src/solar-dashboard.js";

const today = "2026-11-08"; // יום ראשון
const fill = (from, n, x) => Object.fromEntries(Array.from({ length: n }, (_, i) => [addDays(from, i), { ...x }]));

assert.equal(isoDay("2026-10-31T22:00:00Z"), "2026-11-01", "מסמן יום לפי שעון ישראל");
assert.equal(adjusted({ kwh: 10, rad: 2, tmax: 25 }), null, "יום מעונן לא נמדד");
assert.equal(adjusted({ kwh: 5, rad: 11, tmax: 18, rain: 9.8 }), null, "יום גשום לא נחשב תקלה בגג");
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

// משיכה ישנה של 13 חלונות ממשיכה אחורה עד 20
{
  const store = fakeStore({ refreshToken: "r", clientId: "c", clientSecret: "s", siteId: "9", backfilled: true, backfillIdx: 13, lastRunDay: "2026-11-05", connectedAt: "2026-11-01T00:00:00Z" });
  const log = [];
  globalThis.fetch = api(log, () => json({ access_token: "a", refresh_token: "r2" }));
  await solarRun(store, async () => {}, new Date("2026-11-06T05:10:00Z"));
  assert.equal(log.filter((u) => u.includes("/energy?")).length, 5, "הימים האחרונים, 3 חלונות ישנים וייצור היום");
  assert.equal(store.docs["agentReports/solar"].backfillIdx, 16);
  assert.ok(store.docs["agentReports/solar"].today, "ייצור היום גם באמצע משיכת ההיסטוריה");
}
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
  assert.equal(log.filter((u) => u.includes("monitoringapi")).length, 5, "3 קרדיטים ביום, אחד לייצור של היום, ועוד אחד לציוד ביום ראשון");
  assert.ok(s.today && s.today.day === "2026-11-08", "גם הריצה היומית מעדכנת את ייצור היום");
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
  assert.equal(log.filter((u) => u.includes("/energy?")).length, 5, "הימים האחרונים, 3 חלונות וייצור היום");
  assert.ok(log.filter((u) => u.includes("monitoringapi")).length <= 9, "מתחת ל-10 קריאות בדקה");
  assert.equal(store.docs["agentReports/solar"].backfillIdx, 9);
  for (let d = 7; d <= 13 && !store.docs["agentReports/solar"].backfilled; d++) {
    store.docs["agentReports/solar"].lastRunDay = "";
    await solarRun(store, quiet, new Date(`2026-11-${String(d).padStart(2, "0")}T05:10:00Z`));
  }
  assert.equal(store.docs["agentReports/solar"].backfilled, true);
  assert.equal(store.docs["agentReports/solar"].backfillIdx, 20, "כ-600 יום אחורה");

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
  // אחרי הריצה היומית: רק הייצור של היום, בלי הודעות
  globalThis.fetch = async (u, i) => (String(u).includes("/energy?") ? json({ unit: "KWH", values: [{ timestamp: "2026-11-08T22:00:00Z", value: 12.5 }] }) : good(u, i));
  assert.equal(await solarRun(store, async () => assert.fail(), new Date("2026-11-09T08:10:00Z")), "solar: today");
  assert.equal(store.docs["agentReports/solar"].today.kwh, 12.5);
  assert.equal(await solarRun(store, async () => assert.fail(), new Date("2026-11-09T08:40:00Z")), "solar: skip", "פעם בשעה");
  globalThis.fetch = async (u, i) => (String(u).includes("/energy?") ? json({}, 500) : good(u, i));
  assert.equal(await solarRun(store, async () => assert.fail(), new Date("2026-11-09T09:10:00Z")), "solar: today failed", "תקלה בנתון הנוחות לא מציקה");
  assert.match(store.docs["agentReports/solar"].todayError, /500/, "התקלה נשמרת כדי שהדשבורד יסביר");
  assert.equal(store.docs["agentReports/solar"].today.kwh, 12.5, "המספר הקודם נשאר");
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
// 🔎 סריקת הגג: הערכה בלבד. התקנת האפליקציה: קבצים ציבוריים בלי נתונים
{
  assert.equal(panelScan(20, 0.93).lost, 1, "7% מ-20 פאנלים זה בערך פאנל");
  assert.equal(panelScan(20, 0.97).lost, 0, "רעש קטן הוא לא פאנל");
  assert.equal(panelScan(12, 0.8).lost, 2);
  assert.equal(panelScan(null, 0.5).lost, 0, "בלי מספר פאנלים לא מנחשים");
  assert.equal(panelScan(20, null).lost, 0);
  assert.deepEqual(outages({ "2026-11-01": { kwh: 0, rad: 10 }, "2026-11-02": { kwh: 0, rad: 1 }, "2026-11-03": { kwh: 9, rad: 9 } }, "2026-11-07"), ["2026-11-01"]);
  const store = fakeStore({ days: { "2026-11-07": { kwh: 20, rad: 14, tmax: 22 } }, refreshToken: "TOKEN-SECRET" });
  const m = await solarRoute(new Request("https://x.dev/solar/manifest.webmanifest"), {}, store, null);
  const j = await m.json();
  assert.equal(j.start_url, "/solar/dashboard");
  assert.equal(j.display, "standalone");
  assert.ok(!JSON.stringify(j).includes("kWh"));
  for (const n of [192, 512]) {
    const png = new Uint8Array(await (await solarRoute(new Request(`https://x.dev/solar/icon-${n}.png`), {}, store, null)).arrayBuffer());
    assert.equal(png[1], 0x50, "PNG אמיתי");
  }
  const log = [];
  const run = fakeStore({ refreshToken: "r", clientId: "c", clientSecret: "s", siteId: "9", backfilled: true, archived: true, connectedAt: "2026-11-01T00:00:00Z" });
  const base = api(log, () => json({ access_token: "a", refresh_token: "r2" }));
  globalThis.fetch = async (u, i) => (String(u).includes("/devices") ? (log.push(String(u)), json([{ type: "INVERTER" }, ...Array(14).fill({ type: "OPTIMIZER" })])) : base(u, i));
  await solarRun(run, async () => {}, new Date("2026-11-08T05:10:00Z"));
  assert.equal(run.docs["agentReports/solar"].panels, 14);
  assert.equal(run.docs["agentReports/solar"].inverters, 1);
  assert.ok(log.some((u) => u.includes("types=OPTIMIZER")));
}
// 🌤️ למה הייצור השתנה, השוואות וצפי
{
  assert.match(why(-20, -18), /בגלל מזג האוויר/);
  assert.match(why(-20, 0), /לא מזג האוויר/);
  assert.match(why(-30, -10), /רק חלק/);
  assert.match(why(-5, -20), /התמודד טוב/);
  assert.match(why(15, 14), /בזכות מזג האוויר/);
  assert.match(why(15, 0), /עבד טוב יותר/);
  assert.match(why(2, -20), /אותו דבר/);
  assert.equal(why(null, 5), "");
  const today2 = "2026-11-16";
  const days = {};
  for (let i = 400; i >= 1; i--) days[addDays(today2, -i)] = { kwh: 20, rad: 10, tmax: 25 };
  for (let i = 1; i <= 15; i++) days[addDays(today2, -i)] = { kwh: 16, rad: 8, tmax: 25 };
  const rows = comparisons(days, today2);
  assert.deepEqual(rows.map((r) => r.pct).slice(0, 3), [0, -20, -20]);
  assert.match(rows[2].why, /בגלל מזג האוויר/);
  const f = forecast(days, today2);
  assert.equal(f.done, 240);
  assert.equal(f.target, 600);
  assert.equal(f.end, 480);
  assert.equal(f.onTrack, false);
  const noHistory = forecast({ "2026-11-14": { kwh: 10 }, "2026-11-13": { kwh: 10 }, "2026-11-12": { kwh: 10 }, "2026-11-11": { kwh: 10 }, "2026-11-10": { kwh: 10 } }, "2026-11-15");
  assert.equal(noHistory.target, null);
  assert.equal(noHistory.end, 50 + 16 * 10);
  const html = solarHtml({ days, today: { day: today2, kwh: 7.4, at: "2026-11-16T09:10:00Z" } }, today2);
  assert.match(html, /היום עד עכשיו/);
  assert.match(html, /מאחורי הקצב/);
  assert.ok(!/ממתין/.test(html));
  const warn = solarHtml({ days, lastError: "x", today: { day: today2, kwh: 7.4, at: "2026-11-16T09:10:00Z" } }, today2);
  assert.match(warn, /class="why">הבדיקה מול SolarEdge לא הצליחה/, "כשיש משהו לבדוק, כתוב מה");
  assert.match(warn, /מה לעשות:<\/span> לא צריך לעשות כלום/, "ועם פתרון");
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
  const store = fakeStore({ days, refreshToken: "TOKEN-SECRET" });
  const docs = store.docs;
  const route = (url, init) => solarRoute(new Request(url, init), {}, store, null);
  const base = "https://x.dev";
  // בלי כניסה אין נתונים, גם עם הקישור החתום הישן
  for (const u of [`${base}/solar/dashboard`, `${base}/solar/dashboard?t=abc`]) {
    const res = await route(u);
    assert.equal(res.status, 401);
    assert.ok(!/קוט/.test(await res.text()));
  }
  assert.equal((await solarUrl({}, base)).includes("?"), false, "הקישור בדוח לא נותן גישה");
  assert.equal((await route(`${base}/solar/login?k=bad`)).status, 403);
  const link = await loginUrl(store, base);
  const k = new URL(link).searchParams.get("k");
  const seen = await route(link);
  assert.equal(seen.status, 200, "תצוגה מקדימה לא שורפת את הקישור");
  assert.equal((await route(link)).status, 200);
  const form = () => { const f = new FormData(); f.set("k", k); return f; };
  const ok = await route(`${base}/solar/login`, { method: "POST", body: form() });
  assert.equal(ok.status, 303);
  const cookie = ok.headers.get("set-cookie");
  assert.match(cookie, /^__Host-solar=[0-9a-f]{64}; Path=\/; Secure; HttpOnly; SameSite=Lax/);
  assert.equal((await route(`${base}/solar/login`, { method: "POST", body: form() })).status, 403, "קישור עובד פעם אחת");
  assert.equal((await route(link)).status, 403);
  const token = cookie.split(";")[0];
  assert.ok(!JSON.stringify(docs["agentReports/solarAuth"]).includes(token.split("=")[1]), "העוגייה לא נשמרת גלויה");
  const page = await route(`${base}/solar/dashboard`, { headers: { cookie: token } });
  assert.equal(page.status, 200);
  const csp = page.headers.get("content-security-policy");
  const nonce = csp.match(/nonce-([0-9a-f]+)/)[1];
  const body = await page.text();
  assert.equal(body.match(/<script[^>]*>/g).length, 2);
  assert.ok(body.match(/<script[^>]*>/g).every((t) => t.includes(nonce)), "כל סקריפט עם nonce");
  assert.ok(!/TOKEN-SECRET/.test(body));
  assert.equal(page.headers.get("cache-control"), "no-store");
  assert.equal(page.headers.get("x-frame-options"), "DENY");
  assert.equal((await route(`${base}/solar/dashboard`, { headers: { cookie: "__Host-solar=" + "0".repeat(64) } })).status, 401);
  docs["agentReports/solarAuth"].sessions[0].exp = Date.now() - 1;
  assert.equal((await route(`${base}/solar/dashboard`, { headers: { cookie: token } })).status, 401, "עוגייה שפגה");
  docs["agentReports/solarAuth"].sessions[0].exp = Date.now() + 1000;
  await makeSolarTools({ store, origin: base }).solar_logout();
  assert.equal((await route(`${base}/solar/dashboard`, { headers: { cookie: token } })).status, 401, "ניתוק מכל המכשירים");
}
console.log("solar ok");
// דוחות וכסף
{
  const { reportData, reportXlsx, reportHtml, earnings, validPeriod, money } = await import("../src/solar-report.js");
  const days = {};
  for (let i = 1; i <= 31; i++) { days[`2026-10-${String(i).padStart(2, "0")}`] = { kwh: 20, rad: 15 }; days[`2025-10-${String(i).padStart(2, "0")}`] = { kwh: 16, rad: 15 }; }
  const s = { days, rate: 0.5, selfShare: 0, fixed: 10, today: { day: "2026-11-08", kwh: 4 } };
  const r = reportData(s, "2026-10", "2026-11-08");
  assert.equal(r.kwh, 620);
  assert.equal(r.change, 25);
  assert.equal(r.net, 300, "620 קוט\"ש כפול 50 אגורות, פחות 10 ₪");
  const open = reportData(s, "2026-11", "2026-11-03");
  assert.equal(open.rows.length, 2, "חודש פתוח: רק עד אתמול");
  assert.equal(earnings(s, "2026-11-08").today, 2);
  assert.equal(money({ selfShare: 0 }).rate, 0.48);
  assert.ok(Math.abs(money({}).rate - (0.75 * 0.48 + 0.25 * 0.6352)) < 1e-9, "מסלול ירוק: הזנה לרשת וצריכה עצמית");
  const b = earnings({ ...s, invest: 1000, since: "2025-10-01" }, "2026-11-08").back;
  assert.equal(Math.round(b.earned), Math.round(620 * 0.5 + 496 * 0.5 - 10 * (62 / 30.4)), "החזר השקעה על כל הימים מאז ההפעלה");
  assert.ok(Math.abs(b.saved + b.credit - b.earned) < 1e-6 && b.saved === 0, "בלי צריכה עצמית כל ההחזר הוא זיכוי");
  const real = earnings({ ...s, invest: 1000, since: "2025-10-01", cpi: { "2025-10": 100, "2026-10": 110, at: "2026-11" } }, "2026-11-08").back;
  assert.equal(Math.round(real.invest), 1100, "ההשקעה בשקלים של היום");
  assert.equal(real.inflation, 10);
  assert.ok(real.earned > b.earned, "גם ההכנסות מתואמות למדד");
  assert.ok(validPeriod("2026", "2026-11-08") && validPeriod("2025-12", "2026-11-08"));
  assert.ok(!validPeriod("2026-12", "2026-11-08") && !validPeriod("2026-13", "2026-11-08") && !validPeriod("../x", "2026-11-08"));
  // צריכה עצמית מחשבונות: 620 קוט"ש ייצור באוקטובר, 465 הוזרמו לרשת → 25%
  const { billShare } = await import("../src/solar-report.js");
  const withBills = { ...s, selfShare: 0.9, bills: [{ from: "2026-10-01", to: "2026-10-31", kwh: 465 }, { from: "2026-11-01", to: "2026-11-30", kwh: 100 }] };
  assert.equal(billShare(withBills).share, 0.25);
  assert.equal(billShare(withBills).bills, 1, "חשבון בלי נתוני ייצור לא נספר");
  assert.equal(money(withBills).selfShare, 0.25, "החשבונות קובעים, לא ההערכה");
  const xl = reportXlsx(r);
  assert.equal(xl[0], 0x50, "ZIP");
  assert.ok(new TextDecoder().decode(xl).includes("SUM('פירוט'!B5:B35)"), "הנוסחאות על שורות הנתונים");
  assert.ok(!/NaN|undefined/.test(reportHtml(r, "n")));
}

// השמיים בדשבורד מראים גשם ועננות
{
  assert.equal(skyKind({ weather_code: 61, precipitation: 0.4 }), "rain");
  assert.equal(skyKind({ weather_code: 2, precipitation: 0.2 }), "rain");
  assert.equal(skyKind({ weather_code: 3, precipitation: 0 }), "overcast");
  assert.equal(skyKind({ weather_code: 1, precipitation: 0, cloud_cover: 20 }), "");
  assert.equal(skyKind(undefined), "");
  assert.match(solarHtml({}, "2026-11-06", "", "rain"), /id="scene" class=" wx-rain"/);
}
// יום חלש: חשוד רק ביום בהיר, ויום בודד לא מוריד את הסטטוס
{
  const { insights } = await import("../src/solar-dashboard.js");
  const t0 = "2026-11-08";
  const d = {};
  for (let i = 1; i <= 40; i++) d[addDays(t0, -i)] = { kwh: 30, rad: 15, tmax: 25 };
  d["2026-11-06"] = { kwh: 8, rad: 9, tmax: 25 }; // מעונן חלקית: הקרינה של המודל לא אמינה
  assert.deepEqual(analyze(d, t0).low, [], "יום מעונן חלקית לא נחשד");
  d["2026-11-06"] = { kwh: 8, rad: 15, tmax: 25 };
  assert.deepEqual(analyze(d, t0).low, ["2026-11-06"]);
  assert.equal(insights({ days: d }, t0).status, "ok", "יום חלש בודד לא מוריד את הסטטוס");
  d["2026-11-05"] = { kwh: 8, rad: 15, tmax: 25 };
  assert.equal(insights({ days: d }, t0).status, "check", "שני ימים כאלה כבר כן");
}
