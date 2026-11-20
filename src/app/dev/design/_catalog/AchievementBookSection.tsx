'use client';

import { AchievementBook } from '@/components/achievements/AchievementBook';
import {
  buildAchievementBook,
  type AchievementDef,
} from '@/lib/quest/achievementBook';
import type { ClaimAchievementResult } from '@/lib/quest/achievements';
import { Demo, Section } from './ui';

/** 견본 정의 (00036·00048·00053 표의 실제 행 일부 — 카테고리마다 몇 개, 숨김 level_50·sea_perfect, 코인 0 배지 skill_pass 포함) */
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
  ['skill_pass', '실력 인정', '실력 확인 퀴즈에 합격해 코드 바다로 바로 떠났어요!', 'ClipboardCheck', 'silver', 'sea', 'skill_pass', 710, false, 0],
  ['sea_stage_1', '첫 항해', '코드 바다의 스테이지 하나를 끝까지 깼어요!', 'Sailboat', 'bronze', 'sea', 'sea_stages', 720],
  ['sea_boss_1', '바다 보스 첫 승리', '코드 바다 보스를 처음으로 이겼어요!', 'Anchor', 'bronze', 'sea', 'sea_bosses', 730],
  ['sea_bug_doctor', '버그 병원선 명의', '버그 병원선의 코드 퀘스트를 모두 힌트 없이 고쳤어요!', 'Stethoscope', 'silver', 'sea', 'sea_bug_fix', 740],
  ['sea_captain', '코드 바다 선장', '버그버그 선장을 이기고 코드 바다를 끝까지 항해했어요!', 'ShipWheel', 'silver', 'sea', 'sea_clear', 750],
  ['sea_bosses_all', '일곱 바다의 용사', '코드 바다 보스를 모두 이겼어요!', 'Waves', 'gold', 'sea', 'sea_bosses', 760],
  ['sea_perfect', '완벽한 바다', '코드 바다의 모든 퀘스트와 퀴즈에서 별 3개를 받았어요!', 'Shell', 'gold', 'sea', 'sea_perfect', 770, true],
  ['maker_first_save', '첫 작품', '내 작품을 처음으로 저장했어요!', 'Palette', 'bronze', 'maker', 'maker_saves', 810],
  ['turtle_painter', '거북이 화가', '거북이 화가 공방을 끝까지 깼어요!', 'Brush', 'silver', 'maker', 'maker_turtle', 840],
  ['maker_citizen', '메이커 시티 명예 시민', '메가 로봇 버그버그를 이기고 메이커 시티를 끝까지 깼어요!', 'Building2', 'gold', 'maker', 'maker_clear', 870],
  ['perfect_city', '완벽한 도시', '메이커 시티의 모든 퀘스트와 퀴즈에서 별 3개를 받았어요!', 'Landmark', 'gold', 'maker', 'maker_perfect', 880, true],
  ['cheer_leader', '응원 단장', '친구 작품 5개에 스티커로 응원했어요!', 'HandHeart', 'bronze', 'maker', 'maker_cheers', 890, false, 0],
].map(([id, name, description, icon, tier, category, metric, sort, hidden, coins]) => ({
  id,
  name,
  description,
  icon,
  tier,
  category,
  metric,
  sort,
  hidden: hidden === true,
  coins: typeof coins === 'number' ? coins : null,
})) as AchievementDef[];

const AT = '2026-11-10T03:00:00Z';
/** 얻고 받음 · 얻고 안 받음(반짝임) · 진행 중 · 비밀 */
const OWNED = [
  { achievement_id: 'first_code', achieved_at: AT, claimed_at: AT },
  { achievement_id: 'stage_clear', achieved_at: AT, claimed_at: null },
  { achievement_id: 'quiz_1', achieved_at: AT, claimed_at: AT },
  { achievement_id: 'error_1', achieved_at: AT, claimed_at: null },
  { achievement_id: 'streak_7', achieved_at: AT, claimed_at: null },
  // 코인 0 배지는 얻는 순간 받은 것으로 (00053)
  { achievement_id: 'skill_pass', achieved_at: AT, claimed_at: AT },
  { achievement_id: 'sea_stage_1', achieved_at: AT, claimed_at: null },
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
  sea_boss_1: [0, 1],
  sea_bug_doctor: [5, 7],
  sea_captain: [0, 1],
  sea_bosses_all: [2, 7],
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
    const d = DEFS.find((x) => x.id === id);
    const got = d?.coins ?? coins[d?.tier ?? 'bronze'];
    balance += got;
    return {
      claimed: true,
      already_claimed: false,
      coins_earned: got,
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
      description="/profile/achievements. 분류 진열장(P13-23): 칸에 면 없이 메달 + 이름 + 상태 한 줄 — 얻음(티어 메달·날짜) · 받을 수 있음(반짝 점 Glint + 받기) · 아직(실루엣 + 진행 막대 + 수치) · 비밀(???). 분류 사이는 여백 + 1px 선, 900px부터 분류 제목·소개가 왼쪽 열에 붙어 따라옴, 면은 실패 칭찬(옅은 초록)만. 코드 바다 절(돛단배 소개 줄, P10-11 — 실력 인정은 코인 없는 배지라 받기 없이 바로 얻음). 칸을 누르면 상세 시트, 받기는 가짜 요청으로 코인이 위 지갑으로 날아가요."
    >
      <Demo label="도감 (견본 21종)" surface="bg" data-testid="achievement-book-demo">
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
