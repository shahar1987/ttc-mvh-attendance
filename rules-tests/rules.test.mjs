import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where, addDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
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
  // מאמן חדש שעוד לא נקבעו לו הרשאות פרטניות, ומאמן שהמנהל הוריד לו את התחרויות
  await setDoc(doc(d, 'users/payer'), { role: 'Viewer', name: 'גזבר', permissions: ['payments'] });
  await setDoc(doc(d, 'users/coachNew'),  { role: 'Coach', name: 'מאמן חדש' });
  await setDoc(doc(d, 'users/coachNoComp'), { role: 'Coach', name: 'מאמן בלי תחרויות', permissions: [] });
  await setDoc(doc(d, 'users/parent1'), { role: 'Member', name: 'הורה', phone: '0500000009' });
  await setDoc(doc(d, 'users/poster'), { role: 'Coach', name: 'מפרסם', permissions: ['boardPosts'] });
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
// פורטל ההורים הוסר: קישור ישן כבר לא פותח את כרטיס הילד
await t('לא קורא יותר את כרטיס הילד המקושר', () => assertFails(getDoc(doc(as('parent1'), 'players/p1'))));
await t('לא קורא יותר את הנוכחות של הילד המקושר', () => assertFails(getDocs(query(collection(as('parent1'), 'attendance'), where('playerId', 'in', ['p1'])))));
await t('לא קורא את הקישורים של עצמו', () => assertFails(getDocs(query(collection(as('parent1'), 'links'), where('uid', '==', 'parent1')))));
await t('כן קורא קבוצות והודעות', async () => { await assertSucceeds(getDocs(collection(as('parent1'), 'groups'))); await assertSucceeds(getDocs(collection(as('parent1'), 'cancellations'))); });
await t('כן קורא תחרויות, אבל לא כותב (Member בלי הרשאת תחרויות)', async () => { await assertSucceeds(getDocs(collection(as('parent1'), 'tournaments'))); await assertFails(setDoc(doc(as('parent1'), 'tournaments/t9'), { name: 'חדש' })); });

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
await t('לא כותב תחרות בלי הרשאת תחרויות', () => assertFails(setDoc(doc(as('viewer1'), 'tournaments/tV'), { name: 'x' })));

console.log('\n— פורטל ההורים הוסר: אין הרשמה ואין בקשות גישה —');
await t('לא קורא הזמנה לפני התחברות', () => assertFails(getDoc(doc(anon(), 'invites/tok_open'))));
await t('לא יוצר לעצמו פרופיל Member גם עם טוקן חי', () => assertFails(setDoc(doc(as('newParent'), 'users/newParent'), { name: 'הורה חדש', role: 'Member', phone: '0500000077', inviteToken: 'tok_open', createdAt: 'now' })));
await t('לא יוצר לעצמו קישור לילד', () => assertFails(setDoc(doc(as('newParent'), 'links/newParent_p2'), { uid: 'newParent', playerId: 'p2', relation: 'parent', inviteToken: 'tok_open', createdAt: 'now' })));
await t('לא מסמן הזמנה כמומשה', () => assertFails(updateDoc(doc(as('newParent'), 'invites/tok_open'), { usedAt: 'now', usedByUid: 'newParent' })));
await t('לא שולח בקשת גישה מבחוץ', () => assertFails(addDoc(collection(anon(), 'accessRequests'), { name: 'הורה', phone: '0501111111', childName: 'ילד', relation: 'parent', note: '', status: 'pending', createdAt: '2026-09-20' })));
await t('לא קורא את הבקשות', () => assertFails(getDocs(collection(anon(), 'accessRequests'))));
await t('מאמן עם הרשאת access ישנה כבר לא מנהל הזמנות וקישורים', async () => {
  await assertFails(getDocs(collection(as('coachA'), 'invites')));
  await assertFails(setDoc(doc(as('coachA'), 'links/parent2_p1'), { uid: 'parent2', playerId: 'p1', relation: 'parent', inviteToken: '' }));
});
await t('מנהל עדיין מנקה נתונים ישנים', async () => {
  await assertSucceeds(updateDoc(doc(as('admin1'), 'invites/tok_open'), { revoked: true }));
  await assertSucceeds(deleteDoc(doc(as('admin1'), 'links/parent1_p1')));
});

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
// תחרויות — pushCloud ובדיקת החיבור של ttc-mvh-tournaments
// ====================================================================
console.log('\n— תחרויות —');
const tbody = (uid, extra = {}) => ({ name: 'אליפות', date: '2026-10-01', system: 'groups', phase: 'setup', playersCount: 0, rev: 0, client: 'c1',
  state: JSON.stringify({ settings: { name: 'אליפות' }, players: [], phase: 'setup' }), updatedAt: Date.now(), updatedBy: uid, updatedByName: 'x', ...extra });
