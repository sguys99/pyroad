import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  bitDepthFor,
  decodePalettePng,
  encodePalettePng,
} from '../lib/png.mjs';
import {
  TEXTURES,
  TEXTURE_MAX_BYTES,
  mulberry32,
  renderTexture,
  sameImage,
} from '../lib/textures.mjs';
import {
  budgetProblems,
  lockStatus,
  normalizeConfig,
  normalizeEntry,
  outputName,
  planOutputs,
  sourceProblems,
} from '../lib/raster.mjs';
import { inspectLottie, judgeRender, sampleFrames } from '../lib/lottie.mjs';
import { idFromOutputName, runRaster } from '../raster.mjs';
import { runSvg, svgRuleProblems } from '../svg.mjs';
import { runTextures } from '../textures.mjs';

const FIXTURES = join(__dirname, 'fixtures');
const readJson = (p: string) =>
  JSON.parse(readFileSync(join(FIXTURES, p), 'utf8'));
const tmp = () => mkdtempSync(join(tmpdir(), 'pyroad-assets-'));

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('팔레트 PNG', () => {
  it('단계 수에 맞는 가장 작은 비트 깊이를 고른다', () => {
    expect([2, 3, 6, 8, 16, 17, 256].map(bitDepthFor)).toEqual([
      1, 2, 4, 4, 4, 8, 8,
    ]);
  });

  it('인코딩한 그림을 그대로 읽어 온다 (폭이 바이트 경계가 아니어도)', () => {
    const indices = Uint8Array.from({ length: 13 * 5 }, (_, i) => i % 6);
    const img = {
      width: 13,
      height: 5,
      indices,
      palette: Array.from({ length: 6 }, () => [92, 70, 42]),
      alpha: [0, 10, 20, 30, 40, 50],
    };
    const back = decodePalettePng(encodePalettePng(img));
    expect(sameImage(back, img)).toBe(true);
  });

  it('손상된 파일은 CRC로 거부한다', () => {
    const buf = encodePalettePng({
      width: 2,
      height: 2,
      indices: new Uint8Array(4),
      palette: [[0, 0, 0]],
      alpha: [255],
    });
    buf[buf.length - 20] ^= 0xff;
    expect(() => decodePalettePng(buf)).toThrow();
  });
});

