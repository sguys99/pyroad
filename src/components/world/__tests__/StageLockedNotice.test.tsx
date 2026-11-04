// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  cleanup,
  act,
  fireEvent,
} from '@testing-library/react';
import { MotionConfig } from 'framer-motion';
import {
  StageLockedNotice,
  STAGE_LOCKED_NOTICE_MS,
} from '../StageLockedNotice';
import {
  STAGE_LOCKED_MESSAGE,
  isStageLockedNotice,
} from '@/lib/world/stageLock';

// 잠긴 스테이지 퀘스트를 URL 로 열어 월드맵으로 돌아왔을 때의 안내 (B38)

// 퇴장 애니메이션 없이 바로 사라지게
const renderNotice = () =>
  render(
    <MotionConfig reducedMotion="always" transition={{ duration: 0 }}>
      <StageLockedNotice />
    </MotionConfig>,
  );

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  window.history.replaceState(null, '', '/world?notice=stage-locked&tab=1#map');
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('StageLockedNotice', () => {
  it('아이용 문구를 status 로 알리고, 주소에서 안내 값만 지운다 (새로 고침해도 다시 뜨지 않게)', () => {
    renderNotice();
    expect(screen.getByRole('status').textContent).toContain(
      STAGE_LOCKED_MESSAGE,
    );
    expect(
      `${window.location.pathname}${window.location.search}${window.location.hash}`,
    ).toBe('/world?tab=1#map');
  });

  it('잠시 뒤 스스로 닫힌다', async () => {
    renderNotice();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(STAGE_LOCKED_NOTICE_MS);
    });
    expect(screen.queryByTestId('stage-locked-notice')).toBeNull();
  });

  it('닫기 버튼으로 바로 닫을 수 있다', async () => {
    renderNotice();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '안내 닫기' }));
    });
    expect(screen.queryByTestId('stage-locked-notice')).toBeNull();
  });
});

describe('isStageLockedNotice', () => {
  it('정해진 값만 안내로 본다 (배열·다른 값 무시)', () => {
    expect(isStageLockedNotice('stage-locked')).toBe(true);
    expect(isStageLockedNotice(undefined)).toBe(false);
    expect(isStageLockedNotice('https://evil.example')).toBe(false);
    expect(isStageLockedNotice(['stage-locked', 'stage-locked'])).toBe(false);
  });
});
