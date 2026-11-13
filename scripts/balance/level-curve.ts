/**
 * 레벨 곡선 시뮬레이션 (P8-01, §3 F1). `npm run balance:levels` → docs/balance.md "레벨 곡선" 표를 그대로 출력.
 *
 * 1월드는 content/ 의 실제 퀘스트 XP 로 계산: 코드·프로젝트 = quest_xp(xp_reward, 힌트) (00006),
 * 퀴즈 = 별 × 10 XP (00026, 퀴즈의 xp_reward 는 쓰지 않음). 2·3월드는 콘텐츠가 아직 없어
 * "1월드와 같은 퀘스트 구성 × 기본 XP 배율" 로 가정한다 (WORLD_XP_SCALE, 문서에 명시).
 */
import { resolve } from 'node:path';
import { loadContent } from '@/lib/content/load';
import {
  LEVEL_THRESHOLDS,
  MAX_LEVEL,
  calculateLevel,
  calculateXP,
  levelUpCoins,
} from '@/lib/quest/xp';

/** 00026 submit_quiz_answer: 별 1개당 10 XP */
export const QUIZ_XP_PER_STAR = 10;
/** 가정: 2월드(응용) 퀘스트 기본 XP는 1월드의 1.5배, 3월드(만들기)는 2배. 퀘스트 수는 1월드와 같음 */
export const WORLD_XP_SCALE = [1, 1.5, 2] as const;

export interface Scenario {
  name: string;
  hints: number;
  quizStars: number;
}
export const SCENARIOS: Scenario[] = [
  { name: '꼼꼼이 (힌트 0 · 퀴즈 첫 시도)', hints: 0, quizStars: 3 },
  { name: '보통 (힌트 1 · 퀴즈 두 번째)', hints: 1, quizStars: 2 },
  { name: '보통 + 퀴즈 복습 (다음 날 ⭐⭐⭐로 채움)', hints: 1, quizStars: 3 },
  { name: '힌트 많이 (힌트 2+ · 퀴즈 세 번째)', hints: 2, quizStars: 1 },
];

export interface QuestXp {
  type: 'code' | 'project' | 'quiz';
  base: number;
}

export function world1Quests(): QuestXp[] {
  const tree = loadContent(resolve(__dirname, '../../content'));
  const world = tree.worlds.find((w) => w.world.order === 1);
  if (!world) throw new Error('1월드 콘텐츠가 없음');
  return world.stages.flatMap((s) =>
    // shortcut: 보스(P9-12)는 빼고 셈 (docs/balance.md 3.14). 보스 7종(P9-13) 뒤 모델에 넣기
    s.quests.flatMap(({ quest }) =>
      quest.quest_type === 'boss'
        ? []
        : [{ type: quest.quest_type, base: quest.xp_reward }],
    ),
  );
}

export function worldXp(quests: QuestXp[], s: Scenario, scale = 1): number {
  return quests.reduce(
    (sum, q) =>
      sum +
      (q.type === 'quiz'
        ? s.quizStars * QUIZ_XP_PER_STAR
        : calculateXP(Math.round(q.base * scale), s.hints)),
    0,
  );
}

/** 시나리오별 월드 끝 누적 XP·레벨 */
export function simulate(
  quests: QuestXp[],
  scales: readonly number[] = WORLD_XP_SCALE,
) {
  return SCENARIOS.map((s) => {
    let total = 0;
    const worlds = scales.map((scale) => {
      total += worldXp(quests, s, scale);
      return { total, level: calculateLevel(total) };
    });
    return { scenario: s, worlds };
  });
}

/** Lv 30 → 50 에 필요한 XP 와 하루 XP 별 걸리는 날 */
export function tailDays(dailyXp: number): number | null {
  const need = LEVEL_THRESHOLDS[MAX_LEVEL - 1] - LEVEL_THRESHOLDS[29];
  return dailyXp > 0 ? Math.ceil(need / dailyXp) : null;
}

function main() {
  const quests = world1Quests();
  const count = (t: QuestXp['type']) => quests.filter((q) => q.type === t);
  const base = quests
    .filter((q) => q.type !== 'quiz')
    .reduce((a, q) => a + q.base, 0);
  const out: string[] = [];
  out.push(
    `1월드: 코드 ${count('code').length} · 프로젝트 ${count('project').length} · 퀴즈 ${count('quiz').length}개, 코드·프로젝트 기본 XP 합 ${base}`,
    '',
    '| 시나리오 | 1월드 XP | 1월드 Lv | 2월드까지 XP | Lv | 3월드까지 XP | Lv |',
    '|---|---|---|---|---|---|---|',
  );
  for (const { scenario, worlds } of simulate(quests)) {
    out.push(
      `| ${scenario.name} | ${worlds.map((w) => `${w.total} | ${w.level}`).join(' | ')} |`,
    );
  }
  out.push('', '같은 구성·같은 기본 XP(배율 1)라면:', '');
  for (const { scenario, worlds } of simulate(quests, [1, 1, 1])) {
    out.push(
      `- ${scenario.name}: Lv ${worlds.map((w) => w.level).join(' → ')}`,
    );
  }
  out.push(
    '',
    '| 레벨 | 문턱 XP | 다음까지 | 레벨 업 코인 |',
    '|---|---|---|---|',
  );
  for (let l = 1; l <= MAX_LEVEL; l++) {
    const next =
      l < MAX_LEVEL ? LEVEL_THRESHOLDS[l] - LEVEL_THRESHOLDS[l - 1] : '-';
    out.push(
      `| ${l} | ${LEVEL_THRESHOLDS[l - 1]} | ${next} | ${levelUpCoins(l)} |`,
    );
  }
  out.push(
    '',
    `Lv 30 → 50: ${LEVEL_THRESHOLDS[MAX_LEVEL - 1] - LEVEL_THRESHOLDS[29]} XP`,
  );
  for (const d of [0, 30, 45, 60, 90]) {
    const days = tailDays(d);
    out.push(
      `- 하루 ${d} XP: ${days === null ? '닿지 않음' : `${days}일 (약 ${Math.round(days / 30)}개월)`}`,
    );
  }
  console.log(out.join('\n'));
}

if (require.main === module) main();
