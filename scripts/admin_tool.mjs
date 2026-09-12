// כלי ניהול חשבונות למנהל המועדון, רץ רק דרך GitHub Actions.
//
//   ACTION=check        — בודק אם קיים חשבון התחברות למספר/לאימייל שהוזן, ומה מקושר אליו
//   ACTION=reset-access — מוחק את חשבון ההתחברות, את הפרופיל ואת הקישורים לשחקנים,
//                         כדי שאפשר יהיה לשלוח הזמנה חדשה והאדם יבחר סיסמה מחדש
//
// שום סיסמה לא נוצרת ולא מודפסת: יומני ההרצה של הריפו ציבוריים, ולכן ההתאוששות
// נעשית דרך הזמנה חדשה מהאפליקציה ולא דרך סיסמה זמנית.
import admin from "firebase-admin";

const MEMBER_DOMAIN = "members.ttcmh.app";

function normalizePhone(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("972")) return "972" + digits.slice(3).replace(/^0+/, "");
  if (digits.startsWith("0")) return "972" + digits.replace(/^0+/, "");
  if (digits.length === 9 && digits.startsWith("5")) return "972" + digits;
  return digits;
}

const lines = [];
function say(text) {
  lines.push(text);
  console.log(text);
}

async function main() {
  let sa;
  try {
    sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT אינו JSON תקין");
  }
  if (!sa.project_id) throw new Error("חסר סוד FIREBASE_SERVICE_ACCOUNT בהגדרות הריפו");

  admin.initializeApp({ credential: admin.credential.cert(sa) });
  const auth = admin.auth();
  const db = admin.firestore();

  const action = (process.env.ACTION || "check").trim();
  const raw = (process.env.WHO || "").trim();
  if (!raw) throw new Error("לא הוזן מספר טלפון או אימייל");

  let email;
  if (raw.includes("@")) {
    email = raw.toLowerCase();
  } else {
    const phone = normalizePhone(raw);
    if (!/^972\d{8,9}$/.test(phone)) throw new Error(`מספר טלפון לא תקין: ${raw}`);
    email = `${phone}@${MEMBER_DOMAIN}`;
  }
  say(`חשבון: ${email}`);

  let user = null;
  try {
    user = await auth.getUserByEmail(email);
  } catch (err) {
    if (err.code !== "auth/user-not-found") throw err;
  }

  if (!user) {
    say("אין חשבון התחברות עם הכתובת הזו. אם רצית לתת גישה — פשוט שלח הזמנה חדשה מהאפליקציה.");
    return;
  }

  say(`נוצר: ${user.metadata.creationTime}`);
  say(`התחברות אחרונה: ${user.metadata.lastSignInTime || "מעולם לא"}`);

  const profileSnap = await db.collection("users").doc(user.uid).get();
  const profile = profileSnap.exists ? profileSnap.data() : null;
  say(profile ? `פרופיל: ${profile.name || "ללא שם"} · ${profile.role || "ללא תפקיד"}` : "אין פרופיל במערכת");

  const linkSnap = await db.collection("links").where("uid", "==", user.uid).get();
  const playerNames = [];
  for (const doc of linkSnap.docs) {
    const pid = doc.data().playerId;
    if (!pid) continue;
    const p = await db.collection("players").doc(pid).get();
    playerNames.push(p.exists ? p.data().name || pid : pid);
  }
  say(`מקושר ל-${linkSnap.size} כרטיסי שחקן${playerNames.length ? ": " + playerNames.join(", ") : ""}`);

  if (action !== "reset-access") {
    say("");
    say("לא בוצע שינוי (פעולת בדיקה בלבד).");
    return;
  }

  const batch = db.batch();
  linkSnap.docs.forEach((d) => batch.delete(d.ref));
  if (profileSnap.exists) batch.delete(profileSnap.ref);
  await batch.commit();
  await auth.deleteUser(user.uid);

  say("");
  say(`נמחקו: חשבון ההתחברות, ${profileSnap.exists ? "הפרופיל" : "אין פרופיל"} ו-${linkSnap.size} קישורים.`);
  say("השלב הבא: שלח הזמנה חדשה מהאפליקציה (גישת הורים ← הזמנות), והאדם יבחר סיסמה חדשה בעצמו.");
  if (playerNames.length) say(`לזכור לקשר שוב ל: ${playerNames.join(", ")}`);
}

main()
  .then(async () => {
    if (process.env.GITHUB_STEP_SUMMARY) {
      const fs = await import("node:fs");
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n");
    }
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("שגיאה: " + (err.message || err));
    if (process.env.GITHUB_STEP_SUMMARY) {
      const fs = await import("node:fs");
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, "שגיאה: " + (err.message || err) + "\n");
    }
    process.exit(1);
  });
