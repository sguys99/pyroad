'use client';

import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';

import { PybaemStatic } from '@/components/characters/rig';
import { Button } from '@/components/ui/button';
import { track } from '@/lib/analytics/track';
import type { ContinueTarget } from '@/lib/world/mapData';

import './continueCta.css';

/** 화면 낭독기·버튼 첫 줄 */
export function continueLabel(target: ContinueTarget): string {
  return target.kind === 'start' ? '모험 시작하기' : '이어서 하기';
}

interface ContinueButtonProps {
  target: ContinueTarget;
  place: 'head' | 'float';
}

/**
 * 이어하기 CTA (P5-10, 시안 f-world-head "이어서 하기 >"): 주 버튼 첫 줄 + 보조 줄 "3단계 · 퀘스트 이름".
 * 대상 고르기는 `pickContinue`(mapData.ts). 지도 머리(`place="head"`)와 모바일 아래 떠 있는 버튼(`ContinueFloat`)이 같이 쓴다
 */
export function ContinueButton({ target, place }: ContinueButtonProps) {
  const label = continueLabel(target);
  return (
    <Button
      variant="primary"
      href={`/quest/${target.questId}`}
      className="wc-btn"
      data-continue={place}
      data-kind={target.kind}
      aria-label={`${label}: ${target.stageOrder}단계 ${target.questTitle}`}
      icon={
        place === 'float' ? (
          <span className="wc-face">
            <PybaemStatic state="happy" size={32} framing="avatar" label="" />
          </span>
        ) : undefined
      }
      iconRight={<ChevronRight aria-hidden />}
      onClick={() => track('continue_click', { kind: target.kind, place })}
    >
      <span className="wc-text">
        <span>{label}</span>
        <span className="wc-sub font-sans">
          {target.stageOrder}단계 · {target.questTitle}
        </span>
      </span>
    </Button>
  );
}

/**
 * 모바일·태블릿(1024px 미만, 세로로 긴 지도) 아래 가운데 떠 있는 이어하기. 지도 머리의 버튼이 화면에 보이면 숨는다.
 * 겹침: z 30 < HUD 40 < 시트 덮개 50 < 토스트 70. 아래 가운데 쪽지(InstallHint·잠긴 스테이지·잠긴 노드)가 떠 있으면
 * 같은 자리라 비켜 준다(continueCta.css `:has`). 들어오고 나가기는 transform·opacity 한 번(반복 없음)
 */
export function ContinueFloat({ target }: { target: ContinueTarget }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const head = document.querySelector('[data-continue="head"]');
    if (!head) return;
    // 머리 버튼이 위로(따라오는 HUD 밑으로) 지나갔을 때만. 처음 화면에서 머리가 보이면 숨김
    const io = new IntersectionObserver(
      ([e]) =>
        setShow(
          !e.isIntersecting &&
            e.boundingClientRect.top < (e.rootBounds?.top ?? 0),
        ),
      { rootMargin: '-64px 0px 0px 0px' },
    );
    io.observe(head);
    return () => io.disconnect();
  }, []);
  return (
    <div
      className="wc-float lg:hidden"
      data-show={show || undefined}
      // 숨었을 때는 탭·낭독기에서도 빠진다
      inert={!show}
      data-testid="continue-float"
    >
      <ContinueButton target={target} place="float" />
    </div>
  );
}
