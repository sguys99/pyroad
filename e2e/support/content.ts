// 퀘스트 콘텐츠 (content/ YAML, P1-11) 에서 e2e 가 쓰는 값을 읽는다. 콘텐츠가 바뀌어도 테스트를 고치지 않게
// 퀘스트 id·정답 코드·힌트를 하드코딩하지 않는다. seed.sql 은 이 YAML 의 생성물이라 로컬 DB 와 같다 (CI content job 이 확인).

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { REPO_ROOT } from './env';

const WORLD_DIR = join(REPO_ROOT, 'content/worlds/python-island');

export interface E2eQuest {
  id: string;
  order: number;
  title: string;
  solution: string;
  /** 처음 코드 (공책 첫 내용) */
  starter: string;
  fallbackText: string;
  /** 공개 해 볼 일 (P7-17) */
  checklist: string[];
  /** 공개 예시 출력 (결과 쪽지 견줘 보기, P7-17) */
  example: string;
  hints: [string, string, string];
}

export interface E2eStage {
  id: string;
  order: number;
  title: string;
  quests: E2eQuest[];
  /** 퀴즈(보너스, P7-12)까지 센 퀘스트 수. 헤더 스테이지 진행 점은 퀴즈도 하나씩 */
  questCount: number;
  /** 퀴즈(보너스) order 순 — 폰 퀴즈 추천(P7-11) */
  quizzes: { id: string; order: number; title: string; kind: string }[];
  /** 스테이지 보스 (P9-12, 마지막 관문). 없으면 null. quests 에는 들어가지 않음(정답 코드가 없음) */
  boss: { id: string; order: number; title: string } | null;
}

interface QuestYaml {
  id: string;
  order: number;
  title: string;
  quest_type: string;
  quiz_kind?: string;
  prompt: {
    fallback_text: string;
    checklist: string[];
    example_output: string;
    starter_code?: string;
  };
  answer: {
    solution_code?: string;
    hints: { level_1: string; level_2: string; level_3: string };
  };
}

let cache: E2eStage[] | null = null;

/** 첫 월드의 스테이지들 (order 순), 각 스테이지의 코드 퀘스트 (order 순) */
export function stages(): E2eStage[] {
  if (cache) return cache;
  cache = readdirSync(WORLD_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const dir = join(WORLD_DIR, d.name);
      const stage = parse(readFileSync(join(dir, 'stage.yaml'), 'utf8'));
      const all = readdirSync(dir)
        .filter((f) => f.endsWith('.yaml') && f !== 'stage.yaml')
        .map((f) => parse(readFileSync(join(dir, f), 'utf8')) as QuestYaml);
      const quests = all
        .filter((q) => q.quest_type === 'code')
        .map((q) => ({
          id: q.id,
          order: q.order,
          title: q.title,
          solution: (q.answer.solution_code ?? '').trim(),
          starter: (q.prompt.starter_code ?? '').trim(),
          fallbackText: q.prompt.fallback_text.trim(),
          checklist: q.prompt.checklist,
          example: q.prompt.example_output.trim(),
          hints: [
            q.answer.hints.level_1,
            q.answer.hints.level_2,
            q.answer.hints.level_3,
          ] as [string, string, string],
        }))
        .sort((a, b) => a.order - b.order);
      return {
        id: stage.id,
        order: stage.order,
        title: stage.title,
        quests,
        questCount: all.length,
        quizzes: all
          .filter((q) => q.quest_type === 'quiz')
          .map(({ id, order, title, quiz_kind }) => ({
            id,
            order,
            title,
            kind: quiz_kind ?? '',
          }))
          .sort((a, b) => a.order - b.order),
        boss:
          all
            .filter((q) => q.quest_type === 'boss')
            .map(({ id, order, title }) => ({ id, order, title }))[0] ?? null,
      };
    })
    .sort((a, b) => a.order - b.order);
  return cache;
}

export function stage(order: number): E2eStage {
  const found = stages().find((s) => s.order === order);
  if (!found) throw new Error(`[e2e] 스테이지 ${order} 가 content/ 에 없음`);
  return found;
}

/** 첫 월드의 모든 퀘스트(코드·프로젝트, 퀴즈 빼고) id. 월드를 다 깬 상태를 만들 때 (P5-01) */
export function allQuestIds(): string[] {
  return readdirSync(WORLD_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) => {
      const dir = join(WORLD_DIR, d.name);
      return readdirSync(dir)
        .filter((f) => f.endsWith('.yaml') && f !== 'stage.yaml')
        .map((f) => parse(readFileSync(join(dir, f), 'utf8')) as QuestYaml)
        .filter((q) => q.quest_type !== 'quiz')
        .map((q) => q.id);
    });
}

interface ProjectYaml {
  id: string;
  title: string;
  quest_type: string;
  steps: Array<{
    prompt: { step_goal: string; checklist: string[] };
    answer: { solution_code: string };
  }>;
}

/** 첫 월드의 프로젝트 퀘스트 (P6-12): 단계 목표와 단계마다의 정답 코드 */
export function projectQuest(): {
  id: string;
  title: string;
  steps: Array<{ goal: string; checklist: string[]; solution: string }>;
} {
  for (const d of readdirSync(WORLD_DIR, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const dir = join(WORLD_DIR, d.name);
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.yaml') || f === 'stage.yaml') continue;
      const q = parse(readFileSync(join(dir, f), 'utf8')) as ProjectYaml;
      if (q.quest_type !== 'project') continue;
      return {
        id: q.id,
        title: q.title,
        steps: q.steps.map((s) => ({
          goal: s.prompt.step_goal,
          checklist: s.prompt.checklist,
          solution: s.answer.solution_code.trim(),
        })),
      };
    }
  }
  throw new Error('[e2e] 프로젝트 퀘스트가 content/ 에 없음');
}
