// קובץ האקסל של הדוחות (part-a.js, ReportActionBar). פונקציות טהורות בלי React ובלי דפדפן, כדי שאפשר לבדוק אותן.
// meta = { club, produced } — שורות הכותרת בגיליון הסיכום.

export const reportCell = (c) => (c !== null && typeof c === "object" ? c : { v: c });

// קובץ xlsx נכתב ישירות: ספרייה עם עיצוב תאים שוקלת מאות KB, וזו אפליקציה שמאמן פותח באולם ברגע שהאימון מתחיל.
function xlsxEsc(s) {
  return String(s)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}
export function xlsxCol(n) {
  let s = "";
  for (n += 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}
function xlsxStyles() {
  let font = (extra, color) => `<font>${extra}<sz val="11"/><color rgb="FF${color}"/><name val="Arial"/></font>`,
    fill = (c) => `<fill><patternFill patternType="solid"><fgColor rgb="FF${c}"/></patternFill></fill>`,
    line = (t) => `<${t} style="thin"><color rgb="FFD5DCE5"/></${t}>`,
    xf = (fontId, fillId, border, numFmt, align) =>
      `<xf numFmtId="${numFmt}" fontId="${fontId}" fillId="${fillId}" borderId="${border}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="${align}" vertical="center" wrapText="${align === "right" ? 1 : 0}"/></xf>`,
    body = [[0, 0], [4, 3], [5, 4], [6, 5], [7, 0]],
    kinds = [[0, "right"], [0, "center"], [9, "center"]],
    xfs = [
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>',
      xf(2, 0, 0, 0, "right"), // 1 כותרת
      xf(1, 0, 0, 0, "right"), // 2 מודגש
      xf(7, 0, 0, 0, "right"), // 3 משני
      xf(3, 2, 1, 0, "center"), // 4 כותרת עמודה
    ];
  body.forEach(([f, b]) => kinds.forEach(([n, a]) => xfs.push(xf(f, b, 1, n, a)))); // 5-19 גוף: גוון × סוג
  kinds.forEach(([n, a]) => xfs.push(xf(1, 6, 1, n, a))); // 20-22 שורת סיכום
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="8">${font("", "1E293B")}${font("<b/>", "0B1F3A")}<font><b/><sz val="18"/><color rgb="FF0B1F3A"/><name val="Arial"/></font>${font("<b/>", "FFFFFF")}${font("<b/>", "0F6B4F")}${font("<b/>", "8A5300")}${font("<b/>", "B3261E")}${font("", "64748B")}</fonts><fills count="7"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${fill("0B1F3A")}${fill("E6F4EE")}${fill("FDF3DF")}${fill("FBE9E7")}${fill("F1F5F9")}</fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border>${line("left")}${line("right")}${line("top")}${line("bottom")}<diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join("")}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
}
const xlsxBodyStyle = (tone, kind, foot) =>
  foot ? 20 + kind : 5 + 3 * Math.max(0, ["", "good", "warn", "bad", "muted"].indexOf(tone || "")) + kind;
