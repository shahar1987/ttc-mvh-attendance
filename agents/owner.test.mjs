import { test } from "node:test";
import assert from "node:assert/strict";
import { tellOwner, enqueueOwner } from "./lib/owner.mjs";

// Firestore מדומה: שומר כל set עם merge כמו Firestore (מיזוג עמוק של מפות, arrayUnion מוסיף למערך)
const UNION = Symbol("arrayUnion");
const opts = { arrayUnion: (x) => ({ [UNION]: [x] }) };
function fakeDb(initial = {}) {
  const docs = { "agentReports/bot": structuredClone(initial) };
  const merge = (a, b) => {
    for (const [k, v] of Object.entries(b)) {
      if (v && v[UNION]) a[k] = [...(Array.isArray(a[k]) ? a[k] : []), ...v[UNION]];
      else a[k] = v && typeof v === "object" && !Array.isArray(v) && a[k] && typeof a[k] === "object" ? merge(a[k], v) : v;
    }
    return a;
  };
  return {
    docs,
    collection: (c) => ({
      doc: (d) => ({
        get: async () => ({ data: () => docs[`${c}/${d}`] }),
        set: async (data, opt) => {
          docs[`${c}/${d}`] = opt?.merge ? merge(docs[`${c}/${d}`] || {}, data) : structuredClone(data);
        },
      }),
    }),
  };
}

const noWa = () => {
  for (const k of ["WHATSAPP_TOKEN", "WHATSAPP_PHONE_ID", "OWNER_PHONE"]) delete process.env[k];
};

test("without WhatsApp secrets the message is queued for the worker, not lost", async () => {
  noWa();
  const db = fakeDb({ outbox: { review: { at: "2026-10-01T00:00:00Z", text: "old" } }, lastOwnerMsgAt: "x" });
  const how = await tellOwner(db, { agent: "scan", text: "שורה ראשונה\nפרטים", templateParam: "סיכום" }, opts);
  assert.equal(how, "queued");
  const bot = db.docs["agentReports/bot"];
  assert.equal(bot.outbox.review.text, "old", "other outbox entries are kept");
  assert.equal(bot.outbox.scan.how, "queued");
  assert.equal(bot.outboxQueue.length, 1);
  const q = bot.outboxQueue[0];
  assert.deepEqual(Object.keys(q).sort(), ["at", "from", "id", "template", "templateParam", "text"]);
  assert.equal(q.text, "שורה ראשונה\nפרטים");
  assert.equal(q.from, "scan");
  assert.equal(q.templateParam, "סיכום");
  assert.equal(q.template, "agent_alert");
  assert.match(q.at, /^\d{4}-\d\d-\d\dT/);
  assert.ok(q.id);
  assert.equal(bot.outbox.scan.id, q.id);
  assert.equal(db.docs["agentReports/bot"].lastOwnerMsgAt, "x");
});

test("two agents queueing at once keep both entries", async () => {
  noWa();
  const db = fakeDb();
  await Promise.all([
    enqueueOwner(db, { agent: "ideas", text: "a" }, opts),
    enqueueOwner(db, { agent: "github-actions", key: "alert-backup", text: "b" }, opts),
  ]);
  assert.deepEqual(db.docs["agentReports/bot"].outboxQueue.map((x) => x.text).sort(), ["a", "b"]);
  assert.deepEqual(Object.keys(db.docs["agentReports/bot"].outbox).sort(), ["alert-backup", "ideas"]);
  assert.equal(db.docs["agentReports/bot"].outbox["alert-backup"].templateParam, "b");
});
