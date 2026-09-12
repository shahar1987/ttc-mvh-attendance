#!/usr/bin/env python3
"""
ממיר את ה-snapshot של הסקרייפר לקובץ tttm.json שהאפליקציה קוראת.

  python scraper/to_portal.py snapshot.json tttm.json

הקובץ מוגש לכל הורה שנכנס לפורטל, ולכן נשמר רזה: בלי תוצאות אישיות
לכל משחק ובלי שדות פנימיים של הסקרייפר.
"""
import datetime as dt
import json
import sys

CLUB = "הפועל מבואות חרמון"
CLUB_ID = "160"
SOURCE = "https://tttm.co.il/c/160-p/"

PLAYER_KEYS = ("tttmId", "name", "category", "rank", "teamKey", "photoUrl",
               "seasonWins", "seasonGames")
TEAM_KEYS = ("teamId", "teamKey", "name", "league", "drawName", "position",
             "played", "won", "drawn", "lost", "points", "table",
             "nextMatch", "lastResults")
MATCH_KEYS = ("matchId", "date", "time", "round", "homeName", "awayName",
              "homeScore", "awayScore", "played", "isHome", "ourTeamKey",
              "league", "drawName")
TOURNAMENT_KEYS = ("eventId", "name", "date", "venue", "registrationUntil",
                   "categories", "url")


def pick(d, keys):
    return {k: d.get(k) for k in keys if d.get(k) is not None}


def main():
    src, dst = sys.argv[1], sys.argv[2]
    with open(src, encoding="utf-8") as f:
        snap = json.load(f)

    players = []
    for p in snap.get("players", {}).values():
        out = pick(p, PLAYER_KEYS)
        # האפליקציה מציגה "נקודות" — זה ה-rating של האיגוד
        if p.get("rating") is not None:
            out["points"] = p["rating"]
        players.append(out)
    players.sort(key=lambda x: (x.get("rank") or 10**9, x.get("name", "")))

    teams = [pick(t, TEAM_KEYS) for t in snap.get("teams", [])]

    matches = [pick(m, MATCH_KEYS) for m in snap.get("matches", {}).values()]
    matches.sort(key=lambda m: (m.get("date") or "", m.get("time") or ""))

    tournaments = [pick(t, TOURNAMENT_KEYS) for t in snap.get("tournaments", [])]

    out = {
        "club": CLUB,
        "clubId": CLUB_ID,
        "source": SOURCE,
        "updatedAt": dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z"),
        "ranked": sum(1 for p in players if p.get("rank")),
        "players": players,
        "teams": teams,
        "matches": matches,
        "tournaments": tournaments,
    }

    if not players:
        raise SystemExit("no players parsed - the association page layout probably changed")

    # אם שום דבר מהותי לא השתנה, שומרים על חותמת הזמן הישנה כדי שהקובץ
    # יישאר זהה בייט-בייט ולא ייווצר קומיט מיותר בכל ריצה.
    try:
        with open(dst, encoding="utf-8") as f:
            prev = json.load(f)
        a = dict(prev); a.pop("updatedAt", None)
        b = dict(out); b.pop("updatedAt", None)
        if json.dumps(a, ensure_ascii=False, sort_keys=True) == json.dumps(b, ensure_ascii=False, sort_keys=True):
            out["updatedAt"] = prev.get("updatedAt", out["updatedAt"])
    except (OSError, ValueError):
        pass

    with open(dst, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write("\n")

    print(f"{len(players)} players ({out['ranked']} ranked), {len(teams)} teams, "
          f"{len(matches)} matches, {len(tournaments)} tournaments")


if __name__ == "__main__":
    main()
