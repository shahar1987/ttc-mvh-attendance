// ⏰ תזכורת למאמנים שלא מילאו נוכחות — רץ כל רבע שעה (wrangler.toml → triggers).
// קבוצה שהתאמנה היום (groups.days), שהאימון שלה נגמר לפני חצי שעה לפחות, ואין לה אף רשומת נוכחות להיום:
// הבעלים מקבל קישור לכל מאמן שלה, עם נוסח coach_attendance_reminder מוכן, ושולח מהמספר שלו בלחיצה.
import { israelToday, normalizePhone, isValidPhone } from "../../agents/lib/analysis.mjs";
import { waLink, notifyOwner } from "../../agents/lib/whatsapp.mjs";
import { renderTemplate } from "../../agents/templates.mjs";
import { outboxMap } from "./queue.js";

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
      lines.push(`• ${g.name} — ${c.name}: ${waLink(normalizePhone(c.phone), renderTemplate("coach_attendance_reminder", [c.name, g.name]))}`);
    }
    if (!coachIds(g).length) lines.push(`• ${g.name}: אין מאמן משויך`);
  }
  const text = lines.length ? `⏰ *נוכחות שלא מולאה היום* — ללחוץ על קישור ואז "שלח":\n${lines.join("\n")}` : "";
  if (text) {
    // ב-outbox כדי ששולה תוכל להראות את הקישורים שוב אם הסיכום יצא כתבנית קצרה (חלון 24 השעות סגור)
    await store.update("agentReports/bot", (cur) => ({ outbox: { ...outboxMap(cur.outbox), reminders: { at: now.toISOString(), text } } }));
    // אם השליחה נכשלת — זורק, והקבוצות לא מסומנות כ"טופלו", כך שהריצה הבאה (עוד רבע שעה) מנסה שוב
    await notifyOwner(wa, { lastOwnerMsgAt: bot.lastOwnerMsgAt, text, template: "agent_alert", templateParam: `${lines.length} מאמנים לא מילאו נוכחות היום. אפשר להשיב כדי לקבל קישורי תזכורת` });
  }
  await store.update("agentReports/bot", (cur) => ({ coachReminders: { date: today, groups: [...new Set([...(cur.coachReminders?.date === today ? cur.coachReminders.groups || [] : []), ...groups.map((g) => g.id)])] } }));
  return text || "all marked";
}
