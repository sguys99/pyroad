// 앱 웹폰트를 만든다 (P2-10, docs/design/fonts.md). 결과는 src/fonts/에 커밋한다.
//
//   npm run fonts:build              # 전부 (원본 받기 → 랜딩 텍스트 서브셋 → 앱 조각 → CSS·폴백·manifest·README)
//   npm run fonts:build -- --landing # 랜딩 텍스트 서브셋만 (랜딩 문구를 바꿨을 때, 몇 초)
//   npm run fonts:build -- --share-card # 공유 카드 폰트만 (src/fonts/share-card/, P2-19)
//
// 필요: python3 + fontTools 4.63 + brotli (`pip install -r scripts/fonts/requirements.txt`), 네트워크(처음 한 번).
// 원본은 아래 SOURCES의 고정 주소에서 받아 sha256을 확인하고 node_modules/.cache/pyroad-fonts/에 둔다(커밋하지 않음).
//
// 구성 (§2.5, P0-14, §12-Q15·Q27·Q28)
// - 제목 Jua (OFL, 예약 이름 없음 → 이름 그대로): 랜딩 텍스트 서브셋 + 앱 unicode-range 조각
// - 본문 Pretendard Variable → `pyRoad Sans` (예약 이름 "Pretendard"): 랜딩 텍스트 서브셋 + npm 공식 가변 동적 서브셋 92조각의 이름만 바꿈
// - 코드 D2Coding Regular → `pyRoad Mono` (예약 이름 "D2Coding"): 한자 제외 조각 (퀘스트·에디터 레이아웃에서만 로드)
// - 공유 카드(next/og satori, P0-10·P2-19): WOFF2를 못 읽어 TTF/OTF. Jua·pyRoad Sans SemiBold는 KS X 1001 2,350자,
//   pyRoad Sans Bold는 11,172자 전부(대체 폰트). 서버 함수가 고정 경로로 읽으므로 이 폴더에는 카드 폰트만 둔다

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { shareCardText } from './share-card-chars.mjs';
import {
  ALWAYS_CHARS,
  LANDING_ENTRIES,
  ROOT,
  collectLandingText,
} from './landing-text.mjs';

const CACHE =
  process.env.FONT_CACHE ?? join(ROOT, 'node_modules/.cache/pyroad-fonts');
const OUT = join(ROOT, 'src/fonts');
const KIT = join(ROOT, 'scripts/fonts/fontkit.py');

const JUA_COMMIT = 'cbe7e8d481ca94724c15fd4ed93694f2ccf500a7'; // google/fonts, ofl/jua 마지막 변경 (2026-10-22)
const D2_REPO_COMMIT = '48d294137e3b65158deef2f5846d2e335e43f92f'; // naver/d2-coding-font (2026-10-26), OFL.txt만 씀

/** 원본 (주소·sha256 고정). 버전을 올리면 주소·해시를 함께 바꾸고 fonts:build를 다시 돌린다 */
export const SOURCES = {
  jua: {
    url: `https://raw.githubusercontent.com/google/fonts/${JUA_COMMIT}/ofl/jua/Jua-Regular.ttf`,
    sha256: '769677aef240bfc3b9965f2b50748075bff885e6c6992fc591a3fb268279f898',
    file: 'Jua-Regular.ttf',
  },
  juaOfl: {
    url: `https://raw.githubusercontent.com/google/fonts/${JUA_COMMIT}/ofl/jua/OFL.txt`,
    sha256: '44a7c6e4c5572392ae122d3b1d8c6ba6fd640a7797e675384585d947f2773e3c',
    file: 'Jua-OFL.txt',
  },
  pretendard: {
    url: 'https://registry.npmjs.org/pretendard/-/pretendard-1.3.9.tgz',
    sha256: '0ffc240cee83be02520fb4ac1b2a0a51052b9d13506ade0ba90c591dbbb3bd53',
    file: 'pretendard-1.3.9.tgz',
  },
  d2coding: {
    url: 'https://github.com/naver/d2-coding-font/releases/download/VER1.3.2/D2Coding-Ver1.3.2-20180524.zip',
    sha256: '0f1c9192eac7d56329dddc620f9f1666b707e9c8ed38fe1f988d0ae3e30b24e6',
    file: 'D2Coding-Ver1.3.2-20180524.zip',
  },
  d2codingOfl: {
    url: `https://raw.githubusercontent.com/naver/d2-coding-font/${D2_REPO_COMMIT}/OFL.txt`,
    sha256: '1807e8dec4d65f474cbf9be39f5e2254ecb81702babc320749e272ea66ffcc69',
    file: 'D2Coding-OFL.txt',
  },
};

