'use client';

import { useMemo } from 'react';

import { LearningCalendar } from '@/components/profile/LearningCalendar';
import {
  AchievementsCard,
  ProfileHero,
  ProfileStatsCard,
  TreasureCard,
} from '@/components/profile/ProfileSections';
import type { ProfileStatsRaw } from '@/lib/profile/profileStats';
import { LEVEL_THRESHOLDS } from '@/lib/quest/xp';
import { addKstDays, kstToday } from '@/lib/time/kst';
import { Demo, Section } from './ui';

/** 오늘에서 거꾸로 센 날 → 푼 수 (잔디 견본: 지난달까지 이어지게) */
const SAMPLE_SOLVED: [daysAgo: number, solved: number][] = [
  [0, 2], [1, 5], [2, 1], [4, 3], [5, 1], [6, 2], [9, 4], [10, 1], [12, 2],
  [15, 6], [16, 1], [20, 2], [24, 1], [27, 3], [31, 2], [33, 1], [38, 4],
];

const STATS: ProfileStatsRaw = {
  stats: {
    quests: 27,
    no_hint: 18,
    stars: 64,
    three_stars: 15,
    quiz_correct: 9,
    reviews: 6,
    streak: 8,
    errors: 11,
    chests: 2,
    attendance: 21,
  },
  quiz_tries: 14,
  quiz_right: 10,
  streak: 3,
  shields: 1,
  days: {},
  shield_days: [],
  stamp_days: [],
  coins_week: 85,
};

const STAGES = [
  { id: 's1', order: 1, title: '파이썬 마을 입구', stars: 27, maxStars: 30, chest: 'opened', locked: false },
  { id: 's2', order: 2, title: '변수의 숲', stars: 21, maxStars: 30, chest: 'opened', locked: false },
  { id: 's3', order: 3, title: '조건의 갈림길', stars: 16, maxStars: 30, chest: 'ready', locked: false },
  { id: 's4', order: 4, title: '반복의 동굴', stars: 0, maxStars: 33, chest: 'none', locked: true },
] as const;

/** 프로필 (P8-13): 머리(보통·큰 칭호·최고 레벨) · 학습 달력(잔디·방패·출석·빈 달) · 모험 기록 · 업적 · 별과 보물 */
export function ProfileSection() {
  const today = kstToday();
  const cal = useMemo(() => {
    const days = Object.fromEntries(
      SAMPLE_SOLVED.map(([ago, n]) => [addKstDays(today, -ago), n]),
    );
    return {
      days,
      shieldDays: [addKstDays(today, -3), addKstDays(today, -11)],
      stampDays: [0, 1, 2, 3, 4, 6, 9, 10, 12, 15].map((d) =>
        addKstDays(today, -d),
      ),
    };
  }, [today]);

  return (
    <Section
      id="profile"
      kicker="재미 요소 (P8-13)"
      title="프로필"
      description="본인만 보는 성장 기록. 360은 한 열, 768부터 두 열 카드. 초록은 학습(레벨 도장·잔디), 금색은 보상(칭호 도장·별·코인·출석). 반복 연출 없음 — 정보는 글자와 낭독 이름으로도."
    >
      <div className="pf">
        <ProfileHero name="코딩하는 다람쥐" skin="green" totalXp={1500} />
        <Demo
          label="5레벨마다 큰 칭호 · 최고 레벨"
          note="Lv 10 = 금색 레벨 도장 + 금색 면 칭호 도장(레벨업 카드와 같은 톤), Lv 50은 '최고 레벨에 닿았어요!'"
          className="pf-wide"
        >
          <div className="pf">
            <ProfileHero name="섬마을 영웅" skin="green" totalXp={LEVEL_THRESHOLDS[9] + 300} />
            <ProfileHero name="전설" skin="green" totalXp={LEVEL_THRESHOLDS[49] + 10} />
          </div>
        </Demo>
        <Demo
          label="학습 달력"
          note="그날 푼 퀘스트 수만큼 진한 초록(1 · 2~3 · 4+), 방패로 지킨 날은 방패, 출석 도장은 아래 금색 점, 오늘은 테두리. 칸 낭독 '11월 12일, 퀘스트 3개, 출석 도장'. 이전·다음 달은 첫 기록 달 ~ 이번 달(최대 12개월)"
          surface="card"
          data-testid="profile-calendar-demo"
        >
          <LearningCalendar today={today} {...cal} />
        </Demo>
        <Demo label="기록이 없는 달력" note="이번 달 하나, 이전·다음 달 버튼 꺼짐, 응원 한 줄" surface="card">
          <LearningCalendar today={today} days={{}} shieldDays={[]} stampDays={[]} />
        </Demo>
        <ProfileStatsCard raw={STATS} />
        <ProfileStatsCard raw={{ ...STATS, quiz_tries: 0, quiz_right: 0, stats: { ...STATS.stats, quiz_correct: 0 } }} />
        <AchievementsCard
          earned={12}
          total={42}
          claimable={2}
          recent={[
            { id: 'a', name: '첫 에러 친구', icon: 'Bug', tier: 'bronze', achievedAt: `${today}T03:00:00Z` },
            { id: 'b', name: '코드 탐험가', icon: 'Compass', tier: 'silver', achievedAt: `${today}T02:00:00Z` },
            { id: 'c', name: '별 세 개 단골', icon: 'Gem', tier: 'gold', achievedAt: `${today}T01:00:00Z` },
          ]}
        />
        <TreasureCard coins={1280} coinsWeek={85} threeStars={15} stages={[...STAGES]} />
      </div>
    </Section>
  );
}
