import type { RunResult } from '@/lib/pyodide/usePyodide';
import { errorLineFromStderr } from '@/lib/editor/stderrLine';

export interface NowTodoInput {
  /** 지금 할 일 (코드 퀘스트 = 과제 설명, 프로젝트 = 지금 단계 목표) */
  task: string;
  /** 공개된 나와야 하는 모습 (코드 퀘스트 expected_output_hint) */
  expected?: string;
  /** 프로젝트 단계 (n/전체) */
  step?: { n: number; total: number };
  runResult: RunResult | null;
  /** 마지막 실행이 지금 코드의 것인지 (고쳤으면 예전 결과로 말하지 않음) */
  runIsCurrent: boolean;
  passed: boolean;
  isCompleted: boolean;
}

/**
 * "무엇을 하면 돼요?" 답 (P6-10 추가, §12-Q58): 퀘스트 소개(quest_intro)를 다시 보여 주는 대신
 * 해 볼 일 + 지금 상태로 짧게 — LLM을 부르지 않아 바로 답하고 한도를 쓰지 않는다
 */
export function nowTodoText(input: NowTodoInput): string {
  const { task, expected, step, runResult, runIsCurrent } = input;
  const head = step
    ? `지금은 **${step.n}/${step.total}단계**예요. 할 일: ${task}`
    : `지금 할 일: ${task}`;
  const lines = [head];
  if (expected?.trim()) lines.push(`나와야 하는 모습: ${expected}`);

  let tip: string;
  if (input.passed && (input.isCompleted || !step)) {
    tip = '벌써 해냈어요! 다음 퀘스트로 가거나, 한 번 더 돌려 복습해 봐요. 🎉';
  } else if (!runResult || !runIsCurrent) {
    tip = runResult
      ? '코드를 고쳤네요! "코드 돌려보기"로 어떻게 나오는지 확인해 봐요.'
      : '공책에 주문을 쓰고 "코드 돌려보기"를 눌러 봐요!';
  } else if (runResult.hadException) {
    const line = errorLineFromStderr(runResult.stderr);
    tip = line
      ? `먼저 ${line}번째 줄에 숨은 버그버그를 찾아 고쳐요. 오류 쪽지의 "${line}번째 줄 보러 가기"를 눌러 봐요.`
      : '먼저 오류 쪽지를 보고 버그버그가 숨은 곳을 고쳐요.';
  } else if (runResult.isTimeout || runResult.outcome === 'output-limit') {
    tip = '반복이 언젠가 멈추는지 살펴보고 다시 돌려 봐요.';
  } else {
    tip =
      '나온 글자를 나와야 하는 모습과 한 글자씩 견줘 보고, 다른 곳을 고쳐 봐요.';
  }
  lines.push(tip);
  return lines.join('\n\n');
}