await t('הורה (Member) לא יוצר תחרות חדשה', () => assertFails(setDoc(doc(as('parent1'), 'tournaments/tNew'), tbody('parent1', { createdBy: 'parent1' }), { merge: true })));
await t('מאמן מעדכן תחרות קיימת (merge)', () => assertSucceeds(setDoc(doc(as('coachB'), 'tournaments/tNew'), tbody('coachB', { rev: 5, phase: 'live' }), { merge: true })));
await t('תחרות ישנה בלי state מתעדכנת (מאמן עם הרשאת תחרויות)', () => assertSucceeds(setDoc(doc(as('coachA'), 'tournaments/t1'), { name: 'שם חדש' }, { merge: true })));
await t('state גדול (~500KB) עובר — אין מגבלת גודל', () => assertSucceeds(setDoc(doc(as('coachA'), 'tournaments/tBig'), tbody('coachA', { state: 'א'.repeat(250000) }), { merge: true })));
await t('בדיקת החיבור (zz-connection-test, ping) עובדת למאמן עם הרשאה', () => assertSucceeds(setDoc(doc(as('coachA'), 'tournaments/zz-connection-test'), { ping: Date.now(), by: 'coachA' }, { merge: true })));
await t('state שאינו מחרוזת נחסם', () => assertFails(setDoc(doc(as('parent1'), 'tournaments/tNew'), { state: { evil: true } }, { merge: true })));
await t('זר בלי פרופיל לא כותב תחרות', () => assertFails(setDoc(doc(stranger(), 'tournaments/tX'), tbody('randomGoogleUser'))));
await t('הורה לא מוחק, בעל הרשאת תחרויות כן', async () => {
  await assertFails(deleteDoc(doc(as('parent1'), 'tournaments/tNew')));
  await assertSucceeds(deleteDoc(doc(as('coachB'), 'tournaments/tNew')));
});

await t('מאמן חדש בלי הרשאות פרטניות כותב תחרות (ברירת המחדל של התפקיד)', () => assertSucceeds(setDoc(doc(as('coachNew'), 'tournaments/tC'), tbody('coachNew'), { merge: true })));
await t('מאמן שהוסרה לו הרשאת תחרויות לא כותב', () => assertFails(setDoc(doc(as('coachNoComp'), 'tournaments/tC2'), tbody('coachNoComp'), { merge: true })));
await t('מנהל כותב תחרות', () => assertSucceeds(setDoc(doc(as('admin1'), 'tournaments/tA'), tbody('admin1'), { merge: true })));

console.log('\n— תשלומים ויומן —');
await t('מאמן בלי הרשאת תשלומים לא קורא מסמכי מערכת', () => assertFails(getDoc(doc(as('coachA'), 'system/paymentSync'))));
await t('מאמן בלי הרשאת תשלומים לא קורא מיפוי תשלומים', () => assertFails(getDocs(collection(as('coachA'), 'paymentMappings'))));
await t('צופה בלי הרשאת תשלומים לא קורא מיפוי תשלומים', () => assertFails(getDocs(collection(as('viewer1'), 'paymentMappings'))));
await t('בעל הרשאת תשלומים קורא את מסך התשלומים', async () => { await assertSucceeds(getDoc(doc(as('payer'), 'system/paymentSync'))); await assertSucceeds(getDocs(collection(as('payer'), 'paymentMappings'))); });

