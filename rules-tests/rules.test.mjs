import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where, addDoc, writeBatch } from 'firebase/firestore';
import fs from 'fs';

// emulators:exec מגדיר את FIRESTORE_EMULATOR_HOST; ברירת המחדל לפי firebase.json
const [emuHost, emuPort] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8181').split(':');
const env = await initializeTestEnvironment({
  projectId: 'demo-ttcmh',
  firestore: { host: emuHost, port: Number(emuPort), rules: fs.readFileSync('firestore.rules', 'utf8') },
});

const FAR = Date.now() + 30 * 24 * 3600 * 1000;
const A1 = 'attendance/2026-09-18_gA_p1';
const A2 = 'attendance/2026-09-18_gB_p2';

await env.withSecurityRulesDisabled(async (c) => {
  const d = c.firestore();
  await setDoc(doc(d, 'users/admin1'),  { role: 'Admin', name: 'שולה', phone: '0500000001' });
  await setDoc(doc(d, 'users/coachA'),  { role: 'Coach', name: 'מאמן א', permissions: ['access', 'competitions'] });
  await setDoc(doc(d, 'users/coachB'),  { role: 'Coach', name: 'מאמן ב', permissions: ['competitions'] });
  await setDoc(doc(d, 'users/viewer1'), { role: 'Viewer', name: 'צופה', permissions: ['reports'] });
  await setDoc(doc(d, 'users/parent1'), { role: 'Member', name: 'הורה', phone: '0500000009' });
  await setDoc(doc(d, 'users/parent2'), { role: 'Member', name: 'הורה אחר' });

  await setDoc(doc(d, 'groups/gA'), { name: 'קבוצה א', coachId: 'coachA', coachIds: ['coachA'] });
  await setDoc(doc(d, 'groups/gB'), { name: 'פרקינסון', coachId: 'coachB', coachIds: ['coachB'] });

  await setDoc(doc(d, 'players/p1'), { name: 'ילד א', groupId: 'gA', parentPhone: '0500000009' });
  await setDoc(doc(d, 'players/p2'), { name: 'ילד ב', groupId: 'gB', parentPhone: '0500000010' });

  // מזהים לפי חוזה השמירה: date_groupId_playerId
  await setDoc(doc(d, A1), { playerId: 'p1', groupId: 'gA', date: '2026-09-18', status: 'Present' });
  await setDoc(doc(d, A2), { playerId: 'p2', groupId: 'gB', date: '2026-09-18', status: 'Absent' });
  await setDoc(doc(d, 'players/p3'), { name: 'ילד ג', groupId: 'gA' });
  // רשומות ישנות שלא עומדות בחוזה: מזהה לא תואם, סטטוס מוזר, שדה חסר
  await setDoc(doc(d, 'attendance/legacyX'), { playerId: 'p1', groupId: 'gA', date: '2026-01-05', status: 'Late' });
  await setDoc(doc(d, 'attendance/legacyNoDate'), { playerId: 'p3', groupId: 'gA', status: 'present' });

  await setDoc(doc(d, 'links/parent1_p1'), { uid: 'parent1', playerId: 'p1', relation: 'parent' });

  await setDoc(doc(d, 'invites/tok_open'),    { phone: '0500000077', displayName: 'הורה חדש', playerIds: ['p2'], playerNames: ['ילד ב'], revoked: false, usedAt: null, expiresAtMs: FAR });
  await setDoc(doc(d, 'invites/tok_revoked'), { phone: '0500000078', playerIds: ['p1'], revoked: true,  usedAt: null, expiresAtMs: FAR });
  await setDoc(doc(d, 'invites/tok_expired'), { phone: '0500000079', playerIds: ['p1'], revoked: false, usedAt: null, expiresAtMs: Date.now() - 1000 });
  // הזמנה עם שני ילדים, בדיוק בצורה ש-createInvite כותב
  await setDoc(doc(d, 'invites/tok_two'),     { phone: '0500000080', displayName: 'הורה של שניים', playerIds: ['p1', 'p3'], playerNames: ['ילד א', 'ילד ג'], relation: 'parent', createdBy: 'coachA', createdAt: 'x', expiresAt: 'x', expiresAtMs: FAR, usedAt: null, usedByUid: null, revoked: false });
  // הזמנה שכבר מומשה על ידי מישהו אחר
  await setDoc(doc(d, 'invites/tok_used'),    { phone: '0500000081', playerIds: ['p1'], revoked: false, usedAt: '2026-09-01T10:00:00Z', usedByUid: 'realParent', expiresAtMs: FAR });
  // הזמנה ישנה, בלי השדות usedAt/usedByUid בכלל
  await setDoc(doc(d, 'invites/tok_legacy'),  { phone: '0500000082', playerIds: ['p3'], revoked: false, expiresAtMs: FAR });

  await setDoc(doc(d, 'tournaments/t1'), { name: 'אליפות המועדון' });
  await setDoc(doc(d, 'tournaments/zz-connection-test'), { ping: 1, by: 'admin1' });
  await setDoc(doc(d, 'system/paymentSync'), { at: 'x' });
  await setDoc(doc(d, 'paymentMappings/m1'), { from: 'x', to: 'gA' });
});

