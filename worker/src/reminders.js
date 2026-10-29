// ⏰ תזכורת למאמנים שלא מילאו נוכחות — רץ כל רבע שעה (wrangler.toml → triggers).
// קבוצה שהתאמנה היום (groups.days), שהאימון שלה נגמר לפני חצי שעה לפחות, ואין לה אף רשומת נוכחות להיום:
// הבוט שולח לכל מאמן שלה את התבנית coach_attendance_reminder עם קישור שפותח ישר את הקבוצה, והבעלים מקבל סיכום.
// מאמן שהשליחה אליו נכשלה (למשל התבנית לא אושרה) — הבעלים מקבל עבורו קישור wa.me כמו פעם, ושולח בעצמו.
import { addDays, israelToday, normalizePhone, isValidPhone, analyze } from "../../agents/lib/analysis.mjs";
import { waLink, notifyOwner, sendTemplate, sendText } from "../../agents/lib/whatsapp.mjs";
import { renderTemplate } from "../../agents/templates.mjs";
import { outboxMap } from "./queue.js";

const GRACE_MIN = 30;
// הסימון הוא בדיקת בטיחות בתחילת האימון (שולה, 18.10): מזכירים 10 דקות אחרי ההתחלה, כשעוד אפשר לברר מי חסר.
// קבוצה בלי startTime — כמו פעם, חצי שעה אחרי הסוף.
const START_GRACE_MIN = 10;
const remindAt = (g) => (toMin(g.startTime) !== null ? toMin(g.startTime) + START_GRACE_MIN : toMin(g.endTime) !== null ? toMin(g.endTime) + GRACE_MIN : null);
// הקישור פותח את האפליקציה ישר על מסך הסימון של הקבוצה (part-b.js קורא את #group=)
const APP_URL = "https://shahar1987.github.io/ttc-mvh-attendance/";

// 🔗 קישורי wa.me עם נוסח בעברית יוצאים ארוכים מאוד (כל אות מקודדת ל-%D7%..) וממלאים את המסך.
// מחליפים כל אחד בקישור קצר של ה-worker (/w/<id>) שמפנה אליו. נשמרים 7 ימים ב-agentReports/links. בלי PUBLIC_URL — משאירים כמו שהם.
export async function shortLinks(env, store, text) {
  const urls = env.PUBLIC_URL ? [...new Set(String(text).match(/https:\/\/wa\.me\/\S+/g) || [])] : [];
  if (!urls.length) return text;
  const at = new Date().toISOString(), week = new Date(Date.now() - 7 * 864e5).toISOString();
  const map = Object.fromEntries(urls.map((u) => [u, crypto.randomUUID().replace(/-/g, "").slice(0, 10)]));
  await store.update("agentReports/links", (cur) => ({
    links: {
      ...Object.fromEntries(Object.entries(cur.links || {}).filter(([, v]) => v?.at > week)),
      ...Object.fromEntries(Object.entries(map).map(([url, id]) => [id, { url, at }])),
    },
  }));
  return urls.reduce((t, u) => t.split(u).join(`${env.PUBLIC_URL}/w/${map[u]}`), String(text));
}

const israelNow = (now) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now).map((x) => [x.type, x.value]));
  return { dow: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday), min: Number(p.hour) * 60 + Number(p.minute) };
};
const toMin = (t) => (/^\d{1,2}:\d{2}$/.test(t || "") ? Number(t.split(":")[0]) * 60 + Number(t.split(":")[1]) : null);
export const coachIds = (g) => [...new Set([g.coachId, ...(Array.isArray(g.coachIds) ? g.coachIds : [])].filter(Boolean))];
// מאמנים שהבעלים ביקש לא לשלוח להם הודעות אוטומטיות (למשל מחליף) — נשארים משויכים בקבוצה. coach_messages ב-coaches.js
const quietIds = async (store) => ((await store.get("agentReports/coaches")) || {}).quiet || [];

