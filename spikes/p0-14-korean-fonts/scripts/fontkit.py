#!/usr/bin/env python3
"""P0-14 한글 웹폰트 도구 (fontTools).

  python3 -P -E fontkit.py inspect <font>...                       # 메트릭·커버리지·라이선스·크기
  python3 -P -E fontkit.py subset  <font> <out.woff2> [--profile ksx1001|text] [--text-file F] [--no-hinting]
  python3 -P -E fontkit.py slice   <font> <outdir> --family NAME --ranges <google.css>
                                [--weight 400] [--style normal] [--prefix name] [--no-hinting]
                                [--url-prefix ./] [--display swap]
  python3 -P -E fontkit.py estimate <slices.css> <outdir> --text-file F    # 페이지 텍스트에 필요한 슬라이스 수·바이트

- ksx1001 프로필: ASCII + Latin-1 + 일반 문장부호 + 화살표·도형·★♥ + KS X 1001 비한자 기호행
  (A1~A4, A6, A8, A9: 기호·전각·호환 자모·괘선·원문자) + 현대 한글 2,350자.
- slice: 기준 CSS(구글 폰트 css2 응답)의 unicode-range 묶음 그대로 잘라 woff2 슬라이스 + @font-face CSS를 만든다.
  구글 폰트·Pretendard의 "동적 서브셋"과 같은 방식이며, 구글에 없는 폰트(D2Coding, Cafe24 써라운드)를
  같은 품질로 자가 호스팅하기 위한 것이다.
- 폰트 파일은 신뢰하지 않는 입력으로 보고 `python3 -P -E`로 실행한다 (스크립트·현재 디렉터리를 import 경로에 넣지 않음, fontTools는 사용자 site-packages).
"""
from __future__ import annotations

import argparse
import io
import json
import os
import re
import sys

from fontTools import subset as ftsubset
from fontTools.ttLib import TTCollection, TTFont

HANGUL_ALL = range(0xAC00, 0xD7A4)  # 11,172


def ksx1001_hangul() -> list[int]:
    out = []
    for hi in range(0xB0, 0xC9):
        for lo in range(0xA1, 0xFF):
            try:
                out.append(ord(bytes([hi, lo]).decode("euc_kr")))
            except UnicodeDecodeError:
                pass
    return out


def ksx1001_symbols(rows=(0xA1, 0xA2, 0xA3, 0xA4, 0xA6, 0xA8, 0xA9)) -> list[int]:
    out = []
    for hi in rows:
        for lo in range(0xA1, 0xFF):
            try:
                s = bytes([hi, lo]).decode("euc_kr")
                if len(s) == 1:
                    out.append(ord(s))
            except UnicodeDecodeError:
                pass
    return out


def profile_codepoints(profile: str, text: str | None = None) -> set[int]:
    if profile == "text":
        return {ord(c) for c in (text or "")} | set(range(0x20, 0x7F))
    cps = set(range(0x20, 0x7F))  # ASCII
    cps |= set(range(0xA0, 0x100))  # Latin-1 (·, ×, © …)
    cps |= set(range(0x2010, 0x2028)) | set(range(0x2030, 0x205F))  # “ ” ‘ ’ … ‧
    cps |= set(range(0x2190, 0x2200))  # 화살표
    cps |= set(range(0x25A0, 0x2600))  # 도형 ■□▲△●○◆
    cps |= {0x2605, 0x2606, 0x2661, 0x2665, 0x266A, 0x266B, 0x2713, 0x2714, 0x2716}  # ★☆♡♥♪♫✓✔✖
    cps |= set(range(0x3000, 0x3040))  # CJK 기호 (「」『』〈〉)
    cps |= set(range(0x3131, 0x318F))  # 호환 자모 (ㅋㅋ ㅠㅠ)
    cps |= set(range(0xFF01, 0xFF5F))  # 전각
    cps |= set(ksx1001_symbols())
    cps |= set(ksx1001_hangul())
    return cps


