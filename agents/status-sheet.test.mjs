// סנכרון גיליון הסטטוסים: כל צד נשפט מול הערך הקודם שלו, ואי-התאמה ישנה לא נוגעת באף צד
import test from "node:test";
import assert from "node:assert/strict";
import { plan, newRow, PAID, UNPAID, OFF } from "../scripts/status_sheet.mjs";

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
