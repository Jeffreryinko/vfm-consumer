#!/usr/bin/env python3
"""뉴스 로봇 — 하루 2번. 나라·언어별 구글 뉴스 RSS + 레딧 → 제목을 한국어로 → data/news/<beauty|game>.json (30일 보관)

글 하나: {id, t(원문 제목), ko(한국어 제목), src(매체), url, at(시각), cc(나라), rg(권역), kind(trade|gen|biz|press|comm), q(검색어)}
같은 제목(거의 같은 글)은 하나로 합침. 보도자료로 보이는 글은 kind=press.
"""
from __future__ import annotations

import re
import sys
import urllib.parse
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from email.utils import parsedate_to_datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common as C  # noqa: E402
import sources as S  # noqa: E402

KEEP_DAYS = 30


def gnews(cc, q):
    hl, gl, ceid = S.GN[cc]
    url = f"https://news.google.com/rss/search?q={urllib.parse.quote(q + ' when:3d')}&hl={hl}&gl={gl}&ceid={ceid}"
    root = ET.fromstring(C.get(url, timeout=25))
    out = []
    for it in root.iter("item"):
        title = C.clean(it.findtext("title"))
        src_el = it.find("source")
        src = C.clean(src_el.text if src_el is not None else "")
        if src and title.endswith(" - " + src): title = title[: -len(src) - 3]
        try: at = parsedate_to_datetime(it.findtext("pubDate")).astimezone(C.KST)
        except Exception: at = C.now()
        out.append({"t": title, "src": src, "url": it.findtext("link") or "", "at": at.isoformat(timespec="minutes"),
                    "dom": (src_el.get("url") if src_el is not None else "") or ""})
    return out[:25]


def reddit(sub):
    xml = C.get(f"https://www.reddit.com/r/{sub}/top/.rss?t=day&limit=15", timeout=25, ua=C.BOT_UA)
    ns = {"a": "http://www.w3.org/2005/Atom"}
    root = ET.fromstring(xml)
    out = []
    for e in root.findall("a:entry", ns):
        out.append({"t": C.clean(e.findtext("a:title", "", ns)), "src": "r/" + sub, "url": (e.find("a:link", ns).get("href") if e.find("a:link", ns) is not None else ""),
                    "at": (e.findtext("a:updated", "", ns) or C.now().isoformat())[:16]})
    return out


def norm(t):
    return re.sub(r"[^0-9a-z가-힣ぁ-んァ-ン一-龥]", "", t.lower())[:40]


def run(ind, qs):
    path = C.DATA / "news" / f"{ind}.json"
    old = C.rj(path, {}) or {}
    items = {x["id"]: x for x in old.get("items", [])}
    seen = {norm(x["t"]) for x in items.values()}
    got, okc, fail = [], 0, 0

    def job(q):
        cc, query, kind = q
        try:
            rows = gnews(cc, query); C.mark(f"news:{ind}:{cc}:{query[:24]}", True, len(rows)); return cc, query, kind, rows
        except Exception as e:
            C.mark(f"news:{ind}:{cc}:{query[:24]}", False, e); return cc, query, kind, None

    with ThreadPoolExecutor(6) as ex:
        for cc, query, kind, rows in ex.map(job, qs):
            if rows is None: fail += 1; continue
            okc += 1
            for r in rows:
                k = norm(r["t"])
                if not k or k in seen or re.match(r"^\s*[\[【(](잡담|수다|질문|정보|공략|사진|자랑|유머|일상|후기|짤|팁)", r["t"]): continue
                seen.add(k)
                low = (r["src"] + " " + r["dom"] + " " + r["t"]).lower()
                kd = "press" if any(p in low for p in S.PRESS) else kind
                got.append({"id": C.sid(r["url"] or r["t"]), "t": r["t"], "src": r["src"], "url": r["url"], "at": r["at"],
                            "cc": cc, "rg": S.REGION.get(cc, "ww"), "kind": kd, "q": query})
    for sub in S.REDDIT.get(ind, []):
        try:
            for r in reddit(sub):
                k = norm(r["t"])
                if k in seen: continue
                seen.add(k)
                got.append({"id": C.sid(r["url"]), **r, "cc": "us", "rg": "us", "kind": "comm", "q": "reddit"})
            C.mark(f"reddit:{sub}", True)
        except Exception as e:
            C.mark(f"reddit:{sub}", False, e)
    kos = C.translate([g["t"] for g in got])
    for g, ko in zip(got, kos):
        g["ko"] = ko
        items[g["id"]] = g
    cut = (C.now() - timedelta(days=KEEP_DAYS)).isoformat()
    keep = sorted((x for x in items.values() if x.get("at", "") >= cut), key=lambda x: x.get("at", ""), reverse=True)
    C.wj(path, {"at": C.now().isoformat(timespec="minutes"), "n": len(keep), "items": keep})
    cut3 = (C.now() - timedelta(days=3)).isoformat()
    slim = [{k: x.get(k) for k in ("id", "ko", "t", "src", "url", "at", "cc", "kind") if x.get(k)} for x in keep if x.get("at", "") >= cut3][:900]
    C.wj(C.DATA / "news" / f"{ind}_recent.json", {"at": C.now().isoformat(timespec="minutes"), "items": slim})
    C.log(f"{ind}: 검색 {okc}개 성공 · {fail}개 실패 · 새 글 {len(got)} · 보관 {len(keep)}")


def main():
    run("beauty", S.BEAUTY)
    run("game", S.GAME)
    C.save_tcache()


if __name__ == "__main__":
    main()