describe('종이 결 타일', () => {
  it('같은 시드면 같은 수열 (플랫폼과 무관한 정수 연산)', () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it.each(TEXTURES)('$id: 다시 만들어도 같은 그림이고 예산 안', (def) => {
    const img = renderTexture(def);
    expect(sameImage(img, renderTexture(def))).toBe(true);
    expect(img.width).toBe(def.size);
    expect(new Set(img.indices).size).toBeGreaterThan(2);
    expect(encodePalettePng(img).length).toBeLessThanOrEqual(TEXTURE_MAX_BYTES);
  });

  it('없는 타일은 만들고, 다른 그림으로 덮어쓰지 않고, 모르는 파일은 실패', () => {
    const dir = tmp();
    expect(runTextures({ check: true, dir, rasterOutputs: [] })).toBe(false); // 아직 없음
    expect(runTextures({ dir, rasterOutputs: [] })).toBe(true);
    expect(runTextures({ check: true, dir, rasterOutputs: [] })).toBe(true);

    const grain = join(dir, 'paper-grain.v1.png');
    const original = readFileSync(grain);
    writeFileSync(
      grain,
      encodePalettePng({
        ...renderTexture(TEXTURES[0]),
        alpha: [0, 1, 2, 3, 4, 5],
      }),
    );
    expect(runTextures({ dir, rasterOutputs: [] })).toBe(false);
    expect(readFileSync(grain).equals(original)).toBe(false); // 덮어쓰지 않고 멈춤
    writeFileSync(grain, original);

    writeFileSync(join(dir, 'stray.png'), 'x');
    expect(runTextures({ check: true, dir, rasterOutputs: [] })).toBe(false);
    expect(
      runTextures({ check: true, dir, rasterOutputs: ['stray.png'] }),
    ).toBe(true);
  });

  it('저장소의 public/textures가 정의와 같다', () => {
    expect(runTextures({ check: true })).toBe(true);
  });
});

describe('래스터 설정', () => {
  const hero = { id: 'hero-island', version: 2, kind: 'hero', source: 'a.png' };

  it('종류별 기본값을 채우고 폭을 정렬한다', () => {
    const e = normalizeEntry({ ...hero, widths: [1200, 480, 800, 480] });
    expect(e.widths).toEqual([480, 800, 1200]);
    expect(e.formats).toEqual(['webp']);
    expect(e.outDir).toBe('public/images');
    expect(e.quality.webp).toBe(78);
  });

  it('잘못된 항목을 거부한다', () => {
    expect(() => normalizeEntry({ ...hero, id: 'Hero_Island' })).toThrow(
      /kebab/,
    );
    expect(() => normalizeEntry({ ...hero, version: 0 })).toThrow(/version/);
    expect(() => normalizeEntry({ ...hero, kind: 'poster' })).toThrow(/kind/);
    expect(() => normalizeEntry({ ...hero, formats: ['jpg'] })).toThrow(
      /formats/,
    );
    expect(() =>
      normalizeEntry({
        id: 'c',
        version: 1,
        kind: 'card-bg',
        source: 'c.png',
        widths: [600],
      }),
    ).toThrow(/1200/);
    expect(() => normalizeConfig([hero, hero])).toThrow(/두 번/);
  });

  it('버전 붙은 출력 이름 (폭이 하나면 폭을 생략)', () => {
    const e = normalizeEntry({ ...hero, formats: ['avif', 'webp'] });
    expect(planOutputs(e).map((o) => o.name)).toEqual([
      'hero-island-480w.v2.avif',
      'hero-island-800w.v2.avif',
      'hero-island-1200w.v2.avif',
      'hero-island-480w.v2.webp',
      'hero-island-800w.v2.webp',
      'hero-island-1200w.v2.webp',
    ]);
    const card = normalizeEntry({
      id: 'card-paper',
      version: 1,
      kind: 'card-bg',
      source: 'c.png',
    });
    expect(outputName(card, 1200, 'png')).toBe('card-paper.v1.png');
    expect(idFromOutputName('hero-island-480w.v2.webp')).toBe('hero-island');
    expect(idFromOutputName('card-paper.v1.png')).toBe('card-paper');
  });

  it('예산: 파일별·폭별 예외·형식별 세트 합', () => {
    const e = normalizeEntry(hero);
    const f = (width: number, bytes: number) => ({
      name: `x-${width}`,
      width,
      format: 'webp',
      bytes,
    });
    expect(
      budgetProblems(e, [f(480, 20_000), f(800, 45_000), f(1200, 75_000)]),
    ).toEqual([]);
    expect(budgetProblems(e, [f(800, 55_000)])).toHaveLength(1); // 800w는 50KB
    expect(
      budgetProblems(e, [f(480, 40_000), f(800, 49_000), f(1200, 79_000)]),
    ).toEqual(['hero-island webp 세트 합 168000B > 150000B']);
  });

  it('원본이 작으면 늘리지 않고, 카드 배경은 비율을 본다', () => {
    const e = normalizeEntry(hero);
    expect(sourceProblems(e, { width: 1000, height: 600 })).toHaveLength(1);
    expect(sourceProblems(e, { width: 2400, height: 1600 })).toEqual([]);
    const card = normalizeEntry({
      id: 'c',
      version: 1,
      kind: 'card-bg',
      source: 'c.png',
    });
    expect(sourceProblems(card, { width: 2400, height: 1260 })).toEqual([]);
    expect(sourceProblems(card, { width: 2400, height: 1600 })).toHaveLength(1);
  });

  it('잠금 비교: 같은 버전에서 원본·설정·출력이 바뀌면 멈춘다', () => {
    const locked = {
      source: 'S',
      settings: 'P',
      files: { 'a.webp': { sha256: 'A' }, 'b.webp': { sha256: 'B' } },
    };
    const now = {
      sourceSha: 'S',
      settings: 'P',
      files: { 'a.webp': 'A', 'b.webp': 'B' },
    };
    expect(lockStatus(undefined, now).status).toBe('fresh');
    expect(lockStatus(locked, now).status).toBe('same');
    expect(lockStatus(locked, { ...now, sourceSha: 'S2' }).status).toBe(
      'source-changed',
    );
    expect(lockStatus(locked, { ...now, settings: 'P2' }).status).toBe(
      'plan-changed',
    );
    expect(
      lockStatus(locked, { ...now, files: { 'a.webp': 'A' } }).status,
    ).toBe('plan-changed');
    expect(
      lockStatus(locked, { ...now, files: { 'a.webp': 'A', 'b.webp': null } }),
    ).toEqual({
      status: 'output-missing',
      file: 'b.webp',
    });
    expect(
      lockStatus(locked, { ...now, files: { 'a.webp': 'A', 'b.webp': 'X' } }),
    ).toEqual({
      status: 'output-changed',
      file: 'b.webp',
    });
  });
});

describe('래스터 파이프라인 (sharp)', () => {
  it('인코딩 → 기록 → 확인, 같은 버전의 원본 변경·출력 덮어쓰기·남은 파일을 잡는다', async () => {
    const sharp = (await import('sharp')).default;
    const root = tmp();
    mkdirSync(join(root, 'src'));
    const make = (color: string) =>
      sharp({
        create: { width: 1600, height: 1000, channels: 3, background: color },
      })
        .png()
        .toFile(join(root, 'src/hero.png'));
    await make('#f2c98b');
    const lockPath = join(root, 'lock.json');
    const entries = [
      { id: 'hero-test', version: 1, kind: 'hero', source: 'src/hero.png' },
    ];
    const opts = { entries, lockPath, root };

    expect(await runRaster({ ...opts, check: true })).toBe(false); // 아직 안 만듦
    expect(await runRaster(opts)).toBe(true);
    const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
    expect(Object.keys(lock['hero-test.v1'].files)).toEqual([
      'hero-test-480w.v1.webp',
      'hero-test-800w.v1.webp',
      'hero-test-1200w.v1.webp',
    ]);
    expect(lock['hero-test.v1'].files['hero-test-800w.v1.webp']).toMatchObject({
      width: 800,
      height: 500,
    });
    expect(await runRaster({ ...opts, check: true })).toBe(true);
    expect(await runRaster(opts)).toBe(true); // 다시 돌려도 그대로 (멱등)

    // 같은 이름을 다른 내용으로 덮어씀 → 확인 실패
    const out = join(root, 'public/images/hero-test-480w.v1.webp');
    const saved = readFileSync(out);
    writeFileSync(
      out,
      readFileSync(join(root, 'public/images/hero-test-800w.v1.webp')),
    );
    expect(await runRaster({ ...opts, check: true })).toBe(false);
    writeFileSync(out, saved);

    // 원본을 바꾸고 버전을 안 올림 → 멈춤, 버전을 올리면 새 파일 + 옛 버전은 경고만
    await make('#9cc9a6');
    expect(await runRaster(opts)).toBe(false);
    expect(
      await runRaster({ ...opts, entries: [{ ...entries[0], version: 2 }] }),
    ).toBe(true);
    expect(existsSync(join(root, 'public/images/hero-test-480w.v2.webp'))).toBe(
      true,
    );
    expect(Object.keys(JSON.parse(readFileSync(lockPath, 'utf8')))).toEqual([
      'hero-test.v2',
    ]);

    // 설정에 없는 손으로 둔 파일 → 실패
    writeFileSync(join(root, 'public/images/hand.png'), 'x');
    expect(
      await runRaster({
        ...opts,
        entries: [{ ...entries[0], version: 2 }],
        check: true,
      }),
    ).toBe(false);
  });

  it('저장소의 raster.lock.json이 설정·파일과 같다', async () => {
    expect(await runRaster({ check: true })).toBe(true);
  });
});

describe('SVG', () => {
  const messy = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generator: Illustrator -->
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="120px" height="80px" viewBox="0 0 120 80" data-name="Layer 1">
  <title>섬</title>
  <metadata>junk</metadata>
  <g id="Layer_1" onclick="alert(1)"><script>alert(1)</script>
    <path d="M 10.000 70.000 L 60.000 10.000 L 110.000 70.000 Z" fill="#7FB77E" stroke="#3B2A1A" stroke-width="4.000"/>
  </g>
</svg>`;

  it('최적화하고 다시 돌리면 그대로 (멱등), 확인 모드는 최적화 안 된 파일을 잡는다', async () => {
    const dir = tmp();
    const file = join(dir, 'island.svg');
    writeFileSync(file, messy);
    expect(await runSvg({ check: true, files: [file] })).toBe(false);
    expect(await runSvg({ files: [file] })).toBe(true);
    const once = readFileSync(file, 'utf8');
    expect(once).toContain('viewBox="0 0 120 80"');
    expect(once).toContain('<title>섬</title>');
    expect(once).not.toMatch(
      /<script|onclick|data-name|width="120px"|metadata/,
    );
    expect(await runSvg({ files: [file] })).toBe(true);
    expect(readFileSync(file, 'utf8')).toBe(once);
    expect(await runSvg({ check: true, files: [file] })).toBe(true);
  });

  it('공유 카드·성능 규칙: 글자·래스터·SMIL 금지', () => {
    expect(svgRuleProblems('<svg><path d="M0 0"/></svg>')).toEqual([]);
    expect(svgRuleProblems('<svg><text x="0">Zzz</text></svg>')).toHaveLength(
      1,
    );
    expect(svgRuleProblems('<svg><image href="a.png"/></svg>')).toHaveLength(1);
    expect(
      svgRuleProblems('<svg><foreignObject></foreignObject></svg>'),
    ).toHaveLength(1);
    expect(
      svgRuleProblems('<svg><animate attributeName="x"/></svg>'),
    ).toHaveLength(1);
  });
});

describe('Lottie 구조 검사', () => {
  it('정상 파일은 오류가 없다', () => {
    const r = inspectLottie(readJson('valid-pop.json'));
    expect(r.errors).toEqual([]);
    expect(r.stats).toMatchObject({ layers: 2, seconds: 1.5, w: 128, h: 128 });
  });

  it.each(['celebrating', 'entrance', 'level-up', 'project-complete'])(
    'B32 파일(%s)은 st·ks.a·이징 누락으로 실패한다',
    (name) => {
      const { errors } = inspectLottie(readJson(`b32/${name}.json`));
      expect(errors.some((e) => e.includes('st가 없어요'))).toBe(true);
      expect(errors.some((e) => e.includes('ks.a'))).toBe(true);
      expect(errors.some((e) => e.includes('이징(i/o)'))).toBe(true);
    },
  );

  it('lottie_light에 없는 기능과 예산을 잡는다', () => {
    const base = readJson('valid-pop.json');
    const layer = base.layers[1];
    const variants: Array<[string, (d: typeof base) => void, RegExp]> = [
      [
        'expressions',
        (d) => (d.layers[1].ks.o.x = 'wiggle(1,2)'),
        /expressions/,
      ],
      ['효과', (d) => (d.layers[1].ef = [{ ty: 5 }]), /효과/],
      ['텍스트 레이어', (d) => d.layers.push({ ...layer, ty: 5 }), /텍스트/],
      [
        '이미지 에셋',
        (d) => d.assets.push({ id: 'img', p: 'a.png', w: 1, h: 1 }),
        /이미지 에셋/,
      ],
      [
        '패스 병합',
        (d) => d.layers[1].shapes[0].it.unshift({ ty: 'mm', mm: 1 }),
        /패스 병합/,
      ],
      ['길이', (d) => (d.op = 30 * 5), /길이/],
      ['3D', (d) => (d.ddd = 1), /3D/],
      [
        '없는 프리컴프',
        (d) => d.layers.push({ ...layer, ty: 0, refId: 'nope' }),
        /프리컴프/,
      ],
    ];
    for (const [, mutate, re] of variants) {
      const d = structuredClone(base);
      mutate(d);
      expect(inspectLottie(d).errors.join('\n')).toMatch(re);
    }
    expect(inspectLottie(base, { bytes: 70 * 1024 }).errors.join()).toMatch(
      /예산/,
    );
  });

  it('멈춤(h: 1) 키프레임과 마지막 키프레임은 이징이 없어도 된다', () => {
    const d = readJson('valid-pop.json');
    d.layers[1].ks.r.k = [
      { t: 0, s: [0], h: 1 },
      { t: 10, s: [20] },
    ];
    expect(inspectLottie(d).errors).toEqual([]);
  });

  it('렌더 판정: 빈 화면·움직임 없음', () => {
    expect(sampleFrames(0, 70)).toEqual([10, 20, 30, 40, 50, 60]);
    const blank = Array.from({ length: 6 }, () => ({ ratio: 0, hash: 1 }));
    expect(judgeRender(blank)).toMatchObject({ blank: true, still: true });
    const one = [{ ratio: 0.3, hash: 2 }, ...blank.slice(1)];
    expect(judgeRender(one).blank).toBe(true); // 한 프레임만 그려짐
    const moving = blank.map((f, i) => ({ ratio: 0.05, hash: i }));
    expect(judgeRender(moving)).toMatchObject({ blank: false, still: false });
  });
});
