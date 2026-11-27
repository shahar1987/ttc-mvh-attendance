// 🎙️ הודעה קולית לבעלים בוואטסאפ (הגרסה החינמית של "ג'רביס מתקשר", 27.11: בלי Twilio ובלי ElevenLabs).
// מופעל מ-GitHub (voice-note.yml) עם text. הקול: edge-tts, he-IL-AvriNeural — חינמי, בלי מפתח.
// כאן אין סודות וואטסאפ: הקובץ (ogg/opus) נשמר ב-agentReports/voice_<id> והפריט נכנס ל-outboxQueue עם voice=<id>.
// ה-worker שולח אותו כהודעה קולית תוך רבע שעה (deliverOutbox). חלון 24 השעות של Meta סגור — יוצא הטקסט בתבנית, בלי קול.
// הקלט נקרא מקובץ האירוע ולא מ-env, כדי שלא יודפס ביומן הציבורי. היומן מדפיס רק מספרים.
import { pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";

export const MAX_CHARS = 1500; // ~2 דקות דיבור, ~300KB בתור base64 — מתחת למגבלת המסמך של Firestore
export const MAX_BYTES = 700_000;

// טקסט לדיבור: בלי קישורים, אימוג'י, כוכביות וסימני רשימה, שלא יוקראו בקול
export function speakable(text) {
  return String(text || "")
    .replace(/https?:\S+/g, "")
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "")
    .replace(/[*_~`#>|]/g, "")
    .replace(/^\s*(?:[-•]|\d+[.)])\s+/gm, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim()
    .slice(0, MAX_CHARS);
}

export function voiceItem({ id, at, text }) {
  const first = String(text).replace(/\s+/g, " ").trim();
  return { id, from: "voice", key: "voice", at, text: `🎙️ ${first}`.slice(0, 3500), voice: id, templateParam: first.slice(0, 900) };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { text } = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8")).inputs || {};
  const say = speakable(text);
  if (!say) throw new Error("missing text");
  const { execFileSync } = await import("node:child_process");
  const { mkdtempSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { randomUUID } = await import("node:crypto");
  const dir = mkdtempSync(join(tmpdir(), "voice-"));
  writeFileSync(join(dir, "say.txt"), say);
  execFileSync("edge-tts", ["--voice", "he-IL-AvriNeural", "--file", join(dir, "say.txt"), "--write-media", join(dir, "say.mp3")], { stdio: "ignore" });
  // וואטסאפ מציג הודעה קולית רק ל-ogg/opus מונו
  execFileSync("ffmpeg", ["-loglevel", "error", "-i", join(dir, "say.mp3"), "-ac", "1", "-c:a", "libopus", "-b:a", "24k", join(dir, "say.ogg")]);
  const bytes = readFileSync(join(dir, "say.ogg"));
  if (bytes.length > MAX_BYTES) throw new Error(`audio too big: ${bytes.length}`);
  const { firestore } = await import("./lib/firebase.mjs");
  const admin = (await import("firebase-admin")).default;
  const db = firestore();
  const id = randomUUID();
  const at = new Date().toISOString();
  await db.collection("agentReports").doc(`voice_${id}`).set({ at, mime: "audio/ogg", b64: bytes.toString("base64") });
  await db.collection("agentReports").doc("bot").set({ outboxQueue: admin.firestore.FieldValue.arrayUnion(voiceItem({ id, at, text })) }, { merge: true });
  console.log(`queued 1 voice note (${bytes.length} bytes, sent within 15 minutes)`);
}
