import xt from "react";
import { createRoot as bt } from "react-dom/client";
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
  ChevronUp as ke,
  LogOut as Ce,
  Home as le,
  Bell as J,
  Archive as Ae,
  Menu as Pe,
  Shield as Ie,
  Trash2 as Se,
  Pencil as $e,
  ArrowRight as je,
  FileText as ReportsIcon,
  Ban as BanIcon,
  RotateCcw as UndoIcon,
  Trophy as TrophyIcon,
  Settings as SettingsIcon,
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
import { getToken as ze, onMessage as Fe } from "firebase/messaging";
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
import { getMessaging as fe, isSupported as ve } from "firebase/messaging";
var B = {
    apiKey: "AIzaSyCmEVnBSkODaCZyrdEdO0vNQtvOnvgsQiA",
    authDomain: "ttcmh-2a752.firebaseapp.com",
    databaseURL: "https://ttcmh-2a752-default-rtdb.firebaseio.com",
    projectId: "ttcmh-2a752",
    storageBucket: "ttcmh-2a752.firebasestorage.app",
    messagingSenderId: "198162387540",
    appId: "1:198162387540:web:f4c4728a39aed9468c13c1",
  },
  G = "";
var z = de(B),
  D = me(z),
  P = xe(z, { localCache: be({ tabManager: pe() }) });
ue(D, ce).catch((t) => {
  console.warn("Auth persistence not available:", t);
});
var F =
  typeof window < "u"
    ? ve()
        .then((t) => (t ? fe(z) : null))
        .catch(() => null)
    : Promise.resolve(null);
