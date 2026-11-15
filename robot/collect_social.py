#!/usr/bin/env python3
"""반응·흐름 로봇 — 매일 1번.
  · 트위치 많이 보는 게임 (data/social/twitch.json)
  · IGDB 다가오는 모바일 게임 출시 (data/cal/releases.json)
  · 앱스토어 리뷰: 한국 매출 상위 게임 최근 리뷰 (data/social/reviews.json)
  · 유튜브: 최근 이틀 많이 본 뷰티·게임 영상 (data/social/youtube.json)
  · 네이버 검색량: 회사·게임·성분 등 지켜보는 낱말의 달별 흐름 (data/trend/naver.json)
"""
from __future__ import annotations

import os
import sys
import time
from datetime import timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common as C  # noqa: E402

SO = C.DATA / "social"


def twitch_token():
    cid, sec = os.environ.get("TWITCH_CLIENT_ID", "").strip(), os.environ.get("TWITCH_CLIENT_SECRET", "").strip()
    if not cid or not sec: raise RuntimeError("열쇠 없음")
    o = C.get_json(f"https://id.twitch.tv/oauth2/token?client_id={cid}&client_secret={sec}&grant_type=client_credentials", data=b"")
    return cid, o["access_token"]


def twitch(cid, tok):
    H = {"Client-ID": cid, "Authorization": "Bearer " + tok}
    g = C.get_json("https://api.twitch.tv/helix/games/top?first=40", headers=H)["data"]
    out = []
    for i, x in enumerate(g, 1):
        v = 0
        try:
            s = C.get_json(f"https://api.twitch.tv/helix/streams?game_id={x['id']}&first=100", headers=H)["data"]
            v = sum(z.get("viewer_count", 0) for z in s)
        except Exception: pass
        out.append({"r": i, "n": x["name"], "id": x["id"], "img": x.get("box_art_url", "").replace("{width}", "144").replace("{height}", "192"), "v": v})
        time.sleep(0.15)
    C.wj(SO / "twitch.json", {"at": C.now().isoformat(timespec="minutes"), "rows": out})
    return len(out)


def igdb(cid, tok):
    H = {"Client-ID": cid, "Authorization": "Bearer " + tok, "Content-Type": "text/plain"}
    now = int(time.time())
    q = (f"fields date,human,platform,game.name,game.cover.image_id,game.involved_companies.company.name,game.involved_companies.developer,game.genres.name,game.hypes;"
         f" where platform = (34,39) & date > {now - 86400 * 7} & date < {now + 86400 * 120}; sort date asc; limit 400;")
    rows = C.get_json("https://api.igdb.com/v4/release_dates", headers=H, data=q.encode())
    seen, out = {}, []
    for r in rows:
        g = r.get("game") or {}
        if not g.get("name"): continue
        k = g["name"]
        plat = "iOS" if r.get("platform") == 39 else "Android"
        if k in seen: seen[k]["p"] = sorted(set(seen[k]["p"] + [plat])); continue
        cos = [ic["company"]["name"] for ic in g.get("involved_companies") or [] if ic.get("company")]
        it = {"d": time.strftime("%Y-%m-%d", time.gmtime(r["date"])) if r.get("date") else "", "n": k, "p": [plat], "by": cos[:2],
              "g": [x["name"] for x in g.get("genres") or []][:2], "hype": g.get("hypes") or 0,
              "img": f"https://images.igdb.com/igdb/image/upload/t_cover_small/{g['cover']['image_id']}.jpg" if g.get("cover") else ""}
        seen[k] = it; out.append(it)
    out.sort(key=lambda x: (x["d"], -x["hype"]))
    C.wj(C.DATA / "cal" / "releases.json", {"at": C.now().isoformat(timespec="minutes"), "items": out})
    return len(out)


def reviews():
    rk = (C.rj(C.DATA / "rank" / "latest.json", {}) or {}).get("boards", {})
    top = ((rk.get("g.ios.kr.gross") or {}).get("rows") or [])[:15]
    out = []
    for g in top:
        if not g.get("id"): continue
        try:
            o = C.get_json(f"https://itunes.apple.com/kr/rss/customerreviews/page=1/id={g['id']}/sortby=mostrecent/json", timeout=20)
            es = o.get("feed", {}).get("entry", []) or []
            if isinstance(es, dict): es = [es]
            rv = [{"s": int(e.get("im:rating", {}).get("label", 0) or 0), "t": C.clean(e.get("title", {}).get("label", ""), 60),
                   "b": C.clean(e.get("content", {}).get("label", ""), 220)} for e in es if e.get("im:rating")][:12]
            if rv: out.append({"id": g["id"], "n": g["n"], "avg": round(sum(x["s"] for x in rv) / len(rv), 1), "rv": rv})
        except Exception as e:
            C.log(f"  리뷰 {g['n']} 실패: {e}")
        time.sleep(0.4)
    C.wj(SO / "reviews.json", {"at": C.now().isoformat(timespec="minutes"), "games": out})
    return len(out)


