# 📥 משימה לילית של קלוד (רצה ב-workbench של Composio): שולפת מ-Meta דרך חיבורי Composio של הבעלים את מה שלטוקן של שולה אין הרשאה אליו
# (חשיפה, עוקבים חדשים, לייקים בפייסבוק) ושולחת ל-/insights/feed. FEED_KEY מוגדר במשימה עצמה, לא כאן.

import time, json, urllib.request
from datetime import datetime, timedelta, timezone
from concurrent.futures import ThreadPoolExecutor
PAGE="129474751033574"; IGACC="instagram_their-fanion"; IGID="17841456203525107"
now=int(time.time()); DAY=86400
def data(r):
    x=(r or {}).get("data",r or {})
    return x.get("data",x) if isinstance(x,dict) else x
def day_of(end):  # ערך יומי של Meta: end_time = סוף היום
    return (datetime.fromisoformat(end.replace("+0000","+00:00"))-timedelta(days=1)).strftime("%Y-%m-%d")
errors=[]
def call(slug,args,acc=None):
    for i in range(3):
        r,e=run_composio_tool(slug,args,account=acc) if acc else run_composio_tool(slug,args)
        if not e: return r
        time.sleep(2)
    errors.append(f"{slug}: {str(e)[:120]}"); return None
series={"fbReach":{},"fbFollows":{},"igReach":{},"igFollows":{}}
# פייסבוק: חשיפה ועוקבים חדשים ליום, 400 יום, חלונות של 90
def fbwin(i):
    u=now-i*89*DAY; s=u-89*DAY
    return call("FACEBOOK_GET_PAGE_INSIGHTS",{"page_id":PAGE,"metrics":"page_total_media_view_unique,page_daily_follows_unique","period":"day","since":str(s),"until":str(u)})
def igwin(i):
    u=now-i*29*DAY; s=u-29*DAY
    return call("INSTAGRAM_GET_USER_INSIGHTS",{"metric":["reach"],"period":"day","since":s,"until":u},IGACC)
with ThreadPoolExecutor(8) as ex:
    fbs=list(ex.map(fbwin,range(5))); igs=list(ex.map(igwin,range(14)))
for r in fbs:
    for m in data(r) or []:
        k={"page_total_media_view_unique":"fbReach","page_daily_follows_unique":"fbFollows"}.get(m.get("name"))
        for v in (m.get("values") or []) if k else []:
            if isinstance(v.get("value"),(int,float)): series[k][day_of(v["end_time"])]=v["value"]
for r in igs:
    for m in data(r) or []:
        for v in m.get("values") or []:
            if isinstance(v.get("value"),(int,float)): series["igReach"][day_of(v["end_time"])]=v["value"]
r=call("INSTAGRAM_GET_USER_INSIGHTS",{"metric":["follower_count"],"period":"day","since":now-29*DAY,"until":now},IGACC)
for m in data(r) or []:
    for v in m.get("values") or []:
        if isinstance(v.get("value"),(int,float)): series["igFollows"][day_of(v["end_time"])]=v["value"]
# פייסבוק: פוסטים של 400 יום עם לייקים/תגובות/שיתופים
fbposts=[]; after=None
for _ in range(30):
    a={"page_id":PAGE,"limit":100,"since":str(now-400*DAY),"fields":"id,created_time,from,reactions.summary(true).limit(0),comments.summary(true).limit(0),shares"}
    if after: a["after"]=after
    r=call("FACEBOOK_GET_PAGE_POSTS",a)
    if not r: break
    rows=data(r) or []
    fbposts+=[p for p in rows if (p.get("from") or {}).get("id")==PAGE]
    after=(((r.get("data") or {}).get("paging") or {}).get("cursors") or {}).get("after")
    if not rows or not after or len(rows)<100: break
eng={}; hist=[]
for p in fbposts:
    l=((p.get("reactions") or {}).get("summary") or {}).get("total_count",0); c=((p.get("comments") or {}).get("summary") or {}).get("total_count",0); s=(p.get("shares") or {}).get("count",0)
    eng[p["id"]]={"likes":l,"comments":c,"shares":s}; hist.append({"at":p["created_time"],"e":l+c+s})
reach={}
recent=[p["id"] for p in fbposts if datetime.fromisoformat(p["created_time"].replace("+0000","+00:00")).timestamp()>now-31*DAY]
def fbreach(pid):
    r=call("FACEBOOK_GET_POST_INSIGHTS",{"post_id":pid,"metrics":"post_total_media_view_unique"})
    for m in data(r) or []:
        if m.get("name")=="post_total_media_view_unique": return pid,(m.get("values") or [{}])[0].get("value")
    return pid,None
# אינסטגרם: חשיפה לכל פוסט מ-31 הימים האחרונים
r=call("INSTAGRAM_GET_IG_USER_MEDIA",{"ig_user_id":"me","limit":100,"fields":"id,timestamp"},IGACC)
igrecent=[m["id"] for m in (data(r) or []) if datetime.fromisoformat(m["timestamp"].replace("+0000","+00:00")).timestamp()>now-31*DAY]
def igreach(mid):
    r=call("INSTAGRAM_GET_IG_MEDIA_INSIGHTS",{"ig_media_id":mid,"metric":["reach"]},IGACC)
    for m in data(r) or []:
        if m.get("name")=="reach": return mid,(m.get("values") or [{}])[0].get("value")
    return mid,None
with ThreadPoolExecutor(8) as ex:
    for k,v in list(ex.map(fbreach,recent))+list(ex.map(igreach,igrecent)):
        if isinstance(v,(int,float)): reach[k]=v
body={"series":series,"reach":reach,"eng":eng,"fbHistory":hist}
KEY=FEED_KEY
req=urllib.request.Request("https://shula-whatsapp.shahar1987.workers.dev/insights/feed?k="+KEY,data=json.dumps(body).encode(),headers={"content-type":"application/json"},method="POST")
resp=urllib.request.urlopen(req,timeout=60).read().decode()
print(json.dumps({"sent":{k:len(v) for k,v in series.items()},"reach":len(reach),"fbPosts":len(fbposts),"igPosts":len(igrecent),"worker":resp,"errors":errors[:5]},ensure_ascii=False))
