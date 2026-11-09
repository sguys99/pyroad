// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import type { StageWithStatus } from '@/lib/types/database';
import type { StageQuestItem } from '@/lib/world/mapData';

import { StageSheet, questRows } from '../StageSheet';

vi.mock('@/components/providers/soundContext', () => ({
  useSfx: () => () => {},
}));

// 스테이지 차례 시트 (P5-06): 유형·상태 판정, 다시 하기·시작 링크, 별 숨김(Q51)

afterEach(cleanup);

const stage: StageWithStatus = {
  id: 's3',
  world_id: 'w',
  order: 3,
  title: '조건의 갈림길',
  theme_name: 'condition_crossroad',
  description: '갈림길에서 길을 골라요',
  is_final: false,
  created_at: '',
  status: 'in_progress',
  quests: [],
  completedQuestCount: 1,
  totalQuestCount: 4,
  firstIncompleteQuestId: 'q2',
  stars: 3,
  maxStars: 12,
};

const q = (
  order: number,
  extra: Partial<StageQuestItem> = {},
): StageQuestItem => ({
  id: `q${order}`,
  order,
  title: `퀘스트${order}`,
  concept: `개념${order}`,
  quest_type: 'code',
  is_mobile_friendly: false,
  status: null,
  best_stars: 0,
  ...extra,
});

const quests = [
  q(1, { status: 'completed', best_stars: 3 }),
  q(2, { status: 'in_progress' }),
  q(3, { quest_type: 'quiz', is_mobile_friendly: true }),
  q(4, { status: 'in_progress' }),
];

describe('questRows', () => {
  it('완료 → done, 첫 미완료 → now, 진행 행 있음 → doing, 나머지 todo / 퀴즈', () => {
    const rows = questRows(stage, quests);
    expect(rows.map((r) => r.state)).toEqual(['done', 'now', 'todo', 'doing']);
    expect(rows.map((r) => r.kind)).toEqual(['code', 'code', 'quiz', 'code']);
  });

  it('보스: quest_type boss, 또는 마지막 스테이지의 마지막 퀘스트', () => {
    expect(questRows(stage, [q(1, { quest_type: 'boss' })])[0].kind).toBe(
      'boss',
    );
    const rows = questRows({ is_final: true }, [
      q(1),
      q(2, { quest_type: 'project' }),
    ]);
    expect(rows.map((r) => r.kind)).toEqual(['code', 'boss']);
  });
});

describe('StageSheet', () => {
  it('제목·진행 요약, 완료 퀘스트는 다시 하기, 첫 미완료는 이어하기 주 버튼, 별은 숨김', async () => {
    const onOpenChange = vi.fn();
    render(
      <StageSheet
        stage={stage}
        quests={quests}
        open
        onOpenChange={onOpenChange}
      />,
    );
    const dialog = await screen.findByRole('dialog', {
      name: /3단계 · 지금 모험 중\s*조건의 갈림길/,
    });
    expect(dialog).toHaveAccessibleDescription('갈림길에서 길을 골라요');
    expect(dialog).toHaveTextContent('퀘스트 1/4 완료');

    const replay = screen.getByRole('link', { name: /퀘스트1.*다시 하기/ });
    expect(replay).toHaveAttribute('href', '/quest/q1');
    // 아직 안 한 퀘스트도 건너뛰어 열 수 있다 (열린 스테이지는 서버가 모든 퀘스트를 연다)
    expect(screen.getByRole('link', { name: /퀘스트3/ })).toHaveAttribute(
      'href',
      '/quest/q3',
    );
    expect(screen.getByRole('link', { name: /퀘스트2/ })).toHaveAttribute(
      'aria-current',
      'step',
    );
    expect(screen.getByTestId('stage-sheet-start')).toHaveTextContent(
      '2번 퀘스트 이어하기',
    );
    expect(screen.getByText('휴대폰 추천')).toBeInTheDocument();
    // 배울 개념 한 줄은 보이고, 줄 이름에도 들어간다 (P5-06 추가)
    expect(screen.getByText('개념3')).toBeVisible();
    expect(
      screen.getByRole('link', { name: /퀘스트3, 배울 개념\s*개념3/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('퀴즈')).toBeInTheDocument();
    // SHOW_STARS = false (Q51): 별 그림 없음
    expect(screen.queryByRole('img', { name: /별 \d개/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '차례 닫기' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('모두 끝낸 스테이지: 주 버튼 없이 모두 다시 하기, 처음이면 시작하기', async () => {
    const all = quests.map((x) => ({ ...x, status: 'completed' }));
    const { unmount } = render(
      <StageSheet
        stage={{ ...stage, status: 'completed' }}
        quests={all}
        open
        onOpenChange={() => {}}
      />,
    );
    await screen.findByRole('dialog', { name: /통과한 곳/ });
    expect(screen.queryByTestId('stage-sheet-start')).toBeNull();
    expect(screen.getAllByRole('link', { name: /다시 하기/ })).toHaveLength(4);
    unmount();

    render(
      <StageSheet
        stage={stage}
        quests={[q(1), q(2)]}
        open
        onOpenChange={() => {}}
      />,
    );
    expect(await screen.findByTestId('stage-sheet-start')).toHaveTextContent(
      '1번 퀘스트 시작하기',
    );
  });
});
