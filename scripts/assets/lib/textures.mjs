// 종이 결 타일 생성기 (P2-16). 시안 B `design/prototypes/src/b/gen-paper.py`(P2-03)를 정식 스크립트로 옮긴 것.
// 실시간 feTurbulence(비쌈, 공유 카드 PNG를 1MB로 키움: P0-10) 대신 미리 만든 작은 PNG 타일을 반복한다.
// - 같은 입력이면 항상 같은 픽셀 (시드 고정 PRNG + 사칙연산만) → `--check`가 픽셀로 드리프트를 찾는다
// - 가장자리를 감싸는(wrap) 흐림이라 이음매 없이 반복된다
// - 색은 하나(잉크 갈색), 인덱스마다 투명도만 다르게 → 팔레트 PNG가 아주 작다. CSS `mask-image`로 쓰면 다른 색으로도 칠할 수 있다

/** 종이 결 색 (#5C462A, 시안 B와 같음) */
export const PAPER_INK = [92, 70, 42];

/**
 * 만드는 타일. 알고리즘·값을 바꾸면 `version`을 올린다 (`/textures/*`는 1년 immutable 캐시).
 * - grain: 잔 입자 (흰 잡음 + 살짝 흐림 → 위쪽 값만 입자로)
 * - fiber: 섬유 얼룩 (큰 얼룩 + 작은 요철, 바탕 전체 1겹)
 */
export const TEXTURES = [
  {
    id: 'paper-grain',
    version: 1,
    kind: 'grain',
    size: 128,
    levels: 6,
    seed: 7,
  },
  {
    id: 'paper-fiber',
    version: 1,
    kind: 'fiber',
    size: 256,
    levels: 8,
    seed: 8,
  },
];

/** 타일 한 장 크기 예산 (바이트). 반복 배경이라 첫 화면 전송량에 그대로 더해진다 */
export const TEXTURE_MAX_BYTES = 10 * 1024;

export function textureFileName(def) {
  return `${def.id}.v${def.version}.png`;
}

/** mulberry32: 32비트 정수 연산만 쓰는 작은 PRNG (플랫폼과 무관하게 같은 수열) */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function noise(size, rand) {
  const a = new Float64Array(size * size);
  for (let i = 0; i < a.length; i++) a[i] = rand();
  return a;
}

/** 박스 블러 3회(가우시안 근사), 가장자리 wrap → 이음매 없음 */
export function blurWrap(src, size, r) {
  let a = Float64Array.from(src);
  const tmp = new Float64Array(a.length);
  const n = 2 * r + 1;
  for (let pass = 0; pass < 3; pass++) {
    for (let axis = 0; axis < 2; axis++) {
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          let acc = 0;
          for (let s = -r; s <= r; s++) {
            const xx = axis === 0 ? x : (x + s + size) % size;
            const yy = axis === 0 ? (y + s + size) % size : y;
            acc += a[yy * size + xx];
          }
          tmp[y * size + x] = acc / n;
        }
      }
      a.set(tmp);
    }
  }
  return a;
}

/** 평균 0, 표준편차 1로 */
function standardize(a) {
  let mean = 0;
  for (const v of a) mean += v;
  mean /= a.length;
  let varSum = 0;
  for (const v of a) varSum += (v - mean) ** 2;
  const std = Math.sqrt(varSum / a.length) || 1;
  return a.map((v) => (v - mean) / std);
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** 타일의 픽셀별 불투명도 (0~1) */
export function textureAlpha(def) {
  const rand = mulberry32(def.seed);
  const { size } = def;
  if (def.kind === 'grain') {
    const g = standardize(blurWrap(noise(size, rand), size, 1));
    return g.map((v) => clamp01((v - 0.6) / 2.2) * 0.11);
  }
  if (def.kind === 'fiber') {
    const f1 = standardize(blurWrap(noise(size, rand), size, 9));
    const f2 = standardize(blurWrap(noise(size, rand), size, 2));
    return f1.map((v, i) => clamp01((v * 0.8 + f2[i] * 0.35 + 0.4) / 3) * 0.04);
  }
  throw new Error(`모르는 타일 종류: ${def.kind}`);
}

/**
 * 불투명도를 `levels`단계로 양자화해 팔레트 이미지로 (encodePalettePng 입력).
 * 가장 진한 값이 마지막 단계가 되고, 단계마다 투명도만 다르다.
 */
export function quantizeAlpha(alpha, size, levels, ink = PAPER_INK) {
  let top = 0;
  for (const v of alpha) if (v > top) top = v;
  if (top === 0) top = 1;
  const indices = new Uint8Array(alpha.length);
  for (let i = 0; i < alpha.length; i++) {
    indices[i] = Math.round((alpha[i] / top) * (levels - 1));
  }
  const palette = Array.from({ length: levels }, () => [...ink]);
  const trns = Array.from({ length: levels }, (_, i) =>
    Math.round((i / (levels - 1)) * top * 255),
  );
  return { width: size, height: size, indices, palette, alpha: trns };
}

export function renderTexture(def) {
  return quantizeAlpha(textureAlpha(def), def.size, def.levels);
}

/** 두 팔레트 이미지가 같은 그림인지 (압축 바이트가 아니라 픽셀·색·투명도로) */
export function sameImage(a, b) {
  if (a.width !== b.width || a.height !== b.height) return false;
  if (JSON.stringify(a.palette) !== JSON.stringify(b.palette)) return false;
  if (JSON.stringify(a.alpha) !== JSON.stringify(b.alpha)) return false;
  if (a.indices.length !== b.indices.length) return false;
  for (let i = 0; i < a.indices.length; i++) {
    if (a.indices[i] !== b.indices[i]) return false;
  }
  return true;
}
