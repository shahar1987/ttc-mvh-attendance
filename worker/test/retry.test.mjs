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
