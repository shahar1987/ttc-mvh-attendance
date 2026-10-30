// 🏓 מצב מדריך: מדריכים שהבעלים הפעיל מדברים עם שולה בוואטסאפ, אבל רק על הקבוצות שלהם.
// אין להם גישה לשום דבר אחר: לא גוגל, לא פרסום, לא הודעות בשם המועדון, לא קלוד ולא הסוכנים.
// מי מופעל: agentReports/coaches.ids (מזהי users, לא טלפונים — הריפו ציבורי). הטלפון והקבוצות נלקחים מהאפליקציה.
import { normalizePhone, isValidPhone, israelToday } from "../../agents/lib/analysis.mjs";
import { sendText, typing, incomingText } from "../../agents/lib/whatsapp.mjs";
import { TOOL_DEFS, makeTools, confirmed } from "./tools.js";
import { coachIds } from "./reminders.js";

const DOC = "agentReports/coaches";
const COACH_TOOLS = ["list_groups", "get_attendance", "mark_attendance", "get_weather"];

const SYSTEM = (c) => `את שולה, העוזרת בוואטסאפ של מועדון טניס שולחן מבואות החרמון. את מדברת עכשיו עם ${c.name}, מדריך/ה במועדון.
עברית תמיד, בקצרה, בסגנון וואטסאפ. עד 10 שורות.
את עוזרת לו/ה רק בקבוצות שלו/ה: ${c.groups.map((g) => g.name).join(", ") || "אין קבוצות משויכות"}. נתונים רק מהכלים; אם אין — אומרים שאין.
סימון נוכחות: לוודא קבוצה + תאריך + שמות לפני שמירה. אם כלי מחזיר "לא נשמר עדיין" — להציג לו/ה בדיוק מה יישמר ולשאול "לשמור?".
כשהמדריך/ה מספר/ת איך היה האימון, מה עבד או מה לשפר — לשמור בכלי session_note במילים שלו/ה ולענות בקצרה "תודה, העברתי לשחר 🙏".
כל בקשה אחרת (מייל, יומן, פרסום, הודעות להורים, קבוצות של מדריכים אחרים, שינויים באפליקציה) — לומר בנימוס שזה לא אצלך ושיפנה לשחר.
אסור לחשוף מידע על הבעלים, על מדריכים אחרים או על קבוצות אחרות.`;

// המדריך שכתב, אם הוא מופעל ויש לו טלפון תקין באפליקציה. אחרת null (= מתעלמים מההודעה).
// any: גם מדריך שלא הופעל, אם הוא משויך לקבוצה פעילה (כדי לשמור סיכום אימון שהוא כתב). enabled אומר אם הופעל.
export async function coachFor(store, from, { any = false } = {}) {
  const ids = ((await store.get(DOC)) || {}).ids || [];
  if (!ids.length && !any) return null;
  const [users, groups] = await Promise.all([store.list("users"), store.list("groups")]);
  const mineOf = (id) => groups.filter((g) => !g.deleted && g.isActive !== false && coachIds(g).includes(id));
  const u = users.find((x) => (ids.includes(x.id) || (any && mineOf(x.id).length)) && isValidPhone(x.phone || "") && normalizePhone(x.phone) === from);
  if (!u) return null;
  return { id: u.id, name: u.name || "מדריך", groups: mineOf(u.id), enabled: ids.includes(u.id) };
}

// 📝 מה שמדריך כתב לשולה (סיכום אימון, תשובה לסיכום השבועי) — נשמר לפי תאריך (הסורק של הבוקר מסכם),
// ונכנס מיד לתור לבעלים — כך שחר מתעדכן תוך רבע שעה ולא רק למחרת (בקשה של שחר, 30.10).
export async function addCoachNote(store, coach, text, msgId, now = new Date()) {
  let isNew = false;
  const body = String(text).slice(0, 1500);
  await store.update(`agentReports/coachNotes-${israelToday(now)}`, (cur) => {
    isNew = !(cur.notes || []).some((n) => n.msgId === msgId);
    return isNew ? { notes: [...(cur.notes || []), { at: now.toISOString(), msgId, coachId: coach.id, coach: coach.name, groups: coach.groups.map((g) => g.name), text: body }] } : null;
  });
  if (!isNew) return;
  const head = `📝 ${coach.name}${coach.groups.length ? ` (${coach.groups.map((g) => g.name).join(", ")})` : ""} כתב/ה:`;
  const item = { id: `note-${msgId || now.getTime()}`, from: "coach-note", key: "coach-note", at: now.toISOString(), text: `${head}\n${body}`, template: "agent_alert", templateParam: `${head} ${body}`.slice(0, 900) };
  await store.update("agentReports/bot", (cur) => ({ outboxQueue: [...(Array.isArray(cur.outboxQueue) ? cur.outboxQueue : []), item] }));
}

