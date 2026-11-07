// 래스터 정지 그림 파이프라인의 순수 함수 (P2-16): 설정 검증·출력 계획·예산·잠금(lock) 비교.
// 인코딩(sharp)은 scripts/assets/raster.mjs에만 있다. 여기 함수는 단위 테스트한다.

/**
 * 종류별 기본값. 근거는 docs/design/assets.md "래스터 정지 그림".
 * - hero: 랜딩 히어로 같은 큰 일러스트. 화면 폭 360~430(2배 밀도 → 약 800px)·데스크톱 두 단 560px(2배 → 약 1200px)을 덮는 3단계.
 *   모바일이 실제로 받는 800w가 50KB 이하면 Slow 4G(약 200KB/s)에서 0.25초. 랜딩 예산(JS 250KB·폰트 150KB, §2.10) 옆에 얹힘
 * - still: 화면 안의 작은 정지 그림(빈 상태·안내 카드). 2배 밀도까지
 * - card-bg: 공유 카드 배경 1200×630 PNG (P0-10: satori+resvg가 PNG를 확실히 그림, 장당 100KB 이하). 서버가 파일로 읽으므로 public 밖
 * - texture: 스캔·그린 수채·종이 질감처럼 생성기로 못 만드는 반복 타일 (생성 타일은 textures.mjs)
 */
export const KIND_DEFAULTS = {
  hero: {
    widths: [480, 800, 1200],
    formats: ['webp'],
    outDir: 'public/images',
    maxBytes: 80_000,
    setBytes: 150_000,
    perWidth: { 800: 50_000 },
  },
  still: {
    widths: [320, 640],
    formats: ['webp'],
    outDir: 'public/images',
    maxBytes: 40_000,
    setBytes: 60_000,
  },
  'card-bg': {
    widths: [1200],
    formats: ['png'],
    outDir: 'assets/share-card',
    maxBytes: 100_000,
    setBytes: 100_000,
    exactSize: { width: 1200, height: 630 },
  },
  texture: {
    widths: [256],
    formats: ['png'],
    outDir: 'public/textures',
    maxBytes: 10_240,
    setBytes: 20_480,
  },
};

/** 인코더 기본 품질 (sharp). 그림책 일러스트는 넓은 평면 + 선이라 WebP 78이면 경계 번짐이 눈에 안 띔 */
export const DEFAULT_QUALITY = { webp: 78, avif: 52, png: 90 };

export const FORMATS = ['webp', 'avif', 'png'];
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** 설정 한 항목을 기본값과 합치고 검사한다. 잘못되면 Error */
export function normalizeEntry(entry) {
  const where = `raster.config: ${entry?.id ?? '(id 없음)'}`;
  if (!entry || typeof entry !== 'object')
    throw new Error(`${where}: 객체가 아니에요`);
  if (!ID.test(entry.id ?? ''))
    throw new Error(`${where}: id는 소문자·숫자·하이픈 (kebab-case)`);
  if (!Number.isInteger(entry.version) || entry.version < 1) {
    throw new Error(`${where}: version은 1 이상의 정수`);
  }
  const base = KIND_DEFAULTS[entry.kind];
  if (!base) {
    throw new Error(
      `${where}: kind는 ${Object.keys(KIND_DEFAULTS).join('·')} 중 하나`,
    );
  }
  if (typeof entry.source !== 'string' || !entry.source) {
    throw new Error(`${where}: source(원본 경로)가 없어요`);
  }
  const e = {
    ...base,
    ...entry,
    quality: { ...DEFAULT_QUALITY, ...entry.quality },
  };
  if (!Array.isArray(e.widths) || e.widths.length === 0) {
    throw new Error(`${where}: widths가 비었어요`);
  }
  if (e.widths.some((w) => !Number.isInteger(w) || w < 16 || w > 3840)) {
    throw new Error(`${where}: widths는 16~3840 정수`);
  }
  e.widths = [...new Set(e.widths)].sort((a, b) => a - b);
  if (e.formats.some((f) => !FORMATS.includes(f))) {
    throw new Error(`${where}: formats는 ${FORMATS.join('·')}만`);
  }
  if (
    e.exactSize &&
    (e.widths.length !== 1 || e.widths[0] !== e.exactSize.width)
  ) {
    throw new Error(`${where}: ${e.kind}는 폭 ${e.exactSize.width} 한 장만`);
  }
  return e;
}

