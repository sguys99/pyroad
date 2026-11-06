# pyRoad Sans

pyRoad 앱이 자체 호스팅하는 웹폰트입니다 (P2-10). 구성·다시 만드는 법: [docs/design/fonts.md](../../../docs/design/fonts.md)

| 항목 | 값 |
|---|---|
| 원본 | Pretendard Variable 1.3.9 (내부 버전 1.309) |
| 받은 곳 | https://registry.npmjs.org/pretendard/-/pretendard-1.3.9.tgz |
| 원본 sha256 | `0ffc240cee83be02520fb4ac1b2a0a51052b9d13506ade0ba90c591dbbb3bd53` |
| 라이선스 | SIL OFL 1.1 (예약 이름 "Pretendard") — 전문은 같은 폴더의 [OFL.txt](OFL.txt) |
| 글꼴 이름 | `pyRoad Sans` (원래 이름 "Pretendard Variable"·"Pretendard"에서 바꿈) |

## 바꾼 것 (OFL "수정본")

- 조각: npm `pretendard` 1.3.9의 공식 가변 동적 서브셋(`dist/web/variable/woff2-dynamic-subset/`) 92개를 글리프는 그대로 두고 이름만 바꿔 다시 저장.
- 랜딩 텍스트 서브셋: `dist/public/variable/PretendardVariable.ttf`에서 랜딩 글자만 남김 (가변 축 wght 45~920 유지).
- 힌팅 제거, 레이아웃 기능(kern 등)과 저작권·라이선스 name 레코드(0·13·14)는 그대로 둠.
- name 테이블 버전(nameID 5) 끝에 `; pyRoad subset`을 붙임.
- OFL 예약 이름 때문에 글꼴 이름이 들어가는 name 레코드(1·3·4·6·16·17·21·25·256 이상)를 `pyRoad Sans`로 바꿈. 저작권·상표·제작사·디자이너·URL·라이선스 레코드는 원문 그대로.

## 파일

- `pyRoadSans-landing.woff2`: 랜딩 텍스트 서브셋 (랜딩 문구에 쓰인 글자 + ASCII). `src/fonts/landing.ts`가 `next/font/local`로 preload
- `pyroad-sans.css` + `slices/`: unicode-range 조각. 화면에 나온 글자가 든 조각만 받음
- `OFL.txt`: 라이선스 전문 (원본 배포본 그대로)

파일은 모두 `npm run fonts:build`가 만든 생성물입니다. 직접 고치지 마세요.
