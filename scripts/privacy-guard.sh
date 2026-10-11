#!/usr/bin/env bash
# שומר הפרטיות — הריפו ציבורי, אסור מספר טלפון אמיתי בשום קובץ.
# רץ ב-3 מקומות, אותו קוד: ב-Build and deploy (אחרי push ל-main), בבדיקות של PR (checks.yml),
# וב-`cd agents && npm test` — כדי שסשן שמריץ בדיקות לפני דחיפה יתפוס את זה אצלו ולא אחרי המיזוג.
# סורק את כל הקבצים בריפו (git ls-files). מחוץ לסריקה: בינאריים, קובצי lock, ונתוני גופנים של סקיל צד-שלישי.
# מותרים: מספר הדוגמה 050-1234567 ומספרי בדיקה מזויפים בולטים (1234567/7654321/1111111/1112222 או אפסים).
# מספר אמיתי (גם הציבורי של המועדון) עובר דרך משתנה סביבה / Firestore, לא דרך הקוד.
cd "$(git rev-parse --show-toplevel)" || exit 1
MATCHES=$(git ls-files -z \
  | grep -zvE '\.(png|jpe?g|gif|webp|ico|pdf|woff2?|ttf|otf|pyc)$|(^|/)package-lock\.json$|^\.claude/skills/[^/]+/scripts/data/' \
  | xargs -0 -r grep -nIoE '(\+?972[- ]?5[0-9][- ]?[0-9]{3}[- ]?[0-9]{4}|05[0-9][- ]?[0-9]{3}[- ]?[0-9]{4})' 2>/dev/null \
  | grep -vE ':(\+?972|0)5[0-9]-?(1234567|7654321|1111111|1112222|0{5}[0-9]{2})$' || true)
if [ -n "$MATCHES" ]; then
  echo "ERROR: phone-number-like values found in source files:"
  echo "$MATCHES"
  echo "Personal data must live only in Firestore or in env/secrets, never in the source code."
  exit 1
fi
echo "Privacy guard passed - no phone numbers in source."
