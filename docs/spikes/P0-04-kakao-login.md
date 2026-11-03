# P0-04 Kakao 로그인 (Supabase 내장 Kakao provider)

> - 작성일: 2026-11-03 · 브랜치 `feat/phase0`
> - 코드: [`spikes/p0-04-kakao/`](../../spikes/p0-04-kakao/)
> - 관련: [업그레이드 계획서](../4.upgrade-plan.md) §2.6, P0-04, P1-14, P3-01·02·05~10·16, B16, B24, §12 Q5·Q12
> - 소스 기준: `supabase/auth` master `004f767` (2026-11-03, 최신 릴리스 v2.197.0), `@supabase/auth-js` 2.101.0(저장소 설치본)

## 1. 결론: **대안** (내장 provider는 유지하되, scope를 덮어써서 사용)

- 계획서대로 "내장 Kakao provider + Allow users without an email"만 켜면 **비즈앱이 아닌 앱에서는 로그인이 안 됩니다.** GoTrue가 `account_email`을 scope에 **항상** 넣고([kakao.go:87-95](https://github.com/supabase/auth/blob/004f767f3297ba766cafbd0824c69b82edf31919/internal/api/provider/kakao.go#L87-L95)), 일반 앱은 이 동의항목을 설정할 수 없어서 Kakao가 동의 화면을 띄우기도 전에 **KOE205**(설정하지 않은 동의항목)로 막습니다. Supabase 문서("account_email을 빼고 Allow users without an email을 켜라")와 실제 동작이 다릅니다.
  - 이슈 [supabase/auth#2574](https://github.com/supabase/auth/issues/2574) (open), 수정 PR [#2579](https://github.com/supabase/auth/pull/2579) (open, 미머지). 같은 내용의 이전 PR [#2397](https://github.com/supabase/auth/pull/2397)은 하위 호환 문제로 닫혔고, 2026-10-23 Kakao Developers 담당자가 #2579에 "KOE205로 막힌다"고 확인하는 댓글을 남겼습니다.
  - `signInWithOAuth`의 `options.scopes`로는 뺄 수 없습니다. 기본 목록 뒤에 **덧붙기만** 합니다.
- **채택하는 우회 방법**: `queryParams: { scope: 'profile_nickname' }`로 scope 값을 통째로 바꿉니다. GoTrue는 `scope`를 예약 파라미터로 막지 않고([custom_oauth_admin.go:654-664](https://github.com/supabase/auth/blob/004f767f3297ba766cafbd0824c69b82edf31919/internal/api/custom_oauth_admin.go#L654-L664)) 나머지 쿼리를 그대로 Kakao 인가 URL 파라미터로 넘깁니다([external.go:84-91](https://github.com/supabase/auth/blob/004f767f3297ba766cafbd0824c69b82edf31919/internal/api/external.go#L84-L91)). 이때 `golang.org/x/oauth2`가 같은 이름의 값을 **교체**합니다. 로컬 GoTrue v2.197.0 + Kakao 목업에서 Kakao가 받은 scope가 바뀌고, 이메일 없이 가입·재로그인·수동 연결까지 모두 동작했습니다 (실측 S3~S11).

| 결정 항목 | 결론 |
|---|---|
| 비즈앱 전환 | **안 함** (Q12 유지). 나중에 필요하면 "개인 개발자 비즈앱"(사업자등록번호 없이 앱 오너 본인인증 + 카카오비즈니스 약관 동의)으로 전환할 수 있음 |
| "Allow users without an email" | **켬 (필수)**. 끄면 이메일 없는 Kakao 사용자는 `Error getting user email from external provider`로 가입 실패 (실측 S4) |
| 요청 scope | **`profile_nickname` 하나** (선택 동의). 프로필 사진·이메일은 요청하지 않음 (§2.6 "프로필 사진 비노출", 아동 최소 수집) |
| identity provider 이름 | **`kakao`** (내장). PR #2579가 배포되면 덮어쓰기 한 줄만 지우면 되고 기존 사용자에 영향 없음. 반대로 `custom:kakao`로 바꾸면 같은 사람이 **다른 계정**이 됨 (실측 S14b) → Phase 3에서 정하면 계속 유지 |
| 대체안 | Supabase custom OIDC provider `custom:kakao`. 공식 기능이지만 토큰 교환 방식에 실기기 확인 전 위험이 있어 2순위 (§4.9) |

- 이메일이 없으므로 **Google 계정과 자동 연결은 절대 일어나지 않습니다.** 같은 아이가 Google과 Kakao로 각각 들어오면 계정이 2개가 됩니다. "최근 로그인" 배지와 수동 연결(`linkIdentity`, 실측 S10)로 대응합니다.
- 계정을 삭제해도 Supabase는 Kakao에 연결 해제를 알리지 않습니다. 어드민 키로 `POST /v1/user/unlink`를 직접 불러야 합니다 (P3-16).

## 2. 검증한 질문

| # | 질문 | 답 |
|---|---|---|
| Q1 | GoTrue 내장 Kakao provider가 기본으로 요청하는 scope는? `account_email`이 항상 들어가나? | `account_email profile_image profile_nickname` 고정. 항상 들어감 (소스 확인 + 실측 S1) |
| Q2 | `signInWithOAuth({ options: { scopes } })`로 `account_email`을 뺄 수 있나? | 아니요. 기본 목록 뒤에 덧붙음 → 여전히 KOE205 (소스 확인 + 실측 S2). `queryParams.scope`로는 **교체**됨 (실측 S3) |
| Q3 | "Allow users without an email"은 어디에 있고 무엇을 하나? | 대시보드 Kakao provider 설정 토글 = `GOTRUE_EXTERNAL_KAKAO_EMAIL_OPTIONAL` = `config.toml [auth.external.kakao] email_optional`. 이메일 없는 사용자 생성을 허용할 뿐 **요청 scope는 바꾸지 않음** (문서·소스 확인 + 실측 S3/S4) |
| Q4 | 비즈앱이 아닌 앱이 쓸 수 있는 동의항목은? 설정 안 한 scope를 요청하면? | 닉네임·프로필 사진은 기본 제공, 이메일은 비즈앱·테스트 앱만. 설정 안 한 항목을 scope에 넣으면 KOE205 (문서 확인) |
| Q5 | Redirect URI, 클라이언트 시크릿, 로그아웃·연결 끊기 API는? Supabase가 unlink를 부르나? | §4.3. Supabase는 삭제·연결 해제 때 Kakao를 부르지 않음 (소스 확인) → 어드민 키로 직접 호출 |
| Q6 | 만 14세 미만 서비스에서 Kakao 쪽 정책은? | Kakao는 14세 미만 계정에 자체 법정대리인 동의 절차를 거치게 하지만, 이는 Kakao→서비스 정보 제공 동의일 뿐. 서비스 자체 보호자 동의(P3-15)는 별도로 필요 (문서 확인: devtalk 카카오 담당자 답변) |
| Q7 | Kakao·Google·Naver의 `raw_user_meta_data`에는 어떤 키가 들어가나? | §4.4 표. Kakao 내장 경로 키는 실측으로 소스 분석과 일치 확인 |
| Q8 | 카카오톡 인앱 브라우저에서 Kakao 로그인이 되나? 현재 코드는? | Kakao 문서는 인앱 브라우저 로그인을 정식 시나리오로 다룸 (문서 확인). 현재 코드는 provider와 상관없이 클릭 즉시 외부 브라우저로 보냄 (코드 확인). 실기기는 P3-19 |
| Q9 | 이메일 없는 Kakao와 기존 Google 사용자는 어떻게 연결되나? `last_login_provider`는 어디서 읽나? | 자동 연결 없음, 수동 연결은 동작 (실측 S9~S11). `app_metadata.provider`는 첫 identity라 못 씀 → `user_metadata.iss` (소스 확인 + 실측 S10) |
| Q10 | provider별 메타데이터 정규화와 `handle_new_user` 재작성을 실제 GoTrue 행으로 검증할 수 있나? | 예. 단위 28개, SQL 17개, GoTrue 흐름 18개, 사후 검증 10개 모두 통과 (실측) |

## 3. 방법 & 환경

| 항목 | 값 | 구분 |
|---|---|---|
| 1차 자료 | Supabase 문서(Context7 `/supabase/supabase`: auth-kakao, custom-oauth-providers, identity-linking, docker CONFIG.md), `supabase/auth` Go 소스(`004f767`), `supabase/cli` config 스키마·템플릿, developers.kakao.com(동의항목, REST API, 앱 설정, 문제 해결, FAQ), devtalk.kakao.com, GitHub 이슈·PR | 문서·소스 확인 |
| Kakao OIDC discovery | `https://kauth.kakao.com/.well-known/openid-configuration` 실제 조회 (2026-11-03): `token_endpoint_auth_methods_supported: ["client_secret_post"]`, `code_challenge_methods_supported: ["S256"]`, claims `nickname, picture, email` | 실측 |
| 머신 | WSL2 Linux 6.6, Docker 29.8.2, Node v22.23.2 (호스트) / v24 (컨테이너) | 실측 |
| DB | `public.ecr.aws/supabase/postgres:17.6.1.171`, 호스트 포트 127.0.0.1:55532 하나만 사용 | 실측 |
| Auth | `public.ecr.aws/supabase/gotrue:v2.197.0` 2대: A(`email_optional=true`, manual linking ON), B(`email_optional=false`) | 실측 |
| Kakao 목업 | `e2e/mock-kakao.mjs`(의존성 없음). docker 네트워크 별칭 `kapi.kakao.com`·`mock-kauth.p004.test` + 임시 CA로 TLS. 그래서 `iss`가 운영과 같은 `https://kapi.kakao.com`으로 저장됨 | 실측 |
| 네트워크 | `p004net` = 100.64.54.0/24 (CGNAT). GoTrue의 SSRF 가드가 RFC1918 사설 IP로 가는 custom OIDC discovery/JWKS를 막기 때문 (P0-03과 같은 방법, 다른 대역) | 실측 |
| 클라이언트 | 저장소 `node_modules/@supabase/auth-js` 2.101.0을 읽기 전용으로 마운트해 `signInWithOAuth`·`linkIdentity`·`exchangeCodeForSession`을 **실제 클라이언트 코드**로 호출 (PKCE) | 실측 |

구성 (`spikes/p0-04-kakao/`)

| 파일 | 역할 |
|---|---|
| `src/normalizeProviderMetadata.ts` | provider별 메타데이터 → `{ providerUserId, displayNameCandidate, avatarUrl, email, … }` |
| `src/loginProvider.ts` | `providerFromIssuer`, `resolveLoginProvider`(콜백 검증), `pickIdentityData`(연결 계정용), 배지 문구 |
| `fixtures/metadata.ts` | Google / Kakao(내장·OIDC, 이메일 없음·기본 이미지·동의 거부·정책 닉네임) / Naver(가정 샘플) |
| `tests/*.test.ts` | `node --test` 단위 테스트 28개 |
| `handle_new_user.draft.sql` | Phase 3 트리거 초안 (가입 + 로그인 트리거) |
| `sql/handle_new_user.test.sql` | 초안 SQL 검증 17개 (GoTrue 역할로 INSERT/UPDATE, ROLLBACK) |
| `e2e/mock-kakao.mjs` | Kakao 인가·토큰·사용자 정보·OIDC(discovery, JWKS, id_token) 목업, KOE101/006/010/205/320 흉내 |
| `e2e/gotrue-flow.mjs` | GoTrue 흐름 시나리오 S1~S15 |
| `sql/e2e_check.sql` | GoTrue가 실제로 만든 행에 대한 트리거 결과 검증 10개 |
| `e2e/run.sh` | 전체 실행·정리. `e2e/observed/`에 실측 JSON 저장 |

## 4. 결과

### 4.1 내장 provider의 scope (Q1·Q2)

소스 ([kakao.go:87-95](https://github.com/supabase/auth/blob/004f767f3297ba766cafbd0824c69b82edf31919/internal/api/provider/kakao.go#L87-L95)):

```go
oauthScopes := []string{
    "account_email",
    "profile_image",
    "profile_nickname",
}
if scopes != "" {
    oauthScopes = append(oauthScopes, strings.Split(scopes, ",")...)
}
```

실측 (GoTrue v2.197.0 → 목업이 받은 인가 요청):

| 시나리오 | 클라이언트 호출 | Kakao가 받은 `scope` | 결과 |
|---|---|---|---|
| S1 | `signInWithOAuth({ provider: 'kakao' })` | `account_email profile_image profile_nickname` | KOE205 `account_email` |
| S2 | `options.scopes: 'profile_nickname'` | `account_email profile_image profile_nickname profile_nickname` | KOE205 |
| S3 | `options.queryParams: { scope: 'profile_nickname profile_image' }` | `profile_nickname profile_image` | 가입 성공 (이메일 없음) |

- 덮어쓰기 원리 (소스 확인): GoTrue는 `scopes`, `provider`와 예약 파라미터(`client_id, client_secret, redirect_uri, response_type, state, code_challenge, code_challenge_method, code_verifier, nonce`)만 지우고, 나머지 쿼리는 `oauth2.SetAuthURLParam(key, value)`로 넘깁니다. `oauth2.Config.AuthCodeURL`은 `scope`를 먼저 넣은 뒤 옵션을 `url.Values.Set`으로 적용하므로 값이 교체됩니다.
- 부수 효과: 예약되지 않은 `redirect_to` 등도 Kakao 인가 URL에 같이 붙습니다(S1 파라미터 목록). 지금도 모든 provider에서 그렇고 Kakao는 모르는 파라미터를 무시합니다.
- 토큰 요청은 `AuthStyleInParams`(본문에 `client_id`·`client_secret`, Basic 헤더 없음)로 Kakao가 지원하는 유일한 방식과 같습니다 (실측 S3c).

### 4.2 "Allow users without an email" (Q3)

| 위치 | 이름 |
|---|---|
| 대시보드 | Authentication → Sign In / Providers → Kakao → **Allow users without an email** |
| GoTrue env | `GOTRUE_EXTERNAL_KAKAO_EMAIL_OPTIONAL` ([configuration.go:73](https://github.com/supabase/auth/blob/004f767f3297ba766cafbd0824c69b82edf31919/internal/conf/configuration.go#L73) `EmailOptional`) |
| 로컬 `supabase/config.toml` | `[auth.external.kakao] email_optional = true` (CLI 템플릿 설명: "allow the user to successfully authenticate when the provider does not return an email address") |

동작 (소스 확인 + 실측):
1. 콜백에서 이메일이 0개면 원래 `500 Error getting user email from external provider`로 끝나는데([external.go:184](https://github.com/supabase/auth/blob/004f767f3297ba766cafbd0824c69b82edf31919/internal/api/external.go#L184)), 이 옵션이 켜져 있으면 통과합니다. 꺼진 서버 B에서는 앱 콜백으로 `?error=server_error&error_code=unexpected_failure&error_description=Error+getting+user+email+from+external+provider`가 돌아오고 사용자는 만들어지지 않았습니다 (S4, 사후 검증).
2. 이메일이 없으면 확인 메일 발송과 `provider_email_needs_verification` 검사를 건너뜁니다([external.go:410](https://github.com/supabase/auth/blob/004f767f3297ba766cafbd0824c69b82edf31919/internal/api/external.go#L410)). 그래서 `auth.users.email`과 `email_confirmed_at`이 모두 NULL이지만 세션은 정상 발급됩니다 (실측).
3. **요청 scope는 바꾸지 않습니다.** 이것을 바꾸는 것이 PR #2579입니다 (`EmailOptional`이면 `account_email`을 기본 목록에서 뺌).

### 4.3 Kakao Developers 사실 (Q4·Q5·Q6, 문서 확인 2026-11-03)

| 항목 | 내용 |
|---|---|
| 동의항목 | 닉네임(`profile_nickname`)·프로필 사진(`profile_image`): "기본 제공". 이메일(`account_email`): **비즈앱·테스트 앱만**. 이름·연령대·출생 연도: "동의 단계 설정 권한"(추가 기능 신청, 비즈앱 전제) 필요 |
| scope 규칙 | scope를 보내면 그 항목만 동의 화면에 나옴. 앱에 설정하지 않은 항목이 있으면 **KOE205 `invalid_scope`**, Kakao 도메인의 에러 페이지에서 멈추고 우리 앱으로 돌아오지 않음 |
| 개인 개발자 비즈앱 | 사업자등록번호 없이 앱 오너 본인인증 + 카카오비즈니스 통합 서비스 약관 동의로 전환 가능. 비즈 채널 연결 불가. 전환하면 이메일을 필수 동의까지 설정 가능 |
| 테스트 앱 | 비즈앱만 생성 가능, 멤버만 로그인 가능, 운영에서는 원본 앱 키 사용 → 운영 대안 아님 |
| 키·Redirect URI | **[앱] > [플랫폼 키] > [REST API 키]**에서 리다이렉트 URI와 클라이언트 시크릿 설정(시크릿은 기본 활성화, 켜져 있으면 토큰 요청에 필수). Supabase의 Client ID = REST API 키. 값이 등록값과 완전히 같아야 함(KOE006) |
| 활성화 | [카카오 로그인] > [사용 설정] 상태 ON (OFF면 KOE004). OpenID Connect는 [카카오 로그인] > [OpenID Connect] (내장 경로에서는 불필요) |
| 오류 코드 | KOE006 미등록 redirect_uri, KOE101 잘못된 앱 키, KOE010 시크릿 누락·불일치, KOE205 미설정 동의항목, KOE320 인가 코드 재사용·만료 |
| 사용자 정보 | `/v2/user/me`의 `kakao_account.profile.{nickname, profile_image_url(640), thumbnail_image_url(110), is_default_image, is_default_nickname}`. 정책 위반 닉네임은 `닉네임을 등록해주세요`로 바뀜. 이메일은 사용자가 등록·동의했을 때만 |
| 로그아웃 | `POST /v1/user/logout`(토큰 폐기). "카카오계정과 함께 로그아웃"(`GET kauth/oauth/logout`)은 인앱 브라우저에서 선택 화면 없이 바로 리다이렉트 |
| 연결 끊기 | `POST https://kapi.kakao.com/v1/user/unlink`. 사용자 토큰(`Bearer`) 또는 **서비스 앱 어드민 키**(`Authorization: KakaoAK ${ADMIN_KEY}`, 본문 `target_id_type=user_id&target_id=<회원번호>`). 동의 철회 + 토큰 폐기. 어드민 키는 서버에서만, 호출 허용 IP 등록 권장 |
| 만 14세 미만 | Kakao 담당자 답변(devtalk, 2026-08-19): "카카오 로그인은 14세 미만 계정의 경우 법정대리인 동의 절차를 통해 이용 가능". "만 14세 이상 연령 동의" 옵션(간편가입, 비즈앱+추가 기능)은 동의 대신 **이용을 막는** 기능이고 Kakao가 14세 미만으로 아는 계정에만 동작. 법적 연령 제한이 필요하면 본인확인기관으로 검증해야 함. Kakao 절차는 Kakao→서비스 정보 제공 동의이므로 **서비스 이용 보호자 동의(P3-15)는 별도** |

### 4.4 provider별 `raw_user_meta_data` 키 (Q7)

GoTrue는 provider가 만든 `Claims` 구조체를 `structs.Map`으로 바꿔 identity의 `identity_data`와 사용자의 `raw_user_meta_data`에 넣습니다([provider.go:86-123](https://github.com/supabase/auth/blob/004f767f3297ba766cafbd0824c69b82edf31919/internal/api/provider/provider.go#L86-L123)). 빈 문자열은 빠지고, `email_verified`·`phone_verified`는 false여도 항상 들어갑니다.

| 키 | Google (OIDC id_token) | Kakao 내장 OAuth (`/v2/user/me`) | Kakao OIDC (`custom:kakao`, id_token) | Naver (P0-03, **가정 샘플**) |
|---|---|---|---|---|
| `iss` | `https://accounts.google.com` | `https://kapi.kakao.com` | `https://kauth.kakao.com` | `https://nid.naver.com` |
| `sub`, `provider_id` | Google sub | 회원번호 | 회원번호 (같은 값) | Naver id (앱별) |
| `name` | 실명 | 닉네임 | 닉네임 | custom OIDC: 없음 / 브릿지: (실명 `name`이 올 수 있음) |
| `full_name` | 실명 | 닉네임 | - | - |
| `preferred_username`, `user_name` | - | 닉네임 (둘 다) | `preferred_username`만 | - |
| `nickname` | - | **없음** | **없음** | 브릿지: 별명 |
| `avatar_url` | 사진 | 640px 사진 | - | - |
| `picture` | 사진 | **없음** | 110px 사진 | - |
| `profile_image` | - | - | - | 브릿지: 사진 |
| `email` | 있음 | 비즈앱·동의 시만 | 비즈앱·동의 시만 | 동의 시만 |
| `custom_claims` | `hd`(Workspace) | - | - | - |
| 출처 | [oidc.go:91](https://github.com/supabase/auth/blob/004f767f3297ba766cafbd0824c69b82edf31919/internal/api/provider/oidc.go#L91) | [kakao.go:63-75](https://github.com/supabase/auth/blob/004f767f3297ba766cafbd0824c69b82edf31919/internal/api/provider/kakao.go#L63-L75) + **실측 S3b** | [oidc.go:375](https://github.com/supabase/auth/blob/004f767f3297ba766cafbd0824c69b82edf31919/internal/api/provider/oidc.go#L375) + **실측 S14** | P0-03 fixtures |

실측한 Kakao 내장 경로 사용자 (S3, 닉네임·사진 동의, 이메일 없음):

```json
{
  "email": "",
  "app_metadata": { "provider": "kakao", "providers": ["kakao"] },
  "user_metadata": {
    "iss": "https://kapi.kakao.com", "sub": "4012345678", "provider_id": "4012345678",
    "name": "파이썬꿈나무", "full_name": "파이썬꿈나무", "preferred_username": "파이썬꿈나무", "user_name": "파이썬꿈나무",
    "avatar_url": "http://k.kakaocdn.net/dn/.../img_640x640.jpg",
    "email_verified": false, "phone_verified": false
  },
  "identities": [{ "provider": "kakao", "id": "4012345678", "email": null }]
}
```

- 닉네임·사진 선택 동의를 모두 거부하면 `iss, sub, provider_id, email_verified, phone_verified`만 남습니다 (실측 S6). 그래도 가입은 됩니다.
- GoTrue는 `is_default_image`·`is_default_nickname`을 넘기지 않습니다. 기본 이미지는 URL(`/account_images/default_profile.`)로, 정책 닉네임은 문자열로 판별해야 합니다.
- Kakao 이미지 URL은 `http://`로 올 수 있습니다(문서 예시와 목업 기준).
- **B16 정정**: 현재 트리거(`COALESCE(full_name, name)`, `COALESCE(avatar_url, picture)`)는 Kakao 닉네임을 "처리하지 못하는" 것이 아니라, GoTrue가 닉네임을 `full_name`·`name`에 넣어 주기 때문에 **그대로 공개 `display_name`에 복사**합니다. 진짜 문제는 실명일 수 있는 값과 사진을 공개 필드에 넣는 것입니다.
- **연결 계정 주의**: 로그인할 때마다 GoTrue가 그 identity의 데이터를 `raw_user_meta_data`에 **병합**합니다([user.go:232-245](https://github.com/supabase/auth/blob/004f767f3297ba766cafbd0824c69b82edf31919/internal/models/user.go#L232-L245)). Google 사용자가 Kakao를 연결해 Kakao로 로그인하면 `name, full_name, sub, iss`는 Kakao 값으로 바뀌고 Google의 `email, picture`는 남아 섞입니다 (실측 S10). provider별 값이 필요하면 `user_metadata` 대신 `identities[].identity_data`를 씁니다(`pickIdentityData`).

### 4.5 프로토타입: `normalizeProviderMetadata`

```ts
normalizeProviderMetadata(provider: 'google' | 'kakao' | 'naver' | 'custom:kakao' | 'custom:naver', raw)
→ {
  provider, providerUserId,          // sub → provider_id → (naver) response.id
  displayNameCandidate,              // 온보딩 닉네임 입력칸 "기본 제안값". 실명 가능성 있으면 null. DB 저장 금지
  displayNameSource,                 // 'kakao_nickname' | 'naver_nickname' | 'google_name' | null
  nameMayBeRealName, privateName,    // 본인 화면 인사말용. DB 저장 금지
  avatarUrl, avatarIsDefault,        // https만, 기본 이미지는 null
  email, emailVerified               // 없으면 null / false
}
```

규칙 (계획서 §2.6, P3-11: 공개는 닉네임 + 캐릭터 아바타뿐)
- **Google `name`은 실명**이므로 제안값으로 쓰지 않습니다 (`displayNameCandidate = null`, `privateName`에만).
- Kakao 닉네임은 `nickname → preferred_username → name → user_name → full_name` 순서. Naver는 `nickname`(또는 `response.nickname`)만 쓰고 실명 `name`은 절대 쓰지 않습니다.
- **한글 2~4글자 닉네임은 실명일 가능성이 높아 제안하지 않습니다**(`/^[가-힣]{2,4}$/`). "코딩왕" 같은 거짓 양성은 "제안 안 함"이 되므로 안전한 쪽입니다. Kakao 기본 닉네임 `닉네임을 등록해주세요`, Naver 마스킹 별명(`bob***`)도 없는 것으로 처리합니다.
- 줄바꿈·제로폭 문자 정리, NFC 정규화, 12자 자르기. 최종 검증(금칙어·중복)은 P3-11 온보딩에서 합니다.
- 이미지: Kakao 기본 이미지·Naver 기본 이미지 → null. `*.kakaocdn.net`, `*.pstatic.net`의 `http://`는 `https://`로 올리고, 그 밖의 비 https URL은 버립니다.
- 테스트: 28개 통과 (`npm test`). 이메일 없음, 기본 이미지, 닉네임 없음, 정책 닉네임, 숫자 회원번호, 연결 계정 메타데이터 섞임 등.

### 4.6 `handle_new_user` 재작성 초안 (`handle_new_user.draft.sql`)

- 가입 트리거(`AFTER INSERT ON auth.users`)
  - provider: `app_metadata.provider`(google / kakao / custom:kakao / custom:naver)를 3종으로, 모르는 값(브릿지의 `email` 등)이면 `user_metadata.iss`로 판별 (`pyroad_social_provider`)
  - `display_name` = `모험가0000` 자리표시자(user id 해시, P3-12와 같은 형식), `avatar_url` = `''`, `nickname` = NULL. **실명·provider 닉네임·사진을 공개 필드에 복사하지 않음**
  - `NEW.email`을 참조하지 않음 → 이메일 없는 계정 OK
  - `SET search_path = ''` + 모든 객체 스키마 명시 (B24), `ON CONFLICT (id) DO NOTHING`
- 로그인 트리거(`AFTER UPDATE OF last_sign_in_at ON auth.users`)
  - `last_login_at = NEW.last_sign_in_at` (B24)
  - `last_login_provider` = 이번 로그인 identity의 `iss` (모르는 값이면 유지). GoTrue가 로그인마다 `raw_user_meta_data`를 그 identity 값으로 덮어쓰고 세션 발급 때 `last_sign_in_at`을 갱신하는 동작을 이용
- 함수 4개 모두 `anon`·`authenticated` EXECUTE 회수 (PostgREST RPC 노출 차단). GoTrue(`supabase_auth_admin`)의 INSERT에서도 트리거가 정상 실행됨을 확인
- 검증 (실측)
  - SQL 단위 17개 통과: 6종 가입(Google 실명, Kakao 이메일 없음, custom:kakao, custom:naver, 알 수 없는 provider, 메타데이터 NULL), 연결 계정 Kakao 로그인 → `kakao`, 메타데이터만 바뀌면 무시, 알 수 없는 iss면 유지, search_path·권한
  - GoTrue가 실제로 만든 행 사후 검증 10개 통과: 이메일 없는 Kakao 3명 가입, 자리표시자·미복사, 재로그인 후 `last_login_at` 일치, 수동 연결 사용자의 `last_login_provider = kakao`(그때 `app_metadata.provider`는 `email`), custom:kakao 가입자도 `iss`로 `kakao`
  - 00001 + 00002 위에 두 번 적용해도 오류 없음

### 4.7 카카오톡 인앱 브라우저 (Q8)

- 현재 코드 (코드 확인): `useGoogleLogin.ts:15-25`는 `detectInAppBrowser()`가 인앱이면 **로그인 버튼을 누르는 즉시** `kakaotalk://web/openExternal?url=`로 외부 브라우저를 엽니다. provider 구분이 없어서 Kakao 버튼을 추가해도 카카오톡 안에서는 Kakao 로그인까지 막힙니다. `InAppBrowserGuide` 문구도 "Google 로그인이 지원되지 않아요"로 고정입니다.
- Google: 2021-09-30부터 임베디드 웹뷰의 OAuth를 `disallowed_useragent`로 차단합니다 ([Google 공지](https://goo.gle/3h0GhPw)). 외부 브라우저 전환은 Google 버튼에만 필요합니다.
- Kakao (문서 확인, 간접): Kakao 문서는 인앱 브라우저 로그인을 정식 시나리오로 다룹니다. "카카오톡에서 자동 로그인(`prompt=none`)은 카카오톡 인앱 브라우저에서 서비스 페이지 진입 시 가입 여부 분기를 지원", "`prompt=login`은 카카오톡 인앱 브라우저에서 제공되지 않음", "카카오계정과 함께 로그아웃은 인앱 브라우저에서 바로 리다이렉트". 인앱 브라우저에서는 카카오톡에 로그인된 계정으로 ID/비밀번호 없이 진행될 것으로 보이지만 **실기기 미확인** (P3-19).
- Supabase 흐름은 `pyroad → <ref>.supabase.co → kauth.kakao.com → <ref>.supabase.co → pyroad`를 같은 웹뷰 안에서 오갑니다. PKCE code verifier는 시작한 브라우저의 쿠키에 있으므로(`@supabase/ssr`), **외부 브라우저 전환은 반드시 `signInWithOAuth` 호출 전**에 해야 합니다. 흐름 중간에 브라우저가 바뀌면 `exchangeCodeForSession`이 실패합니다.
- 선택 아이디어: 카카오톡 인앱에서 첫 진입 때 `queryParams.prompt = 'none'`으로 조용히 로그인 시도 → `consent_required`면 버튼 표시. `prompt`는 예약 파라미터가 아니라 전달됩니다(소스 확인). 아이들이 헷갈릴 수 있어 v0.4 범위 밖으로 둡니다.
- Phase 9 공유(P9-09): 카카오톡 공유는 같은 앱의 **JavaScript 키**로 `Kakao.init()`합니다. 로그인(REST API 키 + 시크릿, Supabase가 사용)과 키가 달라 충돌하지 않습니다. [앱] > [플랫폼 키] > [JavaScript 키]의 JavaScript SDK 도메인과 [앱] > [제품 링크 관리] > [웹 도메인]을 따로 등록해야 합니다. 같은 앱을 쓰면 동의 화면과 공유 메시지의 앱 이름·아이콘이 같아집니다. Kakao JS SDK로 로그인(`Kakao.Auth.authorize`)은 하지 않습니다.

### 4.8 계정 연결과 최근 로그인 provider (Q9)

| 시나리오 | 결과 | 근거 |
|---|---|---|
| 이메일 없는 Kakao로 처음 로그인 | 항상 **새 사용자** (기존 사용자와 연결 안 됨) | [linking.go:103](https://github.com/supabase/auth/blob/004f767f3297ba766cafbd0824c69b82edf31919/internal/models/linking.go#L103) "verified email이 없으면 항상 CreateAccount" + 실측 (identity 1개씩) |
| (비교) 비즈앱 + 검증된 같은 이메일 | 기존 사용자에 자동 연결 | 실측 S9 |
| 로그인한 상태에서 `linkIdentity({ provider: 'kakao' })` | 이메일 없이도 기존 계정에 Kakao identity 추가, 이후 Kakao 로그인 = 같은 사용자 | 실측 S10. **Manual linking 설정 필요** (대시보드, `GOTRUE_SECURITY_MANUAL_LINKING_ENABLED`, `config.toml [auth] enable_manual_linking`) |
| 이미 다른 pyRoad 계정에 묶인 Kakao를 연결 | 실패, 앱 콜백에 `error_code=identity_already_exists` | 실측 S11, [identity.go:181-186](https://github.com/supabase/auth/blob/004f767f3297ba766cafbd0824c69b82edf31919/internal/api/identity.go#L181-L186) |
| 사용자가 Kakao 동의 화면에서 취소 | 앱 콜백에 `?error=access_denied&error_description=User+denied+access` | 실측 S8 (P3-10 안내 화면 분기에 사용) |

- **`app_metadata.provider`는 "가장 먼저 연결된 identity"입니다**([user.go:264-276](https://github.com/supabase/auth/blob/004f767f3297ba766cafbd0824c69b82edf31919/internal/models/user.go#L264-L276), identities `created_at ASC`). 수동 연결 후 Kakao로 로그인해도 `email`로 남았습니다(실측 S10). 최근 로그인 판별에 쓰면 안 됩니다.
- 대신 `user_metadata.iss`가 방금 로그인한 identity의 값입니다(실측 S10: `https://kapi.kakao.com`). 단, 사용자가 `updateUser({ data })`로 바꿀 수 있는 값이라 **UI 힌트로만** 씁니다.
- "최근에 ○○로 로그인했어요" 배지는 로그인 **전** 화면에 나오므로 브라우저 저장값이 기준입니다. `/auth/callback`에서 `providerFromIssuer(user.user_metadata.iss)`(또는 버튼이 붙인 `?lp=`를 `resolveLoginProvider`로 identities와 대조)로 판별해 저장합니다. DB의 `users.last_login_provider`는 4.6의 로그인 트리거가 채웁니다.
- 결론: 자동 연결이 없으니 **수동 연결을 v0.4에 넣는 것을 권장**합니다(P3-07). 계정 합치기(이미 둘 다 진행 기록이 있는 경우)는 범위 밖.

### 4.9 대체안 `custom:kakao` (Supabase custom OIDC provider) 실측

- 생성: `issuer: https://kauth.kakao.com`, `scopes: ["openid","profile_nickname"]`, `email_optional: true` → 201. 실제 Kakao discovery를 읽고 인가 URL은 `https://kauth.kakao.com/oauth/authorize?...scope=openid+profile_nickname&code_challenge=…&code_challenge_method=S256` (실측 S12). custom provider는 `options.scopes`가 저장된 scope를 **대체**합니다(S13, 내장과 반대).
- 콜백(목업 discovery, 같은 issuer): 이메일 없이 가입, 메타데이터는 `parseKakaoIDToken` 경로(§4.4 표), PKCE S256 검증 통과 (실측 S14).
- **위험**: 토큰 요청이 매번 2번 갑니다. 1차 HTTP Basic(본문에 `client_id` 없음) → Kakao 방식이면 KOE101 → 2차 `client_secret_post` 성공 (실측 S14 로그 `basic:KOE101 → post:ok`). 원인은 custom provider의 `oauth2.Endpoint`에 `AuthStyle`이 없고([custom_oauth.go:154-163](https://github.com/supabase/auth/blob/004f767f3297ba766cafbd0824c69b82edf31919/internal/api/provider/custom_oauth.go#L154-L163)), `x/oauth2`가 자동 감지 결과를 **Config마다** 캐시하는데([oauth2 internal/token.go:215-249](https://github.com/golang/oauth2/blob/v0.36.0/internal/token.go#L215-L249)) GoTrue가 요청마다 provider를 새로 만들기 때문입니다. **Kakao가 실패한 1차 요청에서 인가 코드를 소모하면 모든 로그인이 실패합니다**(S15 가정 시 `Unable to exchange external code`). 실제 Kakao 앱으로 확인하기 전에는 1순위로 쓰지 않습니다. 같은 구조라 P0-03의 `custom:naver`도 확인이 필요합니다.
- 그 밖에: 내장 `kakao`와 identity 이름이 달라 **같은 사람이 다른 계정**이 됩니다(S14b). Free 플랜은 custom provider 3개까지(Naver와 합쳐 2개). GoTrue의 OIDC provider 캐시는 issuer만 키로 써서([oidc_cache.go:110-139](https://github.com/supabase/auth/blob/004f767f3297ba766cafbd0824c69b82edf31919/internal/api/provider/oidc_cache.go#L110-L139)) 같은 issuer를 두 provider가 쓰면 먼저 읽은 discovery가 쓰입니다(테스트에서 실제로 겪음).
- `signInWithIdToken({ provider: 'kakao' })`(Kakao JS SDK + 서버 코드 교환)도 가능하지만, 2026-08 Supabase 호스팅에서 Kakao issuer의 id_token이 약 30시간 차단된 사고가 있었고([#2719](https://github.com/supabase/auth/issues/2719)), 서버에 Kakao 시크릿·코드 교환 라우트가 따로 필요해 채택하지 않습니다.

### 4.10 계정 삭제와 Kakao 연결 해제 (P3-16)

- Supabase `auth.admin.deleteUser`([admin.go:595](https://github.com/supabase/auth/blob/004f767f3297ba766cafbd0824c69b82edf31919/internal/api/admin.go#L595))와 `unlinkIdentity`([identity.go:18](https://github.com/supabase/auth/blob/004f767f3297ba766cafbd0824c69b82edf31919/internal/api/identity.go#L18))는 DB 행만 지우고 provider에는 아무것도 보내지 않습니다 (소스 확인). Kakao 쪽에는 pyRoad 연결과 동의가 남습니다.
- 현재 `/api/account/delete`는 `adminClient.auth.admin.deleteUser`만 부릅니다.
- 권장: Auth 사용자 삭제 **전에** Kakao identity마다 어드민 키로 연결 끊기를 호출합니다. `target_id`는 `auth.identities.provider_id`(= 회원번호)입니다. 실패해도 우리 데이터 삭제는 계속하고 실패를 기록합니다.

```ts
// /api/account/delete (Phase 3, 서버 전용)
for (const id of user.identities ?? []) {
  if (id.provider !== 'kakao') continue;
  const res = await fetch('https://kapi.kakao.com/v1/user/unlink', {
    method: 'POST',
    headers: {
      Authorization: `KakaoAK ${process.env.KAKAO_ADMIN_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
    },
    body: new URLSearchParams({ target_id_type: 'user_id', target_id: id.id }),
  });
  if (!res.ok) console.error('kakao unlink failed', res.status); // 삭제는 계속 진행
}
```

## 5. 선택지 비교

| 선택지 | 비즈앱 | 동작 | 장점 | 단점·위험 | 판정 |
|---|---|---|---|---|---|
| **A. 내장 `kakao` + `queryParams.scope` 덮어쓰기 + email optional** | 불필요 | 실측 통과 (S3~S11) | 대시보드 설정만, 토큰 교환이 Kakao 방식과 일치, identity `kakao`라 PR #2579 배포 후 그대로 이어짐 | 문서에 없는 동작(쿼리가 scope를 교체)에 기댐. Supabase가 `scope`를 예약 파라미터에 넣으면 다시 KOE205 → 호출을 헬퍼 1곳에 모으고 실 Kakao 스모크 테스트 | **채택** |
| B. custom OIDC `custom:kakao` | 불필요 | 콜백까지 목업 실측 (S12~S14) | 공식 기능, scope 자유, 문서화됨 | 토큰 요청 Basic→post 재시도, Kakao가 코드를 소모하면 전부 실패(미확인). identity 이름이 달라 A와 섞을 수 없음 | 대체안 (실 Kakao 확인 후) |
| C. 개인 개발자 비즈앱 전환 + 내장 provider | 필요 (본인인증·약관) | 문서 확인 | 우회 없이 문서대로 동작, 이메일(선택 동의) 가능 | Q12 결정과 다름. 아동 보호자 이메일 수집 → 최소 수집 원칙과 충돌, 개인정보처리방침 항목 증가. 선택 동의 거부 대비로 email optional은 여전히 필요 | 보류 (사용자 재결정 시) |
| D. `signInWithIdToken` (JS SDK + 서버 코드 교환) | 불필요 | 소스 확인 | scope 자유, identity `kakao` | 서버 라우트·시크릿 추가, 2026-08 호스팅 차단 사고(#2719) | 미채택 |
| E. 서버 브릿지 (직접 OAuth → admin API) | 불필요 | 미검증 | 완전 제어 | 세션 발급·보안을 직접 구현 (P0-03 대체안과 같은 부담) | 미채택 |
| F. PR #2579 배포 대기 | 불필요 | - | 우회 불필요 | 일정 불확실(2026-06 생성, 미리뷰) | A를 쓰다가 배포되면 덮어쓰기 제거 |

## 6. 이후 Phase 영향 (계획서 교체 문안)

**P0-04** (체크 + 결론)
> - [x] **P0-04** 스파이크: **Kakao 로그인**. 결론 **대안**: 내장 provider는 `account_email`을 항상 요청해 일반 앱에서 KOE205(supabase/auth#2574, 수정 PR #2579 미머지). 비즈앱 전환 없이 `queryParams: { scope: 'profile_nickname' }`로 scope를 덮어쓰고 "Allow users without an email"을 켜서 사용. 대체안은 `custom:kakao`(OIDC) → [보고서](spikes/P0-04-kakao-login.md)

**P3-01**
> - [ ] **P3-01** Kakao Developers 앱 등록 (일반 앱, 비즈앱 전환 안 함). REST API 키에 Redirect URI `https://<project-ref>.supabase.co/auth/v1/callback` 등록, 클라이언트 시크릿 ON, 카카오 로그인 ON, 동의항목은 **닉네임(선택 동의)만**. 프로필 사진·이메일은 설정하지 않음. 어드민 키는 서버 env `KAKAO_ADMIN_KEY`로만 보관(P3-16). 체크리스트: [P0-04 보고서 §6](spikes/P0-04-kakao-login.md#6-이후-phase-영향-계획서-교체-문안)

**P3-02**
> - [ ] **P3-02** Supabase Kakao provider 활성화: Client ID = REST API 키, Client Secret, **"Allow users without an email" ON**(끄면 이메일 없는 사용자 가입 실패). 로그인·연결 호출은 헬퍼 한 곳에서 `queryParams: { scope: 'profile_nickname' }`를 붙여서만 하고, `options.scopes`는 쓰지 않음(덧붙기만 함). PR #2579 배포 후 덮어쓰기 제거 (identity `kakao` 그대로라 영향 없음)

**P3-06**
> - [ ] **P3-06** `handle_new_user` 재작성 ([초안](../spikes/p0-04-kakao/handle_new_user.draft.sql)): provider를 `app_metadata.provider`(google/kakao/custom:*)와 `iss`로 3종 정규화, 이메일 미참조(없는 계정 OK), `display_name`은 "모험가0000" 자리표시자·`avatar_url`은 빈 값(실명·provider 닉네임·사진을 공개 필드에 복사하지 않음), `SET search_path = ''`(B24), `last_login_provider`·`last_login_at`은 가입 트리거 + `last_sign_in_at` UPDATE 트리거로 갱신. 온보딩 닉네임 기본 제안값은 클라이언트가 identity_data를 정규화해 만들고(`normalizeProviderMetadata`, 실명 가능성이 있으면 제안하지 않음) DB에 저장하지 않음

**P3-07**
> - [ ] **P3-07** 계정 연결 정책: Kakao는 이메일이 없어 **자동 연결이 일어나지 않음**(Google·Kakao로 각각 들어오면 계정 2개). ① "최근 로그인" 배지(P3-08)로 같은 provider 유도 ② 설정 화면에 "카카오/Google 계정 연결"(`linkIdentity`, Supabase "Manual linking" ON, Kakao는 같은 scope 덮어쓰기) ③ 이미 다른 계정에 묶인 경우 `identity_already_exists` 안내 (계정 합치기는 v1.0 이후) ④ 연결 해제는 identity 2개 이상일 때만, Kakao 해제 시 unlink API 호출(P3-16)

**P3-08**
> - [ ] **P3-08** "최근에 ○○로 로그인했어요" 배지: 로그인 전 화면이므로 브라우저 저장값(localStorage 또는 1년 쿠키)이 기준. `/auth/callback`에서 세션 사용자의 `user_metadata.iss`로 provider를 판별해 저장 (`app_metadata.provider`는 첫 identity라 쓰지 않음). DB `users.last_login_provider`는 로그인 트리거가 갱신(P3-06)

**P3-09**
> - [ ] **P3-09** 인앱 브라우저 처리 갱신: 카카오톡 인앱에서는 외부 브라우저로 보내지 않고 카카오 버튼을 맨 위에 크게 노출해 인앱 안에서 로그인. **Google 버튼을 누를 때만** 외부 브라우저로 전환(Google은 웹뷰 OAuth 차단, `disallowed_useragent`). 전환은 `signInWithOAuth` 호출 전에 (PKCE verifier 쿠키가 시작한 브라우저에 있음). 안내 문구를 provider별로. 다른 앱 인앱(네이버 등)의 Kakao·Naver 동작은 P3-19에서 확인

**P3-16**
> - [ ] **P3-16** 계정 삭제 시 provider 연결 해제: Supabase `admin.deleteUser`·`unlinkIdentity`는 Kakao에 알리지 않음. `/api/account/delete`에서 Kakao identity(`provider_id` = 회원번호)마다 `POST https://kapi.kakao.com/v1/user/unlink`(`Authorization: KakaoAK ${KAKAO_ADMIN_KEY}`, `target_id_type=user_id&target_id=<회원번호>`)를 Auth 삭제 전에 호출, 실패는 기록하고 삭제는 계속. 수동 연결 해제 때도 동일. Google·Naver 해제는 별도 확인

**B16**
> - [ ] **B16** 소셜 로그인을 추가하면 깨지는 부분 (P0-04에서 정정)
>   - provider `'google'` 하드코딩(`useGoogleLogin.ts:28`), 인앱 브라우저면 provider와 상관없이 클릭 즉시 외부 브라우저로 보냄 → 카카오톡 안에서 Kakao 로그인까지 막힘. `InAppBrowserGuide` 문구도 Google 고정
>   - `next.config.ts` 이미지 허용 도메인이 Google뿐 → provider 프로필 사진을 쓰지 않기로 해서(§2.6, P3-06) Kakao·Naver 도메인 추가는 불필요. 기존 Google 사진은 P3-13에서 캐릭터 아바타로 교체
>   - `handle_new_user`가 Kakao 닉네임을 `full_name`/`name`으로 받아(GoTrue가 닉네임을 넣어 줌) **공개 `display_name`에 그대로 복사**. 실명일 수 있는 값과 사진을 공개 필드에 넣는 것이 문제
>   - 처리: P1-14, P3-06, P3-09

추가로 고칠 곳 (교체 문안 대상은 아니지만 함께 반영 권장)
- **P3-05**: Kakao 버튼은 [카카오 로그인 디자인 가이드](https://developers.kakao.com/docs/ko/kakaologin/design-guide)를 따르고, 호출은 P3-02의 헬퍼만 사용
- **P3-10**: 앱 콜백 `error` 값으로 분기 (`access_denied` = 취소, `identity_already_exists` = 연결 충돌, `server_error` + "Error getting user email" = 설정 오류). KOE 계열 오류는 Kakao 도메인에서 멈춰 앱으로 돌아오지 않으므로 화면이 아니라 **설정·스모크 테스트로 예방**
- **P3-17/P3-18**: `spikes/p0-04-kakao`의 목업·정규화 테스트를 `src/lib/auth/__tests__/`로 옮김
- **P3-15**: 14세 미만 Kakao 계정은 첫 로그인 때 Kakao 자체 보호자 동의 화면을 볼 수 있음 → 보호자 안내 문구에 반영. 서비스 보호자 동의는 그대로 필요
- **§12 Q12 답변 보충**: "이메일 없이 가입 가능하도록 설계(P0-04: 내장 provider + scope 덮어쓰기 + email optional). 필요하면 개인 개발자 비즈앱으로 전환 가능(사업자등록번호 불필요)"

### Kakao Developers 설정 체크리스트 (P3-01)

1. [ ] developers.kakao.com → 앱 만들기 (앱 이름 "pyRoad", 아이콘 등록: 동의 화면에 표시). **비즈앱 전환은 하지 않음**
2. [ ] [앱] > [플랫폼 키] > [REST API 키]
   - [ ] 리다이렉트 URI: `https://<project-ref>.supabase.co/auth/v1/callback` (대시보드 Kakao provider 화면의 Callback URL을 그대로 복사, 한 글자도 다르면 KOE006). 로컬 CLI용 `http://localhost:54321/auth/v1/callback`은 필요할 때만
   - [ ] 클라이언트 시크릿: 활성화 상태 확인 → 코드 복사 → Supabase Client Secret
   - [ ] REST API 키 → Supabase Client ID (JavaScript 키·네이티브 앱 키 아님, 틀리면 KOE101)
3. [ ] [카카오 로그인] > [사용 설정] 상태 **ON** (OFF면 KOE004)
4. [ ] [카카오 로그인] > [동의항목] > [개인정보]
   - [ ] 닉네임(`profile_nickname`): **선택 동의**, 동의 목적 예: "첫 화면에서 별명 추천(다른 사람에게 공개하지 않음)"
   - [ ] 프로필 사진: 설정하지 않음 / 카카오계정(이메일): "권한 없음" 그대로
   - [ ] [동의 화면 미리보기]로 닉네임만 나오는지 확인
5. [ ] [카카오 로그인] > [OpenID Connect]: OFF 유지 (대체안 B를 쓸 때만 ON)
6. [ ] [앱] > [어드민 키]: Vercel 서버 env `KAKAO_ADMIN_KEY`에만 저장 (클라이언트·저장소 금지). 호출 허용 IP는 Vercel 고정 IP가 없어 비워 둠 → §7 위험
7. [ ] [카카오 로그인] > [고급] 로그아웃 리다이렉트 URI: 등록하지 않음 ("카카오계정과 함께 로그아웃" 미사용)
8. [ ] (Phase 9) [앱] > [플랫폼 키] > [JavaScript 키] > JavaScript SDK 도메인 `https://pyroad.vercel.app` (+ `http://localhost:3000`), [앱] > [제품 링크 관리] > [웹 도메인]
9. [ ] 팀원(멤버)에 개발자 계정 추가 (콘솔 관리용)

### Supabase 설정 (P3-02)

- [ ] Authentication → Sign In / Providers → **Kakao**: Enable, Client ID, Client Secret, **Allow users without an email ON**
- [ ] Authentication → URL Configuration: Redirect URLs에 `https://pyroad.vercel.app/auth/callback`, `http://localhost:3000/auth/callback` (Preview 배포를 쓰면 해당 패턴)
- [ ] Manual linking ON (P3-07)
- [ ] 로컬 `supabase/config.toml` (Phase 3에서 CLI를 도입할 경우)

```toml
[auth]
enable_manual_linking = true

[auth.external.kakao]
enabled = true
client_id = "env(SUPABASE_AUTH_EXTERNAL_KAKAO_CLIENT_ID)"
secret = "env(SUPABASE_AUTH_EXTERNAL_KAKAO_SECRET)"
email_optional = true
```

클라이언트 호출 (P1-14 `useSocialLogin`의 Kakao 분기)

```ts
// GoTrue 내장 kakao 는 account_email 을 항상 요청 → 일반 앱 KOE205 (supabase/auth#2574).
// options.scopes 는 덧붙기만 하므로 쓰지 말고 queryParams.scope 로 통째로 바꾼다.
const KAKAO_QUERY = { scope: 'profile_nickname' } as const;

await supabase.auth.signInWithOAuth({
  provider: 'kakao',
  options: { redirectTo: `${location.origin}/auth/callback`, queryParams: KAKAO_QUERY },
});
await supabase.auth.linkIdentity({
  provider: 'kakao',
  options: { redirectTo: `${location.origin}/auth/callback?next=/settings`, queryParams: KAKAO_QUERY },
});
```

## 7. 남은 리스크 & 사용자 확인/작업 필요 사항

| # | 리스크 | 영향 | 대응 |
|---|---|---|---|
| R1 | **실제 Kakao 앱으로는 아직 한 번도 로그인하지 않음** (목업 + 문서 기준) | 동의 화면·인앱 동작·이미지 URL 형식이 다를 수 있음 | P3-01 직후 실 앱으로 스모크: 카카오톡 인앱(iOS·Android), Safari, Chrome. KOE205가 안 나오는지, 이메일 없이 가입되는지 |
| R2 | `queryParams.scope` 덮어쓰기는 문서화되지 않은 동작 | GoTrue가 `scope`를 예약 파라미터에 넣으면 다시 KOE205 (앱으로 돌아오지 않고 Kakao 화면에서 멈춤) | 호출을 헬퍼 한 곳에 모으고, 배포 전 실 Kakao 인가 URL의 `scope`를 확인하는 스모크 테스트. 막히면 B(`custom:kakao`)로 전환하되 기존 사용자 계정이 갈라지므로 전환 전에 마이그레이션 계획 필요 |
| R3 | PR #2579가 다른 형태로 머지될 수 있음 | 대부분 무해 (덮어쓰기가 우선) | 릴리스 노트 확인 후 덮어쓰기 제거 |
| R4 | 대체안 B의 토큰 요청 재시도 | Kakao가 1차 실패 요청에서 코드를 소모하면 B는 전혀 동작 안 함 | B로 갈 때만 실 앱으로 확인 (P0-03 `custom:naver`도 같은 구조라 공유) |
| R5 | 자동 연결이 없어 계정이 갈라짐 | 진행 기록이 다른 계정에 쌓임 → 아이·보호자 혼란 | 최근 로그인 배지 + 수동 연결 + 고객 문의 시 운영자 수동 합치기 절차(문서만) |
| R6 | 어드민 키를 IP 제한 없이 서버 env에 둠 | 키가 새면 임의 사용자 연결 끊기 가능 | 서버 전용, 로그 마스킹, 유출 시 재발급 절차 문서화 |
| R7 | 한글 2~4글자 = 실명 휴리스틱 | 닉네임 제안이 자주 비어 보임 | 제안값은 편의 기능일 뿐. 온보딩은 랜덤 추천 닉네임을 기본으로 |
| R8 | 14세 미만 Kakao 계정의 Kakao 측 보호자 동의 화면 | 아이가 첫 로그인에서 멈출 수 있음 | 랜딩·온보딩에 보호자 안내. P3-15 보호자 동의와 별개임을 개인정보처리방침에 명시 (P12-06 법률 검토) |

사용자 확인·작업 필요
1. **Q12 유지 확인**: 비즈앱 전환 없이 "닉네임만" 받는 안으로 진행 (이메일 미수집). 바꾸려면 C(개인 개발자 비즈앱)로 재결정
2. **프로필 사진 미사용 확인**: Kakao 프로필 사진을 요청·저장하지 않고 캐릭터 아바타만 씀 (§2.6을 그대로 적용)
3. **Phase 3 착수 시**: Kakao Developers 앱 생성(체크리스트), Supabase 대시보드에 키 입력, Vercel env `KAKAO_ADMIN_KEY` 추가 (사용자 계정 필요)
4. **수동 연결(Manual linking) ON** 결정: v0.4에 포함 권장
5. `docs/spikes/README.md` 표에 P0-04 행 추가 (이 스파이크는 보고서 파일만 작성)

## 8. 재현 방법

```bash
cd spikes/p0-04-kakao

# 1) 단위 테스트 (의존성 설치 없음, Node 22.18+ 타입 제거 기본 지원)
npm test                         # 28개

# 2) SQL + GoTrue 흐름 e2e (Docker 필요, 실측 57초)
#    - Postgres 127.0.0.1:55532, 나머지는 docker 네트워크 p004net(100.64.54.0/24) 내부
#    - 저장소 루트 node_modules 의 @supabase/auth-js 를 읽기 전용으로 사용 (npm install 불필요)
#    - S12 는 실제 https://kauth.kakao.com discovery 를 읽으므로 인터넷 필요
P004_WORK=/tmp/p004 sh e2e/run.sh
#    결과: SQL 단위 17 + 흐름 18(S1~S15) + 사후 검증 10, e2e/observed/{observed,db_rows}.json
#    P004_KEEP=1 이면 컨테이너 유지 (끝나면 docker rm -f p004pg p004auth p004auth-strict p004mock; docker network rm p004net)
```

시나리오 목록 (`e2e/gotrue-flow.mjs`)

| ID | 내용 |
|---|---|
| S1·S2 | 기본 호출, `options.scopes` → KOE205 |
| S3·S3b·S3c | `queryParams.scope` 덮어쓰기 가입, 메타데이터 키, 토큰 요청 방식 |
| S4 | email optional OFF 서버에서 가입 실패 |
| S5·S6·S7 | 기본 이미지·실명형 닉네임, 동의 전부 거부, 재로그인 |
| S8 | 동의 화면 취소 |
| S9 | (비교) 비즈앱 이메일 자동 연결 |
| S10·S11 | 수동 연결, 연결 충돌 |
| S12·S13 | `custom:kakao` 생성(실제 Kakao discovery), scope 대체 |
| S14·S14b·S15 | `custom:kakao` 콜백(목업), 계정 분리, 코드 소모 가정 |
