'use client';

import { RewardIcon } from '@/components/ui/reward-icon';
import { withObjectParticle } from '@/lib/korean';
import type { QuestKind } from '@/lib/quest/questKind';
import { CelebrationCta, Kicker } from './parts';

interface GoldenKeyCardProps {
  kind: QuestKind;
  questTitle: string;
  onNext: () => void;
}

/**
 * 황금키로 연 퀘스트 (P1-09 → P6-13): XP가 0이므로 큰 축하 대신 가벼운 확인. 컨페티·캐릭터 점프 없이 금색 메달 안
 * 열쇠가 한 번 돌아가는 연출만. 정답 코드를 읽어 보도록 권한다 (§2.6: 보상은 학습 행동에만)
 */
export function GoldenKeyCard({
  kind,
  questTitle,
  onNext,
}: GoldenKeyCardProps) {
  return (
    <>
      <span className="cel-medal cel-turn" data-size="l" aria-hidden>
        <RewardIcon kind="key" size={44} />
      </span>

      <div className="cel-head">
        <Kicker gold>황금키</Kicker>
        <h2 id="celebration-title" className="cel-t font-display" data-size="m">
          황금키로 문을 열었어요
        </h2>
      </div>
      <p className="cel-sub">
        {kind === 'project'
          ? `황금키의 도움으로 ${withObjectParticle(questTitle)} 끝까지 해냈어요. 정답 코드를 한 줄씩 살펴봐요!`
          : '정답 코드를 한 줄씩 읽어 보면 다음에는 혼자서도 열 수 있어요!'}
      </p>
      <p className="cel-slip-k">황금키로 연 퀘스트는 XP와 뱃지 없이 완료돼요</p>

      <div className="cel-actions">
        <CelebrationCta onClick={onNext}>알겠어요</CelebrationCta>
      </div>
    </>
  );
}
