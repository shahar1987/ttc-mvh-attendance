// 🤖 הסוכן הראשי — הבוט ששולה מדברת איתו בוואטסאפ.
//
// Meta שולחת כל הודעה שמגיעה למספר המועדון ל-POST /webhook. הבוט:
//   1. מוודא שההודעה באמת מ-Meta (חתימה עם App Secret)
//   2. עונה רק למספר של שולה (OWNER_PHONE). כל מספר אחר — מתעלם. זו הנעילה.
//   3. מעביר ל-Claude עם הכלים שב-tools.js, ושולח את התשובה בוואטסאפ.
import Anthropic from "@anthropic-ai/sdk";
import { db } from "./firestore.js";
import { TOOL_DEFS, makeTools } from "./tools.js";
import { waConfig, sendText } from "../../agents/lib/whatsapp.mjs";

const MODEL = "claude-opus-5-5";
const REQUIRED = ["WHATSAPP_TOKEN", "WHATSAPP_PHONE_ID", "OWNER_PHONE", "META_APP_SECRET", "WEBHOOK_VERIFY_TOKEN", "ANTHROPIC_API_KEY", "FIREBASE_SERVICE_ACCOUNT"];

const SYSTEM = `אתה "המפקד" — הסוכן הראשי של מערכת הנוכחות של מועדון טניס שולחן מבואות החרמון.
אתה מדבר בוואטסאפ עם מנהלת המועדון בלבד. מתחתיך ארבעה סוכנים:
🔎 הסורק היומי (כל בוקר: מי לא הגיע, מי החסיר פעמיים ברצף, מי בסכנת נשירה)
🐞 בודק הבאגים (כל לילה: האתר, הנתונים, תהליכים שנכשלו)
💡 סוכן הרעיונות (פעם בשבוע)
🛡️ המפקח (כל שעה: שכולם עובדים ושלא דלף מידע)

איך לענות:
- עברית, קצר, בסגנון וואטסאפ. בלי כותרות markdown; *כוכבית* להדגשה מותרת. עד 12 שורות.
- קודם התשובה, אחר כך פרט אם צריך. כשמציגים רשימה — עם המספרים מהדוח.
- נתונים רק מהכלים. אם אין — אומרים שאין, לא מנחשים.

הודעות להורים ולשחקנים:
- שולחים רק אחרי אישור מפורש בהודעה האחרונה ("שלח הכל", "שלח 1,3", "כן").
- אם היא מבקשת לשלוח בלי שראתה את הרשימה — קודם להראות את הרשימה ואת נוסח ההודעה ולשאול.
- אחרי שליחה — לדווח בדיוק למי נשלח ולמי לא.

אם מבקשים משהו שאין לך כלי בשבילו (למשל לשנות קוד באפליקציה) — לומר שזה דורש עבודה על הקוד ושזה יעבור ל-Claude בפרויקט.`;

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (url.pathname === "/health") {
      const missing = REQUIRED.filter((k) => !env[k]);
      return Response.json({ ok: missing.length === 0, missing });
    }
    if (url.pathname !== "/webhook") return new Response("not found", { status: 404 });

    // אימות ה-webhook מול Meta (פעם אחת, בהגדרה)
    if (req.method === "GET") {
      const ok = url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === env.WEBHOOK_VERIFY_TOKEN;
      return ok ? new Response(url.searchParams.get("hub.challenge")) : new Response("forbidden", { status: 403 });
    }
    if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

    const raw = await req.text();
    if (!(await validSignature(raw, req.headers.get("x-hub-signature-256"), env.META_APP_SECRET)))
      return new Response("bad signature", { status: 401 });

    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return new Response("ok");
    }
    const owner = String(env.OWNER_PHONE || "").replace(/\D/g, "");
    const msgs = (body.entry || [])
      .flatMap((e) => e.changes || [])
      .flatMap((c) => c.value?.messages || [])
      .filter((m) => m.from === owner);
    // עונים ל-Meta מיד (אחרת היא שולחת שוב), וממשיכים לעבוד ברקע
    for (const m of msgs) ctx.waitUntil(handle(m, env));
    return new Response("ok");
  },
};

