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
} from "firebase/firestore";
import {
  onAuthStateChanged as Le,
  signInWithEmailAndPassword as Ue,
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
async function He(t, s) {
  let a = Be(B, "userCreator-" + Date.now());
  try {
    let l = Xe(a),
      i = await Me(l, t, s);
    return (await _e(l), i.user.uid);
  } finally {
    await Ge(a).catch(() => {});
  }
}
var X =
    "\u05DE\u05D5\u05E2\u05D3\u05D5\u05DF \u05D8\u05E0\u05D9\u05E1 \u05E9\u05D5\u05DC\u05D7\u05DF \u05DE\u05D1\u05D5\u05D0\u05D5\u05EA \u05D4\u05D7\u05E8\u05DE\u05D5\u05DF",
  W = '\u05E2"\u05E9 \u05E8\u05D5\u05E0\u05D9 \u05D2\u05DC\u05D1\u05D5\u05E2',
  E = () => new Date().toISOString().split("T")[0];
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
function Ve(t, s) {
  return `\u05E9\u05DC\u05D5\u05DD ${t}, \u05DB\u05D0\u05DF ${X} ${W}. \u05E9\u05DE\u05E0\u05D5 \u05DC\u05D1 \u05E9${s} \u05E0\u05E2\u05D3\u05E8 \u05DE\u05E9\u05E0\u05D9 \u05D4\u05D0\u05D9\u05DE\u05D5\u05E0\u05D9\u05DD \u05D4\u05D0\u05D7\u05E8\u05D5\u05E0\u05D9\u05DD. \u05E8\u05E6\u05D9\u05E0\u05D5 \u05DC\u05D3\u05E8\u05D5\u05E9 \u05D1\u05E9\u05DC\u05D5\u05DE\u05D5 \u05D5\u05DC\u05D5\u05D5\u05D3\u05D0 \u05E9\u05D4\u05DB\u05DC \u05D1\u05E1\u05D3\u05E8. \u05E0\u05E9\u05DE\u05D7 \u05DC\u05E2\u05D3\u05DB\u05D5\u05DF!`;
}
var We = [
    "\u05E8\u05D0\u05E9\u05D5\u05DF",
    "\u05E9\u05E0\u05D9",
    "\u05E9\u05DC\u05D9\u05E9\u05D9",
    "\u05E8\u05D1\u05D9\u05E2\u05D9",
    "\u05D7\u05DE\u05D9\u05E9\u05D9",
    "\u05E9\u05D9\u05E9\u05D9",
    "\u05E9\u05D1\u05EA",
  ],
  ie = ["\u05D0", "\u05D1", "\u05D2", "\u05D3", "\u05D4", "\u05D5", "\u05E9"];
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
      "\u05DC\u05D0 \u05D4\u05D5\u05D2\u05D3\u05E8\u05D5 \u05E9\u05E2\u05D5\u05EA"
    );
  let s = [...t.days]
      .sort((l, i) => l - i)
      .map((l) => ie[l])
      .join(", "),
    a = t.startTime && t.endTime ? ` ${t.startTime}-${t.endTime}` : "";
  return `${s}${a}`;
}
function L(t) {
  let [s, a] = b([]),
    [l, i] = b(!0);
  return (
    j(
      () =>
        ae(
          M(P, t),
          (n) => {
            (a(n.docs.map((m) => ({ id: m.id, ...m.data() }))), i(!1));
          },
          (n) => {
            (console.error(`Firestore listen error on ${t}:`, n), i(!1));
          },
        ),
      [t],
    ),
    { data: s, loading: l }
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
function Ze(t, s, a) {
  let l = new Set(a.filter((n) => n.groupId === s).map((n) => n.id)),
    i = t.filter((n) => n.groupId === s && l.has(n.playerId));
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
    (out.push(cur.toISOString().split("T")[0]), cur.setDate(cur.getDate() + 1));
  }
  return out;
}
function csvEscape(value) {
  let s = value === null || value === void 0 ? "" : String(value);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
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
      .filter((p) => p.isActive)
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
function ReportCoachFillRate({ groups, users, attendance }) {
  let [startDate, setStartDate] = b(firstOfMonthStr()),
    [endDate, setEndDate] = b(E()),
    allDates = eachDateInRange(startDate, endDate),
    rows = groups
      .map((g) => {
        let coach = users.find((u) => u.id === g.coachId),
          hasSchedule = Array.isArray(g.days) && g.days.length > 0,
          expectedDates = hasSchedule
            ? allDates.filter((d) => g.days.includes(new Date(d + "T00:00:00").getDay()))
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
          "תאריכים שלא מולאו",
        ],
        rowsData = rows.map((r) => [
          r.group.name,
          r.coach ? r.coach.name : "—",
          r.expected,
          r.filled,
          r.fillPct === null ? "—" : r.fillPct + "%",
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
function ReportDropoutRisk({ players, groups, attendance }) {
  let [startDate, setStartDate] = b(firstOfMonthStr()),
    [endDate, setEndDate] = b(E()),
    groupName = (groupId) => groups.find((g) => g.id === groupId)?.name || "—",
    atRisk = players
      .filter((p) => p.isActive)
      .map((p) => {
        let records = attendance
            .filter(
              (rec) =>
                rec.playerId === p.id && rec.date >= startDate && rec.date <= endDate,
            )
            .sort((a, c) => c.date.localeCompare(a.date)),
          lastTwo = records.slice(0, 2),
          flagged = lastTwo.length === 2 && lastTwo.every((r) => r.status === "Absent");
        return { player: p, lastDate: records[0]?.date || null, flagged };
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
                e.createElement(
                  "button",
                  {
                    onClick: () =>
                      window.open(
                        ne(x.player.parentPhone, Ve(x.player.parentName, x.player.name)),
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
                    `${groupName(x.player.groupId)} \xB7 ${x.player.parentName}`,
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
        let coach = users.find((u) => u.id === g.coachId),
          records = attendance.filter(
            (rec) =>
              rec.groupId === g.id && rec.date >= startDate && rec.date <= endDate,
          ),
          sessions = new Set(records.map((r) => r.date)).size,
          presentCount = records.filter((r) => r.status === "Present").length,
          pct = records.length > 0 ? Math.round((presentCount / records.length) * 100) : null,
          activePlayers = players.filter((p) => p.groupId === g.id && p.isActive).length;
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
function ReportsScreen({ groups, users, players, attendance }) {
  let [tab, setTab] = b("matrix"),
    tabs = [
      { key: "matrix", label: "נוכחות חודשית" },
      { key: "player", label: "דוח שחקן" },
      { key: "fillrate", label: "מילוי מאמנים" },
      { key: "risk", label: "בסיכון נשירה" },
      { key: "compare", label: "השוואת קבוצות" },
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
    tab === "fillrate" && e.createElement(ReportCoachFillRate, { groups, users, attendance }),
    tab === "risk" && e.createElement(ReportDropoutRisk, { players, groups, attendance }),
    tab === "compare" &&
      e.createElement(ReportGroupComparison, { groups, users, players, attendance }),
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
      "2 \u05D4\u05D9\u05E2\u05D3\u05E8\u05D5\u05D9\u05D5\u05EA",
    ),
    e.createElement(
      "button",
      {
        onClick: () => s(t),
        className:
          "w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center active:scale-95 transition-transform",
        "aria-label":
          "\u05E9\u05DC\u05D9\u05D7\u05EA \u05D4\u05D5\u05D3\u05E2\u05EA \u05D5\u05D5\u05D0\u05D8\u05E1\u05D0\u05E4 \u05DC\u05D4\u05D5\u05E8\u05D4",
      },
      e.createElement(te, { className: "w-4 h-4 text-white" }),
    ),
  );
}
var et = {
  "auth/invalid-email":
    "\u05DB\u05EA\u05D5\u05D1\u05EA \u05D0\u05D9\u05DE\u05D9\u05D9\u05DC \u05DC\u05D0 \u05EA\u05E7\u05D9\u05E0\u05D4",
  "auth/user-not-found":
    "\u05DC\u05D0 \u05E0\u05DE\u05E6\u05D0 \u05DE\u05E9\u05EA\u05DE\u05E9 \u05E2\u05DD \u05E4\u05E8\u05D8\u05D9\u05DD \u05D0\u05DC\u05D5",
  "auth/wrong-password":
    "\u05E1\u05D9\u05E1\u05DE\u05D4 \u05E9\u05D2\u05D5\u05D9\u05D4",
  "auth/invalid-credential":
    "\u05D0\u05D9\u05DE\u05D9\u05D9\u05DC \u05D0\u05D5 \u05E1\u05D9\u05E1\u05DE\u05D4 \u05E9\u05D2\u05D5\u05D9\u05D9\u05DD",
  "auth/too-many-requests":
    "\u05D9\u05D5\u05EA\u05E8 \u05DE\u05D3\u05D9 \u05E0\u05D9\u05E1\u05D9\u05D5\u05E0\u05D5\u05EA. \u05E0\u05E1\u05D4 \u05E9\u05D5\u05D1 \u05D1\u05E2\u05D5\u05D3 \u05DB\u05DE\u05D4 \u05D3\u05E7\u05D5\u05EA",
};
function tt() {
  let [t, s] = b(""),
    [a, l] = b(""),
    [i, c] = b(""),
    [n, m] = b(!1),
    o = async () => {
      (c(""), m(!0));
      try {
        await Ue(D, t.trim(), a);
      } catch (x) {
        c(
          et[x.code] ||
            "\u05E9\u05D2\u05D9\u05D0\u05D4 \u05D1\u05D4\u05EA\u05D7\u05D1\u05E8\u05D5\u05EA, \u05E0\u05E1\u05D4 \u05E9\u05D5\u05D1",
        );
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
      e.createElement(
        "div",
        {
          className:
            "w-16 h-16 rounded-2xl bg-emerald-500 mx-auto mb-4 flex items-center justify-center",
        },
        e.createElement(H, { className: "w-8 h-8 text-white" }),
      ),
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
        type: "email",
        placeholder: "\u05D0\u05D9\u05DE\u05D9\u05D9\u05DC",
        dir: "ltr",
        className:
          "w-full bg-white rounded-xl py-3.5 px-4 text-sm outline-none text-right",
      }),
      e.createElement("input", {
        value: a,
        onChange: (x) => l(x.target.value),
        type: "password",
        placeholder: "\u05E1\u05D9\u05E1\u05DE\u05D4",
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
      e.createElement(
        "button",
        {
          onClick: o,
          disabled: n || !t || !a,
          className:
            "bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-xl py-3.5 mt-1",
        },
        n
          ? "\u05DE\u05EA\u05D7\u05D1\u05E8\u2026"
          : "\u05D4\u05EA\u05D7\u05D1\u05E8\u05D5\u05EA",
      ),
      e.createElement(
        "p",
        { className: "text-blue-400 text-xs text-center mt-2" },
        '\u05D7\u05E9\u05D1\u05D5\u05E0\u05D5\u05EA \u05E0\u05D5\u05E6\u05E8\u05D9\u05DD \u05E2"\u05D9 \u05DE\u05E0\u05D4\u05DC \u05D4\u05DE\u05D5\u05E2\u05D3\u05D5\u05DF \u05D1\u05E7\u05D5\u05E0\u05E1\u05D5\u05DC\u05EA Firebase',
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
  currentUserId: c,
}) {
  let [n, m] = b(null),
    [o, x] = b(null),
    [h, u] = b(!1),
    f = a.filter((d) => d.isActive),
    { avgPct: g, sessions: r } = Je(l),
    y = () => {
      let d = E(),
        A = s
          .filter((I) => !l.some((p) => p.groupId === I.id && p.date === d))
          .map((I) => ({ group: I, coach: t.find((p) => p.id === I.coachId) }));
      x(A);
    },
    N = async (d, A) => {
      (u(!0),
        await V(M(P, "reminders"), {
          coachId: A.id,
          coachName: A.name,
          groupId: d.id,
          groupName: d.name,
          message: `\u05EA\u05D6\u05DB\u05D5\u05E8\u05EA \u05D9\u05D3\u05D9\u05D3\u05D5\u05EA\u05D9\u05EA \u05DC\u05DE\u05DC\u05D0 \u05E0\u05D5\u05DB\u05D7\u05D5\u05EA \u05E2\u05D1\u05D5\u05E8 \u05E7\u05D1\u05D5\u05E6\u05EA ${d.name} \u05DC\u05D4\u05D9\u05D5\u05DD. \u05EA\u05D5\u05D3\u05D4!`,
          createdAt: Oe(),
          processed: !1,
        }),
        u(!1));
    },
    C = async (d) => {
      await O(S(P, "players", d), { isActive: !1, endDate: E() });
    };
  return e.createElement(
    "div",
    { className: "px-4 pt-4 pb-6 flex flex-col gap-5" },
    e.createElement(
      "div",
      { className: "grid grid-cols-2 gap-3" },
      e.createElement(U, {
        icon: H,
        label:
          "\u05E9\u05D7\u05E7\u05E0\u05D9\u05DD \u05E4\u05E2\u05D9\u05DC\u05D9\u05DD",
        value: f.length,
        accent: "bg-blue-900",
      }),
      e.createElement(U, {
        icon: le,
        label: '\u05E1\u05D4"\u05DB \u05E7\u05D1\u05D5\u05E6\u05D5\u05EA',
        value: s.length,
        accent: "bg-blue-900",
      }),
      e.createElement(U, {
        icon: he,
        label:
          "\u05E0\u05D5\u05DB\u05D7\u05D5\u05EA \u05DE\u05DE\u05D5\u05E6\u05E2\u05EA \u05D4\u05D7\u05D5\u05D3\u05E9",
        value: g === null ? "\u2014" : `${g}%`,
        accent: "bg-emerald-500",
      }),
      e.createElement(U, {
        icon: ge,
        label:
          "\u05D0\u05D9\u05DE\u05D5\u05E0\u05D9\u05DD \u05E9\u05E0\u05E8\u05E9\u05DE\u05D5 \u05D4\u05D7\u05D5\u05D3\u05E9",
        value: r,
        accent: "bg-emerald-500",
      }),
    ),
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
        " \u05D4\u05D5\u05E1\u05E4\u05EA \u05E9\u05D7\u05E7\u05DF",
      ),
      e.createElement(
        "button",
        {
          onClick: y,
          className:
            "bg-blue-900 rounded-xl py-3.5 flex items-center justify-center gap-2 text-white font-semibold active:scale-[0.98] transition-transform",
        },
        e.createElement(J, { className: "w-4 h-4" }),
        " \u05EA\u05D6\u05DB\u05D5\u05E8\u05EA \u05DC\u05DE\u05D0\u05DE\u05E0\u05D9\u05DD",
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
            "\u05DE\u05D0\u05DE\u05E0\u05D9\u05DD \u05E9\u05D8\u05E8\u05DD \u05E8\u05E9\u05DE\u05D5 \u05E0\u05D5\u05DB\u05D7\u05D5\u05EA \u05D4\u05D9\u05D5\u05DD",
          ),
        ),
        o.length === 0
          ? e.createElement(
              "p",
              { className: "text-sm text-slate-500 text-center py-2" },
              "\u05DB\u05DC \u05D4\u05DE\u05D0\u05DE\u05E0\u05D9\u05DD \u05DB\u05D1\u05E8 \u05E8\u05E9\u05DE\u05D5 \u05E0\u05D5\u05DB\u05D7\u05D5\u05EA \u05D4\u05D9\u05D5\u05DD \u2705",
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
                      key: d.id,
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
                        " \xB7 \u05E9\u05D5\u05DC\u05D7 \u05D4\u05EA\u05E8\u05D0\u05EA Push",
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
        "\u05E7\u05D1\u05D5\u05E6\u05D5\u05EA",
      ),
      s.map((d) => {
        let A = t.find((k) => k.id === d.coachId),
          I = Ze(l, d.id, a),
          p = n === d.id,
          w = a.filter((k) => k.groupId === d.id && k.isActive);
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
              onClick: () => m(p ? null : d.id),
              className: "w-full px-4 py-3.5 flex items-center justify-between",
            },
            p
              ? e.createElement(ke, { className: "w-4 h-4 text-slate-400" })
              : e.createElement(we, { className: "w-4 h-4 text-slate-400" }),
            e.createElement(
              "div",
              { className: "text-right flex-1 mr-3" },
              e.createElement(
                "div",
                { className: "font-semibold text-blue-950" },
                d.name,
              ),
              e.createElement(
                "div",
                { className: "text-xs text-slate-500" },
                A?.name || "\u2014",
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
                I === null ? "\u2014" : `${I}%`,
              ),
              e.createElement(
                "div",
                { className: "text-[10px] text-slate-400" },
                "\u05E0\u05D5\u05DB\u05D7\u05D5\u05EA",
              ),
            ),
          ),
          p &&
            e.createElement(
              "div",
              { className: "border-t border-slate-100 p-3 bg-slate-50" },
              e.createElement(re, {
                group: d,
                profile: { id: c },
                players: a,
                attendance: l,
                onArchivePlayer: C,
              }),
            ),
        );
      }),
    ),
  );
}
function lt({ players: t, groups: s }) {
  let [a, l] = b(""),
    c = t
      .filter((m) => m.isActive)
      .filter((m) => m.name.includes(a) || m.parentName.includes(a)),
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
          "\u05D7\u05D9\u05E4\u05D5\u05E9 \u05DC\u05E4\u05D9 \u05E9\u05DD \u05E9\u05D7\u05E7\u05DF \u05D0\u05D5 \u05D4\u05D5\u05E8\u05D4",
        className:
          "w-full bg-white border border-slate-200 rounded-xl py-3 pr-9 pl-3 text-sm text-right outline-none focus:border-emerald-400",
      }),
    ),
    n.length === 0 &&
      e.createElement(
        "p",
        { className: "text-center text-sm text-slate-400 py-8" },
        "\u05DC\u05D0 \u05E0\u05DE\u05E6\u05D0\u05D5 \u05EA\u05D5\u05E6\u05D0\u05D5\u05EA",
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
                e.createElement(
                  "a",
                  {
                    href: ne(x.parentPhone, ""),
                    target: "_blank",
                    rel: "noreferrer",
                    className:
                      "w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center",
                    "aria-label": "\u05D5\u05D5\u05D0\u05D8\u05E1\u05D0\u05E4",
                  },
                  e.createElement(te, {
                    className: "w-4 h-4 text-emerald-600",
                  }),
                ),
                e.createElement(
                  "a",
                  {
                    href: `tel:+${x.parentPhone}`,
                    className:
                      "w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center",
                    "aria-label": "\u05D7\u05D9\u05D9\u05D2",
                  },
                  e.createElement(se, { className: "w-4 h-4 text-blue-900" }),
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
                  x.parentName,
                  " \xB7 ",
                  x.parentPhone,
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}
function at({ groups: t, onClose: s }) {
  let [a, l] = b(""),
    [i, c] = b(t[0]?.id || ""),
    [n, m] = b(""),
    [o, x] = b(""),
    [h, u] = b(!1),
    f = a.trim() && i && n.trim() && o.trim(),
    g = async () => {
      (u(!0),
        await V(M(P, "players"), {
          name: a.trim(),
          groupId: i,
          parentName: n.trim(),
          parentPhone: o.trim(),
          joinDate: E(),
          endDate: null,
          isActive: !0,
        }),
        u(!1),
        s());
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
        onClick: (r) => r.stopPropagation(),
        className:
          "bg-white w-full max-w-md rounded-t-2xl p-5 flex flex-col gap-3.5",
      },
      e.createElement(
        "div",
        { className: "flex items-center justify-between" },
        e.createElement(
          "button",
          { onClick: s, className: "text-slate-400" },
          e.createElement(T, { className: "w-5 h-5" }),
        ),
        e.createElement(
          "h3",
          { className: "font-bold text-blue-950" },
          "\u05D4\u05D5\u05E1\u05E4\u05EA \u05E9\u05D7\u05E7\u05DF",
        ),
      ),
      e.createElement(
        "div",
        { className: "flex flex-col gap-1" },
        e.createElement(
