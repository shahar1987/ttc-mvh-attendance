// בודק שכל אנשי הצוות (מנהל, מאמן, צופה) יכולים להיכנס לאפליקציית הנוכחות.
//
// למה: הלוח הציבורי מתחבר עם Google לאותו פרויקט Firebase. מי שנכנס שם עם Google
// באותו אימייל של חשבון הצוות, ולא אימת את האימייל, Firebase מוחק לו את הסיסמה —
// והוא נחסם במסך הכניסה ("אימייל או סיסמה שגויים"). כך נחסמה שולה ב-20.10.2026.
// "שכחתי סיסמה" מחזיר את הסיסמה, אבל שולה צריכה לדעת מי נפגע.
//
// הודעה לשולה בוואטסאפ (דרך התור של הבוט) רק כשרשימת הנפגעים משתנה. ביומן רק מספרים.
//   FIREBASE_SERVICE_ACCOUNT=... node scripts/staff_logins.mjs
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { firestore, loadAll } from "../agents/lib/firebase.mjs";
import { enqueueOwner } from "../agents/lib/owner.mjs";

// firebase-admin מותקן ב-agents/ — אותו מופע ש-firestore() מאתחל (כמו send_push.mjs)
const admin = createRequire(new URL("../agents/package.json", import.meta.url))("firebase-admin");

const STAFF = ["admin", "coach", "viewer"];

// מה מונע מהמשתמש להיכנס, או "" אם הכל תקין
export function staffIssue(user) {
  if (!user) return "אין חשבון התחברות";
  if (user.disabled) return "החשבון מושבת";
  if (!(user.providerData || []).some((p) => p.providerId === "password"))
    return (user.providerData || []).some((p) => p.providerId === "google.com")
      ? "הסיסמה נמחקה אחרי כניסה עם Google בלוח המועדון — “שכחתי סיסמה” במסך הכניסה מחזיר אותה"
      : "אין סיסמה לחשבון";
  return "";
}

export function ownerText(issues) {
  return (
    `🔐 ${issues.length} מאנשי הצוות לא יכולים להיכנס לאפליקציית הנוכחות עם סיסמה:\n` +
    issues.map((i) => `• ${i.name}: ${i.issue}`).join("\n") +
    `\nהתיקון: במסך הרשאות, כפתור "סיסמה חדשה" ליד השם (או "שכחתי סיסמה" במסך הכניסה).`
  );
}

async function main() {
  const db = firestore();
  const auth = admin.auth();
  const staff = (await loadAll(db, "users")).filter((u) =>
    STAFF.includes(String(u.role || "").trim().toLowerCase()),
  );
  const issues = [];
  for (const u of staff) {
    let user = null;
    try {
      user = await auth.getUser(u.id);
    } catch (err) {
      if (err.code !== "auth/user-not-found") throw err;
    }
    const issue = staffIssue(user);
    if (issue) issues.push({ id: u.id, name: u.name || "בלי שם", issue });
  }
  // ביומן הציבורי רק ספירה לפי סוג הבעיה, בלי שמות
  const byType = {};
  for (const i of issues) byType[i.issue.split(" — ")[0]] = (byType[i.issue.split(" — ")[0]] || 0) + 1;
  console.log(`staff: ${staff.length}, cannot sign in with password: ${issues.length}`, JSON.stringify(byType));

  const ref = db.collection("agentReports").doc("staffLogins");
  // v2: ההודעה נשלחת שוב פעם אחת אחרי התיקון של 22.10 (#108)
  const key = "v2|" + issues.map((i) => i.id + ":" + i.issue).sort().join("|");
  if (key === ((await ref.get()).data() || {}).key) return;
  if (issues.length) await enqueueOwner(db, { agent: "staff-logins", text: ownerText(issues) });
  await ref.set({ key, count: issues.length, at: new Date().toISOString() });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error("error: " + (err.message || err));
    process.exit(1);
  });
}
