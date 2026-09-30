// הכלים שהסוכן הראשי (Claude) יכול להפעיל. כל גישה לנתונים עוברת כאן —
// Claude לא נוגע ב-Firestore או בוואטסאפ ישירות.
import { absenceTemplate, renderTemplate } from "../../agents/templates.mjs";
import { sendTemplate } from "../../agents/lib/whatsapp.mjs";
import { dropoutRisk, playerHistory, israelToday, isValidPhone } from "../../agents/lib/analysis.mjs";

const AGENTS = ["scan", "bugcheck", "ideas", "supervisor"];
const MAX_SEND = 40;
// הודעות להורים יוצאות רק כששולה אישרה במילים שלה, בהודעה האחרונה שכתבה
export const APPROVAL = /(^|\s)(שלח|תשלח|שלחי|תשלחי|כן|אשר|מאשר|מאשרת|אישור)(\s|$|[.!,])/;

export const TOOL_DEFS = [
  {
    name: "get_daily_report",
    description:
      "הדוח האחרון של הסורק היומי: מי לא הגיע וממתין להודעה (רשימה ממוספרת), מי החסיר פעמיים ברצף, מי בסכנת נשירה. המספרים ברשימה הם אלה ששולה משתמשת בהם כשהיא אומרת 'שלח 1,3'.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_agent_results",
    description: "התוצאות האחרונות של שאר הסוכנים: בודק הבאגים, הרעיונות השבועיים, ומצב המפקח (מתי כל סוכן רץ ומה הבעיות).",
    input_schema: {
      type: "object",
      properties: { agent: { type: "string", enum: ["bugcheck", "ideas", "supervisor"] } },
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
    name: "send_absence_messages",
    description:
      "שולח בוואטסאפ ממספר המועדון את הודעות ההיעדרות לפי המספרים בדוח היומי. מותר רק אחרי ששולה אישרה במפורש בהודעה האחרונה שלה (למשל 'שלח הכל' או 'שלח 1,3'). לפני אישור — להציג לה את הרשימה ולשאול.",
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
    name: "run_agent_now",
    description: "מבקש להריץ סוכן עכשיו במקום לחכות לזמן הקבוע. התוצאה מגיעה בוואטסאפ תוך כ-10-15 דקות.",
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

export function makeTools({ env, store, wa, lastOwnerText }) {
  const latest = () => store.get("agentReports/latest");

  return {
    async get_daily_report() {
      const r = await latest();
      if (!r) return "עוד אין דוח — הסורק היומי לא רץ עדיין.";
      const done = new Set(r.handledKeys || []);
      return JSON.stringify({
        date: r.date,
        yesterday: r.yesterday,
        summary: r.summary,
        pending: (r.pending || []).map((x, i) => {
          const t = absenceTemplate(x);
          return {
            number: i + 1,
            name: x.playerName,
            group: x.groupName,
            kind: x.kind === "repeat" ? "שתי היעדרויות ברצף" : `היעדרות ${x.whenText}`,
            hasPhone: !!x.phone,
            alreadyHandled: done.has(x.key),
            message: renderTemplate(t.name, t.params),
          };
        }),
        atRisk: (r.atRisk || []).map((x) => ({ name: x.playerName, group: x.groupName, level: x.level, reason: x.reason })),
      });
    },

    async get_agent_results({ agent }) {
      if (agent === "bugcheck") return JSON.stringify((await store.get("agentReports/bugs")) || "עוד לא רץ");
      if (agent === "ideas") {
        const i = await store.get("agentReports/ideas");
        return i ? JSON.stringify({ date: i.date, text: i.text }) : "עוד לא רץ";
      }
      return JSON.stringify((await store.get("agentReports/health")) || "עוד לא רץ");
    },

    async find_player({ name }) {
      const q = String(name || "").trim();
      if (!q) return "צריך שם.";
      const [players, groups] = await Promise.all([store.list("players"), store.list("groups")]);
      const hits = players.filter((p) => !p.deleted && (p.name || "").includes(q)).slice(0, 5);
      if (!hits.length) return `לא נמצא שחקן בשם "${q}".`;
      const today = israelToday();
      const out = [];
      for (const p of hits) {
        const recs = await store.where("attendance", "playerId", p.id);
        const hist = playerHistory(recs, p.id, today);
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

    async send_absence_messages({ numbers }) {
      // השער לא תלוי במה ש-Claude החליט: בלי מילת אישור בהודעה האחרונה של שולה — לא שולחים
      if (!APPROVAL.test(lastOwnerText)) return "לא נשלח: שולה עוד לא אישרה בהודעה האחרונה. להציג את הרשימה ולשאול.";
      const r = await latest();
      if (!r) return "אין דוח.";
      const done = new Set(r.handledKeys || []);
      const chosen = pick(r, numbers).filter(({ item }) => !done.has(item.key));
      if (chosen.length > MAX_SEND) return `יותר מ-${MAX_SEND} הודעות בבת אחת — לבקש משולה לבחור מספרים.`;
      const results = [];
      const sentTo = new Set();
      for (const { n, item } of chosen) {
        if (sentTo.has(item.playerId)) {
          results.push(`${n}. ${item.playerName}: כבר קיבל הודעה עכשיו — דילגתי`);
          continue;
        }
        if (!item.phone) {
          results.push(`${n}. ${item.playerName}: אין טלפון תקין — לא נשלח`);
          continue;
        }
        try {
          const t = absenceTemplate(item);
          await sendTemplate(wa, item.phone, t.name, t.params);
          await markHandled(store, item, true);
          done.add(item.key);
          sentTo.add(item.playerId);
          results.push(`${n}. ${item.playerName}: נשלח ✓`);
        } catch (e) {
          results.push(`${n}. ${item.playerName}: נכשל (${e.message})`);
        }
      }
      await store.merge("agentReports/latest", { handledKeys: [...done] });
      return results.join("\n") || "אין מה לשלוח — כל הרשימה כבר טופלה.";
    },

    async skip_messages({ numbers }) {
      const r = await latest();
      if (!r) return "אין דוח.";
      const done = new Set(r.handledKeys || []);
      const chosen = pick(r, numbers);
      for (const { item } of chosen) {
        await markHandled(store, item, false);
        done.add(item.key);
      }
      await store.merge("agentReports/latest", { handledKeys: [...done] });
      return `סומנו כמטופלים: ${chosen.map(({ n, item }) => `${n}. ${item.playerName}`).join(", ")}`;
    },

    async run_agent_now({ agent }) {
      if (!AGENTS.includes(agent)) return "סוכן לא מוכר.";
      const bot = (await store.get("agentReports/bot")) || {};
      await store.merge("agentReports/bot", { requests: [...new Set([...(bot.requests || []), agent])] });
      return `ביקשתי להריץ את ${agent}. התוצאה תגיע בוואטסאפ תוך כ-10-15 דקות.`;
    },
  };
}

// אותו רישום שהאפליקציה עושה כשמאמן שולח הודעה או לוחץ "טופל" (markAbsenceMsgSent / markAlertHandled
// ב-part-a.js), כדי שהמאמנים לא יראו את אותה היעדרות כממתינה ואף הורה לא יקבל הודעה כפולה.
async function markHandled(store, item, sent) {
  const p = await store.get(`players/${item.playerId}`);
  // רק מקדמים את התאריך — לא מחזירים אחורה סימון חדש יותר
  if (p && !(p.alertHandledDate && p.alertHandledDate >= item.date))
    await store.merge(`players/${item.playerId}`, { alertHandledDate: item.date });
  if (sent && item.kind === "absence") {
    await store.merge(`attendance/${item.date}_${item.groupId}_${item.playerId}`, {
      date: item.date,
      groupId: item.groupId,
      playerId: item.playerId,
      status: "Absent",
      msgSentAt: new Date().toISOString(),
      msgSentBy: "whatsapp-agent",
    });
  }
}
