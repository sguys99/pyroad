'use client';

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  Check,
  CornerDownLeft,
  Flag,
  Hand,
  Hourglass,
  Loader2,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RunResult } from '@/lib/pyodide/usePyodide';
import type { LiveOutputStore } from '@/lib/pyodide/liveOutput';
import type { ValidationType } from '@/lib/quest/validation';
import { errorLineFromStderr } from '@/lib/editor/errorLine';
import { DURATION } from '@/lib/motion/tokens';
import { BugbugAside, BugbugMakeup } from './BugbugAside';
import {
  POP_LINES,
  errorSummary,
  mismatchTip,
  outputLines,
} from './outputSlip';
import './outputPanel.css';

const NO_LIVE_OUTPUT = { text: '', clipped: false };
const subscribeNothing = () => () => {};
const getNoLiveOutput = () => NO_LIVE_OUTPUT;

/**
 * 나온 글자 줄들. 줄마다 쪽지 카드가 튀어나온다(앞 POP_LINES줄만, 연출 단계는 outputPanel.css).
 * 실행 중(store)과 끝난 뒤(text)를 같은 자리에서 그려서, 실시간으로 이미 나온 줄은 결과가 와도 다시 튀지 않는다.
 * 실행 중에는 이 컴포넌트만 출력 조각마다 다시 그린다 (셸은 그대로)
 */
function OutputLines({
  store,
  text,
}: {
  store?: LiveOutputStore;
  text: string;
}) {
  const live = useSyncExternalStore(
    store?.subscribe ?? subscribeNothing,
    store?.getSnapshot ?? getNoLiveOutput,
    getNoLiveOutput,
  );
  const shown = store ? live.text : text;
  const listRef = useRef<HTMLOListElement>(null);

  // 실행 중 새 출력이 오면 맨 아래로 (긴 반복문 출력도 마지막 줄이 보이게)
  useEffect(() => {
    const list = listRef.current;
    if (store && list) list.scrollTop = list.scrollHeight;
  }, [store, shown]);

  const lines = outputLines(shown);
  if (!lines.length)
    return store ? (
      <p className="qo-empty">주문을 돌리는 중이에요. 글자를 기다려요…</p>
    ) : null;
  return (
    <>
      <ol
        ref={listRef}
        data-testid={store ? 'live-output' : undefined}
        className="qo-lines"
      >
        {lines.map((line, i) => (
          <li
            // 줄 번호가 곧 자리: 새 줄만 새로 그려져 앞줄 연출이 다시 돌지 않는다
            key={i}
            className={cn('qo-line font-mono', i < POP_LINES && 'qo-pop')}
            style={{ '--i': i } as CSSProperties}
          >
            {line || ' '}
          </li>
        ))}
      </ol>
      {store && live.clipped && (
        <p className="qo-note">출력이 너무 많아서 앞부분만 보여 줘요.</p>
      )}
    </>
  );
}

type Tone = 'idle' | 'live' | 'good' | 'diff' | 'bug' | 'calm';

interface SlipProps {
  state: string;
  tone: Tone;
  verdict?: 'pass' | 'diff';
  chip?: ReactNode;
  /** 나온 글자 (끝난 뒤) */
  text?: string;
  /** 실행 중 실시간 출력 */
  store?: LiveOutputStore;
  children?: ReactNode;
  /** 쪽지 아래 붙는 것 (견줘 보기·오류 자리) */
  after?: ReactNode;
}

/** "나온 글자" 쪽지 (최종 시안 ResultSlip `.f-slip`): 테두리 없는 옅은 면 + 머리 한 줄(이름 · 상태 딱지) */
function Slip({
  state,
  tone,
  verdict,
  chip,
  text = '',
  store,
  children,
  after,
}: SlipProps) {
  return (
    <section
      data-testid="output-panel"
      data-state={state}
      data-verdict={verdict}
      className="qo"
      aria-label="나온 글자"
    >
      <div className="qo-slip" data-tone={tone} aria-live="polite">
        <div className="qo-head">
          <span className="qo-k">
            <Flag aria-hidden />
            나온 글자
          </span>
          {chip}
        </div>
        <OutputLines store={store} text={text} />
        {children}
      </div>
      {after}
    </section>
  );
}

