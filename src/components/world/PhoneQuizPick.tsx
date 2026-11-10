'use client';

import { useEffect } from 'react';
import {
  Bug,
  ListChecks,
  ListOrdered,
  Smartphone,
  Star,
  TextCursorInput,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { QuizKind } from '@/lib/content/schema';
import { track } from '@/lib/analytics/track';
import { usePhoneLike } from '@/lib/hooks/usePhoneLike';
import type { StageWithStatus } from '@/lib/types/database';
import type { StageQuestItem } from '@/lib/world/mapData';
import {
  pickPhoneQuiz,
  QUIZ_KIND_LABEL,
  type PhoneQuizPick as QuizPick,
} from '@/lib/world/phoneQuiz';

import './phoneQuiz.css';

/** 퀴즈 종류 아이콘 (스테이지 시트 태그·폰 퀴즈 쪽지) */
export const QUIZ_KIND_ICON: Record<QuizKind, typeof Bug> = {
  multiple_choice: ListChecks,
  fill_blank: TextCursorInput,
  parsons: ListOrdered,
  bug_hunt: Bug,
};

/**
 * "폰에서 하기 좋은 퀴즈" 쪽지 한 장 (P7-11). 이어하기(주 버튼) 아래 보조 추천: 제목 + 종류 + 바로가기(보조 버튼).
 * 등장은 한 번(phoneQuiz.css, 연출 단계별). 카탈로그는 이 모양만 진열
 */
export function PhoneQuizSlip({
  pick,
  onGo,
}: {
  pick: QuizPick;
  onGo?: () => void;
}) {
  const Icon = QUIZ_KIND_ICON[pick.kind];
  return (
    <aside
      className="pq"
      aria-label="폰에서 하기 좋은 퀴즈"
      data-testid="phone-quiz-pick"
    >
      <span className="pq-badge" aria-hidden>
        <Smartphone className="size-5" strokeWidth={2.4} />
      </span>
      <span className="pq-main">
        <span className="pq-k font-sans">폰에서 하기 좋은 퀴즈</span>
        <span className="pq-t">{pick.title}</span>
        <span className="pq-meta font-sans">
          <Icon aria-hidden className="size-3.5" strokeWidth={2.6} />
          {QUIZ_KIND_LABEL[pick.kind]} · {pick.stageOrder}단계
          {pick.review && (
            <>
              {' · '}
              <Star aria-hidden className="size-3.5" strokeWidth={2.6} />별 더
              모으기
            </>
          )}
        </span>
      </span>
      <Button
        variant="secondary"
        size="sm"
        href={`/quest/${pick.questId}`}
        className="pq-go"
        aria-label={`퀴즈 풀기: ${pick.title}`}
        onClick={onGo}
      >
        풀어 보기
      </Button>
    </aside>
  );
}

/**
 * 월드맵 폰 퀴즈 추천 (P7-11, §12-Q3 C): 휴대폰·태블릿(`usePhoneLike`)에서 이어하기가 코드 퀘스트이고 열린 스테이지에
 * 풀 만한 퀴즈가 있을 때만. 고르기는 `pickPhoneQuiz`. 서버 렌더·넓은 화면은 아무것도 그리지 않음
 */
export function PhoneQuizPick({
  stages,
  questsByStage,
  continueQuestId,
}: {
  stages: readonly StageWithStatus[];
  questsByStage: Record<string, StageQuestItem[]>;
  continueQuestId: string | null | undefined;
}) {
  const phone = usePhoneLike();
  const pick = pickPhoneQuiz({ phone, continueQuestId, stages, questsByStage });
  const shown = pick?.questId;
  useEffect(() => {
    if (shown) track('phone_quiz_pick', { place: 'world', action: 'show' });
  }, [shown]);
  if (!pick) return null;
  return (
    <PhoneQuizSlip
      pick={pick}
      onGo={() => track('phone_quiz_pick', { place: 'world', action: 'click' })}
    />
  );
}
