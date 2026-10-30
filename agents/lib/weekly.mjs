// 📊 הסיכום השבועי (שישי 14:00): מה חסר לסדר ואיך להשתפר. פונקציה טהורה, בלי Firestore ובלי מודל —
// כל שורה נשענת על מספר מהנתונים, כדי שאפשר לבדוק אותה ושהיא לא תמציא.
import { addDays, analyze, isValidPhone, onlyHeldTrainings } from "./analysis.mjs";

const pct = (recs) => (recs.length ? Math.round((100 * recs.filter((a) => a.status === "Present").length) / recs.length) : null);
const DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const dow = (d) => new Date(d + "T00:00:00Z").getUTCDay();
const list = (names, max = 5) => names.slice(0, max).join(", ") + (names.length > max ? ` ועוד ${names.length - max}` : "");

export function weeklySummary({ players, groups, attendance, cancellations, today }) {
  const weekStart = addDays(today, -dow(today));
  const prevFrom = addDays(weekStart, -28);
  const held = onlyHeldTrainings(attendance, cancellations, today).filter((a) => !a.excused);
  const active = players.filter((p) => p.isActive && !p.deleted && !p.trial);
  const live = groups.filter((g) => !g.deleted);
  const cancelled = new Set((cancellations || []).map((c) => `${c.date}_${c.groupId}`));
  const marked = new Set(attendance.map((a) => `${a.date}_${a.groupId}`));

  const rows = live
    .map((g) => {
      const recs = held.filter((a) => a.groupId === g.id);
      const now = pct(recs.filter((a) => a.date >= weekStart && a.date <= today));
      const before = pct(recs.filter((a) => a.date >= prevFrom && a.date < weekStart));
      return { g, now, before, diff: now !== null && before !== null ? now - before : null };
    })
    .filter((r) => r.now !== null);

  // אימון שהיה אמור להתקיים השבוע (לפי ימי הקבוצה), לא בוטל ואף אחד לא סומן בו
  const unmarked = [];
  for (let d = weekStart; d <= today; d = addDays(d, 1))
    for (const g of live)
      if (Array.isArray(g.days) && g.days.includes(dow(d)) && !cancelled.has(`${d}_${g.id}`) && !marked.has(`${d}_${g.id}`))
        unmarked.push(`${g.name} (${DAYS[dow(d)]})`);

  const report = analyze({ players, groups, attendance, cancellations, today });
  const noPhone = active.filter((p) => !isValidPhone(p.parentPhone)).map((p) => (p.name || "").trim());
  const notPaying = active.filter((p) => p.notPaying).length;
  const high = report.atRisk.filter((r) => r.level === "high");

  const fix = [];
  if (unmarked.length) fix.push(`📝 אימונים שלא סומנה בהם נוכחות: ${list(unmarked)}`);
  if (report.summary.pending) fix.push(`✉️ ${report.summary.pending} היעדרויות עוד בלי הודעה להורים/לשחקן`);
  if (high.length) fix.push(`⚠️ בסכנת נשירה גבוהה: ${list(high.map((r) => `${r.playerName} (${r.groupName})`))}`);
  if (noPhone.length) fix.push(`📞 בלי טלפון תקין באפליקציה: ${list(noPhone)}`);
  if (notPaying) fix.push(`💳 ${notPaying} מסומנים כלא משלמים — מסך "מי לא משלם"`);

  const better = [];
  const drops = rows.filter((r) => r.diff !== null && r.diff <= -10).sort((a, b) => a.diff - b.diff);
  for (const r of drops.slice(0, 2)) better.push(`📉 ${r.g.name}: ${r.now}% השבוע מול ${r.before}% בחודש שלפני — לבדוק עם המאמן מה השתנה`);
  const ups = rows.filter((r) => r.diff !== null && r.diff >= 10).sort((a, b) => b.diff - a.diff);
  if (ups[0]) better.push(`📈 ${ups[0].g.name} עלתה ל-${ups[0].now}% (מ-${ups[0].before}%) — כדאי לפרגן לקבוצה ולמאמן`);
  const weakest = rows.filter((r) => r.now < 70).sort((a, b) => a.now - b.now)[0];
  if (weakest && !drops.includes(weakest)) better.push(`🎯 ${weakest.g.name} הכי נמוכה השבוע (${weakest.now}%) — שיחה קצרה עם מי שלא מגיע`);

  const lines = [`📊 סיכום שבועי — ${weekStart.slice(8)}.${+weekStart.slice(5, 7)}–${today.slice(8)}.${+today.slice(5, 7)}`, ""];
  if (rows.length) {
    lines.push("נוכחות השבוע:");
    for (const r of rows) lines.push(`• ${r.g.name}: ${r.now}%${r.diff === null || r.diff === 0 ? "" : r.diff > 0 ? ` (↑${r.diff})` : ` (↓${-r.diff})`}`);
    lines.push("");
  }
  lines.push("🔧 מה לסדר:", ...(fix.length ? fix.map((x) => `• ${x}`) : ["• הכל מסודר השבוע"]), "");
  if (better.length) lines.push("💡 איך להשתפר:", ...better.map((x) => `• ${x}`));
  return { text: lines.join("\n").trim(), counts: { groups: rows.length, unmarked: unmarked.length, fix: fix.length, better: better.length } };
}
