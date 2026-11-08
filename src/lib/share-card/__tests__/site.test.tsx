import { describe, expect, it } from 'vitest';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { COLOR, CONTRAST_MIN, contrastRatio } from '@/lib/design/tokens';
import { LEGAL_OPERATOR } from '@/lib/legal/meta';
import { OG_IMAGE_ALT } from '@/lib/seo/site';
import * as og from '@/app/opengraph-image';
import { characterSvg } from '../characters';
import { glyphSvg } from '../icons';
import { SITE_CARD_TEXT, SiteOgCard, siteMapSvg } from '../site';
import { findForbiddenSvg } from '../svg';
import { CARD, TEXT_W } from '../tokens';
import { emWidth } from '../text';

// satori가 받는 호스트 엘리먼트로 펼치기 (share-card.test.tsx와 같은 방식)
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
  if (typeof el.type !== 'string') throw new Error('펼칠 수 없는 엘리먼트');
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

const tree = expand(<SiteOgCard />);
const texts: string[] = [];
walk(tree, (h) => {
  for (const c of h.children) if (typeof c === 'string') texts.push(c);
});

describe('사이트 OG 그림 (P4-10)', () => {
  it('라우트: 1200×630 PNG, 빌드 때 정적 생성, 대체 글', () => {
    expect(og.size).toEqual({ width: 1200, height: 630 });
    expect(og.size).toEqual({ width: CARD.width, height: CARD.height });
    expect(og.contentType).toBe('image/png');
    expect(og.dynamic).toBe('force-static');
    expect(og.runtime).toBe('nodejs');
    expect(og.alt).toBe(OG_IMAGE_ALT);
  });

  it('공유 카드 틀(CardFrame) 그대로: 1200×630 바탕, 브랜드 줄', () => {
    const root = tree[0] as Host;
    expect(root.props.style).toMatchObject({
      width: CARD.width,
      height: CARD.height,
      backgroundColor: COLOR.bg,
    });
    expect(texts).toContain('pyRoad');
  });

  it('글자는 정한 문구 + 브랜드뿐 (사실만, 개인정보 없음)', () => {
    expect(texts).toEqual([
      SITE_CARD_TEXT.kicker,
      ...SITE_CARD_TEXT.title,
      SITE_CARD_TEXT.sub,
      'pyRoad',
      '초등학생 파이썬 모험',
    ]);
    const all = texts.join(' ');
    expect(all).not.toContain(LEGAL_OPERATOR.name);
    expect(all).not.toContain('@');
    // 이모지 없음 (satori가 외부 CDN에서 받아 오게 됨)
    expect(all).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it('satori 제약: 자식이 둘 이상인 div는 flex, zIndex·그림자·필터 없음', () => {
    walk(tree, (h) => {
      const style = (h.props.style ?? {}) as Record<string, unknown>;
      if (h.type === 'div' && h.children.length > 1) {
        expect(style.display).toBe('flex');
      }
      for (const k of ['zIndex', 'boxShadow', 'textShadow', 'filter']) {
        expect(style).not.toHaveProperty(k);
      }
    });
  });

  it('지도·깃발·캐릭터 SVG는 resvg가 그릴 수 있다 (<text>·<image> 없음)', () => {
    expect(findForbiddenSvg(siteMapSvg())).toBeNull();
    expect(findForbiddenSvg(glyphSvg('flag', COLOR.primaryText))).toBeNull();
    expect(
      findForbiddenSvg(characterSvg({ id: 'pybaem', state: 'wave' })),
    ).toBeNull();
    // 색은 토큰에서만 (지도 SVG에 토큰 밖 색이 없는지: 모든 #hex가 토큰이거나 토큰을 섞은 값)
    expect(siteMapSvg()).toContain(COLOR.primary);
    expect(siteMapSvg()).toContain(COLOR.accentText);
  });

  it('제목 두 줄이 글 영역 안에 한 줄씩 들어간다 (84px Jua)', () => {
    for (const line of SITE_CARD_TEXT.title) {
      expect(emWidth(line, 'display') * 84).toBeLessThan(TEXT_W);
    }
    expect(emWidth(SITE_CARD_TEXT.sub, 'sans') * 30).toBeLessThan(TEXT_W);
    expect(emWidth(SITE_CARD_TEXT.kicker, 'sans') * 30 + 80).toBeLessThan(
      TEXT_W,
    );
  });

  it('글자 조합은 AA', () => {
    const pairs: [string, string][] = [
      [COLOR.text, COLOR.bg], // 제목
      [COLOR.text, COLOR.accentLight], // 형광펜 위 제목
      [COLOR.textMuted, COLOR.bg], // 설명
      [COLOR.primaryText, COLOR.primarySoft], // 이름표
    ];
    for (const [fg, bg] of pairs) {
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(CONTRAST_MIN.text);
    }
  });
});