/**
 * 시스템 한글 폰트의 한글 평균 폭(em). 폴백 보정(size-adjust) 계산에 쓴다.
 * 맑은 고딕: Windows 11 malgun.ttf 6.69를 fontkit.py metrics로 잰 값. Noto Sans CJK KR: P0-14 실측.
 * Apple SD Gothic Neo(iOS·macOS)는 아직 재지 못해 보정 없이 스택에만 둔다 (docs/design/fonts.md 남은 일).
 */
export const SYSTEM_KR_FONTS = [
  {
    key: 'Malgun',
    locals: ['Malgun Gothic', '맑은 고딕', 'MalgunGothic'],
    hangulAdvance: 1.0,
  },
  {
    key: 'Noto',
    locals: [
      'Noto Sans CJK KR',
      'NotoSansCJKkr-Regular',
      'Noto Sans KR',
      'NotoSansKR-Regular',
    ],
    hangulAdvance: 0.92,
  },
];

/** 폴백 보정 글꼴이 맡는 범위: 한글 자모·호환 자모·음절 (라틴은 시스템 기본 폰트에 그대로 맡김) */
const KR_FALLBACK_RANGE =
  'U+1100-11FF, U+3130-318F, U+A960-A97F, U+AC00-D7A3, U+D7B0-D7FF';

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

function fetchSource(key) {
  const s = SOURCES[key];
  const path = join(CACHE, s.file);
  if (!existsSync(path)) {
    console.log(`  ↓ ${s.url}`);
    execFileSync(
      'curl',
      ['-fsSL', '--retry', '2', '--max-time', '300', '-o', path, s.url],
      { stdio: 'inherit' },
    );
  }
  const got = sha256(readFileSync(path));
  if (got !== s.sha256) {
    rmSync(path);
    throw new Error(
      `${s.file}: sha256이 다름 (기대 ${s.sha256}, 받음 ${got}). 원본이 바뀌었으면 SOURCES를 확인하세요`,
    );
  }
  return path;
}

function prepareSources() {
  mkdirSync(CACHE, { recursive: true });
  const paths = Object.fromEntries(
    Object.keys(SOURCES).map((k) => [k, fetchSource(k)]),
  );
  // 압축은 출처마다 빈 디렉터리에 푼다 (받은 파일은 신뢰하지 않는 입력)
  const pret = join(CACHE, 'pretendard-1.3.9');
  if (!existsSync(join(pret, 'package/package.json'))) {
    mkdirSync(pret, { recursive: true });
    execFileSync('tar', ['-xzf', paths.pretendard, '-C', pret]);
  }
  const d2 = join(CACHE, 'd2coding-1.3.2');
  if (!existsSync(d2)) {
    execFileSync('python3', ['-I', '-m', 'zipfile', '-e', paths.d2coding, d2]);
  }
  return {
    jua: paths.jua,
    juaOfl: paths.juaOfl,
    pretendardTtf: join(
      pret,
      'package/dist/public/variable/PretendardVariable.ttf',
    ),
    pretendardCss: join(
      pret,
      'package/dist/web/variable/pretendardvariable-dynamic-subset.css',
    ),
    pretendardOfl: join(pret, 'package/dist/LICENSE.txt'),
    pretendardSemiBold: join(
      pret,
      'package/dist/public/static/Pretendard-SemiBold.otf',
    ),
    pretendardBold: join(
      pret,
      'package/dist/public/static/Pretendard-Bold.otf',
    ),
    d2coding: join(d2, 'D2Coding/D2Coding-Ver1.3.2-20180524.ttf'),
    d2codingOfl: paths.d2codingOfl,
  };
}

