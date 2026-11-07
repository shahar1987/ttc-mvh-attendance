// בקשות "תריץ עכשיו" מהבוט: הבוט כותב ל-agentReports/bot.requests, וה-workflow
// בודק כל 10 דקות ומריץ את מה שביקשו. מדפיס את שמות הסוכנים ל-GITHUB_OUTPUT.
import { appendFileSync } from "node:fs";
import { firestore } from "./lib/firebase.mjs";
import { RUNNABLE } from "./lib/agents.mjs";
import { botDoc } from "./lib/owner.mjs";

const db = firestore();
const ref = botDoc(db);
const requested = await db.runTransaction(async (tx) => {
  const data = (await tx.get(ref)).data() || {};
  const list = (data.requests || []).filter((r) => RUNNABLE.has(r));
  if (list.length) tx.set(ref, { requests: [] }, { merge: true });
  return [...new Set(list)];
});
console.log(`requested: ${requested.join(",") || "none"}`);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `run=${requested.join(",")}\n`);
