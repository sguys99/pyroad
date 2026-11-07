// `/licenses` 고지 화면의 npm 밖 항목: 브라우저 파이썬 런타임·웹폰트·사운드 (P3-14, §12-Q33).
// 정본은 docs/assets-license.md(§2 폰트, §3 사운드, §5 런타임, §8 고지 문안)이고, 이 표는 화면에 보일 고지만 담는다.
// 에셋을 바꾸면 그 문서와 이 표를 같은 커밋에서 고치고 `npm run licenses:build`를 다시 돌린다
// (단위 테스트가 이 표의 작가·주소가 그 문서에 있는지 확인한다).
//
// texts/ 아래 전문은 받은 그대로 둔다:
// - MPL-2.0.txt                     https://raw.githubusercontent.com/pyodide/pyodide/314.0.7/LICENSE (2026-11-06)
// - cpython-3.14.2-LICENSE.txt      https://raw.githubusercontent.com/python/cpython/v3.14.2/LICENSE (2026-11-06)
// - emscripten-5.0.3-LICENSE.txt    https://raw.githubusercontent.com/emscripten-core/emscripten/5.0.3/LICENSE (2026-11-06)
// - Apache-2.0.txt                  https://www.apache.org/licenses/LICENSE-2.0.txt (2026-11-06)

/** 고지 텍스트가 맞춰져 있는 Pyodide 판. node_modules와 다르면 생성기가 멈춘다 (texts/를 새 판으로 바꿀 것) */
export const PYODIDE_EXPECTED = {
  version: '314.0.7',
  python: '3.14.2',
  platform: 'emscripten_5_0_3',
};

/** MIT 표준 허락 문구 (저작권 줄은 패키지마다 다르므로 뺌). 라이선스 파일이 없는 MIT 패키지에 이 문구를 함께 보여 준다 */
export const MIT_STANDARD = `Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

/**
 * 브라우저 파이썬 런타임. `text`는 texts/ 파일 이름
 * TODO(P12-06 법률 검토): CPython과 함께 빌드된 C 라이브러리 목록·전문을 Pyodide 314.0.7 빌드 설정으로 확인
 */
export const RUNTIME = [
  {
    id: 'pyodide',
    name: 'Pyodide',
    version: PYODIDE_EXPECTED.version,
    license: 'MPL-2.0',
    copyright: [],
    url: `https://github.com/pyodide/pyodide/tree/${PYODIDE_EXPECTED.version}`,
    note: '브라우저에서 파이썬을 실행합니다. 배포 파일을 고치지 않고 우리 도메인(/pyodide/)에서 그대로 제공하며, 소스 코드는 위 주소에서 받을 수 있습니다 (MPL 2.0 §3.2).',
    text: 'MPL-2.0.txt',
  },
  {
    id: 'cpython',
    name: 'CPython (Pyodide 안의 파이썬 인터프리터·표준 라이브러리)',
    version: PYODIDE_EXPECTED.python,
    license: 'PSF-2.0',
    copyright: [
      'Copyright (c) 2001 Python Software Foundation; All Rights Reserved',
    ],
    url: `https://github.com/python/cpython/tree/v${PYODIDE_EXPECTED.python}`,
    note: 'Python Software Foundation License Version 2와 그 이전 판 라이선스(BeOpen·CNRI·CWI)를 따릅니다. 함께 빌드된 C 라이브러리(zlib, bzip2, expat, libffi, mpdecimal 등)는 허용형 라이선스입니다.',
    text: 'cpython-3.14.2-LICENSE.txt',
  },
  {
    id: 'emscripten',
    name: 'Emscripten 런타임 (Pyodide 안)',
    version: '5.0.3',
    license: 'MIT OR NCSA',
    copyright: [
      'Copyright (c) 2010-2014 Emscripten authors, see AUTHORS file.',
    ],
    url: 'https://github.com/emscripten-core/emscripten/tree/5.0.3',
    note: 'Pyodide를 WebAssembly로 빌드한 도구의 런타임 코드가 Pyodide 파일에 들어 있습니다.',
    text: 'emscripten-5.0.3-LICENSE.txt',
  },
];

