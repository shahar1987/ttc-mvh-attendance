// ימים בלי תוכן פרסומי (חוברת הכללים): 7 באוקטובר, יום כיפור (י' תשרי) ויום הזיכרון (ד' אייר).
// יום הזיכרון זז כמו בחוק: יום העצמאות בשישי/שבת מוקדם לחמישי, ובשני נדחה לשלישי.
const heb = (ymd) => new Intl.DateTimeFormat("en-u-ca-hebrew", { timeZone: "UTC", day: "numeric", month: "long" }).format(new Date(ymd + "T12:00:00Z"));
const add = (ymd, n) => new Date(Date.parse(ymd + "T12:00:00Z") + n * 864e5).toISOString().slice(0, 10);

export function memorialDay(year) {
  for (let d = `${year}-04-01`; d < `${year}-06-01`; d = add(d, 1)) {
    if (heb(d) !== "4 Iyar") continue;
    const shift = { 4: -1, 5: -2, 0: 1 }[new Date(d + "T12:00:00Z").getUTCDay()] || 0;
    return add(d, shift);
  }
  return "";
}

// "YYYY-MM-DD" → שם היום הרגיש, או "" ביום רגיל
export function sensitiveDay(ymd) {
  if (ymd.slice(5) === "10-07") return "7 באוקטובר";
  if (heb(ymd) === "10 Tishri") return "יום כיפור";
  if (ymd === memorialDay(ymd.slice(0, 4))) return "יום הזיכרון";
  return "";
}
