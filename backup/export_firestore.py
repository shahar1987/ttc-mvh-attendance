#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
גיבוי יומי של נתוני המועדון מ-Firestore.

נוכחות היא הדאטה שאי אפשר לשחזר: אם רשומה נדרסת, אין לאן לחזור.
הסקריפט מושך את כל האוספים הקריטיים ושומר אותם כ-JSON.

הרצה:  python backup/export_firestore.py <output_dir>
דורש:  GOOGLE_APPLICATION_CREDENTIALS מצביע ל-service account JSON
"""
import json
import os
import sys
from datetime import datetime, timezone, timedelta

from google.cloud import firestore

# האוספים שאי אפשר לשחזר אם יאבדו
COLLECTIONS = [
    "attendance",      # הכי קריטי — אי אפשר לשחזר נוכחות שנמחקה
    "cancellations",   # בלעדיהם אחוזי הנוכחות מעוותים
    "players",         # כולל שחקנים בארכיון
    "groups",
    "users",
]


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
    docs = {}
    for doc in db.collection(name).stream():
        docs[doc.id] = serialise(doc.to_dict())
    return docs


def main():
    out_dir = sys.argv[1] if len(sys.argv) > 1 else "backup-out"
    os.makedirs(out_dir, exist_ok=True)

    db = firestore.Client()

    # שעון ישראל — כדי ששם התיקייה יתאים ליום האמיתי ולא ל-UTC
    israel_now = datetime.now(timezone(timedelta(hours=3)))
    stamp = israel_now.strftime("%Y-%m-%d")

    summary = {"date": stamp, "generatedAt": israel_now.isoformat(), "counts": {}}
    day_dir = os.path.join(out_dir, stamp)
    os.makedirs(day_dir, exist_ok=True)

    for name in COLLECTIONS:
        try:
            data = export_collection(db, name)
        except Exception as exc:            # אוסף אחד שנכשל לא יפיל את הגיבוי כולו
            print(f"שגיאה ביצוא {name}: {exc}", file=sys.stderr)
            summary["counts"][name] = f"ERROR: {exc}"
            continue

        path = os.path.join(day_dir, f"{name}.json")
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(data, fh, ensure_ascii=False, indent=1, sort_keys=True)
        summary["counts"][name] = len(data)
        print(f"{name}: {len(data)} מסמכים")

    with open(os.path.join(day_dir, "_summary.json"), "w", encoding="utf-8") as fh:
        json.dump(summary, fh, ensure_ascii=False, indent=1)

    # בדיקת שפיות: גיבוי ריק של נוכחות הוא כמעט תמיד תקלה,
    # ועדיף שההרצה תיכשל ברעש משתידחוף גיבוי ריק על גבי הקודם.
    att = summary["counts"].get("attendance")
    if isinstance(att, int) and att == 0:
        print("אזהרה: אפס רשומות נוכחות — נראה כמו תקלה", file=sys.stderr)
        sys.exit(1)

    print(f"\nהגיבוי נשמר ב-{day_dir}")


if __name__ == "__main__":
    main()
