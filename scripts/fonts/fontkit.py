#!/usr/bin/env python3
"""pyRoad 웹폰트 도구 (P2-10, fontTools). `scripts/fonts/build-fonts.mjs`가 부른다.

  python3 -P -E fontkit.py subset  <src> <out.woff2> --text-file F [--family NAME --rename OLD,OLD2] [--sfnt]
  python3 -P -E fontkit.py slice   <src> <outdir> --ranges <ref.css> --prefix P [--no-hanja] [--family NAME --rename OLD]
  python3 -P -E fontkit.py rewrap  <ref.css> <outdir> --prefix P --family NAME --rename OLD   # 공식 동적 서브셋 조각의 이름만 바꿈
  python3 -P -E fontkit.py metrics <font>...                                                   # 폴백 보정용 메트릭

모든 명령은 결과를 JSON 한 줄로 stdout에 낸다 (Node 쪽이 CSS·manifest를 씀).

- `subset --sfnt`: WOFF2 대신 압축 없는 TTF/OTF로 저장한다(공유 카드 satori는 WOFF2를 못 읽음, P0-10·P2-19).
  CFF(OTF)는 서브루틴을 풀면 오히려 커져서 그대로 둔다.

- 서브셋은 힌팅 제거(구글 폰트 조각과 같음), 레이아웃 기능 전부 유지(kern, ccmp, Pretendard tnum 등),
  저작권·라이선스 name 레코드(0·13·14) 유지 → OFL 고지 의무.
- `--family`를 주면 OFL 예약 이름(RFN) 때문에 이름을 바꾼다(§12-Q27): 글꼴 이름이 들어가는 name 레코드
  (1·3·4·6·16·17·21·25·256 이상)의 OLD를 NAME으로 바꾸고, 저작권·상표·제작사·디자이너·설명·URL·라이선스
  (0·7·8·9·10·11·12·13·14)는 원문 그대로 둔다. 바꾼 뒤 이름 레코드에 OLD가 남아 있으면 실패.
- 조각(slice)은 기준 CSS(npm `pretendard` 가변 동적 서브셋)의 unicode-range 묶음대로 자르고, 어느 묶음에도 없는
  글자는 마지막 "나머지" 조각에 모은다(빠뜨리는 글자 없음). unicode-range는 실제로 글리프가 있는 코드포인트만 적는다.
- 폰트 파일은 신뢰하지 않는 입력으로 보고 `python3 -P -E`로 실행한다(스크립트·현재 디렉터리를 import 경로에 넣지 않음).
"""
from __future__ import annotations

import argparse
import io
import json
import os
import re
import logging
import statistics
import sys
from concurrent.futures import ProcessPoolExecutor

# "FFTM NOT subset; dropped" 같은 경고는 의도된 것(빌드 도구 메타 테이블)이라 숨긴다
logging.getLogger("fontTools.subset").setLevel(logging.ERROR)

from fontTools import subset as ftsubset
from fontTools.ttLib import TTFont

# 이름을 바꾸지 않는(원문 유지) name ID: 저작권·상표·제작사·디자이너·설명·URL·라이선스
KEEP_NAME_IDS = {0, 7, 8, 9, 10, 11, 12, 13, 14}
HANJA_KANA = (
    set(range(0x3040, 0x3100))  # 히라가나·가타카나
    | set(range(0x3400, 0x4DC0))  # CJK 확장 A
    | set(range(0x4E00, 0xA000))  # CJK 통합 한자
    | set(range(0xF900, 0xFB00))  # CJK 호환 한자
)
VERSION_SUFFIX = "; pyRoad subset"


def load(path: str) -> TTFont:
    return TTFont(path, lazy=False)


def rename(font: TTFont, family: str, olds: list[str]) -> None:
    """name 테이블의 글꼴 이름을 family로 바꾼다. olds: 원래 이름들(긴 것부터 치환)."""
    ps_family = family.replace(" ", "")
    pairs = []
    for old in sorted(olds, key=len, reverse=True):
        pairs.append((old, family))
        if " " in old:
            pairs.append((old.replace(" ", ""), ps_family))  # PostScript 이름 (공백 없음)
    name = font["name"]
    for rec in list(name.names):
        if rec.nameID in KEEP_NAME_IDS:
            continue
        s = new = rec.toUnicode()
        # PostScript 이름(6)·가변 PS 접두사(25)에는 공백을 쓸 수 없다
        ps_only = rec.nameID in (6, 25)
        for old, rep in pairs:
            new = new.replace(old, ps_family if ps_only else rep)
        if rec.nameID == 3:
            new = f"{new};pyroad-subset"
        if new != s:
            name.setName(new, rec.nameID, rec.platformID, rec.platEncID, rec.langID)
    left = [
        (r.nameID, r.toUnicode())
        for r in name.names
        if r.nameID not in KEEP_NAME_IDS
        and any(o in r.toUnicode() or o.replace(" ", "") in r.toUnicode() for o in olds)
    ]
    if left:
        raise SystemExit(f"rename: 원래 이름이 남은 name 레코드 {left}")


