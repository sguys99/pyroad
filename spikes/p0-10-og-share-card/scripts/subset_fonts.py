"""공유 카드용 한글 폰트 서브셋을 만듭니다 (fontTools).

사용: python3 subset_fonts.py <원본 폰트 디렉토리> <출력 디렉토리> [폰트 이름 필터]

서브셋 3종:
  ks2350  : KS X 1001 완성형 한글 2,350자 + 호환 자모 + ASCII + 카드에 쓰는 기호
  full    : 현대 한글 11,172자 전부 + 위와 같은 기호 (원본에 있는 글리프만)
  ui      : 카드 템플릿 고정 문구에 쓰는 글자만 (제목 전용 폰트용)

각 서브셋은 TTF(무압축)와 WOFF(zlib)로 저장합니다. satori는 WOFF2를 읽지 못합니다.
힌팅은 제거합니다 (PNG 래스터라이즈에는 필요 없음).
"""
import os
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

SOURCES = {
    # 출력 이름: 원본 상대 경로
    "Jua": "jua/Jua-Regular.ttf",
    "Gaegu-Bold": "gaegu/Gaegu-Bold.ttf",
    "GowunDodum": "gowundodum/GowunDodum-Regular.ttf",
    "Pretendard-Bold": "pretendard/Pretendard-Bold.otf",
    "Pretendard-ExtraBold": "pretendard/Pretendard-ExtraBold.otf",
    "Cafe24Ssurround": "cafe24/Cafe24Ssurround.woff",
}

ASCII = list(range(0x20, 0x7F))
SYMBOLS = [
    0x00B7, 0x00D7, 0x2018, 0x2019, 0x201C, 0x201D, 0x2026, 0x2190, 0x2191, 0x2192, 0x2193,
    0x2605, 0x2606, 0x2665, 0x266A, 0x3001, 0x3002, 0x300C, 0x300D, 0x300E, 0x300F, 0x301C,
    0xFF5E, 0x2022, 0x00A0,
]
JAMO = list(range(0x3131, 0x318F))  # 호환 자모 (ㄱ~ㅎ, ㅏ~ㅣ) — KS X 1001에 포함
KS2350 = [c for c in range(0xAC00, 0xD7A4) if len(chr(c).encode("euc-kr", errors="ignore")) == 2]
FULL = list(range(0xAC00, 0xD7A4))

# 카드 템플릿에 들어가는 고정 문구 (ui 서브셋). 실제 구현에서는 템플릿 문구 파일에서 자동 추출합니다.
UI_TEXT = (
    "레벨업 레벨 업 달성 축하해요 새로운 칭호 스테이지 클리어 업적 획득 별 개 "
    "이번 주 성장 카드 부모님께 자랑하기 주간 퀘스트 연속 출석 일 배운 것 함께 모험해요 "
    "파이뱀 버그버그 별똥이 파이썬 마을 입구 변수의 숲 조건의 갈림길 반복의 동굴 리스트 호수 함수의 탑 "
    "프로젝트 왕국 에러 번 극복 첫 코드 힌트 마스터 일 연속 빌더 브론즈 실버 골드 "
    "나도 해보기 모험가 님 이 가 을 를 의 와 과 는 은 에서 까지 도 만 했어요 했다 "
    "월 화 수 목 금 토 일 요일 총 획득한 코인 꾸준히 멋져요 대단해요 최고 "
    "참 잘했어요 다음 모험도 기대돼 오늘도 한 걸음 코딩 실력 쑥쑥 반복문 리스트 조건문 변수 "
    "0123456789 Lv LV XP pyRoad pyroad.kr . , ! ? ~ + - : / ( ) % ' \" … ★ ☆ · × "
)


def build(src: str, unicodes: list[int], out_base: str) -> dict:
    font = TTFont(src)
    cmap = font.getBestCmap()
    present = [u for u in unicodes if u in cmap]
    opts = subset.Options()
    opts.hinting = False
    opts.desubroutinize = False  # CFF(Pretendard)는 서브루틴을 풀면 오히려 커짐
    opts.layout_features = ["kern", "liga", "ccmp", "locl", "mark", "mkmk"]
    opts.name_IDs = ["*"]  # 라이선스(13, 14) 등 name 레코드 유지 (OFL 고지 조건)
    opts.notdef_outline = True
    opts.drop_tables += ["DSIG"]
    res = {}
    for flavor, ext in ((None, "ttf"), ("woff", "woff")):
        f = TTFont(src)
        f.flavor = None
        sub = subset.Subsetter(options=opts)
        sub.populate(unicodes=present)
        sub.subset(f)
        f.flavor = flavor
        out = f"{out_base}.{ext}" if "CFF " not in f else f"{out_base}.{'otf' if ext == 'ttf' else ext}"
        f.save(out)
        res[ext] = (out, os.path.getsize(out))
    res["glyphs"] = len(present)
    return res


def main(src_dir: str, out_dir: str, only: str | None = None) -> None:
    os.makedirs(out_dir, exist_ok=True)
    ui = sorted({ord(ch) for ch in UI_TEXT} | set(ASCII))
    sets = {
        "ks2350": ASCII + SYMBOLS + JAMO + KS2350,
        "full": ASCII + SYMBOLS + JAMO + FULL,
        "ui": ui,
    }
    print(f"{'font':22s} {'subset':7s} {'chars':>6s} {'ttf/otf KB':>10s} {'woff KB':>8s}  (원본 KB)")
    for name, rel in SOURCES.items():
        if only and only not in name:
            continue
        src = os.path.join(src_dir, rel)
        if not os.path.exists(src):
            print(f"skip {name}: {src} 없음")
            continue
        orig = os.path.getsize(src) / 1024
        for sname, cps in sets.items():
            r = build(src, cps, os.path.join(out_dir, f"{name}.{sname}"))
            print(
                f"{name:22s} {sname:7s} {r['glyphs']:6d} {r['ttf'][1] / 1024:10.0f} "
                f"{r['woff'][1] / 1024:8.0f}  ({orig:.0f})"
            )


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
