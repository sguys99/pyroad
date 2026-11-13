'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePyodideRuntime } from '@/lib/pyodide/PyodideProvider';
import { createLiveOutputStore } from '@/lib/pyodide/liveOutput';
import type { RunResult } from '@/lib/pyodide/usePyodide';
import { useTutor, TutorRateLimitError } from '@/lib/tutor/useTutor';
import { TUTOR_UNAVAILABLE_HINT_MESSAGE } from '@/lib/tutor/messages';
import type { ChatMessage, TutorRequest } from '@/lib/tutor/types';
import type { FreeQuestionBlock } from '@/lib/tutor/freeQuestion';
import { loadBrowserClient } from '@/lib/supabase/loadClient';
import { fireConfetti, resetConfetti } from '@/lib/confetti';
import { useMotionTier } from '@/lib/motion/MotionTierProvider';
import { useRestHold } from '@/lib/rest/restHold';
import { useSfx } from '@/components/providers/SoundProvider';
import type {
  ProjectStep,
  QuestWithStage,
  UserProgress,
} from '@/lib/types/database';
import type { ValidationResult } from './validation';
import {
  retryChanged,
  type GoldenKeyResponse,
  type QuestCompleteResponse,
  type RewardErrorResponse,
} from './rewards';
import { getQuestKind, type QuestKind } from './questKind';
import { nowTodoText } from './nowTodo';
import { createCelebrationStore } from '@/lib/celebration/celebrationStore';
import {
  buildCelebrationEvents,
  type CelebrationEvent,
} from './celebrationEvents';
import { levelUpCoinsTotal } from './coins';
import { starReviewOpen } from './starReview';

/**
 * 퀘스트 엔진 공통 훅 (P1-09, §2.5).
 *
 * 진행 상태·자동 저장·힌트·실행·채점·완료·황금키·보상을 한 곳에서 다루고, 유형별 렌더러
 * (`CodeQuest`, `ProjectQuest`, 이후 Quiz·Boss)는 화면만 그린다. 보상 응답은 축하 이벤트 목록
 * (`celebrationStore`, P6-13: React 상태가 아닌 바깥 저장소 — 넣고 비울 때 셸이 다시 그려지지 않게)로 내보내고,
 * 축하 시퀀서(`QuestCelebrations`, P1-10)가 다 보여 준 뒤 `dismissCelebrations`로 지운다.
 *
 * 코드 퀘스트는 1단계짜리 프로젝트처럼 다룬다. 단계 진행은 `stepRef`로 읽어서, 타이머 뒤에 실행되는
 * 다음 단계 이동이 예전 화면 값(코드·단계)을 잡지 않는다 (B10).
 * 실행기(Pyodide Worker)는 퀘스트 레이아웃의 PyodideProvider 것을 같이 쓴다 (B22).
 */

export type QuestTab = 'story' | 'code' | 'result';

/**
 * 완료한 퀘스트의 지금 모습 (§12-Q57): just = 이번에 처음 통과해 보상을 받음 · before = 예전에 통과(복습 전) ·
 * review = 이미 통과한 퀘스트를 다시 풀어 통과. XP는 없고, 복습 도전(별 3개 미만 + 다음 날)이면 완료 API(retry)로 별을 채움 (P8-05, Q64)
 */
export type QuestCompletion = 'just' | 'before' | 'review';

export interface QuestSessionOptions {
  quest: QuestWithStage;
  progress: UserProgress | null;
  userId: string;
  initialXP: number;
  initialLevel: number;
  initialGoldenKeys: number;
}

/** 클라이언트가 쓸 수 있는 진행 저장 컬럼만 (P1-04: 상태·힌트 수·별은 서버만 씀) */
export type ProgressSaveFields = {
  code_submitted: string;
  current_step?: number;
  step_submissions?: Record<string, string>;
};

interface StepState {
  step: number;
  /** 통과한 단계의 코드 (`"1"` → 코드) */
  submissions: Record<string, string>;
}

export const MAX_HINTS_PER_STEP = 3;
/** 마지막으로 고친 뒤 이만큼 지나면 자동 저장 */
export const AUTO_SAVE_DELAY_MS = 2000;
/**
 * 단계 통과(또는 황금키) 뒤 다음 단계로 넘어가기까지: "다음 단계" 박자(해 볼 일 체크 → 다음 목표, P6-12).
 * 그 사이 `skipStepBeat`로 바로 넘어갈 수 있다
 */
export const STEP_ADVANCE_DELAY_MS = 2200;
/**
 * 완료 컨페티를 본 뒤 축하 오버레이를 띄우기까지. 코드 퀘스트는 결과 쪽 성공 장면(도장 → XP 카운트업, 약 1.6초 —
 * `QuestSuccess.SUCCESS_RUN_MS`)을 끝까지 본 다음 (P6-08)
 */
export const CELEBRATION_DELAY_MS: Record<QuestKind, number> = {
  code: 1800,
  // 마지막 단계도 같은 성공 장면(도장 → XP)을 본 뒤 프로젝트 완성 카드 (P6-12, 전에는 500ms라 장면을 덮음)
  project: 1800,
  // 퀴즈도 정답 도장 → 보상 띠를 본 뒤 (P7-03, useQuizSession)
  quiz: 1800,
  // 보스: 쓰러진 보스·승리 화면(별·보상)을 본 뒤 (P9-12, useBossSession)
  boss: 1800,
};

/**
 * 퀘스트 화면 안의 컨페티. 뒤이어 축하 카드가 뜰 수 있으므로 카드 컨페티보다 작게 (단계 통과 30 < 정답 80 <
 * 뱃지·레벨 업·스테이지 클리어, P1-10). 황금키로 연 단계·퀘스트에는 쏘지 않는다 (§2.6: 보상은 학습 행동에만)
 */
const STEP_PASS_CONFETTI = {
  particleCount: 30,
  spread: 50,
  origin: { y: 0.7 },
  ticks: 80,
  gravity: 2.2,
  startVelocity: 55,
};
export const ANSWER_CONFETTI = {
  particleCount: 80,
  spread: 70,
  origin: { y: 0.6 },
  ticks: 90,
  gravity: 2.2,
  startVelocity: 60,
};

/**
 * "파이뱀에게 물어보기"에서 고르는 질문 (P6-10, §12-Q58). 자유 입력은 `handleFreeAsk`(P9-17):
 * what = 지금 할 일(해 볼 일 + 지금 상태, LLM 없이 `nowTodoText`) · concept = 이 퀘스트 개념만(`concept_explain`) ·
 * why = 마지막 실행 결과 설명(`code_feedback`, 결과가 지금 코드의 것일 때만)
 */
