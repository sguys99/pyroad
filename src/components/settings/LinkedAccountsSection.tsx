'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import { Check, KeyRound, Link2, Unlink } from 'lucide-react';
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
import { SOCIAL_MARK } from '@/components/auth/brandMarks';
import { cn } from '@/lib/utils';
import { loadBrowserClient } from '@/lib/supabase/loadClient';
import { useLinkIdentity } from '@/lib/hooks/useLinkIdentity';
import { ENABLED_LOGIN_PROVIDERS } from '@/lib/auth/enabledProviders';
import {
  accountLinkRows,
  takeLinkedResult,
  type AccountLinkRow,
} from '@/lib/auth/accountLinks';
import { forgetLastLoginIf } from '@/lib/auth/lastLogin';
import { formatKstDate } from '@/lib/time/kst';
import type { IdentityLike } from '@/lib/auth/loginProvider';
import type { SocialProvider } from '@/lib/auth/socialLogin';

const NAME: Record<SocialProvider, string> = {
  google: 'Google',
  kakao: '카카오',
  naver: '네이버',
};

/** 해제한 뒤 provider 쪽에 남은 연결 정리 안내 (P3-16 헬퍼 결과) */
const PROVIDER_SIDE_NOTE: Partial<Record<SocialProvider, string>> = {
  kakao:
    '카카오 쪽 연결은 카카오톡 → 설정 → 카카오계정 → 연결된 서비스 관리에서 직접 끊을 수 있어요.',
  naver:
    '네이버 쪽 연결은 네이버 → 내정보 → 이력관리 → 연결된 서비스 관리에서 pyRoad를 끊으면 완전히 정리돼요.',
};

type Status =
  | { tone: 'good'; text: string }
  | { tone: 'warn'; text: string }
  | null;

export interface LinkedAccountsListProps {
  rows: readonly AccountLinkRow[];
  /** 진행 중인 provider (연결하러 떠나는 중·해제 중) */
  busy?: SocialProvider | null;
  onLink?: (provider: SocialProvider) => void;
  onUnlink?: (provider: SocialProvider) => void;
}

/**
 * 연결된 로그인 수단 목록 (P3-07, 모양만). 줄마다 브랜드 로고 + 이름 + 상태(연결됨 · 연결한 날 / 연결 안 됨) + 버튼.
 * 이메일·이름·provider 식별자는 보여 주지 않는다. 막힌 줄은 이유를 글로 함께 적는다(버튼만 회색이 되지 않게).
 */
