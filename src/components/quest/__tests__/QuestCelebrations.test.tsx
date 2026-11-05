// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  cleanup,
  fireEvent,
  act,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { LazyMotion, domAnimation } from 'framer-motion';
import type { CelebrationEvent } from '@/lib/quest/celebrationEvents';
import { MIN_DWELL_MS } from '@/lib/celebration/plan';
import { CelebrationSoundContext } from '@/lib/celebration/sound';
import { MotionTierProvider } from '@/lib/motion/MotionTierProvider';
import type { ReducedMotionSetting } from '@/lib/motion/tier';

// Framer의 퇴장 연출 시간은 jsdom에서 재현되지 않으므로(모듈을 불러올 때 진짜 rAF를 잡아 둠) AnimatePresence를
// "퇴장 즉시 완료"로 바꾼다: 자식이 사라지면 바로 onExitComplete. 시퀀서 규칙(순서·묶음·시간·정리)만 시험한다.
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  const { useEffect, useRef } = await import('react');
  function AnimatePresence({
    children,
    onExitComplete,
  }: {
    children?: React.ReactNode;
    onExitComplete?: () => void;
  }) {
    const had = useRef(false);
    const has =
      children !== null && children !== undefined && children !== false;
    useEffect(() => {
      if (had.current && !has) onExitComplete?.();
      had.current = has;
    });
    return <>{children}</>;
  }
  return { ...actual, AnimatePresence };
});

const mocks = vi.hoisted(() => ({
  confetti: vi.fn((): number => 1),
  resetConfetti: vi.fn(),
  tutor: vi.fn(
    async (): Promise<{ message: string; is_fallback: boolean } | null> => ({
      message: '정리했어요',
      is_fallback: false,
    }),
  ),
  sfx: vi.fn(),
}));
vi.mock('@/lib/confetti', () => ({
  fireConfetti: mocks.confetti,
  resetConfetti: mocks.resetConfetti,
}));
vi.mock('@/lib/tutor/useTutor', () => ({
  useTutor: () => ({ sendTutorStreamRequest: mocks.tutor }),
}));

import { QuestCelebrations } from '../QuestCelebrations';

