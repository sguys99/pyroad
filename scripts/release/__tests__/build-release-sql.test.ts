import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ALREADY_APPLIED,
  RELEASES,
  assertReleases,
  buildReleases,
  migrationFiles,
} from '../build-release-sql.mjs';

type Bundle = { file: string; stage: number; head: string[]; parts: string[] };
type Release = { name: string; dir: string; bundles: Bundle[] };

const releases = RELEASES as Release[];

describe('운영 SQL Editor 붙여넣기 묶음 (B39)', () => {
  it('모든 마이그레이션이 어느 릴리즈 묶음에 한 번씩 들어 있다 (새 파일은 RELEASES·런북 표에 추가)', () => {
    const files = migrationFiles();
    expect(() => assertReleases(files)).not.toThrow();
    const listed = releases
      .flatMap((r) => r.bundles.flatMap((b) => b.parts))
      .filter((p) => p !== 'seed');
    expect([...ALREADY_APPLIED, ...listed].sort()).toEqual(
      [...files.keys()].sort(),
    );
  });

  it('묶음에 빠진 파일·단계가 다른 파일을 잡는다', () => {
    const files = migrationFiles();
    const withoutLast = releases.map((r) => ({
      ...r,
      bundles: r.bundles.map((b) => ({
        ...b,
        parts: b.parts.filter((p) => p !== '00020'),
      })),
    }));
    expect(() => assertReleases(files, withoutLast)).toThrow(
      /묶음에 없는 마이그레이션: 00020/,
    );
    const twice = [
      ...releases,
      {
        name: 'x',
        dir: 'x',
        bundles: [{ file: 'a.sql', stage: 1, head: [], parts: ['00020'] }],
      },
    ];
    expect(() => assertReleases(files, twice)).toThrow(/두 번 들어간/);
    // ③ 묶음(00005·08…)을 ① 로 표시하면 머리 주석과 달라 거부
    const stageOnly = releases.map((r) => ({
      ...r,
      bundles: r.bundles.map((b) => ({
        ...b,
        stage: b.file === '2_두번째실행.sql' ? 1 : b.stage,
      })),
    }));
    expect(() => assertReleases(files, stageOnly)).toThrow(/릴리즈 단계/);
  });

  it('v0.4 묶음은 release-sql/ 바로 아래, 이후 릴리즈는 하위 폴더에 적용 순서대로 쓴다', () => {
    const out = mkdtempSync(join(tmpdir(), 'pyroad-release-'));
    const written = buildReleases({ out }).map((p: string) => relative(out, p));
    expect(written).toEqual([
      '1_먼저실행.sql',
      '2_두번째실행.sql',
      '3_선택.sql',
      join('v0.5-phase2', '1_먼저실행.sql'),
      join('v0.4-phase3', '1_먼저실행.sql'),
      join('v0.4-phase3', '2_두번째실행.sql'),
      join('v0.5-phase5', '1_먼저실행.sql'),
      join('v0.6-phase7', '1_먼저실행.sql'),
    ]);
    const phase2 = readFileSync(
      join(out, 'v0.5-phase2', '1_먼저실행.sql'),
      'utf8',
    );
    expect(phase2).toMatch(/\nBEGIN;\n\n-- ===== 00020 =====\n/);
    expect(phase2).toMatch(/patch_user_settings/);
    expect(phase2.endsWith('\nCOMMIT;\n')).toBe(true);
    expect(phase2).not.toContain('\r');
    // Phase 3 ①: 00021 다음 00023(온보딩, P3-11). ③ 00022 는 2_두번째실행
    const phase3 = readFileSync(
      join(out, 'v0.4-phase3', '1_먼저실행.sql'),
      'utf8',
    );
    expect(phase3.indexOf('-- ===== 00021 =====')).toBeGreaterThan(0);
    expect(phase3.indexOf('-- ===== 00023 =====')).toBeGreaterThan(
      phase3.indexOf('-- ===== 00021 ====='),
    );
    expect(phase3).toMatch(/complete_onboarding/);
    // 00024(P3-15)는 00023 뒤 (complete_onboarding 을 9인자로 다시 정의)
    expect(phase3.indexOf('-- ===== 00024 =====')).toBeGreaterThan(
      phase3.indexOf('-- ===== 00023 ====='),
    );
    expect(phase3).not.toContain('-- ===== 00022 =====');
    // Phase 7 ①: 00026(퀴즈 채점) 다음 00027(reset_progress 가 퀴즈 시도 기록도 지움, B50)
    const phase7 = readFileSync(
      join(out, 'v0.6-phase7', '1_먼저실행.sql'),
      'utf8',
    );
    expect(phase7.indexOf('-- ===== 00026 =====')).toBeGreaterThan(0);
    expect(phase7.indexOf('-- ===== 00027 =====')).toBeGreaterThan(
      phase7.indexOf('-- ===== 00026 ====='),
    );
    expect(phase7).toMatch(/DELETE FROM public\.quiz_attempts/);
  });

  it('--release 로 고른 릴리즈만, --crlf 면 모든 줄바꿈이 CRLF', () => {
    const out = mkdtempSync(join(tmpdir(), 'pyroad-release-'));
    const written = buildReleases({
      out,
      crlf: true,
      releases: ['v0.5-phase2'],
    });
    expect(written.map((p: string) => relative(out, p))).toEqual([
      join('v0.5-phase2', '1_먼저실행.sql'),
    ]);
    const text = readFileSync(written[0], 'utf8');
    expect(text).toContain('\r\n');
    expect(text.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
    expect(() => buildReleases({ out, releases: ['v9.9'] })).toThrow(
      /모르는 릴리즈/,
    );
  });
});
