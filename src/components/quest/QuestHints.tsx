'use client';

import { lazy, Suspense, useState } from 'react';
import { Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RewardIcon, Stars } from '@/components/ui/reward-icon';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { calculateXP, codeQuestStars } from '@/lib/quest/xp';
import { SHOW_STARS } from '@/lib/world/flags';
import type { ChatMessage } from '@/lib/tutor/types';
import type { QuestKind } from '@/lib/quest/questKind';
import type { QuestCompletion } from '@/lib/quest/useQuestSession';
import './questHints.css';

const MAX_HINTS = 3;
// 받은 힌트가 있을 때만 받는다. 오기 전에는 같은 글자를 그대로 보여 줌 (P6-16)
const HintMarkdown = lazy(() => import('./HintMarkdown'));

/** 완료한 퀘스트의 보상 줄 (Q57): 막 통과한 직후에 "이미 통과한 퀘스트"라고 하지 않게 */
export const COMPLETED_NOTE: Record<QuestCompletion, string> = {
  just: '통과해서 보상을 받았어요! 한 번 더 돌려 보면 복습이 돼요.',
  before:
    '예전에 통과한 퀘스트예요. 다시 풀면 복습이 되고, 보상은 처음 한 번만 받아요.',
  review: '복습 완료! 보상은 처음 한 번만 받아서 이번엔 XP가 없어요.',
};

export interface HintNoteData {
  level: number;
  text: string;
  /** 아직 받는 중 (글자가 흘러 들어오는 중이거나 기다리는 중) */
  pending?: boolean;
  /** AI 대신 저장된 힌트 (대화의 "저장된 답변" 배지와 같음) */
  fallback?: boolean;
}

/**
 * 대화 메시지에서 이번 단계의 힌트 쪽지를 꺼낸다. 힌트를 받는 흐름(단계 올리기·기록·되돌리기)은 useQuestSession이 맡고,
 * 여기서는 `hint` 표시가 붙은 메시지를 쪽지로 모으기만 한다. 받는 중인 쪽지에는 흘러 들어오는 글자를 보여 준다
 */
export function hintNotes(
  messages: ChatMessage[],
  step: number,
  streaming: string,
): HintNoteData[] {
  const mine = messages.filter((m) => m.hint?.step === step);
  const texts = new Map(
    mine.filter((m) => m.role === 'tutor').map((m) => [m.hint!.level, m]),
  );
  const levels = [...new Set(mine.map((m) => m.hint!.level))].sort(
    (a, b) => a - b,
  );
  return levels.map((level) => {
    const msg = texts.get(level);
    return msg
      ? { level, text: msg.content, fallback: msg.isFallback || undefined }
      : { level, text: streaming, pending: true };
  });
}

interface QuestHintsProps {
  kind: QuestKind;
  /** 이번 단계에서 받은 힌트 수 (0~3) */
  hintsUsed: number;
  notes: HintNoteData[];
  onHint: () => void;
  /** 튜터가 대답하는 중이라 지금은 힌트를 받을 수 없음 */
  hintBusy: boolean;
  goldenKeys: number;
  /** 확인 창에서 "황금키 쓰기"를 눌렀을 때 */
  onGoldenKey: () => void;
  /** 지금은 황금키를 쓸 수 없음 (튜터 대답 중·실행기 준비 중·실행·채점 중) */
  keyBlocked: boolean;
  keyLoading?: boolean;
  /** 퀘스트 기본 XP (quests.xp_reward) */
  xpReward: number;
  /** 보상 계산에 쓰는 누적 힌트 수 (DB hints_used) */
  totalHintsUsed: number;
  usedGoldenKey: boolean;
  isCompleted: boolean;
  /** 완료했으면 방금·예전·복습 중 무엇인지 (세션 `completion`, 없으면 예전에 통과) */
  completion?: QuestCompletion | null;
  /** 별로 안내 (기본 SHOW_STARS, Q51·Q52로 지금은 꺼져 XP로 안내) */
  showStars?: boolean;
}

/**
 * 이야기 쪽 힌트·황금키 줄 + 힌트 쪽지 (P6-09, 최종 시안 Quest.tsx StoryPage·HintNote).
 * 남은 횟수를 버튼에 바로 보여 주고, 쓰기 전에 보상이 어떻게 바뀌는지 미리 알려 준다.
 * 규칙은 서버와 같다: 완료 XP = complete_quest의 quest_xp(힌트 0회 1.5배 · 1회 1.25배 · 그 외 기본 · 황금키 0, xp.ts),
 * 황금키 완료는 뱃지 없음(00019), 스테이지를 깨면 황금키 3개로 채움. 별은 같은 자리에 SHOW_STARS로 (F3 규칙, P8-05)
 */
