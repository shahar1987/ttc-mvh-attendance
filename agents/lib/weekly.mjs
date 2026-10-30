// 📊 הסיכום השבועי (שישי 14:00): מה חסר לסדר ואיך להשתפר. פונקציה טהורה, בלי Firestore ובלי מודל —
// כל שורה נשענת על מספר מהנתונים, כדי שאפשר לבדוק אותה ושהיא לא תמציא.
import { addDays, analyze, isValidPhone, normalizePhone, onlyHeldTrainings } from "./analysis.mjs";

const pct = (recs) => (recs.length ? Math.round((100 * recs.filter((a) => a.status === "Present").length) / recs.length) : null);
const DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const dow = (d) => new Date(d + "T00:00:00Z").getUTCDay();
const list = (names, max = 5) => names.slice(0, max).join(", ") + (names.length > max ? ` ועוד ${names.length - max}` : "");

// אימון שהיה אמור להתקיים בטווח (לפי ימי הקבוצה), לא בוטל ואף אחד לא סומן בו
function unmarkedTrainings(groups, attendance, cancellations, from, to) {
  const cancelled = new Set((cancellations || []).map((c) => `${c.date}_${c.groupId}`));
  const marked = new Set(attendance.map((a) => `${a.date}_${a.groupId}`));
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1))
    for (const g of groups)
      if (Array.isArray(g.days) && g.days.includes(dow(d)) && !cancelled.has(`${d}_${g.id}`) && !marked.has(`${d}_${g.id}`))
        out.push({ g, day: DAYS[dow(d)] });
  return out;
}

// הודעה שבועית לכל מדריך על הקבוצות שלו. text = גרסה מסודרת בשורות (כשהמדריך כתב לשולה ב-24 השעות האחרונות),
// param = אותו תוכן בשורה אחת לתבנית club_message (Meta לא מקבלת ירידות שורה בתבנית).
// מנהל לא מקבל — הוא מקבל את הסיכום המלא. מדריך שביקש שקט (agentReports/coaches.quiet) מדולג.
export function coachMessages({ players, groups, users, attendance, cancellations, today, quiet = [] }) {
  const weekStart = addDays(today, -dow(today));
  const held = onlyHeldTrainings(attendance, cancellations, today).filter((a) => !a.excused);
  const live = groups.filter((g) => !g.deleted && g.isActive !== false);
  const riskById = new Map(analyze({ players, groups, attendance, cancellations, today }).atRisk.map((r) => [r.playerId, r]));
  const unmarked = unmarkedTrainings(live, attendance, cancellations, weekStart, today);
  const out = [];
  for (const u of users) {
    if (u.deleted || quiet.includes(u.id) || String(u.role || "").toLowerCase() === "admin" || !isValidPhone(u.phone || "")) continue;
    const mine = live.filter((g) => g.coachId === u.id || (Array.isArray(g.coachIds) && g.coachIds.includes(u.id)));
    if (!mine.length) continue;
    const blocks = mine.map((g) => {
      const roster = players.filter((p) => p.groupId === g.id && p.isActive && !p.deleted && !p.trial);
      const week = held.filter((a) => a.groupId === g.id && a.date >= weekStart && a.date <= today);
      const pc = week.length ? Math.round((100 * week.filter((a) => a.status === "Present").length) / week.length) : null;
      const missing = unmarked.filter((x) => x.g.id === g.id).map((x) => x.day);
      const noPhone = roster.filter((p) => !isValidPhone(p.parentPhone)).map((p) => (p.name || "").trim());
      const noDays = (g.days || []).length > 1 ? roster.filter((p) => !(Array.isArray(p.trainingDays) && p.trainingDays.length)).map((p) => (p.name || "").trim()) : [];
      const absent = roster.map((p) => riskById.get(p.id)).filter(Boolean).map((r) => `${r.playerName} (${r.reason})`);
      const items = [];
      if (missing.length) items.push(`📝 לא מולאה נוכחות: יום ${missing.join(", ")}`);
      if (absent.length) items.push(`⚠️ הרבה חיסורים: ${list(absent, 4)}`);
      if (noPhone.length) items.push(`📞 חסר טלפון: ${list(noPhone)}`);
      if (noDays.length) items.push(`📅 לא סומנו ימי אימון: ${list(noDays)}`);
      if (!items.length) items.push("✅ הכל מסודר, כל הכבוד");
      return { head: `${g.name}${pc === null ? "" : ` — נוכחות השבוע ${pc}%`}`, items };
    });
    const first = (u.name || "").trim().split(/\s+/)[0] || "";
    const hello = `היי ${first}, הסיכום השבועי של הקבוצה שלך 📋`;
    const bye = "אפשר לתקן הכל באפליקציה. שבת שלום!";
    out.push({
      uid: u.id,
      name: u.name || "מדריך",
      phone: normalizePhone(u.phone),
      text: [hello, ...blocks.map((b) => `\n*${b.head}*\n${b.items.join("\n")}`), "", bye].join("\n"),
      param: `${hello} ${blocks.map((b) => `${b.head}: ${b.items.join(" · ")}`).join(" | ")}. ${bye}`.slice(0, 900),
    });
  }
  return out;
}