def load_font(path: str, index: int = 0) -> TTFont:
    if path.lower().endswith((".ttc", ".otc")):
        return TTCollection(path).fonts[index]
    return TTFont(path, lazy=False)


def font_bytes(font: TTFont, flavor: str | None) -> int:
    buf = io.BytesIO()
    font.flavor = flavor
    font.save(buf)
    return len(buf.getvalue())


def make_subset(path: str, cps: set[int], hinting: bool = True, flavor: str = "woff2") -> TTFont:
    font = load_font(path)
    opts = ftsubset.Options()
    opts.flavor = flavor
    opts.hinting = hinting
    opts.desubroutinize = True  # CFF 폰트 woff2 압축률 개선
    opts.layout_features = ["*"]  # kern, ccmp, ljmo/vjmo/tjmo 등 유지
    opts.name_IDs = ["*"]  # 저작권·라이선스(nameID 0, 13, 14) 유지 → OFL 고지 의무
    opts.name_languages = ["*"]
    opts.notdef_outline = True
    opts.glyph_names = False
    opts.ignore_missing_unicodes = True
    sub = ftsubset.Subsetter(options=opts)
    sub.populate(unicodes=sorted(cps))
    sub.subset(font)
    font.flavor = flavor
    return font


def name(font: TTFont, nid: int) -> str:
    rec = font["name"].getDebugName(nid)
    return rec or ""


def adv(font: TTFont, ch: str) -> int | None:
    cmap = font.getBestCmap()
    g = cmap.get(ord(ch))
    if g is None:
        return None
    return font["hmtx"][g][0]


def cmd_inspect(args):
    rows = []
    ks = set(ksx1001_hangul())
    for path in args.fonts:
        font = load_font(path)
        cmap = font.getBestCmap()
        cps = set(cmap)
        upm = font["head"].unitsPerEm
        os2 = font["OS/2"]
        row = {
            "file": os.path.basename(path),
            "family": name(font, 1),
            "subfamily": name(font, 2),
            "version": name(font, 5),
            "upm": upm,
            "glyphs": font["maxp"].numGlyphs,
            "outline": "CFF" if "CFF " in font or "CFF2" in font else "glyf",
            "variable": "fvar" in font,
            "hangul_syllables": len(cps & set(HANGUL_ALL)),
            "ksx1001_coverage": len(cps & ks),
            "license": name(font, 13)[:120].replace("\n", " "),
            "license_url": name(font, 14),
            "fsType": os2.fsType,
            "weightClass": os2.usWeightClass,
            "ascender": os2.sTypoAscender,
            "descender": os2.sTypoDescender,
            "winAscent": os2.usWinAscent,
            "winDescent": os2.usWinDescent,
            "hheaAscent": font["hhea"].ascent,
            "hheaDescent": font["hhea"].descent,
            "lineGap": font["hhea"].lineGap,
            "adv_a": adv(font, "a"),
            "adv_0": adv(font, "0"),
            "adv_space": adv(font, " "),
            "adv_가": adv(font, "가"),
            "adv_ㅋ": adv(font, "ㅋ"),
            "adv_─": adv(font, "─"),
            "has_liga": _has_feature(font, "liga") or _has_feature(font, "calt"),
            "file_bytes": os.path.getsize(path),
        }
        if args.sizes:
            row["full_woff2"] = font_bytes(load_font(path), "woff2")
            row["ksx_woff2"] = font_bytes(make_subset(path, profile_codepoints("ksx1001")), "woff2")
            row["ksx_woff2_nohint"] = font_bytes(
                make_subset(path, profile_codepoints("ksx1001"), hinting=False), "woff2"
            )
        rows.append(row)
    print(json.dumps(rows, ensure_ascii=False, indent=1))


def _has_feature(font, tag):
    if "GSUB" not in font or font["GSUB"].table.FeatureList is None:
        return False
    return any(fr.FeatureTag == tag for fr in font["GSUB"].table.FeatureList.FeatureRecord)


