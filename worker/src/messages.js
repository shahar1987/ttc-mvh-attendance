// ✉️ הודעות שהבעלים מכתיב לשולה — לאנשים לפי שם, לכל המאמנים, או למספר — עכשיו או בשעה שנקבעה.
// ההודעות יוצאות מהמספר של הבעלים: שולה מחזירה לו קישור wa.me לכל נמען, והוא לוחץ "שלח" — הלחיצה היא האישור.
// מתוזמנות נשמרות ב-agentReports/bot.scheduled, ובשעה שנקבעה הקישורים מגיעים אליו מה-cron (wrangler.toml).
import { waLink } from "../../agents/lib/whatsapp.mjs";
import { normalizePhone, isValidPhone } from "../../agents/lib/analysis.mjs";
import { TEMPLATES } from "../../agents/templates.mjs";
import { israelToUtc } from "./time.js";
import { confirmed, findGroup } from "./tools.js";
import { drainQueue } from "./queue.js";

const COACHES = /^(כל )?ה?מאמנים$|^(כל )?ה?מדריכים$|^צוות$/;
const role = (u) => String(u.role || "").trim().toLowerCase();

// "שם", "מאמנים", "קבוצת X" (ההורים של כל השחקנים הפעילים בקבוצה), או מספר → [{name, phone}] + שמות שלא נמצאו / לא חד-משמעיים
async function resolve(store, to) {
  const [users, players] = await Promise.all([store.list("users"), store.list("players")]);
  const people = [
    ...users.filter((u) => !u.deleted).map((u) => ({ name: u.name || "", phone: u.phone, staff: ["coach", "admin"].includes(role(u)) })),
    ...players.filter((p) => !p.deleted).map((p) => ({ name: p.name || "", phone: p.parentPhone })),
  ];
  const out = [];
  const problems = [];
  for (const q of to.map((x) => String(x).trim()).filter(Boolean)) {
    const group = q.match(/^קבוצ(?:ת|ה)\s+(.+)/);
    if (COACHES.test(q)) out.push(...people.filter((p) => p.staff));
    else if (group) {
      const { g, roster } = await findGroup(store, group[1], undefined, players);
      if (g) out.push(...roster.map((p) => ({ name: p.name || "", phone: p.parentPhone })));
      else problems.push(roster);
    } else if (isValidPhone(q)) out.push({ name: q, phone: q });
    else {
      const hits = people.filter((p) => p.name.includes(q));
      const exact = hits.filter((p) => p.name === q);
      if (hits.length === 1 || exact.length === 1) out.push(exact[0] || hits[0]);
      else problems.push(hits.length ? `"${q}" מתאים לכמה: ${hits.map((h) => h.name).join(", ")}` : `"${q}" לא נמצא`);
    }
  }
  const seen = new Set();
  const recipients = [];
  for (const p of out) {
    if (!isValidPhone(p.phone || "")) problems.push(`ל${p.name} אין טלפון שמור`);
    else if (!seen.has(normalizePhone(p.phone))) {
      seen.add(normalizePhone(p.phone));
      recipients.push({ name: p.name, phone: normalizePhone(p.phone) });
    }
  }
  return { recipients, problems };
}

const deliver = (recipients, text) => recipients.map((r) => `${r.name}: ${waLink(r.phone, text)}`).join("\n");

