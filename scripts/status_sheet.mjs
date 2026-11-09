// סנכרון דו-כיווני בין גיליון "דוח שחקני המועדון" לשדה players.notPaying (מסך "מי לא משלם").
// סטטוס שהשתנה בגיליון נכתב לאפליקציה (notPayingSource: "manual", כמו סימון ידני, כך שסנכרון הדרייב לא דורס אותו).
// שינוי באפליקציה מעדכן את הגיליון. אי-התאמה ישנה שאף צד לא שינה נשארת: משווים כל צד רק מול הערך הקודם שלו
// (system/statusSheetSync), כדי ששלום יכריע בה בעצמו.
// שחקן פעיל שנוסף באפליקציה ועוד אין לו שורה נכנס ללשונית הקבוצה שלו (הגיליון הוא הבקרה של המועדון).
// שורה חדשה בגיליון עם שם וטלפון תקין נוצרת כשחקן באפליקציה (autosend שולח לו ברוכים הבאים). בלי טלפון השורה ממתינה:
// ההרצה עלולה לתפוס שורה באמצע הקלדה, ושחקן שנוצר בלי טלפון לא יקבל הודעה לעולם.
// גם שם, הורה, טלפון ותאריך הצטרפות מסונכרנים לשני הכיוונים (planFields), באותו עיקרון: כל צד מול הערך הקודם שלו.
// רץ מ-board-members.yml פעם בשעה. הריפו ציבורי: ליומן ההרצה מודפסים רק מספרים.
//   FIREBASE_SERVICE_ACCOUNT=... node scripts/status_sheet.mjs   (אחרי `cd agents && npm ci`)
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { firestore, loadAll } from "../agents/lib/firebase.mjs";
import { isValidPhone, normalizePhone } from "../agents/lib/analysis.mjs";
import { safeCell } from "./export_event_signups.mjs";
import { fetchRetry, finish } from "./sheets_retry.mjs";
import { CUTOFF } from "../agents/autosend.mjs";

const { JWT } = createRequire(new URL("../agents/package.json", import.meta.url))("google-auth-library");

export const SHEET_ID = "13xzdQCpxGrJj4oMm3CQwee44bQRIRqw9s60G08ooVj4";
export const PAID = "✓ רשום ושילם";
export const UNPAID = "◐ רשום, לא שילם";
export const OFF = "— לא במעקב";
export const CHECK = "⏳ לבדיקה"; // פער שמחכה להכרעה: לא משנה כלום באפליקציה, כמו "לא במעקב"
const neutral = (s) => s === OFF || s === CHECK;
export const NOT_REGISTERED = "✗ לא רשום";
const UNTRACKED_GROUP = "חוגים רמת כורזים";
const MAX_NEW_ROWS = 30;
const MAX_ARCHIVED = 10;
const MAX_APP_WRITES = 20; // יותר מזה בריצה אחת זה כנראה עמודה שנמחקה או הודבקה בטעות, לא עדכון אמיתי

// rows: [{ id, status, mirrored }]; players: Map(id → player); last: { id: { s, a } }
export function plan(rows, players, last) {
  const app = [], sheet = [], next = {};
  for (const r of rows) {
    const p = players.get(r.id);
    if (!p || !p.isActive || p.deleted || !r.status) continue;
    const a = p.notPaying === true;
    const was = last[r.id];
    if (!was) { next[r.id] = { s: r.status, a }; continue; } // פעם ראשונה: רק מתעדים, בלי לגעת באף צד
    let s = r.status, want = a;
    if (s !== was.s) {
      if (!neutral(s)) want = !s.startsWith("✓");
      if (want !== a) app.push({ id: r.id, notPaying: want });
    } else if (a !== was.a && !neutral(s) && !r.mirrored && s.startsWith("✓") === a) {
      s = a ? UNPAID : PAID;
      sheet.push({ id: r.id, status: s });
    }
    next[r.id] = { s, a: want };
  }
  return { app, sheet, next };
}

