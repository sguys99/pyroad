// `/licenses` 오픈소스·에셋 고지 생성기의 순수 함수 (P3-14, §12-Q33, docs/assets-license.md §8).
// 파일을 읽는 것은 넘겨받은 경로·함수로만 해서 단위 테스트가 가짜 node_modules로 돌 수 있다.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * package.json `dependencies`에 있지만 고지 목록에 넣지 않는 것 (이유와 함께).
 * - 쓰지 않는 의존성, 따로 고지하는 런타임(Pyodide)
 */
export const SKIP_ROOTS = {
  'lottie-react':
    '앱에서 쓰지 않는 의존성 (B32). Phase 6에서 lottie-web을 쓰기 시작하면 다시 넣음',
  pyodide: '브라우저 파이썬 런타임으로 따로 고지 (MPL 2.0 + CPython PSF)',
};

/** 패키지 자신만 앱에 들어가고 그 의존성은 들어가지 않는 것 */
export const SELF_ONLY = {
  shadcn:
    'CSS(shadcn/tailwind.css)만 앱에 들어감. 명령줄 도구 의존성은 번들되지 않음',
};

/** 빌드 때만 쓰여 앱(브라우저·서버 함수)에 실리지 않는 패키지. 이 아래로는 따라가지 않는다 */
export const BUILD_ONLY = {
  '@sentry/bundler-plugins':
    'Sentry 빌드 플러그인 (소스맵 업로드, sentry CLI 포함)',
  rollup: 'Sentry 빌드 플러그인이 쓰는 번들러',
  '@rollup/plugin-commonjs': 'Sentry 빌드 플러그인이 쓰는 번들러 플러그인',
  'caniuse-lite': 'Next 빌드 때 브라우저 목록',
  postcss: 'Next 빌드 때 CSS 처리',
};

/** 타입 정의만 있는 패키지는 실행 코드가 없다 */
export function isTypesOnly(name) {
  return name.startsWith('@types/');
}

/** 줄바꿈·끝 공백을 맞춘 글자 (CRLF 원본도 같은 결과) */
export function normalizeText(text) {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/^\n+|\n+$/g, '');
}

export function textId(text) {
  return createHash('sha256').update(text).digest('hex').slice(0, 12);
}

/** node 해석 규칙대로 `fromDir`에서 위로 올라가며 `node_modules/<name>`을 찾는다 (root 밖으로는 안 나감) */
export function resolvePackageDir(name, fromDir, rootDir) {
  let dir = fromDir;
  for (;;) {
    const candidate = join(dir, 'node_modules', name);
    if (existsSync(join(candidate, 'package.json'))) return candidate;
    if (dir === rootDir) return null;
    const parent = dirname(dir);
    if (parent === dir || !parent.startsWith(rootDir)) return null;
    dir = parent;
  }
}

/** package.json의 라이선스 표기 (옛 `licenses: [{type}]` 형식 포함) */
export function licenseOf(pkg) {
  if (typeof pkg.license === 'string' && pkg.license.trim()) {
    return pkg.license.trim();
  }
  if (pkg.license && typeof pkg.license === 'object' && pkg.license.type) {
    return String(pkg.license.type);
  }
  if (Array.isArray(pkg.licenses) && pkg.licenses.length > 0) {
    const types = pkg.licenses.map((l) => l?.type ?? l).filter(Boolean);
    return types.length === 1 ? types[0] : `(${types.join(' OR ')})`;
  }
  return 'UNKNOWN';
}

