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
  // הודעה תפעולית למאמן/מנהל (במקום club_message, ש-Meta סיווגה כשיווקית ונחסמת 131049).
  // שם הנמען + "נשלח כי את/ה רשום/ה" = קשר קיים, כך Meta מסווגת כ-UTILITY. {{1}}=שם, {{2}}=הנוסח בשורה אחת
  coach_notice: {
    category: "UTILITY",
    body: `שלום {{1}}, עדכון מ${CLUB} לגבי האימונים שלך:\n{{2}}\nנשלח אליך כי את/ה רשום/ה כמאמן/ת במועדון. לשאלות אפשר להשיב כאן.`,
    example: ["דני", "מחר האימון בדפנה מתחיל ב-19:30, נא לסמן נוכחות באפליקציה"],
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

// הפרמטרים של הודעה להורה/לשחקן על שתי היעדרויות ברצף. item מגיע מ-analysis.mjs.
// בלי מין רשום באפליקציה: נוסח בלי לשון זכר או נקבה. לא נשלח דרך Meta, רק מהמספר של הבעלים, ולכן מחוץ ל-TEMPLATES
const NEUTRAL = {
  neutral_missed_two: { body: `שלום, לא ראינו את {{1}} בשני האימונים האחרונים.\nהכל בסדר? נשמח לדעת אם יש משהו שאפשר לעזור בו.\n${SIGNATURE}` },
};

export function absenceTemplate(item) {
  if (!item.adult && item.genderKnown === false) return { name: "neutral_missed_two", params: [item.playerName] };
  if (item.adult) return { name: "club_missed_two_adult", params: [item.playerName] };
  return { name: "club_missed_two_child", params: [item.gender === "f" ? `בתכם ${item.playerName} לא הגיעה` : `בנכם ${item.playerName} לא הגיע`] };
}

// הטקסט המלא של התבנית אחרי מילוי — כדי להראות לשולה בדיוק מה ייצא.
export function renderTemplate(name, params) {
  return (TEMPLATES[name] || NEUTRAL[name]).body.replace(/\{\{(\d)\}\}/g, (_, i) => params[Number(i) - 1] ?? "");
}
