'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BADGE_FIRST_AT_S, BADGE_STAGGER_S } from '@/lib/celebration/plan';
import {
  TIER_LABEL,
  type AchievementInfo,
  type ClaimAchievementResult,
} from '@/lib/quest/achievements';
import { useSfx } from '@/components/providers/soundContext';
import { RewardIcon } from '@/components/ui/reward-icon';
import { AchievementGlyph } from '@/components/shared/AchievementMedal';
import { CelebrationCta, Kicker, delayStyle } from './parts';
import { CelebrationShare } from './CelebrationShare';

const TIER_RANK = { bronze: 1, silver: 2, gold: 3 } as const;

const CLAIM_ERROR = '코인을 받지 못했어요. 다음에 다시 받을 수 있어요.';

async function requestClaim(id: string): Promise<ClaimAchievementResult> {
  const res = await fetch('/api/achievements/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });
  const body = await res.json().catch(() => null);
  // 401(로그인 끊김)의 영어 오류 문구는 보여 주지 않음
  if (!res.ok)
    throw new Error((res.status !== 401 && body?.error) || CLAIM_ERROR);
  return body as ClaimAchievementResult;
}

interface BadgesCardProps {
  badges: AchievementInfo[];
  onNext: () => void;
  /** 받기 요청 (기본 `/api/achievements/claim`. 카탈로그·테스트용) */
  request?: (id: string) => Promise<ClaimAchievementResult>;
}

/**
 * 업적 묶음 (P6-13 → P8-09): 이번에 얻은 업적을 한 카드에 티어 색 메달(브론즈·실버·골드)로 차례로 톡톡. 컨페티는 묶음에 한 번만.
 * 효과음은 메달이 튈 때마다 음을 올려(시퀀서 `sfxSchedule`).
 * 코인은 "받기"로 (§12-Q62 ③): 카드의 "코인 N개 받기"가 모두 받음(효과음 `coin` + HUD 새로 고침). "나중에"로 넘겨도
 * 업적은 기록돼 있어 다음에 받을 수 있음 (자동 넘김 없음)
 */
export function BadgesCard({
  badges,
  onNext,
  request = requestClaim,
}: BadgesCardProps) {
  const router = useRouter();
  const play = useSfx();
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [got, setGot] = useState(0);
  const single = badges.length === 1;
  const total = badges.reduce((n, b) => n + b.coins, 0);
  // 여러 개면 가장 높은 티어(같으면 먼저 얻은 것) 한 장을 자랑 (P9-10)
  const proud = badges.reduce((a, b) =>
    TIER_RANK[b.tier] > TIER_RANK[a.tier] ? b : a,
  );

  const claim = async () => {
    setState('busy');
    setError(null);
    try {
      const res = await Promise.all(badges.map((b) => request(b.id)));
      const coins = res.reduce((n, r) => n + r.coins_earned, 0);
      setGot(coins);
      setState('done');
      if (coins > 0) play('coin');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : CLAIM_ERROR);
      setState('idle');
    }
  };

  return (
    <>
      <div className="cel-head">
        <Kicker gold>
          {single ? '새 업적' : `새 업적 ${badges.length}개`}
        </Kicker>
        <h2 id="celebration-title" className="cel-t font-display">
          {single ? badges[0].name : '업적을 모았어요'}
        </h2>
      </div>

      <ul className="cel-medals" data-many={single ? undefined : ''}>
        {badges.map((badge, i) => {
          const at = Math.round(
            (BADGE_FIRST_AT_S + i * BADGE_STAGGER_S) * 1000,
          );
          return (
            <li
              key={badge.id}
              className="cel-medal-item"
              data-testid="achievement-medal"
              data-achievement={badge.id}
            >
              <span
                className="cel-medal cel-pop"
                data-size={single ? 'l' : undefined}
                data-tier={badge.tier}
                style={delayStyle(at)}
                aria-hidden
              >
                <AchievementGlyph icon={badge.icon} />
              </span>
              {!single && <p className="cel-medal-name">{badge.name}</p>}
              <p className="cel-medal-desc">
                <span className="cel-medal-tier" data-tier={badge.tier}>
                  {TIER_LABEL[badge.tier]}
                </span>{' '}
                {badge.description}
              </p>
            </li>
          );
        })}
      </ul>

      {state === 'done' && (
        <p className="cel-gains" role="status">
          <span className="cel-gain">
            <RewardIcon kind="coin" size={24} />
            {got > 0 ? (
              <>
                <b>+{got}</b> 코인을 받았어요!
              </>
            ) : (
              '이미 받은 코인이에요'
            )}
          </span>
        </p>
      )}
      {error && (
        <p className="cel-sub" role="alert">
          {error}
        </p>
      )}

      <div className="cel-actions">
        {state === 'done' ? (
          <>
            <CelebrationCta onClick={onNext}>좋아요!</CelebrationCta>
            <CelebrationShare kind="achievement" cardRef={proud.id} />
          </>
        ) : (
          <>
            <CelebrationCta
              testId="achievement-claim"
              variant="reward"
              loading={state === 'busy'}
              icon={<RewardIcon kind="coin" size={22} />}
              onClick={claim}
            >
              코인 {total}개 받기
            </CelebrationCta>
            {/* 받기에 실패하면 "나중에"로 포커스 → Enter 로 넘길 수 있음 */}
            <CelebrationCta variant="ghost" focus={!!error} onClick={onNext}>
              나중에 받을래요
            </CelebrationCta>
            <CelebrationShare kind="achievement" cardRef={proud.id} />
          </>
        )}
      </div>
    </>
  );
}