export function weeklySummary({ players, groups, attendance, cancellations, today }) {
  const weekStart = addDays(today, -dow(today));
  const prevFrom = addDays(weekStart, -28);
  const held = onlyHeldTrainings(attendance, cancellations, today).filter((a) => !a.excused);
  const active = players.filter((p) => p.isActive && !p.deleted && !p.trial);
  const live = groups.filter((g) => !g.deleted);

  const rows = live
    .map((g) => {
      const recs = held.filter((a) => a.groupId === g.id);
      const now = pct(recs.filter((a) => a.date >= weekStart && a.date <= today));
      const before = pct(recs.filter((a) => a.date >= prevFrom && a.date < weekStart));
      return { g, now, before, diff: now !== null && before !== null ? now - before : null };
    })
    .filter((r) => r.now !== null);

  const unmarked = unmarkedTrainings(live, attendance, cancellations, weekStart, today).map((u) => `${u.g.name} (${u.day})`);

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

// 🩺 בדיקה לפני השליחה: שאין "נשלח / לא נשלח" בשקט. בודק שלכל קבוצה יש מדריך עם טלפון, שה-worker
// (שמוציא את ההודעות מהתור) חי, שהתור לא תקוע, ושלא היו כישלוני מסירה בשבוע האחרון.
// problems = מה שמונע ממדריך לקבל את ההודעה; notes = לידיעה.
export function weeklyHealth({ groups, users, quiet = [], bot = {}, now = new Date() }) {
  const problems = [];
  const notes = [];
  const live = groups.filter((g) => !g.deleted && g.isActive !== false);
  const byId = new Map(users.filter((u) => !u.deleted).map((u) => [u.id, u]));
  const coachesOf = (g) => [g.coachId, ...(Array.isArray(g.coachIds) ? g.coachIds : [])].filter(Boolean).map((id) => byId.get(id)).filter(Boolean);
  const isAdmin = (u) => String(u.role || "").toLowerCase() === "admin";
  for (const g of live) {
    const cs = coachesOf(g).filter((u) => !isAdmin(u));
    if (!coachesOf(g).length) problems.push(`לקבוצה ${g.name} לא משויך מדריך באפליקציה`);
    else if (!cs.length) notes.push(`${g.name}: רק אתה מדריך — הנתונים שלה בסיכום שלך`);
    for (const u of cs) {
      if (!isValidPhone(u.phone || "")) problems.push(`למדריך ${u.name || "?"} (${g.name}) אין טלפון תקין באפליקציה`);
      else if (quiet.includes(u.id)) notes.push(`${u.name || "?"} מושתק — לא יקבל הודעות`);
    }
    if (cs.length && cs.every((u) => quiet.includes(u.id))) problems.push(`לקבוצה ${g.name} אין מדריך פעיל שמקבל הודעות — לשייך מדריך באפליקציה`);
  }
  const hours = (iso) => (iso ? (now - new Date(iso)) / 36e5 : Infinity);
  if (hours(bot.lastCronError?.at) < 1) problems.push(`השרת של שולה נכשל בשעה האחרונה: ${String(bot.lastCronError.message || "").slice(0, 120)}`);
  const queue = Array.isArray(bot.outboxQueue) ? bot.outboxQueue : [];
  const stuck = queue.filter((x) => hours(x.at) > 1).length;
  if (stuck) problems.push(`${stuck} הודעות תקועות בתור יותר משעה — השרת של שולה לא מוציא אותן`);
  const fails = (bot.failLog || []).filter((f) => hours(f.at) < 7 * 24);
  if (fails.length) problems.push(`${fails.length} הודעות לא נמסרו בשבוע האחרון (${[...new Set(fails.map((f) => f.who).filter(Boolean))].join(", ")})`);
  return { problems: [...new Set(problems)], notes: [...new Set(notes)] };
}