beforeEach(() => {
  // 카운트업(rAF)·등장 직후 입력 무시(performance.now)·자동 넘김(setTimeout)을 시간으로 흘려 보냄
  vi.useFakeTimers({
    toFake: [
      'setTimeout',
      'clearTimeout',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'performance',
    ],
  });
  mocks.confetti.mockClear();
  mocks.resetConfetti.mockClear();
  mocks.tutor.mockClear();
  mocks.sfx.mockClear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const LEVEL_UP: CelebrationEvent = {
  type: 'level_up',
  level: 2,
  fromLevel: 1,
  title: '새싹 코더',
};
const STAGE: CelebrationEvent = {
  type: 'stage_clear',
  stage: {
    stage_id: 's1',
    order: 1,
    title: '시작의 숲',
    concepts: ['print', '변수'],
  },
};
const badge = (
  b: 'first_code' | 'stage_clear' | 'hint_master',
): CelebrationEvent => ({
  type: 'badge',
  badge: b,
});

function renderSeq(
  events: CelebrationEvent[],
  { reduced = 'off' as ReducedMotionSetting, onDismiss = vi.fn() } = {},
) {
  const ui = (list: CelebrationEvent[]) => (
    <LazyMotion features={domAnimation}>
      <MotionTierProvider reduced={reduced}>
        <CelebrationSoundContext.Provider value={{ play: mocks.sfx }}>
          <QuestCelebrations events={list} questId="q1" onDismiss={onDismiss} />
        </CelebrationSoundContext.Provider>
      </MotionTierProvider>
    </LazyMotion>
  );
  const utils = render(ui(events));
  return {
    ...utils,
    onDismiss,
    rerenderWith: (list: CelebrationEvent[]) => utils.rerender(ui(list)),
  };
}

/** 등장 직후 입력을 무시하는 시간이 지난 뒤 */
const DWELL = MIN_DWELL_MS + 50;

/** 시간을 흘려 보냄 (타이머·프레임·Promise) */
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

const stepKind = () =>
  screen
    .queryByTestId(/^celebration-step-/)
    ?.getAttribute('data-testid')
    ?.replace('celebration-step-', '') ?? null;

describe('QuestCelebrations: 큐 순서·묶음', () => {
  it('받은 순서와 상관없이 스테이지 클리어 → 레벨 업 → 뱃지 묶음, 한 번에 하나씩', async () => {
    const { onDismiss } = renderSeq([
      badge('first_code'),
      LEVEL_UP,
      badge('stage_clear'),
      STAGE,
    ]);
    await advance(0);
    expect(stepKind()).toBe('stage_clear');
    // 점: 3단계 중 1번째
    expect(screen.getByLabelText('축하 3개 중 1번째')).toBeInTheDocument();

    await advance(DWELL);
    fireEvent.click(screen.getByTestId('celebration-cta'));
    await advance(600);
    expect(stepKind()).toBe('level_up');

    await advance(DWELL);
    fireEvent.click(screen.getByTestId('celebration-cta'));
    await advance(600);
    expect(stepKind()).toBe('badges');
    // 뱃지 2개를 한 카드에
    expect(screen.getByText('뱃지 2개 획득!')).toBeInTheDocument();
    expect(screen.getByText('첫 코드')).toBeInTheDocument();
    expect(screen.getByText('스테이지 클리어')).toBeInTheDocument();

    await advance(DWELL);
    fireEvent.click(screen.getByTestId('celebration-cta'));
    // 퇴장 연출이 끝난 뒤(onExitComplete)에 받은 4개를 한꺼번에 비운다
    await advance(600);
    expect(screen.queryByTestId('celebration-overlay')).toBeNull();
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledWith(4);
  });

  it('배경은 시퀀스 내내 같은 요소로 남고 카드만 바뀐다 (깜빡임 없음)', async () => {
    renderSeq([LEVEL_UP, badge('first_code')]);
    await advance(0);
    const overlay = screen.getByTestId('celebration-overlay');
    await advance(DWELL);
    fireEvent.click(screen.getByTestId('celebration-cta'));
    await advance(600);
    expect(stepKind()).toBe('badges');
    expect(screen.getByTestId('celebration-overlay')).toBe(overlay);
  });

  it('이벤트가 없으면 아무것도 그리지 않는다', async () => {
    renderSeq([]);
    await advance(100);
    expect(screen.queryByTestId('celebration-overlay')).toBeNull();
  });

  it('보여 주는 중에 새 이벤트가 오면 뒤에 이어 붙인다', async () => {
    const { rerenderWith, onDismiss } = renderSeq([LEVEL_UP]);
    await advance(0);
    rerenderWith([LEVEL_UP, { type: 'coin', amount: 10 }]);
    await advance(DWELL);
    fireEvent.click(screen.getByTestId('celebration-cta'));
    await advance(600);
    expect(stepKind()).toBe('rewards');
    expect(screen.getByText('+10 코인')).toBeInTheDocument();
    await advance(DWELL);
    fireEvent.click(screen.getByTestId('celebration-cta'));
    await advance(600);
    expect(onDismiss).toHaveBeenCalledWith(2);
  });
});

describe('QuestCelebrations: 넘기기·자동 넘김·건너뛰기', () => {
  it('등장 직후(MIN_DWELL_MS 전)의 탭은 무시한다 (실행 버튼 연타가 바로 닫지 않게)', async () => {
    renderSeq([LEVEL_UP, badge('first_code')]);
    await advance(0);
    fireEvent.click(screen.getByTestId('celebration-cta'));
    await advance(600);
    expect(stepKind()).toBe('level_up');
  });

  it('배경을 탭하면 다음으로, 카드 안을 탭하면 그대로', async () => {
    renderSeq([LEVEL_UP, badge('first_code')]);
    await advance(DWELL);
    fireEvent.click(screen.getByText('새싹 코더'));
    await advance(600);
    expect(stepKind()).toBe('level_up');
    fireEvent.click(screen.getByTestId('celebration-overlay'));
    await advance(600);
    expect(stepKind()).toBe('badges');
  });

  it('자동 넘김: 레벨 업 6초, 뱃지 2개 6초. 포인터가 카드 위에 있으면 멈췄다가 남은 시간부터', async () => {
    const { onDismiss } = renderSeq([
      LEVEL_UP,
      badge('first_code'),
      badge('hint_master'),
    ]);
    await advance(0);
    expect(screen.getByTestId('celebration-countdown')).toHaveStyle({
      animationDuration: '6000ms',
    });
    await advance(5900);
    expect(stepKind()).toBe('level_up');
    await advance(700);
    expect(stepKind()).toBe('badges');
    expect(screen.getByTestId('celebration-countdown')).toHaveStyle({
      animationDuration: '6000ms',
    });

    // 뱃지 카드가 나온 지 약 2초 뒤 포인터를 올리고 오래 기다려도 그대로
    const card = screen.getByTestId('celebration-step-badges');
    await advance(2000);
    fireEvent.pointerEnter(card, { pointerType: 'mouse' });
    await advance(10000);
    expect(stepKind()).toBe('badges');
    expect(screen.getByTestId('celebration-countdown')).toHaveStyle({
      animationPlayState: 'paused',
    });
    // 남은 약 4초부터 다시
    fireEvent.pointerLeave(card, { pointerType: 'mouse' });
    await advance(3000);
    expect(stepKind()).toBe('badges');
    await advance(1500);
    await advance(600);
    expect(screen.queryByTestId('celebration-overlay')).toBeNull();
    expect(onDismiss).toHaveBeenCalledWith(3);
  });

  it('스테이지 클리어는 정리를 읽도록 자동으로 넘기지 않는다', async () => {
    renderSeq([STAGE, LEVEL_UP]);
    await advance(30000);
    expect(stepKind()).toBe('stage_clear');
    expect(screen.queryByTestId('celebration-countdown')).toBeNull();
    expect(screen.getByText('정리했어요')).toBeInTheDocument();
  });

  it('"모두 닫기"는 남은 축하를 한 번에 닫는다', async () => {
    const { onDismiss } = renderSeq([STAGE, LEVEL_UP, badge('first_code')]);
    await advance(0);
    fireEvent.click(screen.getByRole('button', { name: '모두 닫기' }));
    await advance(600);
    expect(screen.queryByTestId('celebration-overlay')).toBeNull();
    expect(onDismiss).toHaveBeenCalledWith(3);
  });
});

describe('QuestCelebrations: 키보드', () => {
  it('Enter·Space는 다음으로, Esc는 모두 닫기. CTA에 포커스가 간다', async () => {
    const { onDismiss } = renderSeq([
      STAGE,
      LEVEL_UP,
      badge('first_code'),
      badge('hint_master'),
    ]);
    await advance(DWELL);
    expect(screen.getByTestId('celebration-cta')).toHaveFocus();

    fireEvent.keyDown(window, { key: 'Enter' });
    await advance(600);
    expect(stepKind()).toBe('level_up');
    expect(screen.getByTestId('celebration-cta')).toHaveTextContent('멋져요!');

    await advance(DWELL);
    fireEvent.keyDown(window, { key: ' ' });
    await advance(600);
    expect(stepKind()).toBe('badges');

    fireEvent.keyDown(window, { key: 'Escape' });
    await advance(600);
    expect(screen.queryByTestId('celebration-overlay')).toBeNull();
    expect(onDismiss).toHaveBeenCalledWith(4);
  });

  it('닫히면 열기 전에 포커스가 있던 곳(실행 버튼 등)으로 돌려준다', async () => {
    const outside = document.createElement('button');
    outside.textContent = '실행';
    document.body.appendChild(outside);
    outside.focus();
    renderSeq([LEVEL_UP]);
    await advance(DWELL);
    expect(screen.getByTestId('celebration-cta')).toHaveFocus();
    fireEvent.keyDown(window, { key: 'Escape' });
    await advance(600);
    expect(outside).toHaveFocus();
    outside.remove();
  });

  it('대화 상자 접근성: role=dialog + 제목', async () => {
    renderSeq([LEVEL_UP]);
    await advance(0);
    expect(
      screen.getByRole('dialog', { name: '레벨 2 달성' }),
    ).toBeInTheDocument();
  });
});

describe('QuestCelebrations: 컨페티·효과음', () => {
  it('세기: 스테이지 클리어(3발) > 레벨 업(2발 + 숫자 pop 1발) > 뱃지 묶음(1발, 뱃지 수와 무관)', async () => {
    renderSeq([STAGE, LEVEL_UP, badge('first_code'), badge('hint_master')]);
    await advance(DWELL + 50);
    const stageShots = mocks.confetti.mock.calls.length;
    const stageParticles = mocks.confetti.mock.calls.reduce(
      (sum, c) =>
        sum + (c as unknown as [{ particleCount: number }])[0].particleCount,
      0,
    );
    expect(stageShots).toBe(3);

    mocks.confetti.mockClear();
    fireEvent.click(screen.getByTestId('celebration-cta'));
    await advance(2500);
    expect(stepKind()).toBe('level_up');
    expect(mocks.confetti).toHaveBeenCalledTimes(3);
    const levelParticles = mocks.confetti.mock.calls.reduce(
      (sum, c) =>
        sum + (c as unknown as [{ particleCount: number }])[0].particleCount,
      0,
    );
    expect(levelParticles).toBeLessThan(stageParticles);

    mocks.confetti.mockClear();
    fireEvent.click(screen.getByTestId('celebration-cta'));
    await advance(1500);
    expect(stepKind()).toBe('badges');
    expect(mocks.confetti).toHaveBeenCalledTimes(1);
    const badgeParticles = (
      mocks.confetti.mock.calls[0] as unknown as [{ particleCount: number }]
    )[0].particleCount;
    expect(badgeParticles).toBeLessThan(levelParticles);
  });

  it('효과음 키: 레벨 업은 levelup 한 번, 뱃지는 하나씩 음을 올려 star', async () => {
    renderSeq([LEVEL_UP, badge('first_code'), badge('hint_master')]);
    await advance(DWELL);
    expect(mocks.sfx).toHaveBeenCalledTimes(1);
    expect(mocks.sfx).toHaveBeenCalledWith('levelup', { rate: undefined });
    mocks.sfx.mockClear();
    fireEvent.click(screen.getByTestId('celebration-cta'));
    await advance(1000);
    expect(mocks.sfx.mock.calls).toEqual([
      ['star', { rate: 1 }],
      ['star', { rate: 1.26 }],
    ]);
  });

  it('빨리 넘기면 아직 쏘지 않은 컨페티는 취소된다 (겹쳐 쌓이지 않게)', async () => {
    renderSeq([STAGE, LEVEL_UP]);
    await advance(300);
    // 0.15초 첫 발만 나간 상태 (옆 2발은 0.45초)
    expect(mocks.confetti).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: 'Escape' });
    await advance(1000);
    expect(mocks.confetti).toHaveBeenCalledTimes(1);
  });

  it('언마운트(퀘스트 이동)하면 타이머가 정리되고 떠 있는 컨페티를 지운다', async () => {
    const { unmount, onDismiss } = renderSeq([LEVEL_UP, badge('first_code')]);
    await advance(100);
    unmount();
    expect(mocks.resetConfetti).toHaveBeenCalled();
    const shots = mocks.confetti.mock.calls.length;
    await advance(20000);
    expect(mocks.confetti.mock.calls.length).toBe(shots);
    expect(onDismiss).not.toHaveBeenCalled();
  });
});

