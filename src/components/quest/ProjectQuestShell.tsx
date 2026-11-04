'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { usePyodide } from '@/lib/pyodide/usePyodide';
import { useTutor } from '@/lib/tutor/useTutor';
import { TUTOR_UNAVAILABLE_HINT_MESSAGE } from '@/lib/tutor/messages';
import { loadBrowserClient } from '@/lib/supabase/loadClient';
import { fireConfetti } from '@/lib/confetti';
import { getLevelTitle } from '@/lib/quest/xp';
import { levelChanged, type QuestCompleteResponse } from '@/lib/quest/rewards';
import type { BadgeType } from '@/lib/quest/badges';
import type { RunResult } from '@/lib/pyodide/usePyodide';
import type {
  QuestWithStage,
  UserProgress,
  ProjectStep,
} from '@/lib/types/database';
import type { ChatMessage } from '@/lib/tutor/types';
import type { ValidationResult } from '@/lib/quest/validation';
import { QuestHeader } from './QuestHeader';
import { ConversationPanel } from './ConversationPanel';
import { CodePanel } from './CodePanel';
import { OutputPanel } from './OutputPanel';
import { QuestStatusBar } from './QuestStatusBar';
import { StepProgressBar } from './StepProgressBar';
import { LevelUpCelebration } from './celebrations/LevelUpCelebration';
import { BadgeEarnedPopup } from './celebrations/BadgeEarnedPopup';
import { ProjectCompleteCelebration } from './celebrations/ProjectCompleteCelebration';
import { ApiKeyBanner } from './ApiKeyBanner';

type Tab = 'story' | 'code' | 'result';
type CelebrationPhase =
  | 'idle'
  | 'project_complete'
  | 'level_up'
  | 'badges'
  | 'done';

const tabs: { key: Tab; label: string }[] = [
  { key: 'story', label: '이야기' },
  { key: 'code', label: '코드' },
  { key: 'result', label: '결과' },
];

interface ProjectQuestShellProps {
  quest: QuestWithStage;
  progress: UserProgress | null;
  userId: string;
  initialXP: number;
  initialLevel: number;
  initialGoldenKeys: number;
}