const as = (uid) => env.authenticatedContext(uid).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const stranger = () => env.authenticatedContext('randomGoogleUser').firestore();  // signed in, no profile

let pass = 0, fail = 0;
const t = async (name, fn) => {
  try { await fn(); console.log('  ✔ ' + name); pass++; }
  catch (e) { console.log('  ✘ ' + name + '\n      ' + String(e.message).split('\n')[0]); fail++; }
};

console.log('\n— זר מחובר עם חשבון גוגל כלשהו, בלי פרופיל —');
await t('לא קורא את רשימת המשתמשים', () => assertFails(getDocs(collection(stranger(), 'users'))));
await t('לא קורא פרופיל של מישהו אחר', () => assertFails(getDoc(doc(stranger(), 'users/admin1'))));
await t('לא קורא את רשימת ההזמנות', () => assertFails(getDocs(collection(stranger(), 'invites'))));
await t('לא קורא את רשימת השחקנים', () => assertFails(getDocs(collection(stranger(), 'players'))));

console.log('\n— הורה (Member) —');
await t('לא שולף את כל השחקנים', () => assertFails(getDocs(collection(as('parent1'), 'players'))));
await t('לא שולף את כל הנוכחות', () => assertFails(getDocs(collection(as('parent1'), 'attendance'))));
await t('לא קורא את רשימת המשתמשים', () => assertFails(getDocs(collection(as('parent1'), 'users'))));
await t('לא קורא כרטיס של ילד שאינו שלו', () => assertFails(getDoc(doc(as('parent1'), 'players/p2'))));
await t('לא קורא נוכחות של ילד אחר', () => assertFails(getDoc(doc(as('parent1'), A2))));
await t('לא מוחק תחרות', () => assertFails(deleteDoc(doc(as('parent1'), 'tournaments/t1'))));
await t('לא קורא את מסמכי המערכת', () => assertFails(getDoc(doc(as('parent1'), 'system/paymentSync'))));
await t('לא קורא את מיפוי התשלומים', () => assertFails(getDocs(collection(as('parent1'), 'paymentMappings'))));
await t('כן קורא את הפרופיל של עצמו', () => assertSucceeds(getDoc(doc(as('parent1'), 'users/parent1'))));
await t('כן קורא את כרטיס הילד שלו', () => assertSucceeds(getDoc(doc(as('parent1'), 'players/p1'))));
await t('כן קורא את הנוכחות של הילד שלו', () => assertSucceeds(getDocs(query(collection(as('parent1'), 'attendance'), where('playerId', 'in', ['p1'])))));
await t('כן קורא את הקישורים של עצמו', () => assertSucceeds(getDocs(query(collection(as('parent1'), 'links'), where('uid', '==', 'parent1')))));
await t('כן קורא קבוצות והודעות', async () => { await assertSucceeds(getDocs(collection(as('parent1'), 'groups'))); await assertSucceeds(getDocs(collection(as('parent1'), 'cancellations'))); });
await t('כן קורא ומנהל תחרויות', async () => { await assertSucceeds(getDocs(collection(as('parent1'), 'tournaments'))); await assertSucceeds(setDoc(doc(as('parent1'), 'tournaments/t9'), { name: 'חדש' })); });

