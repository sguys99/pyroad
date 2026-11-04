"""P0-13 스크린샷 합치기·줄이기 (Pillow).

    python3 -P -E images.py <shots 디렉터리> <출력 디렉터리> --font <한글 TTF>

여러 화면을 라벨과 함께 가로로 붙이고, 256색 PNG로 줄여 파일당 max_kb 이하로 맞춘다.
"""
import argparse
import os
import sys

from PIL import Image, ImageDraw, ImageFont

ap = argparse.ArgumentParser()
ap.add_argument("shots")
ap.add_argument("out")
ap.add_argument("--font", required=True)
ap.add_argument("--max-kb", type=int, default=240)
a = ap.parse_args()

SETS = {
    "P0-13-mobile-before.png": (
        0.5,
        [
            ("mobile-landing", "랜딩 /"),
            ("mobile-world", "월드맵 /world"),
            ("mobile-quest", "퀘스트 1-1 (이야기 탭)"),
            ("mobile-quest-code", "퀘스트 1-1 (코드 탭)"),
            ("mobile-profile", "프로필 /profile"),
        ],
    ),
    "P0-13-tablet-before.png": (
        0.3,
        [
            ("tablet-landing", "랜딩"),
            ("tablet-world", "월드맵"),
            ("tablet-quest", "퀘스트 1-1"),
            ("tablet-profile", "프로필"),
        ],
    ),
    "P0-13-celebration-before.png": (
        0.4,
        [
            ("mobile-celebration", "모바일: 스테이지 클리어"),
            ("mobile-levelup", "모바일: 레벨 업"),
            ("tablet-celebration", "태블릿: 스테이지 클리어"),
        ],
    ),
    "P0-13-landing-mobile-full.png": (0.5, [("mobile-landing-full", "랜딩 전체 (390px)")]),
}

font = ImageFont.truetype(a.font, 22)
BAR, GAP, BG = 40, 16, (238, 240, 244)


def compose(scale, panels):
    ims = []
    for name, label in panels:
        p = os.path.join(a.shots, name + ".png")
        im = Image.open(p).convert("RGB")
        im = im.resize((max(1, int(im.width * scale)), max(1, int(im.height * scale))), Image.LANCZOS)
        ims.append((im, label))
    W = sum(im.width for im, _ in ims) + GAP * (len(ims) + 1)
    H = max(im.height for im, _ in ims) + BAR + GAP * 2
    canvas = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(canvas)
    x = GAP
    for im, label in ims:
        d.text((x, GAP), label, fill=(40, 40, 50), font=font)
        canvas.paste(im, (x, GAP + BAR))
        d.rectangle([x - 1, GAP + BAR - 1, x + im.width, GAP + BAR + im.height], outline=(190, 194, 204))
        x += im.width + GAP
    return canvas


for out, (scale, panels) in SETS.items():
    missing = [n for n, _ in panels if not os.path.exists(os.path.join(a.shots, n + ".png"))]
    if missing:
        print("skip", out, "missing", missing, file=sys.stderr)
        continue
    s = scale
    for _ in range(12):
        img = compose(s, panels).quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        dst = os.path.join(a.out, out)
        img.save(dst, optimize=True)
        kb = os.path.getsize(dst) / 1024
        if kb <= a.max_kb:
            break
        s *= 0.9
    print(f"{out}: scale={s:.3f} {img.width}x{img.height} {kb:.0f}KB")
