#!/usr/bin/env node
// 운영 SQL Editor 붙여넣기용 묶음 파일 생성 (v0.4, B39)
//
// docs/release/v0.4-runbook.md 의 ①·③·콘텐츠 seed 를 실행 순서대로 이어 붙여, 파일마다 BEGIN; … COMMIT; 한 번으로 감쌉니다.
// 하나라도 실패하면 그 파일 전체가 되돌려집니다 (마이그레이션의 자기 검증 예외 포함).
//   1_먼저실행.sql   ① 추가형 (앱 배포 전)
//   2_두번째실행.sql ③ 권한 회수 + 콘텐츠 seed (새 앱 배포·확인 뒤)
//   3_선택.sql       00009 평문 API 키 컬럼 삭제 (평문 키 이관 0 확인 뒤)
//
// Windows 에서 SQL Editor 에 붙여넣으면 줄바꿈이 모두 CRLF 로 바뀝니다. 마이그레이션·seed 는 CRLF 에 안전하게 써 두었고(B39),
// supabase/tests/run.sh 의 RLS_CRLF=1 이 이 묶음을 CRLF 로 바꿔 운영 재현 DB 에 그대로 적용해 확인합니다.
//
//   node scripts/release/build-release-sql.mjs                 # → release-sql/ (gitignore)
//   node scripts/release/build-release-sql.mjs --out <dir> --crlf   # CRLF 로 씀 (붙여넣기 재현, run.sh 가 사용)

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MIG = join(REPO, 'supabase/migrations');
const SEED = join(REPO, 'supabase/seed.sql');

// 런북 ① 표·③ 표의 순서. 00001·00002 는 운영에 이미 적용됨
const BUNDLES = [
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
];
const ALREADY_APPLIED = ['00001', '00002'];

function parseArgs(argv) {
  const opts = { out: join(REPO, 'release-sql'), crlf: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') opts.out = resolve(argv[++i]);
    else if (argv[i] === '--crlf') opts.crlf = true;
    else throw new Error(`알 수 없는 인자: ${argv[i]}`);
  }
  return opts;
}

function migrationFiles() {
  const files = new Map();
  for (const f of readdirSync(MIG).sort()) {
    const m = /^(\d{5})_.*\.sql$/.exec(f);
    if (m) files.set(m[1], join(MIG, f));
  }
  return files;
}

/** 묶음 구성 검사: 모든 마이그레이션이 한 번씩, 머리 주석의 릴리즈 단계와 묶음 단계가 같음 */
function assertBundles(files) {
  const listed = BUNDLES.flatMap((b) => b.parts).filter((p) => p !== 'seed');
  const dup = listed.filter((p, i) => listed.indexOf(p) !== i);
  if (dup.length) throw new Error(`묶음에 두 번 들어간 마이그레이션: ${dup}`);
  const missing = [...files.keys()].filter(
    (n) => !ALREADY_APPLIED.includes(n) && !listed.includes(n),
  );
  if (missing.length)
    throw new Error(
      `묶음에 없는 마이그레이션: ${missing} (BUNDLES 와 런북 표에 추가)`,
    );
  for (const b of BUNDLES)
    for (const p of b.parts) {
      if (p === 'seed') continue;
      if (!files.has(p)) throw new Error(`마이그레이션 파일 없음: ${p}`);
      const tagged3 = /^-- 릴리즈 단계: ③/m.test(
        readFileSync(files.get(p), 'utf8'),
      );
      if (tagged3 !== (b.stage === 3))
        throw new Error(
          `${p}: 머리 주석의 릴리즈 단계와 묶음(${b.file})이 다름`,
        );
    }
}

function bundleText(bundle, files) {
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
  return out.join('\n');
}

const opts = parseArgs(process.argv.slice(2));
const files = migrationFiles();
assertBundles(files);
mkdirSync(opts.out, { recursive: true });
for (const b of BUNDLES) {
  let text = bundleText(b, files);
  if (text.includes('\r'))
    throw new Error(`${b.file}: 원본에 CR 이 있음 (LF 로 저장)`);
  if (opts.crlf) text = text.replace(/\n/g, '\r\n');
  writeFileSync(join(opts.out, b.file), text);
  console.log(
    `썼어요: ${join(opts.out, b.file)} (${Buffer.byteLength(text)} bytes${opts.crlf ? ', CRLF' : ''}) — ${b.parts.join(' ')}`,
  );
}
