// התראת כישלון מתוך GitHub Actions לשולה, דרך התור של בוט הוואטסאפ (agentReports/bot.outbox).
// עובד גם כש-Issues כבויים בריפו וגם כשאין ב-GitHub סודות וואטסאפ.
//   ALERT_KEY=backup ALERT_TEXT="..." node alert.mjs
// מדפיס רק את המפתח — בלי פרטים אישיים ביומן הציבורי.
import { firestore } from "./lib/firebase.mjs";
import { enqueueOwner } from "./lib/owner.mjs";

const key = `alert-${(process.env.ALERT_KEY || "workflow").replace(/[^\w-]/g, "_")}`;
const text = process.env.ALERT_TEXT || "❌ תהליך אוטומטי נכשל";
await enqueueOwner(firestore(), { agent: "github-actions", key, text, templateParam: text.split("\n")[0] });
