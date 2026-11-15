// 실행 중 stdout을 화면에 흘려 보여 주는 작은 저장소 (P1-09, §2.9 stdout 스트리밍).
//
// Worker는 출력을 묶어서 자주 보내므로, 이 값을 퀘스트 셸의 state로 두면 조각마다 셸 전체
// (대화 패널·에디터·상태바)가 다시 그려진다. 출력창만 useSyncExternalStore로 구독해서
// 다시 그리는 범위를 출력창 하나로 줄인다.
//
// input() 대기(P11-01)도 여기 둔다: 실행을 부른 곳은 `liveRunOptions(store)`만 넘기고, 출력창(OutputPanel)이
// 대기 상태를 읽어 입력 칸을 그리고 `answer`·`stopInput`을 부른다 (셸·코드 패널을 거쳐 props를 내려보내지 않음).
// turtle 그리기 명령(P11-02)도 여기 쌓는다: 글자 줄과 따로 구독해서(subscribeTurtle) 청크마다 출력창이 다시 그려지지 않고,
// 그림판(TurtleStage)이 늦게 붙어도(모바일 결과 쪽) 이번 실행 명령을 처음부터 다시 그릴 수 있다.

import { MAX_OUTPUT_LENGTH } from './constants';
import type { InputRequest, RunInput } from './types';
import type { RunCodeOptions } from './usePyodide';
import type { TurtleCommand } from '@/lib/turtle/scene';

export interface LiveOutputSnapshot {
  /** 지금까지 받은 출력 (화면 상한 MAX_OUTPUT_LENGTH까지만) */
  text: string;
  /** 상한을 넘어 뒷부분을 버렸는지 */
  clipped: boolean;
  /** 이번 실행에서 input()에 답한 말 (P11-01) */
  inputs: readonly RunInput[];
  /** input()이 답을 기다리는 중 */
  waiting: boolean;
  /** 이번 실행이 turtle로 무언가 그렸는지 (첫 명령이 오면 true, P11-02) */
  drawing: boolean;
}

export interface LiveOutputStore {
  append(chunk: string): void;
  reset(): void;
  /** input()이 답을 기다림 (usePyodide onInputRequest) */
  ask(request: InputRequest): void;
  /** 기다리는 input()에 답한다. 기다리는 중이 아니면 무시 */
  answer(value: string): void;
  /** 이번 실행 멈추기 (입력 칸의 멈추기 버튼) */
  stopInput(): void;
  /** turtle 명령 묶음 받기 (usePyodide onTurtle, JSON 배열 문자열) */
  turtle(chunk: string): void;
  /** 이번 실행의 turtle 명령. 실행마다(reset) 새 배열이라 바뀐 배열이면 새 그림 */
  getTurtle(): readonly TurtleCommand[];
  subscribeTurtle(listener: () => void): () => void;
  getSnapshot(): LiveOutputSnapshot;
  subscribe(listener: () => void): () => void;
}

const NO_INPUTS: readonly RunInput[] = [];
const EMPTY: LiveOutputSnapshot = {
  text: '',
  clipped: false,
  inputs: NO_INPUTS,
  waiting: false,
  drawing: false,
};

/**
 * 실행 중 출력 저장소. 상한을 넘으면 앞부분만 남긴다
 * (실행이 끝난 뒤 결과도 `truncateOutput`으로 앞부분 MAX_OUTPUT_LENGTH자를 보여 주므로 같은 모양)
 */
export function createLiveOutputStore(
  limit: number = MAX_OUTPUT_LENGTH,
): LiveOutputStore {
  let snapshot = EMPTY;
  let request: InputRequest | null = null;
  // 이번 실행 멈추기 (답을 보낸 뒤 다음 질문 전에도 입력 칸의 멈추기가 듣게)
  let stopRun: (() => void) | null = null;
  const listeners = new Set<() => void>();
  let turtle: TurtleCommand[] = [];
  const turtleListeners = new Set<() => void>();
  const notifyTurtle = () => {
    for (const listener of turtleListeners) listener();
  };
  const set = (next: Partial<LiveOutputSnapshot>) => {
    snapshot = { ...snapshot, ...next };
    for (const listener of listeners) listener();
  };

  return {
    append(chunk) {
      if (!chunk || snapshot.clipped) return;
      const next = snapshot.text + chunk;
      set(
        next.length > limit
          ? { text: next.slice(0, limit), clipped: true }
          : { text: next },
      );
    },
    reset() {
      request = null;
      stopRun = null;
      if (turtle.length) {
        turtle = [];
        notifyTurtle();
      }
      if (snapshot === EMPTY) return;
      snapshot = EMPTY;
      for (const listener of listeners) listener();
    },
    ask(next) {
      request = next;
      stopRun = next.stop;
      set({ waiting: true });
    },
    answer(value) {
      if (!request) return;
      const current = request;
      request = null;
      set({
        waiting: false,
        inputs: [...snapshot.inputs, { at: snapshot.text.length, value }],
      });
      current.answer(value);
    },
    stopInput() {
      request = null;
      if (snapshot.waiting) set({ waiting: false });
      stopRun?.();
    },
    turtle(chunk) {
      let cmds: unknown;
      try {
        cmds = JSON.parse(chunk);
      } catch {
        return;
      }
      if (!Array.isArray(cmds) || !cmds.length) return;
      turtle.push(...(cmds as TurtleCommand[]));
      notifyTurtle();
      if (!snapshot.drawing) set({ drawing: true });
    },
    getTurtle: () => turtle,
    subscribeTurtle(listener) {
      turtleListeners.add(listener);
      return () => turtleListeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** runCode에 넘길 출력·입력 연결 (실행 중 출력 + input() 대기) */
export function liveRunOptions(
  store: LiveOutputStore,
): Pick<RunCodeOptions, 'onStdout' | 'onInputRequest' | 'onTurtle'> {
  return {
    onStdout: store.append,
    onInputRequest: store.ask,
    onTurtle: store.turtle,
  };
}
