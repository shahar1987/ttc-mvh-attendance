// 🤖 שליחה אוטומטית מהמספר של שלום (28.10, שלום: "מישהו לא יגיע לאימון, שולחים לו הודעה להורים... שלא תהיה תלויה בי").
// שלום בחר (5.11): הודעה רק אחרי שתי היעדרויות ברצף (הנוסח של "שני האימונים האחרונים"), לא אחרי אחת, וברוך הבא למצטרף חדש.
// השליחה עצמה ב-shahar1987/wa-sender (מכשיר מקושר למספר שלו). הקוד כאן מחבר בין השניים, בלי סוכן AI בדרך
// (3.11: סוכן שמשגר את השליחה נעצר אצל מנגנון הבטיחות שלו כשאין אישור באותה ריצה, אז לפעמים יצא ולפעמים לא):
//   run                                 — ב-agents.yml: Firestore ← plan ← wa-sender ← יומן ← סימון באפליקציה ← דיווח לשלום.
//   plan <backupDir> [today] [sentLog]  — מגיבוי: מה לשלוח (JSON ל-stdout). לבדיקה ידנית בסנדבוקס.
//   mark                                — ב-Actions (autosend-mark.yml): MARKS=מפתחות שנשלחו → מסמן באפליקציה,
//                                         בדיוק כמו כשמאמן שולח (msgSentAt / alertHandledDate), כדי שלא יציקו למאמנים.
// הריפו ציבורי: mark מדפיס רק מספרים, והמפתחות הם מזהים בלבד.
import { readFileSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { analyze, addDays, israelToday, hebrewDay, isAdultGroup, isValidPhone, normalizePhone } from "./lib/analysis.mjs";
import { absenceTemplate, renderTemplate, CLUB } from "./templates.mjs";
import { knownGender } from "./lib/gender.mjs";

export const CUTOFF = "2026-10-28"; // לא שולחים על מה שקרה לפני שהאוטומציה הופעלה
const KEY = /^(repeat|welcome):\d{4}-\d{2}-\d{2}:[A-Za-z0-9]{1,40}:[A-Za-z0-9_]{1,40}$/;

const DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
function daysText(days) {
  const d = [...new Set(days || [])].filter((x) => x >= 0 && x <= 6).sort().map((x) => DAYS[x]);
  return d.length ? `בימי ${d.length > 1 ? d.slice(0, -1).join(", ") + " ו" + d.at(-1) : d[0]}` : "";
}

export function welcomeText(p, g) {
  const name = (p.name || "").trim(), first = name.split(/\s+/)[0];
  const parent = String(p.parentName || "").trim().split(/\s+/)[0];
  const gender = knownGender(p);
  const when = [daysText(g.days), g.startTime && `ב-${g.startTime}`].filter(Boolean).join(" ");
  const sched = when ? `האימונים ${when}.\n` : "";
  const end = `כל שאלה, אפשר לכתוב לי כאן.\nנתראה באימון!\nשלום, ${CLUB}`;
  return isAdultGroup(g)
    ? `היי ${first}, ברוכים הבאים למועדון! 🏓\nשמחים שהצטרפת לקבוצת ${g.name}, והשולחן כבר מחכה לך.\n${sched}${end}`
    : `היי${parent ? " " + parent : ""}, איזה כיף! 🏓\n${gender ? `שמחים ש${name} ${gender === "f" ? "הצטרפה" : "הצטרף"} לקבוצת ${g.name}, והשולחן כבר מחכה ${gender === "f" ? "לה" : "לו"}` : `שמחים לקבל את ${name} לקבוצת ${g.name}, והשולחן כבר מחכה`}.\n${sched}${end}`;
}

const rows = (o) => Object.entries(o || {}).map(([id, v]) => ({ id, ...v }));

// data: {players, groups, attendance, cancellations} כמערכים. sent: מפתחות שכבר יצאו (יומן wa-sender).
export function plan(data, today, sent = new Set()) {
  const { players, groups } = data;
  const groupById = new Map(groups.map((g) => [g.id, g]));
  const messages = [], noPhone = [];
  const add = (key, phone, text, who) => {
    if (sent.has(key)) return;
    if (!phone) return noPhone.push(who);
    messages.push({ key, to: phone, text, who });
  };
  // analyze לא סופר את היום בשתי היעדרויות (באפליקציה האימון עוד רץ); השליחה בערב, אז היום כבר נספר: כך ההודעה יוצאת באותו ערב, ומי שחזר היום לא מקבל
  for (const it of analyze({ ...data, today: addDays(today, 1) }).pending) {
    if (it.date < CUTOFF) continue;
    if (sent.has(`repeat:${it.dates[1]}:${it.groupId}:${it.playerId}`)) continue; // השלישית ברצף: כבר נשלחה על שתיים, הודעה הבאה אחרי עוד שתיים
    const t = absenceTemplate(it);
    add(`${it.kind}:${it.date}:${it.groupId}:${it.playerId}`, it.phone, renderTemplate(t.name, t.params), it.playerName);
  }
  for (const p of players) {
    const g = groupById.get(p.groupId);
    if (!g || g.deleted || !p.isActive || p.deleted || p.welcomeSentAt) continue;
    if (!p.joinDate || p.joinDate < CUTOFF || p.joinDate > today) continue;
    add(`welcome:${p.joinDate}:${g.id}:${p.id}`, isValidPhone(p.parentPhone) ? normalizePhone(p.parentPhone) : "", welcomeText(p, g), (p.name || "").trim());
  }
  return { today, messages, noPhone };
}

export function parseMarks(raw) {
  const keys = String(raw || "").split(",").map((s) => s.trim()).filter(Boolean);
  const bad = keys.filter((k) => !KEY.test(k));
  if (bad.length) throw new Error(`${bad.length} מפתחות לא תקינים`);
  return keys.map((k) => { const [kind, date, groupId, playerId] = k.split(":"); return { kind, date, groupId, playerId }; });
}

// כמו markHandled ב-worker/src/tools.js: alertHandledDate רק קדימה
async function mark(db, m, now) {
  const pref = db.collection("players").doc(m.playerId);
  if (m.kind === "welcome") return pref.set({ welcomeSentAt: now }, { merge: true }).then(() => "ok");
  await db.runTransaction(async (tx) => {
    const p = await tx.get(pref);
    const cur = p.exists && p.data().alertHandledDate;
    if (p.exists && !(cur && cur >= m.date)) tx.update(pref, { alertHandledDate: m.date });
  });
  return "ok";
}

export const LIMIT = 25; // יותר מזה ביום אחד = כנראה נוכחות נשמרה לא נכון, אז מחכים לשלום
const KIND = { absence: "לא הגיע/ה", repeat: "שתי היעדרויות", welcome: "ברוך הבא" };

// חלוקה להודעות עד 3000 תווים, בגבול של פריט
export function chunks(items, max = 3000) {
  const out = [];
  for (const it of items) {
    if (out.length && out.at(-1).length + it.length + 2 <= max) out[out.length - 1] += `\n\n${it}`;
    else out.push(it);
  }
  return out;
}

// io: send(messages) → {sent:[keys], failed:[{key,reason}]}, log(keys), mark(keys), tell(text), hold().
// נזרק מ-send = לא ידוע מה יצא (אין תוצאה מהשולח) אם err.unknown; אחרת שום דבר לא יצא.
export async function deliver({ today, messages, noPhone = [], noPhoneTold, requested, held }, io) {
  if (noPhone.length && !noPhoneTold) {
    await io.tell(`📇 אין טלפון באפליקציה ל: ${noPhone.join(", ")}. אפשר לכתוב לשולה: הטלפון של <שם> ואת המספר`);
    await io.log([`nophone:${today}`]);
  }
  if (!messages.length) {
    if (requested) await io.tell("אין כרגע הודעות שמחכות לשליחה");
    return { ok: true, sent: 0 };
  }
  if (messages.length > LIMIT && !(requested && held === today)) {
    if (held !== today) {
      await io.hold();
      await io.tell(`⚠️ ${messages.length} הודעות מחכות, יותר מהרגיל, ולא נשלחו. אולי נוכחות נשמרה לא נכון. אם הכל תקין, תכתוב לשולה: שלחי את ההודעות`);
    }
    return { ok: true, sent: 0, held: true };
  }
  if (held === today && !requested) return { ok: true, sent: 0, held: true }; // מחכה להחלטה שלו
  let res;
  try {
    res = await io.send(messages);
  } catch (e) {
    if (e.unknown) await io.hold(); // אולי יצא: לא שולחים שוב בלי החלטה שלו
    await io.tell(`⚠️ ההודעות להורים לא יצאו: ${e.message}`);
    return { ok: false, sent: 0, note: e.message };
  }
  const byKey = new Map(messages.map((m) => [m.key, m]));
  const notes = [];
  if (res.sent.length) {
    await io.log(res.sent); // קודם היומן: הוא מה שמונע שליחה כפולה גם אם הסימון נופל
    await io.mark(res.sent).catch(() => notes.push("⚠️ לא סומן באפליקציה"));
  }
  const items = res.sent.map((k) => `${byKey.get(k)?.who} (${KIND[k.split(":")[0]]}):\n${byKey.get(k)?.text}`);
  const failed = res.failed.map((f) => `לא יצא: ${byKey.get(f.key)?.who} — ${f.reason}`);
  for (const t of chunks([`נשלחו ${res.sent.length} הודעות:`, ...items, ...failed, ...notes])) await io.tell(t);
  return { ok: !failed.length, sent: res.sent.length, note: failed[0] };
}

const WA_API = "https://api.github.com/repos/shahar1987/wa-sender";
function waSender(token, sleep = (ms) => new Promise((r) => setTimeout(r, ms))) {
  const api = (path, init = {}) => fetch(`${WA_API}/${path}`, { ...init, headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "user-agent": "ttc-autosend", "content-type": "application/json" } });
  const read = async (path) => {
    const r = await api(`contents/${path}`);
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`wa-sender ${path}: ${r.status}`);
    const j = await r.json();
    return { sha: j.sha, json: JSON.parse(Buffer.from(j.content, "base64").toString("utf8")) };
  };
  return {
    log: async () => (await read("pending/auto-log.json"))?.json || [],
    async append(keys) {
      const at = new Date().toISOString();
      for (let i = 0; ; i++) {
        const cur = await read("pending/auto-log.json");
        const content = Buffer.from(JSON.stringify([...(cur?.json || []), ...keys.map((key) => ({ key, at }))], null, 1)).toString("base64");
        const r = await api("contents/pending/auto-log.json", { method: "PUT", body: JSON.stringify({ message: `autosend: ${keys.length} ביומן`, content, sha: cur?.sha }) });
        if (r.ok) return;
        if (i >= 2) throw new Error(`יומן wa-sender: ${r.status}`);
      }
    },
    async send(messages) {
      const id = randomUUID();
      const list = messages.map(({ key, to, text }) => ({ key, to, text }));
      const r = await api("actions/workflows/wa.yml/dispatches", { method: "POST", body: JSON.stringify({ ref: "main", inputs: { mode: "batch", messages: JSON.stringify(list), result: id } }) });
      if (r.status !== 204) throw new Error(`הפעלת השולח נכשלה (${r.status})`);
      for (let i = 0; i < 210; i++) { // עד 35 דקות: התור של wa משותף, ובין הודעות יש הפרש אקראי של 20-60 שניות
        await sleep(10000);
        const res = (await read("pending/last-result.json").catch(() => null))?.json;
        if (res?.id === id) {
          if (res.error && !res.sent?.length) throw new Error(res.error);
          return res;
        }
      }
      throw Object.assign(new Error("השולח לא החזיר תוצאה תוך 35 דקות"), { unknown: true });
    },
  };
}

