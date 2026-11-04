/**
 * 긴 닉네임·스테이지 이름 처리: 자소/이모지를 깨지 않는 grapheme 단위 자르기 + 글자 크기 자동 맞춤.
 *
 * satori에는 "상자에 맞게 글자 크기 줄이기"가 없어서, 글자 폭을 em 단위로 근사해 크기를 고릅니다.
 * 폰트별 평균 advance(fontTools로 원본 hmtx 실측, unitsPerEm 기준)를 씁니다. 커닝은 무시합니다.
 * 근사가 빗나가도 마지막 안전장치로 CSS `textOverflow: ellipsis`(한 줄)를 같이 겁니다.
 */

export type MetricFamily = 'Jua' | 'Gaegu' | 'Gowun Dodum' | 'Pretendard';
// [한글, 대문자·숫자, 소문자, 공백, 문장부호]
const METRICS: Record<MetricFamily, [number, number, number, number, number]> = {
  Jua: [0.82, 0.6, 0.48, 0.3, 0.3],
  Gaegu: [0.82, 0.54, 0.45, 0.42, 0.45],
  'Gowun Dodum': [0.91, 0.6, 0.47, 0.31, 0.3],
  Pretendard: [0.87, 0.67, 0.55, 0.23, 0.32],
};

const seg = new Intl.Segmenter('ko', { granularity: 'grapheme' });

export function graphemes(s: string): string[] {
  return Array.from(seg.segment(s), (x) => x.segment);
}

function charEm(g: string, fam: MetricFamily): number {
  const [han, up, lo, sp, pu] = METRICS[fam];
  const c = g.codePointAt(0) ?? 0;
  if (c === 0x20) return sp;
  if (c === 0x2026) return 0.88; // … 는 Jua·Gaegu에 없어 Fallback(Pretendard)로 그려짐
  if ((c >= 0x1100 && c <= 0x11ff) || (c >= 0x3130 && c <= 0x318f)) return han; // 자모
  if ((c >= 0x3000 && c <= 0x9fff) || (c >= 0xac00 && c <= 0xd7a3) || (c >= 0xff00 && c <= 0xffef)) return han;
  if (c >= 0x1f000) return 1.1; // 이모지
  if (/[A-Z0-9]/.test(g)) return up;
  if (/[a-z]/.test(g)) return lo;
  return pu;
}

export function emWidth(s: string, fam: MetricFamily = 'Pretendard'): number {
  return graphemes(s).reduce((a, g) => a + charEm(g, fam), 0);
}

/** maxEm(폭, em 단위)을 넘으면 grapheme 단위로 자르고 … 를 붙입니다. */
export function truncateEm(s: string, maxEm: number, fam: MetricFamily = 'Pretendard'): string {
  if (emWidth(s, fam) <= maxEm) return s;
  const gs = graphemes(s);
  let out = '';
  let w = 0;
  for (const g of gs) {
    const cw = charEm(g, fam);
    if (w + cw > maxEm - 0.9) break;
    out += g;
    w += cw;
  }
  return `${out.trimEnd()}…`;
}

/**
 * 상자 폭(px)에 맞는 글자 크기를 고르고, 최소 크기로도 넘치면 자릅니다.
 * @returns { text, fontSize }
 */
export function fitText(
  s: string,
  boxWidth: number,
  { max, min, family = 'Pretendard', letterSpacingEm = 0 }: { max: number; min: number; family?: MetricFamily; letterSpacingEm?: number },
): { text: string; fontSize: number } {
  const n = graphemes(s).length;
  const em = emWidth(s, family) + letterSpacingEm * n;
  const ideal = Math.floor(boxWidth / Math.max(em, 0.01));
  if (ideal >= min) return { text: s, fontSize: Math.min(max, ideal) };
  return { text: truncateEm(s, boxWidth / min, family), fontSize: min };
}

/**
 * 제목용: 한 줄에 min 이상으로 들어가면 한 줄, 아니면 공백 기준 2줄로 나눠 다시 맞추고, 그래도 넘치면 자릅니다.
 * 스테이지 이름처럼 우리가 쓰는 콘텐츠는 2줄까지 허용하는 편이 자르는 것보다 낫습니다.
 */
export function fitTitle(
  s: string,
  boxWidth: number,
  opts: { max: number; min: number; family?: MetricFamily },
): { lines: string[]; fontSize: number } {
  const one = fitText(s, boxWidth, opts);
  if (one.text === s) return { lines: [s], fontSize: one.fontSize };
  const words = s.split(' ');
  if (words.length < 2) return { lines: [one.text], fontSize: one.fontSize };
  // 두 줄 폭 차이가 가장 작은 분할점
  let best = 1;
  let bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = emWidth(words.slice(0, i).join(' '), opts.family);
    const b = emWidth(words.slice(i).join(' '), opts.family);
    const diff = Math.max(a, b);
    if (diff < bestDiff) { bestDiff = diff; best = i; }
  }
  const l1 = words.slice(0, best).join(' ');
  const l2 = words.slice(best).join(' ');
  const twoMax = Math.round(opts.max * 0.72);
  const f1 = fitText(l1, boxWidth, { ...opts, max: twoMax });
  const f2 = fitText(l2, boxWidth, { ...opts, max: twoMax });
  const fontSize = Math.min(f1.fontSize, f2.fontSize);
  return { lines: [truncateEm(l1, boxWidth / fontSize, opts.family), truncateEm(l2, boxWidth / fontSize, opts.family)], fontSize };
}

/** 닉네임 정규화: 공백 정리, 제어문자 제거, 최대 grapheme 수 제한 (카드 단계의 안전장치) */
export function normalizeNickname(s: string, maxGraphemes = 12): string {
  // eslint-disable-next-line no-control-regex
  const clean = s.replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim();
  const gs = graphemes(clean);
  return gs.length > maxGraphemes ? `${gs.slice(0, maxGraphemes).join('')}…` : clean;
}
