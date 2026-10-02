// 📮 תיבת בקשות לקלוד: מה ששולה לא יכולה לעשות בעצמה (מייל, יומן, דרייב דרך חיבורי הגוגל של הבעלים בקלוד,
// או כל משימה אחרת) נרשם ב-agentReports/bot.inbox. רוטינה של קלוד (פעם בשעה) מושכת את הבקשות הפתוחות
// ב-GET /inbox, עונה ב-POST /inbox, והתשובה נשלחת לבעלים בוואטסאפ.
// המפתח עצמו שמור רק ברוטינה; כאן (ריפו ציבורי) רק ה-SHA-256 שלו.
import { notifyOwner } from "../../agents/lib/whatsapp.mjs";

const sha256 = async (s) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, "0")).join("");

export async function inboxRoute(req, env, store, wa) {
  const url = new URL(req.url);
  if (!env.INBOX_KEY_SHA256 || (await sha256(url.searchParams.get("k") || "")) !== env.INBOX_KEY_SHA256) return new Response("forbidden", { status: 403 });
  const bot = (await store.get("agentReports/bot")) || {};
  const inbox = bot.inbox || [];
  if (req.method === "GET") return Response.json(inbox.filter((x) => x.status === "open"));
  const { id, answer } = await req.json();
  const item = inbox.find((x) => x.id === id && x.status === "open");
  if (!item || !answer) return Response.json({ ok: false, error: "no such open request" }, { status: 404 });
  const at = new Date().toISOString();
  await store.merge("agentReports/bot", {
    inbox: inbox.map((x) => (x === item ? { ...x, status: "done", answer, doneAt: at } : x)).slice(-30),
    outbox: { ...(bot.outbox || {}), claude: { at, text: `על "${item.request}": ${answer}` } },
  });
  await notifyOwner(wa, { lastOwnerMsgAt: bot.lastOwnerMsgAt, text: `📮 *תשובה מקלוד* על "${item.request}":\n\n${answer}`, template: "agent_alert", templateParam: "יש תשובה מקלוד לבקשה שלך" });
  return Response.json({ ok: true });
}

export const INBOX_TOOL_DEFS = [
  {
    name: "ask_claude",
    description:
      "מעביר בקשה לקלוד, שיש לו את חיבורי הגוגל של הבעלים (ג'ימייל, יומן, דרייב) ויכולות נוספות. קלוד עונה עד שעה, והתשובה מגיעה לבעלים בוואטסאפ. להשתמש כשצריך מייל/יומן/דרייב וכלי הגוגל של שולה לא מחוברים, או למשימה שאין לשולה כלי בשבילה. request = הבקשה המלאה במילים של הבעלים, עם כל הפרטים.",
    input_schema: { type: "object", properties: { request: { type: "string" } }, required: ["request"], additionalProperties: false },
  },
];

export function makeInboxTools({ store }) {
  return {
    async ask_claude({ request }) {
      const bot = (await store.get("agentReports/bot")) || {};
      const id = Math.random().toString(36).slice(2, 8);
      await store.merge("agentReports/bot", { inbox: [...(bot.inbox || []), { id, at: new Date().toISOString(), request, status: "open" }].slice(-30) });
      return "נרשם. קלוד יענה עד שעה, והתשובה תגיע לבעלים בוואטסאפ. לא לנחש בינתיים את התשובה.";
    },
  };
}