export async function remindCoaches(env, store, wa, now = new Date()) {
  const today = israelToday(now);
  const { dow, min } = israelNow(now);
  const bot = (await store.get("agentReports/bot")) || {};
  const done = bot.coachReminders?.date === today ? bot.coachReminders.groups : [];
  const groups = (await store.list("groups")).filter(
    (g) => !g.deleted && g.isActive !== false && Array.isArray(g.days) && g.days.includes(dow) && remindAt(g) !== null && min >= remindAt(g) && !done.includes(g.id),
  );
  if (!groups.length) return "nothing due";

  const [players, users, recs, quiet] = await Promise.all([store.list("players"), store.list("users"), store.where("attendance", "date", today), quietIds(store)]);
  const marked = new Set(recs.map((a) => a.groupId));
  const lines = [];
  const targets = [];
  for (const g of groups) {
    const hasPlayers = players.some((p) => p.groupId === g.id && p.isActive && !p.deleted);
    if (!hasPlayers || marked.has(g.id)) continue;
    for (const id of coachIds(g).filter((x) => !quiet.includes(x))) {
      const c = users.find((u) => u.id === id) || { name: "מאמן" };
      if (!isValidPhone(c.phone || "")) lines.push(`• ${g.name} — ${c.name}: אין טלפון שמור`);
      else targets.push({ g, c, phone: normalizePhone(c.phone) });
    }
    if (!coachIds(g).length) lines.push(`• ${g.name}: אין מאמן משויך`);
  }
  const ids = groups.map((g) => g.id);
  // מסמנים את הקבוצות *לפני* השליחה. כך כישלון בסימון לא גורם לשליחה חוזרת כל רבע שעה (אם הכתיבה נכשלת —
  // לא שולחים בכלל, והריצה הבאה מנסה מחדש). אם השליחה עצמה נכשלת — מבטלים את הסימון כדי לנסות שוב ברבע הבא.
  await store.update("agentReports/bot", (cur) => {
    const prev = cur.coachReminders?.date === today ? cur.coachReminders : {};
    return { coachReminders: { date: today, groups: [...new Set([...(prev.groups || []), ...ids])], lastSentAt: { ...(prev.lastSentAt || {}), ...Object.fromEntries(ids.map((id) => [id, now.toISOString()])) } } };
  });
  let sentCount = 0;
  for (const { g, c, phone } of targets) {
    const link = `${APP_URL}#group=${g.id}`;
    try {
      // הקישור נכנס בפרמטר של שם הקבוצה, כי נוסח התבנית המאושרת לא כולל קישור
      await sendTemplate(wa, phone, "coach_attendance_reminder", [c.name, `${g.name} · ${link}`]);
      sentCount++;
      lines.push(`• ${g.name} — ${c.name}: נשלחה תזכורת ✓`);
    } catch (e) {
      lines.push(`• ${g.name} — ${c.name}: השליחה נכשלה, אפשר לשלוח בעצמך: ${waLink(phone, renderTemplate("coach_attendance_reminder", [c.name, g.name]) + `\n${link}`)}`);
    }
  }
  const text = lines.length ? await shortLinks(env, store, `⏰ *נוכחות שלא מולאה היום*:\n${lines.join("\n")}`) : "";
  if (text) {
    try {
      // ב-outbox כדי ששולה תוכל להראות את הקישורים שוב אם הסיכום יצא כתבנית קצרה (חלון 24 השעות סגור)
      await store.update("agentReports/bot", (cur) => ({ outbox: { ...outboxMap(cur.outbox), reminders: { at: now.toISOString(), text } } }));
      await notifyOwner(wa, { lastOwnerMsgAt: bot.lastOwnerMsgAt, text, template: "agent_alert", templateParam: `${lines.length} מאמנים לא מילאו נוכחות היום (${sentCount} קיבלו תזכורת). אפשר להשיב כדי לקבל את הפרטים` });
    } catch (e) {
      // מאמנים כבר קיבלו תזכורת — לא מבטלים את הסימון, אחרת הם יקבלו אותה שוב ברבע השעה הבאה
      if (sentCount) throw e;
      // אם גם הביטול נכשל — התזכורת של היום מתפספסת (ונרשמת שגיאה), אבל לא נשלחת שוב ושוב
      await store
        .update("agentReports/bot", (cur) => {
          if (cur.coachReminders?.date !== today) return null;
          const lastSentAt = { ...(cur.coachReminders.lastSentAt || {}) };
          ids.forEach((id) => delete lastSentAt[id]);
          return { coachReminders: { ...cur.coachReminders, groups: (cur.coachReminders.groups || []).filter((g) => !ids.includes(g)), lastSentAt } };
        })
        .catch((e2) => { e.message += ` (וגם ביטול הסימון נכשל: ${e2.message} — התזכורת לא תישלח שוב היום)`; });
      throw e;
    }
  }
  return text || "all marked";
}

