// מייצא מדי יום את האוספים attendance, cancellations ו-players מ-Firestore
// ודוחף אותם כ-JSON לריפו הפרטי shahar1987/ttc-mvh-backups.
//
// למה ריפו נפרד ופרטי: הריפו הזה (ttc-mvh-attendance) ציבורי, והאוספים
// האלה כוללים שמות ילדים, טלפוני הורים ושיוך לקבוצות (כולל "פרקינסון").
// שמירתם כאן היתה חושפת אותם לכל אחד באינטרנט. היומן של ה-Action הזה,
// לעומת זאת, מדפיס רק מספרי רשומות — אף פעם לא תוכן.
//
// "רצ'ט": אם אוסף כלשהו מגיע עם פחות מחצי מהרשומות שהיו בגיבוי הקודם,
// זה כנראה שגיאת קריאה חלקית מ-Firestore ולא ירידה אמיתית בנתונים —
// עוצרים ולא דורסים גיבוי תקין בגיבוי חלקי (אותו רעיון כמו ה-ratchet
// ב-to_portal.py של הסקרייפר).
//
// דורש שני סודות (Settings → Secrets and variables → Actions):
//   FIREBASE_SERVICE_ACCOUNT — כבר קיים בריפו הזה (משמש גם את Account tools)
//   BACKUP_REPO_TOKEN — Personal Access Token מסוג fine-grained, בהרשאת
//     Contents: Read and write, מוגבל אך ורק לריפו ttc-mvh-backups
import admin from "firebase-admin";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const COLLECTIONS = ["attendance", "cancellations", "players"];
const BACKUP_DIR = "backup-repo";
const BACKUP_REPO = "shahar1987/ttc-mvh-backups";

function sh(cmd, args, opts = {}) {
  execFileSync(cmd, args, { stdio: "inherit", ...opts });
}

async function dumpCollection(db, name) {
  const snap = await db.collection(name).get();
  const docs = {};
  snap.forEach((d) => {
    docs[d.id] = d.data();
  });
  return docs;
}

async function main() {
  let sa;
  try {
    sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT is not valid JSON");
  }
  if (!sa.project_id) throw new Error("missing repository secret FIREBASE_SERVICE_ACCOUNT");
  const token = process.env.BACKUP_REPO_TOKEN;
  if (!token) throw new Error("missing repository secret BACKUP_REPO_TOKEN");

  admin.initializeApp({ credential: admin.credential.cert(sa) });
  const db = admin.firestore();

  sh("git", [
    "clone",
    "--depth",
    "1",
    `https://x-access-token:${token}@github.com/${BACKUP_REPO}.git`,
    BACKUP_DIR,
  ]);

  let aborted = false;
  for (const name of COLLECTIONS) {
    const data = await dumpCollection(db, name);
    const count = Object.keys(data).length;
    const outPath = `${BACKUP_DIR}/${name}.json`;

    if (fs.existsSync(outPath)) {
      const prev = JSON.parse(fs.readFileSync(outPath, "utf8"));
      const prevCount = Object.keys(prev).length;
      if (prevCount > 0 && count < prevCount / 2) {
        console.error(
          `${name}: ${count} records, was ${prevCount} — ירידה חדה, כנראה קריאה חלקית. מדלג ולא דורס.`,
        );
        aborted = true;
        continue;
      }
    }
    fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
    console.log(`${name}: ${count} records`);
  }

  sh("git", ["config", "user.name", "Attendance backup bot"], { cwd: BACKUP_DIR });
  sh("git", ["config", "user.email", "actions@users.noreply.github.com"], { cwd: BACKUP_DIR });
  sh("git", ["add", ...COLLECTIONS.map((c) => `${c}.json`)], { cwd: BACKUP_DIR });

  const status = execFileSync("git", ["status", "--porcelain"], { cwd: BACKUP_DIR }).toString().trim();
  if (!status) {
    console.log("no change since the previous backup");
  } else {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
    sh("git", ["commit", "-m", `גיבוי יומי ${today}`], { cwd: BACKUP_DIR });
    sh("git", ["push"], { cwd: BACKUP_DIR });
    console.log("backup pushed");
  }

  if (aborted) {
    throw new Error("one or more collections were skipped — see log above");
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
