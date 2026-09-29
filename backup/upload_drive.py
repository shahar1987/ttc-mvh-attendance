#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
מעתיק את קבצי הגיבוי לתיקייה בגוגל דרייב של שולה.

ל-service account אין מקום אחסון משלו בדרייב, ולכן הוא לא יכול ליצור
קבצים חדשים — רק לדרוס קבצים קיימים ששייכים לשולה. הקבצים נוצרו פעם אחת
בתיקייה, והתיקייה משותפת עם ה-service account כעורך. גרסאות קודמות
נשמרות ב"ניהול גרסאות" של הדרייב (כ-30 יום); ההיסטוריה המלאה ב-ttc-mvh-backups.

הרצה:  python backup/upload_drive.py <dir>
דורש:  GOOGLE_APPLICATION_CREDENTIALS מצביע ל-service account JSON
"""
import json
import os
import sys

from google.auth.transport.requests import AuthorizedSession
from google.oauth2 import service_account

FOLDER_ID = "1axAKyZctWETz6jdYdoGUmgjbOUveTo6F"  # "גיבוי מועדון טניס שולחן"
API = "https://www.googleapis.com/drive/v3/files"


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else "backup-out"
    sa_path = os.environ["GOOGLE_APPLICATION_CREDENTIALS"]
    creds = service_account.Credentials.from_service_account_file(
        sa_path, scopes=["https://www.googleapis.com/auth/drive"])
    print("service account:", json.load(open(sa_path))["client_email"])
    s = AuthorizedSession(creds)

    r = s.get(API, params={"q": f"'{FOLDER_ID}' in parents and trashed=false",
                           "fields": "files(id,name)", "pageSize": 100})
    r.raise_for_status()
    in_drive = {f["name"]: f["id"] for f in r.json()["files"]}

    missing = []
    for name in sorted(os.listdir(src)):
        if not name.endswith(".json"):
            continue
        if name not in in_drive:
            missing.append(name)
            continue
        with open(os.path.join(src, name), "rb") as fh:
            r = s.patch(f"https://www.googleapis.com/upload/drive/v3/files/{in_drive[name]}",
                        params={"uploadType": "media"}, data=fh.read(),
                        headers={"Content-Type": "application/json"})
        r.raise_for_status()
        print(f"{name}: עודכן בדרייב")

    # קובץ שעוד לא נוצר בדרייב לא מפיל את הגיבוי — הוא עדיין נשמר ב-GitHub.
    if missing:
        print("אזהרה: לא בדרייב עדיין (צריך ליצור אותם בתיקייה פעם אחת):",
              ", ".join(missing), file=sys.stderr)


if __name__ == "__main__":
    main()
