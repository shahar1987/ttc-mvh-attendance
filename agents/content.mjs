// 📣 סוכן הפרסום — ראשון בבוקר: 3 טיוטות פוסטים לשבוע, לומד ממה שעבד בדף בשבועות האחרונים.
// הטיוטות נשלחות לבעלים בוואטסאפ. שום דבר לא מתפרסם מכאן: הוא עונה לשולה "פרסם 2" עם תמונה,
// ושולה מפרסמת/מתזמנת דרך publish_post (worker/src/meta.js) רק אחרי "כן".
// Gemini (חינמי, אותו מפתח של שולה). בלי שמות שחקנים ובלי טלפונים בקוד — הריפו ציבורי.
import { fileURLToPath } from "node:url";
import { israelToday, addDays } from "./lib/analysis.mjs";

// תיוג באינסטגרם בלבד. בפייסבוק @ דרך ה-API נשאר טקסט מת — שם כותבים את השמות במילים.
export const IG_TAGS = "@matnas.mvhr @mevoothahermon @kiryat8 @galil.elion";
export const CREDIT = 'בשיתוף מתנ"ס אזורי מבואות החרמון והמועצה האזורית מבואות החרמון';
export const BLOCKED_DAYS = ["10-07"]; // 7 באוקטובר — לא מפרסמים שיווק
// יום לפני אימון: ראשון→שני (כורזים, דפנה), שלישי→רביעי (כורזים), רביעי→חמישי (שאר ישוב, דפנה)
const SLOTS = [{ dow: 0, time: "17:00" }, { dow: 2, time: "17:00" }, { dow: 3, time: "17:00" }];

export const localPhone = (p) => String(p || "").replace(/\D/g, "").replace(/^972/, "0").replace(/^(\d{3})(\d{7})$/, "$1-$2");

// מועדי הפרסום של השבוע שמתחיל ב-sunday (YYYY-MM-DD), בלי ימים חסומים
export const weekSlots = (sunday) =>
  SLOTS.map((s) => ({ ...s, date: addDays(sunday, s.dow) })).filter((s) => !BLOCKED_DAYS.includes(s.date.slice(5)));

// סידור טיוטה מהמודל: פייסבוק בלי @, קרדיט ושורת סיום תמיד, אינסטגרם = אותו טקסט + תיוגים
export function tidy(text, phone) {
  const closing = `אימון ניסיון חינם לכולם, בכל מועד! לפרטים והצטרפות: ${localPhone(phone)}`;
  let fb = String(text || "").replace(/@[\w.]+/g, "").replace(/[ \t]{2,}/g, " ").trim();
  if (!fb.includes("אימון ניסיון חינם")) fb += `\n\n${closing}`;
  if (!fb.includes(CREDIT)) fb += `\n${CREDIT}`;
  return { facebook: fb, instagram: `${fb}\n\n${IG_TAGS}` };
}

// מה עבד בדף: 15 הפוסטים האחרונים עם תגובות/שיתופים (רק אם הדף מחובר דרך /meta/start)
async function performance(page) {
  if (!page?.token) return [];
  const f = "message,created_time,shares,reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0)";
  const r = await fetch(`https://graph.facebook.com/v24.0/${page.id}/posts?fields=${f}&limit=15&access_token=${page.token}`);
  const j = await r.json();
  if (!r.ok) return console.log(`performance: ${j.error?.message || r.status}`), [];
  return (j.data || []).map((p) => ({
    date: p.created_time.slice(0, 10),
    start: (p.message || "").slice(0, 90),
    reactions: p.reactions?.summary?.total_count || 0,
    comments: p.comments?.summary?.total_count || 0,
    shares: p.shares?.count || 0,
  }));
}

// Gemini כשיש מפתח (חינמי); אחרת Claude עם המפתח שכבר קיים בריפו (אותו מפתח של סוכן הרעיונות)
async function draftsJson(system, user) {
  if (process.env.GEMINI_API_KEY) return gemini(system, user);
  const { ask } = await import("./lib/claude.mjs");
  const t = await ask(system + "\nהחזר JSON בלבד, בלי גדרות קוד.", user);
  return JSON.parse(t.replace(/^```(json)?\s*|\s*```$/g, "").trim());
}

async function gemini(system, user) {
  let err;
  for (const model of ["gemini-flash-latest", "gemini-flash-lite-latest"]) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { temperature: 0.8, responseMimeType: "application/json" },
      }),
    });
    if (r.ok) return JSON.parse((await r.json()).candidates[0].content.parts.map((p) => p.text || "").join(""));
    err = new Error(`${model}: ${r.status}`);
  }
  throw err;
}