function kit(args) {
  const out = execFileSync('python3', ['-P', '-E', KIT, ...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  return JSON.parse(out.trim().split('\n').pop());
}

/** 글꼴별 설정. dir·css 이름은 src/fonts/ 아래 경로 */
export const FAMILIES = {
  jua: {
    dir: 'jua',
    family: 'Jua',
    prefix: 'Jua',
    // 굵기 하나뿐인 글꼴을 굵기 범위로 선언해 `font-bold` 제목도 가짜 굵게(합성) 없이 Jua 그대로 그린다
    weight: '100 900',
    landing: 'Jua-landing.woff2',
    version: '1.001 (google/fonts ofl/jua)',
    license: 'SIL OFL 1.1 (예약 이름 없음)',
    rename: null,
  },
  sans: {
    dir: 'pyroad-sans',
    family: 'pyRoad Sans',
    prefix: 'pyRoadSans',
    weight: '45 920',
    landing: 'pyRoadSans-landing.woff2',
    version: 'Pretendard Variable 1.3.9 (내부 버전 1.309)',
    license: 'SIL OFL 1.1 (예약 이름 "Pretendard")',
    rename: 'Pretendard Variable,Pretendard',
  },
  mono: {
    dir: 'pyroad-mono',
    family: 'pyRoad Mono',
    prefix: 'pyRoadMono',
    weight: '400',
    landing: null,
    version: 'D2Coding 1.3.2 (Build 20180524), 리거처 없는 기본판 Regular',
    license: 'SIL OFL 1.1 (예약 이름 "D2Coding", "D2Coding-Bold")',
    rename: 'D2Coding',
  },
};

/**
 * 공유 카드 폰트 (P2-19). `src/fonts/share-card/<dir>/<file>`. 이름 변경 규칙은 앱 폰트와 같다.
 * `src/lib/share-card/fonts.ts`가 이 경로를 **고정 문자열로** 읽는다(동적 경로면 파일 추적이 폴더 전체를 함수에 넣음, P0-10 §4.6)
 */
export const SHARE_CARD_DIR = 'share-card';
export const SHARE_CARD_FONTS = [
  {
    dir: 'jua',
    file: 'Jua-KS2350.ttf',
    src: 'jua',
    range: 'ks2350',
    family: 'Jua',
    weight: 400,
    rename: null,
    use: '제목·닉네임·큰 숫자',
  },
  {
    dir: 'pyroad-sans',
    file: 'pyRoadSans-SemiBold-KS2350.otf',
    src: 'pretendardSemiBold',
    range: 'ks2350',
    family: 'pyRoad Sans',
    weight: 600,
    rename: 'Pretendard',
    use: '본문·설명',
  },
  {
    dir: 'pyroad-sans',
    file: 'pyRoadSans-Bold-Full.otf',
    src: 'pretendardBold',
    range: 'full',
    family: 'pyRoad Sans',
    weight: 700,
    rename: 'Pretendard',
    use: '눈썹 글자·수치 + 대체 폰트(11,172자: 다른 폰트에 없는 글자를 글자 단위로 받침)',
  },
];

function buildShareCard(src) {
  const base = join(OUT, SHARE_CARD_DIR);
  cleanDir(base);
  const files = {};
  for (const f of SHARE_CARD_FONTS) {
    mkdirSync(join(base, f.dir), { recursive: true });
    const textFile = join(CACHE, `share-card-${f.range}.txt`);
    writeFileSync(textFile, shareCardText(f.range));
    const out = join(base, f.dir, f.file);
    const r = kit([
      'subset',
      src[f.src],
      out,
      '--text-file',
      textFile,
      '--sfnt',
      ...(f.rename ? ['--family', f.family, '--rename', f.rename] : []),
    ]);
    files[`${SHARE_CARD_DIR}/${f.dir}/${f.file}`] = {
      family: f.family,
      weight: f.weight,
      range: f.range,
      ...fileInfo(out),
      chars: r.chars,
      // 원본 글꼴에 없는 글자 (기호 일부). 카드는 대체 폰트로 그림
      notInFont: r.missing,
    };
    console.log(
      `  ${f.file}: ${(r.bytes / 1024).toFixed(0)}KB, 글자 ${r.chars}개${r.missing ? `, 원본에 없음: ${r.missing}` : ''}`,
    );
  }
  copyFileSync(src.juaOfl, join(base, 'jua', 'OFL.txt'));
  copyFileSync(src.pretendardOfl, join(base, 'pyroad-sans', 'OFL.txt'));
  const total = Object.values(files).reduce((n, x) => n + x.bytes, 0);
  writeFileSync(
    join(base, 'README.md'),
    [
      '# 공유 카드 폰트 (P2-19)',
      '',
      '`next/og`(satori + resvg) 공유 카드 전용입니다. satori는 WOFF2를 읽지 못해 압축 없는 TTF/OTF이고, 서버 함수(`src/lib/share-card/fonts.ts`)가 고정 경로로 읽어 함수에 번들됩니다. 브라우저에는 보내지 않습니다. 구성·다시 만드는 법: [docs/design/share-card.md](../../../docs/design/share-card.md), [docs/design/fonts.md](../../../docs/design/fonts.md)',
      '',
      '| 파일 | 글꼴 이름 · 굵기 | 글자 | 쓰임 | 원본 |',
      '|---|---|---|---|---|',
      ...SHARE_CARD_FONTS.map((f) => {
        const info = files[`${SHARE_CARD_DIR}/${f.dir}/${f.file}`];
        const origin =
          f.src === 'jua'
            ? `Jua 1.001 (${SOURCES.jua.url})`
            : `npm \`pretendard\` 1.3.9 \`dist/public/static/${f.src === 'pretendardBold' ? 'Pretendard-Bold' : 'Pretendard-SemiBold'}.otf\``;
        return `| \`${f.dir}/${f.file}\` (${(info.bytes / 1024).toFixed(0)}KB) | \`${f.family}\` ${f.weight} | ${f.range === 'full' ? '현대 한글 11,172자' : 'KS X 1001 완성형 2,350자'} + 호환 자모 + ASCII + 카드 기호 | ${f.use} | ${origin} |`;
      }),
      '',
      `합계 ${(total / 1024).toFixed(0)}KB.`,
      '',
      '## 바꾼 것 (OFL "수정본")',
      '',
      '- 서브셋(위 글자 범위), 힌팅 제거, 레이아웃 기능과 저작권·라이선스 name 레코드(0·13·14)는 그대로. CFF(OTF)는 서브루틴을 풀지 않음.',
      '- name 테이블 버전(nameID 5) 끝에 `; pyRoad subset`.',
      '- Pretendard는 OFL 예약 이름 때문에 글꼴 이름이 들어가는 name 레코드를 `pyRoad Sans`로 바꿈. Jua는 예약 이름이 없어 그대로.',
      '- 라이선스 전문은 폴더마다 `OFL.txt`(원본 배포본 그대로).',
      '',
      '파일은 모두 `npm run fonts:build -- --share-card`가 만든 생성물입니다. 직접 고치지 마세요.',
      '',
    ].join('\n'),
  );
  return { dir: SHARE_CARD_DIR, bytes: total, files };
}

function writeFamilyCss(key, faces) {
  const f = FAMILIES[key];
  const total = faces.reduce((n, x) => n + x.bytes, 0);
  const lines = [
    `/* ${f.family} — unicode-range 조각 ${faces.length}개, 합계 ${(total / 1024).toFixed(0)}KB.`,
    ` * 생성물: npm run fonts:build (scripts/fonts/build-fonts.mjs). 직접 고치지 마세요. 출처·라이선스는 README.md·OFL.txt */`,
  ];
  for (const face of faces) {
    lines.push(
      '@font-face {',
      `  font-family: '${f.family}';`,
      '  font-style: normal;',
      `  font-weight: ${f.weight};`,
      '  font-display: swap;',
      `  src: url('./slices/${face.file}') format('woff2');`,
      `  unicode-range: ${face.range};`,
      '}',
    );
  }
  writeFileSync(join(OUT, f.dir, `${f.dir}.css`), lines.join('\n') + '\n');
}

function round(n) {
  return `${(n * 100).toFixed(2)}%`;
}

/** 시스템 한글 폰트를 웹폰트 크기에 맞춘 폴백 @font-face (한글 줄바꿈이 웹폰트와 같아 교체 때 CLS가 거의 없음) */
function writeFallbackCss(metrics) {
  const roles = [
    { name: 'Jua', m: metrics.jua },
    { name: 'pyRoad Sans', m: metrics.sans },
  ];
  const lines = [
    '/* 한글 폴백 보정 (P2-10, P0-14 §4.2). 생성물: npm run fonts:build — 직접 고치지 마세요.',
    ' * next/font의 폴백 보정은 라틴(Arial) 기준이라 한글은 보정 없이 시스템 폰트로 그려진다.',
    ' * 그래서 시스템 한글 폰트를 local()로 감싸 한글 평균 폭이 웹폰트와 같도록 size-adjust를 건다.',
    ' * 값 = 웹폰트 한글 평균 폭 / 시스템 폰트 한글 평균 폭, ascent·descent는 웹폰트 값 / size-adjust.',
    ' * 그 기기에 없는 local() 글꼴은 건너뛰므로 기기마다 맞는 한 벌만 쓰인다. */',
  ];
  for (const { name, m } of roles) {
    for (const sys of SYSTEM_KR_FONTS) {
      const size = m.hangulAdvance / sys.hangulAdvance;
      lines.push(
        '@font-face {',
        `  font-family: '${name} Fallback ${sys.key}';`,
        `  src: ${sys.locals.map((l) => `local('${l}')`).join(', ')};`,
        `  size-adjust: ${round(size)};`,
        `  ascent-override: ${round(m.ascent / size)};`,
        `  descent-override: ${round(m.descent / size)};`,
        '  line-gap-override: 0%;',
        `  unicode-range: ${KR_FALLBACK_RANGE};`,
        '}',
      );
    }
  }
  writeFileSync(join(OUT, 'fallbacks.css'), lines.join('\n') + '\n');
}

function writeReadme(key, src, extra) {
  const f = FAMILIES[key];
  const s = SOURCES[src];
  const body = [
    `# ${f.family}`,
    '',
    `pyRoad 앱이 자체 호스팅하는 웹폰트입니다 (P2-10). 구성·다시 만드는 법: [docs/design/fonts.md](../../../docs/design/fonts.md)`,
    '',
    '| 항목 | 값 |',
    '|---|---|',
    `| 원본 | ${f.version} |`,
    `| 받은 곳 | ${s.url} |`,
    `| 원본 sha256 | \`${s.sha256}\` |`,
    `| 라이선스 | ${f.license} — 전문은 같은 폴더의 [OFL.txt](OFL.txt) |`,
    `| 글꼴 이름 | \`${f.family}\`${
      f.rename
        ? ` (원래 이름 ${f.rename
            .split(',')
            .map((n) => `"${n}"`)
            .join('·')}에서 바꿈)`
        : ''
    } |`,
    '',
    '## 바꾼 것 (OFL "수정본")',
    '',
    ...extra,
    '- 힌팅 제거, 레이아웃 기능(kern 등)과 저작권·라이선스 name 레코드(0·13·14)는 그대로 둠.',
    '- name 테이블 버전(nameID 5) 끝에 `; pyRoad subset`을 붙임.',
    f.rename
      ? `- OFL 예약 이름 때문에 글꼴 이름이 들어가는 name 레코드(1·3·4·6·16·17·21·25·256 이상)를 \`${f.family}\`로 바꿈. 저작권·상표·제작사·디자이너·URL·라이선스 레코드는 원문 그대로.`
      : '- 예약 이름(Reserved Font Name)이 없어 글꼴 이름은 그대로 둠.',
    '',
    '## 파일',
    '',
    ...(f.landing
      ? [
          `- \`${f.landing}\`: 랜딩 텍스트 서브셋 (랜딩 문구에 쓰인 글자 + ASCII). \`src/fonts/landing.ts\`가 \`next/font/local\`로 preload`,
        ]
      : []),
    `- \`${f.dir}.css\` + \`slices/\`: unicode-range 조각. 화면에 나온 글자가 든 조각만 받음`,
    '- `OFL.txt`: 라이선스 전문 (원본 배포본 그대로)',
    '',
    '파일은 모두 `npm run fonts:build`가 만든 생성물입니다. 직접 고치지 마세요.',
    '',
  ];
  writeFileSync(join(OUT, f.dir, 'README.md'), body.join('\n'));
}

function cleanDir(dir) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}

function fileInfo(path) {
  const buf = readFileSync(path);
  return { bytes: buf.length, sha256: sha256(buf) };
}

function main() {
  const landingOnly = process.argv.includes('--landing');
  const shareCardOnly = process.argv.includes('--share-card');
  const manifestPath = join(OUT, 'manifest.json');
  const prev = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, 'utf8'))
    : null;
  if ((landingOnly || shareCardOnly) && !prev) {
    throw new Error(
      'manifest.json이 없어요. 처음에는 --landing·--share-card 없이 실행하세요',
    );
  }

  console.log('[1/4] 원본 준비');
  const src = prepareSources();

  if (shareCardOnly) {
    console.log('[공유 카드] TTF/OTF 서브셋');
    const manifest = { ...prev, shareCard: buildShareCard(src) };
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    execFileSync(
      'npx',
      ['prettier', '--write', '--log-level', 'warn', 'src/fonts/manifest.json'],
      { cwd: ROOT, stdio: 'inherit' },
    );
    console.log(`done → ${relative(ROOT, join(OUT, SHARE_CARD_DIR))}`);
    return;
  }

  console.log('[2/4] 랜딩 텍스트 서브셋');
  const landing = collectLandingText();
  const textFile = join(CACHE, 'landing-text.txt');
  writeFileSync(textFile, ALWAYS_CHARS + landing.chars.join(''));
  const landingFonts = {};
  for (const [key, from] of [
    ['jua', src.jua],
    ['sans', src.pretendardTtf],
  ]) {
    const f = FAMILIES[key];
    mkdirSync(join(OUT, f.dir), { recursive: true });
    const out = join(OUT, f.dir, f.landing);
    const r = kit([
      'subset',
      from,
      out,
      '--text-file',
      textFile,
      ...(f.rename ? ['--family', f.family, '--rename', f.rename] : []),
    ]);
    landingFonts[key] = {
      file: `${f.dir}/${f.landing}`,
      ...fileInfo(out),
      // 원본 글꼴에 없어 서브셋에 넣을 수 없는 글자 (이모지 등). 시스템 폰트로 그려짐
      notInFont: r.missing,
    };
    console.log(
      `  ${f.family}: ${(r.bytes / 1024).toFixed(1)}KB, 글자 ${r.chars}개${r.missing ? `, 원본에 없음: ${r.missing}` : ''}`,
    );
  }

  let families = prev?.families ?? {};
  let metrics = prev?.metrics;
  let shareCard = prev?.shareCard;
  if (!landingOnly) {
    console.log('[공유 카드] TTF/OTF 서브셋');
    shareCard = buildShareCard(src);

    console.log('[3/4] 앱 unicode-range 조각');
    const commands = {
      jua: (dir) => [
        'slice',
        src.jua,
        dir,
        '--ranges',
        src.pretendardCss,
        '--prefix',
        FAMILIES.jua.prefix,
      ],
      sans: (dir) => [
        'rewrap',
        src.pretendardCss,
        dir,
        '--prefix',
        FAMILIES.sans.prefix,
        '--family',
        FAMILIES.sans.family,
        '--rename',
        FAMILIES.sans.rename,
      ],
      mono: (dir) => [
        'slice',
        src.d2coding,
        dir,
        '--ranges',
        src.pretendardCss,
        '--prefix',
        FAMILIES.mono.prefix,
        '--no-hanja',
        '--family',
        FAMILIES.mono.family,
        '--rename',
        FAMILIES.mono.rename,
      ],
    };
    families = {};
    for (const [key, command] of Object.entries(commands)) {
      const f = FAMILIES[key];
      const sliceDir = join(OUT, f.dir, 'slices');
      cleanDir(sliceDir);
      const { faces } = kit(command(sliceDir));
      writeFamilyCss(key, faces);
      families[key] = {
        family: f.family,
        css: `${f.dir}/${f.dir}.css`,
        faces: faces.length,
        bytes: faces.reduce((n, x) => n + x.bytes, 0),
        files: Object.fromEntries(
          faces.map((x) => [
            `${f.dir}/slices/${x.file}`,
            sha256(readFileSync(join(sliceDir, x.file))),
          ]),
        ),
      };
      console.log(
        `  ${f.family}: 조각 ${faces.length}개, ${(families[key].bytes / 1024).toFixed(0)}KB`,
      );
    }

    const [jua, sans] = kit(['metrics', src.jua, src.pretendardTtf]);
    metrics = { jua, sans };
    writeFallbackCss(metrics);

    // 라이선스 전문 (원본 배포본 그대로) + README
    copyFileSync(src.juaOfl, join(OUT, FAMILIES.jua.dir, 'OFL.txt'));
    copyFileSync(src.pretendardOfl, join(OUT, FAMILIES.sans.dir, 'OFL.txt'));
    copyFileSync(src.d2codingOfl, join(OUT, FAMILIES.mono.dir, 'OFL.txt'));
    writeReadme('jua', 'jua', [
      '- 서브셋: 랜딩 텍스트 서브셋 1개 + unicode-range 조각(기준 묶음은 npm `pretendard` 1.3.9 가변 동적 서브셋 CSS, 실제 글리프가 있는 글자만 적음).',
    ]);
    writeReadme('sans', 'pretendard', [
      '- 조각: npm `pretendard` 1.3.9의 공식 가변 동적 서브셋(`dist/web/variable/woff2-dynamic-subset/`) 92개를 글리프는 그대로 두고 이름만 바꿔 다시 저장.',
      '- 랜딩 텍스트 서브셋: `dist/public/variable/PretendardVariable.ttf`에서 랜딩 글자만 남김 (가변 축 wght 45~920 유지).',
    ]);
    writeReadme('mono', 'd2coding', [
      '- 원본: 릴리스 zip의 `D2Coding/D2Coding-Ver1.3.2-20180524.ttf` (리거처 없는 기본판 Regular). OFL.txt는 zip에 없어 저장소(`naver/d2-coding-font` ' +
        `\`${D2_REPO_COMMIT.slice(0, 7)}\`)의 OFL.txt를 그대로 씀.`,
      '- 서브셋: 한자·가나를 뺀 unicode-range 조각(기준 묶음은 npm `pretendard` 가변 동적 서브셋 CSS, 그 밖의 글자는 코드포인트 순 160자씩).',
    ]);
  }

  console.log('[4/4] manifest');
  const manifest = {
    $comment:
      '생성물: npm run fonts:build (scripts/fonts/build-fonts.mjs). 검사: npm run fonts:check. docs/design/fonts.md',
    sources: Object.fromEntries(
      Object.entries(SOURCES).map(([k, s]) => [
        k,
        { url: s.url, sha256: s.sha256 },
      ]),
    ),
    landing: {
      entries: LANDING_ENTRIES,
      chars: landing.chars.join(''),
      fonts: landingFonts,
    },
    families,
    metrics,
    systemKrFonts: SYSTEM_KR_FONTS,
    shareCard,
  };
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

  // 생성한 CSS·JSON·README를 저장소 Prettier 규칙에 맞춘다 (README는 .prettierignore 대상)
  execFileSync(
    'npx',
    ['prettier', '--write', '--log-level', 'warn', 'src/fonts/**/*.{css,json}'],
    { cwd: ROOT, stdio: 'inherit' },
  );
  console.log(`done → ${relative(ROOT, OUT)}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
