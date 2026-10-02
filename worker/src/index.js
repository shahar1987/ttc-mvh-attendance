// 🤖 שולה — העוזרת האישית בוואטסאפ, וגם "המפקד" של מערכת הנוכחות.
//
// Meta שולחת כל הודעה שמגיעה למספר ל-POST /webhook. הבוט:
//   1. מוודא שההודעה באמת מ-Meta (חתימה עם App Secret)
//   2. עונה רק למספר של הבעלים (OWNER_PHONE). כל מספר אחר — מתעלם. זו הנעילה.
//   3. מעביר ל-Gemini עם הכלים שב-tools.js, ושולח את התשובה בוואטסאפ.
import { db } from "./firestore.js";
import { TOOL_DEFS, makeTools } from "./tools.js";
import { waConfig, sendText, typing, downloadMedia } from "../../agents/lib/whatsapp.mjs";

const MODELS = ["gemini-flash-latest", "gemini-3.8-flash", "gemini-flash-lite-latest"];
const REQUIRED = ["WHATSAPP_TOKEN", "WHATSAPP_PHONE_ID", "OWNER_PHONE", "META_APP_SECRET", "WEBHOOK_VERIFY_TOKEN", "GEMINI_API_KEY", "FIREBASE_SERVICE_ACCOUNT"];
const CHUNK = 4000; // מגבלת אורך הודעת וואטסאפ
const LOG_KEEP = 80; // כמה הודעות אחרונות המפקח רואה

const SYSTEM = `את שולה — העוזרת האישית של מנהל מועדון טניס שולחן מבואות החרמון, בוואטסאפ.
את מדברת רק איתו. עברית תמיד, בקצרה, בסגנון וואטסאפ: בלי כותרות markdown, *כוכבית* להדגשה מותרת, עד 12 שורות אלא אם ביקשו יותר.
עוזרת בכל דבר: שאלות, ניסוח הודעות ופוסטים, תכנון, רעיונות, חשיבה על החלטות. אם משהו לא ברור — שאלה אחת קצרה.

מערכת הנוכחות של המועדון — יש לך כלים אמיתיים (tools):
- נתונים רק מהכלים. אם אין — אומרים שאין, לא מנחשים.
- מתחתייך ארבעה סוכנים אוטומטיים: 🔎 הסורק היומי (מי לא הגיע, מי החסיר פעמיים ברצף, מי בסכנת נשירה), 🐞 בודק הבאגים, 💡 רעיונות, 🛡️ המפקח.
- סימון נוכחות: לפני שכותבים, לוודא קבוצה + תאריך + שמות, ולהציג מה עומד להישמר. אם שם שחקן לא חד-משמעי — לשאול.
- הודעות להורים ולשחקנים: שולחים רק אחרי אישור מפורש בהודעה האחרונה ("שלח הכל", "שלח 1,3", "כן"). לפני אישור — להראות את הרשימה והנוסח ולשאול. אחרי שליחה — לדווח בדיוק למי נשלח ולמי לא.
- משהו שאין לו כלי (למשל לשנות קוד באפליקציה) — לומר שזה דורש עבודה על הקוד ושזה יעבור ל-Claude בפרויקט.

פרסום המועדון — את מנסחת טיוטות בלבד, הוא מאשר ומתזמן בעצמו:
- קהל: הציבור המקומי בגליל העליון, בעיקר הורים לילדים. נימה חמה, ברורה, בלי סופרלטיבים ריקים.
- כל פוסט מסתיים בשורת קרדיט: "בשיתוף מתנ"ס אזורי מבואות החרמון והמועצה האזורית מבואות החרמון" (רק שני אלה בשורה הזאת).
- אימונים: אולם שאר ישוב — מתחילים א' וה' 16:30-17:30, מתקדמים א', ב', ה' 17:30-19:00, נבחרת/סגל א' וה' 19:00-21:00. רמת כורזים — מתחילים/מתקדמים ב' וד' 16:30-18:00, בוגרים ב' וד' 18:00-20:00. קיבוץ דפנה — מבוגרים וסטודנטים ב' וה' 19:30-21:00. קבוצת פינג פונג פרקינסון פועלת במועדון.
- להציע תמיד 2 גרסאות קצרות שונות באופי (לא רק ניסוח שונה), ולשאול אם רוצה עוד.

תמונות: כשמגיעה תמונה (פלאייר, פוסט, עיצוב) — להתייחס למה שרואים בה בפועל: היררכיה, קריאות, צבעים, לוגואים של השותפים (גדולים ובולטים), טקסט בעברית. הערות קונקרטיות ומה לשנות, לא מחמאות כלליות.
הודעות קוליות מגיעות אלייך כתמלול — לענות על התוכן כרגיל.`;

