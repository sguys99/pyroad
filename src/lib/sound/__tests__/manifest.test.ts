import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SFX_USES, SOUND_MANIFEST } from '../manifest';
import { STEP_SPECS } from '@/lib/celebration/plan';
import { getSoundEngine } from '../index';

const PUBLIC = join(process.cwd(), 'public');
const all = [
  ...Object.values(SOUND_MANIFEST.sfx),
  ...Object.values(SOUND_MANIFEST.bgm),
].flatMap((d) => d.src);

describe('사운드 매니페스트 (P2-14)', () => {
  it('효과음 12종 + BGM 3곡, 쓰임 설명이 모두 있음', () => {
    expect(Object.keys(SOUND_MANIFEST.sfx)).toHaveLength(12);
    expect(Object.keys(SOUND_MANIFEST.bgm)).toEqual([
      'world1',
      'world2',
      'world3',
    ]);
    expect(Object.keys(SFX_USES).sort()).toEqual(
      Object.keys(SOUND_MANIFEST.sfx).sort(),
    );
  });

  it('가리키는 파일이 public/sounds에 모두 있고, 이름에 버전이 있으며 WebM(Opus) → AAC 순서 (MP3 없음)', () => {
    for (const url of all) {
      expect(url).toMatch(/^\/sounds\/(sfx|bgm)\/[a-z0-9]+\.v\d+\.(webm|m4a)$/);
      const file = join(PUBLIC, url);
      expect(existsSync(file), url).toBe(true);
      expect(statSync(file).size, url).toBeGreaterThan(500);
    }
    for (const def of [
      ...Object.values(SOUND_MANIFEST.sfx),
      ...Object.values(SOUND_MANIFEST.bgm),
    ]) {
      expect(def.src.map((u) => u.split('.').pop())).toEqual(['webm', 'm4a']);
    }
  });

  it('public/sounds 에 MP3 없음 (WebKit 패딩, P0-15 §4.4)', () => {
    for (const dir of ['sfx', 'bgm']) {
      const files = readdirSync(join(PUBLIC, 'sounds', dir));
      expect(files.filter((f) => f.endsWith('.mp3'))).toEqual([]);
    }
  });

  it('축하 시퀀서가 쓰는 효과음 키가 매니페스트에 있음', () => {
    for (const spec of Object.values(STEP_SPECS)) {
      if (spec.sfx) expect(SOUND_MANIFEST.sfx).toHaveProperty(spec.sfx);
    }
  });

  it('서버(window 없음)에서는 no-op 엔진 — Web Audio에 손대지 않음', () => {
    const engine = getSoundEngine(SOUND_MANIFEST);
    expect(engine.kind).toBe('noop');
    expect(engine.getSnapshot().state).toBe('unsupported');
    expect(() => {
      engine.unlock();
      engine.play('correct');
      engine.playBgm('world1');
    }).not.toThrow();
  });
});
