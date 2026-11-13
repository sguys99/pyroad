'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Code2,
  ExternalLink,
  Music,
  RotateCcw,
  Share2,
  Volume2,
} from 'lucide-react';
import {
  useSfx,
  useSoundSettings,
  useSoundSnapshot,
} from '@/components/providers/SoundProvider';
import { WorldBgm } from '@/components/sound/WorldBgm';
import {
  SFX_USES,
  SOFT_TAP,
  STAR_RATES,
  type BgmId,
  type SfxId,
} from '@/lib/sound/manifest';
import { SHARE_CARD_SAMPLES } from '@/lib/share-card/samples';
import { ShareSheet } from '@/components/share/ShareSheet';
import { shareCardSummary } from '@/lib/share-card/summary';
import {
  ShareCardView,
  ShareGoneView,
} from '@/components/share/ShareCardView';
import { rewardSfx } from '@/lib/celebration/rewardSfx';
import { Button } from '@/components/ui/button';
import {
  RunControls,
  RunnerLoading,
} from '@/components/quest/RunControls';
import {
  CodeEditor,
  type CodeEditorHandle,
} from '@/components/quest/CodeEditor';
import CodeKeyboard from '@/components/quest/CodeKeyboard';
import { EditorThemeProvider } from '@/components/quest/EditorThemeContext';
import { EDITOR_THEME_IDS, type EditorThemeId } from '@/lib/design/tokens';
import { SHOP_ITEMS } from '@/lib/shop/catalog';
import { questTabs } from '@/components/quest/QuestWorkspace';
import { SegmentedTabs } from '@/components/ui/tabs';
import { MotionProvider } from '@/components/providers/MotionProvider';
import { OutputPanel } from '@/components/quest/OutputPanel';
import { createLiveOutputStore } from '@/lib/pyodide/liveOutput';
import type { RunResult } from '@/lib/pyodide/usePyodide';
import type { QuestSession } from '@/lib/quest/useQuestSession';
import { DialogueBox } from '@/components/ui/dialogue-box';
import { PybaemRig } from '@/components/characters/rig/MascotRig';
import { tutorLine } from '@/components/quest/StoryPage';
import { HAPPY_MS, useThinkBeat } from '@/components/quest/useThinkBeat';
import { CelebrationMascot } from '@/components/quest/celebrations/parts';
import { useMotionTier } from '@/lib/motion/MotionTierProvider';
import { CodeSample, Demo, Section } from './ui';

/** 모바일 코드 키보드 견본 (P6-04): 실제 에디터 + 키보드. 퀘스트 화면은 lg 미만·터치에서만 띄운다. 스테이지를 바꾸면 그 스테이지 주문이 앞으로 (P6-11) */
function CodeKeyboardDemo() {
  const editor = useRef<CodeEditorHandle>(null);
  const [code, setCode] = useState('# 아래에 코드를 작성해보세요!\n');
  const [stage, setStage] = useState('1');
  return (
    <div className="flex max-w-sm flex-col gap-2" data-testid="catalog-code-keyboard">
      <SegmentedTabs
        aria-label="스테이지"
        items={['1', '3', '4', '5', '6'].map((v) => ({ value: v, label: `${v}스테이지` }))}
        value={stage}
        onValueChange={setStage}
      />
      <CodeEditor ref={editor} value={code} onChange={setCode} />
      <CodeKeyboard editor={editor} stage={Number(stage)} />
    </div>
  );
}

const THEME_SAMPLE_CODE = [
  '# 별을 세어 봐요',
  'def shine(n):',
  '    return n * 2',
  'for i in range(3):',
  '    print("반짝", shine(i), True)',
].join('\n');

/** 에디터 테마 견본 (P9-06): 기본 + 상점 공책 3종에 같은 코드 (키워드·함수·숫자·문자열·주석) */
function EditorThemeDemo({ theme }: { theme: EditorThemeId | null }) {
  const [code, setCode] = useState(THEME_SAMPLE_CODE);
  const name = theme
    ? SHOP_ITEMS.find((i) => i.kind === 'editor_theme' && i.art === theme)?.name
    : '기본 공책';
  return (
    <div className="flex min-w-0 flex-col gap-1" data-testid={`catalog-editor-theme-${theme ?? 'default'}`}>
      <EditorThemeProvider theme={theme}>
        <CodeEditor value={code} onChange={setCode} title={<span className="text-small font-bold">{name}</span>} />
      </EditorThemeProvider>
    </div>
  );
}

/** 모바일 번호 탭 + ③결과 상태 점 견본 (P6-11) */
function QuestTabsDemo() {
  const [tab, setTab] = useState<'story' | 'code' | 'result'>('result');
  return (
    <div className="flex max-w-sm flex-col gap-3">
      {([null, 'good', 'bad'] as const).map((v) => (
        <SegmentedTabs
          key={v ?? 'none'}
          aria-label={`퀘스트 쪽 고르기 (${v ?? '실행 전'})`}
          items={questTabs(v)}
          value={tab}
          onValueChange={setTab}
        />
      ))}
    </div>
  );
}

