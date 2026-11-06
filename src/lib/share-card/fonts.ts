/**
 * 공유 카드 폰트 로더 (P2-19, 서버 전용: `node:fs`). P9-07의 Node.js 런타임 이미지 라우트가 쓴다.
 *
 * - 경로는 **고정 문자열**로 둔다. `join(dir, name)`처럼 동적이면 Turbopack 파일 추적이 폴더 전체를 함수에 넣는다
 *   (P0-10 §4.6). P9-07은 `next.config.ts` `outputFileTracingIncludes`에 `src/fonts/share-card/**`를 적고
 *   빌드 뒤 `.next/server/app/**\/route.js.nft.json`에 이 세 파일만 들어갔는지 확인한다
 * - satori는 파싱한 폰트를 `fonts` 배열 객체를 키로 캐시한다(WeakMap). 같은 배열 객체를 돌려줘야 두 번째 요청부터
 *   파싱을 건너뛴다 → 프로세스 안에서 한 번만 만든다
 * - 순서: Jua(제목) → pyRoad Sans 600(본문, 2,350자) → pyRoad Sans 700(11,172자). satori는 글자가 없으면 목록의
 *   다른 폰트에서 **그 글자만** 가져오므로, 마지막 Bold 전체가 드문 글자·기호(…·×)의 대체 폰트가 된다(P0-10 §4.4)
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { FONT } from './tokens';

export interface CardFont {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 600 | 700;
  style: 'normal';
}

const toArrayBuffer = (b: Buffer): ArrayBuffer =>
  b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

let cached: Promise<CardFont[]> | null = null;

export function loadShareCardFonts(
  root: string = process.cwd(),
): Promise<CardFont[]> {
  if (cached && root === process.cwd()) return cached;
  const p = Promise.all([
    readFile(join(root, 'src/fonts/share-card/jua/Jua-KS2350.ttf')),
    readFile(
      join(
        root,
        'src/fonts/share-card/pyroad-sans/pyRoadSans-SemiBold-KS2350.otf',
      ),
    ),
    readFile(
      join(root, 'src/fonts/share-card/pyroad-sans/pyRoadSans-Bold-Full.otf'),
    ),
  ]).then(([jua, sans600, sans700]): CardFont[] => [
    {
      name: FONT.display,
      data: toArrayBuffer(jua),
      weight: 400,
      style: 'normal',
    },
    {
      name: FONT.sans,
      data: toArrayBuffer(sans600),
      weight: 600,
      style: 'normal',
    },
    {
      name: FONT.sans,
      data: toArrayBuffer(sans700),
      weight: 700,
      style: 'normal',
    },
  ]);
  if (root === process.cwd()) {
    cached = p;
    p.catch(() => {
      cached = null;
    });
  }
  return p;
}
