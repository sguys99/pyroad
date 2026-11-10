import 'server-only';

import type { QuizAnswer } from '@/lib/quest/answerKeys';
import type { QuizPrompt } from '@/lib/quest/questKind';
import type { QuizAnswerValue } from '@/lib/quest/quizAnswer';
import { quizRunCode } from '@/lib/quest/quizCode';

/**
 * 퀴즈 오답 해설 `quiz_explain` (P7-08, §2.3). 서버 전용: 정답 키를 프롬프트에 넣으므로 결과를 그대로 믿지 않는다.
 *
 * - 학생 답은 클라이언트 값이 아니라 서버가 읽은 이 사용자의 가장 최근 오답(quiz_attempts)만 (정답 오라클 방지)
 * - 시스템 프롬프트 뒤에 QUIZ_EXPLAIN_RULES 로 정답 노출 금지를 한 번 더 강하게
 * - 응답에 정답 글자(보기 글·토큰·수정안·줄)가 있으면 버리고 정적 해설(quizExplainFallback)로
 */

export const QUIZ_EXPLAIN_RULES = `

## 퀴즈 오답 해설 규칙 (가장 중요)
- 정답 보기, 정답 글자, 정답 코드, 정답 순서는 어떤 형태로도 말하지 마세요. 돌려 말하거나 첫 글자만 알려 주는 것도 안 돼요
- 아래 [정답] 칸은 학생이 왜 틀렸는지 이해하려고 당신만 보는 자료예요. 그 안의 글자를 응답에 옮겨 쓰지 마세요
- 보기·토큰·코드 줄을 따옴표나 코드로 옮겨 쓰지 마세요. 학생이 고른 답은 말해도 돼요
- 학생 답이 왜 원하는 결과가 안 되는지, 무엇을 다시 생각해 보면 좋을지 질문으로 이끌어 주세요`;

/** 정답 여부를 캐지 못하게 학생 답은 서버가 읽은 마지막 오답만 넣는다 */
export interface QuizExplainInput {
  topic: string;
  quiz: QuizPrompt;
  answer: QuizAnswer;
  submitted: QuizAnswerValue;
}

const squash = (s: string) => s.replace(/`/g, '').replace(/\s+/g, ' ').trim();

function byId<T extends { id: string }>(list: T[], id: unknown): T | undefined {
  return list.find((x) => x.id === id);
}

/** 답을 사람이 읽는 글로 (프롬프트용. id 는 넣지 않음) */
function describe(quiz: QuizPrompt, value: unknown): string {
  switch (quiz.kind) {
    case 'multiple_choice':
      return byId(quiz.options, value)?.text ?? '(알 수 없음)';
    case 'bug_hunt': {
      const v = (value ?? {}) as { line?: unknown; fix?: unknown };
      const n = quiz.lines.findIndex((l) => l.id === v.line);
      const fix = byId(quiz.fixes, v.fix)?.code ?? '(알 수 없음)';
      return `${n + 1}번째 줄을 \`${fix.trim()}\` 로 고침`;
    }
    default:
      return quizRunCode(quiz, value as QuizAnswerValue) ?? '(알 수 없음)';
  }
}

function quizBody(quiz: QuizPrompt): string {
  switch (quiz.kind) {
    case 'multiple_choice':
      return [
        quiz.code ? `- 문제 코드:\n\`\`\`python\n${quiz.code}\n\`\`\`` : '',
        `- 보기: ${quiz.options.map((o) => `「${o.text}」`).join(' ')}`,
      ]
        .filter(Boolean)
        .join('\n');
    case 'fill_blank':
      return `- 빈칸 코드:\n\`\`\`python\n${quiz.code.replace(/\{\{[^{}]+\}\}/g, '___')}\n\`\`\`\n- 조각: ${quiz.tokens.map((t) => `「${t.text}」`).join(' ')}`;
    case 'parsons':
      return `- 섞인 줄: ${quiz.lines.map((l) => `「${l.code}」`).join(' ')}${quiz.indent ? '\n- 들여쓰기도 학생이 정해요' : ''}`;
    case 'bug_hunt':
      return `- 코드:\n\`\`\`python\n${quiz.lines.map((l, i) => `${i + 1}: ${l.code}`).join('\n')}\n\`\`\`\n- 고칠 후보: ${quiz.fixes.map((f) => `「${f.code}」`).join(' ')}`;
  }
}

const KIND_NAME: Record<QuizPrompt['kind'], string> = {
  multiple_choice: '객관식',
  fill_blank: '빈칸 채우기',
  parsons: '줄 순서 맞추기',
  bug_hunt: '버그 찾기',
};

export function buildQuizExplainPrompt(p: QuizExplainInput): string {
  return `## 컨텍스트
- 학습 주제: ${p.topic}
- 퀴즈 종류: ${KIND_NAME[p.quiz.kind]}
- 문제: ${p.quiz.question}
${quizBody(p.quiz)}
- 학생이 낸 답 (틀림): ${describe(p.quiz, p.submitted)}
- [정답] (말하지 말 것): ${describe(p.quiz, p.answer.accepted[0])}
- [정답 해설] (말하지 말 것): ${p.answer.explanation}

## 지시
학생이 "왜 틀렸어요?"라고 물었어요.
1. 학생이 고른 답이 왜 원하는 결과가 안 되는지 쉽게 짚어 주세요
2. 정답은 절대 말하지 말고, 스스로 다시 생각해 볼 질문 하나로 마무리하세요
3. 초등학생 말투로 2~3문장만 쓰세요

⚠️ 응답은 반드시 200자 이내로 작성하세요.`;
}