export function EditorSection() {
  return (
    <Section
      id="editor"
      kicker="기타 (P2-18)"
      title="코드 에디터"
      description="CodeMirror 키즈 테마(D2Coding 16px · 14~20px 짝수만 · 행간 1.6 · 구문색 3종)는 같은 에디터를 그대로 띄우는 점검 페이지에서 봅니다. 커서 깜빡임은 입력 위치 신호라 minimal에서도 돌고, 동작 줄이기에서만 멈춰요."
    >
      <Demo label="점검 페이지 (개발 전용)" note="한글 주석 정렬 견본 · 글자 크기 · 오류 줄">
        <div className="flex flex-wrap gap-3">
          <Button href="/dev/editor" variant="secondary" sfx={false} icon={<Code2 aria-hidden />}>
            /dev/editor
          </Button>
          <Button
            href="/dev/editor?error=3"
            variant="secondary"
            sfx={false}
            icon={<Code2 aria-hidden />}
          >
            오류 줄 3 표시
          </Button>
        </div>
      </Demo>
      <Demo
        label="에디터 테마 (P9-06)"
        note="상점 공책을 입으면 퀘스트 에디터 상자 안 색만 바뀜(공책 머리·실행 줄·결과 쪽지는 그대로). 모든 글자·틴트 조합 AA는 kidsTheme.test.ts. 오류 줄은 점검 페이지 ?theme=night&error=3"
      >
        <div className="grid gap-4 md:grid-cols-2" data-testid="catalog-editor-themes">
          {[null, ...EDITOR_THEME_IDS].map((t) => (
            <EditorThemeDemo key={t ?? 'default'} theme={t} />
          ))}
        </div>
      </Demo>
      <Demo
        label="모바일 코드 키보드 (P6-04)"
        note="주문(초록)·기호는 띠를 옆으로 넘기고, 커서 ← →는 오른쪽에 고정. 눌러도 에디터 포커스·폰 키보드를 뺏지 않음. 화살표 키로 키 사이 이동"
        surface="card"
      >
        <CodeKeyboardDemo />
      </Demo>
      <Demo
        label="모바일 쪽 넘기기 (P6-11)"
        note="①이야기 ②공책 ③결과 번호 탭 + 책 위 좌우 스와이프(에디터·코드 키보드 안은 제외). ③결과 점: 실행 전 없음 · 통과 초록 · 고칠 곳 금색. 폰 키보드가 올라오면 코드 키보드가 키보드 윗변에 붙음(퀘스트 화면)"
        surface="card"
      >
        <QuestTabsDemo />
      </Demo>
    </Section>
  );
}

const noop = () => {};

/** 실행 줄 견본 (P6-05). 공책 쪽처럼 흰 면 위, 폭은 쪽 안 폭과 같은 컨테이너 기준 */
export function RunControlsSection() {
  const states = [
    {
      label: '준비됨',
      note: '큰 초록 버튼 · 아랫면 3px · 재생 아이콘',
      props: { status: 'ready' as const, isRunning: false },
    },
    {
      label: '처음 준비 중 · 불러오기',
      note: 'Worker가 알린 단계만 · 지금 칸은 흐르는 조각(바쁨 표시) · 팁이 바뀜',
      props: {
        status: 'loading' as const,
        loadStage: 'download' as const,
        isRunning: false,
      },
    },
    {
      label: '처음 준비 중 · 점검',
      note: 'Pyodide를 띄운 뒤 네트워크 API 지우기 등 (짧음)',
      props: {
        status: 'loading' as const,
        loadStage: 'setup' as const,
        isRunning: false,
      },
    },
    {
      label: '실행 중',
      note: '초록 면 + 스피너 + 빛 띠(full·lite). 멈추기 옆에',
      props: { status: 'ready' as const, isRunning: true },
    },
    {
      label: '정답 확인 중',
      note: '채점·완료 요청 동안 다시 못 누름 (B06)',
      props: { status: 'ready' as const, isRunning: false, isSubmitting: true },
    },
    {
      label: '다시 준비 중 (무한 루프를 멈춘 뒤)',
      note: 'Worker를 다시 띄우는 2~5초 (§2.9)',
      props: {
        status: 'loading' as const,
        restarting: 'stop' as const,
        loadStage: 'download' as const,
        isRunning: false,
      },
    },
    {
      label: '빈 공책',
      note: '준비됐지만 코드가 없으면 납작한 회색 면',
      props: { status: 'ready' as const, isRunning: false, isCodeEmpty: true },
    },
    {
      label: '실행기 오류',
      note: '다시 불러오기 + 안내',
      props: { status: 'error' as const, isRunning: false },
    },
  ];
  // 팁이 Framer m.* 라 LazyMotion 이 필요하다 (앱은 LoggedInShell 이 감쌈)
  return (
    <MotionProvider>
    <Section
      id="run-controls"
      kicker="퀘스트 (P6-05)"
      title="실행 버튼 · 실행기 준비"
      description="공책 쪽 실행 줄(RunControls). 진행률 숫자는 지어내지 않고 Worker가 알려 주는 단계(불러오기 → 점검 → 준비 끝)만 보여 줘요. 흐르는 조각·점 세 개는 바쁨 표시라 minimal에서도 돌고, 실행 중 빛 띠는 full·lite만, 동작 줄이기는 모두 멈추고 글자·색으로만 알려요. 8초가 넘으면 팁 대신 '처음 한 번은 오래 걸려요' 안내."
    >
      <div className="grid items-start gap-4 md:grid-cols-2">
        {states.map((s) => (
          <Demo
            key={s.label}
            label={s.label}
            note={s.note}
            surface="card"
            className="@container"
          >
            <RunControls
              {...s.props}
              onRun={noop}
              onStop={noop}
              onRetry={noop}
            />
          </Demo>
        ))}
        <Demo
          label="첫 방문이 느릴 때"
          note="Slow 4G 첫 방문 34초 실측 → 8초 뒤 안내로 바뀜"
          surface="card"
        >
          <RunnerLoading stage="download" slow />
        </Demo>
      </div>
      <CodeSample
        code={`<RunControls status={runner.status} restarting={runner.restarting} loadStage={runner.loadStage}\n  isRunning={runner.isRunning} isSubmitting={isSubmitting} isCodeEmpty={isCodeEmpty}\n  onRun={handleRun} onStop={handleStop} onRetry={runner.retry} />`}
      />
    </Section>
    </MotionProvider>
  );
}

