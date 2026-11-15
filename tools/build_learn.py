#!/usr/bin/env python3
"""배움 자료 묶기 — data/learn/src/*.json (작가가 쓴 원본) → 화면이 읽는 파일들

  data/learn/hist_<beauty|game>.json : 글 목록(본문 빼고) + 코스
  data/learn/u/<id>.json             : 글 하나 전체 (읽을 때만 받음)
  data/learn/terms_<ind>.json        : 사전
  data/learn/eras.json               : 시대 배경
  data/learn/index.json              : 브리핑 로봇이 고를 배움 글 번호 목록
"""
import json, re, glob
from pathlib import Path

D = Path(__file__).resolve().parent.parent / "data" / "learn"
SRC = D / "src"
CCN = {"kr": "한국", "us": "미국", "jp": "일본", "cn": "중국", "eu": "유럽", "me": "중동", "ww": "세계"}


def rj(p, d=None):
    try: return json.loads(Path(p).read_text(encoding="utf-8"))
    except Exception as e:
        print("  읽기 실패", p, e); return d


def wj(p, o):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(o, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def main():
    units = []
    for f in sorted(SRC.glob("[bg][A-Z].json")):
        o = rj(f, {}) or {}
        for u in o.get("units", []):
            if not (u.get("id") and u.get("t") and u.get("y")): continue
            units.append(u)
    seen = set(); U = []
    for u in units:
        if u["id"] in seen: continue
        seen.add(u["id"]); U.append(u)
    (D / "u").mkdir(parents=True, exist_ok=True)
    for old in (D / "u").glob("*.json"):
        if old.stem not in seen: old.unlink()
    idx = {"beauty": {"term": {}, "hist": {}}, "game": {"term": {}, "hist": {}}}
    for ind in ("beauty", "game"):
        us = sorted([u for u in U if u.get("ind") == ind], key=lambda u: (u["y"][0], u["y"][1], u["id"]))
        meta = []
        for u in us:
            wj(D / "u" / f"{u['id']}.json", u)
            meta.append({k: u.get(k) for k in ("id", "t", "sub", "y", "cc", "theme", "short", "events", "cos", "terms")})
            idx[ind]["hist"][u["id"]] = u["t"]
        courses = []
        if us:
            courses.append({"id": f"{ind[0]}-all", "t": "세계 통사 — 처음부터 시대 순서대로", "one": "근현대부터 지금까지 한 줄로", "units": [u["id"] for u in us]})
            kr = [u["id"] for u in us if "kr" in (u.get("cc") or [])]
            if kr: courses.append({"id": f"{ind[0]}-kr", "t": "한국 코스", "one": "한국 " + ("화장품" if ind == "beauty" else "게임") + "의 흐름", "units": kr})
            for cc in ("cn", "jp", "us", "eu", "me", "ww"):
                ids = [u["id"] for u in us if cc in (u.get("cc") or [])]
                if len(ids) >= 3: courses.append({"id": f"{ind[0]}-{cc}", "t": f"{CCN[cc]} 코스", "one": f"{CCN[cc]}에서 일어난 일", "units": ids})
            th = {}
            for u in us: th.setdefault(u.get("theme") or "기타", []).append(u["id"])
            for t, ids in sorted(th.items(), key=lambda x: -len(x[1])):
                if len(ids) >= 2: courses.append({"id": f"{ind[0]}-t-{abs(hash(t)) % 10**6}", "t": f"주제: {t}", "one": f"{t}만 모아서", "units": ids})
            # 같은 결과가 나오게 주제 코스 번호는 이름으로 고정
            for c in courses:
                if "-t-" in c["id"]: c["id"] = f"{ind[0]}-t-" + re.sub(r"[^0-9A-Za-z가-힣]", "", c["t"].replace("주제: ", ""))
        wj(D / f"hist_{ind}.json", {"units": meta, "courses": courses})
        tf = rj(SRC / f"terms_{ind}.json", {}) or {}
        terms = [t for t in tf.get("terms", []) if t.get("id") and t.get("w")]
        wj(D / f"terms_{ind}.json", {"terms": terms})
        for t in terms: idx[ind]["term"][t["id"]] = t["w"]
        print(f"{ind}: 글 {len(us)} · 코스 {len(courses)} · 낱말 {len(terms)}")
    er = rj(SRC / "eras.json", None)
    if er: wj(D / "eras.json", er); print("시대 배경:", {k: len(v) for k, v in er.get("regions", {}).items()})
    wj(D / "index.json", idx)


if __name__ == "__main__":
    main()
