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

export function sendText(cfg, to, text) {
  return post(cfg, { to, type: "text", text: { body: text.slice(0, 4000), preview_url: false } });
}

export function sendTemplate(cfg, to, name, params = [], lang = "he") {
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
export async function notifyOwner(cfg, { lastOwnerMsgAt, text, template, templateParam }) {
  if (!cfg || !cfg.owner) return "skipped: WhatsApp not configured";
  const open = lastOwnerMsgAt && Date.now() - new Date(lastOwnerMsgAt).getTime() < 23 * 3600 * 1000;
  if (open) {
    await sendText(cfg, cfg.owner, text);
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
