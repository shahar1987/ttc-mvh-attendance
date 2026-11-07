// קובץ האקסל של הדוחות (app/report-xlsx.mjs): הבדיקה קוראת את ה-zip וה-XML שיוצאים ממנו בפועל.
import test from "node:test";
import assert from "node:assert/strict";

import { buildXlsx as build, xlsxCol, crc32 } from "../app/report-xlsx.mjs";

const buildXlsx = (doc) => build(doc, { club: "מועדון", produced: "2026-11-03" });

function unzip(u8) {
  const v = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), out = {}, dec = new TextDecoder();
  for (let p = 0; v.getUint32(p, true) === 0x04034b50; ) {
    const size = v.getUint32(p + 18, true), nl = v.getUint16(p + 26, true);
    const name = dec.decode(u8.subarray(p + 30, p + 30 + nl)), data = u8.subarray(p + 30 + nl, p + 30 + nl + size);
    assert.equal(v.getUint32(p + 14, true), crc32(data), `crc of ${name}`);
    out[name] = dec.decode(data);
    p += 30 + nl + size;
  }
  return out;
}

const doc = {
  title: "דוח <בדיקה> & \"ציטוט\"",
  period: "01.11.2026 עד 03.11.2026",
  kpis: [{ label: "נוכחות", value: "82%", tone: "good" }],
  highlights: ["נקודה"],
  tables: [
    {
      title: "נוכחות לפי שחקן",
      cols: [{ h: "שחקן" }, { h: "%", pct: true }, { h: "טלפון", sheetOnly: true }],
      rows: [["=1+1", { v: 85, tone: "good" }, "0000000"], ["ב", null, ""]],
      foot: ["נכחו", 50, ""],
    },
  ],
};

test("עמודת אקסל", () => {
  assert.deepEqual([0, 25, 26, 51, 52].map(xlsxCol), ["A", "Z", "AA", "AZ", "BA"]);
});

test("הקובץ שלם, מימין לשמאל, וכל XML תקין", () => {
  const f = unzip(buildXlsx(doc));
  assert.ok(f["[Content_Types].xml"] && f["xl/workbook.xml"] && f["xl/styles.xml"]);
  for (const [n, x] of Object.entries(f)) assert.match(x, /^<\?xml/, n);
  assert.match(f["xl/worksheets/sheet2.xml"], /rightToLeft="1"/);
  assert.match(f["xl/workbook.xml"], /sheet name="סיכום"/);
  assert.match(f["xl/workbook.xml"], /sheet name="נוכחות לפי שחקן"/);
  assert.ok(!/<workbookView[^>]*rightToLeft/.test(f["xl/workbook.xml"]), "not a valid workbookView attribute");
});

test("תוכן: בריחה, אחוז מספרי, טקסט שלא הופך לנוסחה, טלפון נשמר", () => {
  const f = unzip(buildXlsx(doc)), s = f["xl/worksheets/sheet2.xml"];
  assert.match(f["xl/worksheets/sheet1.xml"], /דוח &lt;בדיקה&gt; &amp; &quot;ציטוט&quot;/);
  assert.match(s, /<c r="B2" s="\d+"><v>0\.85<\/v><\/c>/);
  assert.match(s, /t="inlineStr"><is><t xml:space="preserve">=1\+1</);
  assert.ok(!s.includes("<f>"));
  assert.match(s, /0000000/);
  assert.match(s, /<autoFilter ref="A1:C3"\/>/);
});