const isoDate = (v) => { const m = String(v || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : ""; };
const cleanPhone = (v) => (/\d/.test(String(v || "")) ? normalizePhone(v) : "");
const text = (v) => String(v || "").trim();
// key: שדה בשורה; app: שדה באפליקציה; ok: אפשר לכתוב לאפליקציה. ערך ריק בגיליון לעולם לא מוחק מידע מהאפליקציה
export const FIELDS = [
  { key: "name", app: "name", read: text, show: text, ok: (v) => v.length >= 2 && v.length <= 60 },
  { key: "parent", app: "parentName", read: text, show: text, ok: (v) => v.length >= 2 && v.length <= 60 },
  { key: "phone", app: "parentPhone", read: cleanPhone, show: (v) => phone(v), ok: isValidPhone },
  // תאריך שחוצה את CUTOFF היה מפעיל הודעת ברוך הבא לשחקן ותיק
  { key: "join", app: "joinDate", read: isoDate, readApp: text, show: (v) => String(v || "").split("-").reverse().join("/"), ok: (v, a) => !!v && !(v >= CUTOFF && String(a || "") < CUTOFF) },
];

// rows: [{ id, fields: { name, ... }, cells: { name: "'tab'!B3", ... } }]; last: { id: { name: { s, a } } }
// שני הצדדים השתנו: הגיליון קובע, כמו בסטטוס. ערך לא תקין בגיליון נשאר ממתין עד שיתוקן.
export function planFields(rows, players, last) {
  const patches = new Map(), sheet = [], next = {};
  for (const r of rows) {
    const p = players.get(r.id);
    if (!p || !p.isActive || p.deleted) continue;
    next[r.id] = {};
    for (const f of FIELDS) {
      if (!r.fields || !(f.key in r.fields)) continue;
      const s = f.read(r.fields[f.key]), a = (f.readApp || f.read)(p[f.app]);
      const was = last[r.id]?.[f.key];
      let v = { s, a };
      if (was && s !== was.s) {
        if (s !== a && f.ok(s, a)) { patches.set(r.id, { ...patches.get(r.id), [f.app]: s }); v = { s, a: s }; }
        else if (s !== a) v = was;
      } else if (was && a !== was.a) {
        sheet.push({ cell: r.cells[f.key], value: f.show(a) });
        v = { s: a, a };
      }
      next[r.id][f.key] = v;
    }
  }
  return { app: [...patches].map(([id, patch]) => ({ id, patch })), sheet, next };
}

// שחקן שיצא לארכיון: מרוקנים את השורה ומשאירים בהערה את שמו, כך שכל ספירות הגיליון יורדות לבד.
// הנוסחאות נשענות על טווח שורות קבוע, ולכן לא מוחקים שורה. אם יחזור, הוא ייכנס כשורה חדשה.
export function archivedRows(rows, players) {
  return rows.filter((r) => {
    const p = players.get(r.id);
    return p && r.clear && (p.isActive === false || p.deleted);
  }).map((r) => {
    const end = String(players.get(r.id).endDate || "").split("-").reverse().join("/");
    return { id: r.id, range: r.clear.range, noteCell: r.noteCell, note: `יצא לארכיון${end ? ` ${end}` : ""}: ${r.clear.name}${r.status ? ` (היה: ${r.status})` : ""}` };
  });
}

const phone = (raw) => {
  const d = String(raw || "").replace(/\D/g, "");
  if (!d) return "חסר";
  const n = d.startsWith("972") ? `0${d.slice(3)}` : d;
  return `${n.slice(0, 3)}-${n.slice(3)}`;
};

// שורה לשחקן חדש, לפי כותרות הלשונית (ילדים ומבוגרים שונים בעמודות)
export function newRow(p, group, headers, index) {
  const off = group === UNTRACKED_GROUP;
  const cell = {
    "#": index, "שם": String(p.name || "").trim(), "הורה": String(p.parentName || "").trim(), "טלפון": phone(p.parentPhone), "טלפון הורה": phone(p.parentPhone),
    "הצטרף": String(p.joinDate || "").split("-").reverse().join("/"), "אימון ראשון": "",
    "סטטוס רישום": off ? OFF : p.notPaying === false ? PAID : NOT_REGISTERED, "הערה": off ? "" : "נוסף מהאפליקציה", "מזהה": p.id,
  };
  return headers.map((h) => safeCell(cell[h] ?? ""));
}

// שחקן לאפליקציה משורה שהוקלדה בגיליון, באותו מבנה של אישור טופס הצטרפות (part-b.js). null = עוד לא מוכנה
export function draftPlayer(d, groupId, today) {
  const name = String(d.name || "").trim();
  if (name.length < 2 || name.length > 60 || !isValidPhone(d.phone)) return null;
  const parentPhone = normalizePhone(d.phone);
  return {
    id: `sheet_${createHash("sha1").update(`${groupId}|${name}|${parentPhone}`).digest("hex").slice(0, 16)}`, // קבוע: הרצה חוזרת לא יוצרת כפילות
    name, groupId, parentName: String(d.parent || "").trim().slice(0, 60), parentPhone, joinDate: today, endDate: null, isActive: true,
    notPaying: !String(d.status || "").startsWith("✓"), notPayingSource: "manual",
  };
}

async function sheetsFetch(tok, path, body) {
  const r = await fetchRetry(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }, `Sheets ${path.split("?")[0]}`);
  return r.json();
}