/** 웹폰트 3종. `text`는 저장소 경로 (폴더마다 원본 OFL.txt) */
export const FONTS = [
  {
    id: 'jua',
    name: 'Jua',
    original: 'Jua 1.001',
    license: 'OFL-1.1',
    copyright: ['Copyright 2018 The Jua Project Authors'],
    url: 'https://github.com/google/fonts/tree/main/ofl/jua',
    note: '제목 글꼴. 쓰는 글자만 남긴 서브셋입니다.',
    text: 'src/fonts/jua/OFL.txt',
  },
  {
    id: 'pyroad-sans',
    name: 'pyRoad Sans',
    original: 'Pretendard 1.3.9',
    license: 'OFL-1.1',
    copyright: ['Copyright (c) 2021, Kil Hyung-jin'],
    url: 'https://github.com/orioncactus/pretendard',
    note: '본문 글꼴. Pretendard를 서브셋으로 고쳐 만들었고, 라이선스의 예약 글꼴 이름 규칙에 따라 이름을 pyRoad Sans로 바꿨습니다.',
    text: 'src/fonts/pyroad-sans/OFL.txt',
  },
  {
    id: 'pyroad-mono',
    name: 'pyRoad Mono',
    original: 'D2Coding 1.3.2',
    license: 'OFL-1.1',
    copyright: ['Copyright (c) 2015, NAVER Corporation'],
    url: 'https://github.com/naver/d2codingfont',
    note: '코드 글꼴. D2Coding을 서브셋으로 고쳐 만들었고, 라이선스의 예약 글꼴 이름 규칙에 따라 이름을 pyRoad Mono로 바꿨습니다.',
    text: 'src/fonts/pyroad-mono/OFL.txt',
  },
];

/** 사운드 (모두 CC0 1.0 — 의무는 없지만 감사의 뜻으로 적음, docs/assets-license.md §3·§8) */
export const SOUNDS = [
  {
    id: 'sfx-kenney',
    name: '효과음 12종',
    author: 'Kenney (kenney.nl)',
    license: 'CC0-1.0',
    works: [
      {
        title: 'Interface Sounds',
        url: 'https://opengameart.org/content/interface-sounds',
      },
      {
        title: 'RPG Audio',
        url: 'https://opengameart.org/content/50-rpg-sound-effects',
      },
      {
        title: 'Digital Audio',
        url: 'https://opengameart.org/content/63-digital-sound-effects-lasers-phasers-space-etc',
      },
      {
        title: 'Music Jingles',
        url: 'https://opengameart.org/content/85-short-music-jingles',
      },
    ],
  },
  {
    id: 'bgm-world1',
    name: '월드 1 배경음악',
    author: 'congusbongus (OpenGameArt)',
    license: 'CC0-1.0',
    works: [
      {
        title: 'Keep your dream alive! (seamless)',
        url: 'https://opengameart.org/content/keep-your-dream-alive-seamless-loop',
      },
    ],
  },
  {
    id: 'bgm-world2',
    name: '월드 2 배경음악',
    author: 'Trex0n (OpenGameArt)',
    license: 'CC0-1.0',
    works: [
      { title: 'Aurora', url: 'https://opengameart.org/content/aurora-0' },
    ],
  },
  {
    id: 'bgm-world3',
    name: '월드 3 배경음악',
    author: 'Some Weirdo (OpenGameArt)',
    license: 'CC0-1.0',
    works: [
      {
        title: 'A Respectable Amount of Bounce',
        url: 'https://opengameart.org/content/a-respectable-amount-of-bounce',
      },
    ],
  },
];

/** 라이선스 이름표 (화면용) */
export const LICENSE_NAMES = {
  MIT: 'MIT License',
  ISC: 'ISC License',
  'Apache-2.0': 'Apache License 2.0',
  'BSD-2-Clause': 'BSD 2-Clause License',
  'BSD-3-Clause': 'BSD 3-Clause License',
  '0BSD': 'BSD Zero Clause License',
  'BlueOak-1.0.0': 'Blue Oak Model License 1.0.0',
  'MPL-2.0': 'Mozilla Public License 2.0',
  'PSF-2.0': 'Python Software Foundation License 2.0',
  'OFL-1.1': 'SIL Open Font License 1.1',
  'CC0-1.0': 'CC0 1.0 (퍼블릭 도메인)',
  'MIT OR NCSA': 'MIT License 또는 University of Illinois/NCSA License',
};
