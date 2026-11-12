#!/usr/bin/env node
// 운영 SQL Editor 붙여넣기용 묶음 파일 생성 (B39, 릴리즈마다)
//
// 릴리즈 런북(docs/release/)의 마이그레이션·콘텐츠 seed 를 실행 순서대로 이어 붙여, 파일마다 BEGIN; … COMMIT; 한 번으로 감쌉니다.
// 하나라도 실패하면 그 파일 전체가 되돌려집니다 (마이그레이션의 자기 검증 예외 포함).
//   v0.4         → release-sql/              1_먼저실행.sql(①) · 2_두번째실행.sql(③ + seed) · 3_선택.sql(00009)   v0.4-runbook.md
//   v0.5-phase2  → release-sql/v0.5-phase2/  1_먼저실행.sql(① 00020)                                            v0.5-runbook.md
//   v0.4-phase3  → release-sql/v0.4-phase3/  1_먼저실행.sql(① 00021·00023·00024) · 2_두번째실행.sql(③ 00022)   v0.4-runbook.md "Phase 3 병합"
//   v0.5-phase5  → release-sql/v0.5-phase5/  1_먼저실행.sql(① 00025)                                            v0.5-runbook.md "Phase 5 병합"
// 새 마이그레이션은 RELEASES 의 그 릴리즈 묶음과 런북 표에 함께 넣습니다. 어느 묶음에도 없으면 오류(단위 테스트가 CI 에서 잡음).
//
// Windows 에서 SQL Editor 에 붙여넣으면 줄바꿈이 모두 CRLF 로 바뀝니다. 마이그레이션·seed 는 CRLF 에 안전하게 써 두었고(B39),
// supabase/tests/run.sh 의 RLS_CRLF=1 이 모든 릴리즈 묶음을 CRLF 로 바꿔 운영 재현 DB 에 RELEASES 순서대로 그대로 적용해 확인합니다.
//
//   node scripts/release/build-release-sql.mjs                         # 모든 릴리즈 → release-sql/ (gitignore)
//   node scripts/release/build-release-sql.mjs --release v0.5-phase2   # 그 릴리즈만 (여러 번 줄 수 있음)
//   node scripts/release/build-release-sql.mjs --out <dir> --crlf      # CRLF 로 씀 (붙여넣기 재현, run.sh 가 사용)
//   … --list                                                           # 쓴 파일 경로만 적용 순서대로 한 줄씩 (run.sh 가 사용)

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MIG = join(REPO, 'supabase/migrations');
const SEED = join(REPO, 'supabase/seed.sql');

/**
 * 운영 적용 순서대로. `dir` 은 출력 폴더 아래 하위 폴더('' = 바로 아래, v0.4 가 처음 쓰던 자리라 그대로 둠).
 * 묶음의 `parts` 는 런북 표의 순서이고 `stage` 는 마이그레이션 머리 주석의 릴리즈 단계(①=1, ③=3)와 같아야 함.
 */
