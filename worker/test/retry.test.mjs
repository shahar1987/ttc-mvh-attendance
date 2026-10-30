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
  const pick = (xs) => [xs.find((x) => x.to), ...xs.filter((x) => !x.to).slice(0, 2)].filter(Boolean);
  await drainQueue(store, "q", "items", { now, pick, run: async (xs) => (seen = xs.map((x) => x.id)) });
  assert.deepEqual(seen, ["c1", "o1", "o2"], "מדריך אחד ועד שניים לבעלים בריצה");
  assert.deepEqual(docs.q.items.map((x) => x.id), ["o3", "c2", "locked", "stale"]);
  await drainQueue(store, "q", "items", { now, run: async (xs) => (seen = xs.map((x) => x.id)) });
  assert.deepEqual(seen, ["o3", "c2", "stale"], "נעילה של 5 דקות נשארת, של 15 דקות משתחררת");
  console.log("queue max ok");
}

// 🔑 כניסה אחת לגוגל לכל ריצה: 14 משימות במקביל חלקו 14 בקשות כניסה ופוצצו את מגבלת 50 הבקשות של ה-worker (30.10)
{
  const { generateKeyPairSync } = await import("node:crypto");
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const sa = { client_email: "x@y", private_key: privateKey.export({ type: "pkcs8", format: "pem" }) };
  const { accessToken } = await import("../src/firestore.js");
  let tokenCalls = 0;
  globalThis.fetch = async (url) => {
    if (String(url).includes("oauth2")) { tokenCalls++; await new Promise((r) => setTimeout(r, 20)); return new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }), { status: 200 }); }
    return new Response("{}", { status: 200 });
  };
  const tokens = await Promise.all(Array.from({ length: 14 }, () => accessToken(sa)));
  assert.equal(tokenCalls, 1, "14 בקשות במקביל — כניסה אחת");
  assert.ok(tokens.every((t) => t === "t"));
  await accessToken(sa);
  assert.equal(tokenCalls, 1, "אחר כך מהמטמון");
  console.log("token shared ok");
}
