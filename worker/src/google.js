// 📧📅 המייל והיומן של הבעלים (Gmail + Google Calendar), דרך OAuth של חשבון הגוגל שלו.
// חיבור חד-פעמי: שולה שולחת לו קישור /google/start, הוא מאשר בגוגל, וה-refresh token נשמר
// ב-agentReports/google (האוסף חסום לאפליקציה בחוקי Firestore).
// מה מותר: לחפש ולקרוא קבצים בדרייב (קריאה בלבד), לקרוא מיילים, ליצור *טיוטות* (לא שולחים מייל אף פעם), לקרוא יומן, ולהוסיף אירוע רק אחרי אישור מפורש.
import { APPROVAL } from "./tools.js";

const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/gmail.compose", "https://www.googleapis.com/auth/calendar.events", "https://www.googleapis.com/auth/drive.readonly", "https://www.googleapis.com/auth/tasks"];
const TZ = "Asia/Jerusalem";
let cached = { token: "", exp: 0 };

export async function connectKey(env, label = "google") {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.META_APP_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(label)));
  return [...mac.slice(0, 12)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
// בלי GOOGLE_CLIENT_ID הקישור מוביל ל-"OAuth client was not found" — עדיף להגיד מה חסר
export const connectLink = async (env, origin) =>
  env.GOOGLE_CLIENT_ID ? `${origin}/google/start?k=${await connectKey(env)}` : "(גוגל לא מחובר ישירות לשולה — להעביר את הבקשה לקלוד עם ask_claude, שיש לו את חיבורי הגוגל של הבעלים)";

// /google/start ו-/google/callback. רק מי שמחזיק את המפתח (נשלח רק לבעלים בוואטסאפ) יכול לחבר חשבון.
export async function oauthRoute(req, env, store) {
  const url = new URL(req.url);
  const key = await connectKey(env);
  const redirect = `${url.origin}/google/callback`;
  if (url.pathname === "/google/start") {
    if (url.searchParams.get("k") !== key) return new Response("forbidden", { status: 403 });
    const q = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, redirect_uri: redirect, response_type: "code", scope: SCOPES.join(" "), access_type: "offline", prompt: "consent", state: key });
    return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${q}`, 302);
  }
  if (url.searchParams.get("state") !== key) return new Response("forbidden", { status: 403 });
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code: url.searchParams.get("code") || "", client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: redirect, grant_type: "authorization_code" }),
  });
  const j = await r.json();
  if (!j.refresh_token) return html(`החיבור נכשל: ${j.error_description || j.error || "אין refresh token"}. אפשר לנסות שוב מהקישור.`, 400);
  await store.merge("agentReports/google", { refreshToken: j.refresh_token, connectedAt: new Date().toISOString() });
  cached = { token: "", exp: 0 };
  return html("✅ שולה מחוברת למייל וליומן. אפשר לחזור לוואטסאפ.");
}
const html = (msg, status = 200) => new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><body dir="rtl" style="font:20px system-ui;padding:24px">${msg}</body>`, { status, headers: { "content-type": "text/html; charset=utf-8" } });

async function accessToken(env, store) {
  if (cached.token && cached.exp > Date.now() + 60000) return cached.token;
  const g = await store.get("agentReports/google");
  if (!g?.refreshToken) return null;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ refresh_token: g.refreshToken, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, grant_type: "refresh_token" }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`Google: ${j.error_description || j.error} — צריך לחבר מחדש`);
  cached = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return cached.token;
}

const b64url = (s) => Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
const header = (msg, name) => msg.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
function plainText(part) {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data) return fromB64url(part.body.data);
  for (const p of part.parts || []) {
    const t = plainText(p);
    if (t) return t;
  }
  if (part.mimeType === "text/html" && part.body?.data) return fromB64url(part.body.data).replace(/<style[\s\S]*?<\/style>|<[^>]+>/g, " ").replace(/\s+/g, " ");
  return "";
}

