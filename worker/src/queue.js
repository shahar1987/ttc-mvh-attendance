// תור במסמך Firestore (מערך של פריטים עם id) שה-cron מרוקן: תופסים פריטים בכתיבה מותנית, מטפלים,
// ומוציאים מהתור רק את מה שהצליח. מה שנכשל נשאר עם מונה ניסיונות, ואחרי maxAttempts יוצא עם שגיאה.
// כך הודעה לא הולכת לאיבוד כשהשליחה נכשלת, ושתי ריצות cron במקביל לא שולחות את אותו פריט פעמיים.
export const keyOf = (x) => x.id || `${x.at || ""}|${x.from || ""}|${String(x.text || "").slice(0, 60)}`;

export async function drainQueue(store, path, field, { due = () => true, run, maxAttempts = 5, now = new Date() }) {
  const stamp = now.toISOString();
  const staleBefore = new Date(now.getTime() - 30 * 60 * 1000).toISOString(); // תפיסה של ריצה שנפלה באמצע
  let claimed = [];
  await store.update(path, (cur) => {
    const list = Array.isArray(cur[field]) ? cur[field] : [];
    claimed = list.filter((x) => x && due(x) && !(x.claimedAt && x.claimedAt > staleBefore));
    if (!claimed.length) return null;
    const ids = new Set(claimed.map(keyOf));
    return { [field]: list.map((x) => (x && ids.has(keyOf(x)) ? { ...x, claimedAt: stamp } : x)) };
  });
  if (!claimed.length) return { done: [], dropped: [] };

  let ok = new Set();
  let error = null;
  try {
    ok = new Set(await run(claimed));
  } catch (e) {
    error = e;
  }
  const dropped = [];
  const done = claimed.filter((x) => ok.has(keyOf(x)));
  if (!error && done.length < claimed.length) error = new Error(`${claimed.length - done.length} פריטים ב-${field} לא נשלחו`);
  await store.update(path, (cur) => {
    dropped.length = 0;
    const list = Array.isArray(cur[field]) ? cur[field] : [];
    const next = [];
    for (const x of list) {
      if (!x || x.claimedAt !== stamp) {
        next.push(x);
        continue;
      }
      if (ok.has(keyOf(x))) continue;
      const { claimedAt, ...rest } = x;
      const attempts = (x.attempts || 0) + 1;
      if (attempts >= maxAttempts) dropped.push(x);
      else next.push({ ...rest, attempts });
    }
    return { [field]: next };
  });
  if (error || dropped.length) {
    const msg = [error && String(error.message || error), dropped.length && `${dropped.length} פריטים ב-${field} נזרקו אחרי ${maxAttempts} ניסיונות`].filter(Boolean).join(" · ");
    const e = new Error(msg);
    e.done = done;
    throw e;
  }
  return { done, dropped };
}

// agentReports/bot.outbox הוא מפה { <סוכן>: {at, text, how} } — ההודעה האחרונה מכל סוכן, להקשר כשהבעלים עונה.
// אם בטעות נכתב שם מערך, מתייחסים אליו כאל מפה ריקה (התוכן עצמו עובר ל-outboxQueue, ראו index.js).
export const outboxMap = (o) => (o && typeof o === "object" && !Array.isArray(o) ? o : {});
