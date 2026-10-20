import test from "node:test";
import assert from "node:assert/strict";
import { staffIssue } from "../scripts/staff_logins.mjs";

const p = (...ids) => ids.map((providerId) => ({ providerId }));

test("staffIssue: password account is fine", () => {
  assert.equal(staffIssue({ providerData: p("password") }), "");
  assert.equal(staffIssue({ providerData: p("password", "google.com") }), "");
});

test("staffIssue: blocked accounts", () => {
  assert.equal(staffIssue(null), "אין חשבון התחברות");
  assert.equal(staffIssue({ disabled: true, providerData: p("password") }), "החשבון מושבת");
  assert.match(staffIssue({ providerData: p("google.com") }), /Google/);
  assert.equal(staffIssue({ providerData: [] }), "אין סיסמה לחשבון");
});
