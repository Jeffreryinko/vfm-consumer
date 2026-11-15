#!/usr/bin/env python3
"""돈 로봇 — 매일 1번. 주가(야후 파이낸스) · 공시(DART·SEC) · 경제 지표(한국은행 ECOS · FRED · 세계은행).

저장
  data/stock/latest.json : 회사별 {c 종가, ch 하루 변화%, w 1년 주간 종가[], cur 통화, at}
  data/cal/filings.json  : 최근 60일 실적·주요 공시 (한국 DART · 미국 SEC 8-K 2.02)
  data/econ/latest.json  : 월별·연도별 경제 숫자 (연표 옆 '그 시기 경제'와 '경제 날씨', 물가 환산에 씀)
"""
from __future__ import annotations

import io
import json
import os
import sys
import zipfile
from datetime import timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common as C  # noqa: E402

COS = C.rj(C.DATA / "companies.json", {}) or {}


# ───────── 주가 ─────────
def yahoo(sym):
    o = C.get_json(f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}?range=1y&interval=1wk", timeout=25)
    r = o["chart"]["result"][0]
    closes = [round(x, 2) if x else None for x in r["indicators"]["quote"][0]["close"]]
    closes = [x for x in closes if x]
    meta = r["meta"]
    c = meta.get("regularMarketPrice") or closes[-1]
    pc = meta.get("chartPreviousClose") or meta.get("previousClose")
    d = C.get_json(f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}?range=5d&interval=1d", timeout=25)["chart"]["result"][0]
    dc = [x for x in d["indicators"]["quote"][0]["close"] if x]
    ch = round((dc[-1] / dc[-2] - 1) * 100, 2) if len(dc) >= 2 else None
    return {"c": round(c, 2), "ch": ch, "w": closes[-53:], "cur": meta.get("currency", ""), "y1": round((closes[-1] / closes[0] - 1) * 100, 1) if closes else None}


def stocks():
    out, ok = {}, 0
    old = (C.rj(C.DATA / "stock" / "latest.json", {}) or {}).get("q", {})
    for co in COS.get("list", []):
        sym = co.get("tk")
        if not sym: continue
        try:
            out[co["id"]] = {**yahoo(sym), "tk": sym, "at": C.today()}; ok += 1
        except Exception as e:
            C.log(f"  주가 {sym} 실패: {e}")
            if co["id"] in old: out[co["id"]] = {**old[co["id"]], "stale": True}
    C.wj(C.DATA / "stock" / "latest.json", {"at": C.now().isoformat(timespec="minutes"), "q": out})
    C.mark("stock:yahoo", ok > 0, f"{ok}곳")
    C.log(f"주가 {ok}곳")


# ───────── 공시 ─────────
def dart_corp_map():
    cache = C.DATA / "_dart_corp.json"
    m = C.rj(cache, {}) or {}
    need = {co["dart"] for co in COS.get("list", []) if co.get("dart")}
    if need <= set(m): return m
    key = os.environ.get("DART_API_KEY", "").strip()
    import urllib.request
    raw = urllib.request.urlopen(f"https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key={key}", timeout=60).read()
    import xml.etree.ElementTree as ET
    xml = zipfile.ZipFile(io.BytesIO(raw)).read("CORPCODE.xml")
    for e in ET.fromstring(xml).iter("list"):
        sc = (e.findtext("stock_code") or "").strip()
        if sc in need: m[sc] = e.findtext("corp_code")
    C.wj(cache, m)
    return m


def dart():
    key = os.environ.get("DART_API_KEY", "").strip()
    if not key: return []
    cm = dart_corp_map()
    bgn = (C.now() - timedelta(days=60)).strftime("%Y%m%d")
    out = []
    for co in COS.get("list", []):
        sc = co.get("dart")
        if not sc or sc not in cm: continue
        try:
            o = C.get_json(f"https://opendart.fss.or.kr/api/list.json?crtfc_key={key}&corp_code={cm[sc]}&bgn_de={bgn}&page_count=40")
            for x in o.get("list", []) or []:
                nm = x.get("report_nm", "")
                if any(w in nm for w in ("영업(잠정)실적", "분기보고서", "반기보고서", "사업보고서", "타법인주식", "유상증자", "주요사항", "합병", "공개매수")):
                    out.append({"co": co["id"], "d": f"{x['rcept_dt'][:4]}-{x['rcept_dt'][4:6]}-{x['rcept_dt'][6:]}", "t": nm.strip(),
                                "url": f"https://dart.fss.or.kr/dsaf001/main.do?rcpNo={x['rcept_no']}", "src": "DART",
                                "kind": "earn" if "실적" in nm or "보고서" in nm else "deal"})
        except Exception as e:
            C.log(f"  DART {co['n']} 실패: {e}")
    return out