/** 설정 전체 검사 (id 중복 금지) */
export function normalizeConfig(entries) {
  const out = entries.map(normalizeEntry);
  const seen = new Set();
  for (const e of out) {
    if (seen.has(e.id))
      throw new Error(`raster.config: id ${e.id}가 두 번 있어요`);
    seen.add(e.id);
  }
  return out;
}

export function lockKey(e) {
  return `${e.id}.v${e.version}`;
}

/** 출력 파일 이름: `<id>-<폭>w.v<N>.<형식>` (폭이 하나뿐이면 `<id>.v<N>.<형식>`) */
export function outputName(e, width, format) {
  const w = e.widths.length > 1 ? `-${width}w` : '';
  return `${e.id}${w}.v${e.version}.${format}`;
}

/** 이 항목이 만드는 파일들 (출력 폴더 기준 상대 경로) */
export function planOutputs(e) {
  const out = [];
  for (const format of e.formats) {
    for (const width of e.widths) {
      out.push({ name: outputName(e, width, format), width, format });
    }
  }
  return out;
}

/**
 * 크기 예산. 파일마다 maxBytes(폭별 예외 perWidth), 형식별 세트 합 setBytes.
 * @param {ReturnType<typeof normalizeEntry>} e
 * @param {{ name: string, width: number, format: string, bytes: number }[]} files
 * @returns {string[]} 넘친 항목 설명 (비면 통과)
 */
export function budgetProblems(e, files) {
  const problems = [];
  const sums = {};
  for (const f of files) {
    const limit = e.perWidth?.[f.width] ?? e.maxBytes;
    if (f.bytes > limit) problems.push(`${f.name}: ${f.bytes}B > ${limit}B`);
    sums[f.format] = (sums[f.format] ?? 0) + f.bytes;
  }
  for (const [format, sum] of Object.entries(sums)) {
    if (sum > e.setBytes) {
      problems.push(`${e.id} ${format} 세트 합 ${sum}B > ${e.setBytes}B`);
    }
  }
  return problems;
}

/** 원본이 출력 폭보다 작으면 늘리지 않는다 (흐려짐) */
export function sourceProblems(e, meta) {
  const problems = [];
  const widest = e.widths[e.widths.length - 1];
  if (meta.width < widest) {
    problems.push(
      `원본 폭 ${meta.width}px < 가장 큰 출력 ${widest}px (늘리지 않음)`,
    );
  }
  if (e.exactSize) {
    const want = e.exactSize.width / e.exactSize.height;
    const got = meta.width / meta.height;
    if (Math.abs(got - want) / want > 0.01) {
      problems.push(
        `원본 비율 ${meta.width}×${meta.height}가 ${e.exactSize.width}×${e.exactSize.height}와 달라요`,
      );
    }
  }
  return problems;
}

/**
 * 잠금 파일과 비교해 이 항목을 어떻게 할지 정한다.
 * - `fresh`: 잠금에 없음 → 새로 만든다
 * - `same`: 원본·출력이 모두 기록과 같음 → 건너뜀
 * - `source-changed`: 같은 버전인데 원본이 바뀜 → 멈춤 (version을 올려야 함)
 * - `output-changed` / `output-missing`: 기록된 출력 파일이 다르거나 없음 → 멈춤 (덮어쓰기 금지·git에서 되살리기)
 * - `plan-changed`: 같은 버전인데 폭·형식·품질이 바뀜 → 멈춤 (version을 올려야 함)
 * @param {object|undefined} locked 잠금 항목
 * @param {{ sourceSha: string, settings: string, files: Record<string, string|null> }} now 현재 원본 해시·설정 서명·출력 파일 해시(없으면 null)
 */
export function lockStatus(locked, now) {
  if (!locked) return { status: 'fresh' };
  if (locked.source !== now.sourceSha) return { status: 'source-changed' };
  if (locked.settings !== now.settings) return { status: 'plan-changed' };
  const names = Object.keys(locked.files);
  const planned = Object.keys(now.files);
  if (
    names.length !== planned.length ||
    planned.some((n) => !locked.files[n])
  ) {
    return { status: 'plan-changed' };
  }
  for (const name of names) {
    if (now.files[name] === null)
      return { status: 'output-missing', file: name };
    if (now.files[name] !== locked.files[name].sha256) {
      return { status: 'output-changed', file: name };
    }
  }
  return { status: 'same' };
}

/** 출력 모양을 바꾸는 설정만 모은 서명 (같은 버전 안에서 바뀌면 안 됨) */
export function settingsSignature(e) {
  return JSON.stringify({
    widths: e.widths,
    formats: e.formats,
    quality: e.formats.map((f) => [f, e.quality[f]]),
    png: e.png ?? null,
  });
}
