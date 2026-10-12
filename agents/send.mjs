// ✉️ הודעה חופשית מהבעלים למדריכים המופעלים (agentReports/coaches.ids), דרך התבנית club_message.
// מופעל ידנית מ-GitHub (send-coach.yml) — כך Claude בפרויקט שולח כשהבעלים מבקש.
// to = שם (או חלק משם) של מדריך מופעל, או "כולם". text = הנוסח; קישור לקובץ (למשל מהדרייב) פשוט בתוך הטקסט.
// הקלט נקרא מקובץ האירוע ולא מ-env, כדי שלא יודפס ביומן הציבורי. היומן מדפיס רק מספרים.
import { pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";
import { normalizePhone, isValidPhone } from "./lib/analysis.mjs";

// רק מדריכים מופעלים עם טלפון תקין. שם לא חד-משמעי או לא מופעל — שגיאה, לא ניחוש.
export function pickCoaches(users, ids, to) {
  const approved = users.filter((u) => ids.includes(u.id) && !u.deleted);
  const q = String(to || "").trim();
  if (!q) throw new Error("missing recipient");
  const hits = q === "כולם" ? approved : (() => {
    const exact = approved.filter((u) => u.name === q);
    return exact.length ? exact : approved.filter((u) => (u.name || "").includes(q));
  })();
  if (q !== "כולם" && hits.length !== 1) throw new Error(`recipient matches ${hits.length} approved coaches (need exactly 1)`);
  const bad = hits.filter((u) => !isValidPhone(u.phone || ""));
  if (bad.length || !hits.length) throw new Error(`${bad.length} matched coaches have no valid phone, ${hits.length} matched`);
  return hits.map((u) => ({ id: u.id, phone: normalizePhone(u.phone) }));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { to, text } = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8")).inputs || {};
  if (!String(text || "").trim()) throw new Error("missing text");
  const { firestore, loadAll } = await import("./lib/firebase.mjs");
  const { waConfig, sendTemplate } = await import("./lib/whatsapp.mjs");
  const wa = waConfig(process.env);
  if (!wa) throw new Error("missing WhatsApp secrets");
  const db = firestore();
  const ids = (await db.collection("agentReports").doc("coaches").get()).data()?.ids || [];
  const targets = pickCoaches(await loadAll(db, "users"), ids, to);
  let sent = 0;
  for (const t of targets) {
    try {
      await sendTemplate(wa, t.phone, "club_message", [text]);
      sent++;
    } catch (e) {
      console.log(`send failed: ${e.message}`);
    }
  }
  console.log(`sent ${sent}/${targets.length}`);
  if (sent < targets.length) process.exit(1);
}
