// הועתק מ-part-a.js (guessGender) כדי שהסוכנים ינסחו הודעה בלשון הנכונה, בדיוק כמו האפליקציה.
const maleNameExceptions = [
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
const femaleNameHints = [
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
export function guessGender(name) {
  let first = String(name || "")
    .trim()
    .split(/\s+/)[0];
  if (!first) return "m";
  if (femaleNameHints.includes(first)) return "f";
  if (maleNameExceptions.includes(first)) return "m";
  return /[הת]$/.test(first) ? "f" : "m";
}
export function playerGender(p) {
  return p && (p.gender === "f" || p.gender === "m") ? p.gender : guessGender(p ? p.name : "");
}
