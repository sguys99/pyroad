import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  BUGBUG_STATES,
  BYEOLTTONGI_STATES,
  PYBAEM_STATES,
} from '@/components/characters/rig';
import { SFX_USES } from '@/lib/sound/manifest';
import { createReactionCycle, FRIENDS } from '../sections/friends/friends';
import { FriendsSection } from '../sections/FriendsSection';

const SFX_IDS = Object.keys(SFX_USES);

// 랜딩 세 친구 (P4-06): 반응 데이터가 리그 상태·효과음과 맞고, 서버 HTML에 이름·역할·정지 그림·버튼이 있다

const STATES: Record<string, readonly string[]> = {
  pybaem: PYBAEM_STATES,
  bugbug: BUGBUG_STATES,
  byeolttongi: BYEOLTTONGI_STATES,
};

describe('세 친구 데이터', () => {
  it('파이뱀 · 버그버그 · 별똥이 순서', () => {
    expect(FRIENDS.map((f) => f.name)).toEqual([
      '파이뱀',
      '버그버그',
      '별똥이',
    ]);
  });

  it('인사·반응 상태가 그 캐릭터 리그에 있고, 효과음이 매니페스트에 있다', () => {
    for (const f of FRIENDS) {
      const states = STATES[f.id];
      expect(states).toContain(f.greet.state);
      expect(f.reactions.length).toBeGreaterThanOrEqual(3);
      for (const r of f.reactions) {
        expect(states).toContain(r.state);
        expect(SFX_IDS).toContain(r.sfx);
        expect(r.hold).toBeGreaterThan(500);
      }
    }
  });

  it('아직 없는 보상(코인)·싸움 포즈는 쓰지 않는다', () => {
    const used = FRIENDS.flatMap((f) => [
      f.greet.state as string,
      ...f.reactions.map((r) => r.state as string),
    ]);
    for (const s of ['give', 'attack', 'defeat', 'sad', 'sleep'])
      expect(used).not.toContain(s);
    const text = FRIENDS.flatMap((f) => [
      f.role,
      f.hello,
      ...f.reactions.map((r) => r.line),
    ]).join(' ');
    expect(text).not.toMatch(/코인|뽑기|결제/);
  });

  it('대사는 말풍선 자리(두세 줄)에 들어갈 만큼 짧다', () => {
    for (const f of FRIENDS)
      for (const line of [f.hello, ...f.reactions.map((r) => r.line)])
        expect([...line].length).toBeLessThanOrEqual(24);
  });

  it('반응은 순서대로 돌고 같은 반응이 연달아 나오지 않는다', () => {
    for (const f of FRIENDS) {
      const cycle = createReactionCycle(f.reactions);
      const seen = Array.from({ length: f.reactions.length * 2 + 1 }, () =>
        cycle.next(),
      );
      expect(seen.slice(0, f.reactions.length)).toEqual([...f.reactions]);
      expect(seen[f.reactions.length]).toBe(f.reactions[0]);
      for (let i = 1; i < seen.length; i++)
        expect(
          seen[i].state === seen[i - 1].state &&
            seen[i].line === seen[i - 1].line,
        ).toBe(false);
    }
  });
});

describe('세 친구 서버 HTML', () => {
  const html = renderToStaticMarkup(<FriendsSection />);

  it('섹션 앵커·제목 id가 정해진 값이다', () => {
    expect(html).toMatch(/<section[^>]*id="friends"/);
    expect(html).toContain('id="friends-title"');
  });

  it('이름(h3)·역할·첫 말풍선이 처음부터 보이는 상태다 (opacity 0 없음)', () => {
    for (const f of FRIENDS) {
      expect(html).toContain(`>${f.name}</h3>`);
      expect(html).toContain(f.role);
      expect(html).toContain(f.hello);
    }
    expect(html).not.toMatch(/opacity:\s*0[;"]/);
  });

  it('캐릭터는 정지 그림(장식) + 이름 붙은 버튼으로 그린다', () => {
    for (const f of FRIENDS)
      expect(html).toMatch(
        new RegExp(
          `<button[^>]*aria-label="${f.name} 콕 누르기"[^>]*data-testid="friend-${f.id}-btn"`,
        ),
      );
    expect(html.match(/class="ld-friends-svg"/g)).toHaveLength(3);
    // 정지 그림 id가 히어로 파이뱀과 겹치지 않는다
    expect(html).toContain('ldfr-py-');
    expect(html).toContain('ldfr-bug-');
    expect(html).toContain('ldfr-star-');
  });
});
