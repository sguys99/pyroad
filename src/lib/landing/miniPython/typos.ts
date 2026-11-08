/**
 * `print` 오타 알아보기 (P4-03): 글자 바꿈·빠짐·더함·자리 바꿈 2번 이내, 그리고 한글 자판으로 친 print(ㅔ갸ㅜㅅ).
 * 화면에 그리지 않는 자모는 문자열 대신 코드포인트·영문 자판 글자로만 둔다 (랜딩 글꼴 서브셋에 들어가지 않게).
 */

/** 낱자 바꿈·빠짐·더함·이웃 자리 바꿈 거리 (짧은 이름만 비교하므로 표 크기가 작다) */
export function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 3 || a.length > 24) return 99;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) =>
      i === 0 ? j : j === 0 ? i : 0,
    ),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

/** print를 잘못 친 것 같은 이름 (대소문자는 따로 본다) */
export function closeToPrint(id: string): boolean {
  if (id.length < 3 || id === 'print') return false;
  return editDistance(id.toLowerCase(), 'print') <= 2;
}

// ── 한글 자판 → 영문 자판 (두벌식) ──────────────────────────

/** 초성 19 · 중성 21 · 종성 28(0 = 없음)을 누른 영문 자판 글자 */
const L_KEYS = 'r R s e E f a q Q t T d w W c z x v g'.split(' ');
const V_KEYS = 'k o i O j p u P h hk ho hl y n nj np nl b m ml l'.split(' ');
const T_KEYS = [
  '',
  'r',
  'R',
  'rt',
  's',
  'sw',
  'sg',
  'e',
  'f',
  'fr',
  'fa',
  'fq',
  'ft',
  'fx',
  'fv',
  'fg',
  'a',
  'q',
  'qt',
  't',
  'T',
  'd',
  'w',
  'c',
  'z',
  'x',
  'v',
  'g',
];
/** 호환 자모 U+3131(ㄱ)…U+314E(ㅎ) 자음 30개 */
const COMPAT_CONSONANT_KEYS =
  'r R rt s sw sg e E f fr fa fq ft fx fv fg a q Q qt t T d w W c z x v g'.split(
    ' ',
  );

function keysOf(ch: string): string | null {
  const c = ch.codePointAt(0) ?? 0;
  if (c >= 0xac00 && c <= 0xd7a3) {
    const i = c - 0xac00;
    return (
      L_KEYS[Math.floor(i / 588)] +
      V_KEYS[Math.floor((i % 588) / 28)] +
      T_KEYS[i % 28]
    );
  }
  if (c >= 0x3131 && c <= 0x314e) return COMPAT_CONSONANT_KEYS[c - 0x3131];
  if (c >= 0x314f && c <= 0x3163) return V_KEYS[c - 0x314f];
  return null;
}

/** 한글 자판 상태로 `target`을 친 것 같은지 (예: ㅔ갸ㅜㅅ → print). 한글이 하나도 없으면 false */
export function koreanKeyboardTo(id: string, target: string): boolean {
  let keys = '';
  let hangul = false;
  for (const ch of id) {
    const k = keysOf(ch);
    if (k === null) {
      keys += ch;
    } else {
      keys += k;
      hangul = true;
    }
  }
  if (!hangul) return false;
  return editDistance(keys.toLowerCase(), target) <= 1;
}
