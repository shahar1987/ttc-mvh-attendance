// סנכרון גיליון הסטטוסים: כל צד נשפט מול הערך הקודם שלו, ואי-התאמה ישנה לא נוגעת באף צד
import test from "node:test";
import assert from "node:assert/strict";
import { plan, planFields, archivedRows, newRow, draftPlayer, PAID, UNPAID, OFF, CHECK } from "../scripts/status_sheet.mjs";

const NO = "✗ לא רשום";
const players = (o) => new Map(Object.entries(o).map(([id, notPaying]) => [id, { isActive: true, notPaying }]));

test("ריצה ראשונה רק מתעדת, גם כשיש אי-התאמה", () => {
  const r = plan([{ id: "a", status: NO }], players({ a: false }), {});
  assert.deepEqual([r.app, r.sheet, r.next.a], [[], [], { s: NO, a: false }]);
});

test("אי-התאמה ישנה שלא השתנתה נשארת", () => {
  const r = plan([{ id: "a", status: NO }], players({ a: false }), { a: { s: NO, a: false } });
  assert.deepEqual([r.app, r.sheet], [[], []]);
});

test("שינוי בגיליון נכתב לאפליקציה, גם ל-✓ וגם ל-✗", () => {
  assert.deepEqual(plan([{ id: "a", status: PAID }], players({ a: true }), { a: { s: NO, a: true } }).app, [{ id: "a", notPaying: false }]);
  assert.deepEqual(plan([{ id: "a", status: UNPAID }], players({ a: false }), { a: { s: PAID, a: false } }).app, [{ id: "a", notPaying: true }]);
});

test("בין ✗ ל-◐ אין מה לעדכן באפליקציה", () => {
  const r = plan([{ id: "a", status: UNPAID }], players({ a: true }), { a: { s: NO, a: true } });
  assert.deepEqual([r.app, r.next.a], [[], { s: UNPAID, a: true }]);
});

test("שינוי באפליקציה מעדכן את הגיליון", () => {
  assert.deepEqual(plan([{ id: "a", status: UNPAID }], players({ a: false }), { a: { s: UNPAID, a: true } }).sheet, [{ id: "a", status: PAID }]);
  assert.deepEqual(plan([{ id: "a", status: PAID }], players({ a: true }), { a: { s: PAID, a: false } }).sheet, [{ id: "a", status: UNPAID }]);
});

test("שינוי באפליקציה לא דורס נוסחה, ולא שורה שלא במעקב", () => {
  assert.deepEqual(plan([{ id: "a", status: PAID, mirrored: true }], players({ a: true }), { a: { s: PAID, a: false } }).sheet, []);
  assert.deepEqual(plan([{ id: "a", status: OFF }], players({ a: true }), { a: { s: OFF, a: false } }).sheet, []);
});

test("שני הצדדים השתנו: הגיליון קובע", () => {
  const r = plan([{ id: "a", status: PAID }], players({ a: false }), { a: { s: NO, a: true } });
  assert.deepEqual([r.app, r.sheet, r.next.a], [[], [], { s: PAID, a: false }]);
});

test("שחקן שנמחק או תא ריק לא נכתב ונשמט מהזיכרון", () => {
  const r = plan([{ id: "x", status: PAID }, { id: "a", status: "" }], players({ a: true }), { x: { s: NO, a: true } });
  assert.deepEqual([r.app, r.next], [[], {}]);
});

test("שורה לשחקן חדש לפי כותרות הלשונית", () => {
  const kid = ["#", "שם", "הורה", "טלפון הורה", "הצטרף", "אימון ראשון", "סטטוס רישום", "הערה", "מזהה"];
  const p = { id: "x", name: " דנה ", parentName: "רון", parentPhone: "972501234567", joinDate: "2026-11-02" };
  assert.deepEqual(newRow(p, "מתחילים שאר ישוב", kid, 10), [10, "דנה", "רון", "050-1234567", "02/11/2026", "", NO, "נוסף מהאפליקציה", "x"]);
  const adult = ["#", "שם", "טלפון", "הצטרף", "אימון ראשון", "סטטוס רישום", "הערה", "מזהה"];
  assert.deepEqual(newRow({ ...p, parentPhone: "", notPaying: false }, "פרקינסון", adult, 1).slice(2, 7), ["חסר", "02/11/2026", "", PAID, "נוסף מהאפליקציה"]);
  assert.equal(newRow(p, "חוגים רמת כורזים", kid, 1)[6], OFF);
  assert.equal(newRow({ ...p, name: "=HACK()" }, "פרקינסון", adult, 1)[1], "'=HACK()");
});

