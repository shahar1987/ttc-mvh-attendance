// המפקח: האם כל סוכן רץ בזמן. פונקציה טהורה (בלי Firestore) כדי שאפשר לבדוק אותה.
// הזמנים תואמים ל-.github/workflows/agents.yml:
//   scan — כל בוקר (05:00 UTC, כלומר 07:00/08:00 בישראל). GitHub מאחר לפעמים בשעות,
//          ולכן מתריעים רק אם עד 16:00 שעון ישראל אין סריקה מהיום.
//   bugcheck — כל לילה; מתריעים אחרי 30 שעות בלי ריצה.
//   ideas, content — ראשון ב-09:00 בישראל; מתריעים רק אחרי ראשון 12:00 אם הריצה המוצלחת האחרונה
//          לפני אותו ראשון. לא מתריעים כשאין סימן חיים בכלל (עוד לא רץ אף פעם — למשל ראשון הראשון
//          אחרי השחרור), ולא כשהסוכן עצמו דיווח על מפתח חסר (missingKeyAt) — הוא כבר שלח הודעה
//          משלו, וכך מפתח חסר = הודעה אחת בשבוע.
//   bot.lastCronError — ה-worker כותב { at, message } בכל כישלון של cron (כל 15 דקות). מתריעים רק
//          על תקלה חוזרת: השגיאה טרייה (פחות מ-1.2 שעות), וגם בריצת המפקח הקודמת כבר נראתה שגיאה
//          טרייה עם at אחר (health.supervisor.cronErrorAt). כישלון חד-פעמי לא מגיע לבעלים.
// ההתראה עצמה יוצאת רק כשרשימת הבעיות משתנה (supervisor.mjs), ולכן אין התראה חוזרת כל שעה.
import { addDays, israelToday } from "./analysis.mjs";

const hoursAgo = (iso, now) => (iso ? (now.getTime() - new Date(iso).getTime()) / 3600000 : Infinity);
const israelHour = (now) => Number(now.toLocaleString("en-US", { timeZone: "Asia/Jerusalem", hour: "numeric", hourCycle: "h23" }));
const dayOf = (iso) => (iso ? israelToday(new Date(iso)) : "");

// הראשון האחרון שבו הסוכן השבועי כבר היה אמור לסיים (כולל זמן חסד עד 12:00)
export function lastWeeklyDue(now) {
  const today = israelToday(now);
  const dow = new Date(today + "T00:00:00Z").getUTCDay();
  let sunday = addDays(today, -dow);
  if (dow === 0 && israelHour(now) < 12) sunday = addDays(sunday, -7);
  return sunday;
}

export function scheduleProblems(health = {}, bot = {}, now = new Date()) {
  const problems = [];
  const today = israelToday(now);
  if (israelHour(now) >= 16 && dayOf(health.scan?.at) !== today) problems.push("הסורק היומי לא רץ היום");
  if (hoursAgo(health.bugcheck?.at, now) > 30) problems.push("בודק הבאגים לא רץ יותר מיממה");
  const due = lastWeeklyDue(now);
  const weeklyLate = (h) => h && !(h.missingKeyAt && h.missingKeyAt > (h.at || "")) && dayOf(h.at) < due;
  if (weeklyLate(health.ideas)) problems.push("סוכן הרעיונות לא רץ השבוע");
  if (weeklyLate(health.content)) problems.push("סוכן הפרסום לא רץ השבוע");
  if (recurringCronError(health, bot, now)) problems.push("משימה מתוזמנת של הבוט נכשלת שוב ושוב (הפרטים ב-agentReports/bot.lastCronError)");
  return problems;
}

export function recurringCronError(health = {}, bot = {}, now = new Date()) {
  const e = bot.lastCronError;
  const prev = health.supervisor?.cronErrorAt;
  if (!e?.at || hoursAgo(e.at, now) >= 1.2) return false;
  return Boolean(prev && prev !== e.at && hoursAgo(prev, now) < 2.5);
}

// alert.mjs: האם כל השלבים שנכשלו ב-workflow הם סוכנים שכבר הודיעו לבעלים על מפתח חסר
export function alreadyToldOwner(steps = {}, health = {}, now = new Date()) {
  const failed = Object.entries(steps).filter(([, s]) => s && s.outcome === "failure").map(([id]) => id);
  return failed.length > 0 && failed.every((id) => hoursAgo(health[id]?.missingKeyAt, now) < 2);
}
