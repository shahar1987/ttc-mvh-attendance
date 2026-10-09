// 🏓 מצב מדריך: מדריכים שהבעלים הפעיל מדברים עם שולה בוואטסאפ, אבל רק על הקבוצות שלהם.
// אין להם גישה לשום דבר אחר: לא גוגל, לא פרסום, לא הודעות בשם המועדון, לא קלוד ולא הסוכנים.
// מי מופעל: agentReports/coaches.ids (מזהי users, לא טלפונים — הריפו ציבורי). הטלפון והקבוצות נלקחים מהאפליקציה.
import { normalizePhone, isValidPhone } from "../../agents/lib/analysis.mjs";
import { sendText, typing } from "../../agents/lib/whatsapp.mjs";
import { TOOL_DEFS, makeTools, confirmed } from "./tools.js";
import { coachIds } from "./reminders.js";

const DOC = "agentReports/coaches";
const COACH_TOOLS = ["list_groups", "get_attendance", "mark_attendance", "get_weather"];

const SYSTEM = (c) => `את שולה, העוזרת בוואטסאפ של מועדון טניס שולחן מבואות החרמון. את מדברת עכשיו עם ${c.name}, מדריך/ה במועדון.
עברית תמיד, בקצרה, בסגנון וואטסאפ. עד 10 שורות.
את עוזרת לו/ה רק בקבוצות שלו/ה: ${c.groups.map((g) => g.name).join(", ") || "אין קבוצות משויכות"}. נתונים רק מהכלים; אם אין — אומרים שאין.
סימון נוכחות: לוודא קבוצה + תאריך + שמות לפני שמירה. אם כלי מחזיר "לא נשמר עדיין" — להציג לו/ה בדיוק מה יישמר ולשאול "לשמור?".
כל בקשה אחרת (מייל, יומן, פרסום, הודעות להורים, קבוצות של מדריכים אחרים, שינויים באפליקציה) — לומר בנימוס שזה לא אצלך ושיפנה לשחר.
אסור לחשוף מידע על הבעלים, על מדריכים אחרים או על קבוצות אחרות.`;

// המדריך שכתב, אם הוא מופעל ויש לו טלפון תקין באפליקציה. אחרת null (= מתעלמים מההודעה)
export async function coachFor(store, from) {
  const ids = ((await store.get(DOC)) || {}).ids || [];
  if (!ids.length) return null;
  const [users, groups] = await Promise.all([store.list("users"), store.list("groups")]);
  const u = users.find((x) => ids.includes(x.id) && isValidPhone(x.phone || "") && normalizePhone(x.phone) === from);
  if (!u) return null;
  return { id: u.id, name: u.name || "מדריך", groups: groups.filter((g) => !g.deleted && g.isActive !== false && coachIds(g).includes(u.id)) };
}

// שיחה עם מדריך: היסטוריה נפרדת לכל מדריך (agentReports/coach_<id>), רק כלי הנוכחות של הקבוצות שלו
export async function handleCoach(m, env, store, wa, coach, gemini) {
  const path = `agentReports/coach_${coach.id}`;
  let hist = [], dup = false;
  await store.update(path, (cur) => {
    hist = cur.history || [];
    dup = (cur.seenIds || []).includes(m.id);
    return dup ? null : { seenIds: [...(cur.seenIds || []), m.id].slice(-30) };
  });
  if (dup) return;
  await typing(wa, m.id).catch(() => {});
  const text = (m.type === "text" ? m.text.body : m.type === "button" ? m.button.text : "").trim();
  if (!text) return void (await sendText(wa, m.from, "אני מבינה כרגע רק הודעות טקסט 🙂"));

  const all = makeTools({ env, store, wa, lastOwnerText: text, turn: m.id, coach });
  const tools = {
    ...Object.fromEntries(COACH_TOOLS.filter((n) => n !== "list_groups").map((n) => [n, all[n]])),
    list_groups: async () => JSON.stringify(coach.groups.map((g) => g.name)),
  };
  const decls = TOOL_DEFS.filter((d) => COACH_TOOLS.includes(d.name)).map(({ name, description, input_schema: { additionalProperties, ...parameters } }) => ({ name, description, parameters }));
  const contents = [...hist.map((h) => ({ role: h.role === "assistant" ? "model" : "user", parts: [{ text: h.text }] })), { role: "user", parts: [{ text }] }];
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
  let answer = "זה לקח יותר מדי צעדים. אפשר לנסח שוב בקצרה?";
  for (let i = 0; i < 4; i++) {
    const parts = await gemini(env, {
      systemInstruction: { parts: [{ text: `${SYSTEM(coach)}\n\nהיום: ${today}` }] },
      contents,
      tools: [{ functionDeclarations: decls }],
      generationConfig: { maxOutputTokens: 2048, temperature: 0.4 },
    });
    const calls = parts.filter((p) => p.functionCall);
    if (!calls.length) {
      answer = parts.map((p) => p.text || "").join("").trim() || "לא קיבלתי תשובה מהמודל, נסה שוב";
      break;
    }
    contents.push({ role: "model", parts });
    const results = await Promise.all(
      calls.map(async ({ functionCall: { name, args } }) => {
        let result;
        try {
          if (!tools[name]) throw new Error("אין לך הרשאה לכלי הזה");
          result = String(await tools[name](args || {}));
        } catch (e) {
          result = `שגיאה: ${e.message}`;
        }
        return { functionResponse: { name, response: { result } } };
      }),
    );
    contents.push({ role: "user", parts: results });
  }
  await sendText(wa, m.from, answer);
  const at = new Date().toISOString();
  await store.update(path, (cur) => ({ history: [...(cur.history || []), { role: "user", text, at }, { role: "assistant", text: answer, at }].slice(-12) }));
}