export const ASK_QUESTIONS = {
  what: '무엇을 하면 돼요?',
  concept: '힌트 말고 개념만 알려 줘요',
  why: '왜 이렇게 나왔어요?',
} as const;
export type AskQuestion = keyof typeof ASK_QUESTIONS;

/**
 * 자유 질문을 보낸 결과 (P9-17). sent = 대화에 들어감(입력 칸 비움) · note = 보내지 못함: 입력 칸 아래 안내, 글은 남겨 고칠 수 있게
 * (개인정보·부적절·역할 바꾸기로 거름, 한도). 위험 신호(wellbeing)는 안내를 파이뱀 말풍선으로 대화에 남기므로 sent
 */
export type FreeAskResult =
  | { status: 'sent' }
  | { status: 'note'; message: string; block?: FreeQuestionBlock }
  | { status: 'busy' };
const ASK_FAILED =
  '지금은 파이뱀이 대답하기 어려워요. 조금 뒤에 다시 물어봐 줘요!';
const SAVE_FAILED_MESSAGE =
  '앗, 기록을 저장하지 못했어요. 한 번 더 눌러 볼까요?';
const RUNNER_NOT_READY_FOR_KEY =
  '실행기가 준비되면 황금키를 쓸 수 있어요. 잠시만 기다려 줘요!';

/**
 * 튜터 요청이 실패했을 때 말풍선에 넣을 문구. 요청 한도(P1-19, 서버 429)면 서버가 준 아이용 한도 문구
 * ("잠깐 쉬고 있어요. N초 뒤에…")이고 저장된 답변이 아니므로 배지를 달지 않는다. 그 밖의 실패는 준비한 문구
 */
export function tutorFailure(
  error: unknown,
  failText: string,
): { message: string; isFallback: boolean } {
  return error instanceof TutorRateLimitError
    ? { message: error.message, isFallback: false }
    : { message: failText, isFallback: true };
}

type ApiResult<T> = { ok: boolean; data: T & Partial<RewardErrorResponse> };

async function postJson<T>(url: string, body: object): Promise<ApiResult<T>> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, data: await res.json() };
}

/** 이전 단계 코드 아래에 다음 단계 시작 코드를 붙인다 */
/** fromStep(= current.step)을 passedCode로 통과한 뒤의 단계 상태와 공책 코드 */
function stepAfter(
  steps: ProjectStep[],
  current: { step: number; submissions: Record<string, string> },
  passedCode: string,
) {
  const nextStep = current.step + 1;
  return {
    next: {
      step: nextStep,
      submissions: {
        ...current.submissions,
        [String(current.step)]: passedCode,
      },
    },
    nextCode: appendStarter(passedCode, steps[nextStep - 1].starter_code),
  };
}

function appendStarter(code: string, starter: string): string {
  if (code && starter) return code + '\n' + starter;
  return code || starter;
}

function initialStepState(
  steps: ProjectStep[] | null,
  progress: UserProgress | null,
): StepState {
  if (!steps) return { step: 1, submissions: {} };
  const saved = progress?.current_step ?? 1;
  return {
    // 콘텐츠가 바뀌어 저장된 단계가 범위를 벗어나도 화면이 깨지지 않게
    step: Math.min(Math.max(saved, 1), steps.length),
    submissions: progress?.step_submissions ?? {},
  };
}

function initialCode(
  quest: QuestWithStage,
  steps: ProjectStep[] | null,
  stepState: StepState,
  progress: UserProgress | null,
): string {
  // 저장된 코드 > (프로젝트) 이전 단계 코드 + 시작 코드 > 시작 코드
  if (progress?.code_submitted) return progress.code_submitted;
  if (!steps) return quest.prompt_skeleton.starter_code;
  const prev = stepState.submissions[String(stepState.step - 1)] ?? '';
  return appendStarter(prev, steps[stepState.step - 1].starter_code);
}

