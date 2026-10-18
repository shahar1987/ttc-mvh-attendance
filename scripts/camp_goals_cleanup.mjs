// חד-פעמי: מחיקת אוסף campGoals (אתר יעדי המחנה הושבת). מדפיס רק ספירה, בלי שמות.
import admin from 'firebase-admin';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = admin.firestore();
const snap = await db.collection('campGoals').get();
await db.recursiveDelete(db.collection('campGoals'));
const left = (await db.collection('campGoals').limit(1).get()).size;
console.log(`::notice title=campGoals::deleted ${snap.size} docs, left ${left}`);
if (left) process.exit(1);
