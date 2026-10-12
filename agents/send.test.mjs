import { test } from "node:test";
import assert from "node:assert/strict";
import { pickCoaches } from "./send.mjs";

const users = [
  { id: "a", name: "אבי כהן", phone: "050-0000001" },
  { id: "b", name: "בני לוי", phone: "0500000002" },
  { id: "c", name: "אבי לוי", phone: "0500000003" }, // לא מופעל
];
const ids = ["a", "b"];

test("picks one approved coach by partial name", () => {
  assert.deepEqual(pickCoaches(users, ids, "אבי"), [{ id: "a", phone: "972500000001" }]);
});
test("never sends to a coach who is not approved", () => {
  assert.throws(() => pickCoaches(users, ids, "אבי לוי"));
});
test("'כולם' sends to every approved coach", () => {
  assert.equal(pickCoaches(users, ids, "כולם").length, 2);
});
test("ambiguous or empty recipient fails", () => {
  assert.throws(() => pickCoaches(users, [...ids, "c"], "לוי"));
  assert.throws(() => pickCoaches(users, ids, ""));
});
