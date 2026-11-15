# 뷰티·폰게임 자판기 — 배움 글 쓰기 규칙 (Claude 작가용)

읽는 사람: 뷰티·폰게임 업계를 처음 공부하는 한국 직장인. "그때 무슨 일이 있었고, 왜 그랬고, 누가 돈을 벌었나"를 알고 싶어 함.
도파민이 중요한 사람이라 **재밌고 생생하게**, 장면·인물·숫자·회사 이름이 많이 나와야 함. 밋밋한 교과서 말투 금지.

## 말투
- 모든 글은 **음슴체**(~했음, ~임, ~함, ~였음). 예: "1961년 서울 명동에 첫 매장을 열었음. 반응은 폭발적이었음."
- 쉬운 말. 업계 용어는 처음 나올 때 괄호로 풀기. 예: "ODM(브랜드 대신 개발·생산해 주는 회사)".
- 문장은 짧게. 한 문단 3~5문장.

## 정확성 (가장 중요)
- 숫자·날짜·이름·회사 관계는 **WebSearch로 확인**하고 쓰기. 확인 못 한 숫자는 쓰지 말거나 "~쯤으로 알려짐"으로.
- 지어내지 않기. 확실하지 않은 일화는 빼기.
- 각 글의 `src`에 참고한 자료 이름이나 주소를 2~5개 적기.

## 파일
- 지정된 경로에 **JSON 하나**로 저장 (UTF-8). 저장 뒤 `python3 -c "import json;json.load(open('경로'))"` 로 꼭 검사.
- 다른 파일은 건드리지 않기.
- 글이 많으니 **몇 편씩 나눠서 파일에 덧붙여** 저장해도 됨 (중간에 끊겨도 앞부분이 남게). 최종 모양은 아래 형식.

## 역사 글(unit) 형식 — 파일 = {"units":[ unit, … ]}
```json
{
 "id": "지정된 접두어+두 자리 번호 (예: bA01)",
 "ind": "beauty | game",
 "t": "제목 (20자 안팎, 궁금하게)",
 "sub": "부제 한 줄",
 "y": [시작연도, 끝연도],
 "cc": ["kr|us|jp|cn|eu|me|ww 중 해당 권역들"],
 "theme": "아래 주제 중 하나",
 "short": "짧게: 3~4문장, 약 250자",
 "mid": ["보통: 문단 4~6개, 합쳐 약 900~1200자"],
 "long": [{"h": "소제목", "p": ["문단", "문단"]}, …],
 "events": [{"y": 1961, "m": 3, "t": "연표에 들어갈 사건 한 줄", "cc": "kr"}],
 "ctx": {
   "econ": "그 시기 (그 나라) 경제 상황 2~3문장 — 성장률·환율·소득 등 확인된 숫자",
   "mood": "그 시기 사회 분위기 2~3문장 — 세대·유행·생활",
   "big": ["그 시기 큰 사건 한 줄 (연도 포함)", …3~5개],
   "prices": [{"i": "물건 이름", "y": 1970, "v": 100, "cur": "KRW|USD|JPY|CNY"}, …2~4개 — 그때 그 업계 물건 값과 짜장면·버스비 같은 생활 물가]
 },
 "cos": ["회사 번호 (아래 목록에 있는 것만)"],
 "terms": ["이 글에 나온 업계 낱말 3~8개"],
 "now": "지금과 닮은 장면 1~2문장 — 요즘 업계의 어떤 일과 닮았나",
 "quiz": [{"q": "문제", "a": ["보기1","보기2","보기3","보기4"], "c": 정답번호(0~3), "ex": "해설 1~2문장"}, … 4개],
 "src": ["참고 자료", …]
}
```
- `long`은 **소제목 4~7개, 합쳐 2,500~4,000자**. 잡지 기사처럼: 장면으로 시작 → 배경 → 사람과 회사 → 돈 이야기 → 그 뒤 → 오늘과의 연결.
- `events`는 4~10개 (연표에 쓰임). 월(m)은 알면 넣고 모르면 빼기.
- `prices`는 확인된 값만. 모르면 빈 목록.

뷰티 주제: 브랜드 흥망 · 유행 · 유통 · 미의 기준 · 성분·기술 · 시술·기기 · 정책·규제
게임 주제: 대박 게임 · 돈 버는 방식 · 회사 흥망 · 기기·플랫폼 · 규제 · e스포츠·방송

## 회사 번호 (cos 에 쓸 수 있는 것)
뷰티: amore 아모레퍼시픽, lghh LG생활건강, cosmax 코스맥스, kolmar 한국콜마, cosmecca 코스메카코리아, apr 에이피알, silicon2 실리콘투, clio 클리오, vt 브이티, dalba 달바, goodai 구다이글로벌, craver 크레이버(스킨1004), oliveyoung 올리브영, tonymoly 토니모리, able 에이블씨엔씨(미샤), hugel 휴젤, daewoong 대웅제약, medytox 메디톡스, classys 클래시스, pharmar 파마리서치, jeisys 제이시스메디칼, loreal 로레알, esteel 에스티로더, shiseido 시세이도, kao 가오, kose 고세, pola 폴라오르비스, pg P&G, unilever 유니레버, coty 코티, beiers 바이어스도르프, lvmh LVMH(세포라), ulta 울타뷰티, elf e.l.f., interparfums 인터파르퓸, puig 푸이그, kenvue 켄뷰, galderma 갈더마, abbvie 애브비(앨러간), inmode 인모드, olaplex 올라플렉스, dyson 다이슨, proya 프로야, bloomage 블루미지, jahwa 상하이자화, botanee 보태니, maogeping 마오거핑, huda 후다뷰티, chalhoub 샬후브, natura 나투라
게임: nexon 넥슨, ncsoft 엔씨소프트, netmarble 넷마블, krafton 크래프톤, kakaogames 카카오게임즈, pearlabyss 펄어비스, com2us 컴투스, wemade 위메이드, nexongames 넥슨게임즈, shiftup 시프트업, devsisters 데브시스터즈, smilegate 스마일게이트, webzen 웹젠, neowiz 네오위즈, gravity 그라비티, 111p 111퍼센트, soop SOOP, naver 네이버(치지직), tencent 텐센트, netease 넷이즈, mihoyo 미호요, lilith 릴리스, papergames 페이퍼게임즈, kuro 쿠로게임즈, hypergryph 하이퍼그리프, g37 37인터랙티브, century 센추리게임즈, firstfun 퍼스트펀, bandai 반다이남코, squareenix 스퀘어에닉스, nintendo 닌텐도, sony 소니, capcom 캡콤, sega 세가사미, konami 코나미, cygames 사이게임즈, mixi 믹시, gungho 겅호, apple 애플, google 구글, microsoft 마이크로소프트, ea EA, taketwo 테이크투, roblox 로블록스, unity 유니티, applovin 앱러빈, playtika 플레이티카, scopely 스코플리, supercell 슈퍼셀, dreamgames 드림게임즈, savvy 새비, twitch 트위치, huya 후야
