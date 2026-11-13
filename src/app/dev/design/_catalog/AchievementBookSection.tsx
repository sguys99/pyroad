'use client';

import { AchievementBook } from '@/components/achievements/AchievementBook';
import {
  buildAchievementBook,
  type AchievementDef,
} from '@/lib/quest/achievementBook';
import type { ClaimAchievementResult } from '@/lib/quest/achievements';
import { Demo, Section } from './ui';

/** 견본 정의 (00036·00048 표의 실제 행 일부 — 카테고리마다 몇 개, 숨김 level_50 포함) */
const DEFS: AchievementDef[] = [
  ['first_code', '첫 코드', '처음으로 퀘스트를 혼자 풀었어요!', 'Code', 'bronze', 'learn', 'quests', 10],
  ['quests_10', '코드 탐험가', '퀘스트 10개를 혼자 풀었어요.', 'Compass', 'silver', 'learn', 'quests', 20],
  ['quests_30', '코드 모험왕', '퀘스트 30개를 혼자 풀었어요.', 'Mountain', 'gold', 'learn', 'quests', 30],
  ['stage_clear', '스테이지 클리어', '스테이지 하나를 끝까지 깼어요!', 'Flag', 'bronze', 'learn', 'stages', 50],
  ['stars_10', '별 줍기', '별을 10개 모았어요.', 'Star', 'bronze', 'star', 'stars', 110],
  ['stars_150', '은하수 수집가', '별을 150개나 모았어요!', 'Telescope', 'gold', 'star', 'stars', 130],
  ['quiz_1', '첫 퀴즈 정답', '퀴즈를 처음 맞혔어요.', 'BadgeCheck', 'bronze', 'quiz', 'quiz_correct', 210],
  ['streak_7', '일주일 불꽃', '7일 연속으로 공부했어요.', 'Flame', 'silver', 'habit', 'streak', 340],
  ['week2_4', '차곡차곡 공부', '한 주에 2일 이상 공부한 주가 4번이에요.', 'CalendarDays', 'bronze', 'habit', 'weeks_two', 352],
  ['level_10', '레벨 10', '레벨 10이 되었어요.', 'Zap', 'bronze', 'growth', 'level', 510],
  ['level_50', '정상에 선 코더', '가장 높은 레벨 50이 되었어요!', 'MountainSnow', 'gold', 'growth', 'level', 540, true],
  ['error_1', '첫 에러 친구', '에러를 만났지만 포기하지 않고 끝까지 풀었어요!', 'Bug', 'bronze', 'grit', 'errors', 610],
  ['comeback_1', '다시 일어서기', '틀린 퀴즈를 다시 풀어 맞혔어요.', 'Sprout', 'bronze', 'grit', 'quiz_comeback', 640],
  ['hint_finish_10', '힌트로 쑥쑥', '힌트를 보고 퀘스트 10개를 끝까지 해냈어요.', 'Footprints', 'silver', 'grit', 'hint_finish', 670],
].map(([id, name, description, icon, tier, category, metric, sort, hidden]) => ({
  id,
  name,
  description,
  icon,
  tier,
  category,
  metric,
  sort,
  hidden: hidden === true,
})) as AchievementDef[];

const AT = '2026-11-10T03:00:00Z';
/** 얻고 받음 · 얻고 안 받음(반짝임) · 진행 중 · 비밀 */
const OWNED = [
  { achievement_id: 'first_code', achieved_at: AT, claimed_at: AT },
  { achievement_id: 'stage_clear', achieved_at: AT, claimed_at: null },
  { achievement_id: 'quiz_1', achieved_at: AT, claimed_at: AT },
  { achievement_id: 'error_1', achieved_at: AT, claimed_at: null },
  { achievement_id: 'streak_7', achieved_at: AT, claimed_at: null },
];
const GOALS: Record<string, [number, number]> = {
  quests_10: [4, 10],
  quests_30: [4, 30],
  stars_10: [7, 10],
  stars_150: [7, 150],
  week2_4: [2, 4],
  level_10: [6, 10],
  level_50: [6, 50],
  comeback_1: [0, 1],
  hint_finish_10: [3, 10],
};
const PROGRESS = Object.entries(GOALS).map(([id, [progress, goal]]) => ({
  achievement_id: id,
  progress,
  goal,
}));

/** 가짜 받기: 티어 코인만큼 잔액이 오름 (서버 없이 날아가기·카운트업까지) */
function fakeRequest() {
  let balance = 1240;
  const coins: Record<string, number> = { bronze: 10, silver: 30, gold: 100 };
  return async (id: string): Promise<ClaimAchievementResult> => {
    await new Promise((r) => setTimeout(r, 300));
    const tier = DEFS.find((d) => d.id === id)?.tier ?? 'bronze';
    balance += coins[tier];
    return {
      claimed: true,
      already_claimed: false,
      coins_earned: coins[tier],
      coins_balance: balance,
    };
  };
}

export function AchievementBookSection() {
  return (
    <Section
      id="achievements"
      kicker="P8-10"
      title="업적 도감"
      description="/profile/achievements. 얻음(티어 메달·날짜) · 받을 수 있음(반짝 별 + 받기) · 아직(실루엣 + 진행 막대 + 얻는 법) · 비밀(???). 칸을 누르면 상세 시트, 받기는 가짜 요청으로 코인이 위 지갑으로 날아가요."
    >
      <Demo label="도감 (견본 14종)" surface="bg" data-testid="achievement-book-demo">
        <AchievementBook
          entries={buildAchievementBook(DEFS, OWNED, PROGRESS)}
          coins={1240}
          request={fakeRequest()}
          embedded
        />
      </Demo>
    </Section>
  );
}
