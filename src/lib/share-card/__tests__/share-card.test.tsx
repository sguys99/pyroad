import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import {
  BUGBUG_STATES,
  BYEOLTTONGI_STATES,
  PYBAEM_STATES,
} from '@/components/characters/rig';
import {
  COLOR,
  CONTRAST_MIN,
  contrastRatio,
  WORLD_THEMES,
  type WorldId,
} from '@/lib/design/tokens';
import { NICKNAME_SUFFIX, renderShareCard } from '../cards';
import { characterSvg } from '../characters';
import { allIconSvgs, starSvg } from '../icons';
import { fitNickname } from '../layout';
import { SHARE_CARD_SAMPLES } from '../samples';
import { findForbiddenSvg, serializeSvg, svgDataUri } from '../svg';
import {
  ELLIPSIS,
  NICKNAME_MAX,
  digitCells,
  emWidth,
  fitNumberRow,
  fitTitle,
  graphemes,
  normalizeNickname,
} from '../text';
import {
  CARD,
  SAFE,
  TEXT_W,
  TIER_COLOR,
  TIER_LABEL,
  TIER_RANK,
  TYPE,
  worldPalette,
} from '../tokens';
import type { ShareCardData, Tier } from '../types';
import {
  allHangul,
  ksX1001Hangul,
  nicknameChars,
} from '../../../../scripts/fonts/share-card-chars.mjs';
import { inspectSfnt } from '../../../../scripts/fonts/woff2.mjs';
import { findReservedNames } from '../../../../scripts/fonts/check.mjs';

// ─────────────── 트리 펼치기 (satori가 받는 호스트 엘리먼트만)

interface Host {
  type: string;
  props: Record<string, unknown>;
  children: (Host | string)[];
}

function expand(node: ReactNode): (Host | string)[] {
  if (node === null || node === undefined || typeof node === 'boolean')
    return [];
  if (typeof node === 'string' || typeof node === 'number')
    return [String(node)];
  if (Array.isArray(node)) return node.flatMap(expand);
  if (!isValidElement(node)) return [];
  const el = node as ReactElement<Record<string, unknown>>;
  if (typeof el.type === 'function') {
    return expand((el.type as (p: unknown) => ReactNode)(el.props));
  }
  if (typeof el.type !== 'string') {
    throw new Error(`satori가 못 펼치는 엘리먼트: ${String(el.type)}`);
  }
  return [
    {
      type: el.type,
      props: el.props,
      children: expand(el.props.children as ReactNode),
    },
  ];
}

function walk(nodes: (Host | string)[], fn: (h: Host) => void) {
  for (const n of nodes) {
    if (typeof n === 'string') continue;
    fn(n);
    walk(n.children, fn);
  }
}

function texts(nodes: (Host | string)[]): string[] {
  const out: string[] = [];
  for (const n of nodes) {
    if (typeof n === 'string') out.push(n);
    else out.push(...texts(n.children));
  }
  return out;
}

const decodeSvg = (src: string) =>
  Buffer.from(src.replace('data:image/svg+xml;base64,', ''), 'base64').toString(
    'utf8',
  );

const ALL_KINDS = new Set(SHARE_CARD_SAMPLES.map((s) => s.data.kind));

// ─────────────── 글자 규칙

