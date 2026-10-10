// ⏰ תזכורת למאמנים שלא מילאו נוכחות — רץ כל רבע שעה (wrangler.toml → triggers).
// קבוצה שהתאמנה היום (groups.days), שהאימון שלה נגמר לפני חצי שעה לפחות, ואין לה אף רשומת נוכחות להיום:
// הבוט שולח לכל מאמן שלה את התבנית coach_attendance_reminder עם קישור שפותח ישר את הקבוצה, והבעלים מקבל סיכום.
// מאמן שהשליחה אליו נכשלה (למשל התבנית לא אושרה) — הבעלים מקבל עבורו קישור wa.me כמו פעם, ושולח בעצמו.
import { addDays, israelToday, normalizePhone, isValidPhone } from "../../agents/lib/analysis.mjs";
import { waLink, notifyOwner, sendTemplate } from "../../agents/lib/whatsapp.mjs";
import { renderTemplate } from "../../agents/templates.mjs";
import { outboxMap } from "./queue.js";

const GRACE_MIN = 30;
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

export async function remindCoaches(env, store, wa, now = new Date()) {
  const today = israelToday(now);
  const { dow, min } = israelNow(now);
  const bot = (await store.get("agentReports/bot")) || {};
  const done = bot.coachReminders?.date === today ? bot.coachReminders.groups : [];
  const groups = (await store.list("groups")).filter(
    (g) => !g.deleted && g.isActive !== false && Array.isArray(g.days) && g.days.includes(dow) && toMin(g.endTime) !== null && min >= toMin(g.endTime) + GRACE_MIN && !done.includes(g.id),
  );
  if (!groups.length) return "nothing due";

  const [players, users, recs] = await Promise.all([store.list("players"), store.list("users"), store.where("attendance", "date", today)]);
  const marked = new Set(recs.map((a) => a.groupId));
  const lines = [];
  const targets = [];
  for (const g of groups) {
    const hasPlayers = players.some((p) => p.groupId === g.id && p.isActive && !p.deleted);
    if (!hasPlayers || marked.has(g.id)) continue;
    for (const id of coachIds(g)) {
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

// 🧪 בדיקה חד-פעמית ששולה ביקשה ואישרה (10.10.2026): רצה ב-cron הראשון אחרי הפריסה ולא חוזרת (הסימון
// coachReminderTest נכתב בכתיבה מותנית *לפני* השליחה). לכל קבוצה פעילה — האימון האחרון בשבוע האחרון (לא היום).
// אם אין לו נוכחות וגם לא בוטל, המאמנים מקבלים את התבנית עם "בדיקה בלבד" ליד שם הקבוצה, ושולה מקבלת סיכום.
// shortcut: קוד חד-פעמי, למחוק אחרי שרץ.
const TEST_ID = "2026-10-10";
export async function coachReminderTest(env, store, wa, now = new Date()) {
  const claimed = await store.update("agentReports/bot", (cur) => (cur.coachReminderTest === TEST_ID ? null : { coachReminderTest: TEST_ID }));
  if (!claimed) return "test done";
  const bot = (await store.get("agentReports/bot")) || {};
  const today = israelToday(now);
  const [groups, users, players, cancellations] = await Promise.all([store.list("groups"), store.list("users"), store.list("players"), store.list("cancellations")]);
  const lastTraining = (g) => {
    for (let i = 1; i <= 6; i++) {
      const d = addDays(today, -i);
      if (g.days.includes(new Date(d + "T12:00:00Z").getUTCDay())) return d;
    }
    return null;
  };
  const due = groups
    .filter((g) => !g.deleted && g.isActive !== false && Array.isArray(g.days) && players.some((p) => p.groupId === g.id && p.isActive && !p.deleted))
    .map((g) => ({ g, d: lastTraining(g) }))
    .filter(({ g, d }) => d && !cancellations.some((c) => c.groupId === g.id && c.date === d));
  const recs = (await Promise.all([...new Set(due.map((x) => x.d))].map((d) => store.where("attendance", "date", d)))).flat();
  const lines = [];
  let sentCount = 0;
  for (const { g, d } of due) {
    if (recs.some((a) => a.groupId === g.id && a.date === d)) continue;
    for (const id of coachIds(g)) {
      const c = users.find((u) => u.id === id) || { name: "מאמן" };
      if (!isValidPhone(c.phone || "")) {
        lines.push(`• ${g.name} (${d}) — ${c.name}: אין טלפון שמור`);
        continue;
      }
      try {
        await sendTemplate(wa, normalizePhone(c.phone), "coach_attendance_reminder", [c.name, `${g.name} (בדיקה בלבד, אין צורך לעשות כלום) · ${APP_URL}#group=${g.id}`]);
        sentCount++;
        lines.push(`• ${g.name} (${d}) — ${c.name}: נשלחה ✓`);
      } catch (e) {
        lines.push(`• ${g.name} (${d}) — ${c.name}: נכשלה (${e.message})`);
      }
    }
  }
  const text = lines.length
    ? `🧪 *בדיקת תזכורת למאמנים* (אימון אחרון בשבוע האחרון שלא מולא):\n${lines.join("\n")}`
    : "🧪 בדיקת תזכורת למאמנים: כל האימונים של השבוע האחרון מולאו, אין למי לשלוח.";
  await store.update("agentReports/bot", (cur) => ({ outbox: { ...outboxMap(cur.outbox), "coach-test": { at: now.toISOString(), text } } }));
  await notifyOwner(wa, { lastOwnerMsgAt: bot.lastOwnerMsgAt, text, template: "agent_alert", templateParam: `בדיקת תזכורת למאמנים: ${sentCount} נשלחו. אפשר להשיב כדי לקבל פרטים` });
  return text;
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
  const [players, users] = await Promise.all([store.list("players"), store.list("users")]);
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
    for (const id of coachIds(g)) {
      const c = users.find((u) => u.id === id) || { name: "מאמן" };
      if (!isValidPhone(c.phone || "")) { problems.push(`• ${g.name} — ${c.name}: אין טלפון שמור`); continue; }
      try {
        const wamid = await sendTemplate(wa, normalizePhone(c.phone), "club_message", [text]);
        if (wamid) watch[wamid] = { who: c.name, what: `סיכום אימון ${g.name}`, at: now.toISOString() };
        out.push(`${g.name} — ${c.name} ✓`);
      } catch (e) {
        problems.push(`• ${g.name} — ${c.name}: השליחה נכשלה (${e.message})`);
      }
    }
  }
  if (Object.keys(watch).length) await watchReads(store, watch, now);
  if (problems.length) {
    const msg = `📋 *סיכום אימון למאמנים — לא נשלח לכולם*:\n${problems.join("\n")}`;
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

// Meta שולחת ב-webhook סטטוס "read" כשהנמען פתח את ההודעה (רק אם אישורי קריאה פעילים אצלו).
// הודעה שבמעקב — הבעלים מקבל "✓✓ קרא", והיא יוצאת מהמעקב (פעם אחת לכל הודעה).
export async function readReceipts(store, wa, statuses) {
  const ids = statuses.filter((s) => s.status === "read").map((s) => s.id);
  if (!ids.length) return [];
  let hits = [];
  await store.update("agentReports/bot", (cur) => {
    hits = ids.map((id) => cur.readWatch?.[id]).filter(Boolean);
    if (!hits.length) return null;
    return { readWatch: Object.fromEntries(Object.entries(cur.readWatch).filter(([id]) => !ids.includes(id))) };
  });
  if (!hits.length) return [];
  const bot = (await store.get("agentReports/bot")) || {};
  const text = hits.map((h) => `✓✓ ${h.who} קרא/ה: ${h.what}`).join("\n");
  await notifyOwner(wa, { lastOwnerMsgAt: bot.lastOwnerMsgAt, text, template: "agent_alert", templateParam: text.replace(/\n/g, " · ") });
  return hits;
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
  const [groups, users, cancellations] = await Promise.all([store.list("groups"), store.list("users"), store.where("cancellations", "date", today)]);
  const todays = groups
    .filter((g) => !g.deleted && g.isActive !== false && Array.isArray(g.days) && g.days.includes(dow) && !cancellations.some((c) => c.groupId === g.id))
    .sort((a, b) => String(a.startTime || "").localeCompare(String(b.startTime || "")));
  const byCoach = new Map();
  for (const g of todays) for (const id of coachIds(g)) byCoach.set(id, [...(byCoach.get(id) || []), g]);
  const out = [], watch = {};
  for (const [id, gs] of byCoach) {
    const c = users.find((u) => u.id === id);
    if (!c || !isValidPhone(c.phone || "")) continue;
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
      const wamid = await sendTemplate(wa, normalizePhone(c.phone), "club_message", [text]);
      if (wamid) watch[wamid] = { who: c.name, what: "תזכורת הבוקר לאימון", at: now.toISOString() };
      out.push(`${c.name} ✓`);
    } catch (e) {
      out.push(`${c.name}: נכשל (${e.message})`);
    }
  }
  if (Object.keys(watch).length) await watchReads(store, watch, now);
  return `morning: ${out.join(", ") || "no coaches today"}`;
}
