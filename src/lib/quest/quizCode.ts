import type { QuizPrompt } from './questKind';
import { QUIZ_BLANK_RE } from './questKind';
import type { QuizAnswerValue } from './quizAnswer';

/**
 * 정답 뒤 "직접 실행해 보기"(P7-07)에 넣을 코드. 클라이언트가 이미 아는 것만 씀: 공개 퀴즈 + 맞힌 제출값(correct)
 * 또는 서버가 공개한 정답(revealed.answer). 정답을 새로 받지 않는다.
 * 실행할 코드가 없으면 null: 문제 코드가 없는 객관식, 값 모양이 퀴즈와 안 맞을 때
 */
export function quizRunCode(
  quiz: QuizPrompt,
  answer: QuizAnswerValue | null,
): string | null {
  switch (quiz.kind) {
    case 'multiple_choice':
      // 출력 예측형만 (문제에 code). 보기 자체가 코드인 객관식은 고른 보기가 정답일 뿐 돌릴 프로그램이 아님
      return quiz.code ?? null;
    case 'fill_blank': {
      if (!isRecord(answer)) return null;
      const filled = answer as Record<string, unknown>;
      const text = (id: string) =>
        quiz.tokens.find((t) => t.id === filled[id])?.text;
      const parts = quiz.code.split(QUIZ_BLANK_RE);
      // 홀수 칸이 빈칸 id
      for (let i = 1; i < parts.length; i += 2) {
        const t = text(parts[i]);
        if (t == null) return null;
        parts[i] = t;
      }
      return parts.join('');
    }
    case 'parsons': {
      if (!Array.isArray(answer)) return null;
      const out: string[] = [];
      for (const item of answer) {
        const id = typeof item === 'string' ? item : item.id;
        const indent = typeof item === 'string' ? 0 : item.indent;
        const line = quiz.lines.find((l) => l.id === id);
        if (!line) return null;
        out.push('    '.repeat(indent) + line.code);
      }
      return out.join('\n');
    }
    case 'bug_hunt': {
      if (!isRecord(answer) || !('line' in answer)) return null;
      const { line, fix: fixId } = answer as { line: unknown; fix: unknown };
      const fix = quiz.fixes.find((f) => f.id === fixId);
      if (!fix || !quiz.lines.some((l) => l.id === line)) return null;
      return quiz.lines
        .map((l) => {
          if (l.id !== line) return l.code;
          // 수정안에 들여쓰기가 없으면 원래 줄의 들여쓰기를 이어 받음
          if (/^\s/.test(fix.code)) return fix.code;
          return (l.code.match(/^\s*/)?.[0] ?? '') + fix.code;
        })
        .join('\n');
    }
  }
}

function isRecord(v: unknown): v is object {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * "코드 바꿔 보기"(§12-Q60 4b) 한 줄 도전 문구. 콘텐츠 필드 없이 코드에서 만든다(공개 필드를 늘리지 않음):
 * 숫자가 있으면 숫자, 따옴표 글자가 있으면 글자, 그 밖은 한 줄 고치기. 정답과는 무관한 놀이 안내
 */
export function tryItPrompt(code: string): string {
  // 주석(#…)은 빼고 봄
  const body = code.replace(/#.*$/gm, '');
  if (/(?<![A-Za-z_])\d/.test(body))
    return '숫자를 바꿔서 다시 돌려 볼까요? 무엇이 달라질까요?';
  if (/(["'])[^"'\n]*[^\s"'\n][^"'\n]*\1/.test(body))
    return '따옴표 안 글자를 내 마음대로 바꿔서 다시 돌려 볼까요?';
  return '한 줄을 살짝 바꿔서 다시 돌려 볼까요?';
}
