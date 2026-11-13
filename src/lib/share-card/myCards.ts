/**
 * "내 자랑 카드" 목록 한 줄 (P9-11). 본인 카드(RLS 본인 읽기) 행 → 화면 값. 순수 함수라 서버·카탈로그·테스트가 같이 쓴다
 */
import { cardFromSnapshot } from './snapshot';
import type { ShareCardKind } from './types';

export interface MyShareCard {
  id: string;
  kind: ShareCardKind;
  version: number;
  isPublic: boolean;
  expiresAt: string;
  createdAt: string;
  imageUrl: string;
  /** 카드에 적힌 성과 한 줄 ("레벨 7", "「…」 스테이지 · 별 3개") */
  detail: string;
}

export const KIND_LABEL: Record<ShareCardKind, string> = {
  levelup: '레벨 업 카드',
  stage: '스테이지 클리어 카드',
  achievement: '업적 카드',
  weekly: '이번 주 기록 카드',
};

/** 공개 중 · 숨김(본인이 닫음) · 기간 끝(90일, §12-Q67 ①) */
export type MyCardState = 'public' | 'hidden' | 'expired';

const DAY = 86_400_000;

export function myCardState(
  c: Pick<MyShareCard, 'isPublic' | 'expiresAt'>,
  now: Date = new Date(),
): { state: MyCardState; daysLeft: number } {
  const left = new Date(c.expiresAt).getTime() - now.getTime();
  const daysLeft = Math.max(0, Math.ceil(left / DAY));
  if (!c.isPublic) return { state: 'hidden', daysLeft };
  return left > 0
    ? { state: 'public', daysLeft }
    : { state: 'expired', daysLeft: 0 };
}

export function myCardDetail(kind: string, snapshot: unknown): string {
  const d = cardFromSnapshot(kind, snapshot);
  if (!d) return '';
  switch (d.kind) {
    case 'levelup':
      return `레벨 ${d.level}`;
    case 'stage':
      return `「${d.stageName}」 · 별 ${d.stars}개`;
    case 'achievement':
      return `「${d.name}」`;
    case 'weekly':
      return `${d.weekLabel} · 퀘스트 ${d.quests}개`;
  }
}
