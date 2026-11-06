# 시안 B 종이 질감 타일 (P2-03). 실시간 feTurbulence 대신 미리 만든 작은 PNG 타일을 data URI로 쓴다.
#   python3 src/b/gen-paper.py   → src/b/paper.gen.ts (커밋 대상, 다시 만들 때만 실행)
# - grain: 잔 입자 128px (잉크 갈색, 알파만 6단계로 양자화해 압축이 잘 되게)
# - fiber: 섬유 얼룩 256px (부드러운 큰 요철, 바탕 전체 1겹)
# 둘 다 가장자리를 감싸는(wrap) 흐림이라 이음매 없이 반복된다.
import base64, io, os
import numpy as np
from PIL import Image

rng = np.random.default_rng(7)
INK = (92, 70, 42)  # 종이 결 색 (#5C462A)

def blur_wrap(a, r):
    # 박스 블러 3회(가우시안 근사), 가장자리 wrap → 이음매 없음
    for _ in range(3):
        for ax in (0, 1):
            acc = np.zeros_like(a)
            for s in range(-r, r + 1):
                acc += np.roll(a, s, axis=ax)
            a = acc / (2 * r + 1)
    return a

def png_la(alpha, levels):
    # 팔레트 PNG: 색은 모두 INK, 인덱스마다 투명도만 다르게(tRNS) → 아주 작게 압축
    top = float(alpha.max()) or 1.0
    idx = np.round(alpha / top * (levels - 1)).astype(np.uint8)
    im = Image.fromarray(idx, 'P')
    im.putpalette(list(INK) * levels)
    trns = bytes(int(round(i / (levels - 1) * top * 255)) for i in range(levels))
    buf = io.BytesIO()
    im.save(buf, 'PNG', optimize=True, transparency=trns)
    return buf.getvalue()

# grain: 흰 잡음 + 살짝 흐림 → 상위 값만 입자로
n = rng.random((128, 128))
g = blur_wrap(n, 1)
g = (g - g.mean()) / g.std()
grain = np.clip((g - 0.6) / 2.2, 0, 1) * 0.11

# fiber: 큰 얼룩 + 가로로 긴 섬유
f1 = blur_wrap(rng.random((256, 256)), 9)
f2 = blur_wrap(rng.random((256, 256)), 2)
f2 = np.roll(f2, 0, axis=1)
f = (f1 - f1.mean()) / f1.std() * 0.8 + (f2 - f2.mean()) / f2.std() * 0.35
fiber = np.clip((f + 0.4) / 3.0, 0, 1) * 0.04

out = {}
for name, a, lv in (('grain', grain, 6), ('fiber', fiber, 8)):
    data = png_la(a, lv)
    out[name] = 'data:image/png;base64,' + base64.b64encode(data).decode()
    print(name, len(data), 'bytes')

here = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(here, 'paper.gen.ts'), 'w') as fp:
    fp.write('// 생성물: python3 src/b/gen-paper.py (손으로 고치지 않음)\n')
    fp.write('// 시안 B 종이 질감 PNG 타일. 실시간 SVG 필터 없이 배경 이미지로 반복한다.\n')
    for k, v in out.items():
        fp.write(f"export const PAPER_{k.upper()} = 'url(\"{v}\")';\n")
