// 💡 סוכן הרעיונות — פעם בשבוע (ראשון בבוקר): 3 הצעות לשיפור המועדון או האפליקציה.
//
// Claude מקבל רק נתונים מצטברים (אחוזי נוכחות לפי קבוצה ויום, כמה בסכנת נשירה,
// ממצאי בודק הבאגים) — בלי שמות ובלי טלפונים.
import { readFileSync } from "node:fs";
import { firestore, loadAll, heartbeat } from "./lib/firebase.mjs";
import { analyze, addDays, israelToday } from "./lib/analysis.mjs";
import { ask } from "./lib/claude.mjs";
import { tellOwner } from "./lib/owner.mjs";

const db = firestore();
// בלי מפתח הסוכן לא יכול לעבוד — נכשלים בקול (ריצה אדומה + הודעה לשולה) ולא "מצליחים" בשקט
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ideas did not run: ANTHROPIC_API_KEY is missing (Settings → Secrets and variables → Actions)");
  await tellOwner(db, { agent: "ideas", text: "💡 סוכן הרעיונות לא רץ: חסר מפתח ANTHROPIC_API_KEY ב-GitHub" }).catch((e) => console.error(e.message));
  process.exit(1);
}
const today = israelToday();
const [players, groups, attendance] = await Promise.all([
  loadAll(db, "players"),
  loadAll(db, "groups"),
  loadAll(db, "attendance", (c) => c.where("date", ">=", addDays(today, -91))),
]);

const pct = (recs) => (recs.length ? Math.round((100 * recs.filter((r) => r.status === "Present").length) / recs.length) : null);
const recentFrom = addDays(today, -28);
const WEEKDAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

const byGroup = groups
  .filter((g) => !g.deleted)
  .map((g) => {
    const recs = attendance.filter((a) => a.groupId === g.id);
    return {
      group: g.name,
      activePlayers: players.filter((p) => p.groupId === g.id && p.isActive && !p.deleted).length,
      attendancePctLast4Weeks: pct(recs.filter((a) => a.date >= recentFrom)),
      attendancePctPrev8Weeks: pct(recs.filter((a) => a.date < recentFrom)),
    };
  });
const byWeekday = WEEKDAYS.map((d, i) => ({
  day: d,
  attendancePct: pct(attendance.filter((a) => new Date(a.date + "T00:00:00Z").getUTCDay() === i)),
})).filter((x) => x.attendancePct !== null);

const report = analyze({ players, groups, attendance, today });
const bugs = ((await db.collection("agentReports").doc("bugs").get()).data() || {}).findings || [];
const pastIdeas = ((await db.collection("agentReports").doc("ideas").get()).data() || {}).text || "";

const stats = {
  activePlayers: players.filter((p) => p.isActive && !p.deleted).length,
  byGroup,
  byWeekday,
  dropoutRisk: report.summary,
  openFindings: bugs.map((b) => b.text),
};

const system = `אתה יועץ למועדון טניס שולחן קהילתי קטן בצפון (ילדים, נוער, מבוגרים וקבוצת פרקינסון).
יש למועדון אפליקציית נוכחות למאמנים ולמנהלת. אלה היכולות שלה היום:
${readFileSync(new URL("../README.md", import.meta.url), "utf8").split("## התחברות")[0].slice(0, 2500)}

כתוב בעברית, להודעת וואטסאפ אחת: בדיוק 3 רעיונות, כל אחד בשורה-שתיים, עם אימוג'י בתחילתו.
כל רעיון נשען על נתון מהמספרים שתקבל ואומר מה לעשות השבוע. לפחות רעיון אחד לשימור שחקנים ולפחות אחד לאפליקציה.
בלי הקדמה ובלי סיכום. אל תחזור על רעיונות מהשבוע שעבר.`;

const text = await ask(
  system,
  `הנתונים של השבוע (JSON):\n${JSON.stringify(stats)}\n\nהרעיונות מהשבוע שעבר:\n${pastIdeas || "אין"}`,
);

await db.collection("agentReports").doc("ideas").set({ date: today, createdAt: new Date().toISOString(), text, stats });
await tellOwner(db, {
  agent: "ideas",
  text: `💡 3 רעיונות לשבוע:\n${text}`,
  templateParam: "3 רעיונות חדשים לשבוע מחכים לך",
});
await heartbeat(db, "ideas");
