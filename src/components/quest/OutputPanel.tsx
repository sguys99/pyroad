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
  Keyboard,
  Loader2,
  MessageCircleQuestion,
  MessageCircleMore,
  PencilLine,
  RefreshCw,
  Search,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { PyodideRestartReason, RunResult } from '@/lib/pyodide/usePyodide';
import type {
  LiveOutputSnapshot,
  LiveOutputStore,
} from '@/lib/pyodide/liveOutput';
import { INPUT_UNAVAILABLE_ERROR, type RunInput } from '@/lib/pyodide/types';
import type { ValidationType } from '@/lib/quest/validation';
import { errorLineFromStderr } from '@/lib/editor/stderrLine';
import { DURATION } from '@/lib/motion/tokens';
import { BugbugAside, BugbugMakeup } from './BugbugAside';
import {
  PassStamp,
  RewardStrip,
  useSuccessRun,
  type QuestReward,
} from './QuestSuccess';
import {
  POP_LINES,
  compareLines,
  errorSummary,
  mismatchTip,
  outputLines,
  transcriptRows,
} from './outputSlip';
import { InputReply } from './InputReply';
import { TestGuests } from './TestGuests';
import type { GuestRun } from '@/lib/quest/testGuests';
import { RunnerWakingNotice } from './RunControls';
import './outputPanel.css';

// 그림판 (P11-02): turtle을 쓰는 코드에서만 받는다 (렌더러 chunk는 첫 로드 JS 밖)
const TurtleStage = dynamic(() => import('./TurtleStage'), { ssr: false });
// 게임 조종판 (P11-04): get_key()를 부르는 실행에서만 받는다
const GameKeys = dynamic(() => import('./GameKeys'), { ssr: false });

const NO_LIVE_OUTPUT: LiveOutputSnapshot = {
  text: '',
  clipped: false,
  inputs: [],
  waiting: false,
  drawing: false,
  keys: null,
};
const subscribeNothing = () => () => {};
const getNoLiveOutput = () => NO_LIVE_OUTPUT;

/** 실행 중 출력 저장소 구독 (store가 없으면 빈 값) */
function useLive(store?: LiveOutputStore): LiveOutputSnapshot {
  return useSyncExternalStore(
    store?.subscribe ?? subscribeNothing,
    store?.getSnapshot ?? getNoLiveOutput,
    getNoLiveOutput,
  );
}

/**
 * 나온 글자 줄들. 줄마다 쪽지 카드가 튀어나온다(앞 POP_LINES줄만, 연출 단계는 outputPanel.css).
 * input()에 답한 말은 프롬프트 줄 바로 뒤에 내 말풍선으로 끼운다 (P11-01, 대화처럼).
 * 실행 중(store)과 끝난 뒤(text)를 같은 자리에서 그려서, 실시간으로 이미 나온 줄은 결과가 와도 다시 튀지 않는다.
 * 실행 중에는 이 컴포넌트만 출력 조각마다 다시 그린다 (셸은 그대로)
 */
function OutputLines({
  store,
  text,
  inputs,
}: {
  store?: LiveOutputStore;
  text: string;
  inputs?: readonly RunInput[];
}) {
  const live = useLive(store);
  const shown = store ? live.text : text;
  const answers = store ? live.inputs : inputs;
  const listRef = useRef<HTMLOListElement>(null);

  // 실행 중 새 출력이 오면 맨 아래로 (긴 반복문 출력도 마지막 줄이 보이게)
  useEffect(() => {
    const list = listRef.current;
    if (store && list) list.scrollTop = list.scrollHeight;
  }, [store, shown, answers]);

  const rows = transcriptRows(shown, answers);
  if (!rows.length)
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
        {rows.map((row, i) =>
          row.answer ? (
            <li
              // 줄 번호가 곧 자리: 새 줄만 새로 그려져 앞줄 연출이 다시 돌지 않는다
              key={i}
              className={cn('qo-answer', i < POP_LINES && 'qo-pop')}
              style={{ '--i': i } as CSSProperties}
              data-testid="output-answer"
            >
              <span className="sr-only">내 대답: </span>
              <span className="qo-answer-bubble">{row.text || ' '}</span>
            </li>
          ) : (
            <li
              key={i}
              className={cn('qo-line font-mono', i < POP_LINES && 'qo-pop')}
              style={{ '--i': i } as CSSProperties}
            >
              {row.text || ' '}
            </li>
          ),
        )}
      </ol>
      {store && live.clipped && (
        <p className="qo-note">출력이 너무 많아서 앞부분만 보여 줘요.</p>
      )}
    </>
  );
}

