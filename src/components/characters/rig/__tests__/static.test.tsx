// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  BUGBUG,
  BUGBUG_STATES,
  BYEOLTTONGI,
  BYEOLTTONGI_STATES,
  BugBugStatic,
  ByeolttongiStatic,
  PYBAEM,
  PYBAEM_EXPRESSION_STATE,
  PYBAEM_PALETTES,
  PYBAEM_STATES,
  PybaemStatic,
  RIG_STYLES,
  RigStatic,
  STYLE_RULES,
  type RigDef,
} from '..';
import { RigView } from '../LiveRig';
import { PybaemSvg } from '../../PybaemSvg';
import type { PybaemExpression } from '../../expressions';
import { PetArt } from '../../pets';
import { PYBAEM_SKINS, skinPalette } from '@/lib/avatar/skins';
import {
  PET_IDS,
  SHOP_ITEMS,
  costumeFromAvatarConfig,
} from '@/lib/shop/catalog';

const FORBIDDEN = /<(text|foreignObject|image|tspan|use)\b/i;
/** SMIL: 정지 이미지(공유 카드)에서 무시되고 연출 단계·동작 줄이기를 따르지 않음 (P0-10, P9-04) */
const SMIL = /<(animate|animateTransform|animateMotion|set)\b/i;
const DEFS = [
  [PYBAEM, PYBAEM_STATES],
  [BUGBUG, BUGBUG_STATES],
  [BYEOLTTONGI, BYEOLTTONGI_STATES],
] as unknown as [RigDef<string, unknown>, readonly string[]][];

describe('정지 그림 (공유 카드·아바타·SSR, P0-10)', () => {
  it.each(DEFS.map(([d, s]) => [d.id, d, s] as const))(
    '%s: 모든 상태·스타일에서 금지 요소(<text>·<foreignObject>·래스터 <image>)가 없다',
    (_id, def, states) => {
      for (const style of RIG_STYLES) {
        for (const state of states) {
          for (const halo of [false, true]) {
            const svg = renderToStaticMarkup(
              <RigStatic
                def={def}
                state={state}
                style={style}
                halo={halo}
                costume={{
                  hat: 'party',
                  glasses: 'round',
                  cape: '#E53935',
                  bg: 'island',
                }}
              />,
            );
            expect(svg).not.toMatch(FORBIDDEN);
            expect(svg).not.toMatch(/NaN|undefined|Infinity/);
            expect(svg.startsWith('<svg')).toBe(true);
            expect(svg).toContain(
              `aria-label="${def.name} - ${def.stateLabel[state]}"`,
            );
          }
        }
      }
    },
  );

  it('A안은 그라디언트·필터가 없다 (렌더 비용 최적화)', () => {
    for (const [def, states] of DEFS) {
      for (const state of states) {
        const svg = renderToStaticMarkup(
          <RigStatic def={def} state={state} style="A" />,
        );
        expect(svg).not.toMatch(/Gradient|<filter/);
      }
    }
  });

  it('A×B 종이 결 필터는 filters={false}(작은 아바타·lite 이하)면 빠진다', () => {
    expect(renderToStaticMarkup(<PybaemStatic style="AB" />)).toContain(
      '<filter',
    );
    expect(
      renderToStaticMarkup(<PybaemStatic style="AB" filters={false} />),
    ).not.toContain('<filter');
  });

  it('B는 종이 결 필터 없이 몸색 톤의 얇은 외곽선 (P2-07 2차)', () => {
    const svg = renderToStaticMarkup(<PybaemStatic style="B" />);
    expect(svg).not.toContain('<filter');
    expect(svg).toContain(`stroke="${PYBAEM_PALETTES.B.outline}"`);
    expect(svg).toContain(`stroke-width="${STYLE_RULES.B.outline}"`);
    // 눈·입은 짙은 잉크 그대로 (표정이 읽히게)
    expect(svg).toContain(`fill="${PYBAEM_PALETTES.B.ink}"`);
  });

  it('눈꺼풀 clipPath는 슬플 때만 건다', () => {
    expect(renderToStaticMarkup(<PybaemStatic state="idle" />)).not.toMatch(
      /clip-path="url\(#[^"]*clipL\)"/,
    );
    expect(renderToStaticMarkup(<PybaemStatic state="sad" />)).toMatch(
      /clip-path="url\(#[^"]*clipL\)"/,
    );
  });

  it('기존 표정 10종 API: expression을 주면 포즈 표의 상태로 그린다', () => {
    for (const [ex, st] of Object.entries(PYBAEM_EXPRESSION_STATE)) {
      const svg = renderToStaticMarkup(
        <PybaemStatic expression={ex as PybaemExpression} />,
      );
      expect(svg).toContain(`파이뱀 선생님 - ${PYBAEM.stateLabel[st]}`);
    }
    expect(renderToStaticMarkup(<BugBugStatic expression="fixed" />)).toContain(
      '버그버그 - 화해',
    );
    expect(
      renderToStaticMarkup(<ByeolttongiStatic expression="flying" />),
    ).toContain('별똥이 - 날아오기');
  });

  it('label=""이면 장식 (aria-hidden)', () => {
    const svg = renderToStaticMarkup(<PybaemStatic label="" />);
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).not.toContain('role="img"');
  });

  it('기존 PybaemSvg도 Zzz·물음표를 경로로 그린다 (<text> 없음)', () => {
    for (const ex of ['sleeping', 'confused'] as const) {
      expect(renderToStaticMarkup(<PybaemSvg expression={ex} />)).not.toMatch(
        FORBIDDEN,
      );
    }
  });
});