describe('글자 규칙 (P2-19)', () => {
  it('닉네임은 최대 10자, 넘으면 10자 + 줄임표', () => {
    expect(normalizeNickname('코딩왕민준')).toBe('코딩왕민준');
    expect(normalizeNickname('가나다라마바사아자차')).toBe(
      '가나다라마바사아자차',
    );
    const long = normalizeNickname('가나다라마바사아자차카타');
    expect(long).toBe(`가나다라마바사아자차${ELLIPSIS}`);
    expect(graphemes(long)).toHaveLength(NICKNAME_MAX + 1);
  });

  it('닉네임의 제어문자·방향 제어·폭 없는 문자를 지우고 공백을 정리한다', () => {
    expect(normalizeNickname('  코딩‮왕​민준\n ')).toBe('코딩왕민준');
  });

  it('grapheme 단위로 자른다 (풀어쓴 첫가끝 자모 한 글자를 깨지 않음)', () => {
    const han = '한'.normalize('NFD'); // U+1112 U+1161 U+11AB, 한 글자
    expect([...han]).toHaveLength(3);
    const s = normalizeNickname(`가나다라마바사아자${han}카`);
    expect(s).toBe(`가나다라마바사아자${han}${ELLIPSIS}`);
  });

  it('붙는 말이 가장 긴 카드에서도 10자 닉네임(가장 넓은 글자)은 자르지 않고 최소 크기 이상으로 들어간다', () => {
    const widest = [
      '가나다라마바사아자차',
      '뀉뀉뀉뀉뀉뀉뀉뀉뀉뀉',
      'WWWWWWWWWW',
    ];
    for (const suffix of Object.values(NICKNAME_SUFFIX)) {
      for (const name of widest) {
        const fit = fitNickname(name, suffix);
        expect(fit.text).toBe(name);
        expect(fit.fontSize).toBeGreaterThanOrEqual(TYPE.nickname.min);
        expect(emWidth(name, 'display') * fit.fontSize).toBeLessThanOrEqual(
          fit.box,
        );
      }
    }
  });

  it('제목: 짧으면 한 줄 큰 글자, 길면 2줄, 더 길면 2줄 분량에서 줄임표', () => {
    const short = fitTitle('함수 공장', TEXT_W, TYPE.title);
    expect(short).toMatchObject({ lines: 1, fontSize: TYPE.title.max });

    const two = fitTitle(
      '리스트와 딕셔너리로 보물 지도 정리하기',
      TEXT_W,
      TYPE.title,
    );
    expect(two.lines).toBe(2);
    expect(two.text).not.toContain(ELLIPSIS);
    expect(two.fontSize).toBeLessThanOrEqual(TYPE.title.max2);
    expect(two.fontSize).toBeGreaterThanOrEqual(TYPE.title.min);

    const huge = fitTitle('아주 '.repeat(40), TEXT_W, TYPE.title);
    expect(huge).toMatchObject({ lines: 2, fontSize: TYPE.title.min });
    expect(huge.text.endsWith(ELLIPSIS)).toBe(true);
    expect(emWidth(huge.text, 'display') * huge.fontSize).toBeLessThanOrEqual(
      2 * TEXT_W,
    );
  });

  it('숫자는 고정폭 칸으로 나뉘고, 숫자 줄은 자릿수가 늘어도 글 영역 안에 들어간다', () => {
    expect(digitCells(128)).toEqual(['1', '2', '8']);
    expect(digitCells(-3)).toEqual(['0']);
    for (const n of [1, 12, 128, 1024, 99999]) {
      const size = fitNumberRow(n, TEXT_W, {
        max: TYPE.hero,
        unitSize: TYPE.heroUnit,
        before: '레벨',
        after: '달성!',
        gap: 14,
      });
      const width =
        (emWidth('레벨', 'display') + emWidth('달성!', 'display')) *
          TYPE.heroUnit +
        28 +
        digitCells(n).length * Math.round(size * 0.6);
      expect(size).toBeLessThanOrEqual(TYPE.hero);
      expect(width).toBeLessThanOrEqual(TEXT_W + digitCells(n).length);
    }
  });
});

// ─────────────── 상태 매핑

