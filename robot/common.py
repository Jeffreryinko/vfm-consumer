#!/usr/bin/env python3
"""뷰티·폰게임 자판기 로봇 공통 부품 — 파일 읽고 쓰기, 인터넷에서 가져오기, 번역, AI 부르기.

AI 순서: Claude(유료 API, 이 저장소 몫 한도 안에서) → Gemini(무료) → Groq(무료).
  · 한도: CLAUDE_MONTHLY_USD (기본 15달러). 자판기 전체 70달러 중 이 사이트 몫.
  · 주기: 매달 30일(2월은 말일)에 새로 시작 — 주현의 API 크레딧 지정일.
  · 쓴 돈은 data/claude_usage/<로봇이름>.json 에 적음.
열쇠가 하나도 없으면 AI 일은 건너뛰고 전에 있던 자료를 그대로 둠.
"""
from __future__ import annotations

import calendar
import hashlib
import html
import json
import os
import re
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
KST = timezone(timedelta(hours=9))
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
BOT_UA = "vfm-consumer-robot/1.0 (https://github.com/Jeffreryinko/vfm-consumer; personal reading app)"


def log(*a): print(*a, flush=True)


def now(): return datetime.now(KST)


def today(): return now().strftime("%Y-%m-%d")


def rj(p, d=None):
    try: return json.loads(Path(p).read_text(encoding="utf-8"))
    except Exception: return d


