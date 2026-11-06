# 공유 카드 폰트 (P2-19)

`next/og`(satori + resvg) 공유 카드 전용입니다. satori는 WOFF2를 읽지 못해 압축 없는 TTF/OTF이고, 서버 함수(`src/lib/share-card/fonts.ts`)가 고정 경로로 읽어 함수에 번들됩니다. 브라우저에는 보내지 않습니다. 구성·다시 만드는 법: [docs/design/share-card.md](../../../docs/design/share-card.md), [docs/design/fonts.md](../../../docs/design/fonts.md)

| 파일 | 글꼴 이름 · 굵기 | 글자 | 쓰임 | 원본 |
|---|---|---|---|---|
| `jua/Jua-KS2350.ttf` (1298KB) | `Jua` 400 | KS X 1001 완성형 2,350자 + 호환 자모 + ASCII + 카드 기호 | 제목·닉네임·큰 숫자 | Jua 1.001 (https://raw.githubusercontent.com/google/fonts/cbe7e8d481ca94724c15fd4ed93694f2ccf500a7/ofl/jua/Jua-Regular.ttf) |
| `pyroad-sans/pyRoadSans-SemiBold-KS2350.otf` (355KB) | `pyRoad Sans` 600 | KS X 1001 완성형 2,350자 + 호환 자모 + ASCII + 카드 기호 | 본문·설명 | npm `pretendard` 1.3.9 `dist/public/static/Pretendard-SemiBold.otf` |
| `pyroad-sans/pyRoadSans-Bold-Full.otf` (1248KB) | `pyRoad Sans` 700 | 현대 한글 11,172자 + 호환 자모 + ASCII + 카드 기호 | 눈썹 글자·수치 + 대체 폰트(11,172자: 다른 폰트에 없는 글자를 글자 단위로 받침) | npm `pretendard` 1.3.9 `dist/public/static/Pretendard-Bold.otf` |

합계 2901KB.

## 바꾼 것 (OFL "수정본")

- 서브셋(위 글자 범위), 힌팅 제거, 레이아웃 기능과 저작권·라이선스 name 레코드(0·13·14)는 그대로. CFF(OTF)는 서브루틴을 풀지 않음.
- name 테이블 버전(nameID 5) 끝에 `; pyRoad subset`.
- Pretendard는 OFL 예약 이름 때문에 글꼴 이름이 들어가는 name 레코드를 `pyRoad Sans`로 바꿈. Jua는 예약 이름이 없어 그대로.
- 라이선스 전문은 폴더마다 `OFL.txt`(원본 배포본 그대로).

파일은 모두 `npm run fonts:build -- --share-card`가 만든 생성물입니다. 직접 고치지 마세요.
