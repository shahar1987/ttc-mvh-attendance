import { test } from "node:test";
import assert from "node:assert/strict";
import admin from "firebase-admin";
import { heartbeat, reportMissingKey } from "./lib/firebase.mjs";

// מסמך health מדומה שמתנהג כמו set({merge:true}) של Firestore, כולל FieldValue.delete()
const doc = {};
const db = { collection: () => ({ doc: () => ({ set: async (patch) => { for (const [agent, fields] of Object.entries(patch)) { doc[agent] ||= {}; for (const [k, v] of Object.entries(fields)) v?.constructor === admin.firestore.FieldValue.delete().constructor ? delete doc[agent][k] : (doc[agent][k] = v); } } }) }) };

test("ריצה מוצלחת מוחקת דגל מפתח חסר", async () => {
  await reportMissingKey(db, "ideas", "ANTHROPIC_API_KEY");
  assert.equal(doc.ideas.missingKey, "ANTHROPIC_API_KEY");
  await heartbeat(db, "ideas");
  assert.equal(doc.ideas.missingKey, undefined);
  assert.equal(doc.ideas.missingKeyAt, undefined);
  assert.ok(doc.ideas.at);
});