function Chip({
  tone,
  icon,
  children,
}: {
  tone: Tone;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <span className="qo-chip" data-tone={tone}>
      {icon}
      {children}
    </span>
  );
}

/** 고친 뒤 화해 인사를 보여 주는 시간 (CSS qo-bye = --dur-celebrate × 2.5와 같게) */
const FIX_BYE_MS = DURATION.celebrate * 2.5;

/**
 * 직전 결과가 오류였고 이번 실행은 끝까지 돌았으면 잠깐 true ("버그를 고쳤어요" 화해 인사).
 * 실행 중에도 이전 결과가 그대로라 실행 결과가 바뀐 순간만 본다
 */
function useBugFixed(result: RunResult | null): boolean {
  const [seen, setSeen] = useState(result);
  const [fixed, setFixed] = useState(false);
  if (result !== seen) {
    setSeen(result);
    setFixed(!!seen?.hadException && !!result?.success);
  }
  useEffect(() => {
    if (!fixed) return;
    const t = setTimeout(() => setFixed(false), FIX_BYE_MS);
    return () => clearTimeout(t);
  }, [fixed]);
  return fixed;
}

export interface OutputPanelProps {
  result: RunResult | null;
  isRunning: boolean;
  /** 채점 결과. type은 공개 규칙 유형(무엇을 견줘 볼지 안내에만 씀) */
  validationResult?: { passed: boolean; type?: ValidationType } | null;
  /** 실행 중 stdout (P1-09). 없으면 실행 중 표시만 */
  liveOutput?: LiveOutputStore;
  /** 공개된 "나와야 하는 모습" 안내 (코드 퀘스트 expected_output_hint · 프로젝트 단계 목표). 출력이 다를 때 견줘 보기에 */
  goal?: string;
  /** 오류 줄로 가기 (모바일은 공책 쪽으로 넘김) */
  onShowErrorLine?: (line: number) => void;
  /** 결과 쪽 안에서 Worker를 다시 띄우는 중 (모바일 결과 쪽: 따로 쌓인 상자 대신 쪽지 아래 한 줄) */
  restarting?: boolean;
}

/**
 * 결과 쪽지 (P6-06, 최종 시안 ResultSlip "나온 글자"):
 * 아직 안 돌림 · 실행 중 실시간 출력 · 통과 · 출력이 다름(공개 안내와 견줘 보기) · 오류(줄로 가기) · 시간 초과 · 멈춤 · 출력 상한.
 * 출력 줄은 쪽지 카드로 튀어나온다(full 스프링 차례로 · lite 짧게 · minimal·동작 줄이기 없음).
 * 정답 기준값은 서버 전용이라(§2.3) 줄 단위 비교는 하지 않고 공개 안내 + 규칙 유형별 살펴볼 거리만 보여 준다
 */