console.log('\n— מאמן —');
await t('לא מושך אליו רשומת נוכחות של קבוצה אחרת', () => assertFails(updateDoc(doc(as('coachA'), A2), { groupId: 'gA', status: 'Present' })));
await t('לא מעביר רשומה משלו לקבוצה אחרת', () => assertFails(updateDoc(doc(as('coachA'), A1), { groupId: 'gB' })));
await t('כן מעדכן נוכחות בקבוצה שלו', () => assertSucceeds(updateDoc(doc(as('coachA'), A1), { status: 'Absent' })));
await t('כן יוצר נוכחות בקבוצה שלו', () => assertSucceeds(setDoc(doc(as('coachA'), 'attendance/2026-09-19_gA_p1'), { playerId: 'p1', groupId: 'gA', date: '2026-09-19', status: 'Present' })));
await t('לא יוצר נוכחות בקבוצה של אחר', () => assertFails(setDoc(doc(as('coachA'), 'attendance/2026-09-19_gB_p2'), { playerId: 'p2', groupId: 'gB', date: '2026-09-19', status: 'Present' })));
await t('לא משנה תפקיד למשתמש אחר', () => assertFails(updateDoc(doc(as('coachA'), 'users/coachB'), { role: 'Admin' })));
await t('לא מעניק לעצמו הרשאות', () => assertFails(updateDoc(doc(as('coachA'), 'users/coachA'), { permissions: ['payments'] })));
await t('לא מוחק שחקן', () => assertFails(deleteDoc(doc(as('coachA'), 'players/p1'))));
await t('כן קורא את רשימת השחקנים והמשתמשים', async () => { await assertSucceeds(getDocs(collection(as('coachA'), 'players'))); await assertSucceeds(getDocs(collection(as('coachA'), 'users'))); });

console.log('\n— צופה —');
await t('כן קורא שחקנים ונוכחות', async () => { await assertSucceeds(getDocs(collection(as('viewer1'), 'players'))); await assertSucceeds(getDocs(collection(as('viewer1'), 'attendance'))); });
await t('לא כותב נוכחות', () => assertFails(setDoc(doc(as('viewer1'), 'attendance/2026-09-20_gA_p1'), { playerId: 'p1', groupId: 'gA', date: '2026-09-20', status: 'Present' })));
await t('לא מוחק תחרות (אין לו הרשאת תחרויות)', () => assertFails(deleteDoc(doc(as('viewer1'), 'tournaments/t1'))));

console.log('\n— הרשמת הורה דרך קישור הזמנה —');
await t('קורא את ההזמנה לפני התחברות', () => assertSucceeds(getDoc(doc(anon(), 'invites/tok_open'))));
await t('יוצר לעצמו פרופיל Member עם טוקן חי', () => assertSucceeds(setDoc(doc(as('newParent'), 'users/newParent'), { name: 'הורה חדש', role: 'Member', phone: '0500000077', inviteToken: 'tok_open', createdAt: 'now' })));
await t('יוצר את הקישור לילד שבהזמנה', () => assertSucceeds(setDoc(doc(as('newParent'), 'links/newParent_p2'), { uid: 'newParent', playerId: 'p2', relation: 'parent', inviteToken: 'tok_open', createdAt: 'now' })));
await t('מסמן את ההזמנה כמומשה', () => assertSucceeds(updateDoc(doc(as('newParent'), 'invites/tok_open'), { usedAt: 'now', usedByUid: 'newParent' })));
await t('ואז באמת רואה את הילד שלו', () => assertSucceeds(getDoc(doc(as('newParent'), 'players/p2'))));

