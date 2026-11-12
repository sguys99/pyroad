'use client';

import { useState } from 'react';
import { Trophy } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { RewardIcon } from '@/components/ui/reward-icon';
import type { RetroWelcome } from '@/lib/world/mapData';
import './attendance.css';
import './retroWelcome.css';

async function dismissRetro() {
  await fetch('/api/retro/seen', { method: 'POST' }).catch(() => null);
}

interface RetroWelcomeCardProps {
  retro: RetroWelcome;
  /** 코인을 아직 안 받은 업적 수 (소급 판정분 포함) → 도감 바로 가기 */
  achievementsReady: number;
  /** 닫기 요청 (기본 `/api/retro/seen`. 카탈로그·테스트용) */
  onDismiss?: () => Promise<void> | void;
}

/**
 * "그동안의 모험 보상" 환영 카드 (P8-11). 새 보상 규칙 전에 모험한 사용자가 소급으로 받은 별 보상·코인을 한 번 알려 줌.
 * 코인은 이미 잔액(HUD)에 들어가 있어 받기 버튼 없이 "좋아요!"로 닫음 → 서버에 본 기록(seen_at), 다음 방문부터 안 보임.
 * 소급 판정한 업적은 축하 카드 없이 도감 "받기 가능"으로만 있으므로 그 수를 한 줄로 알려 도감으로 보냄.
 * 출석 카드와 같은 쪽지 모양(`.at`, 위 금색 띠)이고 출석 카드 위에 놓임
 */
export function RetroWelcomeCard({
  retro,
  achievementsReady,
  onDismiss = dismissRetro,
}: RetroWelcomeCardProps) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  const close = () => {
    setHidden(true);
    void onDismiss();
  };

  return (
    <section
      className="at rw"
      aria-labelledby="retro-title"
      data-testid="retro-welcome"
    >
      <div className="at-head">
        <span className="at-k">그동안의 모험 보상</span>
        <h2 id="retro-title" className="at-t font-display">
          지난 모험도 보상으로 바꿔 왔어요!
        </h2>
      </div>
      <ul className="rw-stats">
        {retro.stars > 0 && (
          <li>
            <RewardIcon kind="star" size={26} />
            <span className="font-display tabular-nums">{retro.stars}</span>
            <span className="rw-l">별 보상</span>
          </li>
        )}
        <li>
          <RewardIcon kind="coin" size={26} />
          <span className="font-display tabular-nums">
            +{retro.coins.toLocaleString('ko-KR')}
          </span>
          <span className="rw-l">코인</span>
        </li>
      </ul>
      <div className="at-foot">
        <p className="at-note">
          {achievementsReady > 0 ? (
            <>
              <Trophy size={18} aria-hidden />
              <span>
                받을 수 있는 업적이 {achievementsReady}개 있어요 (업적 도감)
              </span>
            </>
          ) : (
            <span>코인은 벌써 지갑에 들어갔어요</span>
          )}
        </p>
        <div className="rw-acts">
          {achievementsReady > 0 && (
            <Button
              variant="secondary"
              size="sm"
              href="/profile/achievements"
              onClick={close}
            >
              업적 보러 가기
            </Button>
          )}
          <Button
            variant="reward"
            size="sm"
            onClick={close}
            data-testid="retro-close"
          >
            좋아요!
          </Button>
        </div>
      </div>
    </section>
  );
}