test("שורה מהגיליון: בלי טלפון תקין ממתינה, עם טלפון נוצרת באותו מבנה ועם מזהה קבוע", () => {
  assert.equal(draftPlayer({ name: "דנה כהן", phone: "חסר" }, "g", "2026-11-04"), null);
  assert.equal(draftPlayer({ name: "ד", phone: "050-1234567" }, "g", "2026-11-04"), null);
  const a = draftPlayer({ name: " דנה כהן ", parent: "רון", phone: "050-1234567", status: PAID }, "g", "2026-11-04");
  assert.deepEqual({ ...a, id: 0 }, { id: 0, name: "דנה כהן", groupId: "g", parentName: "רון", parentPhone: "972501234567", joinDate: "2026-11-04", endDate: null, isActive: true, notPaying: false, notPayingSource: "manual" });
  assert.match(a.id, /^sheet_[0-9a-f]{16}$/);
  assert.equal(draftPlayer({ name: "דנה כהן", phone: "0501234567" }, "g", "2026-12-01").id, a.id);
  assert.equal(draftPlayer({ name: "דנה כהן", phone: "050-1234567" }, "g", "2026-11-04").notPaying, true);
});

test("לבדיקה לא נוגע באפליקציה, והכרעה אחריו כן", () => {
  assert.deepEqual(plan([{ id: "a", status: CHECK }], players({ a: false }), { a: { s: NO, a: false } }).app, []);
  assert.deepEqual(plan([{ id: "a", status: CHECK }], players({ a: true }), { a: { s: CHECK, a: false } }).sheet, []);
  assert.deepEqual(plan([{ id: "a", status: NO }], players({ a: false }), { a: { s: CHECK, a: false } }).app, [{ id: "a", notPaying: true }]);
});

test("שחקן בארכיון: השורה מתרוקנת והשם נשאר בהערה; פעיל או לא מוכר לא נוגעים", () => {
  const clear = { range: "'x'!A3:C3", name: "שם" };
  const m = new Map([["a", { isActive: false, endDate: "2026-11-05" }], ["b", { isActive: true }]]);
  const r = archivedRows([{ id: "a", status: NO, noteCell: "'x'!B3", clear }, { id: "b", status: NO, clear }, { id: "c", status: NO, clear }, { id: "a", status: NO, clear: null }], m);
  assert.deepEqual(r, [{ id: "a", range: "'x'!A3:C3", noteCell: "'x'!B3", note: `יצא לארכיון 05/11/2026: שם (היה: ${NO})` }]);
});

const fp = (o) => new Map([["a", { isActive: true, name: "דנה", parentPhone: "972501234567", joinDate: "2026-09-01", ...o }]]);
const row = (o) => ({ id: "a", fields: { name: "דנה", phone: "050-1234567", join: "01/09/2026", ...o }, cells: { name: "n", phone: "p", join: "j" } });
const base = planFields([row()], fp(), {}).next;

test("שדות: ריצה ראשונה רק מתעדת, בלי שינוי אין כתיבה", () => {
  const r = planFields([row({ name: "דנה / רון" })], fp(), {});
  assert.deepEqual([r.app, r.sheet], [[], []]);
  assert.deepEqual([planFields([row()], fp(), base).app, planFields([row()], fp(), base).sheet], [[], []]);
});

test("שדות: שינוי בגיליון נכתב לאפליקציה, בפורמט שלה", () => {
  assert.deepEqual(planFields([row({ phone: "052-7654321", name: "דנה כהן" })], fp(), base).app, [{ id: "a", patch: { name: "דנה כהן", parentPhone: "972527654321" } }]);
});

test("שדות: שינוי באפליקציה מעדכן את הגיליון", () => {
  assert.deepEqual(planFields([row()], fp({ parentPhone: "972527654321" }), base).sheet, [{ cell: "p", value: "052-7654321" }]);
});

test("שדות: ריק או לא תקין בגיליון לא מוחק ונשאר ממתין", () => {
  for (const phone of ["חסר", "123"]) {
    const r = planFields([row({ phone })], fp(), base);
    assert.deepEqual([r.app, r.next.a.phone], [[], base.a.phone]);
  }
});

test("שדות: תאריך שחוצה את CUTOFF לא נכתב, כדי לא להפעיל ברוך הבא", () => {
  assert.deepEqual(planFields([row({ join: "01/11/2026" })], fp(), base).app, []);
  assert.deepEqual(planFields([row({ join: "02/09/2026" })], fp(), base).app, [{ id: "a", patch: { joinDate: "2026-09-02" } }]);
});