describe('상태 매핑 (빈 별·티어·월드 틴트)', () => {
  it('카드 크기와 카카오 안전 영역', () => {
    expect(CARD).toEqual({ width: 1200, height: 630 });
    expect(SAFE).toEqual({ top: 20, bottom: 20 });
    // 카카오 2:1 크롭은 위아래 15px → 안전 영역이 그보다 안쪽
    expect((CARD.height - CARD.width / 2) / 2).toBeLessThan(SAFE.top);
  });

  it.each([0, 1, 2, 3, 5, -1])('별 %i개 → 채운 별 + 빈 별 = 3개', (stars) => {
    const tree = expand(
      renderShareCard({
        kind: 'stage',
        nickname: '하늘별',
        world: 1,
        worldName: '숲 마을',
        stageNo: 1,
        stageName: '첫 주문',
        stars,
      }),
    );
    const filled = svgDataUri(starSvg(true));
    const empty = svgDataUri(starSvg(false));
    let f = 0;
    let e = 0;
    walk(tree, (h) => {
      if (h.type !== 'img') return;
      if (h.props.src === filled) f++;
      if (h.props.src === empty) e++;
    });
    const want = Math.max(0, Math.min(3, stars));
    expect(f).toBe(want);
    expect(e).toBe(3 - want);
  });

  it('티어 3종: 이름표·단계·색이 모두 다르고 이름표 글자는 AA', () => {
    const tiers: Tier[] = ['bronze', 'silver', 'gold'];
    expect(tiers.map((t) => TIER_LABEL[t])).toEqual(['브론즈', '실버', '골드']);
    expect(tiers.map((t) => TIER_RANK[t])).toEqual([1, 2, 3]);
    expect(new Set(tiers.map((t) => TIER_COLOR[t].face)).size).toBe(3);
    expect(TIER_COLOR.gold.face).toBe(COLOR.accent);
    for (const t of tiers) {
      const c = TIER_COLOR[t];
      expect(contrastRatio(c.ink, c.soft)).toBeGreaterThanOrEqual(
        CONTRAST_MIN.text,
      );
    }
  });

  it('월드 틴트: 무대 바탕은 월드 soft, 눈썹 글자(ink)는 흰 이름표 위 AA', () => {
    for (const id of [1, 2, 3] as WorldId[]) {
      const w = worldPalette(id);
      expect(w.soft).toBe(COLOR[WORLD_THEMES[id].soft]);
      expect(contrastRatio(w.ink, COLOR.surface)).toBeGreaterThanOrEqual(
        CONTRAST_MIN.text,
      );
    }
  });

  it('카드 글자 조합은 모두 AA (큰 글자 포함 본문 기준 4.5)', () => {
    const pairs: [string, string][] = [
      [COLOR.text, COLOR.bg],
      [COLOR.textMuted, COLOR.bg],
      [COLOR.primaryText, COLOR.bg],
      [COLOR.primaryText, COLOR.primarySoft],
      [COLOR.accentText, COLOR.accentSoft],
      [COLOR.text, COLOR.accentSoft],
      [COLOR.text, COLOR.surface],
      [COLOR.textMuted, COLOR.surface],
      [COLOR.text, COLOR.surface2],
      [COLOR.textMuted, COLOR.surface2],
    ];
    for (const [fg, bg] of pairs) {
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(CONTRAST_MIN.text);
    }
  });
});

// ─────────────── satori 제약·금지 요소