const SLIP_ERR =
  'Traceback (most recent call last):\n  File "<exec>", line 3, in <module>\nNameError: name \'nmae\' is not defined\n';

/** 실행 중 견본: 줄이 하나씩 흘러 들어온다 */
function LiveSlipDemo() {
  const [store] = useState(() => createLiveOutputStore());
  useEffect(() => {
    store.reset();
    const timers = ['반복 0', '반복 1', '반복 2'].map((line, i) =>
      setTimeout(() => store.append(`${line}\n`), (i + 1) * 600),
    );
    return () => timers.forEach(clearTimeout);
  }, [store]);
  return <OutputPanel result={null} isRunning liveOutput={store} />;
}

/** 결과 쪽지 견본 (P6-06). "다시 튀어나오기"로 줄 카드 등장 연출을 다시 본다 */
export function OutputPanelSection() {
  const [round, setRound] = useState(0);
  const ok = { stderr: '', success: true, outcome: 'ok' as const };
  const states = [
    {
      label: '아직 안 돌림',
      note: '옅은 회색 쪽지 · 안내 한 줄',
      node: <OutputPanel result={null} isRunning={false} />,
    },
    {
      label: '실행 중 (실시간 출력)',
      note: '돌아가는 중 딱지(바쁨 표시) · 줄이 오는 대로 카드로',
      node: <LiveSlipDemo />,
    },
    {
      label: '통과',
      note: '초록 면 · "통과! 정답이에요!" 딱지 · 줄마다 흰 카드',
      node: (
        <OutputPanel
          result={{ ...ok, stdout: '나는 파이썬 모험가!\n반가워!\n' }}
          isRunning={false}
          validationResult={{ passed: true }}
        />
      ),
    },
    {
      label: '출력이 다름 · 줄마다 견줘 보기',
      note: '금색 면 · 공개 예시 출력(P7-17)과 줄마다 견줌: 같은 줄 ✓, 다른 줄은 연필 표시 + 옅은 금색 + "내 글자", 모자란 줄 "(안 나왔어요)" · 규칙 유형별 살펴볼 거리 + "파이뱀에게 더 물어보기"(Q56). 결과가 정해진 output_match 퀘스트만',
      node: (
        <OutputPanel
          result={{ ...ok, stdout: '=== 파이썬 마을 ===\n인구: 2026 명\n' }}
          isRunning={false}
          validationResult={{ passed: false, type: 'output_match' }}
          example={{
            text: '=== 파이썬 마을 ===\n인구: 2026명\n환영합니다!',
            compare: true,
          }}
          onAskTutor={noop}
        />
      ),
    },
    {
      label: '출력이 다름 · 무작위 예시',
      note: '무작위·포함 검사 퀘스트(output_match 아님)는 줄 비교 없이 "예시"라고 밝히고 보여 줌',
      node: (
        <OutputPanel
          result={{ ...ok, stdout: '비밀 숫자: 4\n' }}
          isRunning={false}
          validationResult={{ passed: false, type: 'all' }}
          example={{ text: '비밀 숫자: 7\n추측: 3', compare: false }}
        />
      ),
    },
    {
      label: '출력이 다름 · 아무것도 안 나옴',
      note: 'print를 빠뜨렸을 때',
      node: (
        <OutputPanel
          result={{ ...ok, stdout: '' }}
          isRunning={false}
          validationResult={{ passed: false, type: 'output_match' }}
          example={{ text: '2026', compare: true }}
        />
      ),
    },
    {
      label: '오류',
      note: '옅은 빨강 면 · 몇 번째 줄 + 마지막 한 줄 · 줄로 가기 · 전체 메시지는 접음. 아래에 버그버그 등장(P6-07, 아래 절) + "파이뱀에게 더 물어보기"(Q56: AI 피드백은 누를 때만)',
      node: (
        <OutputPanel
          result={{
            stdout: '마법 상자 준비!\n',
            stderr: SLIP_ERR,
            success: false,
            hadException: true,
          }}
          isRunning={false}
          onShowErrorLine={noop}
          onAskTutor={noop}
        />
      ),
    },
    {
      label: '시간 초과',
      note: '차분한 회색 · 멈추기 전까지 나온 글자',
      node: (
        <OutputPanel
          result={{
            stdout: '0\n1\n2\n',
            stderr: '',
            success: false,
            isTimeout: true,
            outcome: 'timeout',
          }}
          isRunning={false}
        />
      ),
    },
    {
      label: '멈춤 · 결과 쪽에서 재준비',
      note: '모바일 결과 쪽: 따로 쌓인 상자 대신 쪽지 아래 한 줄',
      node: (
        <OutputPanel
          result={{
            stdout: '반복 0\n반복 1\n',
            stderr: '',
            success: false,
            isStopped: true,
            outcome: 'stopped',
          }}
          isRunning={false}
          restarting
        />
      ),
    },
  ];
  return (
    <Section
      id="output-slip"
      kicker="퀘스트 (P6-06)"
      title="결과 쪽지 · 나온 글자"
      description="공책 쪽 결과(OutputPanel). 나온 글자는 줄마다 흰 카드로 튀어나와요: full은 body 스프링으로 차례로(앞 12줄만), lite는 짧게, minimal·동작 줄이기는 바로 보여요. 출력이 다를 때는 정답 기준값(서버 전용) 대신 해 볼 일의 공개 안내와 규칙 유형별 살펴볼 거리로 견줘 봐요."
    >
      <Button
        onClick={() => setRound((r) => r + 1)}
        variant="secondary"
        size="sm"
        sfx={false}
        icon={<RotateCcw aria-hidden />}
        data-testid="output-slip-replay"
      >
        다시 튀어나오기
      </Button>
      <div className="mt-4 grid items-start gap-4 md:grid-cols-2">
        {states.map((s) => (
          <Demo
            key={`${s.label}-${round}`}
            label={s.label}
            note={s.note}
            surface="card"
          >
            {s.node}
          </Demo>
        ))}
      </div>
      <CodeSample
        code={`<OutputPanel result={runResult} isRunning={runner.isRunning} validationResult={validation}\n  liveOutput={liveOutput} example={{ text: example_output, compare: validation_type === 'output_match' }} onShowErrorLine={showErrorLine} />`}
      />
    </Section>
  );
}

