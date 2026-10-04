// 🛡️ המפקח — כל שעה בודק שכל שאר הסוכנים עובדים ושהכל מאובטח:
//   • כל סוכן רץ בזמן (סימני החיים ב-agentReports/health)
//   • בוט הוואטסאפ עונה, ואין לו שגיאות חדשות
//   • הטוקן של וואטסאפ תקף ודירוג האיכות של המספר לא אדום
//   • לא נכנסו לריפו הציבורי טלפונים או מפתחות
// מדווח לשולה רק כשמצב משתנה: בעיה חדשה, או שהכל חזר לתקין. שקט כשהכל בסדר.
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { firestore, heartbeat } from "./lib/firebase.mjs";
import { israelToday } from "./lib/analysis.mjs";
import { tellOwner } from "./lib/owner.mjs";

const db = firestore();
const reports = db.collection("agentReports");
const health = (await reports.doc("health").get()).data() || {};
const bot = (await reports.doc("bot").get()).data() || {};
const problems = [];
const hoursAgo = (iso) => (iso ? (Date.now() - new Date(iso).getTime()) / 3600000 : Infinity);
const israelHour = Number(new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem", hour: "numeric", hourCycle: "h23" }));

// 1. כל סוכן רץ בזמן
if (israelHour >= 10 && hoursAgo(health.scan?.at) > 20) problems.push("הסורק היומי לא רץ הבוקר");
if (hoursAgo(health.bugcheck?.at) > 30) problems.push("בודק הבאגים לא רץ יותר מיממה");
if (hoursAgo(health.ideas?.at) > 8 * 24 && health.ideas) problems.push("סוכן הרעיונות לא רץ השבוע");

// 2. הבוט
const waReady = process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID;
if (bot.workerUrl) {
  try {
    const res = await fetch(`${bot.workerUrl}/health`);
    const j = await res.json();
    if (!res.ok || !j.ok) problems.push(`בוט הוואטסאפ לא תקין: ${(j.missing || []).join(", ") || res.status}`);
  } catch (e) {
    problems.push("בוט הוואטסאפ לא עונה");
  }
} else if (waReady) {
  problems.push("בוט הוואטסאפ עוד לא הועלה (להריץ את Agents setup)");
}
if (bot.lastError && hoursAgo(bot.lastError.at) < 1.2) problems.push(`שגיאה בבוט: ${String(bot.lastError.message).slice(0, 120)}`);

// 3. וואטסאפ
if (waReady) {
  const res = await fetch(
    `https://graph.facebook.com/v24.0/${process.env.WHATSAPP_PHONE_ID}?fields=quality_rating,verified_name`,
    { headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` } },
  );
  const j = await res.json().catch(() => ({}));
  if (!res.ok) problems.push(`הטוקן של וואטסאפ לא עובד (${j.error?.message || res.status})`);
  else if (j.quality_rating === "RED") problems.push("דירוג האיכות של מספר המועדון בוואטסאפ ירד לאדום — יותר מדי אנשים חוסמים");
}

// 4. אבטחה: טלפונים או מפתחות חדשים בריפו הציבורי
const grep = (re, exclude = "") => {
  try {
    return execSync(`git grep -n -I -E '${re}' -- . ':!.claude/' ${exclude}`, { encoding: "utf8", maxBuffer: 1 << 26, cwd: fileURLToPath(new URL("..", import.meta.url)) })
      .split("\n")
      .filter(Boolean);
  } catch {
    return []; // git grep מחזיר 1 כשאין התאמות
  }
};
const PLACEHOLDER = /05[0-9]-?1234567|972501234567|05000000|9725X/;
// קבצי בדיקה משתמשים במספרים מומצאים בלבד, ולכן לא נסרקים לטלפונים
const phones = grep("(^|[^0-9])(05[0-9]-?[0-9]{3}-?[0-9]{4}|9725[0-9]{8})([^0-9]|$)", "':!*.test.mjs' ':!rules-tests/'").filter((l) => !PLACEHOLDER.test(l));
const secrets = grep("sk-ant-[A-Za-z0-9_-]{10}|EAA[A-Za-z0-9]{40}|-----BEGIN PRIVATE KEY-{5}"); // {5} ולא חמישה מקפים — כדי שהשורה הזו לא תתפוס את עצמה
const fingerprint = (lines) => lines.map((l) => createHash("sha256").update(l.replace(/^[^:]+:\d+:/, "")).digest("hex").slice(0, 16));
const sec = (await reports.doc("security").get()).data();
const phoneFp = fingerprint(phones);
if (!sec) {
  // ריצה ראשונה: מה שכבר בריפו הוא נקודת הבסיס; מתריעים רק על חדש
  await reports.doc("security").set({ phoneBaseline: phoneFp, at: new Date().toISOString() });
} else {
  const base = new Set(sec.phoneBaseline || []);
  const fresh = phoneFp.filter((f) => !base.has(f)).length;
  if (fresh) problems.push(`נכנסו לריפו הציבורי ${fresh} מספרי טלפון חדשים`);
}
if (secrets.length) problems.push(`נמצא מפתח סודי בקוד הציבורי (${secrets.length} מקומות) — צריך להחליף אותו מיד`);

// דיווח רק כשהמצב משתנה
const key = problems.join("|");
const sup = health.supervisor || {};
console.log(`problems: ${problems.length}`);
if (key !== (sup.key || "")) {
  if (problems.length) {
    await tellOwner(db, {
      agent: "supervisor",
      text: ["🛡️ המפקח מצא בעיות:", ...problems.map((p) => `• ${p}`)].join("\n"),
      templateParam: problems[0],
    });
  } else if (sup.key) {
    await tellOwner(db, { agent: "supervisor", text: "✅ המפקח: כל הסוכנים חזרו לעבוד כרגיל.", templateParam: "כל הסוכנים חזרו לעבוד כרגיל" });
  }
}
await heartbeat(db, "supervisor", { key, problems, day: israelToday() });
