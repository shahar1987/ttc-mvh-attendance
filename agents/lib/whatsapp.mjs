// שליחת הודעות דרך WhatsApp Cloud API (Meta). משמש גם את הסוכנים ב-GitHub Actions.
// ה-Worker (worker/src) משתמש באותו קובץ.
const GRAPH = "https://graph.facebook.com/v24.0";

export function waConfig(env) {
  const token = env.WHATSAPP_TOKEN;
  const phoneId = env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) return null;
  return { token, phoneId, owner: env.OWNER_PHONE || "" };
}

async function post(cfg, body) {
  const res = await fetch(`${GRAPH}/${cfg.phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", ...body }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = json.error || {};
    const err = new Error(`WhatsApp ${res.status}: ${e.message || "unknown error"}`);
    err.code = e.code;
    throw err;
  }
  return json.messages?.[0]?.id || "";
}

// "1. כן\n2. לא" בסוף הודעה יוצא ככפתורים ללחיצה (30.10: "כל העניין הזה של המספרים מאוד מעצבן").
// buttons מפורשים: [{id, title}] — id הוא מה שחוזר כשלוחצים (למשל "מוח 9"), title עד 20 תווים.
const OPTIONS = /\n+((?:[1-3]\. [^\n]{1,20}(?:\n|$)){2,3})\s*$/;
export async function sendText(cfg, to, text, buttons) {
  const m = !buttons?.length && text.match(OPTIONS);
  if (m) buttons = m[1].trim().split("\n").map((l) => l.replace(/^\d\. /, "").trim());
  if (!buttons?.length) return post(cfg, { to, type: "text", text: { body: text.slice(0, 4000), preview_url: false } });
  let body = (m ? text.slice(0, m.index) : text).trim();
  // גוף הודעה עם כפתורים מוגבל ל-1024 תווים — הארוך יוצא קודם כטקסט, והכפתורים עם השורה האחרונה
  if (body.length > 1000) {
    await post(cfg, { to, type: "text", text: { body: body.slice(0, 4000), preview_url: false } });
    body = body.split("\n").filter(Boolean).pop().slice(0, 1000);
  }
  return post(cfg, {
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body || "?" },
      action: {
        buttons: buttons.slice(0, 3).map((b) => (typeof b === "string" ? { id: b, title: b } : b))
          .map((b) => ({ type: "reply", reply: { id: String(b.id).slice(0, 256), title: String(b.title || b.id).slice(0, 20) } })),
      },
    },
  });
}

// הטקסט של הודעה נכנסת: כתיבה, כפתור של תבנית, או לחיצה על כפתור (חוזר ה-id שלו)
export const incomingText = (m) =>
  (m.type === "text" ? m.text.body : m.type === "button" ? m.button.text : m.type === "interactive" ? m.interactive?.button_reply?.id || "" : "").trim();

// club_message סווגה ב-Meta כשיווקית, ונמענים חסומים לה (131049). קודם התבנית התפעולית, ואם היא עוד לא קיימת/מאושרת — הישנה.
const PREFER = { club_message: "coach_notice" };
const NO_TEMPLATE = [132001, 132015, 132016];
// who = שם הנמען (התבנית התפעולית פונה בשם)
export async function sendTemplate(cfg, to, name, params = [], lang = "he", who = "") {
  if (PREFER[name]) {
    try {
      return await sendTemplate(cfg, to, PREFER[name], [who || "מאמן/ת", ...params], lang);
    } catch (e) {
      if (!NO_TEMPLATE.includes(e.code)) throw e;
    }
  }
  return post(cfg, {
    to,
    type: "template",
    template: {
      name,
      language: { code: lang },
      components: params.length
        ? [{ type: "body", parameters: params.map((p) => ({ type: "text", text: String(p).replace(/\s*\n\s*/g, " · ") })) }]
        : [],
    },
  });
}

// הודעה לשולה: טקסט מלא אם היא כתבה לבוט ב-24 השעות האחרונות (חלון השירות של Meta),
// אחרת תבנית עם שורת סיכום, והפרטים המלאים מחכים לה כשהיא עונה.
export async function notifyOwner(cfg, { lastOwnerMsgAt, text, template, templateParam, buttons }) {
  if (!cfg || !cfg.owner) return "skipped: WhatsApp not configured";
  const open = lastOwnerMsgAt && Date.now() - new Date(lastOwnerMsgAt).getTime() < 23 * 3600 * 1000;
  if (open) {
    await sendText(cfg, cfg.owner, text, buttons);
    return "text";
  }
  await sendTemplate(cfg, cfg.owner, template, [templateParam]);
  return "template";
}

// "נקרא" + "מקלידה…" על ההודעה שהתקבלה. החיווי נעלם כשנשלחת תשובה או אחרי 25 שניות.
export function typing(cfg, messageId) {
  return post(cfg, { status: "read", message_id: messageId, typing_indicator: { type: "text" } });
}

// מוריד קובץ שנשלח לבוט (הקלטה, תמונה) ומחזיר אותו כ-base64 לשליחה ל-Gemini
export async function downloadMedia(cfg, mediaId) {
  const auth = { Authorization: `Bearer ${cfg.token}` };
  const meta = await (await fetch(`${GRAPH}/${mediaId}`, { headers: auth })).json();
  if (!meta.url) throw new Error(`WhatsApp media: ${meta.error?.message || "no url"}`);
  const res = await fetch(meta.url, { headers: auth });
  if (!res.ok) throw new Error(`WhatsApp media download ${res.status}`);
  return { mimeType: (meta.mime_type || "").split(";")[0], data: Buffer.from(await res.arrayBuffer()).toString("base64") };
}

// קישור שפותח את הוואטסאפ של הבעלים עם הטקסט מוכן לנמען — ההודעה יוצאת מהמספר שלו, בלחיצה שלו
export const waLink = (phone, text) => `https://wa.me/${String(phone).replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