console.log('\n— עריכת שחקן: הרשאת תשלומים ומעבר קבוצה (18.10) —');
await env.withSecurityRulesDisabled(async (c) => {
  await setDoc(doc(c.firestore(), 'groups/gC'), { name: 'קבוצה ג', coachId: 'coachA', coachIds: ['coachA'] });
  await setDoc(doc(c.firestore(), 'players/p9'), { name: 'ילד ט', groupId: 'gB', parentPhone: '0500000011', notPaying: true });
});
await t('תשלומים: מסמן ששילם ומתקן שם (מסך "מי לא משלם")', async () => {
  await assertSucceeds(updateDoc(doc(as('payer'), 'players/p9'), { notPaying: false, notPayingSource: 'manual' }));
  await assertSucceeds(updateDoc(doc(as('payer'), 'players/p9'), { name: 'ילד ט׳', notPaying: false, notPayingSource: 'manual', paymentSettledAt: '2026-10-18T10:00:00Z' }));
});
await t('תשלומים: לא מעביר שחקן לקבוצה אחרת', () => assertFails(updateDoc(doc(as('payer'), 'players/p9'), { groupId: 'gA' })));
await t('תשלומים: לא משנה טלפון הורה', () => assertFails(updateDoc(doc(as('payer'), 'players/p9'), { parentPhone: '0500000012' })));
await t('מאמן של שתי קבוצות לא מעביר שחקן ביניהן (האפליקציה מסתירה את הבחירה)', () => assertFails(updateDoc(doc(as('coachA'), 'players/p3'), { groupId: 'gC' })));
await t('מאמן עדיין עורך שחקן בקבוצה שלו', () => assertSucceeds(updateDoc(doc(as('coachA'), 'players/p3'), { parentName: 'הורה ג' })));
await t('מנהל קורא את נתוני התשלומים', () => assertSucceeds(getDocs(collection(as('admin1'), 'paymentMappings'))));
await t('אי אפשר לכתוב ליומן הפעולות', () => assertFails(setDoc(doc(as('coachA'), 'auditLog/x1'), { who: 'coachA', what: 'מזויף' })));

console.log('\n— מנהל —');
await t('קורא הכל ומוחק', async () => {
  await assertSucceeds(getDocs(collection(as('admin1'), 'users')));
  await assertSucceeds(getDocs(collection(as('admin1'), 'invites')));
  await assertSucceeds(getDocs(collection(as('admin1'), 'accessRequests')));
  await assertSucceeds(deleteDoc(doc(as('admin1'), 'tournaments/t9')));
  await assertSucceeds(updateDoc(doc(as('admin1'), 'users/coachB'), { permissions: ['competitions', 'access'] }));
});

console.log('\n— מידות תלבושת (אתר נפרד) —');
const uni = { first: 'נועה', last: 'כהן', shirt: 'M', pants: 'L', at: serverTimestamp() };
await t('הורה שולח מילוי בלי התחברות', () => assertSucceeds(addDoc(collection(anon(), 'uniformResponses'), uni)));
await t('הורה לא יכול להוסיף שדות אחרים', () => assertFails(addDoc(collection(anon(), 'uniformResponses'), { ...uni, player: 'נועה כהן' })));
await t('הורה לא קורא תשובות של אחרים', () => assertFails(getDocs(collection(anon(), 'uniformResponses'))));
await t('מאמן רגיל לא קורא תשובות', () => assertFails(getDocs(collection(as('coachA'), 'uniformResponses'))));
await t('מנהל קורא, עורך מידות, מוסיף ומוחק', async () => {
  await assertSucceeds(getDocs(collection(as('admin1'), 'uniformResponses')));
  const ref = await addDoc(collection(as('admin1'), 'uniformResponses'), { ...uni, player: 'נועה כהן', by: 'coach' });
  await assertSucceeds(updateDoc(ref, { shirt: 'S', player: 'נועה כהן' }));
  await assertSucceeds(deleteDoc(ref));
});
await t('רשימת השחקנים: רק מנהל', async () => {
  await assertSucceeds(setDoc(doc(as('admin1'), 'uniformConfig/roster'), { players: [{ name: 'נועה כהן', group: 'ליגה א' }] }));
  await assertFails(getDoc(doc(anon(), 'uniformConfig/roster')));
  await assertFails(setDoc(doc(as('coachA'), 'uniformConfig/roster'), { players: [] }));
});

