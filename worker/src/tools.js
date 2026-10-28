// הכלים שהסוכן הראשי (Claude) יכול להפעיל. כל גישה לנתונים עוברת כאן —
// Claude לא נוגע ב-Firestore או בוואטסאפ ישירות.
import { absenceTemplate, renderTemplate } from "../../agents/templates.mjs";
import { waLink } from "../../agents/lib/whatsapp.mjs";
import { dropoutRisk, onlyHeldTrainings, playerHistory, israelToday, isValidPhone, normalizePhone, topActions } from "../../agents/lib/analysis.mjs";
import { DELETE } from "./firestore.js";

const AGENT_HE = { scan: "הסורק היומי (דוח הבוקר)", bugcheck: "בודק הבאגים", ideas: "סוכן הרעיונות", supervisor: "המפקח", content: "סוכן הפרסום" };
const AGENTS = Object.keys(AGENT_HE);
const MAX_SEND = 40;
// הודעות להורים יוצאות רק כששולה אישרה במילים שלה, בהודעה האחרונה שכתבה
const APPROVE_RE = /(^|\s)(שלח|תשלח|שלחי|תשלחי|כן|אשר|מאשר|מאשרת|אישור)(\s|$|[.!,])/;
// "לא, אל תשלח עדיין" מכיל "תשלח" — שלילה או תנאי מבטלים את האישור (עדיף לשאול שוב מאשר לשלוח בטעות)
const DENY_RE = /(^|\s)(לא|אל|טרם|עוד לא|אם כן|רגע|חכה|חכי|תחכה|תחכי)(\s|$|[.!,?])/;
// שאלות כן/לא מגיעות עם "1. כן / 2. לא" (שולה, 23.10) — "1" לבד = כן
export const APPROVAL = { test: (t) => /^\s*1\s*[.!]?\s*$/.test(t || "") || (APPROVE_RE.test(t || "") && !DENY_RE.test(t || "")) };

// הבעלים כתב בעצמו את רוב המילים של הטקסט (בהודעה הזאת או באחרונות) — אז זה לא תוכן שהוזרק
// דרך שם של שחקן/קבוצה או תשובה חיצונית. מילה עם אות-תחילית (ה/ו/ל/ב/ש) נחשבת גם בלעדיה.
export function ownerWrote(text, ownerText) {
  const words = String(text || "").match(/[\p{L}\p{N}]{2,}/gu) || [];
  const o = String(ownerText || "");
  if (!words.length) return false;
  return words.filter((w) => o.includes(w) || (w.length > 3 && o.includes(w.slice(1)))).length / words.length >= 0.5;
}

// אישור בשני שלבים לפעולה שיוצאת החוצה: הקריאה הראשונה שומרת טיוטה ולא עושה כלום. רק אם הבעלים ענה "כן"
// בהודעה *אחרת* (לא באותה הודעה שבה ביקש — "תשלחי למאמנים..." מכיל "תשלחי") ועם אותם פרטים בדיוק — מאשרים.
// הכתיבה מותנית: שתי קריאות במקביל (Gemini מפעיל כמה כלים יחד) לא יכולות שתיהן "לצרוך" את אותו אישור.
// "כן" תקף רק 10 דקות אחרי שהשאלה נשאלה — "כן" לשאלה אחרת שעה אחר כך לא מפעיל טיוטה ישנה
const CONFIRM_TTL_MS = 10 * 60 * 1000;
export async function confirmed(store, kind, payload, ownerText, turn) {
  const key = JSON.stringify(payload);
  let ok = false;
  await store.update("agentReports/bot", (bot) => {
    const p = bot.pending?.[kind];
    const fresh = Date.now() - Date.parse(p?.askedAt || p?.at || 0) < CONFIRM_TTL_MS;
    ok = APPROVAL.test(ownerText || "") && p?.key === key && p.turn !== turn && fresh;
    const now = new Date().toISOString();
    return { pending: { ...(bot.pending || {}), [kind]: ok ? null : { key, turn, at: p?.key === key ? p.at || now : now, askedAt: now } } };
  });
  return ok;
}

// "כן" על בקשה שכבר הוצגה לבעלים, גם כשהמודל ניסח אותה מחדש בתור הבא (13.10: שלוש פעמים "כן" ושוב "להעביר לקלוד?",
// כי המפתח של confirmed הוא הנוסח המדויק). מחזיר את מה שהבעלים ראה ואישר — לא את הנוסח החדש.
export async function approvedShown(store, kind, ownerText, turn) {
  if (!APPROVAL.test(ownerText || "")) return null;
  let shown = null;
  await store.update("agentReports/bot", (bot) => {
    const p = bot.pending?.[kind];
    if (!p?.key || p.turn === turn || Date.now() - Date.parse(p.askedAt || p.at || 0) >= CONFIRM_TTL_MS) return null;
    shown = JSON.parse(p.key);
    return { pending: { ...bot.pending, [kind]: null } };
  });
  return shown;
}