console.log('\n— ניסיונות ניצול של ההרשמה —');
await t('לא יוצר פרופיל של מנהל', () => assertFails(setDoc(doc(as('evil1'), 'users/evil1'), { name: 'x', role: 'Admin', inviteToken: 'tok_open' })));
await t('לא יוצר פרופיל עם הרשאות', () => assertFails(setDoc(doc(as('evil2'), 'users/evil2'), { name: 'x', role: 'Member', permissions: ['payments'], inviteToken: 'tok_open' })));
await t('לא יוצר פרופיל בלי טוקן', () => assertFails(setDoc(doc(as('evil3'), 'users/evil3'), { name: 'x', role: 'Member' })));
await t('לא יוצר פרופיל עם טוקן שבוטל', () => assertFails(setDoc(doc(as('evil4'), 'users/evil4'), { name: 'x', role: 'Member', inviteToken: 'tok_revoked' })));
await t('לא יוצר פרופיל עם טוקן שפג', () => assertFails(setDoc(doc(as('evil5'), 'users/evil5'), { name: 'x', role: 'Member', inviteToken: 'tok_expired' })));
await t('לא יוצר פרופיל למישהו אחר', () => assertFails(setDoc(doc(as('evil6'), 'users/admin1'), { name: 'x', role: 'Member', inviteToken: 'tok_open' })));
await t('לא מקשר את עצמו לילד שלא בהזמנה', () => assertFails(setDoc(doc(as('newParent'), 'links/newParent_p1'), { uid: 'newParent', playerId: 'p1', inviteToken: 'tok_open' })));
await t('לא מקשר בשם מישהו אחר', () => assertFails(setDoc(doc(as('newParent'), 'links/parent2_p2'), { uid: 'parent2', playerId: 'p2', inviteToken: 'tok_open' })));
await t('לא מוחק לעצמו את סימון המימוש', () => assertFails(updateDoc(doc(as('newParent'), 'invites/tok_open'), { revoked: false, playerIds: ['p1'] })));

console.log('\n— בקשות גישה מבחוץ —');
await t('טופס תקין עובר', () => assertSucceeds(addDoc(collection(anon(), 'accessRequests'), { name: 'הורה', phone: '0501111111', childName: 'ילד', relation: 'parent', note: '', status: 'pending', createdAt: '2026-09-20' })));
await t('שדה זר נחסם', () => assertFails(addDoc(collection(anon(), 'accessRequests'), { name: 'x', phone: 'y', status: 'pending', createdAt: 'z', junk: 'a'.repeat(100) })));
await t('טקסט ענק נחסם', () => assertFails(addDoc(collection(anon(), 'accessRequests'), { name: 'a'.repeat(5000), phone: 'y', status: 'pending', createdAt: 'z' })));
await t('סטטוס מאושר מראש נחסם', () => assertFails(addDoc(collection(anon(), 'accessRequests'), { name: 'x', phone: 'y', status: 'approved', createdAt: 'z' })));
await t('לא קורא את הבקשות', () => assertFails(getDocs(collection(anon(), 'accessRequests'))));

// ====================================================================
// נוכחות — כל נתיבי הכתיבה של האפליקציה, בדיוק בצורה שהם נשלחים
// ====================================================================
const rec = (date, groupId, playerId, status, by, extra = {}) =>
  ({ date, playerId, groupId, status, markedBy: by, updatedAt: '2026-09-21T18:00:00.000Z', ...extra });

console.log('\n— נוכחות: מסך הסימון (part-b, writeBatch) —');
await t('מאמן שומר יום חדש בבאץ\' (יצירה)', async () => {
  const db = as('coachA'); const b = writeBatch(db);
  b.set(doc(db, 'attendance/2026-09-21_gA_p1'), rec('2026-09-21', 'gA', 'p1', 'Present', 'coachA'));
  b.set(doc(db, 'attendance/2026-09-21_gA_p3'), rec('2026-09-21', 'gA', 'p3', 'Absent', 'coachA'));
  await assertSucceeds(b.commit());
});
await t('מאמן שומר מחדש יום קיים (set מלא, שומר msgSentAt קודם)', async () => {
  const db = as('coachA'); const b = writeBatch(db);
  b.set(doc(db, 'attendance/2026-09-21_gA_p1'), rec('2026-09-21', 'gA', 'p1', 'Absent', 'coachA'));
  b.set(doc(db, 'attendance/2026-09-21_gA_p3'), rec('2026-09-21', 'gA', 'p3', 'Absent', 'coachA', { msgSentAt: '2026-09-21T19:00:00Z', msgSentBy: 'coachA' }));
  await assertSucceeds(b.commit());
});
await t('מנהל שומר יום בכל קבוצה (יצירה ועדכון)', async () => {
  const db = as('admin1'); const b = writeBatch(db);
  b.set(doc(db, 'attendance/2026-09-21_gB_p2'), rec('2026-09-21', 'gB', 'p2', 'Present', 'admin1'));
  b.set(doc(db, 'attendance/2026-09-21_gA_p1'), rec('2026-09-21', 'gA', 'p1', 'Present', 'admin1'));
  await assertSucceeds(b.commit());
});
await t('מנהל מנקה סימון (מחיקה בבאץ\')', async () => {
  const db = as('admin1'); const b = writeBatch(db);
  b.delete(doc(db, 'attendance/2026-09-21_gB_p2'));
  await assertSucceeds(b.commit());
});
await t('מאמן לא מוחק רשומה (כמו קודם — רק מנהל)', () => assertFails(deleteDoc(doc(as('coachA'), 'attendance/2026-09-21_gA_p3'))));