/** 응답에 나오면 안 되는 정답 글자. 학생 답과 같은 글자는 빼고 판단하도록 학생 쪽 글자도 함께 */
function answerTexts(
  quiz: QuizPrompt,
  answer: QuizAnswer,
  submitted: QuizAnswerValue,
): { secrets: string[]; mine: string[] } {
  const secrets: string[] = [];
  const mine: string[] = [];
  for (const acc of answer.accepted as unknown[]) {
    switch (quiz.kind) {
      case 'multiple_choice': {
        secrets.push(acc as string, byId(quiz.options, acc)?.text ?? '');
        mine.push(byId(quiz.options, submitted)?.text ?? '');
        break;
      }
      case 'fill_blank': {
        const a = acc as Record<string, string>;
        const s = submitted as Record<string, string>;
        for (const [blank, tok] of Object.entries(a)) {
          secrets.push(tok);
          // 학생이 이미 맞힌 빈칸의 조각은 비밀이 아님
          if (s[blank] !== tok)
            secrets.push(byId(quiz.tokens, tok)?.text ?? '');
        }
        break;
      }
      case 'parsons':
        // 줄 글자는 모두 공개지만 순서가 정답: 줄을 옮겨 쓰면 순서를 알려 주게 되므로 모든 줄을 막음
        for (const x of acc as (string | { id: string })[]) {
          const id = typeof x === 'string' ? x : x.id;
          secrets.push(id, byId(quiz.lines, id)?.code ?? '');
        }
        break;
      case 'bug_hunt': {
        const a = acc as { line: string; fix: string };
        const s = submitted as { line?: string; fix?: string };
        secrets.push(a.line, a.fix, byId(quiz.fixes, a.fix)?.code ?? '');
        if (s.line !== a.line)
          secrets.push(byId(quiz.lines, a.line)?.code ?? '');
        mine.push(byId(quiz.fixes, s.fix)?.code ?? '');
        break;
      }
    }
  }
  return {
    secrets: [...new Set(secrets.map(squash).filter(Boolean))],
    mine: mine.map(squash).filter(Boolean),
  };
}

const WORD = /[A-Za-z0-9_]/;

/** needle 이 hay 에 낱말로 들어 있는지 (`3` 이 `range(30)` 안에 걸리지 않게). 짧은 기호도 그대로 셈(안전 쪽) */
function mentions(hay: string, needle: string): boolean {
  for (let i = hay.indexOf(needle); i !== -1; i = hay.indexOf(needle, i + 1)) {
    const before = hay[i - 1] ?? ' ';
    const after = hay[i + needle.length] ?? ' ';
    if (
      !(WORD.test(needle[0]) && WORD.test(before)) &&
      !(WORD.test(needle.at(-1)!) && WORD.test(after))
    )
      return true;
  }
  return false;
}

/** 응답에 정답 글자가 있는지. 학생이 고른 답을 그대로 말한 부분은 지우고 본다 */
export function leaksQuizAnswer(
  text: string,
  input: Pick<QuizExplainInput, 'quiz' | 'answer' | 'submitted'>,
): boolean {
  const { secrets, mine } = answerTexts(
    input.quiz,
    input.answer,
    input.submitted,
  );
  let hay = squash(text);
  for (const m of mine) hay = hay.split(m).join(' ');
  return secrets.some((s) => mentions(hay, s));
}

const KIND_TIP: Record<QuizPrompt['kind'], string> = {
  multiple_choice:
    '보기를 하나씩 넣어 보고, 컴퓨터가 정말 그렇게 할지 머릿속으로 한 줄씩 따라가 봐요.',
  fill_blank:
    '빈칸마다 어떤 역할이 필요한지 먼저 생각해 봐요. 숫자를 만들어야 할까요, 화면에 보여 줘야 할까요?',
  parsons:
    '먼저 만들어야 하는 것부터 차례로 놓아 봐요. 상자(변수)는 쓰기 전에 만들고, 반복이나 조건 안에서 할 일은 그 아래에 들여 써요.',
  bug_hunt:
    '줄마다 끝까지 읽으면서 괄호·따옴표·콜론(:)·들여쓰기가 맞는지 살펴봐요.',
};

/**
 * 저장된 해설 (키 없음·한도·오류·누출 감지): 고른 보기·수정안의 해설(채점 응답과 같은 것)이 있으면 그것,
 * 없으면 콘텐츠의 fallback_text(빌드가 정답 글자를 막음) + 종류별 생각 안내. 정답은 들어가지 않음
 */
export function quizExplainFallback(
  input: Pick<QuizExplainInput, 'quiz' | 'answer' | 'submitted'>,
  fallbackText?: string,
): string {
  const { quiz, answer, submitted } = input;
  const why = answer.explanations ?? {};
  const choice =
    quiz.kind === 'multiple_choice'
      ? why[submitted as string]
      : quiz.kind === 'bug_hunt'
        ? (why[(submitted as { fix: string }).fix] ??
          why[(submitted as { line: string }).line])
        : undefined;
  return [choice ?? fallbackText, KIND_TIP[quiz.kind]]
    .filter(Boolean)
    .join(' ');
}
