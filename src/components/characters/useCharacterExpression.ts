import type { PybaemExpression } from './expressions';
import type { ChatMessage } from '@/lib/tutor/types';
import type { RunResult } from '@/lib/pyodide/usePyodide';

/**
 * 키워드-표정 매핑 (우선순위 순서).
 * 첫 번째 매칭된 표정을 반환한다.
 */
const EXPRESSION_KEYWORDS: { expression: PybaemExpression; keywords: string[] }[] = [
  {
    expression: 'celebrating',
    keywords: ['정답', '대단', '축하', '완벽', '성공', '훌륭', '멋져', '잘했'],
  },
  {
    expression: 'proud',
    keywords: ['자랑', '뿌듯', '최고', '실력'],
  },
  {
    expression: 'surprised',
    keywords: ['어머', '놀랍', '세상에', '대박', '우와'],
  },
  {
    expression: 'encouraging',
    keywords: ['괜찮', '힘내', '할 수 있', '다시', '앗', '오류', '에러', '실수'],
  },
  {
    expression: 'teaching',
    keywords: ['힌트', '알려', '설명', '방법', '이렇게', '먼저', '다음'],
  },
  {
    expression: 'thinking',
    keywords: ['생각', '음', '글쎄', '한번'],
  },
];

/**
 * 메시지 내용의 한국어 키워드를 분석하여 적절한 표정을 반환한다.
 */
export function useMessageExpression(message: ChatMessage): PybaemExpression {
  const content = message.content;
  for (const { expression, keywords } of EXPRESSION_KEYWORDS) {
    if (keywords.some((kw) => content.includes(kw))) {
      return expression;
    }
  }
  return 'happy';
}

interface OutputExpressionState {
  isRunning: boolean;
  result: RunResult | null;
  validationResult?: { passed: boolean } | null;
}

/**
 * OutputPanel의 실행 상태를 표정으로 매핑한다.
 */
export function getOutputExpression(state: OutputExpressionState): PybaemExpression {
  if (state.isRunning) return 'thinking';
  if (!state.result) return 'happy';
  if (state.result.isTimeout) return 'confused';
  if (!state.result.success) return 'encouraging';
  if (state.validationResult?.passed) return 'celebrating';
  if (state.validationResult && !state.validationResult.passed) return 'teaching';
  return 'happy';
}