console.log('\n— נוכחות: "נשלחה הודעה" (markAbsenceMsgSent, part-a) —');
await t('גרסה חדשה: updateDoc של msgSentAt/msgSentBy בלבד — מאמן', () =>
  assertSucceeds(updateDoc(doc(as('coachA'), 'attendance/2026-09-21_gA_p3'), { msgSentAt: '2026-09-22T08:00:00Z', msgSentBy: 'coachA' })));
await t('גרסה חדשה: updateDoc של msgSentAt/msgSentBy בלבד — מנהל, קבוצה אחרת', () =>
  assertSucceeds(updateDoc(doc(as('admin1'), A2), { msgSentAt: '2026-09-22T08:00:00Z', msgSentBy: 'admin1' })));
await t('גרסה חדשה: גיבוי כשאין רישום — setDoc merge מלא (יצירה)', () =>
  assertSucceeds(setDoc(doc(as('coachA'), 'attendance/2026-09-22_gA_p3'),
    { date: '2026-09-22', groupId: 'gA', playerId: 'p3', status: 'Absent', msgSentAt: 'x', msgSentBy: 'coachA' }, { merge: true })));
await t('גרסה ישנה: setDoc merge מלא על רישום קיים', () =>
  assertSucceeds(setDoc(doc(as('coachA'), 'attendance/2026-09-21_gA_p3'),
    { date: '2026-09-21', groupId: 'gA', playerId: 'p3', status: 'Absent', msgSentAt: 'y', msgSentBy: 'coachA' }, { merge: true })));
await t('מאמן לא מסמן הודעה על רשומה של קבוצה אחרת', () =>
  assertFails(updateDoc(doc(as('coachA'), A2), { msgSentAt: 'x', msgSentBy: 'coachA' })));
await t('גרסה חדשה: הגיבוי לא עוקף — merge על רשומה של קבוצה אחרת נחסם', () =>
  assertFails(setDoc(doc(as('coachA'), A2), { date: '2026-09-18', groupId: 'gB', playerId: 'p2', status: 'Absent', msgSentAt: 'x' }, { merge: true })));

