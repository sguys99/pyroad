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
import type { QuestWithStage, UserProgress } from '@/lib/types/database';
import type { ChatMessage } from '@/lib/tutor/types';
import type { ValidationResult } from '@/lib/quest/validation';
import type { BadgeType } from '@/lib/quest/badges';
import { QuestHeader } from './QuestHeader';
import { ConversationPanel } from './ConversationPanel';
import { CodePanel } from './CodePanel';
import { OutputPanel } from './OutputPanel';
import { QuestStatusBar } from './QuestStatusBar';
import { LevelUpCelebration } from './LevelUpCelebration';
import { BadgeEarnedPopup } from './BadgeEarnedPopup';

type Tab = 'story' | 'code' | 'result';
type CelebrationPhase = 'idle' | 'level_up' | 'badges' | 'done';

const tabs: { key: Tab; label: string }[] = [
  { key: 'story', label: '이야기' },
  { key: 'code', label: '코드' },
  { key: 'result', label: '결과' },
];

interface QuestShellProps {
  quest: QuestWithStage;
  progress: UserProgress | null;
  userId: string;
  initialXP: number;
  initialLevel: number;
}

export function QuestShell({
  quest,
  progress,
  userId,
  initialXP,
  initialLevel,
}: QuestShellProps) {
  const [activeTab, setActiveTab] = useState<Tab>('story');
  const [code, setCode] = useState(
    progress?.code_submitted || quest.prompt_skeleton.starter_code,
  );
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [validationRes, setValidationRes] = useState<ValidationResult | null>(
    null,
  );
  const { status: pyodideStatus, runCode, isRunning, retry } = usePyodide();

  // AI 튜터 상태
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hintsUsed, setHintsUsed] = useState(progress?.hints_used ?? 0);
  const { sendTutorRequest, isLoading: isAiLoading } = useTutor();

  // 완료/XP 상태
  const [isCompleted, setIsCompleted] = useState(
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

  // 퀘스트 진입 시 quest_intro 자동 호출
  useEffect(() => {
    let cancelled = false;

    async function fetchIntro() {
      try {
        const res = await sendTutorRequest({
          type: 'quest_intro',
          quest_id: quest.id,
        });
        if (!cancelled) {
          setMessages([
            {
              role: 'tutor',
              content: res.message,
              isFallback: res.is_fallback,
            },
          ]);
        }
      } catch {
        if (!cancelled) {
          setMessages([
            {
              role: 'tutor',
              content: quest.prompt_skeleton.fallback_text,
              isFallback: true,
            },
          ]);
        }
      }
    }

    fetchIntro();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quest.id]);

  // 코드 변경 시 자동 저장 (in_progress)
  useEffect(() => {
    if (isCompleted) return;

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
            hints_used: hintsUsed,
            status: 'in_progress' as const,
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

  // 힌트 요청 핸들러
  const handleHintRequest = useCallback(async () => {
    if (hintsUsed >= 3 || isAiLoading) return;

    const nextLevel = (hintsUsed + 1) as 1 | 2 | 3;

    try {
      const res = await sendTutorRequest({
        type: 'hint_generator',
        quest_id: quest.id,
        student_code: code,
        hint_level: nextLevel,
      });
      setHintsUsed(nextLevel);
      setMessages((prev) => [
        ...prev,
        { role: 'system', content: `힌트 ${nextLevel}/3` },
        { role: 'tutor', content: res.message, isFallback: res.is_fallback },
      ]);
    } catch {
      const hintKey =
        `level_${nextLevel}` as keyof typeof quest.prompt_skeleton.hints;
      setHintsUsed(nextLevel);
      setMessages((prev) => [
        ...prev,
        { role: 'system', content: `힌트 ${nextLevel}/3` },
        {
          role: 'tutor',
          content: quest.prompt_skeleton.hints[hintKey],
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
          hints_used: nextLevel,
          code_submitted: code,
          status: 'in_progress' as const,
        },
        { onConflict: 'user_id,quest_id' },
      )
      .then();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hintsUsed, isAiLoading, quest.id, code, userId]);

  const handleRun = useCallback(async () => {
    if (isCodeEmpty || isCompleted) return;

    // 초기화
    setValidationRes(null);
    setEarnedXP(null);

    const result = await runCode(code);
    setRunResult(result);
    setActiveTab('result');

    // 실행 에러 시 (구문 에러 등)
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
            {
              role: 'tutor',
              content: res.message,
              isFallback: res.is_fallback,
            },
          ]);
        })
        .catch(() => {
          setMessages((prev) => [
            ...prev,
            {
              role: 'tutor',
              content:
                '앗, 코드에 오류가 있어요! 에러 메시지를 잘 읽어보고 다시 도전해봐요! 💪',
              isFallback: true,
            },
          ]);
        });
      return;
    }

    // 검증
    const vResult = validateResult({
      validationType: quest.validation_type,
      expectedOutput: quest.expected_output,
      stdout: result.stdout,
      studentCode: code,
    });
    setValidationRes(vResult);

    if (vResult.passed) {
      // 완료 API 호출
      try {
        const completeRes = await fetch('/api/quest/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quest_id: quest.id,
            code_submitted: code,
            hints_used: hintsUsed,
          }),
        });
        const completeData = await completeRes.json();

        if (!completeData.already_completed) {
          setEarnedXP(completeData.earned_xp);
          setUserXP(completeData.total_xp);
          setUserLevel(completeData.new_level);

          // 축하 시퀀싱
          const badges: BadgeType[] = completeData.new_badges ?? [];
          setNewBadges(badges);

          if (completeData.level_changed) {
            setLevelUpInfo({
              level: completeData.new_level,
              title: getLevelTitle(completeData.new_level),
            });
            setTimeout(() => setCelebrationPhase('level_up'), 1000);
          } else if (badges.length > 0) {
            setTimeout(() => setCelebrationPhase('badges'), 1000);
          }
        }
        setIsCompleted(true);

        // Confetti
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        });

        // AI 피드백 (성공)
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
              {
                role: 'tutor',
                content: res.message,
                isFallback: res.is_fallback,
              },
            ]);
          })
          .catch(() => {
            setMessages((prev) => [
              ...prev,
              {
                role: 'tutor',
                content: '대단해요! 정답이에요! 🎉',
                isFallback: true,
              },
            ]);
          });

        // 격려 메시지
        sendTutorRequest({
          type: 'encouragement',
          quest_id: quest.id,
          earned_xp: completeData.earned_xp,
          hints_used: hintsUsed,
        })
          .then((res) => {
            setMessages((prev) => [
              ...prev,
              {
                role: 'tutor',
                content: res.message,
                isFallback: res.is_fallback,
              },
            ]);
          })
          .catch(() => {
            setMessages((prev) => [
              ...prev,
              {
                role: 'tutor',
                content: '퀘스트를 완료했어요! 정말 대단해요! 🎉🐍',
                isFallback: true,
              },
            ]);
          });
      } catch {
        // 완료 API 실패 시에도 UI는 업데이트
        setMessages((prev) => [
          ...prev,
          {
            role: 'tutor',
            content: '대단해요! 정답이에요! 🎉',
            isFallback: true,
          },
        ]);
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
            {
              role: 'tutor',
              content: res.message,
              isFallback: res.is_fallback,
            },
          ]);
        })
        .catch(() => {
          setMessages((prev) => [
            ...prev,
            {
              role: 'tutor',
              content:
                '앗, 조금 고쳐볼까요? 힌트를 사용해보세요! 💡',
              isFallback: true,
            },
          ]);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, isCodeEmpty, isCompleted, runCode, quest, hintsUsed]);

  return (
    <div className="flex h-dvh flex-col bg-background">
      <QuestHeader
        stageTitle={quest.stage.title}
        stageOrder={quest.stage.order}
        questTitle={quest.title}
      />

      {/* 완료 배너 */}
      {isCompleted && (
        <div className="bg-primary/10 px-4 py-2 text-center text-sm font-medium text-primary">
          이미 완료한 퀘스트예요!{' '}
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
            hintsUsed={hintsUsed}
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
              initialCode={
                progress?.code_submitted ||
                quest.prompt_skeleton.starter_code
              }
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
        hintsUsed={hintsUsed}
        earnedXP={earnedXP}
      />

      {/* 축하 오버레이 */}
      <AnimatePresence>
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