// "שלחתי" מהבעלים — אחרי שלחץ על קישורי ההיעדרות
export const SENT_CONFIRM = /(שלחתי|שלחנו|נשלחו|נשלח הכל)/;
const NOT_SENT = /(לא|עוד לא|טרם)\s+(שלחתי|שלחנו|נשלחו|נשלח)/;

export const TOOL_DEFS = [
  {
    name: "get_daily_report",
    description:
      "הדוח האחרון של הסורק היומי: מי לא הגיע וממתין להודעה (רשימה ממוספרת), מי החסיר פעמיים ברצף, מי בסכנת נשירה. המספרים ברשימה הם אלה ששולה משתמשת בהם כשהיא אומרת 'שלח 1,3'.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_agent_results",
    description: "התוצאות האחרונות של שאר הסוכנים: bugcheck = בודק הבאגים; ideas = הרעיונות השבועיים; supervisor = מצב המפקח (מתי כל סוכן רץ ומה הבעיות); content = טיוטות הפרסום של השבוע (ממוספרות 1-3 עם נוסח פייסבוק, נוסח אינסטגרם ומועד). דוח הבוקר עצמו — get_daily_report.",
    input_schema: {
      type: "object",
      properties: { agent: { type: "string", enum: ["bugcheck", "ideas", "supervisor", "content"] } },
      required: ["agent"],
      additionalProperties: false,
    },
  },
  {
    name: "find_player",
    description: "חיפוש שחקן לפי שם (או חלק ממנו): קבוצה, האם פעיל, 12 האימונים האחרונים וסכנת נשירה.",
    input_schema: {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "set_player_phone",
    description:
      "שומר טלפון לשחקן באפליקציה (players.parentPhone; בקבוצות בוגרים זה הטלפון של השחקן עצמו). רק כשהבעלים כתב את המספר בעצמו. הודעות שחיכו למספר יוצאות בשליחה האוטומטית הבאה.",
    input_schema: {
      type: "object",
      properties: { name: { type: "string", description: "שם השחקן כמו באפליקציה" }, phone: { type: "string" } },
      required: ["name", "phone"],
      additionalProperties: false,
    },
  },
  {
    name: "send_absence_messages",
    description:
      "מכין קישורי וואטסאפ (wa.me) להודעות ההיעדרות לפי המספרים בדוח היומי. ההודעות יוצאות מהמספר של הבעלים כשהוא לוחץ על כל קישור ואז \"שלח\" — הבוט לא שולח בעצמו. אישור בשני שלבים: הקריאה הראשונה רק שומרת את הבקשה ומחזירה \"עוד לא\"; להציג לבעלים את הרשימה ולשאול \"להכין קישורים?\", ורק אחרי \"כן\" בהודעה נפרדת — לקרוא שוב עם אותם מספרים בדיוק. ההיעדרויות מסומנות כמטופלות רק אחרי שהבעלים כותב \"שלחתי\" (confirm_absence_sent).",
    input_schema: {
      type: "object",
      properties: {
        numbers: { type: "array", items: { type: "integer" }, description: "המספרים מהדוח. ריק = כולם" },
      },
      required: ["numbers"],
      additionalProperties: false,
    },
  },
  {
    name: "confirm_absence_sent",
    description: "אחרי שהבעלים כתב \"שלחתי\" על קישורי ההיעדרות שהוכנו (send_absence_messages): מסמן אותן כנשלחו, כמו לחיצה על \"נשלח\" באפליקציה. numbers = המספרים שנשלחו בפועל; ריק = כל הקישורים שהוכנו. לא לקרוא בלי \"שלחתי\" מהבעלים.",
    input_schema: {
      type: "object",
      properties: { numbers: { type: "array", items: { type: "integer" } } },
      required: ["numbers"],
      additionalProperties: false,
    },
  },
  {
    name: "skip_messages",
    description: "מסמן היעדרויות כמטופלות בלי לשלוח הודעה (למשל ששולה כבר דיברה עם ההורה), כמו כפתור 'טופל' באפליקציה.",
    input_schema: {
      type: "object",
      properties: { numbers: { type: "array", items: { type: "integer" } } },
      required: ["numbers"],
      additionalProperties: false,
    },
  },
  {
    name: "resolve_registration",
    description:
      "הצעות ההתאמה ברישום (registration בדוח היומי, מסומנות ר1, ר2...): שם בקובץ המתנ\"ס שכנראה שייך לשחקן באפליקציה. approve=true (\"אשר ר1\") — זה אותו ילד: השם באפליקציה משתנה לשם שבקובץ והוא מסומן ששילם, בדיוק כמו \"עדכן וסמן ששילם\" במסך מי לא משלם. approve=false (\"דחה ר1\") — לא אותו ילד, ההצעה לא תחזור. numbers = המספרים בלי ה-ר'.",
    input_schema: {
      type: "object",
      properties: { numbers: { type: "array", items: { type: "integer" } }, approve: { type: "boolean" } },
      required: ["numbers", "approve"],
      additionalProperties: false,
    },
  },
  {
    name: "trial_decision",
    description: "החלטה על ילדים בניסיון מהרשימה ששלחתי לבעלים (\"ילדים בניסיון שחזרו\"): keep=true הופך אותם לשחקנים קבועים, keep=false מוציא אותם מהרשימה (ההיסטוריה נשמרת). numbers = המספרים ברשימה.",
    input_schema: {
      type: "object",
      properties: { numbers: { type: "array", items: { type: "integer" } }, keep: { type: "boolean" } },
      required: ["numbers", "keep"],
      additionalProperties: false,
    },
  },
  {
    name: "list_groups",
    description: "כל הקבוצות במועדון עם מספר השחקנים הפעילים בכל אחת. להשתמש כדי לזהות קבוצה לפי שם לפני סימון או קריאת נוכחות.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_attendance",
    description: "הנוכחות של קבוצה בתאריך מסוים: מי סומן נוכח, מי נעדר, ומי עוד לא סומן. date בפורמט YYYY-MM-DD (ברירת מחדל: היום).",
    input_schema: {
      type: "object",
      properties: { group: { type: "string", description: "שם הקבוצה או חלק ממנו" }, date: { type: "string" } },
      required: ["group"],
      additionalProperties: false,
    },
  },
  {
    name: "mark_attendance",
    description:
      "מסמן נוכחות/היעדרות לשחקנים בקבוצה בתאריך — בדיוק כמו שמאמן מסמן באפליקציה. date בפורמט YYYY-MM-DD (ברירת מחדל: היום). שחקן שלא מופיע ברשימה לא משתנה. לפני ההפעלה לוודא עם שולה את הקבוצה, התאריך והשמות.",
    input_schema: {
      type: "object",
      properties: {
        group: { type: "string", description: "שם הקבוצה או חלק ממנו" },
        date: { type: "string" },
        present: { type: "array", items: { type: "string" }, description: "שמות (או חלקי שמות) של מי שהגיע" },
        absent: { type: "array", items: { type: "string" }, description: "שמות (או חלקי שמות) של מי שנעדר" },
      },
      required: ["group"],
      additionalProperties: false,
    },
  },
  {
    name: "get_weather",
    description: "תחזית מזג אוויר (Open-Meteo, חינמי) למקום לפי שם, בעברית או באנגלית. מחזיר את המצב עכשיו ותחזית יומית. days = 1-7 (ברירת מחדל 3).",
    input_schema: {
      type: "object",
      properties: { place: { type: "string", description: "עיר/יישוב, למשל 'שאר ישוב' או 'Berlin'" }, days: { type: "integer" } },
      required: ["place"],
      additionalProperties: false,
    },
  },
  {
    name: "run_agent_now",
    description:
      "מבקש להריץ סוכן עכשיו במקום לחכות לזמן הקבוע. התוצאה מגיעה בוואטסאפ תוך כ-10-15 דקות. scan = הסורק היומי / דוח הבוקר (נוכחות, היעדרויות, סכנת נשירה, רישום ותשלום); bugcheck = בודק הבאגים באפליקציה; ideas = רעיונות שבועיים; supervisor = המפקח (האם כל הסוכנים עובדים); content = טיוטות הפרסום. בקשה כללית (\"תריץ בדיקה\", \"תריץ דוח\", \"תסרקי\") = scan. bugcheck רק כשהבעלים אומר במפורש באגים או תקלות באפליקציה. לא ברור איזה — לשאול אותו, לא לנחש.",
    input_schema: {
      type: "object",
      properties: { agent: { type: "string", enum: AGENTS } },
      required: ["agent"],
      additionalProperties: false,
    },
  },
];

function pick(report, numbers) {
  const all = report.pending || [];
  const idx = numbers && numbers.length ? numbers : all.map((_, i) => i + 1);
  return idx.map((n) => ({ n, item: all[n - 1] })).filter((x) => x.item);
}

// שער לכתיבת נוכחות: כל שם/מספר חייב להופיע בהודעה הגולמית של הבעלים. אם לא (למשל "סמני את כולם", או טקסט
// שהוזרק דרך שם שחקן) — אישור דו-שלבי כמו בפרסום. ככה הכתבה רגילה של הבעלים נשארת מיידית.
// רשימה ריקה (= "כולם") אף פעם לא נחשבת כמופיעה בהודעה — תמיד אישור דו-שלבי.
// מספר — רק כמספר שלם ("1" לא נמצא בתוך "12"); שם — לפחות 2 אותיות
const inOwnerText = (items, ownerText) => items.length > 0 && items.every((x) => {
  const v = String(x).trim(), o = String(ownerText || "");
  return /^\d+$/.test(v) ? new RegExp(`(^|\\D)${v}(\\D|$)`).test(o) : v.length >= 2 && o.includes(v);
});

// התאריך הוזכר בהודעה של הבעלים: היום, אתמול/שלשום, או התאריך עצמו (2026-10-01 / 1.10 / 1/10)
function dateInOwnerText(d, ownerText, today = israelToday()) {
  const t = String(ownerText || "");
  if (d === today) return true;
  const back = (n) => new Date(Date.parse(today + "T12:00:00Z") - n * 864e5).toISOString().slice(0, 10);
  if (/אתמול/.test(t) && d === back(1)) return true;
  if (/שלשום/.test(t) && d === back(2)) return true;
  const [, m, day] = d.split("-").map(Number);
  return t.includes(d) || new RegExp(`(^|\\D)0?${day}[./]0?${m}(\\D|$)`).test(t);
}

// coach = מדריך שמדבר עם שולה: רואה ומסמן רק בקבוצות שלו (coach.groups), והאישור שלו נשמר בנפרד מזה של הבעלים
export function makeTools({ env, store, wa, lastOwnerText, turn, coach }) {
  const latest = () => store.get("agentReports/latest");

  return {
    async get_daily_report() {
      const r = await latest();
      if (!r) return "עוד אין דוח — הסורק היומי לא רץ עדיין.";
      const done = new Set(r.handledKeys || []);
      const prepared = new Set((((await store.get("agentReports/bot")) || {}).absenceLinks?.items || []).map((x) => x.key));
      return JSON.stringify({
        date: r.date,
        yesterday: r.yesterday,
        summary: r.summary,
        mostImportantToday: topActions(r),
        pending: (r.pending || []).map((x, i) => {
          const t = absenceTemplate(x);
          return {
            number: i + 1,
            name: x.playerName,
            group: x.groupName,
            kind: x.kind === "repeat" ? "שתי היעדרויות ברצף" : `היעדרות ${x.whenText}`,
            hasPhone: !!x.phone,
            alreadyHandled: done.has(x.key),
            ...(prepared.has(x.key) && !done.has(x.key) ? { linksPrepared: true } : {}),
            message: renderTemplate(t.name, t.params),
          };
        }),
        atRisk: (r.atRisk || []).map((x) => ({ name: x.playerName, group: x.groupName, level: x.level, reason: x.reason })),
        ...(r.registration && {
          registration: {
            matchesToConfirm: r.registration.items.map((x, i) => ({
              number: `ר${i + 1}`,
              nameInApp: x.playerName,
              group: x.group,
              nameInFile: x.fileName,
              groupInFile: x.fileGroup,
              alreadyHandled: done.has(x.key),
            })),
            unmatchedInFile: r.registration.unmatched,
            paidForFewerSessions: r.registration.gaps,
            syncStopped: r.registration.stopped,
          },
        }),
      });
    },

    async resolve_registration({ numbers, approve }) {
      // שינוי שם בנתונים: מיידי רק כשהבעלים כתב את המספרים בעצמו ("אשר ר2"); אחרת אישור בשני שלבים
      const nums = (numbers || []).map(Number);
      if (!inOwnerText(nums, lastOwnerText) && !(await confirmed(store, "registration", { nums, approve: !!approve }, lastOwnerText, turn)))
        return "לא בוצע עדיין. להציג לבעלים את ההתאמות (ר + מספר, השם באפליקציה והשם בקובץ) ולשאול אם לאשר. אחרי \"כן\" — לקרוא שוב עם אותם מספרים.";
      const r = await latest();
      const items = r?.registration?.items || [];
      const done = new Set(r?.handledKeys || []);
      const chosen = nums.map((n) => ({ n, x: items[n - 1] })).filter(({ x }) => x && !done.has(x.key));
      if (!chosen.length) return "אין התאמות כאלה ברשימה, או שכבר טופלו.";
      const out = [];
      for (const { n, x } of chosen) {
        const p = await store.get(`players/${x.playerId}`);
        if (!p || p.deleted) {
          out.push(`ר${n}. ${x.playerName}: השחקן כבר לא באפליקציה — דילגתי`);
          continue;
        }
        // notPayingSource: "manual" — אותו דבר שהאפליקציה כותבת, כדי שהסנכרון הבא לא יחזיר אותו לרשימה
        if (approve) await store.merge(`players/${x.playerId}`, { name: x.fileName, notPaying: false, notPayingSource: "manual" });
        out.push(approve ? `ר${n}. ${p.name} ← "${x.fileName}", סומן ששילם` : `ר${n}. ${p.name}: לא אותו ילד, ההצעה לא תחזור`);
      }
      const keys = chosen.map(({ x }) => x.key);
      await store.update("system/paymentSyncIgnores", (cur) => ({ keys: [...new Set([...(cur.keys || []), ...keys])] }));
      await store.update("agentReports/latest", (cur) => ({ handledKeys: [...new Set([...(cur.handledKeys || []), ...keys])] }));
      return out.join("\n");
    },

    async get_agent_results({ agent }) {
      if (agent === "bugcheck") return JSON.stringify((await store.get("agentReports/bugs")) || "עוד לא רץ");
      if (agent === "content") {
        const c = await store.get("agentReports/content");
        return c ? JSON.stringify({ date: c.date, drafts: (c.drafts || []).map((d, i) => ({ number: i + 1, ...d })) }) : "עוד לא רץ";
      }
      if (agent === "ideas") {
        const i = await store.get("agentReports/ideas");
        return i ? JSON.stringify({ date: i.date, text: i.text }) : "עוד לא רץ";
      }
      return JSON.stringify((await store.get("agentReports/health")) || "עוד לא רץ");
    },

    async find_player({ name }) {
      const q = String(name || "").trim();
      if (!q) return "צריך שם.";
      const [players, groups, cancellations] = await Promise.all([store.list("players"), store.list("groups"), store.list("cancellations")]);
      const hits = players.filter((p) => !p.deleted && (p.name || "").includes(q)).slice(0, 5);
      if (!hits.length) return `לא נמצא שחקן בשם "${q}".`;
      const today = israelToday();
      const out = [];
      for (const p of hits) {
        // רשומות כל הקבוצה — כדי לזהות יום שאף אחד לא הגיע בו (חג, אימון שלא התקיים)
        const recs = [...(await store.where("attendance", "playerId", p.id)), ...(p.groupId ? await store.where("attendance", "groupId", p.groupId) : [])];
        const hist = playerHistory(onlyHeldTrainings(recs, cancellations, today), p.id, today);
        out.push({
          name: p.name,
          group: groups.find((g) => g.id === p.groupId)?.name || "",
          active: !!p.isActive,
          hasValidPhone: isValidPhone(p.parentPhone),
          last12: hist.slice(0, 12).map((r) => `${r.date} ${r.status === "Present" ? "הגיע" : "לא הגיע"}`),
          risk: dropoutRisk(hist, today)?.reason || "אין",
        });
      }
      return JSON.stringify(out);
    },

    async set_player_phone({ name, phone }) {
      // 28.10, שלום: "אני יכול לשלוח את המספר, אבל תשמור אותו באפליקציה". המספר חייב להופיע בהודעה שלו —
      // לא מספר ש-Gemini המציא או שהגיע מתוכן חיצוני.
      const digits = String(phone || "").replace(/\D/g, "");
      if (!isValidPhone(digits) || !/^0?5\d{8}$|^9725\d{8}$/.test(digits)) return "המספר לא נראה כמו נייד ישראלי (05XXXXXXXX).";
      const local = "0" + normalizePhone(digits).slice(3);
      if (!String(lastOwnerText || "").replace(/\D/g, "").includes(local.slice(1))) return "שמירת טלפון רק כשהבעלים כותב את המספר בעצמו בהודעה.";
      const q = String(name || "").trim();
      const hits = q ? (await store.list("players")).filter((p) => !p.deleted && p.isActive !== false && (p.name || "").includes(q)) : [];
      if (hits.length !== 1) return hits.length ? `יש ${hits.length} שחקנים שמתאימים ל"${q}": ${hits.map((p) => p.name).join(", ")}. לשאול את הבעלים מי מהם.` : `לא נמצא שחקן פעיל בשם "${q}".`;
      await store.merge(`players/${hits[0].id}`, { parentPhone: local });
      return `נשמר ל${hits[0].name}. הודעות שחיכו למספר יוצאות בשליחה האוטומטית הקרובה.`;
    },

    async send_absence_messages({ numbers }) {
      // השער לא תלוי במה ש-Gemini החליט: אישור בשני שלבים, כמו בפרסום. "כן" באותה הודעה של הבקשה
      // ("תשלחי להורים...") לא נחשב — רק "כן" בהודעה נפרדת, על אותם מספרים בדיוק.
      const nums = (numbers || []).map(Number);
      if (!(await confirmed(store, "absence", { numbers: nums }, lastOwnerText, turn)))
        return "עוד לא הוכנו קישורים. להציג לבעלים את הרשימה (מספר, שם, נוסח) ולשאול \"להכין קישורים?\". אחרי \"כן\" בהודעה נפרדת — לקרוא שוב עם אותם מספרים בדיוק.";
      const r = await latest();
      if (!r) return "אין דוח.";
      const done = new Set(r.handledKeys || []);
      const chosen = pick(r, nums).filter(({ item }) => !done.has(item.key));
      if (chosen.length > MAX_SEND) return `יותר מ-${MAX_SEND} הודעות בבת אחת — לבקש מהבעלים לבחור מספרים.`;
      const results = [];
      const prepared = [];
      const sentTo = new Set();
      for (const { n, item } of chosen) {
        if (sentTo.has(item.playerId)) {
          results.push(`${n}. ${item.playerName}: כבר יש קישור להורה הזה ברשימה — דילגתי`);
          continue;
        }
        if (!item.phone) {
          results.push(`${n}. ${item.playerName}: אין טלפון תקין — אין קישור`);
          continue;
        }
        const t = absenceTemplate(item);
        sentTo.add(item.playerId);
        prepared.push({ n, key: item.key, kind: item.kind, date: item.date, groupId: item.groupId, playerId: item.playerId, playerName: item.playerName });
        results.push(`${n}. ${item.playerName}: ${waLink(item.phone, renderTemplate(t.name, t.params))}`);
      }
      // לא מסמנים "נשלח" כשרק מכינים קישור — הבעלים עוד לא לחץ. נשמר כ"קישורים הוכנו", ומסומן רק אחרי "שלחתי".
      if (prepared.length)
        await store.update("agentReports/bot", (bot) => {
          const keep = (bot.absenceLinks?.date === r.date ? bot.absenceLinks.items || [] : []).filter((x) => !prepared.some((p) => p.key === x.key));
          return { absenceLinks: { date: r.date, at: new Date().toISOString(), items: [...keep, ...prepared] } };
        });
      return results.length
        ? `ללחוץ על כל קישור ואז "שלח" — ההודעה יוצאת מהמספר שלך. אחרי ששלחת — לכתוב לי "שלחתי" ואסמן אותן כנשלחו:\n${results.join("\n")}`
        : "אין מה לשלוח — כל הרשימה כבר טופלה.";
    },

    async confirm_absence_sent({ numbers }) {
      if (!SENT_CONFIRM.test(lastOwnerText || "") || NOT_SENT.test(lastOwnerText || ""))
        return "לא סומן: הבעלים עוד לא כתב \"שלחתי\". לשאול אותו אם שלח את ההודעות.";
      const bot = (await store.get("agentReports/bot")) || {};
      const all = bot.absenceLinks?.items || [];
      const want = (numbers || []).map(Number);
      const chosen = want.length ? all.filter((x) => want.includes(x.n)) : all;
      if (!chosen.length) return "אין קישורים שהוכנו וממתינים לאישור שליחה.";
      const lines = [];
      for (const item of chosen) lines.push(`${item.n}. ${item.playerName}: ${await markHandled(store, item, true)}`);
      const keys = new Set(chosen.map((x) => x.key));
      await store.update("agentReports/latest", (cur) => ({ handledKeys: [...new Set([...(cur.handledKeys || []), ...keys])] }));
      await store.update("agentReports/bot", (cur) => ({ absenceLinks: { ...(cur.absenceLinks || {}), items: (cur.absenceLinks?.items || []).filter((x) => !keys.has(x.key)) } }));
      return `סומנו כנשלחו:\n${lines.join("\n")}`;
    },

    async skip_messages({ numbers }) {
      if (!inOwnerText(numbers || [], lastOwnerText) && !(await confirmed(store, "skip", { numbers }, lastOwnerText, turn)))
        return "לא סומן עדיין. להציג לבעלים את המספרים ולשאול אם לסמן כמטופלים. אחרי \"כן\" — לקרוא שוב עם אותם מספרים.";
      const r = await latest();
      if (!r) return "אין דוח.";
      const chosen = pick(r, numbers);
      for (const { item } of chosen) await markHandled(store, item, false);
      await store.update("agentReports/latest", (cur) => ({ handledKeys: [...new Set([...(cur.handledKeys || []), ...chosen.map(({ item }) => item.key)])] }));
      return `סומנו כמטופלים: ${chosen.map(({ n, item }) => `${n}. ${item.playerName}`).join(", ")}`;
    },

    async trial_decision({ numbers, keep }) {
      if (!inOwnerText(numbers || [], lastOwnerText) && !(await confirmed(store, "trial", { numbers, keep }, lastOwnerText, turn)))
        return `לא עודכן עדיין. להציג לבעלים את המספרים ולשאול אם ${keep ? "להשאיר אותם קבועים" : "להוציא אותם מהרשימה"}. אחרי "כן" — לקרוא שוב עם אותם מספרים.`;
      const items = ((await store.get("agentReports/bot")) || {}).trialAsk?.items || [];
      const chosen = items.filter((x) => (numbers || []).map(Number).includes(x.n));
      if (!chosen.length) return "המספרים האלה לא ברשימת הילדים בניסיון.";
      for (const x of chosen) await store.merge(`players/${x.id}`, keep ? { trial: false } : { isActive: false, endDate: israelToday() });
      const ids = new Set(chosen.map((x) => x.id));
      await store.update("agentReports/bot", (cur) => ({ trialAsk: { items: (cur.trialAsk?.items || []).filter((x) => !ids.has(x.id)) } }));
      return `${keep ? "עכשיו שחקנים קבועים" : "יצאו מהרשימה"}: ${chosen.map((x) => `${x.n}. ${x.label}`).join(", ")}`;
    },

    async list_groups() {
      const [players, groups] = await Promise.all([store.list("players"), store.list("groups")]);
      return JSON.stringify(groups.map((g) => ({ name: g.name, players: players.filter((p) => p.groupId === g.id && p.isActive && !p.deleted && !p.trial).length })));
    },

    async get_attendance({ group, date }) {
      const d = validDate(date);
      const { g, roster } = await findGroup(store, group, coach?.groups);
      if (!g) return roster; // הודעת שגיאה
      const recs = (await store.where("attendance", "groupId", g.id)).filter((a) => a.date === d);
      const status = new Map(recs.map((a) => [a.playerId, a.status]));
      const by = (s) => roster.filter((p) => status.get(p.id) === s).map((p) => p.name);
      return JSON.stringify({
        group: g.name,
        date: d,
        present: by("Present"),
        absent: by("Absent"),
        unmarked: roster.filter((p) => !status.has(p.id)).map((p) => p.name),
      });
    },

    async mark_attendance({ group, date, present = [], absent = [] }) {
      const d = validDate(date);
      const short = [...present, ...absent].filter((q) => String(q || "").trim().length < 2);
      if (short.length) return `לא נשמר: שם קצר מדי (${short.map((q) => `"${q}"`).join(", ")}). צריך לפחות 2 אותיות מהשם.`;
      // מיידי רק כשהכל כתוב בהודעה של הבעלים: השמות, הקבוצה, והתאריך (או שזה היום). אחרת — "כן" נפרד.
      const direct = inOwnerText([...present, ...absent], lastOwnerText) && inOwnerText([group], lastOwnerText) && dateInOwnerText(d, lastOwnerText);
      if (!direct && !(await confirmed(store, coach ? `attendance_${coach.id}` : "attendance", { group, date: d, present, absent }, lastOwnerText, turn)))
        return "לא נשמר עדיין. להציג לבעלים בדיוק את הקבוצה, התאריך, מי מסומן נוכח ומי נעדר ולשאול \"לשמור?\". אחרי \"כן\" — לקרוא שוב עם אותם פרטים בדיוק.";
      const { g, roster } = await findGroup(store, group, coach?.groups);
      if (!g) return roster;
      const saved = [];
      const problems = [];
      for (const [names, status] of [
        [present, "Present"],
        [absent, "Absent"],
      ]) {
        for (const q of names) {
          const hits = roster.filter((p) => (p.name || "").includes(String(q).trim()));
          if (hits.length !== 1) {
            problems.push(`${q}: ${hits.length ? "כמה שחקנים מתאימים — " + hits.map((p) => p.name).join(", ") : "לא נמצא בקבוצה"}`);
            continue;
          }
          const p = hits[0];
          // אותו חוזה שמירה של האפליקציה: מזהה ${date}_${groupId}_${playerId}, סטטוס Present/Absent.
          // כמו באפליקציה: נעדר שנשמר מחדש שומר את msgSentAt (merge), ונוכח נשמר בלי msgSentAt/msgSentBy.
          await store.merge(`attendance/${d}_${g.id}_${p.id}`, {
            date: d,
            groupId: g.id,
            playerId: p.id,
            status,
            markedBy: coach ? `shula-whatsapp:${coach.id}` : "shula-whatsapp",
            updatedAt: new Date().toISOString(),
            ...(status === "Present" ? { msgSentAt: DELETE, msgSentBy: DELETE, excused: DELETE } : {}),
          });
          saved.push(`${p.name}: ${status === "Present" ? "נוכח" : "נעדר"}`);
        }
      }
      return [`${g.name} ${d}`, ...saved, ...(problems.length ? ["לא נשמרו:", ...problems] : [])].join("\n");
    },

    async get_weather({ place, days = 3 }) {
      const geo = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?${new URLSearchParams({ name: place, count: "1", language: "he" })}`)).json();
      const g = geo.results?.[0];
      if (!g) return `לא מצאתי מקום בשם "${place}". לנסות שם של עיר קרובה או באנגלית.`;
      const q = new URLSearchParams({
        latitude: g.latitude, longitude: g.longitude, timezone: "auto", forecast_days: String(Math.min(Math.max(days, 1), 7)),
        current: "temperature_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation",
        daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max",
      });
      const w = await (await fetch(`https://api.open-meteo.com/v1/forecast?${q}`)).json();
      if (!w.daily) throw new Error(`Open-Meteo: ${w.reason || "no data"}`);
      return JSON.stringify({
        place: [g.name, g.admin1, g.country].filter(Boolean).join(", "),
        now: { temp: w.current?.temperature_2m, feels: w.current?.apparent_temperature, sky: WEATHER[w.current?.weather_code] ?? w.current?.weather_code, windKmh: w.current?.wind_speed_10m },
        days: w.daily.time.map((d, i) => ({ date: d, sky: WEATHER[w.daily.weather_code[i]] ?? w.daily.weather_code[i], min: w.daily.temperature_2m_min[i], max: w.daily.temperature_2m_max[i], rainChance: w.daily.precipitation_probability_max[i], windKmh: w.daily.wind_speed_10m_max[i] })),
      });
    },

    async run_agent_now({ agent }) {
      if (!AGENTS.includes(agent)) return "סוכן לא מוכר.";
      const bot = (await store.get("agentReports/bot")) || {};
      await store.merge("agentReports/bot", { requests: [...new Set([...(bot.requests || []), agent])] });
      // השם בעברית בתשובה — כדי שהבעלים יראה מיד אם הורץ סוכן אחר ממה שביקש
      return `ביקשתי להריץ את ${AGENT_HE[agent]}. התוצאה תגיע בוואטסאפ תוך כ-10-15 דקות.`;
    },
  };
}

// קודי WMO של Open-Meteo
const WEATHER = { 0: "בהיר", 1: "בהיר ברובו", 2: "מעונן חלקית", 3: "מעונן", 45: "ערפל", 48: "ערפל", 51: "טפטוף", 53: "טפטוף", 55: "טפטוף חזק", 61: "גשם קל", 63: "גשם", 65: "גשם חזק", 71: "שלג קל", 73: "שלג", 75: "שלג כבד", 80: "ממטרים", 81: "ממטרים", 82: "ממטרים חזקים", 95: "סופת רעמים", 96: "סופת רעמים עם ברד", 99: "סופת רעמים עם ברד" };

export function validDate(date) {
  const d = String(date || "").trim() || israelToday();
  // בדיקה הלוך-חזור: 2026-02-31 לא קיים (Date.parse היה מגלגל אותו ל-3 במרץ)
  const t = /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + "T00:00:00Z") : null;
  if (!t || Number.isNaN(t.getTime()) || t.toISOString().slice(0, 10) !== d) throw new Error(`תאריך לא תקין: ${d} (צריך YYYY-MM-DD)`);
  return d;
}

