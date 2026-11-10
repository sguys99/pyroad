/**
 * 폰에서 하기 좋은 퀴즈 추천 (P7-11, §12-Q3 C). 퀴즈는 스테이지 사이사이의 보너스, 코드 퀘스트가 필수다.
 * 휴대폰은 코드 입력이 불편하니 이어하기가 코드 퀘스트일 때 옆에 퀴즈 하나를 보조로 권한다 — 진행 규칙(잠금은 코드 퀘스트 기준)은
 * 그대로이고 코드 퀘스트를 막거나 숨기지 않는다. 순수 함수라 단위 테스트한다 (`__tests__/phoneQuiz.test.ts`)
 */
import type { QuizKind } from '@/lib/content/schema';
import type { StageWithStatus } from '@/lib/types/database';

import type { StageQuestItem } from './mapData';

/** 퀴즈 종류 이름 (퀴즈 입력 컴포넌트의 `label`과 같은 말. 그 컴포넌트를 월드맵에 싣지 않으려고 따로 둠) */
export const QUIZ_KIND_LABEL: Record<QuizKind, string> = {
  multiple_choice: '객관식',
  fill_blank: '빈칸 채우기',
  parsons: '순서 맞추기',
  bug_hunt: '버그 찾기',
};

export const isQuizKind = (k: string | null | undefined): k is QuizKind =>
  !!k && Object.hasOwn(QUIZ_KIND_LABEL, k);

export interface PhoneQuizPick {
  questId: string;
  title: string;
  kind: QuizKind;
  stageOrder: number;
  /** 이미 풀었고 별이 3개 미만 → 다시 풀어 별 더 모으기 */
  review: boolean;
}

interface PickInput {
  /** 코드 입력이 불편한 기기 (`usePhoneLike`) */
  phone: boolean;
  /** 이어하기 대상 퀘스트 (없으면 추천 없음) */
  continueQuestId: string | null | undefined;
  /** 보여 주는 월드의 스테이지 (잠긴 스테이지 퀴즈는 고르지 않음) */
  stages: readonly Pick<StageWithStatus, 'id' | 'order' | 'status'>[];
  questsByStage: Record<string, StageQuestItem[]>;
}

/**
 * 고르는 순서: ① 이어하기 스테이지의 안 푼 퀴즈 ② 그 스테이지의 별 3개 미만 퀴즈(복습) ③ 다른 열린 스테이지의 안 푼 퀴즈(가까운 스테이지부터)
 * ④ 다른 스테이지 복습. 같은 자리면 앞 스테이지·앞 순서. 폰이 아니거나, 이어하기가 이미 퀴즈거나 이 월드 밖이면 없음.
 * shortcut: 오늘 푼 퀴즈를 다시 풀면 연습(별·XP 없음)인데 완료 시각을 지도에 싣지 않아 가리지 않는다. 오늘 푼 것을 빼려면 completed_at 을 StageQuestItem 에
 */
export function pickPhoneQuiz({
  phone,
  continueQuestId,
  stages,
  questsByStage,
}: PickInput): PhoneQuizPick | null {
  if (!phone || !continueQuestId) return null;
  const open = stages.filter((s) => s.status !== 'locked');
  const here = open.find((s) =>
    questsByStage[s.id]?.some((q) => q.id === continueQuestId),
  );
  if (!here) return null;
  const target = questsByStage[here.id].find((q) => q.id === continueQuestId);
  if (target?.quest_type === 'quiz') return null;

  const best = open
    .flatMap((s) =>
      (questsByStage[s.id] ?? []).flatMap((q) =>
        q.quest_type === 'quiz' &&
        isQuizKind(q.quiz_kind) &&
        (q.status !== 'completed' || q.best_stars < 3)
          ? [{ q, kind: q.quiz_kind, s, review: q.status === 'completed' }]
          : [],
      ),
    )
    .map((c) => ({ ...c, away: Math.abs(c.s.order - here.order) }))
    .sort(
      (a, b) =>
        Number(a.away > 0) - Number(b.away > 0) ||
        Number(a.review) - Number(b.review) ||
        a.away - b.away ||
        a.s.order - b.s.order ||
        a.q.order - b.q.order,
    )[0];
  return best
    ? {
        questId: best.q.id,
        title: best.q.title,
        kind: best.kind,
        stageOrder: best.s.order,
        review: best.review,
      }
    : null;
}
