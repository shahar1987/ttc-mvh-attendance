// 📒 פנקס פתוחים: כל כרטיס עם כפתורים שמשימה של קלוד שולחת ל-POST /inbox נרשם כאן לבד, בלי לשנות את המשימות.
// כך "מאשר הכל" יודע מה באמת מחכה, שולה והמפקח רואים מה פתוח, ולחיצה על כרטיס ישן לא מפעילה את הפריט החדש שקיבל אותו מספר.
// מסמך נפרד, כי agentReports/bot חם וכבר הגיע ל-429 כשהתנפח. לא נקרא ב-cron של רבע השעה (תקציב הבקשות שם מלא).
import { israelToday } from "../../agents/lib/analysis.mjs";

const DOC = "agentReports/open";
const CODED = /^(מוח|הודעות|הרכב)( |$)/;
// לפי מזהה ולא לפי מיקום: הכפתור השני לא אחיד בין המשימות
const APPROVE = /^(מוח \d+|הודעות כן( \d+)?|הרכב לקבוצה|מאושר)$/;
const WEEK = 7 * 24 * 3600 * 1000;
const CONFIRM_MS = 10 * 60 * 1000;
export const PLAN_KEY = "מאושר";

const israelDate = (at) => new Date(at).toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
// מספרי ההיעדרות מתחילים מחדש כל יום, אז כרטיס של אתמול לא נשאר פתוח
const alive = (i, now = Date.now()) => now - Date.parse(i.at) < WEEK && (!i.key.startsWith("הודעות") || israelDate(i.at) === israelToday());
const load = async (store) => ((await store.get(DOC)) || {}).items || [];

export async function recordCard(store, { text, buttons, wamid }) {
  const list = (buttons || []).filter((b) => b?.id && (CODED.test(b.id) || b.id === PLAN_KEY));
  if (!list.length) return;
  const item = { key: list[0].id, ids: list.map((b) => b.id), label: list[0].title || "", title: String(text).split("\n").find((l) => l.trim())?.trim().slice(0, 80) || "", at: new Date().toISOString(), ...(wamid ? { wamid } : {}) };
  await store.update(DOC, (cur) => ({ items: [...(cur.items || []).filter((i) => i.key !== item.key && alive(i)), item].slice(-40) }));
}

// לחיצה על כרטיס שהוחלף בכרטיס חדש עם אותו מזהה
export const staleTap = (items, id, context) => !!context && items.some((i) => i.ids.includes(id) && i.wamid && i.wamid !== context);

export async function closeTap(store, id) {
  const all = /^הודעות (כן|לא)$/.test(id); // הכפתור של כל הרשימה סוגר גם את כרטיסי הפריטים
  await store.update(DOC, (cur) => ((cur.items || []).length ? { items: cur.items.map((i) => (i.ids.includes(id) || (all && i.key.startsWith("הודעות")) ? { ...i, answered: true } : i)) } : null));
}

export const cards = (store) => load(store);
export const openCards = async (store) => (await load(store)).filter((i) => !i.answered && alive(i));

export function approvable(items) {
  const list = items.filter((i) => APPROVE.test(i.key));
  return list.some((i) => i.key === "הודעות כן") ? list.filter((i) => !/^הודעות כן \d/.test(i.key)) : list;
}

// "מאשר הכל": קודם מראים בדיוק מה ייכנס לאישור, והכפתור מאשר את הרשימה הזאת ולא מה שיתווסף אחריה
export async function approveAllCard(store) {
  const list = approvable(await openCards(store));
  if (!list.length) return null;
  await store.merge("agentReports/bot", { approveAll: { keys: list.map((i) => i.key), at: new Date().toISOString() } });
  const lines = list.map((i) => `• ${i.title}${i.label ? ` (${i.label})` : ""}`);
  return { text: `אלה הפריטים שמחכים לאישור שלך:\n${lines.join("\n")}`, buttons: [{ id: "פנקס אשר", title: `אשר ${list.length} פריטים` }, { id: "פנקס בטל", title: "לא עכשיו" }] };
}

// מחזיר את התשובה לבעלים. perform מבצע מפתח אחד כמו לחיצה על הכרטיס שלו
export async function ledgerTap(store, id, bot, perform, now = Date.now()) {
  const asked = bot.approveAll;
  await store.merge("agentReports/bot", { approveAll: null });
  if (id !== "פנקס אשר") return "לא אישרתי כלום.";
  if (!asked || now - Date.parse(asked.at) >= CONFIRM_MS) return "האישור פג ולא ביצעתי כלום. אפשר לכתוב שוב \"מאשר הכל\".";
  const items = await openCards(store);
  const list = asked.keys.map((k) => items.find((i) => i.key === k)).filter(Boolean);
  if (!list.length) return "הפריטים כבר טופלו בינתיים, ולא ביצעתי כלום.";
  for (const i of list) await perform(i.key);
  return `הועברו לביצוע ${list.length} פריטים:\n${list.map((i) => `• ${i.title}`).join("\n")}\nזה עדיין לא אומר שהם בוצעו.`;
}

export const openNote = (items) => (items.length ? `\n\nכרטיסים שמחכים עכשיו לבעלים (מהפנקס):\n${items.map((i) => `- ${i.title}`).join("\n")}` : "");
