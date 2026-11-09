'use client';

import { Library } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { useBookNavigate } from './bookTransition';
import './worldBook.css';

interface WorldMapHeadProps {
  slug: string;
  title: string;
  /** 그림책 N권 */
  no: number;
  completedStages: number;
  totalStages: number;
}

/**
 * 지도 머리 (P5-01, 시안 f-world-head "그림책 1권 · 숲 마을 모험 지도"): 권·월드 이름 + 통과한 스테이지 + "월드 바꾸기".
 * 월드 바꾸기는 책장(/worlds)으로 가며 지도가 이 월드 표지로 접히는 전환(full). 상단 HUD 버튼은 P5-07 범위라 그대로
 */
export function WorldMapHead({
  slug,
  title,
  no,
  completedStages,
  totalStages,
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
      </div>
    </div>
  );
}