// 📋 סיכום אימון למאמנים: 5 דקות אחרי סוף האימון (בפועל ברבע השעה הראשון אחרי), אם כבר מולאה נוכחות להיום.
// מי הגיע, מי לא, ועם מי צריך ליצור קשר (נעדר שעוד לא נשלחה עליו הודעה). מאמן שמילא באיחור — מקבל ברבע שאחרי המילוי.
// לא מולאה בכלל — remindCoaches למעלה מזכיר למאמן ומעדכן את הבעלים חצי שעה אחרי האימון.
// נשלח בתבנית club_message (מאושרת), ומזהה ההודעה נשמר ב-readWatch כדי שהבעלים יקבל "קרא" (readReceipts).
const SUMMARY_MIN = 5;
export async function coachSummaries(env, store, wa, now = new Date()) {
  const today = israelToday(now);
  const { dow, min } = israelNow(now);
  const bot = (await store.get("agentReports/bot")) || {};
  const done = bot.coachSummaries?.date === today ? bot.coachSummaries.groups : [];
  const groups = (await store.list("groups")).filter(
    (g) => !g.deleted && g.isActive !== false && Array.isArray(g.days) && g.days.includes(dow) && toMin(g.endTime) !== null && min >= toMin(g.endTime) + SUMMARY_MIN && !done.includes(g.id),
  );
  if (!groups.length) return "nothing due";
  const recs = await store.where("attendance", "date", today);
  const due = groups.filter((g) => recs.some((a) => a.groupId === g.id));
  if (!due.length) return "not marked yet";
  const [players, users, quiet] = await Promise.all([store.list("players"), store.list("users"), quietIds(store)]);
  const nameOf = (id) => (players.find((p) => p.id === id)?.name || "").trim() || "?";
  const ids = due.map((g) => g.id);
  // מסמנים לפני השליחה (כמו remindCoaches) — כישלון לא יגרום לסיכום כפול כל רבע שעה
  await store.update("agentReports/bot", (cur) => {
    const prev = cur.coachSummaries?.date === today ? cur.coachSummaries.groups || [] : [];
    return { coachSummaries: { date: today, groups: [...new Set([...prev, ...ids])] } };
  });
  const problems = [], watch = {}, out = [];
  for (const g of due) {
    const mine = recs.filter((a) => a.groupId === g.id);
    const here = mine.filter((a) => a.status === "Present").map((a) => nameOf(a.playerId));
    const away = mine.filter((a) => a.status === "Absent");
    const contact = away.filter((a) => !a.msgSentAt).map((a) => nameOf(a.playerId));
    const text = [
      `סיכום אימון ${g.name} היום: הגיעו ${here.length} מתוך ${mine.length}`,
      here.length && `הגיעו: ${here.join(", ")}`,
      away.length && `לא הגיעו: ${away.map((a) => nameOf(a.playerId)).join(", ")}`,
      contact.length ? `ליצור קשר: ${contact.join(", ")}` : away.length && "כל מי שלא הגיע כבר קיבל הודעה",
    ].filter(Boolean).join(" · ").slice(0, 900);
    for (const id of coachIds(g).filter((x) => !quiet.includes(x))) {
      const c = users.find((u) => u.id === id) || { name: "מאמן" };
      if (!isValidPhone(c.phone || "")) { problems.push(`• ${g.name} — ${c.name}: אין טלפון שמור`); continue; }
      try {
        const wamid = await sendTemplate(wa, normalizePhone(c.phone), "club_message", [text], "he", c.name);
        if (wamid) watch[wamid] = { who: c.name, what: `סיכום אימון ${g.name}`, at: now.toISOString() };
        out.push(`${g.name} — ${c.name} ✓`);
      } catch (e) {
        problems.push(`• ${g.name} — ${c.name}: השליחה נכשלה (${e.message})`);
      }
    }
  }
  if (Object.keys(watch).length) await watchReads(store, watch, now);
  if (out.length && !problems.length) {
    await notifyOwner(wa, { lastOwnerMsgAt: bot.lastOwnerMsgAt, text: `📋 שלחתי סיכום אימון למאמנים: ${out.join(", ")}`, template: "agent_alert", templateParam: `סיכום אימון נשלח: ${out.join(", ")}` });
  }
  if (problems.length) {
    const msg = `📋 *סיכום אימון למאמנים — לא נשלח לכולם*:\n${out.length ? `נשלח: ${out.join(", ")}\n` : ""}${problems.join("\n")}`;
    await store.update("agentReports/bot", (cur) => ({ outbox: { ...outboxMap(cur.outbox), summaries: { at: now.toISOString(), text: msg } } }));
    await notifyOwner(wa, { lastOwnerMsgAt: bot.lastOwnerMsgAt, text: msg, template: "agent_alert", templateParam: `סיכום אימון לא נשלח ל-${problems.length} מאמנים. אפשר להשיב כדי לקבל פרטים` });
  }
  return `summaries: ${out.join(", ") || "none"}${problems.length ? ` · problems: ${problems.length}` : ""}`;
}

