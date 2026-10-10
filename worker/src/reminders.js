// ⏰ תזכורת למאמנים שלא מילאו נוכחות — רץ כל רבע שעה (wrangler.toml → triggers).
// קבוצה שהתאמנה היום (groups.days), שהאימון שלה נגמר לפני חצי שעה לפחות, ואין לה אף רשומת נוכחות להיום:
// הבעלים מקבל קישור לכל מאמן שלה, עם נוסח coach_attendance_reminder מוכן, ושולח מהמספר שלו בלחיצה.
import { israelToday, normalizePhone, isValidPhone } from "../../agents/lib/analysis.mjs";
import { waLink, notifyOwner } from "../../agents/lib/whatsapp.mjs";
import { renderTemplate } from "../../agents/templates.mjs";
import { outboxMap } from "./queue.js";

const GRACE_MIN = 30;
// הקישור פותח את האפליקציה ישר על מסך הסימון של הקבוצה (part-b.js קורא את #group=)
const APP_URL = "https://shahar1987.github.io/ttc-mvh-attendance/";

// 🔗 קישורי wa.me עם נוסח בעברית יוצאים ארוכים מאוד (כל אות מקודדת ל-%D7%..) וממלאים את המסך.
// מחליפים כל אחד בקישור קצר של ה-worker (/w/<id>) שמפנה אליו. נשמרים 7 ימים ב-agentReports/links. בלי PUBLIC_URL — משאירים כמו שהם.
export async function shortLinks(env, store, text) {
  const urls = env.PUBLIC_URL ? [...new Set(String(text).match(/https:\/\/wa\.me\/\S+/g) || [])] : [];
  if (!urls.length) return text;
  const at = new Date().toISOString(), week = new Date(Date.now() - 7 * 864e5).toISOString();
  const map = Object.fromEntries(urls.map((u) => [u, crypto.randomUUID().replace(/-/g, "").slice(0, 10)]));
  await store.update("agentReports/links", (cur) => ({
    links: {
      ...Object.fromEntries(Object.entries(cur.links || {}).filter(([, v]) => v?.at > week)),
      ...Object.fromEntries(Object.entries(map).map(([url, id]) => [id, { url, at }])),
    },
  }));
  return urls.reduce((t, u) => t.split(u).join(`${env.PUBLIC_URL}/w/${map[u]}`), String(text));
}

const israelNow = (now) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now).map((x) => [x.type, x.value]));
  return { dow: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday), min: Number(p.hour) * 60 + Number(p.minute) };
};
const toMin = (t) => (/^\d{1,2}:\d{2}$/.test(t || "") ? Number(t.split(":")[0]) * 60 + Number(t.split(":")[1]) : null);
export const coachIds = (g) => [...new Set([g.coachId, ...(Array.isArray(g.coachIds) ? g.coachIds : [])].filter(Boolean))];

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
      lines.push(`• ${g.name} — ${c.name}: ${waLink(normalizePhone(c.phone), renderTemplate("coach_attendance_reminder", [c.name, g.name]) + `\n${APP_URL}#group=${g.id}`)}`);
    }
    if (!coachIds(g).length) lines.push(`• ${g.name}: אין מאמן משויך`);
  }
  const text = lines.length ? await shortLinks(env, store, `⏰ *נוכחות שלא מולאה היום* — ללחוץ על קישור ואז "שלח":\n${lines.join("\n")}`) : "";
  const ids = groups.map((g) => g.id);
  // מסמנים את הקבוצות *לפני* השליחה. כך כישלון בסימון לא גורם לשליחה חוזרת כל רבע שעה (אם הכתיבה נכשלת —
  // לא שולחים בכלל, והריצה הבאה מנסה מחדש). אם השליחה עצמה נכשלת — מבטלים את הסימון כדי לנסות שוב ברבע הבא.
  await store.update("agentReports/bot", (cur) => {
    const prev = cur.coachReminders?.date === today ? cur.coachReminders : {};
    return { coachReminders: { date: today, groups: [...new Set([...(prev.groups || []), ...ids])], lastSentAt: { ...(prev.lastSentAt || {}), ...Object.fromEntries(ids.map((id) => [id, now.toISOString()])) } } };
  });
  if (text) {
    try {
      // ב-outbox כדי ששולה תוכל להראות את הקישורים שוב אם הסיכום יצא כתבנית קצרה (חלון 24 השעות סגור)
      await store.update("agentReports/bot", (cur) => ({ outbox: { ...outboxMap(cur.outbox), reminders: { at: now.toISOString(), text } } }));
      await notifyOwner(wa, { lastOwnerMsgAt: bot.lastOwnerMsgAt, text, template: "agent_alert", templateParam: `${lines.length} מאמנים לא מילאו נוכחות היום. אפשר להשיב כדי לקבל קישורי תזכורת` });
    } catch (e) {
      // אם גם הביטול נכשל — התזכורת של היום מתפספסת (ונרשמת שגיאה), אבל לא נשלחת שוב ושוב
      await store
        .update("agentReports/bot", (cur) => {
          if (cur.coachReminders?.date !== today) return null;
          const lastSentAt = { ...(cur.coachReminders.lastSentAt || {}) };
          ids.forEach((id) => delete lastSentAt[id]);
          return { coachReminders: { ...cur.coachReminders, groups: (cur.coachReminders.groups || []).filter((g) => !ids.includes(g)), lastSentAt } };
        })
        .catch((e2) => { e.message += ` (וגם ביטול הסימון נכשל: ${e2.message} — התזכורת לא תישלח שוב היום)`; });
      throw e;
    }
  }
  return text || "all marked";
}
