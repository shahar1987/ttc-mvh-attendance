// התראת כישלון מתוך GitHub Actions לשולה, דרך התור של בוט הוואטסאפ (agentReports/bot.outboxQueue).
// עובד גם כש-Issues כבויים בריפו וגם כשאין ב-GitHub סודות וואטסאפ.
//   ALERT_KEY=backup ALERT_TEXT="..." node alert.mjs
// לכל היותר פעם ב-6 שעות לאותו מפתח (enqueueAlertOnce).
// STEPS (רשות, ${{ toJSON(steps) }}): אם כל השלבים שנכשלו הם סוכנים שכבר הודיעו לבעלים בעצמם
// על מפתח חסר (health.<agent>.missingKeyAt מהשעתיים האחרונות) — לא שולחים הודעה שנייה.
// מדפיס רק את המפתח — בלי פרטים אישיים ביומן הציבורי.
import { firestore } from "./lib/firebase.mjs";
import { enqueueAlertOnce } from "./lib/owner.mjs";
import { alreadyToldOwner } from "./lib/schedule.mjs";

const key = `alert-${(process.env.ALERT_KEY || "workflow").replace(/[^\w-]/g, "_")}`;
let text = process.env.ALERT_TEXT || "❌ תהליך אוטומטי נכשל";
const db = firestore();

if (process.env.STEPS) {
  const steps = JSON.parse(process.env.STEPS);
  const health = (await db.collection("agentReports").doc("health").get()).data() || {};
  if (alreadyToldOwner(steps, health)) {
    console.log(`${key}: the failed agents already told the owner themselves — skipped`);
    process.exit(0);
  }
  // שמות השלבים שנכשלו בפועל (לא כל מה שתוכנן לרוץ)
  const failed = Object.entries(steps).filter(([, s]) => s?.outcome === "failure").map(([id]) => id);
  if (failed.length) text = text.replace("סוכן נכשל", `סוכן נכשל: ${failed.join(", ")}`);
}
await enqueueAlertOnce(db, { key, text });