// 👀 הודעות למאמנים שהבעלים רוצה לדעת מתי נקראו. נשמרות 7 ימים.
export async function watchReads(store, entries, now = new Date()) {
  const week = new Date(now.getTime() - 7 * 864e5).toISOString();
  await store.update("agentReports/bot", (cur) => ({
    readWatch: { ...Object.fromEntries(Object.entries(cur.readWatch || {}).filter(([, v]) => v?.at > week)), ...entries },
  }));
}

// Meta שולחת ב-webhook סטטוס "read" כשהנמען פתח את ההודעה (רק אם אישורי קריאה פעילים אצלו),
// ו-"failed" כשהודעה שכבר קיבלה ✓ (Meta קיבלה אותה) לא נמסרה בפועל.
// הודעה שבמעקב — הבעלים מקבל "✓✓ קרא" או "❌ לא נמסרה" עם הסיבה, והיא יוצאת מהמעקב (פעם אחת לכל הודעה).
const WHY = { 131049: "Meta עצרה את ההודעה (מגבלת הודעות שיווק לנמען)", 131026: "המספר לא יכול לקבל את ההודעה (אין וואטסאפ / גרסה ישנה / חסם)", 131030: "המספר לא ברשימת הנמענים המאושרים של שולה", 131047: "עברו 24 שעות מההודעה האחרונה שלו" };
export async function readReceipts(store, wa, statuses) {
  const st = Object.fromEntries(statuses.filter((s) => ["read", "failed", "delivered"].includes(s.status)).map((s) => [s.id, s]));
  const ids = Object.keys(st);
  if (!ids.length) return [];
  let hits = [];
  await store.update("agentReports/bot", (cur) => {
    const watch = { ...(cur.readWatch || {}) };
    const fails = statuses.filter((s) => s.status === "failed" && watch[s.id]);
    hits = [];
    for (const id of ids) {
      const w = watch[id];
      if (!w) continue;
      // "delivered" — רק נרשם. Meta שולחת לפעמים "failed" (131026) על הודעה שכבר הגיעה לטלפון (29.10, תזכורת הבוקר) — לא מתריעים עליה
      if (st[id].status === "delivered") watch[id] = { ...w, delivered: true };
      else {
        delete watch[id];
        if (!(st[id].status === "failed" && w.delivered)) hits.push({ ...w, s: st[id] });
      }
    }
    // הכישלון כמו ש-Meta שלחה אותו — כדי שאפשר יהיה לבדוק בדיעבד. 10 אחרונים
    const failLog = fails.length ? { failLog: [...(cur.failLog || []), ...fails.map((s) => ({ who: cur.readWatch[s.id].who, delivered: !!cur.readWatch[s.id].delivered, at: new Date().toISOString(), errors: s.errors || null }))].slice(-10) } : {};
    return { readWatch: watch, ...failLog };
  });
  if (!hits.length) return [];
  // נחסמה כתבנית → נשמרת בתור, ויוצאת כטקסט רגיל ברגע שהנמען כותב לשולה (חלון 24 שעות נפתח). 131026/131030 — זה לא יעזור
  const queued = hits.filter(({ s, phone, text }) => s.status === "failed" && phone && text && ![131026, 131030].includes(s.errors?.[0]?.code));
  if (queued.length)
    await store.update("agentReports/bot", (cur) => {
      const pend = { ...(cur.pendingDelivery || {}) };
      for (const { phone, who, text } of queued) pend[phone] = [...(pend[phone] || []), { who, text, at: new Date().toISOString() }].slice(-5);
      return { pendingDelivery: pend };
    });
  const bot = (await store.get("agentReports/bot")) || {};
  const text = hits
    .map((h) => {
      const { who, what, phone, s } = h;
      if (s.status === "read") return `✓✓ ${who} קרא/ה: ${what}`;
      const e = s.errors?.[0] || {};
      const later = queued.includes(h) ? `\n⏳ תישלח אליו אוטומטית ברגע שיכתוב משהו לשולה` : "";
      return `❌ ההודעה ל${who} לא נמסרה: ${what}\nסיבה: ${WHY[e.code] || e.error_data?.details || e.title || "לא ידוע"} (${e.code || "?"})${later}${phone ? `\nלשליחה ידנית: ${waLink(phone, h.text || "")}` : ""}`;
    })
    .join("\n");
  await notifyOwner(wa, { lastOwnerMsgAt: bot.lastOwnerMsgAt, text, template: "agent_alert", templateParam: text.replace(/\n/g, " · ") });
  return hits;
}

