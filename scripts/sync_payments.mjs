// מסנכרן את רשימת "מי לא משלם" מקובץ שהמנהל מעלה לדרייב אל Firestore.
//
// גרסה 2 (2026-09-14): הקובץ שמועלה עכשיו הוא רשימת "מי כן שילם" (ייצוא
// מהמתנ"ס), לא רשימת "מי לא משלם" כמו בגרסה הראשונה — הלוגיקה כאן הפוכה
// בהתאם: מי ששייך לקבוצה ממופה ולא נמצא בקובץ מסומן כלא משלם.
//
// איך זה עובד:
//   1. מתחברים לדרייב עם אותו service account של Firebase (FIREBASE_SERVICE_ACCOUNT).
//   2. טוענים את טבלת המיפוי (paymentMappings) — שם קבוצה כפי שמופיע בקובץ
//      המתנ"ס <-> קבוצה באפליקציה + אימונים בשבוע. ניתנת לעריכה מלאה
//      באפליקציה (מסך "מי לא משלם"); אם ריקה, נזרעת כאן פעם אחת מתוך
//      DEFAULT_PAYMENT_MAPPINGS (אותה רשימת ברירת מחדל שגם האפליקציה מכירה).
//      קבוצת "חוגים רמת כורזים" מוחרגת לגמרי ולעולם לא נבדקת, וכל קבוצה בלי
//      שורת מיפוי כלל לא נבדקת (לא נוגעים בסימון שלה).
//   3. מאתרים את הקובץ שעודכן לאחרונה בתיקייה הייעודית (גיליון גוגל, CSV או
//      קובץ Excel בינארי שהורד מהמתנ"ס) ומפענחים אותו.
//   4. לכל שורה בקובץ: מזהים לאיזו קבוצה באפליקציה היא שייכת דרך המיפוי,
//      ומנסים להתאים שם שחקן (שם מלא, או משפחה+פרטי בנפרד, בשני סדרים
//      אפשריים) לשחקן פעיל באותה קבוצה בלבד. שחקן שנמצא בוודאות = שילם.
//   5. כל שחקן פעיל בקבוצה ממופה (ולא מוחרגת) שלא נמצא בקובץ מסומן
//      notPaying=true. שחקן שסומן ידנית באפליקציה (notPayingSource === "manual")
//      לא נדרס אוטומטית — רק המנהל שמשנה אותו ידנית משנה אותו. סימוני sync
//      מתעדכנים בכל ריצה כדי לשקף את הקובץ הנוכחי.
//   6. נכתב סיכום ל-system/paymentSync (נקרא במסך "מי לא משלם" באפליקציה).
//
// חשוב לפרטיות: הריפו ציבורי והיומנים גלויים לכולם, ולכן שמות שחקנים לעולם לא
// מודפסים ליומן ההרצה — רק מספרים. שמות/קבוצות "לא זוהו" נשמרים ב-Firestore
// (מוגן בהרשאות) ומוצגים באפליקציה למנהל בלבד.
//
// דורש סוד קיים: FIREBASE_SERVICE_ACCOUNT (כבר משמש את admin_tool.mjs ו-backup).
// דורש חבילת npm נוספת: xlsx (לפענוח קבצי Excel בינאריים שמועלים ישירות).
import admin from "firebase-admin";
import { JWT } from "google-auth-library";
import * as XLSX from "xlsx";

const DRIVE_FOLDER_ID = "1BDA-dBIcalpI1O4lllsDlNbk1nZ-OwFM"; // "תשלומים - מועדון טניס שולחן מבואות החרמון"
const PAYMENT_EXCLUDED_GROUP_NAME = "חוגים רמת כורזים";