// שעון ישראל → ISO UTC (time.js — פונקציה אחת משותפת עם meta.js, נכונה גם סביב שעון קיץ/חורף)
const israelToUtcIso = (local) => israelToUtc(local).toISOString();
const LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
// בודק גם שהתאריך אמיתי: 2026-02-31T10:00 או 25:00 נדחים (Date.parse היה מגלגל אותם הלאה)
const validLocal = (at) => {
  if (!LOCAL.test(at || "")) return false;
  const d = new Date(`${at}:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 16) === at;
};

export const MESSAGE_TOOL_DEFS = [
  {
    name: "send_message",
    description:
      "מכין הודעת וואטסאפ שהבעלים שולח מהמספר שלו: מחזיר קישור לכל נמען, שפותח את הוואטסאפ שלו עם הטקסט מוכן. to = רשימה של שמות מלאים (מאמן/משתמש/שחקן — להורה), 'מאמנים' לכל הצוות, 'קבוצת <שם>' לכל ההורים בקבוצה, או מספרי טלפון. at = YYYY-MM-DDTHH:MM שעון ישראל לשליחה מתוזמנת (בלי = עכשיו). בשעה שנקבעה הקישורים יגיעו לבעלים. את הקישורים להעביר לו כמו שהם, כל אחד בשורה. לקבוצת וואטסאפ אין קישור — להציע לו להעתיק את הנוסח לקבוצה.",
    input_schema: {
      type: "object",
      properties: { to: { type: "array", items: { type: "string" } }, text: { type: "string" }, at: { type: "string" } },
      required: ["to", "text"],
      additionalProperties: false,
    },
  },
  {
    name: "preview_recipients",
    description: "רשימה ממוספרת של מי יקבל (שם ומספר מוסתר), באותו פורמט to של send_message. כשהבעלים רוצה לבחור מתוך רשימה (למשל 'תראי לי את קבוצת מתחילים'): להציג לו את הרשימה הממוספרת, והוא עונה במספרים ('1,3'). אז לקרוא ל-send_message עם השמות המלאים של המספרים שבחר.",
    input_schema: { type: "object", properties: { to: { type: "array", items: { type: "string" } } }, required: ["to"], additionalProperties: false },
  },
  {
    name: "remind_me",
    description: "תזכורת לבעלים עצמו: בשעה שנקבעה שולה שולחת לו את הטקסט בוואטסאפ. at = YYYY-MM-DDTHH:MM שעון ישראל. text = על מה להזכיר. רק הכלי שומר — בלי קריאה אליו אין תזכורת.",
    input_schema: { type: "object", properties: { at: { type: "string" }, text: { type: "string" } }, required: ["at", "text"], additionalProperties: false },
  },
  {
    name: "scheduled_messages",
    description: "ההודעות המתוזמנות שעוד לא יצאו. cancel = מזהה לביטול — רק אחרי שהבעלים אישר (\"כן\") בהודעה נפרדת: הקריאה הראשונה מחזירה מה יבוטל, ואחרי \"כן\" קוראים שוב עם אותו מזהה.",
    input_schema: { type: "object", properties: { cancel: { type: "string" } }, additionalProperties: false },
  },
];

export function makeMessageTools({ store, lastOwnerText = "", turn }) {
  return {
    async preview_recipients({ to }) {
      const { recipients, problems } = await resolve(store, to);
      return JSON.stringify({ recipients: recipients.map((r, i) => `${i + 1}. ${r.name} (…${r.phone.slice(-4)})`), problems });
    },

    async send_message({ to, text, at }) {
      const { recipients, problems } = await resolve(store, to);
      if (!recipients.length) return `לא נשלח: אין נמענים. ${problems.join("; ")}`;
      const note = problems.length ? ` (דילגתי: ${problems.join("; ")})` : "";
      if (at) {
        // שעה לא תקינה או שכבר עברה — שגיאה מפורשת, לא קישורים מיידיים שהבעלים לא ביקש עכשיו
        if (!validLocal(at)) return `לא נשלח ולא תוזמן: השעה "${at}" לא תקינה (צריך YYYY-MM-DDTHH:MM שעון ישראל).`;
        const due = israelToUtcIso(at);
        if (due <= new Date().toISOString()) return `לא נשלח ולא תוזמן: ${at.replace("T", " ")} כבר עבר. לשליחה עכשיו — לקרוא שוב בלי at.`;
        const id = Math.random().toString(36).slice(2, 7);
        await store.update("agentReports/bot", (bot) => ({ scheduled: [...(bot.scheduled || []), { id, due, at, text, recipients }] }));
        return `תוזמן ל-${at.replace("T", " ")} (מזהה ${id}) ל: ${recipients.map((r) => r.name).join(", ")}${note}`;
      }
      return `ללחוץ על כל קישור ואז "שלח":\n${deliver(recipients, text)}${note}`;
    },

    async remind_me({ at, text }) {
      if (!validLocal(at) || !String(text || "").trim()) return "לא נשמרה תזכורת: צריך שעה בפורמט YYYY-MM-DDTHH:MM וטקסט.";
      const nowIso = new Date().toISOString();
      const orig = israelToUtc(at);
      if (orig.toISOString() <= nowIso) return `לא נשמרה תזכורת: ${at.replace("T", " ")} כבר עבר.`;
      // ה-cron רץ כל רבע שעה — מעגלים למטה כדי שהתזכורת תגיע בזמן או קצת לפני, אף פעם לא אחרי.
      // אם העיגול נופל לפני עכשיו (למשל 15:50 כשעכשיו 15:47) — השעה עוד לא עברה, אז מגיעה בריצה הבאה.
      const d = new Date(orig);
      d.setUTCMinutes(d.getUTCMinutes() - (d.getUTCMinutes() % 15));
      const due = d.toISOString() <= nowIso ? nowIso : d.toISOString();
      const id = Math.random().toString(36).slice(2, 7);
      await store.update("agentReports/bot", (bot) => ({ scheduled: [...(bot.scheduled || []), { id, due, at, text, remind: true, recipients: [] }] }));
      return `⏰ נשמרה תזכורת ל-${at.replace("T", " ")}: ${text} (מזהה ${id})`;
    },

    async scheduled_messages({ cancel } = {}) {
      const list = ((await store.get("agentReports/bot")) || {}).scheduled || [];
      if (cancel) {
        const m = list.find((x) => x.id === cancel);
        if (!m) return `אין הודעה מתוזמנת עם המזהה ${cancel}.`;
        // ביטול רק אחרי "כן" נפרד של הבעלים — טקסט חיצוני (תשובה מקלוד, הודעת סוכן) לא יכול לבטל לבד
        if (!(await confirmed(store, "cancel", { cancel }, lastOwnerText, turn)))
          return `עוד לא בוטל. להציג לבעלים מה יבוטל (${m.at.replace("T", " ")}: ${m.text}) ולשאול "לבטל?". אחרי "כן" — לקרוא שוב עם אותו מזהה.`;
        let found = false;
        await store.update("agentReports/bot", (bot) => {
          const cur = bot.scheduled || [];
          found = cur.some((x) => x.id === cancel);
          return found ? { scheduled: cur.filter((x) => x.id !== cancel) } : null;
        });
        return found ? `בוטלה ההודעה ${cancel}.` : `ההודעה ${cancel} כבר יצאה או בוטלה.`;
      }
      return list.length ? JSON.stringify(list.map((m) => ({ id: m.id, at: m.at, to: m.remind ? ["תזכורת לבעלים"] : m.recipients.map((r) => r.name), text: m.text }))) : "אין הודעות מתוזמנות.";
    },
  };
}

// מה-cron: מחזיר את הקישורים של מה שהגיע זמנו. notify(lines) שולח אותם לבעלים (index.js);
// מה שהגיע זמנו יוצא מהתור רק אחרי ש-notify הצליח. אם נכשל — נשאר לריצה הבאה (עד 5 ניסיונות).
export async function sendDue(store, now = new Date(), notify = async () => {}) {
  const fmt = (m) => (m.remind ? `⏰ *תזכורת:* ${m.text}` : `• ${m.at.replace("T", " ")}:\n${deliver(m.recipients, m.text)}`);
  let lines = [];
  await drainQueue(store, "agentReports/bot", "scheduled", {
    now,
    due: (m) => m.due <= now.toISOString(),
    run: async (items) => {
      lines = items.map(fmt);
      await notify(lines);
      return items.map((m) => m.id);
    },
  });
  return lines;
}

// התבניות שעוד לא הוגשו ל-Meta — מגיש מתוך ה-worker (לא תלוי בסודות בגיטהאב). WABA = מזהה, לא סוד.
export async function ensureTemplates(env) {
  const waba = env.WHATSAPP_WABA_ID;
  const g = (path, init) => fetch(`https://graph.facebook.com/v24.0/${path}`, { ...init, headers: { authorization: `Bearer ${env.WHATSAPP_TOKEN}`, "content-type": "application/json" } }).then((r) => r.json());
  const have = new Set(((await g(`${waba}/message_templates?fields=name,language&limit=200`)).data || []).filter((t) => t.language === "he").map((t) => t.name));
  const out = [];
  for (const [name, t] of Object.entries(TEMPLATES)) {
    if (have.has(name)) continue;
    const r = await g(`${waba}/message_templates`, { method: "POST", body: JSON.stringify({ name, language: "he", category: t.category, components: [{ type: "BODY", text: t.body, example: { body_text: [t.example] } }] }) });
    out.push(`${name}: ${r.status || r.error?.message || "?"}`);
  }
  return out;
}

// 🔌 Meta מפסיקה לפעמים להעביר לשולה את ההודעות הנכנסות, ואז שולה שותקת בלי שום שגיאה
// (2026-10-02: ה-WABA לא היה רשום לאפליקציה; 2026-10-07: שתיקה מ-9:53). נבדק כל רבע שעה:
// מה שאפשר לתקן — מתקנים ומדווחים. מה שלא — מדווחים, אותה בעיה לכל היותר פעם ב-6 שעות.
export async function ensureWebhook(env, store) {
  const { WHATSAPP_WABA_ID: waba, META_APP_ID: app, META_APP_SECRET: secret } = env;
  if (!waba || !app || !secret) return [];
  const g = async (path, token, init) => {
    const j = await fetch(`https://graph.facebook.com/v24.0/${path}`, { ...init, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" } }).then((r) => r.json());
    if (j.error) throw new Error(`Meta ${path}: ${j.error.message}`);
    return j;
  };
  const appToken = `${app}|${secret}`;
  const fixed = [], open = [];
  const subs = (await g(`${waba}/subscribed_apps`, env.WHATSAPP_TOKEN)).data || [];
  if (!subs.some((s) => s.whatsapp_business_api_data?.id === app)) {
    await g(`${waba}/subscribed_apps`, env.WHATSAPP_TOKEN, { method: "POST" });
    fixed.push("✅ חשבון הוואטסאפ לא היה מחובר לאפליקציה של שולה, ולכן ההודעות שלך לא הגיעו אליה. חיברתי מחדש.");
  }
  const hook = ((await g(`${app}/subscriptions`, appToken)).data || []).find((s) => s.object === "whatsapp_business_account");
  if (!hook) open.push("⚠️ אין webhook לוואטסאפ באפליקציה shula ב-Meta, אז הודעות לא מגיעות אליי. צריך להריץ את Agents setup.");
  else if (!hook.active || !(hook.fields || []).some((f) => (f.name || f) === "messages")) {
    await g(`${app}/subscriptions`, appToken, { method: "POST", body: JSON.stringify({ object: "whatsapp_business_account", callback_url: hook.callback_url, verify_token: env.WEBHOOK_VERIFY_TOKEN, fields: "messages" }) });
    fixed.push("✅ קבלת ההודעות הנכנסות הייתה כבויה ב-Meta. הפעלתי מחדש.");
  }
  const bot = (await store.get("agentReports/bot")) || {};
  if (bot.badSignatureAt && Date.now() - new Date(bot.badSignatureAt).getTime() < 30 * 60 * 1000)
    open.push("⚠️ Meta שולחת לי הודעות אבל החתימה לא מתאימה, אז אני דוחה אותן. כנראה ה-App Secret של האפליקציה shula הוחלף, וצריך לעדכן את META_APP_SECRET.");
  if (fixed.length) fixed.push("הודעות ששלחת קודם לא הגיעו אליי, אפשר לשלוח אותן שוב.");
  const key = open.join("|");
  const repeat = key && bot.webhookOpen?.key === key && Date.now() - new Date(bot.webhookOpen.at).getTime() < 6 * 3600 * 1000;
  if (key && !repeat) await store.merge("agentReports/bot", { webhookOpen: { key, at: new Date().toISOString() } });
  return [...fixed, ...(repeat ? [] : open)];
}
