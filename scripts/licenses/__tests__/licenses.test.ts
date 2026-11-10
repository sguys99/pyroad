import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  APACHE_MARKER,
  collectPackages,
  compactApache,
  copyrightLines,
  firstDiffLine,
  groupByLicense,
  isCopyrightNotice,
  licenseOf,
  normalizeText,
  packageUrl,
  serialize,
} from '../lib/collect.mjs';
import {
  OUTPUT,
  ROOT,
  buildLicenseData,
  checkPyodideVersion,
} from '../build-licenses.mjs';
import { FONTS, PYODIDE_EXPECTED, SOUNDS } from '../notices.mjs';

// /licenses 고지 생성기 (P3-14, §12-Q33): 패키지 모으기·라이선스별 묶기·전문 줄이기·드리프트 검사

const APACHE = readFileSync(
  join(ROOT, 'scripts/licenses/texts/Apache-2.0.txt'),
  'utf8',
);
const SCRIPT = join(ROOT, 'scripts/licenses/build-licenses.mjs');

let tmp: string | null = null;
afterEach(() => {
  if (tmp) rmSync(tmp, { recursive: true, force: true });
  tmp = null;
});

/** 가짜 저장소: { 'node_modules/a': {package.json 필드, files} } */
function fakeRepo(
  rootDeps: Record<string, string>,
  pkgs: Record<
    string,
    { json: Record<string, unknown>; files?: Record<string, string> }
  >,
) {
  tmp = mkdtempSync(join(tmpdir(), 'pyroad-licenses-'));
  writeFileSync(
    join(tmp, 'package.json'),
    JSON.stringify({ dependencies: rootDeps }),
  );
  for (const [path, { json, files = {} }] of Object.entries(pkgs)) {
    const dir = join(tmp, path);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'package.json'), JSON.stringify(json));
    for (const [f, text] of Object.entries(files))
      writeFileSync(join(dir, f), text);
  }
  return tmp;
}

describe('패키지 모으기 (dependencies만 따라감)', () => {
  it('중첩 node_modules를 node 규칙대로 찾고, optional·peer·타입·빌드 도구·제외 목록은 따라가지 않는다', () => {
    const root = fakeRepo(
      { a: '1', shadcn: '1', pyodide: '1' },
      {
        'node_modules/a': {
          json: {
            name: 'a',
            version: '1.0.0',
            license: 'MIT',
            dependencies: { b: '2', '@types/x': '1', rollup: '4' },
            optionalDependencies: { 'native-bin': '1' },
            peerDependencies: { react: '19' },
          },
        },
        // a 아래에 중첩된 b@2 (위의 b@1보다 먼저 찾아야 함)
        'node_modules/a/node_modules/b': {
          json: { name: 'b', version: '2.0.0', license: 'ISC' },
        },
        'node_modules/b': {
          json: { name: 'b', version: '1.0.0', license: 'ISC' },
        },
        'node_modules/shadcn': {
          json: {
            name: 'shadcn',
            version: '4.0.0',
            license: 'MIT',
            dependencies: { cli: '1' },
          },
        },
        'node_modules/pyodide': {
          json: { name: 'pyodide', version: '1.0.0', license: 'MPL-2.0' },
        },
      },
    );
    const { packages, skipped } = collectPackages(root, {
      dependencies: { a: '1', shadcn: '1', pyodide: '1' },
    });
    expect(packages.map((p) => `${p.name}@${p.version}`)).toEqual([
      'a@1.0.0',
      'b@2.0.0',
      'shadcn@4.0.0', // 자신만 (cli는 따라가지 않음 → 없어도 오류 아님)
    ]);
    expect(skipped).toEqual(['@types/x', 'pyodide', 'rollup']);
  });

  it('dependencies에 있는데 설치되지 않은 패키지는 오류 (npm ci 안내)', () => {
    const root = fakeRepo(
      { a: '1' },
      {
        'node_modules/a': {
          json: {
            name: 'a',
            version: '1.0.0',
            license: 'MIT',
            dependencies: { gone: '1' },
          },
        },
      },
    );
    expect(() => collectPackages(root, { dependencies: { a: '1' } })).toThrow(
      /gone/,
    );
  });
});

