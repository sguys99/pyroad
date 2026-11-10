import { describe, it, expect } from 'vitest';
import type { QuizAnswer } from '@/lib/quest/answerKeys';
import type { QuizPrompt } from '@/lib/quest/questKind';
import {
  QUIZ_EXPLAIN_RULES,
  buildQuizExplainPrompt,
  leaksQuizAnswer,
  quizExplainFallback,
} from '../quizExplain';

const MC: QuizPrompt = {
  kind: 'multiple_choice',
  question: '이 코드를 돌리면 무엇이 나올까?',
  code: 'for i in range(3):\n    print(i)',
  options: [
    { id: 'opt-w9fa', text: '0 1 2 3' },
    { id: 'opt-k7qz', text: '0 1 2' },
    { id: 'opt-b2mx', text: '1 2 3' },
  ],
};
const MC_KEY: QuizAnswer = {
  kind: 'multiple_choice',
  accepted: ['opt-k7qz'],
  explanation: 'range(3)은 0, 1, 2 세 번 돌아요.',
  explanations: { 'opt-b2mx': 'range는 0부터 세기 시작해요.' },
};

const FILL: QuizPrompt = {
  kind: 'fill_blank',
  question: '빈칸을 채워요',
  code: 'for i in {{bk-r2fa}}(3):\n    {{bk-m8ce}}(i)',
  tokens: [
    { id: 'tok-z6nh', text: 'input' },
    { id: 'tok-c3pd', text: 'print' },
    { id: 'tok-m4xe', text: 'range' },
  ],
};
const FILL_KEY: QuizAnswer = {
  kind: 'fill_blank',
  accepted: [{ 'bk-r2fa': 'tok-m4xe', 'bk-m8ce': 'tok-c3pd' }],
  explanation: 'range 로 숫자를 만들고 print 로 보여 줘요.',
};

const PARSONS: QuizPrompt = {
  kind: 'parsons',
  question: '순서대로 놓아요',
  lines: [
    { id: 'ln-q8wd', code: 'print(total)' },
    { id: 'ln-a3ke', code: 'total = 0' },
  ],
};
const PARSONS_KEY: QuizAnswer = {
  kind: 'parsons',
  accepted: [['ln-a3ke', 'ln-q8wd']],
  explanation: '상자를 먼저 만들어요.',
};

const BUG: QuizPrompt = {
  kind: 'bug_hunt',
  question: '버그를 찾아요',
  lines: [
    { id: 'ln-x5pc', code: 'name = "파이"' },
    { id: 'ln-h7jq', code: 'for i in range(3)' },
  ],
  fixes: [
    { id: 'fx-b7nd', code: 'for i in range(3):' },
    { id: 'fx-m9ts', code: 'for i in range(3);' },
  ],
};
const BUG_KEY: QuizAnswer = {
  kind: 'bug_hunt',
  accepted: [{ line: 'ln-h7jq', fix: 'fx-b7nd' }],
  explanation: 'for 줄 끝에는 콜론이 있어야 해요.',
  explanations: { 'fx-m9ts': '세미콜론은 파이썬 반복문에 쓰지 않아요.' },
};

describe('buildQuizExplainPrompt (P7-08)', () => {
  it('학생 답·정답을 글로 넣고 정답을 말하지 말라고 지시한다 (id 는 넣지 않음)', () => {
    const p = buildQuizExplainPrompt({
      topic: '반복문',
      quiz: MC,
      answer: MC_KEY,
      submitted: 'opt-b2mx',
    });
    expect(p).toContain('학생이 낸 답 (틀림): 1 2 3');
    expect(p).toContain('[정답] (말하지 말 것): 0 1 2');
    expect(p).toContain('정답은 절대 말하지 말고');
    expect(p).not.toMatch(/opt-/);
    expect(QUIZ_EXPLAIN_RULES).toContain('정답 코드');
    expect(QUIZ_EXPLAIN_RULES).toContain('말하지 마세요');
  });

  it('빈칸·순서·버그 찾기는 조립한 코드로 보여 준다', () => {
    const fill = buildQuizExplainPrompt({
      topic: 't',
      quiz: FILL,
      answer: FILL_KEY,
      submitted: { 'bk-r2fa': 'tok-z6nh', 'bk-m8ce': 'tok-c3pd' },
    });
    expect(fill).toContain('for i in input(3):');
    expect(fill).toContain('for i in ___(3):');
    const bug = buildQuizExplainPrompt({
      topic: 't',
      quiz: BUG,
      answer: BUG_KEY,
      submitted: { line: 'ln-h7jq', fix: 'fx-m9ts' },
    });
    expect(bug).toContain('2번째 줄을 `for i in range(3);` 로 고침');
  });
});

