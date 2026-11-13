import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  COSTUME_SLOTS,
  PET_IDS,
  PRICE_RANGE,
  SHOP_ITEMS,
  SHOP_KINDS,
  costumeFromAvatarConfig,
  editorThemeFromSettings,
  petFromAvatarConfig,
  weeklyLimitOf,
} from '../catalog';
import { CAPE_COLORS } from '@/components/characters/rig/costumes';

const MIG = resolve(__dirname, '../../../../supabase/migrations');

type Row = Record<string, string | number | null>;

/** `('a', 1, NULL), (…)` → 값 배열들. 작은따옴표 문자열('' 이스케이프)·정수·NULL 만 (00039 형식) */
function parseTuples(values: string): (string | number | null)[][] {
  const rows: (string | number | null)[][] = [];
  let row: (string | number | null)[] | null = null;
  let i = 0;
  while (i < values.length) {
    const c = values[i];
    if (c === '(') {
      row = [];
      i++;
    } else if (c === ')') {
      rows.push(row!);
      row = null;
      i++;
    } else if (row && c === "'") {
      let s = '';
      i++;
      while (!(values[i] === "'" && values[i + 1] !== "'")) {
        s += values[i];
        i += values[i] === "'" ? 2 : 1;
      }
      row.push(s);
      i++;
    } else if (row && /[-\dN]/.test(c)) {
      const m = /^(NULL|-?\d+)/.exec(values.slice(i))!;
      row.push(m[1] === 'NULL' ? null : Number(m[1]));
      i += m[1].length;
    } else i++;
  }
  return rows;
}

/** 모든 마이그레이션의 shop_items INSERT 를 번호 순으로 — 같은 id 는 뒤 파일 값 (ON CONFLICT DO UPDATE) */
function dbItems(): Map<string, Row> {
  const items = new Map<string, Row>();
  for (const file of readdirSync(MIG).sort()) {
    const sql = readFileSync(join(MIG, file), 'utf8').replace(/--[^\n]*/g, '');
    for (const m of sql.matchAll(
      /INSERT INTO public\.shop_items \(([^)]+)\) VALUES([\s\S]*?)(?:ON CONFLICT|;)/g,
    )) {
      const cols = m[1].split(',').map((c) => c.trim());
      for (const vals of parseTuples(m[2]))
        items.set(
          vals[0] as string,
          Object.fromEntries(cols.map((c, k) => [c, vals[k]])),
        );
    }
  }
  return items;
}

describe('상점 카탈로그 (P9-01)', () => {
  it('DB shop_items(마이그레이션 INSERT)와 열마다 같다 — 드리프트 테스트', () => {
    const db = dbItems();
    expect([...db.keys()].sort()).toEqual(SHOP_ITEMS.map((i) => i.id).sort());
    for (const item of SHOP_ITEMS) {
      expect(db.get(item.id), item.id).toEqual({
        id: item.id,
        kind: item.kind,
        slot: item.kind === 'costume' ? item.slot : null,
        name: item.name,
        description: item.description,
        price: item.price,
        rarity: item.rarity,
        weekly_limit: weeklyLimitOf(item),
        sort: item.sort,
      });
    }
  });

  it('id·이름이 겹치지 않고, id 형식·종류 접두사·sort 오름차순', () => {
    expect(new Set(SHOP_ITEMS.map((i) => i.id)).size).toBe(SHOP_ITEMS.length);
    expect(new Set(SHOP_ITEMS.map((i) => i.name)).size).toBe(SHOP_ITEMS.length);
    const sorts = SHOP_ITEMS.map((i) => i.sort);
    expect(sorts).toEqual([...sorts].sort((a, b) => a - b));
    for (const i of SHOP_ITEMS) {
      expect(i.id).toMatch(/^[a-z][a-z0-9_]{1,39}$/);
      if (i.kind === 'costume')
        expect(i.id.startsWith(`${i.slot}_`)).toBe(true);
      if (i.kind === 'pet') expect(i.id.startsWith('pet_')).toBe(true);
    }
  });

  it('가격은 §12-Q65 확정 범위 안, 종류마다 1개 이상', () => {
    for (const kind of SHOP_KINDS) {
      const items = SHOP_ITEMS.filter((i) => i.kind === kind);
      expect(items.length, kind).toBeGreaterThan(0);
      const [lo, hi] = PRICE_RANGE[kind];
      for (const i of items) {
        expect(i.price, i.id).toBeGreaterThanOrEqual(lo);
        expect(i.price, i.id).toBeLessThanOrEqual(hi);
      }
    }
    expect(SHOP_ITEMS.find((i) => i.id === 'golden_key')?.price).toBe(240);
    expect(SHOP_ITEMS.find((i) => i.id === 'streak_shield')?.price).toBe(180);
  });

  it('주 구매 한도는 황금키·방패만 1개', () => {
    const limited = SHOP_ITEMS.filter((i) => weeklyLimitOf(i) !== null);
    expect(limited.map((i) => [i.id, weeklyLimitOf(i)]).sort()).toEqual([
      ['golden_key', 1],
      ['streak_shield', 1],
    ]);
  });

  it('펫 3~4종, 900~1,500 안에서 가격이 모두 다름', () => {
    expect(PET_IDS.length).toBeGreaterThanOrEqual(3);
    expect(PET_IDS.length).toBeLessThanOrEqual(4);
    const prices = SHOP_ITEMS.filter((i) => i.kind === 'pet').map(
      (i) => i.price,
    );
    expect(new Set(prices).size).toBe(prices.length);
    expect(Math.min(...prices)).toBe(900);
    expect(Math.max(...prices)).toBe(1500);
  });

  it('settings → 에디터 테마 (모르는 값·다른 종류 id 는 기본 공책 null, P9-06)', () => {
    expect(editorThemeFromSettings({ editor_theme: 'theme_night' })).toBe(
      'night',
    );
    expect(
      editorThemeFromSettings({ editor_theme: 'theme_candy', motion: 'full' }),
    ).toBe('candy');
    for (const bad of [
      null,
      [],
      'theme_night',
      {},
      { editor_theme: 'night' },
      { editor_theme: 'pet_fox' },
    ])
      expect(editorThemeFromSettings(bad)).toBeNull();
  });

  it('avatar_config → 펫 id / 리그 코스튬 (모르는 값·슬롯이 틀린 id 는 버림)', () => {
    expect(petFromAvatarConfig({ pet: 'pet_fox' })).toBe('pet_fox');
    for (const bad of [
      null,
      [],
      'pet_fox',
      { pet: 'hat_party' },
      { pet: 'x' },
      {},
    ])
      expect(petFromAvatarConfig(bad)).toBeNull();

    expect(
      costumeFromAvatarConfig({
        skin: 'sky',
        hat: 'hat_crown',
        glasses: 'glasses_sun',
        cape: 'cape_night',
        bg: 'bg_island',
        pet: 'pet_chick',
      }),
    ).toEqual({
      hat: 'crown',
      glasses: 'sun',
      cape: CAPE_COLORS.night,
      bg: 'island',
    });
    expect(
      costumeFromAvatarConfig({ hat: 'glasses_round', cape: 'nope', bg: 1 }),
    ).toEqual({});
    expect(costumeFromAvatarConfig(null)).toEqual({});
    // 모든 코스튬이 자기 슬롯에 그려짐
    for (const i of SHOP_ITEMS)
      if (i.kind === 'costume') {
        expect(COSTUME_SLOTS).toContain(i.slot);
        const c = costumeFromAvatarConfig({ [i.slot]: i.id });
        expect(Object.keys(c), i.id).toEqual([i.slot]);
      }
  });
});