console.log('\n— נוכחות: חוזה השמירה נאכף —');
await t('סטטוס לא מוכר נחסם (מאמן)', () => assertFails(setDoc(doc(as('coachA'), 'attendance/2026-09-23_gA_p1'), rec('2026-09-23', 'gA', 'p1', 'Late', 'coachA'))));
await t('סטטוס באותיות קטנות נחסם (מנהל)', () => assertFails(setDoc(doc(as('admin1'), 'attendance/2026-09-23_gA_p1'), rec('2026-09-23', 'gA', 'p1', 'present', 'admin1'))));
await t('רשומה בלי סטטוס נחסמת', () => assertFails(setDoc(doc(as('admin1'), 'attendance/2026-09-23_gA_p1'), { date: '2026-09-23', groupId: 'gA', playerId: 'p1' })));
await t('מזהה שלא תואם את השדות נחסם (מנהל)', () => assertFails(setDoc(doc(as('admin1'), 'attendance/random123'), rec('2026-09-23', 'gA', 'p1', 'Present', 'admin1'))));
await t('מזהה של שחקן אחר נחסם (מאמן)', () => assertFails(setDoc(doc(as('coachA'), 'attendance/2026-09-23_gA_p3'), rec('2026-09-23', 'gA', 'p1', 'Present', 'coachA'))));
await t('עדכון לסטטוס לא מוכר נחסם', () => assertFails(updateDoc(doc(as('coachA'), A1), { status: 'Maybe' })));
await t('מחיקת הסטטוס בעדכון נחסמת', async () => {
  const { deleteField } = await import('firebase/firestore');
  await assertFails(updateDoc(doc(as('admin1'), A1), { status: deleteField() }));
});
console.log('\n— נוכחות: רשומות ישנות שלא עומדות בחוזה —');
await t('מאמן מסמן msgSentAt על רשומה ישנה (מזהה לא תואם, סטטוס Late)', () =>
  assertSucceeds(updateDoc(doc(as('coachA'), 'attendance/legacyX'), { msgSentAt: 'x', msgSentBy: 'coachA' })));
await t('מאמן מסמן msgSentAt על רשומה ישנה בלי date', () =>
  assertSucceeds(updateDoc(doc(as('coachA'), 'attendance/legacyNoDate'), { msgSentAt: 'x', msgSentBy: 'coachA' })));
await t('מאמן מתקן רשומה ישנה ל-Present', () => assertSucceeds(updateDoc(doc(as('coachA'), 'attendance/legacyX'), { status: 'Present' })));
await t('מאמן מתקן רשומה ישנה ל-Absent', () => assertSucceeds(updateDoc(doc(as('coachA'), 'attendance/legacyNoDate'), { status: 'Absent' })));
await t('מאמן לא קובע ברשומה ישנה סטטוס Late', () => assertFails(updateDoc(doc(as('coachA'), 'attendance/legacyX'), { status: 'Late' })));
await t('לא מוסיף date לרשומה ישנה שחסר בה', () => assertFails(updateDoc(doc(as('coachA'), 'attendance/legacyNoDate'), { date: '2026-01-05' })));
await t('מאמן קבוצה אחרת לא נוגע ברשומה ישנה', () => assertFails(updateDoc(doc(as('coachB'), 'attendance/legacyX'), { msgSentAt: 'x' })));

await t('מנהל לא משנה playerId של רשומה', () => assertFails(updateDoc(doc(as('admin1'), A1), { playerId: 'p3' })));
await t('מנהל לא משנה date של רשומה', () => assertFails(updateDoc(doc(as('admin1'), A1), { date: '2026-09-19' })));
await t('מנהל לא משנה groupId של רשומה', () => assertFails(updateDoc(doc(as('admin1'), A1), { groupId: 'gB' })));

// ====================================================================
// הרשמה דרך הזמנה — הרצף המדויק של signUpFromInvite (part-a)
// users.set ← links.set לכל ילד ← invites.update(usedAt, usedByUid)
// ====================================================================
console.log('\n— הזמנה עם שני ילדים: הרצף המלא של האפליקציה —');
const NOW = '2026-09-22T09:00:00.000Z';
await t('1. יוצר פרופיל Member (השדות של האפליקציה)', () => assertSucceeds(setDoc(doc(as('twoKids'), 'users/twoKids'),
  { name: 'הורה של שניים', role: 'Member', phone: '0500000080', email: '', inviteToken: 'tok_two', consentAt: NOW, createdAt: NOW })));
await t('2. קישור לילד הראשון', () => assertSucceeds(setDoc(doc(as('twoKids'), 'links/twoKids_p1'),
  { uid: 'twoKids', playerId: 'p1', relation: 'parent', inviteToken: 'tok_two', createdAt: NOW })));
await t('3. קישור לילד השני', () => assertSucceeds(setDoc(doc(as('twoKids'), 'links/twoKids_p3'),
  { uid: 'twoKids', playerId: 'p3', relation: 'parent', inviteToken: 'tok_two', createdAt: NOW })));