const STAGE_ERR: RunResult = {
  stdout: '마법 상자 준비!\n',
  stderr: SLIP_ERR,
  success: false,
  hadException: true,
};
const STAGE_DIFF: RunResult = {
  stdout: '안녕하세요\n',
  stderr: '',
  success: true,
  outcome: 'ok',
};
const STAGE_TIMEOUT: RunResult = {
  stdout: '0\n1\n2\n',
  stderr: '',
  success: false,
  isTimeout: true,
  outcome: 'timeout',
};

/** 앱과 같은 대사 고르기(tutorLine) + 오류면 생각 박자(useThinkBeat). 견본이라 세션 대신 필요한 값만 */
function StagedTutor({
  result,
  validation = null,
  round,
}: {
  result: RunResult;
  validation?: QuestSession['validation'];
  round: number;
}) {
  const said = tutorLine({
    runResult: result,
    validation,
    isCompleted: false,
    steps: null,
  } as unknown as QuestSession);
  const thinking = useThinkBeat(`${round}`, !!result.hadException);
  const line = thinking
    ? { state: 'think' as const, text: '음… 어디 보자. 버그버그가 어디 숨었을까?' }
    : said;
  return (
    <DialogueBox
      speaker="파이뱀"
      text={line.text}
      data-testid="staging-dialogue"
      character={(speaking) => (
        <PybaemRig state={line.state} talking={speaking} size={96} label="" />
      )}
    />
  );
}

/** 고친 뒤: 오류 → (다시 돌림) → 끝까지 돎. 버그버그가 화해하고 사라진다 */
function FixDemo() {
  const [fixed, setFixed] = useState(false);
  return (
    <div className="space-y-3">
      <Button
        onClick={() => setFixed((f) => !f)}
        variant="secondary"
        size="sm"
        sfx={false}
        data-testid="staging-fix"
      >
        {fixed ? '다시 버그 내기' : '고쳐서 다시 돌리기'}
      </Button>
      <OutputPanel
        result={
          fixed
            ? { stdout: '마법 상자 준비!\n상자 열기!\n', stderr: '', success: true, outcome: 'ok' }
            : STAGE_ERR
        }
        isRunning={false}
        validationResult={fixed ? { passed: true } : null}
      />
    </div>
  );
}

