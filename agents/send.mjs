// ✉️ הודעה חופשית מהבעלים למדריכים, דרך התבנית club_message. מדריך = מופעל בבוט (agentReports/coaches.ids)
// או משויך לקבוצה פעילה באפליקציה (כמו שהתזכורות האוטומטיות מוצאות אותו).
// מופעל ידנית מ-GitHub (send-coach.yml) — כך Claude בפרויקט שולח כשהבעלים מבקש.
// to = שם (או חלק משם) של מדריך מופעל, או "כולם". text = הנוסח; קישור לקובץ (למשל מהדרייב) פשוט בתוך הטקסט.
// אין כאן סודות וואטסאפ: הבקשה נכנסת לתור agentReports/bot.outboxQueue עם to, וה-worker (שיש לו את הסודות)
// שולח בריצת ה-cron הבאה, עד רבע שעה (worker/src/index.js, deliverOutbox).
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
  return hits.map((u) => ({ id: u.id, name: u.name || "מדריך", phone: normalizePhone(u.phone) }));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { to, text } = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8")).inputs || {};
  if (!String(text || "").trim()) throw new Error("missing text");
  const { firestore, loadAll } = await import("./lib/firebase.mjs");
  const { randomUUID } = await import("node:crypto");
  const admin = (await import("firebase-admin")).default;
  const db = firestore();
  const groups = (await loadAll(db, "groups")).filter((g) => !g.deleted && g.isActive !== false);
  const ids = [
    ...((await db.collection("agentReports").doc("coaches").get()).data()?.ids || []),
    ...groups.flatMap((g) => [g.coachId, ...(Array.isArray(g.coachIds) ? g.coachIds : [])]).filter(Boolean),
  ];
  const targets = pickCoaches(await loadAll(db, "users"), ids, to);
  const at = new Date().toISOString();
  const items = targets.map((t) => ({ id: randomUUID(), from: "send-coach", key: "send-coach", at, to: t.phone, who: t.name, uid: t.id, text, template: "club_message", templateParam: text }));
  await db.collection("agentReports").doc("bot").set({ outboxQueue: admin.firestore.FieldValue.arrayUnion(...items) }, { merge: true });
  console.log(`queued ${items.length} for the WhatsApp bot (sent within 15 minutes)`);
}
