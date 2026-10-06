// ⚡ "תריץ עכשיו" בלי לחכות ל-cron של GitHub (שמתעכב לפעמים בעשרות דקות): כל רבע שעה ה-worker בודק אם יש
// בקשה ממתינה, ואם כן מפעיל את ה-workflow ב-workflow_dispatch. פועל רק אם הוגדר הסוד GH_DISPATCH_TOKEN
// (טוקן GitHub עם הרשאת Actions: write לריפו הזה בלבד). בלי הסוד — לא עושה כלום, והבדיקות הקבועות ב-GitHub
// (כל 10/15 דקות) ממשיכות כרגיל.
//   agents.yml        — בקשות מהבוט (agentReports/bot.requests, run_agent_now): input agent לכל סוכן
//   sync-payments.yml — "רענון עכשיו" באפליקציה (system/paymentSyncRequest ממתין)
//   admin-tools.yml   — משימות ניהול ממתינות (adminTasks עם status=pending)
const ALLOWED = new Set(["scan", "bugcheck", "ideas", "supervisor", "content"]);

async function dispatch(env, workflow, inputs) {
  const repo = env.GH_REPO || "shahar1987/ttc-mvh-attendance";
  const r = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`, {
    method: "POST",
    headers: { authorization: `Bearer ${env.GH_DISPATCH_TOKEN}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", "user-agent": "shula-whatsapp-worker", "content-type": "application/json" },
    body: JSON.stringify({ ref: env.GH_REF || "main", ...(inputs ? { inputs } : {}) }),
  });
  if (r.status !== 204 && !r.ok) throw new Error(`GitHub dispatch ${workflow}: ${r.status}`);
}

export async function dispatchWorkflows(env, store) {
  if (!env.GH_DISPATCH_TOKEN) return "no token";
  const done = [];
  const errors = [];

  // 1. בקשות "תריץ עכשיו" מהבוט — קודם לוקחים אותן מהתור (כתיבה מותנית, כמו requests.mjs), כדי שבדיקת
  //    ה-10 דקות ב-GitHub לא תריץ אותן שוב. מה שנכשל בהפעלה חוזר לתור.
  let taken = [];
  await store.update("agentReports/bot", (bot) => {
    taken = [...new Set((bot.requests || []).filter((r) => ALLOWED.has(r)))];
    return taken.length ? { requests: [] } : null;
  });
  const failed = [];
  for (const agent of taken) {
    try {
      await dispatch(env, "agents.yml", { agent });
      done.push(`agents:${agent}`);
    } catch (e) {
      failed.push(agent);
      errors.push(e.message);
    }
  }
  if (failed.length) await store.update("agentReports/bot", (bot) => ({ requests: [...new Set([...(bot.requests || []), ...failed])] }));

  const bot = (await store.get("agentReports/bot")) || {};
  const sent = bot.dispatched || {};
  const mark = {};

  // 2. רענון התשלומים — פעם אחת לכל בקשה (לפי requestedAt)
  try {
    const req = await store.get("system/paymentSyncRequest");
    const pending = req && req.requestedAt && (!req.handledAt || req.handledAt < req.requestedAt);
    if (pending && sent.payments !== req.requestedAt) {
      await dispatch(env, "sync-payments.yml");
      mark.payments = req.requestedAt;
      done.push("sync-payments");
    }
  } catch (e) {
    errors.push(e.message);
  }

  // 3. משימות ניהול חשבונות — פעם אחת לכל קבוצת משימות ממתינות
  try {
    const ids = (await store.where("adminTasks", "status", "pending")).map((t) => t.id).sort().join(",");
    if (ids && sent.admin !== ids) {
      await dispatch(env, "admin-tools.yml");
      mark.admin = ids;
      done.push("admin-tools");
    }
  } catch (e) {
    errors.push(e.message);
  }

  if (Object.keys(mark).length) await store.update("agentReports/bot", (cur) => ({ dispatched: { ...(cur.dispatched || {}), ...mark } }));
  if (errors.length) throw new Error(errors.join(" · "));
  return done.join(",") || "nothing pending";
}

// ❌ ריצות שנכשלו ב-GitHub — נבדק כאן כל רבע שעה, כי GitHub מדלג על רוב הריצות המתוזמנות של המפקח השעתי.
// הריפו ציבורי, אז אין צורך בטוקן (אם יש GH_DISPATCH_TOKEN — משתמשים בו בשביל מכסת בקשות גבוהה יותר).
// מחזיר שורה לכל ריצה שעוד לא דווחה, ואת כל הריצות שנכשלו ב-6 השעות האחרונות (ids) לסימון אחרי השליחה.
export async function failedRuns(env, store) {
  const repo = env.GH_REPO || "shahar1987/ttc-mvh-attendance";
  const since = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
  const r = await fetch(`https://api.github.com/repos/${repo}/actions/runs?status=failure&per_page=50&created=>=${since}`, {
    headers: { accept: "application/vnd.github+json", "user-agent": "shula-whatsapp-worker", ...(env.GH_DISPATCH_TOKEN ? { authorization: `Bearer ${env.GH_DISPATCH_TOKEN}` } : {}) },
  });
  if (r.status === 403 || r.status === 429) return { lines: [], ids: null }; // מכסה — ננסה ברבע השעה הבא
  if (!r.ok) throw new Error(`GitHub runs: ${r.status}`);
  const runs = (await r.json()).workflow_runs || [];
  const seen = new Set(((await store.get("agentReports/bot")) || {}).reportedRuns || []);
  const fresh = runs.filter((x) => !seen.has(x.id));
  return { lines: fresh.map((x) => `• ${x.name}: ${x.html_url}`), ids: fresh.length ? runs.map((x) => x.id) : null };
}