const israelHour = () => Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", hour: "numeric", hourCycle: "h23" }).format(new Date()));

async function run() {
  const requested = process.env.AUTOSEND_REQUESTED === "1";
  if (!requested && (israelHour() < 20 || israelHour() > 22)) return console.log("autosend: outside the evening window");
  const [{ firestore, loadAll }, { tellOwner }] = await Promise.all([import("./lib/firebase.mjs"), import("./lib/owner.mjs")]);
  const db = firestore(), botRef = db.collection("agentReports").doc("bot");
  const tell = (text) => tellOwner(db, { agent: "autosend", text });
  const finish = async (ok, note = "") => {
    if (!requested) return;
    const open = await db.collection("agentReports").where("tap", "==", "הודעות עכשיו").get();
    for (const d of open.docs) if (d.data().inboxStatus === "waiting") await d.ref.set({ inboxStatus: ok ? "done" : "failed", note, doneAt: new Date().toISOString() }, { merge: true });
  };
  const stamp = new Date().toISOString();
  const locked = await db.runTransaction(async (tx) => { // ריצה מתוזמנת ובקשה מיידית לא שולחות במקביל
    const at = (await tx.get(botRef)).data()?.autosendLock;
    if (at && Date.now() - Date.parse(at) < 40 * 60 * 1000) return true;
    tx.set(botRef, { autosendLock: stamp }, { merge: true });
    return false;
  });
  if (locked) return console.log("autosend: another run is active");
  try {
    if (!process.env.WA_SENDER_TOKEN) throw new Error("חסר הסוד WA_SENDER_TOKEN בגיטהאב");
    const wa = waSender(process.env.WA_SENDER_TOKEN);
    const today = israelToday();
    const [players, groups, attendance, cancellations, log, bot] = await Promise.all([...["players", "groups", "attendance", "cancellations"].map((n) => loadAll(db, n)), wa.log(), botRef.get()]);
    const sent = new Set(log.map((x) => x.key));
    const p = plan({ players, groups, attendance, cancellations }, today, sent);
    const res = await deliver({ ...p, noPhoneTold: sent.has(`nophone:${today}`), requested, held: bot.data()?.autosendHeld }, {
      send: wa.send, log: wa.append, tell,
      hold: () => botRef.set({ autosendHeld: today }, { merge: true }),
      mark: async (keys) => { const now = new Date().toISOString(); for (const m of parseMarks(keys.join(","))) await mark(db, m, now); },
    });
    console.log(`::notice title=autosend::${res.sent} נשלחו${res.held ? ", מחכה לשלום" : ""}`); // רק מספרים: הריפו ציבורי
    await finish(res.ok, res.note);
  } catch (e) {
    await tell(`⚠️ ההודעות להורים לא יצאו: ${e.message}`).catch(() => {});
    await finish(false, e.message).catch(() => {});
    throw e;
  } finally {
    await botRef.set({ autosendLock: null }, { merge: true });
  }
}

async function main() {
  const [cmd, dir, todayArg, sentLog] = process.argv.slice(2);
  if (cmd === "plan") {
    const load = (n) => rows(JSON.parse(readFileSync(`${dir}/${n}.json`, "utf8")));
    const sent = new Set(sentLog && existsSync(sentLog) ? JSON.parse(readFileSync(sentLog, "utf8")).map((x) => x.key) : []);
    const data = { players: load("players"), groups: load("groups"), attendance: load("attendance"), cancellations: load("cancellations") };
    console.log(JSON.stringify(plan(data, todayArg || israelToday(), sent), null, 1));
  } else if (cmd === "run") {
    await run();
  } else if (cmd === "mark") {
    const marks = parseMarks(process.env.MARKS);
    const { firestore } = await import("./lib/firebase.mjs");
    const db = firestore(), now = new Date().toISOString();
    const res = { ok: 0, skipped: 0 };
    for (const m of marks) res[await mark(db, m, now)]++;
    console.log(`::notice title=סומן::${res.ok} סומנו, ${res.skipped} דולגו (סומנו בינתיים כנוכח או לא קיימים)`);
  } else throw new Error("usage: autosend.mjs run | plan <dir> [today] [sentLog] | mark");
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
