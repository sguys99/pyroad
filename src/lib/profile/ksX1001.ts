/**
 * KS X 1001 완성형 한글 2,350자 (§12-Q14, P3-11·P3-18).
 *
 * 닉네임 글자 규칙과 공유 카드·제목 폰트 서브셋이 같은 집합을 씁니다. 2,350자 문자열을 코드에 다시 적지 않고,
 * `scripts/fonts/share-card-chars.mjs`의 `ksX1001Hangul()`과 같은 방법(EUC-KR 한글 영역 0xB0A1~0xC8FE, 25행 × 94칸을
 * 디코딩)으로 만듭니다. 두 결과가 같은지는 `__tests__/ksX1001.test.ts`가 확인합니다.
 * DB 쪽 사본(00012 `users_nickname_chars` CHECK)은 PostgreSQL `convert_from(…, 'EUC_KR')` 결과이고, 회귀 테스트 NK-*가 확인합니다.
 *
 * `TextDecoder('euc-kr')`는 WHATWG Encoding 표준이라 모든 브라우저와 Node(full-icu, 공식 빌드 기본값)에 있습니다.
 * 서버·클라이언트 어디서나 import할 수 있는 순수 모듈이며, 처음 쓸 때 한 번만 만듭니다.
 */

const FIRST_ROW = 0xb0;
const LAST_ROW = 0xc8;
const FIRST_CELL = 0xa1;
const LAST_CELL = 0xfe;

let cachedList: readonly string[] | null = null;
let cachedSet: ReadonlySet<string> | null = null;

/** KS X 1001 완성형 한글 2,350자 (코드포인트 순) */
export function ksX1001HangulList(): readonly string[] {
  if (cachedList) return cachedList;
  const cellsPerRow = LAST_CELL - FIRST_CELL + 1;
  const bytes = new Uint8Array((LAST_ROW - FIRST_ROW + 1) * cellsPerRow * 2);
  let i = 0;
  for (let row = FIRST_ROW; row <= LAST_ROW; row++) {
    for (let cell = FIRST_CELL; cell <= LAST_CELL; cell++) {
      bytes[i++] = row;
      bytes[i++] = cell;
    }
  }
  // fatal: 디코더가 없거나 잘못 풀면 조용히 U+FFFD로 채우지 않고 바로 실패
  const list = Array.from(
    new TextDecoder('euc-kr', { fatal: true }).decode(bytes),
  );
  if (list.length !== 2350) {
    throw new Error(`KS X 1001 한글이 2,350자가 아님 (${list.length}자)`);
  }
  cachedList = Object.freeze(list);
  return cachedList;
}

/** 한 글자(코드포인트 1개)가 KS X 1001 완성형 한글인가. "똠·햏"은 false */
export function isKsX1001Hangul(ch: string): boolean {
  cachedSet ??= new Set(ksX1001HangulList());
  return cachedSet.has(ch);
}
