'use client';

import { AArrowDown, AArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CODE_FONT_SIZES, type CodeFontSize } from '@/lib/editor/fontSize';

interface CodeFontSizeControlProps {
  size: CodeFontSize;
  onChange: (dir: 1 | -1) => void;
  className?: string;
}

const btn =
  'inline-flex size-touch items-center justify-center rounded-full text-text transition-colors hover:bg-surface focus-ring disabled:text-text-muted disabled:hover:bg-transparent';

/**
 * 코드 글자 크기 조절 (P2-18). 14·16·18·20px 네 단계(짝수만). 버튼은 48px 터치 영역, 지금 크기는 가운데 숫자로 보여 주고
 * 바뀌면 화면 읽기 프로그램이 읽는다(`output`은 기본 polite 라이브 영역)
 */
export function CodeFontSizeControl({
  size,
  onChange,
  className,
}: CodeFontSizeControlProps) {
  const min = CODE_FONT_SIZES[0];
  const max = CODE_FONT_SIZES[CODE_FONT_SIZES.length - 1];
  return (
    <div
      role="group"
      aria-label="코드 글자 크기"
      data-testid="code-font-size"
      className={cn(
        'inline-flex items-center rounded-full bg-surface-2',
        className,
      )}
    >
      <button
        type="button"
        className={btn}
        aria-label="코드 글자 작게"
        disabled={size <= min}
        onClick={() => onChange(-1)}
        data-testid="code-font-smaller"
      >
        <AArrowDown aria-hidden className="size-5" strokeWidth={2.2} />
      </button>
      <output
        className="min-w-[3ch] text-center text-caption text-text tabular-nums"
        data-testid="code-font-size-value"
      >
        <span className="sr-only">코드 글자 크기 </span>
        {size}
      </output>
      <button
        type="button"
        className={btn}
        aria-label="코드 글자 크게"
        disabled={size >= max}
        onClick={() => onChange(1)}
        data-testid="code-font-larger"
      >
        <AArrowUp aria-hidden className="size-5" strokeWidth={2.2} />
      </button>
    </div>
  );
}