// קורא את כל לשוניות הקבוצות (כל לשונית שיש בה עמודות סטטוס רישום + מזהה)
async function readRows(tok) {
  const meta = await sheetsFetch(tok, "?fields=sheets.properties.title");
  const ranges = meta.sheets.map((s) => `'${s.properties.title}'!A2:K60`);
  const q = ranges.map((x) => `ranges=${encodeURIComponent(x)}`).join("&");
  const [vals, forms] = await Promise.all(["FORMATTED_VALUE", "FORMULA"].map((o) => sheetsFetch(tok, `/values:batchGet?${q}&valueRenderOption=${o}`)));
  const rows = [], tabs = {}, drafts = [];
  vals.valueRanges.forEach((vr, i) => {
    const grid = vr.values || [], tab = meta.sheets[i].properties.title;
    const [st, note, id] = ["סטטוס רישום", "הערה", "מזהה"].map((h) => (grid[0] || []).indexOf(h));
    if (st < 0 || id < 0) return;
    tabs[tab] = { headers: grid[0], used: grid.length + 1, count: grid.filter((r, k) => k && r[1]).length }; // used: שורת הגיליון האחרונה בשימוש
    const col = (c) => String.fromCharCode(65 + c);
    const at = (h) => grid[0].indexOf(h);
    const tel = at("טלפון הורה") < 0 ? at("טלפון") : at("טלפון הורה");
    grid.slice(1).forEach((row, j) => {
      if (!row[id]) {
        if ((row[at("שם")] || "").trim()) drafts.push({ tab, row: j + 3, name: row[at("שם")], parent: at("הורה") < 0 ? "" : row[at("הורה")], phone: row[tel], status: row[st] || "", cols: { id: col(id), st: col(st), note: col(note), join: col(at("הצטרף")), hash: col(0) } });
        return;
      }
      const n = j + 3, f = forms.valueRanges[i].values?.[j + 1]?.[st];
      const fields = {}, cells = {};
      for (const [key, h] of [["name", "שם"], ["parent", "הורה"], ["phone", grid[0][tel]], ["join", "הצטרף"]])
        if (h && at(h) >= 0) { fields[key] = row[at(h)] || ""; cells[key] = `'${tab}'!${col(at(h))}${n}`; }
      rows.push({ fields, cells, id: row[id], status: row[st] || "", mirrored: String(f || "").startsWith("="), statusCell: `'${tab}'!${col(st)}${n}`, noteCell: note < 0 ? null : `'${tab}'!${col(note)}${n}`,
        clear: note < 0 ? null : { range: `'${tab}'!A${n}:${col(grid[0].length - 1)}${n}`, name: row[at("שם")] || "" } });
    });
  });
  return { rows, tabs, drafts };
}

