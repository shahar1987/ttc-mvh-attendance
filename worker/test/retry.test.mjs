import assert from "node:assert/strict";
import { fetchRetry } from "../src/firestore.js";

const seq = (codes) => { let n = 0; globalThis.fetch = async () => new Response("{}", { status: codes[n++] ?? 200 }); return () => n; };
let calls = seq([429, 503, 200]);
assert.equal((await fetchRetry("x", {}, [1, 1, 1])).status, 200);
assert.equal(calls(), 3);
calls = seq([429, 429, 429, 429, 429]);
assert.equal((await fetchRetry("x", {}, [1, 1])).status, 429); // מוותרים אחרי הניסיונות — השגיאה עוברת הלאה כרגיל
assert.equal(calls(), 3);
calls = seq([409]);
assert.equal((await fetchRetry("x", {}, [1])).status, 409); // שגיאה אחרת — בלי ניסיון חוזר
assert.equal(calls(), 1);
console.log("firestore retry ok");

// 📬 תור: לכל היותר max פריטים בריצה, לפי סדר העדיפות; נעילה ישנה (10 דק') משתחררת
{
  const { drainQueue } = await import("../src/queue.js");
  const docs = { q: { items: [] } };
  const store = { update: async (p, f) => { const r = f(docs[p]); if (r) docs[p] = { ...docs[p], ...r }; } };
  const now = new Date("2026-10-30T16:00:00Z");
  docs.q.items = [
    { id: "o1" }, { id: "o2" }, { id: "c1", to: "x" }, { id: "o3" }, { id: "c2", to: "y" },
    { id: "locked", claimedAt: "2026-10-30T15:55:00Z" }, { id: "stale", claimedAt: "2026-10-30T15:45:00Z" },
  ];
  let seen = [];
  await drainQueue(store, "q", "items", { now, max: 3, order: (a, b) => (b.to ? 1 : 0) - (a.to ? 1 : 0), run: async (xs) => (seen = xs.map((x) => x.id)) });
  assert.deepEqual(seen, ["c1", "c2", "o1"], "מדריכים קודם, ורק 3");
  assert.deepEqual(docs.q.items.map((x) => x.id), ["o2", "o3", "locked", "stale"]);
  await drainQueue(store, "q", "items", { now, max: 10, run: async (xs) => (seen = xs.map((x) => x.id)) });
  assert.deepEqual(seen, ["o2", "o3", "stale"], "נעילה של 5 דקות נשארת, של 15 דקות משתחררת");
  console.log("queue max ok");
}
