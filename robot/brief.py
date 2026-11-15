#!/usr/bin/env python3
"""아침 브리핑 로봇 — 매일 아침 6시 반. 뷰티 브리핑 · 게임 브리핑을 따로 씀 (음슴체).

AI 에게 주는 것 (AI 는 여기 있는 것만 쓸 수 있음)
  · 최근 36시간 기사 제목 (나라·매체 성격 표시, 보도자료는 따로 표시)
  · 순위 변화 (새로 들어온 것·많이 오른 것), 해외 순위에 오른 한국 브랜드·게임
  · 앱스토어 리뷰 일부 (게임), 경제 숫자 (환율·금리·소비심리)
  · 배움 글 목록 (배경은 지어내지 말고 배움 글 번호만 고르게)
  · 어제 브리핑 제목 (어제와 달라진 점)
AI 순서: Claude(이 사이트 몫 예산 안) → Gemini → Groq. 열쇠가 없으면 아무것도 바꾸지 않음.
저장: data/brief/<beauty|game>/latest.json + 날짜.json (60일)
시험: python robot/brief.py --dry
"""
from __future__ import annotations

import re
import sys
from datetime import timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common as C  # noqa: E402

CCN = {"kr": "한국", "us": "미국", "gb": "영국", "jp": "일본", "cn": "중국", "tw": "대만", "fr": "프랑스", "de": "독일", "ae": "UAE", "sa": "사우디", "in": "인도", "sg": "싱가포르"}
KIND = {"trade": "업계지", "gen": "일반", "biz": "경제", "press": "보도자료", "comm": "커뮤니티"}

PROMPT = """너는 '{label}' 편집자임. 읽는 사람은 이 업계를 공부하는 직장인이고, 아침 5분에 업계가 보이길 원함.
아래 자료만 보고 오늘 브리핑을 써. 말투는 음슴체(~함, ~임, ~했음). 쉬운 말로, 업계 용어는 풀어서.

꼭 지킬 것
1. 사실(회사·제품·숫자·날짜)은 자료에 있는 것만. 모르면 쓰지 마.
2. 같은 일을 다룬 기사는 하나로 합쳐 (ids 에 번호를 모두). 중요한 순서로 {lo}~{hi}개.
   중요도 = 여러 매체·여러 나라가 다룸 + 돈·시장에 주는 영향 + 한국과의 관계. 보도자료만 있는 일은 뒤로.
3. 나라를 고루: 한국·중국·미국·일본·유럽·중동. 커뮤니티 글은 '소비자 반응'의 근거로만.
4. 배경(bg)은 [배움 글 목록]의 번호만. 목록에 없으면 빈 칸.

이슈마다
- ids: 기사 번호들 / t: 제목 26자 안팎 / one: 한 줄 요약
- sum: 2~3문장 요약 / why: 왜 중요한지 1~2문장
- cc: 나라마다 어떻게 전했는지 {{"kr":"…","us":"…"}} (자료에 있는 나라만, 각 1문장)
- money: 돈 이야기 1~2문장 — 누가 돈을 벌고 잃나, 시장 크기·매출·주가와의 관계 (자료에 근거, 없으면 빈 칸)
- op: '이렇게 보는 사람도 있음' — 칼럼·분석·커뮤니티의 다른 시각 1문장 (없으면 빈 칸)
- chg: [어제 브리핑]과 이어지는 일이면 어제와 달라진 점 1문장 (아니면 빈 칸)
- tag: {tags} 중 하나
- cos: [회사 목록]의 번호 0~3개
- bg: [{{"k":"term|hist","id":"…"}}] 0~3개
- press: 보도자료 위주면 true

그리고
- lead: 오늘 줄기 3문장
- rank: 순위 변화 해설 2~3문장 ([순위 변화] 근거)
- abroad: {abroad_q} 2~3문장 ([해외 순위의 한국] 근거)
- hidden: 한국 매체엔 없고 외국 매체에만 나온 일 0~3개 [{{"ids":[…],"t":"…","one":"…"}}]
- ad: 화제의 광고·콜라보·모델 소식 0~3개 [{{"ids":[…],"t":"…","one":"…"}}]
- voice: 소비자 반응 한 단락 2~3문장 ([소비자 반응] 근거, 없으면 빈 칸)
- econ: 경제 날씨 한 줄 — [경제 숫자]가 이 업계에 주는 뜻 (1문장)
- cal: 기사에 날짜가 나온 앞으로의 일정(출시·실적 발표·행사·규제 시행) 0~8개 [{{"d":"YYYY-MM-DD","t":"…","ids":[…]}}] — 날짜가 기사에 없으면 넣지 마
{extra}
답은 JSON 하나: {{"lead":"…","items":[…],"rank":"…","abroad":"…","hidden":[…],"ad":[…],"voice":"…","econ":"…","cal":[…]{extra_keys}}}

[기사]  (번호 | 나라 | 성격 | 매체 | 제목)
{news}

[순위 변화]
{ranks}

[해외 순위의 한국]
{abroad}

[소비자 반응]
{voice}

[경제 숫자]
{econ}

[어제 브리핑]
{prev}

[회사 목록]  (번호=이름)
{cos}

[배움 글 목록]  (k:id=이름)
{learn}
"""

