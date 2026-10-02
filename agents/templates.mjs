// תבניות הודעות הוואטסאפ של הסוכנים.
//
// הודעה שהעסק יוזם (להורה, או לשולה כשהיא לא כתבה לבוט ב-24 השעות האחרונות)
// חייבת לצאת מתבנית ש-Meta אישרה מראש. setup.mjs מגיש את כולן לאישור.
// כללי Meta: משתנה ({{1}}) לא בתחילת ההודעה ולא בסופה, ובלי ירידות שורה בתוך משתנה.
//
// הנוסחים קרובים ככל האפשר להודעות שהמאמנים שולחים היום מהאפליקציה (absenceMsg, Ve ב-part-a.js).

export const CLUB = "מועדון טניס שולחן מבואות החרמון";
const SIGNATURE = `צוות ${CLUB}`;

export const TEMPLATES = {
  // היעדרות אחת — להורה. {{1}}="בנכם דני לא הגיע", {{2}}="ביום שלישי, 29 בספטמבר"
  club_absence_child: {
    category: "UTILITY",
    body: `שלום, ראינו ש{{1}} לאימון {{2}}.\nנשמח לדעת שהכל בסדר.\nנתראה באימון הבא!\n${SIGNATURE}`,
    example: ["בנכם דני לא הגיע", "ביום שלישי, 29 בספטמבר"],
  },
  // היעדרות אחת — לשחקן מבוגר. {{1}}=שם, {{2}}=מתי
  club_absence_adult: {
    category: "UTILITY",
    body: `שלום {{1}}, ראינו שלא הגעת לאימון {{2}}.\nנשמח לדעת שהכל בסדר.\nנתראה באימון הבא!\n${SIGNATURE}`,
    example: ["דני", "ביום שלישי, 29 בספטמבר"],
  },
  // שתי היעדרויות ברצף — להורה. {{1}}="בנכם דני לא הגיע"
  club_missed_two_child: {
    category: "UTILITY",
    body: `שלום, שמנו לב ש{{1}} לשני האימונים האחרונים.\nהכל בסדר? נשמח לדעת אם יש משהו שאפשר לעזור בו.\n${SIGNATURE}`,
    example: ["בנכם דני לא הגיע"],
  },
  // שתי היעדרויות ברצף — לשחקן מבוגר. {{1}}=שם
  club_missed_two_adult: {
    category: "UTILITY",
    body: `שלום {{1}}, שמנו לב שלא הגעת לשני האימונים האחרונים.\nהכל בסדר? נשמח לדעת אם צריך משהו.\n${SIGNATURE}`,
    example: ["דני"],
  },
  // למאמן שלא מילא נוכחות (worker/src/reminders.js). {{1}}=שם המאמן, {{2}}=שם הקבוצה
  coach_attendance_reminder: {
    category: "UTILITY",
    body: `היי {{1}}, תזכורת ידידותית למלא נוכחות עבור קבוצת {{2}} להיום.\nתודה!\n${SIGNATURE}`,
    example: ["דני", "מתחילים"],
  },
  // הודעה שהבעלים הכתיב לשולה (worker/src/messages.js). {{1}}=הנוסח, בשורה אחת
  club_message: {
    category: "UTILITY",
    body: `הודעה מ${CLUB}:\n{{1}}\n${SIGNATURE}`,
    example: ["האימון מחר מתחיל ב-18:00 במקום 17:30"],
  },
  // לשולה: דוח הבוקר כשחלון 24 השעות סגור. {{1}}=סיכום בשורה אחת
  agent_daily_report: {
    category: "UTILITY",
    body: `דוח הבוקר של סוכני המועדון:\n{{1}}\nלפרטים או לאישור שליחת הודעות, אפשר להשיב להודעה הזו.`,
    example: ["3 נעדרים ממתינים להודעה · 1 בסכנת נשירה"],
  },
  // לשולה: התראה מהמפקח או מבודק הבאגים. {{1}}=מה קרה בשורה אחת
  agent_alert: {
    category: "UTILITY",
    body: `התראה ממערכת הסוכנים של המועדון:\n{{1}}\nלפרטים אפשר להשיב להודעה הזו.`,
    example: ["הסורק היומי לא רץ הבוקר"],
  },
};

// הפרמטרים של הודעה להורה/לשחקן, לפי סוג ההתראה. item מגיע מ-analysis.mjs.
export function absenceTemplate(item) {
  const who = item.gender === "f" ? `בתכם ${item.playerName} לא הגיעה` : `בנכם ${item.playerName} לא הגיע`;
  if (item.kind === "repeat") {
    return item.adult
      ? { name: "club_missed_two_adult", params: [item.playerName] }
      : { name: "club_missed_two_child", params: [who] };
  }
  return item.adult
    ? { name: "club_absence_adult", params: [item.playerName, item.whenText] }
    : { name: "club_absence_child", params: [who, item.whenText] };
}

// הטקסט המלא של התבנית אחרי מילוי — כדי להראות לשולה בדיוק מה ייצא.
export function renderTemplate(name, params) {
  return TEMPLATES[name].body.replace(/\{\{(\d)\}\}/g, (_, i) => params[Number(i) - 1] ?? "");
}