describe('라이선스 정보 읽기', () => {
  it('license 표기: 문자열·객체·옛 licenses 배열', () => {
    expect(licenseOf({ license: 'MIT' })).toBe('MIT');
    expect(licenseOf({ license: { type: 'ISC' } })).toBe('ISC');
    expect(
      licenseOf({ licenses: [{ type: 'MIT' }, { type: 'Apache-2.0' }] }),
    ).toBe('(MIT OR Apache-2.0)');
    expect(licenseOf({})).toBe('UNKNOWN');
  });

  it('저장소 주소를 https로 바꾼다', () => {
    expect(
      packageUrl({ name: 'x', repository: 'git+https://github.com/a/b.git' }),
    ).toBe('https://github.com/a/b');
    expect(packageUrl({ name: 'x', repository: 'github:a/b' })).toBe(
      'https://github.com/a/b',
    );
    expect(packageUrl({ name: 'x', repository: 'a/b' })).toBe(
      'https://github.com/a/b',
    );
    expect(
      packageUrl({ name: 'x', repository: { url: 'git@github.com:a/b.git' } }),
    ).toBe('https://github.com/a/b');
    expect(
      packageUrl({
        name: 'x',
        repository: { url: 'https://github.com/a/m', directory: 'pkg/x' },
      }),
    ).toBe('https://github.com/a/m/tree/HEAD/pkg/x');
    expect(packageUrl({ name: '@s/x' })).toBe(
      'https://www.npmjs.com/package/@s/x',
    );
  });

  it('CRLF·끝 공백을 맞춘다', () => {
    expect(normalizeText('\r\nA  \r\nB\t\r\n\r\n')).toBe('A\nB');
  });

  it('저작권 줄만 고른다 (조항 본문·견본 줄 제외)', () => {
    expect(isCopyrightNotice('Copyright (c) 2020 Kiril Vatev')).toBe(true);
    expect(isCopyrightNotice('Copyright 2018 The Jua Project Authors')).toBe(
      true,
    );
    expect(
      isCopyrightNotice('Copyright Joyent, Inc. and other Node contributors.'),
    ).toBe(true);
    expect(isCopyrightNotice('(c) 2015 someone')).toBe(true);
    expect(
      isCopyrightNotice(
        'copyright license to reproduce, prepare Derivative Works of,',
      ),
    ).toBe(false);
    expect(isCopyrightNotice('(c) You must retain, in the Source form')).toBe(
      false,
    );
    expect(
      copyrightLines(
        'MIT\n\nCopyright (c) 2020 A\nCopyright (c) 2020 A\n   Copyright [yyyy] [name of copyright owner]',
      ),
    ).toEqual(['Copyright (c) 2020 A']);
  });
});

describe('Apache-2.0 전문 줄이기', () => {
  it('표준과 같은 조항은 표시 하나로 바꾸고 머리말·저작권은 남긴다', () => {
    const pkgText = `Copyright 2024 SWC contributors.\n\n${APACHE}`;
    const compact = compactApache(
      normalizeText(pkgText),
      normalizeText(APACHE),
    );
    expect(compact).toContain('Copyright 2024 SWC contributors.');
    expect(compact).toContain(APACHE_MARKER);
    expect(compact).not.toContain('Grant of Copyright License');
    expect(compact.length).toBeLessThan(1000);
  });

  it('조항을 고친 라이선스는 그대로 둔다', () => {
    const changed = normalizeText(APACHE).replace(
      'Grant of Patent License',
      'Grant of NOTHING',
    );
    expect(compactApache(changed, normalizeText(APACHE))).toBe(changed);
  });
});

describe('라이선스별 묶기', () => {
  const entry = (name: string, license: string, text: string | null) => ({
    name,
    version: '1.0.0',
    license,
    url: `https://example.com/${name}`,
    author: 'Someone',
    text,
    notice: null,
  });

  it('많은 묶음이 먼저, 묶음 안은 이름 순, 같은 전문은 한 번만 저장', () => {
    const mit = 'Copyright (c) 2020 X\n\nPermission is hereby granted';
    const { groups, texts } = groupByLicense([
      entry('zeta', 'MIT', mit),
      entry('alpha', 'MIT', mit),
      entry('solo', 'ISC', 'ISC text'),
      entry('nofile', 'MIT', null),
    ]);
    expect(
      groups.map((g) => [g.license, g.packages.map((p) => p.name)]),
    ).toEqual([
      ['MIT', ['alpha', 'nofile', 'zeta']],
      ['ISC', ['solo']],
    ]);
    expect(Object.keys(texts)).toHaveLength(2);
    const [alpha, nofile, zeta] = groups[0].packages;
    expect(alpha.textId).toBe(zeta.textId);
    expect(alpha.copyright).toEqual(['Copyright (c) 2020 X']);
    // 라이선스 파일이 없으면 package.json 작성자
    expect(nofile.textId).toBeNull();
    expect(nofile.copyright).toEqual(['Author: Someone']);
  });
});