def youtube():
    key = os.environ.get("YOUTUBE_API_KEY", "").strip()
    if not key: raise RuntimeError("열쇠 없음")
    after = (C.now() - timedelta(days=2)).astimezone().strftime("%Y-%m-%dT%H:%M:%SZ")
    Q = {"beauty": [("kr", "ko", "화장품 리뷰 OR 스킨케어 OR 메이크업"), ("us", "en", "skincare OR makeup review")],
         "game": [("kr", "ko", "모바일게임 신작 OR 리뷰"), ("us", "en", "mobile game")]}
    out = {}
    for ind, qs in Q.items():
        rows = []
        for cc, lang, q in qs:
            import urllib.parse
            o = C.get_json(f"https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&order=viewCount&maxResults=15&regionCode={cc.upper()}"
                           f"&relevanceLanguage={lang}&publishedAfter={after}&q={urllib.parse.quote(q)}&key={key}")
            for x in o.get("items", []):
                rows.append({"id": x["id"]["videoId"], "n": C.clean(x["snippet"]["title"]), "by": x["snippet"]["channelTitle"], "cc": cc,
                             "img": x["snippet"]["thumbnails"].get("medium", {}).get("url", ""), "at": x["snippet"]["publishedAt"][:10]})
        kos = C.translate([r["n"] for r in rows])
        for r, ko in zip(rows, kos):
            if ko != r["n"]: r["ko"] = ko
        out[ind] = rows
    C.wj(SO / "youtube.json", {"at": C.now().isoformat(timespec="minutes"), **out})
    return sum(len(v) for v in out.values())


def naver_trend():
    cid, sec = os.environ.get("NAVER_CLIENT_ID", "").strip(), os.environ.get("NAVER_CLIENT_SECRET", "").strip()
    if not cid: raise RuntimeError("열쇠 없음")
    watch = C.rj(C.DATA / "watch.json", {}) or {}
    H = {"X-Naver-Client-Id": cid, "X-Naver-Client-Secret": sec}
    end = C.now().strftime("%Y-%m-%d")
    out = {}
    for ind, anchor in (("beauty", "화장품"), ("game", "게임")):
        words = [w for w in watch.get(ind, []) if w != anchor]
        series = {}
        for s in range(0, len(words), 4):
            grp = [anchor] + words[s:s + 4]
            body = {"startDate": "2016-01-01", "endDate": end, "timeUnit": "month",
                    "keywordGroups": [{"groupName": w, "keywords": [w]} for w in grp]}
            o = C.get_json("https://openapi.naver.com/v1/datalab/search", headers=H, data=body)
            res = {r["title"]: [[d["period"][:7], d["ratio"]] for d in r["data"]] for r in o["results"]}
            base = {p: v for p, v in res.get(anchor, [])}
            scale = None
            if anchor not in series: series[anchor] = [[p, round(v, 2)] for p, v in res[anchor]]
            else:
                a0 = {p: v for p, v in series[anchor]}
                common = [p for p in base if base[p] > 0 and a0.get(p)]
                scale = sum(a0[p] / base[p] for p in common) / len(common) if common else 1
            for w in grp[1:]:
                series[w] = [[p, round(v * (scale or 1), 2)] for p, v in res.get(w, [])]
            time.sleep(0.3)
        out[ind] = series
    C.wj(C.DATA / "trend" / "naver.json", {"at": C.now().isoformat(timespec="minutes"), "note": "네이버 검색량 (같은 분야 안에서 견줄 수 있게 '화장품'·'게임' 검색량에 맞춰 바꾼 값)", **out})
    return sum(len(v) for v in out.values())


def main():
    tw = None
    try: tw = twitch_token()
    except Exception as e: C.mark("twitch:token", False, e)
    jobs = [("twitch", (lambda: twitch(*tw)) if tw else None), ("igdb", (lambda: igdb(*tw)) if tw else None),
            ("reviews", reviews), ("youtube", youtube), ("naver_trend", naver_trend)]
    for name, fn in jobs:
        if not fn: C.mark("social:" + name, False, "트위치 열쇠 없음"); continue
        try: n = fn(); C.mark("social:" + name, True, n); C.log(f"  ✓ {name}: {n}")
        except Exception as e: C.mark("social:" + name, False, e); C.log(f"  ✗ {name}: {e}")
    C.save_tcache()


if __name__ == "__main__":
    main()