/** 실패 연출 세 갈래 (P6-07): 오류 · 출력이 다름 · 시간 초과 + 고친 뒤 화해 */
export function ErrorStagingSection() {
  const [round, setRound] = useState(0);
  const cases = [
    {
      label: '오류 (버그버그 등장 + 파이뱀 생각 → 설명)',
      note: 'full: 버그버그가 옆에서 통통 뛰어 들어옴 · lite: 제자리 깜짝 점프 · minimal·동작 줄이기: 움직임 없이 표정·후광 색만. 파이뱀은 생각 박자 뒤 쉬운 설명(동작 줄이기는 바로). lg 미만에서는 결과 쪽에 파이뱀 설명 쪽지가 한 줄 더',
      result: STAGE_ERR,
      validation: null,
      testId: 'staging-error',
    },
    {
      label: '출력이 다름 (버그버그 없음)',
      note: '파이뱀 갸우뚱(confused) + 격려. 결과 쪽지는 금색 견줘 보기',
      result: STAGE_DIFF,
      validation: { passed: false, type: 'output_match' as const },
      testId: 'staging-diff',
    },
    {
      label: '시간 초과 (무한 반복)',
      note: '파이뱀 격려(encourage) + 반복이 멈추는지 살펴보자는 차분한 말',
      result: STAGE_TIMEOUT,
      validation: null,
      testId: 'staging-timeout',
    },
  ];
  return (
    <Section
      id="error-staging"
      kicker="퀘스트 (P6-07)"
      title="실패 연출 · 버그버그와 파이뱀"
      description="빨간 경고 대신 캐릭터가 알려 줘요. 오류는 파이썬 오류 문장을 아이 말로 바꾼 규칙표(src/lib/quest/errorExplain.ts, LLM 호출 없음)로 줄 번호와 함께 설명해요. 성공 연출은 아래 #success-staging."
    >
      <Button
        onClick={() => setRound((r) => r + 1)}
        variant="secondary"
        size="sm"
        sfx={false}
        icon={<RotateCcw aria-hidden />}
        data-testid="staging-replay"
      >
        다시 보기
      </Button>
      <div className="mt-4 grid gap-4">
        {cases.map((c) => (
          <Demo
            key={`${c.testId}-${round}`}
            label={c.label}
            note={c.note}
            surface="card"
            data-testid={c.testId}
          >
            <div className="grid items-start gap-4 md:grid-cols-2">
              <StagedTutor
                result={c.result}
                validation={c.validation}
                round={round}
              />
              <OutputPanel
                result={c.result}
                isRunning={false}
                validationResult={c.validation}
                example={{ text: '안녕하세요!', compare: true }}
                onShowErrorLine={noop}
              />
            </div>
          </Demo>
        ))}
        <Demo
          label="고친 뒤 (화해)"
          note="오류 다음 실행이 끝까지 돌면 버그버그가 화해 인사를 하고 3초 뒤 스르르 사라져요(동작 줄이기는 바로)"
          surface="card"
          data-testid="staging-fixed"
        >
          <FixDemo />
        </Demo>
      </div>
      <CodeSample
        code={`// OutputPanel 오류 → <BugbugAside stderr={result.stderr} /> (errorAside 자리)\n// StoryPage: tutorLine(session) + useThinkBeat(runResult, hadException)\nexplainError(stderr) // { type, line, text: '3번째 줄을 봐요. …' }`}
      />
    </Section>
  );
}

const STAGE_PASS: RunResult = {
  stdout: '안녕하세요!\n마법 상자 준비!\n',
  stderr: '',
  success: true,
  outcome: 'ok',
};
const STAGE_PASS_CHECK = { passed: true, type: 'output_match' as const };

/** 이야기 쪽 파이뱀 성공 박자: 기쁨 점프(happy) → 응원(cheer). StoryPage와 같은 tutorLine + useThinkBeat(HAPPY_MS) */
function SuccessTutor({ round }: { round: number }) {
  const said = tutorLine({
    runResult: STAGE_PASS,
    validation: STAGE_PASS_CHECK,
    isCompleted: true,
    steps: null,
  } as unknown as QuestSession);
  const jumping = useThinkBeat(`${round}`, true, HAPPY_MS);
  const state = jumping ? 'happy' : said.state;
  return (
    <DialogueBox
      speaker="파이뱀"
      text={said.text}
      tone="good"
      data-testid="success-dialogue"
      character={(speaking) => (
        <span data-rig-state={state} data-testid="success-pybaem">
          <PybaemRig state={state} talking={speaking} size={96} label="" />
        </span>
      )}
    />
  );
}

