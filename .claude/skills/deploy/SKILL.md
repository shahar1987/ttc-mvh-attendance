---
name: deploy
description: כל שינוי קוד בריפו הזה שצריך להגיע ל-main ולאפליקציה החיה — עריכה בטוחה, אימות מקומי, דחיפה ואישור שה-build עבר. חובה לפני כל commit.
---

# פריסה בטוחה של מערכת הנוכחות

האפליקציה חיה ומאמנים משתמשים בה כל יום. הנתונים ב-Firestore לא נפגעים לעולם. סשנים אחרים דוחפים לריפו במקביל — main זז הרבה.

## חוקים קשיחים
- לא משנים את חוזה הכתיבה של הנוכחות: אוסף `attendance`, מזהה `${date}_${groupId}_${playerId}`, ‏`status` הוא "Present" או "Absent", נכתבים רק שחקנים שב-`touchedRef`, ‏`msgSentAt`/`msgSentBy` נשמרים ב-Absent שנשמר מחדש.
- לא עורכים חוקי Firestore בקונסולה. מכינים לשלום את הקטע המדויק להדבקה.
- הריפו ציבורי: אין שמות, טלפונים או מידע אישי בקוד (CI נכשל על תבניות 05x/972).
- לא עורכים את `bundle.js` — ‏CI בונה אותו מחדש מ-part-a.js + part-b.js, והעותק בריפו ישן.
- ‏commit ישר ל-`main`, הודעת commit בעברית, עם שורות הייחוס של הסשן.

## 1. מתחילים מ-main טרי
```bash
cd /home/claude && ( [ -d repo ] || git clone -q https://github.com/shahar1987/ttc-mvh-attendance.git repo )
cd repo && git fetch -q origin main && git reset -q --hard origin/main
git log --oneline -8 origin/main
```
קוראים את הקומיטים האחרונים לפני שמתכננים שינוי. אם סשן אחר כבר שינה את המסך שעומדים לגעת בו — בונים על הגרסה שלו. לעולם לא דוחפים עריכה מקומית ישנה מעליה.

## 2. עורכים ומאמתים מקומית
השינוי הקטן ביותר ב-part-a.js או part-b.js (בלי JSX, ‏`e.createElement`, שמות משתנים קצרים). ואז:
```bash
cat part-a.js part-b.js > /tmp/chk.js && node --check /tmp/chk.js
npm i -s esbuild@0.21.5 react@18.3.1 react-dom@18.3.1 lucide-react@0.383.0 firebase@10.12.2 --no-audit --no-fund
npx esbuild /tmp/chk.js --bundle --minify --format=esm --outfile=/tmp/app.js && stat -c%s /tmp/app.js   # חייב להיות מעל 200000
grep -nE '(\+?972[- ]?5[0-9]|05[0-9][- ]?[0-9]{3}[- ]?[0-9]{4})' part-a.js part-b.js | grep -v 050-?1234567 || echo privacy-ok
rm -rf node_modules package.json package-lock.json
git diff -- part-a.js part-b.js > patch.diff   # לשמור קטן
```
שינוי ב-`agents/` מריץ גם `cd agents && npm test`.

## 3. דוחפים
אם `git push` עובד מהסביבה הנוכחית (סשן עם הרשאת push לריפו) — דוחפים ישירות אחרי האימות ומדלגים לשלב 4.

אחרת (ה-git proxy חוסם: "not in this session's authorized repository set") — לא מנסים שוב. משתמשים בחיבור ה-GitHub של שלום ב-Composio (‏login ‏shahar1987):
1. ‏`COMPOSIO_SEARCH_TOOLS` עם session חדש — לקבל session id ולוודא ש-GitHub במצב ACTIVE.
2. ב-`COMPOSIO_REMOTE_WORKBENCH`: מושכים את הקבצים הנוכחיים מ-`main` עם `run_composio_tool("GITHUB_GET_REPOSITORY_CONTENT", ...)`‏ (base64 ב-`data.content.content`), כותבים לדיסק, מחילים את ה-patch (מוטמע base64) עם `patch -p1`, ומשווים sha256 לקובץ המקומי. אם `patch` מדווח "reversed or previously applied" או hunks נכשלים — main זז: עוצרים, חוזרים לשלב 1, ועושים את השינוי מחדש על ה-main החדש.
3. מריצים `node --check` על part-a + ה-part-b החדש בתוך ה-workbench.
4. ‏commit עם `run_composio_tool("GITHUB_COMMIT_MULTIPLE_FILES", {owner, repo, branch: "main", message, upserts: [{path, content, encoding: "utf-8"}], max_retries: 0})`. עם `max_retries: 0` מרוץ נכשל במקום לעשות rebase בשקט.
5. מושכים את הקובץ שוב ומוודאים התאמה בייט-בייט.

תוכן הקבצים עובר דרך ה-workbench, לא דרך ארגומנטים של הכלי — קובץ 200KB כמעט לא עולה טוקנים.

## 4. מאשרים את הפריסה
מחכים ~100 שניות, ואז ב-workbench (או עם gh/API): ‏`GET /repos/shahar1987/ttc-mvh-attendance/actions/runs?head_sha=<sha>`. ‏"Build and deploy" חייב להראות `completed` / `success`. בכישלון — קוראים את לוג ה-job לפני שנוגעים בכל דבר אחר.

ואז מאפסים את העותק המקומי: `git fetch -q origin main && git reset -q --hard origin/main`.

## 5. מדווחים לשלום
בעברית, קצר: מה השתנה במסך, ה-sha של הקומיט, תוצאת ה-build, ומשפט פשוט שאף נתון לא נפגע.
