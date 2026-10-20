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
export const MAX_TOKENS = 20000; // מעבר לזה — כנראה הצפה של טוקנים מזויפים
const CHUNK = 500;
const DEAD = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-argument",
  "messaging/invalid-registration-token",
]);

const clean = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export function pushInput({ title, body, url } = {}) {
  const t = clean(title, 60);
  if (!t) throw new Error("TITLE is empty — nothing sent");
  const u = String(url ?? "").trim();
  return { title: t, body: clean(body, 180), url: u.startsWith(BOARD_URL) && !/\s/.test(u) ? u : BOARD_URL };
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

async function main() {
  const data = pushInput(rawInput());
  const db = firestore();
  const tokens = (await loadAll(db, "pushTokens")).map((x) => x.id);
  if (tokens.length > MAX_TOKENS) throw new Error(`${tokens.length} push tokens (limit ${MAX_TOKENS}) — possible flooding, nothing sent`);

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
    for (const tok of dead) await db.collection("pushTokens").doc(tok).delete();
    n.removed += dead.length;
  }
  console.log(`push: ${tokens.length} tokens, ${n.sent} sent, ${n.failed} failed, ${n.removed} dead tokens removed`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href)
  main().catch((err) => {
    console.error("push send failed: " + (err.message || err));
    process.exit(1);
  });