export const RELEASES = [
  {
    name: 'v0.4',
    dir: '',
    bundles: [
      {
        file: '1_먼저실행.sql',
        stage: 1,
        head: [
          '-- pyRoad v0.4 운영 적용 1/3: ① 추가형 마이그레이션 (00003·04·06·07·10·12·14·16·17·18·19)',
          '-- 앱 배포 전에 실행. 하나라도 실패하면 전체가 되돌려집니다.',
        ],
        parts: [
          '00003',
          '00004',
          '00006',
          '00007',
          '00010',
          '00012',
          '00014',
          '00016',
          '00017',
          '00018',
          '00019',
        ],
      },
      {
        file: '2_두번째실행.sql',
        stage: 3,
        head: [
          '-- pyRoad v0.4 운영 적용 2/3: ③ 권한 회수 (00005·08·11·13·15) + 콘텐츠 seed',
          '-- 1/3 적용 + 새 앱 배포·확인 후 실행. 하나라도 실패하면 전체가 되돌려집니다.',
          '-- 00009(평문 API 키 컬럼 삭제)는 평문 키 이관 확인 뒤 3/3 으로 따로.',
        ],
        parts: ['00005', '00008', '00011', '00013', '00015', 'seed'],
      },
      {
        file: '3_선택.sql',
        stage: 3,
        head: [
          '-- pyRoad v0.4 운영 적용 3/3 (선택): 00009 평문 API 키 컬럼 삭제',
          '-- 평문 키가 남아 있으면 오류를 내고 아무것도 바꾸지 않습니다(안전). 그 경우 그대로 두면 됩니다.',
        ],
        parts: ['00009'],
      },
    ],
  },
  {
    name: 'v0.5-phase2',
    dir: 'v0.5-phase2',
    bundles: [
      {
        file: '1_먼저실행.sql',
        stage: 1,
        head: [
          '-- pyRoad v0.5 (Phase 2 병합) 운영 적용 1/1: ① 추가형 마이그레이션 (00020 patch_user_settings)',
          '-- feat/phase2 병합(앱 배포) 전에 실행. 실패하면 전체가 되돌려집니다. docs/release/v0.5-runbook.md',
        ],
        parts: ['00020'],
      },
    ],
  },
  {
    // v0.4 태그는 Phase 1+3 완료 뒤(§10). Phase 3 는 Phase 2(v0.5-phase2) 다음에 병합되므로 적용 순서도 그 뒤
    name: 'v0.4-phase3',
    dir: 'v0.4-phase3',
    bundles: [
      {
        file: '1_먼저실행.sql',
        stage: 1,
        head: [
          '-- pyRoad v0.4 (Phase 3 병합) 운영 적용 1/2: ① 추가형 마이그레이션 (00021 public_avatar_skin · 00023 onboarding · 00024 guardian_consent)',
          '-- feat/phase3 병합(앱 배포) 전에 실행. 실패하면 전체가 되돌려집니다. docs/release/v0.4-runbook.md "Phase 3 병합"',
        ],
        parts: ['00021', '00023', '00024'],
      },
      {
        file: '2_두번째실행.sql',
        stage: 3,
        head: [
          '-- pyRoad v0.4 (Phase 3 병합) 운영 적용 2/2: ③ (00022 clear_legacy_real_names, 되돌릴 수 없는 실명·사진 정리)',
          '-- 1/2 적용 + 새 앱 배포·확인 후 실행. 실패하면 전체가 되돌려집니다. docs/release/v0.4-runbook.md "Phase 3 병합"',
        ],
        parts: ['00022'],
      },
    ],
  },
  {
    name: 'v0.5-phase5',
    dir: 'v0.5-phase5',
    bundles: [
      {
        file: '1_먼저실행.sql',
        stage: 1,
        head: [
          '-- pyRoad v0.5 (Phase 5 병합) 운영 적용 1/1: ① 추가형 마이그레이션 (00025 seen_unlocks)',
          '-- feat/phase5 병합(앱 배포) 전에 실행. 실패하면 전체가 되돌려집니다. docs/release/v0.5-runbook.md "Phase 5 병합"',
        ],
        parts: ['00025'],
      },
    ],
  },
  {
    name: 'v0.6-phase7',
    dir: 'v0.6-phase7',
    bundles: [
      {
        file: '1_먼저실행.sql',
        stage: 1,
        head: [
          '-- pyRoad v0.6 (Phase 7 병합) 운영 적용 1/1: ① 추가형 마이그레이션 (00026 quiz_answer_rpc, 00027 reset_quiz_attempts) + 콘텐츠 seed (퀴즈 21문항·해 볼 일·예시 출력)',
          '-- feat/phase7 병합(앱 배포) 전에 실행. 실패하면 전체가 되돌려집니다. docs/release/v0.6-runbook.md "Phase 7 병합"',
        ],
        // seed 는 00026 뒤 (퀴즈가 잠금 계산에서 빠진 뒤에 퀴즈 행을 넣음)
        parts: ['00026', '00027', 'seed'],
      },
    ],
  },
  {
    name: 'v0.6-phase8',
    dir: 'v0.6-phase8',
    bundles: [
      {
        file: '1_먼저실행.sql',
        stage: 1,
        head: [
          '-- pyRoad v0.6 (Phase 8 병합) 운영 적용 1/1: ① 추가형 마이그레이션 (00028 level_curve, 00029 level_recalc, 00030 coin_ledger, 00031 coin_sources, 00032 star_system, 00033 stage_chest, 00034 daily_missions, 00035 attendance_streak, 00036 achievements, 00037 retro_rewards, 00038 profile_stats)',
          '-- feat/phase8 병합(앱 배포) 직전에 실행. 실패하면 전체가 되돌려집니다. docs/release/v0.6-runbook.md "Phase 8 병합"',
        ],
        parts: [
          '00028',
          '00029',
          '00030',
          '00031',
          '00032',
          '00033',
          '00034',
          '00035',
          '00036',
          '00037',
          '00038',
        ],
      },
    ],
  },
  {
    name: 'v0.7-phase9',
    dir: 'v0.7-phase9',
    bundles: [
      {
        file: '1_먼저실행.sql',
        stage: 1,
        head: [
          '-- pyRoad v0.7 (Phase 9 병합) 운영 적용 1/1: ① 추가형 마이그레이션 (00039 shop_items · 00040 인벤토리)',
          '-- feat/phase9 병합(앱 배포) 직전에 실행. 실패하면 전체가 되돌려집니다. docs/release/v0.7-runbook.md "Phase 9 병합"',
        ],
        parts: ['00039', '00040'],
      },
    ],
  },
];
/** 운영에 묶음 없이 이미 적용된 마이그레이션 */
export const ALREADY_APPLIED = ['00001', '00002'];