// כשמי שהודעה אליו נחסמה כותב לשולה — החלון פתוח, ההודעות מהתור יוצאות אליו כטקסט רגיל והבעלים מקבל ✅
// חלון 24 השעות של Meta: מאמן שכתב לשולה ב-23 השעות האחרונות מקבל טקסט רגיל, בלי תבנית —
// כך לא חלה עליו מגבלת הודעות השיווק (131049). אחרת — תבנית כרגיל.
const DAY = 23 * 3600 * 1000;
export async function staffSend(store, wa, { phone, name, uid }, text, param = text) {
  let last = ((await store.get("agentReports/bot")) || {}).lastInbound?.[phone];
  if (!last && uid) last = (((await store.get(`agentReports/coach_${uid}`)) || {}).history || []).filter((h) => h.role === "user").at(-1)?.at;
  if (last && Date.now() - new Date(last).getTime() < DAY) return sendText(wa, phone, text);
  return sendTemplate(wa, phone, "club_message", [param], "he", name);
}

// נרשם כשמאמן כותב לשולה (route ב-index.js). רק יומיים אחרונים נשמרים
export const noteInbound = (store, phone, now = new Date()) =>
  store.update("agentReports/bot", (cur) => ({
    lastInbound: { ...Object.fromEntries(Object.entries(cur.lastInbound || {}).filter(([, at]) => now - new Date(at) < 2 * DAY)), [phone]: now.toISOString() },
  }));

export async function flushPending(store, wa, phone) {
  let list = [];
  await store.update("agentReports/bot", (cur) => {
    list = cur.pendingDelivery?.[phone] || [];
    if (!list.length) return null;
    const { [phone]: _, ...rest } = cur.pendingDelivery;
    return { pendingDelivery: rest };
  });
  if (!list.length) return [];
  const done = [], back = [];
  for (const m of list) {
    try { await sendText(wa, phone, m.text); done.push(m); } catch { back.push(m); }
  }
  // שליחה שנכשלה — חוזרת לתור לפעם הבאה שיכתוב
  if (back.length) await store.update("agentReports/bot", (cur) => ({ pendingDelivery: { ...(cur.pendingDelivery || {}), [phone]: [...back, ...(cur.pendingDelivery?.[phone] || [])] } }));
  if (done.length) {
    const bot = (await store.get("agentReports/bot")) || {};
    const text = done.map((m) => `✅ ההודעה ל${m.who} נמסרה עכשיו: "${m.text.replace(/\s+/g, " ").slice(0, 40)}"`).join("\n");
    await notifyOwner(wa, { lastOwnerMsgAt: bot.lastOwnerMsgAt, text, template: "agent_alert", templateParam: text.replace(/\n/g, " · ") }).catch(() => {});
  }
  return done;
}

