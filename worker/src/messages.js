// ✉️ הודעות שהבעלים מכתיב לשולה — לאנשים לפי שם, לכל המאמנים, או למספר — עכשיו או בשעה שנקבעה.
// יוצא רק אחרי "שלח"/"כן" על הנוסח והנמענים שהוצגו לו. מתוזמנות נשמרות ב-agentReports/bot.scheduled
// ויוצאות מה-cron (wrangler.toml). וואטסאפ מרשה לעסק לפתוח שיחה רק בתבנית מאושרת — club_message.
import { confirmed } from "./tools.js";
import { sendTemplate } from "../../agents/lib/whatsapp.mjs";
import { normalizePhone, isValidPhone } from "../../agents/lib/analysis.mjs";
import { TEMPLATES } from "../../agents/templates.mjs";

const COACHES = /^(כל )?ה?מאמנים$|^(כל )?ה?מדריכים$|^צוות$/;
const role = (u) => String(u.role || "").trim().toLowerCase();

// "שם", "מאמנים", או מספר → [{name, phone}] + שמות שלא נמצאו / לא חד-משמעיים
async function resolve(store, to) {
  const [users, players] = await Promise.all([store.list("users"), store.list("players")]);
  const people = [
    ...users.filter((u) => !u.deleted).map((u) => ({ name: u.name || "", phone: u.phone, staff: ["coach", "admin"].includes(role(u)) })),
    ...players.filter((p) => !p.deleted).map((p) => ({ name: p.name || "", phone: p.parentPhone })),
  ];
  const out = [];
  const problems = [];
  for (const q of to.map((x) => String(x).trim()).filter(Boolean)) {
    if (COACHES.test(q)) out.push(...people.filter((p) => p.staff));
    else if (isValidPhone(q)) out.push({ name: q, phone: q });
    else {
      const hits = people.filter((p) => p.name.includes(q));
      if (hits.length === 1) out.push(hits[0]);
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

async function deliver(wa, recipients, text) {
  const lines = [];
  for (const r of recipients) {
    try {
      await sendTemplate(wa, r.phone, "club_message", [text]);
      lines.push(`${r.name} ✓`);
    } catch (e) {
      lines.push(`${r.name}: נכשל (${e.message})`);
    }
  }
  return lines.join(" · ");
}

// שעון ישראל → ISO UTC. "2026-10-05T18:00" (מניחים +03:00 בקיץ / +02:00 בחורף לפי Intl)
function israelToUtc(local) {
  const guess = new Date(`${local}:00Z`);
  const offset = new Date(guess.toLocaleString("en-US", { timeZone: "Asia/Jerusalem" })) - new Date(guess.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(guess - offset).toISOString();
}

export const MESSAGE_TOOL_DEFS = [
  {
    name: "send_message",
    description:
      "שולח הודעת וואטסאפ בשם המועדון. to = רשימה של שמות (מאמן/משתמש/שחקן — להורה), 'מאמנים' לכל הצוות, או מספרי טלפון. at = YYYY-MM-DDTHH:MM שעון ישראל לשליחה מתוזמנת (בלי = עכשיו). מותר רק אחרי שהבעלים ענה 'שלח'/'כן' על הנוסח המדויק, הנמענים והשעה שהצגת לו. אי אפשר לשלוח לקבוצת וואטסאפ — שולחים לכל אחד בנפרד.",
    input_schema: {
      type: "object",
      properties: { to: { type: "array", items: { type: "string" } }, text: { type: "string" }, at: { type: "string" } },
      required: ["to", "text"],
      additionalProperties: false,
    },
  },
  {
    name: "preview_recipients",
    description: "מי יקבל את ההודעה (שם ומספר מוסתר) לפני ששואלים את הבעלים — באותו פורמט to של send_message.",
    input_schema: { type: "object", properties: { to: { type: "array", items: { type: "string" } } }, required: ["to"], additionalProperties: false },
  },
  {
    name: "scheduled_messages",
    description: "ההודעות המתוזמנות שעוד לא יצאו. cancel = מזהה לביטול (מותר בלי אישור נוסף).",
    input_schema: { type: "object", properties: { cancel: { type: "string" } }, additionalProperties: false },
  },
];

export function makeMessageTools({ store, wa, lastOwnerText, turn }) {
  return {
    async preview_recipients({ to }) {
      const { recipients, problems } = await resolve(store, to);
      return JSON.stringify({ recipients: recipients.map((r) => `${r.name} (…${r.phone.slice(-4)})`), problems });
    },

    async send_message({ to, text, at }) {
      const { recipients, problems } = await resolve(store, to);
      if (!recipients.length) return `לא נשלח: אין נמענים. ${problems.join("; ")}`;
      if (!(await confirmed(store, "message", { to, text, at }, lastOwnerText, turn)))
        return `עוד לא נשלח. להציג לבעלים בדיוק: הנוסח, הנמענים (${recipients.map((r) => r.name).join(", ")}) והשעה, ולשאול "לשלוח?". אחרי "כן" — לקרוא שוב עם אותם פרטים בדיוק.`;
      const note = problems.length ? ` (דילגתי: ${problems.join("; ")})` : "";
      if (at && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(at)) {
        const due = israelToUtc(at);
        if (due > new Date().toISOString()) {
          const bot = (await store.get("agentReports/bot")) || {};
          const id = Math.random().toString(36).slice(2, 7);
          await store.merge("agentReports/bot", { scheduled: [...(bot.scheduled || []), { id, due, at, text, recipients }] });
          return `תוזמן ל-${at.replace("T", " ")} (מזהה ${id}) ל: ${recipients.map((r) => r.name).join(", ")}${note}`;
        }
      }
      return `נשלח: ${await deliver(wa, recipients, text)}${note}`;
    },

    async scheduled_messages({ cancel } = {}) {
      const list = ((await store.get("agentReports/bot")) || {}).scheduled || [];
      if (cancel) {
        const left = list.filter((m) => m.id !== cancel);
        if (left.length === list.length) return `אין הודעה מתוזמנת עם המזהה ${cancel}.`;
        await store.merge("agentReports/bot", { scheduled: left });
        return `בוטלה ההודעה ${cancel}.`;
      }
      return list.length ? JSON.stringify(list.map((m) => ({ id: m.id, at: m.at, to: m.recipients.map((r) => r.name), text: m.text }))) : "אין הודעות מתוזמנות.";
    },
  };
}

// מה-cron: שולח את מה שהגיע זמנו ומדווח לבעלים
export async function sendDue(store, wa, now = new Date()) {
  const bot = (await store.get("agentReports/bot")) || {};
  const due = (bot.scheduled || []).filter((m) => m.due <= now.toISOString());
  if (!due.length) return [];
  await store.merge("agentReports/bot", { scheduled: (bot.scheduled || []).filter((m) => m.due > now.toISOString()) });
  const lines = [];
  for (const m of due) lines.push(`• ${m.at.replace("T", " ")}: ${await deliver(wa, m.recipients, m.text)}`);
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
