# יומן החלטות — סידור הקוד (untangle, 7.11.2026)

ענף `untangle`. לא מוזג ל-main ולא נדחף. כל תיקון כתוב מעל הבעיות שהוא פותר.
בסוף: מה נשאר בכוונה, ומה מחכה להחלטה של שלום.

## תיקונים

### 1. כללי המועדון כתובים פעם אחת, ב-`agents/lib`, והאפליקציה מייבאת אותם במקום להעתיק
האפליקציה נבנית ב-esbuild, כך שהיא יכולה לייבא את `agents/lib/analysis.mjs` ו-`gender.mjs` בדיוק כמו הבוט והסוכנים.
- `part-a.js` העתיק ביד את `skipAbsenceMsg`, `lastTwoAbsences`, `onlyHeldTrainings`, `isAdultGroup`, `normalizePhone`, `isValidPhone`, `guessGender`, `playerGender` מ-`agents/lib` (או להפך), עם הערות "שינוי — לשנות גם שם".
- `analysis-equivalence.test.mjs` ו-CLAUDE.md קיימים רק כדי לשמור על ההעתקים; הבדיקה שולפת פונקציות מטקסט המקור ומדלגת על עצמה כשהקובץ חסר.
- `agents/lib/analysis.mjs` בנה "שתי היעדרויות ברצף" פעם שנייה (`twoAbsenceIndex`) לצד העותק של האפליקציה.
- מזהה מסמך הנוכחות `${date}_${groupId}_${playerId}` (החוזה המוגן) נבנה ביד ב-`part-a.js:453`, `part-b.js:3583`, `:3977`, `worker/src/tools.js:499`, `:571`.
- `onlyHeldTrainings` בונה את מפתח תאריך+קבוצה בעצמו במקום `cancellationId`, ו-analysis בונה אותו פעם שלישית.

### 2. עזרי ווב כלליים של הבוט עוברים למודול קטן ויציב (`worker/src/web.js`)
- `esc` גר ב-dashboard.js, ‏`sha256` ב-inbox.js, ‏`sign`/`issueKey`/`checkKey`/`dropKey` ב-google.js — מודולים גדולים שמשתנים הרבה, ולכן google↔dashboard ו-solar↔solar-dashboard↔solar-report מייבאים זה את זה במעגל.
- `esc` מועתק ב-join.js; עמוד HTML קצר מועתק 4 פעמים (google, meta, inbox, solar); ‏hex אקראי מועתק פעמיים.
- `solar.js:361` קורא את `bot.keys.solar.key` ישירות במקום `checkKey`.

### 3. קוד גוגל המת בבוט נמחק
- `GOOGLE_TOOL_DEFS`, `makeGoogleTools`, `DIRECT`, `connectLink` וכ-150 שורות של gmail/drive/tasks/calendar לא בשימוש; גוגל עובר דרך Claude.
- `bot.test.mjs:41-63`, `:1344` — mocks ובדיקה שלא יכולה להיכשל בגלל הקוד המת.

### 4. תוצאה של פעולה חוזרת כנתון, לא כטקסט שמישהו אחר מחפש בו
- `index.js:719` מחפש "נזרקו" בהודעת שגיאה של `queue.js:50`.
- `index.js:665`, `:704` בודקים אם `notifyOwner` החזיר מחרוזת שמתחילה ב-"skipped".
- `index.js:581` מחליט שתזכורת נשמרה לפי "⏰" בתחילת התשובה של `remind_me`.
- `supervisor.mjs:96` מחליט על קוד יציאה לפי `startsWith("בוט הוואטסאפ")`.

### 5. רשימת הסוכנים שאפשר להפעיל נמצאת במקום אחד
- `agents/requests.mjs:6`, `worker/src/dispatch.js:10`, `worker/src/tools.js:8`, `:86` — ארבע רשימות שכבר לא מסכימות: `insights` מותר ב-requests אבל לא ב-dispatch, ו-dispatch מנקה את כל התור — בקשת `insights` נזרקת בשקט (באג שהתיקון סוגר).