async function main() {
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
  const { token: tok } = await new JWT({ email: sa.client_email, key: sa.private_key, scopes: ["https://www.googleapis.com/auth/spreadsheets"] }).getAccessToken();
  if (!tok) throw new Error("no Sheets access token");
  const db = firestore();
  const ref = db.collection("system").doc("statusSheetSync");
  const [{ rows, tabs, drafts }, players, groups, snap] = await Promise.all([readRows(tok), loadAll(db, "players"), loadAll(db, "groups"), ref.get()]);
  const { app, sheet, next } = plan(rows, new Map(players.map((p) => [p.id, p])), snap.exists ? snap.data().players || {} : {});
  const fieldPlan = planFields(rows, new Map(players.map((p) => [p.id, p])), snap.exists ? snap.data().fields || {} : {});
  if (app.length + fieldPlan.app.length > MAX_APP_WRITES) throw new Error(`refusing ${app.length + fieldPlan.app.length} app writes in one run`);
  const gone = archivedRows(rows, new Map(players.map((p) => [p.id, p])));
  if (gone.length > MAX_ARCHIVED) throw new Error(`refusing to clear ${gone.length} rows in one run`);
  const byId = new Map(rows.map((r) => [r.id, r]));
  if (sheet.length) {
    const today = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", day: "2-digit", month: "2-digit" }).format(new Date());
    const data = sheet.flatMap(({ id, status }) => {
      const r = byId.get(id);
      return [{ range: r.statusCell, values: [[status]] }, ...(r.noteCell ? [{ range: r.noteCell, values: [[`עודכן מהאפליקציה ${today}`]] }] : [])];
    });
    await sheetsFetch(tok, "/values:batchUpdate", { valueInputOption: "RAW", data });
  }
  if (app.length || fieldPlan.app.length) {
    const b = db.batch();
    app.forEach(({ id, notPaying }) => b.update(db.collection("players").doc(id), { notPaying, notPayingSource: "manual" }));
    fieldPlan.app.forEach(({ id, patch }) => b.update(db.collection("players").doc(id), patch));
    await b.commit();
  }
  if (fieldPlan.sheet.length)
    await sheetsFetch(tok, "/values:batchUpdate", { valueInputOption: "USER_ENTERED", data: fieldPlan.sheet.map(({ cell, value }) => ({ range: cell, values: [[safeCell(value)]] })) });
  // שחקנים חדשים מהאפליקציה: USER_ENTERED כדי שתאריך ההצטרפות יישמר כתאריך; safeCell מונע נוסחאות מהשמות
  const known = new Set(rows.map((r) => r.id));
  const groupName = new Map(groups.map((g) => [g.id, g.name]));
  // שורות חדשות מהגיליון: קודם האפליקציה ואז המזהה בגיליון, כך שתקלה באמצע רק חוזרת בהרצה הבאה
  const tabGroup = new Map(groups.filter((g) => !g.deleted).map((g) => [g.name.replace("קובצת", "קבוצת"), g.id]));
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
  const links = [];
  let created = 0, waiting = 0;
  if (drafts.length > MAX_NEW_ROWS) throw new Error(`refusing ${drafts.length} sheet rows in one run`);
  for (const d of drafts) {
    const gid = tabGroup.get(d.tab);
    const doc = gid && draftPlayer(d, gid, today);
    if (!doc) { waiting++; continue; }
    const same = players.find((p) => p.groupId === gid && !p.deleted && p.isActive !== false && (p.name || "").trim() === doc.name);
    const { id, ...fields } = doc;
    if (!same && !players.some((p) => p.id === id)) { await db.collection("players").doc(id).set(fields); created++; }
    const pid = same ? same.id : id;
    known.add(pid);
    const cell = (c, v) => ({ range: `'${d.tab}'!${c}${d.row}`, values: [[v]] });
    links.push(cell(d.cols.id, pid), cell(d.cols.join, today.split("-").reverse().join("/")), cell(d.cols.hash, tabs[d.tab].count + 1));
    tabs[d.tab].count++;
    if (!d.status) links.push(cell(d.cols.st, NOT_REGISTERED), cell(d.cols.note, "נוסף מהגיליון"));
  }
  if (links.length) await sheetsFetch(tok, "/values:batchUpdate", { valueInputOption: "USER_ENTERED", data: links });
  const fresh = players.filter((p) => p.isActive !== false && !p.deleted && p.name && !known.has(p.id));
  if (fresh.length > MAX_NEW_ROWS) throw new Error(`refusing ${fresh.length} new rows in one run`);
  const add = [];
  let noTab = 0;
  for (const p of fresh) {
    const g = groupName.get(p.groupId) || "", t = tabs[g.replace("קובצת", "קבוצת")];
    if (!t) { noTab++; continue; }
    t.used++; t.count++;
    add.push({ range: `'${g.replace("קובצת", "קבוצת")}'!A${t.used}`, values: [newRow(p, g, t.headers, t.count)] });
  }
  if (gone.length) {
    // batchClear ולא כתיבת "": מחרוזת ריקה עדיין נספרת ב-COUNTA של הסיכום
    await sheetsFetch(tok, "/values:batchClear", { ranges: gone.map((g) => g.range) });
    await sheetsFetch(tok, "/values:batchUpdate", { valueInputOption: "RAW", data: gone.map((g) => ({ range: g.noteCell, values: [[g.note]] })) });
  }
  if (add.length) await sheetsFetch(tok, "/values:batchUpdate", { valueInputOption: "USER_ENTERED", data: add });
  await ref.set({ players: next, fields: fieldPlan.next, updatedAt: new Date().toISOString() });
  console.log(`status sheet: ${rows.length} rows, ${app.length} to app, ${sheet.length} to sheet, ${fieldPlan.app.length} field updates to app, ${fieldPlan.sheet.length} field updates to sheet, ${add.length} new rows, ${gone.length} archived rows cleared, ${noTab} without a tab, ${created} created from sheet, ${waiting} waiting for a phone`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href)
  main().catch((e) => finish("status sheet sync", e));