describe('꾸미기 렌더러 (P9-04): 모든 코스튬 조각 × 포즈 × 스킨, 펫', () => {
  const costumes = SHOP_ITEMS.flatMap((i) =>
    i.kind === 'costume'
      ? [[i.id, costumeFromAvatarConfig({ [i.slot]: i.id })] as const]
      : [],
  );

  it('코스튬 10종이 모두 조각으로 그려진다', () => {
    expect(costumes).toHaveLength(10);
    for (const [id, c] of costumes) expect(Object.keys(c), id).toHaveLength(1);
  });

  it.each(costumes)(
    '%s: 모든 상태·스타일·스킨에서 금지 요소·SMIL 없음, 조각이 제 그룹 안에',
    (_id, costume) => {
      for (const style of RIG_STYLES)
        for (const state of PYBAEM_STATES)
          for (const skin of PYBAEM_SKINS) {
            const svg = renderToStaticMarkup(
              <PybaemStatic
                state={state}
                style={style}
                costume={costume}
                palette={skinPalette(skin.id)}
                filters={false}
              />,
            );
            expect(svg).not.toMatch(FORBIDDEN);
            expect(svg).not.toMatch(SMIL);
            expect(svg).not.toMatch(/NaN|undefined|Infinity/);
          }
      // 슬롯 위치: 배경 = 리그(root) 밖 앞, 망토 = root 첫 자식(몸 뒤), 안경 = 얼굴 그룹, 모자 = 머리 그룹
      const doc = new DOMParser().parseFromString(
        renderToStaticMarkup(<PybaemStatic costume={costume} />),
        'image/svg+xml',
      );
      const svg = doc.documentElement;
      const root = svg.querySelector('g > g[transform]')!;
      const head = [...root.children].find((el) =>
        el.querySelector(':scope > ellipse[cy="44"]'),
      )!;
      if (costume.bg) {
        const kids = [...svg.children].filter((el) => el.tagName !== 'defs');
        expect(kids[0].tagName).toBe('g');
        expect(kids[0].contains(root)).toBe(false);
      }
      if (costume.cape)
        expect(root.firstElementChild!.getAttribute('fill')).toBe(costume.cape);
      if (costume.glasses)
        expect(
          head.querySelector('g[transform^="translate"] circle[r="8.4"]'),
        ).not.toBeNull();
      if (costume.hat)
        expect(
          head.lastElementChild!.querySelector('path, polygon'),
        ).not.toBeNull();
    },
  );

  it('펫 4종도 금지 요소·SMIL 없음', () => {
    expect(PET_IDS).toHaveLength(4);
    for (const id of PET_IDS) {
      const svg = renderToStaticMarkup(<PetArt id={id} size={48} />);
      expect(svg).not.toMatch(FORBIDDEN);
      expect(svg).not.toMatch(SMIL);
    }
  });

  it('스킨은 코스튬과 섞여도 몸색만 바꾼다 (코스튬 색은 그대로)', () => {
    const all = costumeFromAvatarConfig({
      hat: 'hat_party',
      cape: 'cape_hero',
    });
    for (const skin of PYBAEM_SKINS) {
      const svg = renderToStaticMarkup(
        <PybaemStatic costume={all} palette={skinPalette(skin.id)} />,
      );
      expect(svg).toContain(`fill="${skin.palette.body}"`);
      expect(svg).toContain(`fill="${all.cape}"`);
      expect(svg).toContain('fill="#FF7043"'); // 고깔모자
    }
  });
});

describe('라이브 리그의 첫 렌더 = 정지 그림 (하이드레이션 뒤 바꿔도 같은 모습)', () => {
  const normalize = (s: string) =>
    s
      .replace(
        /(id="|url\(#)[A-Za-z0-9_-]*?(clipL|clipR|mouthClip|boil|sky)/g,
        '$1X$2',
      )
      .replace(/ style="[^"]*"/g, '');
  it.each(DEFS.map(([d, s]) => [d.id, d, s] as const))(
    '%s',
    (_id, def, states) => {
      for (const style of RIG_STYLES) {
        for (const state of [states[0], states[3]]) {
          // 코스튬도 같은 조각 정의(costumes.tsx)로 그려진다 (P9-04, 중복 없음)
          const costume = {
            hat: 'wizard',
            glasses: 'sun',
            cape: '#3E5A99',
            bg: 'paper',
          } as const;
          const live = renderToStaticMarkup(
            <RigView
              def={def}
              state={state}
              style={style}
              size={160}
              framing="stage"
              pokeable={false}
              costume={costume}
            />,
          );
          const still = renderToStaticMarkup(
            <RigStatic
              def={def}
              state={state}
              style={style}
              size={160}
              framing="stage"
              costume={costume}
            />,
          );
          expect(normalize(live)).toBe(normalize(still));
        }
      }
    },
  );
});
