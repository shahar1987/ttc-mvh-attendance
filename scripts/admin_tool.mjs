// מבצע בקשות ניהול חשבונות שנוצרו מתוך האפליקציה (אוסף adminTasks).
//
// למה ככה ולא עם פרמטרים: הריפו ציבורי, ולכן יומני ההרצה גלויים לכולם.
// מספר טלפון או שם ילד שהיו עוברים כפרמטר היו נשמרים ביומן לצמיתות.
// כאן הבקשה נוצרת באפליקציה, והכלי מדפיס רק מספרים — כמה בקשות טופלו.
//
// סוגי בקשות:
//   check         — בודק אם קיים חשבון התחברות ומתי היתה התחברות אחרונה
//   reset-access  — מוחק חשבון התחברות, פרופיל וקישורים, כדי שאפשר יהיה
//                   לשלוח הזמנה חדשה והאדם יבחר סיסמה מחדש
//   restore       — מחזיר לרשימה משתמש צוות שנמחק ממנה. חשבון ההתחברות שלו
//                   נשאר, ולכן אי אפשר ליצור אותו מחדש מהאפליקציה בלי הסיסמה
//                   שלו. הכלי מאתר את החשבון לפי האימייל, מגדיר את הסיסמה
//                   שהמנהל הזין ויוצר לו פרופיל. הסיסמה נמחקת מהבקשה בסוף.
//
// התוצאה נכתבת בחזרה למסמך הבקשה, והאפליקציה מציגה אותה למנהל.
import admin from "firebase-admin";

const MAX_TASKS = 20;

async function main() {
  let sa;
  try {
    sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT is not valid JSON");
  }
  if (!sa.project_id) throw new Error("missing repository secret FIREBASE_SERVICE_ACCOUNT");

  admin.initializeApp({ credential: admin.credential.cert(sa) });
  const auth = admin.auth();
  const db = admin.firestore();

  const snap = await db
    .collection("adminTasks")
    .where("status", "==", "pending")
    .limit(MAX_TASKS)
    .get();

  if (snap.empty) {
    console.log("no pending tasks");
    return 0;
  }
  console.log(`processing ${snap.size} task(s)`);

  let done = 0;
  let failed = 0;

  for (const taskDoc of snap.docs) {
    const task = taskDoc.data();
    const uid = String(task.uid || "").trim();
    const type = String(task.type || "check").trim();
    const finish = (status, result) =>
      taskDoc.ref.set(
        { status, result, finishedAt: new Date().toISOString() },
        { merge: true },
      );

    try {
      if (type === "restore") {
        try {
          await finish(...(await restoreProfile(auth, db, task)));
        } finally {
          await taskDoc.ref.update({ password: admin.firestore.FieldValue.delete() });
        }
        done++;
        continue;
      }

      if (!uid) throw new Error("missing uid");

      let user = null;
      try {
        user = await auth.getUser(uid);
      } catch (err) {
        if (err.code !== "auth/user-not-found") throw err;
      }

      const linkSnap = await db.collection("links").where("uid", "==", uid).get();
      const profileRef = db.collection("users").doc(uid);
      const profileSnap = await profileRef.get();

      // הגנה: תור adminTasks נכתב היום ישירות מהלקוח בלי חוקי Firestore שאוכפים
      // מי רשאי לכתוב אליו, כך שכל משתמש מחובר (כולל מאמן) יכול תיאורטית לבקש
      // reset-access נגד ה-uid של מנהל ולגרום למחיקת חשבונו. עד שיפורסמו חוקי
      // Firestore שחוסמים כתיבה לא-מנהלית לאוסף הזה, לפחות כאן — בשכבת השרת עם
      // הרשאות Admin SDK מלאות — לעולם לא נבצע reset-access נגד חשבון עם role
      // admin. מנהלים מנוהלים ידנית בקונסולת Firebase, לא דרך התור האוטומטי הזה.
      if (type === "reset-access" && profileSnap.exists && profileSnap.data().role === "admin") {
        await finish(
          "failed",
          "לא ניתן לאפס גישה לחשבון מנהל דרך התור האוטומטי — יש לטפל בכך ידנית בקונסולת Firebase.",
        );
        failed++;
        continue;
      }

      if (type === "check") {
        await finish(
          "done",
          user
            ? `קיים חשבון התחברות. נוצר ב-${String(user.metadata.creationTime || "").slice(0, 16)}. ` +
              `התחברות אחרונה: ${user.metadata.lastSignInTime ? String(user.metadata.lastSignInTime).slice(0, 16) : "מעולם לא"}. ` +
              `מקושר ל-${linkSnap.size} כרטיסי שחקן.`
            : "אין חשבון התחברות — האדם עדיין לא מימש הזמנה, או שהחשבון כבר נמחק.",
        );
        done++;
        continue;
      }

      if (type === "reset-access") {
        const batch = db.batch();
        linkSnap.docs.forEach((d) => batch.delete(d.ref));
        if (profileSnap.exists) batch.delete(profileRef);
        await batch.commit();
        if (user) await auth.deleteUser(uid);
        await finish(
          "done",
          `נמחקו: ${user ? "חשבון ההתחברות" : "לא היה חשבון התחברות"}, ` +
            `${profileSnap.exists ? "הפרופיל" : "לא היה פרופיל"} ו-${linkSnap.size} קישורים. ` +
            "אפשר לשלוח הזמנה חדשה, והאדם יבחר סיסמה בעצמו.",
        );
        done++;
        continue;
      }

      throw new Error(`unknown task type: ${type}`);
    } catch (err) {
      await finish("failed", "הפעולה נכשלה: " + (err.message || String(err)));
      failed++;
    }
  }

  console.log(`done: ${done}, failed: ${failed}`);
  return failed ? 1 : 0;
}

// תפקידים שמותר להחזיר דרך התור. מנהל מוגדר רק ידנית, כמו ב-reset-access.
const RESTORE_ROLES = ["Coach", "Viewer"];

async function restoreProfile(auth, db, task) {
  const email = String(task.email || "").trim().toLowerCase();
  const role = String(task.role || "");
  const name = String(task.name || "").trim();
  const password = String(task.password || "");
  if (!email || !name) return ["failed", "חסרים שם או אימייל."];
  if (!RESTORE_ROLES.includes(role))
    return ["failed", "אפשר להחזיר כך רק מאמן או צופה. מנהל מוגדר ידנית בקונסולת Firebase."];
  if (password && password.length < 6) return ["failed", "הסיסמה קצרה מ-6 תווים."];

  let user;
  try {
    user = await auth.getUserByEmail(email);
  } catch (err) {
    if (err.code !== "auth/user-not-found") throw err;
    return ["failed", "לא נמצא חשבון התחברות לכתובת הזו. אפשר פשוט להוסיף את המשתמש מחדש."];
  }

  const profileRef = db.collection("users").doc(user.uid);
  const profileSnap = await profileRef.get();
  // לעולם לא נוגעים בחשבון של מנהל דרך התור
  if (profileSnap.exists && String(profileSnap.data().role || "").toLowerCase() === "admin")
    return ["failed", "זה חשבון של מנהל. מנהלים מטופלים ידנית בקונסולת Firebase."];

  if (password) await auth.updateUser(user.uid, { password });
  const profile = { name, role, phone: String(task.phone || ""), email };
  if (!profileSnap.exists) await profileRef.set(profile);
  else await profileRef.update(profile);

  return [
    "done",
    `${name} הוחזר לרשימה` + (password ? " ונכנס עם הסיסמה החדשה שהוזנה." : "."),
  ];
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error("error: " + (err.message || err));
    process.exit(1);
  });
