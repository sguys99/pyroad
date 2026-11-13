// P7-14: 퀴즈 채점·보기 섞기·복습 가능일을 실제 콘텐츠(빌드한 퀴즈 전부)와 메모리 Postgres(PGlite)로 확인.
// 채점 RPC 자체(별·XP·practice·동시성)는 supabase/tests/checks.mjs QZ-1~9. 여기는 그 RPC 에 들어가는 값이
// 클라이언트·API 쪽에서 accepted 정규형과 같은 jsonb 가 되는지, 날짜 판단이 SQL kst_date 와 같은지.

import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from 'vitest';

import type { QuizValueMap } from '@/components/quest/quiz/types';
import { buildRows } from '@/lib/content/build';
import { loadContent } from '@/lib/content/load';
import type { QuizAnswer } from '@/lib/content/schema';
import { toKstDateKey } from '@/lib/time/kst';
import type { QuizPrompt } from '@/lib/types/database';

import { CONTENT_DIR, REPO_ROOT } from '../../../../scripts/content/lib/paths';
import { QuizAnswerRequestSchema, type QuizAnswerValue } from '../quizAnswer';
import { shuffleQuiz } from '../quizShuffle';
import { quizEntryMode } from '../useQuizSession';

interface BuiltQuiz {
  id: string;
  quiz: QuizPrompt;
  answer: QuizAnswer;
}

let quizzes: BuiltQuiz[];
let db: PGlite;

beforeAll(async () => {
  const rows = buildRows(loadContent(CONTENT_DIR)).rows;
  quizzes = rows.quests
    .filter((q) => q.quest_type === 'quiz')
    .map((q) => ({
      id: q.id,
      quiz: (q.prompt_skeleton as unknown as { quiz: QuizPrompt }).quiz,
      answer: rows.answer_keys.find((k) => k.quest_id === q.id)!
        .quiz_answer as QuizAnswer,
    }))
    // 보스 라운드(P9-12)도 같은 채점(boss_answer 의 `a.v = p_answer`)이라 함께 검사
    .concat(
      rows.quests
        .filter((q) => q.quest_type === 'boss')
        .flatMap((q) => {
          const rounds = (
            q.prompt_skeleton as unknown as { boss: { rounds: QuizPrompt[] } }
          ).boss.rounds;
          const keys = (
            rows.answer_keys.find((k) => k.quest_id === q.id)!
              .quiz_answer as unknown as { rounds: QuizAnswer[] }
          ).rounds;
          return rounds.map((quiz, i) => ({
            id: q.id,
            quiz,
            answer: keys[i],
          }));
        }),
    );
  db = new PGlite();
  await db.waitReady;
  // 실제 마이그레이션의 kst_date·kst_today 정의 그대로 (00012)
  const m = readFileSync(
    join(REPO_ROOT, 'supabase/migrations/00012_schema_expansion.sql'),
    'utf8',
  );
  const start = m.indexOf('CREATE OR REPLACE FUNCTION public.kst_date');
  const end = m.indexOf('COMMENT ON FUNCTION public.kst_today');
  expect(start).toBeGreaterThan(0);
  await db.exec(m.slice(start, end));
}, 60_000);

afterAll(() => db?.close());

/** submit_quiz_answer 의 `a.v = p_answer` 와 같은 jsonb = (키 순서 무관 · 배열 순서 그대로) */
async function jsonbEq(a: unknown, b: unknown): Promise<boolean> {
  const { rows } = await db.query<{ eq: boolean }>(
    'SELECT $1::jsonb = $2::jsonb AS eq',
    [JSON.stringify(a), JSON.stringify(b)],
  );
  return rows[0].eq;
}

/** 채점 RPC 판정: accepted 중 하나와 jsonb = */
async function graded(q: BuiltQuiz, answer: unknown): Promise<boolean> {
  for (const a of q.answer.accepted) if (await jsonbEq(a, answer)) return true;
  return false;
}

/** 브라우저 → /api/quest/answer → RPC 인자: JSON 본문 왕복 + 라우트 zod. zod 가 거절하면 null */
function throughApi(q: BuiltQuiz, value: unknown): QuizAnswerValue | null {
  const body = JSON.parse(JSON.stringify({ quest_id: q.id, answer: value }));
  const parsed = QuizAnswerRequestSchema.safeParse(body);
  return parsed.success ? parsed.data.answer : null;
}

/**
 * 화면에 보이는 퀴즈에서 정답 id 를 찾아 고르는 학생 (입력 컴포넌트처럼 위치가 아니라 보기 객체의 id 로 값을 만듦).
 * fill_blank 는 빈칸을 거꾸로 채워 키 순서가 accepted 와 다르게, parsons indent 는 {indent, id} 키 순서로
 */
