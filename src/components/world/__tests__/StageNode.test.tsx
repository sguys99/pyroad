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
  it('진행 중: 상태·별·진행이 이름에, 번호 원 둘레 진행률 링', () => {
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
    expect(container.textContent).toContain('5/24');
  });

  it('통과: 도장, 링 없음 / 열림: 퀘스트 0개', () => {
    const { container } = render(
      <StageNode
        stage={{ ...base, status: 'completed', completedQuestCount: 8 }}
        onOpen={() => {}}
      />,
    );
    expect(container.querySelector('.wn-stamp')?.textContent).toBe('통과');
    expect(container.querySelector('.wn-prog')).toBeNull();
    expect(
      stageNodeLabel({ ...base, completedQuestCount: 0 }).split(', ')[1],
    ).toBe('열림');
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
