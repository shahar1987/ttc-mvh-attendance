#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
גיבוי יומי של נתוני המועדון מ-Firestore.

כל אוסף נשמר לקובץ קבוע שנדרס בכל הרצה.
ההיסטוריה נשמרת ב-git — ראה README בריפו הגיבויים.

הרצה:  python backup/export_firestore.py <output_dir>
דורש:  GOOGLE_APPLICATION_CREDENTIALS מצביע ל-service account JSON
"""
import json
import os
import sys
from datetime import datetime, timezone, timedelta

from google.cloud import firestore

# האוספים שאי אפשר לשחזר אם יאבדו
COLLECTIONS = ["attendance", "cancellations", "players"]


def serialise(value):
    """Firestore מחזיר טיפוסים ש-json לא יודע לכתוב; ממירים למחרוזות."""
    if isinstance(value, dict):
        return {k: serialise(v) for k, v in value.items()}
    if isinstance(value, list):
        return [serialise(v) for v in value]
    if hasattr(value, "isoformat"):
        return value.isoformat()
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return str(value)


def export_collection(db, name):
    return {doc.id: serialise(doc.to_dict()) for doc in db.collection(name).stream()}


def main():
    out_dir = sys.argv[1] if len(sys.argv) > 1 else "backup-out"
    os.makedirs(out_dir, exist_ok=True)

    db = firestore.Client()

    # שעון ישראל — לא UTC. בדיוק הבאג שיש באפליקציה עצמה.
    israel_now = datetime.now(timezone(timedelta(hours=3)))
    summary = {
        "date": israel_now.strftime("%Y-%m-%d"),
        "generatedAt": israel_now.isoformat(),
        "counts": {},
    }

    failed = []
    for name in COLLECTIONS:
        try:
            data = export_collection(db, name)
        except Exception as exc:          # אוסף שנכשל לא יפיל את השאר
            print(f"שגיאה ביצוא {name}: {exc}", file=sys.stderr)
            summary["counts"][name] = f"ERROR: {exc}"
            failed.append(name)
            continue

        # sort_keys כדי ש-git diff יראה רק שינויים אמיתיים ולא סדר משתנה
        with open(os.path.join(out_dir, f"{name}.json"), "w", encoding="utf-8") as fh:
            json.dump(data, fh, ensure_ascii=False, indent=1, sort_keys=True)
        summary["counts"][name] = len(data)
        print(f"{name}: {len(data)} מסמכים")

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

    print("\nהיצוא הסתיים בהצלחה")


if __name__ == "__main__":
    main()
