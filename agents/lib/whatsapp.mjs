// שליחת הודעות דרך WhatsApp Cloud API (Meta). משמש גם את הסוכנים ב-GitHub Actions.
// ה-Worker (worker/src) משתמש באותו קובץ.
// גרסת ה-Graph API של Meta לכל הקוד (וואטסאפ, פייסבוק, אינסטגרם) — מעלים גרסה רק כאן
export const META_API_VERSION = "v24.0";
export const GRAPH = `https://graph.facebook.com/${META_API_VERSION}`;

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
// אפשרות ארוכה מ-20 תווים לא נכנסת לכפתור, והיתה יוצאת כרשימה להקלדה (3.11: 18 מתוך 26 שאלות). יוצאת בתפריט בחירה של וואטסאפ
const LONG_OPTIONS = /\n+((?:[1-3]\. [^\n]{1,90}(?:\n|$)){2,3})\s*$/;
const listRow = (option, asked) => {
  const cut = option.length <= 24 ? option.length : option.lastIndexOf(" ", 24) > 0 ? option.lastIndexOf(" ", 24) : 24;
  const description = option.slice(cut).trim().slice(0, 72);
  return { id: `${option}${TAP}${asked}`.slice(0, 200), title: option.slice(0, cut), ...(description ? { description } : {}) };
};
// מזהה של כפתור אוטומטי: "כן¦סוף השאלה". כך הלחיצה חוזרת עם השאלה עצמה, גם בהודעות שנשלחו מה-cron ומהסוכנים (2.11: "כן" הגיע למודל בלי שום הקשר)
const TAP = "¦";
// replyTo = מזהה הודעה קודמת: התשובה מופיעה כציטוט שלה (כמו "עדכון על הכרטיס" בבוטים של Slack)
export async function sendText(cfg, to, text, buttons, replyTo) {
  const ctx = replyTo ? { context: { message_id: replyTo } } : {};
  const m = !buttons?.length && text.match(OPTIONS);
  if (m) {
    const asked = text.slice(0, m.index).replace(/\s+/g, " ").trim().slice(-200);
    buttons = m[1].trim().split("\n").map((l) => l.replace(/^\d\. /, "").trim()).map((title) => ({ id: `${title}${TAP}${asked}`, title }));
  }
  const long = !buttons?.length && text.match(LONG_OPTIONS);
  if (long && /[?:]\s*$/.test(text.slice(0, long.index))) {
    const before = text.slice(0, long.index).trim();
    const asked = before.replace(/\s+/g, " ").slice(-200);
    const rows = long[1].trim().split("\n").map((l) => listRow(l.replace(/^\d\. /, "").trim(), asked));
    const body = before.length > 1000 ? before.split("\n").filter(Boolean).pop().slice(0, 1000) : before;
    const plain = () => post(cfg, { to, ...ctx, type: "text", text: { body: text.slice(0, 4000), preview_url: false } });
    if (before.length > 1000) await post(cfg, { to, type: "text", text: { body: before.slice(0, 4000), preview_url: false } });
    return post(cfg, { to, ...ctx, type: "interactive", interactive: { type: "list", body: { text: body }, action: { button: "בחירה", sections: [{ rows }] } } }).catch(plain);
  }
  if (!buttons?.length) return post(cfg, { to, ...ctx, type: "text", text: { body: text.slice(0, 4000), preview_url: false } });
  let body = (m ? text.slice(0, m.index) : text).trim();
  // גוף הודעה עם כפתורים מוגבל ל-1024 תווים — הארוך יוצא קודם כטקסט, והכפתורים עם השורה האחרונה
  if (body.length > 1000) {
    await post(cfg, { to, type: "text", text: { body: body.slice(0, 4000), preview_url: false } });
    body = body.split("\n").filter(Boolean).pop().slice(0, 1000);
  }
  const send = (list) => post(cfg, {
    to,
    ...ctx,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body || "?" },
      action: {
        buttons: list.slice(0, 3).map((b) => (typeof b === "string" ? { id: b, title: b } : b))
          .map((b) => ({ type: "reply", reply: { id: String(b.id).slice(0, 256), title: String(b.title || b.id).slice(0, 20) } })),
      },
    },
  });
  // אם Meta דוחה מזהה עם השאלה — כפתור רגיל עדיף על הודעה שלא יצאה
  return m ? send(buttons).catch(() => send(buttons.map((b) => b.title))) : send(buttons);
}

const tapId = (m) => m.interactive?.button_reply?.id || m.interactive?.list_reply?.id || "";
// הטקסט של הודעה נכנסת: כתיבה, כפתור של תבנית, או לחיצה על כפתור או שורה בתפריט (חוזר ה-id שלהם)
export const incomingText = (m) =>
  (m.type === "text" ? m.text.body : m.type === "button" ? m.button.text : m.type === "interactive" ? tapId(m).split(TAP)[0] : "").trim();
// על איזו שאלה נלחץ הכפתור (ריק בכפתורים עם מזהה משלהם, כמו "מוח 9")
export const tappedQuestion = (m) => tapId(m).split(TAP)[1] || "";

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

export const oneLine = (text) => String(text || "").replace(/\s+/g, " ").trim().slice(0, 900);

// הודעה לשולה: טקסט מלא אם היא כתבה לבוט ב-24 השעות האחרונות (חלון השירות של Meta),
// אחרת תבנית עם שורת סיכום, והפרטים המלאים מחכים לה כשהיא עונה.
// מחזיר איך נשלח ("text" / "template"), או null כשהוואטסאפ לא מוגדר
export async function notifyOwner(cfg, { lastOwnerMsgAt, text, template = "agent_alert", templateParam = oneLine(text), buttons, replyTo, onSent }) {
  if (!cfg || !cfg.owner) return null;
  const open = lastOwnerMsgAt && Date.now() - new Date(lastOwnerMsgAt).getTime() < 23 * 3600 * 1000;
  if (open) {
    const id = await sendText(cfg, cfg.owner, text, buttons, replyTo);
    onSent?.(id);
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
export async function downloadMedia(cfg, mediaId, maxBytes = Infinity) {
  const auth = { Authorization: `Bearer ${cfg.token}` };
  const meta = await (await fetch(`${GRAPH}/${mediaId}`, { headers: auth })).json();
  if (!meta.url) throw new Error(`WhatsApp media: ${meta.error?.message || "no url"}`);
  if (meta.file_size > maxBytes) throw Object.assign(new Error("הקובץ גדול מדי"), { tooBig: true });
  const res = await fetch(meta.url, { headers: auth });
  if (!res.ok) throw new Error(`WhatsApp media download ${res.status}`);
  return { mimeType: (meta.mime_type || "").split(";")[0], data: Buffer.from(await res.arrayBuffer()).toString("base64") };
}

// קישור שפותח את הוואטסאפ של הבעלים עם הטקסט מוכן לנמען — ההודעה יוצאת מהמספר שלו, בלחיצה שלו
export const waLink = (phone, text) => `https://wa.me/${String(phone).replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