export const GOOGLE_TOOL_DEFS = [
  {
    name: "search_email",
    description: "חיפוש במייל (Gmail) של הבעלים. query בתחביר החיפוש של Gmail, למשל 'is:unread newer_than:2d' או 'from:mataz'. מחזיר מזהה, שולח, נושא, תאריך ותקציר.",
    input_schema: { type: "object", properties: { query: { type: "string" }, max: { type: "integer" } }, required: ["query"], additionalProperties: false },
  },
  {
    name: "read_email",
    description: "התוכן המלא של מייל אחד לפי המזהה מ-search_email.",
    input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"], additionalProperties: false },
  },
  {
    name: "draft_email",
    description: "יוצר טיוטת מייל ב-Gmail (לא שולח! הבעלים שולח בעצמו מהג'ימייל). reply_to_id = מזהה מייל כדי שהטיוטה תהיה תשובה באותו שרשור.",
    input_schema: {
      type: "object",
      properties: { to: { type: "string" }, subject: { type: "string" }, body: { type: "string" }, reply_to_id: { type: "string" } },
      required: ["to", "subject", "body"],
      additionalProperties: false,
    },
  },
  {
    name: "search_drive",
    description: "חיפוש קבצים בגוגל דרייב של הבעלים לפי מילים בשם או בתוכן. מחזיר מזהה, שם, סוג, תאריך עדכון וקישור.",
    input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"], additionalProperties: false },
  },
  {
    name: "read_drive_file",
    description: "התוכן של קובץ מהדרייב לפי מזהה מ-search_drive: מסמך גוגל כטקסט, גיליון כ-CSV, קובץ טקסט כמו שהוא. לקבצים אחרים (PDF, תמונה) מחזיר קישור.",
    input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"], additionalProperties: false },
  },
  {
    name: "list_tasks",
    description: "המשימות הפתוחות ברשימת המשימות הראשית של הבעלים (Google Tasks — זה מה שיש במקום גוגל קיפ, שאין לו גישה לחשבון פרטי).",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "add_task",
    description: "מוסיף משימה/תזכורת/פתק לרשימת המשימות של הבעלים ב-Google Tasks. due = YYYY-MM-DD (לא חובה).",
    input_schema: { type: "object", properties: { title: { type: "string" }, notes: { type: "string" }, due: { type: "string" } }, required: ["title"], additionalProperties: false },
  },
  {
    name: "list_events",
    description: "האירועים ביומן הראשי בין שני תאריכים (YYYY-MM-DD, כולל). ברירת מחדל: היום עד עוד 7 ימים.",
    input_schema: { type: "object", properties: { from: { type: "string" }, to: { type: "string" } }, additionalProperties: false },
  },
  {
    name: "create_event",
    description:
      "מוסיף אירוע ליומן. מותר רק אחרי שהבעלים אישר במפורש בהודעה האחרונה ('כן', 'אשר') את הכותרת, התאריך והשעות שהצגת לו. start/end בפורמט YYYY-MM-DDTHH:MM (שעון ישראל).",
    input_schema: {
      type: "object",
      properties: { title: { type: "string" }, start: { type: "string" }, end: { type: "string" }, location: { type: "string" }, description: { type: "string" } },
      required: ["title", "start", "end"],
      additionalProperties: false,
    },
  },
];

