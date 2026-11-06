// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MotionTierProvider } from '@/lib/motion/MotionTierProvider';
import { DURATION } from '@/lib/motion/tokens';
import { Button } from '../button';
import { Modal, Sheet } from '../sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../alert-dialog';
import { Toast, ToastRegion, ToastViewport, useToastQueue } from '../toast';
import { SpeechBubble, TYPING_CHAR_MS } from '../speech-bubble';
import { RewardIcon, Stars } from '../reward-icon';

vi.mock('@/components/providers/soundContext', () => ({
  useSfx: () => () => {},
}));

// 모달·시트·토스트·말풍선·보상 아이콘 (P2-11): 역할·이름·포커스·Esc·자동 닫힘·타자 효과 분기

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Sheet · Modal', () => {
  it('트리거로 열면 이름 있는 modal dialog, 포커스가 안으로, Esc로 닫고 트리거로 돌아온다', async () => {
    render(
      <Sheet
        title="설정"
        description="소리와 움직임"
        trigger={<Button variant="secondary">열기</Button>}
        footer={<Button>확인</Button>}
      >
        <p>내용</p>
      </Sheet>,
    );
    const trigger = screen.getByRole('button', { name: '열기' });
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: '설정' });
    expect(dialog).toHaveAttribute('data-slot', 'sheet');
    expect(dialog).toHaveAttribute('data-surface', 'raised');
    expect(dialog).toHaveAccessibleDescription('소리와 움직임');
    await waitFor(() =>
      expect(dialog).toContainElement(document.activeElement as HTMLElement),
    );
    expect(screen.getByRole('button', { name: '닫기' })).toBeInTheDocument();

    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('Modal은 가운데 대화 상자(.g-modal), 닫기 버튼으로 닫힘을 알린다', async () => {
    const onOpenChange = vi.fn();
    render(
      <Modal open title="안내" onOpenChange={onOpenChange}>
        <p>본문</p>
      </Modal>,
    );
    const dialog = await screen.findByRole('dialog', { name: '안내' });
    expect(dialog).toHaveClass('g-modal');
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('AlertDialog (확인 모달)', () => {
  it('alertdialog 역할, 덮개 g-scrim, 확인·취소 게임 버튼', async () => {
    render(
      <AlertDialog>
        <AlertDialogTrigger render={<Button variant="danger" />}>
          지우기
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>정말 지울까요?</AlertDialogTitle>
            <AlertDialogDescription>되돌릴 수 없어요.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction variant="danger">지우기</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>,
    );
    fireEvent.click(screen.getByRole('button', { name: '지우기' }));
    const dialog = await screen.findByRole('alertdialog', {
      name: '정말 지울까요?',
    });
    expect(dialog).toHaveClass('g-modal');
    expect(document.querySelector('.g-scrim')).not.toBeNull();
    const cancel = screen.getByRole('button', { name: '취소' });
    expect(cancel).toHaveAttribute('data-variant', 'secondary');
    expect(
      screen
        .getAllByRole('button', { name: '지우기' })
        .some((b) => b.getAttribute('data-variant') === 'danger'),
    ).toBe(true);
    fireEvent.click(cancel);
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });
});

describe('Toast', () => {
  beforeEach(() => vi.useFakeTimers());

  it('늘 떠 있는 status·aria-live 영역 안에서, 끝나기 직전 흐려지고 duration 뒤 닫힌다', () => {
    const onClose = vi.fn();
    render(
      <ToastRegion>
        <Toast duration={3000} onClose={onClose} tone="good">
          저장했어요
        </Toast>
      </ToastRegion>,
    );
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveTextContent('저장했어요');
    const toast = region.querySelector('[data-slot="toast"]')!;
    expect(toast).toHaveAttribute('data-tone', 'good');
    act(() => {
      vi.advanceTimersByTime(3000 - DURATION.fast);
    });
    expect(toast).toHaveAttribute('data-leaving');
    expect(onClose).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(DURATION.fast);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('닫기 버튼은 바로 닫고, duration 0이면 저절로 닫히지 않는다', () => {
    const onClose = vi.fn();
    render(
      <Toast duration={0} onClose={onClose} closeLabel="안내 닫기">
        잠겨 있어요
      </Toast>,
    );
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '안내 닫기' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('useToastQueue: 최대 개수만 쌓고 자동으로 빠진다', () => {
    function Q() {
      const { toasts, show, dismiss } = useToastQueue(2);
      return (
        <>
          <button
            type="button"
            onClick={() => show('하나', { duration: 1000 })}
          >
            추가
          </button>
          <ToastViewport toasts={toasts} onDismiss={dismiss} />
        </>
      );
    }
    render(<Q />);
    const add = screen.getByRole('button', { name: '추가' });
    fireEvent.click(add);
    fireEvent.click(add);
    fireEvent.click(add);
    expect(document.querySelectorAll('[data-slot="toast"]')).toHaveLength(2);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(document.querySelectorAll('[data-slot="toast"]')).toHaveLength(0);
  });
});

describe('SpeechBubble', () => {
  const TEXT = '안녕! 같이 해 보자';

  it('full: 한 글자씩 나타나지만 상자에는 처음부터 전체 문장(남은 글자는 숨김), 낭독기는 전체 문장', () => {
    vi.useFakeTimers();
    render(
      <MotionTierProvider tier="full" reduced="off">
        <SpeechBubble speaker="파이뱀" text={TEXT} typing />
      </MotionTierProvider>,
    );
    const p = document.querySelector('.g-bubble-t')!;
    expect(p.querySelector('.sr-only')).toHaveTextContent(TEXT);
    expect(p.querySelector('.g-bubble-rest')).toHaveTextContent(TEXT);
    expect(screen.getByTestId('bubble-caret')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(TYPING_CHAR_MS * 3);
    });
    expect(p.querySelector('.g-bubble-rest')?.textContent).toBe(
      [...TEXT].slice(3).join(''),
    );
    act(() => {
      vi.advanceTimersByTime(TYPING_CHAR_MS * TEXT.length);
    });
    expect(p.querySelector('.g-bubble-rest')?.textContent).toBe('');
    expect(screen.queryByTestId('bubble-caret')).toBeNull();
  });

  it.each([
    ['minimal', 'off'],
    ['full', 'on'],
  ] as const)('%s · 동작 줄이기 %s: 처음부터 전체 문장', (tier, reduced) => {
    render(
      <MotionTierProvider tier={tier} reduced={reduced}>
        <SpeechBubble text={TEXT} typing tone="good" tail="top" />
      </MotionTierProvider>,
    );
    const bubble = document.querySelector('.g-bubble')!;
    expect(bubble).toHaveAttribute('data-tone', 'good');
    expect(bubble).toHaveAttribute('data-tail', 'top');
    expect(bubble.querySelector('.g-bubble-rest')?.textContent).toBe('');
    expect(screen.queryByTestId('bubble-caret')).toBeNull();
  });

  it('children 내용 + 이름표 + 배지, tail="none"이면 꼬리 없음', () => {
    render(
      <SpeechBubble
        speaker="파이뱀 선생님"
        badge={<span>저장된 답변</span>}
        tail="none"
      >
        <strong>굵게</strong>
      </SpeechBubble>,
    );
    const bubble = document.querySelector('.g-bubble')!;
    expect(bubble).not.toHaveAttribute('data-tail');
    expect(bubble).toHaveTextContent('파이뱀 선생님저장된 답변굵게');
  });
});

describe('RewardIcon · Stars', () => {
  it('label이 있으면 그림(img), 없으면 장식(aria-hidden). 색은 토큰 클래스', () => {
    render(
      <>
        <RewardIcon kind="coin" label="코인" />
        <RewardIcon kind="key" />
      </>,
    );
    const coin = screen.getByRole('img', { name: '코인' });
    expect(coin.querySelector('.fill-accent')).not.toBeNull();
    const key = document.querySelector('[data-reward="key"]')!;
    expect(key).toHaveAttribute('aria-hidden', 'true');
  });

  it('Stars: "별 2개 / 3개"로 한 번 읽히고 빈 별을 채운다', () => {
    render(<Stars n={2} />);
    const stars = screen.getByRole('img', { name: '별 2개 / 3개' });
    expect(stars.querySelectorAll('[data-reward="star"]')).toHaveLength(2);
    expect(stars.querySelectorAll('[data-reward="starEmpty"]')).toHaveLength(1);
  });
});
