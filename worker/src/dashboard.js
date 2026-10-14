// 📊 דשבורד פרסום: דף פרטי (קישור חתום, בלי התחברות) שמציג את מה שסוכן הנתונים (agents/insights.mjs) אסף
// מ-Meta הלילה: עוקבים, פוסטים מתוזמנים בפייסבוק, פוסט שמחכה ל"כן", חשיפה לכל פוסט וממוצע לפי סוג.
// קריאה בלבד: לא נוגע ב-Meta ולא בשום מסמך. מספר שלא ידוע מוצג "לא זמין", אף פעם לא 0.
import { sign } from "./google.js";

const TZ = "Asia/Jerusalem";
const STALE_MS = 36 * 3600 * 1000; // הסוכן רץ כל לילה; יותר מיום וחצי בלי עדכון = משהו נתקע
const TYPE = { photo: "תמונה", image: "תמונה", video: "סרטון", reels: "ריל", album: "אלבום", text: "טקסט", link: "קישור", carousel_album: "אלבום", share: "שיתוף" };
const NET = { facebook: "פייסבוק", instagram: "אינסטגרם" };

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fmt = (n) => (n == null ? "לא זמין" : Number(n).toLocaleString("he-IL"));
const when = (iso) => new Date(iso).toLocaleString("he-IL", { timeZone: TZ, weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
const day = (iso) => new Date(iso).toLocaleDateString("he-IL", { timeZone: TZ, day: "numeric", month: "numeric" });
const title = (t) => esc((t || "(בלי טקסט)").split("\n")[0].slice(0, 60));
const avg = (xs) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null);

export const dashboardUrl = async (env, origin) => `${origin}/dashboard?t=${await sign(env, "dashboard")}`;

export async function dashboardRoute(req, env, store) {
  const url = new URL(req.url);
  if (url.searchParams.get("t") !== (await sign(env, "dashboard"))) return new Response("forbidden", { status: 403 });
  const [insights, bot] = await Promise.all([store.get("agentReports/insights"), store.get("agentReports/bot")]);
  return new Response(dashboardHtml(insights || {}, bot?.pending?.post || null), {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" },
  });
}

function bars(rows, cls = "") {
  const max = Math.max(1, ...rows.map((r) => r.v));
  return rows
    .map(({ name, v, note }) => {
      const pct = (v / max) * 100;
      return `<div class="brow${cls}"><div class="name">${name}${note ? `<small>${note}</small>` : ""}</div><div class="track"><div class="bar" style="width:${pct.toFixed(1)}%"></div><span class="bval${pct > 70 ? " in" : ""}" style="inset-inline-start:${pct > 70 ? `calc(${pct.toFixed(1)}% - 52px)` : `calc(${pct.toFixed(1)}% + 8px)`}">${fmt(v)}</span></div></div>`;
    })
    .join("");
}

export function dashboardHtml(insights, pending, now = new Date()) {
  const posts = insights.posts || [];
  const updated = insights.updatedAt ? new Date(insights.updatedAt) : null;
  const down = !updated || now - updated > STALE_MS || (insights.reconnectToldAt && (!updated || new Date(insights.reconnectToldAt) > updated));
  const net = (n) => posts.filter((p) => p.platform === n);
  const withReach = (xs) => xs.filter((p) => p.reach != null);
  const fb = net("facebook"), ig = net("instagram");
  const week = posts.filter((p) => now - new Date(p.at) < 7 * 864e5);

  // לוח: מה שמתוזמן בדף הפייסבוק + הפוסט ששולה מחכה לו ל"כן"
  const sched = (insights.scheduled || []).filter((s) => new Date(s.at) > now).map((s) => ({ at: s.at, text: s.text, net: "פייסבוק", chip: ["ok", "מתוזמן בפייסבוק"] }));
  if (pending?.text) sched.unshift({ at: pending.at, text: pending.text, net: pending.platform === "both" ? "פייסבוק + אינסטגרם" : NET[pending.platform] || "", chip: ["warn", "מחכה ל\"כן\" שלך"], waiting: true });
  const schedRows = sched.length
    ? sched.map((s) => `<div class="item"><span class="t">${s.waiting ? "עכשיו" : esc(when(s.at))}</span><div class="what"><b>${title(s.text)}</b><div class="sub">${esc(s.net)}</div></div><span class="chip ${s.chip[0]}">${s.chip[1]}</span></div>`).join("")
    : `<p class="empty">אין כרגע פוסטים מתוזמנים בדף הפייסבוק ואין פוסט שמחכה לאישור. פוסטים שמתוזמנים ב-Metricool לא מופיעים כאן.</p>`;

  const top = (xs) => withReach(xs).sort((a, b) => b.reach - a.reach).slice(0, 6).map((p) => ({ name: `${title(p.text)} · ${day(p.at)}`, v: p.reach, note: TYPE[p.type] || esc(p.type) }));
  const byType = (xs) => {
    const g = {};
    for (const p of withReach(xs)) (g[TYPE[p.type] || p.type] ||= []).push(p.reach);
    return Object.entries(g).map(([k, rs]) => ({ name: esc(k), v: avg(rs), note: `${rs.length} פוסטים` })).sort((a, b) => b.v - a.v);
  };
  const chart = (head, rows, cls) => `<div class="panel chart${cls}"><h3>${head}</h3>${rows.length ? `<div class="bars">${bars(rows)}</div>` : `<p class="empty">אין עדיין נתוני חשיפה. הם יופיעו אחרי הריצה הלילית הבאה.</p>`}</div>`;

  const kpi = (lbl, v, note, cls = "") => `<div class="panel kpi${cls}"><span class="lbl">${lbl}</span><span class="val">${esc(v)}</span><span class="note">${note}</span></div>`;
  const f = insights.followers || {};
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>דשבורד פרסום</title>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;700;800;900&family=Assistant:wght@400;600;700&display=swap" rel="stylesheet">
<style>${CSS}</style></head><body>
<header class="band"><div class="wrap">
  <div><div class="eyebrow">מועדון טניס שולחן מבואות החרמון ע"ש רוני גלבוע</div><h1>דשבורד פרסום</h1><p>נתונים ישירות מפייסבוק ומאינסטגרם</p></div>
  <div class="stamp"><span>נשלף מ-Meta</span><b>${updated ? esc(when(updated.toISOString())) : "עוד לא"}</b><span>מתעדכן כל לילה</span></div>
</div></header>
<main><div class="wrap">
${down ? `<div class="alert" role="alert"><div class="ico">!</div><div><h3>החיבור לפייסבוק ולאינסטגרם לא מעדכן</h3><p>${updated ? `העדכון האחרון היה ב-${esc(when(updated.toISOString()))}.` : "עוד לא נאספו נתונים."} כדי לחבר מחדש, לכתוב לשולה בוואטסאפ "תחברי מחדש את פייסבוק". המספרים כאן ישנים עד שזה מתוקן.</p></div></div>` : `<div class="ok-line"><span class="chip ok">החיבור למטא עובד</span> עודכן ${esc(when(updated.toISOString()))}</div>`}
<section><div class="sec-h"><h2>תמונת מצב</h2></div><div class="kpis">
${kpi("עוקבים בפייסבוק", fmt(f.facebook), "מספר העוקבים בדף")}
${kpi("עוקבים באינסטגרם", fmt(f.instagram), "מספר העוקבים בחשבון")}
${kpi("פוסטים השבוע", week.length, `פייסבוק ${week.filter((p) => p.platform === "facebook").length}, אינסטגרם ${week.filter((p) => p.platform === "instagram").length}`)}
${kpi("חשיפה ממוצעת בפייסבוק", fmt(avg(withReach(fb).map((p) => p.reach))), `לפוסט, ${withReach(fb).length} פוסטים ב-30 יום`)}
${kpi("חשיפה ממוצעת באינסטגרם", fmt(avg(withReach(ig).map((p) => p.reach))), `לפוסט, ${withReach(ig).length} פוסטים ב-30 יום`)}
</div></section>
<section><div class="sec-h"><h2>מה עולה ומתי</h2><span class="meta">שום דבר לא עולה בלי "כן" שלך</span></div><div class="panel items">${schedRows}</div></section>
<section><div class="sec-h"><h2>הפוסטים החזקים</h2><span class="meta">חשיפה = כמה אנשים שונים ראו, 30 הימים האחרונים</span></div>
<div class="two">${chart("פייסבוק", top(fb), "")}${chart("אינסטגרם", top(ig), " ig")}</div></section>
<section><div class="sec-h"><h2>מה עובד: חשיפה ממוצעת לפי סוג</h2></div>
<div class="two">${chart("פייסבוק", byType(fb), "")}${chart("אינסטגרם", byType(ig), " ig")}</div></section>
</div></main>
<footer><div class="wrap">מקור: Meta (פייסבוק ואינסטגרם), דרך החיבור של שולה. מספר שמסומן "לא זמין" Meta לא החזירה. פוסטים שמתוזמנים ב-Metricool לא מופיעים כאן.</div></footer>
</body></html>`;
}

const CSS = `:root{--olive:#3D4617;--lime:#AEC048;--gold:#B79440;--bg:#F7F6EE;--panel:#fff;--panel-2:#F1F0E5;--line:#E4E2D3;--ink:#23280E;--ink-2:#4E5436;--ink-3:#7A7F63;--bar:#3D4617;--bar-ig:#8EA035;--track:#EEEDE2;--ok:#2E7D32;--ok-bg:#E4F1E2;--warn:#8F5B00;--warn-bg:#FAEDD0;--bad:#B3261E;--bad-bg:#FBE4E1}
@media (prefers-color-scheme:dark){:root{--bg:#13160A;--panel:#1C2110;--panel-2:#232914;--line:#2F3619;--ink:#F0F0E4;--ink-2:#C8CBB2;--ink-3:#979C7E;--bar:#AEC048;--bar-ig:#D7E39A;--track:#262C15;--ok:#86CF8A;--ok-bg:#1B301D;--warn:#E8B860;--warn-bg:#382B10;--bad:#F3958D;--bad-bg:#3C1916;color-scheme:dark}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 Assistant,Heebo,system-ui,sans-serif}
.wrap{max-width:1100px;margin:0 auto;padding-inline:max(16px,env(safe-area-inset-left,0px))}
h1,h2,h3{font-family:Heebo,system-ui,sans-serif;margin:0}
.band{position:relative;color:#fff;padding-bottom:30px}.band:before{content:"";position:absolute;inset:0 0 -10px;background:linear-gradient(90deg,#9C7C30,var(--gold));clip-path:polygon(0 0,100% 0,100% 88%,0 100%)}.band:after{content:"";position:absolute;inset:0;background:var(--olive);clip-path:polygon(0 0,100% 0,100% 82%,0 100%)}
.band .wrap{position:relative;z-index:1;display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:16px;padding-block:24px 8px}
.eyebrow{font:700 13px Heebo,sans-serif;color:var(--lime)}.band h1{font-weight:900;font-size:clamp(30px,5vw,42px)}.band p{margin:4px 0 0;opacity:.85}
.stamp{display:flex;flex-direction:column;gap:2px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.22);border-radius:10px;padding:8px 14px;font-size:13px}.stamp b{font:800 17px Heebo,sans-serif}
main .wrap{display:flex;flex-direction:column;gap:28px;padding-block:26px 30px}section{display:flex;flex-direction:column;gap:12px;min-width:0}
.sec-h{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:10px}.sec-h h2{font-size:21px;display:flex;align-items:center;gap:10px}.sec-h h2:before{content:"";width:6px;height:20px;border-radius:2px;background:var(--lime)}.meta{font-size:13px;color:var(--ink-3)}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:14px;min-width:0}
.alert{display:flex;gap:14px;padding:16px 18px;border-radius:14px;background:var(--bad-bg);border-inline-start:6px solid var(--bad)}.alert .ico{flex:none;width:36px;height:36px;border-radius:50%;background:var(--bad);color:var(--bad-bg);display:grid;place-items:center;font:900 20px Heebo}.alert h3{color:var(--bad);font-size:18px}.alert p{margin:4px 0 0}
.ok-line{font-size:14px;color:var(--ink-3);display:flex;gap:10px;align-items:center}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}.kpi{padding:16px;display:flex;flex-direction:column;gap:4px}.kpi .lbl{font-size:14px;font-weight:600;color:var(--ink-2)}.kpi .val{font:900 34px/1.1 Heebo,sans-serif;font-variant-numeric:tabular-nums}.kpi .note{font-size:13px;color:var(--ink-3)}
.chip{display:inline-flex;align-items:center;gap:5px;font-weight:700;font-size:12.5px;padding:3px 10px;border-radius:999px;white-space:nowrap}.chip:before{content:"";width:7px;height:7px;border-radius:50%;background:currentColor}.ok{background:var(--ok-bg);color:var(--ok)}.warn{background:var(--warn-bg);color:var(--warn)}
.items{display:flex;flex-direction:column}.item{display:grid;grid-template-columns:110px 1fr auto;gap:12px;align-items:center;padding:12px 16px;border-top:1px solid var(--line)}.item:first-child{border-top:0}.item .t{font:700 14px Heebo,sans-serif;color:var(--ink-2)}.item .what{min-width:0}.item .sub{font-size:13px;color:var(--ink-3)}
.empty{margin:0;padding:16px;color:var(--ink-3);font-size:14px}
.two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.chart{padding:18px;display:flex;flex-direction:column;gap:12px}.chart h3{font-size:16px}
.bars{display:flex;flex-direction:column;gap:10px}.brow{display:grid;grid-template-columns:minmax(120px,44%) 1fr;gap:12px;align-items:center;font-size:14px}.brow .name{color:var(--ink-2);line-height:1.25;min-width:0;overflow-wrap:anywhere}.brow small{display:block;color:var(--ink-3);font-size:12px}
.track{position:relative;height:24px;background:var(--track);border-radius:4px}.bar{position:absolute;inset-inline-start:0;top:0;bottom:0;background:var(--bar);border-radius:4px;min-width:3px}.ig .bar{background:var(--bar-ig)}.bval{position:absolute;top:50%;transform:translateY(-50%);font:800 13px Heebo,sans-serif;font-variant-numeric:tabular-nums}.bval.in{color:var(--panel)}
footer{background:var(--olive);color:#E9ECD6;font-size:13px}footer .wrap{padding-block:14px}
@media (max-width:720px){.two{grid-template-columns:minmax(0,1fr)}.item{grid-template-columns:1fr}.item .chip{justify-self:start}}`;