// ☀️ בוקר טוב למאמנים: ביום אימון, מ-08:00 (ברבע השעה הראשון אחרי), כל מאמן מקבל הודעה קלילה עם הקבוצות והשעות שלו להיום.
// Gemini מנסח כל יום מחדש; אם הוא לא עונה — נוסח קבוע, כדי שהתזכורת תגיע בכל מקרה. פעם אחת ביום (מסומן לפני השליחה).
const MORNING_MIN = 8 * 60;
export async function morningGreetings(env, store, wa, gemini, now = new Date()) {
  const today = israelToday(now);
  const { dow, min } = israelNow(now);
  if (min < MORNING_MIN) return "too early";
  const claimed = await store.update("agentReports/bot", (cur) => (cur.morningGreetings === today ? null : { morningGreetings: today }));
  if (!claimed) return "done today";
  const [groups, users, cancellations, quiet] = await Promise.all([store.list("groups"), store.list("users"), store.where("cancellations", "date", today), quietIds(store)]);
  const todays = groups
    .filter((g) => !g.deleted && g.isActive !== false && Array.isArray(g.days) && g.days.includes(dow) && !cancellations.some((c) => c.groupId === g.id))
    .sort((a, b) => String(a.startTime || "").localeCompare(String(b.startTime || "")));
  const byCoach = new Map();
  for (const g of todays) for (const id of coachIds(g).filter((x) => !quiet.includes(x))) byCoach.set(id, [...(byCoach.get(id) || []), g]);
  const out = [], watch = {};
  for (const [id, gs] of byCoach) {
    const c = users.find((u) => u.id === id);
    if (!c || !isValidPhone(c.phone || "")) { out.push(`${c?.name || "מאמן"}: אין טלפון שמור`); continue; }
    const first = String(c.name || "").trim().split(/\s+/)[0] || "";
    const plan = gs.map((g) => `${g.name}${g.startTime ? ` ב-${g.startTime}` : ""}`).join(", ");
    const fallback = `בוקר טוב ${first}! ☀️ תזכורת: היום יש אימון — ${plan}. שיהיה יום מעולה 🏓`;
    let text = fallback;
    try {
      const parts = await gemini(env, {
        contents: [{ role: "user", parts: [{ text: `כתבי הודעת בוקר טוב קצרה (עד 2 משפטים, שורה אחת, בלי ירידות שורה) למאמן טניס שולחן בשם ${first}, בעברית, בטון חברי, קליל ומגניב, עם אימוג'י אחד או שניים. היא חייבת להזכיר שהיום יש אימון: ${plan}. כל פעם ניסוח אחר לגמרי (היום ${today}). להחזיר רק את ההודעה.` }] }],
        generationConfig: { temperature: 1.2, maxOutputTokens: 200 },
      });
      const t = parts.map((p) => p.text || "").join("").replace(/\s+/g, " ").trim();
      // השעות והקבוצות חייבות להופיע כמו שהן — אחרת נוסח קבוע (שלא תישלח שעה שגויה)
      if (t && t.length < 400 && gs.every((g) => t.includes(g.name) && (!g.startTime || t.includes(g.startTime)))) text = t;
    } catch {}
    try {
      const wamid = await sendTemplate(wa, normalizePhone(c.phone), "club_message", [text], "he", c.name);
      if (wamid) watch[wamid] = { who: c.name, what: "תזכורת הבוקר לאימון", at: now.toISOString() };
      out.push(`${c.name} ✓`);
    } catch (e) {
      out.push(`${c.name}: נכשל (${e.message})`);
    }
  }
  if (Object.keys(watch).length) await watchReads(store, watch, now);
  // הבעלים רוצה לדעת בכל פעם שהתזכורת יצאה, ולמי
  if (out.length) {
    const bot = (await store.get("agentReports/bot")) || {};
    const list = out.join(", ");
    await notifyOwner(wa, { lastOwnerMsgAt: bot.lastOwnerMsgAt, text: `☀️ שלחתי את תזכורת הבוקר לאימון: ${list}`, template: "agent_alert", templateParam: `תזכורת הבוקר לאימון נשלחה: ${list}` });
  }
  return `morning: ${out.join(", ") || "no coaches today"}`;
}