async function validSignature(raw, header, secret) {
  if (!header || !secret || !header.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)));
  const hex = [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
  const given = header.slice(7);
  if (given.length !== hex.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}

async function handle(m, env) {
  const store = db(env);
  const wa = waConfig(env);
  const bot = (await store.get("agentReports/bot")) || {};
  if ((bot.seenIds || []).includes(m.id)) return; // Meta שלחה את אותה הודעה פעמיים
  const now = new Date().toISOString();
  await store.merge("agentReports/bot", { seenIds: [...(bot.seenIds || []), m.id].slice(-50), lastOwnerMsgAt: now });

  try {
    const text = m.type === "text" ? m.text.body : m.type === "button" ? m.button.text : "";
    if (!text) {
      await sendText(wa, m.from, "כרגע אני מבין רק הודעות טקסט 🙂");
      return;
    }
    const { answer, userTurn } = await think(env, store, wa, bot, text);
    await sendText(wa, m.from, answer);
    const history = [...(bot.history || []), { role: "user", text: userTurn, at: now }, { role: "assistant", text: answer, at: new Date().toISOString() }];
    await store.merge("agentReports/bot", { history: history.slice(-16) });
  } catch (e) {
    await store.merge("agentReports/bot", { lastError: { at: new Date().toISOString(), message: String(e.message || e) } });
    await sendText(wa, m.from, `משהו השתבש אצלי: ${String(e.message || e).slice(0, 200)}\nהמפקח יראה את זה ויתריע אם זה חוזר.`).catch(() => {});
  }
}

async function think(env, store, wa, bot, text) {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const tools = makeTools({ env, store, wa, lastOwnerText: text });

  // השיחה הקודמת נשמרת כטקסט בלבד. הודעות מהסוכנים המתוזמנים (דוח הבוקר וכו') נכנסות
  // כהקשר, כדי שתשובה כמו "שלח הכל" לדוח הבוקר תובן נכון.
  const outbox = Object.entries(bot.outbox || {})
    .filter(([, o]) => o && o.at > (bot.lastOwnerMsgAt || "") && Date.now() - new Date(o.at).getTime() < 3 * 24 * 3600 * 1000)
    .map(([agent, o]) => `[${o.at.slice(0, 16)} הודעה שנשלחה ממך (${agent})]\n${o.text}`)
    .join("\n\n");
  const history = (bot.history || []).map((h) => ({ role: h.role, content: h.text }));
  const userTurn = outbox ? `${outbox}\n\n---\nההודעה החדשה של המנהלת:\n${text}` : text;
  const messages = [...history, { role: "user", content: userTurn }];

  for (let turn = 0; turn < 6; turn++) {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      thinking: { type: "adaptive" },
      output_config: { effort: "low" },
      system: `${SYSTEM}\n\nהיום: ${new Date().toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem", weekday: "long", day: "numeric", month: "long", year: "numeric" })}`,
      tools: TOOL_DEFS,
      messages,
    });
    if (res.stop_reason === "refusal") return { answer: "לא יכול לעזור עם זה.", userTurn };
    const uses = res.content.filter((b) => b.type === "tool_use");
    if (res.stop_reason !== "tool_use" || !uses.length) {
      return { answer: res.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim() || "👍", userTurn };
    }
    messages.push({ role: "assistant", content: res.content });
    const results = await Promise.all(
      uses.map(async (u) => {
        try {
          const fn = tools[u.name];
          if (!fn) throw new Error("unknown tool");
          return { type: "tool_result", tool_use_id: u.id, content: String(await fn(u.input || {})) };
        } catch (e) {
          return { type: "tool_result", tool_use_id: u.id, content: `שגיאה: ${e.message}`, is_error: true };
        }
      }),
    );
    messages.push({ role: "user", content: results });
  }
  return { answer: "זה לקח יותר מדי צעדים. אפשר לנסח שוב בקצרה?", userTurn };
}