const SYSTEM = `את כותבת התוכן של מועדון טניס שולחן מבואות החרמון ע"ש רוני גלבוע (גליל עליון).
קהל: הורים לילדים באזור — קריית שמונה, הקיבוצים והמושבים, דן, דפנה, רמת כורזים ודרום עמק החולה. גם מבוגרים וקבוצת פינג פונג פרקינסון.
אימונים: אולם שאר ישוב — מתחילים א' וה' 16:30-17:30, מתקדמים א', ב', ה' 17:30-19:00, נבחרת א' וה' 19:00-21:00.
רמת כורזים — מתחילים/מתקדמים ב' וד' 16:30-18:00, בוגרים ב' וד' 18:00-20:00 (בקבוצת המתחילים בכורזים חסרים ילדים — לתת לה דגש).
קיבוץ דפנה — בוגרים וסטודנטים ב' וה' 19:30-21:00. פרקינסון — ראשון בבוקר.
כללים: עברית חמה ופשוטה, בלי סופרלטיבים ריקים ובלי ניסוחים שנשמעים כמו AI. 3-6 שורות, אימוג'י אחד-שניים.
בלי @ ובלי האשטגים (התיוגים נוספים אוטומטית). בלי שורת קרדיט ובלי מספר טלפון (נוספים אוטומטית).
כל פוסט מיועד ליום שלפני האימון שהוא מקדם. שלושת הפוסטים שונים באופי (סיפור מהאימון, מידע מעשי, הזמנה לנסות וכו').
לא לחזור על נושאים מהשבוע שעבר. להישען על מה שעבד בדף (תגובות ושיתופים).
החזירי JSON בלבד: מערך באורך מספר המועדים, לכל מועד {"topic": "...", "text": "...", "image": "איזו תמונה מתאימה (תמונה אמיתית מהאימון / פלייר מהתבנית / תמונת AI)"}.`;

async function main() {
  const { firestore, heartbeat } = await import("./lib/firebase.mjs");
  const { tellOwner } = await import("./lib/owner.mjs");
  if (!process.env.GEMINI_API_KEY && !process.env.ANTHROPIC_API_KEY) return console.log("skipped: no GEMINI_API_KEY or ANTHROPIC_API_KEY");
  const db = firestore();
  const today = israelToday();
  const sunday = addDays(today, -new Date(today + "T00:00:00Z").getUTCDay());
  const slots = weekSlots(sunday).filter((s) => s.date >= today);
  if (!slots.length) return console.log("no slots left this week");
  const doc = (n) => db.collection("agentReports").doc(n).get().then((d) => d.data() || {});
  const [social, last] = await Promise.all([doc("social"), doc("content")]);
  const perf = await performance((social.pages || []).find((p) => p.ig) || social.pages?.[0]);

  const user = `המועדים: ${JSON.stringify(slots.map((s) => `${s.date} ${s.time}`))}
ביצועי הפוסטים האחרונים בדף: ${perf.length ? JSON.stringify(perf) : "אין נתונים (הדף עוד לא מחובר)"}
הנושאים מהשבוע שעבר: ${(last.drafts || []).map((d) => d.topic).join(" | ") || "אין"}`;
  const out = await draftsJson(SYSTEM, user);
  const drafts = slots.map((s, i) => ({ at: `${s.date}T${s.time}`, topic: out[i]?.topic || "", image: out[i]?.image || "", ...tidy(out[i]?.text, process.env.OWNER_PHONE) })).filter((d) => d.topic);
  if (!drafts.length) throw new Error("Gemini returned no drafts");

  await db.collection("agentReports").doc("content").set({ date: today, createdAt: new Date().toISOString(), drafts, performance: perf });
  const day = (d) => new Date(d + "Z").toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "numeric", timeZone: "UTC" });
  const text =
    `📣 *טיוטות הפרסום לשבוע*\n\n` +
    drafts.map((d, i) => `*${i + 1}. ${day(d.at)} ${d.at.slice(11)}* — ${d.topic}\n${d.facebook}\n🖼 ${d.image}`).join("\n\n") +
    `\n\nבאינסטגרם נוספים: ${IG_TAGS}\nלאשר: לשלוח תמונה ולכתוב "פרסם 2" (או "פרסם 2 בלי אינסטגרם"). אפשר לבקש שינוי לפני.`;
  await tellOwner(db, { agent: "content", text, templateParam: `${drafts.length} טיוטות פוסטים לשבוע מחכות לאישור שלך` });
  await heartbeat(db, "content");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
