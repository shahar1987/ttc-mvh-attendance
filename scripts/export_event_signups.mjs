// מעביר הרשמות לאירועים (eventSignups, נרשמו בלוח המועדון) לגיליון של המארגנים.
//
// לכל הרשמה שאין לה eventSignupExports/{id}:
//   1. שורה אחת בגיליון של האירוע (scripts/event_sheets.json), בסדר העמודות של הגיליון:
//      נרשם בתאריך, שם משפחה, שם פרטי, מקצה, מגדר, תאריך לידה, שם חברה / ארגון / מועדון, פלאפון,
//      ת.ז (ריק — לא אוספים), עיר, מדינה, אימייל, מידת חולצה, נרשם ע"י, הועבר למארגנים (ריק).
//      קריאת append אחת לכל אירוע, עם אותו service account (JWT של google-auth-library, כמו sync_payments.mjs).
//   2. eventSignupExports/{id} = { exportedAt, sheetId }.
//   3. הודעה אחת לבעלים בוואטסאפ (התור של הבוט) עם השמות — פרטית לבעלים.
// הרשמה שנמחקה אחרי הייצוא — מתעלמים (השורה בגיליון נשארת).
//
// הריפו ציבורי: ליומן ההרצה מודפסים רק מספרים.
//   FIREBASE_SERVICE_ACCOUNT=... node scripts/export_event_signups.mjs   (אחרי `cd agents && npm ci`)
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { firestore, loadAll } from "../agents/lib/firebase.mjs";
import { enqueueOwner } from "../agents/lib/owner.mjs";

// google-auth-library מותקן ב-agents/ (כמו firebase-admin)
const { JWT } = createRequire(new URL("../agents/package.json", import.meta.url))("google-auth-library");

export const EVENTS = JSON.parse(readFileSync(new URL("./event_sheets.json", import.meta.url), "utf8"));

const toDate = (v) => (!v ? new Date(0) : typeof v.toDate === "function" ? v.toDate() : new Date(v));

// dd/mm/yyyy HH:MM בשעון ישראל
export function israelTime(v) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Jerusalem", day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(toDate(v)).map((x) => [x.type, x.value]),
  );
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

export function rowFor(s, cfg) {
  return [
    israelTime(s.createdAt), s.lastName || "", s.firstName || "", s.heat || "", s.gender || "", s.birth || "",
    cfg.org, s.phone || "", "", s.city || "", "ישראל", s.email || "", s.shirt || "", s.byName || "", "",
  ];
}

// הרשמות שעוד לא יוצאו, לפי אירוע (רק אירועים שמוגדרים ב-event_sheets.json), לפי סדר ההרשמה
export function pendingByEvent(signups, exportedIds, events = EVENTS) {
  const out = {};
  for (const s of signups) {
    if (exportedIds.has(s.id) || !events[s.event]) continue;
    (out[s.event] ||= []).push(s);
  }
  for (const k in out) out[k].sort((a, b) => toDate(a.createdAt) - toDate(b.createdAt));
  return out;
}

export function ownerText(byEvent, events = EVENTS) {
  return Object.entries(byEvent)
    .map(([ev, list]) =>
      `🏃 ${list.length} נרשמו ל${events[ev].title} מהאפליקציה: ` +
      list.map((s) => `${s.firstName} ${s.lastName} – ${s.heat}`).join(", ") +
      " · חסרות ת.ז — להשלים מול הנרשמים לפני ההעברה למארגנים",
    )
    .join("\n");
}

async function sheetsToken() {
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
  const jwt = new JWT({ email: sa.client_email, key: sa.private_key, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  const { token } = await jwt.getAccessToken();
  if (!token) throw new Error("could not obtain a Sheets access token — check that Sheets API is enabled");
  return token;
}

async function appendRows(token, sheetId, rows) {
  // RAW: הטלפון נשאר עם 0 בהתחלה והתאריך נשאר טקסט. A1 = הגיליון הראשון.
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ values: rows }),
  });
  if (!r.ok) throw new Error(`Sheets append failed (${r.status})`);
}

async function main() {
  const db = firestore();
  const [signups, exports] = await Promise.all([loadAll(db, "eventSignups"), loadAll(db, "eventSignupExports")]);
  const byEvent = pendingByEvent(signups, new Set(exports.map((x) => x.id)));
  const events = Object.keys(byEvent);
  if (!events.length) return console.log(`event signups: ${signups.length} total, 0 new`);

  const token = await sheetsToken();
  let n = 0;
  for (const ev of events) {
    const { sheetId } = EVENTS[ev];
    await appendRows(token, sheetId, byEvent[ev].map((s) => rowFor(s, EVENTS[ev])));
    // shortcut: אם הכתיבה כאן נכשלת אחרי append מוצלח, הריצה הבאה תוסיף את השורות שוב — נדיר, ומספיק למחוק כפילות ידנית
    const batch = db.batch();
    for (const s of byEvent[ev]) batch.set(db.collection("eventSignupExports").doc(s.id), { exportedAt: new Date(), sheetId });
    await batch.commit();
    n += byEvent[ev].length;
  }
  await enqueueOwner(db, { agent: "event-signups", text: ownerText(byEvent) });
  console.log(`event signups: ${signups.length} total, ${n} exported to ${events.length} sheet(s), owner notified`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href)
  main().catch((err) => {
    console.error("event signups export failed: " + (err.message || err));
    process.exit(1);
  });
