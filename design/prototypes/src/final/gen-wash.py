# 최종 시안 히어로 수채 워시 (P2-07, 결정 §12-Q28: 정지 그림만 래스터 혼합)
#   python3 src/final/gen-wash.py   → src/final/wash.gen.ts (커밋 대상, 다시 만들 때만 실행)
# 이미지 생성 도구 없이 절차적으로: 번진 얼룩 마스크 → 가장자리 물자국(진하게) → 안료 입자 → 종이 위에 겹치기.
# 배경은 투명이라 화면의 종이 질감이 비친다. 앱에서는 일러스트레이터 원본 WebP로 바꿀 자리(P2-16·P2-17).
import base64, io, os
import numpy as np
from PIL import Image

W, H = 560, 440
rng = np.random.default_rng(11)
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)


def blur(a, r):
    # 박스 블러 3회 (가우시안 근사, 가장자리 반사)
    for _ in range(3):
        for ax in (0, 1):
            p = np.pad(a, [(r, r), (0, 0)] if ax == 0 else [(0, 0), (r, r)], mode='reflect')
            c = np.cumsum(p, axis=ax, dtype=np.float64)
            if ax == 0:
                c = np.vstack([np.zeros((1, W)), c])
                a = ((c[2 * r + 1:] - c[:-2 * r - 1]) / (2 * r + 1)).astype(np.float32)
            else:
                c = np.hstack([np.zeros((H, 1)), c])
                a = ((c[:, 2 * r + 1:] - c[:, :-2 * r - 1]) / (2 * r + 1)).astype(np.float32)
    return a


def noise(scale, seed):
    r = np.random.default_rng(seed)
    n = r.random((H, W)).astype(np.float32)
    n = blur(n, scale)
    return (n - n.mean()) / (n.std() + 1e-6)


def wash(mask, color, strength=0.55, edge=0.55, gran=0.12, seed=0):
    """마스크(0~1) → RGBA 층. 가장자리에 안료가 모여 진해지는 수채 특유의 테두리 + 입자"""
    m = np.clip(mask, 0, 1)
    soft = blur(m, 6)
    rim = np.clip(m - blur(m, 10), 0, 1) * 2.2  # 경계 안쪽 띠
    g = noise(2, seed + 100) * 0.35 + noise(6, seed + 200) * 0.65
    a = soft * strength * (1 + edge * rim) * (1 + gran * g)
    a = np.clip(a, 0, 1)
    rgb = np.ones((H, W, 3), np.float32) * np.array(color, np.float32) / 255
    return rgb, a


def blob(cx, cy, rx, ry, wobble, seed):
    n = noise(18, seed) * wobble
    d = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2
    return np.clip((1.0 - d + n * 0.35) * 3.0, 0, 1)


layers = []
# 하늘: 위쪽 옅은 물빛
sky = np.clip(1.1 - yy / (H * 0.55) + noise(30, 1) * 0.18, 0, 1)
layers.append(wash(sky, (150, 192, 214), strength=0.45, edge=0.25, gran=0.1, seed=1))
# 해: 겨자
layers.append(wash(blob(430, 92, 46, 46, 0.4, 2), (242, 193, 78), strength=0.7, edge=0.8, seed=2))
# 먼 언덕: 세이지
hill1 = np.clip((yy - (250 - 40 * np.sin(xx / 95) + noise(25, 3) * 10)) / 6, 0, 1)
layers.append(wash(hill1, (156, 203, 128), strength=0.5, edge=0.7, seed=3))
# 가까운 언덕: 올리브빛 초록
hill2 = np.clip((yy - (318 - 28 * np.sin(xx / 70 + 1.3) + noise(25, 4) * 10)) / 6, 0, 1)
layers.append(wash(hill2, (122, 168, 95), strength=0.55, edge=0.8, seed=4))
# 길: 모래색 띠 (아래 왼쪽 → 오른쪽 위)
path_y = 400 - (xx / W) * 150 + 18 * np.sin(xx / 60)
road = np.clip(1 - np.abs(yy - path_y) / 16 + noise(12, 5) * 0.15, 0, 1) * (xx > 30) * (xx < 520)
layers.append(wash(road, (233, 211, 166), strength=0.75, edge=0.5, gran=0.15, seed=5))

# 종이 위에 겹치기 (투명 바탕, 곱하기에 가까운 over)
out_rgb = np.ones((H, W, 3), np.float32)
out_a = np.zeros((H, W), np.float32)
for rgb, a in layers:
    out_rgb = out_rgb * (1 - a[..., None]) + rgb * a[..., None] * 0.98
    out_a = out_a + a * (1 - out_a)
# 전체 가장자리: 붓으로 칠한 듯 고르지 않게 사라짐
vx = np.minimum(xx, W - xx) / 60
vy = np.minimum(yy, H - yy) / 50
vign = np.clip(np.minimum(vx, vy) + noise(14, 9) * 0.25, 0, 1)
out_a *= vign
rgb = out_rgb / np.maximum(out_a[..., None], 1e-3) * out_a[..., None] + (1 - out_a[..., None])
img = np.dstack([np.clip(out_rgb, 0, 1), np.clip(out_a, 0, 1)])
img8 = (img * 255).astype(np.uint8)
im = Image.fromarray(img8, 'RGBA').quantize(colors=255, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
buf = io.BytesIO()
im.save(buf, 'PNG', optimize=True)
data = buf.getvalue()
print('wash', len(data), 'bytes')
here = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(here, 'wash.gen.ts'), 'w') as fp:
    fp.write('// 생성물: python3 src/final/gen-wash.py (손으로 고치지 않음)\n')
    fp.write('// 히어로 수채 워시 PNG (정지 그림만 래스터, §12-Q28). 560×440, 투명 바탕\n')
    fp.write(f"export const HERO_WASH = 'data:image/png;base64,{base64.b64encode(data).decode()}';\n")
