// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { StageWithStatus } from '@/lib/types/database';

import { StageNode, stageNodeLabel } from '../StageNode';

afterEach(cleanup);

const base: StageWithStatus = {
  id: 's3',
  world_id: 'w',
  order: 3,
  title: '조건의 갈림길',
  theme_name: 'condition_crossroad',
  description: '',
  is_final: false,
  created_at: '',
  status: 'in_progress',
  quests: [],
  completedQuestCount: 2,
  totalQuestCount: 8,
  firstIncompleteQuestId: 'q',
  stars: 5,
  maxStars: 24,
};

describe('StageNode (P5-04)', () => {
  it('진행 중: 상태·별·진행이 이름에(SHOW_STARS, P8-05), 번호 원 둘레 진행률 링', () => {
    const { container } = render(<StageNode stage={base} onOpen={() => {}} />);
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('aria-label')).toBe(
      '3단계 조건의 갈림길, 도전 중, 지금 여기, 별 5/24, 퀘스트 2/8 완료',
    );
    expect(container.querySelector('.wn')?.getAttribute('data-state')).toBe(
      'current',
    );
    expect(
      container.querySelector('.wn-prog-bar')?.getAttribute('stroke-dasharray'),
    ).toBe('0.25 1');
    expect(container.querySelector('.wn-ring')).not.toBeNull();
    // 이름표 아래는 별 합계 (SHOW_STARS, P8-05). 퀘스트 수는 링·이름에
    expect(container.querySelector('.wn-meta')?.textContent).toContain('5/24');
    expect(container.querySelector('.wn-meta')?.textContent).not.toContain(
      '2/8',
    );
  });

  it('통과: 도장, 링 없음 / 열림: 퀘스트 0개', () => {
    const { container } = render(
      <StageNode
        stage={{ ...base, status: 'completed', completedQuestCount: 8 }}
        onOpen={() => {}}
      />,
    );
    expect(container.querySelector('.wn-stamp')?.textContent).toBe('통과');
    // 별이 켜지면 이름표 아래 체크 대신 별 합계 (통과는 도장으로 보임)
    expect(container.querySelector('.wn-check')).toBeNull();
    expect(container.querySelector('.wn-prog')).toBeNull();
    expect(
      stageNodeLabel({ ...base, completedQuestCount: 0 }).split(', ')[1],
    ).toBe('열림');
  });

  it('열 수 있는 보물상자(P8-06): 이름표 옆 작은 상자 + 이름에 안내, 열었으면 없음', () => {
    // 코드 퀘스트 8개 → 목표 17
    const ready = { ...base, stars: 17 };
    const { container, rerender } = render(
      <StageNode stage={ready} onOpen={() => {}} />,
    );
    expect(container.querySelector('.wn-chest')).not.toBeNull();
    expect(stageNodeLabel(ready)).toContain('보물상자를 열 수 있어요');
    rerender(
      <StageNode stage={{ ...ready, chestOpened: true }} onOpen={() => {}} />,
    );
    expect(container.querySelector('.wn-chest')).toBeNull();
    expect(stageNodeLabel(base)).not.toContain('보물상자');
  });

  it('잠김: aria-disabled 지만 누르면 onOpen (안내는 WorldMap), 별 대신 잠김', () => {
    const onOpen = vi.fn();
    const locked = { ...base, status: 'locked' as const };
    render(<StageNode stage={locked} onOpen={onOpen} />);
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('aria-disabled')).toBe('true');
    expect(btn.getAttribute('aria-label')).toBe('3단계 조건의 갈림길, 잠김');
    fireEvent.click(btn);
    expect(onOpen).toHaveBeenCalledWith(locked);
  });

  it('보스: is_final 이면 data-boss + 이름에 보스', () => {
    const { container } = render(
      <StageNode stage={{ ...base, is_final: true }} onOpen={() => {}} />,
    );
    expect(container.querySelector('.wn[data-boss]')).not.toBeNull();
    expect(screen.getByRole('button').getAttribute('aria-label')).toMatch(
      /보스 스테이지/,
    );
  });
});
