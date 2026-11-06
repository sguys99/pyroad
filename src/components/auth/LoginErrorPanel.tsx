import { ArrowLeft, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PybaemStatic } from '@/components/characters/rig';
import type { LoginErrorReason } from '@/lib/auth/loginError';
import type { SocialProvider } from '@/lib/auth/socialLogin';
import { ENABLED_LOGIN_PROVIDERS } from '@/lib/auth/enabledProviders';
import { loginErrorCopy, loginErrorHint } from './loginErrorCopy';

export interface LoginErrorPanelProps {
  reason: LoginErrorReason;
  via?: SocialProvider | null;
  /** 돌아갈 곳 (흐름을 시작한 화면, `safeNext`를 통과한 값). 없으면 처음 화면만 */
  backHref?: string | null;
  /** 돌아가기 버튼 글자 */
  backLabel?: string;
  /** 제목 수준 (화면 제목이면 h1, 카탈로그처럼 다른 화면 안이면 h2) */
  headingLevel?: 'h1' | 'h2';
}

/**
 * 로그인 실패 안내 패널 (P3-10): 랜딩 밖에서 시작한 흐름(설정의 계정 연결 P3-07 등)이 실패했을 때 `/auth/error`가 그린다.
 * 랜딩에서 시작한 로그인은 로그인 시트가 같은 문구를 보여 준다(`LoginSheet notice`).
 * 서버에서 그린다(훅 없음): 정지 파이뱀(`PybaemStatic`, 움직임 없음) + 제목 + 설명 + "다른 방법" 한마디 + 돌아가기.
 */
export function LoginErrorPanel({
  reason,
  via = null,
  backHref = null,
  backLabel = '돌아가기',
  headingLevel: Heading = 'h1',
}: LoginErrorPanelProps) {
  const copy = loginErrorCopy(reason, via);
  const hint = loginErrorHint(reason, {
    via,
    available: ENABLED_LOGIN_PROVIDERS,
  });
  return (
    <section
      aria-labelledby={`login-error-title-${reason}`}
      className="mx-auto flex w-full max-w-md flex-col items-center gap-4 rounded-2xl bg-card p-6 text-center shadow-card"
      data-surface="raised"
      data-testid={`login-error-panel-${reason}`}
    >
      <PybaemStatic state={copy.rig} size={120} framing="avatar" label="" />
      <div className="grid gap-1.5">
        <Heading
          id={`login-error-title-${reason}`}
          className="font-display text-h2 text-balance text-foreground"
        >
          {copy.title}
        </Heading>
        <p className="text-balance text-small text-muted-foreground">
          {copy.body}
        </p>
      </div>
      {hint && (
        <p className="flex items-start gap-2 rounded-xl bg-accent-soft px-3 py-2.5 text-left text-small text-foreground">
          <Lightbulb
            aria-hidden
            className="mt-0.5 size-4 shrink-0 text-accent-text"
          />
          {hint}
        </p>
      )}
      <div className="flex w-full flex-col gap-2.5">
        {backHref && (
          <Button
            href={backHref}
            size="lg"
            icon={<ArrowLeft aria-hidden />}
            className="w-full"
          >
            {backLabel}
          </Button>
        )}
        <Button
          href="/"
          variant={backHref ? 'secondary' : 'primary'}
          size="lg"
          className="w-full"
        >
          처음 화면으로
        </Button>
      </div>
    </section>
  );
}