// קבוצה אחת לפי שם (או חלק ממנו) + השחקנים הפעילים שלה. מחזיר הודעת שגיאה במקום roster אם אין התאמה יחידה.
export async function findGroup(store, group, groups, players) {
  const q = String(group || "").trim();
  [groups, players] = await Promise.all([groups || store.list("groups"), players || store.list("players")]);
  const hits = groups.filter((g) => (g.name || "").includes(q));
  if (!q || hits.length !== 1)
    return { g: null, roster: hits.length ? `כמה קבוצות מתאימות: ${hits.map((g) => g.name).join(", ")}` : `לא נמצאה קבוצה "${q}". הקבוצות: ${groups.map((g) => g.name).join(", ")}` };
  const g = hits[0];
  return { g, roster: players.filter((p) => p.groupId === g.id && p.isActive && !p.deleted) };
}

// אותו רישום שהאפליקציה עושה כשמאמן שולח הודעה או לוחץ "טופל" (markAbsenceMsgSent / markAlertHandled
// ב-part-a.js), כדי שהמאמנים לא יראו את אותה היעדרות כממתינה ואף הורה לא יקבל הודעה כפולה.
// "נשלח" נכתב רק על רשומת היעדרות קיימת שעדיין Absent (קריאה וכתיבה מותנית): אם המאמן סימן בינתיים
// "נוכח" או שהרשומה לא קיימת — לא נוגעים. לא כותבים status בכלל, רק msgSentAt/msgSentBy. מחזיר מה נעשה.
async function markHandled(store, item, sent) {
  if (sent && item.kind === "absence") {
    let state = "missing";
    await store.update(`attendance/${item.date}_${item.groupId}_${item.playerId}`, (a, exists) => {
      state = !exists ? "missing" : a.status !== "Absent" ? "notAbsent" : "ok";
      return state === "ok" ? { msgSentAt: new Date().toISOString(), msgSentBy: "whatsapp-agent" } : null;
    });
    if (state === "missing") return "הרשומה לא קיימת — לא סומן";
    if (state === "notAbsent") return "סומן בינתיים כנוכח — לא סומן כנשלח";
  }
  const p = await store.get(`players/${item.playerId}`);
  // רק מקדמים את התאריך — לא מחזירים אחורה סימון חדש יותר
  if (p && !(p.alertHandledDate && p.alertHandledDate >= item.date))
    await store.merge(`players/${item.playerId}`, { alertHandledDate: item.date });
  return sent ? "סומן כנשלח" : "סומן כמטופל";
}
