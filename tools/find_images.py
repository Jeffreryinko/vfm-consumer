#!/usr/bin/env python3
"""역사 글 사진 후보 찾기 — 위키미디어 공용(자유 이용 사진)에서 글마다 후보 몇 장.
결과: data/learn/img_candidates.json  (사람(Claude)이 눈으로 보고 골라 tools/img_pick.json 에 적음)"""
import json, time, urllib.parse, urllib.request, re, sys
from pathlib import Path
R = Path(__file__).resolve().parent.parent
UA = "vfm-consumer/1.0 (https://github.com/Jeffreryinko/vfm-consumer)"
Q = json.load(open(R / "tools" / "img_queries.json"))
out = {}
def get(u):
    for i in range(4):
        try:
            return json.loads(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA}), timeout=30).read())
        except Exception as e:
            print("  재시도", e); time.sleep(5 * (i + 1))
    return {}
for uid, qs in Q.items():
    cands = []
    for q in qs:
        u = ("https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=4&gsrsearch="
             + urllib.parse.quote("filetype:bitmap " + q) + "&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=640&iiextmetadatafilter=LicenseShortName|Artist")
        pages = (get(u).get("query") or {}).get("pages") or {}
        for p in sorted(pages.values(), key=lambda p: p.get("index", 99)):
            ii = (p.get("imageinfo") or [{}])[0]
            md = ii.get("extmetadata") or {}
            if ii.get("width", 0) < 300: continue
            cands.append({"q": q, "title": p["title"], "thumb": ii.get("thumburl"), "page": ii.get("descriptionurl"),
                          "lic": (md.get("LicenseShortName") or {}).get("value", ""), "by": re.sub("<[^>]+>", "", (md.get("Artist") or {}).get("value", ""))[:80]})
        time.sleep(1.2)
    out[uid] = cands
    print(uid, len(cands))
json.dump(out, open(R / "data" / "learn" / "img_candidates.json", "w"), ensure_ascii=False)
