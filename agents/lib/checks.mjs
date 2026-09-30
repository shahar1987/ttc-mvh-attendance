// בדיקות תקינות הנתונים של בודק הבאגים — פונקציות טהורות.
// כל ממצא: { id, severity: "high"|"medium"|"low", text } — הטקסט בעברית ובלי טלפונים.
import { addDays, isValidPhone } from "./analysis.mjs";

const STATUSES = new Set(["Present", "Absent"]);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function dataChecks({ players, groups, attendance, cancellations, today }) {
  const out = [];
  const add = (id, severity, text) => out.push({ id, severity, text });
  const playerById = new Map(players.map((p) => [p.id, p]));
  const groupById = new Map(groups.map((g) => [g.id, g]));

  // חוזה השמירה של attendance: מזהה `${date}_${groupId}_${playerId}`, סטטוס Present/Absent
  const bad = attendance.filter(
    (a) =>
      !DATE.test(a.date || "") ||
      !STATUSES.has(a.status) ||
      !a.groupId ||
      !a.playerId ||
      a.id !== `${a.date}_${a.groupId}_${a.playerId}`,
  );
  if (bad.length) add("attendance-contract", "high", `${bad.length} רשומות נוכחות לא בפורמט התקין (תאריך/סטטוס/מזהה)`);

  const future = attendance.filter((a) => a.date > addDays(today, 1));
  if (future.length) add("attendance-future", "medium", `${future.length} רשומות נוכחות בתאריך עתידי`);

  const orphanPlayer = attendance.filter((a) => a.playerId && !playerById.has(a.playerId));
  if (orphanPlayer.length) add("attendance-orphan-player", "low", `${orphanPlayer.length} רשומות נוכחות של שחקן שלא קיים ברשימה`);

  const orphanGroup = attendance.filter((a) => a.groupId && !groupById.has(a.groupId));
  if (orphanGroup.length) add("attendance-orphan-group", "low", `${orphanGroup.length} רשומות נוכחות של קבוצה שלא קיימת`);

  const activePlayers = players.filter((p) => p.isActive && !p.deleted);
  const noGroup = activePlayers.filter((p) => !p.groupId || !groupById.has(p.groupId));
  if (noGroup.length) add("player-no-group", "medium", `${noGroup.length} שחקנים פעילים בלי קבוצה קיימת (לא יופיעו למאמן)`);

  const noPhone = activePlayers.filter((p) => !isValidPhone(p.parentPhone));
  if (noPhone.length) add("player-no-phone", "low", `${noPhone.length} שחקנים פעילים בלי טלפון תקין (אי אפשר לשלוח להם הודעה)`);

  const noCoach = groups.filter(
    (g) => !g.deleted && !g.coachId && !(Array.isArray(g.coachIds) && g.coachIds.length),
  );
  if (noCoach.length) add("group-no-coach", "medium", `${noCoach.length} קבוצות בלי מאמן משויך: ${noCoach.map((g) => g.name).join(", ")}`);

  // אימונים שעברו בשבוע האחרון ולא מולאה בהם נוכחות (כמו דוח "מילוי מאמנים" באפליקציה)
  const days = [];
  for (let d = addDays(today, -7); d < today; d = addDays(d, 1)) days.push(d);
  const cancelled = new Set((cancellations || []).map((c) => `${c.date}_${c.groupId}`));
  const filled = new Set(attendance.map((a) => `${a.date}_${a.groupId}`));
  const unfilled = [];
  for (const g of groups) {
    if (g.deleted || !Array.isArray(g.days) || !g.days.length) continue;
    const missed = days.filter(
      (d) =>
        (!g.createdDate || d >= g.createdDate) &&
        g.days.includes(new Date(d + "T00:00:00Z").getUTCDay()) &&
        !cancelled.has(`${d}_${g.id}`) &&
        !filled.has(`${d}_${g.id}`),
    );
    if (missed.length) unfilled.push(`${g.name} (${missed.length})`);
  }
  if (unfilled.length) add("unfilled-attendance", "medium", `לא מולאה נוכחות השבוע: ${unfilled.join(", ")}`);

  return out;
}