console.log('\n— נרשמים בלוח המועדון (כניסה עם גוגל, בלי פרופיל) —');
const gTok = (uid, extra = {}) => ({ email: `${uid}@example.com`, email_verified: true, firebase: { sign_in_provider: 'google.com' }, ...extra });
const boardAs = (uid) => env.authenticatedContext(uid, gTok(uid)).firestore();
const bm = (uid, extra = {}) => ({ name: 'גולש', email: `${uid}@example.com`, phone: '050-1234567', consent: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...extra });
await t('גולש יוצר את המסמך של עצמו', () => assertSucceeds(setDoc(doc(boardAs('bm1'), 'boardMembers/bm1'), bm('bm1'))));
await t('גולש קורא את המסמך של עצמו ומעדכן אותו', async () => {
  await assertSucceeds(getDoc(doc(boardAs('bm1'), 'boardMembers/bm1')));
  await assertSucceeds(updateDoc(doc(boardAs('bm1'), 'boardMembers/bm1'), { phone: ' +972501234567 ', updatedAt: serverTimestamp() }));
});
await t('לא משנה את createdAt בעדכון', () => assertFails(updateDoc(doc(boardAs('bm1'), 'boardMembers/bm1'), { createdAt: 'x', updatedAt: serverTimestamp() })));
await t('לא יוצר מסמך בשם של מישהו אחר', () => assertFails(setDoc(doc(boardAs('bm1'), 'boardMembers/bm2'), bm('bm1'))));
await t('לא מוסיף שדה שלא ברשימה', () => assertFails(setDoc(doc(boardAs('bm3'), 'boardMembers/bm3'), bm('bm3', { role: 'Admin' }))));
await t('לא שומר טלפון שאינו נייד ישראלי', async () => {
  await assertFails(setDoc(doc(boardAs('bm3'), 'boardMembers/bm3'), bm('bm3', { phone: '04-6951234' })));
  await assertFails(setDoc(doc(boardAs('bm3'), 'boardMembers/bm3'), bm('bm3', { phone: '050123' })));
  await assertFails(setDoc(doc(boardAs('bm3'), 'boardMembers/bm3'), bm('bm3', { phone: '050-1234567 ext 9999' })));
});
await t('לא שומר בלי הסכמה', () => assertFails(setDoc(doc(boardAs('bm3'), 'boardMembers/bm3'), bm('bm3', { consent: false }))));
await t('לא שומר אימייל שאינו של החשבון', () => assertFails(setDoc(doc(boardAs('bm3'), 'boardMembers/bm3'), bm('bm3', { email: 'other@example.com' }))));
await t('חשבון אנונימי או אימייל לא מאומת — נחסם', async () => {
  await assertFails(setDoc(doc(env.authenticatedContext('bm3', gTok('bm3', { firebase: { sign_in_provider: 'anonymous' } })).firestore(), 'boardMembers/bm3'), bm('bm3')));
  await assertFails(setDoc(doc(env.authenticatedContext('bm3', gTok('bm3', { email_verified: false })).firestore(), 'boardMembers/bm3'), bm('bm3')));
});
await t('בלי אימייל או עם שם שנפתח כנוסחה — נחסם', async () => {
  const { email, ...noEmail } = bm('bm3');
  await assertFails(setDoc(doc(boardAs('bm3'), 'boardMembers/bm3'), noEmail));
  await assertFails(setDoc(doc(boardAs('bm3'), 'boardMembers/bm3'), bm('bm3', { name: '=cmd' })));
});
await t('לא שומר שם ארוך מ-80', () => assertFails(setDoc(doc(boardAs('bm3'), 'boardMembers/bm3'), bm('bm3', { name: 'א'.repeat(81) }))));
await t('לא קורא מסמך של גולש אחר ולא את הרשימה', async () => {
  await assertFails(getDoc(doc(boardAs('bm2'), 'boardMembers/bm1')));
  await assertFails(getDocs(collection(boardAs('bm1'), 'boardMembers')));
});
await t('גולש בלי פרופיל לא קורא שחקנים, משתמשים או נוכחות', async () => {
  await assertFails(getDocs(collection(boardAs('bm1'), 'players')));
  await assertFails(getDoc(doc(boardAs('bm1'), 'players/p1')));
  await assertFails(getDocs(collection(boardAs('bm1'), 'users')));
  await assertFails(getDocs(collection(boardAs('bm1'), 'attendance')));
});
await t('לא כותב ולא קורא את תוצאת ההתאמה', async () => {
  await assertFails(setDoc(doc(boardAs('bm1'), 'boardMemberMatches/bm1'), { status: 'matched', playerIds: ['p1'] }));
  await assertFails(getDoc(doc(boardAs('bm1'), 'boardMemberMatches/bm1')));
  await assertFails(setDoc(doc(as('admin1'), 'boardMemberMatches/bm1'), { status: 'matched', playerIds: ['p1'] }));
});
await t('מאמן לא קורא את הנרשמים', () => assertFails(getDocs(collection(as('coachA'), 'boardMembers'))));
await t('מנהל קורא הכל, מעדכן ומוחק', async () => {
  await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'boardMemberMatches/bm1'), { status: 'matched', playerIds: ['p1'] }));
  await assertSucceeds(getDocs(collection(as('admin1'), 'boardMembers')));
  await assertSucceeds(getDocs(collection(as('admin1'), 'boardMemberMatches')));
  await assertSucceeds(updateDoc(doc(as('admin1'), 'boardMembers/bm1'), { name: 'מתוקן' }));
});
await t('גולש מוחק את עצמו (זכות להישכח), לא אחר', async () => {
  await assertSucceeds(setDoc(doc(boardAs('bm4'), 'boardMembers/bm4'), bm('bm4')));
  await assertFails(deleteDoc(doc(boardAs('bm4'), 'boardMembers/bm1')));
  await assertSucceeds(deleteDoc(doc(boardAs('bm4'), 'boardMembers/bm4')));
  await assertSucceeds(deleteDoc(doc(as('admin1'), 'boardMembers/bm1')));
});