### 6. חיבור ל-Firestore ולמסמך הבוט — פעם אחת
- פענוח מפתח השירות מועתק ב-`admin_tool.mjs:24`, `sync_payments.mjs:455`, `name-guard.mjs:16`, `firestore_rules.mjs:9` לצד `agents/lib/firebase.mjs`.
- `agentReports/bot` נכתב ביד ב-10 מקומות ב-agents; `owner.mjs` כבר מחזיק `botDoc` אבל לא מייצא אותו.
- `send.mjs:61`, `weekly.mjs:31`, `:52` בונים פריט לתור ההודעות ביד במקום `enqueueOwner` (ו-send מדלג על חיתוך 900 התווים).

### 7. `sync_payments.mjs` ניתן לייבוא, וההעתק שלו נמחק
- הקובץ מריץ `main()` ברגע שמייבאים אותו, ולכן `match_board_members.mjs:19` העתיק את `normalisePhone`, ו-`board-members.test.mjs:14` קיים רק כדי לשמור על ההעתק.

### 8. מסלול "היעדרות אחת" המת נמחק
- מאז 5.11 `analyze` מייצר רק `repeat`; `kind:"absence"` לא נוצר לעולם, אבל נשאר ב-`autosend.mjs:18`, `:77-85`, `analysis.mjs:312`, `worker/src/tools.js:569`. ‏`summary.repeat` תמיד שווה ל-`summary.pending`.

### 9. קוד מת בכל שאר המקומות
- האפליקציה: push מת (`G = ""` ⇒ `qe` חוזר מיד, `F`/`Fe` עם מאזין ריק), ייבוא כפול/לא בשימוש, props שאף אחד לא מעביר (`st`, `AlertsCard`, `re.onArchivePlayer` — כפתור "העבר לארכיון" שלא יכול להופיע), משתנים שלא בשימוש.
- הבוט והסוכנים: יצואים שאף אחד לא מייבא, פרמטרים שלא בשימוש, עטיפות שרק מעבירות הלאה.

## נשאר בכוונה (לא שונה)
- `firestore.rules` ו-`rules-tests` — כלל בריפו: נגיעה בחוקים = עצירה, שלום מחליט.
- נוסחי ההודעות להורים: האפליקציה כותבת "שמתי לב", התבניות ב-`agents/templates.mjs` "שמנו לב". התבניות מאושרות אצל Meta בנוסח קבוע.
- `coachNames` נכתב 6 פעמים ואין לו קורא בריפו הזה — אולי לוח המועדון או אפליקציית התחרויות קוראים אותו.
- `DEFAULT_PAYMENT_MAPPINGS` (part-b) מול `sync_payments.mjs` — שניהם זורעים את אותם מסמכים; איחוד = נגיעה בנתונים.

## מחכה להחלטה של שלום (שינוי התנהגות שרואים במסך או בנתונים)
- **באג נתונים:** לחיצה על הרשאה במסך ההרשאות מוחקת למשתמש את `sendMessages` (`part-b.js:1088-1097`), וחוקי Firestore עדיין בודקים אותה.
- "שתי היעדרויות ברצף" מחושב בארבע דרכים שונות במסכים (התראות, דוח סכנת נשירה, אחרי אימון, סיכום) — אותו ילד מסומן במסך אחד ולא בשני.
- האחוז החודשי של המועדון כולל שחקנים שנמחקו, והאחוז של כל קבוצה לא.
- מסך התשלומים מציג שני פאנלים של "ילדים בכמה קבוצות" עם ספירה שונה.
- `meta.js:231` מאשר את הפוסט לפני בדיקת "ילדים בתמונה", ולכן אחרי חסימה צריך לאשר פעמיים.
- חלון השליחה האוטומטית בערב מוגדר בשלושה מקומות שלא מסכימים; אחת משתי הריצות בערב תמיד נדחית.
- תאריך התחלה קבוע `2026-09-07` בבורר התאריכים (`part-b.js:3379`) יחסום את העונה הבאה.
