'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { usePyodide } from '@/lib/pyodide/usePyodide';
import { useTutor } from '@/lib/tutor/useTutor';
import { createClient } from '@/lib/supabase/client';
import { validateResult } from '@/lib/quest/validation';
import { getLevelTitle } from '@/lib/quest/xp';
import type { RunResult } from '@/lib/pyodide/usePyodide';
import type {
  QuestWithStage,
  UserProgress,
  ProjectStep,
} from '@/lib/types/database';
import type { ChatMessage } from '@/lib/tutor/types';
import type { ValidationResult } from '@/lib/quest/validation';
import type { BadgeType } from '@/lib/quest/badges';
import { QuestHeader } from './QuestHeader';
import { ConversationPanel } from './ConversationPanel';
import { CodePanel } from './CodePanel';
import { OutputPanel } from './OutputPanel';
import { QuestStatusBar } from './QuestStatusBar';
import { StepProgressBar } from './StepProgressBar';
import { LevelUpCelebration } from './LevelUpCelebration';
import { BadgeEarnedPopup } from './BadgeEarnedPopup';
import { ProjectCompleteCelebration } from './ProjectCompleteCelebration';

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
}

export function ProjectQuestShell({
  quest,
  progress,
  userId,
  initialXP,
  initialLevel,
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
  const { sendTutorRequest, isLoading: isAiLoading } = useTutor();

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

  // 코드 자동 저장 debounce
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isCodeEmpty = !code.trim();

  // 단계 진입 시 project_guide 호출
  useEffect(() => {
    let cancelled = false;

    async function fetchGuide() {
      const prevCode = currentStep > 1 ? (stepSubmissions[String(currentStep - 1)] ?? '') : '';

      try {
        const res = await sendTutorRequest({
          type: 'project_guide',
          quest_id: quest.id,
          current_step: currentStep,
          total_steps: totalSteps,
          step_goal: currentStepDef.step_goal,
          previous_code: prevCode,
        });
        if (!cancelled) {
          setMessages((prev) => [
            ...prev,
            { role: 'system', content: `단계 ${currentStep}/${totalSteps}: ${currentStepDef.step_goal}` },
            { role: 'tutor', content: res.message, isFallback: res.is_fallback },
          ]);
        }
      } catch {
        if (!cancelled) {
          setMessages((prev) => [
            ...prev,
            { role: 'system', content: `단계 ${currentStep}/${totalSteps}: ${currentStepDef.step_goal}` },
            { role: 'tutor', content: currentStepDef.fallback_text, isFallback: true },
          ]);
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

  // 코드 변경 시 자동 저장
  useEffect(() => {
    if (isProjectComplete) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const supabase = createClient();
      supabase
        .from('user_progress')
        .upsert(
          {
            user_id: userId,
            quest_id: quest.id,
            code_submitted: code,
            hints_used: totalHintsUsed,
            status: 'in_progress' as const,
            current_step: currentStep,
            step_submissions: stepSubmissions,
          },
          { onConflict: 'user_id,quest_id' },
        )
        .then();
    }, 2000);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // 힌트 요청 핸들러 (단계별 3회 리셋)
  const handleHintRequest = useCallback(async () => {
    if (stepHintsUsed >= 3 || isAiLoading) return;

    const nextLevel = (stepHintsUsed + 1) as 1 | 2 | 3;

    try {
      const res = await sendTutorRequest({
        type: 'hint_generator',
        quest_id: quest.id,
        student_code: code,
        hint_level: nextLevel,
      });
      setStepHintsUsed(nextLevel);
      setTotalHintsUsed((prev) => prev + 1);
      setMessages((prev) => [
        ...prev,
        { role: 'system', content: `힌트 ${nextLevel}/3` },
        { role: 'tutor', content: res.message, isFallback: res.is_fallback },
      ]);
    } catch {
      const hintKey =
        `level_${nextLevel}` as keyof typeof currentStepDef.hints;
      setStepHintsUsed(nextLevel);
      setTotalHintsUsed((prev) => prev + 1);
      setMessages((prev) => [
        ...prev,
        { role: 'system', content: `힌트 ${nextLevel}/3` },
        {
          role: 'tutor',
          content: currentStepDef.hints[hintKey],
          isFallback: true,
        },
      ]);
    }

    // DB 저장 (fire-and-forget)
    const supabase = createClient();
    supabase
      .from('user_progress')
      .upsert(
        {
          user_id: userId,
          quest_id: quest.id,
          hints_used: totalHintsUsed + 1,
          code_submitted: code,
          status: 'in_progress' as const,
          current_step: currentStep,
          step_submissions: stepSubmissions,
        },
        { onConflict: 'user_id,quest_id' },
      )
      .then();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepHintsUsed, isAiLoading, quest.id, code, userId, currentStep, totalHintsUsed]);

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

    // 미니 confetti
    confetti({
      particleCount: 40,
      spread: 50,
      origin: { y: 0.7 },
    });

    // DB 저장
    const supabase = createClient();
    supabase
      .from('user_progress')
      .upsert(
        {
          user_id: userId,
          quest_id: quest.id,
          code_submitted: nextCode,
          hints_used: totalHintsUsed,
          status: 'in_progress' as const,
          current_step: nextStep,
          step_submissions: updatedSubmissions,
        },
        { onConflict: 'user_id,quest_id' },
      )
      .then();
  }, [currentStep, code, stepSubmissions, steps, userId, quest.id, totalHintsUsed]);

  const handleRun = useCallback(async () => {
    if (isCodeEmpty || isProjectComplete) return;

    setValidationRes(null);
    setEarnedXP(null);

    const result = await runCode(code);
    setRunResult(result);
    setActiveTab('result');

    // 실행 에러 시
    if (!result.success) {
      sendTutorRequest({
        type: 'code_feedback',
        quest_id: quest.id,
        student_code: code,
        execution_result: {
          stdout: result.stdout,
          stderr: result.stderr,
          passed: false,
        },
      })
        .then((res) => {
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
              content: '앗, 코드에 오류가 있어요! 에러 메시지를 잘 읽어보고 다시 도전해봐요! 💪',
              isFallback: true,
            },
          ]);
        });
      return;
    }

    // 현재 단계 기준 검증
    const vResult = validateResult({
      validationType: currentStepDef.validation_type,
      expectedOutput: currentStepDef.expected_output,
      stdout: result.stdout,
      studentCode: code,
    });
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
        // 프로젝트 완료!
        try {
          const completeRes = await fetch('/api/quest/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              quest_id: quest.id,
              code_submitted: code,
              hints_used: totalHintsUsed,
            }),
          });
          const completeData = await completeRes.json();

          if (!completeData.already_completed) {
            setEarnedXP(completeData.earned_xp);
            setUserXP(completeData.total_xp);
            setUserLevel(completeData.new_level);

            const badges: BadgeType[] = completeData.new_badges ?? [];
            setNewBadges(badges);

            // 축하 시퀀싱: project_complete → level_up → badges
            setTimeout(() => setCelebrationPhase('project_complete'), 500);
            setLevelUpInfo(
              completeData.level_changed
                ? {
                    level: completeData.new_level,
                    title: getLevelTitle(completeData.new_level),
                  }
                : null,
            );
          }
          setIsProjectComplete(true);

          // 격려 메시지
          sendTutorRequest({
            type: 'encouragement',
            quest_id: quest.id,
            earned_xp: completeData.earned_xp,
            hints_used: totalHintsUsed,
          })
            .then((res) => {
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
        // 다음 단계로 진행
        setTimeout(advanceToNextStep, 1500);
      }
    } else {
      // 검증 실패
      sendTutorRequest({
        type: 'code_feedback',
        quest_id: quest.id,
        student_code: code,
        execution_result: {
          stdout: result.stdout,
          stderr: '',
          passed: false,
        },
      })
        .then((res) => {
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
              content: '앗, 조금 고쳐볼까요? 힌트를 사용해보세요! 💡',
              isFallback: true,
            },
          ]);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, isCodeEmpty, isProjectComplete, runCode, quest, currentStep, totalSteps, totalHintsUsed, currentStepDef, advanceToNextStep]);

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
            hintsUsed={stepHintsUsed}
            onHintRequest={handleHintRequest}
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
