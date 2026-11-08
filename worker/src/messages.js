// ✉️ הודעות שהבעלים מכתיב לשולה — לאנשים לפי שם, לכל המאמנים, או למספר — עכשיו או בשעה שנקבעה.
// למאמנים ולמנהלים שולה שולחת בעצמה, מהמספר שלה (תבנית club_message) — הבעלים ביקש בלי לחיצה נוספת (10.10.2026).
// להורים ולמספרים אחרים: שולה מחזירה לבעלים קישור wa.me לכל נמען, והוא לוחץ "שלח" — הלחיצה היא האישור.
// אם השליחה הישירה נכשלה (למשל המספר לא ברשימת הנמענים של מספר הניסיון ב-Meta) — הבעלים מקבל קישור במקום.
// מתוזמנות נשמרות ב-agentReports/bot.scheduled, ובשעה שנקבעה הקישורים מגיעים אליו מה-cron (wrangler.toml).
import { waLink } from "../../agents/lib/whatsapp.mjs";
import { normalizePhone, isValidPhone } from "../../agents/lib/analysis.mjs";
import { TEMPLATES } from "../../agents/templates.mjs";
import { israelToUtc } from "./time.js";
import { confirmed, findGroup, ownerWrote, sameSound } from "./tools.js";
import { drainQueue } from "./queue.js";
import { watchReads, staffSend } from "./reminders.js";

const RESEND_MS = 15 * 60 * 1000; // "כן" אחרי שליחה שלח את אותה הודעה פעם שנייה (3.11)
const COACHES = /^(כל )?ה?מאמנים$|^(כל )?ה?מדריכים$|^צוות$/;
const role = (u) => String(u.role || "").trim().toLowerCase();
const isStaff = (u) => !u.deleted && !!u.name && ["coach", "admin"].includes(role(u));
export const staffNames = (users) => users.filter(isStaff).map((u) => u.name);

// מי זה מי, מהאפליקציה ולא מהקוד (הריפו ציבורי). בלי זה שולה דיברה על הבעלים כעל מאמן אחר ועצרה לו הודעות (1.11)
export function teamNote(users, ownerPhone) {
  const me = users.filter(isStaff).find((u) => normalizePhone(u.phone) === normalizePhone(ownerPhone));
  const team = staffNames(users).filter((n) => n !== me?.name);
  return `\n\nמי זה מי: הבעלים שאת מדברת איתו הוא ${me?.name || "מנהל המועדון"}, גבר. פונים אליו ישירות בלשון זכר, בלי המילה "הבעלים". כשהשם שלו מופיע ברשימות, כמאמן או כנמען, זה הוא עצמו.${team.length ? ` צוות המועדון באפליקציה: ${team.join(", ")}.` : ""} הודעה לאדם: ישר send_message עם השם כמו שהוא אמר, הכלי מזהה כתיב שונה. בלי להחליף שם באדם אחר מהרשימה: אם הכלי לא מצא, שואלים אותו. כשהוא שואל על עצמו, עונים "זה אתה".`;
}

