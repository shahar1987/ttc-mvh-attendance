// 🩺 אבחון התור לוואטסאפ (הפעלה ידנית: Agents ⟵ diag). קריאה בלבד. מדפיס ליומן הציבורי רק ספירות,
// גילאים ושגיאות — כל רצף של 7 ספרות ומעלה מוסתר, ושמות לא מודפסים.
import { firestore, loadAll } from "./lib/firebase.mjs";
import { weeklyHealth } from "./lib/weekly.mjs";
import { tellOwner } from "./lib/owner.mjs";

const db = firestore();
const bot = (await db.collection("agentReports").doc("bot").get()).data() || {};
const now = Date.now();
const age = (iso) => (iso ? `${Math.round((now - new Date(iso)) / 60000)}m` : "-");
const clean = (s) => String(s || "").replace(/\d{7,}/g, "#").replace(/\s+/g, " ").slice(0, 300);
const q = Array.isArray(bot.outboxQueue) ? bot.outboxQueue : [];
// GitHub מציג רק 10 הערות לכל צעד — הבדיקות החשובות קודם
const [groups, users] = await Promise.all([loadAll(db, "groups"), loadAll(db, "users")]);
// DIAG_PHONE: בודק אם הטלפון שהבעלים מסר תואם למה שרשום למנהלים באפליקציה. מדפיס רק כן/לא
if (process.env.DIAG_PHONE) {
  const { normalizePhone } = await import("./lib/analysis.mjs");
  const want = normalizePhone(process.env.DIAG_PHONE);
  const admins = users.filter((u) => String(u.role || "").toLowerCase() === "admin" && !u.deleted);
  console.log(`::notice::admins=${admins.length} match=${admins.map((u) => normalizePhone(u.phone || "") === want).join(",")}`);
  if (0) for (const u of users.filter((u) => String(u.role || "").toLowerCase() === "admin" && !u.deleted))
    console.log(`::notice::admin phone matches=${normalizePhone(u.phone || "") === want} hasPhone=${Boolean(u.phone)}`);
}
console.log(`::notice::env whatsapp=${Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID)} owner=${Boolean(process.env.OWNER_PHONE)}`);
// DIAG_FIX=1: מוציא מהתור את הודעות הסיכום השבועי שנתקעו (ישלחו מחדש ישירות), ומשחרר נעילות של השאר
if (process.env.DIAG_FIX === "1") {
  const ref = db.collection("agentReports").doc("bot");
  const removed = await db.runTransaction(async (t) => {
    const cur = (await t.get(ref)).data()?.outboxQueue || [];
    const keep = cur.filter((x) => !["weekly", "weekly-coach", "weekly-preview"].includes(x?.from)).map(({ claimedAt, ...x }) => x);
    t.update(ref, { outboxQueue: keep });
    return cur.length - keep.length;
  });
  console.log(`::notice::fix removed=${removed}`);
}
console.log(`::notice::queue=${q.length} lastCronError=${age(bot.lastCronError?.at)} lastCoachError=${age(bot.lastCoachError?.at)} lastOwnerMsg=${age(bot.lastOwnerMsgAt)}`);
for (const x of q) console.log(`::notice::item from=${x.from} to=${x.to ? "yes" : "owner"} age=${age(x.at)} attempts=${x.attempts || 0} claimed=${age(x.claimedAt)} template=${x.template || "-"}`);
if (bot.lastCronError) console.log(`::notice::cronError ${clean(bot.lastCronError.message)}`);
if (bot.lastCoachError) console.log(`::notice::coachError ${clean(bot.lastCoachError.message)}`);
for (const f of (bot.failLog || []).slice(-5)) console.log(`::notice::fail age=${age(f.at)} ${clean(JSON.stringify(f.errors || ""))}`);
const t = bot.templates;
if (t) console.log(`::notice::templates age=${age(t.at)} ${clean((t.result || []).join(" | "))}`);

// בדיקת המערכת של הסיכום השבועי — שמות המדריכים מוסתרים ביומן הציבורי
const quiet = (await db.collection("agentReports").doc("coaches").get()).data()?.quiet || [];
const hide = (s) => users.reduce((t, u) => (u.name ? t.split(u.name).join("[מדריך]") : t), clean(s));
const h = weeklyHealth({ groups, users, quiet, bot });
for (const x of h.problems) console.log(`::notice::health problem: ${hide(x)}`);
for (const x of h.notes) console.log(`::notice::health note: ${hide(x)}`);
// DIAG_TELL=1: הפירוט עם השמות נשלח רק לבעלים בוואטסאפ (לא ליומן הציבורי)
if (process.env.DIAG_TELL === "1") {
  const fails = (bot.failLog || []).filter((f) => now - new Date(f.at) < 7 * 864e5).map((f) => `• ${f.who || "?"} — ${new Date(f.at).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem", dateStyle: "short", timeStyle: "short" })}${f.delivered ? " (נמסרה ואז נכשלה)" : ""}`);
  // הטלפון שרשום באפליקציה למי שלא קיבל — רק לבעלים, כדי לבדוק אם המספר נכון
  const phoneOf = (who) => users.find((u) => u.name === who)?.phone || "אין טלפון רשום";
  const failedWho = [...new Set((bot.failLog || []).filter((f) => now - new Date(f.at) < 7 * 864e5).map((f) => f.who).filter(Boolean))];
  const lines = ["🩺 פירוט בדיקת המערכת", ...failedWho.map((w) => `📞 הטלפון של ${w} באפליקציה (לשם נשלחות הודעות המדריך): ${phoneOf(w)}`), ...(fails.length ? ["הודעות שלא נמסרו בשבוע האחרון:", ...fails] : ["אין הודעות שלא נמסרו"]), ...h.problems.map((x) => `❗ ${x}`), ...h.notes.map((x) => `• ${x}`)];
  await tellOwner(db, { agent: "diag", text: lines.join("\n"), templateParam: "פירוט בדיקת המערכת מחכה לך" });
}
