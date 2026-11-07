import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface LandingSectionProps {
  /** 앵커 id (`#try`처럼 헤더·버튼이 가리킴). 제목 id는 `<id>-title` */
  id: string;
  /** 제목 위 작은 눈썹 글자 */
  kicker?: ReactNode;
  title: ReactNode;
  /** 제목 아래 한두 줄 설명 */
  lead?: ReactNode;
  /** 바탕: plain(페이지 바탕) · surface(흰 면 띠) · soft(월드 틴트 띠, `data-world`를 따름) */
  tone?: 'plain' | 'surface' | 'soft';
  /** 머리글 정렬 */
  align?: 'start' | 'center';
  /** 본문 폭: wide(72rem) · narrow(48rem, FAQ·편지글) */
  width?: 'wide' | 'narrow';
  className?: string;
  children?: ReactNode;
}

/**
 * 랜딩 섹션 틀 (P4-01). 모든 아래쪽 섹션이 같은 여백·머리글·앵커 규칙을 쓰도록 한 곳에 둔다.
 * 스타일은 `landing.css`의 `.ld-sec*`. 머리글을 직접 그리고 싶으면 `title`만 주고 `children` 안에서 꾸며도 된다.
 *
 * - `<section id aria-labelledby>` + 제목 `<h2 tabIndex={-1}>`: 바로가기(`scrollToSection`)가 스크롤한 뒤 제목에 포커스를 옮긴다
 * - 고정 헤더 높이만큼 `scroll-margin-top`이 걸려 있다
 */
export function LandingSection({
  id,
  kicker,
  title,
  lead,
  tone = 'plain',
  align = 'start',
  width = 'wide',
  className,
  children,
}: LandingSectionProps) {
  const titleId = `${id}-title`;
  return (
    <section
      id={id}
      aria-labelledby={titleId}
      data-tone={tone}
      data-align={align}
      data-width={width}
      className={cn('ld-sec', className)}
    >
      <div className="ld-sec-in">
        <header className="ld-sec-head">
          {kicker && <span className="ld-kicker">{kicker}</span>}
          <h2 id={titleId} tabIndex={-1} className="ld-h2 font-display">
            {title}
          </h2>
          {lead && <p className="ld-lead">{lead}</p>}
        </header>
        {children}
      </div>
    </section>
  );
}
