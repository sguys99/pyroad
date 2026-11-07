// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MotionTierProvider } from '@/lib/motion/MotionTierProvider';
import type { MotionTier } from '@/lib/motion/tier';

const play = vi.fn();
vi.mock('@/components/providers/soundContext', () => ({
  useSfx: () => play,
}));

import { Button, IconButton } from '../button';

// 게임 버튼 (P2-11): 변형·크기 표시, 눌림 상태, 로딩·비활성, 탭 소리, 단계별 복귀 연출

const animate = vi.fn();

function renderAt(
  ui: React.ReactNode,
  {
    tier = 'full',
    reduced = false,
  }: { tier?: MotionTier; reduced?: boolean } = {},
) {
  return render(
    <MotionTierProvider tier={tier} reduced={reduced ? 'on' : 'off'}>
      {ui}
    </MotionTierProvider>,
  );
}

beforeEach(() => {
  play.mockReset();
  animate.mockReset();
  // jsdom에는 WAAPI가 없다
  HTMLElement.prototype.animate = animate as unknown as HTMLElement['animate'];
});
afterEach(() => {
  cleanup();
  delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
});

describe('Button (게임 버튼)', () => {
  it('변형·크기를 data 속성으로 내고 기본은 primary·md, 글자는 면(face) 안에 그린다', () => {
    renderAt(
      <>
        <Button>시작</Button>
        <Button variant="reward" size="lg">
          받기
        </Button>
      </>,
    );
    const start = screen.getByRole('button', { name: '시작' });
    expect(start).toHaveAttribute('data-variant', 'primary');
    expect(start).toHaveAttribute('data-size', 'md');
    expect(start).toHaveClass('g-btn');
    expect(start.querySelector('.g-btn-face')).toHaveTextContent('시작');
    expect(screen.getByRole('button', { name: '받기' })).toHaveAttribute(
      'data-size',
      'lg',
    );
  });

  it('누르면 data-pressed, 손을 떼거나 벗어나면 풀린다', () => {
    renderAt(<Button>눌러</Button>);
    const b = screen.getByRole('button', { name: '눌러' });
    fireEvent.pointerDown(b, { button: 0 });
    expect(b).toHaveAttribute('data-pressed');
    fireEvent.pointerUp(b);
    expect(b).not.toHaveAttribute('data-pressed');
    fireEvent.pointerDown(b, { button: 0 });
    fireEvent.pointerLeave(b);
    expect(b).not.toHaveAttribute('data-pressed');
  });

  it('키보드 Space·Enter도 눌림 상태를 보여 준다', () => {
    renderAt(<Button>키보드</Button>);
    const b = screen.getByRole('button', { name: '키보드' });
    fireEvent.keyDown(b, { key: ' ' });
    expect(b).toHaveAttribute('data-pressed');
    fireEvent.keyUp(b, { key: ' ' });
    expect(b).not.toHaveAttribute('data-pressed');
  });

  it('full 단계만 손을 뗄 때 jellyB 출렁임(WAAPI)을 건다', () => {
    renderAt(<Button>젤리</Button>);
    const b = screen.getByRole('button', { name: '젤리' });
    fireEvent.pointerDown(b, { button: 0 });
    fireEvent.pointerUp(b);
    expect(animate).toHaveBeenCalledTimes(1);
    const [frames, timing] = animate.mock.calls[0];
    expect(frames[0].transform).toContain('translateY(3px)');
    expect(timing.easing).toMatch(/^linear\(/);
  });

  it.each([
    ['lite', false],
    ['minimal', false],
    ['full', true],
  ] as const)(
    '%s 단계 · 동작 줄이기=%s 에서는 JS 출렁임이 없다 (CSS가 face 스프링·즉시·색만으로 처리)',
    (tier, reduced) => {
      renderAt(<Button>조용히</Button>, { tier, reduced });
      const b = screen.getByRole('button', { name: '조용히' });
      fireEvent.pointerDown(b, { button: 0 });
      fireEvent.pointerUp(b);
      expect(animate).not.toHaveBeenCalled();
    },
  );

  it('로딩: aria-busy · 누를 수 없음 · 도는 표시, 변형 색은 그대로(data-loading)', () => {
    const onClick = vi.fn();
    renderAt(
      <Button loading onClick={onClick}>
        저장 중...
      </Button>,
    );
    const b = screen.getByRole('button', { name: '저장 중...' });
    expect(b).toHaveAttribute('aria-busy', 'true');
    expect(b).toHaveAttribute('data-loading');
    expect(b).toBeDisabled();
    expect(b.querySelector('.animate-spin')).not.toBeNull();
    fireEvent.click(b);
    expect(onClick).not.toHaveBeenCalled();
    expect(play).not.toHaveBeenCalled();
  });

  it('비활성: 누르지 못하고 눌림 상태도 생기지 않는다', () => {
    renderAt(<Button disabled>잠김</Button>);
    const b = screen.getByRole('button', { name: '잠김' });
    expect(b).toBeDisabled();
    fireEvent.pointerDown(b, { button: 0 });
    expect(b).not.toHaveAttribute('data-pressed');
  });

  it('탭 소리: primary·reward는 기본 tap, secondary는 없음, sfx로 바꾸거나 끈다', () => {
    renderAt(
      <>
        <Button>주요</Button>
        <Button variant="reward">보상</Button>
        <Button variant="secondary">보조</Button>
        <Button sfx={false}>조용</Button>
        <Button variant="ghost" sfx="coin">
          코인
        </Button>
      </>,
    );
    for (const name of ['주요', '보상', '보조', '조용', '코인']) {
      fireEvent.click(screen.getByRole('button', { name }));
    }
    expect(play.mock.calls.map((c) => c[0])).toEqual(['tap', 'tap', 'coin']);
  });

  it('href를 주면 링크로 그린다 (Next Link)', () => {
    renderAt(<Button href="/quest/abc">다음 퀘스트로 →</Button>);
    const link = screen.getByRole('link', { name: '다음 퀘스트로 →' });
    expect(link).toHaveAttribute('href', '/quest/abc');
    expect(link).toHaveClass('g-btn');
  });

  it('아이콘 슬롯은 글자 앞뒤에 놓인다', () => {
    renderAt(
      <Button
        icon={<svg data-testid="i1" />}
        iconRight={<svg data-testid="i2" />}
      >
        가운데
      </Button>,
    );
    const face = screen.getByRole('button').querySelector('.g-btn-face')!;
    const kids = Array.from(face.childNodes);
    expect(kids[0]).toContainElement(screen.getByTestId('i1'));
    expect(kids[kids.length - 1]).toContainElement(screen.getByTestId('i2'));
  });
});

describe('IconButton', () => {
  it('아이콘만 있어도 접근성 이름이 있고 기본 48px 원(md)', () => {
    render(
      <IconButton label="닫기">
        <svg />
      </IconButton>,
    );
    const b = screen.getByRole('button', { name: '닫기' });
    expect(b).toHaveAttribute('type', 'button');
    expect(b).toHaveAttribute('data-size', 'md');
    expect(b).toHaveClass('g-icon-btn');
  });
});