// זהה לרשימת ברירת המחדל שבאפליקציה (part-b.js, DEFAULT_PAYMENT_MAPPINGS) —
// משמשת רק לזריעה חד-פעמית אם האוסף paymentMappings עדיין ריק. אחרי הזריעה
// הראשונה שני הצדדים קוראים מ-Firestore בלבד ועורכים שם; אם משנים כאן יש
// לשקף גם שם (ולהפך) כדי שלא יתבלבלו זו מזו.
const DEFAULT_PAYMENT_MAPPINGS = [
  { mtnsLabel: 'טנ"ש דפנה בוגרים 1', groupId: "6ROF53McGgHRz2VsQG6Z", sessionsPerWeek: 1, note: "שני או חמישי" },
  { mtnsLabel: 'טנ"ש דפנה בוגרים 2', groupId: "6ROF53McGgHRz2VsQG6Z", sessionsPerWeek: 2, note: "לאשר — שני וחמישי" },
  { mtnsLabel: 'טנ"ש ישוב מתחילים 2', groupId: "fDzvQ3QoyY1fAQhPCaTG", sessionsPerWeek: 2, note: "לאשר — ראשון וחמישי" },
  { mtnsLabel: 'טנ"ש ישוב מתקדמים 2', groupId: "bM8Yl9Az2vhFBQJ3CXJ4", sessionsPerWeek: 2, note: "לאשר — הקבוצה בפועל מתאמנת 3 פעמים בשבוע, זה רישום חלקי" },
  { mtnsLabel: 'טנ"ש ישוב מתקדמים 3', groupId: "bM8Yl9Az2vhFBQJ3CXJ4", sessionsPerWeek: 3, note: "ראשון, שני וחמישי" },
  { mtnsLabel: 'טנ"ש כורזים מתחיל 1', groupId: "NVeFs6lOj2QgEaoB6DmO", sessionsPerWeek: 1, note: "לאשר — שני או רביעי" },
  { mtnsLabel: 'טנ"ש כורזים מתחיל 2', groupId: "NVeFs6lOj2QgEaoB6DmO", sessionsPerWeek: 2, note: "שני ורביעי" },
  { mtnsLabel: 'טנ"ש כורזים בוגרים 2', groupId: "SbtjPwNpIHRsLlOy2JwK", sessionsPerWeek: 2, note: "שני ורביעי" },
  { mtnsLabel: 'טנ"ש מבח"ר', groupId: "W0xfmRmSDEAzvM2E1ITF", sessionsPerWeek: 1, note: "יום ראשון — בקובץ אין מספר ליד השם" },
  { mtnsLabel: 'טנ"ש סגל ליגות', groupId: "VyDxCfZhhzTMmDmUj0C1", sessionsPerWeek: 2, note: "בקובץ אין מספר ליד השם — זו האפשרות היחידה" },
  { mtnsLabel: 'טנ"ש סטודנטים דפנה 1', groupId: "6ROF53McGgHRz2VsQG6Z", sessionsPerWeek: 1, note: "לאשר — האם זו אותה קבוצה כמו דפנה בוגרים?" },
];

export function normalise(s) {
  return (s || "").toString().trim().replace(/\s+/g, " ");
}