// 📨 הודעות היעדרות שהמאמן עוד לא שלח להורים (18.10, שולה: "שיציק להם עד שישלחו"): כל בוקר מ-10:00, חוץ משבת,
// כל מאמן שיש בקבוצות שלו הודעות כאלה מקבל תזכורת עם המספר וקישור לרשימה — עד שהרשימה שלו מתרוקנת.
// אותה רשימה כמו במסך המאמן (analyze ← pendingAbsenceMsgs/absenceAlerts). פעם אחת ביום (מסומן לפני השליחה).
// כבוי עד ששולה מאשרת את הנוסח: PARENT_MSG_NAG = "on" ב-wrangler.toml.
const NAG_MIN = 10 * 60;
export async function parentMsgNag(env, store, wa, now = new Date()) {
  if (env.PARENT_MSG_NAG !== "on") return "nag off";
  const today = israelToday(now);
  const { dow, min } = israelNow(now);
  if (dow === 6 || min < NAG_MIN) return "not now";
  const claimed = await store.update("agentReports/bot", (cur) => (cur.parentMsgNag === today ? null : { parentMsgNag: today }));
  if (!claimed) return "done today";
  // shortcut: קורא את כל הנוכחות פעם ביום; כשהעונה תגדל מאוד — שאילתת טווח תאריכים (8 שבועות אחורה)
  const [players, groups, users, attendance, cancellations, quiet] = await Promise.all([store.list("players"), store.list("groups"), store.list("users"), store.list("attendance"), store.list("cancellations"), quietIds(store)]);
  const { pending, atRisk } = analyze({ players, groups, attendance, cancellations, today });
  // ⚠️ סכנת נשירה גבוהה (22.10, שולה: "שיוריד למאמנים התראות על נשירה, בשפה ברורה"): כל שחקן לכל היותר פעם בשבוע
  const riskSent = ((await store.get("agentReports/coaches")) || {}).riskSent || {};
  const riskBy = new Map();
  for (const x of atRisk) {
    if (x.level !== "high" || (riskSent[x.playerId] && riskSent[x.playerId] > addDays(today, -7))) continue;
    const g = groups.find((v) => v.id === players.find((p) => p.id === x.playerId)?.groupId);
    if (!g || g.deleted || g.isActive === false) continue;
    for (const id of coachIds(g).filter((c) => !quiet.includes(c))) riskBy.set(id, [...(riskBy.get(id) || []), x]);
  }
  const byCoach = new Map();
  for (const x of pending) {
    const g = groups.find((v) => v.id === x.groupId);
    if (!g || g.deleted || g.isActive === false) continue;
    for (const id of coachIds(g).filter((c) => !quiet.includes(c))) {
      const m = byCoach.get(id) || new Map();
      byCoach.set(id, m.set(g, (m.get(g) || 0) + 1));
    }
  }
  const out = [], watch = {}, riskDone = {};
  for (const id of new Set([...byCoach.keys(), ...riskBy.keys()])) {
    const gs = byCoach.get(id) || new Map();
    const risk = (riskBy.get(id) || []).slice(0, 5);
    const c = users.find((u) => u.id === id);
    if (!c || !isValidPhone(c.phone || "")) { out.push(`${c?.name || "מאמן"}: אין טלפון שמור`); continue; }
    const n = [...gs.values()].reduce((a, b) => a + b, 0);
    const first = String(c.name || "").trim().split(/\s+/)[0] || "";
    const link = gs.size === 1 ? `${APP_URL}#group=${[...gs.keys()][0].id}` : APP_URL;
    // תבנית Meta: שורה אחת, בלי ירידות שורה
    const parts = [];
    if (n) parts.push(`${n === 1 ? "יש הודעת היעדרות אחת" : `יש ${n} הודעות היעדרות`} שעוד לא נשלחו (${[...gs.keys()].map((g) => g.name).join(", ")}). אפשר לשלוח מכאן בלחיצה: ${link}`);
    if (risk.length)
      parts.push(`⚠️ ${risk.length === 1 ? "שחקן שכדאי לבדוק מה שלומו" : "שחקנים שכדאי לבדוק מה שלומם"}: ${risk.map((x) => `${x.playerName} (${x.groupName}) — ${x.reason}`).join(" · ")}. ${risk.every((x) => x.adult) ? "כדאי להתקשר ולשאול אם הכל בסדר" : risk.some((x) => x.adult) ? "כדאי להתקשר (לבוגרים ישירות, לילדים להורים) ולשאול אם הכל בסדר" : "כדאי להתקשר להורים ולשאול אם הכל בסדר"}, ולספר לשחר מה עלה.`);
    const text = `בוקר טוב ${first}, ${parts.join(" ")}`;
    try {
      const wamid = await sendTemplate(wa, normalizePhone(c.phone), "club_message", [text], "he", c.name);
      if (wamid) watch[wamid] = { who: c.name, what: n ? "תזכורת הודעות היעדרות" : "התראת נשירה", at: now.toISOString() };
      risk.forEach((x) => (riskDone[x.playerId] = today));
      out.push(`${c.name} (${[n && `${n} הודעות`, risk.length && `${risk.length} בסכנת נשירה`].filter(Boolean).join(", ")}) ✓`);
    } catch (e) {
      out.push(`${c.name}: נכשל (${e.message})`);
    }
  }
  if (Object.keys(watch).length) await watchReads(store, watch, now);
  if (Object.keys(riskDone).length) await store.update("agentReports/coaches", (cur) => ({ riskSent: { ...(cur.riskSent || {}), ...riskDone } }));
  if (out.length) {
    const bot = (await store.get("agentReports/bot")) || {};
    const list = out.join(", ");
    await notifyOwner(wa, { lastOwnerMsgAt: bot.lastOwnerMsgAt, text: `📨 תזכורת למאמנים על הודעות היעדרות ונשירה: ${list}`, template: "agent_alert", templateParam: `תזכורת הודעות היעדרות למאמנים: ${list}` });
  }
  return `nag: ${out.join(", ") || "nothing pending"}`;
}

