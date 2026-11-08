/**
 * 랜딩 세계관 섹션의 "스테이지 N곳 · 퀘스트 N개"를 콘텐츠 원본(`content/worlds/`)에서 센다 (P4-04, 하드코딩 숫자 금지).
 *
 * - 서버 전용(Node `fs`). 랜딩은 정적 렌더 페이지라 `next build` 때 한 번 센다 → 콘텐츠가 바뀌면 다음 빌드에 반영
 * - 파일 이름만 센다: 정답·힌트·풀이가 든 퀘스트 YAML 내용은 읽지 않는다(월드 순서를 찾으려 `world.yaml`만 읽음)
 * - 규칙은 `src/lib/content/load.ts`와 같다(스테이지 = `NN-slug/` + `stage.yaml`, 퀘스트 = `NN-slug.yaml`).
 *   같은 결과인지는 `__tests__/worldStats.test.ts`가 로더와 비교한다. 로더를 직접 import하지 않는 이유:
 *   랜딩 글꼴 서브셋이 import를 따라가며 문자열을 모으는데(scripts/fonts/landing-text.mjs) 로더의 오류 문구까지 들어간다
 * - 읽지 못하면 null → 화면은 숫자 없이 "지금 열려 있어요"만 보여 준다(랜딩 빌드를 깨지 않음)
 */
import 'server-only';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

export interface WorldStats {
  stages: number;
  quests: number;
}

const STAGE_DIR = /^\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const QUEST_FILE = /^\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*\.yaml$/;

const isDir = (p: string) => existsSync(p) && statSync(p).isDirectory();

/** `order`번 월드의 스테이지·퀘스트 수. 월드가 없거나 읽지 못하면 null */
export function countWorldContent(
  order: number,
  contentDir: string = join(process.cwd(), 'content'),
): WorldStats | null {
  try {
    const worldsDir = join(contentDir, 'worlds');
    for (const name of readdirSync(worldsDir).sort()) {
      const worldDir = join(worldsDir, name);
      const worldFile = join(worldDir, 'world.yaml');
      if (!isDir(worldDir) || !existsSync(worldFile)) continue;
      const meta: unknown = parse(readFileSync(worldFile, 'utf8'));
      if (
        typeof meta !== 'object' ||
        meta === null ||
        (meta as { order?: unknown }).order !== order
      ) {
        continue;
      }
      let stages = 0;
      let quests = 0;
      for (const stageName of readdirSync(worldDir).sort()) {
        const stageDir = join(worldDir, stageName);
        if (
          !STAGE_DIR.test(stageName) ||
          !isDir(stageDir) ||
          !existsSync(join(stageDir, 'stage.yaml'))
        ) {
          continue;
        }
        stages += 1;
        quests += readdirSync(stageDir).filter((f) =>
          QUEST_FILE.test(f),
        ).length;
      }
      return stages > 0 ? { stages, quests } : null;
    }
  } catch {
    // 콘텐츠 디렉토리가 없는 환경: 숫자 없이 그린다
  }
  return null;
}