console.log('\n— הרשמה לאירועים מלוח המועדון —');
const es = (uid, n = 1, extra = {}) => ({ event: 'crane-2026', uid, n, firstName: 'נועה', lastName: 'כהן', heat: '5 ק"מ', gender: 'נ', birth: '1.2.2015', city: 'שניר', phone: '050-1234567', email: `${uid}@example.com`, shirt: 'ילדים 10', byName: 'גולש', createdAt: serverTimestamp(), ...extra });
const esId = (uid, n = 1) => `eventSignups/crane-2026_${uid}_${n}`;
await env.withSecurityRulesDisabled(async (c) => {
  for (const u of ['ev1', 'ev2']) await setDoc(doc(c.firestore(), `boardMembers/${u}`), { name: 'גולש', email: `${u}@example.com`, phone: '050-1234567', consent: true });
});
await t('גולש גוגל שלא הצטרף ללוח (אין boardMembers) — נחסם', () => assertFails(setDoc(doc(boardAs('ev3'), esId('ev3')), es('ev3'))));
await t('חשבון אנונימי — נחסם גם כשיש boardMembers', () =>
  assertFails(setDoc(doc(env.authenticatedContext('ev2', gTok('ev2', { firebase: { sign_in_provider: 'anonymous' } })).firestore(), esId('ev2')), es('ev2'))));
