// הלוגיקה של הסורק היומי — פונקציות טהורות, בלי Firestore, כדי שאפשר לבדוק אותן.
//
// "ממתין להודעה" ו"שתי היעדרויות ברצף" מחושבים בדיוק כמו באפליקציה
// (pendingAbsenceMsgs, absenceAlerts, lastTwoAbsences ב-part-a.js), כדי שהסוכן
// והמאמנים יראו את אותה רשימה ואף הורה לא יקבל שתי הודעות על אותה היעדרות.
// "סכנת נשירה" חדש, ומוגדר ב-dropoutRisk למטה.
import { playerGender } from "./gender.mjs";

export function addDays(date, n) {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function israelToday(now = new Date()) {
  return now.toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
}

export function hebrewDay(date) {
  return new Date(date + "T12:00:00Z").toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

export function whenText(date, today) {
  if (date === today) return "היום";
  if (date === addDays(today, -1)) return "אתמול";
  return `ב${hebrewDay(date)}`;
}

export function isAdultGroup(g) {
  if (!g) return false;
  if (typeof g.isAdultGroup === "boolean") return g.isAdultGroup;
  return /מבוגרים|בוגרים|פרקינסון|סגל|ותיקים/.test(g.name || "");
}

export function normalizePhone(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("972")) return "972" + digits.slice(3).replace(/^0+/, "");
  if (digits.startsWith("0")) return "972" + digits.replace(/^0+/, "");
  if (digits.length === 9 && digits.startsWith("5")) return "972" + digits;
  return digits;
}

export function isValidPhone(value) {
  return /^972\d{8,9}$/.test(normalizePhone(value));
}

const active = (p) => p && p.isActive && !p.deleted;

// רשומה אחת לכל יום לכל שחקן; נוכחות גוברת על היעדרות. מהחדש לישן.
export function playerHistory(attendance, playerId, today) {
  const byDate = new Map();
  for (const a of attendance) {
    if (a.playerId !== playerId || !a.date || a.date >= today) continue;
    const prev = byDate.get(a.date);
    if (!prev || prev.status !== "Present") byDate.set(a.date, a);
  }
  return [...byDate.values()].sort((x, y) => y.date.localeCompare(x.date));
}

function historyIndex(attendance, today) {
  const by = new Map();
  for (const a of attendance) {
    if (!a.playerId || !a.date || a.date >= today) continue;
    let m = by.get(a.playerId);
    if (!m) by.set(a.playerId, (m = new Map()));
    const prev = m.get(a.date);
    if (!prev || prev.status !== "Present") m.set(a.date, a);
  }
  const out = new Map();
  for (const [pid, m] of by) out.set(pid, [...m.values()].sort((x, y) => y.date.localeCompare(x.date)));
  return out;
}

function lastTwoAbsences(hist) {
  if (hist.length < 2) return null;
  if (hist[0].status !== "Absent" || hist[1].status !== "Absent") return null;
  return [hist[0].date, hist[1].date];
}

function rate(recs) {
  if (!recs.length) return null;
  return recs.filter((r) => r.status === "Present").length / recs.length;
}

// סכנת נשירה: מי שעדיין רשום כפעיל אבל מפסיק להגיע. שלושה סימנים, מהחמור לקל:
//   1. 3 היעדרויות ברצף או יותר
//   2. ב-4 השבועות האחרונים הגיע לפחות ממחצית האימונים, אחרי שבחודשיים שלפני הגיע ל-70% ומעלה
//   3. הגיע לפחות ממחצית האימונים ב-4 השבועות האחרונים (לפחות 3 אימונים)
export function dropoutRisk(hist, today) {
  let streak = 0;
  for (const r of hist) {
    if (r.status !== "Absent") break;
    streak++;
  }
  const recentFrom = addDays(today, -28);
  const prevFrom = addDays(today, -84);
  const recent = hist.filter((r) => r.date >= recentFrom);
  const prev = hist.filter((r) => r.date >= prevFrom && r.date < recentFrom);
  const recentRate = rate(recent);
  const prevRate = rate(prev);
  const lastPresent = hist.find((r) => r.status === "Present")?.date || null;
  const base = { streak, recentRate, prevRate, recentCount: recent.length, lastPresent };
  if (streak >= 3) return { level: "high", reason: `${streak} היעדרויות ברצף`, ...base };
  if (recent.length >= 2 && recentRate < 0.5 && prevRate !== null && prev.length >= 3 && prevRate >= 0.7)
    return {
      level: "high",
      reason: `ירידה חדה: ${pct(recentRate)} בחודש האחרון לעומת ${pct(prevRate)} לפני כן`,
      ...base,
    };
  if (recent.length >= 3 && recentRate < 0.5)
    return { level: "medium", reason: `הגיע ל-${pct(recentRate)} מהאימונים בחודש האחרון`, ...base };
  return null;
}

const pct = (x) => `${Math.round(x * 100)}%`;

// הסריקה המלאה. מחזירה את כל מה שהדוח צריך, כולל טלפון (נשמר רק ב-Firestore, לא ביומן).
export function analyze({ players, groups, attendance, today }) {
  const groupById = new Map(groups.map((g) => [g.id, g]));
  const playerById = new Map(players.map((p) => [p.id, p]));
  const hist = historyIndex(attendance, today);
  const yesterday = addDays(today, -1);

  const item = (p, g, kind, date, extra = {}) => ({
    key: `${kind}:${date}:${g ? g.id : ""}:${p.id}`,
    kind,
    date,
    playerId: p.id,
    playerName: (p.name || "").trim(),
    groupId: g ? g.id : p.groupId || "",
    groupName: g ? g.name || "" : "",
    adult: isAdultGroup(g),
    gender: playerGender(p),
    phone: isValidPhone(p.parentPhone) ? normalizePhone(p.parentPhone) : "",
    whenText: whenText(date, today),
    ...extra,
  });

  // שתי היעדרויות ברצף שעוד לא טופלו (כמו absenceAlerts)
  const repeat = [];
  const repeatDates = new Map();
  for (const p of players) {
    if (!active(p)) continue;
    const dates = lastTwoAbsences(hist.get(p.id) || []);
    if (!dates) continue;
    repeatDates.set(p.id, dates);
    if (p.alertHandledDate && p.alertHandledDate >= dates[0]) continue;
    repeat.push(item(p, groupById.get(p.groupId), "repeat", dates[0], { dates }));
  }

  // היעדרות בודדת מהשבוע האחרון שלא נשלחה עליה הודעה (כמו pendingAbsenceMsgs)
  const from = addDays(today, -6);
  const single = [];
  for (const a of attendance) {
    if (a.status !== "Absent" || a.msgSentAt) continue;
    if (!a.date || a.date >= today || a.date < from) continue;
    const p = playerById.get(a.playerId);
    if (!active(p)) continue;
    if (p.alertHandledDate && p.alertHandledDate >= a.date) continue;
    const two = repeatDates.get(p.id);
    if (two && two.includes(a.date)) continue;
    // כבר ממתינה לו הודעת "שתי היעדרויות" — הודעה אחת להורה מספיקה
    if (repeat.some((r) => r.playerId === p.id)) continue;
    single.push(item(p, groupById.get(a.groupId), "absence", a.date));
  }

  const atRisk = [];
  for (const p of players) {
    if (!active(p)) continue;
    const r = dropoutRisk(hist.get(p.id) || [], today);
    if (!r) continue;
    const g = groupById.get(p.groupId);
    atRisk.push({
      playerId: p.id,
      playerName: (p.name || "").trim(),
      groupName: g ? g.name || "" : "",
      ...r,
    });
  }
  atRisk.sort((a, b) => (a.level === b.level ? b.streak - a.streak : a.level === "high" ? -1 : 1));

  const yesterdayRecs = attendance.filter((a) => a.date === yesterday);
  const pending = [...repeat, ...single].sort(
    (x, y) => y.date.localeCompare(x.date) || x.groupName.localeCompare(y.groupName),
  );

  return {
    date: today,
    yesterday: {
      date: yesterday,
      present: yesterdayRecs.filter((a) => a.status === "Present").length,
      absent: yesterdayRecs.filter((a) => a.status === "Absent").length,
    },
    pending,
    atRisk,
    summary: {
      pending: pending.length,
      pendingNoPhone: pending.filter((x) => !x.phone).length,
      repeat: repeat.length,
      atRiskHigh: atRisk.filter((r) => r.level === "high").length,
      atRiskMedium: atRisk.filter((r) => r.level === "medium").length,
    },
  };
}

// שורה אחת לתבנית (בלי ירידות שורה — כלל של Meta)
export function oneLineSummary(r) {
  const s = r.summary;
  const parts = [
    `אתמול: ${r.yesterday.present} הגיעו, ${r.yesterday.absent} לא הגיעו`,
    `${s.pending} ממתינים להודעה`,
    `${s.atRiskHigh + s.atRiskMedium} בסכנת נשירה`,
  ];
  return parts.join(" · ");
}

// הדוח המלא לשולה (בתוך חלון 24 השעות אפשר טקסט חופשי)
export function fullReportText(r, max = 15) {
  const lines = [`📋 דוח נוכחות — ${hebrewDay(r.date)}`, oneLineSummary(r), ""];
  if (r.pending.length) {
    lines.push("✉️ ממתינים להודעה:");
    r.pending.slice(0, max).forEach((x, i) => {
      const kind = x.kind === "repeat" ? "2 ברצף" : x.whenText;
      lines.push(`${i + 1}. ${x.playerName} (${x.groupName}) — ${kind}${x.phone ? "" : " ⚠️ אין טלפון תקין"}`);
    });
    if (r.pending.length > max) lines.push(`ועוד ${r.pending.length - max}`);
    lines.push("");
  }
  if (r.atRisk.length) {
    lines.push("⚠️ בסכנת נשירה:");
    r.atRisk.slice(0, max).forEach((x) => lines.push(`• ${x.playerName} (${x.groupName}) — ${x.reason}`));
    lines.push("");
  }
  if (r.pending.length) lines.push('לשליחת ההודעות: "שלח הכל", או "שלח 1,3".');
  return lines.join("\n").trim();
}
