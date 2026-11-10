/**
 * 오늘의 퀴즈 (P7-10, §2.3·§12-Q60 3). 하루 최대 3문제, 저장 없이 계산한다 — 순수 함수라 단위 테스트 (`__tests__/dailyQuiz.test.ts`).
 *
 * 고르기: 열린 스테이지(퀴즈 보너스 규칙의 잠금 기준)의 퀴즈를 ① 복습 도전(별 3개 미만, 판정일 < 오늘 KST)
 * ② 아직 판정 안 함 ③ 나머지 순으로, 같은 칸 안은 (사용자, KST 날짜, 퀘스트) 해시 순 — 같은 날 다시 열어도 같은 문제.
 * 오늘 판정한 퀴즈는 "오늘 아침 칸"으로 되돌려 센다(처음 완료가 오늘이면 ②, 아니면 ①). 그래서 풀어도 목록이 바뀌지 않는다.
 * shortcut: 오늘 새 스테이지가 열리거나 퀘스트 화면에서 별 3개 퀴즈를 복습하면 아직 안 푼 칸이 바뀔 수 있다. 고정하려면 고른 목록을 저장(P8-07 데일리 미션 테이블)
 *
 * 완료: `quiz_attempts`(본인 행 SELECT, 00012)의 오늘(KST) 시도 중 정답이거나 3번째 오답(정답 공개)이면 그 문제는 끝.
 * 데일리 미션(P8-07)이 같은 함수(`dailyQuizResults`·`isDailyQuizDone`)로 "오늘의 퀴즈 완료"를 센다.
 */
import type { QuizKind } from '@/lib/content/schema';
import { toKstDateKey, type KstDateKey } from '@/lib/time/kst';
import { isQuizKind } from '@/lib/world/phoneQuiz';
import type { StageQuestItem } from '@/lib/world/mapData';

/** 하루 문제 수 */
export const DAILY_QUIZ_COUNT = 3;

export interface DailyQuizPick {
  questId: string;
  title: string;
  kind: QuizKind;
  stageOrder: number;
  /** 별 3개 미만 + 어제 이전 판정 → 오늘 맞히면 별이 오르는 복습 도전 */
  review: boolean;
}

/** 오늘 끝난 문제: correct = 정답으로 끝남, revealed = 3번 틀려 정답 공개 */
export type DailyQuizResult = 'correct' | 'revealed';

export interface QuizAttemptRow {
  user_id: string;
  quest_id: string;
  attempt_no: number;
  is_correct: boolean;
  created_at: string;
}

/** 월드맵 카드·`/daily`가 쓰는 오늘 상태 */
export interface DailyQuizState {
  today: KstDateKey;
  picks: DailyQuizPick[];
  /** 끝난 문제 id → 결과 (picks 안의 것만) */
  results: Record<string, DailyQuizResult>;
}

/** 0 복습 · 1 아직 판정 안 함 · 2 나머지 */
function bucket(q: StageQuestItem, today: KstDateKey): 0 | 1 | 2 {
  const judged = q.stars_judged_on;
  if (!judged) return 1;
  if (judged >= today) {
    // 오늘 판정 → 오늘 아침 칸 (처음 완료가 오늘이면 그때는 안 푼 퀴즈)
    return q.completed_at && toKstDateKey(q.completed_at) === today ? 1 : 0;
  }
  return q.best_stars < 3 ? 0 : 2;
}

/** FNV-1a 32비트 (시드 섞기용, 보안 무관) */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function pickDailyQuizzes({
  userId,
  today,
  stages,
  questsByStage,
}: {
  userId: string;
  today: KstDateKey;
  stages: readonly { id: string; order: number; status: string }[];
  questsByStage: Record<string, StageQuestItem[]>;
}): DailyQuizPick[] {
  return stages
    .filter((s) => s.status !== 'locked')
    .flatMap((s) =>
      (questsByStage[s.id] ?? []).flatMap((q) =>
        q.quest_type === 'quiz' && isQuizKind(q.quiz_kind)
          ? [
              {
                pick: {
                  questId: q.id,
                  title: q.title,
                  kind: q.quiz_kind,
                  stageOrder: s.order,
                  review: false,
                },
                b: bucket(q, today),
                h: hash(`${userId}:${today}:${q.id}`),
              },
            ]
          : [],
      ),
    )
    .sort(
      (a, b) =>
        a.b - b.b || a.h - b.h || (a.pick.questId < b.pick.questId ? -1 : 1),
    )
    .slice(0, DAILY_QUIZ_COUNT)
    .map(({ pick, b }) => ({ ...pick, review: b === 0 }));
}

/** 오늘(KST) 끝난 문제들. 정답이 한 번이라도 있으면 correct, 아니면 3번째 오답이면 revealed */
export function dailyQuizResults(
  questIds: readonly string[],
  attempts: readonly QuizAttemptRow[],
  today: KstDateKey,
): Record<string, DailyQuizResult> {
  const want = new Set(questIds);
  const out: Record<string, DailyQuizResult> = {};
  for (const a of attempts) {
    if (!want.has(a.quest_id) || toKstDateKey(a.created_at) !== today) continue;
    if (a.is_correct) out[a.quest_id] = 'correct';
    else if (a.attempt_no >= 3) out[a.quest_id] ??= 'revealed';
  }
  return out;
}

/** 오늘의 퀴즈를 모두 끝냈는지 (문제가 없으면 false — 할 일이 없는 날은 완료로 세지 않음) */
export function isDailyQuizDone(
  state: Pick<DailyQuizState, 'picks' | 'results'>,
): boolean {
  return (
    state.picks.length > 0 &&
    state.picks.every((p) => p.questId in state.results)
  );
}