export function QuestHints({
  kind,
  hintsUsed,
  notes,
  onHint,
  hintBusy,
  goldenKeys,
  onGoldenKey,
  keyBlocked,
  keyLoading = false,
  xpReward,
  totalHintsUsed,
  usedGoldenKey,
  isCompleted,
  completion,
  showStars = SHOW_STARS,
}: QuestHintsProps) {
  const [confirming, setConfirming] = useState(false);
  const hintsLeft = Math.max(MAX_HINTS - hintsUsed, 0);
  const xp = calculateXP(xpReward, totalHintsUsed, usedGoldenKey);
  const nextXp = calculateXP(xpReward, totalHintsUsed + 1, usedGoldenKey);
  const stars = codeQuestStars(totalHintsUsed, usedGoldenKey);
  const nextStars = codeQuestStars(totalHintsUsed + 1, usedGoldenKey);

  return (
    <section className="qh" aria-label="힌트와 황금키">
      <div className="qh-btns">
        {/* 힌트 소리(tap)는 세션이 낸다 */}
        <Button
          variant="secondary"
          size="sm"
          onClick={onHint}
          disabled={hintBusy || isCompleted || hintsLeft === 0}
          sfx={false}
          icon={<Lightbulb aria-hidden />}
          aria-label={
            hintsLeft === 0 ? undefined : `힌트 받기 (${hintsLeft}번 남음)`
          }
        >
          {hintsLeft === 0 ? (
            '힌트 모두 사용'
          ) : (
            <>
              힌트<span className="qh-verb"> 받기</span>
              <span className="qh-count" aria-hidden>
                {hintsLeft}번 남음
              </span>
            </>
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="qh-key"
          onClick={() => setConfirming(true)}
          disabled={keyBlocked || keyLoading || isCompleted || goldenKeys <= 0}
          loading={keyLoading}
          icon={<RewardIcon kind="key" size={22} />}
          aria-label={`황금키 쓰기 (${goldenKeys}개 남음)`}
        >
          {goldenKeys <= 0 ? '황금키 없음' : '황금키'}
          <span className="qh-count qh-count-key" aria-hidden>
            {goldenKeys}개
          </span>
        </Button>
      </div>

      <p className="qh-reward" data-testid="quest-reward-preview">
        {isCompleted ? (
          COMPLETED_NOTE[completion ?? 'before']
        ) : (
          <>
            <span className="qh-reward-now">
              받을 {showStars ? '별' : '경험치'}{' '}
              {showStars ? <Stars n={stars} size={18} /> : <b>+{xp} XP</b>}
            </span>
            <span className="qh-reward-tip">
              {hintTip({
                showStars,
                usedGoldenKey,
                hintsLeft,
                xp,
                nextXp,
                stars,
                nextStars,
              })}
            </span>
          </>
        )}
      </p>

      {notes.length > 0 && (
        <ol className="qh-notes" aria-label="받은 힌트">
          {notes.map((note) => (
            <li
              key={note.level}
              className="qh-note"
              aria-busy={note.pending || undefined}
            >
              <span className="qh-note-k">
                <Lightbulb aria-hidden />
                힌트 {note.level}/{MAX_HINTS}
              </span>
              {note.fallback && (
                <span className="qh-note-tag">저장된 답변</span>
              )}
              {note.pending ? (
                note.text ? (
                  <p className="qh-note-body whitespace-pre-wrap">
                    {note.text}
                    <span className="g-caret" aria-hidden />
                  </p>
                ) : (
                  <p className="qh-note-body qh-note-wait" role="status">
                    파이뱀이 힌트를 꺼내는 중…
                  </p>
                )
              ) : (
                <div className="qh-note-body prose prose-sm max-w-none text-foreground prose-p:my-1 prose-code:rounded prose-code:bg-surface prose-code:before:content-none prose-code:after:content-none prose-code:px-1 prose-pre:bg-surface prose-pre:text-foreground">
                  <Suspense
                    fallback={
                      <p className="whitespace-pre-wrap">{note.text}</p>
                    }
                  >
                    <HintMarkdown text={note.text} />
                  </Suspense>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-accent-soft">
              <RewardIcon kind="key" size={30} />
            </AlertDialogMedia>
            <AlertDialogTitle>황금키를 쓸까요?</AlertDialogTitle>
            <AlertDialogDescription render={<div />}>
              <ul className="qh-confirm">
                <li>
                  {kind === 'project'
                    ? '이 단계의 정답 주문이 공책에 써지고 다음 단계로 넘어가요.'
                    : '정답 주문이 공책에 써지고 바로 실행돼요.'}
                </li>
                <li>
                  {usedGoldenKey
                    ? '이미 황금키를 써서 이 퀘스트는 경험치(XP)와 뱃지 없이 끝나요.'
                    : kind === 'project'
                      ? `대신 퀘스트를 다 끝내도 경험치(XP)와 뱃지를 받을 수 없어요. (지금 받을 경험치 +${xp} XP → 0)`
                      : `대신 이 퀘스트는 경험치(XP)와 뱃지 없이 끝나요. (지금 받을 경험치 +${xp} XP → 0)`}
                  {showStars && ' 별은 1개만 받아요.'}
                </li>
                <li>
                  황금키 {goldenKeys}개 → {goldenKeys - 1}개. 스테이지를 깨면
                  다시 3개로 채워져요.
                </li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>그만둘래요</AlertDialogCancel>
            <AlertDialogAction variant="reward" onClick={onGoldenKey}>
              황금키 쓰기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

/** 힌트를 하나 더 쓰면 보상이 어떻게 되는지 (쓰기 전에 미리) */
function hintTip(p: {
  showStars: boolean;
  usedGoldenKey: boolean;
  hintsLeft: number;
  xp: number;
  nextXp: number;
  stars: number;
  nextStars: number;
}): string {
  if (p.usedGoldenKey)
    return p.showStars
      ? '황금키를 써서 별 1개로 끝나요.'
      : '황금키를 써서 경험치 없이 끝나요.';
  if (p.hintsLeft === 0) return '힌트를 모두 꺼냈어요. 쪽지를 다시 읽어 봐요!';
  if (p.showStars)
    return p.nextStars < p.stars
      ? `힌트를 쓰면 받을 별이 ${p.stars}개 → ${p.nextStars}개로 줄어요.`
      : '힌트를 더 써도 받을 별은 그대로예요.';
  return p.nextXp < p.xp
    ? `힌트를 쓰면 +${p.nextXp} XP로 줄어요.`
    : '힌트를 더 써도 받을 경험치는 그대로예요.';
}