describe('생성물과 드리프트 검사', () => {
  it('커밋된 생성물이 지금 의존성·에셋과 같다 (다르면 npm run licenses:build)', () => {
    const committed = readFileSync(join(ROOT, OUTPUT), 'utf8');
    expect(serialize(buildLicenseData(ROOT))).toBe(committed);
  });

  it('생성물에 런타임·글꼴·소리·npm 묶음이 모두 있고, 표준 문구와 전문 참조가 이어진다', () => {
    const data = buildLicenseData(ROOT);
    expect(data.runtime.map((r: { id: string }) => r.id)).toEqual([
      'pyodide',
      'cpython',
      'emscripten',
    ]);
    expect(data.runtime[0].text).toMatch(
      /^Mozilla Public License Version 2\.0/,
    );
    expect(data.runtime[1].text).toContain(
      'PYTHON SOFTWARE FOUNDATION LICENSE VERSION 2',
    );
    for (const f of data.fonts)
      expect(f.text).toContain('SIL OPEN FONT LICENSE Version 1.1');
    expect(data.npm.standardTexts.MIT).toContain(
      'Permission is hereby granted',
    );
    const names = data.npm.groups.flatMap(
      (g: { packages: { name: string }[] }) => g.packages.map((p) => p.name),
    );
    for (const n of [
      'react',
      'next',
      'lucide-react',
      'canvas-confetti',
      'shadcn',
    ]) {
      expect(names).toContain(n);
    }
    // 빌드 도구·안 쓰는 의존성·Pyodide(따로 고지)는 npm 목록에 없다
    for (const n of [
      'sentry',
      'rollup',
      'lottie-react',
      'pyodide',
      'caniuse-lite',
    ]) {
      expect(names).not.toContain(n);
    }
    for (const g of data.npm.groups) {
      for (const p of g.packages) {
        if (p.textId) expect(data.npm.texts[p.textId]).toBeTruthy();
        else expect(data.npm.standardTexts[g.license]).toBeTruthy();
      }
    }
  });

  it('--check는 같으면 0, 다르면 1로 끝난다', () => {
    tmp = mkdtempSync(join(tmpdir(), 'pyroad-licenses-check-'));
    const out = join(tmp, 'licenses.json');
    writeFileSync(out, readFileSync(join(ROOT, OUTPUT), 'utf8'));
    execFileSync(process.execPath, [SCRIPT, '--check', '--out', out], {
      stdio: 'pipe',
    });

    writeFileSync(
      out,
      readFileSync(out, 'utf8').replace('"count":', '"count": 1, "x":'),
    );
    let code = 0;
    try {
      execFileSync(process.execPath, [SCRIPT, '--check', '--out', out], {
        stdio: 'pipe',
      });
    } catch (e) {
      code = (e as { status: number }).status;
    }
    expect(code).toBe(1);
  });

  it('처음 달라지는 줄을 알려 준다', () => {
    expect(firstDiffLine('a\nb\nc', 'a\nB\nc')).toEqual({
      line: 2,
      current: 'b',
      next: 'B',
    });
    expect(firstDiffLine('a', 'a')).toBeNull();
  });

  it('Pyodide 판이 바뀌면 고지 텍스트를 새로 받으라고 멈춘다', () => {
    expect(
      checkPyodideVersion(PYODIDE_EXPECTED.version, {
        python: PYODIDE_EXPECTED.python,
        platform: PYODIDE_EXPECTED.platform,
      }),
    ).toEqual([]);
    expect(
      checkPyodideVersion('315.0.0', {
        python: '3.15.0',
        platform: PYODIDE_EXPECTED.platform,
      }),
    ).toHaveLength(2);
  });
});

describe('npm 밖 고지 ↔ docs/assets-license.md', () => {
  const doc = readFileSync(join(ROOT, 'docs/assets-license.md'), 'utf8');

  it('사운드 작가·페이지가 라이선스 기록 문서에 있다', () => {
    for (const s of SOUNDS) {
      expect(doc).toContain(s.author.replace(/ \(.*\)$/, ''));
      for (const w of s.works) expect(doc).toContain(w.url);
    }
  });

  it('글꼴 OFL 파일이 있고 원래 이름이 문서와 같다', () => {
    for (const f of FONTS) {
      expect(readFileSync(join(ROOT, f.text), 'utf8')).toContain(
        'SIL OPEN FONT LICENSE',
      );
      expect(doc).toContain(f.original.split(' ')[0]);
      expect(dirname(f.text)).toMatch(/^src\/fonts\//);
    }
  });
});
