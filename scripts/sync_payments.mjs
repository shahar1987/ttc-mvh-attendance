// מסנכרן מדי שבוע את רשימת "מי לא משלם" מקובץ שהמנהל מעדכן בדרייב אל Firestore.
//
// איך זה עובד:
//   1. מתחברים לדרייב עם אותו service account של Firebase (FIREBASE_SERVICE_ACCOUNT),
//      שכבר שותף כ-Viewer בתיקיית הדרייב הייעודית (ראה DRIVE_FOLDER_ID למטה).
//   2. מאתרים את הקובץ שעודכן לאחרונה בתיקייה (גיליון גוגל או CSV) ומייצאים אותו.
//   3. כל שורה = שם שחקן (עמודה עם "שם") ואופציונלי שם קבוצה (עמודה עם "קבוצה"),
//      שמסמנים כ"לא משלם". שמות מותאמים לשחקנים קיימים באוסף players.
//   4. מעדכנים players.notPaying בהתאם. שחקן שסומן ידנית באפליקציה (notPayingSource
//      === "manual") לא נדרס אוטומטית כשהוא לא מופיע ברשימה השבועית — רק המנהל
//      שמסיר אותו ידנית מסיר את הסימון. סנכרון אוטומטי (source "sync") כן מתעדכן
//      בכל ריצה כדי לשקף את הקובץ הנוכחי.
//   5. נכתב סיכום ל-system/paymentSync (נקרא במסך "מי לא משלם" באפליקציה).
//
// חשוב לפרטיות: הריפו ציבורי והיומנים גלויים לכולם, ולכן שמות שחקנים לעולם לא
// מודפסים ליומן ההרצה — רק מספרים. שמות "לא זוהו" נשמרים ב-Firestore (מוגן
// בהרשאות) ומוצגים באפליקציה למנהל בלבד.
//
// דורש סוד קיים: FIREBASE_SERVICE_ACCOUNT (כבר משמש את admin_tool.mjs ו-backup).
import admin from "firebase-admin";
import { JWT } from "google-auth-library";

const DRIVE_FOLDER_ID = "1BDA-dBIcalpI1O4lllsDlNbk1nZ-OwFM"; // "תשלומים - מועדון טניס שולחן מבואות החרמון"

function normalise(s) {
  return (s || "").trim().replace(/\s+/g, " ");
}

function parseCsv(text) {
  let rows = [];
  let lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.length > 0);
  for (let line of lines) {
    let cells = [],
      cur = "",
      inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      let ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            cur += '"';
            i++;
          } else inQuotes = false;
        } else cur += ch;
      } else if (ch === '"') inQuotes = true;
      else if (ch === ",") {
        cells.push(cur);
        cur = "";
      } else cur += ch;
    }
    cells.push(cur);
    rows.push(cells.map((c) => c.trim()));
  }
  return rows;
}

