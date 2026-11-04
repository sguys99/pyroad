"""폰트 파일의 글리프 수, 한글 커버리지, 라이선스 필드를 출력합니다.

사용: python3 font_report.py <font> [<font> ...]
"""
import os
import sys

from fontTools.ttLib import TTFont

KS = [c for c in range(0xAC00, 0xD7A4) if len(chr(c).encode("euc-kr", errors="ignore")) == 2]


def main(paths: list[str]) -> None:
    print(f"KS X 1001 완성형 한글: {len(KS)}자")
    for p in paths:
        f = TTFont(p)
        cmap = f.getBestCmap()
        hang = sum(1 for c in cmap if 0xAC00 <= c <= 0xD7A3)
        ksc = sum(1 for c in KS if c in cmap)
        lic = (f["name"].getDebugName(13) or "").replace("\n", " ")
        outl = "CFF" if "CFF " in f else "glyf"
        print(
            f"{os.path.basename(p):32s} {os.path.getsize(p) / 1024:8.0f}KB "
            f"glyphs={f['maxp'].numGlyphs:6d} hangul={hang:6d} ks2350={ksc:5d} "
            f"flavor={f.flavor} outlines={outl}"
        )
        print(f"    license: {lic[:150]}")


if __name__ == "__main__":
    main(sys.argv[1:])
