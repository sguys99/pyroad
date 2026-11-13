'use client';

import { useEffect, useState } from 'react';
import {
  Copy,
  ExternalLink,
  HeartHandshake,
  Link2Off,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { useRestricted } from '@/components/consent/ConsentProvider';
import { copyText } from '@/lib/share-card/share';
import { formatKstDate } from '@/lib/time/kst';

export interface GuardianLinkState {
  active: boolean;
  createdAt: string | null;
}

export interface GuardianReportLinkCardProps {
  /** null = 아직 모름(불러오는 중) */
  state: GuardianLinkState | null;
  /** 방금 만든 링크 전체 주소 (원문은 DB 에 없어 만든 그때만 보임) */
  link?: string | null;
  busy?: boolean;
  /** 보호자 동의 전(제한 모드) — 만들기만 막음, 끄기는 됨 */
  restricted?: boolean;
  message?: string | null;
  onCreate?: () => void;
  onOff?: () => void;
  onCopy?: () => void;
}

/**
 * 설정 "보호자에게 보여 주기" 칸 (P9-15) 겉모양. 상태: 꺼짐 · 방금 만듦(링크·복사·열어 보기) · 켜짐(만든 날, 다시 만들기·끄기).
 * 다시 만들기·끄기는 확인 대화 상자(옛 링크가 바로 닫힘). 카탈로그가 요청 없이 그대로 진열한다
 */
export function GuardianReportLinkCard({
  state,
  link,
  busy,
  restricted,
  message,
  onCreate,
  onOff,
  onCopy,
}: GuardianReportLinkCardProps) {
  const [confirm, setConfirm] = useState<'recreate' | 'off' | null>(null);
  if (!state) return null;
  return (
    <section
      className="mb-6 grid gap-3 rounded-xl border border-border bg-card p-4 shadow-sm"
      aria-labelledby="guardian-report-title"
      data-testid="guardian-report-section"
      data-active={state.active || undefined}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary-text [&>svg]:size-5"
        >
          <HeartHandshake />
        </span>
        <div className="grid min-w-0 gap-0.5">
          <h2
            id="guardian-report-title"
            className="text-small font-bold text-foreground"
          >
            보호자에게 보여 주기
          </h2>
          <p className="text-caption text-pretty text-muted-foreground">
            {state.active
              ? `비밀 링크가 켜져 있어요${state.createdAt ? ` · ${formatKstDate(state.createdAt, 'monthDay')}에 만듦` : ''}. 링크를 받은 사람은 요일별 공부 기록을 볼 수 있어요.`
              : '내 한 주 공부 기록(요일별)을 보호자만 볼 수 있는 비밀 링크로 보내요. 코드와 질문은 보이지 않아요.'}
          </p>
        </div>
      </div>

      {link && (
        <div className="grid gap-2 rounded-lg bg-muted/50 p-3">
          <label
            htmlFor="guardian-report-link"
            className="text-caption font-medium text-muted-foreground"
          >
            보호자에게 이 링크를 보내 주세요. 다시 볼 수 없으니 지금 복사해요!
          </label>
          <input
            id="guardian-report-link"
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-small text-foreground"
            data-testid="guardian-report-link"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              icon={<Copy aria-hidden />}
              onClick={onCopy}
              data-testid="guardian-report-copy"
            >
              링크 복사
            </Button>
            {/* 새 창: 이 칸의 링크는 다시 볼 수 없어서 설정 화면을 떠나지 않게 */}
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-10 items-center gap-1.5 px-2 text-small font-bold text-primary-text underline underline-offset-4 [&>svg]:size-4"
            >
              <ExternalLink aria-hidden />새 창에서 미리 보기
            </a>
          </div>
        </div>
      )}

      {restricted && !state.active && (
        <p className="text-caption text-warning">
          보호자 동의를 마치면 링크를 만들 수 있어요.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {state.active ? (
          <>
            <Button
              size="sm"
              variant="secondary"
              icon={<RefreshCw aria-hidden />}
              loading={busy}
              disabled={restricted}
              onClick={() => setConfirm('recreate')}
              data-testid="guardian-report-recreate"
            >
              새 링크 만들기
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={<Link2Off aria-hidden />}
              disabled={busy}
              onClick={() => setConfirm('off')}
              data-testid="guardian-report-off"
            >
              링크 끄기
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            loading={busy}
            disabled={restricted}
            onClick={onCreate}
            data-testid="guardian-report-create"
          >
            비밀 링크 만들기
          </Button>
        )}
      </div>

      <p
        role="status"
        className="min-h-4 text-caption font-medium text-primary-text empty:hidden"
      >
        {message}
      </p>

      <AlertDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === 'off' ? '링크를 끌까요?' : '새 링크를 만들까요?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === 'off'
                ? '보낸 링크가 바로 닫혀서 아무도 볼 수 없어요. 나중에 다시 만들 수 있어요.'
                : '전에 보낸 링크는 바로 닫혀요. 새 링크를 보호자에게 다시 보내 주세요.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              variant={confirm === 'off' ? 'danger' : 'primary'}
              onClick={() => {
                if (confirm === 'off') onOff?.();
                else onCreate?.();
                setConfirm(null);
              }}
              data-testid="guardian-report-confirm"
            >
              {confirm === 'off' ? '끄기' : '새로 만들기'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

async function errorText(res: Response) {
  const data = await res.json().catch(() => null);
  return typeof data?.error === 'string' && /[가-힣]/.test(data.error)
    ? data.error
    : '앗, 잠깐 문제가 생겼어요. 잠시 후 다시 해 볼까요?';
}

/** 설정 화면에 놓는 "보호자에게 보여 주기" (P9-15). 상태·만들기·끄기는 `/api/guardian-report` */
export function GuardianReportSection() {
  const restricted = useRestricted();
  const [state, setState] = useState<GuardianLinkState | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/guardian-report')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: GuardianLinkState | null) => d && setState(d))
      .catch(() => {});
  }, []);

  async function send(method: 'POST' | 'DELETE') {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/guardian-report', { method });
      if (!res.ok) {
        setMessage(await errorText(res));
        return;
      }
      const d = (await res.json()) as GuardianLinkState & { path?: string };
      setState({ active: d.active, createdAt: d.createdAt });
      setLink(d.path ? `${location.origin}${d.path}` : null);
      setMessage(
        method === 'DELETE'
          ? '링크를 껐어요. 이제 아무도 볼 수 없어요.'
          : '새 링크를 만들었어요!',
      );
    } catch {
      setMessage('인터넷 연결을 확인하고 다시 해 볼까요?');
    } finally {
      setBusy(false);
    }
  }

  return (
    <GuardianReportLinkCard
      state={state}
      link={link}
      busy={busy}
      restricted={restricted}
      message={message}
      onCreate={() => void send('POST')}
      onOff={() => void send('DELETE')}
      onCopy={async () => {
        if (!link) return;
        setMessage(
          (await copyText(link))
            ? '링크를 복사했어요. 보호자에게 보내 주세요!'
            : '복사하지 못했어요. 링크 칸을 길게 눌러 복사해 주세요.',
        );
      }}
    />
  );
}
