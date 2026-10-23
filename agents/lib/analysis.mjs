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

// ילד בניסיון (trial) לא נכנס להתראות, להודעות להורים ולרשימת הסיכון — כמו באפליקציה
const active = (p) => p && p.isActive && !p.deleted && !p.trial;

// רשומה אחת לכל יום לכל שחקן; נוכחות גוברת על היעדרות. מהחדש לישן.
export function playerHistory(attendance, playerId, today) {
  const byDate = new Map();
  for (const a of attendance) {
    if (a.playerId !== playerId || !a.date || a.date >= today || a.excused) continue;
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

// בדיוק כמו lastTwoAbsences ב-part-a.js: רשומה אחת לכל יום, נוכחות גוברת על היעדרות,
// ורק היום עצמו לא נספר (תאריך עתידי כן נספר — כמו באפליקציה). שונה במכוון מ-historyIndex,
// שמשמש את סכנת הנשירה ומדלג על כל מה שמהיום והלאה.
function twoAbsenceIndex(attendance, today) {
  const by = new Map();
  for (const a of attendance) {
    if (!a.playerId || !a.date || a.date === today) continue;
    let m = by.get(a.playerId);
    if (!m) by.set(a.playerId, (m = new Map()));
    const prev = m.get(a.date);
    if (!prev || prev.status !== "Present") m.set(a.date, a);
  }
  const out = new Map();
  for (const [pid, m] of by) {
    const recs = [...m.values()].sort((x, y) => y.date.localeCompare(x.date));
    if (recs.length >= 2 && recs[0].status === "Absent" && recs[1].status === "Absent") out.set(pid, [recs[0].date, recs[1].date]);
  }
  return out;
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
// היעדרות שלא שולחים עליה הודעה להורים (18.10, שולה: רוב הרשימה הייתה רעש):
// יום שהוא לא יום האימון של השחקן, או שחקן שכמעט לא מגיע — הוא ברשימת "לא מגיעים", והודעה על כל אימון
// שהוא מפספס מיותרת. ימי האימון: מה שהמדריך רשם, ואם לא רשם — ימים בשבוע שבהם השחקן הגיע לפחות פעמיים
// ולפחות ל-40% מהאימונים של הקבוצה ב-8 השבועות שלפני ההיעדרות. אין מספיק נתונים — לא מדלגים.
// מועתק מ-part-a.js (שינוי — לשנות גם שם). analysis-equivalence.test.mjs משווה.
export function skipAbsenceMsg(p, groupId, attendance, date) {
  let wd = (d) => new Date(d + "T12:00:00Z").getUTCDay(),
    from = new Date(Date.parse(date + "T12:00:00Z") - 56 * 864e5).toISOString().slice(0, 10),
    held = {},
    came = {};
  attendance.forEach((a) => {
    if (a.groupId !== groupId || !a.date || a.date < from || a.date >= date) return;
    if (p.joinDate && a.date < p.joinDate) return;
    let k = wd(a.date);
    (held[k] = held[k] || new Set()).add(a.date);
    a.playerId === p.id && a.status === "Present" && (came[k] = came[k] || new Set()).add(a.date);
  });
  let n = (o) => Object.values(o).reduce((x, v) => x + v.size, 0),
    nHeld = n(held);
  if (nHeld >= 4 && n(came) / nHeld <= 0.2) return !0;
  let days =
    Array.isArray(p.trainingDays) && p.trainingDays.length > 0
      ? p.trainingDays
      : Object.keys(held)
          .map(Number)
          .filter((k) => came[k] && came[k].size >= 2 && came[k].size / held[k].size >= 0.4);
  return days.length > 0 && !days.includes(wd(date));
}
export function analyze({ players, groups, attendance, today }) {
  // היעדרות מוצדקת (excused) לא נספרת בכלל — כמו statAtt באפליקציה
  attendance = attendance.filter((a) => !a.excused);
  const groupById = new Map(groups.map((g) => [g.id, g]));
  const playerById = new Map(players.map((p) => [p.id, p]));
  const hist = historyIndex(attendance, today);
  const twoIdx = twoAbsenceIndex(attendance, today);
  const yesterday = addDays(today, -1);

  const item = (p, g, kind, date, extra = {}) => ({
    key: `${kind}:${date}:${g ? g.id : ""}:${p.id}`,
    kind,
    date,
    playerId: p.id,
    playerName: (p.name || "").trim(),
    groupId: extra.groupId ?? (g ? g.id : p.groupId || ""),
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
    const dates = twoIdx.get(p.id);
    if (!dates) continue;
    repeatDates.set(p.id, dates);
    if (p.alertHandledDate && p.alertHandledDate >= dates[0]) continue;
    if (skipAbsenceMsg(p, p.groupId, attendance, dates[0])) continue;
    repeat.push(item(p, groupById.get(p.groupId), "repeat", dates[0], { dates }));
  }

  // היעדרות בודדת מהשבוע האחרון שלא נשלחה עליה הודעה — בדיוק כמו pendingAbsenceMsgs:
  // כולל היום עצמו, ומדלגים רק על שני התאריכים שכבר בהתראת "שתי היעדרויות".
  const from = addDays(today, -6);
  const single = [];
  for (const a of attendance) {
    if (a.status !== "Absent" || a.msgSentAt) continue;
    if (!a.date || a.date > today || a.date < from) continue;
    // הסימון "נשלחה הודעה" נכתב למסמך ${date}_${groupId}_${playerId} — בלי הקבוצה של הרשומה
    // עצמה אסור לנחש (הקבוצה הנוכחית של השחקן עלולה לייצר מסמך נוכחות חדש ושגוי)
    if (!a.groupId) continue;
    const p = playerById.get(a.playerId);
    if (!active(p)) continue;
    if (p.alertHandledDate && p.alertHandledDate >= a.date) continue;
    const two = repeatDates.get(p.id);
    if (two && two.includes(a.date)) continue;
    if (skipAbsenceMsg(p, a.groupId, attendance, a.date)) continue;
    single.push(item(p, groupById.get(a.groupId), "absence", a.date, { groupId: a.groupId }));
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
      adult: isAdultGroup(g),
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

// בעיות רישום מסנכרון התשלומים (system/paymentSync): הצעות התאמה שממתינות לאישור, ומספר השמות שלא נמצאו
// ושל מי ששילם על פחות אימונים. key = playerId::fileName — אותו מפתח כמו paymentSyncIgnores באפליקציה,
// כך שאישור/דחייה בבוט ובמסך "מי לא משלם" הם אותו דבר.
export function registrationIssues({ sync, ignores, players, groups }) {
  const ign = new Set(ignores || []);
  const byId = new Map(players.map((p) => [p.id, p]));
  const gName = (id) => groups.find((g) => g.id === id)?.name || "";
  const items = [];
  for (const sg of sync?.nameSuggestions || [])
    for (const c of sg.candidates || []) {
      const p = byId.get(c.playerId);
      const key = `${c.playerId}::${sg.fileName}`;
      if (!active(p) || ign.has(key) || items.some((x) => x.key === key)) continue;
      items.push({ key, playerId: p.id, playerName: (p.name || "").trim(), fileName: sg.fileName, group: gName(p.groupId), fileGroup: gName(sg.groupId) });
    }
  return {
    items,
    unmatched: (sync?.unmatchedNames || []).length,
    gaps: (sync?.sessionGaps || []).length,
    stopped: !!(sync?.needsReview && sync?.partialFile),
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

// 🎯 "הכי חשוב היום": עד 3 צעדים, לפי כללים קבועים (לא ניחוש של המודל), מהדחוף לפחות דחוף.
// כל צעד אומר מה לעשות ואיך — כולל הפקודה המדויקת לשולה, כשיש כזו.
export function topActions(r) {
  const a = [];
  const reg = r.registration;
  if (reg?.stopped) a.push('סנכרון התשלומים נעצר כי הקובץ בדרייב נראה חלקי — להעלות את הקובץ המלא מהמתנ"ס');
  for (const x of (r.atRisk || []).filter((x) => x.level === "high").slice(0, 2))
    a.push(`${x.playerName} (${x.groupName}) — ${x.reason}. ${x.adult ? "כדאי להתקשר אליו/אליה היום" : "כדאי להתקשר להורים היום"}`);
  const pend = (r.pending || []).map((x, i) => ({ x, n: i + 1 }));
  const rep = pend.filter(({ x }) => x.kind === "repeat" && x.phone);
  if (rep.length)
    a.push(`${rep.length === 1 ? `${rep[0].x.playerName} החסיר/ה פעמיים ברצף` : `${rep.length} ילדים החסירו פעמיים ברצף`} — ${rep.every((v) => v.x.adult) ? "הודעה אישית" : rep.some((v) => v.x.adult) ? "הודעות (לבוגרים ישירות, לילדים להורים)" : "הודעה להורים"}: "שלח ${rep.map((v) => v.n).join(",")}"`);
  if (reg?.items?.length) a.push(`${reg.items.length === 1 ? "התאמת שם אחת ברישום מחכה" : `${reg.items.length} התאמות שם ברישום מחכות`} לך — "אשר ר1" או "דחה ר1"`);
  if (reg?.gaps) a.push(`${reg.gaps} משלמים על פחות אימונים ממה שהם מתאמנים — לשלוח להורים את קישור ההרשמה הנכון ממסך "מי לא משלם"`);
  if (reg?.unmatched) a.push(`${reg.unmatched} שמות בקובץ המתנ"ס לא קיימים באפליקציה — לבדוק אם צריך להוסיף אותם`);
  const single = pend.filter(({ x }) => x.kind !== "repeat").length;
  if (single) a.push(`${single === 1 ? "הודעת היעדרות אחת ממתינה" : `${single} הודעות היעדרות ממתינות`} — "שלח הכל" או לבחור מספרים`);
  return a.slice(0, 3);
}

// הדוח המלא לשולה (בתוך חלון 24 השעות אפשר טקסט חופשי)
export function fullReportText(r, max = 15) {
  const lines = [`📋 דוח נוכחות — ${hebrewDay(r.date)}`, oneLineSummary(r), ""];
  const top = topActions(r);
  if (top.length) lines.push("🎯 הכי חשוב היום:", ...top.map((t) => `• ${t}`), "");
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
  const reg = r.registration;
  if (reg && (reg.items.length || reg.unmatched || reg.gaps || reg.stopped)) {
    lines.push("", "📝 רישום ותשלום:");
    if (reg.stopped) lines.push("⛔ הסנכרון נעצר — הקובץ בדרייב נראה חלקי");
    reg.items.slice(0, max).forEach((x, i) =>
      lines.push(`ר${i + 1}. ${x.playerName} (${x.group}) — בקובץ: "${x.fileName}"${x.fileGroup && x.fileGroup !== x.group ? ` ב${x.fileGroup}` : ""}`),
    );
    if (reg.items.length > max) lines.push(`ועוד ${reg.items.length - max}`);
    if (reg.unmatched) lines.push(`• ${reg.unmatched} שמות בקובץ לא נמצאו באפליקציה`);
    if (reg.gaps) lines.push(`• ${reg.gaps} שילמו על פחות אימונים ממה שהקבוצה מתאמנת`);
    if (reg.items.length) lines.push('לאישור שזה אותו ילד: "אשר ר1,ר2". לא אותו ילד: "דחה ר1".');
  }
  return lines.join("\n").trim();
}
