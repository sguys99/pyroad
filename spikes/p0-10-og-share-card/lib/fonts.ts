/**
 * 공유 카드 폰트 로더 (Node.js 런타임).
 *
 * 전략 (?fonts= 로 바꿔 가며 측정)
 *  - ks     : KS X 1001 2,350자 서브셋 TTF/OTF를 함수 번들에 포함 (권장안)
 *  - ui     : 제목 폰트는 템플릿 고정 문구 글자만, 닉네임 같은 동적 문자열은 Pretendard 전체(11,172자)로
 *  - full   : 원본 폰트 파일 그대로
 *  - google : Jua·Gaegu·Gowun Dodum을 요청마다 Google Fonts CSS2 API `&text=`로 받아 옴 (Pretendard는 번들)
 *  - woff   : ks와 같은 글자 범위를 WOFF(zlib)로 (번들 크기 ↓, 파싱 비용 ↑ 비교용)
 *
 * 모든 전략 뒤에 'Fallback'(Pretendard Bold 전체 11,172자)을 붙여 서브셋 밖 글자를 받칩니다 (?fallback=0 으로 끔).
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export type Family = 'Jua' | 'Pretendard' | 'Gaegu' | 'Gowun Dodum' | 'Cafe24 Ssurround';
export type FontStrategy = 'ks' | 'ui' | 'full' | 'google' | 'woff';

type Weight = 400 | 700 | 800;
interface FontSpec {
  name: Family | 'Fallback';
  weight: Weight;
  file: Record<Exclude<FontStrategy, 'google'>, string>;
  google?: { family: string; weight: number };
}

const SPECS: Record<string, FontSpec> = {
  jua: {
    name: 'Jua', weight: 400,
    file: { ks: 'Jua.ks2350.ttf', ui: 'Jua.ui.ttf', full: 'orig/Jua-Regular.ttf', woff: 'Jua.ks2350.woff' },
    google: { family: 'Jua', weight: 400 },
  },
  pretendard700: {
    name: 'Pretendard', weight: 700,
    file: { ks: 'Pretendard-Bold.ks2350.otf', ui: 'Pretendard-Bold.full.otf', full: 'orig/Pretendard-Bold.otf', woff: 'Pretendard-Bold.ks2350.woff' },
  },
  pretendard800: {
    name: 'Pretendard', weight: 800,
    file: { ks: 'Pretendard-ExtraBold.ks2350.otf', ui: 'Pretendard-ExtraBold.ui.otf', full: 'orig/Pretendard-ExtraBold.otf', woff: 'Pretendard-ExtraBold.ks2350.woff' },
  },
  gaegu: {
    name: 'Gaegu', weight: 700,
    file: { ks: 'Gaegu-Bold.ks2350.ttf', ui: 'Gaegu-Bold.ui.ttf', full: 'orig/Gaegu-Bold.ttf', woff: 'Gaegu-Bold.ks2350.woff' },
    google: { family: 'Gaegu', weight: 700 },
  },
  gowun: {
    name: 'Gowun Dodum', weight: 400,
    file: { ks: 'GowunDodum.ks2350.ttf', ui: 'GowunDodum.ui.ttf', full: 'orig/GowunDodum-Regular.ttf', woff: 'GowunDodum.ks2350.woff' },
    google: { family: 'Gowun Dodum', weight: 400 },
  },
  cafe24: {
    name: 'Cafe24 Ssurround', weight: 700,
    file: { ks: 'Cafe24Ssurround.ks2350.ttf', ui: 'Cafe24Ssurround.ui.ttf', full: 'orig/Cafe24Ssurround.woff', woff: 'Cafe24Ssurround.ks2350.woff' },
  },
  fallback: {
    name: 'Fallback', weight: 700,
    file: { ks: 'Pretendard-Bold.full.otf', ui: 'Pretendard-Bold.full.otf', full: 'orig/Pretendard-Bold.otf', woff: 'Pretendard-Bold.full.woff' },
  },
};

const FAMILY_SPECS: Record<Family, string[]> = {
  Jua: ['jua'],
  Pretendard: ['pretendard700', 'pretendard800'],
  Gaegu: ['gaegu'],
  'Gowun Dodum': ['gowun'],
  'Cafe24 Ssurround': ['cafe24'],
};

const FONT_DIR = join(process.cwd(), 'assets', 'fonts');
const fileCache = new Map<string, Promise<Buffer>>();
const googleCache = new Map<string, Promise<ArrayBuffer>>();

function loadFile(file: string): Promise<Buffer> {
  let p = fileCache.get(file);
  if (!p) {
    p = readFile(join(FONT_DIR, file));
    fileCache.set(file, p);
  }
  return p;
}

// 구형 Safari UA를 보내야 Google Fonts가 WOFF2 대신 TTF를 돌려줍니다 (@vercel/og와 같은 방법)
const TTF_UA =
  'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1';

export async function loadGoogleFont(family: string, weight: number, text: string): Promise<ArrayBuffer> {
  const uniq = Array.from(new Set(Array.from(text))).sort().join('');
  const key = `${family}:${weight}:${uniq}`;
  let p = googleCache.get(key);
  if (!p) {
    p = (async () => {
      const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&text=${encodeURIComponent(uniq)}`;
      const css = await (await fetch(url, { headers: { 'User-Agent': TTF_UA } })).text();
      const m = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/);
      if (!m) throw new Error(`Google Fonts CSS에 TTF가 없음: ${family}`);
      const res = await fetch(m[1]);
      if (!res.ok) throw new Error(`Google Fonts 파일 실패 ${res.status}`);
      return res.arrayBuffer();
    })();
    googleCache.set(key, p);
    p.catch(() => googleCache.delete(key));
  }
  return p;
}

export interface LoadedFont {
  name: string;
  data: ArrayBuffer | Buffer;
  weight: Weight;
  style: 'normal';
}

// satori는 파싱한 폰트를 `fonts` 배열 객체를 키로 WeakMap에 캐시합니다 (Do.has(t.fonts)).
// 같은 조합이면 같은 배열 객체를 돌려줘야 warm 요청에서 opentype 파싱을 건너뜁니다.
const arrayCache = new Map<string, Promise<{ fonts: LoadedFont[]; bytes: number }>>();

export async function loadFonts(
  families: Family[],
  strategy: FontStrategy,
  opts: { text?: string; fallback?: boolean; memo?: boolean } = {},
): Promise<{ fonts: LoadedFont[]; bytes: number }> {
  const { fallback = true, memo = true } = opts;
  if (!memo || strategy === 'google') return loadFontsUncached(families, strategy, opts);
  const key = `${strategy}|${fallback}|${families.join(',')}`;
  let p = arrayCache.get(key);
  if (!p) {
    p = loadFontsUncached(families, strategy, opts);
    arrayCache.set(key, p);
    p.catch(() => arrayCache.delete(key));
  }
  return p;
}

async function loadFontsUncached(
  families: Family[],
  strategy: FontStrategy,
  { text = '', fallback = true }: { text?: string; fallback?: boolean } = {},
): Promise<{ fonts: LoadedFont[]; bytes: number }> {
  const keys = families.flatMap((f) => FAMILY_SPECS[f]);
  if (fallback) keys.push('fallback');
  const fonts = await Promise.all(
    keys.map(async (k) => {
      const s = SPECS[k];
      let data: ArrayBuffer | Buffer;
      if (strategy === 'google' && s.google) {
        data = await loadGoogleFont(s.google.family, s.google.weight, text);
      } else {
        data = await loadFile(s.file[strategy === 'google' ? 'ks' : strategy]);
      }
      return { name: s.name, data, weight: s.weight, style: 'normal' as const };
    }),
  );
  return { fonts, bytes: fonts.reduce((a, f) => a + f.data.byteLength, 0) };
}

export { FONT_STACK } from './fontStack';
