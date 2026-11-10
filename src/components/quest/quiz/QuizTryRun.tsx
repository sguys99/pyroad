'use client';

import { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { track } from '@/lib/analytics/track';
import { useSfx } from '@/components/providers/SoundProvider';
import {
  usePyodideRuntime,
  type PyodideRuntime,
} from '@/lib/pyodide/PyodideProvider';
import { createLiveOutputStore } from '@/lib/pyodide/liveOutput';
import type { RunResult } from '@/lib/pyodide/usePyodide';
import type { QuizKind } from '@/lib/quest/questKind';
import { tryItPrompt } from '@/lib/quest/quizCode';
import { CodePanel } from '../CodePanel';
import '../questWorkspace.css';

export interface QuizTryRunProps {
  /** quizRunCode 로 조립한 코드 ("처음 코드로"가 돌아갈 곳) */
  code: string;
  kind: QuizKind;
}

type Runner = Pick<
  PyodideRuntime,
  'status' | 'restarting' | 'loadStage' | 'isRunning' | 'runCode' | 'stop'
> & { retry: () => void };

/**
 * "직접 실행해 보기" 실행 칸 (P7-07) 화면. 코드 퀘스트 공책과 같은 CodePanel(에디터·코드 키보드·실행 줄·결과 쪽지)을
 * 그대로 쓰고, 실행은 공용 Worker의 runCode 한 번 — 채점·보상·저장 없음(놀이). initial 은 카탈로그 진열용
 */
export function QuizTryRunView({
  code,
  kind,
  runtime,
  initial,
}: QuizTryRunProps & {
  runtime: Runner;
  initial?: { code?: string; result?: RunResult };
}) {
  const play = useSfx();
  const [draft, setDraft] = useState(initial?.code ?? code);
  const [result, setResult] = useState<RunResult | null>(
    initial?.result ?? null,
  );
  const [live] = useState(createLiveOutputStore);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const run = async () => {
    if (!draft.trim() || runtime.isRunning) return;
    play('run');
    // 학생 코드는 보내지 않음: 종류와 바꿔 봤는지만 (§2.6)
    track('quiz_try_run', { kind, edited: draft !== code });
    live.reset();
    const r = await runtime.runCode(draft, { onStdout: live.append });
    if (alive.current) setResult(r);
  };

  return (
    <section
      className="qz-try"
      aria-label="직접 실행해 보기"
      data-testid="quiz-try"
    >
      <p className="qz-try-dare" data-testid="quiz-try-dare">
        <Sparkles aria-hidden />
        {tryItPrompt(code)}
      </p>
      <p className="qz-try-note">
        바꿔서 돌려도 별과 경험치는 그대로예요. 마음껏 놀아 봐요!
      </p>
      <CodePanel
        code={draft}
        onCodeChange={setDraft}
        starterCode={code}
        pyodideStatus={runtime.status}
        restarting={runtime.restarting}
        loadStage={runtime.loadStage}
        isRunning={runtime.isRunning}
        onRun={run}
        onStop={runtime.stop}
        onRetry={runtime.retry}
        runResult={result}
        liveOutput={live}
        isCodeEmpty={!draft.trim()}
      />
    </section>
  );
}

/** 공용 Worker를 이때 처음 띄운다 (PyodideProvider 는 lazy — 퀴즈 화면은 이 칸을 열기 전엔 Pyodide를 받지 않음) */
export default function QuizTryRun(props: QuizTryRunProps) {
  const runtime = usePyodideRuntime();
  const { start } = runtime;
  useEffect(() => start(), [start]);
  return <QuizTryRunView {...props} runtime={runtime} />;
}
