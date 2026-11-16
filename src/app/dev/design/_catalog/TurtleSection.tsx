'use client';

import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OutputPanel } from '@/components/quest/OutputPanel';
import { GameKeys } from '@/components/quest/GameKeys';
import { TurtleStage } from '@/components/quest/TurtleStage';
import { createLiveOutputStore } from '@/lib/pyodide/liveOutput';
import type { RunResult } from '@/lib/pyodide/usePyodide';
import { CodeSample, Demo, Section } from './ui';
import samples from './turtleSamples.json';

type SampleName = keyof typeof samples;

const LIMIT_ERR =
  'Traceback (most recent call last):\n  File "<exec>", line 4, in <module>\nTurtleLimitError: 그림 명령이 너무 많아요 (최대 50,000개). 끝나지 않는 반복(while True)이 있는지 확인해 보세요!\n';

/**
 * 그림판 견본: 녹화한 명령 스트림(scripts/pyodide/turtle/record-samples.ts)을 실행기 없이 저장소에 흘려 넣는다.
 * live면 실제 Worker처럼 실행 중에 조각으로 나눠 넣고(그리는 중 → 완성), 아니면 다 넣은 뒤 끝난 결과로 보여 준다
 */
function StageDemo({
  name,
  live = false,
  result,
  limit,
}: {
  name: SampleName;
  live?: boolean;
  /** 끝난 뒤 쪽지 (없으면 표본 stdout으로 성공) */
  result?: RunResult;
  /** 명령을 이만큼만 (멈춘 그림 흉내) */
  limit?: number;
}) {
  const sample = samples[name];
  const [store] = useState(() => createLiveOutputStore());
  const [running, setRunning] = useState(live);
  useEffect(() => {
    store.reset();
    const cmds = sample.commands.slice(0, limit);
    if (!live) {
      store.turtle(JSON.stringify(cmds));
      return;
    }
    // Worker처럼: 40ms 뒤 첫 조각, 그 뒤 몇 조각 (Python 실행은 짧고 그림은 렌더러가 제 속도로)
    const timers: ReturnType<typeof setTimeout>[] = [];
    const size = Math.max(1, Math.ceil(cmds.length / 4));
    for (let i = 0; i < cmds.length; i += size) {
      const part = cmds.slice(i, i + size);
      timers.push(
        setTimeout(() => store.turtle(JSON.stringify(part)), 40 + i / 8),
      );
    }
    timers.push(setTimeout(() => setRunning(false), 80 + cmds.length / 8));
    return () => timers.forEach(clearTimeout);
  }, [store, sample, live, limit]);
  return (
    <OutputPanel
      result={
        running
          ? null
          : (result ?? {
              stdout: sample.stdout,
              stderr: '',
              success: true,
              outcome: 'ok',
            })
      }
      isRunning={running}
      liveOutput={store}
      turtle
    />
  );
}

/** 그림판 (P11-02): turtle을 쓰는 코드의 결과 위 도화지 + 빠르기·바로 완성·모눈·저장 */
/** 게임 조종판 견본 (P11-04): 실행 없이 누른 키 이름만 보여 준다 */
function GameKeysDemo({ none = false }: { none?: boolean }) {
  const [last, setLast] = useState<string[]>([]);
  return (
    <>
      <GameKeys
        running
        pad="always"
        preview={{
          channel: none ? 'none' : 'jspi',
          onKey: (k) => setLast((l) => [...l, k].slice(-6)),
        }}
      />
      {!none && (
        <p
          className="text-caption text-muted-foreground"
          data-testid="game-keys-demo-log"
        >
          get_key() → {last.length ? last.join(', ') : 'None'}
        </p>
      )}
    </>
  );
}