def cmd_subset(args):
    text = open(args.text_file, encoding="utf-8").read() if args.text_file else None
    cps = profile_codepoints(args.profile, text)
    font = make_subset(args.font, cps, hinting=not args.no_hinting)
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    font.save(args.out)
    print(f"{args.out}\t{os.path.getsize(args.out)}")


RANGE_RE = re.compile(r"unicode-range:\s*([^;]+);")


def parse_ranges(css_path: str, with_raw: bool = False):
    """구글 css2 응답에서 unicode-range 묶음 목록을 읽는다 (중복 제거, 순서 유지). with_raw면 원문 문자열도 함께."""
    css = open(css_path, encoding="utf-8").read()
    seen, groups = set(), []
    for block in re.findall(r"@font-face\s*{[^}]*}", css):
        m = RANGE_RE.search(block)
        if not m:
            continue
        key = m.group(1).strip()
        if key in seen:
            continue
        seen.add(key)
        rs = []
        for part in key.split(","):
            part = part.strip().upper().replace("U+", "")
            if "-" in part:
                a, b = part.split("-")
                rs.append((int(a, 16), int(b, 16)))
            elif "?" in part:
                rs.append((int(part.replace("?", "0"), 16), int(part.replace("?", "F"), 16)))
            else:
                rs.append((int(part, 16), int(part, 16)))
        groups.append((rs, key) if with_raw else rs)
    return groups


def to_range_str(cps: list[int]) -> str:
    cps = sorted(cps)
    out, start, prev = [], None, None
    for c in cps:
        if start is None:
            start = prev = c
        elif c == prev + 1:
            prev = c
        else:
            out.append((start, prev))
            start = prev = c
    if start is not None:
        out.append((start, prev))
    return ", ".join(f"U+{a:x}" if a == b else f"U+{a:x}-{b:x}" for a, b in out)


def cmd_slice(args):
    groups = parse_ranges(args.ranges, with_raw=True)
    base = load_font(args.font)
    font_cps = set(base.getBestCmap())
    font_cps = {c for c in font_cps if c >= 0x20}  # 제어 문자(개행 등)는 렌더되지 않으므로 슬라이스에서 뺀다
    if args.no_hanja:
        hanja = set(range(0x3400, 0x4DC0)) | set(range(0x4E00, 0xA000)) | set(range(0xF900, 0xFB00)) | set(range(0x3040, 0x3100))
        font_cps -= hanja
    prefix = args.prefix or re.sub(r"[^A-Za-z0-9]+", "", args.family)
    os.makedirs(args.outdir, exist_ok=True)
    css, total, n, covered = [], 0, 0, set()
    for i, (rs, raw_range) in enumerate(groups):
        want = set()
        for a, b in rs:
            want |= set(range(a, b + 1))
        cps = sorted(want & font_cps - covered)
        if not cps:
            continue
        covered |= set(cps)
        fn = f"{prefix}.{i}.woff2"
        if not (args.reuse and os.path.exists(os.path.join(args.outdir, fn))):
            f = make_subset(args.font, set(cps), hinting=not args.no_hinting)
            f.save(os.path.join(args.outdir, fn))
        size = os.path.getsize(os.path.join(args.outdir, fn))
        total += size
        n += 1
        css.append(
            "@font-face {\n"
            f"  font-family: '{args.family}';\n"
            f"  font-style: {args.style};\n"
            f"  font-weight: {args.weight};\n"
            f"  font-display: {args.display};\n"
            f"  src: url({args.url_prefix}{fn}) format('woff2');\n"
            f"  unicode-range: {raw_range if args.range_mode == 'reference' else to_range_str(cps)};\n"
            "}\n"
        )
    missing = len(font_cps - covered)
    header = (
        f"/* {args.family} — {n} slices, {total} bytes total. generated by fontkit.py slice "
        f"(ranges: {os.path.basename(args.ranges)}; {missing} codepoints outside ranges dropped) */\n"
    )
    css_path = os.path.join(args.outdir, f"{prefix}.css")
    with open(css_path, "w", encoding="utf-8") as fh:
        fh.write(header + "\n".join(css))
    print(json.dumps({"family": args.family, "slices": n, "total_bytes": total, "css": css_path, "dropped_cps": missing}))


