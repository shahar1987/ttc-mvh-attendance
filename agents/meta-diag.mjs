// בדיקה חד-פעמית לקריאה בלבד. לא מדפיס טוקנים.
import { firestore } from "./lib/firebase.mjs";
const G = "https://graph.facebook.com/v24.0";
const j = async (u) => (await fetch(u)).json();
const db = firestore();
const s = (await db.collection("agentReports").doc("social").get()).data() || {};
console.log("queue", JSON.stringify((s.queue || []).map((q) => ({ at: q.at, platform: q.platform, status: q.status }))));
const since = Math.floor(new Date("2026-10-10T07:00:00Z") / 1000);
for (const p of s.pages || []) {
  const t = p.token;
  const fb = await j(`${G}/${p.id}/posts?fields=id,created_time,message&since=${since}&limit=20&access_token=${t}`);
  console.log(p.igName, "FB since 10.10:", JSON.stringify((fb.data || []).map((x) => [x.created_time, (x.message || "").slice(0, 25)])), fb.error?.code ?? "");
  const ig = await j(`${G}/${p.ig}/media?fields=timestamp,caption&limit=5&access_token=${t}`);
  console.log(p.igName, "IG latest:", JSON.stringify((ig.data || []).map((x) => [x.timestamp, (x.caption || "").slice(0, 25)])));
  for (const f of ["message", "created_time", "permalink_url", "shares", "reactions.summary(total_count).limit(0)", "comments.summary(total_count).limit(0)", "attachments{media_type}", "insights.metric(post_impressions_unique)"]) {
    const r = await j(`${G}/${p.id}/posts?fields=id,${f}&limit=3&access_token=${t}`);
    console.log(p.igName, "field", f, r.error ? `ERR ${r.error.code}` : "ok");
  }
}
const bot = (await db.collection("agentReports").doc("bot").get()).data() || {};
console.log("tools used since 10.10:", JSON.stringify((bot.log || []).filter((l) => l.at >= "2026-10-10T07" && (l.tools || []).some((t) => /publish/.test(t))).map((l) => [l.at, l.tools])));
const h = (await db.collection("agentReports").doc("health").get()).data() || {};
console.log("content last run:", h.content?.at || h.content?.lastRun || JSON.stringify(h.content || {}).slice(0, 120));
