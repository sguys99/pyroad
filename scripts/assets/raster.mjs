// 래스터 정지 그림 → 크기별 WebP(·AVIF·PNG) (P2-16). 목록은 raster.config.mjs, 결과 기록은 raster.lock.json.
//
//   npm run assets:raster              # 새 항목·새 버전만 인코딩 (기록과 같으면 건너뜀)
//   npm run assets:raster -- --check   # 원본·출력이 기록과 같은지·예산·남은 파일 확인 (인코더 없이, CI용)
//
// - 인코더는 sharp(next의 선택 의존성으로 이미 설치됨, 루트 package.json에 추가하지 않음). 확인 모드는 sharp가 필요 없다
// - 출력 이름에 버전이 있고 `/images/*`는 1년 immutable 캐시라서, 같은 버전의 원본·설정·출력이 기록과 다르면 멈춘다.
//   인코더 버전이 달라 바이트가 조금 달라져도 다시 만들지 않는다 (기록된 파일이 기준)

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { RASTER_ASSETS } from './raster.config.mjs';
import {
  KIND_DEFAULTS,
  budgetProblems,
  lockKey,
  lockStatus,
  normalizeConfig,
  planOutputs,
  settingsSignature,
  sourceProblems,
} from './lib/raster.mjs';
import {
  ROOT,
  VERSIONED_NAME,
  isMain,
  kb,
  listFiles,
  rel,
  sha256,
} from './lib/fsutil.mjs';

export const LOCK_PATH = join(ROOT, 'scripts/assets/raster.lock.json');

/** 래스터 파이프라인이 맡는 출력 폴더 (public/textures는 textures.mjs가 같이 봄) */
const OWNED_DIRS = [
  ...new Set(Object.values(KIND_DEFAULTS).map((k) => k.outDir)),
].filter((d) => d !== 'public/textures');

async function loadSharp() {
  try {
    return (await import('sharp')).default;
  } catch {
    throw new Error(
      'sharp를 불러오지 못했어요. next의 선택 의존성이라 `npm ci`로 설치돼요 (플랫폼 바이너리 확인: npm ls sharp)',
    );
  }
}

