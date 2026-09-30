// עוזר לסוכנים המתוזמנים: שולח לשולה ושומר את ההודעה המלאה, כדי שהבוט יוכל
// להראות אותה כשהיא עונה לתבנית.
import { waConfig, notifyOwner } from "./whatsapp.mjs";

export async function tellOwner(db, { agent, text, template = "agent_alert", templateParam }) {
  const bot = (await db.collection("agentReports").doc("bot").get()).data() || {};
  const how = await notifyOwner(waConfig(process.env), {
    lastOwnerMsgAt: bot.lastOwnerMsgAt,
    text,
    template,
    templateParam: templateParam || text.split("\n")[0],
  });
  await db
    .collection("agentReports")
    .doc("bot")
    .set({ outbox: { [agent]: { at: new Date().toISOString(), text, how } } }, { merge: true });
  console.log(`${agent}: owner notified (${how})`);
  return how;
}
