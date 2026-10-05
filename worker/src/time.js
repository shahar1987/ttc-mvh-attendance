// שעון ישראל → UTC, נכון גם סביב המעבר לשעון קיץ/חורף.
// "2026-10-11T17:00" (שעון ישראל) → Date. ההיסט נבדק פעמיים: פעם בניחוש, ופעם בזמן שיצא —
// כך שעה ליד המעבר (למשל 01:30 בלילה שבו עוברים לשעון קיץ) לא יוצאת בהפרש של שעה.
const fmt = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jerusalem", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });

function offsetAt(t) {
  const p = Object.fromEntries(fmt.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(t / 1000) * 1000;
}

export function israelToUtc(local) {
  const naive = Date.parse(`${local}:00Z`);
  if (Number.isNaN(naive)) return new Date(NaN);
  let t = naive;
  for (let i = 0; i < 2; i++) t = naive - offsetAt(t);
  return new Date(t);
}
