import xt from "react";
import { attendanceId, trainingKey, isAdultGroup, normalizePhone, isValidPhone, lastTwoAbsences, needsRepeatMsg, onlyHeldTrainings, DAY_NAMES } from "./agents/lib/analysis.mjs";
import { playerGender } from "./agents/lib/gender.mjs";
import { buildXlsx, reportCell } from "./app/report-xlsx.mjs";
import { createRoot as bt } from "react-dom/client";
import { createPortal } from "react-dom";
import e, { useState as b, useEffect as j } from "react";
import {
  Users as H,
  TrendingUp as he,
  Calendar as ge,
  Search as Ne,
  Plus as K,
  Check as Z,
  X as T,
  AlertTriangle as ye,
  MessageCircle as te,
  Phone as se,
  ChevronDown as we,
  LogOut as Ce,
  Home as le,
  Bell as J,
  Menu as Pe,
  Shield as Ie,
  Trash2 as Se,
  Pencil as $e,
  ArrowRight as je,
  FileText as ReportsIcon,
  Ban as BanIcon,
  RotateCcw as UndoIcon,
  Trophy as TrophyIcon,
  RefreshCw as RefreshIcon,
  TrendingDown as TrendDownIcon,
  Minus as MinusIcon,
} from "lucide-react";
import {
  collection as M,
  onSnapshot as ae,
  addDoc as V,
  updateDoc as O,
  deleteDoc as Ee,
  setDoc as De,
  doc as S,
  writeBatch as Te,
  serverTimestamp as Oe,
  query as fsQuery,
  where as fsWhere,
  getDoc as fsGetDoc,
  getDocs as fsGetDocs,
  getDocsFromServer as fsGetDocsFromServer,
  waitForPendingWrites as fsWaitPending,
  terminate as fsTerminate,
  clearIndexedDbPersistence as fsClearCache,
} from "firebase/firestore";
import {
  onAuthStateChanged as Le,
  signInWithEmailAndPassword as Ue,
  sendPasswordResetEmail as PRE,
  signOut as R,
  createUserWithEmailAndPassword as Me,
  getAuth as Xe,
  signOut as _e,
} from "firebase/auth";
import { initializeApp as Be, deleteApp as Ge } from "firebase/app";
import { initializeApp as de } from "firebase/app";
import {
  getAuth as me,
  setPersistence as ue,
  browserLocalPersistence as ce,
} from "firebase/auth";
import {
  initializeFirestore as xe,
  persistentLocalCache as be,
  persistentMultipleTabManager as pe,
} from "firebase/firestore";
var B = {
    apiKey: "AIzaSyDhPiyIrP1zOu5bNSpsQDyXFgZBP6rV7vo",
    authDomain: "ttcmh-2a752.firebaseapp.com",
    databaseURL: "https://ttcmh-2a752-default-rtdb.firebaseio.com",
    projectId: "ttcmh-2a752",
    storageBucket: "ttcmh-2a752.firebasestorage.app",
    messagingSenderId: "198162387540",
    appId: "1:198162387540:web:f4c4728a39aed9468c13c1",
  };
// אפליקציה בשם משלה: הלוח והתחרויות יושבים באותו דומיין (shahar1987.github.io) ובאותו פרויקט,
// ועם השם הרגיל הם חלקו איתה את ההתחברות — יציאה או כניסה שם הוציאה את המשתמש גם מכאן.
var AN = "attendance";
try {
  let k = `firebase:authUser:${B.apiKey}:`,
    pw = (v) => { try { return JSON.parse(v).providerData.some((p) => p.providerId === "password"); } catch { return !1; } },
    cur = localStorage.getItem(k + AN);
  // כאן נכנסים רק עם סיסמה. חשבון Google (מהלוח) נתקע במסך "אין הרשאה", ויציאה ממנו
  // החזירה אותו שוב דרך המעבר — לכן הוא לא נשמר ולא מועתק
  cur && !pw(cur) && localStorage.removeItem(k + AN);
  // מעבר חד-פעמי מהשם הישן: מי שכבר מחובר עם סיסמה נשאר מחובר
  if (!localStorage.getItem("authMigrated")) {
    let old = localStorage.getItem(k + "[DEFAULT]");
    old && pw(old) && !localStorage.getItem(k + AN) && localStorage.setItem(k + AN, old);
    localStorage.setItem("authMigrated", "1");
  }
} catch {}
var z = de(B, AN),
  D = me(z),
  P = xe(z, { localCache: be({ tabManager: pe() }) });
ue(D, ce).catch((t) => {
  console.warn("Auth persistence not available:", t);
});
// הדפדפן לא ימחק את ההתחברות והמטמון כשחסר מקום
typeof navigator < "u" && navigator.storage?.persist?.().catch(() => {});
// חד-פעמי: נוכחות שנשמרה בלי רשת במטמון של השם הישן נשלחת לשרת לפני שהמטמון ננטש
try {
  if (typeof window < "u" && !localStorage.getItem("oldCacheFlushed")) {
    let o = de(B);
    me(o);
    let op = xe(o, { localCache: be({ tabManager: pe() }) });
    fsWaitPending(op).then(() => {
      localStorage.setItem("oldCacheFlushed", "1");
      fsTerminate(op);
    }, () => {});
  }
} catch {}
async function logoutAndClearCache() {
  // ניקוי המטמון מוחק גם שמירות שעוד לא הגיעו לשרת ("נשמר במכשיר") — קודם מחכים להן
  let synced = await Promise.race([
    fsWaitPending(P).then(() => !0, () => !0),
    new Promise((res) => setTimeout(() => res(!1), 3000)),
  ]);
  if (
    !synced &&
    !(await askConfirm(
      "יש נוכחות ששמורה רק בטלפון ועוד לא נשלחה לשרת. התנתקות עכשיו תמחק אותה. להתנתק בכל זאת?",
      { yes: "כן, להתנתק", no: "להישאר מחובר", danger: !0 },
    ))
  )
    return;
  try {
    await R(D);
  } catch (t) {
    console.warn("Sign-out failed:", t);
  }
  try {
    await fsTerminate(P);
    await fsClearCache(P);
  } catch (t) {
    console.warn("Clearing local cache failed:", t);
  }
  if (typeof window < "u") window.location.reload();
}
async function He(t, s) {
  let a = Be(B, "userCreator-" + Date.now());
  try {
    let l = Xe(a),
      i = null,
      recovered = !1;
    try {
      i = await Me(l, t, s);
    } catch (v) {
      if (v.code !== "auth/email-already-in-use") throw v;
      ((i = await Ue(l, t, s)), (recovered = !0));
    }
    return (await _e(l), { uid: i.user.uid, recovered });
  } finally {
    await Ge(a).catch(() => {});
  }
}
var X =
    "מועדון טניס שולחן מבואות החרמון",
  W = 'ע"ש רוני גלבוע',
  E = () => new Date().toLocaleDateString("en-CA"),
  // עד 04:00 מסך הסימון נפתח על אתמול: מאמן שממלא אחרי חצות את האימון של הערב
  // לא ייצור בטעות סט שלם של "הגיע" ליום החדש
  attDefaultDay = () => {
    let d = new Date();
    d.getHours() < 4 && d.setDate(d.getDate() - 1);
    return d.toLocaleDateString("en-CA");
  };
