// שולח התראת דחיפה לכל המכשירים שאישרו התראות בלוח המועדון (pushTokens, FCM).
//
// הקלט: TITLE (עד 60), BODY (עד 180), URL (רק תחת לוח המועדון; אחרת — כתובת הלוח). מגיע מ-env,
// ואם אין — מקלט ה-workflow_dispatch בקובץ האירוע (כמו agents/send.mjs, כדי שלא יודפס ביומן).
// הודעת data בלבד: ה-service worker של הלוח מציג אותה בעצמו.
// טוקנים מתים נמחקים. ליומן — רק מספרים.
//   FIREBASE_SERVICE_ACCOUNT=... TITLE=... node scripts/send_push.mjs   (אחרי `cd agents && npm ci`)
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { firestore, loadAll } from "../agents/lib/firebase.mjs";

// firebase-admin מותקן ב-agents/ — אותו מופע ש-firestore() מאתחל
const admin = createRequire(new URL("../agents/package.json", import.meta.url))("firebase-admin");

export const BOARD_URL = "https://shahar1987.github.io/ttc-club-board/";
// לכל היותר 20000, הוותיקים קודם: createdAt נקבע בשרת (request.time), ולכן הצפה של טוקנים
// מזויפים לא דוחקת החוצה מכשירים אמיתיים שנרשמו לפניה
export const MAX_TOKENS = 20000;
const CHUNK = 500;
const DEAD = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

const clean = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export function pushInput({ title, body, url } = {}) {
  const t = clean(title, 60);
  if (!t) throw new Error("TITLE is empty — nothing sent");
  return { title: t, body: clean(body, 180), url: boardUrl(url) };
}

// רק כתובת בלוח המועדון (מקור ונתיב אחרי נרמול), עד 300 תווים; אחרת — דף הבית של הלוח
export function boardUrl(url) {
  const u = String(url ?? "").trim();
  if (!u || u.length > 300) return BOARD_URL;
  try {
    const p = new URL(u);
    if (p.origin !== "https://shahar1987.github.io" || !p.pathname.startsWith("/ttc-club-board/") || p.pathname.includes("..")) return BOARD_URL;
    return p.href;
  } catch {
    return BOARD_URL;
  }
}

function rawInput() {
  const env = process.env;
  if (env.TITLE) return { title: env.TITLE, body: env.BODY, url: env.URL };
  try {
    return JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8")).inputs || {};
  } catch {
    return {};
  }
}

// גם scripts/gameday.mjs משתמש בזה. data — אחרי pushInput.
export async function sendPush(db, data) {
  const tokens = (await loadAll(db, "pushTokens", (q) => q.orderBy("createdAt").limit(MAX_TOKENS))).map((x) => x.id);
  const writer = db.bulkWriter();

  const n = { sent: 0, failed: 0, removed: 0 };
  for (let i = 0; i < tokens.length; i += CHUNK) {
    const chunk = tokens.slice(i, i + CHUNK);
    const res = await admin.messaging().sendEachForMulticast({
      tokens: chunk,
      data,
      webpush: { headers: { Urgency: "high", TTL: "86400" } },
    });
    n.sent += res.successCount;
    n.failed += res.failureCount;
    const dead = chunk.filter((_, k) => !res.responses[k].success && DEAD.has(res.responses[k].error?.code));
    for (const tok of dead) writer.delete(db.collection("pushTokens").doc(tok));
    n.removed += dead.length;
  }
  await writer.close();
  console.log(`push: ${tokens.length} tokens, ${n.sent} sent, ${n.failed} failed, ${n.removed} dead tokens removed`);
  return n;
}

async function main() {
  await sendPush(firestore(), pushInput(rawInput()));
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href)
  main().catch((err) => {
    console.error("push send failed: " + (err.message || err));
    process.exit(1);
  });
