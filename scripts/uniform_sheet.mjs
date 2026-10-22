// מעדכן את גיליון מידות התלבושת (סיכום להזמנה, עוד לא מילאו, רשימת שחקנים, תשובות) מ-Firestore —
// אותו מקור ואותה התאמת שמות כמו דשבורד המאמן ב-shahar1987.github.io/ttc-uniform-sizes,
// כך שהגיליון והדשבורד תמיד מראים אותו דבר (כולל עריכות ושיוכים שהמאמן עשה בדשבורד).
// קורא: uniformResponses, uniformConfig/roster. כותב: הגיליון בלבד (משותף עם ה-service account).
// הריפו ציבורי: ליומן ההרצה מודפסים רק מספרים.
//   FIREBASE_SERVICE_ACCOUNT=... node scripts/uniform_sheet.mjs   (אחרי `cd agents && npm ci`)
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import vm from "node:vm";
import { firestore, loadAll } from "../agents/lib/firebase.mjs";
import { israelTime, safeCell } from "./export_event_signups.mjs";

const { JWT } = createRequire(new URL("../agents/package.json", import.meta.url))("google-auth-library");

export const SHEET_ID = "1ESzW-CmgDwREHuIJJzMcM5dB9WqOLMnZR9iKc3UvwX4";
const MATCH_URL = "https://shahar1987.github.io/ttc-uniform-sizes/match.js";
const SZ = ["16", "18", "XS", "S", "M", "L", "XL", "XXL", "3XL"];
const ms = (a) => (a.at && typeof a.at.toMillis === "function" ? a.at.toMillis() : 0);

// אותה התאמה כמו הדשבורד: קובץ match.js של הדף עצמו, לא עותק
async function loadMatcher() {
  const r = await fetch(MATCH_URL);
  if (!r.ok) throw new Error(`match.js fetch failed (${r.status})`);
  const ctx = {};
  vm.runInNewContext(await r.text(), { globalThis: ctx, window: ctx });
  return ctx.UniformMatch;
}

// = compute() בדשבורד
export function compute(answers, roster, M) {
  const rows = answers
    .filter((a) => M.norm(a.first) !== "בדיקה")
    .map((a) => {
      const auto = M.matchName(a.first, a.last, roster);
      return { ...a, player: a.player || auto.name, suggestion: auto.suggestion, ms: ms(a) };
    })
    .sort((x, y) => x.ms - y.ms);
  const names = new Set(roster.map((p) => p.name));
  const latest = new Map();
  rows.forEach((r) => { if (names.has(r.player)) latest.set(r.player, r); });
  const unmatched = rows.filter((r) => !r.player);
  return { rows, latest, unmatched, kept: [...latest.values(), ...unmatched] };
}

export function tabs(roster, d) {
  const groupOf = new Map(roster.map((p) => [p.name, p.group]));
  const missing = roster.filter((p) => !d.latest.has(p.name));
  const count = (k, s) => d.kept.filter((r) => String(r[k]) === s).length;
  const other = (k) => d.kept.filter((r) => r[k] && !SZ.includes(String(r[k]))).length;
  const lines = SZ.map((s) => [s, count("shirt", s), count("pants", s)]);
  lines.push(["מידה אחרת (פירוט בלשונית תשובות)", other("shirt"), other("pants")]);
  const sum = (i) => lines.reduce((a, l) => a + l[i], 0);

  const order = [
    ["תלבושת ליגה 2026-27, סיכום להזמנה"],
    [`מילאו ${d.latest.size} מתוך ${roster.length}`],
    ["מידה", "חולצות", "מכנסיים"],
    ...lines,
    ['סה"כ', sum(1), sum(2)],
    [],
    [`עודכן ${israelTime(new Date())} מהדשבורד. מי שמילא פעמיים נספר פעם אחת, לפי המילוי האחרון.`],
    ["קישור להורים: https://shahar1987.github.io/ttc-uniform-sizes/"],
    [],
    [`עוד לא מילאו (${missing.length}):`],
    [missing.length ? missing.map((p) => p.name).join(", ") : "כולם מילאו 🎉"],
  ];
  if (d.unmatched.length) order.push([], [`תשובות שלא שויכו לשחקן (${d.unmatched.length}) — לשייך בדשבורד, לשונית תשובות`]);

  const miss = [["מס'", "שם", "קבוצה"], ...missing.map((p, i) => [i + 1, p.name, p.group])];
  const players = [
    ["שם", "קבוצה", "סטטוס", "מידת חולצה", "מידת מכנס"],
    ...roster.map((p) => {
      const a = d.latest.get(p.name);
      return a ? [p.name, p.group, "✅ מילא", a.shirt, a.pants] : [p.name, p.group, "⬜ עוד לא", "", ""];
    }),
  ];
  const kept = new Set(d.kept);
  const answersTab = [
    ["תאריך מילוי", "שם פרטי (כפי שנכתב)", "שם משפחה (כפי שנכתב)", "מידת חולצה", "מידת מכנס", "שחקן ברשימה", "קבוצה", "הערה"],
    ...d.rows.map((r) => [
      r.ms ? israelTime(new Date(r.ms)) : "", r.first || "", r.last || "", r.shirt || "", r.pants || "",
      groupOf.has(r.player) ? r.player : "", groupOf.get(r.player) || "",
      !r.player ? "לא זוהה ברשימה, לבדוק" + (r.suggestion ? ` (אולי ${r.suggestion}?)` : "")
        : !groupOf.has(r.player) ? "הוסר מהרשימה"
        : !kept.has(r) ? "הוחלף במילוי מאוחר יותר"
        : r.by === "coach" ? "הוזן בדשבורד" : "",
    ]),
  ];
  return { "סיכום להזמנה": order, "עוד לא מילאו": miss, "רשימת שחקנים": players, "תשובות": answersTab };
}

async function token() {
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
  const jwt = new JWT({ email: sa.client_email, key: sa.private_key, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  const { token } = await jwt.getAccessToken();
  if (!token) throw new Error("no Sheets access token");
  return token;
}

async function call(tok, path, body) {
  const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}${path}`, {
    method: "POST", headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Sheets ${path} failed (${r.status})`);
}

async function main() {
  const db = firestore();
  const [answers, rdoc, M] = await Promise.all([
    loadAll(db, "uniformResponses"), db.collection("uniformConfig").doc("roster").get(), loadMatcher(),
  ]);
  const roster = rdoc.exists && rdoc.data().players;
  // בלי רשימה אין מה להשוות אליו — לא נוגעים בגיליון
  if (!Array.isArray(roster) || !roster.length) throw new Error("uniformConfig/roster missing — sheet left unchanged");
  const d = compute(answers, roster, M);
  const t = tabs(roster, d);
  const tok = await token();
  // RAW: 16/18 נשארים טקסט; safeCell מונע נוסחאות ממה שהורים הקלידו
  const data = Object.entries(t).map(([name, values]) => ({ range: `'${name}'!A1`, values: values.map((row) => row.map(safeCell)) }));
  await call(tok, "/values:batchClear", { ranges: Object.keys(t).map((n) => `'${n}'!A1:J1000`) });
  await call(tok, "/values:batchUpdate", { valueInputOption: "RAW", data });
  console.log(`uniform sheet: ${d.latest.size}/${roster.length} filled, ${d.rows.length} answers, ${d.unmatched.length} unmatched`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href)
  main().catch((err) => {
    console.error("uniform sheet sync failed: " + (err.message || err));
    process.exit(1);
  });
