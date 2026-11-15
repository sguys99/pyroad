'use client';

import { ArrowRight, Check, Hourglass, Lock, LockOpen } from 'lucide-react';

import { WorldCoverArt } from '@/components/landing/sections/worlds/WorldCoverArt';
import { Card, CardButton } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress-bar';
import {
  type BookSummary,
  type SkillCheckOfferInfo,
  isOpenable,
  STATUS_LABEL,
  worldPath,
  worldTint,
} from '@/lib/world/worldBook';

import { useBookNavigate } from './bookTransition';
import { SkillCheckOffer } from './SkillCheckOffer';
// 표지 그림 재질·책 모양
import './worldBook.css';

/** 표지: 월드 그림(랜딩 세계관과 같은 그림) + 권 띠 + 잠김 걸쇠. `data-vt-book`은 책 ↔ 지도 전환의 짝 */
export function WorldCover({ book, no }: { book: BookSummary; no: number }) {
  const locked = !isOpenable(book);
  return (
    <div className="wb-cover wb-art" data-vt-book>
      {/* 표지 그림은 월드 1·2·3만 있음: 다른 월드(테스트 월드 등)는 1권 그림 */}
      <WorldCoverArt world={worldTint(book.order) ?? 1} />
      <span className="wb-band">{no}권</span>
      {locked && (
        <span className="wb-clasp" aria-hidden>
          {book.status === 'coming_soon' ? (
            <Hourglass className="size-4" strokeWidth={2.4} />
          ) : (
            <Lock className="size-4" strokeWidth={2.4} />
          )}
        </span>
      )}
    </div>
  );
}

interface WorldBookProps {
  book: BookSummary;
  /** 그림책 N권 */
  no: number;
  /** 잠김·준비 중일 때 해제 조건 한 줄 (`unlockText`) */
  unlock: string;
  /** 지금 모험 중인 월드(`/world`가 보여 주는 월드): 책갈피 */
  current?: boolean;
  /** 제목 단계: 책장은 h2, 지도 아래 다음 권은 h3 */
  heading?: 'h2' | 'h3';
  /** 새로 열린 월드 (첫 스테이지의 잠금 해제 연출을 아직 못 봄, P5-05): 상태 칩이 "새로 열렸어요!" */
  fresh?: boolean;
  /** 잠긴 책의 실력 확인 퀴즈 진입점 (P10-03, `skillCheckOfferOf`) */
  skillCheck?: SkillCheckOfferInfo | null;
}

/**
 * 월드 책 한 권 (P5-01): 책장(/worlds)·지도 아래 "다음 권 미리 보기"가 같이 쓴다.
 * 열린 월드(모험 중·다 읽음)는 카드 전체가 그 지도로 가는 링크(표지가 지도로 펼쳐지는 전환), 잠김·준비 중은 누를 수 없는 카드 +
 * 해제 조건. 상태는 글자·아이콘으로도 보여 준다(색만으로 구분하지 않음)
 */
export function WorldBook({
  book,
  no,
  unlock,
  current = false,
  heading: H = 'h2',
  fresh = false,
  skillCheck = null,
}: WorldBookProps) {
  const go = useBookNavigate();
  const { slug, title, order, status } = book;
  const href = worldPath(slug);
  const openable = isOpenable(book);

  const body = (
    <>
      {current && <span className="wb-mark">지금 읽는 책</span>}
      <WorldCover book={book} no={no} />
      <div className="wb-info">
        <span className="wb-kicker">그림책 {no}권</span>
        <H className="font-display text-h3 text-foreground">{title}</H>
        <span
          className="wb-status"
          data-status={status}
          data-fresh={fresh || undefined}
        >
          {status === 'cleared' && <Check className="size-3.5" aria-hidden />}
          {fresh && <LockOpen className="size-3.5" aria-hidden />}
          {fresh ? '새로 열렸어요!' : STATUS_LABEL[status]}
        </span>
        {openable ? (
          <>
            <ProgressBar
              value={book.completedStages}
              max={book.totalStages}
              size="sm"
              label={`${title} 진행`}
              valueText={`스테이지 ${book.completedStages}/${book.totalStages}`}
            />
            <span className="wb-note">
              스테이지 {book.completedStages}/{book.totalStages} · 퀘스트{' '}
              {book.completedQuests}/{book.totalQuests}
            </span>
            <span className="wb-go">
              {status === 'cleared' ? '다시 펼치기' : '지도 펼치기'}
              <ArrowRight className="size-4" aria-hidden />
            </span>
          </>
        ) : (
          <span className="wb-note">
            <Lock className="size-4" aria-hidden />
            <span>
              {status === 'coming_soon' && '지금 만들고 있어요. '}
              {unlock}
            </span>
          </span>
        )}
      </div>
      {/* 표지·글 아래 카드 폭 전체 (360px 가로 카드에서도 버튼이 한 줄) */}
      {!openable && skillCheck && <SkillCheckOffer {...skillCheck} compact />}
    </>
  );

  return openable ? (
    <CardButton
      href={href}
      radius="l"
      padding="none"
      className="wb-book grid"
      data-status={status}
      data-world={worldTint(order)}
      data-book-slug={slug}
      onClick={(e) => go(e, href, '.world-map')}
    >
      {body}
    </CardButton>
  ) : (
    <Card
      radius="l"
      padding="none"
      className="wb-book grid"
      data-status={status}
      data-world={worldTint(order)}
      data-book-slug={slug}
    >
      {body}
    </Card>
  );
}
