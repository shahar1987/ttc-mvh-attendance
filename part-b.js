function nt({ group: t, users: s, onClose: a, isAdmin: IA }) {
  let l = s.filter((v) => v.role === "Coach"),
    [i, c] = b(t?.name || ""),
    [n, m] = b(t?.location || ""),
    [o, x] = b(t?.days || []),
    [h, u] = b(t?.startTime || ""),
    [f, g] = b(t?.endTime || ""),
    r = t && !Y(t) ? t.schedule : "",
    y = (v) => {
      x(($) =>
        $.includes(v)
          ? $.filter((_) => _ !== v)
          : [...$, v].sort((_, oe) => _ - oe),
      );
    },
    [N, C] = b(groupCoachIds(t)),
    [AG, setAG] = b(isAdultGroup(t)),
    toggleCoach = (v) =>
      C(($) => ($.includes(v) ? $.filter((_) => _ !== v) : [...$, v])),
    [d, A] = b(!1),
    [I, p] = b(""),
    w = !!i.trim(),
    k = async () => {
      (A(!0), p(""));
      try {
        let v = {
          name: i.trim(),
          location: n.trim(),
          days: o,
          startTime: h.trim(),
          endTime: f.trim(),
          coachIds: N,
          coachId: N[0] || "",
          isAdultGroup: AG,
        };
        (t ? await O(S(P, "groups", t.id), v) : await V(M(P, "groups"), v),
          a());
      } catch (v) {
        p(
          "שמירה נכשלה: " +
            v.message,
        );
      } finally {
        A(!1);
      }
    };
  return e.createElement(
    "div",
    {
      className: "fixed inset-0 bg-black/40 flex items-end justify-center z-50",
      onClick: a,
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
          { onClick: a, className: "text-slate-400" },
          e.createElement(T, { className: "w-5 h-5" }),
        ),
        e.createElement(
          "h3",
          { className: "font-bold text-blue-950" },
          t
            ? "עריכת קבוצה"
            : "הוספת קבוצה",
        ),
      ),
      e.createElement(
        "div",
        { className: "flex flex-col gap-1" },
        e.createElement(
          "label",
          { className: "text-xs text-slate-500" },
          "שם הקבוצה",
        ),
        e.createElement("input", {
          value: i,
          onChange: (v) => c(v.target.value),
          placeholder:
            "לדוגמה: נוער מתקדמים",
          className:
            "border border-slate-200 rounded-lg py-2.5 px-3 text-right text-sm outline-none focus:border-emerald-400",
        }),
      ),
      e.createElement(
        "div",
        { className: "flex flex-col gap-1" },
        e.createElement(
          "label",
          { className: "text-xs text-slate-500" },
          "מיקום",
        ),
        e.createElement("input", {
          value: n,
          onChange: (v) => m(v.target.value),
          placeholder:
            "לדוגמה: רמת כורזים",
          className:
            "border border-slate-200 rounded-lg py-2.5 px-3 text-right text-sm outline-none focus:border-emerald-400",
        }),
      ),
      e.createElement(
        "div",
        { className: "flex flex-col gap-1.5" },
        e.createElement(
          "label",
          { className: "text-xs text-slate-500" },
          "ימי אימון",
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
                onClick: () => y($),
                className: `w-10 h-10 rounded-lg text-sm font-semibold border transition-colors ${o.includes($) ? "bg-blue-900 text-white border-blue-900" : "bg-white text-slate-500 border-slate-200"}`,
                "aria-label": v,
              },
              ie[$],
            ),
          ),
        ),
        r &&
          e.createElement(
            "p",
            {
              className:
                "text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 leading-relaxed",
            },
            'היה רשום כאן: "',
            r,
            '" — סמן את הימים והשעות וזה יוחלף.',
          ),
      ),
      e.createElement(
        "div",
        { className: "grid grid-cols-2 gap-2" },
        e.createElement(
          "div",
          { className: "flex flex-col gap-1" },
          e.createElement(
            "label",
            { className: "text-xs text-slate-500" },
            "שעת התחלה",
          ),
          e.createElement("input", {
            type: "time",
            value: h,
            onChange: (v) => u(v.target.value),
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
            "שעת סיום",
          ),
          e.createElement("input", {
            type: "time",
            value: f,
            onChange: (v) => g(v.target.value),
            dir: "ltr",
            className:
              "border border-slate-200 rounded-lg py-2.5 px-3 text-sm outline-none focus:border-emerald-400",
          }),
        ),
      ),
      e.createElement(
        "div",
        { className: "flex flex-col gap-1.5" },
        e.createElement(
          "label",
          { className: "text-xs text-slate-500" },
          "סוג הקבוצה",
        ),
        e.createElement(
          "div",
          { className: "flex gap-1.5 justify-end" },
          [
            { v: !1, label: "ילדים ונוער" },
            { v: !0, label: "מבוגרים" },
          ].map((op) =>
            e.createElement(
              "button",
              {
                key: String(op.v),
                type: "button",
                onClick: () => setAG(op.v),
                className: `min-h-[40px] px-3 rounded-lg text-sm font-semibold border transition-colors ${AG === op.v ? "bg-blue-900 text-white border-blue-900" : "bg-white text-slate-500 border-slate-200"}`,
              },
              op.label,
            ),
          ),
        ),
        e.createElement(
          "p",
          { className: "text-[11px] text-slate-400 leading-relaxed" },
          AG
            ? "הודעות על היעדרות יישלחו לשחקן עצמו, בפנייה ישירה."
            : "הודעות על היעדרות יישלחו להורה.",
        ),
      ),
      IA &&
      e.createElement(
        "div",
        { className: "flex flex-col gap-1" },
        e.createElement(
          "label",
          { className: "text-xs text-slate-500" },
          "מאמנים אחראים (אפשר לבחור כמה)",
        ),
        e.createElement(
          "div",
          { className: "flex flex-wrap gap-1.5 justify-end" },
          l.map((v) =>
            e.createElement(
              "button",
              {
                key: v.id,
                onClick: () => toggleCoach(v.id),
                className: `px-2.5 py-2 rounded-lg text-xs font-medium border transition-colors ${N.includes(v.id) ? "bg-blue-900 text-white border-blue-900" : "bg-white text-slate-500 border-slate-200"}`,
              },
              v.name,
            ),
          ),
        ),
        l.length === 0 &&
          e.createElement(
            "p",
            { className: "text-[11px] text-slate-400" },
            "אפשר ליצור את הקבוצה עכשיו ולשייך מאמן בהמשך במסך ההרשאות.",
          ),
      ),
      I && e.createElement("p", { className: "text-xs text-red-600" }, I),
      e.createElement(
        "button",
        {
          disabled: !w || d,
          onClick: k,
          className:
            "mt-1 bg-emerald-500 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold rounded-xl py-3.5",
        },
        d ? "שומר…" : "שמירה",
      ),
    ),
  );
}
function it({ groups: t, users: s, players: a }) {
  let [l, i] = b(null),
    [c, n] = b(""),
    [reassign, setReassign] = b({}),
    [busyReassign, setBusyReassign] = b(null),
    unassigned = a.filter(
      (p) =>
        p.isActive &&
        !p.deleted &&
        (!p.groupId || !t.some((g) => g.id === p.groupId)),
    ),
    doReassign = async (p) => {
      let target = reassign[p.id];
      if (!target) return;
      setBusyReassign(p.id);
      try {
        await O(S(P, "players", p.id), { groupId: target });
      } catch (h) {
        n("שיבוץ נכשל: " + h.message);
      } finally {
        setBusyReassign(null);
      }
    },
    m = async (o) => {
      let x = a.filter((h) => h.groupId === o.id && h.isActive && !h.deleted);
      if (
        !window.confirm(
          x.length > 0
            ? `למחוק את הקבוצה "${o.name}"? ${x.length} השחקנים הפעילים בה יועברו למאגר "שחקנים ללא קבוצה" ותוכל לשבץ אותם מחדש. הפעולה אינה הפיכה.`
            : `למחוק את הקבוצה "${o.name}"? הפעולה אינה הפיכה.`,
        )
      )
        return;
      n("");
      try {
        if (x.length > 0) {
          let batch = Te(P);
          x.forEach((p) =>
            batch.update(S(P, "players", p.id), { groupId: null }),
          );
          await batch.commit();
        }
        await Ee(S(P, "groups", o.id));
      } catch (h) {
        n(
          "מחיקה נכשלה: " +
            h.message,
        );
      }
    };
  return e.createElement(
    "div",
    { className: "px-4 pt-4 pb-6 flex flex-col gap-4" },
    e.createElement(
      "button",
      {
        onClick: () => i("new"),
        className:
          "bg-emerald-500 rounded-xl py-3.5 flex items-center justify-center gap-2 text-white font-semibold active:scale-[0.98] transition-transform",
      },
      e.createElement(K, { className: "w-4 h-4" }),
      " הוספת קבוצה",
    ),
    c &&
      e.createElement(
        "div",
        {
          className:
            "bg-red-50 border border-red-200 rounded-xl p-3 flex items-start justify-between gap-2",
        },
        e.createElement(
          "button",
          { onClick: () => n(""), className: "text-red-400 shrink-0" },
          e.createElement(T, { className: "w-4 h-4" }),
        ),
        e.createElement(
          "p",
          { className: "text-xs text-red-700 text-right leading-relaxed" },
          c,
        ),
      ),
    t.length === 0 &&
      e.createElement(
        "p",
        { className: "text-center text-sm text-slate-400 py-8" },
        'אין עדיין קבוצות. לחץ "הוספת קבוצה" כדי להתחיל.',
      ),
    unassigned.length > 0 &&
      e.createElement(
        "div",
        {
          className:
            "bg-amber-50 border-2 border-amber-300 rounded-xl p-3 flex flex-col gap-2.5",
        },
        e.createElement(
          "div",
          { className: "text-sm font-bold text-amber-900 text-right" },
          "שחקנים ללא קבוצה \xB7 " + unassigned.length,
        ),
        unassigned.map((p) =>
          e.createElement(
            "div",
            {
              key: p.id,
              className:
                "bg-white rounded-lg border border-amber-200 p-2.5 flex items-center gap-2",
            },
            e.createElement(
              "div",
              { className: "text-sm font-medium text-blue-950 flex-1 text-right truncate" },
              p.name,
            ),
            e.createElement(
              "select",
              {
                value: reassign[p.id] || "",
                onChange: (v) =>
                  setReassign((k) => ({ ...k, [p.id]: v.target.value })),
                className:
                  "border border-slate-200 rounded-lg py-2 px-2 text-xs outline-none bg-white min-h-[38px]",
              },
              e.createElement(
                "option",
                { value: "" },
                "בחר קבוצה",
              ),
              t.map((g) =>
                e.createElement("option", { key: g.id, value: g.id }, g.name),
              ),
            ),
            e.createElement(
              "button",
              {
                disabled: !reassign[p.id] || busyReassign === p.id,
                onClick: () => doReassign(p),
                className:
                  "bg-emerald-500 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold rounded-lg px-3 min-h-[38px] shrink-0",
              },
              "שיבוץ",
            ),
          ),
        ),
      ),
    e.createElement(
      "div",
      { className: "flex flex-col gap-2.5" },
      t.map((o) => {
        let x = groupCoachLabel(o, s),
          h = a.filter((u) => u.groupId === o.id && u.isActive && !u.deleted).length;
        return e.createElement(
          "div",
          {
            key: o.id,
            className:
              "bg-white rounded-xl border border-slate-200 px-4 py-3.5 flex items-center gap-2",
          },
          e.createElement(
            "div",
            { className: "flex items-center gap-1 shrink-0" },
            e.createElement(
              "button",
              {
                onClick: () => m(o),
                className:
                  "w-8 h-8 rounded-full bg-red-50 flex items-center justify-center",
                "aria-label": "מחיקה",
              },
              e.createElement(Se, { className: "w-4 h-4 text-red-500" }),
            ),
            e.createElement(
              "button",
              {
                onClick: () => i(o),
                className:
                  "w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center",
                "aria-label": "עריכה",
              },
              e.createElement($e, { className: "w-4 h-4 text-blue-900" }),
            ),
          ),
          e.createElement(
            "div",
            { className: "flex-1 text-right" },
            e.createElement(
              "div",
              { className: "font-semibold text-blue-950" },
              o.name,
            ),
            e.createElement(
              "div",
              { className: "text-xs text-slate-500" },
              x ? x.name : "ללא מאמן",
              o.location ? ` \xB7 ${o.location}` : "",
            ),
            e.createElement(
              "div",
              { className: "text-xs text-slate-400" },
              q(o),
              " \xB7 ",
              h,
              " שחקנים",
            ),
          ),
        );
      }),
    ),
    l &&
      e.createElement(nt, {
        group: l === "new" ? null : l,
        users: s,
        isAdmin: !0,
        onClose: () => i(null),
      }),
  );
}
function rt({ onClose: t, users: US }) {
  let [s, a] = b(""),
    [l, i] = b(""),
    [c, n] = b(""),
    [m, o] = b(""),
    [x, h] = b("Coach"),
    [u, f] = b(!1),
    [g, r] = b(""),
    y = s.trim() && l.trim() && c.length >= 6,
    N = {
      "auth/email-already-in-use":
        "כתובת האימייל כבר רשומה במערכת",
      "auth/invalid-email":
        "כתובת אימייל לא תקינה",
      "auth/weak-password":
        "הסיסמה חלשה מדי — נדרשים לפחות 6 תווים",
      "auth/operation-not-allowed":
        "התחברות עם אימייל וסיסמה אינה מופעלת בפרויקט",
    };
  return e.createElement(
    "div",
    {
      className: "fixed inset-0 bg-black/40 flex items-end justify-center z-50",
      onClick: t,
    },
    e.createElement(
      "div",
      {
        dir: "rtl",
        onClick: (d) => d.stopPropagation(),
        className:
          "bg-white w-full max-w-md rounded-t-2xl p-5 flex flex-col gap-3.5 max-h-[90vh] overflow-y-auto",
      },
      e.createElement(
        "div",
        { className: "flex items-center justify-between" },
        e.createElement(
          "button",
          { onClick: t, className: "text-slate-400" },
          e.createElement(T, { className: "w-5 h-5" }),
        ),
        e.createElement(
          "h3",
          { className: "font-bold text-blue-950" },
          "הוספת משתמש",
        ),
      ),
      e.createElement(
        "div",
        { className: "flex flex-col gap-1" },
        e.createElement(
          "label",
          { className: "text-xs text-slate-500" },
          "שם מלא",
        ),
        e.createElement("input", {
          value: s,
          onChange: (d) => a(d.target.value),
          className:
            "border border-slate-200 rounded-lg py-2.5 px-3 text-right text-sm outline-none focus:border-emerald-400",
        }),
      ),
      e.createElement(
        "div",
        { className: "flex flex-col gap-1" },
        e.createElement(
          "label",
          { className: "text-xs text-slate-500" },
          "אימייל (שם המשתמש לכניסה)",
        ),
        e.createElement("input", {
          value: l,
          onChange: (d) => i(d.target.value),
          type: "email",
          dir: "ltr",
          className:
            "border border-slate-200 rounded-lg py-2.5 px-3 text-right text-sm outline-none focus:border-emerald-400",
        }),
      ),
      e.createElement(
        "div",
        { className: "flex flex-col gap-1" },
        e.createElement(
          "label",
          { className: "text-xs text-slate-500" },
          "סיסמה ראשונית (לפחות 6 תווים)",
        ),
        e.createElement("input", {
          value: c,
          onChange: (d) => n(d.target.value),
          type: "text",
          dir: "ltr",
          className:
            "border border-slate-200 rounded-lg py-2.5 px-3 text-right text-sm outline-none focus:border-emerald-400",
        }),
        e.createElement(
          "p",
          { className: "text-[11px] text-slate-400" },
          "מסור אותה למשתמש והמלץ לו להחליף אותה. אם המשתמש נמחק בעבר ואתה מוסיף אותו שוב עם אותו אימייל — הזן את הסיסמה הנוכחית שלו.",
        ),
      ),
      e.createElement(
        "div",
        { className: "flex flex-col gap-1" },
        e.createElement(
          "label",
          { className: "text-xs text-slate-500" },
          "טלפון (בפורמט 9725XXXXXXXX)",
        ),
        e.createElement("input", {
          value: m,
          onChange: (d) => o(d.target.value),
          dir: "ltr",
          className:
            "border border-slate-200 rounded-lg py-2.5 px-3 text-right text-sm outline-none focus:border-emerald-400",
        }),
      ),
      e.createElement(
        "div",
        { className: "flex flex-col gap-1" },
        e.createElement(
          "label",
          { className: "text-xs text-slate-500" },
          "הרשאה",
        ),
        e.createElement(
          "select",
          {
            value: x,
            onChange: (d) => h(d.target.value),
            className:
              "border border-slate-200 rounded-lg py-2.5 px-3 text-right text-sm outline-none focus:border-emerald-400 bg-white",
          },
          e.createElement(
            "option",
            { value: "Coach" },
            "מאמן — רק הקבוצות שישויכו אליו",
          ),
          e.createElement(
            "option",
            { value: "Admin" },
            "מנהל — גישה מלאה",
          ),
        ),
      ),
      g &&
        e.createElement(
          "p",
          { className: "text-xs text-red-600 leading-relaxed" },
          g,
        ),
      e.createElement(
        "button",
        {
          disabled: !y || u,
          onClick: async () => {
            (f(!0), r(""));
            try {
              let { uid: d, recovered: RC } = await He(l.trim(), c);
              if (RC && (US || []).some((v) => v.id === d)) {
                r("המשתמש הזה כבר קיים ברשימת המשתמשים למעלה.");
                return;
              }
              (await De(S(P, "users", d), {
                name: s.trim(),
                role: x,
                phone: m.trim(),
                email: l.trim().toLowerCase(),
              }),
                t());
            } catch (d) {
              r(
                d.code === "auth/wrong-password" ||
                  d.code === "auth/invalid-credential" ||
                  d.code === "auth/invalid-login-credentials"
                  ? "לכתובת הזו כבר קיים חשבון התחברות (גם אם מחקת את המשתמש מהרשימה). כדי לשחזר אותו הזן את הסיסמה הנוכחית של אותו חשבון, או בחר כתובת אימייל אחרת."
                  : N[d.code] ||
                      "יצירת המשתמש נכשלה: " +
                        d.message,
              );
            } finally {
              f(!1);
            }
          },
          className:
            "mt-1 bg-emerald-500 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold rounded-xl py-3.5",
        },
        u
          ? "יוצר משתמש…"
          : "יצירת משתמש",
      ),
    ),
  );
}
function EditUserModal({ user: t, onClose: s }) {
  let [n, setN] = b(t.name || ""),
    [p, setP] = b(t.phone || ""),
    [sv, setSv] = b(!1),
    [er, setEr] = b(""),
    save = async () => {
      if (!n.trim()) return;
      (setSv(!0), setEr(""));
      try {
        (await O(S(P, "users", t.id), { name: n.trim(), phone: p.trim() }), s());
      } catch (v) {
        setEr("השמירה נכשלה: " + v.message);
      } finally {
        setSv(!1);
      }
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
          "עריכת משתמש",
        ),
      ),
      e.createElement(
        "div",
        { className: "flex flex-col gap-1" },
        e.createElement(
          "label",
          { className: "text-xs text-slate-500" },
          "שם מלא",
        ),
        e.createElement("input", {
          value: n,
          onChange: (v) => setN(v.target.value),
          className:
            "border border-slate-200 rounded-lg py-2.5 px-3 text-right text-sm outline-none focus:border-emerald-400 min-h-[44px]",
        }),
      ),
      e.createElement(
        "div",
        { className: "flex flex-col gap-1" },
        e.createElement(
          "label",
          { className: "text-xs text-slate-500" },
          "טלפון",
        ),
        e.createElement("input", {
          value: p,
          onChange: (v) => setP(v.target.value),
          dir: "ltr",
          className:
            "border border-slate-200 rounded-lg py-2.5 px-3 text-right text-sm outline-none focus:border-emerald-400 min-h-[44px]",
        }),
      ),
      e.createElement(
        "p",
        { className: "text-[11px] text-slate-400 text-right leading-relaxed" },
        t.email
          ? `אימייל להתחברות: ${t.email}. לא ניתן לשנות כתובת אימייל או סיסמה מהאפליקציה.`
          : "לא ניתן לשנות כתובת אימייל או סיסמה מהאפליקציה. את ההרשאה אפשר לשנות ברשימה עצמה.",
      ),
      er &&
        e.createElement(
          "p",
          { className: "text-xs text-red-600 text-right" },
          er,
        ),
      e.createElement(
        "button",
        {
          disabled: !n.trim() || sv,
          onClick: save,
          className:
            "mt-1 bg-emerald-500 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold rounded-xl py-3.5 min-h-[44px]",
        },
        sv ? "שומר…" : "שמירה",
      ),
    ),
  );
}
function ot({ users: t, groups: s, currentUserId: a }) {
  let [l, i] = b(""),
    [c, n] = b(null),
    [m, o] = b(!1),
    [editUser, setEditUser] = b(null),
    [assigningGroupId, setAssigningGroupId] = b(null),
    toggleGroupCoach = async (grp, coachId) => {
      (setAssigningGroupId(grp.id), i(""));
      try {
        let cur = groupCoachIds(grp),
          next = cur.includes(coachId)
            ? cur.filter((v) => v !== coachId)
            : [...cur, coachId];
        await O(S(P, "groups", grp.id), {
          coachIds: next,
          coachId: next[0] || "",
        });
      } catch (err) {
        i("עדכון נכשל: " + err.message);
      } finally {
        setAssigningGroupId(null);
      }
    },
    [deletingCoachId, setDeletingCoachId] = b(null),
    handleDeleteCoach = async (u) => {
      if (
        !window.confirm(
          `למחוק את המאמן "${u.name}"? הוא ינותק מכל הקבוצות שלו וחשבונו יוסר מהמערכת. הפעולה אינה הפיכה.`,
        )
      )
        return;
      (setDeletingCoachId(u.id), i(""));
      try {
        let batch = Te(P);
        s.filter((grp) => isGroupCoach(grp, u.id)).forEach((grp) => {
          let rest = groupCoachIds(grp).filter((v) => v !== u.id);
          batch.update(S(P, "groups", grp.id), {
            coachIds: rest,
            coachId: rest[0] || "",
          });
        });
        (batch.delete(S(P, "users", u.id)), await batch.commit());
      } catch (err) {
        i(
          "המחיקה נכשלה: " +
            err.message,
        );
      } finally {
        setDeletingCoachId(null);
      }
    },
    x = async (u, f) => {
      if (u.id === a && f !== "Admin") {
        i(
          "אי אפשר להוריד לעצמך את הרשאת המנהל — אחרת תיחסם מהמערכת.",
        );
        return;
      }
      (n(u.id), i(""));
      try {
        await O(S(P, "users", u.id), { role: f });
      } catch (g) {
        i(
          "עדכון נכשל: " +
            g.message,
        );
      } finally {
        n(null);
      }
    },
    h = t.filter((u) => u.role === "Admin");
  return e.createElement(
    "div",
    { className: "px-4 pt-4 pb-6 flex flex-col gap-4" },
    e.createElement(
      "button",
      {
        onClick: () => o(!0),
        className:
          "bg-emerald-500 rounded-xl py-3.5 flex items-center justify-center gap-2 text-white font-semibold active:scale-[0.98] transition-transform",
      },
      e.createElement(K, { className: "w-4 h-4" }),
      " הוספת משתמש",
    ),
    l &&
      e.createElement(
        "div",
        {
          className:
            "bg-red-50 border border-red-200 rounded-xl p-3 flex items-start justify-between gap-2",
        },
        e.createElement(
          "button",
          { onClick: () => i(""), className: "text-red-400 shrink-0" },
          e.createElement(T, { className: "w-4 h-4" }),
        ),
        e.createElement(
          "p",
          { className: "text-xs text-red-700 text-right leading-relaxed" },
          l,
        ),
      ),
    e.createElement(
      "div",
      { className: "flex flex-col gap-2" },
      e.createElement(
        "h3",
        { className: "text-sm font-semibold text-slate-500 px-1" },
        "משתמשים ותפקידים",
      ),
      e.createElement(
        "div",
        {
          className:
            "bg-white rounded-xl border border-slate-200 divide-y divide-slate-100",
        },
        t.map((u) => {
          let f = s.filter((r) => isGroupCoach(r, u.id)),
            g = u.role === "Admin" && h.length === 1;
          return e.createElement(
            "div",
            {
              key: u.id,
              className: "px-4 py-3 flex items-center justify-between gap-2",
            },
            e.createElement(
              "select",
              {
                value: u.role || "Coach",
                disabled: c === u.id || g,
                onChange: (r) => x(u, r.target.value),
                className:
                  "border border-slate-200 rounded-lg py-1.5 px-2 text-xs bg-white outline-none disabled:bg-slate-50 disabled:text-slate-400",
              },
              e.createElement(
                "option",
                { value: "Admin" },
                "מנהל",
              ),
              e.createElement(
                "option",
                { value: "Coach" },
                "מאמן",
              ),
            ),
            e.createElement(
              "div",
              { className: "flex-1 text-right" },
              e.createElement(
                "div",
                { className: "text-sm font-medium text-blue-950" },
                u.name,
                u.id === a ? " (אתה)" : "",
              ),
              e.createElement(
                "div",
                { className: "text-xs text-slate-400" },
                u.role === "Admin"
                  ? "גישה מלאה לכל הקבוצות"
                  : f.length > 0
                    ? f.map((r) => r.name).join(", ")
                    : "לא שויכה קבוצה",
              ),
            ),
            e.createElement(
              "button",
              {
                onClick: () => setEditUser(u),
                className:
                  "w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0",
                "aria-label": "עריכת משתמש",
              },
              e.createElement($e, { className: "w-4 h-4 text-blue-900" }),
            ),
            u.role === "Coach" &&
              e.createElement(
                "button",
                {
                  onClick: () => handleDeleteCoach(u),
                  disabled: deletingCoachId === u.id,
                  className:
                    "w-8 h-8 rounded-full bg-red-50 flex items-center justify-center shrink-0 disabled:opacity-50",
                  "aria-label": "מחיקת מאמן",
                },
                e.createElement(Se, { className: "w-4 h-4 text-red-500" }),
              ),
          );
        }),
        t.length === 0 &&
          e.createElement(
            "p",
            { className: "text-center text-xs text-slate-400 py-4" },
            "אין משתמשים",
          ),
      ),
    ),
    e.createElement(
      "div",
      { className: "flex flex-col gap-2" },
      e.createElement(
        "h3",
        { className: "text-sm font-semibold text-slate-500 px-1" },
        "שיוך מאמנים לקבוצות",
      ),
      e.createElement(
        "div",
        {
          className:
            "bg-white rounded-xl border border-slate-200 divide-y divide-slate-100",
        },
        s.map((u) => {
          let staff = t.filter((f) => f.role === "Coach" || f.role === "Admin"),
            assigned = groupCoachNames(u, t);
          return e.createElement(
            "div",
            { key: u.id, className: "px-4 py-3 flex flex-col gap-2" },
            e.createElement(
              "div",
              { className: "text-sm font-medium text-blue-950 text-right" },
              u.name,
            ),
            staff.length === 0
              ? e.createElement(
                  "p",
                  { className: "text-xs text-slate-400 text-right" },
                  "אין עדיין משתמשים לשיוך",
                )
              : e.createElement(
                  "div",
                  { className: "flex flex-wrap gap-1.5 justify-end" },
                  staff.map((f) =>
                    e.createElement(
                      "button",
                      {
                        key: f.id,
                        disabled: assigningGroupId === u.id,
                        onClick: () => toggleGroupCoach(u, f.id),
                        className: `px-2.5 py-2 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 ${isGroupCoach(u, f.id) ? "bg-blue-900 text-white border-blue-900" : "bg-white text-slate-500 border-slate-200"}`,
                      },
                      f.name,
                    ),
                  ),
                ),
            e.createElement(
              "div",
              { className: "text-[11px] text-slate-400 text-right" },
              assigned.length > 0
                ? "משויכים: " + assigned.join(", ")
                : "לא שויך מאמן",
            ),
          );
        }),
        s.length === 0 &&
          e.createElement(
            "p",
            { className: "text-center text-xs text-slate-400 py-4" },
            "אין קבוצות עדיין",
          ),
      ),
    ),
    m && e.createElement(rt, { onClose: () => o(!1), users: t }),
    editUser &&
      e.createElement(EditUserModal, {
        user: editUser,
        onClose: () => setEditUser(null),
      }),
  );
}
function dt({
  open: t,
  onClose: s,
  isAdmin: a,
  view: l,
  setView: i,
  onLogout: c,
  userName: n,
}) {
  return e.createElement(
    e.Fragment,
    null,
    e.createElement("div", {
      className: `fixed inset-0 bg-black/40 z-40 transition-opacity ${t ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`,
      onClick: s,
    }),
    e.createElement(
      "aside",
      {
        dir: "rtl",
        className: `fixed top-0 right-0 h-full w-72 bg-white z-50 shadow-xl flex flex-col transition-transform duration-200 ${t ? "translate-x-0" : "translate-x-full"}`,
      },
      e.createElement(
        "div",
        { className: "bg-blue-950 text-white px-5 py-5" },
        e.createElement(
          "div",
          { className: "text-sm font-bold leading-snug" },
          X,
        ),
        e.createElement(
          "div",
          { className: "text-xs text-blue-300 mt-0.5" },
          W,
        ),
        e.createElement(
          "div",
          { className: "text-xs text-blue-200 mt-2" },
          n,
          " \xB7 ",
          a ? "מנהל" : "מאמן",
        ),
      ),
      e.createElement(
        "nav",
        { className: "flex-1 py-2 overflow-y-auto" },
        (a
          ? [
              {
                key: "dashboard",
                label: "דשבורד",
                icon: le,
              },
              {
                key: "attendance",
                label:
                  "מילוי נוכחות",
                icon: Z,
              },
              {
                key: "groups",
                label:
                  "ניהול קבוצות",
                icon: H,
              },
              {
                key: "phonebook",
                label:
                  "ספר טלפונים",
                icon: se,
              },
              {
                key: "reports",
                label: "דוחות",
                icon: ReportsIcon,
              },
              {
                key: "permissions",
                label:
                  "ניהול הרשאות",
                icon: Ie,
              },
              {
                key: "import",
                label:
                  "ייבוא שחקנים",
                icon: K,
              },
            ]
          : [
              {
                key: "attendance",
                label:
                  "מילוי נוכחות",
                icon: Z,
              },
            ]
        ).map(({ key: h, label: u, icon: f }) =>
          e.createElement(
            "button",
            {
              key: h,
              onClick: () => {
                (i(h), s());
              },
              className: `w-full px-5 py-3.5 flex items-center gap-3 justify-start text-right ${l === h ? "bg-emerald-50 text-emerald-700" : "text-slate-600"}`,
            },
            e.createElement(f, { className: "w-4 h-4 shrink-0" }),
            e.createElement("span", { className: "font-medium text-sm" }, u),
          ),
        ),
      ),
      e.createElement(
        "button",
        {
          onClick: c,
          className:
            "px-5 py-4 flex items-center gap-3 justify-start text-right border-t border-slate-100 text-red-500",
        },
        e.createElement(Ce, { className: "w-4 h-4 shrink-0" }),
        e.createElement(
          "span",
          { className: "font-medium text-sm" },
          "יציאה",
        ),
      ),
    ),
  );
}
function re({
  group: t,
  profile: s,
  players: a,
  attendance: l,
  onBack: i,
  onArchivePlayer: c,
  onEditPlayer: EP,
  onWhatsapp: WA,
  onAddPlayer: AP,
}) {
  let n = a.filter((p) => p.groupId === t.id && p.isActive && !p.deleted),
    m = E(),
    o = l.some((p) => p.groupId === t.id && p.date === m),
    rosterKey = n
      .map((p) => p.id)
      .sort()
      .join(","),
    [x, h] = b({}),
    [u, f] = b(!o),
    [g, r] = b(!1),
    [y, N] = b("");
  j(() => {
    let p = {};
    (n.forEach((w) => {
      let k = l.find(
        (v) => v.groupId === t.id && v.date === m && v.playerId === w.id,
      );
      p[w.id] = k ? k.status : null;
    }),
      h(p),
      f(!o));
  }, [t.id, rosterKey, o]);
  let C = (p, w) => {
      u && h((k) => ({ ...k, [p]: k[p] === w ? null : w }));
    },
    d = (p) => {
      if (!u) return;
      let w = {};
      (n.forEach((k) => {
        w[k.id] = p;
      }),
        h(w));
    },
    A = async () => {
      (r(!0), N(""));
      try {
        let p = Te(P),
          saved = {};
        (n.forEach((w) => {
          let k = S(P, "attendance", `${m}_${t.id}_${w.id}`),
            prev = l.find(
              (v) => v.groupId === t.id && v.date === m && v.playerId === w.id,
            ),
            st2 = x[w.id] || null;
          if (((saved[w.id] = st2), !st2)) {
            p.delete(k);
            return;
          }
          let rec = {
            date: m,
            playerId: w.id,
            groupId: t.id,
            status: st2,
            markedBy: s.id,
          };
          (st2 === "Absent" &&
            prev &&
            prev.msgSentAt &&
            ((rec.msgSentAt = prev.msgSentAt),
            (rec.msgSentBy = prev.msgSentBy || "")),
            p.set(k, rec));
        }),
          await p.commit(),
          h(saved),
          f(!1));
      } catch (p) {
        N(
          "השמירה נכשלה: " +
            p.message,
        );
      } finally {
        r(!1);
      }
    },
    I = n.filter((p) => x[p.id] === "Present").length,
    unmarked = n.filter((p) => !x[p.id]).length;
  return e.createElement(
    "div",
    { className: "flex flex-col gap-4" },
    i &&
      e.createElement(
        "button",
        {
          onClick: i,
          className:
            "flex items-center gap-1.5 text-sm text-slate-500 self-start",
        },
        e.createElement(je, { className: "w-4 h-4" }),
        "חזרה לרשימת הקבוצות",
      ),
    e.createElement(
      "div",
      { className: "bg-white rounded-xl border border-slate-200 p-4" },
      e.createElement(
        "div",
        { className: "flex items-center justify-between" },
        e.createElement(
          "span",
          {
            className: `text-xs font-semibold px-2.5 py-1 rounded-full ${o && !u ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`,
          },
          o && !u
            ? "נשמר להיום ✓"
            : "טרם נשמר",
        ),
        e.createElement(
          "div",
          { className: "text-right" },
          e.createElement(
            "div",
            { className: "font-bold text-blue-950" },
            t.name,
          ),
          e.createElement(
            "div",
            { className: "text-xs text-slate-500" },
            Ke(m),
          ),
        ),
      ),
      n.length > 0 &&
        e.createElement(
          "div",
          {
            className:
              "mt-2 pt-2 border-t border-slate-100 text-xs text-slate-500 text-right",
          },
          "הגיעו ",
          I,
          " מתוך ",
          n.length,
        ),
    ),
    AP &&
      e.createElement(
        "button",
        {
          onClick: () => AP(t),
          className:
            "bg-white border border-emerald-300 text-emerald-700 rounded-xl py-3 min-h-[44px] text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform",
        },
        e.createElement(K, { className: "w-4 h-4" }),
        "הוספת שחקן לקבוצה",
      ),
    u &&
      n.length > 0 &&
      e.createElement(
        "div",
        { className: "grid grid-cols-2 gap-2" },
        e.createElement(
          "button",
          {
            onClick: () => d("Absent"),
            className:
              "bg-white border border-red-200 text-red-600 rounded-xl py-2.5 text-sm font-medium",
          },
          "סמן את כולם כלא הגיעו",
        ),
        e.createElement(
          "button",
          {
            onClick: () => d("Present"),
            className:
              "bg-white border border-emerald-200 text-emerald-700 rounded-xl py-2.5 text-sm font-medium",
          },
          "סמן את כולם כהגיעו",
        ),
      ),
    e.createElement(
      "div",
      {
        className:
          "bg-white rounded-xl border border-slate-200 divide-y divide-slate-100",
      },
      n.map((p) => {
        let w = x[p.id] || null,
          k = Qe(l, p.id),
          savedRec = l.find(
            (v) => v.groupId === t.id && v.date === m && v.playerId === p.id,
          ),
          showWa = !!savedRec && savedRec.status === "Absent",
          waSent = !!(savedRec && savedRec.msgSentAt),
          isOffDay =
            Array.isArray(p.trainingDays) &&
            p.trainingDays.length > 0 &&
            !p.trainingDays.includes(new Date(m + "T00:00:00").getDay());
        return e.createElement(
          "div",
          { key: p.id, className: "px-3 py-3 flex items-center gap-2" },
          e.createElement(
            "div",
            { className: "flex-1 text-right min-w-0" },
            e.createElement(
              "div",
              {
                className:
                  "text-sm font-medium text-blue-950 truncate flex items-center gap-1 justify-start",
              },
              p.name,
              isOffDay &&
                e.createElement(
                  "span",
                  {
                    className:
                      "text-[9px] font-normal text-amber-600 bg-amber-50 border border-amber-200 rounded px-1 shrink-0",
                  },
                  "לא יום קבוע",
                ),
            ),
          ),
          e.createElement(
            "div",
            { className: "flex gap-1.5 shrink-0" },
            e.createElement(
              "button",
              {
                onClick: () => C(p.id, "Present"),
                disabled: !u,
                className: `min-w-[44px] min-h-[44px] px-3 rounded-lg text-xs font-semibold border transition-colors ${w === "Present" ? "bg-emerald-500 text-white border-emerald-500" : "bg-white text-slate-400 border-slate-200"} ${u ? "active:scale-95" : "opacity-70"}`,
              },
              "הגיע",
            ),
            e.createElement(
              "button",
              {
                onClick: () => C(p.id, "Absent"),
                disabled: !u,
                className: `min-w-[44px] min-h-[44px] px-3 rounded-lg text-xs font-semibold border transition-colors ${w === "Absent" ? "bg-red-500 text-white border-red-500" : "bg-white text-slate-400 border-slate-200"} ${u ? "active:scale-95" : "opacity-70"}`,
              },
              "לא הגיע",
            ),
          ),
          showWa &&
            WA &&
            e.createElement(
              "button",
              {
                onClick: () => WA(p, "absence", t.id, m),
                className: `min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center shrink-0 active:scale-95 transition-transform ${waSent ? "bg-slate-100" : "bg-emerald-500"}`,
                "aria-label": waSent
                  ? "הודעה נשלחה — שליחה חוזרת"
                  : "שליחת הודעת וואטסאפ על היעדרות",
                title: waSent ? "הודעה נשלחה" : "שליחת הודעה על היעדרות",
              },
              e.createElement(te, {
                className: `w-4 h-4 ${waSent ? "text-slate-400" : "text-white"}`,
              }),
            ),
          k &&
            e.createElement(Re, {
              player: p,
              onOpenWhatsapp: (v) =>
                WA
                  ? WA(v)
                  : window.open(
                      ne(
                        normalizePhone(v.parentPhone),
                        Ve(v.parentName, v.name, isAdultGroup(t)),
                      ),
                      "_blank",
                    ),
            }),
          EP &&
            e.createElement(
              "button",
              {
                onClick: () => EP(p),
                className:
                  "min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 shrink-0",
                "aria-label": "עריכת פרטי שחקן",
              },
              e.createElement($e, { className: "w-4 h-4" }),
            ),
          c &&
            e.createElement(
              "button",
              {
                onClick: () => {
                  window.confirm(
                    `להעביר את ${p.name} לארכיון? ההיסטוריה שלו תישמר.`,
                  ) && c(p.id);
                },
                className:
                  "min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-300 shrink-0",
                "aria-label":
                  "העברה לארכיון",
              },
              e.createElement(Ae, { className: "w-4 h-4" }),
            ),
        );
      }),
      n.length === 0 &&
        e.createElement(
          "p",
          { className: "text-center text-xs text-slate-400 py-6" },
          "אין שחקנים פעילים בקבוצה זו",
        ),
    ),
    y &&
      e.createElement("p", { className: "text-xs text-red-600 text-right" }, y),
    u &&
      unmarked > 0 &&
      n.length > 0 &&
      e.createElement(
        "p",
        { className: "text-[11px] text-amber-700 text-right leading-relaxed" },
        `${unmarked} שחקנים ללא סימון — הם יישארו ללא רישום נוכחות להיום.`,
      ),
    e.createElement(
      "div",
      {
        className:
          "sticky bottom-0 -mx-1 px-1 pb-1 pt-2 bg-gradient-to-t from-slate-50 via-slate-50",
      },
      u
        ? e.createElement(
            "button",
            {
              onClick: A,
              disabled: g || n.length === 0,
              className:
                "w-full bg-emerald-500 disabled:opacity-60 text-white font-semibold rounded-xl py-3.5 active:scale-[0.98] transition-transform shadow-lg",
            },
            g
              ? "שומר…"
              : "שמירת נוכחות",
          )
        : e.createElement(
            "button",
            {
              onClick: () => f(!0),
              className:
                "w-full bg-blue-900 text-white font-semibold rounded-xl py-3.5 active:scale-[0.98] transition-transform shadow-lg",
            },
            "עריכה מחדש",
          ),
    ),
  );
}
function mt({
  profile: t,
  groups: s,
  players: a,
  attendance: l,
  users: US,
  isAdmin: i,
  onEditPlayer: EP,
  onWhatsapp: WA,
  onAddPlayer: AP,
  selectedGroupId: SG,
  onSelectGroup: onSelectGroup,
}) {
  let [editGroup, setEditGroup] = b(null),
    c = i ? s : s.filter((r) => isGroupCoach(r, t.id)),
    myAlerts = absenceAlerts(
      a,
      s,
      l,
      c.map((r) => r.id),
    ),
    myPending = pendingAbsenceMsgs(a, s, [], l).filter((r) =>
      c.some((gr) => gr.id === r.record.groupId),
    ),
    o = c.length === 1 ? c[0].id : null,
    x = SG || o,
    h = c.find((r) => r.id === x),
    u = E(),
    f = (r) => l.some((y) => y.groupId === r.id && y.date === u),
    g = [...c].sort((r, y) => {
      let N = (d) => (ee(d) ? (f(d) ? 1 : 0) : 2),
        C = N(r) - N(y);
      return C !== 0 ? C : r.name.localeCompare(y.name, "he");
    });
  useLocalAlertNotice(myAlerts, "נוכחות מועדון");
  return c.length === 0
    ? e.createElement(
        "p",
        {
          className:
            "text-center text-sm text-slate-400 py-10 px-6 leading-relaxed",
        },
        i
          ? 'אין עדיין קבוצות. הוסף קבוצה במסך "ניהול קבוצות".'
          : "לא שויכה אליך קבוצה עדיין. פנה למנהל המועדון.",
      )
    : h
      ? e.createElement(
          "div",
          { className: "px-4 pt-4 pb-6 flex flex-col gap-4" },
          e.createElement(AlertsCard, {
            alerts: myAlerts.filter((r) => r.player.groupId === h.id),
            onWhatsapp: WA,
            onEdit: EP,
          }),
          e.createElement(AbsenceMsgCard, {
            items: myPending.filter((r) => r.record.groupId === h.id),
            onWhatsapp: WA,
            currentUserId: t.id,
          }),
          e.createElement(re, {
            group: h,
            profile: t,
            players: a,
            attendance: l,
            onBack: o ? null : () => onSelectGroup(null),
            onEditPlayer: EP,
            onWhatsapp: WA,
            onAddPlayer: AP,
          }),
          e.createElement(
            "button",
            {
              onClick: () => setEditGroup(h),
              className:
                "self-start flex items-center gap-1.5 text-sm text-blue-900 font-medium min-h-[44px]",
            },
            e.createElement($e, { className: "w-4 h-4" }),
            "עריכת פרטי הקבוצה",
          ),
          editGroup &&
            e.createElement(nt, {
              group: editGroup,
              users: US || [],
              isAdmin: i,
              onClose: () => setEditGroup(null),
            }),
        )
      : e.createElement(
          "div",
          { className: "px-4 pt-4 pb-6 flex flex-col gap-3" },
          e.createElement(AlertsCard, {
            alerts: myAlerts,
            onWhatsapp: WA,
            onEdit: EP,
          }),
          e.createElement(AbsenceMsgCard, {
            items: myPending,
            onWhatsapp: WA,
            currentUserId: t.id,
          }),
          e.createElement(
            "p",
            { className: "text-xs text-slate-500 px-1" },
            "בחר קבוצה כדי למלא נוכחות",
          ),
          g.map((r) => {
            let y = f(r),
              N = ee(r),
              C = a.filter((d) => d.groupId === r.id && d.isActive && !d.deleted).length;
            return e.createElement(
              "button",
              {
                key: r.id,
                onClick: () => onSelectGroup(r.id),
                className: `rounded-xl border px-4 py-3.5 flex items-center justify-between gap-2 active:scale-[0.99] transition-transform ${N && !y ? "bg-white border-emerald-400 border-2" : "bg-white border-slate-200"}`,
              },
              e.createElement(
                "span",
                {
                  className: `text-[11px] font-semibold px-2 py-1 rounded-full shrink-0 ${y ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`,
                },
                y
                  ? "נשמר"
                  : "טרם נשמר",
              ),
              e.createElement(
                "div",
                { className: "text-right flex-1 min-w-0" },
                e.createElement(
                  "div",
                  { className: "font-semibold text-blue-950 truncate" },
                  r.name,
                  N &&
                    e.createElement(
                      "span",
                      {
                        className:
                          "mr-1.5 text-[11px] font-bold text-emerald-600",
                      },
                      "\xB7 היום",
                    ),
                ),
                e.createElement(
                  "div",
                  { className: "text-xs text-slate-400 truncate" },
                  q(r),
                  " \xB7 ",
                  C,
                  " שחקנים",
                ),
              ),
            );
          }),
        );
}
function ut() {
  let [t, s] = b(typeof navigator > "u" ? !0 : navigator.onLine);
  return (
    j(() => {
      let a = () => s(!0),
        l = () => s(!1);
      return (
        window.addEventListener("online", a),
        window.addEventListener("offline", l),
        () => {
          (window.removeEventListener("online", a),
            window.removeEventListener("offline", l));
        }
      );
    }, []),
    t
  );
}
function ct() {
  return e.createElement(
    "div",
    {
      className: "bg-amber-100 border-b border-amber-300 px-4 py-2 text-center",
    },
    e.createElement(
      "p",
      { className: "text-[12px] text-amber-900 leading-snug" },
      "אין חיבור לאינטרנט — אפשר להמשיך לסמן נוכחות, והנתונים יסונכרנו אוטומטית כשהחיבור יחזור.",
    ),
  );
}
function Q() {
  let { authUser: t, profile: s, profileError: a } = Ye(),
    { data: l } = L("users"),
    { data: i } = L("groups"),
    { data: c } = L("players"),
    { data: n } = L("attendance"),
    [m, o] = b("dashboard"),
    [attGroupId, setAttGroupId] = b(null),
    [x, h] = b(!1),
    [playerModal, setPlayerModal] = b(null),
    [waPlayer, setWaPlayer] = b(null),
    g = ut(),
    openAddPlayer = (group) =>
      setPlayerModal({ player: null, groupId: group?.id || null }),
    openEditPlayer = (player) => setPlayerModal({ player }),
    openWhatsapp = (player, mode, groupId, date) =>
      setWaPlayer({
        player,
        mode: mode || "",
        groupId: groupId || "",
        date: date || "",
      }),
    goToScreen = (v) => {
      (o(v), setAttGroupId(null));
      try {
        history.pushState({ screen: v, attGroup: null }, "");
      } catch (e2) {}
    },
    goToGroup = (v) => {
      setAttGroupId(v);
      try {
        history.pushState({ screen: "attendance", attGroup: v }, "");
      } catch (e2) {}
    },
    goToGroupScreen = (v) => {
      (o("attendance"), setAttGroupId(v));
      try {
        history.pushState({ screen: "attendance", attGroup: v }, "");
      } catch (e2) {}
    };
  if (
    (j(() => {
      s?.id && qe(s.id);
    }, [s?.id]),
    j(() => {
      s && s.role !== "Admin" && o("attendance");
    }, [s?.role]),
    j(() => {
      let onPop = (ev) => {
        let st = ev.state || {};
        (o(st.screen || "dashboard"), setAttGroupId(st.attGroup || null));
      };
      if (!history.state)
        try {
          history.replaceState({ screen: "dashboard", attGroup: null }, "");
        } catch (e2) {}
      return (
        window.addEventListener("popstate", onPop),
        () => window.removeEventListener("popstate", onPop)
      );
    }, []),
    j(() => {
      let N;
      return (
        F.then((C) => {
          C &&
            (N = Fe(C, (d) => {
              console.log("Foreground push received:", d);
            }));
        }),
        () => N && N()
      );
    }, []),
    t === void 0 || (t && s === void 0))
  )
    return e.createElement(
      "div",
      {
        dir: "rtl",
        className:
          "min-h-screen bg-blue-950 flex flex-col items-center justify-center gap-3",
      },
      e.createElement("img", {
        src: "./logo.png",
        alt: "",
        className:
          "w-16 h-16 rounded-2xl bg-white/95 p-2 shrink-0 animate-pulse",
      }),
      e.createElement(
        "span",
        { className: "text-blue-300 text-sm" },
        "טוען…",
      ),
    );
  if (!t) return e.createElement(tt, null);
  if (!s) {
    let N =
      a &&
      (a.code === "permission-denied" || /permission/i.test(a.message || ""));
    return e.createElement(
      "div",
      {
        dir: "rtl",
        className:
          "min-h-screen bg-blue-950 flex flex-col items-center justify-center gap-4 px-6 text-center",
      },
      N
        ? e.createElement(
            e.Fragment,
            null,
            e.createElement(
              "p",
              { className: "text-white text-sm leading-relaxed" },
              "ההתחברות הצליחה, אבל כללי האבטחה של Firestore חוסמים את קריאת הפרופיל.",
            ),
            e.createElement(
              "p",
              { className: "text-blue-300 text-xs leading-relaxed" },
              "יש לפרסם את כללי האבטחה בקונסולה (Firestore → Rules → Publish).",
            ),
          )
        : e.createElement(
            "p",
            { className: "text-white text-sm leading-relaxed" },
            "המשתמש מחובר אך אין לו מסמך פרופיל תואם ב-Firestore",
            e.createElement("br", null),
            e.createElement(
              "span",
              { className: "text-blue-300 text-xs" },
              "users/",
              t.uid,
            ),
          ),
      e.createElement(
        "button",
        {
          onClick: () => window.location.reload(),
          className: "bg-emerald-500 text-white text-sm rounded-xl px-5 py-2.5",
        },
        "נסה שוב",
      ),
      e.createElement(
        "button",
        { onClick: () => R(D), className: "text-blue-300 text-sm underline" },
        "התנתקות",
      ),
    );
  }
  let r = s.role === "Admin";
  return e.createElement(
    "div",
    { dir: "rtl", className: "min-h-screen bg-slate-50" },
    e.createElement(
      "div",
      {
        className:
          "max-w-md mx-auto min-h-screen bg-slate-50 relative shadow-sm",
      },
      e.createElement(
        "header",
        {
          className:
            "sticky top-0 z-30 bg-blue-950 text-white px-4 py-3.5 flex items-center gap-3",
        },
        e.createElement("img", {
          src: "./logo.png",
          alt: "",
          className: "w-9 h-9 rounded-lg bg-white/95 p-0.5 shrink-0 order-last",
        }),
        e.createElement(
          "button",
          {
            onClick: () => h(!0),
            className:
              "text-white shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center",
            "aria-label": "תפריט",
          },
          e.createElement(Pe, { className: "w-6 h-6" }),
        ),
        e.createElement(
          "div",
          { className: "text-right flex-1 min-w-0" },
          e.createElement(
            "div",
            { className: "text-sm font-bold leading-tight truncate" },
            {
              dashboard: "דשבורד",
              groups:
                "ניהול קבוצות",
              phonebook:
                "ספר טלפונים",
              permissions:
                "ניהול הרשאות",
              import: "ייבוא שחקנים",
              reports: "דוחות",
              attendance:
                "מילוי נוכחות",
            }[m] || X,
          ),
          e.createElement(
            "div",
            { className: "text-[11px] text-blue-300 truncate" },
            s.name,
            " \xB7 ",
            r ? "מנהל" : "מאמן",
          ),
        ),
      ),
      !g && e.createElement(ct, null),
      r &&
        m === "dashboard" &&
        e.createElement(st, {
          users: l,
          groups: i,
          players: c,
          attendance: n,
          onOpenAddPlayer: openAddPlayer,
          currentUserId: s.id,
          onEditPlayer: openEditPlayer,
          onWhatsapp: openWhatsapp,
          onOpenGroup: goToGroupScreen,
        }),
      r &&
        m === "groups" &&
        e.createElement(it, { groups: i, users: l, players: c }),
      r &&
        m === "phonebook" &&
        e.createElement(lt, {
          players: c,
          groups: i,
          onEditPlayer: openEditPlayer,
        }),
      r &&
        m === "reports" &&
        e.createElement(ReportsScreen, {
          groups: i,
          users: l,
          players: c,
          attendance: n,
        }),
      r &&
        m === "permissions" &&
        e.createElement(ot, { users: l, groups: i, currentUserId: s.id }),
      r &&
        m === "import" &&
        e.createElement(ImportScreen, { groups: i, players: c }),
      m === "attendance" &&
        e.createElement(mt, {
          profile: s,
          groups: i,
          players: c,
          attendance: n,
          users: l,
          isAdmin: r,
          onEditPlayer: openEditPlayer,
          onWhatsapp: openWhatsapp,
          onAddPlayer: openAddPlayer,
          selectedGroupId: attGroupId,
          onSelectGroup: goToGroup,
        }),
      e.createElement(dt, {
        open: x,
        onClose: () => h(!1),
        isAdmin: r,
        view: m,
        setView: goToScreen,
        userName: s.name,
        onLogout: () => {
          (h(!1), R(D));
        },
      }),
      playerModal &&
        e.createElement(at, {
          groups: i,
          player: playerModal.player,
          defaultGroupId: playerModal.groupId,
          allowedGroupIds: r
            ? null
            : i.filter((G2) => isGroupCoach(G2, s.id)).map((G2) => G2.id),
          onClose: () => setPlayerModal(null),
        }),
      waPlayer &&
        e.createElement(WhatsappModal, {
          player: waPlayer.player,
          mode: waPlayer.mode,
          date: waPlayer.date,
          adult: playerIsAdult(waPlayer.player, i),
          onClose: () => setWaPlayer(null),
          onSent: () => {
            if (waPlayer.mode === "absence") {
              markAbsenceMsgSent(
                waPlayer.date,
                waPlayer.groupId,
                waPlayer.player.id,
                s.id,
              ).catch((err) => console.warn("Message log not saved:", err));
              return;
            }
            let dates = lastTwoAbsences(n, waPlayer.player.id);
            dates &&
              markAlertHandled(waPlayer.player.id, dates[0]).catch((err) =>
                console.warn("Alert handling not saved:", err),
              );
          },
        }),
    ),
  );
}
bt(document.getElementById("root")).render(xt.createElement(Q, null));
