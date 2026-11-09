'use client';

import { Library } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ContinueButton } from '@/components/world/ContinueCta';
import type { ContinueTarget } from '@/lib/world/mapData';

import { useBookNavigate } from './bookTransition';
import './worldBook.css';

interface WorldMapHeadProps {
  slug: string;
  title: string;
  /** 그림책 N권 */
  no: number;
  completedStages: number;
  totalStages: number;
  /** 이어하기 CTA (P5-10). 없으면(열린 퀘스트를 다 깸) 버튼 없음 */
  continueTarget?: ContinueTarget | null;
}

/**
 * 지도 머리 (P5-01, 시안 f-world-head "그림책 1권 · 숲 마을 모험 지도"): 권·월드 이름 + 통과한 스테이지 + "월드 바꾸기".
 * 월드 바꾸기는 책장(/worlds)으로 가며 지도가 이 월드 표지로 접히는 전환(full). 맨 오른쪽은 이어하기 주 버튼(P5-10)
 */
export function WorldMapHead({
  slug,
  title,
  no,
  completedStages,
  totalStages,
  continueTarget,
}: WorldMapHeadProps) {
  const go = useBookNavigate();
  const map = () => document.querySelector<HTMLElement>('.world-map');
  return (
    <div className="wb-head relative z-10">
      <div>
        <p className="text-kicker text-muted-foreground">그림책 {no}권</p>
        <h1 className="font-display text-h1 text-foreground">
          {title} 모험 지도
        </h1>
      </div>
      <div className="wb-head-side">
        <span>
          <b>{completedStages}</b>/{totalStages} 스테이지 통과
        </span>
        <Button
          variant="secondary"
          size="sm"
          href="/worlds"
          icon={<Library aria-hidden />}
          onClick={(e) =>
            go(
              e as unknown as React.MouseEvent<HTMLElement>,
              '/worlds',
              `[data-book-slug="${slug}"] [data-vt-book]`,
              map(),
            )
          }
        >
          월드 바꾸기
        </Button>
        {continueTarget && (
          <ContinueButton target={continueTarget} place="head" />
        )}
      </div>
    </div>
  );
}
