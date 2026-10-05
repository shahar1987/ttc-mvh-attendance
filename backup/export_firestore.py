#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
גיבוי יומי של נתוני המועדון מ-Firestore.

כל אוסף נשמר לקובץ קבוע שנדרס בכל הרצה.
ההיסטוריה נשמרת ב-git — ראה README בריפו הגיבויים.

מייצא את כל האוספים שבשורש המסד (db.collections()), ותמיד גם את ארבעת
האוספים הקריטיים שלמטה — גם אם אחד מהם ריק ולכן לא מופיע ברשימה.
סודות לא נכנסים לגיבוי: האוסף agentReports (תפעולי, נבנה מחדש, ויש בו טוקנים)
לא מיוצא בכלל, וכל שדה ששמו מכיל token/secret/password/apikey מוחלף ב-"[redacted]".

הגנה מפני דריסת גיבוי טוב בגיבוי חסר: אם קיים _summary.json של הלילה הקודם
(PREVIOUS_SUMMARY), והמספר של אוסף גדול ירד ביותר מ-20% — נכשלים, ושלב
הדחיפה ב-backup.yml לא רץ. ירידה מכוונת (מחיקה המונית) — להריץ ידנית עם
allow_drop (BACKUP_ALLOW_DROP=1).

הרצה:  python backup/export_firestore.py <output_dir>
דורש:  GOOGLE_APPLICATION_CREDENTIALS מצביע ל-service account JSON
רשות:  PREVIOUS_SUMMARY=<path to last night's _summary.json>, BACKUP_ALLOW_DROP=1
"""
import json
import os
import re
import sys
from datetime import datetime
from zoneinfo import ZoneInfo

from google.cloud import firestore

# האוספים שאי אפשר לשחזר אם יאבדו
COLLECTIONS = ["attendance", "cancellations", "players", "tournaments"]  # tournaments — מערכת "תן לי שולחן"

# ירידה של יותר מ-20% במספר המסמכים נחשבת תקלה — רק באוספים שהיו בהם לפחות
# MIN_DOCS_FOR_DROP_CHECK מסמכים, כי באוספים קטנים (תורים, בקשות) תנודה כזו רגילה.
MAX_DROP = 0.20
MIN_DOCS_FOR_DROP_CHECK = 50

# לא מגבים: agentReports תפעולי ושמורים בו טוקנים (גוגל, דף הפייסבוק);
# invites — מזהה המסמך הוא קישור הזמנה חי; adminTasks — בקשות סיסמה זמניות.
EXCLUDED = {"agentReports", "invites", "adminTasks"}

# שדות שהערך שלהם לא נכנס לגיבוי (בכל עומק). כולל fcmToken — האפליקציה יוצרת אותו מחדש,
# ו-inviteToken ב-users/links — הפניה בלבד; ההזמנה עצמה נשמרת באוסף invites לפי המזהה.
SENSITIVE_KEY = re.compile(r"token|secret|password|apikey", re.IGNORECASE)
REDACTED = "[redacted]"


def redact(value):
    """מחזיר עותק שבו כל ערך של שדה רגיש הוחלף ב-REDACTED, ואת מספר השדות שהוחלפו."""
    if isinstance(value, dict):
        out, n = {}, 0
        for k, v in value.items():
            if SENSITIVE_KEY.search(str(k)):
                out[k] = REDACTED
                n += 1
            else:
                out[k], m = redact(v)
                n += m
        return out, n
    if isinstance(value, list):
        out, n = [], 0
        for v in value:
            r, m = redact(v)
            out.append(r)
            n += m
        return out, n
    return value, 0


def serialise(value):
    """Firestore מחזיר טיפוסים ש-json לא יודע לכתוב; ממירים למחרוזות."""
    if isinstance(value, dict):
        return {k: serialise(v) for k, v in value.items()}
    if isinstance(value, list):
        return [serialise(v) for v in value]
    if hasattr(value, "isoformat"):
        return value.isoformat()
    # הפניה למסמך אחר — נשמרת כנתיב ("players/abc"), לא כ-repr של האובייקט
    if type(value).__name__ in ("DocumentReference", "AsyncDocumentReference") and hasattr(value, "path"):
        return value.path
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return str(value)


def export_collection(db, name):
    """מחזיר (מסמכים, מספר השדות שהוסתרו)."""
    data, hidden = {}, 0
    for doc in db.collection(name).stream():
        data[doc.id], n = redact(serialise(doc.to_dict()))
        hidden += n
    return data, hidden


def collection_names(db):
    """כל האוספים בשורש, ותמיד גם הקריטיים. ממוין כדי שהסדר יהיה קבוע."""
    names = set(COLLECTIONS)
    names.update(c.id for c in db.collections())
    return sorted(names - EXCLUDED)


def count_drops(previous, current):
    """אוספים שמספר המסמכים בהם ירד ביותר מ-MAX_DROP לעומת הלילה הקודם."""
    drops = []
    for name, before in (previous or {}).items():
        if name in EXCLUDED or not isinstance(before, int) or before < MIN_DOCS_FOR_DROP_CHECK:
            continue
        now = current.get(name, 0)
        if not isinstance(now, int):
            continue  # אוסף שנכשל מדווח בנפרד
        if now < before * (1 - MAX_DROP):
            drops.append(f"{name}: {before} -> {now}")
    return drops


def load_previous_counts(path):
    if not path or not os.path.exists(path):
        return None
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh).get("counts") or None
    except (OSError, ValueError) as exc:
        print(f"אזהרה: לא הצלחתי לקרוא את הסיכום הקודם ({exc})", file=sys.stderr)
        return None


def main():
    out_dir = sys.argv[1] if len(sys.argv) > 1 else "backup-out"
    os.makedirs(out_dir, exist_ok=True)

    db = firestore.Client()

    # שעון ישראל — לא UTC, וכולל מעבר שעון קיץ/חורף
    israel_now = datetime.now(ZoneInfo("Asia/Jerusalem"))
    summary = {
        "date": israel_now.strftime("%Y-%m-%d"),
        "generatedAt": israel_now.isoformat(),
        "counts": {},
        "excluded": sorted(EXCLUDED),
        "redactedFields": {},
    }

    failed = []
    previous = load_previous_counts(os.environ.get("PREVIOUS_SUMMARY"))
    try:
        names = collection_names(db)
    except Exception as exc:              # רשימת האוספים נכשלה — לפחות הקריטיים
        print(f"שגיאה ברשימת האוספים: {exc}", file=sys.stderr)
        names = list(COLLECTIONS)
        failed.append("(collections list)")

    for name in names:
        try:
            data, hidden = export_collection(db, name)
        except Exception as exc:          # אוסף שנכשל לא יפיל את השאר
            print(f"שגיאה ביצוא {name}: {exc}", file=sys.stderr)
            summary["counts"][name] = f"ERROR: {exc}"
            failed.append(name)
            continue

        # sort_keys כדי ש-git diff יראה רק שינויים אמיתיים ולא סדר משתנה
        with open(os.path.join(out_dir, f"{name}.json"), "w", encoding="utf-8") as fh:
            json.dump(data, fh, ensure_ascii=False, indent=1, sort_keys=True)
        summary["counts"][name] = len(data)
        if hidden:
            summary["redactedFields"][name] = hidden
        print(f"{name}: {len(data)} מסמכים" + (f" ({hidden} שדות רגישים הוסתרו)" if hidden else ""))

    with open(os.path.join(out_dir, "_summary.json"), "w", encoding="utf-8") as fh:
        json.dump(summary, fh, ensure_ascii=False, indent=1)

    # גיבוי ריק של נוכחות הוא כמעט תמיד תקלה. עדיף להיכשל
    # ברעש מלדרוס גיבוי תקין בקובץ ריק.
    att = summary["counts"].get("attendance")
    if isinstance(att, int) and att == 0:
        print("אזהרה: אפס רשומות נוכחות — נראה כמו תקלה", file=sys.stderr)
        sys.exit(1)
    if failed:
        print(f"אוספים שנכשלו: {', '.join(failed)}", file=sys.stderr)
        sys.exit(1)

    drops = count_drops(previous, summary["counts"])
    if drops:
        print("ירידה חדה במספר המסמכים לעומת הלילה הקודם:", file=sys.stderr)
        for line in drops:
            print(f"  {line}", file=sys.stderr)
        if os.environ.get("BACKUP_ALLOW_DROP") == "1":
            print("BACKUP_ALLOW_DROP=1 — ממשיכים בכל זאת", file=sys.stderr)
        else:
            print("הגיבוי הקודם לא נדרס. אם המחיקה מכוונת — להריץ ידנית עם allow_drop.", file=sys.stderr)
            sys.exit(1)

    print("\nהיצוא הסתיים בהצלחה")


if __name__ == "__main__":
    main()
