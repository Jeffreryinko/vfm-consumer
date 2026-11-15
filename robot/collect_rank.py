#!/usr/bin/env python3
"""순위 로봇 — 매일 1번. 게임(애플 앱스토어 공개 RSS·구글플레이)과 뷰티(아마존·큐텐 공개 베스트 화면, 유튜브 인기) 순위.
공개된 피드·화면만 씀. 로봇을 막는 사이트(올리브영 등)나 공개하지 않은 내부 주소는 쓰지 않음.

저장
  data/rank/latest.json           : 오늘 순위 전부 + 어제와 비교(NEW·오름·내림)
  data/rank/hist/YYYY-MM-DD.json  : 날마다 영구 보관 (나중에 '순위의 역사'가 됨)
깨진 출처는 직전 성공본을 그대로 쓰고 status.json 에 실패를 적음 (3일 넘으면 화면에 표시).

한 줄: {r 순위, n 이름, id, by 만든 곳, img 그림 주소, p 가격, g 장르}
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
import urllib.parse
from datetime import timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common as C  # noqa: E402
import sources as S  # noqa: E402

R = C.DATA / "rank"


# ───────── 게임: 애플 앱스토어 (열쇠 없음) ─────────
def apple(cc, feed):
    url = f"https://itunes.apple.com/{cc}/rss/{feed}/limit=100/genre=6014/json"
    o = C.get_json(url, timeout=30)
    out = []
    for i, e in enumerate(o.get("feed", {}).get("entry", []) or [], 1):
        imgs = e.get("im:image") or [{}]
        cat = (e.get("category") or {}).get("attributes", {}).get("label", "")
        out.append({"r": i, "n": e.get("im:name", {}).get("label", ""), "id": e.get("id", {}).get("attributes", {}).get("im:id", ""),
                    "by": e.get("im:artist", {}).get("label", ""), "img": imgs[-1].get("label", ""), "g": cat})
    if not out: raise RuntimeError("빈 순위")
    return out


def apple_v2(cc, kind):
    o = C.get_json(f"https://rss.marketingtools.apple.com/api/v2/{cc}/apps/{kind}/100/apps.json", timeout=30)
    out = [{"r": i, "n": x.get("name", ""), "id": x.get("id", ""), "by": x.get("artistName", ""), "img": x.get("artworkUrl100", ""),
            "g": ",".join(g.get("name", "") for g in x.get("genres") or [])}
           for i, x in enumerate(o.get("feed", {}).get("results", []), 1)]
    return [x for x in out if "Games" in x["g"] or "게임" in x["g"] or "ゲーム" in x["g"]] or out


# ───────── 게임: 구글플레이 (node 의 google-play-scraper) ─────────
GP_JS = r"""
const gplay = require('google-play-scraper').default || require('google-play-scraper');
const [cc, col] = process.argv.slice(2);
gplay.list({collection: gplay.collection[col], category: gplay.category.GAME, country: cc, lang: cc==='kr'?'ko':(cc==='jp'?'ja':'en'), num: 100})
 .then(r => { console.log(JSON.stringify(r.map((x,i)=>({r:i+1,n:x.title,id:x.appId,by:x.developer,img:x.icon,g:x.genre||''})))); })
 .catch(e => { console.error(String(e)); process.exit(1); });
