// 🐞 בודק הבאגים — כל לילה:
//   1. האתר החי עולה, בלי שגיאות JavaScript, מסך ההתחברות מוצג ובכיוון RTL
//   2. הנתונים תקינים (lib/checks.mjs)
//   3. אף תהליך אוטומטי ב-GitHub לא נכשל ביממה האחרונה
// מדווח לשולה רק כשמופיעה בעיה חדשה, כדי שהתראה תמיד תהיה שווה קריאה.
import { firestore, loadAll, heartbeat } from "./lib/firebase.mjs";
import { addDays, israelToday } from "./lib/analysis.mjs";
import { dataChecks } from "./lib/checks.mjs";
import { tellOwner } from "./lib/owner.mjs";

const SITE = "https://shahar1987.github.io/ttc-mvh-attendance/";
const db = firestore();
const today = israelToday();
const findings = [];
const add = (id, severity, text) => findings.push({ id, severity, text });

// 1. האתר החי
try {
  const res = await fetch(SITE, { redirect: "follow" });
  const html = await res.text();
  if (!res.ok) add("site-down", "high", `האתר מחזיר שגיאה ${res.status}`);
  else if (!html.includes("app.js")) add("site-broken", "high", "דף האתר נטען בלי קובץ האפליקציה");
} catch (e) {
  add("site-down", "high", `האתר לא עונה (${e.message})`);
}
try {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 400, height: 850 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(SITE, { waitUntil: "load", timeout: 30000 });
  await page.waitForTimeout(6000);
  const text = await page.$eval("body", (el) => el.innerText);
  const dir = await page.evaluate(() => document.documentElement.dir);
  await browser.close();
  if (errs.length) add("site-js-errors", "high", `שגיאות JavaScript באתר החי: ${errs.slice(0, 2).join(" | ").slice(0, 200)}`);
  if (!text.includes("התחברות")) add("site-no-login", "high", "מסך ההתחברות לא מוצג באתר החי");
  if (dir !== "rtl") add("site-not-rtl", "medium", "האתר החי לא בכיוון ימין-לשמאל");
} catch (e) {
  console.log(`browser check skipped: ${e.message.split("\n")[0]}`);
}

// 2. הנתונים
const from = addDays(today, -30);
const [players, groups, attendance, cancellations] = await Promise.all([
  loadAll(db, "players"),
  loadAll(db, "groups"),
  loadAll(db, "attendance", (c) => c.where("date", ">=", from)),
  loadAll(db, "cancellations", (c) => c.where("date", ">=", from)),
]);
findings.push(...dataChecks({ players, groups, attendance, cancellations, today }));

// 3. תהליכים שהריצה האחרונה שלהם על main נכשלה (ריצה ירוקה מאוחרת יותר = תוקן)
if (process.env.GITHUB_TOKEN && process.env.GITHUB_REPOSITORY) {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const res = await fetch(
    `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/actions/runs?branch=main&status=completed&per_page=100&created=>=${since}`,
    { headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json" } },
  );
  if (res.ok) {
    const latest = new Map();
    for (const r of (await res.json()).workflow_runs || []) if (!latest.has(r.name)) latest.set(r.name, r); // החדשה ראשונה
    const names = [...latest.values()].filter((r) => r.conclusion === "failure").map((r) => r.name);
    if (names.length) add("workflow-failed", "high", `תהליכים אוטומטיים שהריצה האחרונה שלהם נכשלה: ${names.join(", ")}`);
  }
}

console.log(`findings: ${findings.map((f) => f.id).join(", ") || "none"}`);

const ref = db.collection("agentReports").doc("bugs");
const prev = (await ref.get()).data() || {};
const prevIds = new Set((prev.findings || []).map((f) => f.id));
const fresh = findings.filter((f) => f.severity !== "low" && !prevIds.has(f.id));
await ref.set({ date: today, createdAt: new Date().toISOString(), findings });

if (fresh.length) {
  const text = ["🐞 בודק הבאגים מצא בעיות חדשות:", ...fresh.map((f) => `• ${f.text}`)].join("\n");
  await tellOwner(db, { agent: "bugcheck", text, templateParam: `בודק הבאגים: ${fresh[0].text}`.slice(0, 200) });
}
await heartbeat(db, "bugcheck", { findings: findings.length });
