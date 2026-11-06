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
  PYBAEM_STATES,
  PybaemStatic,
  RIG_STYLES,
  RigStatic,
  type RigDef,
} from '..';
import { RigView } from '../LiveRig';
import { PybaemSvg } from '../../PybaemSvg';
import type { PybaemExpression } from '../../expressions';

const FORBIDDEN = /<(text|foreignObject|image|tspan|use)\b/i;
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

  it('B·A×B 종이 결 필터는 filters={false}(작은 아바타·lite 이하)면 빠진다', () => {
    expect(renderToStaticMarkup(<PybaemStatic style="B" />)).toContain(
      '<filter',
    );
    expect(
      renderToStaticMarkup(<PybaemStatic style="B" filters={false} />),
    ).not.toContain('<filter');
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
          const live = renderToStaticMarkup(
            <RigView
              def={def}
              state={state}
              style={style}
              size={160}
              framing="stage"
              pokeable={false}
            />,
          );
          const still = renderToStaticMarkup(
            <RigStatic
              def={def}
              state={state}
              style={style}
              size={160}
              framing="stage"
            />,
          );
          expect(normalize(live)).toBe(normalize(still));
        }
      }
    },
  );
});