describe('QuestCelebrations: reduced-motion', () => {
  it('컨페티 0, 카운트업 없이 처음부터 새 레벨, 자동 넘김 막대 없음', async () => {
    renderSeq([LEVEL_UP, badge('first_code')], { reduced: 'on' });
    await advance(0);
    expect(screen.getByTestId('celebration-overlay')).toHaveAttribute(
      'data-reduced',
      'true',
    );
    // 첫 프레임부터 Lv.2 (1에서 세지 않음)
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.queryByTestId('celebration-countdown')).toBeNull();
    await advance(3000);
    expect(mocks.confetti).not.toHaveBeenCalled();
    // 움직임 0: 카드에 transform이 남지 않는다
    expect(
      screen.getByTestId('celebration-step-level_up').style.transform,
    ).toMatch(/^(none)?$/);
  });

  it('움직임이 있으면 레벨 숫자는 이전 레벨에서 시작해 새 레벨로 센다', async () => {
    renderSeq([{ ...LEVEL_UP, level: 4, fromLevel: 1 } as CelebrationEvent]);
    await advance(0);
    expect(screen.getByText('1')).toBeInTheDocument();
    await advance(2000);
    expect(screen.getByText('4')).toBeInTheDocument();
  });
});

describe('QuestCelebrations: 황금키 완료', () => {
  it('가벼운 확인 카드: 컨페티 없음, 4.5초 뒤 자동으로 닫힘, 이어서 스테이지 클리어', async () => {
    const { onDismiss } = renderSeq([
      { type: 'golden_key', kind: 'code', questTitle: '변수 상자' },
      STAGE,
    ]);
    await advance(0);
    expect(stepKind()).toBe('golden_key');
    expect(screen.getByText('황금키로 문을 열었어요')).toBeInTheDocument();
    expect(
      screen.getByText('황금키로 연 퀘스트는 XP와 뱃지 없이 완료돼요'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('celebration-cta')).toHaveTextContent('알겠어요');
    await advance(4400);
    expect(stepKind()).toBe('golden_key');
    expect(mocks.confetti).not.toHaveBeenCalled();
    expect(mocks.sfx).toHaveBeenCalledWith('unlock', { rate: undefined });
    await advance(800);
    expect(stepKind()).toBe('stage_clear');
    expect(onDismiss).not.toHaveBeenCalled();
  });
});

describe('QuestCelebrations: 프로젝트 + 스테이지 마지막', () => {
  it('프로젝트 완성 카드 하나에 스테이지 클리어를 담는다 (따로 띄우지 않음)', async () => {
    renderSeq([
      {
        type: 'project_complete',
        questTitle: '나만의 게임',
        xpGained: 100,
        stage: {
          stage_id: 's7',
          order: 7,
          title: '최종 프로젝트',
          concepts: ['함수'],
        },
      },
      badge('first_code'),
    ]);
    await advance(2000);
    expect(stepKind()).toBe('project_complete');
    expect(
      screen.getByText('Stage 7 · 최종 프로젝트 완료!'),
    ).toBeInTheDocument();
    expect(screen.getByText(/나만의 게임을/)).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByLabelText('축하 2개 중 1번째')).toBeInTheDocument();
    expect(mocks.tutor).not.toHaveBeenCalled();
  });
});
