// ⏰ תזכורת למאמנים שלא מילאו נוכחות — רץ כל רבע שעה (wrangler.toml → triggers).
// קבוצה שהתאמנה היום (groups.days), שהאימון שלה נגמר לפני חצי שעה לפחות, ואין לה אף רשומת נוכחות להיום:
// כל המאמנים שלה מקבלים את התבנית coach_attendance_reminder (אותו נוסח כמו כפתור התזכורת באפליקציה).
// מאמן בלי טלפון, או שליחה שנכשלה (תבנית לא אושרה / מספר הבדיקה של Meta) — נכנס לסיכום לבעלים.
import { israelToday, normalizePhone, isValidPhone } from "../../agents/lib/analysis.mjs";
import { sendTemplate, notifyOwner } from "../../agents/lib/whatsapp.mjs";

const GRACE_MIN = 30;

const israelNow = (now) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now).map((x) => [x.type, x.value]));
  return { dow: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday), min: Number(p.hour) * 60 + Number(p.minute) };
};
const toMin = (t) => (/^\d{1,2}:\d{2}$/.test(t || "") ? Number(t.split(":")[0]) * 60 + Number(t.split(":")[1]) : null);
const coachIds = (g) => [...new Set([g.coachId, ...(Array.isArray(g.coachIds) ? g.coachIds : [])].filter(Boolean))];

export async function remindCoaches(env, store, wa, now = new Date()) {
  const today = israelToday(now);
  const { dow, min } = israelNow(now);
  const bot = (await store.get("agentReports/bot")) || {};
  const done = bot.coachReminders?.date === today ? bot.coachReminders.groups : [];
  const groups = (await store.list("groups")).filter(
    (g) => !g.deleted && g.isActive !== false && Array.isArray(g.days) && g.days.includes(dow) && toMin(g.endTime) !== null && min >= toMin(g.endTime) + GRACE_MIN && !done.includes(g.id),
  );
  if (!groups.length) return "nothing due";

  const [players, users, recs] = await Promise.all([store.list("players"), store.list("users"), store.where("attendance", "date", today)]);
  const marked = new Set(recs.map((a) => a.groupId));
  const lines = [];
  for (const g of groups) {
    const hasPlayers = players.some((p) => p.groupId === g.id && p.isActive && !p.deleted);
    if (!hasPlayers || marked.has(g.id)) continue;
    for (const id of coachIds(g)) {
      const c = users.find((u) => u.id === id) || { name: "מאמן" };
      if (!isValidPhone(c.phone || "")) {
        lines.push(`• ${g.name} — ${c.name}: אין טלפון שמור`);
        continue;
      }
      try {
        await sendTemplate(wa, normalizePhone(c.phone), "coach_attendance_reminder", [c.name, g.name]);
        lines.push(`• ${g.name} — ${c.name}: נשלחה תזכורת ✓`);
      } catch (e) {
        lines.push(`• ${g.name} — ${c.name}: השליחה נכשלה (${e.message})`);
      }
    }
    if (!coachIds(g).length) lines.push(`• ${g.name}: אין מאמן משויך`);
  }
  await store.merge("agentReports/bot", { coachReminders: { date: today, groups: [...done, ...groups.map((g) => g.id)] } });
  if (!lines.length) return "all marked";
  const text = `⏰ *נוכחות שלא מולאה היום*\n${lines.join("\n")}`;
  await notifyOwner(wa, { lastOwnerMsgAt: bot.lastOwnerMsgAt, text, template: "agent_alert", templateParam: `${lines.length} תזכורות נוכחות למאמנים היום` });
  return text;
}