// כלי לבעלים בלבד: להפעיל/לכבות את שולה למדריך. תמיד אישור דו-שלבי ("כן" בהודעה נפרדת).
export const COACH_ADMIN_TOOL_DEFS = [
  {
    name: "coach_access",
    description:
      "מפעיל או מכבה את שולה למדריך מהאפליקציה (לפי שם). מדריך מופעל יכול לכתוב לשולה ולקבל עזרה רק בנוכחות של הקבוצות שלו. on=false מכבה. בלי name — מחזיר את רשימת המופעלים.",
    input_schema: { type: "object", properties: { name: { type: "string" }, on: { type: "boolean" } }, additionalProperties: false },
  },
];

export function makeCoachAdminTools({ store, lastOwnerText, turn }) {
  return {
    async coach_access({ name, on = true }) {
      const [users, groups, cur] = await Promise.all([store.list("users"), store.list("groups"), store.get(DOC)]);
      const ids = (cur || {}).ids || [];
      if (!String(name || "").trim()) return `מופעלים: ${users.filter((u) => ids.includes(u.id)).map((u) => u.name).join(", ") || "אף אחד"}`;
      const coaches = users.filter((u) => groups.some((g) => !g.deleted && coachIds(g).includes(u.id)));
      const q = String(name).trim();
      const exact = coaches.filter((u) => u.name === q);
      const hits = exact.length ? exact : coaches.filter((u) => (u.name || "").includes(q));
      if (hits.length !== 1) return hits.length ? `כמה מדריכים מתאימים: ${hits.map((u) => u.name).join(", ")}` : `לא נמצא מדריך "${name}". המדריכים: ${coaches.map((u) => u.name).join(", ")}`;
      const u = hits[0];
      if (on && !isValidPhone(u.phone || "")) return `ל${u.name} אין טלפון תקין באפליקציה. צריך לעדכן אותו שם קודם.`;
      if (!(await confirmed(store, "coach_access", { id: u.id, on }, lastOwnerText, turn)))
        return `לא בוצע עדיין. לשאול את הבעלים: "${on ? "להפעיל" : "לכבות"} את שולה ל${u.name}?" ואחרי "כן" לקרוא שוב עם אותם פרטים.`;
      await store.update(DOC, (c) => ({ ids: on ? [...new Set([...(c.ids || []), u.id])] : (c.ids || []).filter((x) => x !== u.id) }));
      if (!on) return `כיביתי את שולה ל${u.name}.`;
      const mine = groups.filter((g) => !g.deleted && coachIds(g).includes(u.id)).map((g) => g.name);
      return `הפעלתי את שולה ל${u.name} (קבוצות: ${mine.join(", ")}).\nעוד שני צעדים: 1) להוסיף את ${normalizePhone(u.phone)} לרשימת הנמענים של מספר הניסיון ב-Meta (WhatsApp → API Setup → To) ולאשר בקוד שיגיע אליו. 2) ש${u.name} ישלח לשולה הודעה ראשונה — היא לא יכולה לפנות ראשונה.`;
    },
  };
}
