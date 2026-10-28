// טופס ההצטרפות: קוד שגוי = סגור, בדיקת שדות קפדנית, מלכודת רובוטים, מגבלת קצב, ושמירה רק ב-joinRequests
import assert from "node:assert/strict";
import { helpLine, ipOf, joinRoute, normalisePhone, validate } from "../src/join.js";

const CODE = "abcdefghijkl1234";
const docs = {
  "joinConfig/main": { enabled: true, code: CODE, groups: ["g1"], contactName: "המאמן", contactPhone: "050-1234567" },
  "groups/g1": { name: "מתחילים רמת כורזים", days: [1, 3], startTime: "16:30", endTime: "18:00" },
  "agentReports/bot": {},
};
const writes = [];
const store = {
  get: async (p) => docs[p] || null,
  merge: async (p, v) => (writes.push(p), (docs[p] = { ...docs[p], ...v })),
  update: async (p, fn) => {
    const patch = await fn(docs[p] || {}, !!docs[p]);
    if (patch) docs[p] = { ...docs[p], ...patch };
    return patch;
  },
};
const opts = (now = 1_800_000_000_000) => ({ now, wa: null });

assert.equal(normalisePhone("050.123.4567"), "0501234567");
assert.equal(normalisePhone("+972501234567"), "0501234567");
assert.equal(normalisePhone("04-1234567"), "", "לא נייד");

const good = { k: CODE, child: "נועה כהן", parent: "דנה כהן", phone: "050-1234567", consent: true, ms: 9000, website: "" };
assert.ok(validate(good, docs["joinConfig/main"]).ok);
assert.equal(validate({ ...good, child: "נועה" }, docs["joinConfig/main"]).error, "child", "צריך שם משפחה");
assert.equal(validate({ ...good, child: "<script>x</script> y" }, docs["joinConfig/main"]).error, "child");
assert.ok(!("groupId" in validate({ ...good, groupId: "g1" }, docs["joinConfig/main"]).data), "את הקבוצה קובע הבעלים באישור, לא ההורה");
assert.ok(!("grade" in validate(good, docs["joinConfig/main"]).data), "בלי כיתה — רק מה שהמנהל מוסיף");
assert.equal(validate({ ...good, consent: "true" }, docs["joinConfig/main"]).error, "consent");
assert.equal(validate({ ...good, website: "spam" }, docs["joinConfig/main"]).error, "bot");
assert.equal(validate({ ...good, ms: 500 }, docs["joinConfig/main"]).error, "bot");

const post = (body, ip = "1.1.1.1") =>
  new Request("https://w/join", { method: "POST", headers: { "content-type": "application/json", "CF-Connecting-IP": ip }, body: JSON.stringify(body) });

// דף הטופס: קוד שגוי או טופס כבוי = "סגור", בלי לחשוף כלום
const closedPage = await (await joinRoute(new Request("https://w/join?k=wrong"), { OWNER_PHONE: "972501234567" }, store, opts())).text();
assert.match(closedPage, /הטופס סגור/);
assert.doesNotMatch(closedPage, /tel:/, "בלי קוד תקין — בלי הטלפון של הבעלים");
const page = await (await joinRoute(new Request(`https://w/join?k=${CODE}`), { OWNER_PHONE: "972501234567" }, store, opts())).text();
assert.match(page, /צריכים עזרה\?/, "הטלפון של הבעלים בתחתית");
assert.doesNotMatch(page + helpLine("972501234567"), /שחר/, "בלי שמות בקוד");
assert.match(page, /tel:0501234567/);
assert.equal(helpLine(""), "", "בלי סוד — בלי שורה");
assert.doesNotMatch(page, /name="groupId"/, "אין בחירת קבוצה בטופס");
const print = await (await joinRoute(new Request(`https://w/join/print?k=${CODE}`), { OWNER_PHONE: "972501234567" }, store, opts())).text();
assert.match(print, /<svg/, "ברקוד בדף ההדפסה");
assert.match(print, /050-1234567/, "הטלפון של הבעלים בכרטיס");
assert.equal((print.match(/class="p"/g) || []).length, 10, "10 כרטיסים בדף A4");

