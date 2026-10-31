// שומר שמות — הריפו ציבורי, אסור שם מלא של שחקן אמיתי בקוד (כמו privacy-guard.sh לטלפונים).
// השמות נשלפים מ-Firestore בזמן הבנייה ולא נשמרים בשום מקום. בלוג מודפסים רק קובץ:שורה, לעולם לא השם.
// בלי FIREBASE_SERVICE_ACCOUNT (PR מ-fork, הרצה מקומית) — מדלג. בדיקה מקומית: node scripts/name-guard.mjs players.json
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const norm = (s) => String(s || "").replace(/[‎‏"'׳״]/g, "").replace(/\s+/g, " ").trim();

async function loadNames() {
  if (process.argv[2]) {
    const j = JSON.parse(readFileSync(process.argv[2], "utf8"));
    return (Array.isArray(j) ? j : Object.values(j)).map((p) => p?.name);
  }
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) return null;
  const { default: admin } = await import("firebase-admin");
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  return (await admin.firestore().collection("players").get()).docs.map((d) => d.get("name"));
}

const raw = await loadNames();
if (!raw) {
  console.log("Name guard skipped - no FIREBASE_SERVICE_ACCOUNT");
  process.exit(0);
}
// רק שם מלא (שתי מילים לפחות) — שם פרטי לבד מופיע בטבעיות בטקסטים ויוצר רעש
const names = [...new Set(raw.map(norm).filter((n) => n.split(" ").length >= 2 && n.length >= 5))];
const files = execSync("git ls-files", { encoding: "utf8" }).split("\n")
  .filter((f) => f && !/\.(png|jpe?g|gif|webp|ico|pdf|woff2?|ttf|otf|pyc)$|(^|\/)package-lock\.json$|^\.claude\/skills\//.test(f));

const hits = [];
for (const f of files) {
  let text;
  try { text = readFileSync(f, "utf8"); } catch { continue; }
  if (text.includes("\0")) continue;
  text.split("\n").forEach((line, i) => {
    const l = norm(line);
    if (names.some((n) => l.includes(n))) hits.push(`${f}:${i + 1}`);
  });
}
if (hits.length) {
  console.log(`ERROR: a real player's full name found in ${hits.length} place(s) (names not printed):\n${hits.join("\n")}`);
  console.log("Personal data must live only in Firestore, never in the source code.");
  process.exit(1);
}
console.log(`Name guard passed - checked ${names.length} names in ${files.length} files.`);