export default {
  // 🕵️ מפקח השיחות — פעם ביום (wrangler.toml → triggers)
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(review(env));
  },

  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (url.pathname === "/health" || url.pathname === "/") {
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
    await typing(wa, m.id).catch(() => {});
    let text = (m.type === "text" ? m.text.body : m.type === "button" ? m.button.text : m.image?.caption || "").trim();
    let media = null;
    if (m.type === "audio") {
      text = await transcribe(env, await downloadMedia(wa, m.audio.id));
      if (!text) return void (await sendText(wa, m.from, "לא הצלחתי לשמוע מה נאמר בהקלטה. אפשר לנסות שוב?"));
      text = `🎤 ${text}`;
    } else if (m.type === "image") {
      media = await downloadMedia(wa, m.image.id);
      text = `📷 [תמונה] ${text || "מה דעתך?"}`;
    }
    if (!text) {
      await sendText(wa, m.from, "כרגע אני מבינה טקסט, הודעות קוליות ותמונות 🙂");
      return;
    }
    if (["איפוס", "התחלה חדשה", "reset"].includes(text)) {
      await store.merge("agentReports/bot", { history: [] });
      await sendText(wa, m.from, "איפסתי את השיחה. מתחילים מחדש 🙂");
      return;
    }
    const { answer, userTurn } = await think(env, store, wa, bot, text, media, () => typing(wa, m.id).catch(() => {}));
    for (let i = 0; i < answer.length; i += CHUNK) await sendText(wa, m.from, answer.slice(i, i + CHUNK));
    const history = [...(bot.history || []), { role: "user", text: userTurn, at: now }, { role: "assistant", text: answer, at: new Date().toISOString() }];
    const log = [...(bot.log || []), { at: now, user: text, shula: answer }].slice(-LOG_KEEP);
    await store.merge("agentReports/bot", { history: history.slice(-16), log });
  } catch (e) {
    await store.merge("agentReports/bot", { lastError: { at: new Date().toISOString(), message: String(e.message || e) } });
    await sendText(wa, m.from, `משהו השתבש אצלי: ${String(e.message || e).slice(0, 200)}\nנסה שוב עוד דקה.`).catch(() => {});
  }
}

// הכלים בפורמט של Gemini (OpenAPI subset — בלי additionalProperties)
const FUNCTION_DECLS = TOOL_DEFS.map(({ name, description, input_schema: { additionalProperties, ...parameters } }) => ({ name, description, parameters }));

async function gemini(env, body) {
  let lastErr;
  for (const model of [...new Set([env.GEMINI_MODEL, ...MODELS].filter(Boolean))]) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
      body: JSON.stringify(body),
    });
    if (r.ok) return (await r.json())?.candidates?.[0]?.content?.parts || [];
    lastErr = new Error(`${model}: ${r.status}`);
    if (r.status === 401 || r.status === 403) break; // מפתח לא תקין — אין טעם לנסות מודל אחר
  }
  throw lastErr;
}

