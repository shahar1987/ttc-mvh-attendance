// עוזר לסוכנים המתוזמנים: שולח לשולה ושומר את ההודעה המלאה, כדי שהבוט יוכל
// להראות אותה כשהיא עונה לתבנית.
//
// סודות הוואטסאפ שמורים היום רק ב-worker בקלאודפלייר, לא ב-GitHub. כשהם חסרים כאן
// ההודעה לא הולכת לאיבוד: היא נכנסת לתור agentReports/bot.outboxQueue, וה-cron של
// ה-worker (שיש לו את הסודות) שולח אותה ומוציא מהתור (worker/src/queue.js, drainQueue).
//
//   outboxQueue — מערך; כל פריט { id, key, at, from, text, template, templateParam }.
//                 key = המפתח ב-outbox להקשר (ה-worker משתמש ב-x.key || x.from).
//                 נכתב ב-arrayUnion, ולכן סוכנים שרצים במקביל לא דורסים זה את זה.
//   outbox.<key> — מפה, ההודעה האחרונה מכל סוכן, להקשר כשהבעלים עונה (המבנה הקיים: { at, text, how }).
//                 נכתב כ-merge על שדה אחד בתוך המפה.
import { randomUUID } from "node:crypto";
import admin from "firebase-admin";
import { waConfig, notifyOwner } from "./whatsapp.mjs";

const botDoc = (db) => db.collection("agentReports").doc("bot");

function entry({ agent, text, template, templateParam, how }) {
  return {
    id: randomUUID(),
    from: agent,
    at: new Date().toISOString(),
    text,
    how,
    template,
    templateParam: String(templateParam || text.split("\n")[0]).slice(0, 900),
  };
}

// מכניס הודעה לתור של ה-worker בלי לנסות לשלוח מכאן
export async function enqueueOwner(db, { agent, key = agent, text, template = "agent_alert", templateParam }, { arrayUnion = (x) => admin.firestore.FieldValue.arrayUnion(x) } = {}) {
  const { how, ...rest } = entry({ agent, text, template, templateParam, how: "queued" });
  const item = { ...rest, key };
  await botDoc(db).set({ outboxQueue: arrayUnion(item), outbox: { [key]: { ...item, how } } }, { merge: true });
  console.log(`${agent}: queued for the WhatsApp bot (outboxQueue)`);
  return "queued";
}

export async function tellOwner(db, { agent, text, template = "agent_alert", templateParam }, opts) {
  const cfg = waConfig(process.env);
  if (!cfg || !cfg.owner) return enqueueOwner(db, { agent, text, template, templateParam }, opts);

  const bot = (await botDoc(db).get()).data() || {};
  let how;
  try {
    how = await notifyOwner(cfg, {
      lastOwnerMsgAt: bot.lastOwnerMsgAt,
      text,
      template,
      templateParam: templateParam || text.split("\n")[0],
    });
  } catch (err) {
    // השליחה הישירה נכשלה — ה-worker ישלח מהתור. אם הכנסה לתור הצליחה ההודעה לא אבדה,
    // ולכן לא נכשלים (אחרת סימן החיים לא נכתב והמפקח ישלח שוב כל שעה). רק אם גם התור נכשל — זורקים.
    try {
      await enqueueOwner(db, { agent, text, template, templateParam }, opts);
    } catch {
      throw err;
    }
    console.warn(`${agent}: direct WhatsApp send failed (${err.message}); queued for the worker instead`);
    return "queued";
  }
  await botDoc(db).set({ outbox: { [agent]: entry({ agent, text, template, templateParam, how }) } }, { merge: true });
  console.log(`${agent}: owner notified (${how})`);
  return how;
}

// התראת כישלון מ-workflow — לכל היותר פעם ב-6 שעות לאותו מפתח (agentReports/bot.alertsSent),
// כדי שתהליך שנכשל כל שעה לא יציף את הבעלים.
export const ALERT_EVERY_HOURS = 6;
export async function enqueueAlertOnce(db, { key, text }, { now = new Date(), ...opts } = {}) {
  const bot = (await botDoc(db).get()).data() || {};
  const last = bot.alertsSent?.[key];
  if (last && now.getTime() - new Date(last).getTime() < ALERT_EVERY_HOURS * 3600 * 1000) {
    console.log(`${key}: already alerted at ${last} — skipped`);
    return "skipped";
  }
  await enqueueOwner(db, { agent: "github-actions", key, text, templateParam: text.split("\n")[0] }, opts);
  await botDoc(db).set({ alertsSent: { [key]: now.toISOString() } }, { merge: true });
  return "queued";
}
