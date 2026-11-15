"""어디서 가져오나 — 뉴스 검색어(나라·언어별), 커뮤니티, 순위 나라.

구글 뉴스 RSS(열쇠 필요 없음)로 나라·언어마다 업계 소식을 모음. site: 를 쓰면 업계 전문지만 골라 옴.
나라 표시: kr 한국 · us 미국 · jp 일본 · cn 중국 · eu 유럽 · me 중동 · ww 세계
"""

# (나라, 구글뉴스 판, 검색어, 매체 성격)  성격: trade 업계지 · gen 일반 매체 · biz 경제지
GN = {
    "kr": ("ko", "KR", "KR:ko"), "us": ("en-US", "US", "US:en"), "gb": ("en-GB", "GB", "GB:en"),
    "jp": ("ja", "JP", "JP:ja"), "cn": ("zh-CN", "CN", "CN:zh-Hans"), "tw": ("zh-TW", "TW", "TW:zh-Hant"),
    "fr": ("fr", "FR", "FR:fr"), "de": ("de", "DE", "DE:de"), "ae": ("ar", "AE", "AE:ar"), "sa": ("ar", "SA", "SA:ar"),
    "in": ("en-IN", "IN", "IN:en"), "sg": ("en-SG", "SG", "SG:en"),
}
REGION = {"kr": "kr", "us": "us", "gb": "eu", "fr": "eu", "de": "eu", "jp": "jp", "cn": "cn", "tw": "cn", "ae": "me", "sa": "me", "in": "ww", "sg": "ww"}

BEAUTY = [
    # 한국
    ("kr", "화장품 업계", "gen"), ("kr", "K뷰티 수출", "biz"), ("kr", "올리브영", "gen"), ("kr", "아모레퍼시픽 OR LG생활건강", "biz"),
    ("kr", "화장품 ODM 코스맥스 OR 한국콜마", "biz"), ("kr", "인디 뷰티 브랜드", "gen"), ("kr", "미용 의료기기 OR 보톡스 OR 리프팅 시술", "gen"),
    ("kr", "뷰티 디바이스 홈뷰티", "gen"), ("kr", "향수 니치 OR 헤어 OR 네일", "gen"),
    ("kr", "site:cosmorning.com", "trade"), ("kr", "site:jangup.com", "trade"), ("kr", "site:beautynury.com", "trade"), ("kr", "site:cmn.co.kr", "trade"),
    # 미국·영국
    ("us", "beauty industry", "gen"), ("us", "K-beauty", "gen"), ("us", "site:wwd.com beauty", "trade"), ("us", "site:businessoffashion.com beauty", "trade"),
    ("us", "site:glossy.co beauty", "trade"), ("us", "site:cosmeticsbusiness.com", "trade"), ("us", "Sephora OR Ulta Beauty", "biz"),
    ("us", "Estee Lauder OR L'Oreal OR elf Beauty earnings", "biz"), ("us", "medical aesthetics Botox OR filler market", "biz"),
    ("gb", "site:cosmeticsdesign-europe.com", "trade"), ("sg", "site:cosmeticsdesign-asia.com", "trade"),
    # 일본
    ("jp", "化粧品 業界", "gen"), ("jp", "韓国コスメ", "gen"), ("jp", "資生堂 OR 花王 OR コーセー", "biz"), ("jp", "site:wwdjapan.com ビューティ", "trade"),
    # 중국
    ("cn", "化妆品 行业", "gen"), ("cn", "国货美妆", "gen"), ("cn", "抖音 美妆 OR 天猫 美妆", "gen"), ("tw", "韓系美妝", "gen"),
    # 유럽
    ("fr", "cosmétiques marché", "biz"), ("fr", "L'Oréal", "biz"), ("de", "Kosmetik Branche", "biz"),
    # 중동
    ("ae", "مستحضرات التجميل", "gen"), ("sa", "التجميل السعودية سوق", "biz"), ("ae", "Huda Beauty OR Chalhoub beauty", "biz"),
]

GAME = [
    # 한국
    ("kr", "모바일게임", "gen"), ("kr", "게임 매출 순위", "gen"), ("kr", "넥슨 OR 엔씨소프트 OR 넷마블 OR 크래프톤", "biz"),
    ("kr", "확률형 아이템", "gen"), ("kr", "게임 신작 출시 사전예약", "gen"), ("kr", "e스포츠 OR 치지직 OR SOOP 스트리밍", "gen"),
    ("kr", "site:inven.co.kr 모바일", "trade"), ("kr", "site:gamemeca.com", "trade"), ("kr", "site:thisisgame.com", "trade"), ("kr", "site:gameple.co.kr", "trade"),
    ("kr", "게임 실적 영업이익", "biz"), ("kr", "한국 게임 해외 매출", "biz"),
    # 미국·영국·유럽
    ("us", "mobile games", "gen"), ("us", "site:pocketgamer.biz", "trade"), ("us", "site:mobilegamer.biz", "trade"), ("us", "site:gamesindustry.biz", "trade"),
    ("us", "site:gamedeveloper.com mobile", "trade"), ("us", "app store games revenue", "biz"), ("us", "Roblox OR Scopely OR Playtika OR AppLovin", "biz"),
    ("us", "mobile esports OR Twitch streaming", "gen"), ("gb", "Supercell OR King Candy Crush OR Dream Games", "biz"), ("de", "Handyspiele Markt", "gen"),
    # 일본
    ("jp", "スマホゲーム", "gen"), ("jp", "ソシャゲ セールスランキング", "gen"), ("jp", "site:4gamer.net スマホ", "trade"), ("jp", "site:famitsu.com アプリ", "trade"),
    ("jp", "サイゲームス OR ミクシィ OR バンダイナムコ ゲーム", "biz"),
    # 중국
    ("cn", "手游", "gen"), ("cn", "版号", "gen"), ("cn", "腾讯 游戏 OR 网易 游戏 OR 米哈游", "biz"), ("cn", "site:gamelook.com.cn", "trade"), ("tw", "手遊 營收", "gen"),
    # 중동·기타
    ("sa", "ألعاب الفيديو السعودية", "gen"), ("us", "Savvy Games Group", "biz"), ("ae", "ألعاب الجوال", "gen"), ("in", "mobile gaming India", "gen"),
]

REDDIT = {
    "beauty": ["SkincareAddiction", "AsianBeauty", "MakeupAddiction", "fragrance"],
    "game": ["gachagaming", "MobileGaming", "AndroidGaming", "iosgaming"],
}

# 보도자료·광고성 출처 (표시하고 아래로)
PRESS = ["prnewswire", "businesswire", "globenewswire", "accesswire", "newswire", "뉴스와이어", "press release", "pr times", "prtimes", "美通社", "einpresswire", "openpr"]

# 게임 순위 나라 (애플)
APPLE_CC = ["kr", "us", "jp", "cn", "de", "sa"]
GPLAY_CC = ["kr", "us", "jp", "de", "sa"]