async function logoutAndClearCache() {
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
  E = () => new Date().toLocaleDateString("en-CA");
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
function isAdultGroup(g) {
  if (!g) return !1;
  if (typeof g.isAdultGroup == "boolean") return g.isAdultGroup;
  return /מבוגרים|בוגרים|פרקינסון|סגל|ותיקים/.test(
    (g && g.name) || "",
  );
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
var maleNameExceptions = [
  "משה",
  "שלמה",
  "אריה",
  "יהודה",
  "נחמיה",
  "ישעיה",
  "ירמיה",
  "זכריה",
  "עובדיה",
  "חזקיה",
  "שמעיה",
  "חנניה",
  "נריה",
  "הושע",
  "אלישע",
  "יונה",
  "עזריה",
  "אליה",
];
var femaleNameHints = [
  "אסתר",
  "רחל",
  "מרים",
  "יעל",
  "רות",
  "אביגיל",
  "מיכל",
  "אורלי",
  "שלי",
  "נטלי",
  "ליהי",
  "ספיר",
  "עינב",
  "קרן",
  "נופר",
  "שירי",
  "סמדר",
  "יסמין",
  "לילך",
  "סיון",
  "שני",
  "אלינור",
  "גפן",
  "מרגלית",
  "שולמית",
  "רויטל",
  "ליאל",
  "תמר",
  "ענבר",
  "נעמי",
];
function guessGender(name) {
  let first = String(name || "")
    .trim()
    .split(/\s+/)[0];
  if (!first) return "m";
  if (femaleNameHints.includes(first)) return "f";
  if (maleNameExceptions.includes(first)) return "m";
  return /[הת]$/.test(first) ? "f" : "m";
}
function playerGender(p) {
  return p && (p.gender === "f" || p.gender === "m")
    ? p.gender
    : guessGender(p ? p.name : "");
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
function normalizePhone(value) {
  let digits = String(value || "").replace(/\D/g, "");
  // 00972… / +972 050-… / 972-050-… — מורידים את קידומת החו"ל ואת ה-0 המוביל שאחריה
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("972")) return "972" + digits.slice(3).replace(/^0+/, "");
  if (digits.startsWith("0")) return "972" + digits.replace(/^0+/, "");
  if (digits.length === 9 && digits.startsWith("5")) return "972" + digits;
  return digits;
}
function isValidPhone(value) {
  return /^972\d{8,9}$/.test(normalizePhone(value));
}
function countUniqueActivePlayers(players) {
  let seen = new Set(),
    count = 0;
  players.forEach((p) => {
    if (!p.isActive || p.deleted) return;
    let key =
      (p.name || "").trim().toLowerCase() +
      "|" +
      normalizePhone(p.parentPhone || "");
    if (seen.has(key)) return;
    (seen.add(key), count++);
  });
  return count;
}
function lastTwoAbsences(attendance, playerId) {
  // רשומה אחת לכל יום (שחקן שעבר קבוצה באותו יום לא נספר פעמיים); נוכחות גוברת על היעדרות
  let byDate = new Map();
  attendance.forEach((a) => {
    if (a.playerId !== playerId || a.date === E()) return;
    let prev = byDate.get(a.date);
    (!prev || prev.status !== "Present") && byDate.set(a.date, a);
  });
  let recs = [...byDate.values()].sort((x, y) => y.date.localeCompare(x.date));
  if (recs.length < 2) return null;
  if (recs[0].status !== "Absent" || recs[1].status !== "Absent") return null;
  return [recs[0].date, recs[1].date];
}
function absenceAlerts(players, groups, attendance, allowedGroupIds) {
  let out = [];
  players.forEach((p) => {
    if (!p.isActive || p.deleted) return;
    if (allowedGroupIds && !allowedGroupIds.includes(p.groupId)) return;
    let dates = lastTwoAbsences(attendance, p.id);
    if (!dates) return;
    if (p.alertHandledDate && p.alertHandledDate >= dates[0]) return;
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
  await De(
    S(P, "attendance", `${date}_${groupId}_${playerId}`),
    {
      date,
      groupId,
      playerId,
      status: "Absent",
      msgSentAt: new Date().toISOString(),
      msgSentBy: userId || "",
    },
    { merge: !0 },
  );
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
function isCoachLikeUser(u) {
  let r = u && typeof u.role === "string" ? u.role.trim().toLowerCase() : "";
  return r === "admin" || r === "coach";
}
function roleLabelHe(u) {
  let r = u && typeof u.role === "string" ? u.role.trim().toLowerCase() : "";
  return r === "admin" ? "מנהל" : r === "coach" ? "מאמן" : r === "viewer" ? "צופה" : "הורה/שחקן";
}
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
    .filter((u) => u && isCoachLikeUser(u))
    .map((u) => u.name)
    .filter(Boolean);
}
// מזהים ששויכו לקבוצה אך אינם מאמנים יותר — מוצגים בניהול ההרשאות כדי שאפשר יהיה להסיר אותם
function staleCoachIds(g, users) {
  return groupCoachIds(g).filter((id) => {
    let u = (users || []).find((v) => v.id === id);
    return u && !isCoachLikeUser(u);
  });
}
function groupCoachLabel(g, users) {
  let n = groupCoachNames(g, users).join(", ");
  return n ? { name: n } : null;
}
var CANCEL_REASONS = [
  "מזג אוויר",
  "מצב ביטחוני",
  "האולם לא זמין",
  "המאמן נעדר",
  "מיעוט משתתפים",
  "אחר",
];
function cancellationId(date, groupId) {
  return `${date}_${groupId}`;
}
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
  let keys = new Set(cancellations.map((c) => cancellationId(c.date, c.groupId)));
  return attendance.filter((a) => !keys.has(cancellationId(a.date, a.groupId)));
}
async function cancelTraining({ date, groupId, reason, note, userId }) {
  // רשומות הנוכחות של היום לא נמחקות: excludeCancelled מסתיר אותן בכל החישובים,
  // וביטול-הביטול מחזיר אותן כמו שהיו.
  let batch = Te(P);
  batch.set(S(P, "cancellations", cancellationId(date, groupId)), {
    date,
    groupId,
    reason,
    note: note || "",
    cancelledBy: userId,
    createdAt: Oe(),
  });
  await batch.commit();
}
async function undoCancellation(c) {
  await Ee(S(P, "cancellations", c.id));
}
function CancelTrainingModal({ group, date, hasAttendance, onConfirm, onClose }) {
  let [reason, setReason] = b(CANCEL_REASONS[0]),
    [note, setNote] = b(""),
    [saving, setSaving] = b(!1),
    [err, setErr] = b(""),
    submit = async () => {
      if (reason === "אחר" && !note.trim()) {
        setErr("נא לפרט את סיבת הביטול");
        return;
      }
      if (
        hasAttendance &&
        !window.confirm(
          "כבר נשמרה נוכחות להיום לקבוצה זו. אחרי ביטול האימון היום לא ייספר בשום חישוב. להמשיך?",
        )
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
              "text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-right leading-relaxed",
          },
          "שים לב: כבר נשמרה נוכחות להיום. אחרי הביטול היום לא ייספר בשום חישוב (ביטול הביטול מחזיר אותו).",
        ),
      err &&
        e.createElement("p", { className: "text-xs text-red-600 text-right" }, err),
      e.createElement(
        "button",
        {
          disabled: saving,
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
// הודעות היעדרות שממתינות לשליחה. שחקן שכבר מופיע בכרטיס ההתראות (שתי היעדרויות)
// לא מופיע גם כאן — אחרת אותו הורה מקבל שתי הודעות שונות על אותו דבר.
function pendingAbsenceMsgs(players, groups, users, attendance) {
  let today = E(),
    d = new Date(today + "T00:00:00");
  d.setDate(d.getDate() - 6);
  let from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    out = [];
  attendance.forEach((a) => {
    if (a.status !== "Absent" || a.msgSentAt) return;
    if (!a.date || a.date > today || a.date < from) return;
    let p = players.find((v) => v.id === a.playerId);
    if (!p || p.deleted || !p.isActive) return;
    if (p.alertHandledDate && p.alertHandledDate >= a.date) return;
    let two = lastTwoAbsences(attendance, p.id);
    if (two && two.includes(a.date)) return;
    let g = groups.find((v) => v.id === a.groupId) || null;
    out.push({
      player: p,
      group: g,
      coach: g ? groupCoachLabel(g, users) : null,
      record: a,
    });
  });
  return out.sort(
    (x, y) =>
      y.record.date.localeCompare(x.record.date) ||
      (x.group ? x.group.name : "").localeCompare(y.group ? y.group.name : ""),
  );
}
function QuotaAlertsCard({ alerts: t }) {
  if (t.length === 0) return null;
  return e.createElement(
    "div",
    {
      className:
        "bg-white rounded-xl border-2 border-blue-300 overflow-hidden",
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
          { className: "text-[11px] text-blue-700 leading-snug" },
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
var We = [
    "ראשון",
    "שני",
    "שלישי",
    "רביעי",
    "חמישי",
    "שישי",
    "שבת",
  ],
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
async function qe(t) {
  try {
    if (!G) return;
    let s = await F;
    if (!s || (await Notification.requestPermission()) !== "granted") return;
    let l = await ze(s, { vapidKey: G });
    l && (await O(S(P, "users", t), { fcmToken: l }));
  } catch (s) {
    console.warn("Push registration skipped:", s);
  }
}
function Qe(t, s) {
  let a = t
    .filter((l) => l.playerId === s && l.date !== E())
    .sort((l, i) => i.date.localeCompare(l.date));
  return a.length < 2
    ? !1
    : a[0].status === "Absent" && a[1].status === "Absent";
}
// אחוז הנוכחות של הקבוצה בחודש הנוכחי (כמו "נוכחות ממוצעת החודש" בכרטיס שמעל)
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
    l = new Set(a.map((c) => `${c.date}_${c.groupId}`)).size;
  if (a.length === 0) return { avgPct: null, sessions: l };
  let i = a.filter((c) => c.status === "Present").length;
  return { avgPct: Math.round((i / a.length) * 100), sessions: l };
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
function PrintStyleTag() {
  return e.createElement(
    "style",
    null,
    "@media print { body * { visibility: hidden; } #ttc-report-print, #ttc-report-print * { visibility: visible; } #ttc-report-print { position: absolute; inset: 0; padding: 10px; } .no-print { display: none !important; } }",
  );
}
function DateRangeControls({ startDate, endDate, onChangeStart, onChangeEnd }) {
  return e.createElement(
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
  );
}
function ReportActionBar({ onPrint, onExportCsv }) {
  return e.createElement(
    "div",
    { className: "flex gap-2 no-print" },
    e.createElement(
      "button",
      {
        onClick: onPrint,
        className:
          "flex-1 bg-blue-900 text-white text-sm font-semibold rounded-xl py-2.5",
      },
      "הדפסה / PDF",
    ),
    e.createElement(
      "button",
      {
        onClick: onExportCsv,
        className:
          "flex-1 bg-emerald-500 text-white text-sm font-semibold rounded-xl py-2.5",
      },
      "ייצוא ל-CSV",
    ),
  );
}
function ReportAttendanceMatrix({ groups, players, attendance }) {
  let [groupId, setGroupId] = b(groups[0]?.id || ""),
    [startDate, setStartDate] = b(firstOfMonthStr()),
    [endDate, setEndDate] = b(E()),
    group = groups.find((g) => g.id === groupId),
    groupAttendance = attendance.filter(
      (rec) =>
        rec.groupId === groupId && rec.date >= startDate && rec.date <= endDate,
    ),
    dates = Array.from(new Set(groupAttendance.map((rec) => rec.date))).sort(),
    groupPlayers = players
      .filter(
        (p) =>
          p.groupId === groupId &&
          (p.isActive || groupAttendance.some((rec) => rec.playerId === p.id)),
      )
      .sort((a, c) => a.name.localeCompare(c.name, "he")),
    cellStatus = (playerId, date) => {
      let rec = groupAttendance.find(
        (r) => r.playerId === playerId && r.date === date,
      );
      return rec ? rec.status : null;
    },
    exportCsv = () => {
      let headers = ["שחקן", ...dates.map(formatHeDate), "אחוז נוכחות"],
        rows = groupPlayers.map((p) => {
          let presentCount = 0,
            totalCount = 0,
            cells = dates.map((d) => {
              let st = cellStatus(p.id, d);
              return (
                st && (totalCount++, st === "Present" && presentCount++),
                st === "Present" ? "נכח" : st === "Absent" ? "נעדר" : ""
              );
            }),
            pct =
              totalCount > 0 ? Math.round((presentCount / totalCount) * 100) + "%" : "";
          return [p.name, ...cells, pct];
        });
      downloadCsv(`נוכחות-${group ? group.name : ""}.csv`, headers, rows);
    };
  return e.createElement(
    "div",
    { className: "flex flex-col gap-4" },
    e.createElement(PrintStyleTag, null),
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
          groups.map((g) => e.createElement("option", { key: g.id, value: g.id }, g.name)),
        ),
      ),
      e.createElement(DateRangeControls, {
        startDate,
        endDate,
        onChangeStart: setStartDate,
        onChangeEnd: setEndDate,
      }),
      e.createElement(ReportActionBar, {
        onPrint: () => window.print(),
        onExportCsv: exportCsv,
      }),
    ),
    e.createElement(
      "div",
      { id: "ttc-report-print", className: "flex flex-col gap-3" },
      e.createElement(
        "h3",
        { className: "font-bold text-blue-950 text-sm" },
        `נוכחות חודשית — ${group ? group.name : ""}`,
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
              { className: "w-full text-xs border-collapse" },
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
                  dates.map((d) =>
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
                  e.createElement(
                    "th",
                    { className: "border border-slate-200 px-1.5 py-1.5 bg-slate-100" },
                    "%",
                  ),
                ),
              ),
              e.createElement(
                "tbody",
                null,
                groupPlayers.map((p) => {
                  let presentCount = 0,
                    totalCount = 0,
                    cells = dates.map((d) => {
                      let st = cellStatus(p.id, d);
                      return (
                        st && (totalCount++, st === "Present" && presentCount++),
                        e.createElement(
                          "td",
                          {
                            key: d,
                            className: `border border-slate-200 text-center py-1 ${st === "Present" ? "bg-emerald-50 text-emerald-700" : st === "Absent" ? "bg-red-50 text-red-600" : "text-slate-300"}`,
                          },
                          st === "Present" ? "✓" : st === "Absent" ? "✗" : "–",
                        )
                      );
                    }),
                    pct =
                      totalCount > 0
                        ? Math.round((presentCount / totalCount) * 100) + "%"
                        : "–";
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
                    cells,
                    e.createElement(
                      "td",
                      { className: "border border-slate-200 text-center font-semibold" },
                      pct,
                    ),
                  );
                }),
                groupPlayers.length === 0 &&
                  e.createElement(
                    "tr",
                    null,
                    e.createElement(
                      "td",
                      {
                        colSpan: dates.length + 2,
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
    exportCsv = () => {
      let headers = ["תאריך", "קבוצה", "סטטוס"],
        rows = records.map((r) => [
          formatHeDate(r.date),
          groupName(r.groupId),
          r.status === "Present" ? "נכח" : "נעדר",
        ]);
      downloadCsv(`דוח-שחקן-${player ? player.name : ""}.csv`, headers, rows);
    };
  return e.createElement(
    "div",
    { className: "flex flex-col gap-4" },
    e.createElement(PrintStyleTag, null),
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
      e.createElement(ReportActionBar, {
        onPrint: () => window.print(),
        onExportCsv: exportCsv,
      }),
    ),
    e.createElement(
      "div",
      { id: "ttc-report-print", className: "flex flex-col gap-3" },
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
    exportCsv = () => {
      let headers = [
          "קבוצה",
          "מאמן",
          "מפגשים צפויים",
          "מפגשים שמולאו",
          "אחוז מילוי",
          "אימונים שבוטלו",
          "תאריכים שלא מולאו",
        ],
        rowsData = rows.map((r) => [
          r.group.name,
          r.coach ? r.coach.name : "—",
          r.expected,
          r.filled,
          r.fillPct === null ? "—" : r.fillPct + "%",
          r.cancelled,
          r.missedDates.map(formatHeDate).join(" | "),
        ]);
      downloadCsv("דוח-מילוי-מאמנים.csv", headers, rowsData);
    };
  return e.createElement(
    "div",
    { className: "flex flex-col gap-4" },
    e.createElement(PrintStyleTag, null),
    e.createElement(
      "div",
      { className: "flex flex-col gap-3 no-print" },
      e.createElement(DateRangeControls, {
        startDate,
        endDate,
        onChangeStart: setStartDate,
        onChangeEnd: setEndDate,
      }),
      e.createElement(ReportActionBar, {
        onPrint: () => window.print(),
        onExportCsv: exportCsv,
      }),
    ),
    e.createElement(
      "div",
      { id: "ttc-report-print", className: "flex flex-col gap-2.5" },
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
              { className: "text-[11px] text-red-500 text-right leading-relaxed" },
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
          flagged = lastTwo.length === 2 && lastTwo.every((r) => r.status === "Absent");
        return {
          player: p,
          group: groups.find((g) => g.id === p.groupId) || null,
          lastDate: records[0]?.date || null,
          flagged,
        };
      })
      .filter((x) => x.flagged),
    exportCsv = () => {
      let headers = ["שחקן", "קבוצה", "הורה", "טלפון", "היעדרות אחרונה"],
        rowsData = atRisk.map((x) => [
          x.player.name,
          groupName(x.player.groupId),
          x.player.parentName,
          x.player.parentPhone,
          x.lastDate ? formatHeDate(x.lastDate) : "—",
        ]);
      downloadCsv("ילדים-בסיכון-נשירה.csv", headers, rowsData);
    };
  return e.createElement(
    "div",
    { className: "flex flex-col gap-4" },
    e.createElement(PrintStyleTag, null),
    e.createElement(
      "div",
      { className: "flex flex-col gap-3 no-print" },
      e.createElement(DateRangeControls, {
        startDate,
        endDate,
        onChangeStart: setStartDate,
        onChangeEnd: setEndDate,
      }),
      e.createElement(ReportActionBar, {
        onPrint: () => window.print(),
        onExportCsv: exportCsv,
      }),
    ),
    e.createElement(
      "div",
      { id: "ttc-report-print", className: "flex flex-col gap-2.5" },
      e.createElement(
        "h3",
        { className: "font-bold text-blue-950 text-sm" },
        "ילדים בסיכון נשירה (2 היעדרויות רצופות)",
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
                      "w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 no-print",
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
                    { className: "text-xs text-slate-400" },
                    x.player.parentName
                      ? `${groupName(x.player.groupId)} \xB7 ${x.player.parentName}`
                      : groupName(x.player.groupId),
                  ),
                ),
                e.createElement(
                  "div",
                  { className: "text-xs text-red-500 shrink-0" },
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
        return { group: g, coach, sessions, pct, activePlayers };
      })
      .sort((a, c) => (c.pct ?? -1) - (a.pct ?? -1)),
    exportCsv = () => {
      let headers = ["קבוצה", "מאמן", "שחקנים פעילים", "מפגשים בטווח", "אחוז נוכחות"],
        rowsData = rows.map((r) => [
          r.group.name,
          r.coach ? r.coach.name : "—",
          r.activePlayers,
          r.sessions,
          r.pct === null ? "—" : r.pct + "%",
        ]);
      downloadCsv("השוואת-קבוצות.csv", headers, rowsData);
    };
  return e.createElement(
    "div",
    { className: "flex flex-col gap-4" },
    e.createElement(PrintStyleTag, null),
    e.createElement(
      "div",
      { className: "flex flex-col gap-3 no-print" },
      e.createElement(DateRangeControls, {
        startDate,
        endDate,
        onChangeStart: setStartDate,
        onChangeEnd: setEndDate,
      }),
      e.createElement(ReportActionBar, {
        onPrint: () => window.print(),
        onExportCsv: exportCsv,
      }),
    ),
    e.createElement(
      "div",
      { id: "ttc-report-print", className: "flex flex-col gap-2.5" },
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
                    className: `border border-slate-200 px-2 py-1 text-center font-semibold ${r.pct === null ? "text-slate-400" : r.pct >= 80 ? "text-emerald-600" : r.pct >= 50 ? "text-amber-600" : "text-red-500"}`,
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
  let alerts = quotaAlerts(players, groups, attendance),
    exportCsv = () => {
      let headers = ["שחקן", "קבוצה", "תקופה", "בפועל", "מכסה"],
        rowsData = alerts.map((o) => [
          o.player.name,
          o.group ? o.group.name : "—",
          o.period,
          o.actual,
          o.target,
        ]);
      downloadCsv("דוח-חריגת-מכסת-אימונים.csv", headers, rowsData);
    };
  return e.createElement(
    "div",
    { className: "flex flex-col gap-4" },
    e.createElement(PrintStyleTag, null),
    e.createElement(
      "div",
      { className: "no-print" },
      e.createElement(ReportActionBar, {
        onPrint: () => window.print(),
        onExportCsv: exportCsv,
      }),
    ),
    e.createElement(
      "div",
      { id: "ttc-report-print", className: "flex flex-col gap-2.5" },
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
  let [tab, setTab] = b("matrix"),
    tabs = [
      { key: "matrix", label: "נוכחות חודשית" },
      { key: "player", label: "דוח שחקן" },
      { key: "fillrate", label: "מילוי מאמנים" },
      { key: "risk", label: "בסיכון נשירה" },
      { key: "compare", label: "השוואת קבוצות" },
      { key: "quota", label: "מכסת אימונים" },
    ];
  return e.createElement(
    "div",
    { className: "px-4 pt-4 pb-6 flex flex-col gap-4" },
    e.createElement(
      "div",
      { className: "flex gap-1.5 overflow-x-auto no-print pb-1" },
      tabs.map((t) =>
        e.createElement(
          "button",
          {
            key: t.key,
            onClick: () => setTab(t.key),
            className: `shrink-0 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap ${tab === t.key ? "bg-blue-900 text-white" : "bg-white border border-slate-200 text-slate-600"}`,
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

function U({ icon: t, label: s, value: a, accent: l }) {
  return e.createElement(
    "div",
    {
      className:
        "bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-2",
    },
    e.createElement(
      "div",
      { className: `w-9 h-9 rounded-lg flex items-center justify-center ${l}` },
      e.createElement(t, { className: "w-5 h-5 text-white" }),
    ),
    e.createElement(
      "div",
      { className: "text-2xl font-bold text-blue-950" },
      a,
    ),
    e.createElement(
      "div",
      { className: "text-xs text-slate-500 leading-tight" },
      s,
    ),
  );
}
function Re({ player: t, onOpenWhatsapp: s }) {
  return e.createElement(
    "div",
    { className: "flex items-center gap-1.5 shrink-0" },
    e.createElement(
      "span",
      {
        className:
          "flex items-center gap-1 bg-amber-50 text-amber-700 text-[11px] font-semibold px-2 py-1 rounded-full border border-amber-200",
      },
      e.createElement(ye, { className: "w-3 h-3" }),
      "2 היעדרויות",
    ),
    e.createElement(
      "button",
      {
        onClick: () => s(t),
        className:
          "w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center active:scale-95 transition-transform",
        "aria-label":
          "שליחת הודעת וואטסאפ להורה",
      },
      e.createElement(te, { className: "w-4 h-4 text-white" }),
    ),
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
    [showReq, setShowReq] = b(!1),
    [n, m] = b(!1),
    o = async () => {
      (c(""), setOk(""), m(!0));
      try {
        await Ue(D, loginIdToEmail(t), a);
      } catch (x) {
        c(
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
      e.createElement(
        "button",
        {
          onClick: () => setShowReq(!0),
          className: "text-blue-300 text-xs underline text-center mt-3",
        },
        "אין לי חשבון — בקשת גישה",
      ),
      e.createElement(
        "p",
        { className: "text-blue-400 text-[11px] text-center mt-1" },
        "הורים ושחקנים נכנסים עם מספר הטלפון והסיסמה שבחרו בהזמנה",
      ),
    ),
    showReq &&
      e.createElement(AccessRequestForm, { onClose: () => setShowReq(!1) }),
  );
}
function st({
  users: t,
  groups: s,
  players: a,
  attendance: l,
  onOpenAddPlayer: i,
  currentUserId: c,
  onEditPlayer: EP,
  onWhatsapp: WA,
  onOpenGroup,
  onOpenGroupDate,
  cancellations: CX,
  readOnly: RO,
}) {
  let [o, x] = b(null),
    [h, u] = b(!1),
    alerts = absenceAlerts(a, s, l, null),
    quotaAl = quotaAlerts(a, s, l),
    pendingMsgs = pendingAbsenceMsgs(a, s, t, l),
    pastMissing = missingAttendanceDays(s, l, CX),
    f = a.filter((d) => d.isActive && !d.deleted),
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
    },
    C = async (d) => {
      try {
        await O(S(P, "players", d), { isActive: !1, endDate: E() });
      } catch (A) {
        setDashErr("העברה לארכיון נכשלה: " + A.message);
      }
    };
  let [dashErr, setDashErr] = b("");
  useLocalAlertNotice(alerts, "נוכחות מועדון");
  return e.createElement(
    "div",
    { className: "px-4 pt-4 pb-6 flex flex-col gap-5" },
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
    !RO &&
      e.createElement(AlertsCard, {
        alerts,
        onWhatsapp: WA,
        onEdit: EP,
      }),
    !RO &&
      e.createElement(AbsenceMsgCard, {
        items: pendingMsgs,
        onWhatsapp: WA,
        currentUserId: c,
      }),
    e.createElement(QuotaAlertsCard, { alerts: quotaAl }),
    e.createElement(
      "div",
      { className: "grid grid-cols-2 gap-3" },
      e.createElement(U, {
        icon: H,
        label:
          "שחקנים פעילים",
        value: uniqueActiveCount,
        accent: "bg-blue-900",
      }),
      e.createElement(U, {
        icon: le,
        label: 'סה"כ קבוצות',
        value: s.length,
        accent: "bg-blue-900",
      }),
      e.createElement(U, {
        icon: he,
        label:
          "נוכחות ממוצעת החודש",
        value: g === null ? "—" : `${g}%`,
        accent: "bg-emerald-500",
      }),
      e.createElement(U, {
        icon: ge,
        label:
          "אימונים שנרשמו החודש",
        value: r,
        accent: "bg-emerald-500",
      }),
    ),
    !RO &&
    e.createElement(
      "div",
      { className: "grid grid-cols-2 gap-3" },
      e.createElement(
        "button",
        {
          onClick: i,
          className:
            "bg-emerald-500 rounded-xl py-3.5 flex items-center justify-center gap-2 text-white font-semibold active:scale-[0.98] transition-transform",
        },
        e.createElement(K, { className: "w-4 h-4" }),
        " הוספת שחקן",
      ),
      e.createElement(
        "button",
        {
          onClick: y,
          className:
            "bg-blue-900 rounded-xl py-3.5 flex items-center justify-center gap-2 text-white font-semibold active:scale-[0.98] transition-transform",
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
                      disabled: h,
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
      { className: "flex flex-col gap-3" },
      e.createElement(
        "h2",
        { className: "text-sm font-semibold text-slate-500 px-1" },
        "קבוצות",
      ),
      s.map((d) => {
        let A = groupCoachLabel(d, t),
          I = Ze(l, d.id, a),
          cancelledToday = findCancellation(CX, d.id, E()),
          w = a.filter((k) => k.groupId === d.id && k.isActive && !k.deleted);
        return e.createElement(
          "div",
          {
            key: d.id,
            className:
              "bg-white rounded-xl border border-slate-200 overflow-hidden",
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
                        "mr-1.5 text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5",
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
                { className: "text-sm font-bold text-emerald-600" },
                I === null ? "—" : `${I}%`,
              ),
              e.createElement(
                "div",
                { className: "text-[10px] text-slate-400" },
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
    { className: "px-4 pt-4 pb-6 flex flex-col gap-4" },
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
        { key: m.id, className: "flex flex-col gap-2" },
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
      (n(!0), window.open(ne(m, l), "_blank"), a && a(), s());
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
                className: `min-h-[36px] px-3 rounded-lg text-xs font-semibold border transition-colors ${gen === v ? "bg-blue-900 text-white border-blue-900" : "bg-white text-slate-500 border-slate-200"}`,
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
        { className: "text-[11px] text-slate-400 text-right leading-relaxed" },
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
  onHandled: l,
  subtitle: i,
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
      className: "bg-white rounded-xl border-2 border-amber-300 overflow-hidden",
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
          { className: "text-[11px] text-amber-700 leading-snug" },
          i || "שחקנים שנעדרו משני האימונים האחרונים",
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
                (m(o), l && l(o));
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
              { className: "text-xs text-slate-500 truncate" },
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
function AbsenceMsgCard({ items: t, onWhatsapp: s, currentUserId: a }) {
  let [l, i] = b("");
  if (t.length === 0) return null;
  let c = async (n) => {
    i("");
    try {
      await markAbsenceMsgSent(
        n.record.date,
        n.record.groupId,
        n.player.id,
        a,
      );
    } catch (m) {
      i("העדכון נכשל: " + m.message);
    }
  };
  return e.createElement(
    "div",
    { className: "bg-white rounded-xl border-2 border-sky-300 overflow-hidden" },
    e.createElement(
      "div",
      { className: "bg-sky-50 px-4 py-3 flex items-center gap-2" },
      e.createElement(te, { className: "w-4 h-4 text-sky-600 shrink-0" }),
      e.createElement(
        "div",
        { className: "text-right flex-1" },
        e.createElement(
          "div",
          { className: "text-sm font-bold text-sky-900" },
          "לא נשלחה הודעה להורים \xB7 ",
          t.length,
        ),
        e.createElement(
          "div",
          { className: "text-[11px] text-sky-700 leading-snug" },
          "שחקנים שנעדרו ולא נשלחה להם הודעה (עד 7 ימים אחורה)",
        ),
      ),
    ),
    l &&
      e.createElement(
        "p",
        { className: "text-xs text-red-600 text-right px-4 py-2" },
        l,
      ),
    e.createElement(
      "div",
      { className: "divide-y divide-slate-100" },
      t.map((n) =>
        e.createElement(
          "div",
          {
            key: n.record.date + "_" + n.record.groupId + "_" + n.player.id,
            className: "px-3 py-3 flex items-center gap-1.5",
          },
          e.createElement(
            "div",
            { className: "flex-1 text-right min-w-0" },
            e.createElement(
              "div",
              { className: "text-sm font-semibold text-blue-950 truncate" },
              n.player.name,
            ),
            e.createElement(
              "div",
              { className: "text-xs text-slate-500 truncate" },
              n.record.date === E()
                ? "היום"
                : Ke(n.record.date),
              " \xB7 ",
              n.group ? n.group.name : "ללא קבוצה",
              n.coach ? " \xB7 מאמן: " + n.coach.name : "",
            ),
          ),
          e.createElement(
            "button",
            {
              onClick: () =>
                s(n.player, "absence", n.record.groupId, n.record.date),
              className:
                "min-w-[44px] min-h-[44px] rounded-full bg-emerald-500 flex items-center justify-center shrink-0 active:scale-95 transition-transform",
              "aria-label": "שליחת הודעה להורה",
            },
            e.createElement(te, { className: "w-4 h-4 text-white" }),
          ),
          e.createElement(
            "button",
            {
              onClick: () => c(n),
              className:
                "min-w-[44px] min-h-[44px] rounded-full bg-slate-100 flex items-center justify-center shrink-0",
              "aria-label": "סימון כטופל",
            },
            e.createElement(Z, { className: "w-4 h-4 text-slate-500" }),
          ),
        ),
      ),
    ),
  );
}
function missingAttendanceDays(groups, attendance, cancellations, lookbackDays) {
  let days = lookbackDays || 7,
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
    { className: "bg-white rounded-xl border-2 border-orange-300 overflow-hidden" },
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
          { className: "text-[11px] text-orange-700 leading-snug" },
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
              AL || "פתיחה",
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
}) {
  let i = !!a,
    c = l ? t.filter((v) => l.includes(v.id)) : t,
    [n, m] = b(a?.name || ""),
    [o, x] = b(a?.groupId || DG || c[0]?.id || ""),
    [h, u] = b(a?.parentName || ""),
    [f, g] = b(a?.parentPhone || ""),
    [WT, setWT] = b(a?.weeklyTarget != null ? String(a.weeklyTarget) : ""),
    [TD, setTD] = b(a?.trainingDays || []),
    toggleTD = (v) => {
      setTD(($) =>
        $.includes(v)
          ? $.filter((_) => _ !== v)
          : [...$, v].sort((_, oe) => _ - oe),
      );
    },
    [r, y] = b(!1),
    [N, C] = b(""),
    d = f.trim().length === 0 || isValidPhone(f),
    selAdult = isAdultGroup(t.find((v) => v.id === o) || null),
    A = n.trim() && o && d,
    I = async () => {
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
        };
        (i
          ? await O(S(P, "players", a.id), v)
          : await V(M(P, "players"), {
              ...v,
              joinDate: E(),
              endDate: null,
              isActive: !0,
            }),
          s());
      } catch (v) {
        C("השמירה נכשלה: " + v.message);
      } finally {
        y(!1);
      }
    },
    delPlayer = async () => {
      if (
        !window.confirm(
          `למחוק את "${n}" מהמערכת? הוא יוסר מכל המסכים הפעילים (רשימות, ספר טלפונים, קבוצה), אך היסטוריית הנוכחות שלו תישמר בדוחות. הפעולה אינה הפיכה.`,
        )
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
    p = (v, k, $, D2) =>
      e.createElement(
        "div",
        { className: "flex flex-col gap-1" },
        e.createElement("label", { className: "text-xs text-slate-500" }, v),
        e.createElement("input", {
          value: k,
          onChange: (z) => $(z.target.value),
          dir: D2 || "rtl",
          className:
            "border border-slate-200 rounded-lg py-2.5 px-3 text-right text-sm outline-none focus:border-emerald-400 min-h-[44px]",
        }),
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
          i ? "עריכת פרטי שחקן" : "הוספת שחקן",
        ),
      ),
      p("שם השחקן", n, m),
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
          { className: "text-[11px] text-slate-400 leading-relaxed" },
          "אם לא נבחרו ימים, השחקן ייחשב זמין בכל ימי האימון של הקבוצה.",
        ),
      ),
      !selAdult && p("שם ההורה (לא חובה)", h, u),
      p(
        selAdult ? "טלפון השחקן" : "טלפון ההורה",
        f,
        g,
        "ltr",
      ),
      e.createElement(
        "p",
        { className: "text-[11px] text-slate-400 text-right leading-relaxed" },
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
          onClick: I,
          className:
            "mt-1 bg-emerald-500 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold rounded-xl py-3.5 min-h-[44px]",
        },
        r ? "שומר…" : "שמירה",
      ),
      i &&
        CD &&
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
var DEFAULT_ROSTER = "";
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
    if (!name) return;
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
  let [text, setText] = b(DEFAULT_ROSTER),
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
  let rows = parsed.rows.map((r) => ({
      ...r,
      status: existing.has(r.name + "@" + r.groupName) ? "exists" : "new",
    })),
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
        { className: "text-[11px] text-slate-500 leading-tight" },
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
        { className: "text-[11px] text-slate-400 text-right mt-1" },
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
              className: `text-[10px] px-2 py-0.5 rounded-full shrink-0 ${r.status === "new" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"}`,
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
              { className: "text-[11px] text-slate-400 truncate" },
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

// ===== גישת הורים ושחקנים לפורטל: טלפון, הזמנות וקישורים =====
var MEMBER_EMAIL_DOMAIN = "members.ttcmh.app";
var INVITE_TTL_DAYS = 7;
var RELATION_LABELS = {
  parent: "הורה",
  self: "השחקן עצמו",
  family: "בן משפחה",
};
var MEM_DAYS = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];
function memberEmailFromPhone(v) {
  return normalizePhone(v) + "@" + MEMBER_EMAIL_DOMAIN;
}
function loginIdToEmail(v) {
  let s = String(v || "").trim();
  return s.includes("@") ? s : memberEmailFromPhone(s);
}
function randomToken() {
  let a = new Uint8Array(24);
  (window.crypto || crypto).getRandomValues(a);
  return Array.from(a)
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
function linkDocId(uid, playerId) {
  return uid + "_" + playerId;
}
function inviteExpiryISO(days) {
  let d = new Date();
  d.setDate(d.getDate() + (days || INVITE_TTL_DAYS));
  return d.toISOString();
}
function inviteStatus(inv) {
  if (!inv) return "missing";
  if (inv.revoked) return "revoked";
  if (inv.usedAt) return "used";
  if (inv.expiresAt && new Date(inv.expiresAt).getTime() <= Date.now())
    return "expired";
  return "open";
}
var INVITE_STATUS_LABELS = {
  open: "ממתינה",
  used: "מומשה",
  expired: "פג תוקף",
  revoked: "בוטלה",
  missing: "לא נמצאה",
};
function portalBaseUrl() {
  return location.origin + location.pathname;
}
function inviteUrl(token) {
  return portalBaseUrl() + "#/invite/" + token;
}
function parseHashRoute() {
  let m = String(location.hash || "").match(/^#\/invite\/([A-Za-z0-9]+)/);
  return m ? { name: "invite", token: m[1] } : { name: "app" };
}
function clearHashRoute() {
  try {
    history.replaceState(null, "", portalBaseUrl());
  } catch (e2) {
    location.hash = "";
  }
}
async function createInvite({
  phone: phone,
  displayName: displayName,
  playerIds: playerIds,
  playerNames: playerNames,
  relation: relation,
  createdBy: createdBy,
}) {
  let token = randomToken();
  await De(S(P, "invites", token), {
    phone: normalizePhone(phone),
    displayName: String(displayName || "").trim(),
    playerIds: playerIds || [],
    playerNames: playerNames || [],
    relation: relation || "parent",
    createdBy: createdBy || "",
    createdAt: new Date().toISOString(),
    expiresAt: inviteExpiryISO(INVITE_TTL_DAYS),
    expiresAtMs: Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1e3,
    usedAt: null,
    usedByUid: null,
    revoked: !1,
  });
  return token;
}
async function loadInvite(token) {
  let snap = await fsGetDoc(S(P, "invites", token));
  return snap.exists() ? { id: token, ...snap.data() } : null;
}
async function revokeInvite(token) {
  await O(S(P, "invites", token), { revoked: !0 });
}
function inviteMessage(inv, token) {
  let names = (inv.playerNames || []).join(", ");
  return (
    `שלום ${inv.displayName || ""}!\n` +
    `הוזמנת לפורטל ${X}${names ? " — " + names : ""}.\n` +
    `לחיצה על הקישור, בחירת סיסמה, וזהו:\n${inviteUrl(token)}\n` +
    `הקישור אישי ותקף ל-${INVITE_TTL_DAYS} ימים.`
  );
}
function inviteWhatsappUrl(inv, token) {
  return ne(normalizePhone(inv.phone), inviteMessage(inv, token));
}
async function signUpFromInvite({
  token: token,
  invite: invite,
  password: password,
  email: email,
}) {
  let mail = memberEmailFromPhone(invite.phone),
    uid = null,
    existed = !1;
  try {
    uid = (await Me(D, mail, password)).user.uid;
  } catch (err) {
    if (err.code !== "auth/email-already-in-use") throw err;
    ((uid = (await Ue(D, mail, password)).user.uid), (existed = !0));
  }
  let now = new Date().toISOString(),
    // אם ניסיון קודם נכשל אחרי יצירת חשבון ההתחברות — הפרופיל עדיין חסר, ויוצרים אותו עכשיו
    hasProfile = existed && (await fsGetDoc(S(P, "users", uid))).exists();
  hasProfile ||
    (await De(S(P, "users", uid), {
      name: invite.displayName || "",
      role: "Member",
      phone: normalizePhone(invite.phone),
      email: String(email || "").trim(),
      inviteToken: token,
      consentAt: now,
      createdAt: now,
    }));
  for (let pid of invite.playerIds || [])
    await De(S(P, "links", linkDocId(uid, pid)), {
      uid: uid,
      playerId: pid,
      relation: invite.relation || "parent",
      inviteToken: token,
      createdAt: now,
    });
  await O(S(P, "invites", token), { usedAt: now, usedByUid: uid });
  return uid;
}
async function createAccessRequest({
  name: name,
  phone: phone,
  childName: childName,
  relation: relation,
  note: note,
}) {
  await V(M(P, "accessRequests"), {
    name: String(name || "").trim(),
    phone: normalizePhone(phone),
    childName: String(childName || "").trim(),
    relation: relation || "parent",
    note: String(note || "").trim(),
    status: "pending",
    createdAt: new Date().toISOString(),
  });
}
async function setAccessRequestStatus(id, status, handledBy) {
  await O(S(P, "accessRequests", id), {
    status: status,
    handledBy: handledBy || "",
    handledAt: new Date().toISOString(),
  });
}
async function deleteLink(uid, playerId) {
  await Ee(S(P, "links", linkDocId(uid, playerId)));
}

// ----- נתוני המשתמש-הורה: קישורים, שחקנים ונוכחות -----
function useMemberData(uid) {
  // מאזינים חיים (onSnapshot) ולא קריאה חד-פעמית: בטלפון עם רשת איטית זה
  // מציג מיד את מה שכבר שמור במכשיר, ומתעדכן ברקע — ולא נתקע על "טוען…".
  let [links, setLinks] = b(null),
    [playersMap, setPlayersMap] = b({}),
    [attendance, setAttendance] = b([]),
    [error, setError] = b("");
  j(() => {
    if (!uid) {
      (setLinks([]), setPlayersMap({}), setAttendance([]), setError(""));
      return;
    }
    let unsubPlayers = {},
      unsubAtt = [],
      onErr = (err) => setError(err.message || String(err)),
      stopAtt = () => {
        (unsubAtt.forEach((u) => u()), (unsubAtt = []));
      },
      unsubLinks = ae(
        fsQuery(M(P, "links"), fsWhere("uid", "==", uid)),
        (snap) => {
          let ls = snap.docs.map((d) => ({ id: d.id, ...d.data() })),
            ids = ls.map((l) => l.playerId).filter(Boolean);
          setLinks(ls);
          for (let pid of ids)
            unsubPlayers[pid] ||
              (unsubPlayers[pid] = ae(
                S(P, "players", pid),
                (ps) => {
                  setPlayersMap((m) => ({
                    ...m,
                    [pid]: ps.exists() ? { id: ps.id, ...ps.data() } : null,
                  }));
                },
                (err) => {
                  // קריאה שנכשלה (הרשאה/כרטיס שנמחק) לא משאירה את המסך על "טוען…"
                  (onErr(err), setPlayersMap((m) => ({ ...m, [pid]: null })));
                },
              ));
          for (let pid of Object.keys(unsubPlayers))
            ids.includes(pid) ||
              (unsubPlayers[pid](),
              delete unsubPlayers[pid],
              setPlayersMap((m) => {
                let c = { ...m };
                return (delete c[pid], c);
              }));
          stopAtt();
          setAttendance([]);
          // Firestore מגביל שאילתת "in" ל-10 ערכים — מאזין נפרד לכל קבוצה של עד 10 שחקנים
          for (let i = 0; i < ids.length; i += 10) {
            let chunk = ids.slice(i, i + 10);
            unsubAtt.push(
              ae(
                fsQuery(M(P, "attendance"), fsWhere("playerId", "in", chunk)),
                (as) =>
                  setAttendance((prev) =>
                    prev
                      .filter((r) => !chunk.includes(r.playerId))
                      .concat(as.docs.map((d) => ({ id: d.id, ...d.data() }))),
                  ),
                onErr,
              ),
            );
          }
        },
        (err) => {
          (onErr(err), setLinks([]));
        },
      );
    return () => {
      (unsubLinks(), Object.values(unsubPlayers).forEach((u) => u()), stopAtt());
    };
  }, [uid]);
  let players = (links || [])
      .map((l) => playersMap[l.playerId])
      .filter((p) => p && !p.deleted),
    loading =
      links === null ||
      (links || []).some((l) => l.playerId && !(l.playerId in playersMap));
  return {
    loading: loading,
    links: links || [],
    players: players,
    attendance: attendance,
    error: error,
  };
}
function memberMonthStats(attendance, playerId) {
  let month = E().slice(0, 7),
    rows = attendance.filter(
      (a) => a.playerId === playerId && String(a.date || "").startsWith(month),
    ),
    present = rows.filter((a) => a.status === "Present").length;
  return {
    total: rows.length,
    present: present,
    pct: rows.length ? Math.round((present / rows.length) * 100) : null,
  };
}
function memberRecent(attendance, playerId, n) {
  return attendance
    .filter((a) => a.playerId === playerId)
    .sort((a, c) => String(c.date).localeCompare(String(a.date)))
    .slice(0, n || 5);
}

// ----- מסך מימוש הזמנה -----
function InviteScreen({ token: token }) {
  let [loading, setLoading] = b(!0),
    [invite, setInvite] = b(null),
    [err, setErr] = b(""),
    [pw, setPw] = b(""),
    [pw2, setPw2] = b(""),
    [mail, setMail] = b(""),
    [consent, setConsent] = b(!1),
    [busy, setBusy] = b(!1);
  j(() => {
    let cancelled = !1;
    return (
      loadInvite(token)
        .then((inv) => {
          cancelled || (setInvite(inv), setLoading(!1));
        })
        .catch((e2) => {
          cancelled ||
            (setErr(
              "לא הצלחנו לטעון את ההזמנה: " + (e2.message || e2),
            ),
            setLoading(!1));
        }),
      () => {
        cancelled = !0;
      }
    );
  }, [token]);
  let status = inviteStatus(invite),
    ok = pw.length >= 6 && pw === pw2 && consent,
    submit = async () => {
      (setBusy(!0), setErr(""));
      try {
        (await signUpFromInvite({
          token: token,
          invite: invite,
          password: pw,
          email: mail,
        }),
          clearHashRoute(),
          window.location.reload());
      } catch (e2) {
        (setErr(
          e2.code === "auth/wrong-password" ||
            e2.code === "auth/invalid-credential"
            ? "למספר הזה כבר יש חשבון בפורטל. כדי לצרף את השחקן לחשבון הקיים — הזן למעלה את הסיסמה שבחרת בפעם הקודמת."
            : e2.code === "auth/weak-password"
              ? "הסיסמה קצרה מדי — צריך לפחות 6 תווים"
              : "ההרשמה נכשלה: " + (e2.message || e2),
        ),
          setBusy(!1));
      }
    },
    shell = (...kids) =>
      e.createElement(
        "div",
        {
          dir: "rtl",
          className:
            "min-h-screen bg-blue-950 flex flex-col justify-center px-6 py-10",
        },
        e.createElement(
          "div",
          { className: "text-center mb-7" },
          e.createElement("img", {
            src: "./logo.png",
            alt: "",
            className:
              "w-20 h-20 rounded-2xl bg-white mx-auto mb-3 object-contain p-1.5",
          }),
          e.createElement(
            "h1",
            { className: "text-white text-lg font-bold leading-snug" },
            X,
          ),
          e.createElement("p", { className: "text-blue-300 text-xs mt-1" }, W),
        ),
        ...kids,
      );
  if (loading)
    return shell(
      e.createElement(
        "p",
        { className: "text-blue-200 text-sm text-center" },
        "רגע, בודקים את ההזמנה…",
      ),
    );
  if (status !== "open")
    return shell(
      e.createElement(
        "div",
        {
          className:
            "bg-white/10 rounded-2xl p-5 text-center flex flex-col gap-3",
        },
        e.createElement(
          "p",
          { className: "text-white text-sm leading-relaxed" },
          status === "used"
            ? "ההזמנה הזו כבר מומשה. אפשר להתחבר עם מספר הטלפון והסיסמה שבחרת."
            : status === "expired"
              ? "תוקף ההזמנה פג. בקש מהמנהל לשלוח הזמנה חדשה."
              : status === "revoked"
                ? "ההזמנה בוטלה על ידי מנהל המועדון."
                : "ההזמנה לא נמצאה. ייתכן שהקישור הועתק חלקית.",
        ),
        err &&
          e.createElement(
            "p",
            { className: "text-red-300 text-xs" },
            err,
          ),
        e.createElement(
          "button",
          {
            onClick: () => {
              (clearHashRoute(), window.location.reload());
            },
            className:
              "bg-emerald-500 text-white font-semibold rounded-xl py-3",
          },
          "למסך ההתחברות",
        ),
      ),
    );
  return shell(
    e.createElement(
      "div",
      { className: "bg-white rounded-2xl p-5 flex flex-col gap-3.5" },
      e.createElement(
        "div",
        null,
        e.createElement(
          "p",
          { className: "text-blue-950 font-bold text-base" },
          "שלום ",
          invite.displayName || "",
          "!",
        ),
        e.createElement(
          "p",
          { className: "text-slate-600 text-sm mt-1 leading-relaxed" },
          "הוזמנת לפורטל המועדון",
          (invite.playerNames || []).length
            ? " כ" +
                (RELATION_LABELS[invite.relation] || "הורה") +
                " של " +
                (invite.playerNames || []).join(", ")
            : "",
          ".",
        ),
      ),
      e.createElement(
        "div",
        { className: "bg-slate-50 rounded-xl p-3" },
        e.createElement(
          "p",
          { className: "text-[11px] text-slate-500" },
          "שם המשתמש שלך הוא מספר הטלפון",
        ),
        e.createElement(
          "p",
          { dir: "ltr", className: "text-sm text-blue-950 font-semibold" },
          invite.phone,
        ),
      ),
      e.createElement(
        "div",
        { className: "flex flex-col gap-1" },
        e.createElement(
          "label",
          { className: "text-xs text-slate-500" },
          "בחירת סיסמה (לפחות 6 תווים)",
        ),
        e.createElement(
          "p",
          { className: "text-[11px] text-slate-400" },
          "אם כבר יש לך חשבון בפורטל — הזן את הסיסמה הקיימת שלך, והשחקן יצורף אליו",
        ),
        e.createElement("input", {
          value: pw,
          onChange: (x) => setPw(x.target.value),
          type: "password",
          dir: "ltr",
          className:
            "border border-slate-200 rounded-lg py-2.5 px-3 text-sm outline-none focus:border-emerald-400",
        }),
      ),
      e.createElement(
        "div",
        { className: "flex flex-col gap-1" },
        e.createElement(
          "label",
          { className: "text-xs text-slate-500" },
          "אימות הסיסמה",
        ),
        e.createElement("input", {
          value: pw2,
          onChange: (x) => setPw2(x.target.value),
          type: "password",
          dir: "ltr",
          className:
            "border border-slate-200 rounded-lg py-2.5 px-3 text-sm outline-none focus:border-emerald-400",
        }),
        pw2 && pw !== pw2
          ? e.createElement(
              "p",
              { className: "text-[11px] text-red-600" },
              "הסיסמאות לא זהות",
            )
          : null,
      ),
      e.createElement(
        "div",
        { className: "flex flex-col gap-1" },
        e.createElement(
          "label",
          { className: "text-xs text-slate-500" },
          "אימייל (לא חובה — לקשר מול המועדון)",
        ),
        e.createElement("input", {
          value: mail,
          onChange: (x) => setMail(x.target.value),
          type: "email",
          dir: "ltr",
          className:
            "border border-slate-200 rounded-lg py-2.5 px-3 text-sm outline-none focus:border-emerald-400",
        }),
      ),
      e.createElement(
        "label",
        { className: "flex items-start gap-2 text-[11px] text-slate-600" },
        e.createElement("input", {
          type: "checkbox",
          checked: consent,
          onChange: (x) => setConsent(x.target.checked),
          className: "mt-0.5 w-4 h-4",
        }),
        e.createElement(
          "span",
          null,
          "אני מאשר/ת שהמועדון ישמור שם, קבוצה, נוכחות ומספר טלפון לצורך ניהול האימונים והקשר עם המשפחה. המידע נשמר אצל המועדון בלבד, לא מועבר לגורם שלישי, וניתן לבקש את מחיקתו בכל עת.",
        ),
      ),
      err &&
        e.createElement(
          "p",
          { className: "text-red-600 text-xs leading-relaxed" },
          err,
        ),
      e.createElement(
        "button",
        {
          onClick: submit,
          disabled: busy || !ok,
          className:
            "bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-xl py-3.5",
        },
        busy ? "רגע…" : "כניסה לפורטל",
      ),
    ),
  );
}

// ----- טופס בקשת גישה (למי שאין לו הזמנה) -----
function AccessRequestForm({ onClose: onClose }) {
  let [name, setName] = b(""),
    [phone, setPhone] = b(""),
    [child, setChild] = b(""),
    [rel, setRel] = b("parent"),
    [note, setNote] = b(""),
    [busy, setBusy] = b(!1),
    [done, setDone] = b(!1),
    [err, setErr] = b(""),
    ok = name.trim().length > 1 && isValidPhone(phone),
    submit = async () => {
      (setBusy(!0), setErr(""));
      try {
        (await createAccessRequest({
          name: name,
          phone: phone,
          childName: child,
          relation: rel,
          note: note,
        }),
          setDone(!0));
      } catch (e2) {
        setErr("השליחה נכשלה: " + (e2.message || e2));
      } finally {
        setBusy(!1);
      }
    },
    field = (label, val, set, type) =>
      e.createElement(
        "div",
        { className: "flex flex-col gap-1" },
        e.createElement("label", { className: "text-xs text-slate-500" }, label),
        e.createElement("input", {
          value: val,
          onChange: (x) => set(x.target.value),
          type: type || "text",
          dir: type === "tel" ? "ltr" : "rtl",
          className:
            "border border-slate-200 rounded-lg py-2.5 px-3 text-sm text-right outline-none focus:border-emerald-400",
        }),
      );
  return e.createElement(
    "div",
    {
      className: "fixed inset-0 bg-black/50 flex items-end justify-center z-50",
      onClick: onClose,
    },
    e.createElement(
      "div",
      {
        dir: "rtl",
        onClick: (x) => x.stopPropagation(),
        className:
          "bg-white w-full max-w-md rounded-t-2xl p-5 flex flex-col gap-3.5 max-h-[90vh] overflow-y-auto",
      },
      e.createElement(
        "div",
        { className: "flex items-center justify-between" },
        e.createElement(
          "button",
          { onClick: onClose, className: "text-slate-400" },
          e.createElement(T, { className: "w-5 h-5" }),
        ),
        e.createElement(
          "h3",
          { className: "font-bold text-blue-950" },
          "בקשת גישה לפורטל",
        ),
      ),
      done
        ? e.createElement(
            e.Fragment,
            null,
            e.createElement(
              "p",
              { className: "text-sm text-slate-700 leading-relaxed" },
              "הבקשה נשלחה למנהל המועדון. ברגע שהיא תאושר תקבל/י הודעת וואטסאפ עם קישור אישי לכניסה.",
            ),
            e.createElement(
              "button",
              {
                onClick: onClose,
                className:
                  "bg-emerald-500 text-white font-semibold rounded-xl py-3",
              },
              "סגירה",
            ),
          )
        : e.createElement(
            e.Fragment,
            null,
            field("השם שלך", name, setName),
            field("טלפון (050-1234567)", phone, setPhone, "tel"),
            field("שם השחקן/ית במועדון", child, setChild),
            e.createElement(
              "div",
              { className: "flex flex-col gap-1" },
              e.createElement(
                "label",
                { className: "text-xs text-slate-500" },
                "מה הקשר שלך אליו/אליה",
              ),
              e.createElement(
                "select",
                {
                  value: rel,
                  onChange: (x) => setRel(x.target.value),
                  className:
                    "border border-slate-200 rounded-lg py-2.5 px-3 text-sm text-right outline-none",
                },
                e.createElement("option", { value: "parent" }, "הורה"),
                e.createElement(
                  "option",
                  { value: "self" },
                  "אני השחקן/ית",
                ),
                e.createElement(
                  "option",
                  { value: "family" },
                  "בן/בת משפחה",
                ),
              ),
            ),
            field("הערה למנהל (לא חובה)", note, setNote),
            err &&
              e.createElement(
                "p",
                { className: "text-red-600 text-xs" },
                err,
              ),
            e.createElement(
              "button",
              {
                onClick: submit,
                disabled: busy || !ok,
                className:
                  "bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-xl py-3.5",
              },
              busy ? "שולח…" : "שליחת בקשה",
            ),
          ),
    ),
  );
}

// ===== דירוג מאתר איגוד טניס השולחן =====
// הנתונים נמשכים מ-tttm.co.il על ידי GitHub Actions ונשמרים ב-tttm.json לצד האפליקציה.
function normalizeHeName(v) {
  return String(v || "")
    .replace(/["'׳״‘’“”]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
function tttmCategoryLabel(code) {
  let c = String(code || "").toUpperCase().trim(),
    m = c.match(/^([A-Z])(\d*)$/);
  if (!m) return c;
  let age = m[2];
  if (m[1] === "S") return age ? "בוגרים " + age + "+" : "בוגרים";
  if (age) return "עד גיל " + age;
  return c;
}
function useTttm() {
  let [state, setState] = b({
    loading: !0,
    players: [],
    teams: [],
    matches: [],
    tournaments: [],
    updatedAt: "",
    error: "",
  });
  return (
    j(() => {
      let cancelled = !1;
      return (
        fetch("./tttm.json", { cache: "no-cache" })
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status))))
          .then((d) => {
            cancelled ||
              setState({
                loading: !1,
                players: Array.isArray(d.players) ? d.players : [],
                teams: Array.isArray(d.teams) ? d.teams : [],
                matches: Array.isArray(d.matches) ? d.matches : [],
                tournaments: Array.isArray(d.tournaments) ? d.tournaments : [],
                updatedAt: d.updatedAt || "",
                error: "",
              });
          })
          .catch((e2) => {
            cancelled ||
              setState({
                loading: !1,
                players: [],
                teams: [],
                matches: [],
                tournaments: [],
                updatedAt: "",
                error: e2.message || String(e2),
              });
          }),
        () => {
          cancelled = !0;
        }
      );
    }, []),
    state
  );
}
function tttmForPlayer(player, list) {
  if (!player || !list || !list.length) return null;
  if (player.tttmId) {
    let byId = list.find((x) => String(x.tttmId) === String(player.tttmId));
    if (byId) return byId;
  }
  let n = normalizeHeName(player.name);
  if (!n) return null;
  let exact = list.filter((x) => normalizeHeName(x.name) === n);
  return exact.length === 1 ? exact[0] : null;
}
function tttmUpdatedLabel(iso) {
  if (!iso) return "";
  let d = new Date(iso);
  return isNaN(d) ? "" : d.toLocaleDateString("he-IL", { day: "numeric", month: "long" });
}
function TttmBadge({ entry: entry, updatedAt: updatedAt }) {
  if (!entry) return null;
  return e.createElement(
    "div",
    { className: "bg-blue-950 rounded-xl px-3 py-2.5 flex flex-col gap-1" },
    e.createElement(
      "div",
      { className: "flex items-baseline justify-between gap-2" },
      e.createElement(
        "span",
        { className: "text-[11px] text-blue-300" },
        "דירוג ארצי",
      ),
      entry.rank
        ? e.createElement(
            "span",
            { className: "text-white text-lg font-bold" },
            entry.rank,
          )
        : e.createElement(
            "span",
            { className: "text-blue-200 text-xs" },
            "רשום, ללא דירוג",
          ),
    ),
    e.createElement(
      "div",
      { className: "flex items-baseline justify-between gap-2" },
      e.createElement(
        "span",
        { className: "text-[11px] text-blue-300" },
        tttmCategoryLabel(entry.category),
      ),
      entry.points
        ? e.createElement(
            "span",
            { className: "text-blue-100 text-xs" },
            entry.points,
            " נק'",
          )
        : null,
    ),
    updatedAt &&
      e.createElement(
        "div",
        { className: "text-[10px] text-blue-400" },
        "מאתר האיגוד · עודכן ",
        tttmUpdatedLabel(updatedAt),
      ),
  );
}

// ===== הפורטל: בית · אישי · אימונים · ליגה · עוד =====
var HEB_DAYS_FULL = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
var CLUB_LINKS = {
  tournaments: "https://shahar1987.github.io/ttc-mvh-tournaments/",
  facebook: "https://www.facebook.com/TTCMH",
  instagram: "https://www.instagram.com/ttcmhr",
  tttm: "https://tttm.co.il/c/160/",
};
function localISO(d) {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}
function relDay(iso) {
  let t = new Date(),
    today = localISO(t),
    tm = new Date(t);
  tm.setDate(t.getDate() + 1);
  if (iso === today) return "היום";
  if (iso === localISO(tm)) return "מחר";
  let d = new Date(iso + "T00:00:00"),
    diff = Math.round((d - new Date(today + "T00:00:00")) / 864e5);
  if (diff > 1 && diff < 7) return "יום " + HEB_DAYS_FULL[d.getDay()];
  return d.toLocaleDateString("he-IL", { day: "numeric", month: "long" });
}
// "היום, ראשון" / "מחר, שני" / "יום רביעי" / "20 באוקטובר, שלישי" — בלי כפילות של שם היום
function relDayWithName(iso) {
  let rel = relDay(iso),
    d = new Date(iso + "T00:00:00");
  return rel.startsWith("יום ") ? rel : rel + ", " + HEB_DAYS_FULL[d.getDay()];
}
function fmtDateShort(iso) {
  if (!iso) return "";
  let d = new Date(iso + "T00:00:00");
  return isNaN(d)
    ? iso
    : d.toLocaleDateString("he-IL", { day: "numeric", month: "numeric", year: "2-digit" });
}
function timeRange(g) {
  return g.startTime
    ? g.startTime + (g.endTime ? "–" + g.endTime : "")
    : "";
}
function groupCoachLabelFor(g, users) {
  if (Array.isArray(users) && users.length) {
    let names = groupCoachNames(g, users);
    if (names.length) return names.join(", ");
  }
  return Array.isArray(g.coachNames) ? g.coachNames.filter(Boolean).join(", ") : "";
}
function isCancelledOn(cancellations, date, groupId) {
  return (cancellations || []).some(
    (c) => c.date === date && c.groupId === groupId,
  );
}
// האימון הקרוב מבין הקבוצות הרלוונטיות, מדלג על אימונים שבוטלו
// ימי האימון של הקבוצה עבור השחקנים המקושרים בה: אם לכולם הוגדרו ימים אישיים — רק הימים האלה
function groupDaysForPlayers(g, players) {
  let days = (g.days || [])
      .map((d) => (typeof d === "number" ? d : MEM_DAYS.indexOf(d)))
      .filter((d) => d >= 0),
    ps = (players || []).filter((p) => p.groupId === g.id);
  if (
    ps.length &&
    ps.every((p) => Array.isArray(p.trainingDays) && p.trainingDays.length)
  ) {
    let allowed = new Set(ps.flatMap((p) => p.trainingDays.map(Number)));
    days = days.filter((d) => allowed.has(d));
  }
  return days.slice().sort((a, b) => a - b);
}
function nextTrainingFor(groups, cancellations, players) {
  let now = new Date(),
    best = null;
  for (let g of groups) {
    for (let dow of groupDaysForPlayers(g, players)) {
      for (let k = 0; k < 14; k++) {
        let dt = new Date(now);
        dt.setDate(now.getDate() + k);
        dt.setHours(0, 0, 0, 0);
        if (dt.getDay() !== dow) continue;
        let [eh, em] = (g.endTime || g.startTime || "23:59").split(":").map(Number),
          [sh, sm] = (g.startTime || "00:00").split(":").map(Number),
          end = new Date(dt),
          start = new Date(dt);
        end.setHours(Number.isFinite(eh) ? eh : 23, Number.isFinite(em) ? em : 59, 0, 0);
        start.setHours(Number.isFinite(sh) ? sh : 0, Number.isFinite(sm) ? sm : 0, 0, 0);
        if (end < now) continue;
        let iso = localISO(dt);
        if (isCancelledOn(cancellations, iso, g.id)) continue;
        if (!best || start < best.start) best = { dt: dt, start: start, iso: iso, g: g };
        break;
      }
    }
  }
  return best;
}
function matchTimes(m) {
  let [y, mo, d] = String(m.date || "").split("-").map(Number),
    [hh, mi] = String(m.time || "19:00").split(":").map(Number),
    start = new Date(y, (mo || 1) - 1, d || 1, hh || 19, mi || 0);
  return [start, new Date(start.getTime() + 3 * 36e5)];
}
function gcalStamp(dt) {
  return (
    dt.getFullYear() +
    String(dt.getMonth() + 1).padStart(2, "0") +
    String(dt.getDate()).padStart(2, "0") +
    "T" +
    String(dt.getHours()).padStart(2, "0") +
    String(dt.getMinutes()).padStart(2, "0") +
    "00"
  );
}
function gcalUrl(m) {
  if (!m || !m.date) return "";
  let [a, c] = matchTimes(m),
    q = new URLSearchParams({
      action: "TEMPLATE",
      text: "🏓 " + m.homeName + " נגד " + m.awayName,
      dates: gcalStamp(a) + "/" + gcalStamp(c),
      details: [m.league, m.drawName, X].filter(Boolean).join(" · "),
      location: m.isHome ? "משחק בית" : "משחק חוץ אצל " + m.homeName,
      ctz: "Asia/Jerusalem",
    });
  return "https://calendar.google.com/calendar/render?" + q.toString();
}
function announcementVisible(a) {
  let now = new Date().toISOString();
  if (a.publishAt && a.publishAt > now) return !1;
  if (a.expiresAt && a.expiresAt < now) return !1;
  return !a.deleted;
}
function announcementIsUrgent(a) {
  return (
    !!a.urgent &&
    announcementVisible(a) &&
    (a.publishAt || a.createdAt || "") > new Date(Date.now() - 3 * 864e5).toISOString()
  );
}
// ----- אבני בניין של הפורטל -----
function PCard(props) {
  let kids = props.children == null ? [] : [].concat(props.children);
  return e.createElement(
    "div",
    {
      onClick: props.onClick,
      className:
        "bg-white rounded-2xl p-4 flex flex-col gap-2.5 shadow-sm " +
        (props.onClick ? "active:bg-slate-50 cursor-pointer " : "") +
        (props.className || ""),
    },
    props.title &&
      e.createElement(
        "div",
        { className: "flex items-center gap-2" },
        props.icon &&
          e.createElement(
            "span",
            {
              className:
                "w-8 h-8 rounded-lg bg-blue-50 text-blue-900 flex items-center justify-center shrink-0",
            },
            e.createElement(props.icon, { className: "w-4 h-4" }),
          ),
        e.createElement(
          "span",
          { className: "text-xs font-semibold text-slate-500" },
          props.title,
        ),
      ),
    ...kids,
  );
}
function PMore(label, onClick) {
  return e.createElement(
    "button",
    {
      onClick: (x) => {
        (x.stopPropagation(), onClick && onClick());
      },
      className: "text-sm text-blue-800 font-semibold text-right mt-1",
    },
    label + " ←",
  );
}
function MatchCard({ m: m, compact: compact }) {
  if (!m) return null;
  let played = !!m.played,
    our = m.isHome ? m.homeScore : m.awayScore,
    opp = m.isHome ? m.awayScore : m.homeScore,
    cls = played ? (our > opp ? "text-emerald-600" : our < opp ? "text-red-500" : "text-slate-700") : "text-blue-950",
    // התוצאה מוצגת כשלושה פריטי flex (ולא מחרוזת "3:1") כדי שתוצאת המארחת תישאר בצד של שם המארחת גם ב-RTL
    score = played
      ? [
          e.createElement("span", { key: "h" }, m.homeScore),
          e.createElement("span", { key: "s", className: "opacity-50" }, ":"),
          e.createElement("span", { key: "a" }, m.awayScore),
        ]
      : m.time || "—";
  return e.createElement(
    "div",
    { className: "flex flex-col gap-2" },
    e.createElement(
      "div",
      { className: "flex items-center justify-between gap-2" },
      e.createElement(
        "div",
        {
          className:
            "flex-1 text-sm font-bold leading-snug " +
            (m.isHome ? "text-blue-900" : "text-slate-700"),
        },
        m.homeName,
      ),
      e.createElement(
        "div",
        {
          className:
            "shrink-0 bg-slate-100 rounded-xl px-3 py-1.5 text-lg font-bold tabular-nums flex items-center gap-0.5 " + cls,
          dir: "rtl",
        },
        score,
      ),
      e.createElement(
        "div",
        {
          className:
            "flex-1 text-sm font-bold leading-snug text-left " +
            (!m.isHome ? "text-blue-900" : "text-slate-700"),
        },
        m.awayName,
      ),
    ),
    e.createElement(
      "p",
      { className: "text-xs text-slate-500" },
      m.date
        ? (played ? fmtDateShort(m.date) : relDay(m.date) + " · " + fmtDateShort(m.date))
        : "תאריך טרם נקבע",
      " · ",
      m.isHome
        ? e.createElement("b", { className: "text-blue-900" }, "בית")
        : "חוץ",
      m.league ? " · " + m.league : "",
    ),
    !played &&
      !compact &&
      m.date &&
      e.createElement(
        "a",
        {
          href: gcalUrl(m),
          target: "_blank",
          rel: "noopener",
          onClick: (x) => x.stopPropagation(),
          className:
            "self-start inline-flex items-center gap-1.5 text-xs font-semibold text-blue-900 bg-blue-50 rounded-lg px-3 py-2",
        },
        e.createElement(ge, { className: "w-3.5 h-3.5" }),
        "הוסף ליומן",
      ),
  );
}
// ----- פרסום הודעה (מנהל / מאמן) -----
function AnnouncementForm({ onClose: onClose, author: author, announcement: ann }) {
  let editing = !!(ann && ann.id),
    [title, setTitle] = b((ann && ann.title) || ""),
    [body, setBody] = b((ann && ann.body) || ""),
    [urgent, setUrgent] = b(!!(ann && ann.urgent)),
    [expires, setExpires] = b(ann && ann.expiresAt ? String(ann.expiresAt).slice(0, 10) : ""),
    [busy, setBusy] = b(!1),
    [err, setErr] = b(""),
    submit = async () => {
      (setBusy(!0), setErr(""));
      try {
        let now = new Date().toISOString(),
          expiresAt = expires ? new Date(expires + "T23:59:59").toISOString() : "";
        editing
          ? await O(S(P, "announcements", ann.id), {
              title: title.trim(),
              body: body.trim(),
              urgent: urgent,
              expiresAt: expiresAt,
              updatedAt: now,
            })
          : await V(M(P, "announcements"), {
              title: title.trim(),
              body: body.trim(),
              urgent: urgent,
              audience: "all",
              expiresAt: expiresAt,
              publishAt: now,
              createdAt: now,
              authorUid: author?.id || "",
              authorName: author?.name || "",
            });
        onClose();
      } catch (e2) {
        (setErr(
          (editing ? "העדכון נכשל: " : "הפרסום נכשל: ") +
            (String(e2.code || "").includes("permission")
              ? "אין הרשאה. צריך לפרסם את כללי האבטחה המעודכנים בקונסולת Firebase."
              : e2.message || e2),
        ),
          setBusy(!1));
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
        onClick: (x) => x.stopPropagation(),
        className:
          "bg-white w-full max-w-md rounded-t-2xl p-5 flex flex-col gap-3",
      },
      e.createElement(
        "div",
        { className: "flex items-center justify-between" },
        e.createElement(
          "button",
          { onClick: onClose, className: "text-slate-400" },
          e.createElement(T, { className: "w-5 h-5" }),
        ),
        e.createElement("h3", { className: "font-bold text-blue-950" }, editing ? "עריכת הודעה" : "הודעה להורים"),
      ),
      e.createElement("input", {
        value: title,
        onChange: (x) => setTitle(x.target.value),
        placeholder: "כותרת",
        className:
          "border border-slate-200 rounded-lg py-2.5 px-3 text-sm text-right outline-none focus:border-emerald-400",
      }),
      e.createElement("textarea", {
        value: body,
        onChange: (x) => setBody(x.target.value),
        placeholder: "תוכן ההודעה",
        rows: 4,
        className:
          "border border-slate-200 rounded-lg py-2.5 px-3 text-sm text-right outline-none focus:border-emerald-400",
      }),
      e.createElement(
        "label",
        { className: "flex items-center gap-2 text-sm text-slate-700" },
        e.createElement("input", {
          type: "checkbox",
          checked: urgent,
          onChange: (x) => setUrgent(x.target.checked),
          className: "w-4 h-4",
        }),
        "דחוף — יוצג בפס אדום בראש מסך הבית",
      ),
      e.createElement(
        "label",
        { className: "flex items-center justify-between gap-2 text-sm text-slate-700" },
        e.createElement("input", {
          type: "date",
          value: expires,
          dir: "ltr",
          onChange: (x) => setExpires(x.target.value),
          className:
            "border border-slate-200 rounded-lg py-2 px-2 text-sm outline-none focus:border-emerald-400",
        }),
        "להסתיר אחרי תאריך (לא חובה)",
      ),
      err && e.createElement("p", { className: "text-red-600 text-xs" }, err),
      e.createElement(
        "button",
        {
          onClick: submit,
          disabled: busy || title.trim().length < 2,
          className:
            "bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-xl py-3.5",
        },
        busy ? (editing ? "שומר…" : "מפרסם…") : editing ? "שמירה" : "פרסום",
      ),
    ),
  );
}
// ----- המסך המלא -----
function MemberPortal({
  profile: profile,
  authUser: authUser,
  embedded: embedded,
  staffGroupIds: staffGroupIds,
  users: users,
  isStaff: isStaff,
  isAdmin: isAdmin,
  allPlayers: allPlayers,
  allAttendance: allAttendance,
}) {
  let uid = authUser?.uid,
    { loading, players, attendance: rawAttendance, links, error } = useMemberData(uid),
    tttm = useTttm(),
    { data: groups } = L("groups", null, uid),
    { data: cancellations } = L("cancellations", null, uid),
    // כמו אצל הצוות: אימון שבוטל לא נספר להורה כהיעדרות
    attendance = excludeCancelled(rawAttendance, cancellations),
    { data: announcementsRaw, error: annError } = L("announcements", null, uid),
    [tab, setTab] = b("home"),
    [annForm, setAnnForm] = b(!1),
    [annEdit, setAnnEdit] = b(null),
    [mgrQuery, setMgrQuery] = b(""),
    [mgrErr, setMgrErr] = b(""),
    [audit, setAudit] = b(null),
    [auditBusy, setAuditBusy] = b(!1),
    [auditNonce, setAuditNonce] = b(0),
    announcements = announcementsRaw
      .filter(announcementVisible)
      .sort((a, c) => String(c.publishAt || c.createdAt).localeCompare(String(a.publishAt || a.createdAt))),
    urgent = announcements.find(announcementIsUrgent),
    groupOf = (p) => groups.find((g) => g.id === p.groupId) || null,
    // הקבוצות שהמסך מדבר עליהן: של הילדים המקושרים, או של המאמן, או כל המועדון למנהל
    myGroups = (() => {
      let fromPlayers = players.map((p) => p.groupId).filter(Boolean);
      if (fromPlayers.length) return groups.filter((g) => fromPlayers.includes(g.id));
      if (Array.isArray(staffGroupIds)) return groups.filter((g) => staffGroupIds.includes(g.id));
      return isStaff ? groups : [];
    })(),
    hasPersonal = players.length > 0,
    next = nextTrainingFor(myGroups, cancellations, players),
    teams = tttmTeams(tttm),
    todayIso = localISO(new Date()),
    // רק משחק שעוד לא התקיים — הנתונים מהאיגוד מתעדכנים פעמיים בשבוע
    nextMatch = teams
      .map((t) => t.nextMatch && { ...t.nextMatch, teamKey: t.teamKey, league: t.nextMatch.league || t.league })
      .filter((m) => m && !m.played && String(m.date || "") >= todayIso)
      .sort((a, c) => String(a.date).localeCompare(String(c.date)))[0],
    firstName = (n) => String(n || "").split(" ")[0],
    monthCount = (pid) => memberMonthStats(attendance, pid).present,
    // -------- בית --------
    homeScreen = () =>
      e.createElement(
        e.Fragment,
        null,
        urgent &&
          e.createElement(
            "div",
            {
              onClick: () => setTab("more"),
              className:
                "bg-red-600 text-white rounded-2xl px-4 py-3 flex flex-col gap-0.5 cursor-pointer",
            },
            e.createElement("span", { className: "text-[11px] font-semibold opacity-90" }, "הודעה דחופה"),
            e.createElement("span", { className: "font-bold" }, urgent.title),
            urgent.body && e.createElement("span", { className: "text-sm opacity-90" }, urgent.body.slice(0, 140)),
          ),
        e.createElement(
          PCard,
          {
            title: hasPersonal ? "האימון הבא שלי" : "האימון הקרוב במועדון",
            icon: ge,
            onClick: () => setTab("trainings"),
          },
          next
            ? e.createElement(
                e.Fragment,
                null,
                e.createElement(
                  "p",
                  { className: "text-xl font-bold text-blue-950 leading-tight" },
                  relDayWithName(next.iso),
                  " ",
                  timeRange(next.g),
                ),
                e.createElement(
                  "p",
                  { className: "text-sm text-slate-600" },
                  [next.g.location, groupCoachLabelFor(next.g, users) && "מאמן " + groupCoachLabelFor(next.g, users)]
                    .filter(Boolean)
                    .join(" · "),
                ),
                e.createElement("p", { className: "text-xs text-slate-400" }, next.g.name),
              )
            : e.createElement(
                "p",
                { className: "text-sm text-slate-500" },
                myGroups.length ? "אין אימון מתוכנן בשבועיים הקרובים" : "אין קבוצה משויכת",
              ),
        ),
        loading &&
          e.createElement(
            PCard,
            { title: "האזור האישי", icon: H },
            e.createElement("p", { className: "text-sm text-slate-400" }, "טוען…"),
          ),
        hasPersonal &&
          e.createElement(
            PCard,
            {
              title: players.length === 1 ? "האזור האישי של " + firstName(players[0].name) : "האזור האישי",
              icon: H,
              onClick: () => setTab("personal"),
            },
            ...players.map((p) => {
              let entry = tttmForPlayer(p, tttm.players);
              return e.createElement(
                "div",
                { key: p.id, className: "flex items-center justify-between gap-3 py-1" },
                players.length > 1 &&
                  e.createElement("span", { className: "text-sm font-semibold text-blue-950 flex-1 truncate" }, p.name),
                e.createElement(
                  "div",
                  { className: "text-center" },
                  e.createElement("p", { className: "text-2xl font-bold text-blue-950 leading-none" }, monthCount(p.id)),
                  e.createElement("p", { className: "text-[11px] text-slate-500 mt-1" }, "אימונים החודש"),
                ),
                e.createElement(
                  "div",
                  { className: "text-center" },
                  e.createElement(
                    "p",
                    { className: "text-2xl font-bold text-blue-950 leading-none" },
                    entry && entry.rank ? entry.rank : "—",
                  ),
                  e.createElement(
                    "p",
                    { className: "text-[11px] text-slate-500 mt-1" },
                    entry && entry.points ? "דירוג ארצי · " + Math.round(entry.points) + " נק'" : "דירוג ארצי",
                  ),
                ),
              );
            }),
            PMore("לכל הפרטים", () => setTab("personal")),
          ),
        e.createElement(
          PCard,
          { title: "הודעות מהמועדון", icon: J, onClick: () => setTab("more") },
          announcements.length
            ? e.createElement(
                "div",
                { className: "flex flex-col divide-y divide-slate-100" },
                ...announcements.slice(0, 3).map((a) =>
                  e.createElement(
                    "div",
                    { key: a.id, className: "py-2" },
                    e.createElement("p", { className: "font-bold text-sm text-blue-950" }, a.title),
                    e.createElement(
                      "p",
                      { className: "text-[11px] text-slate-500" },
                      fmtDateShort(localISO(new Date(a.publishAt || a.createdAt || Date.now()))),
                      a.authorName ? " · " + a.authorName : "",
                    ),
                  ),
                ),
              )
            : e.createElement("p", { className: "text-sm text-slate-500" }, "אין הודעות חדשות"),
          isStaff &&
            e.createElement(
              "button",
              {
                onClick: (x) => {
                  (x.stopPropagation(), setAnnForm(!0));
                },
                className:
                  "self-start text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2",
              },
              "+ הודעה חדשה",
            ),
        ),
        nextMatch &&
          e.createElement(
            PCard,
            { title: "המשחק הבא — " + nextMatch.teamKey, icon: TrophyIcon, onClick: () => setTab("league") },
            e.createElement(MatchCard, { m: nextMatch }),
            PMore("טבלאות ליגה", () => setTab("league")),
          ),
      ),
    // -------- אישי --------
    personalCard = (p) => {
      let g = groupOf(p),
        st = memberMonthStats(attendance, p.id),
        entry = tttmForPlayer(p, tttm.players),
        recent = memberRecent(attendance, p.id, 5);
      return e.createElement(
        PCard,
        { key: p.id },
        e.createElement(
          "div",
          { className: "flex items-center justify-between gap-2" },
          e.createElement(
            "div",
            { className: "min-w-0" },
            e.createElement("p", { className: "font-bold text-blue-950 text-base truncate" }, p.name),
            e.createElement(
              "p",
              { className: "text-xs text-slate-500 truncate" },
              g ? g.name : "ללא קבוצה",
              p.isActive === !1 ? " · כרטיס בארכיון" : "",
            ),
          ),
          st.pct !== null &&
            e.createElement(
              "div",
              { className: "text-center shrink-0" },
              e.createElement(
                "p",
                {
                  className:
                    "text-xl font-bold " +
                    (st.pct >= 75 ? "text-emerald-600" : st.pct >= 50 ? "text-amber-500" : "text-red-500"),
                },
                st.pct,
                "%",
              ),
              e.createElement("p", { className: "text-[10px] text-slate-400" }, "נוכחות החודש"),
            ),
        ),
        entry && e.createElement(TttmBadge, { entry: entry, updatedAt: tttm.updatedAt }),
        entry &&
          entry.seasonGames > 0 &&
          e.createElement(
            "p",
            { className: "text-xs text-slate-600" },
            "העונה בליגה: ",
            entry.seasonWins,
            " ניצחונות מתוך ",
            entry.seasonGames,
            " משחקים",
            entry.teamKey ? " · קבוצה " + entry.teamKey : "",
          ),
        recent.length
          ? e.createElement(
              "div",
              { className: "flex flex-col gap-1" },
              e.createElement("p", { className: "text-[11px] text-slate-500" }, "אימונים אחרונים"),
              ...recent.map((r) =>
                e.createElement(
                  "div",
                  { key: r.id, className: "flex items-center justify-between text-xs border-b border-slate-100 py-1" },
                  e.createElement("span", { className: "text-slate-600" }, Ke(r.date)),
                  e.createElement(
                    "span",
                    { className: r.status === "Present" ? "text-emerald-600 font-semibold" : "text-red-500 font-semibold" },
                    r.status === "Present" ? "נוכח" : "נעדר",
                  ),
                ),
              ),
            )
          : e.createElement("p", { className: "text-xs text-slate-400" }, "עדיין אין רישומי נוכחות"),
      );
    },
    personalScreen = () =>
      e.createElement(
        e.Fragment,
        null,
        loading && e.createElement("p", { className: "text-sm text-slate-400 text-center py-4" }, "טוען…"),
        !loading && !players.length
          ? e.createElement(
              PCard,
              {},
              e.createElement(
                "p",
                { className: "text-sm text-slate-700 leading-relaxed" },
                embedded
                  ? "כך נראה האזור האישי להורה. החשבון שלך לא מקושר לשום שחקן — אפשר לקשר דרך גישת הורים ← קישורים."
                  : "החשבון שלך מחובר לפורטל, אבל עדיין לא שויך אליו שחקן. אם זו טעות — פנה למנהל המועדון.",
              ),
            )
          : null,
        ...players.map(personalCard),
      ),
    // -------- אימונים --------
    trainingsScreen = () => {
      let today = localISO(new Date()),
        todayDow = new Date().getDay(),
        upcomingCancels = cancellations
          .filter((c) => c.date >= today && myGroups.some((g) => g.id === c.groupId))
          .sort((a, c) => a.date.localeCompare(c.date)),
        // לוח האימונים המלא של המועדון — כל הקבוצות, גם כאלה שאינן שלי
        groupDaysOf = (g) =>
          (g.days || [])
            .map((d) => (typeof d === "number" ? d : MEM_DAYS.indexOf(d)))
            .filter((d) => d >= 0),
        startMinutes = (g) => {
          let [h, m] = String(g.startTime || "23:59").split(":").map(Number);
          return (Number.isFinite(h) ? h : 23) * 60 + (Number.isFinite(m) ? m : 59);
        },
        week = [0, 1, 2, 3, 4, 5, 6].map((d) => ({
          dow: d,
          items: groups
            .filter((g) => groupDaysOf(g).includes(d))
            .sort((a, c) => startMinutes(a) - startMinutes(c)),
        })).filter((row) => row.items.length),
        noSchedule = groups.filter((g) => !groupDaysOf(g).length);
      return e.createElement(
        e.Fragment,
        null,
        upcomingCancels.length
          ? e.createElement(
              "div",
              { className: "bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col gap-1" },
              e.createElement("p", { className: "text-xs font-semibold text-amber-700" }, "אימונים שבוטלו"),
              ...upcomingCancels.map((c) => {
                let g = groups.find((x) => x.id === c.groupId);
                return e.createElement(
                  "p",
                  { key: c.id, className: "text-sm text-amber-900" },
                  Ke(c.date),
                  g ? " · " + g.name : "",
                  c.reason ? " · " + c.reason : "",
                );
              }),
            )
          : null,
        myGroups.length === 0
          ? e.createElement(PCard, {}, e.createElement("p", { className: "text-sm text-slate-500" }, "אין קבוצה משויכת"))
          : null,
        ...myGroups.map((g) =>
          e.createElement(
            PCard,
            { key: g.id },
            e.createElement("p", { className: "font-bold text-blue-950" }, g.name),
            e.createElement(
              "p",
              { className: "text-sm text-slate-700" },
              groupDaysForPlayers(g, players).length
                ? "ימים " + groupDaysForPlayers(g, players).map((d) => HEB_DAYS_FULL[d]).join(", ")
                : "ימי אימון טרם נקבעו",
              timeRange(g) ? " · " + timeRange(g) : "",
            ),
            g.location && e.createElement("p", { className: "text-xs text-slate-500" }, g.location),
            groupCoachLabelFor(g, users) &&
              e.createElement("p", { className: "text-xs text-slate-500" }, "מאמן: " + groupCoachLabelFor(g, users)),
          ),
        ),
        isAdmin &&
          e.createElement(
          PCard,
          { title: "לוח האימונים של המועדון", icon: ge },
          week.length
            ? e.createElement(
                "div",
                { className: "flex flex-col gap-3" },
                ...week.map((row) =>
                  e.createElement(
                    "div",
                    { key: row.dow, className: "flex flex-col gap-1" },
                    e.createElement(
                      "p",
                      {
                        className:
                          "text-xs font-bold " + (row.dow === todayDow ? "text-emerald-700" : "text-slate-500"),
                      },
                      "יום " + HEB_DAYS_FULL[row.dow],
                      row.dow === todayDow ? " · היום" : "",
                    ),
                    ...row.items.map((g) =>
                      e.createElement(
                        "div",
                        {
                          key: row.dow + "_" + g.id,
                          className:
                            "flex items-start justify-between gap-2 border-r-2 pr-2 " +
                            (myGroups.some((x) => x.id === g.id) ? "border-blue-900" : "border-slate-200"),
                        },
                        e.createElement(
                          "span",
                          { className: "text-xs text-slate-500 shrink-0 tabular-nums" },
                          timeRange(g) || "שעה טרם נקבעה",
                        ),
                        e.createElement(
                          "div",
                          { className: "flex-1 min-w-0 text-right" },
                          e.createElement("p", { className: "text-sm font-semibold text-blue-950 truncate" }, g.name),
                          e.createElement(
                            "p",
                            { className: "text-[11px] text-slate-500 truncate" },
                            [g.location, groupCoachLabelFor(g, users) && "מאמן " + groupCoachLabelFor(g, users)]
                              .filter(Boolean)
                              .join(" · "),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
                noSchedule.length
                  ? e.createElement(
                      "p",
                      { className: "text-[11px] text-slate-400" },
                      "ללא ימים קבועים: " + noSchedule.map((g) => g.name).join(", "),
                    )
                  : null,
              )
            : e.createElement("p", { className: "text-sm text-slate-500" }, "טרם נקבעו ימי אימון לקבוצות"),
        ),
      );
    },
    // -------- ליגה --------
    leagueScreen = () => {
      let allMatches = tttmMatches(tttm),
        today = localISO(new Date());
      if (!teams.length)
        return e.createElement(
          PCard,
          {},
          e.createElement("p", { className: "text-sm text-slate-500" }, "אין נתוני ליגה כרגע — מתעדכן מאתר האיגוד פעמיים בשבוע."),
        );
      return e.createElement(
        e.Fragment,
        null,
        ...teams.map((t) => {
          let mine = allMatches.filter((m) => m.ourTeamKey === t.teamKey || (!m.ourTeamKey && (m.homeName === t.name || m.awayName === t.name))),
            upcoming = mine.filter((m) => !m.played && m.date >= today).slice(0, 5),
            results = mine.filter((m) => m.played).slice(-5).reverse();
          return e.createElement(
            e.Fragment,
            { key: t.teamId || t.teamKey },
            e.createElement(
              PCard,
              { title: t.league || "ליגה", icon: TrophyIcon },
              e.createElement(
                "div",
                { className: "flex items-end justify-between gap-2" },
                e.createElement(
                  "div",
                  null,
                  e.createElement("p", { className: "font-bold text-blue-950 text-base" }, t.name || "הפועל מבואות חרמון " + t.teamKey),
                  t.drawName && e.createElement("p", { className: "text-xs text-slate-500" }, t.drawName),
                ),
                t.position &&
                  e.createElement(
                    "div",
                    { className: "text-center" },
                    e.createElement("p", { className: "text-2xl font-bold text-blue-950 leading-none" }, t.position),
                    e.createElement("p", { className: "text-[10px] text-slate-500 mt-1" }, "מקום"),
                  ),
              ),
              e.createElement(
                "p",
                { className: "text-xs text-slate-600" },
                "משחקים ",
                t.played ?? 0,
                " · ניצחונות ",
                t.won ?? 0,
                " · הפסדים ",
                t.lost ?? 0,
                " · נקודות ",
                t.points ?? 0,
              ),
              t.nextMatch && !t.nextMatch.played && String(t.nextMatch.date || "") >= today &&
                e.createElement(
                  "div",
                  { className: "border-t border-slate-100 pt-2" },
                  e.createElement("p", { className: "text-[11px] text-slate-500 mb-1" }, "המשחק הבא"),
                  e.createElement(MatchCard, { m: { ...t.nextMatch, league: t.nextMatch.league || t.league } }),
                ),
            ),
            Array.isArray(t.table) && t.table.length
              ? e.createElement(
                  PCard,
                  { title: "טבלת הליגה" },
                  e.createElement(
                    "div",
                    { className: "overflow-x-auto" },
                    e.createElement(
                      "table",
                      { className: "w-full text-xs" },
                      e.createElement(
                        "thead",
                        null,
                        e.createElement(
                          "tr",
                          { className: "text-slate-400" },
                          e.createElement("th", { className: "text-right py-1 font-normal" }, "#"),
                          e.createElement("th", { className: "text-right py-1 font-normal" }, "קבוצה"),
                          e.createElement("th", { className: "text-center py-1 font-normal" }, "מש'"),
                          e.createElement("th", { className: "text-center py-1 font-normal" }, "נק'"),
                        ),
                      ),
                      e.createElement(
                        "tbody",
                        null,
                        ...t.table.map((row, i) =>
                          e.createElement(
                            "tr",
                            {
                              key: row.teamId || i,
                              className:
                                (row.ours || String(row.teamId) === String(t.teamId)
                                  ? "bg-blue-50 font-bold text-blue-950 "
                                  : "text-slate-700 ") + "border-t border-slate-100",
                            },
                            e.createElement("td", { className: "py-1.5 pl-2 tabular-nums" }, row.position ?? i + 1),
                            e.createElement("td", { className: "py-1.5" }, row.name),
                            e.createElement("td", { className: "py-1.5 text-center tabular-nums" }, row.played ?? ""),
                            e.createElement("td", { className: "py-1.5 text-center tabular-nums" }, row.points ?? ""),
                          ),
                        ),
                      ),
                    ),
                  ),
                )
              : null,
            upcoming.length
              ? e.createElement(
                  PCard,
                  { title: "המשחקים הקרובים" },
                  ...upcoming.map((m) =>
                    e.createElement(
                      "div",
                      { key: m.matchId, className: "border-b border-slate-100 last:border-0 py-2" },
                      e.createElement(MatchCard, { m: m, compact: !0 }),
                    ),
                  ),
                )
              : null,
            results.length
              ? e.createElement(
                  PCard,
                  { title: "תוצאות אחרונות" },
                  ...results.map((m) =>
                    e.createElement(
                      "div",
                      { key: m.matchId, className: "border-b border-slate-100 last:border-0 py-2" },
                      e.createElement(MatchCard, { m: m, compact: !0 }),
                    ),
                  ),
                )
              : null,
          );
        }),
        tttm.updatedAt &&
          e.createElement(
            "p",
            { className: "text-[11px] text-slate-400 text-center" },
            "מאתר האיגוד · עודכן ",
            tttmUpdatedLabel(tttm.updatedAt),
          ),
      );
    },
    // -------- עוד --------
    moreScreen = () => {
      let today = localISO(new Date()),
        tournaments = tttmTournaments(tttm)
          .filter((t) => !t.date || t.date >= today)
          .sort((a, c) => String(a.date || "").localeCompare(String(c.date || "")))
          .slice(0, 8),
        linkRow = (label, href) =>
          e.createElement(
            "a",
            {
              key: href,
              href: href,
              target: "_blank",
              rel: "noopener",
              className: "flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0 text-sm text-blue-900 font-semibold",
            },
            label,
            e.createElement("span", { className: "text-slate-300" }, "↗"),
          );
      return e.createElement(
        e.Fragment,
        null,
        e.createElement(
          PCard,
          { title: "הודעות מהמועדון", icon: J },
          announcements.length
            ? e.createElement(
                "div",
                { className: "flex flex-col divide-y divide-slate-100" },
                ...announcements.slice(0, 20).map((a) =>
                  e.createElement(
                    "div",
                    { key: a.id, className: "py-2.5" },
                    e.createElement(
                      "p",
                      { className: "font-bold text-sm text-blue-950" },
                      a.urgent ? e.createElement("span", { className: "text-red-600" }, "דחוף · ") : null,
                      a.title,
                    ),
                    a.body && e.createElement("p", { className: "text-sm text-slate-700 whitespace-pre-line mt-0.5" }, a.body),
                    e.createElement(
                      "p",
                      { className: "text-[11px] text-slate-400 mt-1" },
                      fmtDateShort(localISO(new Date(a.publishAt || a.createdAt || Date.now()))),
                      a.authorName ? " · " + a.authorName : "",
                    ),
                  ),
                ),
              )
            : e.createElement("p", { className: "text-sm text-slate-500" }, "אין הודעות עדיין"),
          isStaff &&
            e.createElement(
              "button",
              { onClick: () => setAnnForm(!0), className: "self-start text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2" },
              "+ הודעה חדשה",
            ),
        ),
        e.createElement(
          PCard,
          { title: "תחרויות קרובות", icon: TrophyIcon },
          tournaments.length
            ? e.createElement(
                "div",
                { className: "flex flex-col divide-y divide-slate-100" },
                ...tournaments.map((t) =>
                  e.createElement(
                    "div",
                    { key: t.eventId || t.name, className: "py-2" },
                    t.url
                      ? e.createElement(
                          "a",
                          { href: t.url, target: "_blank", rel: "noopener", className: "font-bold text-sm text-blue-900 underline" },
                          t.name,
                        )
                      : e.createElement("p", { className: "font-bold text-sm text-blue-950" }, t.name),
                    e.createElement(
                      "p",
                      { className: "text-xs text-slate-500 mt-0.5" },
                      [t.date && fmtDateShort(t.date), t.venue, t.registrationUntil && "הרשמה עד " + t.registrationUntil]
                        .filter(Boolean)
                        .join(" · "),
                    ),
                  ),
                ),
              )
            : e.createElement("p", { className: "text-sm text-slate-500" }, "אין תחרויות קרובות באתר האיגוד"),
          linkRow("כל התחרויות של המועדון", CLUB_LINKS.tournaments),
        ),
        e.createElement(
          PCard,
          { title: "המועדון" },
          linkRow("עמוד המועדון באתר האיגוד", CLUB_LINKS.tttm),
          linkRow("פייסבוק", CLUB_LINKS.facebook),
          linkRow("אינסטגרם", CLUB_LINKS.instagram),
        ),
        !embedded &&
          e.createElement(
            "button",
            { onClick: () => logoutAndClearCache(), className: "text-sm text-slate-500 underline text-center py-2" },
            "התנתקות",
          ),
      );
    },
    // -------- ניהול (מוצג רק לצוות) --------
    manageScreen = () => {
      let activePlayers = (allPlayers || []).filter((p) => p.isActive !== !1 && !p.deleted),
        qs = mgrQuery.trim(),
        shown = qs
          ? activePlayers.filter(
              (p) =>
                String(p.name || "").includes(qs) ||
                String(p.parentName || "").includes(qs) ||
                String(p.parentPhone || "").includes(qs),
            )
          : activePlayers,
        month = E().slice(0, 7),
        monthRows = (allAttendance || []).filter((a) => String(a.date || "").startsWith(month)),
        monthPct = monthRows.length
          ? Math.round((monthRows.filter((a) => a.status === "Present").length / monthRows.length) * 100)
          : null,
        allAnns = announcementsRaw
          .slice()
          .sort((a, c) =>
            String(c.publishAt || c.createdAt || "").localeCompare(String(a.publishAt || a.createdAt || "")),
          ),
        canEditAnn = (a) => !!isAdmin || a.authorUid === profile.id,
        removeAnn = async (a) => {
          if (!window.confirm('למחוק את ההודעה "' + (a.title || "") + '"?')) return;
          try {
            (await Ee(S(P, "announcements", a.id)), setMgrErr(""));
          } catch (err) {
            setMgrErr(
              "המחיקה נכשלה: " +
                (String(err.code || "").includes("permission")
                  ? "אין הרשאה למחוק הודעה של מישהו אחר."
                  : err.message || err),
            );
          }
        },
        statBox = (value, label) =>
          e.createElement(
            "div",
            { key: label, className: "flex-1 min-w-[70px] text-center" },
            e.createElement("p", { className: "text-2xl font-bold text-blue-950 leading-none" }, value),
            e.createElement("p", { className: "text-[11px] text-slate-500 mt-1" }, label),
          ),
        groupName = (id) => (groups.find((g) => g.id === id) || {}).name || "ללא קבוצה",
        knownPlayer = (pid) => (allPlayers || []).find((x) => x.id === pid),
        auditLinks = (audit && audit.links) || [],
        auditInvites = (audit && audit.invites) || [],
        orphanLinks = auditLinks.filter((l) => {
          let pl = knownPlayer(l.playerId);
          return !pl || pl.deleted;
        }),
        ghostLinks = auditLinks.filter((l) => !(users || []).some((u) => u.id === l.uid)),
        staleInvites = auditInvites.filter(
          (iv) =>
            !iv.usedAt &&
            !iv.revoked &&
            (iv.playerIds || []).some((pid) => {
              let pl = knownPlayer(pid);
              return !pl || pl.deleted;
            }),
        ),
        noGroup = activePlayers.filter((p) => !p.groupId),
        danglingGroup = activePlayers.filter((p) => p.groupId && !groups.some((g) => g.id === p.groupId)),
        archivedLinks = auditLinks.filter((l) => {
          let pl = knownPlayer(l.playerId);
          return pl && !pl.deleted && pl.isActive === !1;
        }),
        noCoach = groups.filter((g) => !groupCoachNames(g, users || []).length),
        fixable = [...new Set(orphanLinks.concat(ghostLinks).map((l) => l.id))],
        fixAudit = async () => {
          (setAuditBusy(!0), setMgrErr(""));
          try {
            let batch = Te(P);
            fixable.forEach((id) => batch.delete(S(P, "links", id)));
            staleInvites.forEach((iv) => batch.update(S(P, "invites", iv.id), { revoked: !0 }));
            danglingGroup.forEach((p) => batch.update(S(P, "players", p.id), { groupId: "" }));
            (await batch.commit(), setAudit(null), setAuditNonce((n) => n + 1));
          } catch (err) {
            setMgrErr("הניקוי נכשל: " + (err.message || err));
          } finally {
            setAuditBusy(!1);
          }
        },
        auditRow = (label, count, tone) =>
          e.createElement(
            "div",
            { key: label, className: "py-1.5 flex items-center justify-between gap-2" },
            e.createElement(
              "span",
              {
                className:
                  "text-sm font-bold " + (count ? (tone === "warn" ? "text-amber-600" : "text-slate-500") : "text-emerald-600"),
              },
              count || "0",
            ),
            e.createElement("span", { className: "text-xs text-slate-600 text-right flex-1" }, label),
          );
      return e.createElement(
        e.Fragment,
        null,
        mgrErr && e.createElement("div", { className: "bg-red-50 text-red-700 rounded-xl p-3 text-xs" }, mgrErr),
        annError &&
          e.createElement(
            "div",
            { className: "bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 text-xs leading-relaxed" },
            "לא ניתן לטעון את ההודעות — צריך לפרסם את כללי האבטחה המעודכנים (announcements) בקונסולת Firebase.",
          ),
        e.createElement(
          PCard,
          { title: "המועדון במספרים", icon: he },
          e.createElement(
            "div",
            { className: "flex items-start justify-between gap-2" },
            statBox(activePlayers.length, "שחקנים פעילים"),
            statBox(groups.length, "קבוצות"),
            statBox(monthPct === null ? "—" : monthPct + "%", "נוכחות החודש"),
            statBox(announcements.length, "הודעות פעילות"),
          ),
        ),
        isAdmin &&
          e.createElement(
            PCard,
            { title: "בדיקת עקביות", icon: Ie },
            audit === null
              ? e.createElement("p", { className: "text-sm text-slate-400" }, "בודק…")
              : audit.error
                ? e.createElement("p", { className: "text-sm text-red-600" }, "הבדיקה נכשלה: " + audit.error)
                : e.createElement(
                    e.Fragment,
                    null,
                    e.createElement(
                      "div",
                      { className: "flex flex-col divide-y divide-slate-100" },
                      auditRow("קישורי הורה לשחקן שנמחק", orphanLinks.length, "warn"),
                      auditRow("קישורים למשתמש שכבר לא קיים", ghostLinks.length, "warn"),
                      auditRow("הזמנות פתוחות לשחקן שנמחק", staleInvites.length, "warn"),
                      auditRow("קישורים לכרטיס שחקן בארכיון", archivedLinks.length),
                      auditRow("שחקנים המשויכים לקבוצה שנמחקה", danglingGroup.length, "warn"),
                      auditRow("שחקנים פעילים ללא קבוצה", noGroup.length),
                      auditRow("קבוצות ללא מאמן", noCoach.length),
                    ),
                    fixable.length + staleInvites.length + danglingGroup.length > 0
                      ? e.createElement(
                          "button",
                          {
                            onClick: fixAudit,
                            disabled: auditBusy,
                            className:
                              "self-start text-xs font-semibold text-white bg-amber-500 rounded-lg px-3 py-2 disabled:opacity-50",
                          },
                          auditBusy ? "מנקה…" : "ניקוי אוטומטי",
                        )
                      : e.createElement(
                          "p",
                          { className: "text-[11px] text-emerald-700" },
                          "הכול מסונכרן — שמות המאמנים, ההרשאות והקישורים תואמים למצב במערכת.",
                        ),
                    badPhone.length || dupNames.length
                      ? e.createElement(
                          "p",
                          { className: "text-[11px] text-slate-500 leading-relaxed" },
                          badPhone.length
                            ? "ללא טלפון תקין: " +
                              badPhone.slice(0, 6).map((p) => p.name).join(", ") +
                              (badPhone.length > 6 ? " ועוד…" : "") +
                              ". "
                            : "",
                          dupNames.length ? "שמות כפולים: " + dupNames.slice(0, 6).join(", ") : "",
                        )
                      : null,
                  ),
          ),
        e.createElement(
          PCard,
          { title: "הודעות המועדון", icon: J },
          e.createElement(
            "button",
            {
              onClick: () => (setAnnEdit(null), setAnnForm(!0)),
              className: "self-start text-xs font-semibold text-white bg-emerald-500 rounded-lg px-3 py-2",
            },
            "+ הודעה חדשה",
          ),
          allAnns.length
            ? e.createElement(
                "div",
                { className: "flex flex-col divide-y divide-slate-100" },
                ...allAnns.map((a) => {
                  let now = new Date().toISOString(),
                    scheduled = a.publishAt && a.publishAt > now,
                    expired = a.expiresAt && a.expiresAt < now;
                  return e.createElement(
                    "div",
                    { key: a.id, className: "py-2.5 flex items-start justify-between gap-2" },
                    canEditAnn(a) &&
                      e.createElement(
                        "div",
                        { className: "flex items-center gap-1 shrink-0" },
                        e.createElement(
                          "button",
                          {
                            onClick: () => (setAnnEdit(a), setAnnForm(!0)),
                            "aria-label": "עריכת הודעה",
                            className: "w-8 h-8 flex items-center justify-center text-slate-400",
                          },
                          e.createElement($e, { className: "w-4 h-4" }),
                        ),
                        e.createElement(
                          "button",
                          {
                            onClick: () => removeAnn(a),
                            "aria-label": "מחיקת הודעה",
                            className: "w-8 h-8 flex items-center justify-center text-red-400",
                          },
                          e.createElement(Se, { className: "w-4 h-4" }),
                        ),
                      ),
                    e.createElement(
                      "div",
                      { className: "flex-1 min-w-0 text-right" },
                      e.createElement(
                        "p",
                        { className: "font-bold text-sm text-blue-950" },
                        a.urgent ? e.createElement("span", { className: "text-red-600" }, "דחוף · ") : null,
                        a.title,
                      ),
                      a.body &&
                        e.createElement(
                          "p",
                          { className: "text-xs text-slate-600 whitespace-pre-line mt-0.5" },
                          a.body.length > 160 ? a.body.slice(0, 160) + "…" : a.body,
                        ),
                      e.createElement(
                        "p",
                        { className: "text-[11px] text-slate-400 mt-1" },
                        fmtDateShort(localISO(new Date(a.publishAt || a.createdAt || Date.now()))),
                        a.authorName ? " · " + a.authorName : "",
                        scheduled ? " · מתוזמן" : "",
                        expired ? " · פג תוקף" : "",
                      ),
                    ),
                  );
                }),
              )
            : e.createElement("p", { className: "text-sm text-slate-500" }, "אין הודעות עדיין"),
        ),
        e.createElement(
          PCard,
          { title: "כל השחקנים", icon: H },
          e.createElement("input", {
            value: mgrQuery,
            onChange: (x) => setMgrQuery(x.target.value),
            placeholder: "חיפוש לפי שם שחקן או הורה",
            className:
              "border border-slate-200 rounded-lg py-2.5 px-3 text-sm text-right outline-none focus:border-emerald-400",
          }),
          shown.length
            ? e.createElement(
                "div",
                { className: "flex flex-col divide-y divide-slate-100" },
                ...shown.slice(0, 40).map((p) => {
                  let st = memberMonthStats(allAttendance || [], p.id),
                    entry = tttmForPlayer(p, tttm.players);
                  return e.createElement(
                    "div",
                    { key: p.id, className: "py-2 flex items-center justify-between gap-2" },
                    e.createElement(
                      "div",
                      { className: "text-left shrink-0 flex items-center gap-3" },
                      entry && entry.rank
                        ? e.createElement(
                            "span",
                            { className: "text-[11px] text-slate-500" },
                            "דירוג ",
                            entry.rank,
                          )
                        : null,
                      e.createElement(
                        "span",
                        {
                          className:
                            "text-sm font-bold " +
                            (st.pct === null ? "text-slate-300" : st.pct >= 70 ? "text-emerald-600" : "text-amber-600"),
                        },
                        st.pct === null ? "—" : st.pct + "%",
                      ),
                    ),
                    e.createElement(
                      "div",
                      { className: "flex-1 min-w-0 text-right" },
                      e.createElement("p", { className: "text-sm font-semibold text-blue-950 truncate" }, p.name),
                      e.createElement(
                        "p",
                        { className: "text-[11px] text-slate-500 truncate" },
                        groupName(p.groupId),
                        p.parentName ? " · " + p.parentName : "",
                      ),
                    ),
                  );
                }),
              )
            : e.createElement("p", { className: "text-sm text-slate-500" }, "לא נמצאו שחקנים"),
          shown.length > 40 &&
            e.createElement(
              "p",
              { className: "text-[11px] text-slate-400" },
              "מוצגים 40 מתוך " + shown.length + " — אפשר לחפש שם",
            ),
        ),
        e.createElement(
          PCard,
          { title: "הקבוצות", icon: le },
          e.createElement(
            "div",
            { className: "flex flex-col divide-y divide-slate-100" },
            ...groups.map((g) =>
              e.createElement(
                "div",
                { key: g.id, className: "py-2 flex items-center justify-between gap-2" },
                e.createElement(
                  "span",
                  { className: "text-xs text-slate-500 shrink-0" },
                  activePlayers.filter((p) => p.groupId === g.id).length,
                  " שחקנים",
                ),
                e.createElement(
                  "div",
                  { className: "flex-1 min-w-0 text-right" },
                  e.createElement("p", { className: "text-sm font-semibold text-blue-950 truncate" }, g.name),
                  e.createElement(
                    "p",
                    { className: "text-[11px] text-slate-500 truncate" },
                    [
                      groupDaysForPlayers(g, []).length
                        ? "ימים " + groupDaysForPlayers(g, []).map((d) => HEB_DAYS_FULL[d]).join(", ")
                        : "",
                      timeRange(g),
                      groupCoachLabelFor(g, users),
                    ]
                      .filter(Boolean)
                      .join(" · "),
                  ),
                ),
              ),
            ),
          ),
        ),
        Array.isArray(users) && users.length
          ? e.createElement(
              PCard,
              { title: "צוות המועדון", icon: Ie },
              e.createElement(
                "div",
                { className: "flex flex-col divide-y divide-slate-100" },
                ...users
                  .filter((u) => roleLabelHe(u) !== "הורה/שחקן")
                  .map((u) =>
                    e.createElement(
                      "div",
                      { key: u.id, className: "py-2 flex items-center justify-between gap-2" },
                      e.createElement("span", { className: "text-[11px] text-slate-500 shrink-0" }, roleLabelHe(u)),
                      e.createElement(
                        "div",
                        { className: "flex-1 min-w-0 text-right" },
                        e.createElement("p", { className: "text-sm font-semibold text-blue-950 truncate" }, u.name),
                        e.createElement(
                          "p",
                          { className: "text-[11px] text-slate-500 truncate" },
                          roleLabelHe(u) === "מנהל"
                            ? "גישה מלאה לכל הקבוצות"
                            : roleLabelHe(u) === "צופה"
                              ? "צפייה בלבד בכל הנתונים"
                              : groups
                                  .filter((g) => isGroupCoach(g, u.id))
                                  .map((g) => g.name)
                                  .join(", ") || "ללא קבוצות",
                        ),
                      ),
                    ),
                  ),
              ),
              e.createElement(
                "p",
                { className: "text-[11px] text-slate-400" },
                "שינוי תפקידים, שיוך מאמנים וקישור הורים — בתפריט של האפליקציה: ניהול הרשאות וגישת הורים.",
              ),
            )
          : null,
      );
    },
    screens = {
      home: homeScreen,
      personal: personalScreen,
      trainings: trainingsScreen,
      league: leagueScreen,
      more: moreScreen,
      manage: manageScreen,
    },
    tabs = [
      ["home", "בית", le],
      ["personal", "אישי", H],
      ["trainings", "אימונים", ge],
      ["league", "ליגה", TrophyIcon],
      ["more", "עוד", Pe],
      ...(isStaff ? [["manage", "ניהול", SettingsIcon]] : []),
    ],
    tabBar = e.createElement(
      "nav",
      {
        className:
          "fixed bottom-0 inset-x-0 mx-auto max-w-md z-30 bg-white border-t border-slate-200 flex justify-around px-1 pt-1.5 pb-[max(6px,env(safe-area-inset-bottom))]",
      },
      ...tabs.map(([key, label, Icon]) =>
        e.createElement(
          "button",
          {
            key: key,
            onClick: () => setTab(key),
            className:
              "flex flex-col items-center gap-0.5 min-w-[56px] py-1 text-[11px] " +
              (tab === key ? "text-blue-900 font-bold" : "text-slate-400"),
          },
          e.createElement(Icon, { className: "w-5 h-5" }),
          label,
        ),
      ),
    ),
    body = e.createElement(
      "div",
      { className: "p-4 pb-24 flex flex-col gap-3 min-h-[60vh]" },
      error && e.createElement("div", { className: "bg-red-50 text-red-700 rounded-xl p-3 text-xs" }, "שגיאה בטעינת הנתונים: ", error),
      (screens[tab === "manage" && !isStaff ? "home" : tab] || homeScreen)(),
    ),
    content = e.createElement(
      e.Fragment,
      null,
      body,
      tabBar,
      annForm &&
        e.createElement(AnnouncementForm, {
          author: profile,
          announcement: annEdit,
          onClose: () => (setAnnForm(!1), setAnnEdit(null)),
        }),
    );
  // בדיקת עקביות: נטענת כשמנהל נכנס ללשונית הניהול, ומרעננת אחרי ניקוי
  j(() => {
    if (!isAdmin || tab !== "manage" || !uid) return;
    let alive = !0;
    (async () => {
      try {
        let [ls, inv] = await Promise.all([fsGetDocs(M(P, "links")), fsGetDocs(M(P, "invites"))]);
        alive &&
          setAudit({
            links: ls.docs.map((d) => ({ id: d.id, ...d.data() })),
            invites: inv.docs.map((d) => ({ id: d.id, ...d.data() })),
          });
      } catch (err) {
        alive && setAudit({ error: err.message || String(err), links: [], invites: [] });
      }
    })();
    return () => {
      alive = !1;
    };
  }, [isAdmin, tab, uid || "", auditNonce]);
  if (embedded) return content;
  return e.createElement(
    "div",
    { dir: "rtl", className: "min-h-screen bg-slate-50" },
    e.createElement(
      "div",
      { className: "max-w-md mx-auto min-h-screen bg-slate-50 shadow-sm flex flex-col" },
      e.createElement(
        "header",
        { className: "sticky top-0 z-30 bg-blue-950 text-white px-4 py-3.5 flex items-center gap-3" },
        e.createElement("img", { src: "./logo.png", alt: "", className: "w-9 h-9 rounded-lg bg-white/95 p-0.5 shrink-0 order-last" }),
        e.createElement(
          "div",
          { className: "text-right flex-1 min-w-0" },
          e.createElement("div", { className: "text-sm font-bold leading-tight truncate" }, "פורטל המועדון"),
          e.createElement("div", { className: "text-[11px] text-blue-300 truncate" }, profile.name),
        ),
      ),
      e.createElement("div", { className: "flex-1 flex flex-col" }, content),
    ),
  );
}
function tttmTeams(t) {
  return Array.isArray(t.teams) ? t.teams : [];
}
function tttmMatches(t) {
  return Array.isArray(t.matches) ? t.matches : [];
}
function tttmTournaments(t) {
  return Array.isArray(t.tournaments) ? t.tournaments : [];
}
