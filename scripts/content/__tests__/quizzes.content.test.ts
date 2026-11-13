// 퀴즈 코드를 실제 Pyodide 로 돌려 정답이 정말 정답인지 확인한다 (P7-12, `npm run test:content`)
//
//   multiple_choice  문제에 code 가 있으면(출력 예측형) 실제 출력 = 정답 보기, 오답 보기와는 다름
//                    (여러 줄 출력은 줄을 ", " 로 이은 모양. content/README.md "출력 예측형")
//   fill_blank       정답으로 채운 코드는 오류 없이 끝나고, 다른 토큰으로 채운 결과는 정답과 다름
//   parsons          정답 순서(들여쓰기 포함)는 모두 오류 없이 끝나고 출력이 서로 같음
//   bug_hunt         원래 코드와 오답 수정안은 정답 수정안과 결과(출력·오류·시간 초과)가 다름, 정답 수정안은 오류 없이 끝남
// 퀴즈 코드에는 input()·random 을 쓰지 않는다 (입력·시드 없이 한 번만 돌림)

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { loadContent } from '@/lib/content/load';
import type { QuizQuest } from '@/lib/content/schema';
import { QUIZ_BLANK_RE } from '@/lib/quest/questKind';

import { NodePyodideRunner } from '../../pyodide/nodeRunner';
import { CONTENT_DIR } from '../lib/paths';

/** 무한 반복 버그(오답)는 출력 상한이나 이 시간에 끊김 */
const TIMEOUT_MS = 3_000;

const all = loadContent(CONTENT_DIR)
  .worlds.flatMap((w) => w.stages)
  .flatMap((s) =>
    s.quests.map((q) => ({ stage: s.stage.order, quest: q.quest })),
  );
const quizzes = all.filter(
  (x): x is { stage: number; quest: QuizQuest } =>
    x.quest.quest_type === 'quiz',
);
// 보스 라운드(P9-12)는 퀴즈 하나와 같은 검사: 라운드마다 퀴즈 퀘스트 모양으로 펼침
const bossRounds = all.flatMap(({ stage, quest }) =>
  quest.quest_type === 'boss'
    ? quest.rounds.map((r, i) => ({
        stage,
        quest: {
          ...quest,
          title: `${quest.title} ${i + 1}번째 문제`,
          quest_type: 'quiz',
          quiz_kind: r.quiz_kind,
          prompt: { ...quest.prompt, quiz: r.prompt.quiz },
          answer: r.answer,
        } as unknown as QuizQuest,
      }))
    : [],
);

let runner: NodePyodideRunner;
beforeAll(async () => {
  runner = await NodePyodideRunner.create({ timeoutMs: TIMEOUT_MS });
}, 180_000);
afterAll(() => runner?.close());

interface Outcome {
  ok: boolean;
  /** 결과 비교용: 출력, 또는 오류 종류·시간 초과 */
  result: string;
  stdout: string;
}

async function run(code: string): Promise<Outcome> {
  const r = await runner.run(code, { timeoutMs: TIMEOUT_MS });
  const ok = r.outcome === 'ok' && !r.hadException;
  return {
    ok,
    result: ok ? r.stdout.trim() : `${r.outcome}:${r.errorType ?? ''}`,
    stdout: r.stdout,
  };
}

// 출력 예측형 보기는 실제 출력 그대로 (여러 줄은 \n, 화면은 줄마다 ↵ 표시, B53)
const lines = (stdout: string) => stdout.trim();

it('1월드 스테이지마다 퀴즈가 있음', () => {
  expect(new Set(quizzes.map((q) => q.stage)).size).toBe(7);
});

for (const { stage, quest } of [...quizzes, ...bossRounds])
  describe(`${stage}-${quest.order} ${quest.title} (${quest.quiz_kind})`, () => {
    it('정답 코드가 실제로 정답', async () => {
      switch (quest.quiz_kind) {
        case 'multiple_choice': {
          const { code, options } = quest.prompt.quiz;
          if (!code) return; // 개념 객관식: 돌릴 코드 없음
          const out = await run(code);
          expect(out.ok, out.result).toBe(true);
          const shown = lines(out.stdout);
          const matching = options
            .filter((o) => o.text === shown)
            .map((o) => o.id);
          expect(matching, `실제 출력: ${shown}`).toEqual(
            quest.answer.quiz_answer.accepted,
          );
          return;
        }
        case 'fill_blank': {
          const { code, tokens } = quest.prompt.quiz;
          const text = new Map(tokens.map((t) => [t.id, t.text]));
          const fill = (pick: (blank: string) => string) =>
            code.replace(QUIZ_BLANK_RE, (_, b: string) => pick(b));
          const accepted = quest.answer.quiz_answer.accepted;
          const right = await run(fill((b) => text.get(accepted[0][b])!));
          expect(right.ok, right.result).toBe(true);
          for (const a of accepted.slice(1))
            expect((await run(fill((b) => text.get(a[b])!))).result).toBe(
              right.result,
            );
          // 빈칸 하나만 다른 토큰으로 바꾼 코드는 결과가 달라야 함 (오답 토큰이 정말 오답)
          const blanks = Object.keys(accepted[0]);
          for (const b of blanks)
            for (const t of tokens) {
              const alt = { ...accepted[0], [b]: t.id };
              if (accepted.some((a) => blanks.every((k) => a[k] === alt[k])))
                continue;
              const wrong = await run(fill((k) => text.get(alt[k])!));
              expect(
                wrong.result,
                `빈칸 ${b} 에 ${t.text} 를 넣어도 정답과 같아요`,
              ).not.toBe(right.result);
            }
          return;
        }
        case 'parsons': {
          const { lines: ls } = quest.prompt.quiz;
          const code = new Map(ls.map((l) => [l.id, l.code]));
          const results = new Set<string>();
          for (const order of quest.answer.quiz_answer.accepted) {
            const src = order
              .map((x) =>
                typeof x === 'string'
                  ? code.get(x)
                  : '    '.repeat(x.indent) + code.get(x.id),
              )
              .join('\n');
            const out = await run(src);
            expect(out.ok, `${out.result}\n${src}`).toBe(true);
            results.add(out.result);
          }
          expect(results.size, '정답 순서마다 출력이 달라요').toBe(1);
          return;
        }
        case 'bug_hunt': {
          const { lines: ls, fixes } = quest.prompt.quiz;
          const withFix = (line: string, fix: string) =>
            ls
              .map((l) =>
                l.id === line ? fixes.find((f) => f.id === fix)!.code : l.code,
              )
              .join('\n');
          const [first] = quest.answer.quiz_answer.accepted;
          const right = await run(withFix(first.line, first.fix));
          expect(right.ok, right.result).toBe(true);
          const original = await run(ls.map((l) => l.code).join('\n'));
          expect(original.result, '고치기 전 코드도 결과가 같아요').not.toBe(
            right.result,
          );
          for (const f of fixes) {
            if (
              quest.answer.quiz_answer.accepted.some(
                (a) => a.line === first.line && a.fix === f.id,
              )
            )
              continue;
            const wrong = await run(withFix(first.line, f.id));
            expect(
              wrong.result,
              `오답 수정안 ${f.code} 도 결과가 같아요`,
            ).not.toBe(right.result);
          }
          return;
        }
      }
    });
  });