// "שם", "מאמנים", "קבוצת X" (ההורים של כל השחקנים הפעילים בקבוצה), או מספר → [{name, phone}] + שמות שלא נמצאו / לא חד-משמעיים
async function resolve(store, to) {
  const [users, players] = await Promise.all([store.list("users"), store.list("players")]);
  const people = [
    ...users.filter((u) => !u.deleted).map((u) => ({ name: u.name || "", phone: u.phone, uid: u.id, staff: ["coach", "admin"].includes(role(u)) })),
    ...players.filter((p) => !p.deleted).map((p) => ({ name: p.name || "", phone: p.parentPhone })),
  ];
  const out = [];
  const problems = [];
  const similar = [];
  for (const q of to.map((x) => String(x).trim()).filter(Boolean)) {
    const group = q.match(/^קבוצ(?:ת|ה)\s+(.+)/);
    if (COACHES.test(q)) out.push(...people.filter((p) => p.staff));
    else if (group) {
      const { g, roster } = await findGroup(store, group[1], undefined, players);
      if (g) out.push(...roster.map((p) => ({ name: p.name || "", phone: p.parentPhone })));
      else problems.push(roster);
    } else if (isValidPhone(q)) out.push(people.find((p) => p.staff && normalizePhone(p.phone) === normalizePhone(q)) || { name: q, phone: q });
    else {
      const hits = people.filter((p) => p.name.includes(q));
      const exact = hits.filter((p) => p.name === q);
      const staff = hits.filter((p) => p.staff);
      if (hits.length === 1 || exact.length === 1) out.push(exact[0] || hits[0]);
      // "דניאל" כשיש מדריך אחד בשם הזה ועוד שחקנים — הכוונה למדריך
      else if (staff.length === 1) out.push(staff[0]);
      else if (hits.length) problems.push(`"${q}" מתאים לכמה: ${hits.map((h) => h.name).join(", ")}`);
      else {
        const crew = people.filter((p) => p.staff);
        const sounds = crew.filter((p) => sameSound(p.name).includes(sameSound(q)));
        // שם משפחה לבד יכול להיות הורה אחר, אז רק מציעים ולא שולחים
        const last = q.split(/\s+/).at(-1);
        const family = last.length > 2 && last !== q ? crew.filter((p) => sameSound(p.name).includes(sameSound(last))) : [];
        if (sounds.length === 1) out.push(sounds[0]);
        else if (family.length === 1) similar.push(family[0]);
        else problems.push(`"${q}" לא נמצא`);
      }
    }
  }
  const seen = new Set();
  const recipients = [];
  for (const p of out) {
    if (!isValidPhone(p.phone || "")) problems.push(`ל${p.name} אין טלפון שמור`);
    else if (!seen.has(normalizePhone(p.phone))) {
      seen.add(normalizePhone(p.phone));
      recipients.push({ name: p.name, phone: normalizePhone(p.phone), staff: !!p.staff });
    }
  }
  return { recipients, problems, similar };
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
      "שולח הודעת וואטסאפ שהבעלים הכתיב. למאמנים ולמנהלים (עכשיו, בלי at) — שולה שולחת בעצמה מהמספר שלה, בלי אישור נוסף. הודעה כזאת יוצאת מיד ואי אפשר לבטל אותה: אם הבעלים מתקן אחרי ששלחת (״רק 1 ו-2״, ״בלי הסעיף על...״), להגיד לו בפירוש שההודעה הקודמת כבר יצאה כמו שהיא, ולשלוח למאמן רק תיקון קצר (על מה להתעלם) — לא את כל ההודעה שוב. להורים ולמספרים — מחזיר קישור לכל נמען, שפותח את הוואטסאפ של הבעלים עם הטקסט מוכן. למסור לבעלים בדיוק מה הכלי החזיר: מי קיבל ממך ומי צריך קישור. to = רשימה של שמות מלאים (מאמן/משתמש/שחקן — להורה), 'מאמנים' לכל הצוות, 'קבוצת <שם>' לכל ההורים בקבוצה, או מספרי טלפון. at = YYYY-MM-DDTHH:MM שעון ישראל לשליחה מתוזמנת (בלי = עכשיו). בשעה שנקבעה הקישורים יגיעו לבעלים. את הקישורים להעביר לו כמו שהם, כל אחד בשורה. לקבוצת וואטסאפ אין קישור — להציע לו להעתיק את הנוסח לקבוצה.",
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

export function makeMessageTools({ store, wa, lastOwnerText = "", turn, ownerRecent = lastOwnerText }) {
  return {
    async preview_recipients({ to }) {
      const { recipients, problems } = await resolve(store, to);
      return JSON.stringify({ recipients: recipients.map((r, i) => `${i + 1}. ${r.name} (…${r.phone.slice(-4)})`), problems });
    },

    async send_message({ to, text, at }) {
      const { recipients, problems, similar } = await resolve(store, to);
      if (!recipients.length && similar.length === 1 && isValidPhone(similar[0].phone || "")) {
        await confirmed(store, "message", { to: [normalizePhone(similar[0].phone)], text, at: at || "" }, lastOwnerText, turn);
        return `לא נשלח עדיין: השם לא נמצא, אבל יש בצוות את ${similar[0].name}. לשאול "לשלוח ל${similar[0].name}?" עם הנוסח. אחרי "כן": send_message עם השם הזה ואותו נוסח בדיוק.`;
      }
      if (!recipients.length) return `לא נשלח: אין נמענים. ${problems.join("; ")}`;
      const note = problems.length ? ` (דילגתי: ${problems.join("; ")})` : "";
      // שעה לא תקינה או שכבר עברה — שגיאה מפורשת, לא קישורים מיידיים שהבעלים לא ביקש עכשיו
      if (at && !validLocal(at)) return `לא נשלח ולא תוזמן: השעה "${at}" לא תקינה (צריך YYYY-MM-DDTHH:MM שעון ישראל).`;
      const due = at && israelToUtcIso(at);
      if (at && due <= new Date().toISOString()) return `לא נשלח ולא תוזמן: ${at.replace("T", " ")} כבר עבר. לשליחה עכשיו — לקרוא שוב בלי at.`;
      // הודעה שיוצאת משולה למאמנים: מיד אם הבעלים כתב את הנוסח בעצמו, אחרת רק אחרי "כן" נפרד
      // (מגן מטקסט שהוזרק דרך שם של קבוצה/שחקן). קישורים להורים — הבעלים לוחץ בעצמו, אין צורך.
      // יעד שהוא לא הזכיר: 3.11 "תשלחי לדני" יצא למאמן עם שם דומה, כי הנוסח היה שלו
      const said = sameSound(ownerRecent).split(/[^\p{L}\p{N}]+/u).flatMap((w) => [w, w.slice(1)]);
      const named = (r) => to.some((q) => COACHES.test(q)) || r.name.split(/\s+/).some((w) => said.includes(sameSound(w))) || ownerRecent.replace(/\D/g, "").includes(r.phone.slice(-9));
      const sentKey = (r) => `${r.phone}|${text.trim()}`.slice(0, 200);
      const again = !at && !/שוב/.test(lastOwnerText) && (await store.get("agentReports/bot"))?.recentSends || {};
      const dup = recipients.find((r) => Date.now() - Date.parse(again[sentKey(r)] || 0) < RESEND_MS);
      if (dup) return `לא נשלח שוב: בדיוק ההודעה הזאת כבר יצאה ל${dup.name} לפני כמה דקות. להגיד לו את זה. לשליחה חוזרת הוא צריך לכתוב "שוב".`;
      if (recipients.some((r) => r.staff) && (!ownerWrote(text, ownerRecent) || !recipients.every((r) => !r.staff || named(r)))
        && !(await confirmed(store, "message", { to: recipients.map((r) => r.phone), text, at: at || "" }, lastOwnerText, turn)))
        return `לא נשלח עדיין. להציג לבעלים את הנוסח ואת הנמענים (${recipients.map((r) => r.name).join(", ")}) ולשאול "לשלוח?". אחרי "כן" — לקרוא שוב עם אותם פרטים בדיוק.`;
      if (at) {
        const id = Math.random().toString(36).slice(2, 7);
        await store.update("agentReports/bot", (bot) => ({ scheduled: [...(bot.scheduled || []), { id, due, at, text, recipients }] }));
        return `תוזמן ל-${at.replace("T", " ")} (מזהה ${id}) ל: ${recipients.map((r) => r.name).join(", ")}${note}`;
      }
      const direct = [], links = [];
      const watch = {};
      for (const r of recipients) {
        if (!r.staff || !wa) { links.push(r); continue; }
        try {
          const wamid = await staffSend(store, wa, { phone: r.phone, name: r.name, uid: r.uid }, text);
          if (wamid) watch[wamid] = { who: r.name, phone: r.phone, text, what: `"${text.replace(/\s+/g, " ").slice(0, 40)}"`, at: new Date().toISOString() };
          direct.push(`${r.name}: נשלח משולה ✓`);
        } catch (e) {
          direct.push(`${r.name}: שולה לא הצליחה לשלוח (${e.message}), אפשר בקישור למטה`);
          links.push(r);
        }
      }
      // הבעלים יקבל "✓✓ קרא" כשהמאמן פותח את ההודעה; כישלון כאן לא מבטל את מה שכבר נשלח
      if (Object.keys(watch).length) await watchReads(store, watch).catch(() => {});
      if (Object.keys(watch).length) await store.update("agentReports/bot", (bot) => ({ recentSends: Object.fromEntries([...Object.entries(bot.recentSends || {}).filter(([, t]) => Date.now() - Date.parse(t) < RESEND_MS), ...recipients.filter((r) => r.staff).map((r) => [sentKey(r), new Date().toISOString()])]) })).catch(() => {});
      // ✓ = Meta קיבלה, לא שנמסר. כישלון מסירה מגיע אחר כך ב-webhook (readReceipts) ומעדכן את הבעלים
      if (Object.keys(watch).length) direct.push("(✓ = יצא לוואטסאפ. אם לא יימסר — תגיע הודעת ❌ עם הסיבה)");
      return [direct.join("\n"), links.length ? `ללחוץ על כל קישור ואז "שלח":\n${deliver(links, text)}` : ""].filter(Boolean).join("\n") + note;
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

// תזכורות מ-shula-tools נכנסות לתור scheduled, ומשם sendDue שולח (כולל תבנית מחוץ ל-24 שעות).
// מאשרים רק אחרי שהכתיבה הצליחה; toolReminders מונע כפילות אם האישור נכשל והתזכורת חוזרת בריצה הבאה.
export async function queueToolReminders(tools, store, now = new Date()) {
  if (!tools) return "reminders: off";
  const pending = await tools.pendingReminders();
  if (!pending.length) return "reminders: 0";
  const stamp = now.toISOString();
  await store.update("agentReports/bot", (bot) => {
    const seen = bot.toolReminders || [];
    const fresh = pending.filter((r) => !seen.includes(r.id));
    if (!fresh.length) return null;
    return {
      scheduled: [...(bot.scheduled || []), ...fresh.map((r) => ({ id: `tools-${r.id}`, due: stamp, at: stamp.slice(0, 16), text: r.text, remind: true, recipients: [] }))],
      toolReminders: [...seen, ...fresh.map((r) => r.id)].slice(-200),
    };
  });
  await tools.ackReminders(pending.map((r) => r.id));
  return `reminders: ${pending.length}`;
}

// התבניות שעוד לא הוגשו ל-Meta — מגיש מתוך ה-worker (לא תלוי בסודות בגיטהאב). WABA = מזהה, לא סוד.
export async function ensureTemplates(env) {
  const waba = env.WHATSAPP_WABA_ID;
  const g = (path, init) => fetch(`https://graph.facebook.com/v24.0/${path}`, { ...init, headers: { authorization: `Bearer ${env.WHATSAPP_TOKEN}`, "content-type": "application/json" } }).then((r) => r.json());
  const have = new Set(((await g(`${waba}/message_templates?fields=name,language&limit=200`)).data || []).filter((t) => t.language === "he").map((t) => t.name));
  const out = [];
  for (const [name, t] of Object.entries(TEMPLATES)) {
    if (have.has(name)) continue;
    const r = await g(`${waba}/message_templates`, { method: "POST", body: JSON.stringify({ name, language: "he", category: t.category, allow_category_change: false, components: [{ type: "BODY", text: t.body, example: { body_text: [t.example] } }] }) });
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
