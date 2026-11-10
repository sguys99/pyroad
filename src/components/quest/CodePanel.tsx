'use client';

import { useRef, useState, useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';
import { NotebookPen, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CodeEditor, type CodeEditorHandle } from './CodeEditor';
import { errorLineFromStderr } from '@/lib/editor/stderrLine';
import { OutputPanel, type OutputPanelProps } from './OutputPanel';
import type {
  PyodideRestartReason,
  PyodideStatus,
  RunResult,
} from '@/lib/pyodide/usePyodide';
import type { LiveOutputStore } from '@/lib/pyodide/liveOutput';
import type { PyodideLoadStage } from '@/lib/pyodide/types';
import { RunControls } from './RunControls';

/** 공책 머리 제목 (P6-03) */
export function NotebookTitle() {
  return (
    <h2 className="qw-notebook-t font-display">
      <NotebookPen aria-hidden />
      나의 주문 공책
    </h2>
  );
}

// 코드 키보드(P6-04)는 좁은 화면(lg 미만)이나 터치 화면에서만 받는다 — 넓은 화면 + 마우스는 첫 로드 JS +0.
// 자리(.ck-slot 높이)는 같은 조건의 CSS가 미리 잡아 불러온 뒤 실행 버튼이 밀리지 않는다 (questWorkspace.css)
const KEYBOARD_QUERY = '(max-width: 63.99rem), (pointer: coarse)';
const CodeKeyboard = dynamic(() => import('./CodeKeyboard'), { ssr: false });

// matchMedia가 없는 환경(jsdom)은 넓은 화면으로 본다
function subscribeKeyboardQuery(onChange: () => void) {
  const mq = window.matchMedia?.(KEYBOARD_QUERY);
  mq?.addEventListener('change', onChange);
  return () => mq?.removeEventListener('change', onChange);
}

const ResetCodeDialog = dynamic(() => import('./ResetCodeDialog'), {
  ssr: false,
});

/**
 * "처음 코드로" (P6-03, 시안 NotebookPage 머리). 지금 코드가 시작 코드와 같으면 꺼 두고,
 * 다르면 고친 코드가 사라지므로 한 번 묻는다. 좁은 쪽(24rem 미만)에서는 글자를 숨기고 아이콘만 (questWorkspace.css)
 */
export function ResetCodeButton({
  changed,
  onReset,
}: {
  changed: boolean;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  // 한 번 열면 계속 붙여 둔다 (닫히는 연출·포커스 돌려주기)
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        icon={<RotateCcw aria-hidden />}
        disabled={!changed}
        aria-label="처음 코드로"
        aria-haspopup="dialog"
        className="qw-reset"
        data-testid="reset-code"
        onClick={() => {
          setLoaded(true);
          setOpen(true);
        }}
      >
        <span className="qw-reset-label">처음 코드로</span>
      </Button>
      {loaded && (
        <ResetCodeDialog open={open} onOpenChange={setOpen} onReset={onReset} />
      )}
    </>
  );
}

interface CodePanelProps {
  /** 에디터 코드. 황금키 정답·다음 단계 코드처럼 바깥에서 바꾸면 에디터에도 반영됨 */
  code: string;
  onCodeChange: (code: string) => void;
  /** "처음 코드로"가 돌아갈 코드. 주면 공책 머리에 제목과 버튼을 그린다 */
  starterCode?: string;
  pyodideStatus: PyodideStatus;
  /** Worker를 다시 띄우는 중이면 그 이유 (재준비 연출) */
  restarting?: PyodideRestartReason;
  /** 처음 준비 단계 (준비 연출의 단계 칸) */
  loadStage?: PyodideLoadStage | null;
  isRunning: boolean;
  /** 채점·완료 요청 중 (B06: 이 동안 실행 버튼을 다시 누를 수 없음) */
  isSubmitting?: boolean;
  /** 프로젝트 단계 통과 박자 중 (실행 버튼이 "정답 확인 중"에 머물지 않게, P6-16) */
  stepping?: boolean;
  onRun: () => void;
  /** 실행 멈추기 (실행 중에만 버튼이 보임) */
  onStop?: () => void;
  onRetry: () => void;
  runResult: RunResult | null;
  /** 실행 중 stdout */
  liveOutput?: LiveOutputStore;
  isCodeEmpty: boolean;
  validationResult?: OutputPanelProps['validationResult'];
  /** 퀘스트를 마쳤을 때 결과 쪽지 아래 성공 장면·다음 퀘스트 (P6-08) */
  reward?: OutputPanelProps['reward'];
  /** 결과 쪽지 견줘 보기에 쓰는 공개 안내 (P6-06) */
  goal?: string;
  /** 결과 쪽지의 "N번째 줄 보러 가기" */
  onShowErrorLine?: (line: number) => void;
  /** 결과 쪽지 "파이뱀에게 더 물어보기" (Q56) */
  onAskTutor?: () => void;
  /** 스테이지 차례 (코드 키보드가 그 스테이지 주문을 앞으로, P6-11) */
  stage?: number;
}

export function CodePanel({
  code,
  onCodeChange,
  starterCode,
  pyodideStatus,
  restarting = null,
  loadStage = null,
  isRunning,
  isSubmitting = false,
  stepping = false,
  onRun,
  onStop,
  onRetry,
  runResult,
  liveOutput,
  isCodeEmpty,
  validationResult,
  reward,
  goal,
  onShowErrorLine,
  onAskTutor,
  stage,
}: CodePanelProps) {
  const editorRef = useRef<CodeEditorHandle>(null);
  const showKeyboard = useSyncExternalStore(
    subscribeKeyboardQuery,
    () => window.matchMedia?.(KEYBOARD_QUERY).matches ?? false,
    () => false,
  );

  return (
    // 공책 → 실행 줄 → 결과 간격은 시안 f-run-row·f-result (16px)
    <div className="flex flex-col gap-4">
      {/* 에디터 (오류가 난 줄은 traceback에서 찾아 표시, P2-18) */}
      <CodeEditor
        value={code}
        onChange={onCodeChange}
        ref={editorRef}
        title={starterCode !== undefined && <NotebookTitle />}
        actions={
          starterCode !== undefined && (
            <ResetCodeButton
              changed={code !== starterCode}
              onReset={() => onCodeChange(starterCode)}
            />
          )
        }
        errorLine={
          runResult?.hadException ? errorLineFromStderr(runResult.stderr) : null
        }
      />
      <div className="ck-slot">
        {showKeyboard && <CodeKeyboard editor={editorRef} stage={stage} />}
      </div>

      {/* 실행 버튼 + 준비·재준비·오류 안내 (P6-05) */}
      <RunControls
        status={pyodideStatus}
        restarting={restarting}
        loadStage={loadStage}
        isRunning={isRunning}
        isSubmitting={isSubmitting}
        stepping={stepping}
        isCodeEmpty={isCodeEmpty}
        onRun={onRun}
        onStop={onStop}
        onRetry={onRetry}
      />

      {/* 실행 결과 */}
      <OutputPanel
        result={runResult}
        isRunning={isRunning}
        validationResult={validationResult}
        liveOutput={liveOutput}
        goal={goal}
        onShowErrorLine={onShowErrorLine}
        reward={reward}
        onAskTutor={onAskTutor}
      />
    </div>
  );
}
