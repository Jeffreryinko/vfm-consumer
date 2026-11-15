/* 뷰티, 폰게임 자판기 — 화면 전부 (한 파일, 바깥 라이브러리 없음)
 *
 * 화면 주소(#)
 *   #/            홈 '오늘의 한 페이지'
 *   #/b, #/g      뷰티·게임 — 하위: brief(브리핑) rank(순위) cal(달력) co(회사) map(업계 지도) buzz(반응)
 *   #/l           배움 — 오늘 할 것 / 코스 / 연표 / 사전 / 복습 / 내 수준
 *   #/l/u/<id>    역사 글 읽기 (넓은 화면: 왼쪽 글 + 오른쪽 그 시기 경제·사회)
 *   #/l/tl/<ind>  연표 (10년마다 그 시기 상황을 옆에)
 *   #/x           보관함 (별표·관심 회사·키워드·기록)
 * 기록: localStorage 'vfm:cs:*' (구글 로그인 시 다른 자판기와 함께 동기화)
 */
(function () {
  "use strict";
  var V = window.vfm = window.vfm || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var app = $("#app");
  var IND = { b: "beauty", g: "game" }, INDK = { beauty: "b", game: "g" }, INDN = { beauty: "뷰티", game: "폰게임" };
  var CCN = { kr: "한국", us: "미국", gb: "영국", jp: "일본", cn: "중국", tw: "대만", fr: "프랑스", de: "독일", ae: "UAE", sa: "사우디", in: "인도", sg: "싱가포르", eu: "유럽", me: "중동", ww: "세계" };
  var FLAG = { kr: "🇰🇷", us: "🇺🇸", gb: "🇬🇧", jp: "🇯🇵", cn: "🇨🇳", tw: "🇹🇼", fr: "🇫🇷", de: "🇩🇪", ae: "🇦🇪", sa: "🇸🇦", in: "🇮🇳", sg: "🇸🇬", eu: "🇪🇺", me: "🕌", ww: "🌐" };
  var KINDN = { trade: "업계지", gen: "일반", biz: "경제지", press: "보도자료", comm: "커뮤니티" };

  /* ───────── 작은 도구 ───────── */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var CACHE = {};
  function load(p) {
    if (!CACHE[p]) CACHE[p] = fetch("data/" + p + (p.indexOf("?") < 0 ? "?v=" + Math.floor(Date.now() / 6e5) : ""), { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).catch(function () { delete CACHE[p]; return null; });
    return CACHE[p];
  }
  function S(k, d) { try { var v = localStorage.getItem("vfm:cs:" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function W(k, v) { try { localStorage.setItem("vfm:cs:" + k, JSON.stringify(v)); } catch (e) { } }
  function day(o) { return new Date(Date.now() + 9 * 3600e3 + (o || 0) * 864e5).toISOString().slice(0, 10); }
  function toast(m) { var t = document.createElement("div"); t.className = "toast"; t.textContent = m; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2200); }
  V.toast = toast;
  function tick(k) { try { V.tick && V.tick(k); } catch (e) { } }
  function ago(iso) {
    if (!iso) return ""; var d = (Date.now() - Date.parse(iso)) / 6e4;
    if (d < 60) return Math.max(1, Math.round(d)) + "분 전"; if (d < 1440) return Math.round(d / 60) + "시간 전"; return Math.round(d / 1440) + "일 전";
  }
  function kday(iso) { if (!iso) return ""; var d = new Date(iso.length <= 10 ? iso + "T00:00:00+09:00" : iso); return (d.getMonth() + 1) + "월 " + d.getDate() + "일 " + "일월화수목금토"[d.getDay()] + "요일"; }
  function num(n, d) { return n == null || isNaN(n) ? "–" : Number(n).toLocaleString("ko-KR", { maximumFractionDigits: d == null ? 0 : d }); }
  function won(v) {   // 원화 큰 숫자
    if (!v) return ""; var a = Math.abs(v);
    if (a >= 1e12) return (v / 1e12).toFixed(a >= 1e13 ? 0 : 1).replace(/\.0$/, "") + "조 원";
    if (a >= 1e8) return Math.round(v / 1e8).toLocaleString() + "억 원";
    if (a >= 1e4) return Math.round(v / 1e4).toLocaleString() + "만 원";
    return Math.round(v).toLocaleString() + "원";
  }
  var ICON = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
    beauty: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="10" width="8" height="11" rx="2"/><path d="M9.5 10V6.5a2.5 2.5 0 0 1 5 0V10M12 3v1"/></svg>',
    game: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M10 18.5h4M9.5 8.5h2M10.5 7.5v2M14.5 8.5h.01"/></svg>',
    learn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M2 7l10-4 10 4-10 4z"/><path d="M6 9v5c0 1.7 2.7 3 6 3s6-1.3 6-3V9M22 7v6"/></svg>',
    box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
    chev: '<svg class="chev" width="8" height="13" viewBox="0 0 8 13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m1.5 1.5 5 5-5 5"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>',
    sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></svg>'
  };

  /* ───────── 별표·관심·읽음 ───────── */
  function starred(id) { return S("star", []).some(function (x) { return x.id === id; }); }
  function toggleStar(o) {
    var a = S("star", []), i = a.findIndex(function (x) { return x.id === o.id; });
    if (i >= 0) { a.splice(i, 1); toast("보관함에서 뺐음"); } else { a.unshift(Object.assign({ at: Date.now() }, o)); toast("보관함에 담았음 ★"); tick("card"); }
    W("star", a.slice(0, 500)); return i < 0;
  }
  function starBtn(o) { return '<button class="star' + (starred(o.id) ? " on" : "") + '" data-star=\'' + esc(JSON.stringify(o)) + '\' aria-label="보관함">' + (starred(o.id) ? "★" : "☆") + "</button>"; }
  function following(id) { return S("follow", []).indexOf(id) >= 0; }
  function markRead(k, id) { var r = S("read:" + k, {}); if (!r[id]) { r[id] = day(); W("read:" + k, r); return true; } return false; }
  function isRead(k, id) { return !!S("read:" + k, {})[id]; }

  /* ───────── 그림 ───────── */
  function spark(vals, w, h, color) {
    vals = (vals || []).filter(function (v) { return v != null; }); if (vals.length < 2) return "";
    w = w || 120; h = h || 40;
    var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals), sp = mx - mn || 1;
    var pts = vals.map(function (v, i) { return (i / (vals.length - 1) * w).toFixed(1) + "," + (h - 3 - (v - mn) / sp * (h - 6)).toFixed(1); });
    var up = vals[vals.length - 1] >= vals[0];
    var c = color || (up ? "var(--up)" : "var(--down)");
    return '<svg class="spark" viewBox="0 0 ' + w + " " + h + '" preserveAspectRatio="none"><polyline fill="none" stroke="' + c + '" stroke-width="1.8" stroke-linejoin="round" vector-effect="non-scaling-stroke" points="' + pts.join(" ") + '"/></svg>';
  }
  function lineChart(series, opt) {   // series: [{name, color, pts:[[label, v]]}]
    opt = opt || {}; var W0 = 640, H0 = opt.h || 220, L = 44, R = 10, T = 14, B = 26;
    var labels = []; series.forEach(function (s) { s.pts.forEach(function (p) { if (labels.indexOf(p[0]) < 0) labels.push(p[0]); }); }); labels.sort();
    if (labels.length < 2) return '<div class="empty">아직 그릴 자료가 없음</div>';
    var all = []; series.forEach(function (s) { s.pts.forEach(function (p) { all.push(p[1]); }); });
    var mn = opt.zero ? 0 : Math.min.apply(null, all), mx = Math.max.apply(null, all); if (mx === mn) mx = mn + 1;
    var x = function (lb) { return L + labels.indexOf(lb) / (labels.length - 1) * (W0 - L - R); };
    var y = function (v) { return T + (1 - (v - mn) / (mx - mn)) * (H0 - T - B); };
    var g = "";
    for (var i = 0; i <= 4; i++) { var v = mn + (mx - mn) * i / 4; g += '<line x1="' + L + '" x2="' + (W0 - R) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="var(--sep)" stroke-width=".6"/><text x="' + (L - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end" font-size="11" fill="var(--ink2)">' + (opt.fmt ? opt.fmt(v) : num(v, mx - mn < 10 ? 1 : 0)) + "</text>"; }
    var step = Math.ceil(labels.length / 6);
    labels.forEach(function (lb, i) { if (i % step === 0 || i === labels.length - 1) g += '<text x="' + x(lb) + '" y="' + (H0 - 6) + '" text-anchor="middle" font-size="11" fill="var(--ink2)">' + esc(opt.lab ? opt.lab(lb) : lb) + "</text>"; });
    series.forEach(function (s) {
      var d = s.pts.slice().sort(function (a, b) { return a[0] < b[0] ? -1 : 1; }).map(function (p, i) { return (i ? "L" : "M") + x(p[0]).toFixed(1) + "," + y(p[1]).toFixed(1); }).join("");
      g += '<path d="' + d + '" fill="none" stroke="' + (s.color || "var(--tint)") + '" stroke-width="2.2" stroke-linejoin="round"/>';
    });
    var leg = series.length > 1 ? '<div class="chips" style="margin-top:6px">' + series.map(function (s) { return '<span class="pill"><i style="width:9px;height:9px;border-radius:50%;background:' + s.color + ';display:inline-block"></i>' + esc(s.name) + "</span>"; }).join("") + "</div>" : "";
    return '<svg class="chart" viewBox="0 0 ' + W0 + " " + H0 + '">' + g + "</svg>" + leg;
  }
  var PAL = ["#E5487B", "#6D4AFF", "#FF9500", "#34C759", "#0A84FF", "#AF52DE", "#FF3B30", "#30B0C7"];

  /* ───────── 시트 ───────── */
  var sheetStack = [];
  function sheet(html, opt) {
    opt = opt || {};
    var b = document.createElement("div"); b.className = "back";
    b.innerHTML = '<div class="sheet" role="dialog"><div class="grab"></div><div class="sh-top"><span class="sp"></span>' + (opt.tools || "") +
      '<button class="ib" data-close aria-label="닫기">' + ICON.close + '</button></div><div class="sh-body">' + html + "</div></div>";
    b.addEventListener("click", function (e) { if (e.target === b || e.target.closest("[data-close]")) closeSheet(); });
    document.body.appendChild(b); sheetStack.push(b);
    try { history.pushState({ sheet: sheetStack.length }, ""); } catch (e) { }
    return b;
  }
  function closeSheet(fromPop) {
    var b = sheetStack.pop(); if (!b) return false;
    b.remove(); if (!fromPop) { try { history.back(); } catch (e) { } }
    return true;
  }
  window.addEventListener("popstate", function () { if (sheetStack.length) closeSheet(true); });

  /* ───────── 공유·듣기 ───────── */
  function share(title, text) {
    var url = location.href.split("#")[0] + location.hash;
    var body = title + "\n" + (text || "") + "\n" + url;
    if (navigator.share) { navigator.share({ title: title, text: (text || "").slice(0, 300), url: url }).catch(function () { }); return; }
    (navigator.clipboard ? navigator.clipboard.writeText(body) : Promise.reject()).then(function () { toast("글과 링크를 복사했음"); }, function () { toast("복사 실패"); });
  }
  var speaking = false;
  function speak(el) {
    if (!window.speechSynthesis) return toast("이 기기는 소리 읽기를 못 함");
    if (speaking) { speechSynthesis.cancel(); speaking = false; toast("읽기 멈춤"); return; }
    var t = (el.innerText || "").replace(/AI에게 묻기/g, "").slice(0, 12000);
    var parts = t.split(/(?<=[.!?。]|[함임음됨])\s+/), i = 0; speaking = true;
    var vs = speechSynthesis.getVoices().filter(function (v) { return /ko/i.test(v.lang); });
    (function next() {
      if (!speaking || i >= parts.length) { speaking = false; return; }
      var u = new SpeechSynthesisUtterance(parts[i++]); u.lang = "ko-KR"; u.rate = S("rate", 1.05); if (vs[0]) u.voice = vs[0];
      u.onend = next; u.onerror = function () { speaking = false; }; speechSynthesis.speak(u);
    })();
    toast("소리로 읽는 중 — 한 번 더 누르면 멈춤");
  }

  /* ───────── 낱말 누르면 설명 ───────── */
  var TERMS = {};
  function loadTerms() {
    return Promise.all([load("learn/terms_beauty.json"), load("learn/terms_game.json")]).then(function (r) {
      TERMS = {}; r.forEach(function (o, i) { ((o && o.terms) || []).forEach(function (t) { t.ind = i ? "game" : "beauty"; TERMS[t.w] = t; TERMS[t.id] = t; }); });
      return TERMS;
    });
  }
  function linkTerms(html, max) {   // 글 안의 업계 낱말에 밑줄 (처음 나올 때만)
    var keys = Object.keys(TERMS).filter(function (k) { return k.length >= 2 && !/^t[bg]\d/.test(k); }).sort(function (a, b) { return b.length - a.length; });
    var used = 0, seen = {};
    keys.forEach(function (k) {
      if (used >= (max || 6) || seen[k]) return;
      var re = new RegExp("(^|[^가-힣A-Za-z>])(" + k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")(?![^<]*>)");
      if (re.test(html)) { html = html.replace(re, '$1<button class="term" data-term="' + esc(TERMS[k].id) + '">$2</button>'); used++; seen[k] = 1; }
    });
    return html;
  }
  function termSheet(id) {
    var t = TERMS[id]; if (!t) return;
    var lr = S("terms", {}); lr[t.id] = lr[t.id] || day(); W("terms", lr);
    sheet('<div class="kick">' + esc(INDN[t.ind]) + " · " + esc(t.k || "") + '</div><h2 class="h1" style="font-size:28px">' + esc(t.w) + ' <span class="mut sm">' + esc(t.en || "") + "</span></h2>" +
      '<article class="card"><p class="lede" style="margin:0;font-weight:600">' + esc(t.s) + '</p><div class="hr"></div><div class="read"><p>' + esc(t.d) + "</p>" + (t.ex ? '<p class="mut">예) ' + esc(t.ex) + "</p>" : "") + "</div>" +
      ((t.rel || []).length ? '<div class="chips">' + t.rel.map(function (w) { return TERMS[w] ? '<button class="chip" data-term="' + esc(TERMS[w].id) + '">' + esc(w) + "</button>" : ""; }).join("") + "</div>" : "") +
      "</article>" + (t.q ? quizCard([{ q: t.q.q, a: t.q.a, c: t.q.c, ex: t.q.ex, id: "t:" + t.id }]) : ""), { tools: starBtn({ id: "t:" + t.id, type: "term", t: t.w, ref: t.id }) });
  }

  /* ───────── 퀴즈·복습 (간격 반복: 맞히면 1→3→7→14→30일 뒤, 틀리면 내일) ───────── */
  var GAP = [1, 3, 7, 14, 30, 60];
  function srs(id, ok) {
    var m = S("srs", {}), r = m[id] || { b: 0 };
    r.b = ok ? Math.min(r.b + 1, GAP.length - 1) : 0; r.due = day(GAP[ok ? r.b : 0]); r.n = (r.n || 0) + 1; r.ok = (r.ok || 0) + (ok ? 1 : 0);
    m[id] = r; W("srs", m);
  }
  function quizCard(qs, opt) {
    opt = opt || {};
    return '<div class="quiz">' + qs.map(function (q, i) {
      return '<article class="card" data-q=\'' + esc(JSON.stringify({ c: q.c, id: q.id || "" })) + '\'><div class="kick" style="margin:0 0 6px">' + (opt.label || "문제") + (qs.length > 1 ? " " + (i + 1) + "/" + qs.length : "") + "</div>" +
        '<div class="h3">' + esc(q.q) + "</div>" + q.a.map(function (a, j) { return '<button class="opt" data-a="' + j + '">' + esc(a) + "</button>"; }).join("") +
        '<div class="ex" hidden>' + esc(q.ex || "") + "</div></article>";
    }).join("") + "</div>";
  }
  document.addEventListener("click", function (e) {
    var o = e.target.closest(".quiz .opt"); if (!o) return;
    var card = o.closest("[data-q]"); if (card.dataset.done) return; card.dataset.done = 1;
    var q = JSON.parse(card.dataset.q), a = +o.dataset.a, ok = a === q.c;
    $$(".opt", card).forEach(function (b, j) { if (j === q.c) b.classList.add("ok"); else if (j === a) b.classList.add("no"); });
    $(".ex", card).hidden = false;
    if (q.id) srs(q.id, ok);
    var st = S("qstat", {}); var d = st[day()] || { n: 0, ok: 0 }; d.n++; if (ok) d.ok++; st[day()] = d; W("qstat", st);
    if (ok) { tick("quiz"); } else toast("아쉬움 — 내일 다시 나옴");
  });

  /* ───────── 막대·탭 ───────── */
  function shell(t, sub) {
    document.body.className = "t-" + t + (innerWidth >= 700 ? " unf" : "");
    var tabs = [["home", "#/", "홈", ""], ["beauty", "#/b", "뷰티", "b"], ["game", "#/g", "폰게임", "g"], ["learn", "#/l", "배움", ""], ["box", "#/x", "보관함", ""]];
    return '<header class="top"><div class="wrap"><button class="logo" data-go="#/"><i></i>뷰티·폰게임 자판기</button><span class="sp"></span>' +
      '<button class="ib" data-act="search" aria-label="검색">' + ICON.search + '</button><button class="ib" data-act="menu" aria-label="설정">' + ICON.more + "</button></div></header>" +
      (sub || "") + '<main class="wrap" id="main"></main>' +
      '<nav class="tabs"><div class="wrap">' + tabs.map(function (x) { return '<button class="' + x[3] + '" data-go="' + x[1] + '"' + (x[0] === t ? ' aria-current="page"' : "") + ">" + ICON[x[0]] + x[2] + "</button>"; }).join("") + "</div></nav>";
  }
  function segBar(items, cur, base) {
    return '<div class="subnav"><div class="wrap"><div class="seg">' + items.map(function (x) { return '<button data-go="' + base + "/" + x[0] + '" aria-pressed="' + (x[0] === cur) + '">' + x[1] + "</button>"; }).join("") + "</div></div></div>";
  }
  function setMain(h) { var m = $("#main"); if (m) m.innerHTML = h; return m; }
  function skel(n) { var s = ""; for (var i = 0; i < (n || 6); i++) s += '<div class="skel" style="width:' + (60 + Math.random() * 40) + '%"></div>'; return '<div class="card">' + s + "</div>"; }

  /* ───────── 홈: 오늘의 한 페이지 ───────── */
  function viewHome() {
    app.innerHTML = shell("home");
    setMain(skel(8));
    Promise.all([load("brief/beauty/latest.json"), load("brief/game/latest.json"), load("rank/latest.json"), loadLearn("beauty"), loadLearn("game"), load("econ/latest.json"), load("brief/monthly/index.json"), loadTerms()]).then(function (r) {
      var bb = r[0], gb = r[1], rk = r[2], econ = r[5], mon = r[6];
      var streak = V.joyStreak ? V.joyStreak() : 0, jt = V.joyToday ? V.joyToday() : {};
      var h = '<input class="search" style="margin-top:14px" placeholder="회사·게임·성분·역사 찾기" data-act="search" readonly>';
      h += '<div class="kick">' + kday(day()) + (streak ? ' · <span class="pill t">🔥 ' + streak + "일 연속</span>" : "") + "</div>";
      h += '<h1 class="h1">오늘의 한 페이지</h1>';
      h += homeBrief("beauty", bb) + homeBrief("game", gb);
      h += homeMovers(rk);
      h += homeLearn();
      if (econ) h += '<h2 class="h2">경제 날씨</h2>' + econCard(econ, bb, gb);
      if (mon && mon.length) h += '<h2 class="h2">이달의 소비 분위기</h2><article class="card tap" data-act="monthly" data-id="' + esc(mon[0].id) + '"><div class="kick" style="margin:0">' + esc(mon[0].id.replace("-", "년 ") + "월") + '</div><div class="h3" style="margin-top:4px">' + esc(mon[0].t) + '</div><p class="mut" style="margin:0">' + esc(mon[0].one || "") + "</p></article>";
      if (pushOk()) { var on = S("push", []); h += '<h2 class="h2">알림</h2><div class="list">' + PT.map(function (t) { return '<button class="row" data-act="push" data-t="' + t[0] + '"><div class="tx"><b>' + t[1] + "</b><span>" + t[2] + '</span></div><span class="pill' + (on.indexOf(t[0]) >= 0 ? " t" : "") + '">' + (on.indexOf(t[0]) >= 0 ? "켜짐" : "꺼짐") + "</span></button>"; }).join("") + '</div><p class="note">아이폰은 홈 화면에 추가한 앱에서만 알림이 옴.</p>'; }
      h += '<h2 class="h2">다른 자판기</h2><div class="list">' + SITES.map(function (s) { return '<a class="row" href="' + s[0] + '"><div class="tx"><b>' + s[1] + "</b><span>" + s[2] + "</span></div>" + ICON.chev + "</a>"; }).join("") + "</div>";
      h += '<p class="note">오늘 한 것: 카드 ' + (jt.card || 0) + " · 문제 " + (jt.quiz || 0) + " · 끝낸 글 " + (jt.done || 0) + "</p>";
      setMain(h);
    });
  }
  var SITES = [["../vendingForMe/", "시사 자판기", "시사 · 딜 · AI · 도구"], ["../vfm-story/", "이야기 자판기", "이야기 · 역사 · 뇌 · 책"], ["../vfm-mind/", "사람 자판기", "배댓 · 맨탈"]];
  function homeBrief(ind, b) {
    var k = INDK[ind];
    if (!b) return '<article class="card" style="margin-top:12px"><div class="kick" style="margin:0">' + INDN[ind] + '</div><p class="mut">첫 브리핑은 다음 날 아침 6시쯤 나옴. 그 전엔 순위·배움부터 둘러보면 됨.</p><button class="btn" data-go="#/' + k + '/rank">순위 보기</button></article>';
    var lines = (b.items || []).slice(0, 3);
    return '<div class="hero ' + ind + ' tap" style="margin-top:12px" data-go="#/' + k + '"><div class="d">' + INDN[ind] + " 브리핑 · " + esc(b.label || "") + "</div>" +
      '<h1 style="font-size:20px">' + esc((b.lead || "").split(/(?<=[.다음함임])\s/)[0]) + "</h1>" +
      lines.map(function (x, i) { return '<p style="font-size:15px;margin-top:6px">' + (i + 1) + ". " + esc(x.t) + "</p>"; }).join("") + '<div class="by">눌러서 전체 보기 →</div></div>';
  }
  function homeMovers(rk) {
    if (!rk) return "";
    var B = rk.boards || {}, pick = [["g.ios.kr.gross", "game"], ["g.gp.kr.gross", "game"], ["b.amz.us", "beauty"], ["b.yt.kr", "beauty"], ["g.ios.us.gross", "game"], ["g.ios.jp.gross", "game"]];
    var out = [];
    pick.forEach(function (p) {
      var b = B[p[0]]; if (!b || !b.rows) return;
      var mv = b.rows.slice(0, 50).filter(function (x) { return x.d === "new" || (typeof x.d === "number" && x.d >= 5); }).slice(0, 2);
      if (!mv.length) mv = b.rows.slice(0, 1);
      mv.forEach(function (x) { out.push({ b: b, x: x, ind: p[1], key: p[0] }); });
    });
    if (!out.length) return "";
    return '<h2 class="h2">순위 변화<button class="more" data-go="#/g/rank">전체</button></h2><div class="list">' + out.slice(0, 7).map(function (o) {
      return '<button class="rk row" data-go="#/' + INDK[o.ind] + "/rank/" + o.key + '">' + rankImg(o.x) + '<div class="tx"><b>' + esc(o.x.ko || o.x.n) + "</b><span>" + esc(o.b.t) + " · " + o.x.r + "위</span></div>" + dl(o.x.d) + "</button>";
    }).join("") + "</div>";
  }
  function homeLearn() {
    var p = plan();
    return '<h2 class="h2">오늘 배울 것<button class="more" data-go="#/l">배움</button></h2>' + quotaHTML(p);
  }
  function econCard(econ, bb, gb) {
    var s = econ.s || {}, out = [];
    [["kr_usd", "원·달러", "원"], ["kr_rate", "한국 금리", "%"], ["kr_csi", "소비심리", ""], ["jpy_usd", "엔·달러", "엔"]].forEach(function (k) {
      var v = (s[k[0]] || {}).v || []; if (v.length < 2) return;
      var a = v[v.length - 1][1], b = v[v.length - 2][1], ch = a - b;
      out.push('<div><div class="xs mut">' + k[1] + '</div><div style="font:700 18px var(--disp)">' + num(a, a < 100 ? 2 : 0) + k[2] + '</div><div class="xs ch ' + (ch >= 0 ? "u" : "d") + '">' + (ch >= 0 ? "▲" : "▼") + num(Math.abs(ch), 2) + "</div>" + spark(v.slice(-24).map(function (x) { return x[1]; }), 100, 30, "var(--ink2)") + "</div>");
    });
    var said = [bb && bb.econ, gb && gb.econ].filter(Boolean);
    return '<article class="card">' + (out.length ? '<div class="grid g2 g3w" style="grid-template-columns:repeat(' + Math.min(out.length, 4) + ',1fr)">' + out.join("") + "</div>" : "") +
      (said.length ? '<div class="hr"></div>' + said.map(function (x, i) { return '<p style="margin:4px 0;font-size:15px;line-height:1.6"><b>' + (i ? "게임" : "뷰티") + "</b> " + esc(x) + "</p>"; }).join("") : "") + "</article>";
  }

  /* ───────── 뷰티·게임 ───────── */
  var SUBS = [["brief", "브리핑"], ["rank", "순위"], ["cal", "달력"], ["co", "회사"], ["map", "업계 지도"], ["buzz", "반응"]];
  function viewInd(ind, sub, arg) {
    sub = sub || "brief";
    app.innerHTML = shell(ind, segBar(SUBS, sub, "#/" + INDK[ind]));
    setMain(skel(10));
    ({ brief: vBrief, rank: vRank, cal: vCal, co: vCos, map: vMap, buzz: vBuzz }[sub] || vBrief)(ind, arg);
  }

  function vBrief(ind, arg) {
    Promise.all([load("brief/" + ind + "/latest.json"), loadTerms(), load("companies.json")]).then(function (r) {
      var b = r[0];
      if (!b) return setMain('<div class="empty">아직 브리핑이 없음.<br>로봇이 매일 아침 6시쯤 씀. 순위·달력·회사부터 둘러보셈.</div>');
      var seen = S("seen:" + ind, {});
      var h = '<div class="hero ' + ind + '" style="margin-top:6px"><div class="d">' + kday(b.id) + " · " + INDN[ind] + ' 아침 브리핑</div><h1>오늘의 줄기</h1><p>' + esc(b.lead) + '</p><div class="by">' + esc(b.by || "") + " 정리 · " + ago(b.at) + "</div></div>";
      h += '<div class="chips" style="margin:10px 0 0"><button class="chip" data-act="speak" data-sel="#main">' + "🔊 소리로 듣기</button><button class=\"chip\" data-act=\"share-brief\" data-ind=\"" + ind + "\">공유</button><button class=\"chip\" data-act=\"past\" data-ind=\"" + ind + "\">지난 브리핑</button></div>";
      h += '<h2 class="h2">오늘의 이슈 <small>' + (b.items || []).length + "개</small></h2>";
      h += (b.items || []).map(function (x, i) {
        return '<article class="card issue tap' + (seen[b.id + ":" + i] ? " read" : "") + '" data-act="issue" data-ind="' + ind + '" data-i="' + i + '"><div class="n">' + (i + 1) + (x.tag ? " · " + esc(x.tag) : "") + "</div><h3>" + esc(x.t) + "</h3><p>" + esc(x.one) + '</p><div class="meta">' +
          Object.keys(x.cc || {}).slice(0, 5).map(function (c) { return '<span class="pill">' + (FLAG[c] || "") + " " + (CCN[c] || c) + "</span>"; }).join("") + (x.press ? '<span class="pill press">보도자료</span>' : "") + (x.chg ? '<span class="pill new">달라진 점</span>' : "") + "</div></article>";
      }).join("");
      var fix = [];
      if (b.rank) fix.push(["순위 변화", b.rank, "#/" + INDK[ind] + "/rank"]);
      if (b.abroad) fix.push([ind === "beauty" ? "해외에서 뜨는 K뷰티" : "해외에서 뜨는 한국 게임", b.abroad]);
      if (b.word && TERMS[b.word.id]) fix.push(["오늘의 성분·용어 — " + TERMS[b.word.id].w, TERMS[b.word.id].s + " " + (b.word.why || ""), "", b.word.id]);
      if (b.voice) fix.push(["소비자 반응", b.voice, "#/" + INDK[ind] + "/buzz"]);
      if (b.econ) fix.push(["경제 날씨", b.econ]);
      if (fix.length) h += '<h2 class="h2">고정 칸</h2><div class="grid g2w">' + fix.map(function (f) { return '<article class="card' + (f[2] || f[3] ? " tap" : "") + '"' + (f[2] ? ' data-go="' + f[2] + '"' : f[3] ? ' data-term="' + f[3] + '"' : "") + '><div class="fix"><b>' + esc(f[0]) + "</b><p>" + esc(f[1]) + "</p></div></article>"; }).join("") + "</div>";
      if ((b.hidden || []).length) h += '<h2 class="h2">한국 언론엔 안 나온 일</h2>' + miniList(b.hidden);
      if ((b.ad || []).length) h += '<h2 class="h2">화제의 광고·콜라보</h2>' + miniList(b.ad);
      h += '<p class="note">' + esc(b.note || "") + "</p>";
      setMain(h);
      if (arg != null && b.items[arg]) issueSheet(ind, b, +arg);
    });
  }
  function miniList(a) {
    return a.map(function (x) { return '<article class="card"><div class="h3">' + esc(x.t) + '</div><p style="margin:0;line-height:1.6">' + esc(x.one) + "</p>" + srcList(x.src) + "</article>"; }).join("");
  }
  function srcList(src) {
    if (!src || !src.length) return "";
    return '<div class="src" style="margin-top:10px">' + src.map(function (s) { return (FLAG[s.cc] || "") + " <a href=\"" + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.src || "출처") + "</a>" + (s.kind === "press" ? " (보도자료)" : "") + " — " + esc((s.t || "").slice(0, 70)); }).join("<br>") + "</div>";
  }
  function issueSheet(ind, b, i) {
    var x = b.items[i]; var seen = S("seen:" + ind, {}); if (!seen[b.id + ":" + i]) { seen[b.id + ":" + i] = 1; W("seen:" + ind, seen); tick("card"); }
    load("companies.json").then(function (cs) {
      var cmap = {}; ((cs && cs.list) || []).forEach(function (c) { cmap[c.id] = c; });
      var h = '<div class="kick">' + INDN[ind] + " 이슈 " + (i + 1) + (x.tag ? " · " + esc(x.tag) : "") + '</div><h2 class="h1" style="font-size:26px">' + esc(x.t) + "</h2>";
      h += '<article class="card sec">';
      if (x.chg) h += '<div class="fix" style="margin-bottom:12px"><b>어제와 달라진 점</b><p>' + esc(x.chg) + "</p></div>";
      h += "<h4 style=\"margin-top:0\">요약</h4><p>" + linkTerms(esc(x.sum || x.one)) + "</p>";
      if (x.why) h += "<h4>왜 중요한가</h4><p>" + linkTerms(esc(x.why)) + "</p>";
      if ((x.bg || []).length) h += "<h4>배경 (배움 글)</h4><div class=\"chips\">" + x.bg.map(function (g) { return g.k === "term" ? '<button class="chip" data-term="' + esc(g.id) + '">📖 ' + esc(g.t) + "</button>" : '<button class="chip" data-go="#/l/u/' + esc(g.id) + '">🕰 ' + esc(g.t) + "</button>"; }).join("") + "</div>";
      if (Object.keys(x.cc || {}).length) h += '<h4>나라마다 이렇게 전함</h4><dl class="cc">' + Object.keys(x.cc).map(function (c) { return "<dt>" + (FLAG[c] || "") + " " + (CCN[c] || c) + "</dt><dd>" + esc(x.cc[c]) + "</dd>"; }).join("") + "</dl>";
      if (x.money) h += "<h4>💰 돈 이야기</h4><p>" + linkTerms(esc(x.money)) + "</p>";
      if (x.op) h += "<h4>이렇게 보는 사람도 있음</h4><p>" + esc(x.op) + "</p>";
      if ((x.cos || []).length) h += "<h4>관련 회사</h4><div class=\"chips\">" + x.cos.map(function (c) { return cmap[c] ? '<button class="chip" data-co="' + c + '">' + esc(cmap[c].n) + "</button>" : ""; }).join("") + "</div>";
      h += "<h4>출처</h4>" + srcList(x.src) + "</article>";
      sheet(h, { tools: '<button class="ib" data-act="share-issue" aria-label="공유">' + ICON.share + "</button>" + starBtn({ id: "i:" + b.id + ":" + i, type: "issue", t: x.t, ind: ind, d: b.id, one: x.one }) });
      var sh = sheetStack[sheetStack.length - 1]; sh._share = [x.t, x.one];
    });
  }

  /* 순위 */
  var BOARDS = {
    game: [["g.ios.kr.gross", "🇰🇷 앱스토어 매출"], ["g.gp.kr.gross", "🇰🇷 구글 매출"], ["g.ios.kr.free", "🇰🇷 인기"], ["g.ios.kr.new", "🇰🇷 신작"], ["g.gp.kr.free", "🇰🇷 구글 인기"],
      ["g.ios.us.gross", "🇺🇸 매출"], ["g.gp.us.gross", "🇺🇸 구글 매출"], ["g.ios.us.free", "🇺🇸 인기"], ["g.ios.jp.gross", "🇯🇵 매출"], ["g.gp.jp.gross", "🇯🇵 구글 매출"], ["g.ios.jp.free", "🇯🇵 인기"],
      ["g.ios.cn.gross", "🇨🇳 앱스토어 매출"], ["g.ios.cn.free", "🇨🇳 인기"], ["g.ios.cn.new", "🇨🇳 신작"],
      ["g.ios.de.gross", "🇩🇪 매출"], ["g.ios.sa.gross", "🇸🇦 매출"], ["g.yt.kr", "▶️ 한국 게임 영상"], ["g.yt.us", "▶️ 미국 게임 영상"], ["twitch", "📺 트위치"]],
    beauty: [["b.amz.us", "🇺🇸 아마존"], ["b.yt.kr", "▶️ 한국 뷰티 영상"], ["b.yt.us", "▶️ 미국 뷰티 영상"], ["kb", "🌏 해외의 K뷰티"]]
  };
  var NOTE = { beauty: "올리브영·세포라·화해·큐텐·티몰·더우인은 순위를 공개 자료로 내주지 않거나 로봇 접속을 막아서 못 가져옴. 이 곳들 소식은 브리핑 기사로 다루고, 한국 유행은 업계 지도의 네이버 검색량으로 봄.", game: "중국은 구글플레이가 없어서 애플 중국 앱스토어 순위로 봄 (TapTap은 공개 자료가 없어 뺐음)." };
  function rankImg(x) {
    var adult = /성인|19금|18\+|hentai|adult/i.test((x.n || "") + (x.g || ""));
    return x.img ? '<img loading="lazy" src="' + esc(x.img) + '" alt=""' + (adult ? ' class="blur" title="눌러서 보기"' : "") + ' onerror="this.replaceWith(Object.assign(document.createElement(\'div\'),{className:\'ph\'}))">' : '<div class="ph"></div>';
  }
  function dl(d) {
    if (d === "new") return '<span class="dl n">NEW</span>';
    if (typeof d !== "number" || !d) return '<span class="dl z">–</span>';
    return d > 0 ? '<span class="dl u">▲' + d + "</span>" : '<span class="dl d">▼' + -d + "</span>";
  }
  function vRank(ind, key) {
    Promise.all([load("rank/latest.json"), load("social/twitch.json"), load("companies.json")]).then(function (r) {
      var B = (r[0] && r[0].boards) || {}, tw = r[1];
      var bs = BOARDS[ind].filter(function (b) { return B[b[0]] || (b[0] === "twitch" && tw) || b[0] === "kb"; });
      if (!bs.length) return setMain('<div class="empty">순위 로봇이 아직 안 돌았음. 매일 새벽 5시쯤 모음.</div>');
      key = key && bs.some(function (b) { return b[0] === key; }) ? key : S("board:" + ind, bs[0][0]);
      if (!bs.some(function (b) { return b[0] === key; })) key = bs[0][0];
      W("board:" + ind, key);
      var h = '<div class="board-pick" style="margin-top:4px">' + bs.map(function (b) { return '<button class="chip" data-go="#/' + INDK[ind] + "/rank/" + b[0] + '" aria-pressed="' + (b[0] === key) + '">' + b[1] + "</button>"; }).join("") + "</div>";
      var rows, title, stale;
      if (key === "twitch") { rows = tw.rows; title = "트위치 지금 많이 보는 게임 (PC 포함)"; }
      else if (key === "kb") { rows = kbeautyAbroad(B, r[2]); title = "해외 순위에 오른 한국 브랜드"; }
      else { rows = B[key].rows; title = B[key].t; stale = B[key].stale; }
      h += '<div class="h2" style="margin-top:6px">' + esc(title) + ' <small>' + (key === "twitch" ? ago(tw.at) : (B[key] ? kday(B[key].day) : "")) + (stale ? " · 오늘은 못 가져와 전에 것" : "") + "</small></div>";
      h += '<div class="list">' + (rows || []).slice(0, 100).map(function (x) {
        var link = key.indexOf(".yt.") > 0 ? "https://www.youtube.com/watch?v=" + x.id : key === "twitch" ? "https://www.twitch.tv/directory/category/" + encodeURIComponent((x.n || "").toLowerCase().replace(/\s+/g, "-")) : x.id && /^\d+$/.test(x.id) && key.indexOf(".ios.") > 0 ? "https://apps.apple.com/app/id" + x.id : x.id && key.indexOf(".gp.") > 0 ? "https://play.google.com/store/apps/details?id=" + x.id : "";
        var sub = [x.by, x.g, x.p, x.v ? num(x.v) + (key === "twitch" ? "명 시청" : "회") : "", x.src].filter(Boolean).join(" · ");
        return '<a class="rk"' + (link ? ' href="' + esc(link) + '" target="_blank" rel="noopener"' : "") + '><div class="no' + (x.r <= 3 ? " t1" : "") + '">' + x.r + "</div>" + rankImg(x) + '<div class="tx"><b>' + esc(x.ko || x.n) + "</b><span>" + esc(x.ko ? x.n : sub) + (x.ko && sub ? " · " + esc(sub) : "") + "</span></div>" + dl(x.d) + "</a>";
      }).join("") + "</div>";
      h += '<p class="note">' + NOTE[ind] + " NEW·▲▼는 어제와 견준 것.</p>";
      setMain(h);
    });
  }
  function kbeautyAbroad(B, cs) {
    var kr = ((cs && cs.list) || []).filter(function (c) { return c.ind === "beauty" && c.cc === "kr"; });
    var keys = []; kr.forEach(function (c) { [c.n, c.en].concat(c.brands || []).forEach(function (k) { if (k && k.length >= 3) keys.push([k.toLowerCase(), c.n]); }); });
    var out = [];
    ["b.amz.us"].forEach(function (k) {
      var b = B[k]; if (!b) return;
      b.rows.forEach(function (x) { var t = (x.n + " " + (x.by || "")).toLowerCase(); var m = keys.find(function (kk) { return t.indexOf(kk[0]) >= 0; }); if (m) out.push(Object.assign({}, x, { src: b.t + " · " + m[1] })); });
    });
    return out.map(function (x, i) { return Object.assign(x, { r: i + 1 }); });
  }

  /* 달력 */
  function vCal(ind) {
    var files = ["cal/news_" + ind + ".json", "cal/filings.json", "companies.json"]; if (ind === "game") files.push("cal/releases.json");
    Promise.all(files.map(load)).then(function (r) {
      var cs = {}; ((r[2] && r[2].list) || []).forEach(function (c) { cs[c.id] = c; });
      var ev = [];
      ((r[0] && r[0].items) || []).forEach(function (e) { ev.push({ d: e.d, t: e.t, k: "소식", src: e.src }); });
      ((r[3] && r[3].items) || []).forEach(function (e) { ev.push({ d: e.d, t: e.n, k: "출시", sub: [e.p.join("·"), (e.by || []).join(", "), (e.g || []).join(", ")].filter(Boolean).join(" · "), img: e.img, hype: e.hype }); });
      var today = day(); ev = ev.filter(function (e) { return e.d >= day(-1); }).sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : (b.hype || 0) - (a.hype || 0); });
      var h = '<h2 class="h2">다가오는 일정</h2>';
      if (!ev.length) h += '<div class="empty">아직 모은 일정이 없음. 브리핑 로봇이 기사에서 날짜를 찾아 채우고' + (ind === "game" ? ", 출시 예정 게임은 IGDB에서 가져옴." : ".") + "</div>";
      var by = {}; ev.slice(0, 160).forEach(function (e) { (by[e.d] = by[e.d] || []).push(e); });
      Object.keys(by).forEach(function (d) {
        h += '<div class="kick">' + kday(d) + (d === today ? " · 오늘" : "") + '</div><div class="list" style="margin-top:6px">' + by[d].slice(0, 14).map(function (e) {
          return '<div class="rk">' + (e.img ? rankImg(e) : '<div class="ph" style="display:grid;place-items:center;font-size:20px">' + (e.k === "출시" ? "🎮" : "📌") + "</div>") + '<div class="tx"><b>' + esc(e.t) + "</b><span>" + esc(e.k + (e.sub ? " · " + e.sub : "") + (e.src && e.src[0] ? " · " + e.src[0].src : "")) + "</span></div></div>";
        }).join("") + "</div>";
      });
      var fl = ((r[1] && r[1].items) || []).filter(function (f) { return cs[f.co] && cs[f.co].ind === ind; });
      h += '<h2 class="h2">최근 실적·공시 <small>한국 DART · 미국 SEC</small></h2>';
      h += fl.length ? '<div class="list">' + fl.slice(0, 40).map(function (f) { return '<a class="row" href="' + esc(f.url) + '" target="_blank" rel="noopener"><div class="tx"><b>' + esc(cs[f.co].n) + " — " + esc(f.t) + "</b><span>" + esc(f.d + " · " + f.src) + "</span></div>" + ICON.chev + "</a>"; }).join("") + "</div>" : '<div class="empty">공시 로봇이 아직 안 돌았음.</div>';
      h += '<p class="note">실적 발표 예정일은 회사가 미리 알릴 때 기사에서 찾아 넣음. 공시는 원문(DART·SEC)으로 바로 감.</p>';
      setMain(h);
    });
  }

  /* 회사 */
  function vCos(ind) {
    Promise.all([load("companies.json"), load("stock/latest.json")]).then(function (r) {
      var cs = ((r[0] && r[0].list) || []).filter(function (c) { return c.ind === ind; }), q = (r[1] && r[1].q) || {};
      var f = S("cof:" + ind, "all");
      var regs = [["all", "전체"], ["follow", "★ 관심"], ["kr", "한국"], ["cn", "중국"], ["jp", "일본"], ["us", "미국"], ["eu", "유럽"], ["me", "중동"]];
      var list = cs.filter(function (c) { return f === "all" || (f === "follow" ? following(c.id) : c.cc === f); });
      var h = '<div class="board-pick" style="margin-top:4px">' + regs.map(function (x) { return '<button class="chip" data-act="cof" data-ind="' + ind + '" data-f="' + x[0] + '" aria-pressed="' + (x[0] === f) + '">' + x[1] + "</button>"; }).join("") + "</div>";
      h += '<div class="list">' + list.map(function (c) {
        var s = q[c.id];
        return '<button class="row" data-co="' + c.id + '"><div class="co-av" style="width:40px;height:40px;font-size:15px;border-radius:12px">' + esc(c.n.slice(0, 1)) + '</div><div class="tx"><b>' + (following(c.id) ? "★ " : "") + esc(c.n) + " " + (FLAG[c.cc] || "") + "</b><span>" + esc(c.sub) + "</span></div>" +
          (s ? '<div style="text-align:right;flex:none"><div class="sm" style="font-weight:700">' + num(s.c, s.c < 100 ? 2 : 0) + '</div><div class="xs ch ' + (s.ch >= 0 ? "u" : "d") + '">' + (s.ch == null ? "" : (s.ch >= 0 ? "+" : "") + s.ch + "%") + "</div></div>" : "") + "</button>";
      }).join("") + "</div>" + (list.length ? "" : '<div class="empty">관심 회사가 없음. 회사를 눌러 ★를 누르면 여기 모임.</div>');
      h += '<p class="note">' + esc((r[0] && r[0].note) || "") + " 주가는 하루 한 번 종가.</p>";
      setMain(h);
    });
  }
  function coSheet(id) {
    Promise.all([load("companies.json"), load("stock/latest.json"), load("cal/filings.json"), loadLearn("beauty"), loadLearn("game"), load("trend/naver.json"),
      load("brief/beauty/latest.json"), load("brief/game/latest.json")]).then(function (r) {
      var c = ((r[0] && r[0].list) || []).find(function (x) { return x.id === id; }); if (!c) return;
      var s = ((r[1] && r[1].q) || {})[id], fl = ((r[2] && r[2].items) || []).filter(function (f) { return f.co === id; });
      var L = c.ind === "beauty" ? r[3] : r[4], units = ((L && L.units) || []).filter(function (u) { return (u.cos || []).indexOf(id) >= 0; });
      var b = c.ind === "beauty" ? r[6] : r[7], iss = b ? (b.items || []).map(function (x, i) { return [x, i]; }).filter(function (p) { return (p[0].cos || []).indexOf(id) >= 0; }) : [];
      var h = '<div class="co-h" style="margin-top:6px"><div class="co-av t-' + c.ind + '">' + esc(c.n.slice(0, 1)) + '</div><div><div class="h1" style="margin:0;font-size:26px">' + esc(c.n) + '</div><div class="mut sm">' + esc([c.en, (FLAG[c.cc] || "") + " " + (CCN[c.cc] || ""), c.sub, c.y ? c.y + "년 설립" : ""].filter(Boolean).join(" · ")) + "</div></div></div>";
      h += '<article class="card" style="margin-top:12px"><p class="lede" style="margin:0">' + esc(c.one) + "</p>" + ((c.brands || []).length ? '<div class="chips" style="margin-top:10px">' + c.brands.filter(function (x) { return !/[가-힣]/.test(x) || true; }).slice(0, 10).map(function (x) { return '<span class="pill">' + esc(x) + "</span>"; }).join("") + "</div>" : "") +
        '<p class="note">소개는 일반 지식으로 쓴 것이라 틀릴 수 있음.</p></article>';
      if (s) h += '<article class="card"><div class="mut sm">' + esc(s.tk) + " · " + esc(s.cur) + '</div><div class="px">' + num(s.c, s.c < 100 ? 2 : 0) + ' <span class="sm ch ' + (s.ch >= 0 ? "u" : "d") + '">' + (s.ch == null ? "" : (s.ch >= 0 ? "+" : "") + s.ch + "% (하루)") + "</span></div>" + spark(s.w, 300, 60) + '<div class="xs mut">1년 ' + (s.y1 >= 0 ? "+" : "") + s.y1 + "% · " + esc(s.at) + "</div></article>";
      if (iss.length) h += '<h2 class="h2">오늘 브리핑에서</h2>' + iss.map(function (p) { return '<article class="card tap" data-go="#/' + INDK[c.ind] + "/brief/" + p[1] + '"><div class="h3">' + esc(p[0].t) + '</div><p class="mut" style="margin:0">' + esc(p[0].one) + "</p></article>"; }).join("");
      var tr = r[5] && r[5][c.ind]; var kw = (c.brands || []).concat([c.n]).find(function (k) { return tr && tr[k]; });
      if (kw) h += '<h2 class="h2">네이버 검색량 <small>' + esc(kw) + "</small></h2><article class=\"card\">" + lineChart([{ name: kw, color: "var(--tint)", pts: tr[kw] }], { h: 180, lab: function (x) { return x.slice(2, 4) + "." + x.slice(5); } }) + "</article>";
      if (fl.length) h += '<h2 class="h2">최근 공시</h2><div class="list">' + fl.slice(0, 10).map(function (f) { return '<a class="row" href="' + esc(f.url) + '" target="_blank" rel="noopener"><div class="tx"><b>' + esc(f.t) + "</b><span>" + esc(f.d + " · " + f.src) + "</span></div>" + ICON.chev + "</a>"; }).join("") + "</div>";
      if (units.length) h += '<h2 class="h2">이 회사가 나오는 역사</h2><div class="list">' + units.map(function (u) { return '<button class="row" data-go="#/l/u/' + u.id + '"><div class="tx"><b>' + esc(u.t) + "</b><span>" + u.y[0] + "~" + u.y[1] + " · " + esc(u.sub || "") + "</span></div>" + ICON.chev + "</button>"; }).join("") + "</div>";
      h += '<div style="margin-top:14px"><button class="btn full ' + (following(id) ? "" : "pri") + '" data-act="follow" data-id="' + id + '">' + (following(id) ? "관심 회사에서 빼기" : "★ 관심 회사로 따라가기") + "</button></div>";
      sheet(h);
      document.body.classList.add("t-" + c.ind);
    });
  }

  /* 업계 지도 */
  function vMap(ind) {
    var files = ["trend/naver.json", "stock/latest.json", "companies.json", "rank/latest.json"]; if (ind === "beauty") files.push("econ/kbeauty_export.json");
    Promise.all(files.map(load)).then(function (r) {
      var tr = (r[0] && r[0][ind]) || {}, q = (r[1] && r[1].q) || {}, cs = ((r[2] && r[2].list) || []).filter(function (c) { return c.ind === ind; });
      var h = "";
      if (ind === "beauty") {
        var ex = r[4];
        h += '<h2 class="h2">K뷰티 수출 <small>관세청 · 달러</small></h2>';
        if (ex && ex.m && ex.m["3304"]) {
          var yr = {}; Object.keys(ex.m["3304"]).forEach(function (ym) { var y = ym.slice(0, 4); yr[y] = (yr[y] || 0) + ex.m["3304"][ym]; });
          var ys = Object.keys(yr).sort(), cur = ys[ys.length - 1];
          h += '<article class="card">' + lineChart([{ name: "화장품(3304)", color: "var(--beauty)", pts: ys.filter(function (y) { return y !== cur; }).map(function (y) { return [y, yr[y] / 1e8]; }) }], { h: 200, zero: true, fmt: function (v) { return num(v) + "억$"; } }) +
            '<p class="note">해마다 화장품 수출액(억 달러). 올해(' + cur + ")는 지금까지 " + num(yr[cur] / 1e8, 1) + "억 달러.</p>" +
            '<div class="h3" style="margin-top:12px">최근 24달</div>' + lineChart(["3304", "3303", "3305"].filter(function (k) { return ex.m[k]; }).map(function (k, i) { return { name: { 3304: "화장품", 3303: "향수", 3305: "헤어" }[k], color: PAL[i], pts: Object.keys(ex.m[k]).sort().slice(-24).map(function (ym) { return [ym, ex.m[k][ym] / 1e6]; }) }; }), { h: 200, zero: true, fmt: function (v) { return num(v) + "백만$"; }, lab: function (x) { return x.slice(2).replace("-", "."); } }) + "</article>";
        } else h += '<div class="empty">수출 자료를 아직 못 가져왔음 (공공데이터포털 열쇠로 매일 새벽에 가져옴).</div>';
      } else {
        h += '<h2 class="h2">매출 상위 100, 누가 만들었나 <small>만든 회사의 나라</small></h2>' + shareByCountry(r[3], r[2]);
      }
      var words = Object.keys(tr);
      if (words.length) {
        var sel = S("tw:" + ind, words.slice(1, 4));
        h += '<h2 class="h2">검색량 흐름 <small>네이버 · 달별</small></h2><article class="card"><div class="chips">' + words.map(function (w) { return '<button class="chip" data-act="tw" data-ind="' + ind + '" data-w="' + esc(w) + '" aria-pressed="' + (sel.indexOf(w) >= 0) + '">' + esc(w) + "</button>"; }).join("") + "</div>" +
          '<div style="margin-top:10px">' + lineChart(sel.filter(function (w) { return tr[w]; }).map(function (w, i) { return { name: w, color: PAL[i % PAL.length], pts: tr[w] }; }), { h: 220, lab: function (x) { return x.slice(2, 4) + "." + x.slice(5); } }) + '</div><p class="note">' + esc((r[0] && r[0].note) || "") + "</p></article>";
      }
      var st = cs.filter(function (c) { return q[c.id] && q[c.id].y1 != null; }).sort(function (a, b) { return q[b.id].y1 - q[a.id].y1; });
      if (st.length) {
        var mx = Math.max.apply(null, st.map(function (c) { return Math.abs(q[c.id].y1); })) || 1;
        h += '<h2 class="h2">1년 주가 성적표</h2><div class="list">' + st.map(function (c) {
          var v = q[c.id].y1; return '<button class="row" data-co="' + c.id + '"><div class="tx"><b>' + esc(c.n) + " " + (FLAG[c.cc] || "") + '</b><div class="bar" style="margin-top:6px"><i style="width:' + Math.max(2, Math.abs(v) / mx * 100) + "%;background:" + (v >= 0 ? "var(--up)" : "var(--down)") + '"></i></div></div><div class="sm ch ' + (v >= 0 ? "u" : "d") + '" style="font-weight:700;flex:none">' + (v >= 0 ? "+" : "") + v + "%</div></button>";
        }).join("") + "</div>";
      }
      if (!h) h = '<div class="empty">아직 모은 숫자가 없음.</div>';
      setMain(h);
    });
  }
  function shareByCountry(rk, cs) {
    var B = (rk && rk.boards) || {}, list = ((cs && cs.list) || []).filter(function (c) { return c.ind === "game"; });
    var keys = []; list.forEach(function (c) { [c.en, c.n].concat(c.brands || []).forEach(function (k) { if (k && k.length >= 3) keys.push([k.toLowerCase(), c.cc]); }); });
    var rows = [["g.ios.kr.gross", "한국"], ["g.ios.us.gross", "미국"], ["g.ios.jp.gross", "일본"], ["g.ios.cn.gross", "중국"]].filter(function (x) { return B[x[0]]; });
    if (!rows.length) return '<div class="empty">순위가 모이면 그려짐.</div>';
    var CL = { kr: "#E5487B", cn: "#FF3B30", jp: "#FF9500", us: "#0A84FF", eu: "#34C759", me: "#AF52DE", "?": "#8E8E93" };
    var h = '<article class="card">';
    rows.forEach(function (x) {
      var cnt = {}, tot = 0;
      B[x[0]].rows.slice(0, 100).forEach(function (g) { var t = ((g.by || "") + " " + g.n).toLowerCase(); var m = keys.find(function (k) { return t.indexOf(k[0]) >= 0; }); var cc = m ? m[1] : "?"; cnt[cc] = (cnt[cc] || 0) + 1; tot++; });
      h += '<div style="margin:8px 0 12px"><div class="sm" style="font-weight:700;margin-bottom:5px">' + x[1] + ' 앱스토어</div><div style="display:flex;height:16px;border-radius:5px;overflow:hidden">' +
        Object.keys(cnt).sort(function (a, b) { return a === "?" ? 1 : b === "?" ? -1 : cnt[b] - cnt[a]; }).map(function (k) { return '<i title="' + (CCN[k] || "모름") + " " + cnt[k] + '" style="width:' + cnt[k] / tot * 100 + "%;background:" + CL[k] + '"></i>'; }).join("") +
        '</div><div class="xs mut" style="margin-top:4px">' + Object.keys(cnt).filter(function (k) { return k !== "?"; }).sort(function (a, b) { return cnt[b] - cnt[a]; }).map(function (k) { return (CCN[k] || k) + " " + cnt[k]; }).join(" · ") + (cnt["?"] ? " · 목록 밖 " + cnt["?"] : "") + "</div></div>";
    });
    return h + '<p class="note">회사 목록(약 50곳)에 있는 회사만 나라를 알아봄. 회색은 목록 밖 회사.</p></article>';
  }

  /* 반응 */
  function vBuzz(ind) {
    Promise.all([load("social/youtube.json"), load("social/reviews.json"), load("news/" + ind + "_recent.json")]).then(function (r) {
      var yt = (r[0] && r[0][ind]) || [], rv = (r[1] && r[1].games) || [], news = (r[2] && r[2].items) || [];
      var h = "";
      if (yt.length) h += '<h2 class="h2">최근 이틀 많이 본 영상</h2><div class="grid g2 g3w">' + yt.slice(0, 18).map(function (v) { return '<a class="card" style="padding:0;overflow:hidden" href="https://www.youtube.com/watch?v=' + esc(v.id) + '" target="_blank" rel="noopener"><img loading="lazy" src="' + esc(v.img) + '" alt="" style="width:100%;aspect-ratio:16/9;object-fit:cover;display:block"><div style="padding:10px"><div class="sm" style="font-weight:600;line-height:1.35;color:var(--ink)">' + esc(v.ko || v.n) + '</div><div class="xs mut" style="margin-top:4px">' + (FLAG[v.cc] || "") + " " + esc(v.by) + "</div></div></a>"; }).join("") + "</div>";
      if (ind === "game" && rv.length) h += '<h2 class="h2">앱스토어 최근 리뷰 <small>한국 매출 상위</small></h2>' + rv.slice(0, 10).map(function (g) {
        return '<article class="card"><div class="h3">' + esc(g.n) + ' <span class="pill">평균 ' + g.avg + "점</span></div>" + g.rv.slice(0, 4).map(function (x) { return '<p class="sm" style="margin:6px 0;line-height:1.5"><b>' + "★".repeat(x.s) + "</b> " + esc(x.b) + "</p>"; }).join("") + "</article>";
      }).join("");
      var comm = news.filter(function (x) { return x.kind === "comm"; });
      if (comm.length) h += '<h2 class="h2">레딧에서 많이 본 글</h2><div class="list">' + comm.slice(0, 20).map(function (x) { return '<a class="row" href="' + esc(x.url) + '" target="_blank" rel="noopener"><div class="tx"><b>' + esc(x.ko || x.t) + "</b><span>" + esc(x.src) + " · " + ago(x.at) + "</span></div></a>"; }).join("") + "</div>";
      var rest = news.filter(function (x) { return x.kind !== "comm"; });
      if (rest.length) {
        var cf = S("nf:" + ind, "all"), ccs = ["all", "kr", "us", "jp", "cn", "eu", "me"];
        var flt = rest.filter(function (x) { return cf === "all" || ({ eu: ["gb", "fr", "de"], me: ["ae", "sa"], cn: ["cn", "tw"] }[cf] || [cf]).indexOf(x.cc) >= 0; });
        h += '<h2 class="h2">모든 기사 <small>최근 3일 · ' + rest.length + "개</small></h2><div class=\"board-pick\">" + ccs.map(function (c) { return '<button class="chip" data-act="nf" data-ind="' + ind + '" data-c="' + c + '" aria-pressed="' + (c === cf) + '">' + (c === "all" ? "전체" : (FLAG[c] || "") + " " + CCN[c]) + "</button>"; }).join("") + "</div>" +
          '<div class="list">' + flt.slice(0, 120).map(function (x) { return '<a class="row" href="' + esc(x.url) + '" target="_blank" rel="noopener"><div class="tx"><b>' + esc(x.ko || x.t) + "</b><span>" + (FLAG[x.cc] || "") + " " + esc(x.src) + " · " + (KINDN[x.kind] || "") + " · " + ago(x.at) + "</span></div></a>"; }).join("") + "</div>";
      }
      setMain(h || '<div class="empty">반응 자료가 아직 없음.</div>');
    });
  }

  /* ───────── 배움 ───────── */
  var LEARN = {};
  function loadLearn(ind) { return load("learn/hist_" + ind + ".json").then(function (o) { LEARN[ind] = o; return o; }); }
  function allUnits() { return [].concat(((LEARN.beauty || {}).units) || [], ((LEARN.game || {}).units) || []); }
  function plan() {   // 오늘 할당량: 역사 글 1편 + 낱말 5개 + 복습
    var p = S("plan", {}); if (p.d === day()) return p;
    var rd = S("read:u", {}), lr = S("terms", {}), course = S("course", {});
    var pickU = function (ind) { var L = LEARN[ind]; if (!L) return null; var c = (L.courses || []).find(function (x) { return x.id === course[ind]; }) || (L.courses || [])[0]; if (!c) return null; return c.units.find(function (id) { return !rd[id]; }) || null; };
    var ind = (Object.keys(rd).length % 2) ? "game" : "beauty";
    var u = pickU(ind) || pickU(ind === "game" ? "beauty" : "game");
    var ts = Object.keys(TERMS).filter(function (k) { return /^t[bg]\d/.test(k) && !lr[k]; }).sort(function (a, b) { return (TERMS[a].lv || 1) - (TERMS[b].lv || 1) || (a < b ? -1 : 1); });
    var bt = ts.filter(function (k) { return k[1] === "b"; }), gt = ts.filter(function (k) { return k[1] === "g"; });
    var t = bt.slice(0, 3).concat(gt.slice(0, 2));
    p = { d: day(), u: u, t: t, done: {} }; if (u || t.length) W("plan", p);
    return p;
  }
  function dueReviews() { var m = S("srs", {}), t = day(); return Object.keys(m).filter(function (k) { return m[k].due <= t; }); }
  function quotaHTML(p) {
    var u = p.u && allUnits().find(function (x) { return x.id === p.u; }), tdone = (p.t || []).filter(function (k) { return S("terms", {})[k]; }).length, due = dueReviews().length;
    var udone = p.u && isRead("u", p.u);
    var pct = Math.round(((udone ? 1 : 0) + tdone / Math.max(1, (p.t || []).length) + (due ? 0 : 1)) / 3 * 100);
    return '<article class="card"><div style="display:flex;gap:14px;align-items:center"><div class="ring" style="--p:' + pct + '"><i>' + pct + '%</i></div><div style="flex:1"><div class="h3" style="margin:0">' + (pct >= 100 ? "오늘 몫 끝! 🎉" : "오늘 몫 " + pct + "%") + '</div><div class="sm mut">역사 1편 · 낱말 ' + (p.t || []).length + "개 · 복습 " + due + "문제</div></div></div>" +
      '<div class="quota" style="margin-top:12px"><button class="q' + (udone ? " done" : "") + '" data-go="' + (u ? "#/l/u/" + u.id : "#/l") + '"><b>' + (udone ? "✓" : "1") + "</b><span>" + (u ? esc(u.t.slice(0, 14)) : "역사 글") + '</span></button><button class="q' + (tdone >= (p.t || []).length && tdone ? " done" : "") + '" data-act="today-terms"><b>' + tdone + "/" + (p.t || []).length + '</b><span>오늘 낱말</span></button><button class="q' + (due ? "" : " done") + '" data-go="#/l/review"><b>' + (due || "✓") + "</b><span>복습 문제</span></button></div></article>";
  }

  function viewLearn(sub, a, b) {
    app.innerHTML = shell("learn", segBar([["today", "오늘"], ["course", "코스"], ["tl", "연표"], ["dict", "사전"], ["review", "복습"], ["level", "내 수준"]], sub || "today", "#/l"));
    setMain(skel(8));
    Promise.all([loadLearn("beauty"), loadLearn("game"), loadTerms(), load("learn/eras.json")]).then(function () {
      if (sub === "u") return vUnit(a);
      if (sub === "c") return vCourse(a);
      ({ today: vToday, course: vCourses, tl: vTimeline, dict: vDict, review: vReview, level: vLevel }[sub || "today"] || vToday)(a, b);
    });
  }
  function vToday() {
    var p = plan();
    var h = '<h1 class="h1">오늘 배울 것</h1><p class="mut" style="margin:0 0 12px">하루 10분이면 충분함. 하나 끝낼 때마다 점수가 쌓임.</p>' + quotaHTML(p);
    var ts = (p.t || []).map(function (k) { return TERMS[k]; }).filter(Boolean);
    if (ts.length) h += '<h2 class="h2">오늘의 낱말</h2><div class="list">' + ts.map(function (t) { return '<button class="row" data-term="' + t.id + '"><div class="tx"><b>' + (S("terms", {})[t.id] ? "✓ " : "") + esc(t.w) + ' <span class="pill">' + INDN[t.ind] + "</span></b><span>" + esc(t.s) + "</span></div>" + ICON.chev + "</button>"; }).join("") + "</div>";
    var rd = S("read:u", {}), n = Object.keys(rd).length, tot = allUnits().length;
    h += '<h2 class="h2">내 기록</h2><article class="card"><div class="grid g2"><div><div class="xs mut">읽은 역사 글</div><div class="px">' + n + " / " + tot + '</div><div class="bar" style="margin-top:6px"><i style="width:' + (tot ? n / tot * 100 : 0) + '%"></i></div></div><div><div class="xs mut">아는 낱말</div><div class="px">' + Object.keys(S("terms", {})).length + "개</div></div></div></article>";
    h += '<h2 class="h2">어디서 시작할까</h2><div class="grid g2">' + ["beauty", "game"].map(function (ind) { var L = LEARN[ind]; var c = L && L.courses && L.courses[0]; return '<article class="card tap" data-go="#/l/course"><div class="kick" style="margin:0">' + INDN[ind] + '</div><div class="h3" style="margin-top:4px">코스 ' + ((L && L.courses) || []).length + "개</div><div class=\"sm mut\">" + (c ? esc(c.t) + "부터" : "준비 중") + "</div></article>"; }).join("") + "</div>";
    setMain(h);
  }
  function vCourses() {
    var cur = S("course", {});
    var h = '<h1 class="h1">코스</h1><p class="mut" style="margin:0">통사로 시대 순서대로, 또는 나라·주제별로 골라 읽음. 고른 코스에서 매일 한 편씩 나옴.</p>';
    ["beauty", "game"].forEach(function (ind) {
      var L = LEARN[ind]; if (!L) return;
      h += '<h2 class="h2">' + INDN[ind] + "</h2>";
      h += '<div class="list">' + (L.courses || []).map(function (c) {
        var rd = c.units.filter(function (id) { return isRead("u", id); }).length;
        return '<button class="row" data-go="#/l/c/' + c.id + '"><div class="tx"><b>' + (cur[ind] === c.id ? "▶ " : "") + esc(c.t) + "</b><span>" + esc(c.one || "") + " · " + c.units.length + "편 · 읽음 " + rd + '</span><div class="bar" style="margin-top:6px"><i style="width:' + rd / Math.max(1, c.units.length) * 100 + '%"></i></div></div>' + ICON.chev + "</button>";
      }).join("") + "</div>";
    });
    if (!allUnits().length) h += '<div class="empty">역사 글을 쓰는 중. 곧 채워짐.</div>';
    setMain(h);
  }
  function findCourse(id) { var r; ["beauty", "game"].forEach(function (ind) { var c = ((LEARN[ind] || {}).courses || []).find(function (x) { return x.id === id; }); if (c) r = [ind, c]; }); return r; }
  function vCourse(id) {
    var fc = findCourse(id); if (!fc) return setMain('<div class="empty">없는 코스</div>');
    var ind = fc[0], c = fc[1], U = {}; (LEARN[ind].units || []).forEach(function (u) { U[u.id] = u; });
    document.body.classList.remove("t-learn"); document.body.classList.add("t-" + ind);
    var cur = S("course", {});
    var h = '<div class="kick">' + INDN[ind] + ' 코스</div><h1 class="h1">' + esc(c.t) + '</h1><p class="mut" style="margin:0 0 10px">' + esc(c.one || "") + "</p>";
    h += '<button class="btn ' + (cur[ind] === id ? "" : "pri") + '" data-act="set-course" data-ind="' + ind + '" data-id="' + id + '">' + (cur[ind] === id ? "✓ 지금 이 코스로 배우는 중" : "이 코스로 매일 배우기") + "</button>";
    h += '<div class="list" style="margin-top:14px">' + c.units.map(function (uid, i) {
      var u = U[uid]; if (!u) return "";
      return '<button class="row" data-go="#/l/u/' + uid + '"><div class="unit-c" style="flex:1"><div class="yr">' + u.y[0] + (u.y[1] !== u.y[0] ? "<br>~" + u.y[1] : "") + '</div><div class="tx"><b>' + (isRead("u", uid) ? "✓ " : "") + esc(u.t) + "</b><span>" + esc(u.sub || u.short.slice(0, 60)) + "</span></div></div>" + ICON.chev + "</button>";
    }).join("") + "</div>";
    setMain(h);
  }
  function unitInd(id) { return id && id[0] === "g" ? "game" : "beauty"; }
  function vUnit(id) {
    var ind = unitInd(id);
    document.body.classList.remove("t-learn"); document.body.classList.add("t-" + ind);
    Promise.all([load("learn/u/" + id + ".json"), load("learn/eras.json"), load("econ/latest.json"), load("companies.json")]).then(function (r) {
      var u = r[0]; if (!u) return setMain('<div class="empty">글을 못 찾음</div>');
      var depth = S("depth", "mid");
      var body = depth === "short" ? '<p class="short">' + linkTerms(esc(u.short), 8) + "</p>" :
        depth === "mid" ? (u.mid || []).map(function (p) { return "<p>" + linkTerms(esc(p), 4) + "</p>"; }).join("") :
          (u.long || []).map(function (s) { return "<h3>" + esc(s.h) + "</h3>" + (s.p || []).map(function (p) { return "<p>" + linkTerms(esc(p), 3) + "</p>"; }).join(""); }).join("");
      var cmap = {}; ((r[3] && r[3].list) || []).forEach(function (c) { cmap[c.id] = c; });
      var h = '<div class="two"><div><div class="kick">' + INDN[ind] + " · " + esc(u.theme || "") + " · " + u.y[0] + "~" + u.y[1] + " · " + (u.cc || []).map(function (c) { return (FLAG[c] || "") + " " + (CCN[c] || c); }).join(" ") + "</div>" +
        '<h1 class="h1">' + esc(u.t) + '</h1><p class="mut" style="margin:0;font-size:16px">' + esc(u.sub || "") + "</p>" +
        '<div class="depth seg" style="max-width:360px">' + [["short", "짧게"], ["mid", "보통"], ["long", "길게"]].map(function (d) { return '<button data-act="depth" data-d="' + d[0] + '" aria-pressed="' + (d[0] === depth) + '">' + d[1] + "</button>"; }).join("") + "</div>" +
        '<div class="chips" style="margin-bottom:10px">' + starBtn({ id: "u:" + id, type: "unit", t: u.t, ref: id }).replace('class="star', 'class="chip star') + '<button class="chip" data-act="speak" data-sel="#ubody">🔊 듣기</button><button class="chip" data-act="share-unit">공유</button></div>' +
        '<article class="card read" id="ubody">' + body + (u.now ? '<div class="fix" style="margin-top:18px"><b>지금과 닮은 장면</b><p>' + esc(u.now) + "</p></div>" : "") + "</article>";
      if ((u.cos || []).length) h += '<h2 class="h2">나오는 회사</h2><div class="chips">' + u.cos.map(function (c) { return cmap[c] ? '<button class="chip" data-co="' + c + '">' + esc(cmap[c].n) + "</button>" : ""; }).join("") + "</div>";
      if ((u.terms || []).length) h += '<h2 class="h2">나온 낱말</h2><div class="chips">' + u.terms.map(function (w) { return TERMS[w] ? '<button class="chip" data-term="' + TERMS[w].id + '">' + esc(w) + "</button>" : '<span class="pill">' + esc(w) + "</span>"; }).join("") + "</div>";
      if ((u.quiz || []).length) h += '<h2 class="h2">확인 문제</h2>' + quizCard(u.quiz.map(function (q, i) { return Object.assign({ id: "u:" + id + ":" + i }, q); }));
      if ((u.src || []).length) h += '<p class="note">참고: ' + u.src.map(esc).join(" · ") + "</p>";
      h += '<button class="btn pri full" style="margin-top:14px" data-act="unit-done" data-id="' + id + '">' + (isRead("u", id) ? "✓ 다 읽었음 — 다음 글" : "다 읽었음 ✓") + "</button>";
      h += "</div><aside>" + ctxPanel(u, r[1], r[2]) + "</aside></div>";
      setMain(h); window.scrollTo(0, 0);
      $("#main")._unit = u;
    });
  }
  function eraFor(eras, cc, y) {
    var R = (eras && eras.regions) || {}; var list = R[cc] || R[{ gb: "eu", fr: "eu", de: "eu", tw: "cn", ww: "us" }[cc]] || [];
    return list.find(function (e) { return y >= e.y[0] && y <= e.y[1]; });
  }
  function wbVal(econ, key, iso, y) { var s = econ && econ.s && econ.s["wb_" + key]; var a = s && s.by && s.by[iso]; if (!a) return null; var v = a.find(function (p) { return +p[0] === y; }); return v ? v[1] : null; }
  var ISO = { kr: "KOR", us: "USA", jp: "JPN", cn: "CHN", eu: "DEU", me: "SAU", gb: "GBR", fr: "FRA", de: "DEU" };
  function nowMoney(econ, cur, y, v) {   // 그때 돈 → 지금 돈 (소비자물가지수로)
    var key = cur === "KRW" ? "kr_cpi_y" : cur === "USD" ? "us_cpi_y" : null; var s = key && econ && econ.s && econ.s[key];
    if (!s || !s.v) return null; var a = s.v.find(function (p) { return +p[0].slice(0, 4) === y; }), b = s.v[s.v.length - 1]; if (!a || !b) return null;
    return v * b[1] / a[1];
  }
  function priceRow(econ, p) {
    var sym = { KRW: "원", USD: "달러", JPY: "엔", CNY: "위안" }[p.cur] || "";
    var now = nowMoney(econ, p.cur, p.y, p.v);
    return '<div class="pr"><span>' + esc(p.i) + ' <span class="mut xs">' + p.y + "</span></span><span><b>" + num(p.v, p.v < 10 ? 2 : 0) + sym + "</b>" + (now ? ' <span class="mut xs">≈ 지금 ' + (p.cur === "KRW" ? won(now) : num(now, 2) + "달러") + "</span>" : "") + "</span></div>";
  }
  function ctxPanel(u, eras, econ) {
    var cc = (u.cc || ["ww"])[0], y = u.y[0], c = u.ctx || {}, e = eraFor(eras, cc, y);
    var h = '<div class="h2" style="margin-top:22px">그 시기 ' + (CCN[cc] || "") + ' <small>' + y + "년 무렵</small></div><div class=\"ctxbox\">";
    if (e) h += '<h4>' + esc(e.t) + "</h4>";
    if (c.econ || (e && e.econ)) h += "<h4>경제</h4><p style=\"margin:0\">" + esc(c.econ || e.econ) + "</p>";
    var iso = ISO[cc], g = wbVal(econ, "gdp_g", iso, y), pc = wbVal(econ, "gdp_pc", iso, y), inf = wbVal(econ, "infl", iso, y);
    if (g != null || pc != null) h += '<div class="grid g2" style="margin:10px 0">' + (g != null ? '<div><div class="xs mut">' + y + " 성장률</div><b>" + g + "%</b></div>" : "") + (pc != null ? '<div><div class="xs mut">1인당 소득</div><b>' + num(pc) + "달러</b></div>" : "") + (inf != null ? '<div><div class="xs mut">물가 상승</div><b>' + inf + "%</b></div>" : "") + "</div>";
    if (c.mood || (e && e.mood)) h += "<h4 style=\"margin-top:12px\">사회 분위기</h4><p style=\"margin:0\">" + esc(c.mood || e.mood) + "</p>";
    var big = (c.big || []).concat(e && !(c.big || []).length ? e.big || [] : []);
    if (big.length) h += '<h4 style="margin-top:12px">큰 사건</h4><ul>' + big.slice(0, 6).map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>";
    var pr = (c.prices || []).slice();
    if ((eras && eras.prices) && cc === "kr") eras.prices.filter(function (s) { return s.cc === "kr"; }).slice(0, 3).forEach(function (s) { var p = (s.pts || []).filter(function (q) { return q[0] <= y; }).pop(); if (p && y - p[0] <= 6) pr.push({ i: s.i, y: p[0], v: p[1], cur: s.cur || "KRW" }); });
    if (pr.length) h += '<h4 style="margin-top:12px">그때 물건 값</h4>' + pr.map(function (p) { return priceRow(econ, p); }).join("");
    if (e && e.consumer) h += '<h4 style="margin-top:12px">사람들은 어디에 돈을 썼나</h4><p style="margin:0">' + esc(e.consumer) + "</p>";
    h += "</div>";
    var others = (u.cc || []).slice(1).map(function (c2) { var e2 = eraFor(eras, c2, y); return e2 ? '<div class="ctxbox" style="margin-top:8px"><h4>' + (FLAG[c2] || "") + " " + esc(e2.t) + '</h4><p style="margin:0">' + esc(e2.econ) + "</p></div>" : ""; }).join("");
    return h + others + '<p class="note">"지금 돈"은 소비자물가지수로 어림한 값.</p>';
  }
  function vTimeline(ind) {
    ind = ind || S("tl", "beauty"); W("tl", ind);
    var L = LEARN[ind]; var eras = CACHE["learn/eras.json"];
    var reg = S("tlreg", "kr");
    Promise.resolve(eras).then(function (eras) {
      var ev = []; ((L && L.units) || []).forEach(function (u) { (u.events || []).forEach(function (e) { ev.push(Object.assign({ u: u.id }, e)); }); });
      ev.sort(function (a, b) { return a.y - b.y || (a.m || 0) - (b.m || 0); });
      var h = '<div class="seg" style="margin-top:8px;max-width:320px"><button data-go="#/l/tl/beauty" aria-pressed="' + (ind === "beauty") + '">뷰티</button><button data-go="#/l/tl/game" aria-pressed="' + (ind === "game") + '">폰게임</button></div>';
      h += '<div class="board-pick" style="margin-top:10px">' + ["kr", "us", "jp", "cn", "eu", "me"].map(function (c) { return '<button class="chip" data-act="tlreg" data-c="' + c + '" aria-pressed="' + (c === reg) + '">' + FLAG[c] + " " + CCN[c] + " 상황</button>"; }).join("") + "</div>";
      if (!ev.length) h += '<div class="empty">역사 글이 채워지면 연표가 생김.</div>';
      var dec = {}; ev.forEach(function (e) { var d = Math.floor(e.y / 10) * 10; (dec[d] = dec[d] || []).push(e); });
      Object.keys(dec).sort().forEach(function (d) {
        d = +d; var e = eraFor(eras, reg, d + 5) || eraFor(eras, reg, d);
        h += '<div class="two" style="margin-top:6px"><div><div class="tl"><div class="dec">' + d + "년대</div>" + dec[d].map(function (x) { return '<div class="ev tap" data-go="#/l/u/' + x.u + '"><b>' + x.y + (x.m ? "." + x.m : "") + "</b>" + esc(x.t) + ' <span class="mut xs">' + (FLAG[x.cc] || "") + "</span></div>"; }).join("") + "</div></div>" +
          "<aside>" + (e ? '<div class="ctxbox" style="margin-top:22px"><h4>' + FLAG[reg] + " " + esc(e.t) + "</h4><p style=\"margin:0 0 6px\">" + esc(e.econ) + '</p><p class="mut" style="margin:0">' + esc(e.mood) + "</p>" + ((e.words || []).length ? '<div class="chips" style="margin-top:8px">' + e.words.map(function (w) { return '<span class="pill">' + esc(w) + "</span>"; }).join("") + "</div>" : "") + "</div>" : "") + "</aside></div>";
      });
      setMain(h);
    });
  }
  function vDict(q) {
    var ind = S("dind", "beauty"), k = S("dk", "all"), lr = S("terms", {});
    var all = Object.keys(TERMS).filter(function (x) { return /^t[bg]\d/.test(x); }).map(function (x) { return TERMS[x]; }).filter(function (t) { return t.ind === ind; });
    var cats = []; all.forEach(function (t) { if (cats.indexOf(t.k) < 0) cats.push(t.k); });
    var list = all.filter(function (t) { return k === "all" || t.k === k; });
    var h = '<div class="seg" style="margin-top:8px;max-width:320px"><button data-act="dind" data-v="beauty" aria-pressed="' + (ind === "beauty") + '">뷰티 사전</button><button data-act="dind" data-v="game" aria-pressed="' + (ind === "game") + '">게임 사전</button></div>';
    h += '<input class="search" style="margin-top:10px" placeholder="낱말 찾기" data-act="dq" value="' + esc(q || "") + '">';
    h += '<div class="board-pick" style="margin-top:8px"><button class="chip" data-act="dk" data-v="all" aria-pressed="' + (k === "all") + '">전체 ' + all.length + "</button>" + cats.map(function (c) { return '<button class="chip" data-act="dk" data-v="' + esc(c) + '" aria-pressed="' + (k === c) + '">' + esc(c) + "</button>"; }).join("") + "</div>";
    h += '<div class="list" id="dlist">' + list.map(function (t) { return '<button class="row" data-term="' + t.id + '" data-w="' + esc((t.w + " " + (t.en || "") + " " + t.s).toLowerCase()) + '"><div class="tx"><b>' + (lr[t.id] ? "✓ " : "") + esc(t.w) + ' <span class="mut xs">' + esc(t.en || "") + "</span></b><span>" + esc(t.s) + "</span></div>" + ICON.chev + "</button>"; }).join("") + "</div>";
    if (!all.length) h += '<div class="empty">사전을 쓰는 중. 곧 채워짐.</div>';
    setMain(h);
  }
  function reviewQs(n) {
    var m = S("srs", {}), due = dueReviews(), out = [];
    due.forEach(function (id) {
      if (id.indexOf("t:") === 0) { var t = TERMS[id.slice(2)]; if (t && t.q) out.push(Object.assign({ id: id }, t.q)); }
      else if (id.indexOf("u:") === 0) { var p = id.split(":"); var u = CACHE["learn/u/" + p[1] + ".json"]; out.push({ lazy: p[1], i: +p[2], id: id }); }
    });
    return out.slice(0, n || 15);
  }
  function vReview() {
    var qs = reviewQs(15);
    var h = '<h1 class="h1">복습</h1><p class="mut" style="margin:0 0 10px">어제·지난번에 본 것이 문제로 나옴. 맞히면 더 뒤에, 틀리면 내일 다시.</p>';
    if (!qs.length) {
      // 복습할 게 없으면: 아직 안 본 낱말에서 맛보기 5문제
      var fresh = Object.keys(TERMS).filter(function (k) { return /^t[bg]\d/.test(k) && TERMS[k].q && !S("srs", {})["t:" + k]; }).slice(0, 5);
      h += '<div class="card"><b>오늘 복습할 것 없음 ✓</b><p class="mut sm" style="margin:4px 0 0">대신 새 낱말 문제 몇 개.</p></div>' + quizCard(fresh.map(function (k) { return Object.assign({ id: "t:" + k }, TERMS[k].q); }), { label: "새 문제" });
      return setMain(h);
    }
    var lazy = qs.filter(function (q) { return q.lazy; });
    Promise.all(lazy.map(function (q) { return load("learn/u/" + q.lazy + ".json"); })).then(function (us) {
      lazy.forEach(function (q, i) { var u = us[i]; var z = u && u.quiz && u.quiz[q.i]; if (z) Object.assign(q, z); });
      setMain(h + quizCard(qs.filter(function (q) { return q.a; }), { label: "복습" }));
    });
  }
  function vLevel() {
    var res = S("level", null);
    var pool = Object.keys(TERMS).filter(function (k) { return /^t[bg]\d/.test(k) && TERMS[k].q; });
    var h = '<h1 class="h1">내 수준 확인</h1><p class="mut" style="margin:0 0 12px">뷰티·게임 낱말 12문제로 지금 어디쯤인지 봄. 결과에 맞춰 오늘 낱말이 골라짐.</p>';
    if (res) h += '<article class="card"><div class="xs mut">' + esc(res.d) + ' 결과</div><div class="px">' + res.lv + '</div><p class="sm mut" style="margin:4px 0 0">뷰티 ' + res.b + "/6 · 게임 " + res.g + "/6</p></article>";
    if (pool.length < 12) return setMain(h + '<div class="empty">사전이 채워지면 할 수 있음.</div>');
    var pick = [];
    ["b", "g"].forEach(function (x) { [1, 2, 3].forEach(function (lv) { var c = pool.filter(function (k) { return k[1] === x && (TERMS[k].lv || 1) === lv; }); for (var i = 0; i < 2 && c.length; i++) pick.push(c.splice(Math.floor(Math.random() * c.length), 1)[0]); }); });
    h += '<div id="lvq">' + quizCard(pick.map(function (k) { return Object.assign({ id: "" }, TERMS[k].q, { lv: k }); }), { label: "수준" }) + '</div><button class="btn pri full" style="margin-top:12px" data-act="level-done" data-pick="' + pick.join(",") + '">결과 보기</button>';
    setMain(h);
  }

  /* ───────── 보관함 ───────── */
  function viewBox() {
    app.innerHTML = shell("box");
    Promise.all([load("companies.json"), load("news/beauty_recent.json"), load("news/game_recent.json"), loadTerms()]).then(function (r) {
      var st = S("star", []), fo = S("follow", []), kw = S("kw", []);
      var cmap = {}; ((r[0] && r[0].list) || []).forEach(function (c) { cmap[c.id] = c; });
      var h = '<h1 class="h1">보관함</h1>';
      h += '<h2 class="h2">내 키워드 <small>새 기사에서 찾아 줌</small></h2><article class="card"><div class="chips">' + kw.map(function (w) { return '<button class="chip" aria-pressed="true" data-act="kw-del" data-w="' + esc(w) + '">' + esc(w) + " ✕</button>"; }).join("") + '</div><div style="display:flex;gap:8px;margin-top:10px"><input class="search" id="kwin" placeholder="예: 레티놀, 블루아카이브, 사우디"><button class="btn pri" data-act="kw-add">더하기</button></div></article>';
      if (kw.length) {
        var news = [].concat(((r[1] && r[1].items) || []), ((r[2] && r[2].items) || []));
        var hit = news.filter(function (x) { var t = ((x.ko || "") + " " + x.t).toLowerCase(); return kw.some(function (w) { return t.indexOf(w.toLowerCase()) >= 0; }); }).slice(0, 30);
        h += hit.length ? '<div class="list" style="margin-top:8px">' + hit.map(function (x) { return '<a class="row" href="' + esc(x.url) + '" target="_blank" rel="noopener"><div class="tx"><b>' + esc(x.ko || x.t) + "</b><span>" + (FLAG[x.cc] || "") + " " + esc(x.src) + " · " + ago(x.at) + "</span></div></a>"; }).join("") + "</div>" : '<p class="note">최근 3일 기사엔 아직 없음.</p>';
      }
      h += '<h2 class="h2">관심 회사</h2>' + (fo.length ? '<div class="list">' + fo.map(function (id) { var c = cmap[id]; return c ? '<button class="row" data-co="' + id + '"><div class="tx"><b>★ ' + esc(c.n) + "</b><span>" + esc(c.sub) + "</span></div>" + ICON.chev + "</button>" : ""; }).join("") + "</div>" : '<div class="card mut sm">회사 화면에서 "관심 회사로 따라가기"를 누르면 여기 모이고, 브리핑에 나오면 알려 줌.</div>');
      h += '<h2 class="h2">별표 <small>' + st.length + "개</small></h2>" + (st.length ? '<div class="list">' + st.map(function (x) {
        var go = x.type === "unit" ? 'data-go="#/l/u/' + esc(x.ref) + '"' : x.type === "term" ? 'data-term="' + esc(x.ref) + '"' : x.type === "issue" ? 'data-go="#/' + INDK[x.ind] + '/brief"' : "";
        return '<button class="row" ' + go + '><div class="tx"><b>' + esc(x.t) + "</b><span>" + ({ unit: "역사 글", term: "낱말", issue: "이슈 · " + (x.d || "") }[x.type] || "") + (x.one ? " · " + esc(x.one.slice(0, 50)) : "") + "</span></div>" + ICON.chev + "</button>";
      }).join("") + "</div>" : '<div class="card mut sm">☆를 누르면 여기 모임.</div>');
      var streak = V.joyStreak ? V.joyStreak() : 0;
      h += '<h2 class="h2">기록</h2><article class="card"><div class="grid g2"><div><div class="xs mut">연속</div><div class="px">' + streak + '일</div></div><div><div class="xs mut">읽은 역사 글</div><div class="px">' + Object.keys(S("read:u", {})).length + '편</div></div><div><div class="xs mut">아는 낱말</div><div class="px">' + Object.keys(S("terms", {})).length + '개</div></div><div><div class="xs mut">푼 문제</div><div class="px">' + Object.values(S("qstat", {})).reduce(function (a, d) { return a + d.n; }, 0) + "개</div></div></div></article>";
      setMain(h);
    });
  }

  /* ───────── 찾기 ───────── */
  function searchSheet() {
    var b = sheet('<input class="search" id="sq" placeholder="회사·게임·성분·역사·낱말" autofocus><div id="sr" style="margin-top:12px"></div>');
    var inp = $("#sq", b);
    Promise.all([load("companies.json"), loadLearn("beauty"), loadLearn("game"), loadTerms(), load("brief/beauty/latest.json"), load("brief/game/latest.json"), load("rank/latest.json")]).then(function (r) {
      var idx = [];
      ((r[0] && r[0].list) || []).forEach(function (c) { idx.push({ k: "회사", t: c.n, s: c.sub + " · " + c.one, w: [c.n, c.en].concat(c.brands || []).join(" "), a: 'data-co="' + c.id + '"' }); });
      allUnits().forEach(function (u) { idx.push({ k: "역사", t: u.t, s: u.y[0] + "~" + u.y[1] + " · " + (u.sub || ""), w: u.t + " " + (u.sub || "") + " " + (u.short || ""), a: 'data-go="#/l/u/' + u.id + '"' }); });
      Object.keys(TERMS).filter(function (k) { return /^t[bg]\d/.test(k); }).forEach(function (k) { var t = TERMS[k]; idx.push({ k: "낱말", t: t.w, s: t.s, w: t.w + " " + (t.en || "") + " " + t.s, a: 'data-term="' + t.id + '"' }); });
      [r[4], r[5]].forEach(function (bb, j) { ((bb && bb.items) || []).forEach(function (x, i) { idx.push({ k: "오늘 이슈", t: x.t, s: x.one, w: x.t + " " + x.one + " " + (x.sum || ""), a: 'data-go="#/' + (j ? "g" : "b") + "/brief/" + i + '"' }); }); });
      var B = (r[6] && r[6].boards) || {}; var seen = {};
      Object.keys(B).forEach(function (k) { (B[k].rows || []).slice(0, 50).forEach(function (x) { var n = x.ko || x.n; if (seen[n]) return; seen[n] = 1; idx.push({ k: "순위", t: n, s: B[k].t + " " + x.r + "위", w: n + " " + x.n + " " + (x.by || ""), a: 'data-go="#/' + (k[0] === "g" ? "g" : "b") + "/rank/" + k + '"' }); }); });
      function run() {
        var q = inp.value.trim().toLowerCase(); var box = $("#sr", b);
        if (!q) { box.innerHTML = '<p class="note">회사 ' + ((r[0] && r[0].list) || []).length + " · 역사 " + allUnits().length + " · 낱말 " + Object.keys(TERMS).filter(function (k) { return /^t[bg]\d/.test(k); }).length + "개에서 찾음</p>"; return; }
        var res = idx.filter(function (x) { return x.w.toLowerCase().indexOf(q) >= 0; }).slice(0, 60);
        box.innerHTML = res.length ? '<div class="list">' + res.map(function (x) { return '<button class="row" ' + x.a + '><div class="tx"><b>' + esc(x.t) + ' <span class="pill">' + x.k + "</span></b><span>" + esc((x.s || "").slice(0, 80)) + "</span></div>" + ICON.chev + "</button>"; }).join("") + "</div>" : '<div class="empty">찾는 게 없음</div>';
      }
      inp.addEventListener("input", run); run();
    });
  }

  /* ───────── 알림 (수파베이스 무료 푸시, 다른 자판기와 같은 서버) ───────── */
  var PT = [["cs_brief", "아침 브리핑", "매일 아침 6시쯤 뷰티·게임 브리핑이 나오면"], ["cs_co", "관심 회사 소식", "★한 회사가 브리핑에 나오면"], ["cs_review", "복습 알림", "밤 9시, 복습 3분"]];
  function pushOk() { return "PushManager" in window && "serviceWorker" in navigator && "Notification" in window && !!(window.VFM_SYNC && window.VFM_SYNC.url); }
  function rpc(fn, body) {
    var k = window.VFM_SYNC.key;
    return fetch(window.VFM_SYNC.url + "/rest/v1/rpc/" + fn, { method: "POST", headers: { apikey: k, Authorization: "Bearer " + k, "Content-Type": "application/json" }, body: JSON.stringify(body || {}) })
      .then(function (r) { if (!r.ok) throw new Error("서버 " + r.status); return r.json(); });
  }
  function b64key(s) { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  function pushFollow() {
    if (!pushOk() || S("push", []).indexOf("cs_co") < 0) return;
    load("companies.json").then(function (cs) {
      var m = {}; ((cs && cs.list) || []).forEach(function (c) { m[c.id] = c.n; });
      var names = S("follow", []).map(function (id) { return m[id]; }).filter(Boolean);
      return navigator.serviceWorker.ready.then(function (reg) { return reg.pushManager.getSubscription(); }).then(function (sub) { if (sub) return rpc("vfm_push_follow", { p_endpoint: sub.endpoint, p_follow: names }); });
    }).catch(function () { });
  }
  function pushToggle(t) {
    if (Notification.permission === "denied") return toast("브라우저에서 알림이 막혀 있음 — 사이트 설정에서 허용해 주셈");
    var on = S("push", []).slice(), i = on.indexOf(t), first = !on.length;
    if (i >= 0) on.splice(i, 1); else on.push(t);
    Notification.requestPermission().then(function (p) {
      if (p !== "granted") throw new Error("알림을 허용해야 켤 수 있음");
      return navigator.serviceWorker.ready;
    }).then(function (reg) {
      return reg.pushManager.getSubscription().then(function (sub) {
        if (sub || !on.length) return sub;
        return rpc("planner_vapid_public").then(function (key) { return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64key(key) }); });
      });
    }).then(function (sub) {
      if (!sub) return;
      var j = sub.toJSON();
      return rpc("vfm_push_sub", { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_topics: on, p_ua: navigator.userAgent.slice(0, 200) }).then(function () {
        if (!on.length) return sub.unsubscribe();
        if (first) return rpc("vfm_push_test", { p_endpoint: j.endpoint });
      });
    }).then(function () { W("push", on); if (on.indexOf("cs_co") >= 0) pushFollow(); toast(i >= 0 ? "알림 끔" : "알림 켬 🔔"); closeSheet(); menuSheet(); })
      .catch(function (e) { toast(String(e.message || e)); });
  }

  /* ───────── 설정 시트 ───────── */
  function menuSheet() {
    load("status.json").then(function (st) {
      var bad = Object.keys(st || {}).filter(function (k) { var r = st[k]; return !r.ok || (Date.now() - Date.parse(r.ok)) > 3 * 864e5; });
      var sy = window.vfmSync, user = sy && sy.user && sy.user();
      var h = '<h2 class="h1" style="font-size:26px">설정</h2><div class="list">' +
        (sy && sy.ready ? '<button class="row" data-act="' + (user ? "logout" : "login") + '"><div class="tx"><b>' + (user ? "로그아웃 (" + esc(user.email || "") + ")" : "구글로 로그인 — 폰·PC 기록 이어 보기") + "</b><span>다른 자판기와 같은 계정</span></div></button>" : "") +
        '<button class="row" data-act="rate"><div class="tx"><b>소리 읽기 빠르기</b><span>지금 ' + S("rate", 1.05) + '배</span></div></button></div>';
      if (pushOk()) { var on = S("push", []); h += '<h2 class="h2">알림</h2><div class="list">' + PT.map(function (t) { return '<button class="row" data-act="push" data-t="' + t[0] + '"><div class="tx"><b>' + t[1] + "</b><span>" + t[2] + '</span></div><span class="pill' + (on.indexOf(t[0]) >= 0 ? " t" : "") + '">' + (on.indexOf(t[0]) >= 0 ? "켜짐" : "꺼짐") + "</span></button>"; }).join("") + '</div><p class="note">아이폰은 홈 화면에 추가한 앱에서만 알림이 옴.</p>'; }
      h += '<h2 class="h2">다른 자판기</h2><div class="list">' + SITES.map(function (s) { return '<a class="row" href="' + s[0] + '"><div class="tx"><b>' + s[1] + "</b><span>" + s[2] + "</span></div>" + ICON.chev + "</a>"; }).join("") + "</div>";
      h += '<h2 class="h2">자료 상태 <small>' + (st ? Object.keys(st).length + "곳 중 " + bad.length + "곳 문제" : "") + "</small></h2>";
      h += bad.length ? '<div class="list">' + bad.slice(0, 40).map(function (k) { var r = st[k]; return '<div class="row"><div class="tx"><b>' + esc(k) + "</b><span>" + esc(r.err || "") + (r.ok ? " · 마지막 성공 " + ago(r.ok) : " · 아직 성공 못 함") + "</span></div></div>"; }).join("") + "</div>" : '<p class="note">모든 출처가 잘 돌고 있음.</p>';
      h += '<p class="note">브리핑: 매일 아침 6시 전후 · 뉴스: 새벽 5시쯤·오후 4시 20분 · 순위·주가·경제: 새벽 5시쯤. 깨진 출처는 직전 자료를 그대로 보여 줌.</p>';
      sheet(h);
    });
  }

  /* ───────── 클릭 하나로 받기 ───────── */
  document.addEventListener("click", function (e) {
    var t = e.target;
    var img = t.closest("img.blur"); if (img) { img.classList.remove("blur"); e.preventDefault(); return; }
    var st = t.closest("[data-star]"); if (st) { e.preventDefault(); e.stopPropagation(); var on = toggleStar(JSON.parse(st.dataset.star)); st.classList.toggle("on", on); st.innerHTML = st.classList.contains("chip") ? (on ? "★" : "☆") : (on ? "★" : "☆"); return; }
    var tm = t.closest("[data-term]"); if (tm) { e.preventDefault(); termSheet(tm.dataset.term); return; }
    var co = t.closest("[data-co]"); if (co) { e.preventDefault(); coSheet(co.dataset.co); return; }
    var go = t.closest("[data-go]"); if (go) { e.preventDefault(); while (sheetStack.length) { sheetStack.pop().remove(); } location.hash = go.dataset.go; return; }
    var a = t.closest("[data-act]"); if (!a) return;
    var act = a.dataset.act;
    if (act === "search" && a.tagName !== "INPUT") return searchSheet();
    if (act === "search") { a.blur(); return searchSheet(); }
    if (act === "menu") return menuSheet();
    if (act === "issue") return load("brief/" + a.dataset.ind + "/latest.json").then(function (b) { issueSheet(a.dataset.ind, b, +a.dataset.i); a.classList.add("read"); });
    if (act === "speak") return speak($(a.dataset.sel));
    if (act === "share-issue") { var sh = sheetStack[sheetStack.length - 1]; return share(sh._share[0], sh._share[1]); }
    if (act === "share-brief") return load("brief/" + a.dataset.ind + "/latest.json").then(function (b) { share(b.label, b.lead + "\n" + (b.items || []).slice(0, 5).map(function (x, i) { return (i + 1) + ". " + x.t; }).join("\n")); });
    if (act === "share-unit") { var u = $("#main")._unit; return share(u.t, u.short); }
    if (act === "past") return pastSheet(a.dataset.ind);
    if (act === "cof") { W("cof:" + a.dataset.ind, a.dataset.f); return vCos(a.dataset.ind); }
    if (act === "follow") { var f = S("follow", []), i = f.indexOf(a.dataset.id); if (i >= 0) f.splice(i, 1); else { f.push(a.dataset.id); tick("card"); } W("follow", f); pushFollow(); a.textContent = i >= 0 ? "★ 관심 회사로 따라가기" : "관심 회사에서 빼기"; a.classList.toggle("pri", i >= 0); toast(i >= 0 ? "관심 회사에서 뺐음" : "관심 회사로 따라감 ★"); return; }
    if (act === "tw") { var s2 = S("tw:" + a.dataset.ind, []), w = a.dataset.w, j = s2.indexOf(w); if (j >= 0) s2.splice(j, 1); else s2.push(w); W("tw:" + a.dataset.ind, s2.slice(-6)); return vMap(a.dataset.ind); }
    if (act === "nf") { W("nf:" + a.dataset.ind, a.dataset.c); return vBuzz(a.dataset.ind); }
    if (act === "depth") { W("depth", a.dataset.d); return vUnit($("#main")._unit.id); }
    if (act === "unit-done") {
      var id = a.dataset.id; if (markRead("u", id)) { tick("done"); V.cheer && V.cheer(false, "한 편 끝! 🎉"); }
      var p = S("plan", {}); var ind = unitInd(id), L = LEARN[ind], cur = S("course", {}), c = (L.courses || []).find(function (x) { return x.id === cur[ind]; }) || L.courses[0];
      var nx = c && c.units.find(function (x) { return !isRead("u", x); });
      location.hash = nx ? "#/l/u/" + nx : "#/l"; return;
    }
    if (act === "set-course") { var cc = S("course", {}); cc[a.dataset.ind] = a.dataset.id; W("course", cc); var pl = S("plan", {}); pl.d = ""; W("plan", pl); toast("이 코스로 매일 한 편씩"); return vCourse(a.dataset.id); }
    if (act === "today-terms") { var ps = plan(); var first = (ps.t || []).find(function (k) { return !S("terms", {})[k]; }) || (ps.t || [])[0]; if (first) termSheet(first); return; }
    if (act === "tlreg") { W("tlreg", a.dataset.c); return vTimeline(); }
    if (act === "dind") { W("dind", a.dataset.v); W("dk", "all"); return vDict(); }
    if (act === "dk") { W("dk", a.dataset.v); return vDict(); }
    if (act === "level-done") {
      var pick = a.dataset.pick.split(","), cards = $$("#lvq [data-q]"), sc = { b: 0, g: 0 }, w2 = 0;
      cards.forEach(function (c2, i2) { var q = JSON.parse(c2.dataset.q); var chosen = $(".opt.no", c2) ? -1 : $(".opt.ok", c2) && c2.dataset.done ? q.c : -2; if (chosen === q.c) { sc[pick[i2][1]]++; w2 += TERMS[pick[i2]].lv || 1; } });
      var lv = w2 >= 16 ? "심화 — 업계 사람 수준" : w2 >= 9 ? "중급 — 기사 대부분 이해" : "기초부터 차근차근";
      W("level", { d: day(), lv: lv, b: sc.b, g: sc.g }); toast("결과: " + lv); return vLevel();
    }
    if (act === "kw-add") { var v = ($("#kwin").value || "").trim(); if (!v) return; var k2 = S("kw", []); if (k2.indexOf(v) < 0) k2.push(v); W("kw", k2.slice(-20)); return viewBox(); }
    if (act === "kw-del") { W("kw", S("kw", []).filter(function (x) { return x !== a.dataset.w; })); return viewBox(); }
    if (act === "monthly") return load("brief/monthly/" + a.dataset.id + ".json").then(function (m) { if (!m) return; sheet('<div class="kick">' + esc(m.label) + '</div><h2 class="h1" style="font-size:26px">' + esc(m.t) + '</h2><article class="card read">' + (m.body || []).map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("") + (m.beauty ? "<h3>뷰티</h3><p>" + esc(m.beauty) + "</p>" : "") + (m.game ? "<h3>게임</h3><p>" + esc(m.game) + "</p>" : "") + '<div class="chips">' + (m.words || []).map(function (w) { return '<span class="pill t">' + esc(w) + "</span>"; }).join("") + "</div></article>"); });
    if (act === "push") return pushToggle(a.dataset.t);
    if (act === "login") return window.vfmSync && window.vfmSync.login();
    if (act === "logout") return window.vfmSync && window.vfmSync.logout();
    if (act === "rate") { var rs = [0.9, 1, 1.05, 1.2, 1.4], cu = S("rate", 1.05); W("rate", rs[(rs.indexOf(cu) + 1) % rs.length]); toast("소리 빠르기 " + S("rate", 1) + "배"); return; }
  });
  document.addEventListener("input", function (e) {
    if (e.target.matches("[data-act=dq]")) { var q = e.target.value.trim().toLowerCase(); $$("#dlist .row").forEach(function (r) { r.hidden = q && r.dataset.w.indexOf(q) < 0; }); }
  });
  function pastSheet(ind) {
    var list = []; for (var i = 1; i <= 14; i++) list.push(day(-i));
    sheet('<h2 class="h1" style="font-size:26px">지난 ' + INDN[ind] + ' 브리핑</h2><div class="list">' + list.map(function (d) { return '<button class="row" data-act="past-one" data-ind="' + ind + '" data-d="' + d + '"><div class="tx"><b>' + kday(d) + "</b></div>" + ICON.chev + "</button>"; }).join("") + "</div>");
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest("[data-act=past-one]"); if (!a) return;
    load("brief/" + a.dataset.ind + "/" + a.dataset.d + ".json").then(function (b) {
      if (!b) return toast("그날 브리핑은 없음");
      sheet('<div class="kick">' + esc(b.label) + '</div><article class="card"><p class="lede" style="margin:0">' + esc(b.lead) + "</p></article>" + (b.items || []).map(function (x, i) { return '<article class="card"><div class="n kick" style="margin:0">' + (i + 1) + '</div><div class="h3">' + esc(x.t) + '</div><p style="margin:0;line-height:1.6">' + esc(x.sum || x.one) + "</p>" + (x.money ? '<p class="mut sm" style="margin:8px 0 0">💰 ' + esc(x.money) + "</p>" : "") + "</article>"; }).join(""));
    });
  });

  /* ───────── 길 찾기 ───────── */
  function route() {
    var h = (location.hash || "#/").replace(/^#\/?/, "").split("/");
    window.scrollTo(0, 0);
    if (!h[0]) return viewHome();
    if (h[0] === "b" || h[0] === "g") return viewInd(IND[h[0]], h[1], h[2]);
    if (h[0] === "l") return viewLearn(h[1], h[2], h[3]);
    if (h[0] === "x") return viewBox();
    viewHome();
  }
  window.addEventListener("hashchange", route);
  window.addEventListener("resize", function () { document.body.classList.toggle("unf", innerWidth >= 700); });
  route();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(function () { });
})();