CFG = {
    "beauty": {"label": "뷰티 아침 브리핑", "tags": "화장품|K뷰티 수출|유통|헤어·네일·향수|시술·기기|회사·돈|규제",
               "abroad_q": "해외에서 뜨는 K뷰티", "extra": "- word: 오늘의 성분·용어 하나 — [배움 글 목록]의 term 번호 하나와, 오늘 기사와 이어지는 이유 1문장 {\"id\":\"…\",\"why\":\"…\"}",
               "extra_keys": ",\"word\":{…}"},
    "game": {"label": "폰게임 아침 브리핑", "tags": "신작·업데이트|순위|회사·돈|중국·판호|규제·논란|e스포츠·방송|플랫폼",
             "abroad_q": "해외에서 뜨는 한국 게임", "extra": "", "extra_keys": ""},
}


def news_rows(ind):
    items = (C.rj(C.DATA / "news" / f"{ind}.json", {}) or {}).get("items", [])
    cut = (C.now() - timedelta(hours=36)).isoformat()
    fresh = [x for x in items if x.get("at", "") >= cut] or items[:150]
    # 나라마다 고르게: 한 권역이 넘치지 않게
    by = {}
    for x in fresh: by.setdefault(x.get("rg", "ww"), []).append(x)
    pick, i = [], 0
    while len(pick) < 170 and any(by.values()):
        for k in list(by):
            if by[k]: pick.append(by[k].pop(0))
    pick = pick[:170]
    rows = [f"{n} | {CCN.get(x.get('cc'), x.get('cc'))} | {KIND.get(x.get('kind'), '')} | {x.get('src', '')[:24]} | {(x.get('ko') or x['t'])[:120]}"
            + (f" (원문: {x['t'][:80]})" if x.get('ko') and x.get('ko') != x['t'] and x.get('cc') not in ('kr',) else "")
            + (f" — {x['desc'][:110]}" if x.get('desc') else "")
            for n, x in enumerate(pick)]
    return pick, rows


def rank_block(ind):
    bs = (C.rj(C.DATA / "rank" / "latest.json", {}) or {}).get("boards", {})
    out = []
    for k, b in bs.items():
        if b.get("ind") != ind or b.get("stale") or ".yt." in k: continue
        rows = b["rows"]
        new = [x for x in rows[:30] if x.get("d") == "new"][:5]
        up = sorted([x for x in rows[:50] if isinstance(x.get("d"), int) and x["d"] >= 5], key=lambda x: -x["d"])[:4]
        top = ", ".join((x.get("ko") or x["n"])[:30] for x in rows[:5])
        s = f"{b['t']}: 1~5위 {top}"
        if new: s += " / 새로 들어옴: " + ", ".join(f"{(x.get('ko') or x['n'])[:30]}({x['r']}위)" for x in new)
        if up: s += " / 많이 오름: " + ", ".join(f"{(x.get('ko') or x['n'])[:30]}(+{x['d']}→{x['r']}위)" for x in up)
        out.append(s)
    return "\n".join(out) or "(오늘 순위 없음)"


def abroad_block(ind, cos):
    bs = (C.rj(C.DATA / "rank" / "latest.json", {}) or {}).get("boards", {})
    kr = [c for c in cos if c.get("cc") == "kr"]
    keys = []
    for c in kr:
        keys += [c["n"], c.get("en", "")] + c.get("brands", []) + c.get("kw", [])
    keys = [k.lower() for k in keys if k and len(k) >= 3]
    out = []
    for k, b in bs.items():
        if b.get("ind") != ind or ".kr" in k or b.get("stale"): continue
        hit = [x for x in b["rows"][:100] if any(w in (x.get("n", "") + " " + x.get("by", "")).lower() for w in keys)]
        if hit: out.append(f"{b['t']}: " + ", ".join(f"{x['n'][:40]}({x['r']}위{', '+x['by'][:20] if x.get('by') else ''})" for x in hit[:8]))
    return "\n".join(out) or "(없음)"