def wj(p, o):
    Path(p).parent.mkdir(parents=True, exist_ok=True)
    Path(p).write_text(json.dumps(o, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def sid(*parts):
    return hashlib.md5("|".join(str(x) for x in parts).encode()).hexdigest()[:10]


def clean(s, n=None):
    s = html.unescape(re.sub(r"<[^>]+>", " ", str(s or "")))
    s = re.sub(r"\s+", " ", s).strip()
    return s[:n] if n else s


# ───────── 가져오기 ─────────
def get(url, headers=None, timeout=30, data=None, ua=UA, tries=2):
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, data=data, headers={"User-Agent": ua, "Accept-Language": "ko,en;q=0.8", **(headers or {})})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                raw = r.read()
                if r.headers.get("Content-Encoding") == "gzip":
                    import gzip; raw = gzip.decompress(raw)
                return raw.decode(r.headers.get_content_charset() or "utf-8", "replace")
        except urllib.error.HTTPError as e:
            last = f"HTTP {e.code}"
            if e.code in (400, 401, 403, 404): break
        except Exception as e:
            last = str(e)
        time.sleep(2 + i * 3)
    raise RuntimeError(f"{url[:90]} → {last}")


def get_json(url, headers=None, timeout=30, data=None, ua=UA):
    if isinstance(data, (dict, list)):
        data = json.dumps(data).encode(); headers = {"Content-Type": "application/json", **(headers or {})}
    return json.loads(get(url, headers, timeout, data, ua))


# ───────── 출처 상태 (깨진 곳은 직전 성공본을 쓰고, 3일 넘으면 화면에 표시) ─────────
STATUS = DATA / "status.json"
_SLOCK = threading.Lock()


def mark(name, ok, note=""):
    with _SLOCK:
        st = rj(STATUS, {}) or {}
        r = st.get(name, {})
        r["try"] = now().isoformat(timespec="minutes")
        if ok: r["ok"] = r["try"]; r.pop("err", None)
        else: r["err"] = str(note)[:160]
        if note and ok: r["n"] = note
        st[name] = r
        wj(STATUS, st)


# ───────── 번역 (구글 공개 번역 → 안 되면 DeepL 무료, 같은 글은 다시 번역하지 않음) ─────────
TCACHE = DATA / "_tcache.json"
_tc = None
_TLOCK = threading.Lock()


def _cache():
    global _tc
    if _tc is None: _tc = rj(TCACHE, {}) or {}
    return _tc


def save_tcache():
    c = _cache()
    if len(c) > 12000:
        for k in list(c)[: len(c) - 12000]: c.pop(k)
    wj(TCACHE, c)


def is_ko(s): return len(re.findall(r"[가-힣]", s or "")) > len(s or "") * 0.25


def _gtx(texts):
    q = "\n".join(texts)
    url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ko&dt=t&q=" + urllib.parse.quote(q)
    r = json.loads(get(url, timeout=25, tries=1))
    out = "".join(seg[0] for seg in r[0] if seg and seg[0])
    parts = out.split("\n")
    if len(parts) != len(texts): raise RuntimeError("줄 수가 안 맞음")
    return parts


def _deepl(texts):
    key = os.environ.get("DEEPL_API_KEY", "").strip()
    if not key: raise RuntimeError("DeepL 열쇠 없음")
    host = "api-free.deepl.com" if key.endswith(":fx") else "api.deepl.com"
    body = urllib.parse.urlencode([("target_lang", "KO")] + [("text", t) for t in texts]).encode()
    r = json.loads(get(f"https://{host}/v2/translate", {"Authorization": "DeepL-Auth-Key " + key, "Content-Type": "application/x-www-form-urlencoded"}, 40, body, tries=1))
    return [x["text"] for x in r["translations"]]


def _ai_tr(texts):
    """무료 AI 로 제목 번역 (구글·DeepL 이 막혔을 때)"""
    p = ("다음 제목들을 자연스러운 한국어 뉴스 제목으로 번역해. 고유명사(회사·게임·브랜드)는 한국에서 쓰는 이름으로. "
         "답은 JSON {\"ko\":[번역들]} — 순서와 개수를 그대로.\n" + json.dumps(texts, ensure_ascii=False))
    for fn in (gemini, groq):
        res, err = fn(p)
        if res:
            arr = parse_json(res[0]).get("ko") or []
            if len(arr) == len(texts): return [str(x) for x in arr]
    raise RuntimeError("AI 번역 실패")


def translate(texts):
    """여러 글을 한국어로. 이미 한국어면 그대로. 실패하면 원문."""
    c, out, todo = _cache(), list(texts), []
    for i, t in enumerate(texts):
        t = (t or "").strip()
        if not t or is_ko(t): continue
        k = sid(t)
        if k in c: out[i] = c[k]
        else: todo.append(i)
    fails, s0 = 0, 0
    while s0 < len(todo):
        n = 20 if fails < 3 else 80                      # 구글이 막히면 AI 로 한 번에 많이
        chunk = todo[s0:s0 + n]; s0 += n
        src = [texts[i].replace("\n", " ").strip()[:300] for i in chunk]
        res = None
        for fn in ((_gtx, _gtx, _deepl, _ai_tr) if fails < 3 else (_deepl, _ai_tr)):
            try: res = fn(src); fails = 0 if fn is _gtx else fails; break
            except Exception as e:
                log(f"  번역 {fn.__name__} 실패: {str(e)[:80]}")
                if fn is _gtx: fails += 1; time.sleep(8)
        if not res: continue
        with _TLOCK:
            for i, ko in zip(chunk, res):
                ko = clean(ko)
                if ko: out[i] = ko; c[sid(texts[i].strip())] = ko
        time.sleep(1.2)
    return out


# ───────── AI ─────────
def http_json(url, body=None, headers=None, timeout=120):
    req = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json", "User-Agent": BOT_UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


SYSTEM = "답은 설명 없이 JSON 객체 하나만 써. 한국어 글은 음슴체(~함, ~임, ~했음)로 쓰고, 사실은 주어진 자료에 있는 것만 써."


def gemini(prompt, max_out=16000):
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not key: return None, "열쇠 없음"
    base = "https://generativelanguage.googleapis.com/v1beta"
    model = os.environ.get("GEMINI_MODEL", "").strip()
    cands = [model] if model else []
    if not cands:
        try:
            ms = http_json(f"{base}/models?key={key}&pageSize=200", timeout=30).get("models", [])
            names = [m["name"].split("/")[-1] for m in ms if "generateContent" in (m.get("supportedGenerationMethods") or [])]
            flash = [n for n in names if "flash" in n and not re.search(r"lite|image|tts|live|audio|embedding|8b|thinking|preview-0[0-9]", n)]
            ver = lambda n: [float(x) for x in re.findall(r"\d+(?:\.\d+)?", n)[:1]] or [0]
            flash.sort(key=lambda n: (ver(n), "latest" in n, "preview" not in n and "exp" not in n), reverse=True)
            cands = flash[:3]
        except Exception as e:
            return None, f"모델 목록 실패: {e}"
    err = "쓸 모델 없음"
    for m in cands + cands[:1]:
        try:
            r = http_json(f"{base}/models/{m}:generateContent?key={key}",
                          {"systemInstruction": {"parts": [{"text": SYSTEM}]},
                           "contents": [{"role": "user", "parts": [{"text": prompt}]}],
                           "generationConfig": {"temperature": 0.3, "responseMimeType": "application/json", "maxOutputTokens": max_out}})
            txt = "".join(p.get("text", "") for p in r["candidates"][0]["content"]["parts"])
            return (txt, "gemini:" + m), None
        except urllib.error.HTTPError as e:
            err = f"{m}: HTTP {e.code} {e.read()[:200].decode('utf-8', 'ignore')}"; log("  Gemini 실패 →", err)
            if e.code in (429, 503): time.sleep(20)
        except Exception as e:
            err = f"{m}: {e}"; log("  Gemini 실패 →", err)
    return None, err


def groq(prompt, max_out=8000):
    key = os.environ.get("GROQ_API_KEY", "").strip()
    if not key: return None, "열쇠 없음"
    base, H = "https://api.groq.com/openai/v1", {"Authorization": "Bearer " + key}
    model = os.environ.get("GROQ_MODEL", "").strip()
    cands = [model] if model else []
    if not cands:
        try:
            ids = [m["id"] for m in http_json(base + "/models", headers=H, timeout=30).get("data", []) if m.get("active", True)]
            for p in [r"gpt-oss-120b", r"kimi", r"llama-4", r"llama-3\.3-70b", r"qwen", r"70b", r"gpt-oss"]:
                cands += [i for i in ids if re.search(p, i) and i not in cands and not re.search(r"guard|whisper|tts|vision|safeguard", i)]
            cands = cands[:3]
        except Exception as e:
            return None, f"모델 목록 실패: {e}"
    err = "쓸 모델 없음"
    for m in cands:
        try:
            r = http_json(base + "/chat/completions", {"model": m, "temperature": 0.3, "response_format": {"type": "json_object"},
                                                       "messages": [{"role": "system", "content": SYSTEM}, {"role": "user", "content": prompt}]}, headers=H)
            return (r["choices"][0]["message"]["content"], "groq:" + m), None
        except urllib.error.HTTPError as e:
            err = f"{m}: HTTP {e.code} {e.read()[:200].decode('utf-8', 'ignore')}"; log("  Groq 실패 →", err)
        except Exception as e:
            err = f"{m}: {e}"; log("  Groq 실패 →", err)
    return None, err


PRICE = {"claude-haiku-5-5": (0.10, 0.50), "claude-sonnet-5-5": (2.0, 10.0), "claude-opus-5-5": (4.0, 20.0)}
UDIR = DATA / "claude_usage"
USAGE = UDIR / ((os.environ.get("CLAUDE_USAGE_NAME") or Path(sys.argv[0]).stem or "etc") + ".json")
_ULOCK = threading.Lock()


def _reset_day(y, m): return min(int(os.environ.get("CLAUDE_RESET_DAY") or 30), calendar.monthrange(y, m)[1])


def claude_period(n=None):
    n = n or now(); y, m = n.year, n.month
    if n.day < _reset_day(y, m): y, m = (y - 1, 12) if m == 1 else (y, m - 1)
    return f"{y}-{m:02d}-{_reset_day(y, m):02d}"


def claude_spent():
    per, td, tot, tday = claude_period(), today(), 0.0, 0.0
    for f in UDIR.glob("*.json"):
        r = (rj(f, {}) or {}).get(per) or {}
        tot += float(r.get("usd", 0)); tday += float((r.get("days") or {}).get(td, 0))
    return tot, tday


def claude_days_left():
    n = now(); y, m, _ = map(int, claude_period(n).split("-"))
    y2, m2 = (y + 1, 1) if m == 12 else (y, m + 1)
    nxt = datetime(y2, m2, _reset_day(y2, m2), tzinfo=KST)
    return max(1, (nxt.date() - n.date()).days)


def claude(prompt, model=None, max_tokens=16000):
    key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if not key: return None, "열쇠 없음"
    cap = float(os.environ.get("CLAUDE_MONTHLY_USD") or 15)
    spent, tday = claude_spent()
    if spent >= cap: return None, f"이번 주기 한도 {cap}달러 다 씀 ({spent:.2f})"
    allow = (cap - (spent - tday)) / claude_days_left()
    if tday >= allow: return None, f"오늘 몫 {allow:.2f}달러 다 씀 ({tday:.2f})"
    m = model or os.environ.get("CLAUDE_MODEL", "").strip() or "claude-sonnet-5-5"
    H = {"x-api-key": key, "anthropic-version": "2023-06-01"}
    body = {"model": m, "max_tokens": max_tokens, "output_config": {"effort": "low"}, "system": SYSTEM,
            "messages": [{"role": "user", "content": prompt}]}
    try:
        try:
            r = http_json("https://api.anthropic.com/v1/messages", body, headers=H, timeout=300)
        except urllib.error.HTTPError as e:
            if e.code != 400: raise
            body.pop("output_config", None)
            r = http_json("https://api.anthropic.com/v1/messages", body, headers=H, timeout=300)
    except urllib.error.HTTPError as e:
        return None, f"{m}: HTTP {e.code} {e.read()[:200].decode('utf-8', 'ignore')}"
    except Exception as e:
        return None, f"{m}: {e}"
    us = r.get("usage") or {}
    pi, po = PRICE.get(m, (4.0, 20.0))
    cost = (us.get("input_tokens", 0) * pi + us.get("output_tokens", 0) * po) / 1e6
    with _ULOCK:
        u = rj(USAGE, {}) or {}
        rec = u.setdefault(claude_period(), {"usd": 0, "calls": 0, "in": 0, "out": 0})
        rec["usd"] = round(rec["usd"] + cost, 4); rec["calls"] += 1
        rec["in"] += us.get("input_tokens", 0); rec["out"] += us.get("output_tokens", 0)
        dd = rec.setdefault("days", {}); dd[today()] = round(dd.get(today(), 0) + cost, 4)
        for k in sorted(dd)[:-40]: dd.pop(k)
        wj(USAGE, u)
    log(f"  Claude {m}: 입력 {us.get('input_tokens', 0):,} · 출력 {us.get('output_tokens', 0):,} · {cost:.3f}달러 (이번 주기 {rec['usd']:.2f}/{cap})")
    txt = "".join(b.get("text", "") for b in r.get("content") or [] if b.get("type") == "text")
    return (txt, "claude:" + m), None


def ai_chain(cheap=False):
    c = (lambda p: claude(p, "claude-haiku-5-5", 8000)) if cheap else claude
    return (("Claude", c), ("Gemini", gemini), ("Groq", groq))


def free_chain():
    return (("Gemini", gemini), ("Groq", groq))


def any_key():
    return any(os.environ.get(k) for k in ("ANTHROPIC_API_KEY", "GEMINI_API_KEY", "GROQ_API_KEY"))


def parse_json(txt):
    txt = (txt or "").strip()
    m = re.search(r"\{.*\}", txt, re.S)
    raw = m.group(0) if m else txt
    try:
        return json.loads(raw)
    except Exception:
        try:
            import json_repair
            o = json_repair.loads(raw)
            if isinstance(o, dict) and o: return o
        except ImportError:
            pass
        return json.loads(re.sub(r",\s*([}\]])", r"\1", raw))


def ask(prompt, chain=None, check=None):
    """AI 사슬을 차례로 불러 JSON 을 받음. check(o) 가 False 면 다음 AI 로."""
    for name, fn in chain or ai_chain():
        res, err = fn(prompt)
        if not res: log(f"  {name}: {err}"); continue
        try:
            o = parse_json(res[0])
            if check and not check(o): log(f"  {name}: 답이 모자람"); continue
            return o, res[1]
        except Exception as e:
            log(f"  {name}: 답을 못 읽음 ({e})")
    return None, ""