function pickFrom(quiz: QuizPrompt, accepted: unknown): unknown {
  const find = (xs: readonly { id: string }[], id: string) => {
    const hit = xs.find((x) => x.id === id);
    if (!hit) throw new Error(`화면에 없는 id ${id}`);
    return hit.id;
  };
  switch (quiz.kind) {
    case 'multiple_choice':
      return find(quiz.options, accepted as string);
    case 'fill_blank': {
      const want = accepted as Record<string, string>;
      return Object.fromEntries(
        Object.keys(want)
          .reverse()
          .map((b) => [b, find(quiz.tokens, want[b])]),
      );
    }
    case 'parsons':
      return (accepted as (string | { id: string; indent: number })[]).map(
        (x) =>
          typeof x === 'string'
            ? find(quiz.lines, x)
            : { indent: x.indent, id: find(quiz.lines, x.id) },
      );
    case 'bug_hunt': {
      const { line, fix } = accepted as { line: string; fix: string };
      return { fix: find(quiz.fixes, fix), line: find(quiz.lines, line) };
    }
  }
}

/** 시드 고정 난수 (mulberry32) → randomInt(n) */
function seeded(seed: number) {
  let s = seed >>> 0;
  return (n: number) => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 0x1_0000_0000) * n);
  };
}
const SEEDS = [1, 2, 3, 7, 42, 2026, 31337, 0xdeadbeef];

const ids = (q: QuizPrompt): Record<string, string[]> => {
  switch (q.kind) {
    case 'multiple_choice':
      return { options: q.options.map((o) => o.id) };
    case 'fill_blank':
      return { tokens: q.tokens.map((t) => t.id) };
    case 'parsons':
      return { lines: q.lines.map((l) => l.id) };
    case 'bug_hunt':
      return {
        lines: q.lines.map((l) => l.id),
        fixes: q.fixes.map((f) => f.id),
      };
  }
};

describe('실제 콘텐츠 퀴즈', () => {
  it('퀴즈 21문항 + 보스 라운드, 4종 모두 있음', () => {
    expect(quizzes.length).toBeGreaterThanOrEqual(21 + 3);
    expect(new Set(quizzes.map((q) => q.quiz.kind))).toEqual(
      new Set(['multiple_choice', 'fill_blank', 'parsons', 'bug_hunt']),
    );
  });
});