export function makeGoogleTools({ env, store, lastOwnerText, origin }) {
  const api = async (url, init = {}) => {
    const token = await accessToken(env, store);
    if (!token) throw new Error(`המייל והיומן עוד לא מחוברים. לשלוח לבעלים את הקישור לחיבור: ${await connectLink(env, origin)}`);
    const r = await fetch(url, { ...init, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" } });
    const j = await r.json().catch(() => ({}));
    // 403 = חסרה הרשאה (למשל דרייב/משימות שנוספו אחרי החיבור) — צריך לחבר מחדש
    if (!r.ok) throw new Error(`Google ${r.status}: ${j.error?.message || ""}${r.status === 403 ? ` — לשלוח לבעלים את הקישור לחיבור מחדש: ${await connectLink(env, origin)}` : ""}`);
    return j;
  };
  const G = "https://gmail.googleapis.com/gmail/v1/users/me";
  const D = "https://www.googleapis.com/drive/v3/files";
  const T = "https://tasks.googleapis.com/tasks/v1/lists/@default/tasks";
  const raw = async (url) => {
    const r = await fetch(url, { headers: { authorization: `Bearer ${await accessToken(env, store)}` } });
    if (!r.ok) throw new Error(`Google ${r.status}${r.status === 403 ? ` — לשלוח לבעלים את הקישור לחיבור מחדש: ${await connectLink(env, origin)}` : ""}`);
    return (await r.text()).slice(0, 8000);
  };
  const C = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

  return {
    async search_email({ query, max = 8 }) {
      const list = await api(`${G}/messages?${new URLSearchParams({ q: query, maxResults: String(Math.min(max, 15)) })}`);
      const msgs = await Promise.all(
        (list.messages || []).map((m) => api(`${G}/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`)),
      );
      if (!msgs.length) return "לא נמצאו מיילים.";
      return JSON.stringify(msgs.map((m) => ({ id: m.id, from: header(m, "From"), subject: header(m, "Subject"), date: header(m, "Date"), snippet: m.snippet, unread: (m.labelIds || []).includes("UNREAD") })));
    },

    async read_email({ id }) {
      const m = await api(`${G}/messages/${id}?format=full`);
      return JSON.stringify({ from: header(m, "From"), to: header(m, "To"), subject: header(m, "Subject"), date: header(m, "Date"), body: plainText(m.payload).slice(0, 6000) });
    },

    async draft_email({ to, subject, body, reply_to_id }) {
      const orig = reply_to_id ? await api(`${G}/messages/${reply_to_id}?format=metadata&metadataHeaders=Message-ID`) : null;
      const ref = orig && header(orig, "Message-ID");
      const raw = [
        `To: ${to}`,
        `Subject: =?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`,
        ...(ref ? [`In-Reply-To: ${ref}`, `References: ${ref}`] : []),
        "MIME-Version: 1.0",
        'Content-Type: text/plain; charset="UTF-8"',
        "Content-Transfer-Encoding: base64",
        "",
        Buffer.from(body, "utf8").toString("base64"),
      ].join("\r\n");
      await api(`${G}/drafts`, { method: "POST", body: JSON.stringify({ message: { raw: b64url(raw).replace(/=+$/, ""), ...(orig ? { threadId: orig.threadId } : {}) } }) });
      return `נשמרה טיוטה ל-${to} ("${subject}"). היא מחכה בתיקיית הטיוטות בג'ימייל — לא נשלחה.`;
    },

    async search_drive({ query }) {
      const q = String(query).replace(/['\\]/g, " ");
      const j = await api(`${D}?${new URLSearchParams({ q: `(name contains '${q}' or fullText contains '${q}') and trashed = false`, pageSize: "10", orderBy: "modifiedTime desc", fields: "files(id,name,mimeType,modifiedTime,webViewLink)" })}`);
      if (!j.files?.length) return "לא נמצאו קבצים.";
      return JSON.stringify(j.files.map((f) => ({ id: f.id, name: f.name, type: f.mimeType.split(/[./]/).pop(), modified: f.modifiedTime?.slice(0, 10), link: f.webViewLink })));
    },

    async read_drive_file({ id }) {
      const f = await api(`${D}/${id}?fields=name,mimeType,webViewLink`);
      const as = { "application/vnd.google-apps.document": "text/plain", "application/vnd.google-apps.spreadsheet": "text/csv", "application/vnd.google-apps.presentation": "text/plain" }[f.mimeType];
      if (as) return `${f.name}\n${await raw(`${D}/${id}/export?mimeType=${encodeURIComponent(as)}`)}`;
      if (f.mimeType.startsWith("text/") || f.mimeType === "application/json") return `${f.name}\n${await raw(`${D}/${id}?alt=media`)}`;
      return `את הקובץ "${f.name}" (${f.mimeType}) אי אפשר לקרוא כטקסט. קישור: ${f.webViewLink}`;
    },

    async list_tasks() {
      const j = await api(`${T}?showCompleted=false&maxResults=50`);
      if (!j.items?.length) return "אין משימות פתוחות.";
      return JSON.stringify(j.items.map((t) => ({ title: t.title, notes: t.notes || "", due: t.due?.slice(0, 10) || "" })));
    },

    async add_task({ title, notes, due }) {
      const t = await api(T, { method: "POST", body: JSON.stringify({ title, notes, due: /^\d{4}-\d{2}-\d{2}$/.test(due || "") ? `${due}T00:00:00.000Z` : undefined }) });
      return `נוספה משימה: ${t.title}${due ? ` (עד ${due})` : ""}.`;
    },

    async list_events({ from, to } = {}) {
      const today = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
      const f = from || today;
      const t = to || new Date(Date.parse(f) + 7 * 864e5).toISOString().slice(0, 10);
      // גבולות היום לפי שעון ישראל (+03:00/+02:00 — מספיק לעגל ל-+02:00 מוקדם ו-+03:00 מאוחר)
      const j = await api(`${C}?${new URLSearchParams({ timeMin: `${f}T00:00:00+03:00`, timeMax: `${t}T23:59:59+02:00`, singleEvents: "true", orderBy: "startTime", maxResults: "50", timeZone: TZ })}`);
      if (!j.items?.length) return "אין אירועים בטווח הזה.";
      return JSON.stringify(j.items.map((e) => ({ title: e.summary, start: e.start?.dateTime || e.start?.date, end: e.end?.dateTime || e.end?.date, location: e.location || "" })));
    },

    async create_event({ title, start, end, location, description }) {
      if (!APPROVAL.test(lastOwnerText)) return "לא נוסף: הבעלים עוד לא אישר. להציג לו כותרת, תאריך ושעות ולשאול.";
      const t = (s) => ({ dateTime: s.length === 16 ? `${s}:00` : s, timeZone: TZ });
      const e = await api(C, { method: "POST", body: JSON.stringify({ summary: title, start: t(start), end: t(end), location, description }) });
      return `נוסף ליומן: ${e.summary} (${start}).`;
    },
  };
}