await t('4. מסמן את ההזמנה כמומשה (updateDoc)', () => assertSucceeds(updateDoc(doc(as('twoKids'), 'invites/tok_two'), { usedAt: NOW, usedByUid: 'twoKids' })));
await t('5. רואה את שני הילדים ואת הנוכחות שלהם', async () => {
  await assertSucceeds(getDoc(doc(as('twoKids'), 'players/p1')));
  await assertSucceeds(getDoc(doc(as('twoKids'), 'players/p3')));
  await assertSucceeds(getDocs(query(collection(as('twoKids'), 'attendance'), where('playerId', 'in', ['p1', 'p3']))));
});
await t('המממש עצמו עדיין עובר את inviteLive אחרי המימוש (ניסיון חוזר)', async () => {
  await env.withSecurityRulesDisabled((c) => deleteDoc(doc(c.firestore(), 'links/twoKids_p3')));
  await assertSucceeds(setDoc(doc(as('twoKids'), 'links/twoKids_p3'), { uid: 'twoKids', playerId: 'p3', relation: 'parent', inviteToken: 'tok_two', createdAt: NOW }));
  await assertSucceeds(updateDoc(doc(as('twoKids'), 'invites/tok_two'), { usedAt: NOW, usedByUid: 'twoKids' }));
});

console.log('\n— הרשמה שנקטעה באמצע וחוזרת (אותו חשבון) —');
await t('נקטע אחרי הפרופיל: ההמשך (קישורים + מימוש) עובר', async () => {
  await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'invites/tok_retry'),
    { phone: '0500000083', playerIds: ['p3'], revoked: false, usedAt: null, usedByUid: null, expiresAtMs: FAR }));
  await assertSucceeds(setDoc(doc(as('retryP'), 'users/retryP'), { name: 'x', role: 'Member', phone: '0500000083', email: '', inviteToken: 'tok_retry', consentAt: NOW, createdAt: NOW }));
  // ...הסשן נקטע. בכניסה חוזרת hasProfile=true, ולכן מדלגים ישר לקישורים:
  await assertSucceeds(setDoc(doc(as('retryP'), 'links/retryP_p3'), { uid: 'retryP', playerId: 'p3', relation: 'parent', inviteToken: 'tok_retry', createdAt: NOW }));
  await assertSucceeds(updateDoc(doc(as('retryP'), 'invites/tok_retry'), { usedAt: NOW, usedByUid: 'retryP' }));
});
await t('הזמנה ישנה בלי usedAt/usedByUid בכלל — עדיין עובדת', async () => {
  await assertSucceeds(setDoc(doc(as('legacyP'), 'users/legacyP'), { name: 'x', role: 'Member', inviteToken: 'tok_legacy', createdAt: NOW }));
  await assertSucceeds(setDoc(doc(as('legacyP'), 'links/legacyP_p3'), { uid: 'legacyP', playerId: 'p3', relation: 'parent', inviteToken: 'tok_legacy', createdAt: NOW }));
  await assertSucceeds(updateDoc(doc(as('legacyP'), 'invites/tok_legacy'), { usedAt: NOW, usedByUid: 'legacyP' }));
});

console.log('\n— ניצול של הזמנה שכבר מומשה —');
await t('משתמש אחר לא יוצר פרופיל עם הזמנה שמומשה', () => assertFails(setDoc(doc(as('thief'), 'users/thief'),
  { name: 'x', role: 'Member', inviteToken: 'tok_used', createdAt: NOW })));
await t('משתמש אחר לא מתקשר לילד דרך הזמנה שמומשה', () => assertFails(setDoc(doc(as('parent2'), 'links/parent2_p1'),
  { uid: 'parent2', playerId: 'p1', relation: 'parent', inviteToken: 'tok_used', createdAt: NOW })));