function parseArgs(argv) {
  const opts = {
    out: join(REPO, 'release-sql'),
    crlf: false,
    list: false,
    releases: [],
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') opts.out = resolve(argv[++i]);
    else if (argv[i] === '--crlf') opts.crlf = true;
    else if (argv[i] === '--list') opts.list = true;
    else if (argv[i] === '--release') opts.releases.push(argv[++i]);
    else throw new Error(`알 수 없는 인자: ${argv[i]}`);
  }
  return opts;
}

/** 번호('00020') → 파일 경로 */
export function migrationFiles(dir = MIG) {
  const files = new Map();
  for (const f of readdirSync(dir).sort()) {
    const m = /^(\d{5})_.*\.sql$/.exec(f);
    if (m) files.set(m[1], join(dir, f));
  }
  return files;
}

/** 묶음 구성 검사: 모든 마이그레이션이 모든 릴리즈를 통틀어 한 번씩, 머리 주석의 릴리즈 단계와 묶음 단계가 같음 */
export function assertReleases(files, releases = RELEASES) {
  const names = releases.map((r) => r.name);
  const dupName = names.filter((n, i) => names.indexOf(n) !== i);
  if (dupName.length) throw new Error(`릴리즈 이름이 겹침: ${dupName}`);
  const listed = releases
    .flatMap((r) => r.bundles.flatMap((b) => b.parts))
    .filter((p) => p !== 'seed');
  const dup = listed.filter((p, i) => listed.indexOf(p) !== i);
  if (dup.length) throw new Error(`묶음에 두 번 들어간 마이그레이션: ${dup}`);
  const missing = [...files.keys()].filter(
    (n) => !ALREADY_APPLIED.includes(n) && !listed.includes(n),
  );
  if (missing.length)
    throw new Error(
      `묶음에 없는 마이그레이션: ${missing} (scripts/release/build-release-sql.mjs RELEASES 와 런북 표에 추가)`,
    );
  for (const r of releases)
    for (const b of r.bundles)
      for (const p of b.parts) {
        if (p === 'seed') continue;
        if (!files.has(p)) throw new Error(`마이그레이션 파일 없음: ${p}`);
        const tagged3 = /^-- 릴리즈 단계: ③/m.test(
          readFileSync(files.get(p), 'utf8'),
        );
        if (tagged3 !== (b.stage === 3))
          throw new Error(
            `${p}: 머리 주석의 릴리즈 단계와 묶음(${r.name}/${b.file})이 다름`,
          );
      }
}

/** 묶음 하나의 SQL (LF) */
export function bundleText(bundle, files) {
  const out = [...bundle.head, 'BEGIN;', ''];
  for (const p of bundle.parts) {
    const path = p === 'seed' ? SEED : files.get(p);
    const name = p === 'seed' ? 'content seed' : p;
    out.push(
      `-- ===== ${name} =====`,
      readFileSync(path, 'utf8').replace(/\s+$/, ''),
      '',
    );
  }
  out.push('COMMIT;', '');
  const text = out.join('\n');
  if (text.includes('\r'))
    throw new Error(`${bundle.file}: 원본에 CR 이 있음 (LF 로 저장)`);
  return text;
}

/**
 * 고른 릴리즈(없으면 전부)를 out 아래에 쓰고, 쓴 파일 경로를 적용 순서대로 돌려줌
 * @param {{ out?: string, crlf?: boolean, releases?: string[], log?: (line: string) => void }} [options]
 * @returns {string[]}
 */
export function buildReleases({
  out = join(REPO, 'release-sql'),
  crlf = false,
  releases = [],
  log = () => {},
} = {}) {
  const files = migrationFiles();
  assertReleases(files);
  const unknown = releases.filter((n) => !RELEASES.some((r) => r.name === n));
  if (unknown.length)
    throw new Error(
      `모르는 릴리즈: ${unknown} (있는 것: ${RELEASES.map((r) => r.name).join(', ')})`,
    );
  const picked = releases.length
    ? RELEASES.filter((r) => releases.includes(r.name))
    : RELEASES;
  const written = [];
  for (const r of picked) {
    const dir = join(out, r.dir);
    mkdirSync(dir, { recursive: true });
    for (const b of r.bundles) {
      let text = bundleText(b, files);
      if (crlf) text = text.replace(/\n/g, '\r\n');
      const path = join(dir, b.file);
      writeFileSync(path, text);
      written.push(path);
      log(
        `썼어요: ${path} (${Buffer.byteLength(text)} bytes${crlf ? ', CRLF' : ''}) — ${r.name}: ${b.parts.join(' ')}`,
      );
    }
  }
  return written;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const written = buildReleases({
    ...opts,
    log: opts.list ? () => {} : (line) => console.log(line),
  });
  if (opts.list) for (const path of written) console.log(path);
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main();