describe('렌더 트리 (satori 제약, P0-10 §4.5)', () => {
  it('샘플이 4종을 모두 덮는다', () => {
    expect(ALL_KINDS).toEqual(
      new Set(['levelup', 'stage', 'achievement', 'weekly']),
    );
  });

  it.each(SHARE_CARD_SAMPLES.map((s) => [s.id, s.data] as const))(
    '%s: flex만·zIndex 없음·이모지 없음·그림은 금지 요소 없는 SVG data URI',
    (_id, data: ShareCardData) => {
      const tree = expand(renderShareCard(data));
      walk(tree, (h) => {
        expect(['div', 'img']).toContain(h.type);
        const style = (h.props.style ?? {}) as Record<string, unknown>;
        expect(style).not.toHaveProperty('zIndex');
        expect(style.display).not.toBe('grid');
        expect(style).not.toHaveProperty('boxShadow');
        expect(style).not.toHaveProperty('textShadow');
        expect(style).not.toHaveProperty('filter');
        const elementChildren = h.children.length;
        if (h.type === 'div' && elementChildren > 1) {
          expect(style.display).toBe('flex');
        }
        if (h.type === 'img') {
          const src = String(h.props.src);
          expect(src.startsWith('data:image/svg+xml;base64,')).toBe(true);
          const svg = decodeSvg(src);
          expect(findForbiddenSvg(svg)).toBeNull();
          expect(svg).not.toMatch(/NaN|undefined|Infinity|<animate/);
          expect(h.props.width).toBeGreaterThan(0);
          expect(h.props.height).toBeGreaterThan(0);
        }
      });
      const allText = texts(tree).join('');
      expect(allText).not.toMatch(/\p{Extended_Pictographic}/u);
    },
  );

  it('공개 정보만: 카드 글자는 템플릿 문구 + 넘긴 데이터뿐 (§2.6)', () => {
    const d: ShareCardData = {
      kind: 'weekly',
      nickname: '하늘별',
      weekLabel: '11월 첫째 주',
      quests: 3,
      xp: 90,
      stars: 7,
    };
    const t = texts(expand(renderShareCard(d))).join('|');
    expect(t).toContain('하늘별');
    expect(t).not.toMatch(/@|\d{1,2}:\d{2}|요일/);
  });

  it('모든 아이콘·메달에 금지 요소가 없다', () => {
    for (const svg of allIconSvgs()) {
      expect(findForbiddenSvg(svg)).toBeNull();
      expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(
        true,
      );
    }
  });

  it('캐릭터 정지 그림(모든 상태)은 resvg가 그릴 수 있는 SVG 문자열', () => {
    const cases = [
      ...PYBAEM_STATES.map((state) => ({ id: 'pybaem' as const, state })),
      ...BUGBUG_STATES.map((state) => ({ id: 'bugbug' as const, state })),
      ...BYEOLTTONGI_STATES.map((state) => ({
        id: 'byeolttongi' as const,
        state,
      })),
    ];
    for (const c of cases) {
      const svg = characterSvg(c);
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
      expect(findForbiddenSvg(svg)).toBeNull();
      expect(svg).not.toMatch(/NaN|undefined|<filter/);
    }
    const hat = characterSvg({
      id: 'pybaem',
      state: 'cheer',
      costume: { hat: 'explorer', glasses: 'round' },
    });
    expect(findForbiddenSvg(hat)).toBeNull();
  });

  it('직렬화기: camelCase → kebab, id 접두사, 애니메이션 제거', () => {
    const svg = serializeSvg(
      <svg viewBox="0 0 10 10">
        <defs>
          <linearGradient id="g" gradientUnits="userSpaceOnUse" />
        </defs>
        <rect fill="url(#g)" strokeWidth={2}>
          <animate attributeName="x" />
        </rect>
      </svg>,
      { idPrefix: 'p-' },
    );
    expect(svg).toBe(
      '<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="p-g" gradientUnits="userSpaceOnUse"/></defs><rect fill="url(#p-g)" stroke-width="2"/></svg>',
    );
  });
});

// ─────────────── 폰트 커버리지

describe('공유 카드 폰트 (src/fonts/share-card/)', () => {
  const dir = join(process.cwd(), 'src/fonts/share-card');
  const font = (p: string) => inspectSfnt(readFileSync(join(dir, p)));

  it('KS X 1001 완성형은 2,350자', () => {
    const ks = ksX1001Hangul();
    expect(ks).toHaveLength(2350);
    expect(new Set(ks).size).toBe(2350);
    expect(ks[0]).toBe('가');
    expect(ks).not.toContain('똠');
    expect(ks).not.toContain('햏');
  });

  it.each([
    'jua/Jua-KS2350.ttf',
    'pyroad-sans/pyRoadSans-SemiBold-KS2350.otf',
    'pyroad-sans/pyRoadSans-Bold-Full.otf',
  ])('%s: 닉네임 허용 글자(2,350자 + 영문·숫자)가 모두 있다', (file) => {
    const { codepoints } = font(file);
    const missing = nicknameChars().filter(
      (c: string) => !codepoints.has(c.codePointAt(0)!),
    );
    expect(missing).toEqual([]);
  });

  it('대체 폰트(pyRoad Sans Bold)는 현대 한글 11,172자를 모두 가진다', () => {
    const { codepoints, names } = font('pyroad-sans/pyRoadSans-Bold-Full.otf');
    expect(
      allHangul().every((c: string) => codepoints.has(c.codePointAt(0)!)),
    ).toBe(true);
    expect(names[16] ?? names[1]).toBe('pyRoad Sans');
    expect(findReservedNames(names, ['Pretendard'])).toEqual([]);
  });
});
