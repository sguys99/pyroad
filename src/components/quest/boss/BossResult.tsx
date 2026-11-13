'use client';

import { BookOpen, Map, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RewardIcon } from '@/components/ui/reward-icon';
import { ShareButton } from '@/components/share/ShareButton';
import { levelUpCoinsTotal } from '@/lib/quest/coins';
import type { BossSession } from '@/lib/quest/useBossSession';
import { RewardStrip, useSuccessRun } from '../QuestSuccess';
import { PRACTICE_NOTE } from '../quiz/QuizPanel';

type ResultSession = Pick<
  BossSession,
  | 'boss'
  | 'hearts'
  | 'cleared'
  | 'total'
  | 'reward'
  | 'mode'
  | 'start'
  | 'isSubmitting'
  | 'error'
  | 'quest'
>;

/**
 * 승리 쪽 (P9-12): 보상 띠(별 = 남은 하트 · XP · 코인, 결과 쪽지와 같은 RewardStrip) + 다음 행동.
 * 주 버튼 "다음 스테이지로"(지도: 새로 열린 스테이지 연출) · 자랑하기(스테이지 클리어 카드, P9-10) · 한 번 더(연습)
 */
export function BossWon({
  session: s,
  mapHref,
  stageId,
}: {
  session: ResultSession;
  mapHref: string;
  stageId: string;
}) {
  const r = s.reward;
  // 별 → 숫자 차례 연출 (결과 쪽지와 같은 성공 장면, 누르거나 Enter 로 건너뛰기)
  const done = useSuccessRun(true, r);
  const practice = r?.mode === 'practice';
  const stars = Math.min(3, Math.max(1, r?.stars ?? s.hearts)) as 1 | 2 | 3;
  return (
    <section className="bb-result" data-result="won" data-testid="boss-won">
      <RewardStrip
        done={done}
        reward={{
          title: `${s.boss.name} 격파!`,
          kicker: practice
            ? '연습 승리'
            : r?.already_completed
              ? '복습 승리'
              : '보스 격파',
          xp: r?.xp_gained ?? 0,
          stars,
          newStars: r?.already_completed ? (r?.new_stars ?? 0) : 0,
          // 레벨 업 코인은 레벨 업 카드가 보여 줌 → 띠에는 보스·별 코인만
          coins: (r?.coins_earned ?? 0) - levelUpCoinsTotal(r?.level_ups),
          forceStarsCoins: true,
          review: practice,
          note: practice
            ? `연습이라 별·XP·코인은 그대로예요. ${PRACTICE_NOTE}!`
            : r && r.xp_gained === 0
              ? `지난번 별 ${r.best_stars}개가 그대로 남아요. 하트를 더 남기면 별이 늘어요.`
              : `하트 ${s.hearts}개를 남겨서 별 ${stars}개!`,
          nextHref: mapHref,
          nextLabel: '다음 스테이지로',
          mapHref,
        }}
        actions={
          <div className="bb-result-actions">
            <Button
              size="lg"
              href={mapHref}
              icon={<Map aria-hidden />}
              data-testid="boss-next-stage"
            >
              다음 스테이지로
            </Button>
            <ShareButton kind="stage" cardRef={stageId} testId="boss-share" />
            <Button
              variant="ghost"
              className="bb-ghost"
              onClick={s.start}
              loading={s.isSubmitting}
              icon={<RotateCcw aria-hidden />}
              data-testid="boss-again"
            >
              한 번 더
            </Button>
          </div>
        }
      />
      {s.error && (
        <p className="qz-error" role="alert">
          {s.error}
        </p>
      )}
    </section>
  );
}

/**
 * 패배 쪽 (P9-12): 꾸중 대신 얼마나 왔는지 + 바로 다시 도전(주 버튼) · 복습하러 가기(진 문제의 관련 퀘스트, 없으면 스테이지 목록)
 */
export function BossLost({
  session: s,
  reviewHref,
}: {
  session: ResultSession;
  reviewHref: string;
}) {
  const left = Math.max(0, s.total - s.cleared);
  return (
    <section className="bb-result" data-result="lost" data-testid="boss-lost">
      <div className="bb-result-card">
        <p className="bb-result-k">아깝다!</p>
        <h2 className="bb-result-t font-display" tabIndex={-1}>
          {s.cleared > 0
            ? `보스 HP를 ${s.total}칸 중 ${s.cleared}칸 깎았어요!`
            : '첫 공격이 제일 어려워요!'}
        </h2>
        <p className="bb-result-p">
          {left === 1
            ? '딱 한 문제만 더 맞히면 이겨요. 방금 문제를 떠올리며 다시 도전해 봐요!'
            : '틀린 문제의 해설을 떠올리면 다음엔 더 멀리 갈 수 있어요. 하트는 다시 3개로 채워져요.'}
        </p>
        <div className="bb-result-stars" aria-hidden>
          <RewardIcon kind="starEmpty" size={28} />
          <RewardIcon kind="starEmpty" size={28} />
          <RewardIcon kind="starEmpty" size={28} />
        </div>
      </div>
      {s.error && (
        <p className="qz-error" role="alert">
          {s.error}
        </p>
      )}
      <div className="bb-result-actions">
        <Button
          size="lg"
          onClick={s.start}
          loading={s.isSubmitting}
          icon={<RotateCcw aria-hidden />}
          data-testid="boss-retry"
        >
          다시 도전
        </Button>
        <Button
          size="lg"
          variant="secondary"
          href={reviewHref}
          icon={<BookOpen aria-hidden />}
          data-testid="boss-review"
        >
          복습하러 가기
        </Button>
      </div>
    </section>
  );
}
