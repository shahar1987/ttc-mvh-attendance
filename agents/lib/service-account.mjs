// מפתח ה-service account של Firestore (הסוד FIREBASE_SERVICE_ACCOUNT ב-GitHub). בלי תלויות,
// כדי שגם סקריפטים בלי firebase-admin (firestore_rules.mjs) יקראו אותו מכאן.
export function serviceAccount(env = process.env) {
  let sa;
  try {
    sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT || "{}");
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT is not valid JSON");
  }
  if (!sa.project_id) throw new Error("missing repository secret FIREBASE_SERVICE_ACCOUNT");
  return sa;
}