def cmd_estimate(args):
    """슬라이스 CSS + 파일 크기로 페이지 텍스트가 실제 내려받을 슬라이스 수·바이트를 계산."""
    text = open(args.text_file, encoding="utf-8").read()
    need = {ord(c) for c in text if not c.isspace()} | {0x20}
    css = open(args.css, encoding="utf-8").read()
    hit_files, hit_bytes, all_bytes, nfaces = [], 0, 0, 0
    for block in re.findall(r"@font-face\s*{[^}]*}", css):
        m = RANGE_RE.search(block)
        src = re.search(r"url\(([^)]+)\)", block).group(1).strip("'\"")
        fp = os.path.join(args.dir, os.path.basename(src))
        size = os.path.getsize(fp) if os.path.exists(fp) else 0
        all_bytes += size
        nfaces += 1
        rs = []
        for part in (m.group(1) if m else "U+0-10FFFF").split(","):
            part = part.strip().upper().replace("U+", "")
            a, _, b = part.partition("-")
            rs.append((int(a, 16), int(b or a, 16)))
        if any(a <= c <= b for c in need for a, b in rs):
            hit_files.append(os.path.basename(src))
            hit_bytes += size
    print(json.dumps({"css": os.path.basename(args.css), "faces": nfaces, "all_bytes": all_bytes,
                      "hit_slices": len(hit_files), "hit_bytes": hit_bytes,
                      "unique_chars": len(need)}))


def main():
    p = argparse.ArgumentParser()
    sp = p.add_subparsers(dest="cmd", required=True)
    a = sp.add_parser("inspect")
    a.add_argument("fonts", nargs="+")
    a.add_argument("--sizes", action="store_true", help="full/KS X 1001 woff2 크기까지 계산 (느림)")
    a.set_defaults(fn=cmd_inspect)
    b = sp.add_parser("subset")
    b.add_argument("font")
    b.add_argument("out")
    b.add_argument("--profile", default="ksx1001", choices=["ksx1001", "text"])
    b.add_argument("--text-file")
    b.add_argument("--no-hinting", action="store_true")
    b.set_defaults(fn=cmd_subset)
    c = sp.add_parser("slice")
    c.add_argument("font")
    c.add_argument("outdir")
    c.add_argument("--family", required=True)
    c.add_argument("--ranges", required=True)
    c.add_argument("--weight", default="400")
    c.add_argument("--style", default="normal")
    c.add_argument("--display", default="swap")
    c.add_argument("--prefix")
    c.add_argument("--url-prefix", default="./")
    c.add_argument("--no-hinting", action="store_true")
    c.add_argument("--range-mode", default="exact", choices=["reference", "exact"],
                   help="exact: 실제 글리프가 있는 코드포인트만(기본, 글리프가 적은 폰트일수록 CSS가 짧음) / reference: 기준 CSS 범위 문자열 그대로")
    c.add_argument("--no-hanja", action="store_true", help="한자(CJK 통합 한자·호환 한자)·가나를 빼고 자른다 (코드·제목 폰트용, CSS·용량 절감)")
    c.add_argument("--reuse", action="store_true", help="이미 있는 슬라이스 파일은 다시 만들지 않고 CSS만 갱신")
    c.set_defaults(fn=cmd_slice)
    d = sp.add_parser("estimate")
    d.add_argument("css")
    d.add_argument("dir")
    d.add_argument("--text-file", required=True)
    d.set_defaults(fn=cmd_estimate)
    args = p.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
