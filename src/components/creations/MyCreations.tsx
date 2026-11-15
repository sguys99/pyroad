'use client';

import { useState } from 'react';
import { Lock, MessagesSquare, Palette, Trash2 } from 'lucide-react';
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
import { formatKstDate } from '@/lib/time/kst';
import type { CreationKind } from '@/lib/creations/limits';

export interface MyCreation {
  id: string;
  kind: CreationKind;
  title: string;
  isPublic: boolean;
  createdAt: string;
}

/**
 * 내 작품함 (P11-06): 저장한 작품 목록 + 지우기(확인). 그림은 썸네일(본인만, `/api/creations/{id}/thumbnail`),
 * 대화는 말풍선 그림. 다시 보기(명령 재생·대화 재생)와 갤러리 올리기는 P11-07. `remove` 는 카탈로그가 요청 없이 흉내 낼 때
 */
export function MyCreations({
  creations: initial,
  remove = removeCreation,
  thumbnailUrl = (id) => `/api/creations/${id}/thumbnail`,
}: {
  creations: MyCreation[];
  remove?: (id: string) => Promise<boolean>;
  thumbnailUrl?: (id: string) => string | null;
}) {
  const [items, setItems] = useState(initial);
  const [deleting, setDeleting] = useState<MyCreation | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [broken, setBroken] = useState<Set<string>>(() => new Set());

  async function run(item: MyCreation) {
    setBusy(item.id);
    setStatus('');
    const ok = await remove(item.id).catch(() => false);
    setBusy(null);
    if (!ok)
      return setStatus('지금은 지우지 못했어요. 잠시 뒤에 다시 해 줘요.');
    setItems((xs) => xs.filter((x) => x.id !== item.id));
    setStatus(`「${item.title}」을 지웠어요.`);
  }

  if (items.length === 0)
    return (
      <div
        className="grid justify-items-center gap-2 rounded-3xl bg-surface p-8 text-center shadow-card"
        data-testid="my-creations-empty"
      >
        <Palette className="size-8 text-accent-text" aria-hidden />
        <p className="m-0 font-display text-h3">아직 저장한 작품이 없어요</p>
        <p className="m-0 text-small text-muted-foreground">
          거북이로 그림을 그리거나 대화하는 프로그램을 실행하면 &ldquo;작품으로
          저장&rdquo;이 나와요.
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
      >
        {status}
      </p>
      <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 md:grid-cols-4">
        {items.map((item) => {
          const src = item.kind === 'drawing' ? thumbnailUrl(item.id) : null;
          return (
            <li
              key={item.id}
              className="grid content-start gap-2 rounded-3xl bg-surface p-2.5 shadow-card"
              data-testid="my-creation"
            >
              <figure className="m-0 grid aspect-square place-items-center overflow-hidden rounded-2xl bg-surface-2">
                {src && !broken.has(item.id) ? (
                  // 본인 전용 동적 PNG 라 next/image 최적화를 거치지 않는다
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={src}
                    alt={`${item.title} 그림`}
                    width={400}
                    height={400}
                    loading="lazy"
                    className="block size-full bg-surface object-contain"
                    onError={() => setBroken((s) => new Set(s).add(item.id))}
                  />
                ) : item.kind === 'drawing' ? (
                  <Palette
                    className="size-10 text-accent-text"
                    aria-label="그림 작품"
                  />
                ) : (
                  <MessagesSquare
                    className="size-10 text-primary-text"
                    aria-label="대화 작품"
                  />
                )}
              </figure>
              <div className="grid gap-0.5 px-1">
                <h2 className="m-0 truncate font-display text-body">
                  {item.title}
                </h2>
                <p className="m-0 flex items-center gap-1 text-caption text-muted-foreground">
                  {!item.isPublic && (
                    <Lock
                      className="size-3.5 shrink-0"
                      aria-label="나만 보기"
                    />
                  )}
                  {formatKstDate(item.createdAt, 'monthDay')}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="[--fg:var(--error)]"
                icon={<Trash2 aria-hidden />}
                loading={busy === item.id}
                onClick={() => setDeleting(item)}
                aria-label={`${item.title} 지우기`}
                data-testid="my-creation-delete"
              >
                지우기
              </Button>
            </li>
          );
        })}
      </ul>

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogContent size="sm" data-testid="my-creation-delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>이 작품을 지울까요?</AlertDialogTitle>
            <AlertDialogDescription>
              지운 작품은 다시 되살릴 수 없어요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>그냥 둘래</AlertDialogCancel>
            <AlertDialogAction
              variant="danger"
              onClick={() => {
                const item = deleting;
                setDeleting(null);
                if (item) void run(item);
              }}
              data-testid="my-creation-delete-confirm"
            >
              지우기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

async function removeCreation(id: string) {
  const res = await fetch(`/api/creations/${id}`, { method: 'DELETE' });
  return res.ok;
}