/** 저장소 주소를 https 주소로. 모르면 npm 페이지 */
export function packageUrl(pkg) {
  const raw =
    typeof pkg.repository === 'string'
      ? pkg.repository
      : (pkg.repository?.url ?? '');
  let url = raw.trim();
  const short = url.match(/^(github|gitlab|bitbucket):(.+)$/);
  if (short)
    url = `https://${short[1]}.${short[1] === 'bitbucket' ? 'org' : 'com'}/${short[2]}`;
  else if (/^[\w.-]+\/[\w.-]+$/.test(url)) url = `https://github.com/${url}`;
  url = url
    .replace(/^git\+/, '')
    .replace(/^git:\/\//, 'https://')
    .replace(/^ssh:\/\/git@/, 'https://')
    .replace(/^git@([^:]+):/, 'https://$1/')
    .replace(/\.git$/, '')
    .replace(/#.*$/, '');
  if (/^https?:\/\//.test(url)) {
    const dir = typeof pkg.repository === 'object' && pkg.repository?.directory;
    return dir && /github\.com/.test(url) ? `${url}/tree/HEAD/${dir}` : url;
  }
  return `https://www.npmjs.com/package/${pkg.name}`;
}

export function authorOf(pkg) {
  const a = pkg.author;
  if (!a) return null;
  if (typeof a === 'string') return a.replace(/\s*[<(].*$/, '').trim() || null;
  return a.name?.trim() || null;
}

const LICENSE_FILE = /^(licen[cs]e|copying)([-._].*)?$/i;
const NOTICE_FILE = /^notice(\.(md|txt))?$/i;

/** 패키지 폴더의 라이선스 파일 내용 (여러 개면 이름 순으로 이어 붙임). 없으면 null */
export function readLicenseFiles(dir, list = readdirSync, read = readFileSync) {
  const names = list(dir)
    .filter((f) => LICENSE_FILE.test(f))
    .sort();
  if (names.length === 0) return null;
  return names
    .map((f) => normalizeText(read(join(dir, f), 'utf8')))
    .filter(Boolean)
    .join('\n\n');
}

export function readNoticeFile(dir, list = readdirSync, read = readFileSync) {
  const name = list(dir).find((f) => NOTICE_FILE.test(f));
  return name ? normalizeText(read(join(dir, name), 'utf8')) || null : null;
}

/**
 * 저작권 고지 줄인가. "Copyright (c) 2020 …"·"Copyright 2018 …"·"Copyright Joyent, Inc."·"(c) 2015 …"·"© …"는 맞고,
 * 조항 본문의 "copyright license to reproduce …"·"(c) You must retain …"은 아니다
 */
export function isCopyrightNotice(line) {
  if (/^copyright\b/i.test(line)) {
    return /^(\(c\)|©|\d|[A-Z@])/.test(line.slice('copyright'.length).trim());
  }
  return /^\(c\)\s*\d{4}/i.test(line) || line.startsWith('©');
}

/** 저작권 줄 (최대 3줄). Apache 부록의 `[yyyy]` 견본 줄은 뺀다 */
export function copyrightLines(text) {
  if (!text) return [];
  const out = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!isCopyrightNotice(line)) continue;
    if (/\[yyyy\]|\{yyyy\}|<year>|\[year\]/i.test(line)) continue;
    if (!out.includes(line)) out.push(line);
    if (out.length === 3) break;
  }
  return out;
}

const APACHE_START =
  'TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION';
const APACHE_END = 'END OF TERMS AND CONDITIONS';
export const APACHE_MARKER =
  '[Apache License 2.0 조항 전문 — 위 "Apache-2.0 표준 문구"와 같아 줄였습니다]';

const squash = (s) => s.replace(/\s+/g, ' ').trim();

/**
 * Apache-2.0 전문이 그대로 들어 있는 라이선스 파일에서 조항 부분(같은 글자)을 표시 하나로 바꾼다.
 * 머리말·저작권·NOTICE 같은 패키지 고유 부분은 남는다. 조항이 표준과 다르면 그대로 둔다.
 */
export function compactApache(text, canonical) {
  const s = text.indexOf(APACHE_START);
  const e = text.indexOf(APACHE_END);
  const cs = canonical.indexOf(APACHE_START);
  const ce = canonical.indexOf(APACHE_END);
  if (s < 0 || e < s || cs < 0 || ce < cs) return text;
  const body = text.slice(s, e + APACHE_END.length);
  const canonBody = canonical.slice(cs, ce + APACHE_END.length);
  if (squash(body) !== squash(canonBody)) return text;
  // 표준 부록("APPENDIX: How to apply …" 견본)도 같으면 함께 줄인다
  let rest = text.slice(e + APACHE_END.length);
  const canonRest = canonical.slice(ce + APACHE_END.length);
  const appendixAt = rest.indexOf('APPENDIX: How to apply');
  if (appendixAt >= 0) {
    const tail = rest.slice(appendixAt);
    const canonAppendix = canonRest.slice(canonRest.indexOf('APPENDIX'));
    if (squash(tail) === squash(canonAppendix))
      rest = rest.slice(0, appendixAt);
  }
  return normalizeText(`${text.slice(0, s)}${APACHE_MARKER}${rest}`);
}

/**
 * package.json `dependencies`에서 시작해 실행에 실리는 패키지를 모은다.
 * `optionalDependencies`(플랫폼별 바이너리)·`peerDependencies`는 따라가지 않으므로 운영체제가 달라도 결과가 같다.
 *
 * @param {string} rootDir 저장소 루트 (node_modules가 있는 곳)
 * @param {{ dependencies?: Record<string, string> }} rootPkg
 * @returns {{ packages: Array<{name: string, version: string, dir: string, pkg: any}>, skipped: string[] }}
 */
export function collectPackages(rootDir, rootPkg) {
  const seenDirs = new Set();
  const byKey = new Map();
  const skipped = new Set();
  const stack = Object.keys(rootPkg.dependencies ?? {})
    .filter((name) => {
      if (name in SKIP_ROOTS) skipped.add(name);
      return !(name in SKIP_ROOTS);
    })
    .map((name) => ({ name, from: rootDir, via: '(root)' }));

  while (stack.length > 0) {
    const { name, from, via } = stack.pop();
    if (isTypesOnly(name) || name in BUILD_ONLY) {
      skipped.add(name);
      continue;
    }
    const dir = resolvePackageDir(name, from, rootDir);
    if (!dir) {
      throw new Error(
        `${via}의 의존성 ${name}을 node_modules에서 찾지 못했어요. npm ci를 먼저 실행하세요`,
      );
    }
    if (seenDirs.has(dir)) continue;
    seenDirs.add(dir);
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    const key = `${pkg.name}@${pkg.version}`;
    if (!byKey.has(key))
      byKey.set(key, { name: pkg.name, version: pkg.version, dir, pkg });
    if (name in SELF_ONLY) continue;
    for (const dep of Object.keys(pkg.dependencies ?? {})) {
      stack.push({ name: dep, from: dir, via: key });
    }
  }
  return {
    packages: [...byKey.values()].sort(
      (a, b) =>
        a.name.localeCompare(b.name, 'en') ||
        a.version.localeCompare(b.version, 'en'),
    ),
    skipped: [...skipped].sort(),
  };
}

/**
 * 패키지 목록 → 라이선스별 묶음 + 중복 없는 전문 표.
 * @param {Array<{name: string, version: string, license: string, url: string, text: string|null, notice: string|null, author: string|null}>} entries
 * @param {{ apache?: string }} standard 표준 문구 (Apache 조항 줄이기용)
 * @returns {{ groups: Array<{ license: string, packages: Array<{ name: string, version: string, url: string, copyright: string[], textId: string | null, noticeId?: string }> }>, texts: Record<string, string> }}
 */
export function groupByLicense(entries, standard = {}) {
  const texts = {};
  const groups = new Map();
  for (const e of entries) {
    let text = e.text;
    if (text && standard.apache) text = compactApache(text, standard.apache);
    let id = null;
    if (text) {
      id = textId(text);
      texts[id] = text;
    }
    let noticeId = null;
    if (e.notice) {
      noticeId = textId(e.notice);
      texts[noticeId] = e.notice;
    }
    const copyright = copyrightLines(text);
    const item = {
      name: e.name,
      version: e.version,
      url: e.url,
      copyright:
        copyright.length > 0
          ? copyright
          : e.author
            ? [`Author: ${e.author}`]
            : [],
      textId: id,
      ...(noticeId ? { noticeId } : {}),
    };
    if (!groups.has(e.license)) groups.set(e.license, []);
    groups.get(e.license).push(item);
  }
  const sortedGroups = [...groups.entries()]
    .map(([license, packages]) => ({
      license,
      packages: packages.sort(
        (a, b) =>
          a.name.localeCompare(b.name, 'en') ||
          a.version.localeCompare(b.version, 'en'),
      ),
    }))
    .sort(
      (a, b) =>
        b.packages.length - a.packages.length ||
        a.license.localeCompare(b.license, 'en'),
    );
  const sortedTexts = Object.fromEntries(
    Object.entries(texts).sort(([a], [b]) => a.localeCompare(b, 'en')),
  );
  return { groups: sortedGroups, texts: sortedTexts };
}

/** 생성물 직렬화 (끝 줄바꿈 하나). --check는 이 문자열을 그대로 비교한다 */
export function serialize(data) {
  return `${JSON.stringify(data, null, 2)}\n`;
}

/** 두 문자열이 처음 달라지는 줄 (드리프트 안내용) */
export function firstDiffLine(current, next) {
  const a = current.split('\n');
  const b = next.split('\n');
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) {
      return { line: i + 1, current: a[i] ?? '(없음)', next: b[i] ?? '(없음)' };
    }
  }
  return null;
}