"""


def gplay(cc, col):
    js = Path("/tmp/gp.js"); js.write_text(GP_JS)
    import os
    p = subprocess.run(["node", str(js), cc, col], capture_output=True, text=True, timeout=90, cwd=str(C.ROOT), env={**os.environ, "NODE_PATH": str(C.ROOT / "node_modules")})
    if p.returncode: raise RuntimeError(p.stderr[-200:])
    out = json.loads(p.stdout)
    if not out: raise RuntimeError("빈 순위")
    return out


def amazon():
    h = C.get("https://www.amazon.com/Best-Sellers-Beauty-Personal-Care/zgbs/beauty", headers={"Accept": "text/html"})
    if "captcha" in h.lower()[:20000]: raise RuntimeError("아마존이 로봇 확인을 요구함")
    out = []
    for m in re.finditer(r'<img alt="([^"]{8,220})" src="(https://images-na\.ssl-images-amazon\.com/images/I/[^"]+|https://m\.media-amazon\.com/images/I/[^"]+)"', h):
        name = C.clean(m.group(1))
        if any(x["n"] == name for x in out): continue
        out.append({"r": len(out) + 1, "n": name, "img": m.group(2)})
        if len(out) >= 50: break
    if len(out) < 10: raise RuntimeError(f"읽은 상품 {len(out)}개")
    return out


def youtube_trending(cat, cc):
    import os
    key = os.environ.get("YOUTUBE_API_KEY", "").strip()
    if not key: raise RuntimeError("열쇠 없음")
    o = C.get_json(f"https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&regionCode={cc.upper()}&videoCategoryId={cat}&maxResults=25&key={key}")
    return [{"r": i, "n": x["snippet"]["title"], "id": x["id"], "by": x["snippet"]["channelTitle"], "img": x["snippet"]["thumbnails"].get("medium", {}).get("url", ""),
             "v": int(x.get("statistics", {}).get("viewCount", 0))} for i, x in enumerate(o.get("items", []), 1)]


# ───────── 모으기 ─────────
def boards():
    B = []  # (판 이름, 분야, 제목, 함수)
    names = {"kr": "한국", "us": "미국", "jp": "일본", "cn": "중국", "de": "독일", "sa": "사우디"}
    for cc in S.APPLE_CC:
        B.append((f"g.ios.{cc}.gross", "game", f"앱스토어 {names[cc]} 매출", lambda cc=cc: apple(cc, "topgrossingapplications")))
        B.append((f"g.ios.{cc}.free", "game", f"앱스토어 {names[cc]} 인기", lambda cc=cc: apple(cc, "topfreeapplications")))
        B.append((f"g.ios.{cc}.new", "game", f"앱스토어 {names[cc]} 신작", lambda cc=cc: apple(cc, "newfreeapplications")))
    for cc in S.GPLAY_CC:
        B.append((f"g.gp.{cc}.gross", "game", f"구글플레이 {names[cc]} 매출", lambda cc=cc: gplay(cc, "GROSSING")))
        B.append((f"g.gp.{cc}.free", "game", f"구글플레이 {names[cc]} 인기", lambda cc=cc: gplay(cc, "TOP_FREE")))
    B.append(("g.yt.kr", "game", "유튜브 한국 게임 인기 영상", lambda: youtube_trending(20, "kr")))
    B.append(("g.yt.us", "game", "유튜브 미국 게임 인기 영상", lambda: youtube_trending(20, "us")))
    B.append(("b.amz.us", "beauty", "아마존 미국 뷰티 베스트셀러", amazon))
    B.append(("b.yt.kr", "beauty", "유튜브 한국 뷰티·생활 인기 영상", lambda: youtube_trending(26, "kr")))
    B.append(("b.yt.us", "beauty", "유튜브 미국 뷰티·생활 인기 영상", lambda: youtube_trending(26, "us")))
    return B


def compare(rows, prev):
    pm = {(x.get("id") or x["n"]): x["r"] for x in prev or []}
    for x in rows:
        k = x.get("id") or x["n"]
        if k not in pm: x["d"] = "new" if prev else 0
        else: x["d"] = pm[k] - x["r"]
    return rows


def main():
    old = C.rj(R / "latest.json", {}) or {}
    ob = old.get("boards", {})
    prev_day = C.rj(R / "hist" / f"{(C.now() - timedelta(days=1)).strftime('%Y-%m-%d')}.json", {}) or {}
    out, ok, bad = {}, 0, 0
    for key, ind, title, fn in boards():
        try:
            rows = fn()[:100]
            base = (prev_day.get(key) or {}).get("rows") or (ob.get(key) or {}).get("rows")
            rows = compare(rows, base if (ob.get(key) or {}).get("day") != C.today() else (ob.get(key) or {}).get("prev"))
            out[key] = {"t": title, "ind": ind, "day": C.today(), "rows": rows}
            C.mark("rank:" + key, True, len(rows)); ok += 1
            C.log(f"  ✓ {title}: {len(rows)}")
        except Exception as e:
            C.mark("rank:" + key, False, e); bad += 1
            C.log(f"  ✗ {title}: {e}")
            if key in ob: out[key] = {**ob[key], "stale": True}
    if C.translate:
        names = []
        for k, b in out.items():
            if k.startswith(("b.amz", "b.q10", "g.ios.cn", "g.ios.jp", "g.yt.us", "b.yt.us")) and not b.get("stale"):
                for x in b["rows"][:30]: names.append((x, x["n"]))
        kos = C.translate([n for _, n in names])
        for (x, n), ko in zip(names, kos):
            if ko != n: x["ko"] = ko
        C.save_tcache()
    C.wj(R / "latest.json", {"at": C.now().isoformat(timespec="minutes"), "boards": out})
    slim = {k: {"t": b["t"], "rows": [{kk: x.get(kk) for kk in ("r", "n", "id", "by") if x.get(kk) not in (None, "")} for x in b["rows"][:50]]}
            for k, b in out.items() if not b.get("stale")}
    C.wj(R / "hist" / f"{C.today()}.json", slim)
    C.log(f"순위판 {ok}개 성공 · {bad}개 실패")


if __name__ == "__main__":
    main()
