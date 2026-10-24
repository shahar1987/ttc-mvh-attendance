# context-alarm

מוד ל-Claude Code שמתריע כשחלון ההקשר של השיחה מתמלא.

- מתחת ל-60%: לא מוצג כלום.
- 60%–80%: פס צהוב מעל הפרומפט עם האחוז.
- מעל 80%: פס כתום, צליל קצר פעם אחת (ב-Mac), וההודעה "הזיכרון כמעט מלא - כדאי לסכם ולפתוח צ׳אט חדש".
- `/context` מציג את האחוז הנוכחי מעל הפירוט הרגיל.

## התקנה

בטרמינל, בתוך Claude Code:

```
/plugin install context-alarm --marketplace shahar1987/ttc-mvh-attendance
```

לענות `y` להוספת ה-marketplace ולבחור scope של user.
