# e2e (Playwright)

브라우저로 실제 화면을 눌러 보는 테스트입니다 (P1-21). 설정은 [`playwright.config.ts`](../playwright.config.ts), CI는 [`docs/ci.md`](../docs/ci.md)의 `e2e-smoke`·`e2e` job.

## 실행

```bash
npx playwright install chromium   # 처음 한 번 (Chromium만 씀)
npm run db:start                  # 로그인 스펙에 필요한 로컬 Supabase (supabase/README.md)

npm run test:e2e                  # 전부: public + setup → chromium → teardown (빌드 포함 약 7분)
npx playwright test --project=public     # 비로그인만 (스택 없어도 됨, 약 2분)
npx playwright test --project=chromium   # 로그인만 (setup·teardown은 자동으로 같이 돎)
npx playwright show-report               # 마지막 실행 결과 (실패하면 trace 포함)
```

| 환경 변수 | 기본값 | 설명 |
|---|---|---|
| `PORT` | `3100` | 앱 서버 포트. 3000은 다른 프로젝트 dev 서버가 쓰는 일이 많아 피함 |
| `E2E_SERVER` | `prod` | `prod`: `npm run build` + `npm run start` (배포와 같은 CSP). `dev`: `npm run dev` (첫 요청마다 컴파일이라 느림) |
| `E2E_SKIP_BUILD=1` | - | 빌드를 건너뛰고 `npm run start`만. **직전 빌드가 e2e로 만든 것일 때만** (아래 "주의") |
| `E2E_REUSE_SERVER=1` | - | 이미 `PORT`에 떠 있는 서버를 씀. 그 서버도 e2e env로 떠 있어야 함 |
| `E2E_NO_STACK=1` | - | Supabase 스택을 찾지 않음 (CI `e2e-smoke`). 로그인 스펙은 실패함 |
| `E2E_SUPABASE_URL`·`E2E_SUPABASE_ANON_KEY`·`E2E_SUPABASE_SERVICE_ROLE_KEY` | `supabase status -o env` | 다른 로컬 스택을 쓸 때. `E2E_SUPABASE_WORKDIR`로 `supabase status`의 workdir만 바꿀 수도 있음 |
| `E2E_KEEP_USER=1` | - | 끝나도 테스트 사용자를 지우지 않음 (실패 화면을 손으로 다시 볼 때) |

## 구조

