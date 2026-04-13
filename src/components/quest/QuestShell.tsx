'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { usePyodide } from '@/lib/pyodide/usePyodide';
import { useTutor } from '@/lib/tutor/useTutor';
import { createClient } from '@/lib/supabase/client';
import { getLevelTitle } from '@/lib/quest/xp';
import type { RunResult } from '@/lib/pyodide/usePyodide';
import type { QuestWithStage, UserProgress } from '@/lib/types/database';
import type { ChatMessage } from '@/lib/tutor/types';
import type { ValidationResult } from '@/lib/quest/validation';
import type { BadgeType } from '@/lib/quest/badges';
import { Button } from '@/components/ui/button';
import { QuestHeader } from './QuestHeader';
import { ConversationPanel } from './ConversationPanel';
import { CodePanel } from './CodePanel';
import { OutputPanel } from './OutputPanel';
import { QuestStatusBar } from './QuestStatusBar';
import { LevelUpCelebration } from './celebrations/LevelUpCelebration';
import { StageCompleteCelebration } from './celebrations/StageCompleteCelebration';

// canvas-confetti 모듈 사전 로드 (브라우저에서만)
const confettiReady =
  typeof window !== 'undefined'
    ? import('canvas-confetti').then((m) => m.default)
    : null;
import { BadgeEarnedPopup } from './celebrations/BadgeEarnedPopup';
import { ApiKeyBanner } from './ApiKeyBanner';

type Tab = 'story' | 'code' | 'result';
type CelebrationPhase = 'idle' | 'stage_complete' | 'level_up' | 'badges' | 'done';

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
  initialGoldenKeys: number;
}