await t('משתמש אחר לא "מממש מחדש" את ההזמנה על שמו', () => assertFails(updateDoc(doc(as('thief'), 'invites/tok_used'), { usedAt: NOW, usedByUid: 'thief' })));
await t('גם אחרי רצף מלא של הורה אמיתי — זר לא משתמש באותו קישור', async () => {
  await assertFails(setDoc(doc(as('thief2'), 'users/thief2'), { name: 'x', role: 'Member', inviteToken: 'tok_two', createdAt: NOW }));
  await assertFails(setDoc(doc(as('parent2'), 'links/parent2_p3'), { uid: 'parent2', playerId: 'p3', relation: 'parent', inviteToken: 'tok_two', createdAt: NOW }));
  await assertFails(updateDoc(doc(as('parent2'), 'invites/tok_two'), { usedAt: NOW, usedByUid: 'parent2' }));
});
await t('מנהל/בעל הרשאת גישה עדיין מנהל הזמנות וקישורים', async () => {
  await assertSucceeds(updateDoc(doc(as('coachA'), 'invites/tok_used'), { revoked: true }));
  await assertSucceeds(setDoc(doc(as('coachA'), 'links/parent2_p1'), { uid: 'parent2', playerId: 'p1', relation: 'parent', inviteToken: '' }));
});

// ====================================================================
// תחרויות — pushCloud ובדיקת החיבור של ttc-mvh-tournaments
// ====================================================================
console.log('\n— תחרויות —');
const tbody = (uid, extra = {}) => ({ name: 'אליפות', date: '2026-10-01', system: 'groups', phase: 'setup', playersCount: 0, rev: 0, client: 'c1',
  state: JSON.stringify({ settings: { name: 'אליפות' }, players: [], phase: 'setup' }), updatedAt: Date.now(), updatedBy: uid, updatedByName: 'x', ...extra });
await t('הורה יוצר תחרות חדשה (pushCloud(true), merge)', () => assertSucceeds(setDoc(doc(as('parent1'), 'tournaments/tNew'), tbody('parent1', { createdBy: 'parent1' }), { merge: true })));
await t('מאמן מעדכן תחרות קיימת (merge)', () => assertSucceeds(setDoc(doc(as('coachB'), 'tournaments/tNew'), tbody('coachB', { rev: 5, phase: 'live' }), { merge: true })));
await t('תחרות ישנה בלי state מתעדכנת', () => assertSucceeds(setDoc(doc(as('parent1'), 'tournaments/t1'), { name: 'שם חדש' }, { merge: true })));
await t('state גדול (~500KB) עובר — אין מגבלת גודל', () => assertSucceeds(setDoc(doc(as('coachA'), 'tournaments/tBig'), tbody('coachA', { state: 'א'.repeat(250000) }), { merge: true })));
await t('בדיקת החיבור (zz-connection-test, ping) עובדת', () => assertSucceeds(setDoc(doc(as('parent1'), 'tournaments/zz-connection-test'), { ping: Date.now(), by: 'parent1' }, { merge: true })));
await t('state שאינו מחרוזת נחסם', () => assertFails(setDoc(doc(as('parent1'), 'tournaments/tNew'), { state: { evil: true } }, { merge: true })));
await t('זר בלי פרופיל לא כותב תחרות', () => assertFails(setDoc(doc(stranger(), 'tournaments/tX'), tbody('randomGoogleUser'))));
await t('הורה לא מוחק, בעל הרשאת תחרויות כן', async () => {
  await assertFails(deleteDoc(doc(as('parent1'), 'tournaments/tNew')));
  await assertSucceeds(deleteDoc(doc(as('coachB'), 'tournaments/tNew')));
});

console.log('\n— מנהל —');
await t('קורא הכל ומוחק', async () => {
  await assertSucceeds(getDocs(collection(as('admin1'), 'users')));
  await assertSucceeds(getDocs(collection(as('admin1'), 'invites')));
  await assertSucceeds(getDocs(collection(as('admin1'), 'accessRequests')));
  await assertSucceeds(deleteDoc(doc(as('admin1'), 'tournaments/t9')));
  await assertSucceeds(updateDoc(doc(as('admin1'), 'users/coachB'), { permissions: ['competitions', 'access'] }));
});

console.log('\n— אוסף לא מוכר —');
await t('חסום לחלוטין', () => assertFails(setDoc(doc(as('admin1'), 'somethingNew/x'), { a: 1 })));

console.log(`\n${pass} עברו, ${fail} נכשלו`);
await env.cleanup();
process.exit(fail ? 1 : 0);