function xlsxCell(ref, c) {
  let v = c.v;
  if (v === null || v === void 0 || v === "") return `<c r="${ref}" s="${c.s}"/>`;
  return typeof v === "number"
    ? `<c r="${ref}" s="${c.s}"><v>${v}</v></c>`
    : `<c r="${ref}" s="${c.s}" t="inlineStr"><is><t xml:space="preserve">${xlsxEsc(v)}</t></is></c>`;
}
function xlsxSheet(rows, widths, { freeze, filter, merges, landscape } = {}) {
  let ncol = widths.length,
    pane = !freeze ? "" : freeze === 2
      ? '<pane xSplit="1" ySplit="1" topLeftCell="B2" activePane="bottomRight" state="frozen"/>'
      : '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>',
    data = rows
      .map((r, y) => `<row r="${y + 1}"${r.ht ? ` ht="${r.ht}" customHeight="1"` : ""}>${r.cells.map((c, x) => xlsxCell(xlsxCol(x) + (y + 1), c)).join("")}</row>`)
      .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView rightToLeft="1" showGridLines="0" workbookViewId="0">${pane}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="18" customHeight="1"/><cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols><sheetData>${data}</sheetData>${filter ? `<autoFilter ref="A1:${xlsxCol(ncol - 1)}${filter}"/>` : ""}${merges?.length ? `<mergeCells count="${merges.length}">${merges.map((m) => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>` : ""}<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="${landscape ? "landscape" : "portrait"}" fitToWidth="1" fitToHeight="0"/></worksheet>`;
}
function xlsxTableSheet(t, landscape) {
  let cols = t.cols,
    kind = (c) => (c.pct ? 2 : c.center ? 1 : 0),
    cellFor = (c, col, foot) => {
      let x = reportCell(c),
        pctV = x.v === null || x.v === void 0 ? "–" : x.v / 100;
      return { v: col.pct ? pctV : x.v, s: xlsxBodyStyle(x.tone, col.pct && typeof pctV === "string" ? 1 : kind(col), foot) };
    },
    rows = [{ cells: cols.map((c) => ({ v: c.h, s: 4 })), ht: 24 }]
      .concat(t.rows.map((r) => ({ cells: r.map((c, i) => cellFor(c, cols[i])) })))
      .concat(t.foot ? [{ cells: t.foot.map((c, i) => cellFor(c, cols[i], !0)) }] : []),
    widths = cols.map((c, i) =>
      c.pct ? 9 : Math.min(44, Math.max(6, ...rows.map((r) => String(r.cells[i].v ?? "").length * 1.15 + 3))),
    );
  return xlsxSheet(rows, widths, {
    freeze: cols.length > 6 ? 2 : 1,
    filter: t.rows.length ? t.rows.length + 1 : 0,
    landscape: landscape || cols.length > 6,
  });
}
function xlsxSummarySheet(doc, { club, produced }) {
  let text = (v, s) => ({ cells: [{ v, s }, { v: "", s }] }),
    rows = [
      text(doc.title, 1),
      text(club, 2),
      ...(doc.scope ? [text(doc.scope, 2)] : []),
      text(doc.period, 3),
      text(`הופק: ${produced}`, 3),
      text("", 0),
    ],
    merges = [];
  rows[0].ht = 30;
  rows.forEach((_, y) => merges.push(`A${y + 1}:B${y + 1}`));
  (doc.kpis || []).forEach((k) =>
    rows.push({ cells: [{ v: k.label, s: 5 }, { v: k.value, s: xlsxBodyStyle(k.tone, 1) }] }),
  );
  (doc.highlights || []).concat(doc.note ? [doc.note] : []).forEach((h, i) => {
    i === 0 && rows.push(text("", 0));
    rows.push({ ...text(h, 3), ht: 18 * Math.ceil(h.length / 62) });
    merges.push(`A${rows.length}:B${rows.length}`);
  });
  return xlsxSheet(rows, [34, 34], { merges });
}
export function crc32(bytes) {
  let c = -1;
  for (let i = 0; i < bytes.length; i++) {
    c ^= bytes[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (c ^ -1) >>> 0;
}
// zip בלי דחיסה: אקסל ו-Google Sheets מקבלים אותו, והקובץ קטן ממילא
function zipStore(files) {
  let enc = new TextEncoder(),
    chunks = [],
    central = [],
    offset = 0,
    head = (size) => {
      let u = new Uint8Array(size);
      return { u, v: new DataView(u.buffer) };
    };
  files.forEach(({ name, text }) => {
    let nm = enc.encode(name),
      data = enc.encode(text),
      crc = crc32(data),
      a = head(30),
      c = head(46);
    a.v.setUint32(0, 0x04034b50, !0);
    a.v.setUint16(4, 20, !0);
    a.v.setUint16(12, 0x5021, !0); // תאריך קבוע: אין לקובץ תלות בשעון
    a.v.setUint32(14, crc, !0);
    a.v.setUint32(18, data.length, !0);
    a.v.setUint32(22, data.length, !0);
    a.v.setUint16(26, nm.length, !0);
    c.v.setUint32(0, 0x02014b50, !0);
    c.v.setUint16(4, 20, !0);
    c.v.setUint16(6, 20, !0);
    c.v.setUint16(14, 0x5021, !0);
    c.v.setUint32(16, crc, !0);
    c.v.setUint32(20, data.length, !0);
    c.v.setUint32(24, data.length, !0);
    c.v.setUint16(28, nm.length, !0);
    c.v.setUint32(42, offset, !0);
    chunks.push(a.u, nm, data);
    central.push(c.u, nm);
    offset += 30 + nm.length + data.length;
  });
  let size = central.reduce((n, u) => n + u.length, 0),
    end = head(22);
  end.v.setUint32(0, 0x06054b50, !0);
  end.v.setUint16(8, files.length, !0);
  end.v.setUint16(10, files.length, !0);
  end.v.setUint32(12, size, !0);
  end.v.setUint32(16, offset, !0);
  let all = chunks.concat(central, end.u),
    out = new Uint8Array(all.reduce((n, u) => n + u.length, 0)),
    pos = 0;
  all.forEach((u) => (out.set(u, pos), (pos += u.length)));
  return out;
}
export function buildXlsx(doc, meta) {
  let used = new Set(["סיכום"]),
    sheetName = (t, i) => {
      let n = (t.title || `נתונים ${i + 1}`).replace(/[\[\]:*?/\\']/g, "").slice(0, 31);
      n = used.has(n) ? `${n.slice(0, 28)} ${i + 1}` : n;
      used.add(n);
      return n;
    },
    sheets = [{ name: "סיכום", xml: xlsxSummarySheet(doc, meta) }].concat(
      doc.tables.map((t, i) => ({ name: sheetName(t, i), xml: xlsxTableSheet(t, doc.landscape) })),
    ),
    xmlHead = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  return zipStore([
    {
      name: "[Content_Types].xml",
      text: `${xmlHead}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`,
    },
    {
      name: "_rels/.rels",
      text: `${xmlHead}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      text: `${xmlHead}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="${sheets.length > 1 ? 1 : 0}"/></bookViews><sheets>${sheets.map((s, i) => `<sheet name="${xlsxEsc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      text: `${xmlHead}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    },
    { name: "xl/styles.xml", text: xlsxStyles() },
    ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, text: s.xml })),
  ]);
}
