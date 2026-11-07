import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PYBAEM_PALETTES } from '@/components/characters/rig';
import {
  DEFAULT_SKIN_ID,
  PYBAEM_SKINS,
  SKIN_IDS,
  getSkin,
  isSkinId,
  skinFromAvatarConfig,
  skinPalette,
} from '../skins';

const MIG = resolve(__dirname, '../../../../supabase/migrations');

/** 스킨 id 목록을 담은 SQL 배열 리터럴 (ARRAY['green', …]) — 가장 최근 마이그레이션 기준 */
function sqlSkinLists(): { file: string; lists: string[][] } {
  const files = readdirSync(MIG)
    .filter((f) => /^\d{5}_.*\.sql$/.test(f))
    .sort();
  for (const file of files.reverse()) {
    const sql = readFileSync(join(MIG, file), 'utf8');
    const lists = [...sql.matchAll(/ARRAY\[([^\]]*)\]::TEXT\[\]/gi)]
      .map((m) => [...m[1].matchAll(/'([^']*)'/g)].map((x) => x[1]))
      .filter((l) => l.includes('green'));
    if (lists.length) return { file, lists };
  }
  return { file: '', lists: [] };
}

// ── 색각 시뮬레이션 (Machado 2009, severity 1.0) + CIE Lab 거리 ──
type M3 = [number, number, number][];
const CVD: Record<string, M3> = {
  normal: [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritan: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};
const lin = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
function lab(hex: string, m: M3): [number, number, number] {
  const c = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16)));
  const [r, g, b] = m.map((row) =>
    Math.min(1, Math.max(0, row[0] * c[0] + row[1] * c[1] + row[2] * c[2])),
  );
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const X = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
  const Y = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
  const Z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
}
const dE = (a: number[], b: number[]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('파이뱀 스킨 카탈로그 (P3-13)', () => {
  it('6종, id·이름이 겹치지 않고 카탈로그 순서 = SKIN_IDS', () => {
    expect(PYBAEM_SKINS.map((s) => s.id)).toEqual([...SKIN_IDS]);
    expect(SKIN_IDS).toHaveLength(6);
    expect(new Set(PYBAEM_SKINS.map((s) => s.name)).size).toBe(6);
    for (const s of PYBAEM_SKINS) expect(s.id).toMatch(/^[a-z]+$/);
  });

  it('DB 마이그레이션의 스킨 목록(CHECK·public_avatar_skin)과 같다', () => {
    const { file, lists } = sqlSkinLists();
    expect(file, '스킨 목록이 있는 마이그레이션').not.toBe('');
    // CHECK 제약 + 동기화 함수, 둘 다 같은 목록
    expect(lists.length).toBeGreaterThanOrEqual(2);
    for (const l of lists) expect(l).toEqual([...SKIN_IDS]);
  });

  it('기본(숲초록)은 리그 B 팔레트 그대로', () => {
    expect(DEFAULT_SKIN_ID).toBe('green');
    const B = PYBAEM_PALETTES.B;
    const p = skinPalette('green');
    for (const k of Object.keys(p) as (keyof typeof p)[])
      expect(p[k], k).toBe(B[k]);
  });

  it('모든 스킨이 같은 키를 덮어쓰고 색은 #RRGGBB', () => {
    const keys = Object.keys(PYBAEM_SKINS[0].palette).sort();
    for (const s of PYBAEM_SKINS) {
      expect(Object.keys(s.palette).sort()).toEqual(keys);
      for (const [k, v] of Object.entries(s.palette))
        if (k !== 'cheekAlpha')
          expect(v, `${s.id}.${k}`).toMatch(/^#[0-9A-F]{6}$/);
      // 볼이 0.7 아래면 몸색과 섞여 탁해짐 (rig.md §5)
      expect(Number(s.palette.cheekAlpha)).toBeGreaterThanOrEqual(0.7);
    }
  });

  it('외곽선은 몸색보다 어둡고(진한 톤), 배는 몸색보다 밝다', () => {
    for (const s of PYBAEM_SKINS) {
      const L = (h: string) => lab(h, CVD.normal)[0];
      expect(L(s.palette.outline), s.id).toBeLessThan(L(s.palette.body) - 15);
      expect(L(s.palette.belly), s.id).toBeGreaterThan(L(s.palette.body) + 5);
    }
  });

  it.each(Object.keys(CVD))(
    '몸색끼리 구분됨: %s 시뮬레이션에서 모든 쌍 ΔE ≥ 15',
    (kind) => {
      const m = CVD[kind];
      let min = Infinity;
      let pair = '';
      for (let i = 0; i < PYBAEM_SKINS.length; i++)
        for (let j = i + 1; j < PYBAEM_SKINS.length; j++) {
          const d = dE(
            lab(PYBAEM_SKINS[i].palette.body, m),
            lab(PYBAEM_SKINS[j].palette.body, m),
          );
          if (d < min)
            [min, pair] = [d, `${PYBAEM_SKINS[i].id}/${PYBAEM_SKINS[j].id}`];
        }
      expect(min, pair).toBeGreaterThanOrEqual(15);
    },
  );

  it('id 판별·모르는 값은 기본', () => {
    expect(isSkinId('sky')).toBe(true);
    expect(isSkinId('gold')).toBe(false);
    expect(isSkinId(null)).toBe(false);
    expect(isSkinId('toString')).toBe(false);
    expect(getSkin('violet').name).toBe('보라별');
    expect(getSkin('rainbow').id).toBe('green');
    expect(getSkin(undefined).id).toBe('green');
  });

  it('avatar_config → 스킨 (DB public_avatar_skin 과 같은 규칙)', () => {
    expect(skinFromAvatarConfig({ skin: 'berry', hat: 'crown' })).toBe('berry');
    expect(skinFromAvatarConfig({ skin: 'gold' })).toBe('green');
    expect(skinFromAvatarConfig({ skin: ['sky'] })).toBe('green');
    expect(skinFromAvatarConfig({})).toBe('green');
    expect(skinFromAvatarConfig(null)).toBe('green');
    expect(skinFromAvatarConfig(['sky'])).toBe('green');
  });
});
