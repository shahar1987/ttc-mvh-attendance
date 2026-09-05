function nt({ group: t, users: s, onClose: a }) {
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
    [N, C] = b(t?.coachId || ""),
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
          coachId: N,
        };
        (t ? await O(S(P, "groups", t.id), v) : await V(M(P, "groups"), v),
          a());
      } catch (v) {
        p(
          "\u05E9\u05DE\u05D9\u05E8\u05D4 \u05E0\u05DB\u05E9\u05DC\u05D4: " +
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
            ? "\u05E2\u05E8\u05D9\u05DB\u05EA \u05E7\u05D1\u05D5\u05E6\u05D4"
            : "\u05D4\u05D5\u05E1\u05E4\u05EA \u05E7\u05D1\u05D5\u05E6\u05D4",
        ),
      ),
      e.createElement(
        "div",
        { className: "flex flex-col gap-1" },
        e.createElement(
          "label",
          { className: "text-xs text-slate-500" },
          "\u05E9\u05DD \u05D4\u05E7\u05D1\u05D5\u05E6\u05D4",
        ),
        e.createElement("input", {
          value: i,
          onChange: (v) => c(v.target.value),
          placeholder:
            "\u05DC\u05D3\u05D5\u05D2\u05DE\u05D4: \u05E0\u05D5\u05E2\u05E8 \u05DE\u05EA\u05E7\u05D3\u05DE\u05D9\u05DD",
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
          "\u05DE\u05D9\u05E7\u05D5\u05DD",
        ),
        e.createElement("input", {
          value: n,
          onChange: (v) => m(v.target.value),
          placeholder:
            "\u05DC\u05D3\u05D5\u05D2\u05DE\u05D4: \u05E8\u05DE\u05EA \u05DB\u05D5\u05E8\u05D6\u05D9\u05DD",
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
          "\u05D9\u05DE\u05D9 \u05D0\u05D9\u05DE\u05D5\u05DF",
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
            '\u05D4\u05D9\u05D4 \u05E8\u05E9\u05D5\u05DD \u05DB\u05D0\u05DF: "',
            r,
            '" \u2014 \u05E1\u05DE\u05DF \u05D0\u05EA \u05D4\u05D9\u05DE\u05D9\u05DD \u05D5\u05D4\u05E9\u05E2\u05D5\u05EA \u05D5\u05D6\u05D4 \u05D9\u05D5\u05D7\u05DC\u05E3.',
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
            "\u05E9\u05E2\u05EA \u05D4\u05EA\u05D7\u05DC\u05D4",
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
            "\u05E9\u05E2\u05EA \u05E1\u05D9\u05D5\u05DD",
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
        { className: "flex flex-col gap-1" },
        e.createElement(
          "label",
          { className: "text-xs text-slate-500" },
          "\u05DE\u05D0\u05DE\u05DF \u05D0\u05D7\u05E8\u05D0\u05D9 (\u05DC\u05D0 \u05D7\u05D5\u05D1\u05D4)",
        ),
        e.createElement(
          "select",
          {
            value: N,
            onChange: (v) => C(v.target.value),
            className:
              "border border-slate-200 rounded-lg py-2.5 px-3 text-right text-sm outline-none focus:border-emerald-400 bg-white",
          },
          e.createElement(
            "option",
            { value: "" },
            "\u2014 \u05DC\u05DC\u05D0 \u05DE\u05D0\u05DE\u05DF \u2014",
          ),
          l.map((v) =>
            e.createElement("option", { key: v.id, value: v.id }, v.name),
          ),
        ),
        l.length === 0 &&
          e.createElement(
            "p",
            { className: "text-[11px] text-slate-400" },
            "\u05D0\u05E4\u05E9\u05E8 \u05DC\u05D9\u05E6\u05D5\u05E8 \u05D0\u05EA \u05D4\u05E7\u05D1\u05D5\u05E6\u05D4 \u05E2\u05DB\u05E9\u05D9\u05D5 \u05D5\u05DC\u05E9\u05D9\u05D9\u05DA \u05DE\u05D0\u05DE\u05DF \u05D1\u05D4\u05DE\u05E9\u05DA \u05D1\u05DE\u05E1\u05DA \u05D4\u05D4\u05E8\u05E9\u05D0\u05D5\u05EA.",
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
        d ? "\u05E9\u05D5\u05DE\u05E8\u2026" : "\u05E9\u05DE\u05D9\u05E8\u05D4",
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
        n("\u05E9\u05D9\u05D1\u05D5\u05E5 \u05E0\u05DB\u05E9\u05DC: " + h.message);
      } finally {
        setBusyReassign(null);
      }
    },
    m = async (o) => {
      let x = a.filter((h) => h.groupId === o.id && h.isActive && !h.deleted);
      if (
        !window.confirm(
          x.length > 0
            ? `\u05DC\u05DE\u05D7\u05D5\u05E7 \u05D0\u05EA \u05D4\u05E7\u05D1\u05D5\u05E6\u05D4 "${o.name}"? ${x.length} \u05D4\u05E9\u05D7\u05E7\u05E0\u05D9\u05DD \u05D4\u05E4\u05E2\u05D9\u05DC\u05D9\u05DD \u05D1\u05D4 \u05D9\u05D5\u05E2\u05D1\u05E8\u05D5 \u05DC\u05DE\u05D0\u05D2\u05E8 "\u05E9\u05D7\u05E7\u05E0\u05D9\u05DD \u05DC\u05DC\u05D0 \u05E7\u05D1\u05D5\u05E6\u05D4" \u05D5\u05EA\u05D5\u05DB\u05DC \u05DC\u05E9\u05D1\u05E5 \u05D0\u05D5\u05EA\u05DD \u05DE\u05D7\u05D3\u05E9. \u05D4\u05E4\u05E2\u05D5\u05DC\u05D4 \u05D0\u05D9\u05E0\u05D4 \u05D4\u05E4\u05D9\u05DB\u05D4.`
            : `\u05DC\u05DE\u05D7\u05D5\u05E7 \u05D0\u05EA \u05D4\u05E7\u05D1\u05D5\u05E6\u05D4 "${o.name}"? \u05D4\u05E4\u05E2\u05D5\u05DC\u05D4 \u05D0\u05D9\u05E0\u05D4 \u05D4\u05E4\u05D9\u05DB\u05D4.`,
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
          "\u05DE\u05D7\u05D9\u05E7\u05D4 \u05E0\u05DB\u05E9\u05DC\u05D4: " +
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
      " \u05D4\u05D5\u05E1\u05E4\u05EA \u05E7\u05D1\u05D5\u05E6\u05D4",
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
        '\u05D0\u05D9\u05DF \u05E2\u05D3\u05D9\u05D9\u05DF \u05E7\u05D1\u05D5\u05E6\u05D5\u05EA. \u05DC\u05D7\u05E5 "\u05D4\u05D5\u05E1\u05E4\u05EA \u05E7\u05D1\u05D5\u05E6\u05D4" \u05DB\u05D3\u05D9 \u05DC\u05D4\u05EA\u05D7\u05D9\u05DC.',
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
          "\u05E9\u05D7\u05E7\u05E0\u05D9\u05DD \u05DC\u05DC\u05D0 \u05E7\u05D1\u05D5\u05E6\u05D4 \xB7 " + unassigned.length,
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
                "\u05D1\u05D7\u05E8 \u05E7\u05D1\u05D5\u05E6\u05D4",
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
              "\u05E9\u05D9\u05D1\u05D5\u05E5",
            ),
          ),
        ),
      ),
    e.createElement(
      "div",
      { className: "flex flex-col gap-2.5" },
      t.map((o) => {
        let x = s.find((u) => u.id === o.coachId),
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
                "aria-label": "\u05DE\u05D7\u05D9\u05E7\u05D4",
              },
              e.createElement(Se, { className: "w-4 h-4 text-red-500" }),
            ),
            e.createElement(
              "button",
              {
                onClick: () => i(o),
                className:
                  "w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center",
                "aria-label": "\u05E2\u05E8\u05D9\u05DB\u05D4",
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
              x ? x.name : "\u05DC\u05DC\u05D0 \u05DE\u05D0\u05DE\u05DF",
              o.location ? ` \xB7 ${o.location}` : "",
            ),
            e.createElement(
              "div",
              { className: "text-xs text-slate-400" },
              q(o),
              " \xB7 ",
              h,
              " \u05E9\u05D7\u05E7\u05E0\u05D9\u05DD",
            ),
          ),
        );
      }),
    ),
    l &&
      e.createElement(nt, {
        group: l === "new" ? null : l,
        users: s,
        onClose: () => i(null),
      }),
  );
}
function rt({ onClose: t }) {
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
        "\u05DB\u05EA\u05D5\u05D1\u05EA \u05D4\u05D0\u05D9\u05DE\u05D9\u05D9\u05DC \u05DB\u05D1\u05E8 \u05E8\u05E9\u05D5\u05DE\u05D4 \u05D1\u05DE\u05E2\u05E8\u05DB\u05EA",
      "auth/invalid-email":
        "\u05DB\u05EA\u05D5\u05D1\u05EA \u05D0\u05D9\u05DE\u05D9\u05D9\u05DC \u05DC\u05D0 \u05EA\u05E7\u05D9\u05E0\u05D4",
      "auth/weak-password":
        "\u05D4\u05E1\u05D9\u05E1\u05DE\u05D4 \u05D7\u05DC\u05E9\u05D4 \u05DE\u05D3\u05D9 \u2014 \u05E0\u05D3\u05E8\u05E9\u05D9\u05DD \u05DC\u05E4\u05D7\u05D5\u05EA 6 \u05EA\u05D5\u05D5\u05D9\u05DD",
      "auth/operation-not-allowed":
        "\u05D4\u05EA\u05D7\u05D1\u05E8\u05D5\u05EA \u05E2\u05DD \u05D0\u05D9\u05DE\u05D9\u05D9\u05DC \u05D5\u05E1\u05D9\u05E1\u05DE\u05D4 \u05D0\u05D9\u05E0\u05D4 \u05DE\u05D5\u05E4\u05E2\u05DC\u05EA \u05D1\u05E4\u05E8\u05D5\u05D9\u05E7\u05D8",
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
          "\u05D4\u05D5\u05E1\u05E4\u05EA \u05DE\u05E9\u05EA\u05DE\u05E9",
        ),
      ),
      e.createElement(
        "div",
        { className: "flex flex-col gap-1" },
        e.createElement(
          "label",
          { className: "text-xs text-slate-500" },
          "\u05E9\u05DD \u05DE\u05DC\u05D0",
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
          "\u05D0\u05D9\u05DE\u05D9\u05D9\u05DC (\u05E9\u05DD \u05D4\u05DE\u05E9\u05EA\u05DE\u05E9 \u05DC\u05DB\u05E0\u05D9\u05E1\u05D4)",
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
          "\u05E1\u05D9\u05E1\u05DE\u05D4 \u05E8\u05D0\u05E9\u05D5\u05E0\u05D9\u05EA (\u05DC\u05E4\u05D7\u05D5\u05EA 6 \u05EA\u05D5\u05D5\u05D9\u05DD)",
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
          "\u05DE\u05E1\u05D5\u05E8 \u05D0\u05D5\u05EA\u05D4 \u05DC\u05DE\u05E9\u05EA\u05DE\u05E9 \u05D5\u05D4\u05DE\u05DC\u05E5 \u05DC\u05D5 \u05DC\u05D4\u05D7\u05DC\u05D9\u05E3 \u05D0\u05D5\u05EA\u05D4.",
        ),
      ),
      e.createElement(
        "div",
        { className: "flex flex-col gap-1" },
        e.createElement(
          "label",
          { className: "text-xs text-slate-500" },
          "\u05D8\u05DC\u05E4\u05D5\u05DF (\u05D1\u05E4\u05D5\u05E8\u05DE\u05D8 9725XXXXXXXX)",
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
          "\u05D4\u05E8\u05E9\u05D0\u05D4",
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
            "\u05DE\u05D0\u05DE\u05DF \u2014 \u05E8\u05E7 \u05D4\u05E7\u05D1\u05D5\u05E6\u05D5\u05EA \u05E9\u05D9\u05E9\u05D5\u05D9\u05DB\u05D5 \u05D0\u05DC\u05D9\u05D5",
          ),
          e.createElement(
            "option",
            { value: "Admin" },
            "\u05DE\u05E0\u05D4\u05DC \u2014 \u05D2\u05D9\u05E9\u05D4 \u05DE\u05DC\u05D0\u05D4",
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
              let d = await He(l.trim(), c);
              (await De(S(P, "users", d), {
                name: s.trim(),
                role: x,
                phone: m.trim(),
              }),
                t());
            } catch (d) {
              r(
                N[d.code] ||
                  "\u05D9\u05E6\u05D9\u05E8\u05EA \u05D4\u05DE\u05E9\u05EA\u05DE\u05E9 \u05E0\u05DB\u05E9\u05DC\u05D4: " +
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
          ? "\u05D9\u05D5\u05E6\u05E8 \u05DE\u05E9\u05EA\u05DE\u05E9\u2026"
          : "\u05D9\u05E6\u05D9\u05E8\u05EA \u05DE\u05E9\u05EA\u05DE\u05E9",
      ),
    ),
  );
}
function ot({ users: t, groups: s, currentUserId: a }) {
  let [l, i] = b(""),
    [c, n] = b(null),
    [m, o] = b(!1),
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
        s.filter((grp) => grp.coachId === u.id).forEach((grp) => {
          batch.update(S(P, "groups", grp.id), { coachId: "" });
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
          "\u05D0\u05D9 \u05D0\u05E4\u05E9\u05E8 \u05DC\u05D4\u05D5\u05E8\u05D9\u05D3 \u05DC\u05E2\u05E6\u05DE\u05DA \u05D0\u05EA \u05D4\u05E8\u05E9\u05D0\u05EA \u05D4\u05DE\u05E0\u05D4\u05DC \u2014 \u05D0\u05D7\u05E8\u05EA \u05EA\u05D9\u05D7\u05E1\u05DD \u05DE\u05D4\u05DE\u05E2\u05E8\u05DB\u05EA.",
        );
        return;
      }
      (n(u.id), i(""));
      try {
        await O(S(P, "users", u.id), { role: f });
      } catch (g) {
        i(
          "\u05E2\u05D3\u05DB\u05D5\u05DF \u05E0\u05DB\u05E9\u05DC: " +
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
      " \u05D4\u05D5\u05E1\u05E4\u05EA \u05DE\u05E9\u05EA\u05DE\u05E9",
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
        "\u05DE\u05E9\u05EA\u05DE\u05E9\u05D9\u05DD \u05D5\u05EA\u05E4\u05E7\u05D9\u05D3\u05D9\u05DD",
      ),
      e.createElement(
        "div",
        {
          className:
            "bg-white rounded-xl border border-slate-200 divide-y divide-slate-100",
        },
        t.map((u) => {
          let f = s.filter((r) => r.coachId === u.id),
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
                "\u05DE\u05E0\u05D4\u05DC",
              ),
              e.createElement(
                "option",
                { value: "Coach" },
                "\u05DE\u05D0\u05DE\u05DF",
              ),
            ),
            e.createElement(
              "div",
              { className: "flex-1 text-right" },
              e.createElement(
                "div",
                { className: "text-sm font-medium text-blue-950" },
                u.name,
                u.id === a ? " (\u05D0\u05EA\u05D4)" : "",
              ),
              e.createElement(
                "div",
                { className: "text-xs text-slate-400" },
                u.role === "Admin"
                  ? "\u05D2\u05D9\u05E9\u05D4 \u05DE\u05DC\u05D0\u05D4 \u05DC\u05DB\u05DC \u05D4\u05E7\u05D1\u05D5\u05E6\u05D5\u05EA"
                  : f.length > 0
                    ? f.map((r) => r.name).join(", ")
                    : "\u05DC\u05D0 \u05E9\u05D5\u05D9\u05DB\u05D4 \u05E7\u05D1\u05D5\u05E6\u05D4",
              ),
            ),
            u.role === "Coach" &&
              e.createElement(
                "button",
                {
                  onClick: () => handleDeleteCoach(u),
                  disabled: deletingCoachId === u.id,
                  className:
                    "w-8 h-8 rounded-full bg-red-50 flex items-center justify-center shrink-0 disabled:opacity-50",
                  "aria-label": "\u05DE\u05D7\u05D9\u05E7\u05EA \u05DE\u05D0\u05DE\u05DF",
                },
                e.createElement(Se, { className: "w-4 h-4 text-red-500" }),
              ),
          );
        }),
        t.length === 0 &&
          e.createElement(
            "p",
            { className: "text-center text-xs text-slate-400 py-4" },
            "\u05D0\u05D9\u05DF \u05DE\u05E9\u05EA\u05DE\u05E9\u05D9\u05DD",
          ),
      ),
    ),
    e.createElement(
      "div",
      { className: "flex flex-col gap-2" },
      e.createElement(
        "h3",
        { className: "text-sm font-semibold text-slate-500 px-1" },
        "\u05E9\u05D9\u05D5\u05DA \u05DE\u05D0\u05DE\u05E0\u05D9\u05DD \u05DC\u05E7\u05D1\u05D5\u05E6\u05D5\u05EA",
      ),
      e.createElement(
        "div",
        {
          className:
            "bg-white rounded-xl border border-slate-200 divide-y divide-slate-100",
        },
        s.map((u) =>
          e.createElement(
            "div",
            {
              key: u.id,
              className: "px-4 py-3 flex items-center justify-between gap-2",
            },
            e.createElement(
              "select",
              {
                value: u.coachId || "",
                onChange: async (f) => {
                  i("");
                  try {
                    await O(S(P, "groups", u.id), { coachId: f.target.value });
                  } catch (g) {
                    i(
                      "\u05E2\u05D3\u05DB\u05D5\u05DF \u05E0\u05DB\u05E9\u05DC: " +
                        g.message,
                    );
                  }
                },
                className:
                  "border border-slate-200 rounded-lg py-1.5 px-2 text-xs bg-white outline-none",
              },
              e.createElement(
                "option",
                { value: "" },
                "\u2014 \u05DC\u05DC\u05D0 \u2014",
              ),
              t
                .filter((f) => f.role === "Coach" || f.role === "Admin")
                .map((f) =>
                  e.createElement("option", { key: f.id, value: f.id }, f.name),
                ),
            ),
            e.createElement(
              "span",
              {
                className:
                  "text-sm font-medium text-blue-950 text-right flex-1",
              },
              u.name,
            ),
          ),
        ),
        s.length === 0 &&
          e.createElement(
            "p",
            { className: "text-center text-xs text-slate-400 py-4" },
            "\u05D0\u05D9\u05DF \u05E7\u05D1\u05D5\u05E6\u05D5\u05EA \u05E2\u05D3\u05D9\u05D9\u05DF",
          ),
      ),
    ),
    m && e.createElement(rt, { onClose: () => o(!1) }),
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
          a ? "\u05DE\u05E0\u05D4\u05DC" : "\u05DE\u05D0\u05DE\u05DF",
        ),
      ),
      e.createElement(
        "nav",
        { className: "flex-1 py-2 overflow-y-auto" },
        (a
          ? [
              {
                key: "dashboard",
                label: "\u05D3\u05E9\u05D1\u05D5\u05E8\u05D3",
                icon: le,
              },
              {
                key: "attendance",
                label:
                  "\u05DE\u05D9\u05DC\u05D5\u05D9 \u05E0\u05D5\u05DB\u05D7\u05D5\u05EA",
                icon: Z,
              },
              {
                key: "groups",
                label:
                  "\u05E0\u05D9\u05D4\u05D5\u05DC \u05E7\u05D1\u05D5\u05E6\u05D5\u05EA",
                icon: H,
              },
              {
                key: "phonebook",
                label:
                  "\u05E1\u05E4\u05E8 \u05D8\u05DC\u05E4\u05D5\u05E0\u05D9\u05DD",
                icon: se,
              },
              {
                key: "reports",
                label: "\u05D3\u05D5\u05D7\u05D5\u05EA",
                icon: ReportsIcon,
              },
              {
                key: "permissions",
                label:
                  "\u05E0\u05D9\u05D4\u05D5\u05DC \u05D4\u05E8\u05E9\u05D0\u05D5\u05EA",
                icon: Ie,
              },
              {
                key: "import",
                label:
                  "\u05D9\u05D9\u05D1\u05D5\u05D0 \u05E9\u05D7\u05E7\u05E0\u05D9\u05DD",
                icon: K,
              },
            ]
          : [
              {
                key: "attendance",
                label:
                  "\u05DE\u05D9\u05DC\u05D5\u05D9 \u05E0\u05D5\u05DB\u05D7\u05D5\u05EA",
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
          "\u05D9\u05E6\u05D9\u05D0\u05D4",
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
        let p = Te(P);
        (n.forEach((w) => {
          let k = S(P, "attendance", `${m}_${t.id}_${w.id}`);
          p.set(k, {
            date: m,
            playerId: w.id,
            groupId: t.id,
            status: x[w.id] || "Present",
            markedBy: s.id,
          });
        }),
          await p.commit(),
          f(!1));
      } catch (p) {
        N(
          "\u05D4\u05E9\u05DE\u05D9\u05E8\u05D4 \u05E0\u05DB\u05E9\u05DC\u05D4: " +
            p.message,
        );
      } finally {
        r(!1);
      }
    },
    I = n.filter((p) => x[p.id] === "Present").length;
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
        "\u05D7\u05D6\u05E8\u05D4 \u05DC\u05E8\u05E9\u05D9\u05DE\u05EA \u05D4\u05E7\u05D1\u05D5\u05E6\u05D5\u05EA",
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
            ? "\u05E0\u05E9\u05DE\u05E8 \u05DC\u05D4\u05D9\u05D5\u05DD \u2713"
            : "\u05D8\u05E8\u05DD \u05E0\u05E9\u05DE\u05E8",
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
          "\u05D4\u05D2\u05D9\u05E2\u05D5 ",
          I,
          " \u05DE\u05EA\u05D5\u05DA ",
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
          "\u05E1\u05DE\u05DF \u05D0\u05EA \u05DB\u05D5\u05DC\u05DD \u05DB\u05DC\u05D0 \u05D4\u05D2\u05D9\u05E2\u05D5",
        ),
        e.createElement(
          "button",
          {
            onClick: () => d("Present"),
            className:
              "bg-white border border-emerald-200 text-emerald-700 rounded-xl py-2.5 text-sm font-medium",
          },
          "\u05E1\u05DE\u05DF \u05D0\u05EA \u05DB\u05D5\u05DC\u05DD \u05DB\u05D4\u05D2\u05D9\u05E2\u05D5",
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
          k = Qe(l, p.id);
        return e.createElement(
          "div",
          { key: p.id, className: "px-3 py-3 flex items-center gap-2" },
          e.createElement(
            "div",
            { className: "flex-1 text-right min-w-0" },
            e.createElement(
              "div",
              { className: "text-sm font-medium text-blue-950 truncate" },
              p.name,
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
              "\u05D4\u05D2\u05D9\u05E2",
            ),
            e.createElement(
              "button",
              {
                onClick: () => C(p.id, "Absent"),
                disabled: !u,
                className: `min-w-[44px] min-h-[44px] px-3 rounded-lg text-xs font-semibold border transition-colors ${w === "Absent" ? "bg-red-500 text-white border-red-500" : "bg-white text-slate-400 border-slate-200"} ${u ? "active:scale-95" : "opacity-70"}`,
              },
              "\u05DC\u05D0 \u05D4\u05D2\u05D9\u05E2",
            ),
          ),
          k &&
            e.createElement(Re, {
              player: p,
              onOpenWhatsapp: (v) =>
                WA
                  ? WA(v)
                  : window.open(
                      ne(normalizePhone(v.parentPhone), Ve(v.parentName, v.name)),
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
                    `\u05DC\u05D4\u05E2\u05D1\u05D9\u05E8 \u05D0\u05EA ${p.name} \u05DC\u05D0\u05E8\u05DB\u05D9\u05D5\u05DF? \u05D4\u05D4\u05D9\u05E1\u05D8\u05D5\u05E8\u05D9\u05D4 \u05E9\u05DC\u05D5 \u05EA\u05D9\u05E9\u05DE\u05E8.`,
                  ) && c(p.id);
                },
                className:
                  "min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-300 shrink-0",
                "aria-label":
                  "\u05D4\u05E2\u05D1\u05E8\u05D4 \u05DC\u05D0\u05E8\u05DB\u05D9\u05D5\u05DF",
              },
              e.createElement(Ae, { className: "w-4 h-4" }),
            ),
        );
      }),
      n.length === 0 &&
        e.createElement(
          "p",
          { className: "text-center text-xs text-slate-400 py-6" },
          "\u05D0\u05D9\u05DF \u05E9\u05D7\u05E7\u05E0\u05D9\u05DD \u05E4\u05E2\u05D9\u05DC\u05D9\u05DD \u05D1\u05E7\u05D1\u05D5\u05E6\u05D4 \u05D6\u05D5",
        ),
    ),
    y &&
      e.createElement("p", { className: "text-xs text-red-600 text-right" }, y),
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
              ? "\u05E9\u05D5\u05DE\u05E8\u2026"
              : "\u05E9\u05DE\u05D9\u05E8\u05EA \u05E0\u05D5\u05DB\u05D7\u05D5\u05EA",
          )
        : e.createElement(
            "button",
            {
              onClick: () => f(!0),
              className:
                "w-full bg-blue-900 text-white font-semibold rounded-xl py-3.5 active:scale-[0.98] transition-transform shadow-lg",
            },
            "\u05E2\u05E8\u05D9\u05DB\u05D4 \u05DE\u05D7\u05D3\u05E9",
          ),
    ),
  );
}
function mt({
  profile: t,
  groups: s,
  players: a,
  attendance: l,
  isAdmin: i,
  onEditPlayer: EP,
  onWhatsapp: WA,
  onAddPlayer: AP,
  selectedGroupId: SG,
  onSelectGroup: onSelectGroup,
}) {
  let c = i ? s : s.filter((r) => r.coachId === t.id),
    myAlerts = absenceAlerts(
      a,
      s,
      l,
      c.map((r) => r.id),
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
          ? '\u05D0\u05D9\u05DF \u05E2\u05D3\u05D9\u05D9\u05DF \u05E7\u05D1\u05D5\u05E6\u05D5\u05EA. \u05D4\u05D5\u05E1\u05E3 \u05E7\u05D1\u05D5\u05E6\u05D4 \u05D1\u05DE\u05E1\u05DA "\u05E0\u05D9\u05D4\u05D5\u05DC \u05E7\u05D1\u05D5\u05E6\u05D5\u05EA".'
          : "\u05DC\u05D0 \u05E9\u05D5\u05D9\u05DB\u05D4 \u05D0\u05DC\u05D9\u05DA \u05E7\u05D1\u05D5\u05E6\u05D4 \u05E2\u05D3\u05D9\u05D9\u05DF. \u05E4\u05E0\u05D4 \u05DC\u05DE\u05E0\u05D4\u05DC \u05D4\u05DE\u05D5\u05E2\u05D3\u05D5\u05DF.",
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
        )
      : e.createElement(
          "div",
          { className: "px-4 pt-4 pb-6 flex flex-col gap-3" },
          e.createElement(AlertsCard, {
            alerts: myAlerts,
            onWhatsapp: WA,
            onEdit: EP,
          }),
          e.createElement(
            "p",
            { className: "text-xs text-slate-500 px-1" },
            "\u05D1\u05D7\u05E8 \u05E7\u05D1\u05D5\u05E6\u05D4 \u05DB\u05D3\u05D9 \u05DC\u05DE\u05DC\u05D0 \u05E0\u05D5\u05DB\u05D7\u05D5\u05EA",
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
                  ? "\u05E0\u05E9\u05DE\u05E8"
                  : "\u05D8\u05E8\u05DD \u05E0\u05E9\u05DE\u05E8",
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
                      "\xB7 \u05D4\u05D9\u05D5\u05DD",
                    ),
                ),
                e.createElement(
                  "div",
                  { className: "text-xs text-slate-400 truncate" },
                  q(r),
                  " \xB7 ",
                  C,
                  " \u05E9\u05D7\u05E7\u05E0\u05D9\u05DD",
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
      "\u05D0\u05D9\u05DF \u05D7\u05D9\u05D1\u05D5\u05E8 \u05DC\u05D0\u05D9\u05E0\u05D8\u05E8\u05E0\u05D8 \u2014 \u05D0\u05E4\u05E9\u05E8 \u05DC\u05D4\u05DE\u05E9\u05D9\u05DA \u05DC\u05E1\u05DE\u05DF \u05E0\u05D5\u05DB\u05D7\u05D5\u05EA, \u05D5\u05D4\u05E0\u05EA\u05D5\u05E0\u05D9\u05DD \u05D9\u05E1\u05D5\u05E0\u05DB\u05E8\u05E0\u05D5 \u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9\u05EA \u05DB\u05E9\u05D4\u05D7\u05D9\u05D1\u05D5\u05E8 \u05D9\u05D7\u05D6\u05D5\u05E8.",
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
    openWhatsapp = (player) => setWaPlayer(player),
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
      e.createElement("div", {
        className:
          "w-10 h-10 border-2 border-blue-400 border-t-transparent rounded-full animate-spin",
      }),
      e.createElement(
        "span",
        { className: "text-blue-300 text-sm" },
        "\u05D8\u05D5\u05E2\u05DF\u2026",
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
              "\u05D4\u05D4\u05EA\u05D7\u05D1\u05E8\u05D5\u05EA \u05D4\u05E6\u05DC\u05D9\u05D7\u05D4, \u05D0\u05D1\u05DC \u05DB\u05DC\u05DC\u05D9 \u05D4\u05D0\u05D1\u05D8\u05D7\u05D4 \u05E9\u05DC Firestore \u05D7\u05D5\u05E1\u05DE\u05D9\u05DD \u05D0\u05EA \u05E7\u05E8\u05D9\u05D0\u05EA \u05D4\u05E4\u05E8\u05D5\u05E4\u05D9\u05DC.",
            ),
            e.createElement(
              "p",
              { className: "text-blue-300 text-xs leading-relaxed" },
              "\u05D9\u05E9 \u05DC\u05E4\u05E8\u05E1\u05DD \u05D0\u05EA \u05DB\u05DC\u05DC\u05D9 \u05D4\u05D0\u05D1\u05D8\u05D7\u05D4 \u05D1\u05E7\u05D5\u05E0\u05E1\u05D5\u05DC\u05D4 (Firestore \u2192 Rules \u2192 Publish).",
            ),
          )
        : e.createElement(
            "p",
            { className: "text-white text-sm leading-relaxed" },
            "\u05D4\u05DE\u05E9\u05EA\u05DE\u05E9 \u05DE\u05D7\u05D5\u05D1\u05E8 \u05D0\u05DA \u05D0\u05D9\u05DF \u05DC\u05D5 \u05DE\u05E1\u05DE\u05DA \u05E4\u05E8\u05D5\u05E4\u05D9\u05DC \u05EA\u05D5\u05D0\u05DD \u05D1-Firestore",
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
        "\u05E0\u05E1\u05D4 \u05E9\u05D5\u05D1",
      ),
      e.createElement(
        "button",
        { onClick: () => R(D), className: "text-blue-300 text-sm underline" },
        "\u05D4\u05EA\u05E0\u05EA\u05E7\u05D5\u05EA",
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
            "aria-label": "\u05EA\u05E4\u05E8\u05D9\u05D8",
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
              dashboard: "\u05D3\u05E9\u05D1\u05D5\u05E8\u05D3",
              groups:
                "\u05E0\u05D9\u05D4\u05D5\u05DC \u05E7\u05D1\u05D5\u05E6\u05D5\u05EA",
              phonebook:
                "\u05E1\u05E4\u05E8 \u05D8\u05DC\u05E4\u05D5\u05E0\u05D9\u05DD",
              permissions:
                "\u05E0\u05D9\u05D4\u05D5\u05DC \u05D4\u05E8\u05E9\u05D0\u05D5\u05EA",
              import: "\u05D9\u05D9\u05D1\u05D5\u05D0 \u05E9\u05D7\u05E7\u05E0\u05D9\u05DD",
              reports: "\u05D3\u05D5\u05D7\u05D5\u05EA",
              attendance:
                "\u05DE\u05D9\u05DC\u05D5\u05D9 \u05E0\u05D5\u05DB\u05D7\u05D5\u05EA",
            }[m] || X,
          ),
          e.createElement(
            "div",
            { className: "text-[11px] text-blue-300 truncate" },
            s.name,
            " \xB7 ",
            r ? "\u05DE\u05E0\u05D4\u05DC" : "\u05DE\u05D0\u05DE\u05DF",
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
            : i.filter((G2) => G2.coachId === s.id).map((G2) => G2.id),
          onClose: () => setPlayerModal(null),
        }),
      waPlayer &&
        e.createElement(WhatsappModal, {
          player: waPlayer,
          onClose: () => setWaPlayer(null),
          onSent: () => {
            let dates = lastTwoAbsences(n, waPlayer.id);
            dates &&
              markAlertHandled(waPlayer.id, dates[0]).catch((err) =>
                console.warn("Alert handling not saved:", err),
              );
          },
        }),
    ),
  );
}
bt(document.getElementById("root")).render(xt.createElement(Q, null));
