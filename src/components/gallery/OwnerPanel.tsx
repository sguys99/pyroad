'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Check,
  EyeOff,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Frame,
  TriangleAlert,
  Upload,
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
import { Sheet } from '@/components/ui/sheet';
import { UserAvatar } from '@/components/profile/UserAvatar';
import { ShareButton } from '@/components/share/ShareButton';
import type { AvatarLook } from '@/lib/avatar/look';
import { hasExtraPersonalInfo } from '@/lib/creations/limits';
import type { TranscriptRow } from '@/components/quest/outputSlip';
import './gallery.css';

export interface OwnWork {
  id: string;
  kind: 'drawing' | 'conversation';
  title: string;
  code: string | null;
  transcript: TranscriptRow[];
  visibility: 'private' | 'public';
  hiddenAt: string | null;
  showCode: boolean;
  eligible: boolean;
  author: { name: string; look: AvatarLook };
}

export type PatchResult = { ok: true } | { ok: false; message: string };

const FAILED = '지금은 바꾸지 못했어요. 잠시 뒤에 다시 해 줘요.';

async function patchCreation(
  id: string,
  body: Record<string, unknown>,
): Promise<PatchResult> {
  try {
    const res = await fetch(`/api/creations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) return { ok: true };
    const data = await res.json().catch(() => null);
    return {
      ok: false,
      message:
        typeof data?.error === 'string' && res.status < 500
          ? data.error
          : FAILED,
    };
  } catch {
    return { ok: false, message: FAILED };
  }
}

/** 개인정보 지킴이 (제안 J, 화면 쪽): 서버가 막을 것(stop)과 한 번 더 볼 것(warn) */
export function privacyFindings(work: OwnWork, showCode: boolean) {
  const parts: [string, string[]][] = [
    ['작품 이름', [work.title]],
    ['대화 기록', work.transcript.map((r) => r.text)],
    ['코드', showCode && work.code ? [work.code] : []],
  ];
  const stop: string[] = [];
  const warn: string[] = [];
  for (const [label, texts] of parts) {
    if (texts.some(hasExtraPersonalInfo)) stop.push(label);
    // 숫자가 4개 넘게 이어지면 한 번 더 보기 (집 주소·생일·전화번호 뒷자리일 수 있음)
    else if (texts.some((t) => /\d{4,}/.test(t))) warn.push(label);
  }
  return { stop, warn };
}

/**
 * 내 작품 보기의 작가 패널 (P11-07): 상태 딱지 + 갤러리에 올리기(출품 시트) · 내리기 · 코드 보기 켜고 끄기.
 * 출품은 3월드 프로젝트를 끝낸 작품만(Q75 ⑧) — 자격은 서버가 다시 본다. `patch` 는 카탈로그가 흉내 낼 때
 */
export function OwnerPanel({
  work,
  thumbnailUrl,
  patch = patchCreation,
}: {
  work: OwnWork;
  thumbnailUrl: string | null;
  patch?: (id: string, body: Record<string, unknown>) => Promise<PatchResult>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmDown, setConfirmDown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  // 바꾼 값은 바로 보여 주고(서버 다시 그리기를 기다리지 않음), 스티커 판 등은 refresh 로 맞춘다
  const [state, setState] = useState({
    visibility: work.visibility,
    showCode: work.showCode,
  });

  async function run(
    body: { visibility?: 'private' | 'public'; showCode?: boolean },
    done: string,
  ) {
    setBusy(true);
    setStatus('');
    const res = await patch(work.id, body);
    setBusy(false);
    setStatus(res.ok ? done : res.message);
    if (res.ok) {
      setState((s) => ({ ...s, ...body }));
      router.refresh();
    }
    return res;
  }

  const isPublic = state.visibility === 'public' && !work.hiddenAt;
  return (
    <section
      className="grid gap-3"
      aria-label="내 작품 관리"
      data-testid="owner-panel"
    >
      {work.hiddenAt ? (
        <p className="gl-note" data-tone="stop">
          <ShieldAlert aria-hidden />
          <span>
            <strong>운영자가 숨긴 작품이에요.</strong> 친구들에게 보이지 않고
            다시 올릴 수 없어요. 궁금하면 공지사항의 연락처로 물어봐 줘요.
          </span>
        </p>
      ) : isPublic ? (
        <p className="gl-note" data-tone="ok" data-testid="owner-public">
          <Frame aria-hidden />
          <span>
            <strong>갤러리에 전시 중이에요!</strong> 로그인한 pyRoad 친구들이 볼
            수 있어요.
          </span>
        </p>
      ) : (
        <p className="gl-note">
          <Lock aria-hidden />
          <span>
            <strong>나만 볼 수 있어요.</strong>{' '}
            {work.eligible
              ? '프로젝트를 끝낸 작품이라 갤러리에 올릴 수 있어요.'
              : '갤러리에는 메이커 시티 프로젝트를 끝낸 작품만 올릴 수 있어요.'}
          </span>
        </p>
      )}

      {isPublic ? (
        <div className="grid gap-2">
          <label className="gl-toggle">
            <input
              type="checkbox"
              checked={state.showCode}
              disabled={busy}
              onChange={(e) =>
                run(
                  { showCode: e.target.checked },
                  e.target.checked
                    ? '이제 친구들도 코드를 볼 수 있어요.'
                    : '코드를 다시 나만 보게 했어요.',
                )
              }
              data-testid="owner-show-code"
            />
            <span>
              <strong>코드도 보여 주기</strong>
              친구들이 &ldquo;코드 보기&rdquo;로 내 코드를 읽을 수 있어요.
            </span>
          </label>
          {/* 갤러리 밖(가족·친구)에게는 자랑 카드로만 보임 (Q74 ③, P11-08) */}
          <ShareButton
            kind="creation"
            cardRef={work.id}
            variant="primary"
            size="md"
            testId="owner-share-card"
          >
            자랑 카드 만들기
          </ShareButton>
          <Button
            variant="secondary"
            icon={<EyeOff aria-hidden />}
            loading={busy}
            onClick={() => setConfirmDown(true)}
            data-testid="owner-unpublish"
          >
            갤러리에서 내리기
          </Button>
        </div>
      ) : (
        !work.hiddenAt &&
        work.eligible && (
          <Button
            icon={<Upload aria-hidden />}
            onClick={() => setOpen(true)}
            data-testid="owner-publish-open"
          >
            갤러리에 올리기
          </Button>
        )
      )}
      <p
        role="status"
        className="gl-hint empty:hidden"
        data-testid="owner-status"
      >
        {status}
      </p>

      {open && (
        <PublishSheet
          work={work}
          thumbnailUrl={thumbnailUrl}
          onOpenChange={setOpen}
          submit={async (showCode) => {
            const res = await run(
              { visibility: 'public', showCode },
              '갤러리에 걸었어요! 친구들이 스티커로 응원해 줄 거예요.',
            );
            if (res.ok) setOpen(false);
            return res;
          }}
        />
      )}

      <AlertDialog open={confirmDown} onOpenChange={setConfirmDown}>
        <AlertDialogContent size="sm" data-testid="owner-unpublish-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>갤러리에서 내릴까요?</AlertDialogTitle>
            <AlertDialogDescription>
              친구들에게 더는 보이지 않고 내 작품함에 그대로 남아요. 이 작품으로
              만든 자랑 카드 링크도 닫혀요. 언제든 다시 올릴 수 있어요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>그냥 둘래</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmDown(false);
                void run(
                  { visibility: 'private' },
                  '갤러리에서 내렸어요. 이제 나만 볼 수 있어요.',
                );
              }}
              data-testid="owner-unpublish-confirm"
            >
              내리기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

/**
 * 출품 시트 (제안 J): 친구들에게 보일 모습 미리보기 → 개인정보 확인 목록 + 자동 경고(숫자열·이메일 모양) →
 * 코드 보기 선택(기본 끔) → "모두 확인했어요"를 눌러야 올리기. 서버가 금칙어·개인정보를 다시 검사한다
 */
export function PublishSheet({
  work,
  thumbnailUrl,
  onOpenChange,
  submit,
}: {
  work: OwnWork;
  thumbnailUrl: string | null;
  onOpenChange: (open: boolean) => void;
  submit: (showCode: boolean) => Promise<PatchResult>;
}) {
  const [showCode, setShowCode] = useState(false);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const found = useMemo(
    () => privacyFindings(work, showCode),
    [work, showCode],
  );
  const blocked = found.stop.length > 0;

  return (
    <Sheet
      open
      onOpenChange={onOpenChange}
      title="갤러리에 올리기"
      description="올리면 로그인한 pyRoad 친구들이 볼 수 있어요. 올리기 전에 같이 확인해요."
      data-testid="publish-sheet"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            그만두기
          </Button>
          <Button
            icon={<Upload aria-hidden />}
            loading={busy}
            disabled={!checked || blocked}
            onClick={async () => {
              setBusy(true);
              setError('');
              const res = await submit(showCode);
              setBusy(false);
              if (!res.ok) setError(res.message);
            }}
            data-testid="publish-submit"
          >
            갤러리에 올리기
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <figure className="m-0 grid gap-2 rounded-2xl bg-surface-2 p-3">
          <figcaption className="gl-section-k">
            친구들에게는 이렇게 보여요
          </figcaption>
          <div className="flex items-center gap-3">
            <span className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl bg-surface shadow-card">
              {thumbnailUrl ? (
                // 본인 전용 동적 PNG
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumbnailUrl}
                  alt=""
                  className="size-full object-contain"
                />
              ) : (
                <span className="gl-talk" aria-hidden>
                  {work.transcript.slice(0, 3).map((r, i) => (
                    <span key={i} data-answer={r.answer || undefined}>
                      {r.text || ' '}
                    </span>
                  ))}
                </span>
              )}
            </span>
            <span className="grid min-w-0 gap-1">
              <strong className="truncate font-display text-h3">
                {work.title}
              </strong>
              <span className="gl-by">
                <UserAvatar {...work.author.look} size={24} />
                <span>{work.author.name}</span>
              </span>
              <span className="gl-hint">
                {work.kind === 'drawing'
                  ? '그림과 그리는 모습'
                  : '내가 실행한 대화 기록 전부'}
                {showCode ? ', 코드' : ''}
              </span>
            </span>
          </div>
        </figure>

        <div className="grid gap-2">
          <p className="gl-section-k">올리기 전에 확인해요</p>
          <ul className="gl-checks">
            <li>
              <Check aria-hidden />
              진짜 이름 대신 별명을 썼어요
            </li>
            <li>
              <Check aria-hidden />
              전화번호, 주소, 학교 이름, 이메일이 없어요
            </li>
            <li>
              <Check aria-hidden />
              친구가 속상할 말이 없어요
            </li>
          </ul>
        </div>

        {blocked ? (
          <p
            className="gl-note"
            data-tone="stop"
            role="alert"
            data-testid="publish-stop"
          >
            <ShieldAlert aria-hidden />
            <span>
              <strong>{found.stop.join(', ')}</strong>에 전화번호나 이메일처럼
              보이는 글자가 있어요. 그 부분을 지운 작품만 올릴 수 있어요.
            </span>
          </p>
        ) : found.warn.length > 0 ? (
          <p className="gl-note" data-tone="warn" data-testid="publish-warn">
            <TriangleAlert aria-hidden />
            <span>
              <strong>{found.warn.join(', ')}</strong>에 숫자가 길게 이어진 곳이
              있어요. 주소나 전화번호가 아닌지 한 번 더 봐 줘요.
            </span>
          </p>
        ) : (
          <p className="gl-note" data-tone="ok">
            <ShieldCheck aria-hidden />
            <span>개인정보 지킴이가 살펴봤는데 걱정되는 글자는 없었어요.</span>
          </p>
        )}

        {work.code && (
          <label className="gl-toggle">
            <input
              type="checkbox"
              checked={showCode}
              onChange={(e) => setShowCode(e.target.checked)}
              data-testid="publish-show-code"
            />
            <span>
              <strong>코드도 보여 주기 (선택)</strong>
              켜면 친구들이 내 코드를 읽을 수 있어요. 코드 안에도 이름이나
              전화번호가 없는지 확인해요.
            </span>
          </label>
        )}

        <label className="gl-toggle">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            data-testid="publish-confirm"
          />
          <span>
            <strong>모두 확인했어요</strong>
            갤러리에서는 언제든 다시 내릴 수 있어요.
          </span>
        </label>

        {error && (
          <p
            className="gl-note"
            data-tone="stop"
            role="alert"
            data-testid="publish-error"
          >
            <ShieldAlert aria-hidden />
            <span>{error}</span>
          </p>
        )}
      </div>
    </Sheet>
  );
}