export function useQuestSession({
  quest,
  progress,
  userId,
  initialXP,
  initialLevel,
  initialGoldenKeys,
}: QuestSessionOptions) {
  const router = useRouter();
  const {
    status: runnerStatus,
    restarting,
    loadStage,
    isRunning,
    runCode,
    stop,
    retry,
    start: startRunner,
  } = usePyodideRuntime();
  // 공용 Worker는 lazy (PyodideProvider): 코드 퀘스트는 들어오자마자 준비
  useEffect(() => startRunner(), [startRunner]);
  const {
    sendTutorRequest,
    sendTutorStreamRequest,
    isLoading: isAiLoading,
    setIsLoading,
    hasApiKey,
  } = useTutor();

  const kind = getQuestKind(quest.prompt_skeleton);
  const questId = quest.id;
  const questTitle = quest.title;
  const topic = quest.prompt_skeleton.topic;
  const introFallback = quest.prompt_skeleton.fallback_text;
  const questValidationType = quest.validation_type;
  const steps = quest.prompt_skeleton.steps ?? null;
  const totalSteps = steps?.length ?? 1;

  // 단계 진행. stepRef는 타이머·비동기 흐름이 최신 단계를 읽는 곳 (B10)
  const [stepState, setStepState] = useState<StepState>(() =>
    initialStepState(steps, progress),
  );
  const stepRef = useRef(stepState);
  const currentStep = stepState.step;
  const stepDef = steps?.[currentStep - 1] ?? null;

  // 복습 도전 (§12-Q64): 별 3개 미만 + 마지막 별 판정 다음 날(KST)이면 저장된 코드 대신 처음 뼈대 코드에서 다시 짠다.
  // 완료한 퀘스트는 자동 저장을 하지 않으므로 저장된 코드(처음 통과한 코드)는 그대로 남는다
  const [reviewChallenge, setReviewChallenge] = useState(
    () => progress?.status === 'completed' && starReviewOpen(progress),
  );
  const [code, setCode] = useState(() =>
    initialCode(quest, steps, stepState, reviewChallenge ? null : progress),
  );
  const [tab, setTab] = useState<QuestTab>('story');
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  // 실행 중 stdout. 출력창만 구독하므로 출력 조각마다 셸이 다시 그려지지 않는다
  const [liveOutput] = useState(createLiveOutputStore);

  // AI 튜터
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  // 마지막으로 돌린 코드 ("왜 이렇게 나왔어요?"는 그 코드 그대로일 때만 묻는다)
  const [lastRunCode, setLastRunCode] = useState<string | null>(null);
  // 힌트: 화면의 "힌트 n/3"은 단계마다(코드 퀘스트는 퀘스트 전체), 상태바는 누적
  const [stepHints, setStepHints] = useState(
    kind === 'code' ? (progress?.hints_used ?? 0) : 0,
  );
  const [totalHints, setTotalHints] = useState(progress?.hints_used ?? 0);

  // 연출 단계의 파티클 배율 (reduced-motion·minimal이면 0). 콜백 안에서 최신 값을 읽도록 ref
  const { budget } = useMotionTier();
  const particleScaleRef = useRef(budget.particles);
  particleScaleRef.current = budget.particles;
  // 효과음 (P2-14). 소리는 보조 피드백: 같은 내용을 결과 상자·파이뱀 안내로도 보여 준다
  const play = useSfx();

  // 완료·보상
  const [isCompleted, setIsCompleted] = useState(
    progress?.status === 'completed',
  );
  const [nextQuestId, setNextQuestId] = useState<string | null>(null);
  const [earnedXP, setEarnedXP] = useState<number | null>(null);
  /** 이번 완료로 받은 퀘스트 코인 (레벨 업 코인은 레벨 업 카드가 보여 주므로 뺌, P8-04) */
  const [earnedCoins, setEarnedCoins] = useState(0);
  const [userXP, setUserXP] = useState(initialXP);
  const [userLevel, setUserLevel] = useState(initialLevel);
  const [goldenKeys, setGoldenKeys] = useState(initialGoldenKeys);
  const [isGoldenKeyLoading, setIsGoldenKeyLoading] = useState(false);
  // 이 퀘스트에 황금키를 썼는지 (DB used_golden_key와 같음 → 완료 XP 0, 보상 미리 보기)
  const [usedGoldenKey, setUsedGoldenKey] = useState(
    progress?.used_golden_key ?? false,
  );
  // 별 (P8-05): 이 퀘스트의 최고 별(0 = 기록 없음) · 이번 다시 풀기로 늘어난 별 · 황금키 정답을 그대로 돌렸는지
  const [bestStars, setBestStars] = useState(progress?.best_stars ?? 0);
  const [newStars, setNewStars] = useState(0);
  const [solutionCopy, setSolutionCopy] = useState(false);
  const [celebrationStore] = useState(createCelebrationStore);
  // 복습 (Q57): 이번 세션에 처음 통과했는지 · 마지막으로 채점한 실행이 이미 완료한 퀘스트였는지
  const [justCompleted, setJustCompleted] = useState(false);
  const [reviewRun, setReviewRun] = useState(false);

  // 실행·채점·완료(황금키 포함) 요청 중복 방지 (B06). ref 는 렌더 전 연속 클릭도 막고, state 는 버튼 표시용.
  // 단계를 통과하면 다음 단계로 넘어갈 때까지 잠가 둔다 (같은 단계를 두 번 넘기지 않게)
  const submittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const lockSubmit = useCallback((locked: boolean) => {
    submittingRef.current = locked;
    setIsSubmitting(locked);
  }, []);

  // 화면을 떠나면 예약한 일(단계 이동·축하)을 취소하고, 늦게 끝난 요청의 후속 처리를 하지 않는다
  const aliveRef = useRef(true);
  // 이번 풀이 중 실행 에러를 만났는지 (P8-09 실패 칭찬 업적 "에러를 이겨 냄"). 완료 요청에 실어 보내고 비움
  const hadErrorRef = useRef(false);
  const timersRef = useRef(new Set<ReturnType<typeof setTimeout>>());
  const later = useCallback((fn: () => void, ms: number) => {
    const timers = timersRef.current;
    const timer = setTimeout(() => {
      timers.delete(timer);
      fn();
    }, ms);
    timers.add(timer);
  }, []);
  useEffect(() => {
    aliveRef.current = true;
    const timers = timersRef.current;
    return () => {
      aliveRef.current = false;
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      // 정답·단계 통과 컨페티가 다음 퀘스트 위로 떨어지지 않게 (P6-15)
      resetConfetti();
    };
  }, []);

  // 진행을 서버에 쓴 퀘스트(코드 자동 저장·힌트·황금키)를 떠나면 Router Cache를 새로 받는다 (P6-15).
  // 뒤로/앞으로는 캐시된 페이지 데이터를 그대로 다시 쓰므로, 안 그러면 돌아왔을 때 처음 들어온 때의 코드·힌트 수가 보인다
  const wroteRef = useRef(false);
  const [entry] = useState(() => ({ code, stepState }));
  useEffect(
    () => () => {
      if (wroteRef.current) router.refresh();
    },
    [router],
  );

  // 퀘스트를 떠날 때 돌던 코드를 멈춘다 (Worker는 레이아웃이 계속 가지고 있으므로 다음 퀘스트가 바로 쓸 수 있게)
  useEffect(() => stop, [stop]);

  // ── 대화 ────────────────────────────────────────────────────────────

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);
  const addSystemMessage = useCallback(
    (content: string) => addMessage({ role: 'system', content }),
    [addMessage],
  );

  /** 스트리밍 말풍선을 정리하고 답을 대화에 넣는다 (한 배치로 처리해 깜빡임 없음) */
  const finishStreaming = useCallback(
    (
      message: string,
      isFallback: boolean,
      replace = false,
      hint?: ChatMessage['hint'],
    ) => {
      setStreamingContent('');
      setIsLoading(false);
      const msg: ChatMessage = {
        role: 'tutor',
        content: message,
        isFallback,
        hint,
      };
      setMessages((prev) => (replace ? [msg] : [...prev, msg]));
    },
    [setIsLoading],
  );

  /**
   * 튜터 답을 말풍선에 흘려 쓴다. 실패하면 준비한 문구, 요청 한도(P1-19)에 걸렸으면 한도 문구. 취소(null)면 아무것도 하지 않음.
   * "파이뱀에게 물어보기" 질문에만 쓴다 (Q56부터 실행 피드백도 버튼으로만): 아이가 누른 버튼에 대한 답이라 "왜 선생님이 대답하지 않는지"를 알려 준다
   */
  const streamTutor = useCallback(
    (req: TutorRequest, failText: string) =>
      sendTutorStreamRequest(req, setStreamingContent)
        .then((res) => {
          if (res) finishStreaming(res.message, res.is_fallback);
        })
        .catch((error: unknown) => {
          const failure = tutorFailure(error, failText);
          finishStreaming(failure.message, failure.isFallback);
        }),
    [sendTutorStreamRequest, finishStreaming],
  );

  /** 스트림 말풍선을 쓰지 않는 튜터 요청 (다음 단계 안내 스트림과 겹치지 않게) */
  const askTutor = useCallback(
    (req: TutorRequest, failText: string) =>
      sendTutorRequest(req)
        .then((res) => {
          if (res) {
            addMessage({
              role: 'tutor',
              content: res.message,
              isFallback: res.is_fallback,
            });
          }
        })
        .catch(() =>
          addMessage({ role: 'tutor', content: failText, isFallback: true }),
        ),
    [sendTutorRequest, addMessage],
  );

  // 코드 퀘스트: 들어오면 퀘스트 소개
  useEffect(() => {
    if (kind !== 'code') return;
    let cancelled = false;
    sendTutorStreamRequest(
      { type: 'quest_intro', quest_id: questId },
      (text) => {
        if (!cancelled) setStreamingContent(text);
      },
    )
      .then((res) => {
        // null: 퀘스트를 떠나 요청이 취소됨 → 아무것도 하지 않음
        if (res && !cancelled)
          finishStreaming(res.message, res.is_fallback, true);
      })
      .catch(() => {
        if (!cancelled) finishStreaming(introFallback, true, true);
      });
    return () => {
      cancelled = true;
    };
  }, [kind, questId, introFallback, sendTutorStreamRequest, finishStreaming]);

  // 프로젝트: 단계에 들어갈 때마다 단계 안내
  const stepGoal = stepDef?.step_goal;
  const stepFallback = stepDef?.fallback_text ?? '';
  const previousStepCode =
    currentStep > 1
      ? (stepState.submissions[String(currentStep - 1)] ?? '')
      : '';
  useEffect(() => {
    if (kind !== 'project' || isCompleted || stepGoal === undefined) return;
    let cancelled = false;
    addSystemMessage(`단계 ${currentStep}/${totalSteps}: ${stepGoal}`);
    sendTutorStreamRequest(
      {
        type: 'project_guide',
        quest_id: questId,
        current_step: currentStep,
        total_steps: totalSteps,
        step_goal: stepGoal,
        previous_code: previousStepCode,
      },
      (text) => {
        if (!cancelled) setStreamingContent(text);
      },
    )
      .then((res) => {
        if (res && !cancelled) finishStreaming(res.message, res.is_fallback);
      })
      .catch(() => {
        if (!cancelled) finishStreaming(stepFallback, true);
      });
    return () => {
      cancelled = true;
    };
  }, [
    kind,
    isCompleted,
    questId,
    currentStep,
    totalSteps,
    stepGoal,
    stepFallback,
    previousStepCode,
    addSystemMessage,
    sendTutorStreamRequest,
    finishStreaming,
  ]);

  // ── 진행 저장 ───────────────────────────────────────────────────────

  const saveProgress = useCallback(
    (fields: ProgressSaveFields) => {
      loadBrowserClient().then((supabase) => {
        supabase
          .from('user_progress')
          .upsert(
            { user_id: userId, quest_id: questId, ...fields },
            { onConflict: 'user_id,quest_id' },
          )
          .then();
      });
    },
    [userId, questId],
  );

  // 코드 변경 시 자동 저장 (처음 만드는 행의 status 는 DB 기본값 in_progress)
  useEffect(() => {
    if (isCompleted) return;
    const timer = setTimeout(() => {
      // 단계 통과 박자 중이면 박자가 이미 다음 단계를 저장했다 — 예전 단계로 덮어쓰지 않게 (P6-16)
      if (pendingAdvanceRef.current) return;
      // 들어온 그대로를 다시 저장하는 것은 바뀐 것이 아님
      if (code !== entry.code || stepState !== entry.stepState)
        wroteRef.current = true;
      saveProgress(
        kind === 'project'
          ? {
              code_submitted: code,
              current_step: stepState.step,
              step_submissions: stepState.submissions,
            }
          : { code_submitted: code },
      );
    }, AUTO_SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [code, isCompleted, kind, stepState, saveProgress, entry]);

  // ── 단계·완료 ───────────────────────────────────────────────────────

  /**
   * fromStep을 통과한 코드(passedCode)로 다음 단계로 간다. 타이머 뒤에 불려도 화면 값이 아니라
   * 넘겨받은 코드와 stepRef의 최신 단계를 쓴다 (B10: 황금키 뒤 예전 코드가 저장되던 문제)
   */
  const advanceStep = useCallback(
    (
      fromStep: number,
      passedCode: string,
      { confetti = true }: { confetti?: boolean } = {},
    ) => {
      const current = stepRef.current;
      if (!steps || current.step !== fromStep || fromStep >= steps.length) {
        lockSubmit(false);
        return;
      }
      const { next, nextCode } = stepAfter(steps, current, passedCode);
      const nextStep = next.step;
      const submissions = next.submissions;
      stepRef.current = next;

      setStepState(next);
      setCode(nextCode);
      setRunResult(null);
      setValidation(null);
      setStepHints(0);
      liveOutput.reset();
      lockSubmit(false);
      // 모바일: 비워진 결과 쪽 대신 다음 단계 코드를 쓸 공책 쪽으로 (P6-12)
      setTab('code');

      if (confetti) {
        fireConfetti(STEP_PASS_CONFETTI, { scale: particleScaleRef.current });
      }

      saveProgress({
        code_submitted: nextCode,
        current_step: nextStep,
        step_submissions: submissions,
      });
    },
    [steps, lockSubmit, liveOutput, saveProgress],
  );

  // "다음 단계" 박자 (P6-12): 통과한 단계 번호(넘어가기 전까지)와 바로 넘기기. 예약한 넘김은 한 번만 돈다
  const [stepCleared, setStepCleared] = useState<number | null>(null);
  const pendingAdvanceRef = useRef<(() => void) | null>(null);
  const scheduleAdvance = useCallback(
    (step: number, passedCode: string, opts?: { confetti?: boolean }) => {
      const go = () => {
        if (pendingAdvanceRef.current !== go) return;
        pendingAdvanceRef.current = null;
        setStepCleared(null);
        advanceStep(step, passedCode, opts);
      };
      pendingAdvanceRef.current = go;
      setStepCleared(step);
      // 통과는 박자를 기다리지 않고 바로 저장한다: 박자 중에 떠나도 다음에 다음 단계에서 시작 (박자는 그림만, P6-16)
      const current = stepRef.current;
      if (steps && current.step === step && step < steps.length) {
        const { next, nextCode } = stepAfter(steps, current, passedCode);
        saveProgress({
          code_submitted: nextCode,
          current_step: next.step,
          step_submissions: next.submissions,
        });
      }
      later(go, STEP_ADVANCE_DELAY_MS);
    },
    [advanceStep, later, steps, saveProgress],
  );
  const skipStepBeat = useCallback(() => pendingAdvanceRef.current?.(), []);

  /**
   * 완료 응답을 반영한다. 새로 일어난 일은 축하 이벤트로 (P1-10 시퀀서가 보여 줌).
   * 황금키로 연 퀘스트는 큰 축하 대신 "황금키로 열었어요" 확인이 된다 (buildCelebrationEvents)
   */
  const applyCompletion = useCallback(
    (completion: QuestCompleteResponse) => {
      setNextQuestId(completion.next_quest_id);
      setGoldenKeys(completion.golden_keys);
      if (typeof completion.best_stars === 'number')
        setBestStars(completion.best_stars);
      setNewStars(completion.new_stars ?? 0);
      setSolutionCopy(completion.solution_copy === true);
      // 복습 도전을 마쳤으면(review) 오늘은 더 연습만 (서버가 판정일을 오늘로)
      if (completion.mode === 'review' || completion.mode === 'practice')
        setReviewChallenge(false);
      if (!completion.already_completed) setJustCompleted(true);
      // 다시 풀기로 새 별(코인)·황금키 퀘스트 첫 직접 풀이(XP·뱃지)를 받았으면 처음 완료처럼 반영 (P8-05)
      if (!completion.already_completed || retryChanged(completion)) {
        setEarnedXP(completion.xp_gained);
        setEarnedCoins(
          (completion.coins_earned ?? 0) -
            levelUpCoinsTotal(completion.level_ups),
        );
        setUserXP(completion.total_xp);
        setUserLevel(completion.level_after);
        const events = buildCelebrationEvents(completion, {
          kind,
          questTitle,
        });
        if (events.length > 0) {
          later(
            () => celebrationStore.push(events),
            CELEBRATION_DELAY_MS[kind],
          );
        }
        // 월드맵·프로필이 새 진행을 보이도록 Router Cache를 새로 받는다 (B22: 전체 새로고침 대신)
        router.refresh();
      }
      setIsCompleted(true);
    },
    [kind, questTitle, later, router, celebrationStore],
  );

  /** 서버 채점 (프로젝트는 단계 기준). 요청이 실패하면 통과하지 않은 것으로 */
  const validate = useCallback(
    async (codeToCheck: string, stdout: string, step: number) => {
      try {
        const res = await postJson<{ passed?: boolean }>(
          '/api/quest/validate',
          {
            quest_id: questId,
            stdout,
            student_code: codeToCheck,
            ...(kind === 'project' && { step_number: step }),
          },
        );
        return res.data.passed === true;
      } catch {
        return false;
      }
    },
    [kind, questId],
  );

  /**
   * 다시 풀기 통과 → 완료 API retry (P8-05): 서버가 다시 채점해 best_stars 를 채우고 새 별에만 코인.
   * 실패해도 복습 통과 화면은 그대로 (보상만 못 받음)
   */
  const reviewWith = useCallback(
    async (submitted: string, stdout: string) => {
      try {
        const res = await postJson<QuestCompleteResponse>(
          '/api/quest/complete',
          {
            quest_id: questId,
            code_submitted: submitted,
            stdout,
            retry: true,
            had_error: hadErrorRef.current,
          },
        );
        if (res.ok) hadErrorRef.current = false;
        if (aliveRef.current && res.ok) applyCompletion(res.data);
      } catch {
        // 네트워크 오류: 별은 다음에 다시 풀면 채울 수 있음
      }
    },
    [questId, applyCompletion],
  );

  /** 통과한 코드로 완료 요청 (서버가 다시 채점하고, 힌트 수·황금키 사용은 DB 값으로 보상 계산) */
  const completeWith = useCallback(
    async (submitted: string, stdout: string) => {
      try {
        const res = await postJson<QuestCompleteResponse>(
          '/api/quest/complete',
          {
            quest_id: questId,
            code_submitted: submitted,
            stdout,
            had_error: hadErrorRef.current,
          },
        );
        if (res.ok) hadErrorRef.current = false;
        if (!aliveRef.current) return;
        if (!res.ok) {
          // 완료를 기록하지 못함 → 완료 처리하지 않고 다시 누를 수 있게 둔다 (B06)
          addSystemMessage(res.data.error ?? SAVE_FAILED_MESSAGE);
          return;
        }
        const completion = res.data;
        applyCompletion(completion);

        if (kind === 'project') {
          askTutor(
            {
              type: 'encouragement',
              quest_id: questId,
              earned_xp: completion.xp_gained,
              hints_used: completion.hints_used,
            },
            '프로젝트를 완성했어요! 정말 대단한 코딩 마법사예요! 🎉🐍🏆',
          );
          return;
        }

        fireConfetti(ANSWER_CONFETTI, { scale: particleScaleRef.current });
        // AI 피드백 (성공) → 격려 메시지, 차례로 스트리밍. 기다리지 않는다 (실행 버튼 잠금과 무관)
        void (async () => {
          try {
            const feedback = await sendTutorStreamRequest(
              {
                type: 'code_feedback',
                quest_id: questId,
                student_code: submitted,
                execution_result: { stdout, stderr: '', passed: true },
              },
              setStreamingContent,
            );
            if (!feedback) return;
            finishStreaming(feedback.message, feedback.is_fallback);
            const encourage = await sendTutorStreamRequest(
              {
                type: 'encouragement',
                quest_id: questId,
                earned_xp: completion.xp_gained,
                hints_used: completion.hints_used,
              },
              setStreamingContent,
            );
            if (!encourage) return;
            finishStreaming(encourage.message, encourage.is_fallback);
          } catch {
            finishStreaming('대단해요! 정답이에요! 🎉', true);
          }
        })();
      } catch {
        // 완료 API에 닿지 못함 (네트워크 등)
        addMessage({
          role: 'tutor',
          content:
            kind === 'project'
              ? '프로젝트를 완성했어요! 🎉🏆'
              : '대단해요! 정답이에요! 🎉',
          isFallback: true,
        });
      }
    },
    [
      kind,
      questId,
      addMessage,
      addSystemMessage,
      applyCompletion,
      askTutor,
      finishStreaming,
      sendTutorStreamRequest,
    ],
  );

  /**
   * 실행 → 채점 → (마지막 단계면) 완료. 다음 단계로 넘어가야 하면 'advance'.
   * review = 이미 완료한 퀘스트 다시 풀기 (Q57): 채점·연출은 같고 튜터는 부르지 않는다. 마지막 단계를 통과했고 복습 도전이 열렸으면
   * (별 3개 미만 + 판정 다음 날, §12-Q64) 완료 API를 retry로 불러 별을 채운다. 아니면 연습이라 부르지 않음
   */
  const runAndGrade = useCallback(
    async (
      codeToRun: string,
      step: number,
      review: boolean,
    ): Promise<'advance' | 'stay'> => {
      setValidation(null);
      setEarnedXP(null);
      setEarnedCoins(0);
      setNewStars(0);
      setSolutionCopy(false);
      setReviewRun(review);
      liveOutput.reset();
      // 모바일은 누르자마자 결과 쪽으로 (§12-Q55): 실행 중 글자·멈추기(·P11 turtle 그림)가 실행 버튼과 한 화면에 안 보이는 문제(P0-06)를
      // 떠 있는 버튼 대신 결과 쪽 자동 이동으로 푼다. 결과 쪽에는 실행 중 멈추기 버튼이 있다 (P6-11)
      setTab('result');

      const result = await runCode(codeToRun, { onStdout: liveOutput.append });
      if (!aliveRef.current) return 'stay';
      setRunResult(result);
      setLastRunCode(result.isStopped ? null : codeToRun);

      // 아이가 멈추기를 눌렀음 → 채점·피드백 없이 끝
      if (result.isStopped) return 'stay';

      // 실행 에러 (구문 에러·시간 초과 등). 효과음 'bug'는 결과 쪽지에 버그버그가 들어오는 순간 (`BugbugAside`, P6-14).
      // AI 피드백은 자동으로 부르지 않는다 (§12-Q56): 규칙표 설명(errorExplain)이 바로 보이고, 더 묻고 싶으면 askAboutRun
      if (!result.success) {
        hadErrorRef.current = true;
        return 'stay';
      }

      const passed = await validate(codeToRun, result.stdout, step);
      if (!aliveRef.current) return 'stay';
      setValidation({
        passed,
        type: steps?.[step - 1]?.validation_type ?? questValidationType,
      });

      // 출력이 다름: 결과 쪽지 견줘 보기 + 대사창이 바로 안내하고, AI 피드백은 버튼으로만 (Q56)
      if (!passed) {
        play('wrong');
        return 'stay';
      }

      // 퀘스트를 마친 통과의 'correct'는 결과 쪽지 "통과!" 도장이 닿는 순간 (`PassStamp`, P6-14). 여기서는 프로젝트 중간 단계만
      if (review) {
        fireConfetti(ANSWER_CONFETTI, { scale: particleScaleRef.current });
        if (step >= totalSteps && reviewChallenge)
          await reviewWith(codeToRun, result.stdout);
        return 'stay';
      }
      if (kind === 'project') {
        // 단계 통과 피드백 (비스트림: 곧 시작할 다음 단계 안내 스트림을 끊지 않게)
        askTutor(
          {
            type: 'code_feedback',
            quest_id: questId,
            student_code: codeToRun,
            execution_result: {
              stdout: result.stdout,
              stderr: '',
              passed: true,
            },
          },
          '대단해요! 이 단계를 통과했어요! 🎉',
        );
        if (step < totalSteps) {
          play('correct');
          return 'advance';
        }
      }

      await completeWith(codeToRun, result.stdout);
      return 'stay';
    },
    [
      kind,
      questId,
      questValidationType,
      steps,
      totalSteps,
      liveOutput,
      runCode,
      askTutor,
      validate,
      completeWith,
      reviewWith,
      reviewChallenge,
      play,
    ],
  );

  const isCodeEmpty = !code.trim();

  const handleRun = useCallback(async () => {
    if (isCodeEmpty || submittingRef.current) return;
    play('run');
    lockSubmit(true);
    let advancing = false;
    try {
      const step = stepRef.current.step;
      advancing = (await runAndGrade(code, step, isCompleted)) === 'advance';
      // 넘어갈 때까지 실행 버튼은 잠긴 채 (advanceStep 이 푼다)
      if (advancing) scheduleAdvance(step, code);
    } finally {
      if (!advancing) lockSubmit(false);
    }
  }, [
    code,
    isCodeEmpty,
    isCompleted,
    lockSubmit,
    runAndGrade,
    scheduleAdvance,
    play,
  ]);

  // ── 힌트 ────────────────────────────────────────────────────────────

  const handleHintRequest = useCallback(async () => {
    if (stepHints >= MAX_HINTS_PER_STEP || isAiLoading || isCompleted) return;

    const nextLevel = (stepHints + 1) as 1 | 2 | 3;
    // 이야기 쪽 힌트 쪽지 (P6-09). 단계가 바뀌면 그 단계 쪽지만 보인다
    const hint = { level: nextLevel, step: stepRef.current.step };
    const hintLabel: ChatMessage = {
      role: 'system',
      content: `힌트 ${nextLevel}/3`,
      hint,
    };

    play('tap');
    wroteRef.current = true;
    setMessages((prev) => [...prev, hintLabel]);
    setStepHints(nextLevel);
    setTotalHints((n) => n + 1);

    // 힌트 사용 수는 튜터 API 가 힌트 글자를 보내기 시작할 때 서버에서 기록한다 (P1-04, B05).
    // 글자를 하나도 못 받고 취소·실패했으면 서버도 세지 않았으므로 횟수를 되돌린다
    // (AI가 실패해도 서버가 저장된 힌트를 보내므로 드묾). 일부라도 받았으면 서버가 셌으므로 그대로 둔다
    let received = false;
    const undoHint = () => {
      if (received) return;
      setStepHints(nextLevel - 1);
      setTotalHints((n) => n - 1);
      setMessages((prev) => prev.filter((m) => m !== hintLabel));
    };

    try {
      const res = await sendTutorStreamRequest(
        {
          type: 'hint_generator',
          quest_id: questId,
          student_code: code,
          hint_level: nextLevel,
        },
        (text) => {
          if (text) received = true;
          setStreamingContent(text);
        },
      );
      if (!res) {
        // 다른 요청(코드 실행 등)으로 취소됨
        undoHint();
        return;
      }
      finishStreaming(res.message, res.is_fallback, false, hint);
    } catch (error) {
      undoHint();
      // 일부라도 받았으면 쪽지가 남아 있으니 실패 안내도 그 쪽지에
      finishStreaming(
        tutorFailure(error, TUTOR_UNAVAILABLE_HINT_MESSAGE).message,
        false,
        false,
        received ? hint : undefined,
      );
    }
  }, [
    stepHints,
    isAiLoading,
    isCompleted,
    questId,
    code,
    sendTutorStreamRequest,
    finishStreaming,
    play,
  ]);

  // ── 물어보기 (P6-10) ─────────────────────────────────────────────────

  const canAskWhy = !!runResult && lastRunCode === code;
  const handleAsk = useCallback(
    (question: AskQuestion) => {
      if (isAiLoading || (question === 'why' && (!canAskWhy || !runResult)))
        return;
      play('tap');
      addMessage({ role: 'student', content: ASK_QUESTIONS[question] });
      if (question === 'what') {
        // 소개(quest_intro)를 되풀이하지 않고 지금 할 일만 짧게 (P6-10 추가)
        addMessage({
          role: 'tutor',
          content: nowTodoText({
            task:
              kind === 'project' && stepGoal !== undefined
                ? stepGoal
                : quest.prompt_skeleton.exercise_description,
            expected:
              kind === 'project'
                ? undefined
                : quest.prompt_skeleton.expected_output_hint,
            step:
              kind === 'project'
                ? { n: currentStep, total: totalSteps }
                : undefined,
            runResult,
            runIsCurrent: canAskWhy,
            passed: !!validation?.passed,
            isCompleted,
          }),
        });
        return;
      }
      let req: TutorRequest;
      if (question === 'why' && runResult) {
        req = {
          type: 'code_feedback',
          quest_id: questId,
          student_code: code,
          execution_result: {
            stdout: runResult.stdout,
            stderr: runResult.success ? '' : runResult.stderr,
            passed: !!validation?.passed,
          },
        };
      } else {
        req = { type: 'concept_explain', quest_id: questId };
      }
      streamTutor(req, ASK_FAILED);
    },
    [
      isAiLoading,
      canAskWhy,
      runResult,
      validation,
      isCompleted,
      code,
      kind,
      quest,
      questId,
      stepGoal,
      currentStep,
      totalSteps,
      addMessage,
      streamTutor,
      play,
    ],
  );

  // ── 자유 질문 (P9-17) ────────────────────────────────────────────────

  /** 오늘 더 물어볼 수 있는 수 (서버가 답할 때 알려 줌, 처음엔 모름 = null) */
  const [freeRemaining, setFreeRemaining] = useState<number | null>(null);
  /**
   * 아이가 쓴 질문 보내기. 거르기는 서버가 한다(화면은 글자 수만). 내 말풍선을 먼저 띄우고 생각 중 → 답.
   * 서버가 거르면 말풍선을 거두고 안내를 돌려준다(입력 칸 아래). 답은 다 받은 뒤 거른 것이라 흘려 쓰지 않는다
   */
  const handleFreeAsk = useCallback(
    async (question: string): Promise<FreeAskResult> => {
      const text = question.trim();
      if (!text || isAiLoading) return { status: 'busy' };
      play('tap');
      const mine: ChatMessage = { role: 'student', content: text };
      const takeBack = () =>
        setMessages((prev) => prev.filter((m) => m !== mine));
      addMessage(mine);
      try {
        const res = await sendTutorRequest({
          type: 'free_question',
          quest_id: questId,
          question: text,
        });
        if (!res) {
          takeBack();
          return { status: 'busy' };
        }
        if (res.remaining !== undefined) setFreeRemaining(res.remaining);
        if (res.blocked && res.blocked !== 'wellbeing') {
          takeBack();
          return { status: 'note', message: res.message, block: res.blocked };
        }
        addMessage({
          role: 'tutor',
          content: res.message,
          isFallback: res.is_fallback,
        });
        return { status: 'sent' };
      } catch (error) {
        if (error instanceof TutorRateLimitError) {
          takeBack();
          if (error.scope === 'day') setFreeRemaining(0);
          return { status: 'note', message: error.message };
        }
        addMessage({ role: 'tutor', content: ASK_FAILED, isFallback: true });
        return { status: 'sent' };
      }
    },
    [isAiLoading, play, addMessage, sendTutorRequest, questId],
  );

  // 결과 쪽지의 "파이뱀에게 더 물어보기" (Q56): 대화를 펼치고 그 실행 결과로 묻는다
  const [askOpen, setAskOpen] = useState(false);
  const askAboutRun = useCallback(() => {
    setAskOpen(true);
    handleAsk('why');
  }, [handleAsk]);

  // ── 황금키 ──────────────────────────────────────────────────────────

  // 실행기가 준비되지 않았거나 다른 실행·채점 중이면 쓰지 않는다: 키를 차감한 뒤 정답 실행이 실패하면
  // 정답 대신 오류가 보이는데 퀘스트는 완료되던 문제 (P1-03 보고)
  const isRunnerFree = runnerStatus === 'ready' && !isRunning && !isSubmitting;
  // 휴식 알림(P8-12)은 실행·채점이 끝날 때까지 미룬다
  useRestHold(isRunning || isSubmitting);

  const handleGoldenKeyUse = useCallback(async () => {
    if (goldenKeys <= 0 || isAiLoading || isGoldenKeyLoading || isCompleted)
      return;
    if (submittingRef.current) return;
    if (!isRunnerFree) {
      addSystemMessage(RUNNER_NOT_READY_FOR_KEY);
      return;
    }

    // 확인은 화면의 황금키 확인 창(QuestHints)이 미리 받는다 (P6-09)
    const step = stepRef.current.step;

    lockSubmit(true);
    setIsGoldenKeyLoading(true);
    wroteRef.current = true;
    let advancing = false;

    try {
      const key = await postJson<GoldenKeyResponse>(
        '/api/quest/golden-key',
        kind === 'project'
          ? { quest_id: questId, current_step: step }
          : { quest_id: questId },
      );
      if (!aliveRef.current) return;
      if (!key.ok) {
        addSystemMessage(key.data.error ?? '황금키 사용에 실패했어요');
        return;
      }

      const solution = key.data.solution_code;
      setGoldenKeys(key.data.golden_keys);
      setUsedGoldenKey(true);
      // 에디터에도 정답 코드가 보인다 (CodeEditor가 바깥 값 변경을 반영)
      setCode(solution);
      addSystemMessage(
        kind === 'project'
          ? `🔑 황금키를 사용했어요! (단계 ${step}/${totalSteps})`
          : '🔑 황금키를 사용했어요!',
      );

      // 정답 코드 자동 실행
      liveOutput.reset();
      const result = await runCode(solution, { onStdout: liveOutput.append });
      if (!aliveRef.current) return;
      setRunResult(result);
      setTab('result');

      if (step < totalSteps) {
        // 중간 단계: 정답 코드로 다음 단계로 (넘어갈 때까지 실행 버튼 잠금).
        // 마지막 단계는 황금키 확인 카드가 같은 'unlock' 소리를 내므로 여기서만
        play('unlock');
        advancing = true;
        scheduleAdvance(step, solution, { confetti: false });
      } else {
        // 마지막 단계·코드 퀘스트: 자동 완료 (황금키를 쓴 퀘스트는 서버가 0 XP로 완료, B05)
        const done = await postJson<QuestCompleteResponse>(
          '/api/quest/complete',
          {
            quest_id: questId,
            code_submitted: solution,
            stdout: result.stdout,
          },
        );
        if (!aliveRef.current) return;
        if (!done.ok) throw new Error(done.data.error);
        applyCompletion(done.data);
        if (kind === 'code') {
          setValidation({ passed: true, type: questValidationType });
        }
      }

      // 해설 메시지
      finishStreaming(
        kind === 'project'
          ? `정답 코드를 살펴볼까요?\n\n\`\`\`python\n${solution}\n\`\`\`\n\n다음에는 직접 도전해보세요! 💪`
          : `정답 코드를 살펴볼까요?\n\n\`\`\`python\n${solution}\n\`\`\`\n\n이 코드는 "${topic}" 개념을 사용해요. 다음 퀘스트에서는 직접 도전해보세요! 💪`,
        false,
      );
    } catch (err) {
      addSystemMessage(
        err instanceof Error && err.message
          ? err.message
          : '황금키 사용 중 오류가 발생했어요',
      );
    } finally {
      setIsGoldenKeyLoading(false);
      if (!advancing) lockSubmit(false);
    }
  }, [
    goldenKeys,
    isAiLoading,
    isGoldenKeyLoading,
    isCompleted,
    isRunnerFree,
    kind,
    questId,
    questValidationType,
    topic,
    totalSteps,
    liveOutput,
    runCode,
    lockSubmit,
    scheduleAdvance,
    applyCompletion,
    addSystemMessage,
    finishStreaming,
    play,
  ]);

  // ── 축하 ────────────────────────────────────────────────────────────

  /** 앞에서부터 count개의 축하를 보여 줬다 */
  const dismissCelebrations = celebrationStore.dismiss;

  return {
    kind,
    quest,
    steps,
    currentStep,
    totalSteps,
    /** 방금 통과해 다음 단계로 넘어가기 직전인 단계 ("다음 단계" 박자, P6-12). 아니면 null */
    stepCleared,
    /** "다음 단계" 박자를 건너뛰고 바로 넘어간다 */
    skipStepBeat,

    code,
    setCode,
    /** "처음 코드로"가 돌아갈 코드: 이번 단계를 처음 열었을 때의 코드 (저장된 코드 제외) */
    starterCode: initialCode(quest, steps, stepState, null),
    isCodeEmpty,
    tab,
    setTab,

    runner: { status: runnerStatus, restarting, loadStage, isRunning, retry },
    runResult,
    liveOutput,
    validation,
    isSubmitting,
    handleRun,
    /** 실행 멈추기 (실행 중에만 버튼이 보임) */
    handleStop: stop,

    messages,
    streamingContent,
    isAiLoading,
    hasApiKey,
    /** "힌트 n/3"에 쓰는 이번 단계 힌트 수 */
    hintsUsed: stepHints,
    /** 보상 계산에 쓰는 누적 힌트 수 (DB hints_used와 같음) */
    totalHintsUsed: totalHints,
    handleHintRequest,
    /** "파이뱀에게 물어보기" 질문 (P6-10) */
    handleAsk,
    /** 마지막 실행 결과가 지금 코드의 것인지 ("왜 이렇게 나왔어요?") */
    canAskWhy,
    /** "파이뱀에게 물어보기" 자유 질문 (P9-17) */
    handleFreeAsk,
    /** 오늘 남은 자유 질문 수 (모르면 null) */
    freeRemaining,
    /** "파이뱀에게 물어보기" 대화가 펼쳐져 있는지 (결과 쪽지 버튼이 열 수 있게 세션에 둠) */
    askOpen,
    setAskOpen,
    /** 결과 쪽지 "파이뱀에게 더 물어보기": 대화를 열고 마지막 실행으로 code_feedback (Q56) */
    askAboutRun,

    goldenKeys,
    usedGoldenKey,
    isGoldenKeyLoading,
    /** 황금키 버튼을 막을지 (실행기가 준비되지 않았거나 실행·채점 중) */
    isGoldenKeyBlocked: !isRunnerFree,
    handleGoldenKeyUse,

    isCompleted,
    /** 완료했으면 방금 통과·예전에 통과·복습 통과 중 무엇인지 (Q57), 아니면 null */
    completion: (!isCompleted
      ? null
      : reviewRun && validation?.passed
        ? 'review'
        : justCompleted
          ? 'just'
          : 'before') as QuestCompletion | null,
    nextQuestId,
    earnedXP,
    earnedCoins,
    /** 이 퀘스트의 최고 별 (서버 best_stars, 0 = 아직 기록 없음) */
    bestStars,
    /** 복습 도전이 열려 있는지 (별 3개 미만 + 판정 다음 날 KST, 뼈대 코드에서 시작) — 아니면 다시 풀기는 연습 */
    reviewChallenge,
    /** 이번 다시 풀기로 늘어난 별 (보상 띠 "새 별 +N") */
    newStars,
    /** 황금키가 넣어 준 정답을 그대로 다시 돌려 별이 늘지 않음 */
    solutionCopy,
    userXP,
    userLevel,

    /** 아직 보여 주지 않은 축하 이벤트 (보여 줄 순서) */
    /** 축하 받은 편지함 (오버레이만 구독, P6-13) */
    celebrationStore,
    /** 지금 편지함 내용 (읽는 순간 값. 화면은 celebrationStore를 구독) */
    get celebrations(): CelebrationEvent[] {
      return celebrationStore.get();
    },
    dismissCelebrations,
  };
}

export type QuestSession = ReturnType<typeof useQuestSession>;
