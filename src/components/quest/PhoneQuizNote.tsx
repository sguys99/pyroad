'use client';

import { useEffect, useState } from 'react';
import { Smartphone } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Toast, ToastRegion } from '@/components/ui/toast';
import { track } from '@/lib/analytics/track';
import { usePhoneLike } from '@/lib/hooks/usePhoneLike';
import type { StageQuestDot } from '@/lib/quest/stageProgress';

/** 기기에 "봤음"을 남기는 키. 서버에 보내지 않음 */
export const PHONE_QUIZ_NOTE_KEY = 'pyroad.phoneQuizNote';
/** 화면이 자리 잡은 뒤 띄우는 간격 (들어오는 연출과 겹치지 않게, InstallHint 와 같은 생각) */
export const PHONE_QUIZ_NOTE_DELAY_MS = 1_200;

function seen(): boolean {
  try {
    return localStorage.getItem(PHONE_QUIZ_NOTE_KEY) === '1';
  } catch {
    // 저장소를 못 쓰면(사파리 개인 정보 보호 등) 띄우지 않는다 — 매번 뜨는 것보다 안 뜨는 쪽이 낫다
    return true;
  }
}
function markSeen() {
  try {
    localStorage.setItem(PHONE_QUIZ_NOTE_KEY, '1');
  } catch {
    // 못 남겨도 이번 화면에서는 이미 닫힘
  }
}

/** 쪽지 모양 (카탈로그도 씀) */
export function PhoneQuizToast({
  count,
  href,
  onClose,
  onGo,
}: {
  count: number;
  href: string;
  onClose?: () => void;
  onGo?: () => void;
}) {
  return (
    <Toast
      icon={<Smartphone className="size-5" aria-hidden />}
      duration={0}
      onClose={onClose}
      closeLabel="닫기"
      action={
        <Button size="sm" variant="secondary" href={href} onClick={onGo}>
          퀴즈 보기
        </Button>
      }
      data-testid="phone-quiz-note"
    >
      폰에서는 퀴즈가 더 편해요 · 이 스테이지 퀴즈 {count}개
    </Toast>
  );
}

/**
 * 코드 퀘스트 첫 진입 쪽지 (P7-11, §12-Q3 C): 휴대폰·태블릿(`usePhoneLike`)이고 이 스테이지에 퀴즈가 있으면 한 번만
 * "폰에서는 퀴즈가 더 편해요". 보이는 순간 기기에 남겨(localStorage) 이 기기에선 다시 띄우지 않는다. 코드 퀘스트는 그대로 할 수 있고
 * 퀴즈는 보너스라 진행을 막지 않음. 바로가기는 이 스테이지의 안 푼 첫 퀴즈(다 풀었으면 첫 퀴즈)
 */
export function PhoneQuizNote({
  quests,
  unlocked = true,
}: {
  quests: readonly StageQuestDot[];
  /** 잠긴 스테이지 복습이면 퀴즈를 열 수 없어 띄우지 않음 (B38) */
  unlocked?: boolean;
}) {
  const phone = usePhoneLike();
  const [open, setOpen] = useState(false);
  const quizzes = [...quests]
    .filter((q) => q.quest_type === 'quiz')
    .sort((a, b) => a.order - b.order);
  const target = quizzes.find((q) => !q.completed) ?? quizzes[0];
  const eligible = phone && unlocked && !!target;

  useEffect(() => {
    if (!eligible || seen()) return;
    const t = setTimeout(() => {
      markSeen();
      setOpen(true);
      track('phone_quiz_pick', { place: 'quest', action: 'show' });
    }, PHONE_QUIZ_NOTE_DELAY_MS);
    return () => clearTimeout(t);
  }, [eligible]);

  return (
    <ToastRegion label="퀴즈 안내">
      {open && target && (
        <PhoneQuizToast
          count={quizzes.length}
          href={`/quest/${target.id}`}
          onClose={() => setOpen(false)}
          onGo={() =>
            track('phone_quiz_pick', { place: 'quest', action: 'click' })
          }
        />
      )}
    </ToastRegion>
  );
}