function Ke(t) {
  return new Date(t + "T00:00:00").toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
function ne(t, s) {
  return `https://wa.me/${t}?text=${encodeURIComponent(s)}`;
}
function playerIsAdult(p, groups) {
  return isAdultGroup(
    (groups || []).find((g) => g.id === (p && p.groupId)) || null,
  );
}
function Ve(t, s, adult, gender) {
  let parent = (t || "").trim(),
    f = gender === "f";
  return adult
    ? `היי ${s}, מה שלומך? שמתי לב שלא הגעת לשני האימונים האחרונים. הכל בסדר? אשמח לדעת אם צריך משהו.`
    : `היי${parent && parent !== s ? " " + parent : ""}, מה שלומך? שמתי לב ש${s} לא ${f ? "הגיעה" : "הגיע"} לשני האימונים האחרונים. הכל בסדר? אשמח לדעת אם יש משהו שאפשר לעזור בו.`;
}
function sessionsLabel(n) {
  return n === 1
    ? "פעם בשבוע"
    : n === 2
      ? "פעמיים בשבוע"
      : n
        ? `${n} פעמים בשבוע`
        : "";
}
// "פעמיים בשבוע · 290 ₪ לחודש" — התיאור של מסלול הרשמה אחד בטבלת המיפוי.
// המחיר באתר המתנ"ס הוא תמיד מחיר חודשי, ולכן נכתב כך במפורש: "290 ₪" לבד
// נקרא כאילו זה התשלום לכל העונה.
function trackLabel(row) {
  let parts = [sessionsLabel(Number(row && row.sessionsPerWeek))].filter(Boolean);
  if (row && row.price) parts.push(`${row.price} ₪ לחודש`);
  return parts.join(" · ");
}
// ההודעה שנשלחת מכפתור הוואטסאפ במסך "מי לא משלם".
// בקבוצות ילדים פונים להורה ושם הילד מופיע בגוף ההודעה; בקבוצות בוגרים
// ופרקינסון פונים ישירות לשחקן, בלשון יחיד לפי מגדר.
// tracks: מסלול אחד, מערך מסלולים (כדי לשלוח כמה אפשרויות ולתת להורה לבחור),
// או null — ואז ההודעה נשלחת בלי קישור בכלל.
function paymentMsg(player, group, tracks) {
  let list = (
      Array.isArray(tracks) ? tracks : tracks ? [tracks] : []
    ).filter((tr) => tr && tr.registrationUrl),
    adult = isAdultGroup(group),
    parent = String((player && player.parentName) || "").trim(),
    child = String((player && player.name) || "").trim(),
    greet = adult ? child : parent || child,
    f = playerGender(player) === "f",
    forWhom = adult || !parent || parent === child ? "" : ` של ${child}`,
    ask = adult ? (f ? "אשמח שתסדירי" : "אשמח שתסדיר") : "אשמח שתסדירו",
    write = adult ? (f ? "תכתבי" : "תכתוב") : "תכתבו",
    pick = adult ? "שמתאימה לך" : "שמתאימה לכם",
    link = "";
  if (list.length === 1) {
    let lbl = trackLabel(list[0]);
    link = `להרשמה ותשלום${lbl ? ` — ${lbl}` : ""}:\n${list[0].registrationUrl}\n\n`;
  } else if (list.length > 1) {
    link =
      `${list.length === 2 ? "שתי אפשרויות" : `${list.length} אפשרויות`} הרשמה — לבחור את זו ${pick}:\n\n` +
      list
        .map(
          (tr) => `${trackLabel(tr) || tr.mtnsLabel}\n${tr.registrationUrl}`,
        )
        .join("\n\n") +
      "\n\n";
  }
  return (
    `היי ${greet} 🏓\n\n` +
    `התשלום עבור האימונים${forWhom} העונה עדיין לא הוסדר. ${ask}, כדי שנוכל להמשיך את הפעילות כסדרה.\n\n` +
    link +
    `ואם משהו לא ברור או שיש קושי — ${write} לי בפרטי. אני כאן, ותמיד אפשר למצוא פתרון ביחד.\n\n` +
    `תודה רבה,\nשלום\n${X} ${W}`
  );
}
function absenceMsg(p, gender, date, adult) {
  let g = gender || playerGender(p),
    name = (p && p.name) || "",
    whenTxt = date && date !== E() ? `ב${Ke(date)}` : "היום",
    signature = `צוות ${X}
${W}`;
  return adult
    ? `שלום ${name}, ראינו שלא הגעת לאימון ${whenTxt}.
נשמח לדעת שהכל בסדר.
נתראה באימון הבא!
${signature}`
    : `שלום, ראינו ש${g === "f" ? "בתכם" : "בנכם"} ${name} לא ${g === "f" ? "הגיעה" : "הגיע"} לאימון ${whenTxt}.
נשמח לדעת שהכל בסדר.
נתראה באימון הבא!
${signature}`;
}
// שחקן בשתי קבוצות הוא שני מסמכים של אותו אדם
function playerPersonKey(p) {
  return (p.name || "").trim().toLowerCase() + "|" + normalizePhone(p.parentPhone || "");
}
function countUniqueActivePlayers(players) {
  let seen = new Set(),
    count = 0;
  players.forEach((p) => {
    if (!p.isActive || p.deleted) return;
    let key = playerPersonKey(p);
    if (seen.has(key)) return;
    (seen.add(key), count++);
  });
  return count;
}
function absenceAlerts(players, groups, attendance, allowedGroupIds) {
  let out = [];
  players.forEach((p) => {
    if (!p.isActive || p.deleted || p.trial) return;
    if (allowedGroupIds && !allowedGroupIds.includes(p.groupId)) return;
    let dates = lastTwoAbsences(attendance, p.id, E());
    if (!needsRepeatMsg(p, dates, attendance)) return;
    out.push({
      player: p,
      group: groups.find((g) => g.id === p.groupId) || null,
      dates,
    });
  });
  return out.sort((a, l) => l.dates[0].localeCompare(a.dates[0]));
}
async function markAlertHandled(playerId, latestDate) {
  await O(S(P, "players", playerId), { alertHandledDate: latestDate });
}
async function setPlayerGender(playerId, gender) {
  await O(S(P, "players", playerId), { gender });
}
async function markAbsenceMsgSent(date, groupId, playerId, userId) {
  // גם מסמן את התראת "נעדר משני אימונים" כטופלה, כדי שההורה לא יקבל שתי הודעות על אותה היעדרות
  O(S(P, "players", playerId), { alertHandledDate: date }).catch((err) =>
    console.warn("Alert handling not saved:", err),
  );
  // מעדכנים רק את סימון ההודעה. כתיבת status:"Absent" כאן דרסה תיקון של מאמן
  // ל"הגיע" שנעשה בינתיים. רק אם הרישום לא קיים בכלל — יוצרים אותו כמו קודם.
  let ref = S(P, "attendance", attendanceId(date, groupId, playerId)),
    stamp = { msgSentAt: new Date().toISOString(), msgSentBy: userId || "" };
  try {
    await O(ref, stamp);
  } catch (err) {
    // עדכון של מסמך חסר נכשל ב-not-found, ולמאמן לפעמים ב-permission-denied
    // (הכלל בודק את המסמך הקיים). אם המסמך כן קיים ואין הרשאה, גם הכתיבה
    // הזו תיחסם באותו כלל — כך שאין כאן עקיפה.
    if (!err || (err.code !== "not-found" && err.code !== "permission-denied")) throw err;
    await De(ref, { date, groupId, playerId, status: "Absent", ...stamp }, { merge: !0 });
  }
}
function startOfWeekStr() {
  let d = new Date(),
    day = d.getDay(),
    diff = day;
  d.setDate(d.getDate() - diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function startOfYearStr() {
  return `${new Date().getFullYear()}-01-01`;
}
// מכסה שנתית סופרת מ-1.1, אבל מנהל וצופה מאזינים רק ל-4 חודשים אחרונים (ATT_HISTORY_FROM).
// כשיש לשחקן כלשהו מכסה שנתית — טוענים את החלק החסר פעם אחת, כמו דוח על טווח ישן.
function useYearAttendance(players) {
  let need = players.some((p) => p.isActive && !p.deleted && p.yearlyTarget > 0);
  j(() => {
    need && startOfYearStr() < ATT_HISTORY_FROM && requestOlderAttendance(startOfYearStr());
  }, [need]);
}
function quotaAlerts(players, groups, attendance) {
  let wk = startOfWeekStr(),
    mo = firstOfMonthStr(),
    yr = startOfYearStr(),
    out = [];
  players.forEach((p) => {
    if (!p.isActive || p.deleted) return;
    [
      { period: "השבוע", target: p.weeklyTarget, since: wk },
      { period: "החודש", target: p.monthlyTarget, since: mo },
      { period: "השנה", target: p.yearlyTarget, since: yr },
    ].forEach((ck) => {
      if (!ck.target || ck.target <= 0) return;
      let actual = attendance.filter(
        (a) =>
          a.playerId === p.id && a.status === "Present" && a.date >= ck.since,
      ).length;
      if (actual > ck.target)
        out.push({
          player: p,
          group: groups.find((g) => g.id === p.groupId) || null,
          period: ck.period,
          actual,
          target: ck.target,
        });
    });
  });
  return out;
}
// רק מנהל או מאמן נחשבים מאמני קבוצה. משתמש שהורד לצופה ונשאר משויך לקבוצה לא יוצג כמאמן.
function groupCoachIds(g) {
  let a = g && Array.isArray(g.coachIds) ? g.coachIds.filter(Boolean) : [];
  return g && g.coachId && !a.includes(g.coachId) ? [g.coachId, ...a] : a;
}
function isGroupCoach(g, userId) {
  return !!userId && groupCoachIds(g).includes(userId);
}
function groupCoachNames(g, users) {
  return groupCoachIds(g)
    .map((id) => (users || []).find((v) => v.id === id))
    .filter((u) => u && isStaffMember(u))
    .map((u) => u.name)
    .filter(Boolean);
}
// מזהים ששויכו לקבוצה אך אינם מאמנים יותר — מוצגים בניהול ההרשאות כדי שאפשר יהיה להסיר אותם
function staleCoachIds(g, users) {
  return groupCoachIds(g).filter((id) => {
    let u = (users || []).find((v) => v.id === id);
    return u && !isStaffMember(u);
  });
}
function groupCoachLabel(g, users) {
  let n = groupCoachNames(g, users).join(", ");
  return n ? { name: n } : null;
}
var CANCEL_REASONS = [
  "חג",
  "מזג אוויר",
  "מצב ביטחוני",
  "האולם לא זמין",
  "המאמן נעדר",
  "מיעוט משתתפים",
  "אחר",
];
function findCancellation(cancellations, groupId, date) {
  return (
    (cancellations || []).find((c) => c.groupId === groupId && c.date === date) ||
    null
  );
}
function cancellationLabel(c) {
  if (!c) return "";
  if (c.reason === "אחר") return c.note || c.reason;
  return c.note ? `${c.reason} (${c.note})` : c.reason;
}
function excludeCancelled(attendance, cancellations) {
  if (!cancellations || cancellations.length === 0) return attendance;
  let keys = new Set(cancellations.map((c) => trainingKey(c.date, c.groupId)));
  return attendance.filter((a) => !keys.has(trainingKey(a.date, a.groupId)));
}
async function cancelTraining({ date, groupId, reason, note, userId }) {
  // רשומות הנוכחות של היום לא נמחקות: excludeCancelled מסתיר אותן בכל החישובים,
  // וביטול-הביטול מחזיר אותן כמו שהיו.
  await De(S(P, "cancellations", trainingKey(date, groupId)), {
    date,
    groupId,
    reason,
    note: note || "",
    cancelledBy: userId,
    createdAt: Oe(),
  });
}
async function undoCancellation(c) {
  await Ee(S(P, "cancellations", c.id));
}
// חלון אישור של האפליקציה במקום window.confirm של הדפדפן: טקסט גדול ושני כפתורים גבוהים.
// מחזיר Promise<boolean>. Escape או לחיצה מחוץ לחלון = ביטול. הפוקוס על "ביטול" כדי שאנטר לא יאשר בטעות.
let confirmRoot = null;
function askConfirm(text, { yes = "כן, להמשיך", no = "ביטול", danger = !1 } = {}) {
  if (!confirmRoot) {
    let el = document.createElement("div");
    document.body.appendChild(el);
    confirmRoot = bt(el);
  }
  return new Promise((resolve) => {
    let done = (v) => (confirmRoot.render(null), resolve(v));
    confirmRoot.render(e.createElement(ConfirmDialog, { text, yes, no, danger, done }));
  });
}
function ConfirmDialog({ text, yes, no, danger, done }) {
  let noRef = e.useRef(null);
  j(() => {
    noRef.current && noRef.current.focus();
    let onKey = (ev) => ev.key === "Escape" && done(!1);
    return (
      window.addEventListener("keydown", onKey),
      () => window.removeEventListener("keydown", onKey)
    );
  }, []);
  return e.createElement(
    "div",
    {
      dir: "rtl",
      role: "alertdialog",
      "aria-modal": "true",
      "aria-label": text,
      className: "fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center p-4",
      onClick: (ev) => ev.target === ev.currentTarget && done(!1),
    },
    e.createElement(
      "div",
      { className: "w-full max-w-md bg-white rounded-2xl p-5 flex flex-col gap-3 shadow-xl" },
      e.createElement("p", { className: "text-base text-slate-800 leading-relaxed mb-1" }, text),
      e.createElement(
        "button",
        {
          onClick: () => done(!0),
          className: `min-h-[56px] rounded-xl text-white text-base font-bold ${danger ? "bg-red-500" : "bg-blue-900"}`,
        },
        yes,
      ),
      e.createElement(
        "button",
        {
          ref: noRef,
          onClick: () => done(!1),
          className: "min-h-[56px] rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-base font-semibold",
        },
        no,
      ),
    ),
  );
}
function CancelTrainingModal({ group, date, hasAttendance, onConfirm, onClose }) {
  // 27.9: אין סיבה ברירת מחדל — אישור מהיר רשם "מזג אוויר" גם כשזו לא הייתה הסיבה
  let [reason, setReason] = b(""),
    [note, setNote] = b(""),
    [saving, setSaving] = b(!1),
    [err, setErr] = b(""),
    submit = async () => {
      if (!reason) {
        setErr("נא לבחור את סיבת הביטול");
        return;
      }
      if (reason === "אחר" && !note.trim()) {
        setErr("נא לפרט את סיבת הביטול");
        return;
      }
      if (
        hasAttendance &&
        !(await askConfirm(
          "כבר נשמרה נוכחות ליום הזה בקבוצה זו. אחרי ביטול האימון היום לא ייספר בשום חישוב. להמשיך?",
          { yes: "כן, לבטל את האימון", no: "חזרה" },
        ))
      )
        return;
      (setSaving(!0), setErr(""));
      try {
        (await onConfirm(reason, note.trim()), onClose());
      } catch (e2) {
        setErr("הביטול נכשל: " + e2.message);
      } finally {
        setSaving(!1);
      }
    };
  return e.createElement(
    "div",
    {
      className: "fixed inset-0 bg-black/40 flex items-end justify-center z-50",
      onClick: onClose,
    },
    e.createElement(
      "div",
      {
        dir: "rtl",
        onClick: (v) => v.stopPropagation(),
        className:
          "bg-white w-full max-w-md rounded-t-2xl p-5 flex flex-col gap-3.5 max-h-[90vh] overflow-y-auto",
      },
      e.createElement(
        "div",
        { className: "flex items-center justify-between" },
        e.createElement(
          "button",
          {
            onClick: onClose,
            className:
              "min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400",
            "aria-label": "סגירה",
          },
          e.createElement(T, { className: "w-5 h-5" }),
        ),
        e.createElement(
          "div",
          { className: "text-right" },
          e.createElement(
            "h3",
            { className: "font-bold text-blue-950" },
            "ביטול האימון",
          ),
          e.createElement(
            "div",
            { className: "text-xs text-slate-500" },
            group.name,
            " \xB7 ",
            Ke(date),
          ),
        ),
      ),
      e.createElement(
        "p",
        { className: "text-xs text-slate-500 text-right" },
        "מה הסיבה לביטול?",
      ),
      e.createElement(
        "div",
        { className: "flex flex-col gap-2" },
        CANCEL_REASONS.map((r) =>
          e.createElement(
            "button",
            {
              key: r,
              type: "button",
              onClick: () => setReason(r),
              className: `rounded-xl border px-4 py-3 min-h-[44px] text-sm text-right flex items-center justify-between gap-2 ${reason === r ? "border-blue-900 bg-blue-50 text-blue-950 font-semibold" : "border-slate-200 bg-white text-slate-700"}`,
            },
            e.createElement(
              "span",
              {
                className: `w-4 h-4 rounded-full border-2 shrink-0 ${reason === r ? "border-blue-900 bg-blue-900" : "border-slate-300"}`,
              },
            ),
            e.createElement("span", { className: "flex-1" }, r),
          ),
        ),
      ),
      e.createElement(
        "div",
        { className: "flex flex-col gap-1" },
        e.createElement(
          "label",
          { className: "text-xs text-slate-500" },
          reason === "אחר" ? "פירוט הסיבה" : "הערה (לא חובה)",
        ),
        e.createElement("textarea", {
          value: note,
          onChange: (v) => setNote(v.target.value),
          rows: 2,
          className:
            "border border-slate-200 rounded-lg py-2.5 px-3 text-right text-sm outline-none focus:border-emerald-400 resize-none",
        }),
      ),
      hasAttendance &&
        e.createElement(
          "p",
          {
            className:
              "text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-right leading-relaxed",
          },
          "שים לב: כבר נשמרה נוכחות ליום הזה. אחרי הביטול היום לא ייספר בשום חישוב (ביטול הביטול מחזיר אותו).",
        ),
      err &&
        e.createElement("p", { className: "text-xs text-red-600 text-right" }, err),
      e.createElement(
        "button",
        {
          disabled: saving || !reason,
          onClick: submit,
          className:
            "mt-1 bg-red-500 disabled:opacity-60 text-white font-semibold rounded-xl py-3.5 min-h-[44px] flex items-center justify-center gap-2",
        },
        e.createElement(BanIcon, { className: "w-4 h-4" }),
        saving ? "מבטל…" : "אישור ביטול האימון",
      ),
      e.createElement(
        "button",
        {
          onClick: onClose,
          className: "text-sm text-slate-500 min-h-[44px]",
        },
        "חזרה",
      ),
    ),
  );
}
function QuotaAlertsCard({ alerts: t }) {
  if (t.length === 0) return null;
  return e.createElement(
    "div",
    {
      className:
        "bg-white rounded-2xl ios-card overflow-hidden",
    },
    e.createElement(
      "div",
      { className: "bg-blue-50 px-4 py-3 flex items-center gap-2" },
      e.createElement(he, { className: "w-4 h-4 text-blue-700 shrink-0" }),
      e.createElement(
        "div",
        { className: "text-right flex-1" },
        e.createElement(
          "div",
          { className: "text-sm font-bold text-blue-900" },
          "חריגה ממכסת אימונים \xB7 " +
            t.length,
        ),
        e.createElement(
          "div",
          { className: "text-xs text-blue-700 leading-snug" },
          "שחקנים שהגיעו ליותר אימונים ממה שהוגדר עבורם",
        ),
      ),
    ),
    e.createElement(
      "div",
      { className: "divide-y divide-slate-100" },
      t.map((o, idx) =>
        e.createElement(
          "div",
          {
            key: o.player.id + o.period + idx,
            className:
              "px-4 py-2.5 flex items-center justify-between gap-2",
          },
          e.createElement(
            "div",
            { className: "text-right min-w-0" },
            e.createElement(
              "div",
              { className: "text-sm font-semibold text-blue-950 truncate" },
              o.player.name,
            ),
            e.createElement(
              "div",
              { className: "text-xs text-slate-500 truncate" },
              o.group
                ? o.group.name
                : "ללא קבוצה",
            ),
          ),
          e.createElement(
            "div",
            {
              className:
                "text-xs font-semibold text-blue-700 shrink-0 text-left",
            },
            `${o.actual}/${o.target} ${o.period}`,
          ),
        ),
      ),
    ),
  );
}
function useLocalAlertNotice(alerts, label) {
  let seen = e.useRef(new Set()),
    primed = e.useRef(!1);
  j(() => {
    if (typeof window > "u" || typeof Notification > "u") return;
    if (Notification.permission !== "granted") return;
    // מפתח לפי שחקן+תאריך: היעדרות חדשה של שחקן שכבר דווח עליו בעבר כן מקפיצה התראה
    let key = (a) => a.player.id + "|" + a.dates[0],
      fresh = alerts.filter((a) => !seen.current.has(key(a)));
    fresh.forEach((a) => seen.current.add(key(a)));
    // בטעינה הראשונה רק זוכרים את המצב הקיים — לא מקפיצים את כל ההיסטוריה בכל פתיחה
    if (!primed.current) {
      primed.current = !0;
      return;
    }
    if (fresh.length === 0) return;
    try {
      let first = fresh[0];
      new Notification(label, {
        body:
          fresh.length === 1
            ? `${first.player.name} (${first.group ? first.group.name : "ללא קבוצה"}) נעדר משני האימונים האחרונים`
            : `${fresh.length} שחקנים נעדרו משני האימונים האחרונים`,
        tag: "ttc-absence-alerts",
      });
    } catch (err) {
      console.warn("Local notification skipped:", err);
    }
  }, [alerts.map((a) => a.player.id + a.dates[0]).join("|")]);
}
var We = DAY_NAMES,
  ie = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];
function Y(t) {
  return Array.isArray(t.days) && t.days.length > 0;
}
function ee(t) {
  return Y(t) ? t.days.includes(new Date().getDay()) : !1;
}
function q(t) {
  if (!Y(t))
    return (
      t.schedule ||
      "לא הוגדרו שעות"
    );
  let s = [...t.days]
      .sort((l, i) => l - i)
      .map((l) => ie[l])
      .join(", "),
    a = t.startTime && t.endTime ? ` ${t.startTime}-${t.endTime}` : "";
  return `${s}${a}`;
}
function playerDaysLabel(p) {
  return Array.isArray(p.trainingDays) && p.trainingDays.length > 0
    ? [...p.trainingDays]
        .sort((a, b) => a - b)
        .map((d) => ie[d])
        .join(", ")
    : "";
}
// מנהל וצופה מאזינים רק ל-4 חודשים אחרונים: כל פתיחה אחרי חצי שעה ברקע קוראת מחדש את כל
// הרשומות, ועונה שלמה הייתה גומרת את מכסת הקריאות החינמית. דוח על טווח ישן יותר טוען את
// מה שחסר פעם אחת (requestOlderAttendance). מאמן לא מושפע: השאילתה שלו מסוננת לפי קבוצה,
// ותנאי תאריך נוסף עליה היה דורש אינדקס שאין.
const ATT_HISTORY_FROM = (() => {
  let d = new Date();
  d.setMonth(d.getMonth() - 4);
  return d.toLocaleDateString("en-CA");
})();
let olderAttReq = null;
const requestOlderAttendance = (from) => olderAttReq && olderAttReq(from);
function L(t, groupIds, uid, enabled, filter) {
  let [s, a] = b([]),
    [l, i] = b(!0),
    [err, setErr] = b(null),
    scoped = Array.isArray(groupIds),
    on = enabled !== !1,
    filterKey = filter ? filter.join("|") : "",
    scopeKey = scoped ? groupIds.slice().sort().join(",") : "";
  return (
    j(
      () => {
        setErr(null);
        if (!uid || !on) {
          (a([]), i(!1));
          return;
        }
        if (scoped && groupIds.length === 0) {
          (a([]), i(!1));
          return;
        }
        i(!0);
        // שאילתת "in" מוגבלת במספר הערכים — מאזין נפרד לכל קבוצה של עד 10 מזהים ואיחוד התוצאות
        let chunks = scoped ? [] : [null],
          parts = {},
          pending = new Set();
        if (scoped) for (let k = 0; k < groupIds.length; k += 10) chunks.push(groupIds.slice(k, k + 10));
        chunks.forEach((c, idx) => pending.add(idx));
        let unsubs = chunks.map((chunk, idx) => {
          let ref = chunk ? fsQuery(M(P, t), fsWhere("groupId", "in", chunk)) : M(P, t);
          filter && (ref = fsQuery(ref, fsWhere(filter[0], filter[1], filter[2])));
          return ae(
            ref,
            (n) => {
              parts[idx] = n.docs.map((m) => ({ id: m.id, ...m.data() }));
              pending.delete(idx);
              a(chunks.flatMap((c, k) => parts[k] || []));
              pending.size === 0 && i(!1);
            },
            (n) => {
              // שגיאת האזנה (הרשאה/רשת) לא הופכת ל"אין נתונים": שומרים את מה שיש ומדווחים
              (console.error(`Firestore listen error on ${t}:`, n), setErr(n), i(!1));
            },
          );
        });
        return () => unsubs.forEach((u) => u());
      },
      [t, scoped, scopeKey, uid || "", on, filterKey],
    ),
    { data: s, loading: l, error: err }
  );
}
function Ye() {
  let [t, s] = b(void 0),
    [a, l] = b(void 0),
    [i, c] = b(null);
  return (
    j(() => {
      let n,
        m = Le(D, (o) => {
          if ((n && (n(), (n = void 0)), c(null), !o)) {
            (s(null), l(null));
            return;
          }
          (s(o),
            l(void 0),
            (n = ae(
              S(P, "users", o.uid),
              (x) => {
                (l(x.exists() ? { id: o.uid, ...x.data() } : null), c(null));
              },
              (x) => {
                (console.error("Profile read failed:", x), c(x), l(null));
              },
            )));
        });
      return () => {
        (n && n(), m());
      };
    }, []),
    { authUser: t, profile: a, profileError: i }
  );
}
function Ze(t, s, a) {
  let month = E().slice(0, 7),
    l = new Set(a.filter((n) => n.groupId === s && !n.deleted).map((n) => n.id)),
    i = t.filter((n) => n.groupId === s && String(n.date || "").startsWith(month) && l.has(n.playerId));
  if (i.length === 0) return null;
  let c = i.filter((n) => n.status === "Present").length;
  return Math.round((c / i.length) * 100);
}
function Je(t) {
  let s = E().slice(0, 7),
    a = t.filter((c) => c.date.startsWith(s)),
    l = new Set(a.map((c) => trainingKey(c.date, c.groupId))).size;
  if (a.length === 0) return { avgPct: null, sessions: l };
  let i = a.filter((c) => c.status === "Present").length;
  return { avgPct: Math.round((i / a.length) * 100), sessions: l };
}
// ירידה חדה בנוכחות: בחודש האחרון הגיע לפחות ממחצית האימונים, אחרי שבחודשיים שלפני כן הגיע ל-70% ומעלה.
// תופס ילד שמתרחק בהדרגה בלי להיעדר פעמיים ברצף. אותו תנאי כמו dropoutRisk ב-agents/lib/analysis.mjs.
function attendanceDrop(recs, today) {
  let back = (n) => new Date(Date.parse(today + "T12:00:00Z") - n * 864e5).toISOString().slice(0, 10),
    recentFrom = back(28),
    prevFrom = back(84),
    recent = recs.filter((r) => r.date >= recentFrom && r.date <= today),
    prev = recs.filter((r) => r.date >= prevFrom && r.date < recentFrom),
    rate = (a) => a.filter((r) => r.status === "Present").length / a.length;
  if (recent.length < 2 || prev.length < 3) return null;
  let rr = rate(recent),
    pr = rate(prev);
  return rr < 0.5 && pr >= 0.7 ? { recentPct: Math.round(rr * 100), prevPct: Math.round(pr * 100) } : null;
}
// אותו ילד בכמה קבוצות = כמה מסמכי שחקן עם אותו שם ואותו טלפון (המפתח של countUniqueActivePlayers).
// בלי טלפון תקין לא מאחדים: שם לבד לא מספיק, יש ילדים שונים עם אותו שם.
function multiGroupKids(players, groups, skipGroupIds) {
  let by = new Map();
  players.forEach((p) => {
    if (!p.isActive || p.deleted || (skipGroupIds && skipGroupIds.has(p.groupId))) return;
    if (!isValidPhone(p.parentPhone || "")) return;
    let k = (p.name || "").trim().toLowerCase() + "|" + normalizePhone(p.parentPhone);
    by.has(k) ? by.get(k).push(p) : by.set(k, [p]);
  });
  return [...by.values()]
    .filter((list) => new Set(list.map((p) => p.groupId)).size > 1)
    .map((list) => {
      let parts = list.map((p) => {
        let g = groups.find((x) => x.id === p.groupId) || null;
        return { player: p, group: g, sessions: g && Y(g) ? g.days.length : null };
      });
      return {
        name: list[0].name,
        parts,
        total: parts.every((x) => x.sessions !== null) ? parts.reduce((s2, x) => s2 + x.sessions, 0) : null,
        notPaying: list.some((p) => p.notPaying),
      };
    })
    .sort((a, c) => (a.name || "").localeCompare(c.name || "", "he"));
}
// סיכום אחרי אימון: כמה הגיעו מול הממוצע של 8 האימונים הקודמים, מי חזר אחרי היעדרות ומי חסר פעם שנייה ברצף.
// "הפעם הקודמת" = התאריך האחרון לפני היום שבו השחקן סומן בקבוצה הזו.
function trainingSummary(roster, att, groupId, date) {
  let recs = att.filter((r) => r.groupId === groupId && r.date <= date);
  if (!recs.some((r) => r.date === date)) return null;
  let st = new Map(recs.map((r) => [r.playerId + "|" + r.date, r.status])),
    prevDates = [...new Set(recs.filter((r) => r.date < date).map((r) => r.date))].sort().reverse(),
    presentOn = (d) => recs.filter((r) => r.date === d && r.status === "Present").length,
    last8 = prevDates.slice(0, 8),
    returned = [],
    secondMiss = [];
  roster.forEach((p) => {
    let now = st.get(p.id + "|" + date),
      pd = prevDates.find((d) => st.has(p.id + "|" + d)),
      before = pd && st.get(p.id + "|" + pd);
    now === "Present" && before === "Absent" && returned.push(p);
    now === "Absent" && before === "Absent" && secondMiss.push(p);
  });
  return {
    present: presentOn(date),
    avg: last8.length ? Math.round((last8.reduce((s2, d) => s2 + presentOn(d), 0) / last8.length) * 10) / 10 : null,
    returned,
    secondMiss,
  };
}
function firstOfMonthStr() {
  let d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function formatHeDate(dateStr) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
function eachDateInRange(startStr, endStr) {
  let out = [],
    cur = new Date(startStr + "T00:00:00"),
    end = new Date(endStr + "T00:00:00");
  while (cur <= end) {
    (out.push(cur.toLocaleDateString("en-CA")), cur.setDate(cur.getDate() + 1));
  }
  return out;
}
function csvEscape(value) {
  let s = value === null || value === void 0 ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function downloadCsv(filename, headers, rows) {
  let lines = [headers.map(csvEscape).join(",")].concat(
      rows.map((row) => row.map(csvEscape).join(",")),
    ),
    csvContent = "﻿" + lines.join("\r\n"),
    blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" }),
    url = URL.createObjectURL(blob),
    link = document.createElement("a");
  ((link.href = url),
    (link.download = filename),
    document.body.appendChild(link),
    link.click(),
    document.body.removeChild(link),
    setTimeout(() => URL.revokeObjectURL(url), 1000));
}
// 3.11: כל דוח בונה אובייקט doc אחד, וממנו יוצאים גם מסמך ההדפסה/PDF וגם קובץ האקסל, כדי שלא ייפרדו.
// doc: { title, scope, period, file, landscape, kpis:[{label,value,tone}], highlights:[טקסט], note,
//        tables:[{title, cols:[{h, w, center, pct, bar, ltr, sheetOnly}], rows:[[תא]], foot:[תא]}] }
// תא: ערך פשוט או { v, tone }. בעמודת pct הערך הוא 0-100 או null. tone: good/warn/bad/muted.
const REPORT_CLUB = `מועדון טניס שולחן מבואות החרמון ${W}`;
const REPORT_TONES = {
  good: ["#0F6B4F", "#E6F4EE"],
  warn: ["#8A5300", "#FDF3DF"],
  bad: ["#B3261E", "#FBE9E7"],
  muted: ["#64748B", ""],
};
const reportPctTone = (v) => (v === null || v === void 0 ? "muted" : v >= 75 ? "good" : v >= 50 ? "warn" : "bad");
const reportPct = (v) => ({ v, tone: reportPctTone(v) });
const reportPeriod = (from, to) => `${formatHeDate(from)} עד ${formatHeDate(to)}`;
const reportFile = (...parts) => parts.filter(Boolean).join(" - ").replace(/[\\/:*?"<>|]/g, "");
const REPORT_CSS = `
#ttc-report-print{display:none}
@media print{
  @page{margin:13mm 12mm 15mm;@bottom-center{content:"עמוד " counter(page) " מתוך " counter(pages);font-size:8.5pt;color:#64748B}}
  html,body{background:#fff!important;height:auto!important;min-height:0!important;overflow:visible!important}
  body>*:not(#ttc-report-print){display:none!important}
  #ttc-report-print{display:block;direction:rtl;color:#0B1F3A;font-size:10.5pt;line-height:1.45}
  #ttc-report-print *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .rp-head{display:flex;align-items:center;gap:12px;padding-bottom:10px;border-bottom:2.5px solid #0B1F3A}
  .rp-head img{width:54px;height:54px;object-fit:contain}
  .rp-club{font-size:10pt;font-weight:600;color:#475569}
  .rp-title{font-size:20pt;font-weight:800;line-height:1.2}
  .rp-meta{margin-inline-start:auto;text-align:end;font-size:9.5pt;color:#475569}
  .rp-meta b{display:block;font-size:10.5pt;color:#0B1F3A}
  .rp-kpis{display:flex;gap:8px;margin-top:12px}
  .rp-kpi{flex:1;border:1px solid #CBD5E1;border-radius:6px;padding:7px 10px}
  .rp-kpi b{display:block;font-size:17pt;font-weight:800;line-height:1.15}
  .rp-kpi span{font-size:9pt;color:#475569}
  .rp-high{margin:12px 0 0;padding:8px 12px;background:#F1F5F9;border-radius:6px;list-style:none}
  .rp-high li{padding:1px 0}
  .rp-tt{margin:14px 0 5px;font-size:12pt;font-weight:800;break-after:avoid}
  .rp-t{width:100%;border-collapse:collapse;font-size:9.5pt}
  .rp-t th{background:#0B1F3A;color:#fff;font-weight:700;padding:5px 6px;text-align:start;border:1px solid #0B1F3A}
  .rp-t td{padding:4px 6px;border:1px solid #D5DCE5;text-align:start;vertical-align:middle}
  .rp-t .c{text-align:center}
  .rp-t tr{break-inside:avoid}
  .rp-t thead{display:table-header-group}
  .rp-t .rp-foot td{background:#F1F5F9;font-weight:800;border-top:2px solid #0B1F3A}
  .rp-dense{table-layout:fixed;font-size:8pt}
  .rp-dense th,.rp-dense td{padding:3px 1px}
  .rp-dense th:first-child,.rp-dense td:first-child{padding-inline:5px;overflow:hidden;white-space:nowrap}
  .rp-vert .d{writing-mode:vertical-rl;height:32px;font-size:7.5pt;font-weight:600}
  .rp-t svg{width:12px;height:12px;display:block;margin:auto}
  .rp-bar{height:4px;margin-top:2px;background:#E2E8F0;border-radius:2px;overflow:hidden}
  .rp-bar i{display:block;height:100%}
  .rp-note{margin-top:10px;font-size:8.5pt;color:#64748B}
}`;
function reportCellText(c, col) {
  let x = reportCell(c);
  return col.pct ? (x.v === null || x.v === void 0 ? "–" : `${x.v}%`) : x.v === null || x.v === void 0 ? "" : x.v;
}
function ReportDocumentTable({ table }) {
  let cols = table.cols.map((c, i) => ({ ...c, i })).filter((c) => !c.sheetOnly),
    pick = (row) => cols.map((c) => row[c.i]),
    dense = cols.length > 11,
    vert = cols.length > 19,
    cell = (c, col, key) => {
      let x = reportCell(c),
        tone = REPORT_TONES[x.tone],
        cls = col.center || col.pct ? "c" : void 0,
        text = reportCellText(c, col);
      return e.createElement(
        "td",
        { key, className: cls, style: tone ? { color: tone[0], background: tone[1] || void 0, fontWeight: 700 } : void 0 },
        text === "✓" ? e.createElement(Z, { "aria-label": "הגיע" })
          : text === "✗" ? e.createElement(T, { "aria-label": "לא הגיע" })
          : col.ltr ? e.createElement("span", { dir: "ltr" }, text)
          : text,
        col.bar && x.v !== null && x.v !== void 0 &&
          e.createElement("div", { className: "rp-bar" },
            e.createElement("i", { style: { width: `${x.v}%`, background: tone ? tone[0] : "#64748B" } })),
      );
    };
  return e.createElement(
    e.Fragment,
    null,
    table.title && e.createElement("div", { className: "rp-tt" }, table.title),
    table.rows.length === 0 && e.createElement("p", null, "אין נתונים בטווח שנבחר"),
    table.rows.length > 0 && e.createElement(
      "table",
      { className: `rp-t${dense ? " rp-dense" : ""}${vert ? " rp-vert" : ""}` },
      e.createElement(
        "thead",
        null,
        e.createElement(
          "tr",
          null,
          cols.map((c) =>
            e.createElement("th", { key: c.i, className: c.center || c.pct ? `c${c.date ? " d" : ""}` : void 0, style: c.w ? { width: c.w } : void 0 }, c.h),
          ),
        ),
      ),
      e.createElement(
        "tbody",
        null,
        table.rows.map((row, r) =>
          e.createElement("tr", { key: r }, pick(row).map((c, k) => cell(c, cols[k], k))),
        ),
        table.foot &&
          e.createElement("tr", { className: "rp-foot" }, pick(table.foot).map((c, k) => cell(c, cols[k], k))),
      ),
    ),
  );
}
// שוכן ישירות תחת body ומוסתר במסך: כך ההדפסה לא גוררת עמודים ריקים מגובה האפליקציה
const reportHost = () =>
  document.getElementById("ttc-report-print") ||
  document.body.appendChild(Object.assign(document.createElement("div"), { id: "ttc-report-print" }));
function ReportDocument({ doc }) {
  return createPortal(
    e.createElement(
      e.Fragment,
      null,
      e.createElement("style", null, REPORT_CSS + `@media print{@page{size:A4 ${doc.landscape ? "landscape" : "portrait"}}}`),
      e.createElement(
        "div",
        { className: "rp-head" },
        e.createElement("img", { src: "logo.png", alt: "" }),
        e.createElement(
          "div",
          null,
          e.createElement("div", { className: "rp-club" }, REPORT_CLUB),
          e.createElement("div", { className: "rp-title" }, doc.title),
        ),
        e.createElement(
          "div",
          { className: "rp-meta" },
          doc.scope && e.createElement("b", null, doc.scope),
          e.createElement("div", null, doc.period),
          e.createElement("div", null, `הופק: ${formatHeDate(E())}`),
        ),
      ),
      doc.kpis?.length > 0 &&
        e.createElement(
          "div",
          { className: "rp-kpis" },
          doc.kpis.map((k) =>
            e.createElement(
              "div",
              { key: k.label, className: "rp-kpi" },
              e.createElement("b", { style: REPORT_TONES[k.tone] ? { color: REPORT_TONES[k.tone][0] } : void 0 }, k.value),
              e.createElement("span", null, k.label),
            ),
          ),
        ),
      doc.highlights?.length > 0 &&
        e.createElement("ul", { className: "rp-high" }, doc.highlights.map((h) => e.createElement("li", { key: h }, h))),
      doc.tables.map((t, i) => e.createElement(ReportDocumentTable, { key: i, table: t })),
      doc.note && e.createElement("div", { className: "rp-note" }, doc.note),
    ),
    reportHost(),
  );
}
function printReport(doc) {
  // שם הקובץ שמוצע בשמירה כ-PDF הוא כותרת הדף
  let title = document.title,
    restore = () => ((document.title = title), window.removeEventListener("afterprint", restore)),
    img = document.querySelector("#ttc-report-print img");
  document.title = doc.file;
  window.addEventListener("afterprint", restore);
  (img && img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(() => window.print());
}
function downloadReportXlsx(doc) {
  let url = URL.createObjectURL(
      new Blob([buildXlsx(doc, { club: REPORT_CLUB, produced: formatHeDate(E()) })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    ),
    link = document.createElement("a");
  link.href = url;
  link.download = `${doc.file}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function DateRangeControls({ startDate, endDate, onChangeStart, onChangeEnd }) {
  j(() => {
    startDate && startDate < ATT_HISTORY_FROM && requestOlderAttendance(startDate);
  }, [startDate]);
  let ymd = (d) => d.toLocaleDateString("en-CA"),
    now = new Date(),
    season = new Date(now.getFullYear() - (now.getMonth() < 8 ? 1 : 0), 8, 1),
    presets = [
      ["החודש", firstOfMonthStr(), E()],
      ["חודש קודם", ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)), ymd(new Date(now.getFullYear(), now.getMonth(), 0))],
      ["3 חודשים", ymd(new Date(now.getFullYear(), now.getMonth() - 2, 1)), E()],
      ["העונה", ymd(season), E()],
    ];
  return e.createElement(
    e.Fragment,
    null,
    e.createElement(
      "div",
      { className: "grid grid-cols-4 gap-1.5" },
      presets.map(([label, from, to]) =>
        e.createElement(
          "button",
          {
            key: label,
            onClick: () => (onChangeStart(from), onChangeEnd(to)),
            "aria-pressed": startDate === from && endDate === to,
            className: `rounded-lg text-sm font-semibold ${startDate === from && endDate === to ? "bg-blue-900 text-white" : "bg-white border border-slate-200 text-slate-700"}`,
          },
          label,
        ),
      ),
    ),
    e.createElement(
      "div",
      { className: "flex items-center gap-2 flex-wrap" },
      e.createElement(
        "div",
        { className: "flex flex-col gap-1" },
        e.createElement("label", { className: "text-xs text-slate-500" }, "מתאריך"),
        e.createElement("input", {
          type: "date",
          value: startDate,
          onChange: (ev) => onChangeStart(ev.target.value),
          dir: "ltr",
          className:
            "border border-slate-200 rounded-lg py-2 px-2.5 text-sm outline-none focus:border-emerald-400",
        }),
      ),
      e.createElement(
        "div",
        { className: "flex flex-col gap-1" },
        e.createElement("label", { className: "text-xs text-slate-500" }, "עד תאריך"),
        e.createElement("input", {
          type: "date",
          value: endDate,
          onChange: (ev) => onChangeEnd(ev.target.value),
          dir: "ltr",
          className:
            "border border-slate-200 rounded-lg py-2 px-2.5 text-sm outline-none focus:border-emerald-400",
        }),
      ),
    ),
  );
}
function ReportActionBar({ doc }) {
  return e.createElement(
    "div",
    { className: "flex gap-2 no-print" },
    e.createElement(ReportDocument, { doc }),
    e.createElement(
      "button",
      {
        onClick: () => printReport(doc),
        className:
          "flex-1 bg-blue-900 text-white text-sm font-semibold rounded-xl py-2.5",
      },
      "הדפסה / PDF",
    ),
    e.createElement(
      "button",
      {
        onClick: () => downloadReportXlsx(doc),
        className:
          "flex-1 bg-emerald-700 text-white text-sm font-semibold rounded-xl py-2.5",
      },
      "Excel",
    ),
  );
}
const ALL_CLUB = "__club";
function ReportAttendanceMatrix({ groups, players, attendance }) {
  let [groupId, setGroupId] = b(groups[0]?.id || ""),
    [startDate, setStartDate] = b(firstOfMonthStr()),
    [endDate, setEndDate] = b(E()),
    isClub = groupId === ALL_CLUB,
    group = groups.find((g) => g.id === groupId),
    scopeName = isClub ? "כל המועדון" : group ? group.name : "",
    groupAttendance = attendance.filter(
      (rec) =>
        (isClub || rec.groupId === groupId) && rec.date >= startDate && rec.date <= endDate,
    ),
    dates = Array.from(new Set(groupAttendance.map((rec) => rec.date))).sort(),
    // בטבלה האימון האחרון מוצג ראשון (ליד השם), כדי שלא יהיה צריך לגלול הצידה
    // כדי לראות מה היה היום. החישובים וה-CSV נשארים בסדר כרונולוגי.
    shownDates = dates.slice().reverse(),
    // שחקן שעבר קבוצה נשאר בטבלה של הקבוצה הקודמת עם ההיסטוריה שלו שם (כמו ב"השוואת קבוצות")
    attended = new Set(groupAttendance.map((rec) => rec.playerId)),
    rowOf = {}, // מזהה שחקן ← השורה שלו. במועדון כולו שחקן בשתי קבוצות הוא שורה אחת
    groupPlayers = [],
    keyRow = {};
  players
    .filter(
      (p) =>
        (isClub ? p.isActive && !p.deleted : p.groupId === groupId && p.isActive) ||
        attended.has(p.id),
    )
    .forEach((p) => {
      let k = isClub ? playerPersonKey(p) : p.id,
        row = keyRow[k] || (keyRow[k] = (groupPlayers.push(p), p.id));
      rowOf[p.id] = row;
    });
  groupPlayers.sort((a, c) => a.name.localeCompare(c.name, "he"));
  let statusAt = {};
  groupAttendance.forEach((r) => {
    let k = rowOf[r.playerId] + "|" + r.date;
    if (rowOf[r.playerId] && statusAt[k] !== "Present") statusAt[k] = r.status;
  });
  let cellStatus = (playerId, date) => statusAt[playerId + "|" + date] || null,
    // 27.9: האחוז ישב בעמודה האחרונה, אחרי כל התאריכים — בטלפון צריך היה לגלול הצידה כדי לראות אותו.
    // עכשיו הוא ליד השם, ולצדו מגמה: שלושת האימונים האחרונים מול כל השאר בטווח.
    playerStats = (pid) => {
      let recs = dates.map((d) => cellStatus(pid, d)).filter(Boolean),
        pr = recs.filter((x) => x === "Present").length,
        pct = recs.length ? Math.round((pr / recs.length) * 100) : null,
        last = recs.slice(-3),
        rest = recs.slice(0, -3),
        rate = (a) => a.filter((x) => x === "Present").length / a.length,
        trend =
          last.length === 3 && rest.length >= 3
            ? rate(last) - rate(rest) >= 0.25
              ? "up"
              : rate(rest) - rate(last) >= 0.25
                ? "down"
                : "flat"
            : null;
      return { pct, trend };
    },
    pctClass = (v) =>
      v === null ? "text-slate-500" : v >= 75 ? "text-emerald-700" : v >= 50 ? "text-amber-700" : "text-red-700",
    trendCell = (t) =>
      t === "up"
        ? e.createElement(he, { className: "w-4 h-4 mx-auto text-emerald-700", "aria-label": "מגמת שיפור" })
        : t === "down"
          ? e.createElement(TrendDownIcon, { className: "w-4 h-4 mx-auto text-red-700", "aria-label": "מגמת ירידה" })
          : t === "flat"
            ? e.createElement(MinusIcon, { className: "w-4 h-4 mx-auto text-slate-500", "aria-label": "יציב" })
            : e.createElement("span", { className: "text-slate-400" }, "–"),
    doc = (() => {
      let stats = groupPlayers.map((p) => ({ p, ...playerStats(p.id) })),
        all = groupPlayers.flatMap((p) =>
          dates.map((date) => ({ date, status: cellStatus(p.id, date) })).filter((r) => r.status),
        ),
        present = all.filter((r) => r.status === "Present").length,
        avg = all.length ? Math.round((present / all.length) * 100) : null,
        low = stats.filter((x) => x.pct !== null && x.pct < 50),
        down = stats.filter((x) => x.trend === "down"),
        names = (a) => a.map((x) => x.p.name).join(", "),
        perDate = dates.map((d) => {
          let rs = all.filter((r) => r.date === d);
          return { d, here: rs.filter((r) => r.status === "Present").length, of: rs.length };
        }),
        worst = perDate.slice().sort((a, c) => a.here / (a.of || 1) - c.here / (c.of || 1))[0],
        trendCellDoc = (t) =>
          t === "up" ? { v: "עלייה", tone: "good" } : t === "down" ? { v: "ירידה", tone: "bad" } : t === "flat" ? { v: "יציבה", tone: "muted" } : { v: "–", tone: "muted" };
      return {
        title: "דוח נוכחות קבוצתי",
        scope: scopeName,
        period: reportPeriod(startDate, endDate),
        file: reportFile("דוח נוכחות", scopeName, `${startDate} עד ${endDate}`),
        landscape: dates.length > 8,
        kpis: [
          { label: "שחקנים", value: groupPlayers.length },
          { label: "מפגשים", value: dates.length },
          { label: "נוכחות ממוצעת", value: avg === null ? "–" : `${avg}%`, tone: reportPctTone(avg) },
          { label: "מתחת ל-50%", value: low.length, tone: low.length ? "bad" : "good" },
          { label: "במגמת ירידה", value: down.length, tone: down.length ? "warn" : "good" },
        ],
        highlights: [
          low.length ? `מתחת ל-50% נוכחות: ${names(low)}` : "",
          down.length ? `במגמת ירידה: ${names(down)}` : "",
          worst && dates.length > 1 ? `המפגש עם הנוכחות הנמוכה ביותר: ${formatHeDate(worst.d)} (${worst.here} מתוך ${worst.of})` : "",
        ].filter(Boolean),
        note: "✓ הגיע. ✗ לא הגיע. מקף: לא נרשם. מגמה: שלושת האימונים האחרונים מול הקודמים. היעדרות מוצדקת ואימון שבוטל אינם נספרים.",
        tables: [
          {
            title: "נוכחות לפי שחקן",
            cols: [
              { h: "שחקן", w: dates.length > 8 ? "34mm" : void 0 },
              { h: "%", pct: !0, w: "10mm" },
              { h: "מגמה", center: !0, w: "12mm" },
              ...dates.map((d) => ({ h: ptShort(d), center: !0, date: !0 })),
            ],
            rows: stats.map((x) => [
              x.p.name,
              reportPct(x.pct),
              trendCellDoc(x.trend),
              ...dates.map((d) => {
                let st = cellStatus(x.p.id, d);
                return st === "Present" ? { v: "✓", tone: "good" } : st === "Absent" ? { v: "✗", tone: "bad" } : { v: "–", tone: "muted" };
              }),
            ]),
            foot: ["נכחו", reportPct(avg), "", ...perDate.map((x) => x.here)],
          },
        ],
      };
    })();
  return e.createElement(
    "div",
    { className: "flex flex-col gap-4" },
    e.createElement(
      "div",
      { className: "flex flex-col gap-3 no-print" },
      e.createElement(
        "div",
        { className: "flex flex-col gap-1" },
        e.createElement("label", { className: "text-xs text-slate-500" }, "קבוצה"),
        e.createElement(
          "select",
          {
            value: groupId,
            onChange: (ev) => setGroupId(ev.target.value),
            className:
              "border border-slate-200 rounded-lg py-2.5 px-3 text-right text-sm outline-none bg-white",
          },
          e.createElement("option", { value: ALL_CLUB }, "כל המועדון"),
          groups.map((g) => e.createElement("option", { key: g.id, value: g.id }, g.name)),
        ),
      ),
      e.createElement(DateRangeControls, {
        startDate,
        endDate,
        onChangeStart: setStartDate,
        onChangeEnd: setEndDate,
      }),
      e.createElement(ReportActionBar, { doc }),
    ),
    e.createElement(
      "div",
      { className: "flex flex-col gap-3" },
      e.createElement(
        "h3",
        { className: "font-bold text-blue-950 text-sm" },
        `נוכחות חודשית — ${scopeName}`,
      ),
      dates.length === 0
        ? e.createElement(
            "p",
            { className: "text-center text-sm text-slate-400 py-8" },
            "אין נתוני נוכחות בטווח שנבחר",
          )
        : e.createElement(
            "div",
            { className: "overflow-x-auto" },
            e.createElement(
              "table",
              { className: "w-full text-sm border-collapse" },
              e.createElement(
                "thead",
                null,
                e.createElement(
                  "tr",
                  null,
                  e.createElement(
                    "th",
                    {
                      className:
                        "sticky right-0 bg-slate-100 border border-slate-200 px-2 py-1.5 text-right",
                    },
                    "שחקן",
                  ),
                  e.createElement(
                    "th",
                    { className: "border border-slate-200 px-1.5 py-1.5 bg-slate-100" },
                    "%",
                  ),
                  e.createElement(
                    "th",
                    { className: "border border-slate-200 px-1.5 py-1.5 bg-slate-100 whitespace-nowrap" },
                    "מגמה",
                  ),
                  shownDates.map((d) =>
                    e.createElement(
                      "th",
                      {
                        key: d,
                        className:
                          "border border-slate-200 px-1.5 py-1.5 bg-slate-100 whitespace-nowrap",
                      },
                      formatHeDate(d),
                    ),
                  ),
                ),
              ),
              e.createElement(
                "tbody",
                null,
                groupPlayers.map((p) => {
                  let presentCount = 0,
                    totalCount = 0,
                    cells = shownDates.map((d) => {
                      let st = cellStatus(p.id, d);
                      return (
                        st && (totalCount++, st === "Present" && presentCount++),
                        e.createElement(
                          "td",
                          {
                            key: d,
                            className: `border border-slate-200 text-center py-1 ${st === "Present" ? "bg-emerald-50 text-emerald-700" : st === "Absent" ? "bg-red-50 text-red-600" : "text-slate-300"}`,
                          },
                          st === "Present"
                            ? e.createElement(Z, { className: "w-4 h-4 mx-auto", "aria-label": "הגיע" })
                            : st === "Absent"
                              ? e.createElement(T, { className: "w-4 h-4 mx-auto", "aria-label": "לא הגיע" })
                              : "–",
                        )
                      );
                    }),
                    pct =
                      totalCount > 0
                        ? Math.round((presentCount / totalCount) * 100) + "%"
                        : "–";
                  let st2 = playerStats(p.id);
                  return e.createElement(
                    "tr",
                    { key: p.id },
                    e.createElement(
                      "td",
                      {
                        className:
                          "sticky right-0 bg-white border border-slate-200 px-2 py-1 text-right font-medium text-blue-950 whitespace-nowrap",
                      },
                      p.name,
                    ),
                    e.createElement(
                      "td",
                      { className: `border border-slate-200 text-center font-bold ${pctClass(st2.pct)}` },
                      pct,
                    ),
                    e.createElement(
                      "td",
                      { className: "border border-slate-200 text-center font-bold text-base" },
                      trendCell(st2.trend),
                    ),
                    cells,
                  );
                }),
                groupPlayers.length === 0 &&
                  e.createElement(
                    "tr",
                    null,
                    e.createElement(
                      "td",
                      {
                        colSpan: dates.length + 3,
                        className: "text-center text-slate-400 py-4",
                      },
                      "אין שחקנים",
                    ),
                  ),
              ),
            ),
          ),
    ),
  );
}
function ReportPlayer({ players, groups, attendance }) {
  let activePlayers = players
      .filter((p) => p.isActive && !p.deleted)
      .sort((a, c) => a.name.localeCompare(c.name, "he")),
    [playerId, setPlayerId] = b(activePlayers[0]?.id || ""),
    [startDate, setStartDate] = b(firstOfMonthStr()),
    [endDate, setEndDate] = b(E()),
    player = players.find((p) => p.id === playerId),
    records = attendance
      .filter(
        (rec) =>
          rec.playerId === playerId && rec.date >= startDate && rec.date <= endDate,
      )
      .sort((a, c) => c.date.localeCompare(a.date)),
    presentCount = records.filter((r) => r.status === "Present").length,
    pct = records.length > 0 ? Math.round((presentCount / records.length) * 100) : null,
    groupName = (groupId) => groups.find((g) => g.id === groupId)?.name || "—",
    doc = (() => {
      let streak = 0,
        byMonth = {},
        lastHere = records.find((r) => r.status === "Present"),
        groupRecs = attendance.filter(
          (r) => player && r.groupId === player.groupId && r.date >= startDate && r.date <= endDate,
        ),
        groupPct = groupRecs.length
          ? Math.round((groupRecs.filter((r) => r.status === "Present").length / groupRecs.length) * 100)
          : null;
      for (let r of records) {
        if (r.status !== "Absent") break;
        streak++;
      }
      records.forEach((r) => {
        let k = r.date.slice(0, 7),
          m2 = (byMonth[k] = byMonth[k] || { here: 0, of: 0 });
        m2.of++;
        r.status === "Present" && m2.here++;
      });
      return {
        title: "דוח נוכחות אישי",
        scope: player ? player.name : "",
        period: reportPeriod(startDate, endDate),
        file: reportFile("דוח שחקן", player && player.name, `${startDate} עד ${endDate}`),
        kpis: [
          { label: "מפגשים", value: records.length },
          { label: "הגיע", value: presentCount },
          { label: "לא הגיע", value: records.length - presentCount },
          { label: "נוכחות", value: pct === null ? "–" : `${pct}%`, tone: reportPctTone(pct) },
          { label: "ממוצע הקבוצה", value: groupPct === null ? "–" : `${groupPct}%` },
        ],
        highlights: [
          player ? `קבוצה: ${groupName(player.groupId)}` : "",
          lastHere ? `אימון אחרון שהגיע אליו: ${formatHeDate(lastHere.date)}` : "",
          streak >= 2 ? `${streak} אימונים אחרונים ברצף בלי להגיע` : "",
        ].filter(Boolean),
        note: "היעדרות מוצדקת ואימון שבוטל אינם נספרים.",
        tables: [
          {
            title: "לפי חודש",
            cols: [{ h: "חודש" }, { h: "מפגשים", center: !0 }, { h: "הגיע", center: !0 }, { h: "לא הגיע", center: !0 }, { h: "נוכחות", pct: !0, bar: !0 }],
            rows: Object.keys(byMonth).sort().map((k) => [
              `${k.slice(5)}/${k.slice(0, 4)}`,
              byMonth[k].of,
              byMonth[k].here,
              byMonth[k].of - byMonth[k].here,
              reportPct(Math.round((byMonth[k].here / byMonth[k].of) * 100)),
            ]),
          },
          {
            title: "פירוט מפגשים",
            cols: [{ h: "תאריך" }, { h: "קבוצה" }, { h: "סטטוס", center: !0 }],
            rows: records.map((r) => [
              formatHeDate(r.date),
              groupName(r.groupId),
              r.status === "Present" ? { v: "נכח", tone: "good" } : { v: "נעדר", tone: "bad" },
            ]),
          },
        ],
      };
    })();
  return e.createElement(
    "div",
    { className: "flex flex-col gap-4" },
    e.createElement(
      "div",
      { className: "flex flex-col gap-3 no-print" },
      e.createElement(
        "div",
        { className: "flex flex-col gap-1" },
        e.createElement("label", { className: "text-xs text-slate-500" }, "שחקן"),
        e.createElement(
          "select",
          {
            value: playerId,
            onChange: (ev) => setPlayerId(ev.target.value),
            className:
              "border border-slate-200 rounded-lg py-2.5 px-3 text-right text-sm outline-none bg-white",
          },
          activePlayers.map((p) =>
            e.createElement("option", { key: p.id, value: p.id }, p.name),
          ),
        ),
      ),
      e.createElement(DateRangeControls, {
        startDate,
        endDate,
        onChangeStart: setStartDate,
        onChangeEnd: setEndDate,
      }),
      e.createElement(ReportActionBar, { doc }),
    ),
    e.createElement(
      "div",
      { className: "flex flex-col gap-3" },
      e.createElement(
        "h3",
        { className: "font-bold text-blue-950 text-sm" },
        `דוח שחקן — ${player ? player.name : ""}`,
      ),
      e.createElement(
        "div",
        {
          className:
            "bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between",
        },
        e.createElement(
          "span",
          { className: "text-sm text-slate-500" },
          `${records.length} מפגשים בטווח`,
        ),
        e.createElement(
          "span",
          { className: "text-lg font-bold text-emerald-600" },
          pct === null ? "—" : `${pct}%`,
        ),
      ),
      records.length === 0
        ? e.createElement(
            "p",
            { className: "text-center text-sm text-slate-400 py-8" },
            "אין נתוני נוכחות בטווח שנבחר",
          )
        : e.createElement(
            "div",
            {
              className:
                "bg-white rounded-xl border border-slate-200 divide-y divide-slate-100",
            },
            records.map((r) =>
              e.createElement(
                "div",
                {
                  key: r.date + r.groupId,
                  className: "px-4 py-2.5 flex items-center justify-between text-sm",
                },
                e.createElement(
                  "span",
                  {
                    className:
                      r.status === "Present"
                        ? "text-emerald-600 font-semibold"
                        : "text-red-500 font-semibold",
                  },
                  r.status === "Present" ? "נכח" : "נעדר",
                ),
                e.createElement(
                  "span",
                  { className: "text-slate-500" },
                  groupName(r.groupId),
                ),
                e.createElement(
                  "span",
                  { className: "text-blue-950 font-medium" },
                  formatHeDate(r.date),
                ),
              ),
            ),
          ),
    ),
  );
}
function ReportCoachFillRate({ groups, users, attendance, cancellations }) {
  let [startDate, setStartDate] = b(firstOfMonthStr()),
    [endDate, setEndDate] = b(E()),
    today = E(),
    // היום ותאריכים עתידיים עדיין לא "לא מולאו" — סופרים רק ימים שכבר עברו
    allDates = eachDateInRange(startDate, endDate < today ? endDate : today).filter((d) => d < today),
    rows = groups
      .map((g) => {
        let coach = groupCoachLabel(g, users),
          hasSchedule = Array.isArray(g.days) && g.days.length > 0,
          cancelledDates = allDates.filter((d) =>
            findCancellation(cancellations, g.id, d),
          ),
          expectedDates = hasSchedule
            ? allDates.filter(
                (d) =>
                  (!g.createdDate || d >= g.createdDate) &&
                  g.days.includes(new Date(d + "T00:00:00").getDay()) &&
                  !cancelledDates.includes(d),
              )
            : [],
          filledDates = expectedDates.filter((d) =>
            attendance.some((rec) => rec.groupId === g.id && rec.date === d),
          ),
          missedDates = expectedDates.filter((d) => !filledDates.includes(d)),
          fillPct =
            expectedDates.length > 0
              ? Math.round((filledDates.length / expectedDates.length) * 100)
              : null;
        return {
          group: g,
          coach,
          hasSchedule,
          expected: expectedDates.length,
          filled: filledDates.length,
          cancelled: cancelledDates.length,
          missedDates,
          fillPct,
        };
      })
      .sort((a, c) => (a.fillPct ?? -1) - (c.fillPct ?? -1)),
    doc = (() => {
      let expected = rows.reduce((n, r) => n + r.expected, 0),
        filled = rows.reduce((n, r) => n + r.filled, 0),
        pctAll = expected ? Math.round((filled / expected) * 100) : null,
        fillTone = (v) => (v === null ? "muted" : v === 100 ? "good" : v >= 70 ? "warn" : "bad"),
        noSchedule = rows.filter((r) => !r.hasSchedule);
      return {
        title: "דוח מילוי נוכחות",
        period: reportPeriod(startDate, endDate),
        file: reportFile("דוח מילוי נוכחות", `${startDate} עד ${endDate}`),
        landscape: !0,
        kpis: [
          { label: "קבוצות", value: rows.length },
          { label: "מפגשים צפויים", value: expected },
          { label: "מולאו", value: filled },
          { label: "לא מולאו", value: expected - filled, tone: expected - filled ? "bad" : "good" },
          { label: "אחוז מילוי", value: pctAll === null ? "–" : `${pctAll}%`, tone: fillTone(pctAll) },
        ],
        highlights: noSchedule.length ? [`ללא ימי פעילות מוגדרים: ${noSchedule.map((r) => r.group.name).join(", ")}`] : [],
        note: "היום ואימונים שבוטלו אינם נספרים.",
        tables: [
          {
            title: "מילוי לפי קבוצה",
            cols: [
              { h: "קבוצה", w: "42mm" },
              { h: "מאמן", w: "34mm" },
              { h: "צפוי", center: !0, w: "14mm" },
              { h: "מולא", center: !0, w: "14mm" },
              { h: "בוטל", center: !0, w: "14mm" },
              { h: "מילוי", pct: !0, bar: !0, w: "20mm" },
              { h: "תאריכים שלא מולאו" },
            ],
            rows: rows.map((r) => [
              r.group.name,
              r.coach ? r.coach.name : "ללא מאמן",
              r.expected,
              r.filled,
              r.cancelled,
              { v: r.fillPct, tone: fillTone(r.fillPct) },
              r.missedDates.map(ptShort).join(", "),
            ]),
          },
        ],
      };
    })();
  return e.createElement(
    "div",
    { className: "flex flex-col gap-4" },
    e.createElement(
      "div",
      { className: "flex flex-col gap-3 no-print" },
      e.createElement(DateRangeControls, {
        startDate,
        endDate,
        onChangeStart: setStartDate,
        onChangeEnd: setEndDate,
      }),
      e.createElement(ReportActionBar, { doc }),
    ),
    e.createElement(
      "div",
      { className: "flex flex-col gap-2.5" },
      e.createElement(
        "h3",
        { className: "font-bold text-blue-950 text-sm" },
        "דוח מילוי נוכחות למאמנים",
      ),
      rows.map((r) =>
        e.createElement(
          "div",
          {
            key: r.group.id,
            className:
              "bg-white rounded-xl border border-slate-200 p-3.5 flex flex-col gap-1.5",
          },
          e.createElement(
            "div",
            { className: "flex items-center justify-between" },
            e.createElement(
              "span",
              {
                className: `text-sm font-bold ${r.fillPct === null ? "text-slate-400" : r.fillPct === 100 ? "text-emerald-600" : r.fillPct >= 70 ? "text-amber-600" : "text-red-500"}`,
              },
              r.fillPct === null ? "—" : `${r.fillPct}%`,
            ),
            e.createElement(
              "div",
              { className: "text-right" },
              e.createElement(
                "div",
                { className: "font-semibold text-blue-950 text-sm" },
                r.group.name,
              ),
              e.createElement(
                "div",
                { className: "text-xs text-slate-500" },
                r.coach ? r.coach.name : "ללא מאמן",
              ),
            ),
          ),
          r.hasSchedule
            ? e.createElement(
                "div",
                { className: "text-xs text-slate-500 text-right" },
                `${r.filled} מתוך ${r.expected} מפגשים מולאו`,
                r.cancelled > 0 ? ` \xB7 ${r.cancelled} בוטלו` : "",
              )
            : e.createElement(
                "div",
                { className: "text-xs text-amber-600 text-right" },
                "לא הוגדרו ימי פעילות לקבוצה זו",
              ),
          r.missedDates.length > 0 &&
            e.createElement(
              "div",
              { className: "text-xs text-red-500 text-right leading-relaxed" },
              "לא מולא: " + r.missedDates.map(formatHeDate).join(", "),
            ),
        ),
      ),
      rows.length === 0 &&
        e.createElement(
          "p",
          { className: "text-center text-sm text-slate-400 py-8" },
          "אין קבוצות",
        ),
    ),
  );
}
function ReportDropoutRisk({ players, groups, attendance, readOnly: RO }) {
  let [startDate, setStartDate] = b(firstOfMonthStr()),
    [endDate, setEndDate] = b(E()),
    groupName = (groupId) => groups.find((g) => g.id === groupId)?.name || "—",
    atRisk = players
      .filter((p) => p.isActive && !p.deleted)
      .map((p) => {
        let byDate = new Map();
        attendance.forEach((rec) => {
          if (rec.playerId !== p.id || rec.date < startDate || rec.date > endDate) return;
          let prev = byDate.get(rec.date);
          (!prev || prev.status !== "Present") && byDate.set(rec.date, rec);
        });
        let records = [...byDate.values()].sort((a, c) => c.date.localeCompare(a.date)),
          lastTwo = records.slice(0, 2),
          flagged = lastTwo.length === 2 && lastTwo.every((r) => r.status === "Absent"),
          // 27.9: למה הוא ברשימה — כמה אימונים ברצף הוא לא מגיע, ומה הייתה הנוכחות שלו לפני כן.
          // ילד שהגיע תמיד ופתאום נעלם שונה מילד שממילא מגיע מעט.
          streak = 0;
        for (let r of records) {
          if (r.status !== "Absent") break;
          streak++;
        }
        let before = records.slice(streak),
          beforePct = before.length >= 3
            ? Math.round((before.filter((r) => r.status === "Present").length / before.length) * 100)
            : null,
          // הירידה ההדרגתית נמדדת על 12 השבועות שעד סוף הטווח, לא רק בתוך הטווח שנבחר
          allByDate = new Map();
        attendance.forEach((rec) => {
          if (rec.playerId !== p.id || rec.date > endDate) return;
          let prev = allByDate.get(rec.date);
          (!prev || prev.status !== "Present") && allByDate.set(rec.date, rec);
        });
        let drop = flagged ? null : attendanceDrop([...allByDate.values()], endDate);
        return {
          player: p,
          group: groups.find((g) => g.id === p.groupId) || null,
          lastDate: records[0]?.date || null,
          flagged: flagged || !!drop,
          streak,
          beforePct,
          drop,
        };
      })
      .filter((x) => x.flagged)
      .sort((a, c) => c.streak - a.streak || (c.beforePct || 0) - (a.beforePct || 0)),
    doc = (() => {
      let why = (x) =>
          x.drop
            ? `ירידה: ${x.drop.recentPct}% בחודש האחרון, לעומת ${x.drop.prevPct}% לפני כן`
            : `${x.streak} אימונים ברצף בלי להגיע` + (x.beforePct !== null ? `, לפני כן ${x.beforePct}%` : ""),
        byStreak = atRisk.filter((x) => !x.drop).length;
      return {
        title: "שחקנים בסיכון נשירה",
        period: reportPeriod(startDate, endDate),
        file: reportFile("סיכון נשירה", `${startDate} עד ${endDate}`),
        landscape: !0,
        kpis: [
          { label: "שחקנים בסיכון", value: atRisk.length, tone: atRisk.length ? "bad" : "good" },
          { label: "היעדרות ברצף", value: byStreak },
          { label: "ירידה הדרגתית", value: atRisk.length - byStreak },
        ],
        tables: [
          {
            title: "רשימה לטיפול",
            cols: [
              { h: "שחקן" },
              { h: "קבוצה" },
              { h: "הורה" },
              { h: "טלפון", ltr: !0, sheetOnly: !0 },
              { h: "סיבה" },
              { h: "רישום אחרון", center: !0 },
            ],
            rows: atRisk.map((x) => [
              x.player.name,
              groupName(x.player.groupId),
              x.player.parentName || "",
              x.player.parentPhone || "",
              { v: why(x), tone: x.drop ? "warn" : "bad" },
              x.lastDate ? formatHeDate(x.lastDate) : "–",
            ]),
          },
        ],
      };
    })();
  return e.createElement(
    "div",
    { className: "flex flex-col gap-4" },
    e.createElement(
      "div",
      { className: "flex flex-col gap-3 no-print" },
      e.createElement(DateRangeControls, {
        startDate,
        endDate,
        onChangeStart: setStartDate,
        onChangeEnd: setEndDate,
      }),
      e.createElement(ReportActionBar, { doc }),
    ),
    e.createElement(
      "div",
      { className: "flex flex-col gap-2.5" },
      e.createElement(
        "h3",
        { className: "font-bold text-blue-950 text-sm" },
        "שחקנים בסיכון נשירה",
      ),
      atRisk.length === 0
        ? e.createElement(
            "p",
            { className: "text-center text-sm text-slate-400 py-8" },
            "אין שחקנים בסיכון בטווח שנבחר",
          )
        : e.createElement(
            "div",
            {
              className:
                "bg-white rounded-xl border border-slate-200 divide-y divide-slate-100",
            },
            atRisk.map((x) =>
              e.createElement(
                "div",
                {
                  key: x.player.id,
                  className: "px-4 py-3 flex items-center justify-between gap-2",
                },
                !RO &&
                isValidPhone(x.player.parentPhone) &&
                e.createElement(
                  "button",
                  {
                    onClick: () =>
                      window.open(
                        ne(
                          normalizePhone(x.player.parentPhone),
                          Ve(
                            x.player.parentName,
                            x.player.name,
                            isAdultGroup(x.group),
                            playerGender(x.player),
                          ),
                        ),
                        "_blank",
                      ),
                    className:
                      "w-11 h-11 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 no-print",
                    "aria-label": "שליחת הודעה בוואטסאפ",
                  },
                  e.createElement(te, { className: "w-4 h-4 text-white" }),
                ),
                e.createElement(
                  "div",
                  { className: "text-right flex-1" },
                  e.createElement(
                    "div",
                    { className: "text-sm font-medium text-blue-950" },
                    x.player.name,
                  ),
                  e.createElement(
                    "div",
                    { className: "text-sm text-slate-600" },
                    x.player.parentName
                      ? `${groupName(x.player.groupId)} \xB7 ${x.player.parentName}`
                      : groupName(x.player.groupId),
                  ),
                  x.drop
                    ? e.createElement(
                        "div",
                        { className: "text-sm font-semibold text-amber-700" },
                        `ירידה בנוכחות: ${x.drop.recentPct}% בחודש האחרון, לעומת ${x.drop.prevPct}% לפני כן`,
                      )
                    : e.createElement(
                        "div",
                        { className: "text-sm font-semibold text-red-700" },
                        `${x.streak} אימונים ברצף בלי להגיע` +
                          (x.beforePct !== null ? ` \xB7 לפני כן הגיע/ה ל-${x.beforePct}%` : ""),
                      ),
                ),
                e.createElement(
                  "div",
                  { className: "text-sm text-red-700 shrink-0" },
                  x.lastDate ? formatHeDate(x.lastDate) : "",
                ),
              ),
            ),
          ),
    ),
  );
}
function ReportGroupComparison({ groups, users, players, attendance }) {
  let [startDate, setStartDate] = b(firstOfMonthStr()),
    [endDate, setEndDate] = b(E()),
    rows = groups
      .map((g) => {
        let coach = groupCoachLabel(g, users),
          records = attendance.filter(
            (rec) =>
              rec.groupId === g.id && rec.date >= startDate && rec.date <= endDate,
          ),
          sessions = new Set(records.map((r) => r.date)).size,
          presentCount = records.filter((r) => r.status === "Present").length,
          pct = records.length > 0 ? Math.round((presentCount / records.length) * 100) : null,
          activePlayers = players.filter((p) => p.groupId === g.id && p.isActive && !p.deleted).length;
        return { group: g, coach, sessions, pct, activePlayers, presentCount, total: records.length };
      })
      .sort((a, c) => (c.pct ?? -1) - (a.pct ?? -1)),
    doc = (() => {
      let total = rows.reduce((n, r) => n + r.total, 0),
        here = rows.reduce((n, r) => n + r.presentCount, 0),
        avg = total ? Math.round((here / total) * 100) : null,
        ids = new Set(groups.map((g) => g.id)),
        // שחקן שרשום בשתי קבוצות נספר פעם אחת
        people = new Set(players.filter((p) => ids.has(p.groupId) && p.isActive && !p.deleted).map((p) => p.name.trim())).size,
        ranked = rows.filter((r) => r.pct !== null);
      return {
        title: "השוואת קבוצות",
        period: reportPeriod(startDate, endDate),
        file: reportFile("השוואת קבוצות", `${startDate} עד ${endDate}`),
        kpis: [
          { label: "קבוצות", value: rows.length },
          { label: "שחקנים פעילים", value: people },
          { label: "מפגשים", value: rows.reduce((n, r) => n + r.sessions, 0) },
          { label: "נוכחות ממוצעת", value: avg === null ? "–" : `${avg}%`, tone: reportPctTone(avg) },
        ],
        highlights: ranked.length > 1
          ? [
              `הנוכחות הגבוהה ביותר: ${ranked[0].group.name} (${ranked[0].pct}%)`,
              `הנוכחות הנמוכה ביותר: ${ranked[ranked.length - 1].group.name} (${ranked[ranked.length - 1].pct}%)`,
            ]
          : [],
        note: "היעדרות מוצדקת ואימון שבוטל אינם נספרים.",
        tables: [
          {
            title: "דירוג לפי נוכחות",
            cols: [{ h: "קבוצה" }, { h: "מאמן" }, { h: "שחקנים", center: !0, w: "16mm" }, { h: "מפגשים", center: !0, w: "16mm" }, { h: "נוכחות", pct: !0, bar: !0, w: "24mm" }],
            rows: rows.map((r) => [r.group.name, r.coach ? r.coach.name : "ללא מאמן", r.activePlayers, r.sessions, reportPct(r.pct)]),
          },
        ],
      };
    })();
  return e.createElement(
    "div",
    { className: "flex flex-col gap-4" },
    e.createElement(
      "div",
      { className: "flex flex-col gap-3 no-print" },
      e.createElement(DateRangeControls, {
        startDate,
        endDate,
        onChangeStart: setStartDate,
        onChangeEnd: setEndDate,
      }),
      e.createElement(ReportActionBar, { doc }),
    ),
    e.createElement(
      "div",
      { className: "flex flex-col gap-2.5" },
      e.createElement("h3", { className: "font-bold text-blue-950 text-sm" }, "השוואת קבוצות"),
      e.createElement(
        "div",
        { className: "overflow-x-auto" },
        e.createElement(
          "table",
          { className: "w-full text-xs border-collapse" },
          e.createElement(
            "thead",
            null,
            e.createElement(
              "tr",
              null,
              ["קבוצה", "מאמן", "שחקנים", "מפגשים", "נוכחות"].map((hd) =>
                e.createElement(
                  "th",
                  { key: hd, className: "border border-slate-200 px-2 py-1.5 bg-slate-100" },
                  hd,
                ),
              ),
            ),
          ),
          e.createElement(
            "tbody",
            null,
            rows.map((r) =>
              e.createElement(
                "tr",
                { key: r.group.id },
                e.createElement(
                  "td",
                  {
                    className:
                      "border border-slate-200 px-2 py-1 text-right font-medium text-blue-950",
                  },
                  r.group.name,
                ),
                e.createElement(
                  "td",
                  { className: "border border-slate-200 px-2 py-1 text-right text-slate-500" },
                  r.coach ? r.coach.name : "—",
                ),
                e.createElement(
                  "td",
                  { className: "border border-slate-200 px-2 py-1 text-center" },
                  r.activePlayers,
                ),
                e.createElement(
                  "td",
                  { className: "border border-slate-200 px-2 py-1 text-center" },
                  r.sessions,
                ),
                e.createElement(
                  "td",
                  {
                    className: `border border-slate-200 px-2 py-1 text-center font-semibold ${r.pct === null ? "text-slate-400" : r.pct >= 75 ? "text-emerald-600" : r.pct >= 50 ? "text-amber-600" : "text-red-500"}`,
                  },
                  r.pct === null ? "—" : `${r.pct}%`,
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}
function ReportQuota({ players, groups, attendance }) {
  useYearAttendance(players);
  let alerts = quotaAlerts(players, groups, attendance),
    doc = {
      title: "חריגה ממכסת אימונים",
      period: `נכון ל-${formatHeDate(E())}`,
      file: reportFile("חריגת מכסה", E()),
      kpis: [
        { label: "חריגות", value: alerts.length, tone: alerts.length ? "warn" : "good" },
        { label: "שחקנים", value: new Set(alerts.map((o) => o.player.id)).size },
      ],
      tables: [
        {
          title: "שחקנים שחרגו מהמכסה",
          cols: [
            { h: "שחקן" },
            { h: "קבוצה" },
            { h: "תקופה", center: !0 },
            { h: "מכסה", center: !0 },
            { h: "בפועל", center: !0 },
            { h: "מעל המכסה", center: !0 },
          ],
          rows: alerts.map((o) => [
            o.player.name,
            o.group ? o.group.name : "ללא קבוצה",
            o.period,
            o.target,
            o.actual,
            { v: o.actual - o.target, tone: "warn" },
          ]),
        },
      ],
    };
  return e.createElement(
    "div",
    { className: "flex flex-col gap-4" },
    e.createElement(
      "div",
      { className: "no-print" },
      e.createElement(ReportActionBar, { doc }),
    ),
    e.createElement(
      "div",
      { className: "flex flex-col gap-2.5" },
      e.createElement(
        "h3",
        { className: "font-bold text-blue-950 text-sm" },
        "שחקנים שחרגו ממכסת האימונים שהוגדרה עבורם",
      ),
      alerts.length === 0 &&
        e.createElement(
          "p",
          { className: "text-center text-sm text-slate-400 py-8" },
          "אין חריגות ממכסה כרגע",
        ),
      alerts.map((o, idx) =>
        e.createElement(
          "div",
          {
            key: o.player.id + o.period + idx,
            className:
              "bg-white rounded-xl border border-slate-200 p-3.5 flex items-center justify-between gap-2",
          },
          e.createElement(
            "div",
            { className: "text-right" },
            e.createElement(
              "div",
              { className: "font-semibold text-blue-950 text-sm" },
              o.player.name,
            ),
            e.createElement(
              "div",
              { className: "text-xs text-slate-500" },
              o.group ? o.group.name : "ללא קבוצה",
            ),
          ),
          e.createElement(
            "div",
            { className: "text-sm font-bold text-blue-700" },
            `${o.actual}/${o.target} ${o.period}`,
          ),
        ),
      ),
    ),
  );
}
function ReportsScreen({ groups, users, players, attendance, cancellations, readOnly: RO }) {
  // 27.9: שש לשוניות בשורה גלולה — ארבע מהן הסתתרו מחוץ למסך. עכשיו שתי קבוצות של שלוש.
  let [tab, setTab] = b("matrix"),
    sets = {
      groups: { label: "קבוצות", tabs: [
        { key: "matrix", label: "נוכחות חודשית" },
        { key: "compare", label: "השוואת קבוצות" },
        { key: "fillrate", label: "מילוי מאמנים" },
      ] },
      players: { label: "שחקנים", tabs: [
        { key: "player", label: "דוח שחקן" },
        { key: "risk", label: "בסיכון נשירה" },
        { key: "quota", label: "מכסת אימונים" },
      ] },
    },
    setKey = sets.players.tabs.some((t) => t.key === tab) ? "players" : "groups",
    tabs = sets[setKey].tabs;
  return e.createElement(
    "div",
    { className: "px-4 pt-4 pb-6 flex flex-col gap-4" },
    e.createElement(
      "div",
      { className: "grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl no-print", role: "tablist" },
      Object.entries(sets).map(([k, st]) =>
        e.createElement(
          "button",
          {
            key: k,
            role: "tab",
            "aria-selected": setKey === k,
            onClick: () => setKey !== k && setTab(st.tabs[0].key),
            className: `rounded-lg text-sm font-bold ${setKey === k ? "bg-white text-blue-950 shadow-sm" : "text-slate-600"}`,
          },
          st.label,
        ),
      ),
    ),
    e.createElement(
      "div",
      { className: "grid grid-cols-3 gap-1.5 no-print" },
      tabs.map((t) =>
        e.createElement(
          "button",
          {
            key: t.key,
            onClick: () => setTab(t.key),
            "aria-pressed": tab === t.key,
            className: `px-1 rounded-lg text-sm font-semibold leading-tight ${tab === t.key ? "bg-blue-900 text-white" : "bg-white border border-slate-200 text-slate-700"}`,
          },
          t.label,
        ),
      ),
    ),
    tab === "matrix" && e.createElement(ReportAttendanceMatrix, { groups, players, attendance }),
    tab === "player" && e.createElement(ReportPlayer, { players, groups, attendance }),
    tab === "fillrate" &&
      e.createElement(ReportCoachFillRate, { groups, users, attendance, cancellations }),
    tab === "risk" && e.createElement(ReportDropoutRisk, { players, groups, attendance, readOnly: RO }),
    tab === "compare" &&
      e.createElement(ReportGroupComparison, { groups, users, players, attendance }),
    tab === "quota" &&
      e.createElement(ReportQuota, { players, groups, attendance }),
  );
}

// 30.10: "אחרי האימון" — שלוש תצוגות קריאה בלבד מעל הנתונים הקיימים: סיכום האימון האחרון של קבוצה,
// מפת נוכחות של 8 האימונים האחרונים, ותמונת המועדון של היום. לא כותב כלום ל-Firestore;
// הודעת היעדרות עוברת דרך חלון ה-WhatsApp הרגיל, ששולום שולח ממנו בעצמו.
const PT_TONE = {
  Present: "#2E7D6B",
  Absent: "#C6716A",
};
const ptShort = (d) => `${+d.slice(8, 10)}.${+d.slice(5, 7)}`;
// נוכחות לפי קבוצה: לכל תאריך — מפה שחקן→סטטוס (נוכחות גוברת על היעדרות באותו יום)
function ptGroupData(gid, players, attendance) {
  let roster = players.filter((p) => p.groupId === gid && p.isActive && !p.deleted && !p.trial),
    ids = new Set(roster.map((p) => p.id)),
    byDate = {};
  attendance.forEach((a) => {
    if (a.groupId !== gid || !a.date || a.date > E() || !ids.has(a.playerId)) return;
    let m = (byDate[a.date] = byDate[a.date] || {});
    m[a.playerId] !== "Present" && (m[a.playerId] = a.status);
  });
  let dates = Object.keys(byDate).sort().reverse(),
    pctOf = (d) => {
      let v = Object.values(byDate[d]),
        n = v.length;
      return n ? Math.round((100 * v.filter((x) => x === "Present").length) / n) : null;
    };
  return { roster, byDate, dates, pctOf };
}
// שתי ההיעדרויות האחרונות של השחקן בקבוצה, כשהאחרונה היא date
function ptStreak(pid, date, gd) {
  let mine = gd.dates.filter((d) => d <= date && gd.byDate[d][pid]);
  return mine.length >= 2 && mine[0] === date && gd.byDate[mine[0]][pid] === "Absent" && gd.byDate[mine[1]][pid] === "Absent";
}
// מספר האימונים ברצף שפוספסו לפני date (לשחקן שחזר היום)
function ptMissedBefore(pid, date, gd) {
  let n = 0;
  for (let d of gd.dates) {
    if (d >= date || !gd.byDate[d][pid]) continue;
    if (gd.byDate[d][pid] !== "Absent") break;
    n++;
  }
  return n;
}
function PtCard({ children, className }) {
  return e.createElement("div", { className: `bg-white rounded-2xl ${className || ""}` }, children);
}
function PtTitle({ children }) {
  return e.createElement("p", { className: "text-sm font-bold text-slate-700 px-1 pt-2" }, children);
}
function PtSummary({ group, gd, onWhatsapp }) {
  let date = gd.dates[0];
  if (!date)
    return e.createElement(PtCard, { className: "p-5 text-center text-slate-600" }, "עוד לא סומנה נוכחות בקבוצה הזו");
  let day = gd.byDate[date],
    total = Object.keys(day).length,
    present = Object.values(day).filter((x) => x === "Present").length,
    pct = gd.pctOf(date),
    monthAgo = new Date(Date.parse(date + "T12:00:00Z") - 30 * 864e5).toISOString().slice(0, 10),
    prev = gd.dates.filter((d) => d < date && d >= monthAgo).map(gd.pctOf),
    avg = prev.length ? Math.round(prev.reduce((s, v) => s + v, 0) / prev.length) : null,
    diff = avg === null ? null : pct - avg,
    byId = Object.fromEntries(gd.roster.map((p) => [p.id, p])),
    absent = Object.keys(day)
      .filter((id) => day[id] === "Absent" && byId[id])
      .map((id) => ({ p: byId[id], streak: ptStreak(id, date, gd) }))
      .sort((a, c) => c.streak - a.streak),
    back = Object.keys(day)
      .filter((id) => day[id] === "Present" && byId[id])
      .map((id) => ({ p: byId[id], n: ptMissedBefore(id, date, gd) }))
      .filter((x) => x.n >= 2),
    last4 = gd.dates.slice(0, 4).reverse(),
    R = 44,
    C = 2 * Math.PI * R;
  return e.createElement(
    "div",
    { className: "flex flex-col gap-2" },
    e.createElement(
      PtCard,
      { className: "p-5 flex items-center gap-5" },
      e.createElement(
        "div",
        { className: "relative shrink-0", style: { width: 104, height: 104 } },
        e.createElement(
          "svg",
          { width: 104, height: 104, viewBox: "0 0 104 104", role: "img", "aria-label": `${present} מתוך ${total} הגיעו` },
          e.createElement("circle", { cx: 52, cy: 52, r: R, fill: "none", stroke: "#E9E9EE", strokeWidth: 12 }),
          e.createElement("circle", {
            cx: 52, cy: 52, r: R, fill: "none", stroke: PT_TONE.Present, strokeWidth: 12, strokeLinecap: "round",
            strokeDasharray: `${(C * pct) / 100} ${C}`, transform: "rotate(-90 52 52)",
          }),
        ),
        e.createElement(
          "div",
          { className: "absolute inset-0 flex flex-col items-center justify-center" },
          e.createElement("span", { className: "text-2xl font-extrabold leading-none" }, `${present}/${total}`),
          e.createElement("span", { className: "text-sm text-slate-500" }, "הגיעו"),
        ),
      ),
      e.createElement(
        "div",
        { className: "flex flex-col gap-2" },
        e.createElement("span", { className: "text-sm text-slate-500" }, Ke(date)),
        e.createElement("span", { className: "text-3xl font-extrabold text-emerald-700 leading-none" }, `${pct}%`),
        diff !== null &&
          e.createElement(
            "span",
            { className: `text-sm font-bold ${diff >= 0 ? "text-emerald-700" : "text-red-700"}` },
            diff === 0 ? "בדיוק ממוצע החודש" : `${Math.abs(diff)}% ${diff > 0 ? "מעל" : "מתחת"} לממוצע החודש`,
          ),
      ),
    ),
    absent.length > 0 && e.createElement(PtTitle, null, `לא הגיעו · ${absent.length}`),
    absent.length > 0 &&
      e.createElement(
        PtCard,
        { className: "overflow-hidden" },
        absent.map(({ p, streak }) =>
          e.createElement(
            "div",
            { key: p.id, className: "flex items-center gap-3 px-4 py-3 border-b border-slate-100 last:border-0" },
            e.createElement(
              "div",
              { className: "flex flex-col flex-1 min-w-0" },
              e.createElement("span", { className: "font-bold truncate" }, p.name),
              streak && e.createElement("span", { className: "text-sm font-bold text-red-700" }, "פעם שנייה ברצף"),
            ),
            onWhatsapp &&
              e.createElement(
                "button",
                {
                  onClick: () => onWhatsapp(p, "absence", group.id, date),
                  className: "h-11 px-4 rounded-full bg-emerald-50 text-emerald-700 font-bold text-sm",
                },
                "הודעה",
              ),
          ),
        ),
      ),
    back.length > 0 && e.createElement(PtTitle, null, `חזרו אחרי היעדרות · ${back.length}`),
    back.length > 0 &&
      e.createElement(
        PtCard,
        { className: "overflow-hidden" },
        back.map(({ p, n }) =>
          e.createElement(
            "div",
            { key: p.id, className: "flex items-center gap-3 px-4 py-3 border-b border-slate-100 last:border-0" },
            e.createElement("span", { className: "font-bold flex-1 truncate" }, p.name),
            e.createElement("span", { className: "text-sm text-slate-500" }, `אחרי ${n} אימונים`),
          ),
        ),
      ),
    last4.length > 1 && e.createElement(PtTitle, null, `${last4.length} אימונים אחרונים`),
    last4.length > 1 &&
      e.createElement(
        PtCard,
        { className: "p-4 flex justify-around items-end" },
        last4.map((d) => {
          let v = gd.pctOf(d);
          return e.createElement(
            "div",
            { key: d, className: "flex flex-col items-center gap-1" },
            e.createElement("span", { className: "text-sm font-bold" }, `${v}%`),
            e.createElement(
              "div",
              { className: "w-8 h-16 rounded-lg bg-slate-100 flex items-end overflow-hidden" },
              e.createElement("div", {
                className: "w-full rounded-lg",
                style: { height: `${v}%`, background: d === date ? PT_TONE.Present : "#8FC1B1" },
              }),
            ),
            e.createElement("span", { className: "text-sm text-slate-500" }, d === E() ? "היום" : ptShort(d)),
          );
        }),
      ),
  );
}
function PtHeatmap({ gd }) {
  let dates = gd.dates.slice(0, 8).reverse();
  if (!dates.length)
    return e.createElement(PtCard, { className: "p-5 text-center text-slate-600" }, "עוד לא סומנה נוכחות בקבוצה הזו");
  let cols = `minmax(0,7rem) repeat(${dates.length}, minmax(0,1fr)) 2.75rem`,
    rows = gd.roster
      .map((p) => {
        let marks = dates.map((d) => gd.byDate[d][p.id]),
          seen = marks.filter(Boolean);
        return {
          p, marks,
          pct: seen.length ? Math.round((100 * seen.filter((x) => x === "Present").length) / seen.length) : null,
        };
      })
      .sort((a, c) => (a.pct ?? 101) - (c.pct ?? 101)),
    avgs = dates.map(gd.pctOf),
    avg = Math.round(avgs.reduce((s, v) => s + v, 0) / avgs.length);
  return e.createElement(
    PtCard,
    { className: "p-3 flex flex-col gap-1" },
    e.createElement(
      "div",
      { className: "flex items-baseline justify-between px-1 pb-2" },
      e.createElement("span", { className: "text-sm font-bold text-slate-700" }, `${dates.length} אימונים אחרונים`),
      e.createElement("span", { className: "text-2xl font-extrabold" }, `${avg}%`),
    ),
    e.createElement(
      "div",
      { className: "grid gap-1 text-xs font-bold text-slate-500 items-center", style: { gridTemplateColumns: cols } },
      e.createElement("span", null),
      dates.map((d) => e.createElement("span", { key: d, className: "text-center" }, +d.slice(8, 10))),
      e.createElement("span", { className: "text-center" }, "%"),
    ),
    rows.map(({ p, marks, pct }) =>
      e.createElement(
        "div",
        { key: p.id, className: "grid gap-1 items-center h-9", style: { gridTemplateColumns: cols } },
        e.createElement("span", { className: "text-sm font-semibold truncate" }, p.name),
        marks.map((m, i) =>
          e.createElement("span", {
            key: i,
            "aria-label": m === "Present" ? "הגיע" : m === "Absent" ? "לא הגיע" : "לא סומן",
            className: "h-7 rounded-md",
            style: { background: PT_TONE[m] || "#E9E9EE" },
          }),
        ),
        e.createElement(
          "span",
          {
            className: `text-center text-sm font-extrabold ${pct === null ? "text-slate-400" : pct < 60 ? "text-red-700" : pct < 80 ? "text-amber-700" : "text-emerald-700"}`,
          },
          pct === null ? "—" : pct,
        ),
      ),
    ),
    e.createElement(
      "div",
      { className: "flex gap-4 pt-3 px-1 text-sm text-slate-700 font-semibold" },
      [["הגיע", PT_TONE.Present], ["לא הגיע", PT_TONE.Absent], ["לא סומן", "#E9E9EE"]].map(([l, c]) =>
        e.createElement(
          "span",
          { key: l, className: "flex items-center gap-1.5" },
          e.createElement("span", { className: "w-3.5 h-3.5 rounded", style: { background: c } }),
          l,
        ),
      ),
    ),
  );
}
function PtClub({ groups, data, onOpenGroup }) {
  let today = E(),
    wd = new Date(today + "T12:00:00").getDay(),
    tiles = groups.map((g) => {
      let gd = data[g.id],
        day = gd.byDate[today],
        n = day ? Object.keys(day).length : 0,
        pr = day ? Object.values(day).filter((x) => x === "Present").length : 0;
      return { g, gd, day, n, pr, pct: day ? gd.pctOf(today) : null, trainsToday: Y(g) && g.days.includes(wd) };
    }),
    cards = [];
  let streaks = [];
  tiles.forEach(({ g, gd, day }) =>
    day && Object.keys(day).forEach((id) => {
      let p = gd.roster.find((x) => x.id === id);
      p && ptStreak(id, today, gd) && streaks.push(`${p.name} · ${g.name}`);
    }),
  );
  streaks.length &&
    cards.push({ k: "s", tone: "red", title: `${streaks.length} נעדרו פעמיים ברצף`, detail: streaks.join(", ") });
  tiles.forEach(({ g, gd, pct }) => {
    if (pct === null) return;
    let prev = gd.dates.filter((d) => d < today).slice(0, 8).map(gd.pctOf),
      avg = prev.length ? Math.round(prev.reduce((s, v) => s + v, 0) / prev.length) : null;
    avg !== null && avg - pct >= 10 &&
      cards.push({ k: "d" + g.id, tone: "amber", title: `נוכחות ב${g.name} ירדה ל-${pct}%`, detail: `ממוצע 8 האימונים הקודמים ${avg}%`, gid: g.id });
  });
  tiles.forEach(({ g, day, trainsToday }) =>
    trainsToday && !day &&
      cards.push({ k: "m" + g.id, tone: "blue", title: `${g.name} עוד לא סומנה היום`, gid: g.id }),
  );
  let TONES = {
    red: "bg-red-50 text-red-800",
    amber: "bg-amber-50 text-amber-800",
    blue: "bg-blue-50 text-blue-900",
  };
  return e.createElement(
    "div",
    { className: "flex flex-col gap-2" },
    e.createElement(
      "div",
      { className: "grid grid-cols-2 gap-2" },
      tiles
        .filter((t) => t.day || t.trainsToday)
        .map((t) =>
          e.createElement(
            "button",
            {
              key: t.g.id,
              onClick: () => onOpenGroup && onOpenGroup(t.g.id),
              className: "bg-white rounded-2xl p-3 flex flex-col items-start text-right",
            },
            e.createElement("span", { className: "text-sm font-semibold text-slate-500 truncate w-full" }, t.g.name),
            e.createElement("span", { className: "text-2xl font-extrabold" }, t.pct === null ? "—" : `${t.pct}%`),
            e.createElement("span", { className: "text-sm text-slate-500" }, t.day ? `${t.pr} מתוך ${t.n}` : "לא סומן"),
          ),
        ),
    ),
    !tiles.some((t) => t.day || t.trainsToday) &&
      e.createElement(PtCard, { className: "p-5 text-center text-slate-600" }, "אין היום אימונים"),
    cards.length > 0 && e.createElement(PtTitle, null, `דורש טיפול · ${cards.length}`),
    cards.map((c) =>
      e.createElement(
        PtCard,
        { key: c.k, className: "p-4 flex flex-col gap-3" },
        e.createElement(
          "div",
          { className: `rounded-xl px-3 py-2 ${TONES[c.tone]}` },
          e.createElement("p", { className: "font-extrabold" }, c.title),
          c.detail && e.createElement("p", { className: "text-sm" }, c.detail),
        ),
        c.gid && onOpenGroup &&
          e.createElement(
            "button",
            { onClick: () => onOpenGroup(c.gid), className: "h-11 rounded-xl bg-blue-600 text-white font-bold" },
            "פתח את הקבוצה",
          ),
      ),
    ),
  );
}
function PostTrainingScreen({ groups, players, attendance, onWhatsapp, onOpenGroup }) {
  let [tab, setTab] = b("summary"),
    [gid, setGid] = b(null),
    data = Object.fromEntries(groups.map((g) => [g.id, ptGroupData(g.id, players, attendance)])),
    latest = groups.slice().sort((a, c) => (data[c.id].dates[0] || "").localeCompare(data[a.id].dates[0] || ""))[0],
    group = groups.find((g) => g.id === gid) || latest;
  if (!group)
    return e.createElement("div", { className: "p-6 text-center text-slate-600" }, "אין קבוצות להצגה");
  let TABS = [["summary", "סיכום"], ["map", "מפת נוכחות"], ["club", "המועדון היום"]];
  return e.createElement(
    "div",
    { className: "px-4 pt-4 pb-6 flex flex-col gap-3" },
    e.createElement(
      "div",
      { className: "grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl", role: "tablist" },
      TABS.map(([k, l]) =>
        e.createElement(
          "button",
          {
            key: k, role: "tab", "aria-selected": tab === k, onClick: () => setTab(k),
            className: `h-10 rounded-lg text-sm font-bold ${tab === k ? "bg-white text-blue-950 shadow-sm" : "text-slate-600"}`,
          },
          l,
        ),
      ),
    ),
    tab !== "club" &&
      groups.length > 1 &&
      e.createElement(
        "select",
        {
          "aria-label": "קבוצה",
          value: group.id,
          onChange: (ev) => setGid(ev.target.value),
          className: "h-11 rounded-xl border border-slate-200 bg-white px-3 font-bold",
        },
        groups.map((g) => e.createElement("option", { key: g.id, value: g.id }, g.name)),
      ),
    tab === "summary" && e.createElement(PtSummary, { group, gd: data[group.id], onWhatsapp }),
    tab === "map" && e.createElement(PtHeatmap, { gd: data[group.id] }),
    tab === "club" && e.createElement(PtClub, { groups, data, onOpenGroup }),
  );
}

var et = {
  "auth/invalid-email":
    "כתובת אימייל לא תקינה",
  "auth/user-not-found":
    "לא נמצא משתמש עם פרטים אלו",
  "auth/wrong-password":
    "סיסמה שגויה",
  "auth/invalid-credential":
    "אימייל או סיסמה שגויים",
  "auth/too-many-requests":
    "יותר מדי ניסיונות. נסה שוב בעוד כמה דקות",
  "auth/network-request-failed":
    "אין חיבור לאינטרנט. ההתחברות מחייבת חיבור — נסה שוב כשהחיבור יחזור",
  "auth/user-disabled":
    "החשבון הושבת. פנה למנהל המועדון",
};
function tt() {
  let [t, s] = b(""),
    [a, l] = b(""),
    [i, c] = b(""),
    [ok, setOk] = b(""),
    [n, m] = b(!1),
    o = async () => {
      (c(""), setOk(""), m(!0));
      try {
        await Ue(D, loginIdToEmail(t), a);
      } catch (x) {
        c(
          // מספר טלפון עובד רק להורים ושחקנים; מאמנים וצופים רשומים עם אימייל
          (!t.includes("@") && /credential|user-not-found|wrong-password/.test(x.code || "")
            ? "לא נמצא חשבון עם המספר והסיסמה האלה. מאמנים וצופים נכנסים עם כתובת האימייל שלהם, לא עם מספר הטלפון."
            : "") ||
            et[x.code] ||
            "שגיאה בהתחברות, נסה שוב",
        );
      } finally {
        m(!1);
      }
    },
    resetPw = async () => {
      if (!t.trim()) {
        (setOk(""),
          c("להזין אימייל למעלה ואז ללחוץ שוב על \u201Cשכחתי סיסמה\u201D"));
        return;
      }
      if (!t.includes("@")) {
        (setOk(""),
          c("איפוס סיסמה במייל אפשרי רק למי שרשום עם כתובת אימייל. אם נכנסת עם מספר טלפון — בקש ממנהל המועדון הזמנה חדשה."));
        return;
      }
      (c(""), setOk(""), m(!0));
      try {
        (await PRE(D, t.trim()),
          setOk("נשלח מייל לאיפוס הסיסמה אל " + t.trim()));
      } catch (x) {
        c(et[x.code] || "שליחת מייל האיפוס נכשלה, נסה שוב");
      } finally {
        m(!1);
      }
    };
  return e.createElement(
    "div",
    {
      dir: "rtl",
      className:
        "min-h-screen bg-blue-950 flex flex-col justify-center px-6 py-10",
    },
    e.createElement(
      "div",
      { className: "text-center mb-8" },
      e.createElement("img", {
        src: "./logo.png",
        alt: "",
        className:
          "w-24 h-24 rounded-2xl bg-white mx-auto mb-4 object-contain p-1.5",
      }),
      e.createElement(
        "h1",
        { className: "text-white text-xl font-bold leading-snug" },
        X,
      ),
      e.createElement("p", { className: "text-blue-300 text-sm mt-1" }, W),
    ),
    e.createElement(
      "div",
      { className: "flex flex-col gap-3" },
      e.createElement("input", {
        value: t,
        onChange: (x) => s(x.target.value),
        type: "text",
        placeholder: "טלפון או אימייל",
        dir: "ltr",
        onKeyDown: (x) => x.key === "Enter" && o(),
        className:
          "w-full bg-white rounded-xl py-3.5 px-4 text-sm outline-none text-right",
      }),
      e.createElement("input", {
        value: a,
        onChange: (x) => l(x.target.value),
        type: "password",
        placeholder: "סיסמה",
        dir: "ltr",
        className:
          "w-full bg-white rounded-xl py-3.5 px-4 text-sm outline-none text-right",
        onKeyDown: (x) => x.key === "Enter" && o(),
      }),
      i &&
        e.createElement(
          "p",
          { className: "text-red-300 text-sm text-center" },
          i,
        ),
      ok &&
        e.createElement(
          "p",
          { className: "text-emerald-300 text-sm text-center" },
          ok,
        ),
      e.createElement(
        "button",
        {
          onClick: o,
          disabled: n || !t || !a,
          className:
            "bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-xl py-3.5 mt-1",
        },
        n
          ? "מתחבר…"
          : "התחברות",
      ),
      e.createElement(
        "button",
        {
          onClick: resetPw,
          disabled: n,
          className: "text-blue-300 text-xs underline text-center mt-1",
        },
        "שכחתי סיסמה",
      ),
    ),
  );
}
function st({
  users: t,
  groups: s,
  players: a,
  attendance: l,
  onOpenAddPlayer: i,
  onOpenGroup,
  onOpenGroupDate,
  cancellations: CX,
  readOnly: RO,
  isAdmin: IA,
}) {
  useYearAttendance(a);
  let [o, x] = b(null),
    quotaAl = quotaAlerts(a, s, l),
    pastMissing = missingAttendanceDays(s, l, CX),
    uniqueActiveCount = countUniqueActivePlayers(a),
    { avgPct: g, sessions: r } = Je(l),
    y = () => {
      let d = E(),
        A = s
          .filter(
            (I) =>
              ee(I) &&
              !findCancellation(CX, I.id, d) &&
              !l.some((p) => p.groupId === I.id && p.date === d),
          )
          .flatMap((I) =>
            groupCoachIds(I)
              .map((cid) => t.find((p) => p.id === cid))
              .filter(Boolean)
              .map((coach) => ({ group: I, coach })),
          );
      x(A);
    },
    N = (d, A) => {
      let msg = `היי ${A.name}, תזכורת ידידותית למלא נוכחות עבור קבוצת ${d.name} להיום. תודה!`;
      if (!isValidPhone(A.phone || "")) {
        setDashErr(
          `למאמן ${A.name} אין מספר טלפון שמור — אפשר להוסיף אותו במסך ניהול הרשאות (עריכת משתמש).`,
        );
        return;
      }
      window.open(ne(normalizePhone(A.phone), msg), "_blank");
      V(M(P, "reminders"), {
        coachId: A.id,
        coachName: A.name,
        groupId: d.id,
        groupName: d.name,
        message: msg,
        createdAt: Oe(),
        processed: !0,
      }).catch((I) => console.warn("Reminder log not saved:", I));
    };
  let [dashErr, setDashErr] = b(""),
    todayG = s.filter((d) => ee(d)),
    todayDone = todayG.filter((d) => l.some((y) => y.groupId === d.id && y.date === E()) || findCancellation(CX, d.id, E())).length;
  return e.createElement(
    "div",
    { className: "desk-grid px-4 pt-4 pb-6 flex flex-col gap-5" },
    dashErr &&
      e.createElement(
        "div",
        {
          className:
            "bg-red-50 border border-red-200 rounded-xl p-3 flex items-start justify-between gap-2",
        },
        e.createElement(
          "button",
          { onClick: () => setDashErr(""), className: "text-red-400 shrink-0" },
          e.createElement(T, { className: "w-4 h-4" }),
        ),
        e.createElement(
          "p",
          { className: "text-xs text-red-700 text-right leading-relaxed" },
          dashErr,
        ),
      ),
    // 28.10 עיצוב "בריאות וכושר": טבעת נוכחות החודש (חוץ) ואימוני היום שמולאו (פנים)
    e.createElement(
      "div",
      { className: "desk-half lg:self-stretch rounded-2xl bg-white ios-card p-4 flex items-center gap-5" },
      e.createElement(ActivityRings, {
        outer: g,
        inner: todayG.length ? (100 * todayDone) / todayG.length : 0,
      }),
      e.createElement(
        "div",
        { className: "flex-1 min-w-0 grid gap-2.5" },
        e.createElement(
          "div",
          null,
          e.createElement("div", { className: "text-[28px] font-extrabold leading-none text-[#2F6DB5] tabular-nums" }, g === null ? "—" : `${g}%`),
          e.createElement("div", { className: "text-sm font-semibold text-slate-500 mt-1" }, "נוכחות החודש"),
        ),
        e.createElement(
          "div",
          null,
          e.createElement("div", { className: "text-[28px] font-extrabold leading-none text-emerald-700 tabular-nums" }, todayDone, "/", todayG.length),
          e.createElement("div", { className: "text-sm font-semibold text-slate-500 mt-1" }, "אימונים מולאו היום"),
        ),
      ),
    ),
    e.createElement(
      "div",
      { className: "desk-half lg:self-stretch grid grid-cols-3 gap-2" },
      [[uniqueActiveCount, "שחקנים"], [s.length, "קבוצות"], [r, "אימונים החודש"]].map(([v, lb]) =>
        e.createElement(
          "div",
          { key: lb, className: "rounded-2xl bg-white ios-card px-2 py-3 text-center lg:flex lg:flex-col lg:justify-center" },
          e.createElement("div", { className: "text-xl font-extrabold text-blue-950 tabular-nums" }, v),
          e.createElement("div", { className: "text-xs font-semibold text-slate-500 mt-0.5" }, lb),
        ),
      ),
    ),
    e.createElement(MissingDaysCard, {
      items: pastMissing,
      users: t,
      showCoach: !0,
      actionLabel: "פתיחה",
      onAction: RO
        ? null
        : (o2) =>
            onOpenGroupDate
              ? onOpenGroupDate(o2.group.id, o2.date)
              : onOpenGroup(o2.group.id),
    }),
    // 18.10: הודעות להורים יורדות מהדשבורד של המנהלת — הן אצל המאמנים (CoachHome), והבוט מזכיר להם כל בוקר
    e.createElement(QuotaAlertsCard, { alerts: quotaAl }),
    // רק למנהל: רישום התזכורת (reminders) חסום בחוקים לכל השאר, והוספת שחקן יש למאמן במסך הסימון
    IA &&
    e.createElement(
      "div",
      { className: "grid grid-cols-2 gap-3" },
      e.createElement(
        "button",
        {
          onClick: i,
          className:
            "bg-[#5E9E8C] rounded-full py-3.5 flex items-center justify-center gap-2 text-white font-semibold active:scale-[0.98] transition-transform",
        },
        e.createElement(K, { className: "w-4 h-4" }),
        " הוספת שחקן",
      ),
      e.createElement(
        "button",
        {
          onClick: y,
          className:
            "bg-[#3B82D6] rounded-full py-3.5 flex items-center justify-center gap-2 text-white font-semibold active:scale-[0.98] transition-transform",
        },
        e.createElement(J, { className: "w-4 h-4" }),
        " תזכורת למאמנים",
      ),
    ),
    o &&
      e.createElement(
        "div",
        { className: "bg-white rounded-xl border border-slate-200 p-4" },
        e.createElement(
          "div",
          { className: "flex items-center justify-between mb-2" },
          e.createElement(
            "button",
            { onClick: () => x(null), className: "text-slate-400" },
            e.createElement(T, { className: "w-4 h-4" }),
          ),
          e.createElement(
            "h3",
            { className: "font-semibold text-blue-950 text-sm" },
            "מאמנים שטרם רשמו נוכחות היום",
          ),
        ),
        o.length === 0
          ? e.createElement(
              "p",
              { className: "text-sm text-slate-500 text-center py-2" },
              "כל המאמנים כבר רשמו נוכחות היום ✅",
            )
          : e.createElement(
              "div",
              { className: "flex flex-col gap-2" },
              o.map(
                ({ group: d, coach: A }) =>
                  A &&
                  e.createElement(
                    "button",
                    {
                      key: d.id + "_" + A.id,
                      onClick: () => N(d, A),
                      className:
                        "flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2.5 disabled:opacity-50",
                    },
                    e.createElement(J, {
                      className: "w-4 h-4 text-blue-900 shrink-0",
                    }),
                    e.createElement(
                      "div",
                      { className: "text-right" },
                      e.createElement(
                        "div",
                        { className: "text-sm font-medium text-blue-950" },
                        A.name,
                      ),
                      e.createElement(
                        "div",
                        { className: "text-xs text-slate-500" },
                        d.name,
                        " \xB7 פתיחת תזכורת בוואטסאפ",
                      ),
                    ),
                  ),
              ),
            ),
      ),
    e.createElement(
      "div",
      { className: "flex flex-col gap-3 lg:grid lg:grid-cols-2" },
      e.createElement(
        "h2",
        { className: "text-xl font-extrabold text-blue-950 px-1 mt-1 lg:col-span-2" },
        "קבוצות",
      ),
      s.map((d) => {
        let A = groupCoachLabel(d, t),
          I = Ze(l, d.id, a),
          cancelledToday = findCancellation(CX, d.id, E());
        return e.createElement(
          "div",
          {
            key: d.id,
            className:
              "bg-white rounded-2xl ios-card overflow-hidden",
          },
          e.createElement(
            "button",
            {
              onClick: () => onOpenGroup(d.id),
              className: "w-full px-4 py-3.5 flex items-center justify-between",
            },
            e.createElement(we, {
              className: "w-4 h-4 text-slate-400 -rotate-90",
            }),
            e.createElement(
              "div",
              { className: "text-right flex-1 mr-3" },
              e.createElement(
                "div",
                { className: "font-semibold text-blue-950" },
                d.name,
                cancelledToday &&
                  e.createElement(
                    "span",
                    {
                      className:
                        "mr-1.5 text-xs font-semibold text-slate-500 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5",
                    },
                    "בוטל היום",
                  ),
              ),
              e.createElement(
                "div",
                { className: "text-xs text-slate-500" },
                A?.name || "—",
                " \xB7 ",
                q(d),
              ),
            ),
            e.createElement(
              "div",
              { className: "text-left shrink-0" },
              e.createElement(
                "div",
                { className: "text-lg font-extrabold text-emerald-700 tabular-nums" },
                I === null ? "—" : `${I}%`,
              ),
              e.createElement(
                "div",
                { className: "text-xs text-slate-400" },
                "נוכחות החודש",
              ),
            ),
          ),
        );
      }),
    ),
  );
}
function lt({ players: t, groups: s, onEditPlayer: EP }) {
  let [a, l] = b(""),
    c = t
      .filter((m) => m.isActive && !m.deleted)
      .filter((m) => (m.name || "").includes(a) || (m.parentName || "").includes(a)),
    n = s
      .map((m) => ({ group: m, players: c.filter((o) => o.groupId === m.id) }))
      .filter((m) => m.players.length > 0);
  return e.createElement(
    "div",
    { className: "desk-grid px-4 pt-4 pb-6 flex flex-col gap-4" },
    e.createElement(
      "div",
      { className: "relative" },
      e.createElement(Ne, {
        className:
          "w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2",
      }),
      e.createElement("input", {
        value: a,
        onChange: (m) => l(m.target.value),
        placeholder:
          "חיפוש לפי שם שחקן או הורה",
        className:
          "w-full bg-white border border-slate-200 rounded-xl py-3 pr-9 pl-3 text-sm text-right outline-none focus:border-emerald-400",
      }),
    ),
    n.length === 0 &&
      e.createElement(
        "p",
        { className: "text-center text-sm text-slate-400 py-8" },
        "לא נמצאו תוצאות",
      ),
    n.map(({ group: m, players: o }) =>
      e.createElement(
        "div",
        { key: m.id, className: "desk-half flex flex-col gap-2" },
        e.createElement(
          "h3",
          { className: "text-xs font-semibold text-slate-500 px-1" },
          m.name,
        ),
        e.createElement(
          "div",
          {
            className:
              "bg-white rounded-xl border border-slate-200 divide-y divide-slate-100",
          },
          o.map((x) =>
            e.createElement(
              "div",
              {
                key: x.id,
                className: "px-4 py-3 flex items-center justify-between gap-2",
              },
              e.createElement(
                "div",
                { className: "flex items-center gap-1.5 shrink-0" },
                isValidPhone(x.parentPhone) &&
                e.createElement(
                  "a",
                  {
                    href: ne(normalizePhone(x.parentPhone), ""),
                    target: "_blank",
                    rel: "noreferrer",
                    className:
                      "min-w-[44px] min-h-[44px] rounded-full bg-emerald-50 flex items-center justify-center",
                    "aria-label": "וואטסאפ",
                  },
                  e.createElement(te, {
                    className: "w-4 h-4 text-emerald-600",
                  }),
                ),
                isValidPhone(x.parentPhone) &&
                e.createElement(
                  "a",
                  {
                    href: `tel:+${normalizePhone(x.parentPhone)}`,
                    className:
                      "min-w-[44px] min-h-[44px] rounded-full bg-blue-50 flex items-center justify-center",
                    "aria-label": "חייג",
                  },
                  e.createElement(se, { className: "w-4 h-4 text-blue-900" }),
                ),
                EP &&
                  e.createElement(
                    "button",
                    {
                      onClick: () => EP(x),
                      className:
                        "min-w-[44px] min-h-[44px] rounded-full bg-slate-100 flex items-center justify-center",
                      "aria-label": "עריכת פרטי שחקן",
                    },
                    e.createElement($e, {
                      className: "w-4 h-4 text-slate-500",
                    }),
                  ),
              ),
              e.createElement(
                "div",
                { className: "text-right flex-1" },
                e.createElement(
                  "div",
                  { className: "text-sm font-medium text-blue-950" },
                  x.name,
                ),
                e.createElement(
                  "div",
                  { className: "text-xs text-slate-400" },
                  x.parentName ? x.parentName + " \xB7 " : "",
                  x.parentPhone,
                  playerDaysLabel(x) ? ` \xB7 ${playerDaysLabel(x)}` : "",
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}
function WhatsappModal({
  player: t,
  onClose: s,
  onSent: a,
  mode: MD,
  date: DT,
  adult: AD,
}) {
  let isAbs = MD === "absence",
    [gen, setGen] = b(playerGender(t)),
    [l, i] = b(
      isAbs
        ? absenceMsg(t, playerGender(t), DT, AD)
        : Ve(t.parentName, t.name, AD, playerGender(t)),
    ),
    [c, n] = b(!1),
    m = normalizePhone(t.parentPhone),
    o = isValidPhone(t.parentPhone),
    pickGender = (v) => {
      (setGen(v), i(isAbs ? absenceMsg(t, v, DT, AD) : Ve(t.parentName, t.name, AD, v)));
      setPlayerGender(t.id, v).catch((err) =>
        console.warn("Gender not saved:", err),
      );
    },
    x = () => {
      if (!o || !l.trim()) return;
      let popup = window.open(ne(m, l), "_blank");
      // אם חוסם חלונות קופצים מנע את הפתיחה, window.open מחזיר null/undefined —
      // אין לסמן את ההודעה כ"נשלחה" במקרה כזה, כי ההורה לא קיבל כלום.
      if (!popup) {
        window.alert(
          "הדפדפן חסם את פתיחת הוואטסאפ (חוסם חלונות קופצים). יש לאפשר חלונות קופצים לאתר ולנסות שוב — ההודעה לא סומנה כנשלחה.",
        );
        return;
      }
      (n(!0), a && a(), s());
    };
  return e.createElement(
    "div",
    {
      className: "fixed inset-0 bg-black/40 flex items-end justify-center z-50",
      onClick: s,
    },
    e.createElement(
      "div",
      {
        dir: "rtl",
        onClick: (h) => h.stopPropagation(),
        className:
          "bg-white w-full max-w-md rounded-t-2xl p-5 flex flex-col gap-3",
      },
      e.createElement(
        "div",
        { className: "flex items-center justify-between" },
        e.createElement(
          "button",
          {
            onClick: s,
            className:
              "min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400",
            "aria-label": "סגירה",
          },
          e.createElement(T, { className: "w-5 h-5" }),
        ),
        e.createElement(
          "div",
          { className: "text-right" },
          e.createElement(
            "h3",
            { className: "font-bold text-blue-950" },
            isAbs
              ? AD
                ? "הודעה על היעדרות — לשחקן"
                : "הודעה על היעדרות — להורה"
              : AD
                ? "הודעה לשחקן"
                : "הודעה להורה",
          ),
          e.createElement(
            "div",
            { className: "text-xs text-slate-500" },
            !AD && t.parentName ? t.parentName + " \xB7 " : "",
            t.name,
          ),
        ),
      ),
      !AD &&
        e.createElement(
          "div",
          { className: "flex items-center gap-2 justify-end" },
          e.createElement(
            "span",
            { className: "text-xs text-slate-500" },
            "פנייה בלשון",
          ),
          ["m", "f"].map((v) =>
            e.createElement(
              "button",
              {
                key: v,
                onClick: () => pickGender(v),
                className: `min-h-[44px] min-w-[44px] px-3 rounded-lg text-xs font-semibold border transition-colors ${gen === v ? "bg-blue-900 text-white border-blue-900" : "bg-white text-slate-500 border-slate-200"}`,
              },
              v === "m" ? "בן" : "בת",
            ),
          ),
        ),
      e.createElement("textarea", {
        value: l,
        onChange: (h) => i(h.target.value),
        rows: 5,
        className:
          "border border-slate-200 rounded-lg py-2.5 px-3 text-right text-sm leading-relaxed outline-none focus:border-emerald-400 resize-none",
      }),
      e.createElement(
        "p",
        { className: "text-xs text-slate-400 text-right leading-relaxed" },
        "אפשר לערוך את הנוסח לפני השליחה. ההודעה נפתחת בוואטסאפ שלך ונשלחת ממך.",
      ),
      !o &&
        e.createElement(
          "p",
          { className: "text-xs text-red-600 text-right" },
          "מספר הטלפון של ההורה אינו תקין. עדכן אותו בפרטי השחקן.",
        ),
      e.createElement(
        "button",
        {
          onClick: x,
          disabled: !o || !l.trim() || c,
          className:
            "mt-1 bg-emerald-500 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold rounded-xl py-3.5 min-h-[44px] active:scale-[0.98] transition-transform",
        },
        "פתיחה בוואטסאפ",
      ),
    ),
  );
}
function AlertsCard({
  alerts: t,
  onWhatsapp: s,
  onEdit: a,
}) {
  let [c, n] = b("");
  if (t.length === 0) return null;
  let m = async (o) => {
    n("");
    try {
      await markAlertHandled(o.player.id, o.dates[0]);
    } catch (x) {
      n("העדכון נכשל: " + x.message);
    }
  };
  return e.createElement(
    "div",
    {
      className: "bg-white rounded-2xl ios-card overflow-hidden",
    },
    e.createElement(
      "div",
      { className: "bg-amber-50 px-4 py-3 flex items-center gap-2" },
      e.createElement(ye, { className: "w-4 h-4 text-amber-600 shrink-0" }),
      e.createElement(
        "div",
        { className: "text-right flex-1" },
        e.createElement(
          "div",
          { className: "text-sm font-bold text-amber-900" },
          "דורש תשומת לב \xB7 ",
          t.length,
        ),
        e.createElement(
          "div",
          { className: "text-xs text-amber-700 leading-snug" },
          "שחקנים שנעדרו משני האימונים האחרונים",
        ),
      ),
    ),
    c &&
      e.createElement(
        "p",
        { className: "text-xs text-red-600 text-right px-4 py-2" },
        c,
      ),
    e.createElement(
      "div",
      { className: "divide-y divide-slate-100" },
      t.map((o) =>
        e.createElement(
          "div",
          {
            key: o.player.id,
            className: "px-3 py-3 flex items-center gap-1.5",
          },
          e.createElement(
            "button",
            {
              onClick: () => s(o.player),
              className:
                "min-w-[44px] min-h-[44px] rounded-full bg-emerald-500 flex items-center justify-center shrink-0 active:scale-95 transition-transform",
              "aria-label": "שליחת הודעה להורה",
            },
            e.createElement(te, { className: "w-4 h-4 text-white" }),
          ),
          a &&
            e.createElement(
              "button",
              {
                onClick: () => a(o.player),
                className:
                  "min-w-[44px] min-h-[44px] rounded-full bg-blue-50 flex items-center justify-center shrink-0",
                "aria-label": "עריכת פרטי שחקן",
              },
              e.createElement($e, { className: "w-4 h-4 text-blue-900" }),
            ),
          e.createElement(
            "button",
            {
              onClick: () => {
                m(o);
              },
              className:
                "min-w-[44px] min-h-[44px] rounded-full bg-slate-100 flex items-center justify-center shrink-0",
              "aria-label": "סימון כטופל",
            },
            e.createElement(Z, { className: "w-4 h-4 text-slate-500" }),
          ),
          e.createElement(
            "div",
            { className: "flex-1 text-right min-w-0" },
            e.createElement(
              "div",
              { className: "text-sm font-semibold text-blue-950 truncate" },
              o.player.name,
            ),
            e.createElement(
              "div",
              { className: "text-sm text-slate-600 break-words" },
              o.group ? o.group.name : "ללא קבוצה",
              " \xB7 נעדר ב-",
              formatHeDate(o.dates[1]),
              " וב-",
              formatHeDate(o.dates[0]),
            ),
          ),
        ),
      ),
    ),
  );
}
function missingAttendanceDays(groups, attendance, cancellations) {
  let days = 7,
    today = E(),
    base = new Date(today + "T00:00:00"),
    // אין תאריך רצפה קשיח: הגבול הוא טווח הימים שביקשו, ותאריך פתיחת הקבוצה
    out = [];
  groups.forEach((g) => {
    if (!Y(g)) return;
    for (let i = 1; i <= days; i++) {
      let d = new Date(base);
      d.setDate(d.getDate() - i);
      if (!g.days.includes(d.getDay())) continue;
      let ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (g.createdDate && ds < g.createdDate) continue;
      if (findCancellation(cancellations, g.id, ds)) continue;
      if (attendance.some((a) => a.groupId === g.id && a.date === ds)) continue;
      out.push({ group: g, date: ds });
    }
  });
  return out.sort(
    (a, l) =>
      l.date.localeCompare(a.date) || a.group.name.localeCompare(l.group.name, "he"),
  );
}
function MissingDaysCard({ items: t, users: US, showCoach: SC, onAction: OA, actionLabel: AL }) {
  if (t.length === 0) return null;
  return e.createElement(
    "div",
    { className: "bg-white rounded-2xl ios-card overflow-hidden" },
    e.createElement(
      "div",
      { className: "bg-orange-50 px-4 py-3 flex items-center gap-2" },
      e.createElement(ge, { className: "w-4 h-4 text-orange-600 shrink-0" }),
      e.createElement(
        "div",
        { className: "text-right flex-1" },
        e.createElement(
          "div",
          { className: "text-sm font-bold text-orange-900" },
          "נוכחות שלא דווחה \xB7 ",
          t.length,
        ),
        e.createElement(
          "div",
          { className: "text-xs text-orange-700 leading-snug" },
          "ימי אימון בשבוע האחרון שלא נשמרה בהם נוכחות",
        ),
      ),
    ),
    e.createElement(
      "div",
      { className: "divide-y divide-slate-100" },
      t.map((o) => {
        let coachLabel = SC ? groupCoachLabel(o.group, US) : null;
        return e.createElement(
          "div",
          {
            key: o.group.id + "_" + o.date,
            className: "px-3 py-3 flex items-center gap-2",
          },
          e.createElement(
            "div",
            { className: "flex-1 text-right min-w-0" },
            e.createElement(
              "div",
              { className: "text-sm font-semibold text-blue-950 truncate" },
              o.group.name,
            ),
            e.createElement(
              "div",
              { className: "text-xs text-slate-500 truncate" },
              Ke(o.date),
              coachLabel ? " \xB7 " + coachLabel.name : "",
            ),
          ),
          OA &&
            e.createElement(
              "button",
              {
                onClick: () => OA(o),
                className:
                  "shrink-0 bg-orange-500 text-white text-xs font-semibold rounded-lg px-3 py-2 min-h-[38px] active:scale-95 transition-transform",
              },
              AL,
            ),
        );
      }),
    ),
  );
}
function at({
  groups: t,
  onClose: s,
  player: a,
  allowedGroupIds: l,
  defaultGroupId: DG,
  canDelete: CD,
  players: PL,
  trial: TRIAL,
}) {
  let i = !!a,
    // מעבר שחקן בין קבוצות מותר בחוקים רק עם הרשאת ניהול קבוצות — בלעדיה בעריכה מוצגת רק הקבוצה הנוכחית
    c = l ? t.filter((v) => (i ? v.id === a.groupId : l.includes(v.id))) : t,
    [n, m] = b(a?.name || ""),
    [o, x] = b(a?.groupId || DG || c[0]?.id || ""),
    [h, u] = b(a?.parentName || ""),
    [f, g] = b(a?.parentPhone || ""),
    [WT, setWT] = b(a?.weeklyTarget != null ? String(a.weeklyTarget) : ""),
    [TD, setTD] = b(a?.trainingDays || []),
    // ילד בניסיון: מופיע בסימון, אבל לא נספר בסטטיסטיקה, ברשימות ההיעדרות ובתשלומים
    [TR, setTR] = b(a ? !!a.trial : !!TRIAL),
    toggleTD = (v) => {
      setTD(($) =>
        $.includes(v)
          ? $.filter((_) => _ !== v)
          : [...$, v].sort((_, oe) => _ - oe),
      );
    },
    [r, y] = b(!1),
    [N, C] = b(""),
    // בהוספה השדות הלא-חובה מקופלים כדי שכפתור השמירה יישאר על המסך גם עם
    // מקלדת פתוחה; בעריכה הכל פתוח כי באים לשנות פרט ספציפי
    [more, setMore] = b(i),
    [lastSaved, setLastSaved] = b(""),
    nameRef = e.useRef(null),
    d = f.trim().length === 0 || isValidPhone(f),
    selAdult = isAdultGroup(t.find((v) => v.id === o) || null),
    // שחקן פעיל אחר באותה קבוצה עם אותו שם — אזהרה, לא חסימה
    dupName = (PL || []).find(
      (v) =>
        v.groupId === o &&
        v.isActive &&
        !v.deleted &&
        v.id !== a?.id &&
        (v.name || "").trim() === n.trim(),
    ),
    A = n.trim() && o && d,
    I = async (addAnother) => {
      (y(!0), C(""));
      try {
        let v = {
          name: n.trim(),
          groupId: o,
          parentName: h.trim(),
          parentPhone: normalizePhone(f),
          weeklyTarget: WT.trim() ? Number(WT) : null,
          monthlyTarget: WT.trim() ? Math.round(Number(WT) * 4.345) : null,
          yearlyTarget: WT.trim() ? Number(WT) * 52 : null,
          trainingDays: TD,
          trial: TR,
        };
        i
          ? await O(S(P, "players", a.id), v)
          : await V(M(P, "players"), {
              ...v,
              joinDate: E(),
              endDate: null,
              isActive: !0,
            });
        if (addAnother) {
          // "שמירה והוספת עוד": הקבוצה וימי האימון נשארים, הפרטים האישיים מתנקים
          setLastSaved(v.name);
          m("");
          u("");
          g("");
          setWT("");
          nameRef.current && nameRef.current.focus();
        } else s();
      } catch (v) {
        C("השמירה נכשלה: " + v.message);
      } finally {
        y(!1);
      }
    },
    delPlayer = async () => {
      if (
        !(await askConfirm(
          `למחוק את "${n}" מהמערכת? הוא יוסר מכל המסכים הפעילים (רשימות, ספר טלפונים, קבוצה), אך היסטוריית הנוכחות שלו תישמר בדוחות. הפעולה אינה הפיכה.`,
          { yes: "כן, למחוק", danger: !0 },
        ))
      )
        return;
      (y(!0), C(""));
      try {
        (await O(S(P, "players", a.id), {
          deleted: !0,
          isActive: !1,
          endDate: E(),
        }),
          s());
      } catch (v) {
        C("המחיקה נכשלה: " + v.message);
      } finally {
        y(!1);
      }
    },
    p = (v, k, $, D2, ref) =>
      e.createElement(
        "div",
        { className: "flex flex-col gap-1" },
        e.createElement("label", { className: "text-xs text-slate-500" }, v),
        e.createElement("input", {
          ref: ref || null,
          value: k,
          onChange: (z) => $(z.target.value),
          dir: D2 || "rtl",
          className:
            "border border-slate-200 rounded-lg py-2.5 px-3 text-right text-sm outline-none focus:border-emerald-400 min-h-[44px]",
        }),
      ),
    moreFields = e.createElement(
      e.Fragment,
      null,
      !selAdult && p("שם ההורה (לא חובה)", h, u),
      e.createElement(
        "div",
        { className: "flex flex-col gap-1.5" },
        e.createElement(
          "label",
          { className: "text-xs text-slate-500" },
          "ימי אימון קבועים (לא חובה)",
        ),
        e.createElement(
          "div",
          { className: "flex gap-1.5 flex-wrap" },
          We.map((v, $) =>
            e.createElement(
              "button",
              {
                key: $,
                type: "button",
                onClick: () => toggleTD($),
                className: `w-10 h-10 rounded-lg text-sm font-semibold border transition-colors ${TD.includes($) ? "bg-blue-900 text-white border-blue-900" : "bg-white text-slate-500 border-slate-200"}`,
                "aria-label": v,
              },
              ie[$],
            ),
          ),
        ),
        e.createElement(
          "p",
          { className: "text-xs text-slate-400 leading-relaxed" },
          "אם לא נבחרו ימים, השחקן ייחשב זמין בכל ימי האימון של הקבוצה.",
        ),
      ),
      e.createElement(
        "div",
        { className: "flex flex-col gap-1" },
        e.createElement(
          "label",
          { className: "text-xs text-slate-500" },
          "מכסת אימונים שבועית צפויה (לא חובה — להתראה על חריגה)",
        ),
        e.createElement("input", {
          value: WT,
          onChange: (v) => setWT(v.target.value.replace(/[^0-9]/g, "")),
          placeholder: "מספר אימונים בשבוע",
          inputMode: "numeric",
          className:
            "border border-slate-200 rounded-lg py-2.5 px-3 text-center text-sm outline-none focus:border-emerald-400 min-h-[44px]",
        }),
        WT.trim() &&
          e.createElement(
            "p",
            { className: "text-xs text-slate-400 text-right" },
            `החישוב האוטומטי: כ-${Math.round(Number(WT) * 4.345)} בחודש, ${Number(WT) * 52} בשנה`,
          ),
      )
    );
  return e.createElement(
    "div",
    {
      className: "fixed inset-0 bg-black/40 flex items-end justify-center z-50",
      onClick: s,
    },
    e.createElement(
      "div",
      {
        dir: "rtl",
        onClick: (v) => v.stopPropagation(),
        className:
          "bg-white w-full max-w-md rounded-t-2xl p-5 flex flex-col gap-3.5 max-h-[90vh] overflow-y-auto",
      },
      e.createElement(
        "div",
        { className: "flex items-center justify-between" },
        e.createElement(
          "button",
          {
            onClick: s,
            className:
              "min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400",
            "aria-label": "סגירה",
          },
          e.createElement(T, { className: "w-5 h-5" }),
        ),
        e.createElement(
          "h3",
          { className: "font-bold text-blue-950" },
          i ? "עריכת פרטי שחקן" : TR ? "ילד בניסיון" : "הוספת שחקן",
        ),
      ),
      p("שם השחקן", n, m, null, nameRef),
      e.createElement(
        "label",
        { className: "flex items-center gap-2 text-sm text-slate-700 min-h-[44px] cursor-pointer" },
        e.createElement("input", {
          type: "checkbox",
          checked: TR,
          onChange: (v) => setTR(v.target.checked),
          className: "w-5 h-5 accent-emerald-600",
        }),
        "בניסיון — עוד לא שחקן קבוע",
      ),
      dupName &&
        e.createElement(
          "p",
          { className: "text-xs text-amber-700 text-right" },
          "שים לב: כבר יש בקבוצה הזו שחקן פעיל בשם הזה.",
        ),
      e.createElement(
        "div",
        { className: "flex flex-col gap-1" },
        e.createElement(
          "label",
          { className: "text-xs text-slate-500" },
          "קבוצה",
        ),
        e.createElement(
          "select",
          {
            value: o,
            onChange: (v) => x(v.target.value),
            className:
              "border border-slate-200 rounded-lg py-2.5 px-3 text-right text-sm outline-none focus:border-emerald-400 bg-white min-h-[44px]",
          },
          c.map((v) =>
            e.createElement("option", { key: v.id, value: v.id }, v.name),
          ),
        ),
      ),
      p(
        selAdult ? "טלפון השחקן" : "טלפון ההורה",
        f,
        g,
        "ltr",
      ),
      e.createElement(
        "p",
        { className: "text-xs text-slate-400 text-right leading-relaxed" },
        selAdult
          ? "זו קבוצת מבוגרים — הודעות על היעדרות יישלחו לשחקן עצמו."
          : "זו קבוצת ילדים ונוער — הודעות על היעדרות יישלחו להורה."
      ),
      f.trim().length > 0 &&
        !d &&
        e.createElement(
          "p",
          { className: "text-xs text-red-600 text-right" },
          "מספר לא תקין. אפשר להזין 050-1234567 או 9725XXXXXXXX.",
        ),
      e.createElement(
        "button",
        {
          type: "button",
          onClick: () => setMore(!more),
          "aria-expanded": more,
          className:
            "self-start text-sm font-semibold text-blue-900 min-h-[44px] flex items-center gap-1.5",
        },
        more ? "פחות פרטים" : "פרטים נוספים (לא חובה)",
      ),
      more && moreFields,
      lastSaved &&
        e.createElement(
          "p",
          { className: "text-xs text-emerald-700 text-right" },
          "נשמר: ",
          lastSaved,
          ". אפשר להוסיף את הבא.",
        ),
      N &&
        e.createElement(
          "p",
          { className: "text-xs text-red-600 text-right" },
          N,
        ),
      e.createElement(
        "button",
        {
          disabled: !A || r,
          onClick: () => I(!1),
          className:
            "mt-1 bg-emerald-500 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold rounded-xl py-3.5 min-h-[44px]",
        },
        r ? "שומר…" : "שמירה",
      ),
      !i &&
        e.createElement(
          "button",
          {
            disabled: !A || r,
            onClick: () => I(!0),
            className:
              "bg-white border border-emerald-300 disabled:border-slate-200 disabled:text-slate-400 text-emerald-700 font-semibold rounded-xl py-3 min-h-[44px] text-sm",
          },
          "שמירה והוספת שחקן נוסף",
        ),
      i &&
        CD &&
        // מי שאינו מנהל מוחק רק שחקנים בקבוצות שהוא מאמן
        (!l || l.includes(a.groupId)) &&
        e.createElement(
          "button",
          {
            disabled: r,
            onClick: delPlayer,
            className:
              "text-red-600 text-sm font-medium py-2 min-h-[44px] text-center",
          },
          "מחיקת שחקן מהמערכת",
        ),
    ),
  );
}
var DAY_LETTERS = { א: 0, ב: 1, ג: 2, ד: 3, ה: 4, ו: 5, ש: 6 };
// פיצול שורת CSV עם תמיכה בשדות במירכאות ("כהן, יוסי") — כמו הקובץ שהייצוא שלנו מפיק
function splitCsvLine(line) {
  let out = [],
    cur = "",
    q = !1;
  for (let i = 0; i < line.length; i++) {
    let ch = line[i];
    if (q) {
      if (ch === '"') {
        if (line[i + 1] === '"') (cur += '"'), i++;
        else q = !1;
      } else cur += ch;
    } else if (ch === '"') q = !0;
    else if (ch === "," || ch === "\t") (out.push(cur.trim()), (cur = ""));
    else cur += ch;
  }
  return (out.push(cur.trim()), out);
}
function parseRoster(text) {
  let lines = String(text || "").replace(/^\uFEFF/, "").split("\n"),
    current = null,
    rows = [],
    errors = [];
  lines.forEach((raw, idx) => {
    let line = raw.trim();
    if (!line) return;
    if (line.startsWith("#") || line.endsWith(":")) {
      let body = line.replace(/^#/, "").replace(/:$/, "").trim(),
        parts = body.split("|"),
        name = (parts[0] || "").trim(),
        days = (parts[1] || "")
          .split(/[,\s]+/)
          .map((d) => DAY_LETTERS[d.replace(/['׳]/g, "").trim()])
          .filter((n) => n !== void 0);
      if (!name) {
        errors.push(`שורה ${idx + 1}: שם קבוצה ריק`);
        return;
      }
      current = { name, days };
      return;
    }
    let cells = splitCsvLine(line),
      name = cells[0],
      phone = cells[1] || "",
      parentName = cells[2] || "";
    // שורת כותרת של CSV (כמו בייצוא שלנו) — לא שחקן
    if (!name || /^שם( השחקן)?$/.test(name)) return;
    if (!current) {
      errors.push(`שורה ${idx + 1}: "${name}" מופיע לפני שהוגדרה קבוצה`);
      return;
    }
    rows.push({
      name,
      phone,
      parentName,
      groupName: current.name,
      groupDays: current.days,
    });
  });
  return { rows, errors };
}
function ImportScreen({ groups: t, players: s }) {
  let [text, setText] = b(""),
    [busy, setBusy] = b(!1),
    [log, setLog] = b(null),
    parsed = parseRoster(text),
    groupNameById = {},
    existing = new Set();
  t.forEach((g) => (groupNameById[g.id] = (g.name || "").trim()));
  s.forEach((p) => {
    if (p.deleted) return;
    existing.add(
      (p.name || "").trim() + "@" + (groupNameById[p.groupId] || "").trim(),
    );
  });
  // שם שמופיע פעמיים באותה הדבקה (באותה קבוצה) נוצר פעם אחת
  let rows = parsed.rows.map((r) => {
      let key = r.name + "@" + r.groupName,
        st = existing.has(key) ? "exists" : "new";
      existing.add(key);
      return { ...r, status: st };
    }),
    newRows = rows.filter((r) => r.status === "new"),
    knownGroups = new Set(t.map((g) => (g.name || "").trim())),
    newGroups = [...new Set(rows.map((r) => r.groupName))].filter(
      (n) => !knownGroups.has(n),
    ),
    noPhone = newRows.filter((r) => !r.phone.trim()).length,
    phoneSeen = {},
    dupPhones = [];
  newRows.forEach((r) => {
    let p = normalizePhone(r.phone);
    if (!p) return;
    if (phoneSeen[p] && phoneSeen[p] !== r.name)
      dupPhones.push(`${phoneSeen[p]} / ${r.name}`);
    else phoneSeen[p] = r.name;
  });
  let run = async () => {
    (setBusy(!0), setLog(null));
    let result = { groups: 0, players: 0, errors: [] };
    try {
      let map = {};
      t.forEach((g) => (map[(g.name || "").trim()] = g.id));
      for (let name of [...new Set(newRows.map((r) => r.groupName))]) {
        if (map[name]) continue;
        let sample = newRows.find((r) => r.groupName === name);
        try {
          let ref = await V(M(P, "groups"), {
            name,
            coachId: null,
            days: (sample && sample.groupDays) || [],
            schedule: "",
            location: "",
            createdDate: E(),
          });
          ((map[name] = ref.id), result.groups++);
        } catch (err) {
          result.errors.push(`קבוצה ${name}: ${err.message}`);
        }
      }
      for (let r of newRows) {
        if (!map[r.groupName]) continue;
        try {
          (await V(M(P, "players"), {
            name: r.name,
            groupId: map[r.groupName],
            parentName: r.parentName || "",
            parentPhone: r.phone.trim() ? normalizePhone(r.phone) : "",
            joinDate: E(),
            endDate: null,
            isActive: !0,
          }),
            result.players++);
        } catch (err) {
          result.errors.push(`${r.name}: ${err.message}`);
        }
      }
    } catch (err) {
      result.errors.push(err.message);
    }
    (setBusy(!1), setLog(result));
  };
  let chip = (label, value, tone) =>
    e.createElement(
      "div",
      {
        className: `flex-1 rounded-xl border p-3 text-center ${tone || "bg-white border-slate-200"}`,
      },
      e.createElement("div", { className: "text-xl font-bold" }, value),
      e.createElement(
        "div",
        { className: "text-xs text-slate-500 leading-tight" },
        label,
      ),
    );
  return e.createElement(
    "div",
    { className: "px-4 pt-4 pb-6 flex flex-col gap-4" },
    e.createElement(
      "div",
      { className: "bg-white rounded-xl border border-slate-200 p-4" },
      e.createElement(
        "h2",
        { className: "font-bold text-blue-950 text-right" },
        "ייבוא שחקנים",
      ),
      e.createElement(
        "p",
        {
          className:
            "text-xs text-slate-500 text-right leading-relaxed mt-1.5",
        },
        'שורה שמתחילה ב-# היא שם קבוצה, ואפשר להוסיף אחריה " | " וימי אימון (א,ב,ג…). כל שורה אחריה היא שחקן: שם, טלפון, ושם הורה — הטלפון ושם ההורה לא חובה.',
      ),
      e.createElement(
        "p",
        { className: "text-xs text-slate-400 text-right mt-1" },
        "שחקן שכבר קיים באותה קבוצה לא ייובא פעמיים. קבוצה חדשה תיווצר בלי מאמן — אפשר לשייך אותה במסך ניהול הקבוצות.",
      ),
    ),
    e.createElement("textarea", {
      value: text,
      onChange: (ev) => setText(ev.target.value),
      rows: 12,
      dir: "rtl",
      placeholder:
        "# \u05e9\u05dd \u05e7\u05d1\u05d5\u05e6\u05d4 | \u05d0,\u05d3\n\u05e9\u05dd \u05d4\u05e9\u05d7\u05e7\u05df, 050-1234567, \u05e9\u05dd \u05d4\u05d4\u05d5\u05e8\u05d4",
      className:
        "border border-slate-200 rounded-xl py-3 px-3 text-right text-sm leading-relaxed outline-none focus:border-emerald-400 font-mono",
    }),
    e.createElement(
      "div",
      { className: "flex gap-2" },
      chip("שחקנים חדשים", newRows.length, "bg-emerald-50 border-emerald-200"),
      chip("כבר קיימים", rows.length - newRows.length),
      chip("קבוצות חדשות", newGroups.length),
    ),
    (parsed.errors.length > 0 || dupPhones.length > 0 || noPhone > 0) &&
      e.createElement(
        "div",
        {
          className:
            "bg-amber-50 border border-amber-200 rounded-xl p-3 flex flex-col gap-1 text-right",
        },
        parsed.errors.map((err, i) =>
          e.createElement(
            "p",
            { key: "e" + i, className: "text-xs text-amber-800" },
            err,
          ),
        ),
        noPhone > 0 &&
          e.createElement(
            "p",
            { className: "text-xs text-amber-800" },
            `${noPhone} שחקנים ללא טלפון — אפשר להשלים אחר כך בעריכת שחקן.`,
          ),
        dupPhones.length > 0 &&
          e.createElement(
            "p",
            { className: "text-xs text-amber-800" },
            "אותו טלפון מופיע ליותר משם אחד: " + dupPhones.join(", "),
          ),
      ),
    newGroups.length > 0 &&
      e.createElement(
        "p",
        { className: "text-xs text-slate-500 text-right" },
        "ייווצרו הקבוצות: " + newGroups.join(", "),
      ),
    e.createElement(
      "div",
      {
        className:
          "bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 max-h-72 overflow-y-auto",
      },
      rows.slice(0, 120).map((r, i) =>
        e.createElement(
          "div",
          {
            key: i,
            className: "px-3 py-2 flex items-center justify-between gap-2",
          },
          e.createElement(
            "span",
            {
              className: `text-xs px-2 py-0.5 rounded-full shrink-0 ${r.status === "new" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"}`,
            },
            r.status === "new" ? "חדש" : "קיים",
          ),
          e.createElement(
            "div",
            { className: "text-right flex-1 min-w-0" },
            e.createElement(
              "div",
              { className: "text-sm text-blue-950 truncate" },
              r.name,
            ),
            e.createElement(
              "div",
              { className: "text-xs text-slate-400 truncate" },
              r.groupName,
              r.phone ? " · " + normalizePhone(r.phone) : " · ללא טלפון",
            ),
          ),
        ),
      ),
      rows.length === 0 &&
        e.createElement(
          "p",
          { className: "text-center text-xs text-slate-400 py-6" },
          "אין שורות לייבוא",
        ),
    ),
    e.createElement(
      "button",
      {
        onClick: run,
        disabled: busy || newRows.length === 0,
        className:
          "bg-emerald-500 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold rounded-xl py-3.5 min-h-[44px]",
      },
      busy ? "מייבא…" : `ייבוא ${newRows.length} שחקנים`,
    ),
    log &&
      e.createElement(
        "div",
        {
          className: `rounded-xl border p-3 text-right flex flex-col gap-1 ${log.errors.length ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200"}`,
        },
        e.createElement(
          "p",
          { className: "text-sm font-semibold text-blue-950" },
          `נוספו ${log.players} שחקנים ו-${log.groups} קבוצות`,
        ),
        log.errors.map((err, i) =>
          e.createElement(
            "p",
            { key: "r" + i, className: "text-xs text-red-700" },
            err,
          ),
        ),
      ),
  );
}

// כניסה עם מספר טלפון (חשבונות הורים ישנים) — הפורטל עצמו הוסר
var MEMBER_EMAIL_DOMAIN = "members.ttcmh.app";
function memberEmailFromPhone(v) {
  return normalizePhone(v) + "@" + MEMBER_EMAIL_DOMAIN;
}
function loginIdToEmail(v) {
  let s = String(v || "").trim();
  return s.includes("@") ? s : memberEmailFromPhone(s);
}
function normalizeHeName(v) {
  return String(v || "")
    .replace(/["'׳״‘’“”]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
