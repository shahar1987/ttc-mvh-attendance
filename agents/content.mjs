// 📣 סוכן הפרסום — ראשון בבוקר: 3 טיוטות פוסטים לשבוע, לומד ממה שעבד בדף בשבועות האחרונים.
// הטיוטות נשלחות לבעלים בוואטסאפ. שום דבר לא מתפרסם מכאן: הוא עונה לשולה "פרסם 2" עם תמונה,
// ושולה מפרסמת/מתזמנת דרך publish_post (worker/src/meta.js) רק אחרי "כן".
// Gemini (חינמי, אותו מפתח של שולה). בלי שמות שחקנים ובלי טלפונים פרטיים בקוד — הריפו ציבורי.
import { fileURLToPath } from "node:url";
import { israelToday, addDays } from "./lib/analysis.mjs";
import { sensitiveDay } from "./lib/sensitive.mjs";
import { weeklyReport } from "./insights.mjs";
import { clubPage, CLUB_PHONE, SCHEDULE_SHEET } from "./lib/club.mjs";
import { gemini } from "./lib/gemini.mjs";

// תיוג באינסטגרם בלבד. בפייסבוק @ דרך ה-API נשאר טקסט מת — שם כותבים את השמות במילים.
// המועצה והמתנ"ס תמיד; קריית שמונה וגליל עליון רק בפוסט על רמת כורזים.
export const IG_TAGS = "@matnas.mvhr @mevoothahermon";
const KORAZIM_TAGS = "@kiryat8 @galil.elion";
export const igTags = (place) => (place === "רמת כורזים" ? `${IG_TAGS} ${KORAZIM_TAGS}` : IG_TAGS);
export const CREDIT = 'בשיתוף מתנ"ס אזורי מבואות החרמון והמועצה האזורית מבואות החרמון';
// הלו"ז נקרא כל שבוע מהגיליון "לוז אימונים 2026" (liveTrainings). זה רק גיבוי כשהגיליון לא נגיש — עותק מ-11.10.2026.
// לפי יום בשבוע (0 = ראשון). ליגה (שלישי/רביעי בכורזים) לא כאן — זה לא אימון שמזמינים אליו.
export const TRAININGS = {
  0: [["מתחילים", "שאר ישוב", "16:30-17:30"], ["מתקדמים", "שאר ישוב", "17:30-19:00"], ["נבחרת תחרותית", "שאר ישוב", "19:00-21:00"]],
  1: [["מתחילים", "רמת כורזים", "16:30-18:00"], ["מתקדמים", "שאר ישוב", "17:30-19:00"], ["בוגרים", "רמת כורזים", "18:00-20:00"], ["בוגרים", "דפנה", "19:30-21:00"]],
  3: [["מתחילים", "רמת כורזים", "16:30-18:00"], ["בוגרים", "רמת כורזים", "18:00-20:00"]],
  4: [["מתחילים", "שאר ישוב", "16:30-17:30"], ["מתקדמים", "שאר ישוב", "17:30-19:00"], ["נבחרת תחרותית", "שאר ישוב", "19:00-21:00"], ["בוגרים", "דפנה", "19:30-21:00"]],
};
const DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
// יום לפני אימון: ראשון→שני, שלישי→רביעי, רביעי→חמישי. "מחר" בפוסט = היום שאחרי הפרסום.
const SLOTS = [{ dow: 0, time: "17:00" }, { dow: 2, time: "17:00" }, { dow: 3, time: "17:00" }];
const PHOTO = "תמונה אמיתית מתיקיית המדיה בדרייב";

export const localPhone = (p) => String(p || "").replace(/\D/g, "").replace(/^972/, "0").replace(/^(\d{3})(\d{7})$/, "$1-$2");

// מועדי הפרסום של השבוע שמתחיל ב-sunday (YYYY-MM-DD), בלי 7.10, יום כיפור ויום הזיכרון
export const weekSlots = (sunday, trainings = TRAININGS) =>
  SLOTS.map((s) => ({ ...s, date: addDays(sunday, s.dow), options: trainings[s.dow + 1] || [] })).filter((s) => s.options.length && !sensitiveDay(s.date));

// CSV של הגיליון → { יום בשבוע: [[קבוצה, מקום, שעות]] }. שורת "יום X" פותחת יום; שורת אימון = מספר בעמודה A.
// עמודות: A מס', B שעות, C קבוצה, D מיקום, G סטטוס. בלי ליגה ובלי מה שלא "פעיל".
export function parseSchedule(csv) {
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (q) c === '"' ? (csv[i + 1] === '"' ? ((cell += '"'), i++) : (q = false)) : (cell += c);
    else if (c === '"') q = true;
    else if (c === ",") row.push(cell), (cell = "");
    else if (c === "\n") row.push(cell), rows.push(row), (row = []), (cell = "");
    else if (c !== "\r") cell += c;
  }
  rows.push([...row, cell]);
  const out = {};
  let dow = -1;
  for (const [a = "", hours = "", group = "", place = "", , , status = ""] of rows) {
    const day = DAYS.indexOf(a.trim().replace(/^יום /, ""));
    if (day >= 0) dow = day;
    else if (dow >= 0 && /^\d+$/.test(a.trim()) && /^\d/.test(hours) && status.trim() === "פעיל" && !group.includes("ליגה"))
      (out[dow] ||= []).push([group.trim().replace("מתקמים", "מתקדמים"), place.trim(), hours.trim()]);
  }
  return out;
}