def voice_block(ind):
    out = []
    if ind == "game":
        rv = (C.rj(C.DATA / "social" / "reviews.json", {}) or {}).get("games", [])
        for g in rv[:8]:
            low = [r for r in g["rv"] if r["s"] <= 2][:2]; hi = [r for r in g["rv"] if r["s"] >= 4][:1]
            out.append(f"{g['n']} (최근 리뷰 평균 {g['avg']}점): " + " / ".join(f"{r['s']}점 '{r['b'][:90]}'" for r in low + hi))
    yt = (C.rj(C.DATA / "social" / "youtube.json", {}) or {}).get(ind, [])
    if yt: out.append("최근 많이 본 영상: " + ", ".join((x.get("ko") or x["n"])[:50] for x in yt[:10]))
    items = (C.rj(C.DATA / "news" / f"{ind}.json", {}) or {}).get("items", [])
    comm = [x for x in items if x.get("kind") == "comm"][:12]
    if comm: out.append("레딧 인기 글: " + " / ".join((x.get("ko") or x["t"])[:70] for x in comm))
    return "\n".join(out) or "(없음)"


def econ_block():
    s = (C.rj(C.DATA / "econ" / "latest.json", {}) or {}).get("s", {})
    out = []
    for k in ("kr_usd", "kr_rate", "kr_csi", "jpy_usd", "cny_usd", "us_rate", "us_sent"):
        v = (s.get(k) or {}).get("v") or []
        if len(v) >= 2: out.append(f"{s[k]['t']}: {v[-1][0]} {v[-1][1]:,} (전달 {v[-2][1]:,}, 1년 전 {v[-13][1]:,})" if len(v) >= 13 else f"{s[k]['t']}: {v[-1][0]} {v[-1][1]:,}")
    return "\n".join(out) or "(없음)"


def learn_block(ind):
    li = C.rj(C.DATA / "learn" / "index.json", {}) or {}
    t = li.get(ind, {})
    return "\n".join(f"{k}: " + ", ".join(f"{i}={n}" for i, n in list(v.items())[:260]) for k, v in t.items() if v) or "(없음)", t


