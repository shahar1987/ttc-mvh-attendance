// המפקח: האם כל סוכן רץ בזמן. פונקציה טהורה (בלי Firestore) כדי שאפשר לבדוק אותה.
// הזמנים תואמים ל-.github/workflows/agents.yml:
//   scan — כל בוקר (05:00 UTC, כלומר 07:00/08:00 בישראל). GitHub מאחר לפעמים בשעות,
//          ולכן מתריעים רק אם עד 16:00 שעון ישראל אין סריקה מהיום.
//   bugcheck — כל לילה; מתריעים אחרי 30 שעות בלי ריצה.
//   ideas, content — ראשון ב-09:00 בישראל; מתריעים רק אחרי ראשון 12:00 אם אין ריצה מאז אותו ראשון.
//          גם כשאין סימן חיים בכלל (סוכן שמעולם לא רץ, למשל בגלל מפתח חסר).
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
  if (dayOf(health.ideas?.at) < due) problems.push("סוכן הרעיונות לא רץ השבוע");
  if (dayOf(health.content?.at) < due) problems.push("סוכן הפרסום לא רץ השבוע");
  // ה-worker כותב agentReports/bot.lastCronError = { at, message } כשמשימה מתוזמנת שלו נכשלת
  if (bot.lastCronError && hoursAgo(bot.lastCronError.at, now) < 1.2)
    problems.push(`שגיאה במשימה מתוזמנת של הבוט: ${String(bot.lastCronError.message).slice(0, 120)}`);
  return problems;
}