| 경로 | 내용 |
|---|---|
| `public/*.spec.ts` | 비로그인 (`public` 프로젝트): 랜딩 캐릭터·반응형·reduced-motion·404·보안 헤더·CSP 위반 없음·보호 경로 리다이렉트, 코드 에디터 한글 주석 정렬·글자 크기·오류 줄(`editor-alignment.spec.ts`, 테스트 전용 페이지 `/dev/editor` — 서버 env `PYROAD_TEST_PAGES=1`을 `support/env.ts`가 넣음, 운영 404), 컴포넌트 카탈로그 `/dev/design`과 연출 단계 대체 검사(`design-catalog.spec.ts`, P2-12: 단계마다 무한 반복 애니메이션 허용 목록·흐림·리그 DOM 쓰기·버튼 눌림·카운트업·시트·토스트) |
| `public/social-login.spec.ts` | 비로그인: 로그인 실패 안내(취소·설정 오류 → 진짜 `/auth/callback` → 랜딩 시트가 저절로 열림, GoTrue가 Site URL로 바로 보낸 `bad_oauth_state`), 인앱 브라우저(카카오톡 Android: 카카오 맨 위·크게·Google 안내 한 줄·네이버 `appscheme`, iOS 인스타그램: Google → 안내 + 카카오 버튼). 스택 없이 돎 (P3-17) |
| `social-login.spec.ts` | 로그인: 카카오·네이버·Google 세 갈래 로그인 시트 → (목업) provider → 온보딩 관문(새 사용자) / 월드맵(온보딩 끝낸 사용자), 최근 로그인 저장(`pyroad.lastLogin.v1`)과 로그아웃 뒤 "최근에 사용" 배지. 새 로컬 사용자 4명(로그인 4번) (P3-17) |
| `auth.setup.ts` / `auth.teardown.ts` | 이번 실행 전용 테스트 사용자를 service_role로 만들고 로그인 쿠키를 `e2e/.auth/`에 저장 / 끝나면 사용자 삭제 |
| `*.spec.ts` | 로그인 (`chromium` 프로젝트): 퀘스트 흐름·축하 시퀀서·잠긴 스테이지(B38)·실행기(멈추기·재준비)·힌트·LLM 폴백·황금키·캐릭터·움직임 설정(P2-15)·월드맵·퀘스트 연출 단계 대체(`motion-tiers.spec.ts`, P2-12) |
| `world-select.spec.ts` | 월드 선택(P5-01): 월드 BGM(P5-11, `<html data-bgm data-bgm-playing>`로 제스처 전 무음 → 지도·책장·다른 월드·그 퀘스트 곡 전환), 지도 머리 → 월드 바꾸기 → 책장 → 월드 지도, 잠김·준비 중 안내, 없는 월드 404 화면, 테스트 월드(`fixtures/content/worlds/test-meadow`)를 DB에 넣고 월드 1을 다 깨면 두 번째 월드 지도가 열림. `E2E_SHOTS=<폴더>`면 360·768·1280 × full·minimal 스크린샷도. 테스트 월드 지도 설정은 Playwright가 서버를 띄우기 전에 `content:build -- --fixtures`로 `build/e2e/`에 만들고 서버 env `PYROAD_E2E_WORLDS`로 읽힘 |
| `world-chest.spec.ts` | 스테이지 보물상자(P8-06): 별 합계 목표 미달이면 시트에 모으는 중·안에 든 것(코인 30), 채우면 노드에 작은 상자·이름에 안내 → 시트 "열기" → `/api/world/chest` 200 → 시트가 닫히고 지도 위 상자 축하 카드 → 잔액 +30·HUD, 다시 열면 "열었음". 리셋해도 원장이 남아 재시도면 열린 모습만 확인 |
| `world-missions.spec.ts` | 데일리 미션(P8-07): 월드맵 HUD 미션 칸 → 시트 "오늘의 미션"(첫 칸은 퀘스트 미션, 배정은 서버 `daily_missions_today`로 읽어 기대값) → 달성 전 받기 API 409 → 퀘스트를 끝내면 칸에 금색 점·"받기" → 200, 코인(난이도 금액 + 레벨 업 코인)·XP 15, HUD 잔액 → 다시 받으면 `already_claimed`(0). 360px에서 미션 칸이 보이고 곧 열려요는 빠짐, 시트 가로 넘침 0. 원장 키가 남아 같은 날 재시도면 "받았어요"만 확인 |
| `phase8-loop.spec.ts` | Phase 8 핵심 루프(P8-16): **새 학생**(`createSocialUser`, 공용 사용자는 다른 스펙이 원장 키를 먼저 씀)으로 출석 도장 +5 → 미션 3개 배정 → 힌트 없이 퀘스트 ⭐3·코인 25·XP → HUD 코인·노드 별·미션 진행 → 미션 받기 → 업적 "나중에" → 도감 받기 가능 → 360px 프로필 달력·스트릭 1 → 같은 날 다시 풀기는 복습(원장 그대로) → 어제 기록 시드로 스트릭 2. 단계마다 `coinMismatches()` 0행 |
| `world-continue.spec.ts` | 월드맵 이어하기 CTA(P5-10): 진행 0 → "모험 시작하기"(첫 퀘스트), 하다 만 퀘스트(진행 행) → 다음 차례보다 그 퀘스트, 360px에서 지도를 내리면 아래 떠 있는 버튼(잠긴 노드 쪽지가 뜨면 비켜 줌). `E2E_SHOTS=<폴더>`면 360·768·1280 × full·minimal 스크린샷 |
| `world-responsive.spec.ts` | Phase 5 화면 반응형 회귀(P5-14): 7개 폭에서 지도·책장·잠긴 월드·스테이지 시트 가로 넘침 0(시트 주 버튼 하나), 320px 세로 지도의 지금 위치 깃발이 모든 노드에서 이름표에 안 걸림, minimal·동작 줄이기에서 위치·크기 변화·패럴랙스 0, full 탭 숨김 시 앰비언트 멈춤, 퀘스트에서 돌아와 닫은 시트가 기록을 겹치지 않음 |
| `quiz-mobile.spec.ts` | 모바일 퀴즈(P7-15, 360px 탭만): 4종 첫 시도 ⭐3·30 XP·도장·새로고침 뒤 서버 XP, 오답 2번 → ⭐1·오답 응답에 정답 없음, 3번 → 정답 공개, 같은 날 연습, 퀴즈는 보너스(안 풀어도 다음 스테이지), `/daily` 3문제·콤보·요약, 퀴즈 페이지 HTML·RSC·JS에 정답 없음, 가로 스크롤 없음. 정답은 `support/admin.ts`의 `quizKey`(service_role로 `quest_answer_keys`) |
| `support/env.ts` | 로컬 스택 찾기, 앱 서버 env 만들기 |
| `support/admin.ts` | service_role 도우미 (진행 초기화, 앞 퀘스트 완료) |
| `support/test.ts` | 로그인 스펙의 `test`: 테스트마다 진행 초기화, 끝날 때 쓰기 요청 대기, CSP 위반 감시 |
| `support/motion.ts` | 연출 단계 대체 검사 공용: 돌고 있는 무한 반복 애니메이션 수집, minimal·동작 줄이기 허용 목록(근거 포함), 흐림 요소 수 (P2-12, [docs/design/catalog.md](../docs/design/catalog.md)) |
| `support/oauthMock.ts` · `support/socialUsers.ts` | 소셜 로그인 목업 (아래 절) · 목업 로그인에 쓰는 로컬 사용자 만들기·지우기. 순수 함수 단위 테스트는 `support/__tests__/`(vitest, Playwright는 무시) |
| `support/quest.ts` · `support/content.ts` | 퀘스트 화면 조작, `content/` YAML에서 퀘스트 id·정답·힌트 읽기 (하드코딩하지 않음) |