export function parseCsv(text) {
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

// ממיר את הקובץ שהתקבל מהדרייב למערך שורות (מערך של מערכי תאים), בין אם זה
// CSV/גיליון גוגל מיוצא (טקסט) או קובץ Excel בינארי אמיתי שהועלה ידנית.
export function rowsFromFile(buffer, { isSpreadsheetExport }) {
  if (isSpreadsheetExport) {
    return parseCsv(buffer.toString("utf8"));
  }
  try {
    const wb = XLSX.read(buffer, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils
      .sheet_to_json(sheet, { header: 1, defval: "", raw: false })
      .map((r) => r.map((c) => normalise(c)));
  } catch {
    // לא Excel בינארי — כנראה CSV/טקסט רגיל שהועלה ישירות
    return parseCsv(buffer.toString("utf8"));
  }
}

// מזהה את עמודות הקובץ: או עמודת "שם" משולבת, או משפחה+פרטי בנפרד, ועמודת קבוצה.
export function detectColumns(header) {
  const find = (pred) => header.findIndex(pred);
  const groupCol = find((h) => h.includes("קבוצה"));
  const familyCol = find((h) => h.includes("תושב") && h.includes("משפחה"));
  const personalCol = find((h) => h.includes("תושב") && h.includes("פרטי"));
  const nameCol = familyCol === -1 || personalCol === -1 ? find((h) => h.includes("שם")) : -1;
  return { groupCol, familyCol, personalCol, nameCol };
}

// שמות מועמדים מהשורה (עד שניים — הסדר "משפחה פרטי" ו"פרטי משפחה", כי לא
// תמיד ידוע איך שם השחקן שמור באפליקציה).
export function candidateNames(row, cols) {
  if (cols.familyCol !== -1 && cols.personalCol !== -1) {
    const family = normalise(row[cols.familyCol]);
    const personal = normalise(row[cols.personalCol]);
    if (!family && !personal) return [];
    return [normalise(`${family} ${personal}`), normalise(`${personal} ${family}`)];
  }
  if (cols.nameCol !== -1) {
    const n = normalise(row[cols.nameCol]);
    return n ? [n] : [];
  }
  return [];
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

  // שלב 1: קבוצות + טבלת המיפוי (זריעה חד-פעמית אם ריקה — ה-Admin SDK תמיד
  // עוקף את חוקי ה-Firestore, כך שזה עובד גם אם חוקי הקליינט עוד לא פורסמו)
  const groupsSnap = await db.collection("groups").get();
  const groups = groupsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const excludedGroupIds = new Set(
    groups.filter((g) => g.name === PAYMENT_EXCLUDED_GROUP_NAME).map((g) => g.id),
  );

  let mappingSnap = await db.collection("paymentMappings").get();
  if (mappingSnap.empty) {
    const flagRef = db.collection("system").doc("paymentMappingsSeeded");
    const flagSnap = await flagRef.get();
    if (!flagSnap.exists) {
      const batch = db.batch();
      DEFAULT_PAYMENT_MAPPINGS.forEach((row, idx) =>
        batch.set(db.collection("paymentMappings").doc(`seed-${idx}`), row),
      );
      batch.set(flagRef, { seededAt: new Date().toISOString() });
      await batch.commit();
      mappingSnap = await db.collection("paymentMappings").get();
    }
  }
  const mappings = mappingSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((m) => m.mtnsLabel && m.groupId && !excludedGroupIds.has(m.groupId));
  const mappingByLabel = new Map(mappings.map((m) => [normalise(m.mtnsLabel), m]));
  const coveredGroupIds = new Set(mappings.map((m) => m.groupId));

  // שלב 2: איתור הקובץ שעודכן לאחרונה בתיקייה
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

  // שלב 3: הורדת התוכן (כ-CSV אם זה גיליון גוגל, אחרת כבינארי גולמי — עשוי
  // להיות קובץ Excel אמיתי) ופענוח לשורות
  const isSpreadsheetExport = file.mimeType === "application/vnd.google-apps.spreadsheet";
  let buffer;
  if (isSpreadsheetExport) {
    const text = await (
      await driveFetch(
        `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=text/csv`,
        token,
      )
    ).text();
    buffer = Buffer.from(text, "utf8");
  } else {
    const arrayBuf = await (
      await driveFetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, token)
    ).arrayBuffer();
    buffer = Buffer.from(arrayBuf);
  }
  const rows = rowsFromFile(buffer, { isSpreadsheetExport });
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
        unmatchedGroupLabels: [],
      },
      { merge: true },
    );
    return;
  }
  const header = rows[0];
  const cols = detectColumns(header);
  const dataRows = rows.slice(1).filter((r) => r.some((c) => (c || "").trim()));

  // שלב 4: התאמת כל שורה לשחקן פעיל, דרך המיפוי
  const playersSnap = await db.collection("players").get();
  const players = playersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const activeByGroup = new Map();
  for (const p of players) {
    if (p.deleted || p.isActive === false) continue;
    if (!activeByGroup.has(p.groupId)) activeByGroup.set(p.groupId, []);
    activeByGroup.get(p.groupId).push(p);
  }

  const paidIds = new Set();
  const unmatchedNames = [];
  const unmatchedGroupLabelsSet = new Set();
  for (const row of dataRows) {
    const rawGroupLabel = cols.groupCol !== -1 ? normalise(row[cols.groupCol]) : "";
    const mapping = rawGroupLabel ? mappingByLabel.get(rawGroupLabel) : null;
    if (rawGroupLabel && !mapping) {
      unmatchedGroupLabelsSet.add(rawGroupLabel);
      continue; // אין מיפוי לקבוצה הזו — לא ניתן לשייך לקבוצה באפליקציה, מדלגים
    }
    if (!mapping) continue;
    const pool = activeByGroup.get(mapping.groupId) || [];
    const names = candidateNames(row, cols);
    if (!names.length) continue;
    const nameSet = new Set(names);
    const candidates = pool.filter((p) => nameSet.has(normalise(p.name)));
    if (candidates.length === 1) {
      paidIds.add(candidates[0].id);
    } else {
      // 0 התאמות, או יותר מהתאמה אחת (שני ילדים באותו שם) — לא ניתן לשייך
      // באופן חד-משמעי, כדי לא לסמן ילד לא נכון כמי ששילם.
      unmatchedNames.push(names[0]);
    }
  }

  // שלב 5: כתיבה ל-Firestore — כל שחקן פעיל בקבוצה ממופה (ולא מוחרגת) ולא
  // נמצא ברשימת ה"שילמו" מסומן notPaying. שחקן שסומן ידנית (source "manual")
  // לא נדרס.
  const batch = db.batch();
  let writes = 0;
  for (const p of players) {
    if (p.deleted || p.isActive === false) continue;
    if (!coveredGroupIds.has(p.groupId)) continue; // קבוצה בלי מיפוי, או מוחרגת — לא נוגעים
    const shouldBeNotPaying = !paidIds.has(p.id);
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
      matchedCount: paidIds.size,
      unmatchedCount: unmatchedNames.length,
      unmatchedNames,
      unmatchedGroupLabels: Array.from(unmatchedGroupLabelsSet),
    },
    { merge: true },
  );

  // רק מספרים ליומן הציבורי — לעולם לא שמות
  console.log(
    `הסתיים: ${paidIds.size} שחקנים ששילמו זוהו, ${unmatchedNames.length} שמות מהקובץ לא זוהו, ` +
      `${unmatchedGroupLabelsSet.size} שמות קבוצה בקובץ בלי מיפוי, ${writes} עדכוני notPaying נכתבו`,
  );
}

main().catch((err) => {
  console.error("שגיאה בסנכרון התשלומים: " + (err.message || err));
  process.exit(1);
});
