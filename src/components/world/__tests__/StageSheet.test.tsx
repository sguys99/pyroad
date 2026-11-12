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

// 스테이지 차례 시트 (P5-06): 유형·상태 판정, 다시 하기·시작 링크, 별(P8-05 SHOW_STARS)·복습 도전 가능

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
  quiz_kind: null,
  is_mobile_friendly: false,
  status: null,
  best_stars: 0,
  ...extra,
});

const quests = [
  q(1, { status: 'completed', best_stars: 3 }),
  q(2, { status: 'in_progress' }),
  q(3, {
    quest_type: 'quiz',
    quiz_kind: 'fill_blank',
    is_mobile_friendly: true,
  }),
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
  it('제목·진행 요약, 완료 퀘스트는 다시 하기, 첫 미완료는 이어하기 주 버튼, 별 합계·완료 줄 별', async () => {
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
    // 숫자는 코드 퀘스트끼리, 퀴즈는 따로 (B53): 월드맵 노드와 같은 1/3
    expect(dialog).toHaveTextContent('퀘스트 1/3 완료');
    expect(screen.getByTestId('stage-sheet-quiz-sum')).toHaveTextContent(
      '보너스 퀴즈 0/1',
    );
    expect(
      screen.getByRole('link', { name: /^3번\s*퀘스트4/ }),
    ).toBeInTheDocument();

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
    // 넓은 화면(jsdom 은 matchMedia 없음)에는 폰 표시 없음 (P7-11)
    expect(screen.queryByText('폰에서 하기 좋아요')).toBeNull();
    // 배울 개념 한 줄은 보이고, 줄 이름에도 들어간다 (P5-06 추가)
    expect(screen.getByText('개념3')).toBeVisible();
    expect(
      screen.getByRole('link', { name: /퀘스트3, 배울 개념\s*개념3/ }),
    ).toBeInTheDocument();
    // 퀴즈: 종류 이름 + 보너스 안내 (P7-11)
    expect(screen.getByText('퀴즈 · 빈칸 채우기')).toBeInTheDocument();
    expect(screen.getByTestId('stage-sheet-bonus')).toHaveTextContent(
      '퀴즈는 보너스예요 — 안 풀어도 다음 스테이지가 열려요',
    );
    // SHOW_STARS (P8-05): 요약에 별 합계, 완료한 코드 퀘스트 줄에 최고 별
    expect(dialog).toHaveTextContent('3/12');
    expect(screen.getAllByRole('img', { name: /별 \d개/ })).toHaveLength(1);
    expect(
      screen.getByRole('img', { name: '별 3개 / 3개' }),
    ).toBeInTheDocument();

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

  it('폰(좁은 화면·터치): 휴대폰 추천 퀘스트에 "폰에서 하기 좋아요", 소급 전 0별 완료 줄은 별을 그리지 않음', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: true,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    try {
      render(
        <StageSheet
          stage={stage}
          quests={[
            q(1, { status: 'completed', best_stars: 0 }),
            q(2, {
              quest_type: 'quiz',
              quiz_kind: 'bug_hunt',
              is_mobile_friendly: true,
              status: 'completed',
              best_stars: 2,
            }),
          ]}
          open
          onOpenChange={() => {}}
        />,
      );
      await screen.findByRole('dialog');
      expect(screen.getByText('폰에서 하기 좋아요')).toBeInTheDocument();
      // 별 기록 전(P8-11 소급 전) 완료한 코드 퀘스트는 빈 별 대신 아무것도, 퀴즈 별만
      expect(screen.getAllByRole('img', { name: /별 \d개/ })).toHaveLength(1);
      expect(
        screen.getByRole('img', { name: '별 2개 / 3개' }),
      ).toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('복습 도전 가능 (P8-05, §12-Q64): 별 3개 미만 퀘스트·퀴즈는 판정 다음 날(KST)부터, 오늘 판정·별 3개는 아님', async () => {
    const quiz = (order: number, extra: Partial<StageQuestItem>) =>
      q(order, {
        quest_type: 'quiz',
        quiz_kind: 'multiple_choice',
        status: 'completed',
        ...extra,
      });
    render(
      <StageSheet
        stage={stage}
        today="2026-11-11"
        quests={[
          q(1, {
            status: 'completed',
            best_stars: 1,
            stars_judged_on: '2026-11-01',
          }),
          quiz(2, { best_stars: 2, stars_judged_on: '2026-11-10' }),
          quiz(3, { best_stars: 2, stars_judged_on: '2026-11-11' }),
          quiz(4, { best_stars: 3, stars_judged_on: '2026-11-01' }),
        ]}
        open
        onOpenChange={() => {}}
      />,
    );
    await screen.findByRole('dialog');
    const badges = screen.getAllByTestId('stage-sheet-review');
    expect(badges).toHaveLength(2);
    expect(badges[0]).toHaveTextContent('복습 도전 가능');
    expect(
      screen.getByRole('link', { name: /퀘스트1.*복습 도전 가능/ }),
    ).toHaveAttribute('href', '/quest/q1');
    expect(
      screen.getByRole('link', { name: /퀘스트2.*복습 도전 가능/ }),
    ).toHaveAttribute('href', '/quest/q2');
  });
});