// 🆕 ילדים בניסיון (players.trial) — פעם ביום מ-10:00, חוץ משבת.
// מי שהגיע פעמיים: שולה נשאלת פעם אחת "להשאיר קבוע?" ועונה לבוט (הכלי trial_decision, לפי המספר ברשימה).
// מי שלא הגיע 21 יום (מאז האימון האחרון, או מההצטרפות אם עוד לא הגיע) — יוצא מהרשימה לבד, וההיסטוריה נשמרת.
const TRIAL_DROP_DAYS = 21;
export async function trialCheck(store, wa, now = new Date()) {
  const today = israelToday(now);
  const { dow, min } = israelNow(now);
  if (dow === 6 || min < NAG_MIN) return "not now";
  const claimed = await store.update("agentReports/bot", (cur) => (cur.trialCheck === today ? null : { trialCheck: today }));
  if (!claimed) return "done today";
  const trials = (await store.list("players")).filter((p) => p.trial && p.isActive && !p.deleted);
  if (!trials.length) return "trials: 0";
  const [groups, attendance, bot] = await Promise.all([store.list("groups"), store.list("attendance"), store.get("agentReports/bot")]);
  const items = bot?.trialAsk?.items || [];
  const fresh = [], dropped = [], dropIds = new Set();
  for (const p of trials) {
    const came = attendance.filter((a) => a.playerId === p.id && a.status === "Present").map((a) => a.date).sort();
    const since = came.at(-1) || String(p.joinDate || "").slice(0, 10) || today;
    const label = `${(p.name || "").trim()} (${groups.find((g) => g.id === p.groupId)?.name || ""})`;
    if (addDays(since, TRIAL_DROP_DAYS) <= today) {
      await store.merge(`players/${p.id}`, { isActive: false, endDate: today });
      dropped.push(label);
      dropIds.add(p.id);
    } else if (came.length >= 2 && !items.some((x) => x.id === p.id)) {
      fresh.push({ n: Math.max(0, ...items.map((x) => x.n), ...fresh.map((x) => x.n)) + 1, id: p.id, label, visits: came.length });
    }
  }
  if (fresh.length || dropIds.size)
    await store.update("agentReports/bot", (cur) => ({ trialAsk: { items: [...(cur.trialAsk?.items || []), ...fresh].filter((x) => !dropIds.has(x.id)) } }));
  const lines = [
    ...(fresh.length ? ["🆕 *ילדים בניסיון שחזרו* — להשאיר קבועים? אפשר לענות למשל \"כן ל-1\" או \"לא ל-2\":", ...fresh.map((x) => `${x.n}. ${x.label} — ${x.visits} אימונים`)] : []),
    ...(dropped.length ? [`👋 יצאו מהרשימה (לא הגיעו ${TRIAL_DROP_DAYS} יום): ${dropped.join(", ")}`] : []),
  ];
  if (lines.length) {
    const text = lines.join("\n");
    await notifyOwner(wa, { lastOwnerMsgAt: bot?.lastOwnerMsgAt, text, template: "agent_alert", templateParam: text.replace(/\s+/g, " ").slice(0, 400) });
  }
  return `trials: ask ${fresh.length}, dropped ${dropped.length}`;
}

// 📎 קישורי היעדרות שהוכנו לבעלים ולא קיבלו "שלחתי" (23.10: ליאור ועמית נשארו תלויים כל היום).
// תזכורת אחת, שעתיים אחרי ההכנה, בין 09:00 ל-21:00. אחרי זה שקט — לא מציקים.
const LINKS_NAG_MS = 2 * 3600 * 1000;
export async function absenceLinksNag(store, wa, now = new Date()) {
  const { min } = israelNow(now);
  if (min < 9 * 60 || min > 21 * 60) return "not now";
  let items = [], lastOwnerMsgAt;
  await store.update("agentReports/bot", (cur) => {
    const l = cur.absenceLinks;
    if (!l?.items?.length || l.nagged || now - Date.parse(l.at || 0) < LINKS_NAG_MS) return null;
    items = l.items;
    lastOwnerMsgAt = cur.lastOwnerMsgAt;
    return { absenceLinks: { ...l, nagged: now.toISOString() } };
  });
  if (!items.length) return "links: 0";
  const text = `📎 הכנתי קישורים להודעות היעדרות ל${items.map((x) => `${x.n}. ${x.playerName}`).join(", ")} ועוד לא כתבת "שלחתי".\nשלחת? לכתוב "שלחתי". לא צריך? לכתוב "דלג על ${items.map((x) => x.n).join(",")}".`;
  await store.update("agentReports/bot", (cur) => ({ outbox: { ...outboxMap(cur.outbox), "absence-links": { at: now.toISOString(), text } } }));
  await notifyOwner(wa, { lastOwnerMsgAt, text, template: "agent_alert", templateParam: text.replace(/\s+/g, " ").slice(0, 400) });
  return `links nag: ${items.length}`;
}
