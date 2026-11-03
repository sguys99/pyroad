"""닉네임/콘텐츠 글자가 KS X 1001 2,350자 서브셋을 벗어나는 비율을 측정합니다.

사용: python3 nickname_coverage.py <위키 JSON 디렉토리> <seed.sql 경로> [<폰트> ...]

- 말뭉치: 한국어 위키백과 문서 본문(API extracts JSON)
- 모델 닉네임: 말뭉치 음절 빈도로 N음절 닉네임을 뽑았을 때 1자 이상 빠질 확률
- 예시 닉네임: 아이들이 쓸 법한 닉네임 목록 (직접 작성)
"""
import glob
import json
import random
import sys
from collections import Counter

from fontTools.ttLib import TTFont

KS = {c for c in range(0xAC00, 0xD7A4) if len(chr(c).encode("euc-kr", errors="ignore")) == 2}

SAMPLE_NICKNAMES = [
    "파이뱀짱", "코딩왕민준", "별빛소녀", "슈퍼개발자", "똘똘이", "뿡뿡이", "쀼쀼", "햏햏",
    "뷁", "똠방각하", "냥냥펀치", "멍뭉이", "댕댕이", "꾹꾹이", "쿵야", "뀨", "퓨퓨",
    "삐약이", "꿀벌", "됬다", "갬성", "띵작", "읭", "뭥미", "앙기모띠", "쌉가능",
    "킹갓제너럴", "핵인싸", "쪼꼬미", "똥꼬발랄", "뾰로롱", "뿌잉뿌잉", "츄츄", "랄랄라",
    "마인크래프트", "로블록스킹", "포켓몬마스터", "피카츄", "꼬부기", "푸린", "잠만보",
    "펭수", "뽀로로", "크롱", "루피", "짱구", "흰둥이", "철수", "유리", "맹구",
    "김치볶음밥", "떡볶이", "붕어빵", "호떡", "탕후루", "마라탕", "젤리", "솜사탕",
    "하늘별", "바다곰", "숲속토끼", "무지개", "햇살", "달빛", "구름빵", "노을",
    "ㅋㅋ왕", "ㅎㅎ", "Minjun", "dev_kid", "코딩123", "파이썬마스터2", "😀스마일",
    "똽", "뙇", "쀍", "옭", "쉩", "썽", "쓩", "슝", "샾", "펲", "믜",
]


def hangul(text: str) -> list[int]:
    return [ord(c) for c in text if 0xAC00 <= ord(c) <= 0xD7A3]


def load_corpus(d: str) -> Counter:
    cnt: Counter = Counter()
    for p in glob.glob(f"{d}/*.json"):
        with open(p, encoding="utf-8") as fp:
            data = json.load(fp)
        for page in data.get("query", {}).get("pages", {}).values():
            cnt.update(hangul(page.get("extract", "")))
    return cnt


def main(corpus_dir: str, seed_sql: str, fonts: list[str]) -> None:
    cnt = load_corpus(corpus_dir)
    total = sum(cnt.values())
    miss_tok = sum(v for k, v in cnt.items() if k not in KS)
    miss_types = [k for k in cnt if k not in KS]
    print(f"[말뭉치] 한글 음절 토큰 {total:,}개, 서로 다른 음절 {len(cnt):,}종")
    print(f"  KS 2350 밖 토큰 비율: {miss_tok / total * 100:.3f}%  (종류 {len(miss_types)}종)")
    top_miss = sorted(miss_types, key=lambda k: -cnt[k])[:25]
    print("  빠지는 음절 상위:", " ".join(f"{chr(k)}({cnt[k]})" for k in top_miss))

    # 말뭉치 빈도로 뽑은 N음절 닉네임에서 1자 이상 빠질 확률
    keys = list(cnt.keys())
    weights = [cnt[k] for k in keys]
    rnd = random.Random(42)
    print("[모델 닉네임] 말뭉치 빈도 / 균등(11,172자) 추출, 10만 개씩")
    for n in (2, 4, 6, 8):
        trials = 100_000
        miss_w = sum(
            1 for _ in range(trials) if any(c not in KS for c in rnd.choices(keys, weights, k=n))
        )
        p_uni = 1 - (2350 / 11172) ** n
        print(f"  {n}음절: 빈도 기반 {miss_w / trials * 100:.2f}%  | 균등 {p_uni * 100:.1f}%")

    print("[예시 닉네임]", len(SAMPLE_NICKNAMES), "개")
    misses = [nk for nk in SAMPLE_NICKNAMES if any(c not in KS for c in hangul(nk))]
    print(f"  KS 2350 밖 글자 포함: {len(misses)}개 ({len(misses) / len(SAMPLE_NICKNAMES) * 100:.0f}%)")
    print("  ", ", ".join(f"{nk}[{''.join(chr(c) for c in hangul(nk) if c not in KS)}]" for nk in misses))

    with open(seed_sql, encoding="utf-8") as fp:
        seed = fp.read()
    sc = Counter(hangul(seed))
    sm = [k for k in sc if k not in KS]
    print(f"[seed.sql] 한글 음절 {sum(sc.values()):,}개 / {len(sc)}종, KS 밖: {len(sm)}종 {''.join(chr(k) for k in sm)}")

    for fp_ in fonts:
        cmap = TTFont(fp_).getBestCmap()
        nk_miss = [nk for nk in SAMPLE_NICKNAMES if any(ord(c) not in cmap for c in nk if not c.isspace())]
        tok_cov = sum(v for k, v in cnt.items() if k in cmap) / total * 100
        print(f"[{fp_.split('/')[-1]}] 말뭉치 토큰 커버 {tok_cov:.3f}%, 예시 닉네임 중 글리프 누락 {len(nk_miss)}개")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3:])
