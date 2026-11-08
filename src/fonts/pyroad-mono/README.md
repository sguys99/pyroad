# pyRoad Mono

pyRoad 앱이 자체 호스팅하는 웹폰트입니다 (P2-10). 구성·다시 만드는 법: [docs/design/fonts.md](../../../docs/design/fonts.md)

| 항목 | 값 |
|---|---|
| 원본 | D2Coding 1.3.2 (Build 20180524), 리거처 없는 기본판 Regular |
| 받은 곳 | https://github.com/naver/d2-coding-font/releases/download/VER1.3.2/D2Coding-Ver1.3.2-20180524.zip |
| 원본 sha256 | `0f1c9192eac7d56329dddc620f9f1666b707e9c8ed38fe1f988d0ae3e30b24e6` |
| 라이선스 | SIL OFL 1.1 (예약 이름 "D2Coding", "D2Coding-Bold") — 전문은 같은 폴더의 [OFL.txt](OFL.txt) |
| 글꼴 이름 | `pyRoad Mono` (원래 이름 "D2Coding"에서 바꿈) |

## 바꾼 것 (OFL "수정본")

- 원본: 릴리스 zip의 `D2Coding/D2Coding-Ver1.3.2-20180524.ttf` (리거처 없는 기본판 Regular). OFL.txt는 zip에 없어 저장소(`naver/d2-coding-font` `48d2941`)의 OFL.txt를 그대로 씀.
- 서브셋: 한자·가나를 뺀 unicode-range 조각(기준 묶음은 npm `pretendard` 가변 동적 서브셋 CSS, 그 밖의 글자는 코드포인트 순 160자씩).
- 힌팅 제거, 레이아웃 기능(kern 등)과 저작권·라이선스 name 레코드(0·13·14)는 그대로 둠.
- name 테이블 버전(nameID 5) 끝에 `; pyRoad subset`을 붙임.
- OFL 예약 이름 때문에 글꼴 이름이 들어가는 name 레코드(1·3·4·6·16·17·21·25·256 이상)를 `pyRoad Mono`로 바꿈. 저작권·상표·제작사·디자이너·URL·라이선스 레코드는 원문 그대로.

## 파일

- `pyroad-mono.css` + `slices/`: unicode-range 조각. 화면에 나온 글자가 든 조각만 받음
- `OFL.txt`: 라이선스 전문 (원본 배포본 그대로)

파일은 모두 `npm run fonts:build`가 만든 생성물입니다. 직접 고치지 마세요.
