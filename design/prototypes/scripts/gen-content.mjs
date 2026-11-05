// content/worlds/ 의 실제 퀘스트 문구를 시안용 JSON으로 뽑는다 → src/shared/content.gen.json
//   node scripts/gen-content.mjs
// 공개 문구만 담는다: 정답(answer: validation·hints·solution_code)과 정답이 드러나는
// fallback_text·expected_output_hint는 넣지 않는다 (CLAUDE.md: 정답·힌트는 클라이언트로 내려보내지 않음).
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const REPO = join(ROOT, '..', '..');
const WORLDS = join(REPO, 'content', 'worlds');
const OUT = join(ROOT, 'src', 'shared', 'content.gen.json');

const read = (p) => parse(readFileSync(p, 'utf8'));
const dirs = (p) => readdirSync(p, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();

export function genContent() {
  const worlds = dirs(WORLDS).map((slug) => {
    const w = read(join(WORLDS, slug, 'world.yaml'));
    const stages = dirs(join(WORLDS, slug)).map((sd) => {
      const s = read(join(WORLDS, slug, sd, 'stage.yaml'));
      const quests = readdirSync(join(WORLDS, slug, sd))
        .filter((f) => f.endsWith('.yaml') && f !== 'stage.yaml')
        .sort()
        .map((f) => {
          const q = read(join(WORLDS, slug, sd, f));
          const p = q.prompt ?? {};
          return {
            order: q.order,
            title: q.title,
            concept: q.concept,
            xp: q.xp_reward,
            type: q.quest_type,
            challenge: Boolean(p.is_challenge),
            topic: p.topic ?? '',
            goals: p.learning_goals ?? [],
            story: p.story_context ?? '',
            task: p.exercise_description ?? '',
            starter: (p.starter_code ?? '').replace(/\s+$/, ''),
          };
        });
      return { order: s.order, title: s.title, theme: s.theme_name, description: s.description, final: Boolean(s.is_final), quests };
    });
    return { slug: w.slug, order: w.order, title: w.title, theme: w.theme, description: w.description, stages };
  });
  const json = { generatedFrom: 'content/worlds (공개 문구만, 정답·힌트 제외)', worlds };
  writeFileSync(OUT, JSON.stringify(json, null, 1) + '\n');
  return json;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const j = genContent();
  const n = j.worlds.reduce((a, w) => a + w.stages.reduce((b, s) => b + s.quests.length, 0), 0);
  console.log(`content → ${OUT} (월드 ${j.worlds.length}, 퀘스트 ${n})`);
}
