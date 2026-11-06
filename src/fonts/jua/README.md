# Jua

pyRoad 앱이 자체 호스팅하는 웹폰트입니다 (P2-10). 구성·다시 만드는 법: [docs/design/fonts.md](../../../docs/design/fonts.md)

| 항목 | 값 |
|---|---|
| 원본 | 1.001 (google/fonts ofl/jua) |
| 받은 곳 | https://raw.githubusercontent.com/google/fonts/cbe7e8d481ca94724c15fd4ed93694f2ccf500a7/ofl/jua/Jua-Regular.ttf |
| 원본 sha256 | `769677aef240bfc3b9965f2b50748075bff885e6c6992fc591a3fb268279f898` |
| 라이선스 | SIL OFL 1.1 (예약 이름 없음) — 전문은 같은 폴더의 [OFL.txt](OFL.txt) |
| 글꼴 이름 | `Jua` |

## 바꾼 것 (OFL "수정본")

- 서브셋: 랜딩 텍스트 서브셋 1개 + unicode-range 조각(기준 묶음은 npm `pretendard` 1.3.9 가변 동적 서브셋 CSS, 실제 글리프가 있는 글자만 적음).
- 힌팅 제거, 레이아웃 기능(kern 등)과 저작권·라이선스 name 레코드(0·13·14)는 그대로 둠.
- name 테이블 버전(nameID 5) 끝에 `; pyRoad subset`을 붙임.
- 예약 이름(Reserved Font Name)이 없어 글꼴 이름은 그대로 둠.

## 파일

- `Jua-landing.woff2`: 랜딩 텍스트 서브셋 (랜딩 문구에 쓰인 글자 + ASCII). `src/fonts/landing.ts`가 `next/font/local`로 preload
- `jua.css` + `slices/`: unicode-range 조각. 화면에 나온 글자가 든 조각만 받음
- `OFL.txt`: 라이선스 전문 (원본 배포본 그대로)

파일은 모두 `npm run fonts:build`가 만든 생성물입니다. 직접 고치지 마세요.
