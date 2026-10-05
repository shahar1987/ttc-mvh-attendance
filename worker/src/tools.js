// הכלים שהסוכן הראשי (Claude) יכול להפעיל. כל גישה לנתונים עוברת כאן —
// Claude לא נוגע ב-Firestore או בוואטסאפ ישירות.
import { absenceTemplate, renderTemplate } from "../../agents/templates.mjs";
import { waLink } from "../../agents/lib/whatsapp.mjs";
import { dropoutRisk, playerHistory, israelToday, isValidPhone } from "../../agents/lib/analysis.mjs";
import { DELETE } from "./firestore.js";

const AGENTS = ["scan", "bugcheck", "ideas", "supervisor", "content"];
const MAX_SEND = 40;
// הודעות להורים יוצאות רק כששולה אישרה במילים שלה, בהודעה האחרונה שכתבה
export const APPROVAL = /(^|\s)(שלח|תשלח|שלחי|תשלחי|כן|אשר|מאשר|מאשרת|אישור)(\s|$|[.!,])/;

// אישור בשני שלבים לפעולה שיוצאת החוצה: הקריאה הראשונה שומרת טיוטה ולא עושה כלום. רק אם הבעלים ענה "כן"
// בהודעה *אחרת* (לא באותה הודעה שבה ביקש — "תשלחי למאמנים..." מכיל "תשלחי") ועם אותם פרטים בדיוק — מאשרים.
// הכתיבה מותנית: שתי קריאות במקביל (Gemini מפעיל כמה כלים יחד) לא יכולות שתיהן "לצרוך" את אותו אישור.
export async function confirmed(store, kind, payload, ownerText, turn) {
  const key = JSON.stringify(payload);
  let ok = false;
  await store.update("agentReports/bot", (bot) => {
    const p = bot.pending?.[kind];
    ok = APPROVAL.test(ownerText || "") && p?.key === key && p.turn !== turn;
    return { pending: { ...(bot.pending || {}), [kind]: ok ? null : { key, turn } } };
  });
  return ok;
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
    description: "התוצאות האחרונות של שאר הסוכנים: בודק הבאגים, הרעיונות השבועיים, מצב המפקח (מתי כל סוכן רץ ומה הבעיות), וטיוטות הפרסום של השבוע (content, ממוספרות 1-3 עם נוסח פייסבוק, נוסח אינסטגרם ומועד).",
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

// שער לכתיבת נוכחות: כל שם/מספר חייב להופיע בהודעה הגולמית של הבעלים. אם לא (למשל "סמני את כולם", או טקסט
// שהוזרק דרך שם שחקן) — אישור דו-שלבי כמו בפרסום. ככה הכתבה רגילה של הבעלים נשארת מיידית.
// רשימה ריקה (= "כולם") אף פעם לא נחשבת כמופיעה בהודעה — תמיד אישור דו-שלבי.
const inOwnerText = (items, ownerText) => items.length > 0 && items.every((x) => String(x).trim() && String(ownerText || "").includes(String(x).trim()));

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

export function makeTools({ env, store, wa, lastOwnerText, turn }) {
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
      });
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

    async list_groups() {
      const [players, groups] = await Promise.all([store.list("players"), store.list("groups")]);
      return JSON.stringify(groups.map((g) => ({ name: g.name, players: players.filter((p) => p.groupId === g.id && p.isActive && !p.deleted).length })));
    },

    async get_attendance({ group, date }) {
      const d = validDate(date);
      const { g, roster } = await findGroup(store, group);
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
      if (!direct && !(await confirmed(store, "attendance", { group, date: d, present, absent }, lastOwnerText, turn)))
        return "לא נשמר עדיין. להציג לבעלים בדיוק את הקבוצה, התאריך, מי מסומן נוכח ומי נעדר ולשאול \"לשמור?\". אחרי \"כן\" — לקרוא שוב עם אותם פרטים בדיוק.";
      const { g, roster } = await findGroup(store, group);
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
            markedBy: "shula-whatsapp",
            updatedAt: new Date().toISOString(),
            ...(status === "Present" ? { msgSentAt: DELETE, msgSentBy: DELETE } : {}),
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
      return `ביקשתי להריץ את ${agent}. התוצאה תגיע בוואטסאפ תוך כ-10-15 דקות.`;
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