## 앱 서버 env

저장소의 `.env`·`.env.local`은 바꾸지 않습니다. Playwright가 서버를 띄울 때 env를 넣어 덮습니다 (`support/env.ts`).

- Supabase: 로컬 스택 주소·키만 (`127.0.0.1`/`localhost`가 아니면 중단 — 운영 DB에 붙지 않음)
- LLM 키(`ANTHROPIC_API_KEY` 등)·`API_KEY_ENCRYPTION_KEY`·Sentry DSN·`ANALYTICS_SALT`·`ADMIN_EMAIL`, 그리고 `.env*` 파일에 적힌 다른 키는 모두 빈 값 → 튜터는 외부 호출 없이 **저장된 답변**으로만 답함

## 주의

- **빌드 산출물(`.next/`)에 로컬 스택 주소가 들어갑니다** (`NEXT_PUBLIC_*`는 빌드 때 고정). e2e 뒤에 운영 env로 `npm run start`를 하려면 다시 빌드하세요. 반대로 `E2E_SKIP_BUILD=1`·`E2E_REUSE_SERVER=1`로 다른 env의 빌드·서버를 잡으면 setup이 CSP의 Supabase 주소를 보고 실패합니다.
- 같은 작업 트리에서 다른 `next build`/`next dev`와 동시에 돌리지 마세요 (`.next/`를 같이 씀).
- 로그인 스펙은 테스트 사용자 한 명을 테스트마다 초기화하며 쓰므로 `workers: 1`입니다. 재시도는 0 — 흔들리면 고칩니다.
- 로그인은 실행마다 한 번 (로컬 Auth 로그인 한도: 5분에 30회).

## 소셜 로그인 목업 (P3-17)

실제 Kakao·Naver·Google 없이 로그인 화면부터 월드맵까지를 브라우저로 시험합니다. CI에서도 그대로 돕니다(외부 호출 없음, 추가 컨테이너 없음).

