# content/ — 퀘스트 콘텐츠 원본 (Content as Code)

퀘스트·스테이지·월드를 YAML로 쓰고, `npm run content:build`가 DB seed SQL과 검증용 JSON을 만듭니다. 배경과 결정은 `docs/4.upgrade-plan.md` §2.4, P1-11~13을 참고하세요.

- **한 파일에 공개 부분과 정답 부분을 함께 씁니다.** 빌드가 나눠서 공개 부분은 `quests`(학생 브라우저로 내려감), 정답 부분은 `quest_answer_keys`(service_role 전용)에 씁니다 (P0-08, P1-02).
- 스키마: `src/lib/content/schema.ts` (zod). 모르는 키는 모두 오류입니다.
- 지금(P1-11)은 스테이지 1만 이관했습니다. 나머지 43개 퀘스트 이관과 `supabase/seed.sql` 교체는 P1-12에서 합니다. 그때까지 DB의 원본은 `supabase/seed.sql`입니다.

## 1. 디렉토리 구조

```
content/
└── worlds/
    └── python-island/                 # 월드 slug (worlds.slug, P1-08)
        ├── world.yaml
        ├── 01-python-village/         # NN-<영문 슬러그>, NN = stage.yaml 의 order
        │   ├── stage.yaml
        │   ├── 01-first-greeting.yaml # NN-<영문 슬러그>.yaml, NN = 퀘스트 order
        │   └── …
        └── 07-project-kingdom/
            ├── stage.yaml
            └── 01-number-guessing-game.yaml
```

- 이름은 영문 소문자·숫자·하이픈만 씁니다. 앞 두 자리 번호는 YAML의 `order`와 같아야 합니다(빌드가 확인).
- 순서를 바꾸려면 `order`와 파일 이름 번호를 함께 바꿉니다. 빌드한 seed가 UNIQUE 충돌 없이 순서를 옮깁니다.
- 빌드가 확인하는 중복: 모든 `id`, 스테이지 `order`(지금은 전체에서 유일), 스테이지 안의 퀘스트 `order`.

## 2. 파일 형식

### world.yaml

| 필드 | 설명 |
|---|---|
| `slug` | 디렉토리 이름과 같음. 예: `python-island` |
| `order` | 월드 순서 |
| `title` | 화면 이름. 예: `파이썬 섬` |
| `theme` | 테마 키 (영문 소문자·밑줄) |
| `description` | 소개 문장 |

지금은 검증만 하고 SQL로는 내보내지 않습니다. P1-08에서 `worlds` 테이블이 생기면 빌드가 `slug` 기준으로 업서트하고 `stages.world_id`를 채웁니다.

### stage.yaml → `stages`

`id`(UUID, 바꾸지 않음), `order`, `title`, `theme_name`(월드맵 일러스트 키, 예: `python_village`), `description`, `is_final`

### 퀘스트 파일 → `quests` + `quest_answer_keys`

```yaml
# 퀘스트 1-1: 첫 번째 인사
id: b1000000-0000-0000-0000-000000000001   # quests.id. 한 번 정하면 바꾸지 않음 (user_progress 가 참조)
order: 1
title: 첫 번째 인사
concept: print()
xp_reward: 50
quest_type: code                            # code | project (퀴즈 quiz 는 P7-01)

# 공개: 학생 화면으로 그대로 내려갑니다 (quests.prompt_skeleton)
prompt:
  topic: print() 함수로 출력하기
  learning_goals:
    - print() 함수를 사용하여 텍스트를 출력할 수 있다
  story_context: 파이썬 마을에 도착한 모험가가 …
  exercise_description: print() 함수를 사용하여 "안녕하세요!"를 출력해보세요
  starter_code: |
    # 아래에 코드를 작성해보세요!
  expected_output_hint: 안녕하세요! 가 출력되어야 해요
  fallback_text: print()는 화면에 글자를 보여주는 마법 주문이에요! …
  # is_challenge: true                      # 스테이지의 챌린지 퀘스트 (선택)

# 정답: 서버만 읽습니다 (quest_answer_keys). validation.type 만 공개(quests.validation_type)
answer:
  validation:
    type: output_match
    expected: 안녕하세요!
  hints:
    level_1: 화면에 글자를 보여주는 마법 주문이 있어요. 어떤 주문일까요?
    level_2: print() 안에 따옴표로 감싼 글자를 넣으면 돼요!
    level_3: print("___") 여기서 ___에 인사말을 넣어보세요!
  solution_code: print("안녕하세요!")       # 황금키 정답. 자동 검증(P1-13)이 이 코드로 규칙 통과를 확인
```