type Tone = 'idle' | 'live' | 'ask' | 'good' | 'diff' | 'bug' | 'calm';

interface SlipProps {
  state: string;
  tone: Tone;
  verdict?: 'pass' | 'diff';
  chip?: ReactNode;
  /** 나온 글자 (끝난 뒤) */
  text?: string;
  /** input()에 답한 말 (끝난 뒤, P11-01) */
  inputs?: readonly RunInput[];
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
  inputs,
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
        <OutputLines store={store} text={text} inputs={inputs} />
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

/** 실행 중 딱지: input()이 기다리면 "대답을 기다려요" (P11-01). 저장소를 스스로 구독해 쪽지는 다시 그리지 않는다 */
function LiveChip({ store }: { store?: LiveOutputStore }) {
  const live = useLive(store);
  return live.waiting ? (
    <Chip tone="ask" icon={<MessageCircleMore aria-hidden />}>
      대답을 기다려요
    </Chip>
  ) : (
    <Chip
      tone="live"
      icon={
        <Loader2 aria-hidden className="animate-spin reduced:animate-none" />
      }
    >
      돌아가는 중
    </Chip>
  );
}

/**
 * 실행 중 대화 입력줄 (P11-01). 한 번 물어본 실행은 끝날 때까지 칸을 남겨 둔다
 * (다음 질문 사이에 칸이 사라졌다 나타나며 휴대폰 키보드가 닫히지 않게)
 */
function LiveReply({
  store,
  autoFocus,
}: {
  store?: LiveOutputStore;
  autoFocus: boolean;
}) {
  const live = useLive(store);
  if (!store || (!live.waiting && live.inputs.length === 0)) return null;
  return (
    <InputReply
      waiting={live.waiting}
      onAnswer={store.answer}
      onStop={store.stopInput}
      autoFocus={autoFocus}
    />
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
  /**
   * 공개 예시 출력 (P7-17, 코드 퀘스트 · 프로젝트 지금 단계의 example_output). 출력이 다를 때 견줘 보기에.
   * compare: 결과가 정해진 퀘스트(output_match)면 줄 단위로 견줌, 아니면(무작위·포함 검사) 예시만 보여 줌
   */
  example?: { text: string; compare: boolean };
  /** 오류 줄로 가기 (모바일은 공책 쪽으로 넘김) */
  onShowErrorLine?: (line: number) => void;
  /** Worker를 다시 띄우는 중이면 그 이유 (P11-03 재준비 연출을 쪽지 안에). 준비 중이 아니면 null */
  restarting?: PyodideRestartReason;
  /** 퀘스트를 마쳤으면(완료 응답 뒤) 성공 장면: 도장 쾅 + 보상 띠 + 다음 퀘스트 (P6-08) */
  reward?: QuestReward | null;
  /** 오류·출력이 다를 때 "파이뱀에게 더 물어보기" (Q56: AI 피드백은 자동으로 부르지 않고 이 버튼으로만) */
  onAskTutor?: () => void;
  /** input()이 물으면 입력 칸으로 포커스 (기본 true, 카탈로그 견본만 끔) */
  inputAutoFocus?: boolean;
  /**
   * 코드가 turtle을 불러 씀 (P11-02, `usesTurtle(code)`): 실행 전에도 그림판을 펼쳐 둔다.
   * 없어도 실행이 무언가 그리면(liveOutput.drawing) 그림판이 나온다
   */
  turtle?: boolean;
  /** 시험 손님 대화 (P11-05). 손님 채점을 했으면 손님마다 카드, 결과 쪽지는 판정만 */
  guests?: readonly GuestRun[] | null;
  /** 떨어진 그림 규칙의 이유 (서버 채점 문장, P11-05) */
  reasons?: readonly string[];
  /** 손님이 있는 퀘스트: 직접 실행 뒤 "시험 손님 부르기"로 채점하라고 안내 (P11-05) */
  guestHint?: boolean;
}

/** 이번 실행이 그렸는지만 구독 (글자 조각마다 다시 그리지 않음) */
function useDrawing(store?: LiveOutputStore): boolean {
  return useSyncExternalStore(
    store?.subscribe ?? subscribeNothing,
    () => store?.getSnapshot().drawing ?? false,
    () => false,
  );
}

/** 이번 실행이 get_key()로 키를 듣는지만 구독 (P11-04) */
function useListening(store?: LiveOutputStore): boolean {
  return useSyncExternalStore(
    store?.subscribe ?? subscribeNothing,
    () => (store?.getSnapshot().keys ?? null) !== null,
    () => false,
  );
}

/**
 * 실행 결과 자리: turtle 그림판(P11-02, 그릴 때만) + 게임 조종판(P11-04, get_key()를 부르는 실행 중) + 결과 쪽지.
 * 그림판은 쪽지 위에 두고 쪽지 상태가 바뀌어도 같은 자리에 남아(다시 만들지 않음) 빠르기·모눈 설정과 그린 그림이 유지된다
 */
export function OutputPanel(props: OutputPanelProps) {
  const drawing = useDrawing(props.liveOutput);
  const listening = useListening(props.liveOutput) && props.isRunning;
  const stage = (props.turtle || drawing) && (
    <TurtleStage
      store={props.liveOutput}
      running={props.isRunning}
      game={listening}
    />
  );
  return (
    <>
      {stage}
      {listening && <GameKeys store={props.liveOutput} running />}
      {props.guests && (
        <TestGuests
          guests={props.guests}
          running={props.guests.some(
            (g) => g.state === 'running' || g.state === 'waiting',
          )}
        />
      )}
      <ResultSlip {...props} quietEmpty={!!stage} />
    </>
  );
}

/**
 * 예시 출력과 견줘 보기 (P7-17). 줄 비교면 같은 줄은 ✓, 다른 줄은 연필 표시 + "내 글자"를 바로 아래에
 * (색만으로 알리지 않고 아이콘·글자 병행). 무작위·포함 검사 퀘스트는 "예시"라고 밝히고 줄 비교 없이 보여 줌
 */
function ExampleCompare({
  example,
  stdout,
}: {
  example: { text: string; compare: boolean };
  stdout: string;
}) {
  if (!example.compare)
    return (
      <div className="qo-goal" data-testid="output-example">
        <span className="qo-k">이런 모양이면 돼요 · 예시</span>
        <ol className="qo-cmp">
          {outputLines(example.text.trim()).map((line, i) => (
            <li key={i} className="qo-cmp-row">
              <span className="qo-cmp-text font-mono">{line || ' '}</span>
            </li>
          ))}
        </ol>
        <p className="qo-tip">
          예시일 뿐이라 숫자나 말이 조금 달라도 괜찮아요.
        </p>
      </div>
    );
  const rows = compareLines(example.text, stdout);
  const same = rows.filter((row) => row.same).length;
  return (
    <div className="qo-goal" data-testid="output-example" data-compare>
      <span className="qo-k">
        이런 모양이면 돼요 · {rows.length}줄 중 {same}줄 같아요
      </span>
      <ol className="qo-cmp">
        {rows.map((row, i) => (
          <li key={i} className="qo-cmp-row" data-same={row.same || undefined}>
            <span className="qo-cmp-mark" aria-hidden>
              {row.same ? <Check strokeWidth={3} /> : <PencilLine />}
            </span>
            <span className="qo-cmp-body">
              <span className="qo-cmp-text font-mono">
                {row.example ?? (
                  <span className="qo-cmp-none font-sans">
                    (예시에는 없는 줄)
                  </span>
                )}
              </span>
              <span className="sr-only">
                {row.same ? ' (같아요)' : ' (달라요) '}
              </span>
              {!row.same && (
                <span className="qo-cmp-mine">
                  내 글자{' '}
                  {row.actual === null ? (
                    <span className="qo-cmp-none font-sans">(안 나왔어요)</span>
                  ) : (
                    <span className="font-mono">{row.actual || ' '}</span>
                  )}
                </span>
              )}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function AskMore({ onAsk }: { onAsk: () => void }) {
  return (
    <Button
      variant="secondary"
      size="sm"
      icon={<MessageCircleQuestion aria-hidden />}
      onClick={onAsk}
      className="qo-ask"
      data-testid="ask-more"
    >
      파이뱀에게 더 물어보기
    </Button>
  );
}

/**
 * 결과 쪽지 (P6-06, 최종 시안 ResultSlip "나온 글자"):
 * 아직 안 돌림 · 실행 중 실시간 출력 · 통과 · 출력이 다름(공개 안내와 견줘 보기) · 오류(줄로 가기) · 시간 초과 · 멈춤 · 출력 상한.
 * 출력 줄은 쪽지 카드로 튀어나온다(full 스프링 차례로 · lite 짧게 · minimal·동작 줄이기 없음).
 * 정답 기준값은 서버 전용이라(§2.3) 공개 예시 출력(P7-17)과 견줘 보고 규칙 유형별 살펴볼 거리를 보여 준다
 */
function ResultSlip({
  result,
  isRunning,
  validationResult,
  liveOutput,
  example,
  onShowErrorLine,
  restarting = null,
  reward = null,
  onAskTutor,
  inputAutoFocus = true,
  quietEmpty = false,
  guests = null,
  reasons = [],
  guestHint = false,
}: OutputPanelProps & {
  /** 그림판이 있으면 "아무것도 나오지 않았어요"를 줄인다 (그림이 결과라서) */
  quietEmpty?: boolean;
}) {
  const bugFixed = useBugFixed(result);
  const passed = !isRunning && !!result?.success && !!validationResult?.passed;
  const success = passed && !!reward;
  const successDone = useSuccessRun(success, result);
  // 손님과 손님 사이(잠깐 실행이 없음)에도 실행 중 쪽지 그대로
  const guestsBusy = !!guests?.some(
    (g) => g.state === 'running' || g.state === 'waiting',
  );
  if (isRunning || guestsBusy) {
    return (
      <Slip
        state="running"
        tone="live"
        chip={<LiveChip store={liveOutput} />}
        store={liveOutput}
      >
        {guests ? (
          <p className="qo-note">시험 손님이 내 프로그램을 써 보고 있어요.</p>
        ) : (
          <LiveReply store={liveOutput} autoFocus={inputAutoFocus} />
        )}
      </Slip>
    );
  }

  const wakingNote = restarting && <RunnerWakingNotice reason={restarting} />;

  if (!result) {
    return (
      <Slip state="empty" tone="idle">
        {wakingNote || (
          <p className="qo-empty">
            아직 돌려 보지 않았어요. 주문을 쓰고 “코드 돌려보기”를 눌러요!
          </p>
        )}
      </Slip>
    );
  }

  // 시간 초과·멈춤·출력 상한: 멈추기 전까지 나온 글자 + 차분한 안내
  if (
    result.isTimeout ||
    result.isStopped ||
    result.outcome === 'output-limit'
  ) {
    const [state, title, note, icon] = result.wallLimit
      ? [
          'timeout',
          '3분이 지나서 멈췄어요',
          '끝나지 않는 게임 반복이 있나 봐요. for frame in range(900): 처럼 몇 번 돌지 정해 두면 30초 뒤에 끝나요.',
          <Hourglass key="i" aria-hidden />,
        ]
      : result.isTimeout
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
        inputs={result.inputs}
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

  // input()을 받을 길이 없는 기기 (JSPI·SW 모두 없음, §12-Q74): 버그가 아니라 브라우저 탓이라 차분하게 + 새로고침·Safari 안내
  if (result.errorType === INPUT_UNAVAILABLE_ERROR) {
    return (
      <Slip
        state="input-unavailable"
        text={result.stdout}
        tone="calm"
        chip={
          <Chip tone="calm" icon={<Keyboard aria-hidden />}>
            대답을 받을 수 없어요
          </Chip>
        }
      >
        <div className="qo-noinput" data-testid="input-unavailable">
          <p className="qo-note">
            이 브라우저에서는 <code className="font-mono">input()</code>으로
            대답을 받을 수 없어요. 새로고침해 보고, 그래도 안 되면 Safari나
            Chrome으로 열어 주세요.
          </p>
          <p className="qo-tip">
            카카오톡 같은 앱 안에서 열었다면 메뉴(⋯)에서 “Safari로 열기”를
            눌러요. input() 없는 코드는 여기서도 돌릴 수 있어요.
          </p>
          <Button
            variant="secondary"
            size="sm"
            sfx={false}
            icon={<RefreshCw aria-hidden />}
            onClick={() => window.location.reload()}
            className="qo-ask"
          >
            새로고침
          </Button>
        </div>
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
        inputs={result.inputs}
        tone="bug"
        chip={
          <Chip tone="bug" icon={<Search aria-hidden />}>
            여기를 한번 살펴볼까요?
          </Chip>
        }
        after={
          <BugbugAside
            stderr={result.stderr}
            action={onAskTutor && <AskMore onAsk={onAskTutor} />}
          />
        }
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
  const diff = validationResult && !validationResult.passed;
  return (
    <Slip
      state="success"
      // 손님 채점이면 글자는 손님 카드에 (같은 대화를 두 번 보이지 않게)
      text={guests ? '' : result.stdout}
      inputs={guests ? undefined : result.inputs}
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
          {/* 보상 띠가 쪽지 바로 아래 (도장이 띠의 빈 모서리로 걸침), 고친 뒤 화해 인사는 그 아래 */}
          {success && reward && (
            <RewardStrip reward={reward} done={successDone} />
          )}
          {bugFixed && <BugbugMakeup />}
          {diff && (
            <div className="qo-compare" data-testid="output-compare">
              {example && !guests && (
                <ExampleCompare example={example} stdout={result.stdout} />
              )}
              {reasons.length > 0 && (
                <ul className="qo-reasons" data-testid="grade-reasons">
                  {reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              )}
              <p className="qo-tip">
                {guests
                  ? '“조금 달라요” 손님의 대화를 살펴봐요. 손님이 넣은 대답에 맞는 말이 나왔나요?'
                  : mismatchTip(validationResult.type, result.stdout)}
              </p>
              {onAskTutor && <AskMore onAsk={onAskTutor} />}
            </div>
          )}
        </>
      }
    >
      {guests ? (
        <p className="qo-empty">
          {validationResult
            ? '시험 손님과 나눈 대화는 위에 있어요'
            : '손님 이야기를 듣고 채점하는 중이에요…'}
        </p>
      ) : (
        !outputLines(result.stdout).length && (
          <p className="qo-empty">
            {quietEmpty
              ? '그림만 그리고 글자는 없어요'
              : '(아무것도 나오지 않았어요)'}
          </p>
        )
      )}
      {guestHint && !guests && !validationResult && (
        <p className="qo-tip" data-testid="guest-hint">
          직접 해 봤나요? “시험 손님 부르기”를 누르면 손님들이 차례로 써 보고
          채점해요.
        </p>
      )}
      {success && <PassStamp done={successDone} />}
    </Slip>
  );
}