**어떻게**: 로그인 버튼은 `signInWithOAuth`(P1-14 헬퍼)로 GoTrue `…/auth/v1/authorize?provider=…`로 이동합니다. Playwright가 이 이동을 가로채(`installOAuthMock`)
1. **요청을 검사**합니다 — 앱이 실제로 만든 값: provider 이름(`custom:naver`), PKCE `code_challenge`(S256), `redirect_to` = 같은 출처 `/auth/callback` 그대로(쿼리 없음, B43 — 계정 연결·탈퇴 재인증만 `?next=`), Kakao scope 덮어쓰기(빈 `scope=`, KOE205 방지), Android에서만 네이버 `appscheme=true`. 어긋나면 `mock.problems()`가 이유를 돌려줍니다
2. **provider 결과를 흉내 냅니다**: `success` = 미리 만든 로컬 사용자로 비밀번호 로그인한 세션 쿠키를 넣고 콜백 성공 때와 같은 주소(`next` + `#lp=<provider>`)로 302 · `cancel` = 진짜 `/auth/callback?…&error=access_denied` · `server_error` = 진짜 콜백에 "Error getting user email" · `bad_state` = Site URL `/`에 `error_code=bad_oauth_state`

**시험하지 않는 것과 대신 확인하는 곳**

| 빠진 부분 | 대신 |
|---|---|
| provider ↔ GoTrue 토큰 교환, identity 생성(이메일 없는 Kakao·Naver 가입) | 실 앱 스모크 K-·N-·L- ([docs/release/v0.4-phase3-providers.md](../docs/release/v0.4-phase3-providers.md) §9), 스파이크 실험실 `spikes/p0-04-kakao/e2e`(실제 GoTrue + Kakao 목업)·`spikes/p0-03-naver`(테스트 CA + Naver 목업) |
| `/auth/callback`의 code 교환 **성공** 경로(세션 사용자의 iss → `#lp=`) | 콜백 단위 테스트 `src/app/auth/callback/__tests__/route.test.ts`. e2e는 그 뒤(`#lp=` 저장·관문·배지)만 |
| `NEXT_PUBLIC_LOGIN_PROVIDERS`로 네이버 숨기기 | 빌드 때 고정되는 값이라 서버를 따로 빌드해야 함 → 단위 테스트(`parseLoginProviders`, `SocialLoginButtons.inapp.test.tsx`) |

**왜 이 방식인가 (검토한 대안)**
- *로컬 GoTrue의 Kakao provider를 목업 서버로 돌리기*(`[auth.external.kakao] url`, P0-04 실험실과 같은 방식): provider 왕복까지 진짜지만, 목업을 Supabase 도커 네트워크에 붙이고 `config.toml`의 Kakao를 켜야 해서(개발자가 실제 Kakao 앱으로 시험하는 로컬 설정과 충돌) 스택 재시작·CI 단계가 늘어납니다. Naver(커스텀 OIDC)는 GoTrue가 https + 공인 IP만 허용해 테스트 CA 실험실 없이는 안 됩니다
- *매직 링크 PKCE로 진짜 code 만들기*: CI 스택은 메일 서버(mailpit)를 끄고 띄우고, 로컬 메일 발송 한도(시간당 2통)에 걸립니다
- 그래서 세 provider에 같은 방식(앱 경계에서 가로채기)을 쓰고, 빠진 부분은 위 표의 테스트로 메웁니다

**돌리기**
```bash
npx playwright test --project=public e2e/public/social-login.spec.ts   # 스택 없이 (CI e2e-smoke와 같음)
npm run db:start && npx playwright test --project=chromium e2e/social-login.spec.ts   # 로그인 경로 (setup·teardown 자동)
```
새 로컬 사용자를 4명 만들고(로그인 4번, 로컬 한도 5분 30회 안) 끝나면 지웁니다. 로그인 경로는 온보딩 관문(P3-11, 마이그레이션 00023)이 적용된 DB가 필요합니다.