def mark_version(font: TTFont) -> None:
    name = font["name"]
    for rec in list(name.names):
        if rec.nameID == 5:
            s = rec.toUnicode()
            if VERSION_SUFFIX not in s:
                name.setName(s + VERSION_SUFFIX, 5, rec.platformID, rec.platEncID, rec.langID)


def subset_font(font: TTFont, cps: set[int], flavor: str | None = "woff2") -> TTFont:
    opts = ftsubset.Options()
    opts.flavor = flavor
    opts.hinting = False
    opts.desubroutinize = flavor is not None
    opts.layout_features = ["*"]
    opts.name_IDs = ["*"]
    opts.name_languages = ["*"]
    opts.notdef_outline = True
    opts.glyph_names = False
    opts.ignore_missing_unicodes = True
    sub = ftsubset.Subsetter(options=opts)
    sub.populate(unicodes=sorted(cps))
    sub.subset(font)
    font.flavor = flavor
    return font


def finish(font: TTFont, family: str | None, olds: list[str], flavor: str | None = "woff2") -> None:
    if family:
        rename(font, family, olds)
    mark_version(font)
    font.flavor = flavor


def range_str(cps) -> str:
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


def parse_range(raw: str) -> set[int]:
    cps: set[int] = set()
    for part in raw.split(","):
        part = part.strip().upper().replace("U+", "")
        if not part:
            continue
        if "?" in part:
            a, b = int(part.replace("?", "0"), 16), int(part.replace("?", "F"), 16)
        elif "-" in part:
            a, b = (int(x, 16) for x in part.split("-"))
        else:
            a = b = int(part, 16)
        cps.update(range(a, b + 1))
    return cps


FACE_RE = re.compile(r"@font-face\s*{([^}]*)}")


def parse_faces(css_path: str) -> list[tuple[str | None, set[int]]]:
    """기준 CSS의 (src url, unicode-range 코드포인트) 목록. 같은 범위는 한 번만."""
    css = open(css_path, encoding="utf-8").read()
    out, seen = [], set()
    for body in FACE_RE.findall(css):
        m = re.search(r"unicode-range:\s*([^;]+);", body)
        if not m:
            continue
        key = m.group(1).strip()
        if key in seen:
            continue
        seen.add(key)
        u = re.search(r"url\(([^)]+)\)", body)
        out.append((u.group(1).strip("'\"") if u else None, parse_range(key)))
    return out


def cmd_subset(a):
    text = open(a.text_file, encoding="utf-8").read()
    want = {ord(c) for c in text}
    font = load(a.src)
    have = set(font.getBestCmap())
    missing = sorted(c for c in want - have if c > 0x20 and not chr(c).isspace())
    flavor = None if a.sfnt else "woff2"
    subset_font(font, want & have, flavor)
    finish(font, a.family, a.rename.split(",") if a.rename else [], flavor)
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    font.save(a.out)
    print(json.dumps({
        "out": a.out,
        "bytes": os.path.getsize(a.out),
        "chars": len(want & have),
        "missing": "".join(chr(c) for c in missing),
    }, ensure_ascii=False))


_SLICE_SRC = None


def _init(src):
    global _SLICE_SRC
    _SLICE_SRC = open(src, "rb").read()


def _make_slice(job):
    path, cps, family, olds = job
    font = TTFont(io.BytesIO(_SLICE_SRC), lazy=False)
    subset_font(font, set(cps))
    finish(font, family, olds)
    font.save(path)
    return os.path.getsize(path)


def cmd_slice(a):
    font = load(a.src)
    have = {c for c in font.getBestCmap() if c > 0x20 or c == 0x20}
    if a.no_hanja:
        have -= HANJA_KANA
    groups = parse_faces(a.ranges)
    os.makedirs(a.outdir, exist_ok=True)
    covered: set[int] = set()
    jobs, faces = [], []
    olds = a.rename.split(",") if a.rename else []
    for i, (_url, rng) in enumerate(groups):
        cps = sorted((rng & have) - covered)
        if not cps:
            continue
        covered |= set(cps)
        faces.append({"file": f"{a.prefix}.{len(faces)}.woff2", "cps": cps})
    # 기준 CSS에 없는 글자(D2Coding의 라틴 확장·그리스·키릴·괘선 등)는 코드포인트 순으로 잘게 나눠
    # 한 글자 때문에 큰 조각을 받지 않게 한다
    rest = sorted(have - covered)
    for k in range(0, len(rest), a.rest_chunk):
        faces.append({"file": f"{a.prefix}.{len(faces)}.woff2", "cps": rest[k : k + a.rest_chunk]})
    for f in faces:
        jobs.append((os.path.join(a.outdir, f["file"]), f["cps"], a.family, olds))
    with ProcessPoolExecutor(max_workers=a.jobs, initializer=_init, initargs=(a.src,)) as ex:
        sizes = list(ex.map(_make_slice, jobs))
    out = []
    for f, size in zip(faces, sizes):
        out.append({"file": f["file"], "bytes": size, "range": range_str(f["cps"]), "count": len(f["cps"])})
    print(json.dumps({"faces": out, "rest": len(rest)}, ensure_ascii=False))


