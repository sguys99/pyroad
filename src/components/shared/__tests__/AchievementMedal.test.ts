import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ACHIEVEMENT_ICONS } from '../AchievementMedal';

// 업적 표(00036)의 아이콘 이름이 모두 화면 아이콘 표에 있는지 (없으면 메달 모양으로 대신 그려져 티가 안 남)
describe('업적 아이콘 (P8-09)', () => {
  it('00036 achievements.icon 은 모두 ACHIEVEMENT_ICONS 에 있다', () => {
    const sql = readFileSync(
      join(process.cwd(), 'supabase/migrations/00036_achievements.sql'),
      'utf8',
    );
    const icons = [
      ...sql.matchAll(
        /^\s+\('[a-z0-9_]+',\s*'[^']*',\s*'[^']*',\s*'([A-Za-z]+)'/gm,
      ),
    ].map((m) => m[1]);
    expect(icons.length).toBeGreaterThanOrEqual(30);
    expect(icons.filter((i) => !ACHIEVEMENT_ICONS[i])).toEqual([]);
  });
});
