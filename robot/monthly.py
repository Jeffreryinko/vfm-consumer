#!/usr/bin/env python3
"""이달의 소비 분위기 — 매달 1일(그달 글이 없으면 그다음 날에도) 지난달 뷰티·게임 흐름을 한 편으로 씀 (음슴체).

근거: 지난 30일 기사 제목 표본, 네이버 검색량 변화, 순위 1위들, 경제 숫자. 근거에 없는 사실은 쓰지 않게 함.
저장: data/brief/monthly/<YYYY-MM>.json + index.json
"""
from __future__ import annotations

import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common as C  # noqa: E402
import brief as B  # noqa: E402

PROMPT = """너는 '{label}'를 쓰는 소비 트렌드 기자임. 읽는 사람은 뷰티·폰게임 업계를 공부하는 직장인.
아래 자료만 근거로 지난달 소비 분위기를 정리해. 음슴체(~함, ~임). 세대(Z세대·알파세대), 소비 심리, 유행어, 가격 감각이 보이면 짚어.
자료에 없는 숫자·회사·사건은 쓰지 마.

답은 JSON: {{"t":"제목 24자 안팎","one":"한 줄","body":["문단",…4~6개],"points":["핵심 한 줄",…3~5개],"beauty":"뷰티 쪽 한 문단","game":"게임 쪽 한 문단","words":["이달 키워드",…5개]}}

[뷰티 기사 표본]
{bn}

[게임 기사 표본]
{gn}

[검색량 변화 (지난달 / 석 달 전)]
{tr}

[경제 숫자]
{econ}
"""


def trend_block():
    t = C.rj(C.DATA / "trend" / "naver.json", {}) or {}
    out = []
    for ind in ("beauty", "game"):
        for w, s in (t.get(ind) or {}).items():
            if len(s) >= 4 and s[-4][1]:
                out.append((s[-2][1] / max(s[-4][1], 0.01), f"{w}: {s[-2][1]} / {s[-4][1]}"))
    out.sort(reverse=True)
    return "\n".join(x[1] for x in out[:12] + out[-6:]) or "(없음)"


def main():
    n = C.now()
    pm = (n.replace(day=1) - __import__("datetime").timedelta(days=1)).strftime("%Y-%m")
    D = C.DATA / "brief" / "monthly"
    if (D / f"{pm}.json").exists() or n.day > 5: C.log("이달 글 이미 있음 또는 때가 아님"); return
    if not C.any_key(): return

    def sample(ind):
        items = [x for x in (C.rj(C.DATA / "news" / f"{ind}.json", {}) or {}).get("items", []) if x.get("at", "")[:7] == pm and x.get("kind") != "press"]
        random.seed(pm); random.shuffle(items)
        return "\n".join(f"- [{x.get('cc')}] {(x.get('ko') or x['t'])[:100]}" for x in items[:110]) or "(없음)"
    y, m = map(int, pm.split("-"))
    p = PROMPT.format(label=f"{y}년 {m}월 소비 분위기", bn=sample("beauty"), gn=sample("game"), tr=trend_block(), econ=B.econ_block())
    o, who = C.ask(p, check=lambda o: o.get("body") and o.get("t"))
    if not o: return
    doc = {"id": pm, "label": f"{y}년 {m}월 소비 분위기", "by": who, "at": n.isoformat(timespec="minutes"), **{k: o.get(k) for k in ("t", "one", "body", "points", "beauty", "game", "words")}}
    C.wj(D / f"{pm}.json", doc)
    ix = [x for x in (C.rj(D / "index.json", []) or []) if x["id"] != pm] + [{"id": pm, "t": doc["t"], "one": doc.get("one", "")}]
    C.wj(D / "index.json", sorted(ix, key=lambda x: x["id"], reverse=True))
    C.log(f"이달의 소비 분위기 저장 · {who}")


if __name__ == "__main__":
    main()