| 위치 | 필드 | 필수 | 들어가는 곳 |
|---|---|---|---|
| 맨 위 | `id`, `order`, `title`, `concept`, `xp_reward`, `quest_type` | 모두 | `quests` 컬럼 |
| `prompt` | `topic`, `learning_goals`, `story_context`, `exercise_description`, `starter_code`, `expected_output_hint`, `fallback_text` | 모두 (`starter_code`만 빈 문자열 허용) | `quests.prompt_skeleton` (공개) |
| `prompt` | `is_challenge` | 선택 | `quests.prompt_skeleton` (공개) |
| `answer` | `validation` | 필수 | `type` → `quests.validation_type`(공개), 기준값 → `quest_answer_keys.expected_output` |
| `answer` | `hints.level_1~3` | 3개 모두 | `quest_answer_keys.hints` |
| `answer` | `solution_code` | 코드 퀘스트 필수, 프로젝트 전체에는 선택 | `quest_answer_keys.solution_code` |

여러 줄 문자열(코드, 여러 줄 출력)은 `|`(끝 줄바꿈 하나 유지) 또는 `|-`(끝 줄바꿈 없음)로 씁니다. `output_match`는 앞뒤 공백을 무시하므로 어느 쪽이든 됩니다. 시작 코드·정답 코드는 학생 에디터에 그대로 들어가므로 끝 줄바꿈을 원래대로 둡니다.

### 프로젝트 퀘스트 (`quest_type: project`)

`prompt`·`answer`(퀘스트 전체 규칙, 마지막 단계 정답이 이 규칙도 통과해야 함)에 더해 `steps`를 씁니다. 단계 번호는 1부터 차례대로입니다.

```yaml
steps:
  - step_number: 1
    prompt:                              # 공개 → prompt_skeleton.steps[]
      step_goal: random 모듈로 1~10 사이의 비밀 숫자를 만들고 출력해보기
      starter_code: |                    # 학생 화면에서는 "이전 단계 코드 + 이 시작 코드"
        import random
      fallback_text: …
    answer:                              # 정답 → quest_answer_keys.steps[]
      validation:
        type: code_check
        expected: random.randint
      hints: { level_1: …, level_2: …, level_3: … }
      solution_code: |-                  # 단계마다 필수
        import random
        secret = random.randint(1, 10)
        print(secret)
```

## 3. 검증 규칙 (`answer.validation`)

| `type` | 기준 | 통과 조건 |
|---|---|---|
| `output_match` | `expected: 문자열` | 출력 전체가 같음 (앞뒤 공백·줄바꿈 무시) |
| `contains` | `expected: 문자열` | 출력에 들어 있음 |
| `contains_any` | `expected: [문자열, …]` | 출력에 하나라도 들어 있음. **무작위 출력 퀘스트에 씀** |
| `code_check` | `expected: 문자열`, `whole_word: true`(선택) | 코드에 들어 있음. 주석·문자열 안의 글자는 보지 않음(B25). `whole_word`면 `int(`가 `randint(` 안에서는 안 걸림(B30) |
| `all` | `rules: [규칙, …]` | 모두 통과 |

