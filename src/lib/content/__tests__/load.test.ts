import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { stringify } from 'yaml';

import { buildRows, toWorldInfos } from '../build';
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
/** 스테이지 1개짜리 월드의 지도 (P5-03) */
const MAP = {
  bgm: 'world1',
  path: 'catmull_rom',
  layouts: {
    wide: { width: 1200, height: 720, node_scale: 1, nodes: [[130, 600]] },
    tall: { width: 400, height: 1180, node_scale: 0.82, nodes: [[104, 1080]] },
  },
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
      'map.yaml': MAP,
      '01-python-village/stage.yaml': STAGE,
      '01-python-village/01-first-greeting.yaml': codeQuest(),
    });
    const tree = loadContent(dir);
    expect(tree.worlds[0].map?.layouts.tall.nodes).toEqual([[104, 1080]]);
    expect(tree.worlds[0].stages[0].quests[0].quest.title).toBe('첫 번째 인사');
    expect(tree.hash).toMatch(/^[0-9a-f]{16}$/);
    expect(loadContent(dir).hash).toBe(tree.hash);
  });

  it('퀘스트가 하나도 없는 월드는 지도만 먼저 만든 "준비 중": 통과하되 seed 에 스테이지를 넣지 않음 (P10-04)', () => {
    const draft = makeContent({
      'world.yaml': WORLD,
      'map.yaml': MAP,
      '01-python-village/stage.yaml': STAGE,
    });
    const tree = loadContent(draft);
    expect(buildRows(tree).rows.stages).toEqual([]);
    expect(toWorldInfos(tree)[0]).toMatchObject({ ready: false });
    expect(toWorldInfos(tree)[0].map).not.toBeNull();

    // 퀘스트가 생기면 모든 스테이지에 있어야 함
    const MAP2 = {
      ...MAP,
      layouts: {
        wide: {
          ...MAP.layouts.wide,
          nodes: [
            [130, 600],
            [330, 470],
          ],
        },
        tall: {
          ...MAP.layouts.tall,
          nodes: [
            [104, 1080],
            [292, 930],
          ],
        },
      },
    };
    const partial = makeContent({
      'world.yaml': WORLD,
      'map.yaml': MAP2,
      '01-python-village/stage.yaml': STAGE,
      '01-python-village/01-first-greeting.yaml': codeQuest(),
      '02-variable-forest/stage.yaml': {
        ...STAGE,
        id: 'a1000000-0000-0000-0000-000000000002',
        order: 2,
      },
    });
    expect(problemsOf(partial)).toEqual([
      expect.stringMatching(/02-variable-forest: 퀘스트 파일이 없어요/),
    ]);
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
      'map.yaml': MAP,
      '01-python-village/stage.yaml': STAGE,
      '01-python-village/01-first-greeting.yaml': codeQuest(),
    });
    expect(problemsOf(dir)).toEqual([
      'worlds/python-island/world.yaml: slug(code-sea)가 디렉토리 이름(python-island)과 달라요',
    ]);
  });
});

describe('map.yaml (P5-03)', () => {
  const stage2 = {
    ...STAGE,
    id: 'a1000000-0000-0000-0000-000000000002',
    order: 2,
  };
  const quest2 = { ...codeQuest(), id: 'b1000000-0000-0000-0000-000000000002' };

  it('레이아웃의 노드 수가 스테이지 수와 다르면 실패', () => {
    const dir = makeContent({
      'world.yaml': WORLD,
      'map.yaml': MAP,
      '01-python-village/stage.yaml': STAGE,
      '01-python-village/01-first-greeting.yaml': codeQuest(),
      '02-variable-forest/stage.yaml': stage2,
      '02-variable-forest/01-first-greeting.yaml': quest2,
    });
    expect(problemsOf(dir)).toEqual([
      'worlds/python-island/map.yaml layouts.wide.nodes: 노드 1개가 스테이지 수(2)와 달라요',
      'worlds/python-island/map.yaml layouts.tall.nodes: 노드 1개가 스테이지 수(2)와 달라요',
    ]);
  });

  it('스테이지가 있는데 map.yaml 이 없으면 실패', () => {
    const dir = makeContent({
      'world.yaml': WORLD,
      '01-python-village/stage.yaml': STAGE,
      '01-python-village/01-first-greeting.yaml': codeQuest(),
    });
    expect(problemsOf(dir)).toEqual([
      'worlds/python-island/map.yaml: 스테이지가 있는 월드는 지도 설정(map.yaml)이 있어야 해요',
    ]);
  });

  it('스테이지가 없는 "준비 중" 월드는 world.yaml 만으로 됨', () => {
    const dir = makeContent({
      'world.yaml': {
        ...WORLD,
        unlock_rule: { type: 'previous_world_cleared' },
      },
    });
    const [world] = loadContent(dir).worlds;
    expect(world.map).toBeNull();
    expect(world.stages).toEqual([]);
  });

  const problemsWithMap = (map: unknown) =>
    problemsOf(
      makeContent({
        'world.yaml': WORLD,
        'map.yaml': map,
        '01-python-village/stage.yaml': STAGE,
        '01-python-village/01-first-greeting.yaml': codeQuest(),
      }),
    ).join('\n');
  const withWide = (wide: object) => ({
    ...MAP,
    layouts: { ...MAP.layouts, wide: { ...MAP.layouts.wide, ...wide } },
  });

  it('지도 밖 노드·모르는 키·없는 BGM 은 실패', () => {
    expect(problemsWithMap(withWide({ nodes: [[1300, 600]] }))).toContain(
      'layouts.wide.nodes[0]: 노드가 지도(1200×720) 밖에 있어요',
    );
    expect(problemsWithMap(withWide({ extra: 1 }))).toMatch(/extra/);
    expect(problemsWithMap({ ...MAP, bgm: 'world9' })).toMatch(/bgm/);
  });
});