export function QuestShell({
  quest,
  progress,
  userId,
  initialXP,
  initialLevel,
  initialGoldenKeys,
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
  const [streamingContent, setStreamingContent] = useState('');
  const { sendTutorStreamRequest, isLoading: isAiLoading, setIsLoading, hasApiKey } = useTutor();

  /** 스트리밍 완료 후 상태를 일괄 정리하는 헬퍼 */
  const finishStreaming = useCallback((message: string, isFallback: boolean, replace = false) => {
    // React 18 auto-batching: 이 3개의 setState가 단일 렌더로 처리됨
    setStreamingContent('');
    setIsLoading(false);
    if (replace) {
      setMessages([{ role: 'tutor', content: message, isFallback }]);
    } else {
      setMessages((prev) => [...prev, { role: 'tutor', content: message, isFallback }]);
    }
  }, [setIsLoading]);

  // 완료/XP 상태
  const [isCompleted, setIsCompleted] = useState(
    progress?.status === 'completed',
  );
  const [nextQuestId, setNextQuestId] = useState<string | null>(null);
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
  const [stageCompleteInfo, setStageCompleteInfo] = useState<{
    stageTitle: string;
    stageOrder: number;
    concepts: string[];
  } | null>(null);

  // 황금키 상태
  const [goldenKeys, setGoldenKeys] = useState(initialGoldenKeys);
  const [isGoldenKeyLoading, setIsGoldenKeyLoading] = useState(false);

  // 코드 자동 저장 debounce
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isCodeEmpty = !code.trim();

  // 퀘스트 진입 시 quest_intro 자동 호출
  useEffect(() => {
    let cancelled = false;

    async function fetchIntro() {
      try {
        const res = await sendTutorStreamRequest(
          { type: 'quest_intro', quest_id: quest.id },
          (text) => { if (!cancelled) setStreamingContent(text); },
        );
        if (!cancelled) {
          finishStreaming(res.message, res.is_fallback, true);
        }
      } catch {
        if (!cancelled) {
          finishStreaming(quest.prompt_skeleton.fallback_text, true, true);
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
    if (hintsUsed >= 3 || isAiLoading || isCompleted) return;

    const nextLevel = (hintsUsed + 1) as 1 | 2 | 3;

    setMessages((prev) => [
      ...prev,
      { role: 'system', content: `힌트 ${nextLevel}/3` },
    ]);
    setHintsUsed(nextLevel);

    try {
      const res = await sendTutorStreamRequest(
        {
          type: 'hint_generator',
          quest_id: quest.id,
          student_code: code,
          hint_level: nextLevel,
        },
        setStreamingContent,
      );
      finishStreaming(res.message, res.is_fallback);
    } catch {
      finishStreaming(quest.prompt_skeleton.fallback_text, true);
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
  }, [hintsUsed, isAiLoading, isCompleted, quest.id, code, userId]);

  // 황금키 사용 핸들러
  const handleGoldenKeyUse = useCallback(async () => {
    if (goldenKeys <= 0 || isAiLoading || isGoldenKeyLoading || isCompleted) return;

    const confirmed = window.confirm(
      '황금키를 사용하면 정답이 공개되고 XP를 받을 수 없어요. 사용할까요?',
    );
    if (!confirmed) return;

    setIsGoldenKeyLoading(true);

    try {
      const res = await fetch('/api/quest/golden-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quest_id: quest.id }),
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
        { role: 'system', content: '🔑 황금키를 사용했어요!' },
      ]);

      // 정답 코드 자동 실행
      const result = await runCode(data.solution_code);
      setRunResult(result);
      setActiveTab('result');

      // 자동 완료 처리
      const completeRes = await fetch('/api/quest/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quest_id: quest.id,
          code_submitted: data.solution_code,
          hints_used: hintsUsed,
          used_golden_key: true,
        }),
      });
      const completeData = await completeRes.json();

      if (!completeData.already_completed) {
        setEarnedXP(0);
        setUserXP(completeData.total_xp);
        setUserLevel(completeData.new_level);
        setNextQuestId(completeData.nextQuestId ?? null);
      }
      setIsCompleted(true);

      // 해설 메시지
      finishStreaming(
        `정답 코드를 살펴볼까요?\n\n\`\`\`python\n${data.solution_code}\n\`\`\`\n\n이 코드는 "${quest.prompt_skeleton.topic}" 개념을 사용해요. 다음 퀘스트에서는 직접 도전해보세요! 💪`,
        false,
      );

      // Confetti (황금키 전용 — 작은 규모)
      confettiReady?.then((confetti) => {
        confetti({
          particleCount: 40,
          spread: 50,
          origin: { y: 0.6 },
          ticks: 60,
          colors: ['#FFD700', '#FFA500', '#FF8C00'],
        });
      });
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'system', content: '황금키 사용 중 오류가 발생했어요' },
      ]);
    } finally {
      setIsGoldenKeyLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goldenKeys, isAiLoading, isGoldenKeyLoading, isCompleted, quest.id, hintsUsed, runCode]);

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
          finishStreaming(res.message, res.is_fallback);
        })
        .catch(() => {
          finishStreaming('앗, 코드에 오류가 있어요! 에러 메시지를 잘 읽어보고 다시 도전해봐요! 💪', true);
        });
      return;
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
        }),
      });
      const validateData = await validateRes.json();
      vResult = { passed: validateData.passed, type: quest.validation_type };
    } catch {
      vResult = { passed: false, type: quest.validation_type };
    }
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
          setNextQuestId(completeData.nextQuestId ?? null);

          // 축하 시퀀싱
          const badges: BadgeType[] = completeData.new_badges ?? [];
          setNewBadges(badges);

          if (completeData.level_changed) {
            setLevelUpInfo({
              level: completeData.new_level,
              title: getLevelTitle(completeData.new_level),
            });
          }

          if (completeData.isLastQuestInStage) {
            setStageCompleteInfo({
              stageTitle: completeData.stageTitle ?? quest.stage.title,
              stageOrder: completeData.stageOrder ?? quest.stage.order,
              concepts: completeData.stageConcepts ?? [],
            });
            setTimeout(() => setCelebrationPhase('stage_complete'), 1000);
          } else if (completeData.level_changed) {
            setTimeout(() => setCelebrationPhase('level_up'), 1000);
          } else if (badges.length > 0) {
            setTimeout(() => setCelebrationPhase('badges'), 1000);
          }
        }
        setIsCompleted(true);

        // Confetti
        confettiReady?.then((confetti) => {
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            ticks: 90,
            gravity: 2.2,
            startVelocity: 70,
          });
        });

        // AI 피드백 (성공) — 스트리밍으로 순차 표시
        (async () => {
          try {
            const feedbackRes = await sendTutorStreamRequest(
              {
                type: 'code_feedback',
                quest_id: quest.id,
                student_code: code,
                execution_result: {
                  stdout: result.stdout,
                  stderr: '',
                  passed: true,
                },
              },
              setStreamingContent,
            );
            finishStreaming(feedbackRes.message, feedbackRes.is_fallback);

            // 격려 메시지도 스트리밍
            const encourageRes = await sendTutorStreamRequest(
              {
                type: 'encouragement',
                quest_id: quest.id,
                earned_xp: completeData.earned_xp,
                hints_used: hintsUsed,
              },
              setStreamingContent,
            );
            finishStreaming(encourageRes.message, encourageRes.is_fallback);
          } catch {
            finishStreaming('대단해요! 정답이에요! 🎉', true);
          }
        })();
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
          finishStreaming(res.message, res.is_fallback);
        })
        .catch(() => {
          finishStreaming('앗, 조금 고쳐볼까요? 힌트를 사용해보세요! 💡', true);
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

      {/* API 키 미설정 배너 */}
      {hasApiKey === false && <ApiKeyBanner />}

      {/* 완료 배너 */}
      {isCompleted && (
        <div className="bg-primary/10 px-4 py-2 text-center text-sm font-medium text-primary">
          이미 완료한 퀘스트예요!{' '}
          {nextQuestId ? (
            <>
              <Link href={`/quest/${nextQuestId}`} className="underline">
                다음 퀘스트로
              </Link>
              {' · '}
              <Link href="/world" className="underline">
                월드맵으로 돌아가기
              </Link>
            </>
          ) : (
            <Link href="/world" className="underline">
              월드맵으로 돌아가기
            </Link>
          )}
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
            hintsUsed={hintsUsed}
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
              nextQuestId={nextQuestId}
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
            {validationRes?.passed && nextQuestId && (
              <div className="mt-3">
                <Button render={<Link href={`/quest/${nextQuestId}`} />} className="w-full">
                  다음 퀘스트로 →
                </Button>
              </div>
            )}
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
        {celebrationPhase === 'stage_complete' && stageCompleteInfo && (
          <StageCompleteCelebration
            stageTitle={stageCompleteInfo.stageTitle}
            stageOrder={stageCompleteInfo.stageOrder}
            concepts={stageCompleteInfo.concepts}
            questId={quest.id}
            onClose={() => {
              if (levelUpInfo) {
                setCelebrationPhase('level_up');
              } else if (newBadges.length > 0) {
                setCelebrationPhase('badges');
              } else {
                setCelebrationPhase('done');
              }
            }}
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