// הלו"ז העדכני מהגיליון; null אם הוא לא נגיש (לא משותף בקישור / אין רשת) — אז משתמשים ב-TRAININGS
async function liveTrainings() {
  try {
    const r = await fetch(`https://docs.google.com/spreadsheets/d/${SCHEDULE_SHEET}/export?format=csv`);
    if (!r.ok) return console.log(`schedule sheet: ${r.status}`), null;
    const t = parseSchedule(await r.text());
    return Object.keys(t).length ? t : null;
  } catch (e) {
    return console.log(`schedule sheet: ${e.message}`), null;
  }
}

const training = ([group, place, hours]) => `${group} ב${place} ${hours}`;

// סידור טיוטה מהמודל: פייסבוק בלי @, קרדיט ושורת סיום תמיד, אינסטגרם = אותו טקסט + תיוגים
// שורת סיום/קרדיט שהמודל כתב בעצמו (לפעמים בלי טלפון) נמחקות ותמיד נכתבות מחדש
export function tidy(text, phone = CLUB_PHONE, tags = IG_TAGS) {
  // בלי טלפון (המשתנה CLUB_PHONE חסר) — שורת סיום שעדיין עובדת, לא "לפרטים: " ריק
  const closing = `אימון ניסיון חינם לכולם, בכל מועד! לפרטים והצטרפות: ${localPhone(phone) || "בהודעה פרטית לדף"}`;
  const body = String(text || "")
    .split("\n")
    .filter((l) => !l.includes("אימון ניסיון חינם") && !l.includes(CREDIT))
    .join("\n")
    .replace(/@[\w.]+/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  const fb = `${body}\n\n${closing}\n${CREDIT}`;
  return { facebook: fb, instagram: `${fb}\n\n${tags}` };
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
  if (process.env.GEMINI_API_KEY) return gemini(system, user, { json: true });
  const { ask } = await import("./lib/claude.mjs");
  const t = await ask(system + "\nהחזר JSON בלבד, בלי גדרות קוד.", user);
  return JSON.parse(t.replace(/^```(json)?\s*|\s*```$/g, "").trim());
}

const SYSTEM = `את כותבת התוכן של מועדון טניס שולחן מבואות החרמון ע"ש רוני גלבוע (גליל עליון).
קהל: הורים לילדים באזור — קריית שמונה, הקיבוצים והמושבים, דן, דפנה, רמת כורזים ודרום עמק החולה. גם מבוגרים וקבוצת פינג פונג פרקינסון.
בקבוצת המתחילים ברמת כורזים חסרים ילדים — לתת לה דגש.
כללים: עברית חמה ופשוטה, בלי סופרלטיבים ריקים ובלי ניסוחים שנשמעים כמו AI. 3-6 שורות, אימוג'י אחד-שניים.
בלי @ ובלי האשטגים (התיוגים נוספים אוטומטית). בלי שורת קרדיט ובלי מספר טלפון (נוספים אוטומטית).
כל פוסט מקדם אימון אחד מהאימונים של מחר שמופיעים ליד המועד שלו (training = המספר שלו ברשימה), ו"מחר" בטקסט = היום של האימון הזה.
ימים, שעות ומקומות רק מהרשימה — לא להמציא ולא לשנות. שלושת הפוסטים שונים באופי (סיפור מהאימון, מידע מעשי, הזמנה לנסות וכו').
לא לחזור על נושאים מהשבוע שעבר. להישען על מה שעבד בדף (תגובות ושיתופים).
החזירי JSON בלבד: מערך באורך מספר המועדים, לכל מועד {"topic": "...", "text": "...", "training": 1, "image": "${PHOTO}" או "פלייר מהתבנית בלי תמונה"}. בלי תמונות AI.`;

// טיוטה אחת מתשובת המודל: האימון רק מהרשימה של מחר, תמונה רק אמיתית או פלייר (בלי AI), תיוג לפי המקום
export function draft(slot, o = {}) {
  const t = slot.options[(Number(o.training) || 1) - 1] || slot.options[0];
  const tags = igTags(t[1]);
  const image = /אמיתית|דרייב/.test(o.image || "") ? PHOTO : "פלייר מהתבנית בלי תמונה";
  return { at: `${slot.date}T${slot.time}`, training: `מחר (${DAYS[slot.dow + 1]}): ${training(t)}`, topic: o.topic || "", image, tags, ...tidy(o.text, CLUB_PHONE, tags) };
}

async function main() {
  const { firestore, heartbeat, reportMissingKey } = await import("./lib/firebase.mjs");
  const { tellOwner } = await import("./lib/owner.mjs");
  const db = firestore();
  // Gemini או Claude — מספיק אחד מהם (ראו draftsJson). בלי אף אחד נכשלים בקול: ריצה אדומה + הודעה לשולה
  if (!process.env.GEMINI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    console.error("content did not run: no GEMINI_API_KEY or ANTHROPIC_API_KEY (Settings → Secrets and variables → Actions)");
    await tellOwner(db, { agent: "content", text: "📣 סוכן הפרסום לא רץ: חסר מפתח (GEMINI_API_KEY או ANTHROPIC_API_KEY) ב-GitHub" }).catch((e) => console.error(e.message));
    await reportMissingKey(db, "content", "GEMINI_API_KEY|ANTHROPIC_API_KEY").catch((e) => console.error(e.message));
    process.exitCode = 1;
    return;
  }
  const today = israelToday();
  const sunday = addDays(today, -new Date(today + "T00:00:00Z").getUTCDay());
  const live = await liveTrainings();
  const slots = weekSlots(sunday, live || TRAININGS).filter((s) => s.date >= today);
  if (!slots.length) return console.log("no slots left this week");
  const doc = (n) => db.collection("agentReports").doc(n).get().then((d) => d.data() || {});
  const [social, last, insights, bot] = await Promise.all([doc("social"), doc("content"), doc("insights"), doc("bot")]);
  // הנתונים היומיים (insights.mjs) כשיש; אחרת 15 הפוסטים האחרונים מהדף כמו קודם
  const fresh = insights.posts && Date.now() - new Date(insights.updatedAt) < 3 * 864e5;
  const perf = fresh ? insights.posts.map(({ platform, at, type, text, reach, likes, comments, shares, saves }) => ({ platform, at, type, text, reach, likes, comments, shares, saves })) : await performance(clubPage(social));
  const rules = (bot.postRules || []).map((r) => r.rule);

  const user = `המועדים והאימונים של מחר לכל מועד:\n${slots.map((s) => `${s.date} ${s.time} (יום ${DAYS[s.dow]}) — מחר: ${s.options.map((t, i) => `${i + 1}. ${training(t)}`).join(", ")}`).join("\n")}
ביצועי הפוסטים האחרונים בדף: ${perf.length ? JSON.stringify(perf) : "אין נתונים (הדף עוד לא מחובר)"}
הנושאים מהשבוע שעבר: ${(last.drafts || []).map((d) => d.topic).join(" | ") || "אין"}`;
  const out = await draftsJson(rules.length ? `${SYSTEM}\nכללים קבועים שהבעלים אישר (גוברים על כל השאר):\n- ${rules.join("\n- ")}` : SYSTEM, user);
  const drafts = slots.map((s, i) => draft(s, out[i])).filter((d) => d.topic);
  if (!drafts.length) throw new Error("Gemini returned no drafts");

  await db.collection("agentReports").doc("content").set({ date: today, createdAt: new Date().toISOString(), drafts, performance: perf });
  const day = (d) => new Date(d + "Z").toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "numeric", timeZone: "UTC" });
  const report = fresh ? `📊 *מה עבד השבוע*\n${weeklyReport(insights.posts)}\n\n` : "";
  const text =
    report +
    `📣 *טיוטות הפרסום לשבוע*\n\n` +
    (live ? "" : `⚠️ לא הצלחתי לקרוא את הגיליון "לוז אימונים 2026" (צריך שיתוף "כל מי שיש לו הקישור — צפייה"), אז השעות מהעותק השמור מ-11.10. לבדוק שהן עדיין נכונות.\n\n`) +
    drafts.map((d, i) => `*${i + 1}. ${day(d.at)} ${d.at.slice(11)}* — ${d.topic}\n📍 ${d.training}\n${d.facebook}\n🖼 ${d.image}${d.image === PHOTO ? "\n⚠️ ילדים בתמונה = לפרסם רק עם הסכמת הורים" : ""}\n🏷 באינסטגרם נוספים: ${d.tags}`).join("\n\n") +
    `\n\nלאשר: לשלוח תמונה ולכתוב "פרסם 2" (או "פרסם 2 בלי אינסטגרם"). אפשר לבקש שינוי לפני.`;
  await tellOwner(db, { agent: "content", text, templateParam: `${drafts.length} טיוטות פוסטים לשבוע מחכות לאישור שלך` });
  await heartbeat(db, "content");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
