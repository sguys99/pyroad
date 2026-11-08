import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FONT_FAMILY, themeCssVars } from '@/lib/design/tokens';
import { cn, themeScale } from '@/lib/utils';

// cn()이 프로젝트 토큰 유틸리티를 아는지 (B44): 글자 크기 + 색이 둘 다 남고, 같은 그룹끼리는 뒤가 이긴다

const sizes = themeScale('text');
const shadows = themeScale('shadow');
const spacings = themeScale('spacing');
const eases = themeScale('ease');
const radii = themeScale('radius');

/** 글자색 토큰 (text-<색>) — 이름이 크기와 겹치기 쉬운 것 포함 */
const TEXT_COLORS = [
  'text-text',
  'text-text-muted',
  'text-primary-text',
  'text-accent-text',
  'text-on-primary',
  'text-muted-foreground',
  'text-foreground',
  'text-code-text',
  'text-error',
];

describe('themeScale: 토큰 원본에서 이름 뽑기', () => {
  it('글자 크기는 TYPE 전부 (하위 값 --line-height 등은 빼고)', () => {
    expect(sizes).toEqual(
      expect.arrayContaining(['small', 'caption', 'body', 'h1', 'h2', 'h3']),
    );
    expect(sizes).toContain('hero-wide');
    expect(sizes).toContain('button-lg');
    expect(sizes.some((s) => s.includes('--'))).toBe(false);
  });

  it('globals.css @theme의 --text-*·--shadow-*·--spacing-*·--ease-*와 같은 이름', () => {
    const css = readFileSync(
      join(process.cwd(), 'src/app/globals.css'),
      'utf8',
    );
    // @theme 블록만 (뒤의 :root에는 --text·--text-muted 같은 색 변수가 있다)
    const start = css.indexOf('@theme');
    const theme = css.slice(start, css.indexOf('\n}', start));
    const inCss = (prefix: string) =>
      [...theme.matchAll(new RegExp(`--${prefix}-([a-z0-9-]+?):`, 'g'))]
        .map((m) => m[1])
        .filter((n) => !n.includes('--'));
    expect(new Set(sizes)).toEqual(new Set(inCss('text')));
    expect(new Set(shadows)).toEqual(new Set(inCss('shadow')));
    expect(new Set(spacings)).toEqual(new Set(inCss('spacing')));
    expect(new Set(eases)).toEqual(new Set(inCss('ease')));
  });

  it('토큰을 더하면 자동으로 따라온다 (목록을 손으로 적지 않음)', () => {
    const vars = { ...themeCssVars(), '--text-giant': '3rem' };
    expect(themeScale('text', vars)).toContain('giant');
  });
});

describe('cn: 글자 크기 × 글자색', () => {
  for (const size of sizes) {
    it(`text-${size}: 색과 함께 둘 다 남는다 (앞뒤 어느 쪽이든)`, () => {
      for (const color of TEXT_COLORS) {
        expect(cn(`text-${size}`, color).split(' ')).toEqual([
          `text-${size}`,
          color,
        ]);
        expect(cn(color, `text-${size}`).split(' ')).toEqual([
          color,
          `text-${size}`,
        ]);
      }
    });
  }

  it('크기끼리는 뒤가 이긴다 (Tailwind 기본 크기와도)', () => {
    expect(cn('text-small', 'text-caption')).toBe('text-caption');
    expect(cn('text-button-lg', 'text-button')).toBe('text-button');
    expect(cn('text-h1', 'text-hero-wide')).toBe('text-hero-wide');
    expect(cn('text-small', 'text-lg')).toBe('text-lg');
    expect(cn('text-base', 'text-body')).toBe('text-body');
  });

  it('색끼리는 뒤가 이긴다', () => {
    expect(cn('text-small text-text-muted', 'text-primary-text')).toBe(
      'text-small text-primary-text',
    );
    // 크기 이름으로 시작하는 색(code → code-text)도 색으로 본다
    expect(cn('text-code', 'text-code-text', 'text-text')).toBe(
      'text-code text-text',
    );
  });
});

describe('cn: 그림자·반경·간격·easing·글꼴', () => {
  it('그림자 토큰은 그림자(크기) 그룹: 서로 덮고, 그림자 색과는 함께 남는다', () => {
    for (const s of shadows) {
      expect(cn('shadow-none', `shadow-${s}`)).toBe(`shadow-${s}`);
      expect(cn(`shadow-${s}`, 'shadow-primary/20')).toBe(
        `shadow-${s} shadow-primary/20`,
      );
    }
    expect(cn('shadow-card', 'shadow-pop')).toBe('shadow-pop');
  });

  it('반경은 뒤가 이긴다', () => {
    for (const r of radii)
      expect(cn('rounded-full', `rounded-${r}`)).toBe(`rounded-${r}`);
  });

  it('간격 토큰(touch·gutter)은 숫자 간격과 서로 덮는다', () => {
    for (const s of spacings) {
      expect(cn('px-4', `px-${s}`)).toBe(`px-${s}`);
      expect(cn(`min-h-${s}`, 'min-h-12')).toBe('min-h-12');
      expect(cn(`size-${s}`, 'size-10')).toBe('size-10');
    }
  });

  it('easing 토큰은 뒤가 이긴다', () => {
    for (const e of eases)
      expect(cn('ease-linear', `ease-${e}`)).toBe(`ease-${e}`);
  });

  it('글꼴 토큰은 글꼴 그룹, 굵기와 함께 남는다', () => {
    for (const f of Object.keys(FONT_FAMILY)) {
      expect(cn('font-sans', `font-${f}`, 'font-bold')).toBe(
        `font-${f} font-bold`,
      );
    }
  });
});