describe('leaksQuizAnswer (P7-08, 정답 누출 필터)', () => {
  const mc = { quiz: MC, answer: MC_KEY, submitted: 'opt-b2mx' };

  it('객관식: 정답 보기 글이 있으면 누출', () => {
    expect(leaksQuizAnswer('정답은 0 1 2 예요!', mc)).toBe(true);
    expect(leaksQuizAnswer('opt-k7qz 를 골라 봐요', mc)).toBe(true);
    expect(
      leaksQuizAnswer('range는 어디서 세기 시작할까요? 다시 세어 봐요.', mc),
    ).toBe(false);
  });

  it('학생이 고른 답을 말한 것은 누출이 아님 (정답 글이 그 안에 들어 있어도)', () => {
    const wide = { ...mc, submitted: 'opt-w9fa' };
    expect(leaksQuizAnswer('`0 1 2 3`이 나올까요? 끝 숫자를 봐요.', wide)).toBe(
      false,
    );
    expect(leaksQuizAnswer('0 1 2 3 말고 0 1 2 예요', wide)).toBe(true);
  });

  it('빈칸: 학생이 틀린 빈칸의 정답 조각만 비밀', () => {
    const fill = {
      quiz: FILL,
      answer: FILL_KEY,
      submitted: { 'bk-r2fa': 'tok-z6nh', 'bk-m8ce': 'tok-c3pd' },
    };
    expect(leaksQuizAnswer('range 를 써 봐요', fill)).toBe(true);
    expect(leaksQuizAnswer('print 는 잘 골랐어요!', fill)).toBe(false);
    // 낱말 한가운데는 무시
    expect(leaksQuizAnswer('arranged 같은 말은 상관없어요', fill)).toBe(false);
  });

  it('순서 맞추기: 줄을 그대로 옮기면 누출, 버그 찾기: 정답 수정안이면 누출', () => {
    const parsons = {
      quiz: PARSONS,
      answer: PARSONS_KEY,
      submitted: ['ln-q8wd', 'ln-a3ke'],
    };
    expect(leaksQuizAnswer('먼저 total = 0 을 놓아요', parsons)).toBe(true);
    expect(leaksQuizAnswer('상자는 쓰기 전에 만들어야 해요', parsons)).toBe(
      false,
    );
    const bug = {
      quiz: BUG,
      answer: BUG_KEY,
      submitted: { line: 'ln-h7jq', fix: 'fx-m9ts' },
    };
    expect(leaksQuizAnswer('for i in range(3): 로 고쳐요', bug)).toBe(true);
    expect(
      leaksQuizAnswer('for i in range(3); 의 끝 기호가 맞을까요?', bug),
    ).toBe(false);
  });
});

describe('quizExplainFallback (P7-08, 저장된 해설)', () => {
  it('객관식·버그 찾기: 고른 것의 해설은 오답 쪽지에 이미 있어 되풀이하지 않고 종류별 안내만 (B53)', () => {
    const mc = quizExplainFallback(
      { quiz: MC, answer: MC_KEY, submitted: 'opt-b2mx' },
      '콘텐츠 해설',
    );
    expect(mc).toMatch(/^보기를 하나씩/);
    expect(mc).not.toContain('range는 0부터');
    expect(mc).not.toContain('콘텐츠 해설');
    const bug = quizExplainFallback({
      quiz: BUG,
      answer: BUG_KEY,
      submitted: { line: 'ln-h7jq', fix: 'fx-m9ts' },
    });
    expect(bug).not.toContain('세미콜론');
    expect(bug).toContain('괄호·따옴표');
    // 고른 보기에 해설이 없으면 fallback_text + 안내
    expect(
      quizExplainFallback(
        {
          quiz: MC,
          answer: { ...MC_KEY, explanations: {} },
          submitted: 'opt-b2mx',
        },
        '콘텐츠 해설',
      ),
    ).toMatch(/^콘텐츠 해설 보기를 하나씩/);
  });

  it('해설이 없으면 콘텐츠 fallback_text, 빈칸·순서도 종류별 안내가 나온다', () => {
    const fill = quizExplainFallback(
      {
        quiz: FILL,
        answer: FILL_KEY,
        submitted: { 'bk-r2fa': 'tok-z6nh', 'bk-m8ce': 'tok-c3pd' },
      },
      '반복할 횟수를 만드는 조각을 떠올려요.',
    );
    expect(fill).toContain('반복할 횟수를 만드는 조각');
    expect(fill).toContain('빈칸마다 어떤 역할이 필요한지');
    const parsons = quizExplainFallback({
      quiz: PARSONS,
      answer: PARSONS_KEY,
      submitted: ['ln-q8wd', 'ln-a3ke'],
    });
    expect(parsons).toContain('먼저 만들어야 하는 것부터');
    expect(
      leaksQuizAnswer(parsons, {
        quiz: PARSONS,
        answer: PARSONS_KEY,
        submitted: ['ln-q8wd', 'ln-a3ke'],
      }),
    ).toBe(false);
  });
});