async function think(env, store, wa, bot, text, media, stillTyping) {
  const tools = makeTools({ env, store, wa, lastOwnerText: text });

  // השיחה הקודמת נשמרת כטקסט בלבד. הודעות מהסוכנים המתוזמנים (דוח הבוקר וכו') נכנסות
  // כהקשר, כדי שתשובה כמו "שלח הכל" לדוח הבוקר תובן נכון.
  const outbox = Object.entries(bot.outbox || {})
    .filter(([, o]) => o && o.at > (bot.lastOwnerMsgAt || "") && Date.now() - new Date(o.at).getTime() < 3 * 24 * 3600 * 1000)
    .map(([agent, o]) => `[${o.at.slice(0, 16)} הודעה שנשלחה ממך (${agent})]\n${o.text}`)
    .join("\n\n");
  const userTurn = outbox ? `${outbox}\n\n---\nההודעה החדשה:\n${text}` : text;
  const contents = [
    ...(bot.history || []).map((h) => ({ role: h.role === "assistant" ? "model" : "user", parts: [{ text: h.text }] })),
    { role: "user", parts: [{ text: userTurn }, ...(media ? [{ inlineData: media }] : [])] },
  ];
  const today = new Date().toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem", weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const isoToday = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });

  for (let turn = 0; turn < 6; turn++) {
    if (turn) stillTyping(); // החיווי נעלם אחרי 25 שניות — מחדשים בכל סבב כלים
    const parts = await gemini(env, {
      systemInstruction: { parts: [{ text: `${SYSTEM}\n\nהיום: ${today} (${isoToday})` }] },
      contents,
      tools: [{ functionDeclarations: FUNCTION_DECLS }],
      generationConfig: { maxOutputTokens: 1500, temperature: 0.6 },
    });
    const calls = parts.filter((p) => p.functionCall);
    if (!calls.length) {
      return { answer: parts.map((p) => p.text || "").join("").trim() || "👍", userTurn };
    }
    contents.push({ role: "model", parts });
    const results = await Promise.all(
      calls.map(async ({ functionCall: { name, args } }) => {
        let result;
        try {
          const fn = tools[name];
          if (!fn) throw new Error("unknown tool");
          result = String(await fn(args || {}));
        } catch (e) {
          result = `שגיאה: ${e.message}`;
        }
        return { functionResponse: { name, response: { result } } };
      }),
    );
    contents.push({ role: "user", parts: results });
  }
  return { answer: "זה לקח יותר מדי צעדים. אפשר לנסח שוב בקצרה?", userTurn };
}

// הודעה קולית → טקסט. Gemini מבין אודיו ישירות (ogg/opus של וואטסאפ).
async function transcribe(env, audio) {
  const parts = await gemini(env, {
    contents: [{ role: "user", parts: [{ text: "תמלל/י את ההקלטה מילה במילה, בשפה שבה דוברים. החזר/י רק את התמלול, בלי שום תוספת. אם אין דיבור — החזר/י ריק." }, { inlineData: audio }] }],
    generationConfig: { maxOutputTokens: 1500, temperature: 0 },
  });
  return parts.map((p) => p.text || "").join("").trim();
}

// 🕵️ מפקח השיחות: עובר על השיחות של היממה האחרונה ובודק ששולה סגרה כל בקשה עד הסוף ובדיוק כמו שביקשו.
// שולח הודעה רק כשיש משהו פתוח. השיחה עם הבעלים פתוחה (הוא כתב ב-24 השעות האחרונות), אז מותר טקסט חופשי.
const REVIEW = `את המפקחת על שולה, עוזרת וואטסאפ. לפנייך השיחות של היממה האחרונה בין הבעלים לשולה.
בדקי כל בקשה של הבעלים: האם שולה ביצעה אותה עד הסוף ובדיוק כמו שביקש? חפשי: משימה שנשארה באמצע, הבטחה ("אבדוק", "אחזור אלייך") בלי המשך, תשובה שלא עונה על השאלה, פעולה שנכשלה בלי שדווח, טיוטה שלא תאמה את הבקשה.
אם הכל נסגר — החזירי בדיוק: OK
אחרת — רשימה ממוספרת קצרה בעברית, שורה לכל בעיה: מה ביקש, מה חסר, ומה להציע עכשיו. בלי הקדמות.`;

export async function review(env) {
  const store = db(env);
  const bot = (await store.get("agentReports/bot")) || {};
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const day = (bot.log || []).filter((e) => e.at > since);
  if (!day.length) return "no conversations";
  const transcript = day.map((e) => `[${e.at.slice(11, 16)}] הבעלים: ${e.user}\nשולה: ${e.shula}`).join("\n\n");
  const parts = await gemini(env, {
    systemInstruction: { parts: [{ text: REVIEW }] },
    contents: [{ role: "user", parts: [{ text: transcript }] }],
    generationConfig: { maxOutputTokens: 1000, temperature: 0.2 },
  });
  const verdict = parts.map((p) => p.text || "").join("").trim();
  const at = new Date().toISOString();
  await store.merge("agentReports/bot", { lastReview: { at, verdict } });
  if (!verdict || /^OK\.?$/i.test(verdict)) return "ok";
  const text = `🕵️ *המפקח על שולה* — דברים שנשארו פתוחים היום:\n${verdict}\n\nאפשר לענות כאן ושולה תמשיך מהם.`;
  await sendText(waConfig(env), String(env.OWNER_PHONE).replace(/\D/g, ""), text);
  // נכנס ל-outbox כדי ששולה תראה את הרשימה כשהוא עונה (ראו think)
  await store.merge("agentReports/bot", { outbox: { ...(bot.outbox || {}), review: { at, text } } });
  return "sent";
}
