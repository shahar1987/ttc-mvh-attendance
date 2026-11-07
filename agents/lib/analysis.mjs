// כללי המועדון — פונקציות טהורות, בלי Firestore. האפליקציה (part-a.js), הבוט (worker/) והסוכנים
// מייבאים אותן מכאן, כך שכולם רואים את אותה רשימה ואף הורה לא מקבל שתי הודעות על אותה היעדרות.
import { playerGender, knownGender } from "./gender.mjs";

// החוזה של מסמכי הנוכחות ב-Firestore — לא משנים (CLAUDE.md)
export const attendanceId = (date, groupId, playerId) => `${date}_${groupId}_${playerId}`;
// אימון אחד = קבוצה בתאריך. גם מזהה המסמך ב-cancellations.
export const trainingKey = (date, groupId) => `${date}_${groupId}`;

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

// רשומה אחת לכל יום (שחקן שעבר קבוצה באותו יום לא נספר פעמיים); נוכחות גוברת על היעדרות. מהחדש לישן.
function byDay(recs) {
  const m = new Map();
  for (const a of recs) {
    const prev = m.get(a.date);
    if (!prev || prev.status !== "Present") m.set(a.date, a);
  }
  return [...m.values()].sort((x, y) => y.date.localeCompare(x.date));
}

function perPlayer(attendance, keep) {
  const by = new Map();
  for (const a of attendance) {
    if (!a.playerId || !a.date || !keep(a)) continue;
    let list = by.get(a.playerId);
    if (!list) by.set(a.playerId, (list = []));
    list.push(a);
  }
  const out = new Map();
  for (const [pid, list] of by) out.set(pid, byDay(list));
  return out;
}

export function playerHistory(attendance, playerId, today) {
  return byDay(attendance.filter((a) => a.playerId === playerId && a.date && a.date < today && !a.excused));
}

// שני האימונים האחרונים היו היעדרות. היום עצמו לא נספר (המאמן אולי באמצע סימון); תאריך עתידי כן.
const twoAbsent = (recs) =>
  recs.length >= 2 && recs[0].status === "Absent" && recs[1].status === "Absent" ? [recs[0].date, recs[1].date] : null;

export function lastTwoAbsences(attendance, playerId, today) {
  return twoAbsent(byDay(attendance.filter((a) => a.playerId === playerId && a.date !== today)));
}

// שתי היעדרויות ברצף שעוד לא טופלו ושכן שולחים עליהן הודעה. dates = התוצאה של lastTwoAbsences.
export function needsRepeatMsg(p, dates, attendance) {
  if (!dates) return false;
  if (p.alertHandledDate && p.alertHandledDate >= dates[0]) return false;
  return !skipAbsenceMsg(p, p.groupId, attendance, dates[0]);
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
// אימון שבוטל (cancellations) או שלא התקיים — חג, ביטול שלא נרשם: יום-קבוצה בעבר שאף אחד לא סומן בו
// "הגיע" — לא נספר כהיעדרות. היום עצמו נשאר (המאמן אולי באמצע סימון).
export function onlyHeldTrainings(attendance, cancellations, today) {
  const key = (a) => trainingKey(a.date, a.groupId);
  const cancelled = new Set((cancellations || []).map(key));
  const held = new Set(attendance.filter((a) => a.status === "Present").map(key));
  return attendance.filter((a) => !cancelled.has(key(a)) && (a.date >= today || held.has(key(a))));
}

export function analyze({ players, groups, attendance, cancellations, today }) {
  // היעדרות מוצדקת (excused) לא נספרת בכלל — כמו statAtt באפליקציה
  attendance = onlyHeldTrainings(attendance, cancellations, today).filter((a) => !a.excused);
  const groupById = new Map(groups.map((g) => [g.id, g]));
  const hist = perPlayer(attendance, (a) => a.date < today);
  const recent = perPlayer(attendance, (a) => a.date !== today);
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
    genderKnown: !!knownGender(p),
    phone: isValidPhone(p.parentPhone) ? normalizePhone(p.parentPhone) : "",
    ...extra,
  });

  const repeat = [];
  for (const p of players) {
    if (!active(p)) continue;
    const dates = twoAbsent(recent.get(p.id) || []);
    if (!needsRepeatMsg(p, dates, attendance)) continue;
    repeat.push(item(p, groupById.get(p.groupId), "repeat", dates[0], { dates }));
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
  // 5.11 (שלום): הודעה רק על שתי היעדרויות ברצף, לא על אחת
  const pending = repeat.sort(
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
  const rep = pend.filter(({ x }) => x.phone);
  if (rep.length)
    a.push(`${rep.length === 1 ? `${rep[0].x.playerName} החסיר/ה פעמיים ברצף` : `${rep.length} ילדים החסירו פעמיים ברצף`} — ${rep.every((v) => v.x.adult) ? "הודעה אישית" : rep.some((v) => v.x.adult) ? "הודעות (לבוגרים ישירות, לילדים להורים)" : "הודעה להורים"}: "שלח ${rep.map((v) => v.n).join(",")}"`);
  if (reg?.items?.length) a.push(`${reg.items.length === 1 ? "התאמת שם אחת ברישום מחכה" : `${reg.items.length} התאמות שם ברישום מחכות`} לך — "אשר ר1" או "דחה ר1"`);
  if (reg?.gaps) a.push(`${reg.gaps} משלמים על פחות אימונים ממה שהם מתאמנים — לשלוח להורים את קישור ההרשמה הנכון ממסך "מי לא משלם"`);
  if (reg?.unmatched) a.push(`${reg.unmatched} שמות בקובץ המתנ"ס לא קיימים באפליקציה — לבדוק אם צריך להוסיף אותם`);
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
      lines.push(`${i + 1}. ${x.playerName} (${x.groupName}) — 2 ברצף${x.phone ? "" : " ⚠️ אין טלפון תקין"}`);
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

// 📝 סיכומי האימון שהמדריכים כתבו לשולה — נוסף לדוח הבוקר. אין סיכומים — כלום.
export function coachNotesText(notes, max = 1200) {
  if (!notes.length) return "";
  const lines = notes.map((n) => `• ${n.coach}${n.groups?.length ? ` (${n.groups.join(", ")})` : ""}: ${n.text}`);
  const body = lines.join("\n");
  return `\n\n📝 מה המדריכים כתבו אתמול:\n${body.length > max ? body.slice(0, max) + "…" : body}`;
}
