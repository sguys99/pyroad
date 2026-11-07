"""프로토타입에 실제 쓰인 글자만 남긴 woff2 서브셋을 만들고 이름을 바꾼다.

  python3 -P -E scripts/subset_font.py <원본.ttf> <글자.txt> <출력.woff2> <새 패밀리 이름>

- 레이아웃 기능은 모두 유지(Pretendard 숫자 tnum 등), 힌팅 제거, 가변 축(wght)은 그대로 둔다.
- OFL 예약 이름(RFN) 때문에 서브셋(수정본)은 원래 이름을 쓰지 않는다(P0-10·P2-17):
  name ID 1·3·4·6·16·17·21을 새 이름으로 바꾸고, 저작권·라이선스(0·13·14)는 남긴다.
"""
import sys

from fontTools import subset
from fontTools.ttLib import TTFont


def main() -> None:
    src, text_file, out, family = sys.argv[1:5]
    with open(text_file, encoding="utf-8") as f:
        text = f.read()

    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["*"]
    opts.hinting = False
    opts.name_IDs = ["*"]
    opts.name_languages = ["*"]
    opts.notdef_outline = True
    opts.glyph_names = False

    font = TTFont(src, fontNumber=0)
    sub = subset.Subsetter(options=opts)
    sub.populate(text=text)
    sub.subset(font)

    ps = family.replace(" ", "")
    name = font["name"]
    for rec in list(name.names):
        if rec.nameID in (1, 16, 21):
            name.setName(family, rec.nameID, rec.platformID, rec.platEncID, rec.langID)
        elif rec.nameID == 4:
            name.setName(family, 4, rec.platformID, rec.platEncID, rec.langID)
        elif rec.nameID == 6:
            name.setName(ps, 6, rec.platformID, rec.platEncID, rec.langID)
        elif rec.nameID == 3:
            name.setName(f"{ps};prototype-subset", 3, rec.platformID, rec.platEncID, rec.langID)
        elif rec.nameID in (17, 22):
            name.setName("Regular", rec.nameID, rec.platformID, rec.platEncID, rec.langID)
        elif rec.nameID == 25:
            name.setName(ps, 25, rec.platformID, rec.platEncID, rec.langID)
    if "fvar" in font:
        # 가변 인스턴스 이름의 PostScript 접두사도 바꾼다
        for inst in font["fvar"].instances:
            inst.postscriptNameID = 0xFFFF
    font.flavor = "woff2"
    font.save(out)


if __name__ == "__main__":
    main()