describe('채점 4종: 정답 제출값이 API 를 거쳐 accepted 와 jsonb = 로 같음', () => {
  it('모든 accepted 를 화면에서 골라 보내면 정답 (fill_blank 키 순서·bug_hunt·indent 객체 키 순서 무관)', async () => {
    for (const q of quizzes) {
      for (const a of q.answer.accepted) {
        const sent = throughApi(q, pickFrom(q.quiz, a));
        expect(sent, q.id).not.toBeNull();
        expect(await graded(q, sent), `${q.id} ${JSON.stringify(a)}`).toBe(
          true,
        );
      }
    }
  });

  it('jsonb 의미 확인: 객체 키 순서는 무관, 배열 순서는 유관 (JSON 문자열 비교와 다름)', async () => {
    expect(await jsonbEq({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(await jsonbEq(['a', 'b'], ['b', 'a'])).toBe(false);
    expect(
      await jsonbEq([{ id: 'x', indent: 1 }], [{ indent: 1, id: 'x' }]),
    ).toBe(true);
  });

  it('객관식: 정답이 아닌 보기는 모두 오답', async () => {
    for (const q of quizzes) {
      if (q.quiz.kind !== 'multiple_choice') continue;
      for (const o of q.quiz.options) {
        const ok = q.answer.accepted.includes(o.id as never);
        expect(await graded(q, throughApi(q, o.id)), `${q.id} ${o.id}`).toBe(
          ok,
        );
      }
    }
  });

  it('빈칸: 일부만 채우거나 한 칸을 다른 토큰으로 채우면 오답 (빈 객체는 API 가 거절)', async () => {
    for (const q of quizzes) {
      if (q.quiz.kind !== 'fill_blank') continue;
      const full = q.answer.accepted[0] as Record<string, string>;
      const blanks = Object.keys(full);
      const partial = Object.fromEntries(
        blanks.slice(1).map((b) => [b, full[b]]),
      );
      if (blanks.length === 1) expect(throughApi(q, partial), q.id).toBeNull();
      else expect(await graded(q, throughApi(q, partial)), q.id).toBe(false);

      const other = q.quiz.tokens.find((t) => t.id !== full[blanks[0]])!;
      const wrong = { ...full, [blanks[0]]: other.id };
      expect(await graded(q, throughApi(q, wrong)), q.id).toBe(false);
    }
  });

  it('순서 맞추기: 정답이 아닌 순서·들여쓰기가 다른 줄·형태가 다른 값은 오답', async () => {
    let indentQuizzes = 0;
    for (const q of quizzes) {
      if (q.quiz.kind !== 'parsons') continue;
      const acc = q.answer.accepted as unknown[][];
      const base = acc[0];
      // 이웃한 두 줄을 바꾸면: 바꿔도 되는 줄(accepted 에 그 순서가 있음)만 정답, 나머지는 오답
      let wrongSwaps = 0;
      for (let i = 0; i + 1 < base.length; i++) {
        const swapped = [...base];
        [swapped[i], swapped[i + 1]] = [swapped[i + 1], swapped[i]];
        const listed = acc.some(
          (a) => JSON.stringify(a) === JSON.stringify(swapped),
        );
        expect(await graded(q, throughApi(q, swapped)), q.id).toBe(listed);
        if (!listed) wrongSwaps++;
      }
      expect(wrongSwaps, q.id).toBeGreaterThan(0);
      expect(await graded(q, throughApi(q, [...base].reverse())), q.id).toBe(
        false,
      );
      if (q.quiz.indent) {
        indentQuizzes++;
        const rows = base as { id: string; indent: number }[];
        const bumped = rows.map((r, i) =>
          i === rows.length - 1 ? { ...r, indent: r.indent + 1 } : r,
        );
        expect(await graded(q, throughApi(q, bumped)), q.id).toBe(false);
        // indent 퀴즈에 줄 id 만 보내면 다른 정규형이라 오답
        expect(
          await graded(
            q,
            throughApi(
              q,
              rows.map((r) => r.id),
            ),
          ),
          q.id,
        ).toBe(false);
      } else {
        // 들여쓰기 없는 퀴즈에 {id, indent: 0} 을 보내도 오답
        const asObj = (base as string[]).map((id) => ({ id, indent: 0 }));
        expect(await graded(q, throughApi(q, asObj)), q.id).toBe(false);
      }
    }
    expect(indentQuizzes).toBeGreaterThan(0);
  });

  it('버그 찾기: 줄만 맞거나 수정안만 맞으면 오답, 다른 키가 붙으면 API 가 거절', async () => {
    for (const q of quizzes) {
      if (q.quiz.kind !== 'bug_hunt') continue;
      const { line, fix } = q.answer.accepted[0] as {
        line: string;
        fix: string;
      };
      const otherFix = q.quiz.fixes.find((f) => f.id !== fix)!.id;
      const otherLine = q.quiz.lines.find((l) => l.id !== line)!.id;
      expect(await graded(q, throughApi(q, { line, fix: otherFix }))).toBe(
        false,
      );
      expect(await graded(q, throughApi(q, { line: otherLine, fix }))).toBe(
        false,
      );
      expect(throughApi(q, { line, fix, extra: 'opt-a1b1' })).toBeNull();
    }
  });

  it('입력 컴포넌트 값 타입(QuizValueMap)은 API 요청 answer 타입에 들어감', () => {
    expectTypeOf<
      QuizValueMap[keyof QuizValueMap]
    >().toExtend<QuizAnswerValue>();
  });
});

describe('보기 섞기: 위치가 아니라 id 로 채점', () => {
  it('여러 난수 시퀀스: 같은 id 집합, bug_hunt 코드 줄 순서 고정, 원본 그대로', () => {
    for (const q of quizzes) {
      const before = JSON.stringify(q.quiz);
      const orders = new Set<string>();
      for (const seed of SEEDS) {
        const out = shuffleQuiz(q.quiz, seeded(seed));
        expect(out.kind).toBe(q.quiz.kind);
        const a = ids(q.quiz);
        const b = ids(out);
        for (const k of Object.keys(a))
          expect([...b[k]].sort(), `${q.id} ${k}`).toEqual([...a[k]].sort());
        if (out.kind === 'bug_hunt' && q.quiz.kind === 'bug_hunt')
          expect(out.lines).toEqual(q.quiz.lines);
        orders.add(JSON.stringify(b));
      }
      expect(JSON.stringify(q.quiz)).toBe(before);
      // 보기가 둘 이상이면 시퀀스 8개 중 한 번은 순서가 바뀜
      expect(orders.size, q.id).toBeGreaterThan(1);
    }
  });

  it('섞인 화면에서 id 로 고른 답 = 섞기 전 답 (같은 JSON, 정답 판정 그대로)', async () => {
    for (const q of quizzes) {
      const plain = throughApi(q, pickFrom(q.quiz, q.answer.accepted[0]));
      for (const seed of SEEDS) {
        const sent = throughApi(
          q,
          pickFrom(shuffleQuiz(q.quiz, seeded(seed)), q.answer.accepted[0]),
        );
        expect(JSON.stringify(sent), `${q.id} #${seed}`).toBe(
          JSON.stringify(plain),
        );
      }
      expect(await graded(q, plain), q.id).toBe(true);
    }
  });

  it('자리 기억으로는 못 풂: 객관식 정답 자리의 보기가 섞은 뒤엔 다른 보기인 경우가 있음', async () => {
    for (const q of quizzes) {
      if (q.quiz.kind !== 'multiple_choice') continue;
      const at = q.quiz.options.findIndex((o) => o.id === q.answer.accepted[0]);
      const results = await Promise.all(
        SEEDS.map((seed) => {
          const out = shuffleQuiz(q.quiz, seeded(seed));
          return out.kind === 'multiple_choice'
            ? graded(q, out.options[at].id)
            : false;
        }),
      );
      expect(results, q.id).toContain(false);
    }
  });
});

describe('복습 가능일: TS 날짜 판단 = SQL kst_date', () => {
  const originalTZ = process.env.TZ;
  afterAll(() => {
    vi.useRealTimers();
    if (originalTZ === undefined) delete process.env.TZ;
    else process.env.TZ = originalTZ;
  });

  // KST 자정(UTC 15:00) 앞뒤·연말·윤년·UTC 자정
  const instants = [
    '2026-11-09T14:59:59.999Z',
    '2026-11-09T15:00:00.000Z',
    '2026-11-10T00:00:00.000Z',
    '2026-11-10T14:59:59.999Z',
    '2026-11-10T15:00:00.000Z',
    '2026-12-31T14:59:59Z',
    '2026-12-31T15:00:00Z',
    '2028-02-28T15:00:00Z',
    '2028-02-29T15:00:00Z',
    // 한국에 서머타임이 있던 1987·88년 이후, 미국 서머타임 전환 시각
    '2026-03-08T10:00:00Z',
    '2026-11-01T09:00:00Z',
  ];
  const zones = [
    'UTC',
    'Asia/Seoul',
    'America/Los_Angeles',
    'Pacific/Kiritimati',
  ];

  it('toKstDateKey = public.kst_date (DB 세션 TimeZone·실행 TZ 를 바꿔도)', async () => {
    for (const tz of zones) {
      process.env.TZ = tz;
      await db.exec(`SET TimeZone = '${tz}'`);
      for (const t of instants) {
        const { rows } = await db.query<{ d: string }>(
          "SELECT to_char(public.kst_date($1::timestamptz), 'YYYY-MM-DD') AS d",
          [t],
        );
        expect(toKstDateKey(t), `${tz} ${t}`).toBe(rows[0].d);
      }
    }
  });

  it('날짜 키 문자열 비교(<) = SQL date 비교 (stars_judged_on < kst_today())', async () => {
    const keys = [
      '2026-11-09',
      '2026-11-10',
      '2026-12-31',
      '2027-01-01',
      '2028-02-29',
    ];
    for (const a of keys)
      for (const b of keys) {
        const { rows } = await db.query<{ lt: boolean }>(
          'SELECT $1::date < $2::date AS lt',
          [a, b],
        );
        expect(a < b, `${a} < ${b}`).toBe(rows[0].lt);
      }
  });

  // 00026 v_mode 와 같은 표: 판정일 null → first, < 오늘 → review, 그 밖(오늘·시계가 어긋난 미래) → practice
  it.each([
    // [지금(UTC), stars_judged_on, 기대 모드]
    ['2026-11-10T14:59:59.999Z', null, 'first'],
    ['2026-11-10T14:59:59.999Z', '2026-11-10', 'practice'], // KST 11-10 23:59:59.999
    ['2026-11-10T15:00:00.000Z', '2026-11-10', 'review'], // KST 11-11 00:00 → 다음 날
    ['2026-11-10T15:00:00.000Z', '2026-11-11', 'practice'],
    ['2026-11-10T00:00:00.000Z', '2026-11-10', 'practice'], // UTC 로는 날이 바뀌었지만 KST 같은 날
    ['2026-11-09T23:59:59.999Z', '2026-11-09', 'review'], // KST 11-10 08:59 (UTC 로는 아직 11-09)
    ['2026-12-31T15:00:00Z', '2026-12-31', 'review'], // 연말 경계
    ['2026-11-10T03:00:00Z', '2026-11-12', 'practice'], // 판정일이 미래(시계 어긋남)
  ] as const)(
    '지금 %s · 판정일 %s → %s (실행 TZ 무관)',
    async (now, judged, mode) => {
      const { rows } = await db.query<{ m: string }>(
        `SELECT CASE WHEN $1::date IS NULL THEN 'first'
                     WHEN $1::date < public.kst_date($2::timestamptz) THEN 'review'
                     ELSE 'practice' END AS m`,
        [judged, now],
      );
      expect(rows[0].m).toBe(mode);
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(now));
      for (const tz of zones) {
        process.env.TZ = tz;
        // 기본 today(지금 KST) 그대로
        expect(quizEntryMode({ stars_judged_on: judged }), tz).toBe(mode);
      }
      vi.useRealTimers();
    },
  );
});