def run(ind, dry=False):
    cfg = CFG[ind]
    cos = [c for c in (C.rj(C.DATA / "companies.json", {}) or {}).get("list", []) if c.get("ind") == ind]
    pick, rows = news_rows(ind)
    if len(rows) < 8: C.log(f"{ind}: 기사가 {len(rows)}개뿐 → 건너뜀"); return
    prevo = C.rj(C.DATA / "brief" / ind / "latest.json", {}) or {}
    prev = "\n".join(f"- {x['t']}: {x.get('one', '')}" for x in prevo.get("items", [])[:12]) or "(없음)"
    learn, li = learn_block(ind)
    t = C.now()
    label = f"{t.month}월 {t.day}일 {cfg['label']}"
    prompt = PROMPT.format(label=label, lo=5, hi=10, tags=cfg["tags"], abroad_q=cfg["abroad_q"], extra=cfg["extra"], extra_keys=cfg["extra_keys"],
                           news="\n".join(rows), ranks=rank_block(ind), abroad=abroad_block(ind, cos), voice=voice_block(ind), econ=econ_block(), prev=prev,
                           cos=", ".join(f"{c['id']}={c['n']}" for c in cos), learn=learn)
    C.log(f"{ind}: 기사 {len(rows)} · 글 {len(prompt):,}자")
    if dry: C.log(prompt[:3000]); return
    if not C.any_key(): C.log("AI 열쇠 없음 → 그대로 둠"); return
    o, who = C.ask(prompt, check=lambda o: len(o.get("items") or []) >= 3 and o.get("lead"))
    if not o: C.log(f"{ind}: AI 가 못 씀 → 그대로 둠"); return
    S = lambda v, n: re.sub(r"\s+", " ", str(v or "")).strip()[:n]
    coids = {c["id"] for c in cos}
    def refs(ids): return [pick[i]["id"] for i in ids if isinstance(i, int) and 0 <= i < len(pick)]
    def srcs(ids):
        out = []
        for i in ids:
            if isinstance(i, int) and 0 <= i < len(pick):
                x = pick[i]; out.append({"id": x["id"], "src": x.get("src", ""), "cc": x.get("cc", ""), "t": x.get("ko") or x["t"], "url": x.get("url", ""), "kind": x.get("kind", ""),
                                         **({"img": x["img"]} if x.get("img") else {}), **({"desc": x["desc"]} if x.get("desc") and x.get("cc") == "kr" else {})})
        return out
    items = []
    for it in o.get("items") or []:
        ids = [i for i in (it.get("ids") or []) if isinstance(i, int)]
        if not ids or not it.get("t"): continue
        items.append({"t": S(it.get("t"), 60), "one": S(it.get("one"), 200), "sum": S(it.get("sum"), 600), "why": S(it.get("why"), 360),
                      "cc": {k: S(v, 240) for k, v in (it.get("cc") or {}).items() if isinstance(v, str) and v.strip()},
                      "money": S(it.get("money"), 360), "op": S(it.get("op"), 300), "chg": S(it.get("chg"), 240), "tag": S(it.get("tag"), 20),
                      "press": bool(it.get("press")), "cos": [c for c in (it.get("cos") or []) if c in coids][:3],
                      "bg": [{"k": b["k"], "id": b["id"], "t": li[b["k"]][b["id"]]} for b in (it.get("bg") or [])[:3]
                             if isinstance(b, dict) and b.get("k") in li and b.get("id") in li[b["k"]]],
                      "src": srcs(ids)[:8]})
        im = next((z["img"] for z in items[-1]["src"] if z.get("img")), "")
        if im: items[-1]["img"] = im
    items.sort(key=lambda x: x["press"])
    def mini(arr): return [{"t": S(x.get("t"), 60), "one": S(x.get("one"), 220), "src": srcs(x.get("ids") or [])[:4]} for x in (arr or []) if isinstance(x, dict) and x.get("t")][:3]
    doc = {"id": t.strftime("%Y-%m-%d"), "label": label, "at": t.isoformat(timespec="minutes"), "by": who.split(":")[0], "model": who,
           "lead": S(o.get("lead"), 500), "items": items[:10], "rank": S(o.get("rank"), 500), "abroad": S(o.get("abroad"), 500),
           "hidden": mini(o.get("hidden")), "ad": mini(o.get("ad")), "voice": S(o.get("voice"), 500), "econ": S(o.get("econ"), 240),
           "note": "기사 제목·순위·공개 자료를 AI가 정리했음. 회사 소개와 풀이는 틀릴 수 있음."}
    cal = []
    for x in o.get("cal") or []:
        if isinstance(x, dict) and re.match(r"20\d\d-\d\d-\d\d$", str(x.get("d", ""))) and x.get("t") and x["d"] >= doc["id"]:
            cal.append({"d": x["d"], "t": S(x["t"], 80), "src": srcs(x.get("ids") or [])[:2]})
    if cal:
        cp = C.DATA / "cal" / f"news_{ind}.json"
        old = [e for e in (C.rj(cp, {}) or {}).get("items", []) if e["d"] >= doc["id"]]
        seen = {(e["d"], e["t"]) for e in old}
        C.wj(cp, {"at": doc["at"], "items": sorted(old + [e for e in cal if (e["d"], e["t"]) not in seen], key=lambda e: e["d"])[:120]})
    w = o.get("word") or {}
    if isinstance(w, dict) and w.get("id") in li.get("term", {}): doc["word"] = {"id": w["id"], "t": li["term"][w["id"]], "why": S(w.get("why"), 200)}
    D = C.DATA / "brief" / ind
    C.wj(D / "latest.json", doc); C.wj(D / f"{doc['id']}.json", doc)
    for p in sorted(D.glob("20*.json"))[:-60]: p.unlink()
    C.log(f"{ind}: 브리핑 저장 · {len(items)}개 · {who}")
    # 알림 쪽지 (수파베이스가 15분마다 읽어 감): 아침 브리핑 하나 + 관심 회사가 나온 이슈
    pp = C.DATA / "push.json"
    pu = C.rj(pp, {}) or {}
    cname = {c["id"]: c["n"] for c in cos}
    other = (C.rj(C.DATA / "brief" / ("game" if ind == "beauty" else "beauty") / "latest.json", {}) or {})
    tops = [x["t"] for x in items[:2]] + [x["t"] for x in (other.get("items") or [])[:1] if other.get("id") == doc["id"]]
    pu["brief"] = {"id": f"cs-brief-{doc['id']}", "title": f"☀️ {t.month}월 {t.day}일 뷰티·폰게임 브리핑", "body": " · ".join(tops)[:140], "url": "./"}
    co = [e for e in pu.get("co", []) if e.get("d") == doc["id"] and not e["id"].startswith(f"cs-co-{ind}-")]
    for i, x in enumerate(items):
        if x["cos"]:
            co.append({"id": f"cs-co-{ind}-{doc['id']}-{i}", "d": doc["id"], "hay": " ".join(cname[c] for c in x["cos"]).lower(),
                       "body": (x["t"] + " — " + x["one"])[:150], "url": f"./#/{ind[0]}/brief/{i}"})
    pu["co"] = co[:20]
    C.wj(pp, pu)


def main():
    dry = "--dry" in sys.argv
    for ind in [a for a in sys.argv[1:] if not a.startswith("--")] or ["beauty", "game"]:
        run(ind, dry)


if __name__ == "__main__":
    main()