def _rewrap_one(job):
    src, dst, family, olds = job
    font = TTFont(src, lazy=False)
    finish(font, family, olds)
    font.save(dst)
    return os.path.getsize(dst), set(font.getBestCmap())


def cmd_rewrap(a):
    groups = parse_faces(a.ref)
    base = os.path.dirname(os.path.abspath(a.ref))
    os.makedirs(a.outdir, exist_ok=True)
    olds = a.rename.split(",")
    jobs, metas = [], []
    for i, (url, rng) in enumerate(groups):
        src = os.path.normpath(os.path.join(base, url))
        fn = f"{a.prefix}.{i}.woff2"
        jobs.append((src, os.path.join(a.outdir, fn), a.family, olds))
        metas.append((fn, rng))
    with ProcessPoolExecutor(max_workers=a.jobs) as ex:
        results = list(ex.map(_rewrap_one, jobs))
    out = []
    for (fn, rng), (size, cmap) in zip(metas, results):
        cps = rng & cmap  # 조각에 실제로 있는 글자만 적는다
        out.append({"file": fn, "bytes": size, "range": range_str(cps), "count": len(cps)})
    print(json.dumps({"faces": out}, ensure_ascii=False))


def cmd_metrics(a):
    rows = []
    for p in a.fonts:
        f = load(p)
        upm = f["head"].unitsPerEm
        os2, hhea = f["OS/2"], f["hhea"]
        cmap, hmtx = f.getBestCmap(), f["hmtx"]
        hangul = [c for c in cmap if 0xAC00 <= c <= 0xD7A3]
        use_typo = bool(os2.fsSelection & (1 << 7))
        asc, desc, gap = (
            (os2.sTypoAscender, -os2.sTypoDescender, os2.sTypoLineGap)
            if use_typo
            else (hhea.ascent, -hhea.descent, hhea.lineGap)
        )
        rows.append({
            "file": os.path.basename(p),
            "family": f["name"].getDebugName(1),
            "upm": upm,
            "ascent": asc / upm,
            "descent": desc / upm,
            "lineGap": gap / upm,
            "hangulAdvance": statistics.mean(hmtx[cmap[c]][0] for c in hangul) / upm if hangul else None,
            "latinAdvance": hmtx[cmap[ord("a")]][0] / upm,
            "hangulCount": len(hangul),
        })
    print(json.dumps(rows, ensure_ascii=False))


def main():
    p = argparse.ArgumentParser()
    sp = p.add_subparsers(dest="cmd", required=True)
    s = sp.add_parser("subset")
    s.add_argument("src")
    s.add_argument("out")
    s.add_argument("--text-file", required=True)
    s.add_argument("--family")
    s.add_argument("--rename")
    s.add_argument("--sfnt", action="store_true", help="WOFF2 대신 TTF/OTF (공유 카드)")
    s.set_defaults(fn=cmd_subset)
    c = sp.add_parser("slice")
    c.add_argument("src")
    c.add_argument("outdir")
    c.add_argument("--ranges", required=True)
    c.add_argument("--prefix", required=True)
    c.add_argument("--family")
    c.add_argument("--rename")
    c.add_argument("--no-hanja", action="store_true")
    c.add_argument("--rest-chunk", type=int, default=160)
    c.add_argument("--jobs", type=int, default=os.cpu_count() or 2)
    c.set_defaults(fn=cmd_slice)
    r = sp.add_parser("rewrap")
    r.add_argument("ref")
    r.add_argument("outdir")
    r.add_argument("--prefix", required=True)
    r.add_argument("--family", required=True)
    r.add_argument("--rename", required=True)
    r.add_argument("--jobs", type=int, default=os.cpu_count() or 2)
    r.set_defaults(fn=cmd_rewrap)
    m = sp.add_parser("metrics")
    m.add_argument("fonts", nargs="+")
    m.set_defaults(fn=cmd_metrics)
    args = p.parse_args()
    args.fn(args)


if __name__ == "__main__":
    sys.exit(main())