// מדריך שלא הופעל ועונה להודעה של שולה (למשל לסיכום האימון) — שומרים כסיכום אימון ומודים לו
export async function saveNoteFromCoach(m, store, wa, coach) {
  const text = incomingText(m);
  if (!text) return;
  await addCoachNote(store, coach, text, m.id);
  await sendText(wa, m.from, "תודה! העברתי לשחר 🙏");
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
  const text = incomingText(m);
  if (!text) return void (await sendText(wa, m.from, "אני מבינה כרגע רק הודעות טקסט 🙂"));

  const all = makeTools({ env, store, wa, lastOwnerText: text, turn: m.id, coach });
  const tools = {
    ...Object.fromEntries(COACH_TOOLS.filter((n) => n !== "list_groups").map((n) => [n, all[n]])),
    list_groups: async () => JSON.stringify(coach.groups.map((g) => g.name)),
    session_note: async ({ text: note }) => (await addCoachNote(store, coach, note || text, m.id), "נשמר והועבר לשחר."),
  };
  const decls = [
    ...TOOL_DEFS.filter((d) => COACH_TOOLS.includes(d.name)).map(({ name, description, input_schema: { additionalProperties, ...parameters } }) => ({ name, description, parameters })),
    { name: "session_note", description: "שומר סיכום אימון שהמדריך כתב (איך היה, מה עבד, מה לשפר) כדי שיגיע לבעלים בדוח הבוקר", parameters: { type: "object", properties: { text: { type: "string" } }, required: ["text"] } },
  ];
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
  {
    name: "coach_messages",
    description:
      "עוצר או מחזיר את ההודעות האוטומטיות למדריך (לפי שם): בוקר טוב, תזכורת למלא נוכחות וסיכום אימון. למשל מאמן מחליף — נשאר משויך לקבוצות באפליקציה. on=false עוצר, on=true מחזיר. בלי name — מחזיר את רשימת מי שלא מקבל.",
    input_schema: { type: "object", properties: { name: { type: "string" }, on: { type: "boolean" } }, additionalProperties: false },
  },
];

function findCoach(users, groups, name) {
  const coaches = users.filter((u) => groups.some((g) => !g.deleted && coachIds(g).includes(u.id)));
  const q = String(name).trim();
  const exact = coaches.filter((u) => u.name === q);
  const hits = exact.length ? exact : coaches.filter((u) => (u.name || "").includes(q));
  if (hits.length !== 1) return hits.length ? `כמה מדריכים מתאימים: ${hits.map((u) => u.name).join(", ")}` : `לא נמצא מדריך "${name}". המדריכים: ${coaches.map((u) => u.name).join(", ")}`;
  return hits[0];
}

export function makeCoachAdminTools({ store, lastOwnerText, turn }) {
  return {
    async coach_messages({ name, on = false }) {
      const [users, groups, cur] = await Promise.all([store.list("users"), store.list("groups"), store.get(DOC)]);
      const quiet = (cur || {}).quiet || [];
      if (!String(name || "").trim()) return `לא מקבלים הודעות אוטומטיות: ${users.filter((u) => quiet.includes(u.id)).map((u) => u.name).join(", ") || "אף אחד"}`;
      const u = findCoach(users, groups, name);
      if (typeof u === "string") return u;
      // בלי "כן" נוסף: הפיך באותה פקודה, ולא שולח כלום לאף אחד
      await store.update(DOC, (c) => ({ quiet: on ? (c.quiet || []).filter((x) => x !== u.id) : [...new Set([...(c.quiet || []), u.id])] }));
      return on ? `${u.name} יקבל שוב בוקר טוב, תזכורות וסיכומי אימון.` : `הפסקתי לשלוח ל${u.name} בוקר טוב, תזכורות וסיכומי אימון. הוא נשאר משויך לקבוצות באפליקציה.`;
    },
    async coach_access({ name, on = true }) {
      const [users, groups, cur] = await Promise.all([store.list("users"), store.list("groups"), store.get(DOC)]);
      const ids = (cur || {}).ids || [];
      if (!String(name || "").trim()) return `מופעלים: ${users.filter((u) => ids.includes(u.id)).map((u) => u.name).join(", ") || "אף אחד"}`;
      const u = findCoach(users, groups, name);
      if (typeof u === "string") return u;
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