export function ProjectQuestShell({
  quest,
  progress,
  userId,
  initialXP,
  initialLevel,
  initialGoldenKeys,
}: ProjectQuestShellProps) {
  const steps = quest.prompt_skeleton.steps!;
  const totalSteps = steps.length;

  // 진행 상태 복원
  const initialStep = progress?.current_step ?? 1;
  const initialSubmissions: Record<string, string> =
    progress?.step_submissions ?? {};

  const [currentStep, setCurrentStep] = useState(initialStep);
  const [stepSubmissions, setStepSubmissions] =
    useState<Record<string, string>>(initialSubmissions);

  const currentStepDef = steps[currentStep - 1];

  // 현재 단계의 초기 코드 결정: 이전 저장 코드 > 이전 단계 코드 + starter > starter
  const getInitialCode = useCallback(() => {
    // 이전에 저장된 코드가 있으면 복원
    if (progress?.code_submitted && currentStep === initialStep) {
      return progress.code_submitted;
    }
    // 이전 단계 코드 위에 누적
    const prevCode = stepSubmissions[String(currentStep - 1)] ?? '';
    const starter = currentStepDef.starter_code;
    if (prevCode && starter) return prevCode + '\n' + starter;
    if (prevCode) return prevCode;
    return starter;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  const [activeTab, setActiveTab] = useState<Tab>('story');
  const [code, setCode] = useState(getInitialCode);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [validationRes, setValidationRes] = useState<ValidationResult | null>(
    null,
  );
  const { status: pyodideStatus, runCode, isRunning, retry } = usePyodide();

  // AI 튜터 상태
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [stepHintsUsed, setStepHintsUsed] = useState(0);
  const [totalHintsUsed, setTotalHintsUsed] = useState(
    progress?.hints_used ?? 0,
  );
  const [streamingContent, setStreamingContent] = useState('');
  const { sendTutorRequest, sendTutorStreamRequest, isLoading: isAiLoading, setIsLoading, hasApiKey } = useTutor();

  /** 스트리밍 완료 후 상태를 일괄 정리하는 헬퍼 */
  const finishStreaming = useCallback((message: string, isFallback: boolean) => {
    setStreamingContent('');
    setIsLoading(false);
    setMessages((prev) => [...prev, { role: 'tutor', content: message, isFallback }]);
  }, [setIsLoading]);

  // 완료/XP 상태
  const [isProjectComplete, setIsProjectComplete] = useState(
    progress?.status === 'completed',
  );
  const [earnedXP, setEarnedXP] = useState<number | null>(null);
  const [userXP, setUserXP] = useState(initialXP);
  const [userLevel, setUserLevel] = useState(initialLevel);

  // 축하 시퀀싱
  const [celebrationPhase, setCelebrationPhase] =
    useState<CelebrationPhase>('idle');
  const [levelUpInfo, setLevelUpInfo] = useState<{
    level: number;
    title: string;
  } | null>(null);
  const [newBadges, setNewBadges] = useState<BadgeType[]>([]);

  // 황금키 상태
  const [goldenKeys, setGoldenKeys] = useState(initialGoldenKeys);
  const [isGoldenKeyLoading, setIsGoldenKeyLoading] = useState(false);

  // 실행·채점·완료 요청 중복 방지 (B06). ref 는 렌더 전 연속 클릭도 막고, state 는 버튼 표시용.
  // 단계를 통과하면 다음 단계로 넘어갈 때(advanceToNextStep)까지 잠가 둔다 (같은 단계를 두 번 넘기지 않게)
  const submittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const lockSubmit = useCallback((locked: boolean) => {
    submittingRef.current = locked;
    setIsSubmitting(locked);
  }, []);

  // 코드 자동 저장 debounce
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isCodeEmpty = !code.trim();

  // 단계 진입 시 project_guide 호출
  useEffect(() => {
    let cancelled = false;

    async function fetchGuide() {
      const prevCode = currentStep > 1 ? (stepSubmissions[String(currentStep - 1)] ?? '') : '';

      setMessages((prev) => [
        ...prev,
        { role: 'system', content: `단계 ${currentStep}/${totalSteps}: ${currentStepDef.step_goal}` },
      ]);

      try {
        const res = await sendTutorStreamRequest(
          {
            type: 'project_guide',
            quest_id: quest.id,
            current_step: currentStep,
            total_steps: totalSteps,
            step_goal: currentStepDef.step_goal,
            previous_code: prevCode,
          },
          (text) => { if (!cancelled) setStreamingContent(text); },
        );
        // null: 퀘스트를 떠나 요청이 취소됨 → 아무것도 하지 않음
        if (res && !cancelled) {
          finishStreaming(res.message, res.is_fallback);
        }
      } catch {
        if (!cancelled) {
          finishStreaming(currentStepDef.fallback_text, true);
        }
      }
    }

    if (!isProjectComplete) {
      fetchGuide();
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, quest.id]);

  // 코드 변경 시 자동 저장. 진행 저장 컬럼만 보낸다 (P1-04: 상태·힌트 수는 서버만 씀,
  // 처음 만드는 행의 status 는 DB 기본값 in_progress)
  useEffect(() => {
    if (isProjectComplete) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      loadBrowserClient().then((supabase) => {
        supabase
          .from('user_progress')
          .upsert(
            {
              user_id: userId,
              quest_id: quest.id,
              code_submitted: code,
              current_step: currentStep,
              step_submissions: stepSubmissions,
            },
            { onConflict: 'user_id,quest_id' },
          )
          .then();
      });
    }, 2000);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // 힌트 요청 핸들러 (단계별 3회 리셋)
  const handleHintRequest = useCallback(async () => {
    if (stepHintsUsed >= 3 || isAiLoading || isProjectComplete) return;

    const nextLevel = (stepHintsUsed + 1) as 1 | 2 | 3;
    const hintLabel: ChatMessage = { role: 'system', content: `힌트 ${nextLevel}/3` };

    setMessages((prev) => [...prev, hintLabel]);
    setStepHintsUsed(nextLevel);
    setTotalHintsUsed((prev) => prev + 1);

    // 힌트 사용 수는 튜터 API 가 힌트 글자를 보내기 시작할 때 서버에서 기록한다 (P1-04, B05. 프로젝트는 누적 횟수).
    // 글자를 하나도 못 받고 취소·실패했으면 서버도 세지 않았으므로 횟수를 되돌린다
    // (AI가 실패해도 서버가 저장된 힌트를 보내므로 드묾). 일부라도 받았으면 서버가 셌으므로 그대로 둔다
    let received = false;
    const undoHint = () => {
      if (received) return;
      setStepHintsUsed(nextLevel - 1);
      setTotalHintsUsed((prev) => prev - 1);
      setMessages((prev) => prev.filter((m) => m !== hintLabel));
    };

    try {
      const res = await sendTutorStreamRequest(
        {
          type: 'hint_generator',
          quest_id: quest.id,
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
      finishStreaming(res.message, res.is_fallback);
    } catch {
      undoHint();
      finishStreaming(TUTOR_UNAVAILABLE_HINT_MESSAGE, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepHintsUsed, isAiLoading, isProjectComplete, quest.id, code]);

  // 황금키 사용 핸들러 (프로젝트 퀘스트: 현재 단계의 정답만 제공)
  const handleGoldenKeyUse = useCallback(async () => {
    if (goldenKeys <= 0 || isAiLoading || isGoldenKeyLoading || isProjectComplete) return;

    const confirmed = window.confirm(
      '황금키를 사용하면 이 단계의 정답이 공개되고 XP를 받을 수 없어요. 사용할까요?',
    );
    if (!confirmed) return;

    setIsGoldenKeyLoading(true);

    try {
      const res = await fetch('/api/quest/golden-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quest_id: quest.id,
          current_step: currentStep,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: 'system', content: data.error ?? '황금키 사용에 실패했어요' },
        ]);
        return;
      }

      setGoldenKeys(data.golden_keys);
      setCode(data.solution_code);

      setMessages((prev) => [
        ...prev,
        { role: 'system', content: `🔑 황금키를 사용했어요! (단계 ${currentStep}/${totalSteps})` },
      ]);

      // 정답 코드 자동 실행
      const result = await runCode(data.solution_code);
      setRunResult(result);
      setActiveTab('result');

      const isLastStep = currentStep === totalSteps;

      if (isLastStep) {
        // 최종 단계: 자동 완료 (황금키를 쓴 퀘스트는 서버가 0 XP로 완료, B05)
        const completeRes = await fetch('/api/quest/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quest_id: quest.id,
            code_submitted: data.solution_code,
            stdout: result.stdout,
          }),
        });
        const completeData = await completeRes.json();
        if (!completeRes.ok) {
          throw new Error(completeData.error);
        }
        const completion = completeData as QuestCompleteResponse;

        if (!completion.already_completed) {
          setEarnedXP(completion.xp_gained);
          setUserXP(completion.total_xp);
          setUserLevel(completion.level_after);
        }
        setGoldenKeys(completion.golden_keys);
        setIsProjectComplete(true);
      } else {
        // 중간 단계: 다음 단계로 진행 (넘어갈 때까지 실행 버튼 잠금)
        lockSubmit(true);
        setTimeout(() => advanceToNextStep(), 1500);
      }

      // 해설 메시지
      finishStreaming(
        `정답 코드를 살펴볼까요?\n\n\`\`\`python\n${data.solution_code}\n\`\`\`\n\n다음에는 직접 도전해보세요! 💪`,
        false,
      );

      // Confetti (황금키 전용)
      fireConfetti({
        particleCount: 40,
        spread: 50,
        origin: { y: 0.6 },
        ticks: 60,
        colors: ['#FFD700', '#FFA500', '#FF8C00'],
      });
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'system',
          content:
            err instanceof Error && err.message
              ? err.message
              : '황금키 사용 중 오류가 발생했어요',
        },
      ]);
    } finally {
      setIsGoldenKeyLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goldenKeys, isAiLoading, isGoldenKeyLoading, isProjectComplete, quest.id, currentStep, totalSteps, runCode]);

  // 다음 단계로 진행
  const advanceToNextStep = useCallback(() => {
    // 현재 코드를 이 단계의 submission으로 저장
    const updatedSubmissions = { ...stepSubmissions, [String(currentStep)]: code };
    setStepSubmissions(updatedSubmissions);

    const nextStep = currentStep + 1;
    const nextStepDef = steps[nextStep - 1];

    // 다음 단계 코드: 현재 코드 + 다음 단계 starter
    const nextCode = nextStepDef.starter_code
      ? code + '\n' + nextStepDef.starter_code
      : code;

    setCurrentStep(nextStep);
    setCode(nextCode);
    setRunResult(null);
    setValidationRes(null);
    setStepHintsUsed(0);
    lockSubmit(false);

    // 미니 confetti
    fireConfetti({
      particleCount: 40,
      spread: 50,
      origin: { y: 0.7 },
      ticks: 90,
      gravity: 2.2,
      startVelocity: 70,
    });

    // DB 저장
    loadBrowserClient().then((supabase) => {
      supabase
        .from('user_progress')
        .upsert(
          {
            user_id: userId,
            quest_id: quest.id,
            code_submitted: nextCode,
            current_step: nextStep,
            step_submissions: updatedSubmissions,
          },
          { onConflict: 'user_id,quest_id' },
        )
        .then();
    });
  }, [currentStep, code, stepSubmissions, steps, userId, quest.id, lockSubmit]);

  const handleRun = useCallback(async () => {
    if (isCodeEmpty || isProjectComplete || submittingRef.current) return;
    lockSubmit(true);
    let advancing = false;
    try {
      advancing = await runAndSubmit();
    } finally {
      // 다음 단계로 넘어가는 중이면 advanceToNextStep 이 잠금을 푼다
      if (!advancing) lockSubmit(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, isCodeEmpty, isProjectComplete, runCode, quest, currentStep, totalSteps, totalHintsUsed, currentStepDef, advanceToNextStep, lockSubmit]);

  // 실행 → 채점 → (마지막 단계면) 완료. 다음 단계로 넘어가기로 했으면 true
  async function runAndSubmit(): Promise<boolean> {
    setValidationRes(null);
    setEarnedXP(null);

    const result = await runCode(code);
    setRunResult(result);
    setActiveTab('result');

    // 실행 에러 시
    if (!result.success) {
      sendTutorStreamRequest(
        {
          type: 'code_feedback',
          quest_id: quest.id,
          student_code: code,
          execution_result: {
            stdout: result.stdout,
            stderr: result.stderr,
            passed: false,
          },
        },
        setStreamingContent,
      )
        .then((res) => {
          if (res) finishStreaming(res.message, res.is_fallback);
        })
        .catch(() => {
          finishStreaming('앗, 코드에 오류가 있어요! 에러 메시지를 잘 읽어보고 다시 도전해봐요! 💪', true);
        });
      return false;
    }

    // 서버 사이드 검증
    let vResult: ValidationResult;
    try {
      const validateRes = await fetch('/api/quest/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quest_id: quest.id,
          stdout: result.stdout,
          student_code: code,
          step_number: currentStep,
        }),
      });
      const validateData = await validateRes.json();
      vResult = { passed: validateData.passed, type: currentStepDef.validation_type };
    } catch {
      vResult = { passed: false, type: currentStepDef.validation_type };
    }
    setValidationRes(vResult);

    if (vResult.passed) {
      const isLastStep = currentStep === totalSteps;

      // 성공 피드백
      sendTutorRequest({
        type: 'code_feedback',
        quest_id: quest.id,
        student_code: code,
        execution_result: {
          stdout: result.stdout,
          stderr: '',
          passed: true,
        },
      })
        .then((res) => {
          if (!res) return;
          setMessages((prev) => [
            ...prev,
            { role: 'tutor', content: res.message, isFallback: res.is_fallback },
          ]);
        })
        .catch(() => {
          setMessages((prev) => [
            ...prev,
            { role: 'tutor', content: '대단해요! 이 단계를 통과했어요! 🎉', isFallback: true },
          ]);
        });

      if (isLastStep) {
        // 프로젝트 완료! (서버가 마지막 단계 기준으로 다시 채점하고, 힌트 수·황금키 사용은 DB 값으로 보상 계산)
        try {
          const completeRes = await fetch('/api/quest/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              quest_id: quest.id,
              code_submitted: code,
              stdout: result.stdout,
            }),
          });
          const completeData = await completeRes.json();
          if (!completeRes.ok) {
            // 완료를 기록하지 못함 → 완료 처리하지 않고 다시 누를 수 있게 둔다 (B06)
            setMessages((prev) => [
              ...prev,
              {
                role: 'system',
                content:
                  completeData.error ??
                  '앗, 기록을 저장하지 못했어요. 한 번 더 눌러 볼까요?',
              },
            ]);
            return false;
          }
          const completion = completeData as QuestCompleteResponse;

          setGoldenKeys(completion.golden_keys);
          if (!completion.already_completed) {
            setEarnedXP(completion.xp_gained);
            setUserXP(completion.total_xp);
            setUserLevel(completion.level_after);

            setNewBadges(completion.new_badges);

            // 축하 시퀀싱: project_complete → level_up → badges
            setTimeout(() => setCelebrationPhase('project_complete'), 500);
            setLevelUpInfo(
              levelChanged(completion)
                ? {
                    level: completion.level_after,
                    title: getLevelTitle(completion.level_after),
                  }
                : null,
            );
          }
          setIsProjectComplete(true);

          // 격려 메시지
          sendTutorRequest({
            type: 'encouragement',
            quest_id: quest.id,
            earned_xp: completion.xp_gained,
            hints_used: completion.hints_used,
          })
            .then((res) => {
              if (!res) return;
              setMessages((prev) => [
                ...prev,
                { role: 'tutor', content: res.message, isFallback: res.is_fallback },
              ]);
            })
            .catch(() => {
              setMessages((prev) => [
                ...prev,
                {
                  role: 'tutor',
                  content: '프로젝트를 완성했어요! 정말 대단한 코딩 마법사예요! 🎉🐍🏆',
                  isFallback: true,
                },
              ]);
            });
        } catch {
          setMessages((prev) => [
            ...prev,
            { role: 'tutor', content: '프로젝트를 완성했어요! 🎉🏆', isFallback: true },
          ]);
        }
      } else {
        // 다음 단계로 진행 (넘어갈 때까지 실행 버튼 잠금)
        setTimeout(advanceToNextStep, 1500);
        return true;
      }
    } else {
      // 검증 실패
      sendTutorStreamRequest(
        {
          type: 'code_feedback',
          quest_id: quest.id,
          student_code: code,
          execution_result: {
            stdout: result.stdout,
            stderr: '',
            passed: false,
          },
        },
        setStreamingContent,
      )
        .then((res) => {
          if (res) finishStreaming(res.message, res.is_fallback);
        })
        .catch(() => {
          finishStreaming('앗, 조금 고쳐볼까요? 힌트를 사용해보세요! 💡', true);
        });
    }
    return false;
  }

  return (
    <div className="flex h-dvh flex-col bg-background">
      <QuestHeader
        stageTitle={quest.stage.title}
        stageOrder={quest.stage.order}
        questTitle={quest.title}
      />

      {/* 단계 프로그레스 바 */}
      <StepProgressBar
        currentStep={currentStep}
        totalSteps={totalSteps}
        stepGoals={steps.map((s: ProjectStep) => s.step_goal)}
      />

      {/* API 키 미설정 배너 */}
      {hasApiKey === false && <ApiKeyBanner />}

      {/* 완료 배너 */}
      {isProjectComplete && (
        <div className="bg-primary/10 px-4 py-2 text-center text-sm font-medium text-primary">
          프로젝트를 완성했어요!{' '}
          <a href="/world" className="underline">
            월드맵으로 돌아가기
          </a>
        </div>
      )}

      {/* 모바일 탭 바 */}
      <div className="flex border-b border-border md:hidden">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex-1 py-3 text-center text-sm font-medium transition-colors min-h-[44px]',
              activeTab === tab.key
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 콘텐츠 영역 */}
      <div className="flex-1 overflow-hidden md:grid md:grid-cols-2">
        {/* 대화 패널 */}
        <div
          className={cn(
            'h-full overflow-y-auto border-r border-border',
            activeTab !== 'story' && 'hidden md:block',
          )}
        >
          <ConversationPanel
            promptSkeleton={quest.prompt_skeleton}
            messages={messages}
            isAiLoading={isAiLoading}
            streamingContent={streamingContent}
            hintsUsed={stepHintsUsed}
            onHintRequest={handleHintRequest}
            goldenKeys={goldenKeys}
            onGoldenKeyUse={handleGoldenKeyUse}
            isGoldenKeyLoading={isGoldenKeyLoading}
          />
        </div>

        {/* 코드+결과 패널 */}
        <div
          className={cn(
            'h-full overflow-y-auto',
            activeTab === 'story' && 'hidden md:block',
          )}
        >
          <div className={cn(activeTab === 'result' && 'hidden md:block')}>
            <CodePanel
              initialCode={code}
              onCodeChange={setCode}
              pyodideStatus={pyodideStatus}
              isRunning={isRunning}
              isSubmitting={isSubmitting || isGoldenKeyLoading}
              onRun={handleRun}
              onRetry={retry}
              runResult={runResult}
              isCodeEmpty={isCodeEmpty}
              validationResult={validationRes}
            />
          </div>

          {/* 모바일 결과 전용 뷰 */}
          <div
            className={cn('p-4 md:hidden', activeTab !== 'result' && 'hidden')}
          >
            <OutputPanel
              result={runResult}
              isRunning={isRunning}
              validationResult={validationRes}
            />
          </div>
        </div>
      </div>

      {/* 하단 상태바 */}
      <QuestStatusBar
        xp={userXP}
        level={userLevel}
        hintsUsed={totalHintsUsed}
        earnedXP={earnedXP}
      />

      {/* 축하 오버레이 */}
      <AnimatePresence>
        {celebrationPhase === 'project_complete' && earnedXP != null && (
          <ProjectCompleteCelebration
            earnedXP={earnedXP}
            questName={quest.title}
            onClose={() =>
              setCelebrationPhase(
                levelUpInfo ? 'level_up' : newBadges.length > 0 ? 'badges' : 'done',
              )
            }
          />
        )}
        {celebrationPhase === 'level_up' && levelUpInfo && (
          <LevelUpCelebration
            newLevel={levelUpInfo.level}
            newTitle={levelUpInfo.title}
            onClose={() =>
              setCelebrationPhase(newBadges.length > 0 ? 'badges' : 'done')
            }
          />
        )}
        {celebrationPhase === 'badges' && newBadges.length > 0 && (
          <BadgeEarnedPopup
            badges={newBadges}
            onComplete={() => setCelebrationPhase('done')}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
