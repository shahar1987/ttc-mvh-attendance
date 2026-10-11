// בדיקה חד-פעמית לקריאה בלבד: אילו דפים שמורים ואילו הרשאות יש לכל טוקן. לא מדפיס טוקנים.
import { firestore } from "./lib/firebase.mjs";
const G = "https://graph.facebook.com/v24.0";
const j = async (u) => (await fetch(u)).json();
const db = firestore();
const s = (await db.collection("agentReports").doc("social").get()).data() || {};
console.log("connectedAt", s.connectedAt, "pages", (s.pages || []).length);
for (const [i, p] of (s.pages || []).entries()) {
  const t = p.token;
  const me = await j(`${G}/me?fields=id,name&access_token=${t}`);
  const dbg = await j(`${G}/debug_token?input_token=${t}&access_token=${t}`);
  const posts = await j(`${G}/${p.id}/posts?fields=id&limit=1&access_token=${t}`);
  const ig = p.ig ? await j(`${G}/${p.ig}/media?fields=id,timestamp&limit=3&access_token=${t}`) : null;
  console.log(JSON.stringify({
    i, name: p.name, id: p.id, igName: p.igName, hasIg: !!p.ig,
    tokenIsPage: me.id === p.id, meErr: me.error?.code,
    app: dbg.data?.app_id, valid: dbg.data?.is_valid, type: dbg.data?.type, scopes: dbg.data?.scopes, dbgErr: dbg.error?.message?.slice(0, 80),
    postsOk: !posts.error, postsErr: posts.error?.code,
    igCount: ig ? (ig.data || []).length : null, igLatest: ig?.data?.[0]?.timestamp, igErr: ig?.error?.code,
  }));
}
const ins = (await db.collection("agentReports").doc("insights").get()).data() || {};
console.log("insights posts", (ins.posts || []).length, (ins.posts || []).map((x) => x.platform + ":" + x.at.slice(0, 10)).join(" "));
