import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { stringify } from 'yaml';

import { ContentError, loadContent } from '../load';
import { codeQuest } from './fixtures';

const WORLD = {
  slug: 'python-island',
  order: 1,
  title: '파이썬 섬',
  theme: 'python_island',
  description: '',
  unlock_rule: { type: 'open' },
};
const STAGE = {
  id: 'a1000000-0000-0000-0000-000000000001',
  order: 1,
  title: '파이썬 마을 입구',
  theme_name: 'python_village',
  description: '',
  is_final: false,
};

/** 임시 content/ 를 만든다. files: content/worlds/python-island 아래 상대 경로 → 값(문자열이면 그대로) */
function makeContent(files: Record<string, unknown>): string {
  const root = mkdtempSync(join(tmpdir(), 'pyroad-content-'));
  for (const [rel, value] of Object.entries(files)) {
    const path = join(root, 'worlds/python-island', rel);
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, typeof value === 'string' ? value : stringify(value));
  }
  return root;
}

const problemsOf = (dir: string) => {
  try {
    loadContent(dir);
    return [];
  } catch (error) {
    if (error instanceof ContentError) return error.problems;
    throw error;
  }
};

describe('loadContent', () => {
  it('정상 구조를 읽고 해시를 만듦', () => {
    const dir = makeContent({
      'world.yaml': WORLD,
      '01-python-village/stage.yaml': STAGE,
      '01-python-village/01-first-greeting.yaml': codeQuest(),
    });
    const tree = loadContent(dir);
    expect(tree.worlds[0].stages[0].quests[0].quest.title).toBe('첫 번째 인사');
    expect(tree.hash).toMatch(/^[0-9a-f]{16}$/);
    expect(loadContent(dir).hash).toBe(tree.hash);
  });

  it('이름·번호·중복 문제를 파일 경로와 함께 모두 모아 알려 줌', () => {
    const dir = makeContent({
      'world.yaml': WORLD,
      '01-python-village/stage.yaml': STAGE,
      '01-python-village/02-first-greeting.yaml': codeQuest(), // order 1 인데 파일 번호 02
      '01-python-village/03-copy.yaml': { ...codeQuest(), order: 3 }, // id 중복
      '01-python-village/첫인사.yaml': codeQuest(),
      '01-python-village/04-broken.yaml': 'id: [',
    });
    const problems = problemsOf(dir);
    expect(problems).toEqual(
      expect.arrayContaining([
        expect.stringMatching(
          /02-first-greeting\.yaml: order\(1\)가 파일 번호\(02\)와 달라요/,
        ),
        expect.stringMatching(
          /첫인사\.yaml: 퀘스트 파일 이름은 NN-<영문-슬러그>\.yaml/,
        ),
        expect.stringMatching(/04-broken\.yaml: YAML 문법 오류/),
        expect.stringMatching(
          /03-copy\.yaml: id\(b1000000-0000-0000-0000-000000000001\)가 .*02-first-greeting\.yaml와 겹쳐요/,
        ),
      ]),
    );
  });

  it('공개 부분에 정답을 쓴 파일은 경로와 키를 짚어 줌', () => {
    const q = codeQuest();
    const dir = makeContent({
      'world.yaml': WORLD,
      '01-python-village/stage.yaml': STAGE,
      '01-python-village/01-first-greeting.yaml': {
        ...q,
        prompt: { ...q.prompt, solution_code: 'print(1)' },
      },
    });
    expect(problemsOf(dir)[0]).toBe(
      'worlds/python-island/01-python-village/01-first-greeting.yaml prompt.solution_code: 정답 필드는 공개 부분(prompt)에 둘 수 없어요. answer 아래로 옮기세요',
    );
  });

  it('월드 slug 가 디렉토리 이름과 다르면 오류', () => {
    const dir = makeContent({
      'world.yaml': { ...WORLD, slug: 'code-sea' },
      '01-python-village/stage.yaml': STAGE,
      '01-python-village/01-first-greeting.yaml': codeQuest(),
    });
    expect(problemsOf(dir)).toEqual([
      'worlds/python-island/world.yaml: slug(code-sea)가 디렉토리 이름(python-island)과 달라요',
    ]);
  });
});
