// בדיקה חד-פעמית שהבעלים ביקש (10.10.2026): תזכורת הנוכחות יוצאת מהבוט ישר למאמן.
// לכל קבוצה פעילה: האימון האחרון שלה בשבוע האחרון. אם אין לו רישום נוכחות וגם לא בוטל — המאמנים שלה מקבלים
// את התבנית coach_attendance_reminder, עם "בדיקה בלבד" ליד שם הקבוצה. הבעלים מקבל סיכום. שום דבר לא נכתב לנתונים.
// הריפו ציבורי והלוג של Actions גלוי — בלוג רק מספרים והודעות שגיאה של Meta, בלי שמות וטלפונים.
import { firestore, loadAll } from "./lib/firebase.mjs";
import { addDays, israelToday, normalizePhone, isValidPhone } from "./lib/analysis.mjs";
import { waConfig, sendTemplate, notifyOwner, waLink } from "./lib/whatsapp.mjs";
import { renderTemplate } from "./templates.mjs";

const APP_URL = "https://shahar1987.github.io/ttc-mvh-attendance/";
const coachIds = (g) => [...new Set([g.coachId, ...(Array.isArray(g.coachIds) ? g.coachIds : [])].filter(Boolean))];

const wa = waConfig(process.env);
if (!wa) throw new Error("missing WhatsApp secrets");
const db = firestore();
const today = israelToday();
const from = addDays(today, -6);
const [groups, users, players, attendance, cancellations, botDoc] = await Promise.all([
  loadAll(db, "groups"),
  loadAll(db, "users"),
  loadAll(db, "players"),
  loadAll(db, "attendance", (c) => c.where("date", ">=", from)),
  loadAll(db, "cancellations"),
  db.collection("agentReports").doc("bot").get(),
]);

// היום האחרון (מהיום אחורה, עד 6 ימים) שבו הקבוצה מתאמנת לפי groups.days
const lastTraining = (g) => {
  for (let i = 0; i <= 6; i++) {
    const d = addDays(today, -i);
    if (g.days.includes(new Date(d + "T12:00:00Z").getUTCDay())) return d;
  }
  return null;
};

const lines = [];
let sent = 0, failed = 0;
const errors = new Set();
for (const g of groups.filter((g) => !g.deleted && g.isActive !== false && Array.isArray(g.days) && g.days.length)) {
  if (!players.some((p) => p.groupId === g.id && p.isActive && !p.deleted)) continue;
  const d = lastTraining(g);
  if (!d || d === today) continue; // אימון של היום אולי עוד לא נגמר
  if (attendance.some((a) => a.groupId === g.id && a.date === d)) continue;
  if (cancellations.some((c) => c.groupId === g.id && c.date === d)) continue;
  for (const id of coachIds(g)) {
    const c = users.find((u) => u.id === id) || { name: "מאמן" };
    if (!isValidPhone(c.phone || "")) {
      lines.push(`• ${g.name} (${d}) — ${c.name}: אין טלפון שמור`);
      continue;
    }
    const link = `${APP_URL}#group=${g.id}`;
    try {
      await sendTemplate(wa, normalizePhone(c.phone), "coach_attendance_reminder", [c.name, `${g.name} (בדיקה בלבד, אין צורך לעשות כלום) · ${link}`]);
      sent++;
      lines.push(`• ${g.name} (${d}) — ${c.name}: נשלחה ✓`);
    } catch (e) {
      failed++;
      errors.add(e.message);
      lines.push(`• ${g.name} (${d}) — ${c.name}: נכשלה (${e.message}). ידני: ${waLink(normalizePhone(c.phone), renderTemplate("coach_attendance_reminder", [c.name, g.name]) + `\n${link}`)}`);
    }
  }
}

console.log(`sent ${sent}, failed ${failed}${errors.size ? `, errors: ${[...errors].join(" | ")}` : ""}`);
const text = lines.length
  ? `🧪 *בדיקת תזכורת למאמנים* (אימון אחרון בשבוע האחרון שלא מולא):\n${lines.join("\n")}`
  : "🧪 בדיקת תזכורת למאמנים: כל האימונים של השבוע האחרון מולאו, אין למי לשלוח.";
await notifyOwner(wa, { lastOwnerMsgAt: botDoc.data()?.lastOwnerMsgAt, text, template: "agent_alert", templateParam: `בדיקת תזכורת למאמנים: ${sent} נשלחו, ${failed} נכשלו` });
if (failed && !sent) process.exitCode = 1;
