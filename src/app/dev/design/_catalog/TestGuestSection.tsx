'use client';

import { RunControls } from '@/components/quest/RunControls';
import { OutputPanel } from '@/components/quest/OutputPanel';
import type { RunResult } from '@/lib/pyodide/usePyodide';
import type { GuestRun } from '@/lib/quest/testGuests';
import { MotionProvider } from '@/components/providers/MotionProvider';
import { CodeSample, Demo, Section } from './ui';

const noop = () => {};
const OK: RunResult = { stdout: '', stderr: '', success: true, outcome: 'ok' };

// 3-2 "두 갈래 문" 같은 입력 퀘스트의 손님 대화 견본
const ASK = '1번 문과 2번 문 중 어디로 갈까요? ';
const guest = (
  name: string,
  answer: string,
  reply: string,
  over: Partial<GuestRun> = {},
): GuestRun => ({
  name,
  state: 'done',
  stdout: `${ASK}${reply}\n`,
  inputs: [{ at: ASK.length, value: answer }],
  keys: [],
  ...over,
});

const PASSED: GuestRun[] = [
  guest('별똥이 손님', '1', '반짝이는 동굴에 들어왔어요!', { passed: true }),
  guest('콩콩이 손님', '2', '시원한 강에 도착했어요!', { passed: true }),
];
const ONE_DIFF: GuestRun[] = [
  guest('별똥이 손님', '1', '반짝이는 동굴에 들어왔어요!', { passed: true }),
  guest('콩콩이 손님', '2', '반짝이는 동굴에 들어왔어요!', { passed: false }),
];
const RUNNING: GuestRun[] = [
  guest('별똥이 손님', '1', '반짝이는 동굴에 들어왔어요!'),
  { name: '콩콩이 손님', state: 'running', stdout: ASK, inputs: [], keys: [] },
  { name: '번개 손님', state: 'waiting', stdout: '', inputs: [], keys: [] },
];
const EOF: GuestRun[] = [
  {
    name: '숫자 손님',
    state: 'error',
    stdout: '1~10 숫자를 맞혀 봐요: 커요\n'.repeat(3),
    inputs: [0, 1, 2].map((i) => ({ at: i * 19 + 15, value: String(10 - i) })),
    keys: [],
    errorType: 'EOFError',
  },
  { name: '거꾸로 손님', state: 'skipped', stdout: '', inputs: [], keys: [] },
];
const KEYS: GuestRun[] = [
  {
    name: '오른쪽 손님',
    state: 'done',
    stdout: '(30.00,10.00)\n',
    inputs: [],
    keys: ['Right', 'Right', 'Right', 'Up'],
    passed: true,
  },
  {
    name: '벽 손님',
    state: 'done',
    stdout: '(300.00,0.00)\n',
    inputs: [],
    keys: Array(30).fill('Right'),
    passed: false,
  },
];

/** 시험 손님 (P11-05): 실행 버튼 옆 "시험 손님 부르기" + 결과 쪽지 위 손님 대화 */
export function TestGuestSection() {
  const states = [
    {
      label: '모두 통과',
      note: '손님마다 대화 카드 · 프로그램 말은 흰 줄 카드, 손님 말은 오른쪽 해님 말풍선 · 결과 쪽지는 판정만',
      node: (
        <OutputPanel
          result={OK}
          isRunning={false}
          guests={PASSED}
          validationResult={{ passed: true }}
        />
      ),
    },
    {
      label: '한 손님이 달라요',
      note: '"조금 달라요" 카드 · 쪽지는 기대 출력 대신 손님 대화를 살펴보라는 안내(손님 규칙은 서버만)',
      node: (
        <OutputPanel
          result={OK}
          isRunning={false}
          guests={ONE_DIFF}
          validationResult={{ passed: false }}
        />
      ),
    },
    {
      label: '손님이 써 보는 중',
      note: '차례로 실행 · 지금 손님은 "써 보는 중"(바쁨 표시) · 다음 손님은 기다림',
      node: <OutputPanel result={null} isRunning guests={RUNNING} />,
    },
    {
      label: '입력이 더 필요해요 (EOFError)',
      note: '준비한 대답을 다 썼는데 input()이 또 물음 → 무한 반복 대신 멈춤 · 남은 손님은 "못 써 봄"',
      node: (
        <OutputPanel
          result={{
            stdout: EOF[0].stdout,
            stderr: 'Traceback (most recent call last):\n  File "<exec>", line 4, in <module>\nEOFError: EOF when reading a line\n',
            success: false,
            hadException: true,
            errorType: 'EOFError',
            outcome: 'error',
          }}
          isRunning={false}
          guests={EOF}
        />
      ),
    },
    {
      label: '키 손님 (게임)',
      note: '프레임 순서로 누를 키를 화살표로 보여 줌(많으면 ×30) · 잠은 건너뛰어 900프레임도 1초 안팎',
      node: (
        <OutputPanel
          result={OK}
          isRunning={false}
          guests={KEYS}
          validationResult={{ passed: false }}
        />
      ),
    },
    {
      label: '그림 규칙 이유',
      note: '그림 규칙이 떨어지면 서버가 준 문장을 그대로 (튜터 힌트와 같은 문장)',
      node: (
        <OutputPanel
          result={OK}
          isRunning={false}
          turtle={false}
          validationResult={{ passed: false }}
          reasons={[
            '정사각형을 아직 찾지 못했어요.',
            '매번 90°씩 같은 방향으로 돌아야 해요 (지금: 90°, 80°).',
          ]}
        />
      ),
    },
  ];
  return (
    <MotionProvider>
      <Section
        id="test-guests"
        kicker="퀘스트 (P11-05)"
        title="시험 손님 채점"
        description="입력·키 퀘스트는 “코드 돌려보기”로 직접 해 보고, “시험 손님 부르기”로 채점해요. 손님마다 공개 시험 입력으로 코드를 자동 실행해 대화를 채팅처럼 보여 주고(입력 채널이 없는 기기에서도 됨), 서버가 같은 손님별 규칙으로 다시 채점해요. 카드 등장은 full 스프링·lite 짧게·minimal과 동작 줄이기는 바로. 상태는 글자 + 아이콘으로."
      >
        <div className="grid items-start gap-4 md:grid-cols-2">
          <Demo
            label="실행 줄 · 손님 버튼"
            note="손님이 있는 퀘스트만 · 손님이 쓰는 동안 손님 버튼이 바쁨 표시, 실행 버튼은 잠김"
            surface="card"
            className="@container"
          >
            <div className="grid gap-4">
              <RunControls
                status="ready"
                isRunning={false}
                onRun={noop}
                onRetry={noop}
                onGrade={noop}
              />
              <RunControls
                status="ready"
                isRunning
                grading
                onRun={noop}
                onStop={noop}
                onRetry={noop}
                onGrade={noop}
              />
            </div>
          </Demo>
          {states.map((s) => (
            <Demo key={s.label} label={s.label} note={s.note} surface="card">
              {s.node}
            </Demo>
          ))}
        </div>
        <CodeSample
          code={`# content YAML (answer)\nscenarios:\n  - name: 별똥이 손님\n    inputs: ["1"]\n    expect: { type: contains, expected: 반짝이는 동굴 }\n  - name: 콩콩이 손님\n    inputs: ["2"]\n    expect: { type: contains, expected: 시원한 강 }`}
        />
      </Section>
    </MotionProvider>
  );
}
