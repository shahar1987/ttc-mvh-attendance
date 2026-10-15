// Firestore security rules: pull from / deploy to the live project.
//   node scripts/firestore_rules.mjs pull    — writes the live rules into firestore.rules
//   node scripts/firestore_rules.mjs deploy  — validates firestore.rules and publishes it
// Needs FIREBASE_SERVICE_ACCOUNT (same secret as backup / sync). Prints no data, only status.
import { readFileSync, writeFileSync } from "node:fs";
import { JWT } from "google-auth-library";

const FILE = new URL("../firestore.rules", import.meta.url);
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
if (!sa.project_id) throw new Error("missing repository secret FIREBASE_SERVICE_ACCOUNT");
const P = `projects/${sa.project_id}`;
const API = "https://firebaserules.googleapis.com/v1/";

const auth = new JWT({ email: sa.client_email, key: sa.private_key, scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
async function call(method, path, body) {
  const { token } = await auth.getAccessToken();
  const r = await fetch(API + path, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: body && JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status}: ${j.error?.message || JSON.stringify(j).slice(0, 300)}`);
  return j;
}

async function live() {
  const rel = await call("GET", `${P}/releases/cloud.firestore`);
  const rs = await call("GET", rel.rulesetName);
  const f = rs.source.files.find(x => x.name === "firestore.rules") || rs.source.files[0];
  return { ruleset: rel.rulesetName, content: f.content };
}

// errors go to the step summary / annotations too — the raw log is not always reachable
const report = e => { const m = String(e?.message || e); console.log(`::error::${m}`); if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, `❌ ${m}\n`, { flag: "a" }); process.exit(1); };
process.on("unhandledRejection", report); process.on("uncaughtException", report);
const mode = process.argv[2];
if (mode === "pull") {
  const { ruleset, content } = await live();
  writeFileSync(FILE, content);
  console.log(`pulled ${content.split("\n").length} lines from ${ruleset}`);
} else if (mode === "deploy") {
  const content = readFileSync(FILE, "utf8");
  const cur = await live();
  if (cur.content === content) { console.log("live rules already match firestore.rules — nothing to deploy"); process.exit(0); }
  const source = { files: [{ name: "firestore.rules", content }] };
  const t = await call("POST", `${P}:test`, { source });
  if (t.issues?.some(i => i.severity === "ERROR")) throw new Error("rules have errors: " + t.issues.map(i => `${i.sourcePosition?.line}: ${i.description}`).join("; "));
  const rs = await call("POST", `${P}/rulesets`, { source });
  await call("PATCH", `${P}/releases/cloud.firestore`, { release: { name: `${P}/releases/cloud.firestore`, rulesetName: rs.name }, updateMask: "rulesetName" });
  console.log(`deployed ${rs.name} (was ${cur.ruleset})`);
} else {
  throw new Error("usage: firestore_rules.mjs pull|deploy");
}
