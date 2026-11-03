#!/usr/bin/env python3
"""P0-14 이미지 후처리 (Pillow).

  python3 -P -E images.py shrink <in.png> <out.png> [--max-kb 245] [--max-width 1280]
      팔레트 양자화(256→…색)·축소로 PNG를 목표 크기 이하로 줄인다.
  python3 -P -E images.py filmstrip <frames-root> <out.png> --variants system,a-next,... --times 400,800,...
      screenshot.mjs filmstrip이 남긴 프레임에서 시각별로 가장 가까운(이전) 프레임을 골라 격자로 합친다.
"""
import argparse
import io
import os

from PIL import Image, ImageDraw, ImageFont


def encode(img, colors):
    q = img.convert("RGB").quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    buf = io.BytesIO()
    q.save(buf, "PNG", optimize=True)
    return buf.getvalue()


def cmd_shrink(a):
    img = Image.open(a.inp)
    if img.width > a.max_width:
        img = img.resize((a.max_width, round(img.height * a.max_width / img.width)), Image.LANCZOS)
    limit = a.max_kb * 1024
    data = None
    for scale in (1.0, 0.9, 0.8, 0.7, 0.6):
        im = img if scale == 1.0 else img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
        for colors in (256, 160, 96, 64, 48, 32):
            data = encode(im, colors)
            if len(data) <= limit:
                open(a.out, "wb").write(data)
                print(f"{a.out}\t{len(data)//1024}KB\t{im.width}x{im.height}\t{colors} colors")
                return
    open(a.out, "wb").write(data)
    print(f"{a.out}\t{len(data)//1024}KB (over limit)")


def pick(frames_dir, t):
    files = sorted(os.listdir(frames_dir))
    best = None
    for f in files:
        ft = int(os.path.splitext(f)[0])
        if ft <= t:
            best = f
    return os.path.join(frames_dir, best) if best else None


def cmd_filmstrip(a):
    variants = a.variants.split(",")
    times = [int(t) for t in a.times.split(",")]
    labels = dict(kv.split("=", 1) for kv in (a.labels or "").split(";") if "=" in kv)
    cell_w, cell_h, pad, head, left = 195, 300, 8, 34, 120
    W = left + len(times) * (cell_w + pad) + pad
    H = head + len(variants) * (cell_h + pad) + pad
    canvas = Image.new("RGB", (W, H), "#f4f6fa")
    d = ImageDraw.Draw(canvas)
    try:
        font = ImageFont.truetype(a.font, 15) if a.font else ImageFont.load_default()
    except OSError:
        font = ImageFont.load_default()
    for j, t in enumerate(times):
        d.text((left + pad + j * (cell_w + pad) + 4, 10), f"{t/1000:.1f}s", fill="#23324d", font=font)
    for i, v in enumerate(variants):
        y = head + pad + i * (cell_h + pad)
        d.text((8, y + cell_h // 2 - 20), labels.get(v, v), fill="#23324d", font=font)
        for j, t in enumerate(times):
            x = left + pad + j * (cell_w + pad)
            p = pick(os.path.join(a.root, v), t)
            if p:
                fr = Image.open(p).convert("RGB")
                fr = fr.crop((0, 0, fr.width, min(fr.height, round(fr.width * cell_h / cell_w))))
                fr = fr.resize((cell_w, cell_h), Image.LANCZOS)
                canvas.paste(fr, (x, y))
            else:
                d.rectangle((x, y, x + cell_w, y + cell_h), fill="#ffffff", outline="#d7e7f5")
                d.text((x + 70, y + cell_h // 2), "(빈 화면)", fill="#9aa7bd", font=font)
    buf = io.BytesIO()
    canvas.save(buf, "PNG")
    tmp = a.out + ".raw.png"
    open(tmp, "wb").write(buf.getvalue())
    cmd_shrink(argparse.Namespace(inp=tmp, out=a.out, max_kb=a.max_kb, max_width=W))
    os.remove(tmp)


def main():
    p = argparse.ArgumentParser()
    sp = p.add_subparsers(dest="cmd", required=True)
    s = sp.add_parser("shrink")
    s.add_argument("inp")
    s.add_argument("out")
    s.add_argument("--max-kb", type=int, default=245)
    s.add_argument("--max-width", type=int, default=1280)
    s.set_defaults(fn=cmd_shrink)
    f = sp.add_parser("filmstrip")
    f.add_argument("root")
    f.add_argument("out")
    f.add_argument("--variants", required=True)
    f.add_argument("--times", required=True)
    f.add_argument("--labels", help="variant=라벨;variant=라벨")
    f.add_argument("--font", help="라벨용 TTF (한글 라벨이면 한글 폰트 경로)")
    f.add_argument("--max-kb", type=int, default=245)
    f.set_defaults(fn=cmd_filmstrip)
    a = p.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