export function LinkedAccountsList({
  rows,
  busy = null,
  onLink,
  onUnlink,
}: LinkedAccountsListProps) {
  return (
    <ul className="flex flex-col gap-2.5" data-testid="linked-accounts">
      {rows.map((row) => {
        const Mark = SOCIAL_MARK[row.provider];
        const name = NAME[row.provider];
        const isBusy = busy === row.provider;
        return (
          <li
            key={row.provider}
            className="flex flex-wrap items-center gap-3 rounded-xl bg-surface-2 p-3"
            data-provider={row.provider}
            data-state={row.state}
          >
            <span
              className={cn(
                'grid size-10 shrink-0 place-items-center rounded-full',
                // 브랜드 로고를 각 사 면 색 위에 (네이버 흰 N, 카카오 검은 말풍선, Google 4색 G)
                row.provider === 'naver'
                  ? 'g-social-chip-naver'
                  : row.provider === 'kakao'
                    ? 'g-social-chip-kakao'
                    : 'bg-card',
              )}
              aria-hidden
            >
              <Mark className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold text-foreground">{name}</p>
              <p className="text-small text-muted-foreground">
                {row.state === 'linked' ? (
                  <span className="inline-flex items-center gap-1">
                    <Check aria-hidden className="size-4 text-primary-text" />
                    연결됨
                    {row.linkedAt && ` · ${formatKstDate(row.linkedAt, 'dot')}`}
                  </span>
                ) : row.state === 'blocked' ? (
                  'Google을 먼저 연결하면 붙일 수 있어요'
                ) : (
                  '연결 안 됨'
                )}
              </p>
              {row.state === 'linked' && !row.canUnlink && (
                <p className="text-small text-muted-foreground">
                  로그인할 방법이 하나뿐이라 끊을 수 없어요
                </p>
              )}
            </div>
            {row.state === 'linked' ? (
              <Button
                variant="secondary"
                size="sm"
                sfx={false}
                icon={<Unlink aria-hidden />}
                disabled={!row.canUnlink || busy !== null}
                loading={isBusy}
                onClick={() => onUnlink?.(row.provider)}
                aria-label={`${name} 연결 끊기`}
                data-testid={`unlink-${row.provider}`}
              >
                끊기
              </Button>
            ) : (
              <Button
                variant={row.state === 'available' ? 'primary' : 'secondary'}
                size="sm"
                icon={<Link2 aria-hidden />}
                disabled={row.state === 'blocked' || busy !== null}
                loading={isBusy}
                onClick={() => onLink?.(row.provider)}
                aria-label={`${name} 계정 연결하기`}
                data-testid={`link-${row.provider}`}
              >
                연결하기
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * 설정 화면 "로그인 계정 연결" (P3-07). 자동 연결이 없으므로(Kakao·Naver는 이메일이 없음, §2.8) 같은 아이가 여러 수단으로
 * 들어오려면 여기서 붙인다. 규칙은 `src/lib/auth/accountLinks.ts`, 연결은 `useLinkIdentity`(P1-14 헬퍼), 해제는
 * `POST /api/account/unlink`(마지막 수단 막기 · Kakao provider 쪽 unlink). 연결 실패(이미 다른 계정에 묶임 등)는
 * `/auth/callback` → P3-10 `/auth/error` 안내 → "설정으로 돌아가기".
 */
export function LinkedAccountsSection() {
  const titleId = useId();
  const link = useLinkIdentity();
  const [identities, setIdentities] = useState<IdentityLike[] | null>(null);
  const [busy, setBusy] = useState<SocialProvider | null>(null);
  const [confirm, setConfirm] = useState<SocialProvider | null>(null);
  const [status, setStatus] = useState<Status>(null);

  const load = useCallback(async () => {
    const supabase = await loadBrowserClient();
    const { data } = await supabase.auth.getUser();
    const list = (data.user?.identities ?? []) as IdentityLike[];
    setIdentities(list);
    return list;
  }, []);

  useEffect(() => {
    void (async () => {
      const list = await load();
      // 연결하고 돌아왔으면(`?linked=`) 정말 붙었을 때만 알려 준다
      const result = takeLinkedResult(window.location.href);
      if (!result) return;
      try {
        window.history.replaceState(window.history.state, '', result.cleaned);
      } catch {
        // 무시
      }
      const rows = accountLinkRows(list, ENABLED_LOGIN_PROVIDERS);
      if (
        rows.some((r) => r.provider === result.provider && r.state === 'linked')
      ) {
        setStatus({
          tone: 'good',
          text: `${NAME[result.provider]} 계정을 연결했어요. 이제 ${NAME[result.provider]}로 들어와도 같은 모험이 이어져요!`,
        });
      }
    })();
  }, [load]);

  const handleLink = async (provider: SocialProvider) => {
    setBusy(provider);
    setStatus(null);
    const result = await link(provider);
    if (result === 'redirecting') return;
    setBusy(null);
    setStatus({
      tone: 'warn',
      text:
        result === 'external-only'
          ? '여기(앱 안 화면)에서는 Google을 연결할 수 없어요. Chrome이나 Safari에서 pyRoad에 로그인한 뒤 설정에서 연결해 줘.'
          : '연결을 시작하지 못했어요. 잠시 뒤에 다시 해 줘.',
    });
  };

  const handleUnlink = async (provider: SocialProvider) => {
    setConfirm(null);
    setBusy(provider);
    setStatus(null);
    try {
      const res = await fetch('/api/account/unlink', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        providerSide?: string;
      };
      if (!res.ok) {
        setStatus({
          tone: 'warn',
          text: data.error ?? '연결을 끊지 못했어요. 잠시 뒤에 다시 해 줘.',
        });
        return;
      }
      // 이 수단으로 들어오면 이제 새 계정이 되므로 "최근에 사용" 배지를 지운다 (P3-08)
      forgetLastLoginIf(provider);
      const note =
        data.providerSide === 'manual' || data.providerSide === 'failed'
          ? ` ${PROVIDER_SIDE_NOTE[provider] ?? ''}`
          : '';
      setStatus({
        tone: note ? 'warn' : 'good',
        text: `${NAME[provider]} 연결을 끊었어요.${note}`,
      });
      await load();
    } catch {
      setStatus({
        tone: 'warn',
        text: '연결을 끊지 못했어요. 잠시 뒤에 다시 해 줘.',
      });
    } finally {
      setBusy(null);
    }
  };

  const rows = identities
    ? accountLinkRows(identities, ENABLED_LOGIN_PROVIDERS)
    : null;

  return (
    <section
      aria-labelledby={titleId}
      className="mb-6 rounded-xl border border-border bg-card p-4 shadow-sm"
      data-testid="linked-accounts-section"
    >
      <h2
        id={titleId}
        className="mb-1 flex items-center gap-2 text-lg font-bold text-foreground"
      >
        <KeyRound aria-hidden className="h-5 w-5 text-accent-foreground" />
        로그인 계정 연결
      </h2>
      <p className="mb-3 text-base text-muted-foreground">
        여러 계정을 이어 두면 어느 것으로 들어와도 같은 모험이 이어져요.
      </p>

      {rows ? (
        <LinkedAccountsList
          rows={rows}
          busy={busy}
          onLink={(p) => void handleLink(p)}
          onUnlink={setConfirm}
        />
      ) : (
        <p className="text-base text-muted-foreground">불러오는 중...</p>
      )}

      {status && (
        <p
          role="status"
          className={cn(
            'mt-3 rounded-xl px-3 py-2.5 text-small text-foreground',
            status.tone === 'good' ? 'bg-success-soft' : 'bg-warning-soft',
          )}
          data-testid="linked-accounts-status"
        >
          {status.text}
        </p>
      )}

      <p className="mt-3 text-small text-muted-foreground">
        이미 다른 pyRoad 계정에서 쓰는 계정은 연결할 수 없어요. 두 계정을 합치는
        건 아직 안 돼요.
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
              {confirm ? `${NAME[confirm]} 연결을 끊을까요?` : ''}
            </AlertDialogTitle>
            <AlertDialogDescription>
              끊으면 {confirm ? NAME[confirm] : ''}로는 이 모험에 들어올 수
              없어요. 그걸로 들어오면 새 계정이 만들어져요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              variant="danger"
              onClick={() => confirm && void handleUnlink(confirm)}
              data-testid="unlink-confirm"
            >
              끊기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
