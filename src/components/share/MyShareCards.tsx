'use client';

import { useState } from 'react';
import {
  Award,
  CalendarDays,
  Clock,
  Eye,
  EyeOff,
  Flag,
  Share2,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { ShareSheet } from './ShareSheet';
import { formatKstDate } from '@/lib/time/kst';
import {
  KIND_LABEL,
  myCardState,
  type MyCardState,
  type MyShareCard,
} from '@/lib/share-card/myCards';
import type { ShareCardKind } from '@/lib/share-card/types';
import { cn } from '@/lib/utils';

const KIND_ICON: Record<ShareCardKind, typeof Sparkles> = {
  levelup: Sparkles,
  stage: Flag,
  achievement: Award,
  weekly: CalendarDays,
};

const STATE_LABEL: Record<MyCardState, string> = {
  public: '공개 중',
  hidden: '숨김',
  expired: '기간 끝',
};

type ManageResult = {
  version: number;
  isPublic: boolean;
  expiresAt: string;
  imageUrl: string;
};

/**
 * 내 자랑 카드 (P9-11): 만든 카드 목록 + 숨기기 · 다시 공개(새 90일) · 지우기(확인) · 다시 보내기(공유 시트).
 * 숨기거나 지우면 친구가 가진 링크·그림이 바로 "볼 수 없는 카드"가 된다(서버가 CDN 사본까지 지움).
 * `act` 는 카탈로그가 요청 없이 흉내 낼 때 바꿔 끼운다
 */
export function MyShareCards({
  cards: initial,
  rewardClaimed,
  now,
  act = request,
}: {
  cards: MyShareCard[];
  rewardClaimed: boolean;
  /** 남은 날 계산 기준 (서버 렌더 시각, 하이드레이션이 어긋나지 않게) */
  now: string;
  act?: (
    id: string,
    action: 'hide' | 'show' | 'delete',
  ) => Promise<ManageResult | null>;
}) {
  const [cards, setCards] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [sharing, setSharing] = useState<MyShareCard | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [claimed, setClaimed] = useState(rewardClaimed);
  const [deleting, setDeleting] = useState<MyShareCard | null>(null);

  async function run(card: MyShareCard, action: 'hide' | 'show' | 'delete') {
    setBusy(card.id);
    setStatus('');
    const res = await act(card.id, action).catch(() => null);
    setBusy(null);
    if (!res) {
      setStatus('지금은 바꾸지 못했어요. 잠시 뒤에 다시 해 줘.');
      return;
    }
    if (action === 'delete') {
      setCards((cs) => cs.filter((c) => c.id !== card.id));
      setStatus(`${KIND_LABEL[card.kind]}를 지웠어요.`);
      return;
    }
    setCards((cs) => cs.map((c) => (c.id === card.id ? { ...c, ...res } : c)));
    setStatus(
      action === 'hide'
        ? '카드를 숨겼어요. 이제 링크를 열어도 보이지 않아요.'
        : '카드를 다시 열었어요. 90일 동안 볼 수 있어요.',
    );
  }

  if (cards.length === 0)
    return (
      <div
        className="grid justify-items-center gap-2 rounded-3xl bg-surface p-8 text-center shadow-card"
        data-testid="my-cards-empty"
      >
        <Share2 className="size-8 text-primary-text" aria-hidden />
        <p className="m-0 font-display text-h3">아직 자랑한 카드가 없어요</p>
        <p className="m-0 text-small text-muted-foreground">
          레벨이 오르거나 스테이지를 깨면 &ldquo;자랑하기&rdquo;로 카드를 만들
          수 있어요.
        </p>
        <p role="status" className="m-0 text-small font-semibold empty:hidden">
          {status}
        </p>
      </div>
    );

  return (
    <>
      <p
        role="status"
        className="m-0 rounded-2xl bg-primary-soft px-4 py-2.5 text-small font-semibold text-primary-text empty:hidden"
        data-testid="my-cards-status"
      >
        {status}
      </p>
      <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-2">
        {cards.map((card) => {
          const { state, daysLeft } = myCardState(card, new Date(now));
          const Icon = KIND_ICON[card.kind];
          const isBusy = busy === card.id;
          return (
            <li
              key={card.id}
              className="grid content-start gap-3 rounded-3xl bg-surface p-3.5 shadow-card"
              data-testid="my-card"
              data-state={state}
            >
              <figure className="m-0 overflow-hidden rounded-2xl bg-surface-2">
                {state === 'public' ? (
                  // 사이트 안 동적 PNG(CDN 캐시)라 next/image 최적화를 거치지 않는다
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={card.imageUrl}
                    alt={`${KIND_LABEL[card.kind]} ${card.detail}`}
                    width={1200}
                    height={630}
                    loading="lazy"
                    className="block aspect-[1200/630] h-auto w-full"
                  />
                ) : (
                  <div className="grid aspect-[1200/630] place-items-center content-center gap-1.5 text-muted-foreground">
                    {state === 'hidden' ? (
                      <EyeOff className="size-8" aria-hidden />
                    ) : (
                      <Clock className="size-8" aria-hidden />
                    )}
                    <p className="m-0 text-small font-semibold">
                      {state === 'hidden'
                        ? '숨긴 카드라 아무도 볼 수 없어요'
                        : '90일이 지나 저절로 닫혔어요'}
                    </p>
                  </div>
                )}
              </figure>

              <div className="grid gap-1 px-1">
                <div className="flex items-center gap-2">
                  <Icon
                    className="size-5 shrink-0 text-primary-text"
                    aria-hidden
                  />
                  <h2 className="m-0 min-w-0 truncate font-display text-body">
                    {KIND_LABEL[card.kind]}
                  </h2>
                  <span
                    className={cn(
                      'ml-auto shrink-0 rounded-full px-2.5 py-0.5 text-caption font-semibold',
                      state === 'public'
                        ? 'bg-primary-soft text-primary-text'
                        : 'bg-surface-2 text-muted-foreground',
                    )}
                    data-testid="my-card-state"
                  >
                    {STATE_LABEL[state]}
                  </span>
                </div>
                {card.detail && (
                  <p className="m-0 truncate text-small text-foreground">
                    {card.detail}
                  </p>
                )}
                <p className="m-0 text-caption text-muted-foreground">
                  {formatKstDate(card.createdAt, 'monthDay')}에 만듦
                  {state === 'public' && ` · ${daysLeft}일 남음`}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {state === 'public' ? (
                  <>
                    <Button
                      size="sm"
                      icon={<Share2 aria-hidden />}
                      disabled={isBusy}
                      onClick={() => {
                        setSharing(card);
                        setSheetOpen(true);
                      }}
                      data-testid="my-card-share"
                    >
                      다시 보내기
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<EyeOff aria-hidden />}
                      loading={isBusy}
                      onClick={() => void run(card, 'hide')}
                      data-testid="my-card-hide"
                    >
                      숨기기
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    icon={<Eye aria-hidden />}
                    loading={isBusy}
                    onClick={() => void run(card, 'show')}
                    data-testid="my-card-show"
                  >
                    다시 공개
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  // 360 에서는 그림만 (한 줄에 세 버튼), 낭독 이름은 aria-label
                  className="ml-auto [--fg:var(--error)]"
                  icon={<Trash2 aria-hidden />}
                  disabled={isBusy}
                  onClick={() => setDeleting(card)}
                  aria-label={`${KIND_LABEL[card.kind]} 지우기`}
                  data-testid="my-card-delete"
                >
                  <span className="max-sm:sr-only">지우기</span>
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogContent size="sm" data-testid="my-card-delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>이 카드를 지울까요?</AlertDialogTitle>
            <AlertDialogDescription>
              지우면 친구에게 보낸 링크도 열리지 않아요. 카카오톡에 이미 보인
              미리보기 그림은 남을 수 있어요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>그냥 둘래</AlertDialogCancel>
            <AlertDialogAction
              variant="danger"
              onClick={() => {
                const card = deleting;
                setDeleting(null);
                if (card) void run(card, 'delete');
              }}
              data-testid="my-card-delete-confirm"
            >
              지우기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {sharing && (
        <ShareSheet
          // 카드마다 새 시트 (보상 줄·알림 상태를 카드끼리 나누지 않게)
          key={sharing.id}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          kind={sharing.kind}
          card={{ ...sharing, rewardClaimed: claimed }}
          onShared={() => setClaimed(true)}
        />
      )}
    </>
  );
}

async function request(
  id: string,
  action: 'hide' | 'show' | 'delete',
): Promise<ManageResult | null> {
  const res = await fetch(`/api/share-cards/${id}`, {
    method: action === 'delete' ? 'DELETE' : 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    ...(action === 'delete' ? {} : { body: JSON.stringify({ action }) }),
  });
  return res.ok ? res.json() : null;
}
