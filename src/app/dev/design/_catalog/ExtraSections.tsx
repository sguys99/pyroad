'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Code2,
  ExternalLink,
  Music,
  RotateCcw,
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
import { MotionProvider } from '@/components/providers/MotionProvider';
import { OutputPanel } from '@/components/quest/OutputPanel';
import { createLiveOutputStore } from '@/lib/pyodide/liveOutput';
import { CodeSample, Demo, Section } from './ui';

/** 모바일 코드 키보드 견본 (P6-04): 실제 에디터 + 키보드. 퀘스트 화면은 lg 미만·터치에서만 띄운다 */
function CodeKeyboardDemo() {
  const editor = useRef<CodeEditorHandle>(null);
  const [code, setCode] = useState('# 아래에 코드를 작성해보세요!\n');
  return (
    <div className="flex max-w-sm flex-col gap-2" data-testid="catalog-code-keyboard">
      <CodeEditor ref={editor} value={code} onChange={setCode} />
      <CodeKeyboard editor={editor} />
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
        label="모바일 코드 키보드 (P6-04)"
        note="주문(초록)·기호는 띠를 옆으로 넘기고, 커서 ← →는 오른쪽에 고정. 눌러도 에디터 포커스·폰 키보드를 뺏지 않음. 화살표 키로 키 사이 이동"
        surface="card"
      >
        <CodeKeyboardDemo />
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
      label: '출력이 다름',
      note: '금색 면 · 공개 안내(해 볼 일)와 견줘 보기 + 규칙 유형별 살펴볼 거리. 정답 기준값은 보여 주지 않음',
      node: (
        <OutputPanel
          result={{ ...ok, stdout: '안녕하세요\n' }}
          isRunning={false}
          validationResult={{ passed: false, type: 'output_match' }}
          goal="안녕하세요! 가 출력되어야 해요"
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
          goal="2026 이 출력되어야 해요"
        />
      ),
    },
    {
      label: '오류',
      note: '옅은 빨강 면 · 몇 번째 줄 + 마지막 한 줄 · 줄로 가기 · 전체 메시지는 접음. 버그버그 등장·설명은 P6-07',
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
        code={`<OutputPanel result={runResult} isRunning={runner.isRunning} validationResult={validation}\n  liveOutput={liveOutput} goal={goal} onShowErrorLine={showErrorLine} />`}
      />
    </Section>
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
    </Section>
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
