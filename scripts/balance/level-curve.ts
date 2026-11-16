/**
 * 레벨 곡선 시뮬레이션 (P8-01, §3 F1). `npm run balance:levels` → docs/balance.md "레벨 곡선" 표를 그대로 출력.
 *
 * 1·2·3월드 모두 content/ 의 실제 퀘스트 XP 로 계산: 코드·프로젝트 = quest_xp(xp_reward, 힌트) (00006),
 * 퀴즈 = 별 × 10 XP (00026, 퀴즈의 xp_reward 는 쓰지 않음), 보스 = 별 × xp_reward/3 (00046).
 * 3월드는 P11-14에서 7 스테이지가 다 차서 "1월드 구성 × 2배" 가정을 실제 콘텐츠로 바꿈.
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
  type: 'code' | 'project' | 'quiz' | 'boss';
  base: number;
}

export function worldQuests(order: number): QuestXp[] {
  const tree = loadContent(resolve(__dirname, '../../content'));
  const world = tree.worlds.find((w) => w.world.order === order);
  if (!world) throw new Error(`${order}월드 콘텐츠가 없음`);
  return world.stages.flatMap((s) =>
    s.quests.map(({ quest }) => ({
      type: quest.quest_type,
      base: quest.xp_reward,
    })),
  );
}

export function worldXp(quests: QuestXp[], s: Scenario, scale = 1): number {
  return quests.reduce(
    (sum, q) =>
      sum +
      (q.type === 'quiz'
        ? s.quizStars * QUIZ_XP_PER_STAR
        : q.type === 'boss'
          ? // 00046: 별(남은 하트) × xp_reward/3. 별은 퀴즈 첫 판정과 같다고 가정
            s.quizStars * Math.round((q.base * scale) / 3)
          : calculateXP(Math.round(q.base * scale), s.hints)),
    0,
  );
}

export interface WorldPlan {
  quests: QuestXp[];
  scale: number;
}

/** 1·2·3월드 실제 콘텐츠 */
export function defaultWorlds(): WorldPlan[] {
  return [1, 2, 3].map((order) => ({ quests: worldQuests(order), scale: 1 }));
}

/** 시나리오별 월드 끝 누적 XP·레벨 */
export function simulate(plans: WorldPlan[] = defaultWorlds()) {
  return SCENARIOS.map((s) => {
    let total = 0;
    const worlds = plans.map(({ quests, scale }) => {
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

function summary(name: string, quests: QuestXp[]): string {
  const count = (t: QuestXp['type']) => quests.filter((q) => q.type === t);
  const base = quests
    .filter((q) => q.type === 'code' || q.type === 'project')
    .reduce((a, q) => a + q.base, 0);
  return `${name}: 코드 ${count('code').length} · 프로젝트 ${count('project').length} · 퀴즈 ${count('quiz').length} · 보스 ${count('boss').length}개, 코드·프로젝트 기본 XP 합 ${base} · 보스 별 3개 XP 합 ${count('boss').reduce((a, q) => a + q.base, 0)}`;
}

function main() {
  const plans = defaultWorlds();
  const out: string[] = [];
  out.push(
    `- ${summary('1월드', plans[0].quests)}`,
    `- ${summary('2월드', plans[1].quests)}`,
    `- ${summary('3월드', plans[2].quests)}`,
    '',
    '| 시나리오 | 1월드 XP | 1월드 Lv | 2월드 XP | 2월드까지 XP | Lv | 3월드까지 XP | Lv |',
    '|---|---|---|---|---|---|---|---|',
  );
  for (const { scenario, worlds } of simulate(plans)) {
    const [w1, w2, w3] = worlds;
    out.push(
      `| ${scenario.name} | ${w1.total} | ${w1.level} | ${w2.total - w1.total} | ${w2.total} | ${w2.level} | ${w3.total} | ${w3.level} |`,
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
