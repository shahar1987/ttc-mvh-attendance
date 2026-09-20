import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where, addDoc } from 'firebase/firestore';
import fs from 'fs';

const env = await initializeTestEnvironment({
  projectId: 'demo-ttcmh',
  firestore: { host: '127.0.0.1', port: 8181, rules: fs.readFileSync('firestore.rules', 'utf8') },
});

const FAR = Date.now() + 30 * 24 * 3600 * 1000;

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

  await setDoc(doc(d, 'attendance/a1'), { playerId: 'p1', groupId: 'gA', date: '2026-09-18', status: 'Present' });
  await setDoc(doc(d, 'attendance/a2'), { playerId: 'p2', groupId: 'gB', date: '2026-09-18', status: 'Absent' });

  await setDoc(doc(d, 'links/parent1_p1'), { uid: 'parent1', playerId: 'p1', relation: 'parent' });

  await setDoc(doc(d, 'invites/tok_open'),    { phone: '0500000077', displayName: 'הורה חדש', playerIds: ['p2'], playerNames: ['ילד ב'], revoked: false, usedAt: null, expiresAtMs: FAR });
  await setDoc(doc(d, 'invites/tok_revoked'), { phone: '0500000078', playerIds: ['p1'], revoked: true,  usedAt: null, expiresAtMs: FAR });
  await setDoc(doc(d, 'invites/tok_expired'), { phone: '0500000079', playerIds: ['p1'], revoked: false, usedAt: null, expiresAtMs: Date.now() - 1000 });

  await setDoc(doc(d, 'tournaments/t1'), { name: 'אליפות המועדון' });
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
await t('לא קורא נוכחות של ילד אחר', () => assertFails(getDoc(doc(as('parent1'), 'attendance/a2'))));
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
await t('לא מושך אליו רשומת נוכחות של קבוצה אחרת', () => assertFails(updateDoc(doc(as('coachA'), 'attendance/a2'), { groupId: 'gA', status: 'Present' })));
await t('לא מעביר רשומה משלו לקבוצה אחרת', () => assertFails(updateDoc(doc(as('coachA'), 'attendance/a1'), { groupId: 'gB' })));
await t('כן מעדכן נוכחות בקבוצה שלו', () => assertSucceeds(updateDoc(doc(as('coachA'), 'attendance/a1'), { status: 'Absent' })));
await t('כן יוצר נוכחות בקבוצה שלו', () => assertSucceeds(setDoc(doc(as('coachA'), 'attendance/a3'), { playerId: 'p1', groupId: 'gA', date: '2026-09-19', status: 'Present' })));
await t('לא יוצר נוכחות בקבוצה של אחר', () => assertFails(setDoc(doc(as('coachA'), 'attendance/a4'), { playerId: 'p2', groupId: 'gB', date: '2026-09-19', status: 'Present' })));
await t('לא משנה תפקיד למשתמש אחר', () => assertFails(updateDoc(doc(as('coachA'), 'users/coachB'), { role: 'Admin' })));
await t('לא מעניק לעצמו הרשאות', () => assertFails(updateDoc(doc(as('coachA'), 'users/coachA'), { permissions: ['payments'] })));
await t('לא מוחק שחקן', () => assertFails(deleteDoc(doc(as('coachA'), 'players/p1'))));
await t('כן קורא את רשימת השחקנים והמשתמשים', async () => { await assertSucceeds(getDocs(collection(as('coachA'), 'players'))); await assertSucceeds(getDocs(collection(as('coachA'), 'users'))); });

console.log('\n— צופה —');
await t('כן קורא שחקנים ונוכחות', async () => { await assertSucceeds(getDocs(collection(as('viewer1'), 'players'))); await assertSucceeds(getDocs(collection(as('viewer1'), 'attendance'))); });
await t('לא כותב נוכחות', () => assertFails(setDoc(doc(as('viewer1'), 'attendance/a5'), { playerId: 'p1', groupId: 'gA', date: '2026-09-20', status: 'Present' })));
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
