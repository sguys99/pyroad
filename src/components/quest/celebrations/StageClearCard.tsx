'use client';

import { useEffect, useRef, useState } from 'react';
import { Map } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { stampSlam, type FxHandle } from '@/lib/celebration/onboardingFx';
import type { MotionBudget } from '@/lib/motion/tier';
import type { StageClearInfo } from '@/lib/quest/rewards';
import { useTutor } from '@/lib/tutor/useTutor';
import {
  CelebrationCta,
  CelebrationMascot,
  ConceptChips,
  Kicker,
  delayStyle,
} from './parts';
import { CelebrationShare } from './CelebrationShare';

interface StageClearCardProps {
  stage: StageClearInfo;
  questId: string;
  budget: MotionBudget;
  settled: boolean;
  /** 월드맵 주소 (주 버튼: 그곳에서 새 스테이지가 열리는 연출, P5) */
  worldHref: string;
  onNext: () => void;
  /** 카탈로그 견본: 튜터를 부르지 않고 이 정리 글을 보여 줌 */
  summary?: string;
}

/**
 * 스테이지 클리어 (P6-13): 이번 축하의 마지막 카드(시퀀서가 맨 뒤로 보냄). 금색 "클리어" 도장이 쾅 → 파이뱀 점프 →
 * 파이뱀 선생님의 정리(AI)와 배운 개념. 주 버튼 "지도에서 새 길 보기"는 월드맵으로 가서 새 스테이지 해제 연출을 보여 주고,
 * 보조 "여기 있을래요"는 오버레이만 닫는다. 읽을 것이 많아 자동으로 넘기지 않는다
 */
export function StageClearCard({
  stage,
  questId,
  budget,
  settled,
  worldHref,
  onNext,
  summary: fixedSummary,
}: StageClearCardProps) {
  const summary = useStageSummary(questId, stage.concepts, fixedSummary);

  return (
    <>
      <ClearStamp budget={budget} settled={settled} />
      <CelebrationMascot size={88} budget={budget} settled={settled} />

      <div className="cel-head">
        <Kicker>스테이지 {stage.order} 클리어</Kicker>
        <h2
          id="celebration-title"
          className="cel-t font-display cel-rise"
          style={delayStyle(120)}
        >
          {stage.title}
        </h2>
        <p className="cel-sub">이 스테이지의 퀘스트를 모두 끝냈어요</p>
      </div>

      <div className="cel-slip cel-rise" style={delayStyle(250)}>
        <p className="cel-slip-k">파이뱀 선생님의 정리</p>
        <div className="cel-slip-body" aria-live="polite">
          {summary ? (
            <ReactMarkdown>{summary}</ReactMarkdown>
          ) : (
            <p className="text-muted-foreground">정리하는 중...</p>
          )}
        </div>
      </div>

      <ConceptChips concepts={stage.concepts} delayMs={420} />

      <MapActions
        worldHref={worldHref}
        onStay={onNext}
        stageId={stage.stage_id}
      />
    </>
  );
}

/** 스테이지를 끝낸 카드의 버튼 줄 (스테이지 클리어·스테이지 마지막 프로젝트) + 스테이지 카드 자랑하기(P9-10) */
export function MapActions({
  worldHref,
  onStay,
  stageId,
}: {
  worldHref: string;
  onStay: () => void;
  stageId: string;
}) {
  return (
    <div className="cel-actions">
      <CelebrationCta
        href={worldHref}
        icon={<Map aria-hidden />}
        testId="celebration-map-cta"
      >
        지도에서 새 길 보기
      </CelebrationCta>
      <CelebrationCta onClick={onStay} variant="ghost" focus={false}>
        여기 있을래요
      </CelebrationCta>
      <CelebrationShare kind="stage" cardRef={stageId} />
    </div>
  );
}

/** 카드 오른쪽 위 금색 "클리어" 도장 (온보딩·통과 도장과 같은 stampSlam). 건너뛰면 끝 모습 */
function ClearStamp({
  budget,
  settled,
}: {
  budget: MotionBudget;
  settled: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const fx = useRef<FxHandle | null>(null);
  const budgetRef = useRef(budget);
  useEffect(() => {
    const el = ref.current;
    fx.current = stampSlam(el, {
      budget: budgetRef.current,
      paper: el?.parentElement,
    });
    return () => fx.current?.finish();
  }, []);
  useEffect(() => {
    if (settled) fx.current?.finish();
  }, [settled]);
  return (
    <div ref={ref} className="cel-stamp font-display" aria-hidden>
      클리어
    </div>
  );
}

/** 스테이지 정리 (AI 스트리밍, 실패하면 정해진 문장) */
function useStageSummary(questId: string, concepts: string[], fixed?: string) {
  const { sendTutorStreamRequest } = useTutor();
  const [text, setText] = useState('');
  // 배열 prop은 부모가 다시 그릴 때마다 새로 오므로 문자열로 비교 (요약을 다시 요청하지 않게)
  const conceptsText = concepts.join(', ');

  useEffect(() => {
    if (fixed !== undefined) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await sendTutorStreamRequest(
          { type: 'stage_summary', quest_id: questId },
          (delta) => {
            if (!cancelled) setText(delta);
          },
        );
        // null: 축하 화면을 닫아 요청이 취소됨
        if (res && !cancelled) setText(res.message);
      } catch {
        if (!cancelled) {
          setText(
            `스테이지를 모두 완료했어요! ${conceptsText} 등의 개념을 배웠어요. 대단해요!`,
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [questId, conceptsText, sendTutorStreamRequest, fixed]);

  return fixed ?? text;
}
