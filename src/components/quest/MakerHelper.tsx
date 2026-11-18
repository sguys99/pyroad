'use client';

import { Lightbulb, MessageCircleHeart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { QuestSession } from '@/lib/quest/useQuestSession';
import { IDEA_CARDS, PLANNER_IDEA_MAX_LENGTH } from '@/lib/tutor/maker';
import { FreeQuestionForm } from './FreeQuestionForm';
import './makerHelper.css';

/** 3월드(메이커 시티) 프로젝트인지, 그중 3-F 메이커 박람회인지 */
export function makerPlace(session: QuestSession): 'fair' | 'project' | null {
  const { quest, kind } = session;
  if (kind !== 'project' || quest.stage.world?.slug !== 'maker-city')
    return null;
  return quest.stage.theme_name === 'maker_fair' ? 'fair' : 'project';
}

/**
 * 메이커 작업대 (P11-14, world3.md §8): 이야기 쪽 힌트 줄 아래.
 * - 기획 도우미 `project_planner`: 3-F 1단계에서 아이디어 한 줄(또는 저장된 아이디어 카드 칩) → 파이뱀 대화에 기획 답
 * - 작품 평가 친구 `creation_feedback`: 3-F 4단계, 또는 3월드 프로젝트를 끝낸 뒤 — 지금 코드로 끝까지 돌린 작품을 보여 주면
 *   잘한 점 2 + 한 걸음 더 1 (점수·비교 없음). 답은 모두 "파이뱀에게 물어보기" 대화로 (서버가 거른 뒤 한 번에)
 */
export function MakerHelper({ session }: { session: QuestSession }) {
  const place = makerPlace(session);
  if (!place) return null;
  const planning =
    place === 'fair' && session.currentStep === 1 && !session.isCompleted;
  const feedback =
    session.isCompleted ||
    (place === 'fair' && session.currentStep >= session.totalSteps);
  if (!planning && !feedback) return null;
  const busy = session.isAiLoading;

  const plan = (idea: string) => {
    session.setAskOpen(true);
    return session.handleFreeAsk(idea, 'project_planner');
  };

  return (
    <div className="mk-stack">
      {planning && (
        <section
          className="mk"
          aria-labelledby="mk-plan-title"
          data-testid="maker-planner"
        >
          <h2 id="mk-plan-title" className="mk-title font-display">
            <span className="mk-icon" aria-hidden>
              <Lightbulb />
            </span>
            파이뱀 기획 도우미
          </h2>
          <p className="mk-lead">
            만들고 싶은 작품을 한 줄로 써 봐요. 파이뱀이 작품 이름, 기능 3개,
            기획 카드에 넣을 값을 같이 정해 줘요.
          </p>
          <FreeQuestionForm
            onSubmit={plan}
            remaining={null}
            busy={busy}
            text={{
              label: '파이뱀 기획 도우미에게 아이디어 말하기',
              placeholder: '예: 화살표로 별을 피하는 게임',
              help: '이름·학교·연락처 대신 별명과 상상을 써요',
              send: '같이 기획하기',
              testId: 'maker-plan',
            }}
          />
          <p className="mk-sub" id="mk-cards">
            아이디어가 안 떠오르면 카드를 골라 봐요
          </p>
          <ul className="mk-cards" aria-labelledby="mk-cards">
            {IDEA_CARDS.map((card) => (
              <li key={card.id}>
                <button
                  type="button"
                  className="mk-card"
                  disabled={busy}
                  onClick={() => void plan(card.idea)}
                  data-testid={`maker-card-${card.id}`}
                >
                  <span className="mk-card-k">{card.kind}</span>
                  {card.label}
                </button>
              </li>
            ))}
          </ul>
          <p className="sr-only">
            아이디어는 {PLANNER_IDEA_MAX_LENGTH}자까지 쓸 수 있어요.
          </p>
        </section>
      )}

      {feedback && (
        <section
          className="mk mk-fb"
          aria-labelledby="mk-fb-title"
          data-testid="maker-feedback"
        >
          <h2 id="mk-fb-title" className="mk-title font-display">
            <span className="mk-icon" aria-hidden>
              <MessageCircleHeart />
            </span>
            작품 평가 친구
          </h2>
          <p className="mk-lead">
            {session.canAskFeedback
              ? '작품을 끝까지 돌렸어요! 파이뱀이 잘한 점 두 가지와 한 걸음 더를 알려 줘요.'
              : '"코드 돌려보기"로 작품을 끝까지 돌리면 파이뱀에게 보여 줄 수 있어요.'}
          </p>
          <Button
            variant="secondary"
            size="sm"
            disabled={!session.canAskFeedback || busy}
            onClick={() => void session.handleCreationFeedback()}
            data-testid="maker-feedback-ask"
          >
            파이뱀에게 작품 보여 주기
          </Button>
        </section>
      )}
    </div>
  );
}
