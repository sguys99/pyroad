// 청취 검수 페이지에 넣을 오디오를 data URI(base64)로 모은다 → audio.gen.ts (gitignore, 빌드 전에 실행)
//   node src/sound-review/gen-audio.mjs && node build.mjs sound-review
// - 효과음: public/sounds/sfx/<id>.v<N>.webm (가장 높은 버전) + P0-15 초안 wrong·bug (spikes/p0-15-sound/sounds) 비교용
// - 배경음악 후보: .build/sound-review-bgm/<w1a…w3b>.webm (scripts/build-sounds.sh bgm-preview, Opus 48k).
//   원본 주소는 docs/assets-license.md §3. 없으면 그 후보는 "파일 없음"으로 표시
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROTO = join(HERE, '..', '..');
const REPO = join(PROTO, '..', '..');
const SFX_DIR = join(REPO, 'public/sounds/sfx');
const BGM_DIR = process.env.SOUND_REVIEW_BGM_DIR ?? join(PROTO, '.build/sound-review-bgm');

const SFX = ['tap', 'correct', 'wrong', 'coin', 'star', 'levelup', 'unlock', 'chest', 'run', 'bug', 'blip', 'celebrate'];
const BGM = ['w1a', 'w1b', 'w2a', 'w2b', 'w3a', 'w3b'];

const dur = (f) =>
  Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim());

function latest(id) {
  const files = readdirSync(SFX_DIR).filter((f) => f.startsWith(`${id}.v`) && f.endsWith('.webm'));
  files.sort((a, b) => Number(a.split('.v')[1].split('.')[0]) - Number(b.split('.v')[1].split('.')[0]));
  return files.at(-1) ? join(SFX_DIR, files.at(-1)) : null;
}

const out = {};
const add = (key, file) => {
  if (!file || !existsSync(file)) return console.warn(`  (없음) ${key}`);
  const buf = readFileSync(file);
  out[key] = { b64: buf.toString('base64'), bytes: buf.length, dur: Math.round(dur(file) * 1000) / 1000, file: file.replace(REPO + '/', '') };
};
for (const id of SFX) add(`sfx:${id}`, latest(id));
add('sfx:wrong-p015', join(REPO, 'spikes/p0-15-sound/sounds/wrong.webm'));
add('sfx:bug-p015', join(REPO, 'spikes/p0-15-sound/sounds/bug.webm'));
for (const id of BGM) add(`bgm:${id}`, join(BGM_DIR, `${id}.webm`));

const total = Object.values(out).reduce((n, v) => n + v.b64.length, 0);
writeFileSync(
  join(HERE, 'audio.gen.ts'),
  `// gen-audio.mjs 가 만든 파일 (gitignore). 직접 고치지 마세요\nexport const AUDIO: Record<string, { b64: string; bytes: number; dur: number; file: string }> = ${JSON.stringify(out)};\n`,
);
console.log(`audio.gen.ts: ${Object.keys(out).length}개, base64 ${(total / 1024 / 1024).toFixed(2)}MB`);