def sec():
    mail = os.environ.get("SEC_CONTACT_EMAIL", "").strip()
    if not mail: return []
    out = []
    cut = (C.now() - timedelta(days=60)).strftime("%Y-%m-%d")
    for co in COS.get("list", []):
        cik = co.get("cik")
        if not cik: continue
        try:
            o = C.get_json(f"https://data.sec.gov/submissions/CIK{int(cik):010d}.json", ua=f"vfm-consumer {mail}")
            r = o.get("filings", {}).get("recent", {})
            for i, form in enumerate(r.get("form", [])[:80]):
                d = r["filingDate"][i]
                if d < cut: break
                items = r.get("items", [""] * 80)[i] or ""
                if (form == "8-K" and "2.02" in items) or form in ("10-Q", "10-K", "20-F", "6-K"):
                    acc = r["accessionNumber"][i].replace("-", "")
                    out.append({"co": co["id"], "d": d, "t": {"8-K": "실적 발표(8-K)", "10-Q": "분기 보고서(10-Q)", "10-K": "연간 보고서(10-K)", "20-F": "연간 보고서(20-F)", "6-K": "해외기업 공시(6-K)"}[form],
                                "url": f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{acc}/{r['primaryDocument'][i]}", "src": "SEC", "kind": "earn"})
        except Exception as e:
            C.log(f"  SEC {co['n']} 실패: {e}")
    return out


def filings():
    rows = []
    for fn in (dart, sec):
        try: got = fn(); rows += got; C.mark("filings:" + fn.__name__, True, len(got))
        except Exception as e: C.mark("filings:" + fn.__name__, False, e); C.log(f"  {fn.__name__}: {e}")
    if rows:
        rows.sort(key=lambda x: x["d"], reverse=True)
        C.wj(C.DATA / "cal" / "filings.json", {"at": C.now().isoformat(timespec="minutes"), "items": rows[:300]})
    C.log(f"공시 {len(rows)}건")


# ───────── 경제 지표 ─────────
def ecos(stat, cycle, start, end, item, item2=""):
    key = os.environ.get("ECOS_API_KEY", "").strip()
    if not key: raise RuntimeError("열쇠 없음")
    url = f"https://ecos.bok.or.kr/api/StatisticSearch/{key}/json/kr/1/2000/{stat}/{cycle}/{start}/{end}/{item}" + (f"/{item2}" if item2 else "")
    o = C.get_json(url)
    rows = (o.get("StatisticSearch") or {}).get("row") or []
    if not rows: raise RuntimeError(json.dumps(o, ensure_ascii=False)[:160])
    return [[r["TIME"][:4] + ("-" + r["TIME"][4:6] if len(r["TIME"]) >= 6 else ""), float(r["DATA_VALUE"])] for r in rows if r.get("DATA_VALUE") not in (None, "")]


def fred(series, freq="m", start="1960-01-01"):
    key = os.environ.get("FRED_API_KEY", "").strip()
    if not key: raise RuntimeError("열쇠 없음")
    o = C.get_json(f"https://api.stlouisfed.org/fred/series/observations?series_id={series}&api_key={key}&file_type=json&frequency={freq}&observation_start={start}")
    return [[x["date"][:7] if freq == "m" else x["date"][:4], float(x["value"])] for x in o.get("observations", []) if x.get("value") not in (".", "")]


def worldbank(ind):
    o = C.get_json(f"https://api.worldbank.org/v2/country/KOR;USA;JPN;CHN;DEU;FRA;SAU;ARE/indicator/{ind}?format=json&per_page=3000&date=1960:2030")
    out = {}
    for x in o[1] or []:
        if x.get("value") is None: continue
        out.setdefault(x["countryiso3code"], []).append([x["date"], round(float(x["value"]), 2)])
    for k in out: out[k].sort()
    return out


def econ():
    path = C.DATA / "econ" / "latest.json"
    E = (C.rj(path, {}) or {}).get("s", {})
    ym = C.now().strftime("%Y%m")
    jobs = {
        "kr_rate": ("한국 기준금리(%)", lambda: ecos("722Y001", "M", "199901", ym, "0101000")),
        "kr_usd": ("원·달러 환율(월평균, 원)", lambda: ecos("731Y004", "M", "196401", ym, "0000001", "0000100")),
        "kr_cpi_m": ("한국 소비자물가지수(월, 2020=100)", lambda: ecos("901Y009", "M", "196501", ym, "0")),
        "kr_cpi_y": ("한국 소비자물가지수(연, 2020=100)", lambda: ecos("901Y009", "A", "1965", ym[:4], "0")),
        "kr_csi": ("한국 소비자심리지수", lambda: ecos("511Y002", "M", "200801", ym, "FME", "99988")),
        "us_rate": ("미국 기준금리(%)", lambda: fred("FEDFUNDS")),
        "us_cpi_y": ("미국 소비자물가지수(연)", lambda: fred("CPIAUCSL", "a", "1947-01-01")),
        "us_sent": ("미국 소비자심리(미시간대)", lambda: fred("UMCSENT")),
        "jpy_usd": ("엔·달러 환율(엔)", lambda: fred("DEXJPUS")),
        "cny_usd": ("위안·달러 환율(위안)", lambda: fred("DEXCHUS")),
    }
    ok = 0
    for k, (name, fn) in jobs.items():
        try: E[k] = {"t": name, "v": fn()}; ok += 1; C.mark("econ:" + k, True)
        except Exception as e: C.mark("econ:" + k, False, e); C.log(f"  경제 {k} 실패: {e}")
    wb = {"gdp_g": ("경제성장률(%)", "NY.GDP.MKTP.KD.ZG"), "infl": ("물가상승률(%)", "FP.CPI.TOTL.ZG"), "gdp_pc": ("1인당 국민소득(달러)", "NY.GDP.PCAP.CD"),
          "unemp": ("실업률(%)", "SL.UEM.TOTL.ZS")}
    for k, (name, ind) in wb.items():
        try: E["wb_" + k] = {"t": name, "by": worldbank(ind)}; ok += 1; C.mark("econ:wb_" + k, True)
        except Exception as e: C.mark("econ:wb_" + k, False, e); C.log(f"  세계은행 {k} 실패: {e}")
    C.wj(path, {"at": C.now().isoformat(timespec="minutes"), "s": E})
    C.log(f"경제 지표 {ok}개")


# ───────── 화장품 수출 (관세청, 공공데이터포털) ─────────
def customs():
    """HS 3304(화장품·메이크업·기초) · 3303(향수) · 3305(헤어) 나라별·달별 수출액 (달러)"""
    key = os.environ.get("DATA_GO_KR_KEY", "").strip()
    if not key: raise RuntimeError("열쇠 없음")
    import urllib.parse, xml.etree.ElementTree as ET
    path = C.DATA / "econ" / "kbeauty_export.json"
    old = C.rj(path, {}) or {}
    M = old.get("m", {})          # {"3304": {"2024-01": usd}}
    CC = old.get("cc", {})        # {"3304": {"2024": {"US": usd}}}
    y0, y1 = 2012, C.now().year
    for hs in ("3304", "3303", "3305"):
        for y in range(y0, y1 + 1):
            if str(y) in CC.get(hs, {}) and y < y1 - 1: continue   # 지난 해는 한 번만
            url = ("https://apis.data.go.kr/1220000/nitemtrade/getNitemtradeList?serviceKey=" + urllib.parse.quote(key, safe="")
                   + f"&strtYymm={y}01&endYymm={y}12&hsSgn={hs}")
            try:
                xml = C.get(url, timeout=40)
            except Exception:
                url = url.replace("/nitemtrade/getNitemtradeList", "/Itemtrade/getItemtradeList"); xml = C.get(url, timeout=40)
            root = ET.fromstring(xml)
            for it in root.iter("item"):
                ym = (it.findtext("year") or "").replace(".", "-")[:7]
                cc = (it.findtext("statCd") or it.findtext("statCdCntnKor1") or "").strip()
                v = float(it.findtext("expDlr") or 0)
                if not ym or ym.startswith("총"): continue
                if len(ym) == 7: M.setdefault(hs, {})[ym] = M.get(hs, {}).get(ym, 0) + v if cc else v
                if cc: CC.setdefault(hs, {}).setdefault(str(y), {})[cc] = CC.get(hs, {}).get(str(y), {}).get(cc, 0) + v
    C.wj(path, {"at": C.now().isoformat(timespec="minutes"), "note": "관세청 품목별 수출 (달러). 3304 화장품, 3303 향수, 3305 헤어", "m": M, "cc": CC})
    return sum(len(v) for v in M.values())


def main():
    which = sys.argv[1:] or ["stock", "filings", "econ", "customs"]
    if "customs" in which:
        try: n = customs(); C.mark("econ:customs", True, n); C.log(f"화장품 수출 {n}달")
        except Exception as e: C.mark("econ:customs", False, e); C.log(f"화장품 수출 실패: {e}")
    if "stock" in which: stocks()
    if "filings" in which: filings()
    if "econ" in which: econ()


if __name__ == "__main__":
    main()
