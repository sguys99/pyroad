import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildAchievementBook,
  markClaimed,
  METRIC_HINT,
  SECRET_TEXT,
  summarizeBook,
  type AchievementDef,
} from '../achievementBook';

const def = (
  id: string,
  over: Partial<AchievementDef> = {},
): AchievementDef => ({
  id,
  name: `이름 ${id}`,
  description: `${id} 설명`,
  icon: 'Code',
  tier: 'bronze',
  category: 'learn',
  metric: 'quests',
  sort: 10,
  hidden: false,
  ...over,
});
const AT = '2026-11-10T03:00:00Z';

describe('업적 도감 (P8-10)', () => {
  it('카테고리 순(학습 → … → 실패 칭찬) 다음 sort 순', () => {
    const book = buildAchievementBook(
      [
        def('grit', { category: 'grit', sort: 1 }),
        def('b', { sort: 20 }),
        def('a', { sort: 10 }),
        def('quiz', { category: 'quiz', sort: 5 }),
      ],
      [],
      [],
    );
    expect(book.map((e) => e.id)).toEqual(['a', 'b', 'quiz', 'grit']);
  });

  it('상태: 받음 · 받을 수 있음 · 진행(얻는 법 + n/목표, 목표를 넘지 않음)', () => {
    const book = buildAchievementBook(
      [
        def('got'),
        def('ready', { tier: 'gold' }),
        def('todo', { tier: 'silver', metric: 'stars' }),
      ],
      [
        { achievement_id: 'got', achieved_at: AT, claimed_at: AT },
        { achievement_id: 'ready', achieved_at: AT, claimed_at: null },
      ],
      [
        { achievement_id: 'got', progress: 1, goal: 1 },
        { achievement_id: 'todo', progress: 70, goal: 50 },
      ],
    );
    const [got, ready, todo] = book;
    expect(got).toMatchObject({
      state: 'earned',
      achievedAt: AT,
      progress: null,
    });
    expect(ready).toMatchObject({ state: 'claimable', coins: 100 });
    expect(todo).toMatchObject({
      state: 'locked',
      coins: 30,
      progress: 50,
      goal: 50,
      text: '별을 50개 모아요',
    });
  });

  it('진행도를 못 읽으면 0/0 대신 설명 그대로', () => {
    const [e] = buildAchievementBook([def('x')], [], []);
    expect(e).toMatchObject({
      state: 'locked',
      progress: 0,
      goal: 0,
      text: 'x 설명',
    });
  });

  it('숨김 업적은 얻기 전에 이름·아이콘·조건·진행을 숨기고, 얻으면 보임', () => {
    const hidden = def('level_50', {
      hidden: true,
      name: '정상에 선 코더',
      icon: 'MountainSnow',
      metric: 'level',
      tier: 'gold',
    });
    const progress = [{ achievement_id: 'level_50', progress: 12, goal: 50 }];
    const [secret] = buildAchievementBook([hidden], [], progress);
    expect(secret).toMatchObject({
      state: 'secret',
      name: '???',
      icon: '',
      text: SECRET_TEXT,
      progress: null,
      goal: null,
    });
    expect(JSON.stringify(secret)).not.toMatch(/정상|MountainSnow|레벨/);
    const [shown] = buildAchievementBook(
      [hidden],
      [{ achievement_id: 'level_50', achieved_at: AT, claimed_at: null }],
      progress,
    );
    expect(shown).toMatchObject({ state: 'claimable', name: '정상에 선 코더' });
  });

  it('요약: 얻은 수/전체(숨김 포함) · 티어별 · 받을 코인, 받으면 받을 코인이 줄어듦', () => {
    const book = buildAchievementBook(
      [
        def('a'),
        def('b', { tier: 'silver' }),
        def('c', { tier: 'gold' }),
        def('h', { hidden: true }),
      ],
      [
        { achievement_id: 'a', achieved_at: AT, claimed_at: null },
        { achievement_id: 'c', achieved_at: AT, claimed_at: null },
      ],
      [],
    );
    expect(summarizeBook(book)).toEqual({
      earned: 2,
      total: 4,
      byTier: { bronze: 1, silver: 0, gold: 1 },
      claimable: 2,
      claimableCoins: 110,
    });
    const after = markClaimed(book, new Set(['c']));
    expect(after.find((e) => e.id === 'c')?.state).toBe('earned');
    expect(summarizeBook(after)).toMatchObject({
      earned: 2,
      claimable: 1,
      claimableCoins: 10,
    });
  });

  it('00036 표의 지표는 모두 얻는 법 문구가 있다', () => {
    const sql = readFileSync(
      join(process.cwd(), 'supabase/migrations/00036_achievements.sql'),
      'utf8',
    );
    const metrics = [
      ...sql.matchAll(/^\s+\('[a-z0-9_]+',(?:\s*'[^']*',){5}\s*'([a-z_]+)',/gm),
    ].map((m) => m[1]);
    expect(metrics.length).toBeGreaterThanOrEqual(30);
    expect([...new Set(metrics)].filter((m) => !METRIC_HINT[m])).toEqual([]);
  });
});
