// איזה דף פייסבוק הוא של המועדון. המשתמש של שחר מנהל עוד דף (קפה קורטדו, גם עם אינסטגרם),
// ו-Meta מחזירה את הדפים בסדר משתנה — לכן בוחרים לפי מזהה קבוע, אף פעם לא "הראשון".
// אם דף המועדון לא נמצא מחזירים null: עדיף לא לפרסם ולא לאסוף מאשר לגעת בדף הלא נכון.
export const CLUB_PAGE_ID = "129474751033574";
export const CLUB_IG = "ttcmhr";
export const clubPage = (social) => (social?.pages || []).find((p) => p.id === CLUB_PAGE_ID || p.igName === CLUB_IG) || null;
// הטלפון הציבורי של המועדון — מופיע בכל פוסט ופלייר. ב-GitHub אין OWNER_PHONE (הסודות של הוואטסאפ רק ב-worker),
// ולכן שורת הסיום יצאה בלי מספר.
export const CLUB_PHONE = "050-4999149";
// הגיליון "לוז אימונים 2026" בדרייב — סוכן הפרסום קורא ממנו את האימונים (צריך שיתוף "כל מי שיש לו הקישור — צפייה")
export const SCHEDULE_SHEET = "1UORxS1H8NO6gQfZSMqrZj1_-IGrwxr3cCcAakE4XiTQ";