```yaml
# 무작위 숫자를 쓰는 퀘스트: 어떤 숫자가 나와도 올바른 답이면 통과해야 함 (B09, §12-Q18)
validation:
  type: all
  rules:
    - type: code_check
      expected: elif
    - type: contains_any
      expected: [커요, 작아요, 정답]
```

- **무작위 출력에는 `random.seed` 고정 대신 넓은 규칙을 씁니다.** 시드를 고정하면 난수 뽑는 순서만 다른, 똑같이 맞는 답이 떨어집니다(§2.4).
- `output_match`·`contains`는 답을 그대로 `print`해도 통과합니다. 개념이 중요한 퀘스트는 `all`로 `code_check`와 묶습니다.
- `code_check`에 짧은 문자열을 쓰면 다른 코드에 섞여 걸립니다(`int(` ⊂ `randint(`). `whole_word: true`를 쓰거나 더 긴 문자열을 고릅니다.
- 3단계 힌트(`level_3`)대로 쓴 답도 규칙을 통과하는지 확인합니다(B09: 힌트 문구로는 절대 통과 못 하던 사례).

**DB 저장 형태** (`src/lib/quest/validation.ts`의 `toStoredRule`): 기존 두 칸(`validation_type` + `expected_output`)을 그대로 씁니다. `output_match`·`contains`·`code_check`는 기준 문자열 그대로, `contains_any`·`all`은 기준값 칸에 JSON을 넣고, `code_check` + `whole_word`는 하위 규칙 하나짜리 `all`로 저장합니다. 채점 API(`/api/quest/validate`)는 바꾸지 않아도 됩니다.

> ⚠️ `quests.validation_type`에는 아직 CHECK 제약(`output_match`·`contains`·`code_check`, 00001)이 있습니다. 새 유형(`contains_any`·`all`·`whole_word`)은 **프로젝트 단계**(`prompt_skeleton.steps[]`, jsonb)에는 지금 바로 쓸 수 있지만, **퀘스트 전체 규칙**에 쓰려면 CHECK를 넓히는 마이그레이션이 먼저 필요합니다(P1-08/P1-12). 빌드가 경고로 알려 줍니다.

## 4. 공개 부분에 쓰면 안 되는 것

- `prompt`(와 `steps[].prompt`)에는 정답 키 `hints`, `solution_code`, `expected_output`, `is_correct`, `accepted`를 둘 수 없습니다. 스키마가 막고, 빌드한 공개 행도 한 번 더 검사합니다(00005의 `quests_no_answer_fields` CHECK와 같은 목록).
- 코드 퀘스트의 `fallback_text`·`expected_output_hint`에 예시 코드나 목표 출력을 쓰는 것은 의도한 노출로 인정합니다(§12-Q20: 초반 퀘스트의 예시, `fallback_text`는 튜터가 실패할 때만 보임).
- **퀴즈(P7-01)는 다릅니다.** 공개 필드에 정답이나 정답이 드러나는 문장을 넣으면 빌드가 실패하게 합니다. 보기·토큰·줄 id는 정답 위치를 암시하지 않는 임의 문자열로 씁니다.

## 5. 새 퀘스트 추가

1. 스테이지 디렉토리에 `NN-<슬러그>.yaml`을 만듭니다(비슷한 퀘스트를 복사해 시작).
2. `id`는 새 UUID: `node -e "console.log(crypto.randomUUID())"`. 한 번 정하면 바꾸지 않습니다.
3. `npm run content:build`로 검사·생성합니다. 오류는 파일 경로와 필드 위치를 함께 보여 줍니다.
4. P1-13 이후: `npm run test:content`로 정답 코드가 규칙을 통과하고 시작 코드는 통과하지 않는지 확인합니다.
5. 퀘스트를 **지울 때**는 파일만 지우면 DB에서 사라지지 않습니다(빌드는 지우지 않음). 지우면 `user_progress`가 CASCADE로 함께 지워지므로 마이그레이션으로 따로 처리합니다.

