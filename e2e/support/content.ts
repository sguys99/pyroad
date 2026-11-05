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
  fallbackText: string;
  hints: [string, string, string];
}

export interface E2eStage {
  id: string;
  order: number;
  title: string;
  quests: E2eQuest[];
}

interface QuestYaml {
  id: string;
  order: number;
  title: string;
  quest_type: string;
  prompt: { fallback_text: string };
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
      const quests = readdirSync(dir)
        .filter((f) => f.endsWith('.yaml') && f !== 'stage.yaml')
        .map((f) => parse(readFileSync(join(dir, f), 'utf8')) as QuestYaml)
        .filter((q) => q.quest_type === 'code')
        .map((q) => ({
          id: q.id,
          order: q.order,
          title: q.title,
          solution: (q.answer.solution_code ?? '').trim(),
          fallbackText: q.prompt.fallback_text.trim(),
          hints: [
            q.answer.hints.level_1,
            q.answer.hints.level_2,
            q.answer.hints.level_3,
          ] as [string, string, string],
        }))
        .sort((a, b) => a.order - b.order);
      return { id: stage.id, order: stage.order, title: stage.title, quests };
    })
    .sort((a, b) => a.order - b.order);
  return cache;
}

export function stage(order: number): E2eStage {
  const found = stages().find((s) => s.order === order);
  if (!found) throw new Error(`[e2e] 스테이지 ${order} 가 content/ 에 없음`);
  return found;
}
