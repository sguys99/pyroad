// content/ 디렉토리를 읽어 스키마로 검사한다 (Node 전용: 빌드 스크립트·테스트에서만 import)
//
// 구조 (§2.4)
//   content/worlds/<world-slug>/world.yaml
//   content/worlds/<world-slug>/map.yaml           (지도 설정, P5-03. 스테이지가 있는 월드는 필수)
//   content/worlds/<world-slug>/<NN>-<stage-slug>/stage.yaml
//   content/worlds/<world-slug>/<NN>-<stage-slug>/<NN>-<quest-slug>.yaml
// NN(두 자리)은 YAML 안의 order 와 같아야 합니다. 정렬·탐색용이고, 원본 값은 YAML 의 order 입니다.

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse as parseYaml } from 'yaml';

import {
  parseQuest,
  parseWith,
  StageSchema,
  WorldMapSchema,
  WorldSchema,
  type Quest,
  type Stage,
  type World,
  type WorldMapConfig,
} from './schema';

export interface LoadedQuest {
  file: string;
  quest: Quest;
}

export interface LoadedStage {
  file: string;
  stage: Stage;
  quests: LoadedQuest[];
}

export interface LoadedWorld {
  file: string;
  world: World;
  /** map.yaml. 스테이지가 없는 "준비 중" 월드는 없어도 됨 */
  map: WorldMapConfig | null;
  stages: LoadedStage[];
}

export interface ContentTree {
  worlds: LoadedWorld[];
  /** 읽은 YAML 파일 전체(경로·내용)의 sha256 앞 16자. 생성물 머리에 적어 원본과 어긋났는지 확인 */
  hash: string;
  files: string[];
}

export class ContentError extends Error {
  constructor(public readonly problems: string[]) {
    super(
      `콘텐츠 검사 실패 (${problems.length}건)\n${problems.map((p) => `  - ${p}`).join('\n')}`,
    );
    this.name = 'ContentError';
  }
}

const NUMBERED = /^(\d{2})-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const QUEST_FILE = /^(\d{2})-[a-z0-9]+(?:-[a-z0-9]+)*\.yaml$/;

