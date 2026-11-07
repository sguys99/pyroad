import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** 카탈로그 절 (목차 anchor). 시안의 담백한 구성: 눈썹 글자 + Jua 제목 + 보조 설명 */
export function Section({
  id,
  kicker,
  title,
  description,
  children,
}: {
  id: string;
  kicker: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-40 space-y-5 lg:scroll-mt-28"
      data-catalog-section={id}
    >
      <header className="space-y-1">
        <p className="text-kicker text-primary-text">{kicker}</p>
        <h2 id={`${id}-title`} className="font-display text-h2">
          {title}
        </h2>
        {description && (
          <p className="max-w-3xl text-small text-muted-foreground">
            {description}
          </p>
        )}
      </header>
      {children}
    </section>
  );
}

/** 견본 한 칸: 흰 면 + 이름표. `raised`가 아니면 바탕 위(흰 버튼이 흰 면 그대로) */
export function Demo({
  label,
  note,
  children,
  className,
  surface = 'bg',
  'data-testid': testId,
}: {
  label: ReactNode;
  note?: ReactNode;
  children: ReactNode;
  className?: string;
  /** bg: 앱 바탕 위 · card: 흰 카드 위(data-surface="raised") */
  surface?: 'bg' | 'card';
  'data-testid'?: string;
}) {
  return (
    <div
      className={cn(
        'min-w-0 space-y-3 rounded-2xl p-4',
        surface === 'card'
          ? 'bg-card shadow-card'
          : 'bg-background ring-1 ring-border',
        className,
      )}
      data-surface={surface === 'card' ? 'raised' : undefined}
      data-testid={testId}
    >
      <div className="space-y-0.5">
        <p className="text-caption font-semibold text-foreground">{label}</p>
        {note && <p className="text-caption text-muted-foreground">{note}</p>}
      </div>
      {children}
    </div>
  );
}

/** 짧은 사용 코드 예시 (선택). 접어 두고 필요할 때 펼친다 */
export function CodeSample({ code }: { code: string }) {
  return (
    <details className="group rounded-xl bg-surface-2 text-caption">
      <summary className="flex min-h-touch cursor-pointer items-center px-3 font-semibold text-muted-foreground select-none">
        코드 예시
      </summary>
      <pre className="overflow-x-auto px-3 pb-3 font-mono text-caption leading-relaxed text-foreground">
        <code>{code}</code>
      </pre>
    </details>
  );
}

/** 상태 이름표 (견본 아래 작은 글자) */
export function Tag({ children }: { children: ReactNode }) {
  return <span className="text-caption text-muted-foreground">{children}</span>;
}

/** 견본 + 아래 이름표 */
export function Labeled({
  label,
  children,
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-start gap-1.5', className)}>
      {children}
      <Tag>{label}</Tag>
    </div>
  );
}