// שליחה: נשמרת רק ב-joinRequests
let r = await joinRoute(post(good), {}, store, opts());
assert.equal(r.status, 200);
assert.equal(writes.length, 1);
assert.match(writes[0], /^joinRequests\//);
const saved = docs[writes[0]];
assert.equal(saved.phone, "0501234567");
assert.equal(saved.child, "נועה כהן");
assert.ok(!("k" in saved) && !("ms" in saved) && !("consent" in saved), "רק השדות שנבדקו נשמרים");

// קוד שגוי בשליחה = נדחה
r = await joinRoute(post({ ...good, k: "wrong" }), {}, store, opts());
assert.equal(r.status, 403);
// רובוט: מקבל "ok" ולא נשמר כלום
r = await joinRoute(post({ ...good, website: "x" }), {}, store, opts());
assert.equal(r.status, 200);
assert.equal(writes.length, 1);
// לא JSON / גוף ענק
r = await joinRoute(new Request("https://w/join", { method: "POST", headers: { "content-type": "text/plain" }, body: "x" }), {}, store, opts());
assert.equal(r.status, 415);
r = await joinRoute(post({ ...good, note: "x".repeat(5000) }), {}, store, opts());
assert.equal(r.status, 413);

// גוף ענק נחסם לפי content-length עוד לפני הקריאה
r = await joinRoute(new Request("https://w/join", { method: "POST", headers: { "content-type": "application/json", "content-length": "9999999" }, body: "{}" }), {}, store, opts());
assert.equal(r.status, 413);
// IPv6: כל ה-/64 של אותו בית הוא כתובת אחת
assert.equal(ipOf("2001:db8:1:2:aaaa::1"), ipOf("2001:db8:1:2:bbbb::9"));
assert.notEqual(ipOf("2001:db8:1:3::1"), ipOf("2001:db8:1:2::1"));
assert.equal(ipOf("1.2.3.4"), "1.2.3.4");
// הודעה לבעלים: לכל היותר פעם בשעה
const alertAt = docs["joinConfig/rate"].alertAt;
assert.ok(alertAt, "הבקשה הראשונה מתריעה");

// מגבלת קצב: 5 לשעה מאותה כתובת
for (let i = 0; i < 4; i++) assert.equal((await joinRoute(post(good), {}, store, opts())).status, 200);
assert.equal((await joinRoute(post(good), {}, store, opts())).status, 429, "השישית באותה שעה נחסמת");
assert.equal((await joinRoute(post(good, "2.2.2.2"), {}, store, opts())).status, 200, "כתובת אחרת עוברת");
assert.equal(docs["joinConfig/rate"].alertAt, alertAt, "באותה שעה — בלי הודעות נוספות");
for (let i = 0; i < 6; i++) await joinRoute(post(good, `2001:db8:9:9:${i}::1`), {}, store, opts());
assert.equal(Object.keys(docs["joinConfig/rate"].hits).filter((k) => docs["joinConfig/rate"].hits[k].length >= 5).length >= 1, true, "כל ה-/64 נספר כבית אחד");
assert.equal((await joinRoute(post(good), {}, store, opts(1_800_000_000_000 + 3700e3))).status, 200, "אחרי שעה שוב מותר");
assert.equal(docs["joinConfig/rate"].alertAt, 1_800_000_000_000 + 3700e3, "אחרי שעה — הודעה חדשה");

// טופס כבוי = סגור גם בשליחה
docs["joinConfig/main"].enabled = false;
assert.equal((await joinRoute(post(good, "3.3.3.3"), {}, store, opts())).status, 403);
console.log("join: all assertions passed");