async function encode(sharp, e, src, out) {
  let p = sharp(src, { failOn: 'error' }).rotate();
  p = e.exactSize
    ? p.resize(e.exactSize.width, e.exactSize.height, { fit: 'cover' })
    : p.resize({ width: out.width, kernel: 'lanczos3' });
  p = p.toColorspace('srgb');
  if (out.format === 'webp') {
    p = p.webp({ quality: e.quality.webp, effort: 6, smartSubsample: true });
  } else if (out.format === 'avif') {
    p = p.avif({ quality: e.quality.avif, effort: 6 });
  } else {
    const palette = e.png?.palette ?? true;
    p = p.png({
      compressionLevel: 9,
      effort: 10,
      palette,
      ...(palette ? { quality: e.quality.png } : {}),
    });
  }
  const { data, info } = await p.toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

function readLock(lockPath) {
  return existsSync(lockPath) ? JSON.parse(readFileSync(lockPath, 'utf8')) : {};
}

function writeLock(lockPath, lock) {
  const sorted = Object.fromEntries(
    Object.keys(lock)
      .sort()
      .map((k) => [k, lock[k]]),
  );
  writeFileSync(lockPath, `${JSON.stringify(sorted, null, 2)}\n`);
}

/** 출력 파일 이름에서 항목 id를 되찾는다 (`hero-island-480w.v1.webp` → `hero-island`) */
export function idFromOutputName(name) {
  return name.replace(/\.v\d+\.[a-z0-9]+$/, '').replace(/-\d+w$/, '');
}

/**
 * @param {{ check?: boolean, entries?: object[], lockPath?: string, root?: string }} opts
 * @returns {Promise<boolean>} 통과 여부
 */
export async function runRaster({
  check = false,
  entries = RASTER_ASSETS,
  lockPath = LOCK_PATH,
  root = ROOT,
} = {}) {
  let ok = true;
  const fail = (msg) => {
    ok = false;
    console.error(`  ✗ ${msg}`);
  };
  const config = normalizeConfig(entries);
  const lock = readLock(lockPath);
  const nextLock = {};
  let sharp;
  const planned = new Set();

  for (const e of config) {
    const key = lockKey(e);
    const outs = planOutputs(e);
    const outDir = join(root, e.outDir);
    outs.forEach((o) => planned.add(join(outDir, o.name)));
    const srcPath = join(root, e.source);
    if (!existsSync(srcPath)) {
      fail(`${key}: 원본 ${e.source}이 없어요`);
      if (lock[key]) nextLock[key] = lock[key];
      continue;
    }
    const src = readFileSync(srcPath);
    const files = Object.fromEntries(
      outs.map((o) => {
        const p = join(outDir, o.name);
        return [o.name, existsSync(p) ? sha256(readFileSync(p)) : null];
      }),
    );
    const st = lockStatus(lock[key], {
      sourceSha: sha256(src),
      settings: settingsSignature(e),
      files,
    });

    if (st.status === 'same') {
      nextLock[key] = lock[key];
      const sized = outs.map((o) => ({
        ...o,
        bytes: lock[key].files[o.name].bytes,
      }));
      const over = budgetProblems(e, sized);
      over.forEach((p) => fail(`${key}: 예산 초과 ${p}`));
      if (!over.length) {
        const total = sized.reduce((s, f) => s + f.bytes, 0);
        console.log(`  = ${key} (${outs.length}개, 합 ${kb(total)})`);
      }
      continue;
    }
    if (st.status !== 'fresh') {
      if (lock[key]) nextLock[key] = lock[key];
      const why = {
        'source-changed': '원본이 기록과 달라요 → version을 올리세요',
        'plan-changed': '폭·형식·품질이 기록과 달라요 → version을 올리세요',
        'output-changed': `${st.file}이 기록과 달라요. 같은 이름을 덮어쓰지 마세요 (git에서 되돌리거나 version을 올리세요)`,
        'output-missing': `${st.file}이 없어요 (git에서 되살리세요. 다시 인코딩하면 바이트가 달라질 수 있음)`,
      }[st.status];
      fail(`${key}: ${why}`);
      continue;
    }
    // fresh
    if (check) {
      fail(`${key}: 아직 만들지 않았어요. npm run assets:raster 를 실행하세요`);
      continue;
    }
    sharp ??= await loadSharp();
    const meta = await sharp(src).metadata();
    const srcIssues = sourceProblems(e, {
      width: meta.width,
      height: meta.height,
    });
    if (srcIssues.length) {
      srcIssues.forEach((p) => fail(`${key}: ${p}`));
      continue;
    }
    const encoded = [];
    for (const o of outs) {
      const r = await encode(sharp, e, src, o);
      encoded.push({ ...o, ...r, bytes: r.data.length });
    }
    const over = budgetProblems(e, encoded);
    if (over.length) {
      over.forEach((p) =>
        fail(`${key}: 예산 초과 ${p} (품질·폭을 낮추거나 그림을 단순하게)`),
      );
      continue;
    }
    // 잠금에 없는데 같은 이름 파일이 있음 = 누군가 손으로 둔 파일. 덮어쓰지 않는다
    const clashes = encoded.filter((f) => existsSync(join(outDir, f.name)));
    clashes.forEach((f) =>
      fail(
        `${rel(join(outDir, f.name))}: 기록에 없는 같은 이름 파일이 이미 있어요. 지우거나 version을 올리세요`,
      ),
    );
    if (clashes.length) continue;
    mkdirSync(outDir, { recursive: true });
    nextLock[key] = {
      source: sha256(src),
      settings: settingsSignature(e),
      files: {},
    };
    for (const f of encoded) {
      writeFileSync(join(outDir, f.name), f.data);
      nextLock[key].files[f.name] = {
        sha256: sha256(f.data),
        bytes: f.bytes,
        width: f.width,
        height: f.height,
      };
      console.log(
        `  + ${rel(join(outDir, f.name))} ${f.width}×${f.height} ${kb(f.bytes)}`,
      );
    }
  }

  // 잠금에만 남은 항목 (설정에서 지움·버전 올림)
  for (const key of Object.keys(lock)) {
    if (nextLock[key]) continue;
    if (check)
      fail(
        `raster.lock.json의 ${key}가 설정에 없어요. npm run assets:raster 로 정리하세요`,
      );
    else
      console.log(`  - 기록에서 ${key} 지움 (파일은 아래 "옛 버전" 안내대로)`);
  }

  // 출력 폴더의 남은 파일
  const ids = new Set(config.map((e) => e.id));
  for (const d of OWNED_DIRS) {
    for (const file of listFiles(join(root, d))) {
      if (planned.has(file)) continue;
      const name = basename(file);
      if (VERSIONED_NAME.test(name) && ids.has(idFromOutputName(name))) {
        console.warn(
          `  ! ${rel(file)}: 옛 버전이에요. 배포된 적이 있으면 한 릴리즈 뒤에 지우세요`,
        );
      } else {
        fail(
          `${rel(file)}: raster.config에 없는 파일이에요 (생성물만 두는 폴더)`,
        );
      }
    }
  }

  // 성공한 항목만 기록한다 (실패한 항목은 기록이 없으니 다음 실행에서 다시 시도)
  if (!check) {
    mkdirSync(dirname(lockPath), { recursive: true });
    writeLock(lockPath, nextLock);
  }
  if (config.length === 0) console.log('  (항목 없음)');
  return ok;
}

/** public/textures에서 래스터 파이프라인이 만드는 파일 (textures.mjs가 남은 파일로 오인하지 않게) */
export function rasterTextureOutputs(entries = RASTER_ASSETS) {
  return normalizeConfig(entries)
    .filter((e) => e.outDir === 'public/textures')
    .flatMap((e) => planOutputs(e).map((o) => o.name));
}

if (isMain(import.meta.url)) {
  const check = process.argv.includes('--check');
  console.log(`래스터 정지 그림${check ? ' 확인' : ''}`);
  runRaster({ check })
    .then((ok) => {
      if (!ok) process.exit(1);
    })
    .catch((err) => {
      console.error(`  ✗ ${err.message}`);
      process.exit(1);
    });
}