/** 성공 연출 (P6-08): 도장 쾅 · 보상 띠 · 파이뱀 happy → cheer · 축하 카드 리그 */
export function SuccessStagingSection() {
  const [round, setRound] = useState(0);
  const { budget } = useMotionTier();
  const reward = {
    title: '첫 번째 인사',
    xp: 45,
    stars: 2 as const,
    coins: 10,
    nextHref: '/dev/design#success-staging',
    mapHref: '/dev/design#success-staging',
  };
  return (
    <MotionProvider>
      <Section
        id="success-staging"
        kicker="퀘스트 (P6-08)"
        title="성공 연출 · 통과 도장과 보상"
        description="정답이면 결과 쪽지에 금색 “통과!” 도장이 쾅 찍히고(온보딩 도장과 같은 stampSlam), 아래 보상 띠에서 별 1→3이 스프링으로 톡톡 · XP·코인이 0부터 올라가요(약 1.6초, lite 70%). 그 사이 아무 데나 누르거나 Enter·Esc·Space면 끝 모습으로 건너뛰어요. 이야기 쪽 파이뱀은 기쁨 점프(happy) 뒤 응원(cheer). 정답 컨페티는 full 100% · lite 30% · minimal·동작 줄이기 0. 코인은 P8-04부터(처음 통과 10 + 새로 얻은 별마다 5 — 레벨 업 코인은 레벨 업 카드에), 별은 P8-05부터 실제 화면에도(서버 best_stars). 이미 통과한 퀘스트를 다시 풀어 별이 늘면 “복습 완료” 띠 맨 앞에 금색 “새 별 +N” 알약과 별 코인이 붙어요(XP 없음)."
      >
        <Button
          onClick={() => setRound((r) => r + 1)}
          variant="secondary"
          size="sm"
          sfx={false}
          icon={<RotateCcw aria-hidden />}
          data-testid="success-replay"
        >
          다시 보기
        </Button>
        <div className="mt-4 grid gap-4">
          <Demo
            key={`full-${round}`}
            label="별·코인을 켠 모습 (Phase 8, 플래그 켬)"
            note="도장 → 별 1→3 팝 → XP·코인 카운트업 → 다음 퀘스트 · 지도로"
            surface="card"
            data-testid="success-flags-on"
          >
            <div className="grid items-start gap-4 md:grid-cols-2">
              <SuccessTutor round={round} />
              <OutputPanel
                result={STAGE_PASS}
                isRunning={false}
                validationResult={STAGE_PASS_CHECK}
                reward={{ ...reward, forceStarsCoins: true }}
              />
            </div>
          </Demo>
          <div className="grid items-start gap-4 md:grid-cols-2">
            <Demo
              key={`real-${round}`}
              label="지금 실제 화면 (별·XP·코인, P8-05)"
              note="SHOW_STARS·SHOW_COINS가 켜져 실제 화면도 같은 띠. 좁은 화면(lg 미만)은 띠 머리에 파이뱀 얼굴"
              surface="card"
              data-testid="success-real"
            >
              <OutputPanel
                result={STAGE_PASS}
                isRunning={false}
                validationResult={STAGE_PASS_CHECK}
                reward={reward}
              />
            </Demo>
            <Demo
              key={`end-${round}`}
              label="스테이지 마지막 퀘스트 · 황금 열쇠"
              note="다음 퀘스트가 없으면 지도가 주 버튼(스테이지 클리어 축하는 오버레이가 먼저). 황금 열쇠로 연 퀘스트는 XP 대신 한 줄"
              surface="card"
              data-testid="success-stage-end"
            >
              <OutputPanel
                result={STAGE_PASS}
                isRunning={false}
                validationResult={STAGE_PASS_CHECK}
                reward={{
                  title: '마을 입구 지도 완성',
                  xp: 0,
                  stars: 1,
                  note: '황금 열쇠로 연 퀘스트는 XP·코인 없이 통과로 기록돼요. 나중에 직접 풀면 별과 XP를 받아요.',
                  nextHref: null,
                  mapHref: '/dev/design#success-staging',
                }}
              />
            </Demo>
          </div>
          <Demo
            key={`retry-${round}`}
            label="다시 풀어 새 별 (P8-05)"
            note="이미 통과한 퀘스트를 힌트 없이 다시 풀면 ⭐3으로 최고 별을 채우고, 새로 얻은 별 번호에만 코인(별마다 5). XP는 처음 한 번뿐이라 없음. 별 3개를 다 모은 퀘스트는 “복습 완료” 한 줄만"
            surface="card"
            data-testid="success-retry"
          >
            <OutputPanel
              result={STAGE_PASS}
              isRunning={false}
              validationResult={STAGE_PASS_CHECK}
              reward={{
                ...reward,
                xp: 0,
                stars: 3,
                newStars: 2,
                coins: 10,
                review: true,
                note: '다시 풀어서 새 별을 모았어요! XP는 처음 통과할 때 한 번만 받아요.',
              }}
            />
          </Demo>
          <Demo
            key={`card-${round}`}
            label="축하 카드 파이뱀 (B32 LottieCharacter → 리그)"
            note="뿌듯(proud)으로 나타났다가 기쁨 점프(happy: 웅크림 → 두 번 + 착지 젤리). 반복 점프는 오버레이에서 쓰지 않음. 축하 카드 전체는 #celebrations"
            surface="card"
            data-testid="success-card"
          >
            <div className="flex justify-center">
              <CelebrationMascot size={96} budget={budget} />
            </div>
          </Demo>
        </div>
        <CodeSample
          code={`// QuestWorkspace: 완료한 그 실행이면\n<OutputPanel … reward={{ xp: earnedXP, stars, nextHref, mapHref }} />\n// → <PassStamp>(쪽지 위) + <RewardStrip>(쪽지 아래), useSuccessRun(…)으로 건너뛰기\n// StoryPage: tutorLine → 'cheer', useThinkBeat(runResult, cheer, HAPPY_MS) 동안 'happy'`}
        />
      </Section>
    </MotionProvider>
  );
}

