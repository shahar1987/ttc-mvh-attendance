// 📮 תיבת בקשות לקלוד: מה ששולה לא יכולה לעשות בעצמה (מייל, יומן, דרייב דרך חיבורי הגוגל של הבעלים בקלוד,
// או כל משימה אחרת) נרשם ב-agentReports/bot.inbox. רוטינה של קלוד (פעם בשעה) מושכת את הבקשות הפתוחות
// ב-GET /inbox, עונה ב-POST /inbox, והתשובה נשלחת לבעלים בוואטסאפ.
// המפתח עצמו שמור רק ברוטינה; כאן (ריפו ציבורי) רק ה-SHA-256 שלו.
import { notifyOwner } from "../../agents/lib/whatsapp.mjs";
import { issueKey, checkKey, dropKey } from "./google.js";

// ⚡ הפעלה מיידית: כשנכנסת בקשה, ה-worker מפעיל את המשימה הקבועה של קלוד דרך ה-API (במקום לחכות לריצה השעתית).
// מפתח ה-API של המשימה נוצר בממשק של קלוד והבעלים מדביק אותו פעם אחת בדף /claude/start (נשמר ב-agentReports/claude).
async function fireRoutine(env, store, id) {
  const tok = env.ROUTINE_TOKEN || ((await store.get("agentReports/claude")) || {}).token;
  if (!tok || !env.ROUTINE_ID) return false;
  const r = await fetch(`https://api.anthropic.com/v1/claude_code/routines/${env.ROUTINE_ID}/fire`, {
    method: "POST",
    headers: { authorization: `Bearer ${tok}`, "anthropic-beta": "experimental-cc-routine-2026-04-01", "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ text: `new inbox request ${id}` }),
  }).catch(() => null);
  return !!r?.ok;
}

const page = (body, status = 200) => new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><body dir="rtl" style="font:20px system-ui;padding:24px">${body}</body>`, { status, headers: { "content-type": "text/html; charset=utf-8" } });

// /claude/start — דף חד-פעמי להדבקת מפתח המשימה. מפתח קישור משלו, פג אחרי 30 דקות ונמחק אחרי שמירה.
export async function claudeRoute(req, env, store) {
  const url = new URL(req.url);
  if (!(await checkKey(store, "claude", url.searchParams.get("k")))) return new Response("forbidden", { status: 403 });
  if (req.method === "POST") {
    const tok = String((await req.formData()).get("token") || "").trim();
    if (!tok.startsWith("sk-ant-")) return page("המפתח צריך להתחיל ב-sk-ant-. לחזור אחורה ולהדביק שוב.", 400);
    await store.merge("agentReports/claude", { token: tok, at: new Date().toISOString() });
    await dropKey(store, "claude");
    return page("✅ נשמר. מעכשיו כל בקשת מייל/יומן/דרייב מגיעה לקלוד מיד.");
  }
  return page(`<h2>חיבור מהיר של שולה לקלוד</h2><ol style="line-height:1.7">
<li>לפתוח את <a href="https://claude.ai/code/routines/${env.ROUTINE_ID}" target="_blank">המשימה של שולה בקלוד</a> ← עריכה.</li>
<li>Add another trigger ← <b>API</b> ← <b>Generate token</b>.</li>
<li>להעתיק את המפתח (מתחיל ב-sk-ant-) ולהדביק כאן:</li></ol>
<form method="post"><input name="token" required dir="ltr" style="width:100%;font:16px system-ui;padding:8px;margin:6px 0"><button style="font:18px system-ui;padding:10px 20px">שמירה</button></form>`);
}

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
      "מעביר בקשה לקלוד, שיש לו את חיבורי הגוגל של הבעלים (ג'ימייל, יומן, דרייב) וסקילים: מחקר, מסמכים/אקסל/מצגות/PDF, תמונות וסרטונים, עיצוב אתרים, SEO, שכתוב טקסט, שינוי באפליקציית הנוכחות. קלוד עונה תוך דקות, והתשובה (טקסט או קישור לקובץ) מגיעה לבעלים בוואטסאפ. request = הבקשה המלאה במילים של הבעלים: מה, בשביל מי, פורמט, מקור נתונים, דגשים.",
    input_schema: { type: "object", properties: { request: { type: "string" } }, required: ["request"], additionalProperties: false },
  },
];

export function makeInboxTools({ env, store, origin }) {
  return {
    async ask_claude({ request }) {
      const bot = (await store.get("agentReports/bot")) || {};
      const id = Math.random().toString(36).slice(2, 8);
      await store.merge("agentReports/bot", { inbox: [...(bot.inbox || []), { id, at: new Date().toISOString(), request, status: "open" }].slice(-30) });
      if (await fireRoutine(env, store, id)) return "נשלח לקלוד, והוא כבר עובד על זה. התשובה תגיע לבעלים בוואטסאפ בעוד דקה-שתיים. לא לנחש בינתיים את התשובה.";
      const base = "נרשם. קלוד יענה עד שעה, והתשובה תגיע לבעלים בוואטסאפ. לא לנחש בינתיים את התשובה.";
      // קישור ההפעלה המיידית נשלח לכל היותר פעם ביום, כדי לא לנדנד בכל בקשה
      if (Date.now() - new Date(bot.claudeLinkAt || 0).getTime() < 24 * 3600 * 1000) return base;
      await store.merge("agentReports/bot", { claudeLinkAt: new Date().toISOString() });
      return `${base} להוסיף פעם אחת, במילים האלה בדיוק: "אם תרצה שהתשובות יגיעו מיד במקום עד שעה, יש צעד חד-פעמי (לא קשור לגוגל): לפתוח את הקישור, להדביק שם את מפתח ה-API של המשימה בקלוד וללחוץ שמירה" ואת הקישור: ${origin}/claude/start?k=${await issueKey(store, "claude")}`;
    },
  };
}