/** content/ 를 읽고 검사한다. 문제가 하나라도 있으면 모두 모아 ContentError 로 던진다 */
export function loadContent(contentDir: string): ContentTree {
  const problems: string[] = [];
  const files: string[] = [];
  const rel = (p: string) => relative(contentDir, p);

  const readYaml = (path: string): unknown => {
    files.push(path);
    try {
      return parseYaml(readFileSync(path, 'utf8'));
    } catch (error) {
      problems.push(
        `${rel(path)}: YAML 문법 오류 — ${(error as Error).message}`,
      );
      return undefined;
    }
  };

  /** map.yaml 검사: 레이아웃마다 노드 수 = 스테이지 수 (P5-03) */
  const loadMap = (
    mapFile: string,
    stageCount: number,
  ): WorldMapConfig | null => {
    if (!existsSync(mapFile)) {
      if (stageCount > 0) {
        problems.push(
          `${rel(mapFile)}: 스테이지가 있는 월드는 지도 설정(map.yaml)이 있어야 해요`,
        );
      }
      return null;
    }
    const map = parseWith(WorldMapSchema, readYaml(mapFile));
    if (!map.ok) {
      problems.push(...map.errors.map((e) => `${rel(mapFile)} ${e}`));
      return null;
    }
    for (const [name, layout] of Object.entries(map.value.layouts)) {
      if (layout.nodes.length !== stageCount) {
        problems.push(
          `${rel(mapFile)} layouts.${name}.nodes: 노드 ${layout.nodes.length}개가 스테이지 수(${stageCount})와 달라요`,
        );
      }
    }
    return map.value;
  };

  const worldsDir = join(contentDir, 'worlds');
  if (!existsSync(worldsDir)) {
    throw new ContentError([`${rel(worldsDir)} 디렉토리가 없어요`]);
  }

  const worlds: LoadedWorld[] = [];
  for (const worldName of subdirs(worldsDir)) {
    const worldDir = join(worldsDir, worldName);
    const worldFile = join(worldDir, 'world.yaml');
    if (!existsSync(worldFile)) {
      problems.push(`${rel(worldDir)}: world.yaml 이 없어요`);
      continue;
    }
    const world = parseWith(WorldSchema, readYaml(worldFile));
    if (!world.ok) {
      problems.push(...world.errors.map((e) => `${rel(worldFile)} ${e}`));
      continue;
    }
    if (world.value.slug !== worldName) {
      problems.push(
        `${rel(worldFile)}: slug(${world.value.slug})가 디렉토리 이름(${worldName})과 달라요`,
      );
    }

    const stages: LoadedStage[] = [];
    for (const stageName of subdirs(worldDir)) {
      const stageDir = join(worldDir, stageName);
      const stageNo = NUMBERED.exec(stageName);
      if (!stageNo) {
        problems.push(
          `${rel(stageDir)}: 스테이지 디렉토리 이름은 NN-<영문-슬러그> 형식이어야 해요 (예: 01-python-village)`,
        );
        continue;
      }
      const stageFile = join(stageDir, 'stage.yaml');
      if (!existsSync(stageFile)) {
        problems.push(`${rel(stageDir)}: stage.yaml 이 없어요`);
        continue;
      }
      const stage = parseWith(StageSchema, readYaml(stageFile));
      if (!stage.ok) {
        problems.push(...stage.errors.map((e) => `${rel(stageFile)} ${e}`));
        continue;
      }
      if (stage.value.order !== Number(stageNo[1])) {
        problems.push(
          `${rel(stageFile)}: order(${stage.value.order})가 디렉토리 번호(${stageNo[1]})와 달라요`,
        );
      }

      const quests: LoadedQuest[] = [];
      for (const fileName of readdirSync(stageDir).sort()) {
        const questFile = join(stageDir, fileName);
        if (fileName === 'stage.yaml' || statSync(questFile).isDirectory()) {
          continue;
        }
        const questNo = QUEST_FILE.exec(fileName);
        if (!questNo) {
          problems.push(
            `${rel(questFile)}: 퀘스트 파일 이름은 NN-<영문-슬러그>.yaml 형식이어야 해요 (예: 01-first-greeting.yaml)`,
          );
          continue;
        }
        const quest = parseQuest(readYaml(questFile));
        if (!quest.ok) {
          problems.push(...quest.errors.map((e) => `${rel(questFile)} ${e}`));
          continue;
        }
        if (quest.value.order !== Number(questNo[1])) {
          problems.push(
            `${rel(questFile)}: order(${quest.value.order})가 파일 번호(${questNo[1]})와 달라요`,
          );
        }
        quests.push({ file: questFile, quest: quest.value });
      }
      if (quests.length === 0) {
        problems.push(`${rel(stageDir)}: 퀘스트 파일이 없어요`);
      }
      stages.push({ file: stageFile, stage: stage.value, quests });
    }
    const map = loadMap(join(worldDir, 'map.yaml'), stages.length);
    worlds.push({ file: worldFile, world: world.value, map, stages });
  }

  if (worlds.length === 0) problems.push('월드가 하나도 없어요');
  problems.push(...checkUniqueness(worlds, rel));
  if (problems.length > 0) throw new ContentError(problems);

  const hash = createHash('sha256');
  for (const file of [...files].sort()) {
    hash.update(rel(file)).update('\0').update(readFileSync(file)).update('\0');
  }
  return {
    worlds,
    hash: hash.digest('hex').slice(0, 16),
    files: files.map(rel).sort(),
  };
}

/** id·order 중복 검사 (DB 의 PK·UNIQUE 제약과 같은 범위) */
function checkUniqueness(
  worlds: LoadedWorld[],
  rel: (p: string) => string,
): string[] {
  const problems: string[] = [];
  const seen = new Map<string, string>();
  const claim = (key: string, file: string, label: string) => {
    const prev = seen.get(key);
    if (prev) problems.push(`${rel(file)}: ${label}가 ${rel(prev)}와 겹쳐요`);
    else seen.set(key, file);
  };

  for (const w of worlds) {
    claim(
      `world.order:${w.world.order}`,
      w.file,
      `월드 order(${w.world.order})`,
    );
    for (const s of w.stages) {
      claim(`id:${s.stage.id}`, s.file, `id(${s.stage.id})`);
      // stages."order" 는 월드 안에서 UNIQUE (world_id, "order"), P1-08
      claim(
        `stage.order:${w.world.slug}:${s.stage.order}`,
        s.file,
        `스테이지 order(${s.stage.order})`,
      );
      for (const q of s.quests) {
        claim(`id:${q.quest.id}`, q.file, `id(${q.quest.id})`);
        claim(
          `quest.order:${s.stage.id}:${q.quest.order}`,
          q.file,
          `퀘스트 order(${q.quest.order})`,
        );
      }
    }
  }
  return problems;
}

function subdirs(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => statSync(join(dir, name)).isDirectory())
    .sort();
}