export function ShareCardSection() {
  return (
    <Section
      id="share-card"
      kicker="기타 (P2-19)"
      title="공유 카드 샘플"
      description="샘플 데이터(src/lib/share-card/samples.ts)를 운영과 같은 엔진(next/og)으로 요청 때 그립니다(/dev/design/share-card/<id>, 개발 전용). 커밋된 PNG는 docs/design/img/share-card/ (npm run share-card:render)."
    >
      <ul className="grid gap-4 md:grid-cols-2">
        {SHARE_CARD_SAMPLES.map((s) => (
          <li key={s.id} className="space-y-2 rounded-2xl bg-card p-3 shadow-card">
            {/* 개발 전용 동적 PNG라 next/image 최적화를 거치지 않는다 */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/dev/design/share-card/${s.id}`}
              alt={`공유 카드 샘플: ${s.note}`}
              width={1200}
              height={630}
              loading="lazy"
              className="h-auto w-full rounded-xl bg-surface-2"
            />
            <p className="flex items-center justify-between gap-2 text-caption text-muted-foreground">
              <span>
                <b className="text-foreground">{s.id}</b> · {s.note}
              </span>
              <a
                href={`/dev/design/share-card/${s.id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 shrink-0 items-center gap-1 px-1 font-semibold text-primary-text underline underline-offset-4"
              >
                원본 <ExternalLink aria-hidden className="size-4" />
              </a>
            </p>
          </li>
        ))}
      </ul>
      <h3 className="mt-8 font-display text-h3">
        공유 페이지 /share/[cardId] (P9-08)
      </h3>
      <p className="text-small text-muted-foreground">
        링크를 받은 보호자·친구가 로그인 없이 보는 첫 화면. 카드 그림(대체 글 포함) + 축하 문구 + 소개 + 나도
        해보기(랜딩 30초 체험). 아래: 카드 있음 · 없음·비공개·만료(404, 아이 정보 없음)
      </p>
      <div className="grid gap-4" data-testid="share-page-samples">
        {[SHARE_CARD_SAMPLES[0]].map((s) => (
          <div
            key={s.id}
            className="overflow-hidden rounded-2xl ring-1 ring-line"
          >
            <ShareCardView
              kind={s.data.kind}
              {...shareCardSummary(s.data)}
              imageSrc={`/dev/design/share-card/${s.id}`}
            />
          </div>
        ))}
        <div className="overflow-hidden rounded-2xl ring-1 ring-line">
          <ShareGoneView />
        </div>
      </div>
      <h3 className="mt-8 font-display text-h3">공유 시트 (P9-09)</h3>
      <p className="text-small text-muted-foreground">
        카드 미리보기 + 카카오톡(키가 있을 때만) · 공유하기(Web Share 되는 기기만) · 이미지 저장 · 링크 복사 + 보내기 전 안내.
        앱에서는 <code>{'<ShareButton kind=…>'}</code>(프로필 레벨·주간 카드) 또는 축하 카드의 자랑하기(P9-10). 채널을 다 쓰면
        자랑하기 보상(하루 1회 30코인) 줄이 바뀐다: 오늘 처음 → +30 코인(효과음·HUD로 날아감) / 오늘 보상은 받았어요. 견본은 만들어 둔
        카드(샘플 그림)와 보상 흉내를 넘겨 요청을 하지 않는다
      </p>
      <ShareSheetDemo />
    </Section>
  );
}

function ShareSheetDemo() {
  // 두 견본: 오늘 처음(보내면 +30, 요청 없이 흉내) · 오늘 보상은 이미 받음 (P9-10)
  const [open, setOpen] = useState<'offer' | 'claimed' | null>(null);
  const card = (claimed: boolean) => ({
    id: 'AAAAAAAAAAAAAAAAAAAAAA',
    kind: 'levelup' as const,
    version: 1,
    expiresAt: new Date(Date.now() + 90 * 86_400_000).toISOString(),
    imageUrl: `/dev/design/share-card/${SHARE_CARD_SAMPLES[0].id}`,
    rewardClaimed: claimed,
  });
  return (
    <div className="flex flex-wrap gap-3">
      <Button
        variant="secondary"
        icon={<Share2 aria-hidden />}
        onClick={() => setOpen('offer')}
        data-testid="share-sheet-demo"
      >
        공유 시트 열기 (오늘 처음)
      </Button>
      <Button
        variant="secondary"
        icon={<Share2 aria-hidden />}
        onClick={() => setOpen('claimed')}
        data-testid="share-sheet-demo-claimed"
      >
        오늘 보상은 받음
      </Button>
      {(['offer', 'claimed'] as const).map((k) => (
        <ShareSheet
          key={k}
          open={open === k}
          onOpenChange={(o) => setOpen(o ? k : null)}
          kind="levelup"
          card={card(k === 'claimed')}
          requestReward={async () => ({
            coins_earned: 30,
            coins_balance: 130,
            already_claimed: false,
          })}
        />
      ))}
    </div>
  );
}

const SFX_IDS = Object.keys(SFX_USES) as SfxId[];

export function SoundSection() {
  const play = useSfx();
  const [settings] = useSoundSettings();
  const off = settings.muted || !settings.sfx.enabled;
  return (
    <Section
      id="sound"
      kicker="기타 (P2-14)"
      title="효과음 12종"
      description="첫 탭 전에는 소리를 내지 않아요(브라우저 규칙). 아무 곳이나 한 번 누른 뒤 재생하세요. 효과음은 연출 단계와 무관하게 유지되고, 소리는 유일한 정보가 아니에요(같은 내용을 글자·색·모양으로도 보여 줌)."
    >
      {off && (
        <p className="rounded-xl bg-warning-soft px-4 py-3 text-small text-warning">
          지금 소리가 꺼져 있어요 (설정 또는 HUD 음소거). 재화 HUD의 소리 버튼으로 켤 수 있어요.
        </p>
      )}
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {SFX_IDS.map((id) => (
          <li key={id} className="flex items-start gap-3 rounded-2xl bg-card p-3 shadow-card" data-surface="raised">
            <Button
              variant="secondary"
              size="sm"
              sfx={false}
              icon={<Volume2 aria-hidden />}
              onClick={() => play(id)}
              data-testid={`sfx-${id}`}
            >
              {SFX_USES[id].name}
            </Button>
            <p className="min-w-0 text-caption text-muted-foreground">
              <b className="font-mono text-foreground">{id}</b> · {SFX_USES[id].when}
            </p>
          </li>
        ))}
      </ul>
      <Demo label="별 1 → 3 상승음" note="같은 소리를 도-미-솔 비율로 (STAR_RATES)">
        <Button
          variant="reward"
          size="sm"
          sfx={false}
          onClick={() =>
            STAR_RATES.forEach((rate, i) =>
              window.setTimeout(() => play('star', { rate }), i * 260),
            )
          }
        >
          별 세 개
        </Button>
      </Demo>
      <Demo
        label="퀘스트 박자 (P6-14)"
        note="보상 띠와 같은 rewardSfx 예약: 별 1→3(0.45초부터 0.15초 간격) 뒤 코인 카운트업 동안 coin 최대 6번(동시 상한 6). 대사 블립은 #bubble 대사창(다시 타자)에서, 정답은 #success-staging 도장, bug는 #error-staging 버그버그 등장 때"
      >
        <div className="flex flex-wrap gap-3">
          <Button
            variant="reward"
            size="sm"
            sfx={false}
            data-testid="sfx-reward-run"
            onClick={() =>
              rewardSfx({
                stars: 3,
                coins: 40,
                starsAtMs: 450,
                starGapMs: 150,
                countAtMs: 640,
                countMs: 700,
              }).forEach((c) =>
                window.setTimeout(() => play(c.id, { rate: c.rate }), c.at),
              )
            }
          >
            별 셋 + 코인 카운트업
          </Button>
          <Button
            variant="secondary"
            size="sm"
            sfx={false}
            onClick={() =>
              rewardSfx({ stars: 3, coins: 40 }).forEach((c) =>
                play(c.id, { rate: c.rate }),
              )
            }
          >
            움직임 없음 (화음 + 코인 한 번)
          </Button>
        </div>
      </Demo>
      <Demo label="지도 노드 (P5-11)" note="열린 노드·차례 퀘스트는 탭, 잠긴 노드는 같은 탭을 작고 낮게(경고음 없음, 안내는 쪽지 글자)">
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" size="sm" sfx={false} onClick={() => play('tap')}>
            열린 노드
          </Button>
          <Button variant="secondary" size="sm" sfx={false} onClick={() => play('tap', SOFT_TAP)}>
            잠긴 노드
          </Button>
          <Button variant="secondary" size="sm" sfx={false} onClick={() => play('unlock')}>
            자물쇠 깨짐
          </Button>
        </div>
      </Demo>
      <WorldBgmDemo />
      <CodeSample code={`const play = useSfx();\nplay('correct');\nplay('star', { rate: STAR_RATES[2] });`} />
    </Section>
  );
}

const BGM_IDS: BgmId[] = ['world1', 'world2', 'world3'];

/** 월드를 옮길 때 800ms 크로스페이드 (P5-11). 설정에서 배경음악을 켜야 들린다 */
function WorldBgmDemo() {
  const [bgm, setBgm] = useState<BgmId | null>(null);
  const { playingBgm, settings } = useSoundSnapshot();
  return (
    <Demo
      label="월드 BGM 크로스페이드 (P5-11)"
      note={`곡을 바꾸면 800ms 동안 겹쳐 바뀌고, 디코드한 곡은 지금 곡만 남겨요. 배경음악 ${settings.bgm.enabled ? '켜짐' : '꺼짐(설정에서 켜야 들림)'} · 지금 나는 곡: ${playingBgm ?? '없음'}`}
    >
      <div className="flex flex-wrap gap-3">
        {BGM_IDS.map((id) => (
          <Button
            key={id}
            variant={bgm === id ? 'primary' : 'secondary'}
            size="sm"
            sfx={false}
            icon={<Music aria-hidden />}
            aria-pressed={bgm === id}
            onClick={() => setBgm(id)}
          >
            {id}
          </Button>
        ))}
        <Button variant="ghost" size="sm" sfx={false} onClick={() => setBgm(null)}>
          끄기
        </Button>
      </div>
      <WorldBgm id={bgm} />
    </Demo>
  );
}