await t('גולש רושם את עצמו ובן משפחה, וקורא את שלו', async () => {
  await assertSucceeds(setDoc(doc(boardAs('ev1'), esId('ev1', 1)), es('ev1', 1)));
  await assertSucceeds(setDoc(doc(boardAs('ev1'), esId('ev1', 2)), es('ev1', 2, { gender: 'ז', birth: '12/11/1980', shirt: 'XL' })));
  await assertSucceeds(getDoc(doc(boardAs('ev1'), esId('ev1', 1))));
  await assertSucceeds(getDocs(query(collection(boardAs('ev1'), 'eventSignups'), where('uid', '==', 'ev1'))));
});
await t('מזהה או uid לא תואמים — נחסם', async () => {
  await assertFails(setDoc(doc(boardAs('ev2'), esId('ev2', 2)), es('ev2', 1)));
  await assertFails(setDoc(doc(boardAs('ev2'), esId('ev1', 3)), es('ev1', 3)));
  await assertFails(setDoc(doc(boardAs('ev2'), esId('ev2', 9)), es('ev2', 9)));
  await assertFails(setDoc(doc(boardAs('ev2'), 'eventSignups/crane-2026_ev2_x'), es('ev2', 'x')));
});
await t('אירוע שלא ברשימה — נחסם', () => assertFails(setDoc(doc(boardAs('ev2'), 'eventSignups/other-2026_ev2_1'), es('ev2', 1, { event: 'other-2026' }))));
await t('בלי אימייל — נחסם', async () => {
  const { email, ...noEmail } = es('ev2');
  await assertFails(setDoc(doc(boardAs('ev2'), esId('ev2')), noEmail));
});
await t('שדה נוסף (כמו ת.ז) — נחסם', () => assertFails(setDoc(doc(boardAs('ev2'), esId('ev2')), es('ev2', 1, { idNumber: '123' }))));
await t('מגדר, מידה, טלפון, תאריך לידה או אימייל לא תקינים — נחסם', async () => {
  for (const bad of [{ gender: 'x' }, { shirt: 'XXXL' }, { phone: '04-6951234' }, { phone: '050123' }, { birth: '2015-02-01' }, { birth: 'אתמול' }, { email: 'other@example.com' }, { firstName: '' }, { firstName: '=cmd' }, { lastName: '+1' }, { city: '@x' }, { heat: '-5' }, { byName: '\tx' }])
    await assertFails(setDoc(doc(boardAs('ev2'), esId('ev2')), es('ev2', 1, bad)));
});
await t('לא קורא הרשמה של אחר ולא את כל הרשימה', async () => {
  await assertFails(getDoc(doc(boardAs('ev2'), esId('ev1', 1))));
  await assertFails(getDocs(collection(boardAs('ev2'), 'eventSignups')));
  await assertFails(getDocs(collection(as('coachA'), 'eventSignups')));
});
await t('אין עדכון; מחיקה של שלך בלבד', async () => {
  await assertFails(updateDoc(doc(boardAs('ev1'), esId('ev1', 1)), { heat: '10 ק"מ' }));
  await assertFails(deleteDoc(doc(boardAs('ev2'), esId('ev1', 1))));
  await assertSucceeds(deleteDoc(doc(boardAs('ev1'), esId('ev1', 2))));
});
await t('מנהל קורא ומוחק; ייצוא — מנהל קורא, אף לקוח לא כותב', async () => {
  await assertSucceeds(getDocs(collection(as('admin1'), 'eventSignups')));
  await assertSucceeds(getDocs(collection(as('admin1'), 'eventSignupExports')));
  await assertFails(getDocs(collection(boardAs('ev1'), 'eventSignupExports')));
  await assertFails(setDoc(doc(boardAs('ev1'), 'eventSignupExports/crane-2026_ev1_1'), { exportedAt: 'x' }));
  await assertFails(setDoc(doc(as('admin1'), 'eventSignupExports/crane-2026_ev1_1'), { exportedAt: 'x' }));
  await assertSucceeds(deleteDoc(doc(as('admin1'), esId('ev1', 1))));
});

console.log('\n— טוקני התראות של לוח המועדון —');
const TOK = 'fcm_' + 'a1B2-c3:D4_'.repeat(14);
const pt = (extra = {}) => ({ createdAt: serverTimestamp(), platform: 'android', ...extra });
await t('גולש לא מחובר שומר טוקן', () => assertSucceeds(setDoc(doc(anon(), `pushTokens/${TOK}`), pt())));
await t('מזהה לא תקין (קצר / תווים אסורים) — נחסם', async () => {
  await assertFails(setDoc(doc(anon(), 'pushTokens/short'), pt()));
  await assertFails(setDoc(doc(anon(), `pushTokens/${TOK.slice(0, 120)}.x`), pt()));
});
await t('שדה נוסף או פלטפורמה לא מוכרת — נחסם', async () => {
  await assertFails(setDoc(doc(anon(), `pushTokens/${TOK}x1`), pt({ name: 'x' })));
  await assertFails(setDoc(doc(anon(), `pushTokens/${TOK}x2`), pt({ platform: 'tv' })));
});
await t('קריאה ועדכון — נחסמים לגולש', async () => {
  await assertFails(getDoc(doc(anon(), `pushTokens/${TOK}`)));
  await assertFails(getDocs(collection(anon(), 'pushTokens')));
  await assertFails(setDoc(doc(anon(), `pushTokens/${TOK}`), pt()));
  await assertFails(getDocs(collection(as('coachA'), 'pushTokens')));
});
await t('מנהל קורא ומוחק', async () => {
  await assertSucceeds(getDocs(collection(as('admin1'), 'pushTokens')));
  await assertSucceeds(deleteDoc(doc(as('admin1'), `pushTokens/${TOK}`)));
});