async function driveFetch(url, token) {
  let r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Drive request failed (${r.status}): ${url}`);
  return r;
}

async function main() {
  let sa;
  try {
    sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT is not valid JSON");
  }
  if (!sa.project_id) throw new Error("missing repository secret FIREBASE_SERVICE_ACCOUNT");

  admin.initializeApp({ credential: admin.credential.cert(sa) });
  const db = admin.firestore();

  const jwt = new JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
  const { token } = await jwt.getAccessToken();
  if (!token) throw new Error("could not obtain a Drive access token — check that Drive API is enabled");

  // שלב 1: איתור הקובץ שעודכן לאחרונה בתיקייה
  const q = encodeURIComponent(`'${DRIVE_FOLDER_ID}' in parents and trashed = false`);
  const listRes = await driveFetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=modifiedTime desc&fields=files(id,name,mimeType,modifiedTime)&pageSize=5`,
    token,
  );
  const files = (await listRes.json()).files || [];
  if (!files.length) {
    console.error("לא נמצא אף קובץ בתיקיית הדרייב — לא בוצע עדכון");
    process.exit(1);
  }
  const file = files[0];
  console.log(`נמצא קובץ עדכני, עודכן ב-${file.modifiedTime}`);

  // שלב 2: הורדת התוכן כ-CSV
  let csvText;
  if (file.mimeType === "application/vnd.google-apps.spreadsheet") {
    csvText = await (
      await driveFetch(
        `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=text/csv`,
        token,
      )
    ).text();
  } else {
    csvText = await (
      await driveFetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, token)
    ).text();
  }

  // שלב 3: פענוח השורות
  const rows = parseCsv(csvText);
  if (!rows.length) {
    console.log("הקובץ ריק — אין שינוי");
    await db.collection("system").doc("paymentSync").set(
      {
        updatedAt: new Date().toISOString(),
        sourceFile: file.name,
        sourceModifiedTime: file.modifiedTime,
        matchedCount: 0,
        unmatchedCount: 0,
        unmatchedNames: [],
      },
      { merge: true },
    );
    return;
  }
  const header = rows[0];
  let nameCol = header.findIndex((h) => h.includes("שם"));
  let groupCol = header.findIndex((h) => h.includes("קבוצה"));
  if (nameCol === -1) nameCol = 0;
  const dataRows = rows.slice(1).filter((r) => r[nameCol] && r[nameCol].trim());

  // שלב 4: התאמה לשחקנים קיימים
  const playersSnap = await db.collection("players").get();
  const players = playersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const groupsSnap = await db.collection("groups").get();
  const groupsByName = new Map(
    groupsSnap.docs.map((d) => [normalise(d.data().name), d.id]),
  );

  const playersByName = new Map();
  for (const p of players) {
    if (p.deleted || p.isActive === false) continue;
    const key = normalise(p.name);
    if (!key) continue;
    if (!playersByName.has(key)) playersByName.set(key, []);
    playersByName.get(key).push(p);
  }

  const matchedIds = new Set();
  const unmatchedNames = [];
  for (const row of dataRows) {
    const rawName = row[nameCol];
    const rawGroup = groupCol !== -1 ? row[groupCol] : "";
    const key = normalise(rawName);
    const candidates = playersByName.get(key) || [];
    if (candidates.length === 1) {
      matchedIds.add(candidates[0].id);
      continue;
    }
    if (candidates.length > 1 && rawGroup) {
      const gid = groupsByName.get(normalise(rawGroup));
      const narrowed = candidates.filter((c) => c.groupId === gid);
      if (narrowed.length === 1) {
        matchedIds.add(narrowed[0].id);
        continue;
      }
    }
    unmatchedNames.push(rawName);
  }

  // שלב 5: כתיבה ל-Firestore. שחקן שסומן ידנית (source "manual") לא נדרס.
  const batch = db.batch();
  let writes = 0;
  for (const p of players) {
    const shouldBeNotPaying = matchedIds.has(p.id);
    if (shouldBeNotPaying && !p.notPaying) {
      batch.set(
        db.collection("players").doc(p.id),
        { notPaying: true, notPayingSource: "sync" },
        { merge: true },
      );
      writes++;
    } else if (!shouldBeNotPaying && p.notPaying && p.notPayingSource !== "manual") {
      batch.set(
        db.collection("players").doc(p.id),
        { notPaying: false, notPayingSource: "sync" },
        { merge: true },
      );
      writes++;
    }
  }
  if (writes) await batch.commit();

  await db.collection("system").doc("paymentSync").set(
    {
      updatedAt: new Date().toISOString(),
      sourceFile: file.name,
      sourceModifiedTime: file.modifiedTime,
      matchedCount: matchedIds.size,
      unmatchedCount: unmatchedNames.length,
      unmatchedNames,
    },
    { merge: true },
  );

  // רק מספרים ליומן הציבורי — לעולם לא שמות
  console.log(
    `הסתיים: ${matchedIds.size} שחקנים הותאמו, ${unmatchedNames.length} שמות לא זוהו, ${writes} עדכונים נכתבו`,
  );
}

main().catch((err) => {
  console.error("שגיאה בסנכרון התשלומים: " + (err.message || err));
  process.exit(1);
});