export function TurtleSection() {
  const [round, setRound] = useState(0);
  const [emptyStore] = useState(() => createLiveOutputStore());
  const states: { label: string; note: string; node: React.ReactNode }[] = [
    {
      label: '아직 안 돌림',
      note: 'import turtle이 보이면 빈 도화지를 미리 펼쳐요',
      node: (
        <OutputPanel
          result={null}
          isRunning={false}
          liveOutput={emptyStore}
          turtle
        />
      ),
    },
    {
      label: '그리는 중 → 완성 (꽃)',
      note: 'CPython 속도 공식 1배. 바로 완성으로 건너뛰기, 동작 줄이기·minimal은 처음부터 바로',
      node: <StageDemo name="flower" live />,
    },
    {
      label: '데이터 탐정 막대그래프 (3-5)',
      note: '한글 글씨는 본문 글꼴(pyRoad Sans) 조각을 미리 받아 그려요',
      node: <StageDemo name="bars" />,
    },
    {
      label: '여러 거북이 + 글씨 (경주)',
      note: '거북이마다 명령 순서대로 번갈아 움직여요. 출력 글자는 쪽지에',
      node: <StageDemo name="race" />,
    },
    {
      label: '무지개 나선 + bgcolor',
      note: '배경색을 바꾸면 도화지 색도 바뀌어요',
      node: <StageDemo name="spiral" />,
    },
    {
      label: '게임 조종판 (P11-04)',
      note: '실행이 get_key()를 부르면 그림판 아래에 나와요. 키보드 화살표·스페이스·글자 키, 폰·태블릿은 ← ↑ → ↓ 패드(64px, 누르고 있으면 계속). 여기선 패드를 늘 보여 줘요',
      node: <GameKeysDemo />,
    },
    {
      label: '게임 중 그림판 (P11-13)',
      note: 'get_key() 게임이 도는 동안은 도구 줄(빠르기·바로 완성·모눈·저장)을 접고, 터치 화면은 머리 줄·안내 한 줄도 접어 360×740 폰 한 화면에 그림판과 방향 패드가 함께 들어가요. 게임이 끝나면 다시 펼쳐요',
      node: (
        <>
          <TurtleStage store={emptyStore} running={false} game />
          <GameKeysDemo />
        </>
      ),
    },
    {
      label: '게임 조종판 · 키를 못 받는 브라우저',
      note: 'JSPI도 SW도 없으면(iOS 26 이하 인앱) 버튼 대신 안내 한 줄',
      node: <GameKeysDemo none />,
    },
    {
      label: '명령 상한 (5만 개)',
      note: 'while True로 끝없이 그리면 TurtleLimitError로 멈춰요 — 실행기를 다시 띄우지 않고 그림은 남아요',
      node: (
        <StageDemo
          name="spiral"
          limit={400}
          result={{
            stdout: '',
            stderr: LIMIT_ERR,
            success: false,
            outcome: 'error',
            hadException: true,
            errorType: 'TurtleLimitError',
          }}
        />
      ),
    },
  ];
  return (
    <Section
      id="turtle-stage"
      kicker="퀘스트 (P11-02)"
      title="그림판 · 거북이 그리기 · 게임 조종판"
      description="turtle 코드의 결과(TurtleStage). 결과 쪽지와 같은 옅은 면 위 흰 도화지에 느릿이가 그려요. 빠르기(0.25배~8배·바로), 바로 완성, 좌표 모눈, PNG 저장. 낭독기는 그림 요약 한 문장을 읽어요. 견본은 녹화한 명령을 재생해요(갤러리와 같은 방식). get_key()를 쓰는 게임은 그림판 아래 조종판(P11-04)."
    >
      <Button
        onClick={() => setRound((r) => r + 1)}
        variant="secondary"
        size="sm"
        sfx={false}
        icon={<RotateCcw aria-hidden />}
        data-testid="turtle-stage-replay"
      >
        다시 그리기
      </Button>
      <div className="mt-4 grid items-start gap-4 md:grid-cols-2">
        {states.map((s) => (
          <Demo
            key={`${s.label}-${round}`}
            label={s.label}
            note={s.note}
            surface="card"
          >
            <div className="flex flex-col gap-3 [container-type:inline-size]">
              {s.node}
            </div>
          </Demo>
        ))}
      </div>
      <CodeSample
        code={`// 실행: liveRunOptions(store)가 turtle 청크도 저장소로 (usePyodide onTurtle)\n<OutputPanel result={runResult} isRunning={runner.isRunning} liveOutput={liveOutput}\n  turtle={usesTurtle(code)} />  // → <TurtleStage store running /> + (get_key() 실행 중) <GameKeys /> + 결과 쪽지\n// 갤러리 썸네일(P11-06): new TurtleCanvas(host).push(commands) → exportPNG({ width: 400, height: 400, fit: 'content' })`}
      />
    </Section>
  );
}