console.log('\n— עדכונים בלוח המועדון (boardPosts) —');
const bp = (uid, extra = {}) => ({ title: 'אימון בוטל', text: 'אין אימון היום', banner: false, pin: false, hidden: false,
  link: '', linkText: '', date: '2026-10-20', author: uid, authorName: 'מפרסם', updatedAt: serverTimestamp(), createdAt: serverTimestamp(), ...extra });
await t('מי שקיבל boardPosts מפרסם ועורך', async () => {
  await assertSucceeds(setDoc(doc(as('poster'), 'boardPosts/b1'), bp('poster', { link: 'https://example.org/x', linkText: 'פרטים' })));
  await assertSucceeds(updateDoc(doc(as('poster'), 'boardPosts/b1'), { pin: true, author: 'poster', authorName: 'מפרסם', updatedAt: serverTimestamp() }));
});
await t('גולש לא מחובר קורא', async () => {
  await assertSucceeds(getDoc(doc(anon(), 'boardPosts/b1')));
  await assertSucceeds(getDocs(collection(anon(), 'boardPosts')));
});
await t('בלי ההרשאה — נחסם', async () => {
  await assertFails(setDoc(doc(as('coachB'), 'boardPosts/b2'), bp('coachB')));
  await assertFails(setDoc(doc(anon(), 'boardPosts/b2'), bp('x')));
  await assertFails(deleteDoc(doc(as('coachB'), 'boardPosts/b1')));
});
await t('מנהל מפרסם ומוחק', async () => {
  await assertSucceeds(setDoc(doc(as('admin1'), 'boardPosts/b3'), bp('admin1')));
  await assertSucceeds(deleteDoc(doc(as('admin1'), 'boardPosts/b3')));
});
await t('שדה נוסף / קישור לא https / כותרת ריקה — נחסם', async () => {
  await assertFails(setDoc(doc(as('poster'), 'boardPosts/b4'), bp('poster', { push: true })));
  await assertFails(setDoc(doc(as('poster'), 'boardPosts/b4'), bp('poster', { link: 'http://example.org' })));
  await assertFails(setDoc(doc(as('poster'), 'boardPosts/b4'), bp('poster', { link: 'javascript:alert(1)' })));
  await assertFails(setDoc(doc(as('poster'), 'boardPosts/b4'), bp('poster', { title: '' })));
  await assertFails(setDoc(doc(as('poster'), 'boardPosts/b4'), bp('poster', { date: '20.10.2026' })));
});
await t('התחזות לכותב אחר או שינוי createdAt — נחסם', async () => {
  await assertFails(setDoc(doc(as('poster'), 'boardPosts/b5'), bp('admin1')));
  await assertFails(updateDoc(doc(as('poster'), 'boardPosts/b1'), { author: 'admin1', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(as('poster'), 'boardPosts/b1'), { createdAt: serverTimestamp(), author: 'poster', updatedAt: serverTimestamp() }));
});
await t('מי שקיבל boardPosts מוחק', () => assertSucceeds(deleteDoc(doc(as('poster'), 'boardPosts/b1'))));

console.log('\n— אוסף לא מוכר —');
await t('עותק צפייה של תחרות: כל אחד קורא מסמך בודד, רק מי שמנהל תחרויות כותב', async () => {
  await assertSucceeds(setDoc(doc(as('coachA'), 'tournamentsPublic/t1'), { state: '{}', name: 'מחנה' }));
  await assertSucceeds(getDoc(doc(anon(), 'tournamentsPublic/t1')));
  await assertFails(getDocs(collection(anon(), 'tournamentsPublic')));
  await assertFails(setDoc(doc(anon(), 'tournamentsPublic/t1'), { state: '{}' }));
  await assertFails(setDoc(doc(as('parent1'), 'tournamentsPublic/t1'), { state: '{}' }));
  await assertFails(deleteDoc(doc(as('coachNoComp'), 'tournamentsPublic/t1')));
});
await t('חסום לחלוטין', () => assertFails(setDoc(doc(as('admin1'), 'somethingNew/x'), { a: 1 })));

console.log(`\n${pass} עברו, ${fail} נכשלו`);
await env.cleanup();
process.exit(fail ? 1 : 0);