## 6. 명령

```bash
npm run content:build              # 검사 + 생성: build/content/seed.sql, build/content/quests.json (git 제외)
npm run content:build -- --check   # 생성하지 않고, 이미 있는 출력과 다르면 종료 코드 1 (CI 드리프트 검사용)
npm run content:compare            # 왕복 비교 (아래)
npm run content:extract -- --stage 1   # supabase/seed.sql → content/ YAML 추출 (이관용, --all, --force)
npx vitest run src/lib/content src/lib/quest   # 스키마·빌드·검증기 단위 테스트 (+ PGlite 적용 테스트)
```

- 옵션: `content:build --seed-out <file> --json-out <file> --content <dir>`, `content:compare --expect-diff 7-1,4-7 --seed <file> --content <dir> --migrations-up-to 00005`
- 세 명령 모두 **PGlite**(npm 패키지, 메모리 Postgres)로 SQL을 실행합니다. 로컬 Supabase 스택·docker를 쓰지 않습니다.

### 생성물

| 파일 | 내용 | 커밋 |
|---|---|---|
| seed SQL | 스테이지·`quests`(공개) 업서트 + `quest_answer_keys`(정답) 업서트. DML만 있고 멱등. 머리에 콘텐츠 해시 | P1-12부터 `supabase/seed.sql`로 내보내고 **커밋** (`db reset`·RLS 테스트·운영 SQL Editor가 그대로 읽음, PR에서 SQL diff 리뷰, CI는 `--check`로 원본과 어긋남 검사) |
| 검증 JSON | 퀘스트마다 `id, key, validation_type, expected_output, starter_code, solution_code, steps[]` (P0-09 fixture 형태, P1-13이 읽음). `validation_type`·`expected_output`은 DB 저장 형태라 `validateResult`에 바로 넣음 | **커밋하지 않음** (원본에서 1초 안에 다시 만들고, 정답을 담은 파생물이라 diff 리뷰 가치가 없음. `test:content`가 먼저 빌드) |

지금(P1-11)은 스테이지 1만 있어서 seed를 `build/`에 씁니다(`supabase/seed.sql`은 아직 손으로 쓴 원본). P1-12에서 `scripts/content/lib/paths.ts`의 기본값을 바꿉니다.

### 왕복 비교 (`content:compare`)

메모리 DB 4개를 띄워 비교합니다.

| 비교 | 뜻 |
|---|---|
| A 원본 = B 생성 | `migrations → supabase/seed.sql`과 `migrations → 생성 seed`의 `stages`·`quests`·`quest_answer_keys` 행이 content 범위에서 같음 |
| B = C 재실행 | 생성 seed를 두 번 실행해도 같음 (멱등) |
| A = D 덮어쓰기 | 원본 데이터가 있는 DB에 생성 seed를 업서트해도 전체 행이 같음 |
| 검증 JSON | 원본 DB에서 만든 JSON = 빌드 결과 |

## 7. P1-12 이관 절차 (추출 → 빌드 → 비교)

```bash
npm run content:extract -- --all            # 1) 44 퀘스트 추출 (스테이지 1은 이미 있음: 같으면 그대로 둠)
npm run content:build                       # 2) 검사 + 생성 (경고 0, 스테이지 7 · 퀘스트 44 · solution_code 43 · 단계 5/5)
npm run content:compare                     # 3) 4개 비교 모두 PASS, "퀘스트 44/44"
# 4) 콘텐츠 버그 수정(B09·B30·B31) 후: 고친 퀘스트만 차이가 나는지 확인
npm run content:compare -- --expect-diff 7-1,4-7
# 5) seed 교체: 생성물을 supabase/seed.sql 로 (paths.ts 기본값도 변경)
npm run content:build -- --seed-out supabase/seed.sql
```
