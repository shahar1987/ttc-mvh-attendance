// 🏢 "החברה של שולה" (Worker נפרד, shula-company) מדברת עם אותו מוח ואותם כלים של שולה.
// נקרא רק דרך service binding מאותו חשבון, ולכן בלי מפתח. השיחה עצמה נשמרת באפליקציה; כאן נרשם רק היומן,
// כדי שהמפקח הלילי יראה גם את מה שנאמר שם. היסטוריית הוואטסאפ לא מתערבבת.
import { WorkerEntrypoint } from "cloudflare:workers";
import { db } from "./firestore.js";
import { think, setOrigin } from "./index.js";
import { awaitingYes } from "./tools.js";
import { outboxMap } from "./queue.js";
import { waConfig } from "../../agents/lib/whatsapp.mjs";

const DEADLINE_MS = 90000; // בקריאה פנימית אין את מגבלת 30 השניות של Meta; עדיין לא משאירים את האפליקציה תלויה
const DAY = 24 * 3600 * 1000;

// היסטוריה מהאפליקציה: רק טקסט, רק שני תפקידים, 16 אחרונות. מה שהבעלים כתב שם נחשב כמו שכתב בוואטסאפ (owner)
export function appHistory(list) {
  return (Array.isArray(list) ? list : [])
    .filter((h) => h && (h.role === "user" || h.role === "assistant") && typeof h.text === "string" && h.text.trim())
    .slice(-16)
    .map((h) => ({ role: h.role, text: h.text.slice(0, 4000), ...(h.role === "user" ? { owner: h.text.slice(0, 4000) } : {}) }));
}

export async function ask(env, { text, history, turn }, store = db(env)) {
  text = String(text || "").trim().slice(0, 4000);
  if (!text) return { answer: "", note: "" };
  setOrigin(env.PUBLIC_URL);
  const bot = (await store.get("agentReports/bot")) || {};
  let timer;
  const run = think(env, store, waConfig(env), { ...bot, history: appHistory(history) }, text, null, () => {}, String(turn || `app-${Date.now()}`), [], "", false, "app");
  const late = new Promise((_, no) => (timer = setTimeout(() => no(new Error("לקח לי יותר מדי זמן")), Number(env.COMPANY_DEADLINE_MS) || DEADLINE_MS)));
  try {
    const { answer, used } = await Promise.race([run, late]);
    const note = awaitingYes((await store.get("agentReports/bot").catch(() => null))?.pending) || "";
    const at = new Date().toISOString();
    await store.update("agentReports/bot", (cur) => ({ log: [...(cur.log || []), { at, user: `[אפליקציה] ${text}`, shula: answer, ...(used.length ? { tools: used } : {}) }].slice(-80) })).catch(() => {});
    return { answer, note };
  } finally {
    clearTimeout(timer);
  }
}

// מה שהסוכנים שלחו לבעלים בשבוע האחרון (סורק, באגים, רעיונות, פרסום, המפקח, קלוד) — מסמך אחד, בלי עלות קריאה נוספת
export async function reports(env, store = db(env), now = Date.now()) {
  const bot = (await store.get("agentReports/bot")) || {};
  return Object.entries(outboxMap(bot.outbox))
    .filter(([, o]) => o && typeof o.text === "string" && now - Date.parse(o.at) < 7 * DAY)
    .map(([agent, o]) => ({ agent, at: o.at, text: o.text.slice(0, 3500) }))
    .sort((a, b) => a.at.localeCompare(b.at));
}

export class Company extends WorkerEntrypoint {
  ask(req) {
    return ask(this.env, req || {});
  }
  reports() {
    return reports(this.env);
  }
}
