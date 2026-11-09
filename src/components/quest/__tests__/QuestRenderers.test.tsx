// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  act,
  cleanup,
  fireEvent,
  within,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { RunResult } from '@/lib/pyodide/usePyodide';
import type { QuestWithStage } from '@/lib/types/database';

const mocks = vi.hoisted(() => ({
  runtime: {
    status: 'ready' as 'idle' | 'loading' | 'ready' | 'error',
    restarting: null as 'timeout' | 'stop' | null,
    loadStage: null as 'download' | 'setup' | null,
    isRunning: false,
    generation: 1,
    runtimeInfo: null,
    runCode: vi.fn(),
    stop: vi.fn(),
    retry: vi.fn(),
  },
  tutor: {
    sendTutorRequest: vi.fn(async () => ({
      message: '잘했어요',
      is_fallback: false,
    })),
    sendTutorStreamRequest: vi.fn(async () => ({
      message: '안녕! 같이 해 볼까?',
      is_fallback: false,
    })),
    isLoading: false,
    setIsLoading: vi.fn(),
    hasApiKey: true,
  },
}));

vi.mock('@/lib/pyodide/PyodideProvider', () => ({
  usePyodideRuntime: () => mocks.runtime,
}));
vi.mock('@/lib/tutor/useTutor', () => ({ useTutor: () => mocks.tutor }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock('@/lib/confetti', () => ({
  fireConfetti: vi.fn(),
  resetConfetti: vi.fn(),
}));
vi.mock('@/lib/supabase/loadClient', () => ({
  loadBrowserClient: async () => ({
    from: () => ({ upsert: () => ({ then: () => {} }) }),
  }),
}));
// CodeMirror는 jsdom에서 레이아웃을 잴 수 없어 textarea로 대신한다 (값 동기화만 확인)
vi.mock('../CodeEditor', () => ({
  CodeEditor: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) => (
    <textarea
      aria-label="코드 에디터"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

import { CodeQuest } from '../CodeQuest';
import { ProjectQuest } from '../ProjectQuest';
import { QUEST_RENDERERS } from '../questRenderers';
import { getQuestKind } from '@/lib/quest/questKind';

const STAGE = { id: 's1', title: '시작의 숲', order: 1, theme_name: 'forest' };
const CODE_QUEST = {
  id: 'q-code',
  title: '변수 상자',
  validation_type: 'exact_match',
  stage: STAGE,
  prompt_skeleton: {
    topic: '변수',
    learning_goals: [],
    story_context: '숲 이야기',
    exercise_description: 'x에 10을 넣어요',
    starter_code: 'x = ___',
    expected_output_hint: '10',
    fallback_text: '변수를 배워 봐요!',
  },
} as unknown as QuestWithStage;
const PROJECT_QUEST = {
  ...CODE_QUEST,
  id: 'q-proj',
  title: '나만의 게임',
  prompt_skeleton: {
    ...CODE_QUEST.prompt_skeleton,
    steps: [
      {
        step_number: 1,
        step_goal: '이름 출력',
        starter_code: 'name = ___',
        validation_type: 'exact_match',
        fallback_text: '',
      },
      {
        step_number: 2,
        step_goal: '점수 출력',
        starter_code: '',
        validation_type: 'exact_match',
        fallback_text: '',
      },
    ],
  },
} as unknown as QuestWithStage;

const props = (quest: QuestWithStage) => ({
  quest,
  progress: null,
  userId: 'u1',
  initialXP: 0,
  initialLevel: 1,
  initialGoldenKeys: 3,
});

beforeEach(() => {
  // jsdom에는 scrollIntoView가 없음 (대화 패널 자동 스크롤)
  Element.prototype.scrollIntoView = vi.fn();
  mocks.runtime.status = 'ready';
  mocks.runtime.restarting = null;
  mocks.runtime.loadStage = null;
  mocks.runtime.isRunning = false;
  mocks.runtime.runCode.mockReset();
  mocks.runtime.stop.mockReset();
  mocks.runtime.retry.mockReset();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ passed: false })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('퀘스트 렌더러 스모크', () => {
  it('유형별 렌더러 등록: 단계가 있으면 ProjectQuest, 없으면 CodeQuest', () => {
    expect(QUEST_RENDERERS[getQuestKind(CODE_QUEST.prompt_skeleton)]).toBe(
      CodeQuest,
    );
    expect(QUEST_RENDERERS[getQuestKind(PROJECT_QUEST.prompt_skeleton)]).toBe(
      ProjectQuest,
    );
  });

  it('CodeQuest: 미션·시작 코드·실행 버튼·빈 출력창을 그리고 튜터 소개를 보여 준다', async () => {
    render(<CodeQuest {...props(CODE_QUEST)} />);
    expect(screen.getByText('x에 10을 넣어요')).toBeInTheDocument();
    expect(screen.getByLabelText('코드 에디터')).toHaveValue('x = ___');
    expect(screen.getByTestId('run-button')).toHaveTextContent('코드 돌려보기');
    expect(screen.getByTestId('run-button')).toBeEnabled();
    expect(screen.queryByTestId('stop-button')).toBeNull();
    // 데스크톱 + 모바일 결과 탭
    expect(screen.getAllByTestId('output-panel')[0]).toHaveAttribute(
      'data-state',
      'empty',
    );
    // 튜터 소개는 닫힌 "파이뱀에게 물어보기" 줄에 미리 보기 + 새 이야기 수 (P6-10)
    const ask = screen.getByTestId('ask-pybaem');
    expect(
      await within(ask).findByText('안녕! 같이 해 볼까?'),
    ).toBeInTheDocument();
    expect(within(ask).getByTestId('ask-unread')).toHaveTextContent('1');
    // 퀘스트 → 월드맵은 소프트 내비게이션 링크 (B22)
    expect(screen.getByRole('link', { name: /월드맵/ })).toHaveAttribute(
      'href',
      '/world',
    );
  });

  it('ProjectQuest: 단계 막대와 첫 단계 시작 코드', async () => {
    render(<ProjectQuest {...props(PROJECT_QUEST)} />);
    expect(screen.getByLabelText('코드 에디터')).toHaveValue('name = ___');
    // 단계 시작 알림은 대화에 (P6-10: 열면 지연 로드)
    await within(screen.getByTestId('ask-pybaem')).findByText(
      '안녕! 같이 해 볼까?',
    );
    fireEvent.click(screen.getByTestId('ask-pybaem'));
    expect(await screen.findByText('단계 1/2: 이름 출력')).toBeInTheDocument();
    expect(screen.getByTestId('run-button')).toBeInTheDocument();
  });

  it('실행 중에는 멈추기 버튼이 보이고, 실시간 출력이 출력창에 나온다', async () => {
    let finish!: (r: RunResult) => void;
    let onStdout!: (t: string) => void;
    mocks.runtime.runCode.mockImplementation(
      (_code: string, opts: { onStdout: (t: string) => void }) => {
        onStdout = opts.onStdout;
        return new Promise<RunResult>((r) => (finish = r));
      },
    );
    const { rerender } = render(<CodeQuest {...props(CODE_QUEST)} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('run-button'));
    });
    // usePyodide가 isRunning을 켠 상태를 흉내
    mocks.runtime.isRunning = true;
    rerender(<CodeQuest {...props(CODE_QUEST)} />);

    expect(screen.getByTestId('run-button')).toBeDisabled();
    const stop = screen.getByTestId('stop-button');
    expect(stop).toHaveTextContent('멈추기');

    act(() => onStdout('1\n2\n'));
    expect(
      within(screen.getAllByTestId('live-output')[0])
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['1', '2']);

    fireEvent.click(stop);
    expect(mocks.runtime.stop).toHaveBeenCalledTimes(1);

    mocks.runtime.isRunning = false;
    await act(async () => {
      finish({
        stdout: '1\n2\n',
        stderr: '',
        success: false,
        isStopped: true,
        outcome: 'stopped',
      });
    });
    rerender(<CodeQuest {...props(CODE_QUEST)} />);
    expect(screen.queryByTestId('stop-button')).toBeNull();
    expect(screen.getAllByTestId('output-panel')[0]).toHaveAttribute(
      'data-state',
      'stopped',
    );
    expect(screen.getAllByText('실행을 멈췄어요')[0]).toBeInTheDocument();
  });

  it('시간 초과 뒤 Worker를 다시 띄우는 동안 깨우는 연출을 보여 준다', () => {
    mocks.runtime.status = 'loading';
    mocks.runtime.restarting = 'timeout';
    render(<CodeQuest {...props(CODE_QUEST)} />);
    expect(screen.getAllByTestId('runner-waking')[0]).toHaveTextContent(
      '파이뱀이 주문 공책을 다시 펼치는 중',
    );
    expect(screen.getAllByTestId('runner-waking')[0]).toHaveTextContent(
      '너무 오래 걸려서',
    );
    expect(screen.getByTestId('run-button')).toHaveTextContent(
      '다시 준비 중...',
    );
    expect(screen.getByTestId('run-button')).toBeDisabled();
    expect(screen.queryByTestId('runner-loading')).toBeNull();
    // 실행기가 준비되지 않았으면 황금키도 막힘 (P1-03 보고)
    expect(screen.getByRole('button', { name: /황금키 쓰기/ })).toBeDisabled();
  });

  it('처음 불러올 때는 깨우는 연출 대신 준비 단계와 코딩 팁', () => {
    mocks.runtime.status = 'loading';
    mocks.runtime.loadStage = 'download';
    const { rerender } = render(<CodeQuest {...props(CODE_QUEST)} />);
    expect(screen.queryByTestId('runner-waking')).toBeNull();
    const panel = screen.getByTestId('runner-loading');
    expect(panel).toHaveTextContent('파이썬을 불러오는 중');
    expect(panel).toHaveTextContent('알고 있나요?');
    expect(panel.querySelector('[data-step="current"]')).toHaveTextContent(
      '불러오기',
    );

    // Worker가 setup 단계를 알리면 첫 칸은 채워지고 둘째 칸이 지금 칸
    mocks.runtime.loadStage = 'setup';
    rerender(<CodeQuest {...props(CODE_QUEST)} />);
    expect(panel.querySelector('[data-step="done"]')).toHaveTextContent(
      '불러오기',
    );
    expect(panel.querySelector('[data-step="current"]')).toHaveTextContent(
      '점검',
    );
  });

  it('실행기를 못 불러오면 다시 불러오기 버튼과 안내', () => {
    mocks.runtime.status = 'error';
    render(<CodeQuest {...props(CODE_QUEST)} />);
    expect(screen.queryByTestId('run-button')).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent('불러오지 못했어요');
    fireEvent.click(screen.getByTestId('runner-retry'));
    expect(mocks.runtime.retry).toHaveBeenCalledTimes(1);
  });

  it('Worker 를 띄우기 전(idle)에도 비활성 버튼은 "준비 중..."으로 보인다', () => {
    mocks.runtime.status = 'idle';
    render(<CodeQuest {...props(CODE_QUEST)} />);
    const button = screen.getByTestId('run-button');
    expect(button).toHaveTextContent('준비 중...');
    expect(button).not.toHaveTextContent('코드 돌려보기!');
    expect(button).toBeDisabled();
  });
});