export function OutputPanel({
  result,
  isRunning,
  validationResult,
  liveOutput,
  goal,
  onShowErrorLine,
  restarting = false,
}: OutputPanelProps) {
  const bugFixed = useBugFixed(result);
  if (isRunning) {
    return (
      <Slip
        state="running"
        tone="live"
        chip={
          <Chip
            tone="live"
            icon={
              <Loader2
                aria-hidden
                className="animate-spin reduced:animate-none"
              />
            }
          >
            돌아가는 중
          </Chip>
        }
        store={liveOutput}
      />
    );
  }

  if (!result) {
    return (
      <Slip state="empty" tone="idle">
        <p className="qo-empty">
          아직 돌려 보지 않았어요. 주문을 쓰고 “코드 돌려보기”를 눌러요!
        </p>
      </Slip>
    );
  }

  const wakingNote = restarting && (
    <p role="status" className="qo-waking" data-testid="runner-waking-inline">
      <Loader2 aria-hidden className="animate-spin reduced:animate-none" />
      파이뱀이 공책을 다시 펼치는 중이에요. 몇 초면 다시 돌릴 수 있어요.
    </p>
  );

  // 시간 초과·멈춤·출력 상한: 멈추기 전까지 나온 글자 + 차분한 안내
  if (
    result.isTimeout ||
    result.isStopped ||
    result.outcome === 'output-limit'
  ) {
    const [state, title, note, icon] = result.isTimeout
      ? [
          'timeout',
          '앗, 시간이 너무 오래 걸려요!',
          '혹시 무한 반복이 있는지 살펴볼까요? while 반복문이라면 조건이 언젠가 거짓(False)이 되는지 확인해 봐요.',
          <Hourglass key="i" aria-hidden />,
        ]
      : result.isStopped
        ? [
            'stopped',
            '실행을 멈췄어요',
            '코드를 살펴보고 준비되면 다시 돌려 봐요!',
            <Hand key="i" aria-hidden />,
          ]
        : [
            'output-limit',
            '앗, 출력이 너무 많아요!',
            '그래서 중간에 멈췄어요. 끝없이 반복되는 print가 있는지 살펴볼까요?',
            <Hourglass key="i" aria-hidden />,
          ];
    return (
      <Slip
        state={state}
        text={result.stdout}
        tone="calm"
        chip={
          <Chip tone="calm" icon={icon}>
            {title}
          </Chip>
        }
      >
        <p className="qo-note">{note}</p>
        {wakingNote}
      </Slip>
    );
  }

  // 오류: 나온 글자까지 + 마지막 한 줄 요약(몇 번째 줄 · 종류) + 전체 메시지는 접어 둠
  if (!result.success) {
    const line = errorLineFromStderr(result.stderr);
    const summary = errorSummary(result.stderr);
    return (
      <Slip
        state="error"
        text={result.stdout}
        tone="bug"
        chip={
          <Chip tone="bug" icon={<Search aria-hidden />}>
            여기를 한번 살펴볼까요?
          </Chip>
        }
        after={<BugbugAside stderr={result.stderr} />}
      >
        <div className="qo-err" data-testid="output-error">
          {line && <span className="qo-err-line">{line}번째 줄</span>}
          {summary && <code className="qo-err-msg font-mono">{summary}</code>}
        </div>
        <div className="qo-err-actions">
          {line && onShowErrorLine && (
            <button
              type="button"
              className="qo-link"
              onClick={() => onShowErrorLine(line)}
              data-testid="show-error-line"
            >
              <CornerDownLeft aria-hidden />
              {line}번째 줄 보러 가기
            </button>
          )}
          {result.stderr.trim() !== summary && (
            <details className="qo-more">
              <summary>오류 메시지 전체 보기</summary>
              <pre className="font-mono">{result.stderr}</pre>
            </details>
          )}
        </div>
      </Slip>
    );
  }

  // 돌아감: 통과 / 출력이 다름 / (채점 전)
  const passed = validationResult?.passed;
  const diff = validationResult && !validationResult.passed;
  return (
    <Slip
      state="success"
      text={result.stdout}
      tone={passed ? 'good' : diff ? 'diff' : 'idle'}
      verdict={passed ? 'pass' : diff ? 'diff' : undefined}
      chip={
        passed ? (
          <Chip tone="good" icon={<Check aria-hidden />}>
            통과! 정답이에요!
          </Chip>
        ) : diff ? (
          <Chip tone="diff">조금 달라요</Chip>
        ) : null
      }
      after={
        <>
          {bugFixed && <BugbugMakeup />}
          {diff && (
            <div className="qo-compare" data-testid="output-compare">
              {goal && (
                <div className="qo-goal">
                  <span className="qo-k">해 볼 일에서 나와야 하는 모습</span>
                  <p>{goal}</p>
                </div>
              )}
              <p className="qo-tip">
                {mismatchTip(validationResult.type, result.stdout)}
              </p>
            </div>
          )}
        </>
      }
    >
      {!outputLines(result.stdout).length && (
        <p className="qo-empty">(아무것도 나오지 않았어요)</p>
      )}
    </Slip>
  );
}
