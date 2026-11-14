# content/ — 퀘스트 콘텐츠 원본 (Content as Code)

퀘스트·스테이지·월드를 YAML로 쓰고, `npm run content:build`가 DB seed SQL과 검증용 JSON을 만듭니다. 배경과 결정은 `docs/4.upgrade-plan.md` §2.4, P1-11~13을 참고하세요.

- **한 파일에 공개 부분과 정답 부분을 함께 씁니다.** 빌드가 나눠서 공개 부분은 `quests`(학생 브라우저로 내려감), 정답 부분은 `quest_answer_keys`(service_role 전용)에 씁니다 (P0-08, P1-02).
- 스키마: `src/lib/content/schema.ts` (zod). 모르는 키는 모두 오류입니다.
- **퀘스트 콘텐츠의 원본은 이 디렉토리입니다** (P1-12에서 44개 퀘스트 전체 이관). `supabase/seed.sql`은 빌드 생성물이라 직접 고치지 않습니다. 고치면 CI의 `content:build -- --check`와 `npm test`(`content.test.ts`)가 실패합니다.

## 1. 디렉토리 구조

```
content/
└── worlds/
    ├── python-island/                 # 월드 slug (worlds.slug, P1-08)
    │   ├── world.yaml
    │   ├── map.yaml                   # 지도 설정 (P5-03). 스테이지가 있는 월드는 필수
    │   ├── 01-python-village/         # NN-<영문 슬러그>, NN = stage.yaml 의 order
    │   │   ├── stage.yaml
    │   │   ├── 01-first-greeting.yaml # NN-<영문 슬러그>.yaml, NN = 퀘스트 order
    │   │   └── …
    │   └── 07-project-kingdom/
    │       ├── stage.yaml
    │       └── 01-number-guessing-game.yaml
    ├── code-sea/                      # 월드 2: world.yaml·map.yaml + 스테이지 7개 껍데기(퀘스트는 P10-05~07). 퀘스트 전이라 "준비 중"
    └── maker-city/world.yaml          # 월드 3 "준비 중"
```

- 이름은 영문 소문자·숫자·하이픈만 씁니다. 앞 두 자리 번호는 YAML의 `order`와 같아야 합니다(빌드가 확인).
- 순서를 바꾸려면 `order`와 파일 이름 번호를 함께 바꿉니다. 빌드한 seed가 UNIQUE 충돌 없이 순서를 옮깁니다.
- 빌드가 확인하는 중복: 모든 `id`, 월드 `order`, 월드 안의 스테이지 `order`(DB `UNIQUE(world_id, "order")`, P1-08), 스테이지 안의 퀘스트 `order`.

## 2. 파일 형식

### world.yaml

| 필드 | 설명 |
|---|---|
| `slug` | 디렉토리 이름과 같음. 예: `python-island` |
| `order` | 월드 순서 |
| `title` | 화면 이름. 예: `파이썬 섬`. 랜딩·월드맵이 모두 여기서 읽으므로 가칭은 이 한 곳만 고칩니다 |
| `theme` | 테마 키 (영문 소문자·밑줄) |
| `description` | 소개 문장 |
| `unlock_rule` | 월드 해제 규칙. `{ type: open }`(처음부터 열림) 또는 `{ type: previous_world_cleared }`(이전 월드를 끝내면 열림, §12-Q2·Q48). 실력 확인 퀴즈 규칙은 P10-03 |

스테이지 디렉토리가 없는 월드는 **"준비 중"** 표지가 됩니다(`ready: false`, 랜딩·월드 선택 화면). 스테이지를 넣으면 `map.yaml`도 함께 씁니다.

**지도만 먼저 만든 월드 (P10-04)**: 스테이지는 있지만 퀘스트 파일이 **하나도 없는** 월드는 검사를 통과하되 스테이지를 seed(DB)에 넣지 않고 `ready: false`(준비 중)로 둡니다. 지도(`map.yaml`)는 앱에 실려 카탈로그에서 볼 수 있습니다. 퀘스트를 하나라도 넣으면 보통 월드가 되어 **모든 스테이지**에 퀘스트가 있어야 합니다("퀘스트 파일이 없어요").

빌드가 `worlds`에 `slug` 기준으로 업서트하고(id는 DB가 정함, 1월드는 00012가 만든 고정 id) 그 월드의 스테이지에 `stages.world_id`를 채웁니다(P1-08). 스테이지 순서는 (월드 `order`, 스테이지 `order`)이고, 월드의 첫 스테이지는 이전 월드의 마지막 스테이지를 깨야 열립니다(Phase 10 전까지).

### map.yaml → 앱 지도 (DB 에 쓰지 않음, P5-03)

월드 지도의 노드 좌표·길·장식입니다. 빌드가 `world.yaml`(이름·테마·해제 규칙)과 합쳐 `src/lib/world/worlds.generated.ts`를 만들고, 월드맵(`WorldMap`)이 그 값을 그대로 씁니다. **코드를 고치지 않고 월드 디렉토리만 더하면 지도가 나옵니다.**

```yaml
bgm: world1            # 월드 BGM id (src/lib/sound/manifest.ts 의 bgm 키)
path: catmull_rom      # 노드를 잇는 길: catmull_rom(부드러운 곡선, 시안 smooth) | straight
ambient: { clouds: true, sparkles: true, weather: leaves }   # 선택(P5-09). 없으면 모두 끔. weather: none | leaves
layouts:
  wide:                # 넓은 화면(lg 이상): 가로 지도
    width: 1200        # viewBox 0 0 width height
    height: 720
    node_scale: 1      # 노드 옆 랜드마크 그림 배율
    nodes:             # i번째 = i+1번 스테이지 중심 [x, y]
      - [170, 600]
      - …
    decorations:       # 선택. kind: tree | mountains | waves | bird | boat | palm | rock | buoy | whale, scale 선택
      - { kind: tree, x: 70, y: 430, scale: 1.2 }
  tall:                # 좁은 화면: 세로로 긴 지도 (같은 키)
    width: 400
    height: 1180
    …
```

- **빌드가 확인**: 두 레이아웃 모두 노드 수 = 스테이지 수, 노드가 `width × height` 안, 모르는 키 없음, 스테이지가 있는 월드에 `map.yaml`이 있음.
- 테마 키는 `world.yaml`의 `theme`, 노드의 랜드마크 그림은 `stage.yaml`의 `theme_name`을 씁니다(따로 적지 않음).
- 그림(P5-02, `src/components/world/map/MapArt.tsx`): `decorations`의 `waves`·`boat`·`bird`·`buoy`는 먼 레이어(움직임), `mountains`·`tree`·`palm`·`rock`·`whale`은 중간 레이어(정지)에 그려지고(패럴랙스 깊이), 바다·해안선 같은 바탕은 테마 키로 `THEME_BASE`에서 고릅니다(없는 테마는 종이 바탕 + 장식만). 랜드마크는 `theme_name`이 `LANDMARKS`에 있을 때만, 크기는 `node_scale`.
- 앰비언트(P5-09): `ambient`는 구름(먼 레이어)·반짝임(물결 옆 + 길 위)·날씨를 켜고 끕니다. 자리는 `src/lib/world/ambient.ts`가 레이아웃에서 정하고(종류별 상한 `AMBIENT_CAP`), `waves`·`boat`·`bird` 장식은 스위치와 상관없이 움직입니다. 움직임은 연출 단계 full에서만.
- 좌표를 정할 때는 확정 시안 `design/prototypes/src/final/World.tsx`의 `WIDE`·`TALL`을 참고합니다. 지금 노드 카드가 넓어서(P5-04 전) 양 끝 노드는 지도 가장자리에서 120 이상 떨어뜨립니다. 노드 `y`는 130 이상(지금 위치 파이뱀이 노드 위에 섬). 파이뱀은 가장자리에 가까우면 노드 반대쪽에 서고(`markerSide`), 단위 테스트가 모든 월드·노드에서 잘리지 않는지 확인합니다.
- 테스트용 2번째 월드: `e2e/fixtures/content/worlds/test-meadow/`(스테이지 3개). 단위 테스트(`src/lib/world/__tests__/worldMapData.test.tsx`)가 `content/`에 이 디렉토리를 더해 지도가 나오는지 확인합니다.

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
quest_type: code                            # code | project | quiz | boss (아래 "퀴즈"·"보스")

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
  checklist:                                # "해 볼 일" 목록 (P7-17). 2~4개, 짧고 구체적으로
    - print( )를 써요
    - 따옴표 안에 안녕하세요! 를 넣어요
  example_output: |-                        # 결과 쪽지의 "이런 모양이면 돼요" (P7-17)
    안녕하세요!
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
| `prompt` | `checklist`(1~5개, 2~4개 권장), `example_output` | 코드 퀘스트 필수. 프로젝트는 퀘스트 전체에 쓰지 않고 `steps[].prompt`에 필수 | `quests.prompt_skeleton` (공개, P7-17) |
| `prompt` | `is_challenge` | 선택 | `quests.prompt_skeleton` (공개) |
| `answer` | `validation` | 필수 | `type` → `quests.validation_type`(공개), 기준값 → `quest_answer_keys.expected_output` |
| `answer` | `hints.level_1~3` | 3개 모두 | `quest_answer_keys.hints` |
| `answer` | `solution_code` | 코드 퀘스트 필수, 프로젝트 전체에는 선택 | `quest_answer_keys.solution_code` |
| `answer` | `scenarios` | 선택 (`input()` 퀘스트). 프로젝트는 단계에만 | DB에 쓰지 않음. 자동 검증(§6 정답 자동 검증)만 읽음 |

**해 볼 일·예시 출력 (P7-17, §12-Q59)**: 퀘스트 화면의 "해 볼 일" 체크리스트는 `checklist`를 그대로 보여 주고(통과하면 모두 체크), 결과 쪽지는 출력이 다를 때 `example_output`을 보여 줍니다. 규칙이 `output_match`면 예시와 나온 글자를 줄마다 견주고(같은 줄 ✓, 다른 줄은 연필 표시 + "내 글자"), 다른 규칙(무작위·포함 검사)이면 "예시"라고 밝히고 그대로 보여 줍니다. 예시는 학생에게 보이는 값이라 **정답 규칙을 통과해야 하고**(빌드가 `validateRule`로 확인, `output_match`면 기준값과 똑같이, `code_check`는 정답 코드로 확인) 무작위 출력이면 나올 수 있는 한 가지를 씁니다. 체크리스트는 `exercise_description`·`expected_output_hint`와 같은 말로, 초등학생 눈높이의 "~해요" 문장으로 씁니다.

여러 줄 문자열(코드, 여러 줄 출력)은 `|`(끝 줄바꿈 하나 유지) 또는 `|-`(끝 줄바꿈 없음)로 씁니다. `output_match`는 앞뒤 공백을 무시하므로 어느 쪽이든 됩니다. 시작 코드·정답 코드는 학생 에디터에 그대로 들어가므로 끝 줄바꿈을 원래대로 둡니다.

### 프로젝트 퀘스트 (`quest_type: project`)

`prompt`·`answer`(퀘스트 전체 규칙, 마지막 단계 정답이 이 규칙도 통과해야 함)에 더해 `steps`를 씁니다. 단계 번호는 1부터 차례대로입니다.

```yaml
steps:
  - step_number: 1
    prompt:                              # 공개 → prompt_skeleton.steps[]
      step_goal: random 모듈로 1~10 사이의 비밀 숫자를 만들고 출력해보기
      checklist:                         # 이 단계의 해 볼 일 (지금 단계 아래에 보임, P7-17)
        - secret 에 넣고 print( )로 보여 줘요
      example_output: |-                 # 무작위면 나올 수 있는 한 가지
        7
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

### 퀴즈 (`quest_type: quiz`, P7-01)

키보드 없이 푸는 **보너스 퀘스트**입니다. 스테이지 안 코드 퀘스트 사이에 `order`로 끼워 넣지만 스테이지 잠금 해제·클리어 계산에는 들어가지 않습니다(§12-Q60). 종류는 `quiz_kind` 4가지이고, 실행할 코드가 없어 `hints`·`solution_code`·`validation`·`exercise_description`·`starter_code`·`expected_output_hint`를 쓰지 않습니다(쓰면 오류). XP는 별 1개당 10 XP를 채점 RPC(P7-02)가 줍니다. `xp_reward`는 30(별 3개)으로 씁니다.

공통 모양:

```yaml
id: …                       # 새 UUID
order: 3                    # 코드 퀘스트 사이에 끼워도 됨
title: 반복문 맞혀 보기
concept: for 반복문
xp_reward: 30
quest_type: quiz
quiz_kind: multiple_choice  # multiple_choice | fill_blank | parsons | bug_hunt

prompt:                     # 공개 → quests.prompt_skeleton (quiz 에는 빌드가 kind 를 붙임)
  topic: …
  learning_goals: [ … ]
  story_context: …
  fallback_text: …          # 튜터가 실패할 때 보이는 설명. 정답을 쓰면 빌드 실패
  quiz: { … }               # 종류별 (아래)

answer:                     # 정답 → quest_answer_keys.quiz_answer (빌드가 kind 를 붙임)
  quiz_answer:
    accepted: [ … ]         # 정답 목록. 정답이 여럿이면 모두 (아래 정규형)
    explanation: …          # 정답 해설 (맞혔을 때, 3번 틀려 정답을 보여 줄 때)
    explanations:           # 선택. 보기·줄·수정안 id 별 해설 (그것을 골랐을 때)
      opt-b2mx: 0부터 세요.
```

**id 규칙** (보기·토큰·줄·수정안·빈칸): `<영문 소문자 머리 1~6자>-<영문 소문자와 숫자를 섞은 4~8자>`, 예: `opt-k7qz`, `tok-m4xe`, `ln-q8wd`, `fx-b7nd`, `bk-r2fa`. 글자와 숫자를 반드시 섞어야 해서 `a`·`b`·`opt-a`·`l1`·`ln-0001`·`opt-abcd` 같은 차례형 이름은 실패합니다. 한 퀴즈 안에서 모두 달라야 합니다. 만들기: `node -e "console.log(Math.random().toString(36).slice(2,6))"`(숫자가 없으면 다시).

빌드는 **보기·토큰·parsons 줄·수정안을 id 순으로** 공개합니다(원본에 정답을 앞에 써도 드러나지 않게). bug_hunt 줄만 코드라서 쓴 순서 그대로입니다. 그래서 parsons 줄 id를 정렬한 차례가 정답 차례와 같으면 빌드가 실패합니다(화면에 정답 순서로 나오기 때문).

#### multiple_choice — 객관식

```yaml
quiz_kind: multiple_choice
prompt:
  quiz:
    question: 이 코드를 돌리면 무엇이 나올까?
    code: |-                # 선택. 출력 예측형 문제의 코드
      for i in range(3):
          print(i)
    options:                # 2~6개
      - { id: opt-k7qz, text: "0 1 2" }
      - { id: opt-b2mx, text: "1 2 3" }
      - { id: opt-w9fa, text: "0 1 2 3" }
answer:
  quiz_answer:
    accepted: [opt-k7qz]    # 보기 id. 틀린 보기가 하나는 있어야 함
    explanation: range(3)은 0부터 2까지예요.
```

**출력 예측형**(§12-Q60 결정 4a): 새 종류 없이 객관식으로 씁니다. 문제는 "이 코드를 돌리면 무엇이 나올까?", `code`에 짧은 코드(5줄 이하), 보기에는 실제 출력과 **흔히 헷갈리는 출력**(0부터/1부터, 마지막 수 포함 여부, 따옴표까지 나온다고 착각, 줄바꿈 대신 한 줄)을 넣습니다. 여러 줄 출력은 보기 글자에 실제 줄바꿈(`"안녕\n2026"`)으로 씁니다(B53, 쉼표로 잇지 않음 — `[1, 2, 3]` 같은 출력과 헷갈림). 정답 보기는 실제로 돌려 본 출력과 같아야 합니다.

**보기 글자 모양**(화면 `MultipleChoice`, P7-03·B53): 문제에 `code`가 있으면(출력 예측형) 보기는 "출력 모양" — 코드 글꼴, 문법 색 없이, 줄마다 끝에 ↵ 표시로 보입니다. 그 밖의 보기는 `` `print("안녕")` ``처럼 글자 전체를 백틱 하나로 감싸거나 여러 줄이면 코드 블록으로, 아니면 보통 글자로 보입니다.

#### fill_blank — 빈칸 채우기

```yaml
quiz_kind: fill_blank
prompt:
  quiz:
    question: 빈칸을 채워 0부터 2까지 출력해요
    code: |-                # 빈칸은 {{빈칸 id}}
      for i in {{bk-r2fa}}(3):
          {{bk-m8ce}}(i)
    tokens:                 # 정답에 안 쓰는 토큰 = 방해 토큰
      - { id: tok-m4xe, text: range }
      - { id: tok-c3pd, text: print }
      - { id: tok-z6nh, text: input }
answer:
  quiz_answer:
    accepted:               # 빈칸 id → 토큰 id. 모든 빈칸을 채움
      - { bk-r2fa: tok-m4xe, bk-m8ce: tok-c3pd }
    explanation: range 로 숫자를 만들고 print 로 보여 줘요.
```

#### parsons — 줄 순서 맞추기

```yaml
quiz_kind: parsons
prompt:
  quiz:
    question: 줄을 순서대로 놓아 1부터 3까지 더해요
    indent: true            # 선택. true 면 학생이 들여쓰기도 정함 → 줄 앞 공백 없이 씀
    lines:                  # 2~12줄. 모든 줄을 씀
      - { id: ln-q8wd, code: total = 0 }
      - { id: ln-a3ke, code: "for i in range(1, 4):" }
      - { id: ln-m2xa, code: total = total + i }
      - { id: ln-f5tb, code: print(total) }
answer:
  quiz_answer:
    accepted:               # indent: true 면 {id, indent}(0~4), 아니면 줄 id 배열
      - - { id: ln-q8wd, indent: 0 }
        - { id: ln-a3ke, indent: 0 }
        - { id: ln-m2xa, indent: 1 }
        - { id: ln-f5tb, indent: 0 }
    explanation: 먼저 0으로 시작하고, 반복하며 더한 뒤 출력해요.
```

바꿔도 되는 줄(예: 서로 상관없는 변수 두 줄)이 있으면 가능한 순서를 `accepted`에 모두 씁니다.

#### bug_hunt — 버그 찾기

```yaml
quiz_kind: bug_hunt
prompt:
  quiz:
    question: 틀린 줄을 찾아 고쳐요
    lines:                  # 코드 순서 그대로, 들여쓰기 포함
      - { id: ln-x5pc, code: "for i in range(3)" }
      - { id: ln-h7jq, code: "    print(i)" }
    fixes:                  # 고친 줄 후보 2~6개
      - { id: fx-b7nd, code: "for i in range(3):" }
      - { id: fx-e4kr, code: "for i in range[3]" }
answer:
  quiz_answer:
    accepted:               # 틀린 줄 id + 고친 줄 id
      - { line: ln-x5pc, fix: fx-b7nd }
    explanation: for 줄 끝에는 쌍점(:)이 있어야 해요.
```

**`accepted` 정규형** (채점 RPC가 학생 제출값과 `jsonb =`로 그대로 비교, P7-02. `@>` 금지)

| 종류 | 원소 하나 | 예 |
|---|---|---|
| `multiple_choice` | 보기 id 문자열 | `"opt-k7qz"` |
| `fill_blank` | 빈칸 id → 토큰 id 객체 (모든 빈칸, 키 순서 무관) | `{"bk-r2fa":"tok-m4xe","bk-m8ce":"tok-c3pd"}` |
| `parsons` | 줄 id 배열 (정답 순서) | `["ln-q8wd","ln-a3ke","ln-m2xa","ln-f5tb"]` |
| `parsons` + `indent: true` | `{id, indent}` 배열 | `[{"id":"ln-q8wd","indent":0}, …]` |
| `bug_hunt` | `{line, fix}` | `{"line":"ln-x5pc","fix":"fx-b7nd"}` |

**빌드가 확인**: id 형식·중복, `accepted`·`explanations`가 있는 id만 가리키는지, 객관식에 틀린 보기가 있는지, fill_blank가 모든 빈칸을 채우는지, parsons가 모든 줄을 한 번씩 쓰는지와 indent 모양, 같은 정답 중복, 그리고 **공개 문장(제목·`topic`·`learning_goals`·`story_context`·`fallback_text`·문제 문장)에 정답이 그대로 있는지**(§12-Q20). 정답 글자는 객관식·bug_hunt는 정답 보기·수정안 글자(오답 보기 글자도 같은 문장에 있으면 정답을 짚은 게 아니라서 통과), fill_blank는 빈칸을 정답으로 채운 줄, parsons는 정답 순서로 이어지는 두 줄입니다. 한 글자짜리와 영문·숫자 낱말 한가운데(`3` ⊂ `range(30)`)는 보지 않습니다. 코드·보기 자체는 문제라서 보지 않습니다.

DB: `quests.quest_type = 'quiz'`, `quiz_kind`, `is_mobile_friendly = true`, `validation_type = 'all'`(퀴즈는 쓰지 않는 자리값. 00012 CHECK 안의 값이고 기준값 칸이 비어 코드 채점 경로로는 항상 불합격), `quest_answer_keys`는 `quiz_answer`만 있고 `hints = {}`·`solution_code = NULL`. 정답 코드 자동 검증은 퀴즈를 건너뛰고, 대신 `scripts/content/__tests__/quizzes.content.test.ts`(`test:content`)가 퀴즈 코드를 Pyodide로 돌려 봅니다: 출력 예측형 실제 출력(앞뒤 공백만 뺌) = 정답 보기, fill_blank 정답 채움은 오류 없이 끝나고 오답 토큰은 결과가 다름, parsons 정답 순서는 모두 같은 출력, bug_hunt 원래 코드·오답 수정안은 정답 수정안과 결과가 다름. 그래서 퀴즈 코드에는 `input()`·`random`을 쓰지 않습니다.

### 보스 (`quest_type: boss`, P9-12)

**스테이지 마지막 관문**입니다. 퀴즈 문제(라운드) 3~7개를 이어서 풀고, 맞히면 꾸민 파이뱀이 공격해 보스 HP가 한 칸 줄고, 틀리면 하트(3개)가 하나 줄며 같은 문제를 다시 고릅니다. 하트 0이면 패배(바로 무료 재도전), 마지막 문제를 맞히면 승리. **별 = 남은 하트**, XP = 별 1개당 `xp_reward / 3`(그래서 `xp_reward`는 3의 배수. 1월드는 문제 수에 맞춰 30~54, `docs/balance.md` 3.14), 첫 승리 코인 20 + 새 별마다 5(`docs/balance.md` 3.14). 채점·하트는 서버(`boss_answer`, 00046)가 한 문제씩 합니다.

- **잠금**: 같은 스테이지의 다른 퀘스트(퀴즈 빼고)를 모두 끝내야 열립니다. 보스는 퀴즈와 달리 **스테이지 클리어·다음 스테이지 해제에 듭니다**(이겨야 통과 도장·보물상자·다음 스테이지). 이미 뒤 스테이지에서 퀘스트를 완료한 학생은 앞 스테이지에 보스가 새로 생겨도 그 스테이지들이 잠기지 않습니다(00046 `is_stage_unlocked`).
- **순서**: 스테이지의 맨 마지막 `order`(코드 퀘스트·퀴즈 뒤). 파일 이름 `NN-boss-<슬러그>.yaml`, id는 `b1000000-0000-0000-0000-0000000002NN`(스테이지 번호 NN).
- 라운드 하나 = 퀴즈 하나와 같은 모양·규칙(위 4종, id 규칙, 공개 문장 정답 누출 검사, `test:content` Pyodide 검사). 보스 대사도 공개 문장으로 봅니다. 키보드 없이 깰 수 있게 퀴즈 문제만 씁니다(빌드가 `is_mobile_friendly = true`).

```yaml
id: b1000000-0000-0000-0000-000000000201
order: 11                     # 스테이지 맨 마지막
title: 출력 대장 버그버그
concept: print() 총정리
xp_reward: 30                 # 3의 배수 (별 1개당 10)
quest_type: boss
prompt:
  topic: …
  learning_goals: [ … ]
  story_context: …
  fallback_text: …
  boss:
    name: 출력 대장 버그버그   # HP 바 이름표
    look: village             # 선택. 외형(등딱지 색·모자): village forest crossroad cave lake tower kingdom (P9-13, 리그 bugbug/looks.ts)
    intro: 히히! …            # 등장할 때 보스 한마디
    on_defeat: 으앗, 졌다! …  # 학생이 이겼을 때 (진 보스가 친구처럼)
    on_victory: 이번엔 …      # 학생이 졌을 때 (놀리지 않고 다시 오라고)
rounds:                       # 3~7개. 라운드마다 퀴즈 하나
  - quiz_kind: multiple_choice
    review_quest: b1000000-0000-0000-0000-000000000002   # 선택. 이 문제에서 지면 "복습하러 가기"가 여는 같은 스테이지 퀘스트
    prompt:
      quiz: { question: …, code: …, options: [ … ] }      # 퀴즈 prompt.quiz 와 같음
    answer:
      quiz_answer: { accepted: [ … ], explanation: …, explanations: { … } }
```

DB: `quests.quest_type = 'boss'`, `prompt_skeleton.boss = {name, intro, on_defeat, on_victory, rounds: [퀴즈 공개 모양…], review_quests: [id|null…]}`, `quest_answer_keys.quiz_answer = {kind: 'boss', rounds: [{kind, accepted, explanation, explanations?}…]}`(00046 CHECK). 보기 순서는 들어올 때·다시 도전할 때마다 서버가 섞습니다.

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

> `quests.validation_type` CHECK는 00012(P1-08)부터 `contains_any`·`all`도 받으므로, 새 유형을 프로젝트 단계뿐 아니라 퀘스트 전체 규칙에도 쓸 수 있습니다. 단, 운영에 00012가 적용되기 전에는 그런 콘텐츠의 seed를 적용할 수 없습니다(런북 순서: ① → ② → ③ → seed).

## 4. 공개 부분에 쓰면 안 되는 것

- `prompt`(와 `steps[].prompt`)에는 정답 키 `hints`, `solution_code`, `expected_output`, `is_correct`, `accepted`를 둘 수 없습니다. 스키마가 막고, 빌드한 공개 행도 한 번 더 검사합니다(00005의 `quests_no_answer_fields` CHECK와 같은 목록).
- 코드 퀘스트의 `fallback_text`·`expected_output_hint`·`example_output`에 예시 코드나 목표 출력을 쓰는 것은 의도한 노출로 인정합니다(§12-Q20: 초반 퀘스트의 예시, `fallback_text`는 튜터가 실패할 때만 보임).
- **퀴즈(P7-01)는 다릅니다.** 공개 필드에 정답이나 정답이 드러나는 문장을 넣으면 빌드가 실패합니다. 보기·토큰·줄 id는 정답 위치를 암시하지 않는 임의 문자열로 씁니다(위 "퀴즈"의 id 규칙·빌드 확인). 휴리스틱이 못 잡는 표현("첫 번째 보기가 답이에요")도 쓰지 않습니다.

## 5. 새 퀘스트 추가

1. 스테이지 디렉토리에 `NN-<슬러그>.yaml`을 만듭니다(비슷한 퀘스트를 복사해 시작).
2. `id`는 새 UUID: `node -e "console.log(crypto.randomUUID())"`. 한 번 정하면 바꾸지 않습니다.
3. `npm run content:build`로 검사·생성합니다. 오류는 파일 경로와 필드 위치를 함께 보여 줍니다. 다시 만든 `supabase/seed.sql`을 YAML과 **같은 커밋**에 넣습니다.
4. 운영 DB에는 다음 릴리즈 때 `supabase/seed.sql`을 SQL Editor로 적용합니다(`docs/release/v0.4-runbook.md` "콘텐츠 seed 적용").
5. `npm run test:content`(약 10~30초)로 정답 코드가 규칙을 통과하고 시작 코드는 통과하지 않는지 확인합니다(§6 정답 자동 검증). CI(P1-15)가 생기면 PR 필수 체크가 됩니다(§12-Q19).
6. 퀘스트를 **지울 때**는 파일만 지우면 DB에서 사라지지 않습니다(빌드는 지우지 않음). 지우면 `user_progress`가 CASCADE로 함께 지워지므로 마이그레이션으로 따로 처리합니다.

## 6. 명령

```bash
npm run content:build              # 검사 + 생성: supabase/seed.sql·src/lib/world/worlds.generated.ts (커밋), build/content/quests.json (git 제외)
npm run content:build -- --check   # 생성하지 않고, 커밋하는 생성물이 content/ 와 다르면 종료 코드 1 (CI 드리프트 검사용)
npm run content:build -- --fixtures e2e/fixtures/content   # e2e 테스트 월드(P5-01): content/와 합쳐 검사하고 테스트 월드만 build/e2e/worlds.json·rows.json에 (운영 seed·생성물 그대로, Playwright가 서버 띄울 때 실행)
npm run content:compare            # 왕복 비교 (아래)
npm run content:extract -- --stage 1   # seed → content/ YAML 추출 (이관용, --all, --force, --seed-rev)
npm run test:content               # 정답 자동 검증 (Node Pyodide, 아래 "정답 자동 검증")
npx vitest run src/lib/content src/lib/quest   # 스키마·빌드·검증기 단위 테스트 (+ PGlite 적용 테스트)
```

- 옵션: `content:build --seed-out <file> --json-out <file> --content <dir>`, `content:compare --expect-diff 7-1,4-7 --seed <file> --seed-rev [<rev>] --content <dir> --migrations-up-to 00005`
- `--seed-rev`: 원본 seed 를 파일 대신 git 커밋에서 읽습니다. 값을 생략하면 손으로 쓴 마지막 seed 가 있는 커밋(`scripts/content/lib/paths.ts`의 `LEGACY_SEED_REV` = `9b88cea`)
- 세 명령 모두 **PGlite**(npm 패키지, 메모리 Postgres)로 SQL을 실행합니다. 로컬 Supabase 스택·docker를 쓰지 않습니다.

### 생성물

| 파일 | 내용 | 커밋 |
|---|---|---|
| seed SQL (`supabase/seed.sql`) | 스테이지·`quests`(공개) 업서트 + `quest_answer_keys`(정답) 업서트. DML만 있고 멱등. 머리에 콘텐츠 해시. 값은 모두 한 줄 리터럴(줄바꿈이 있으면 `E'…\n…'`, jsonb는 한 줄 JSON)이라 SQL Editor 붙여넣기의 CRLF에 안전(B39) | **커밋** (`db reset`·RLS 테스트·운영 SQL Editor가 그대로 읽음, PR에서 SQL diff 리뷰, CI는 `--check`로 원본과 어긋남 검사). content/ 를 고친 커밋에 다시 만든 seed 를 함께 넣습니다 |
| 월드 모듈 (`src/lib/world/worlds.generated.ts`) | 월드마다 `slug·order·title·theme·unlock_rule·ready·map`. 앱(월드맵·랜딩)이 import (P5-03). TS 인 까닭은 랜딩 글꼴 서브셋 수집기가 TS 모듈만 따라가기 때문 | **커밋** (`--check`·`content.test.ts`가 원본과 비교, prettier 제외) |
| 검증 JSON (`build/content/quests.json`) | 퀘스트마다 `id, key, validation_type, expected_output, starter_code, solution_code, steps[]`(+ 있으면 `scenarios`) (P0-09 fixture 형태). `validation_type`·`expected_output`은 DB 저장 형태라 `validateResult`에 바로 넣음 | **커밋하지 않음** (원본에서 1초 안에 다시 만들고, 정답을 담은 파생물이라 diff 리뷰 가치가 없음) |

`--check`는 커밋하는 seed만 비교합니다. 검증 JSON은 git에 없어 CI의 새 checkout에는 파일이 없기 때문입니다. `test:content`는 이 파일을 읽지 않고 같은 함수(`toCheckFixture`)로 메모리에서 만들어 씁니다(seed.sql도 쓰지 않음).

### 정답 자동 검증 (`npm run test:content`, P1-13)

모든 퀘스트·프로젝트 단계의 정답 코드를 **브라우저와 같은 실행 코어**(`public/workers/pyodide-core.mjs`, Pyodide 314.0.7을 Node `worker_threads`로)에서 실제로 실행하고, 앱과 같은 순서(예외 없이 끝남 → `validateResult`)로 판정합니다. DB·브라우저·네트워크가 필요 없습니다.

| 검사 | 통과 조건 | 실패하면 |
|---|---|---|
| ① 정답 | 모든 퀘스트·단계에 `solution_code`와 읽을 수 있는 규칙이 있음 | 정답을 씁니다 |
| ② 정답 통과 | 정답이 **시드 0~9 + 무시드 1회** 모두에서 통과 (입력 시나리오가 있으면 시나리오마다) | 규칙·기대 출력·정답 중 틀린 쪽을 고칩니다. 일부 시드만 실패하면 무작위 출력이므로 `contains_any`·`all`로 넓힙니다(§3) |
| ③ 시작 코드 불합격 | 시작 코드를 그대로 실행하면 불합격. 프로젝트 k단계는 화면과 같게 "k-1단계 정답 + 줄바꿈 + k단계 `starter_code`" | 규칙을 좁히거나(`all`로 `code_check` + 출력) 시작 코드에서 답을 뺍니다 (B30) |
| ④ 무한 루프 없음 | 시작 코드가 5초 안에, 출력 상한에 걸리지 않고 끝남 | 반복 조건을 바꾸는 줄을 빈칸(`count = count - ___`)으로 넣어 바로 오류로 멈추게 합니다 (B31) |
| ⑤ 프로젝트 전체 규칙 | 마지막 단계 정답이 퀘스트 전체 `answer.validation`도 통과 | 전체 규칙이나 마지막 단계 정답을 맞춥니다 |

```bash
npm run test:content                                 # PR 필수 체크: 시드 0~9 + 무시드 1회
TEST_CONTENT_ONLY=7-1,4-7 npm run test:content       # 고친 퀘스트만 (퀘스트 키, 단계 7-1#3, 퀘스트 id)
TEST_CONTENT_UNSEEDED_RUNS=20 npm run test:content   # main 전용: 무시드 20회 (드물게 흔들리는 콘텐츠)
TEST_CONTENT_DIR=/tmp/my-content npm run test:content   # 다른 콘텐츠 디렉토리 (기본 content/)
```

- 그 밖의 env: `TEST_CONTENT_SEEDS`(고정 시드 개수, 기본 10), `TEST_CONTENT_WORKERS`(동시에 띄울 Pyodide 수, 기본 `min(4, CPU-1)`. 1개면 프로세스 최대 RSS 약 220MB, 4개면 약 440MB).
- **실행마다 시드를 넣습니다.** 실행마다 namespace는 새로 만들지만 `random` 모듈 상태는 남기 때문입니다. "무시드" 실행도 JS에서 뽑은 무작위 시드를 넣고 실패 메시지에 그 값을 적습니다. "시드 N"은 학생 코드 앞에서 `random.seed(N)`을 부른 것과 같습니다.
- 실패 메시지에는 파일 위치(`… steps[2].answer`), 실패한 시드, 규칙 요약, 하위 규칙별 통과·실패, 기대/실제 출력 차이(`output_match`)나 실제 출력, 재현 명령이 들어 있습니다. 예:

  ```
  [7-1#3] 숫자 맞추기 게임 3/5단계 — content/worlds/python-island/07-project-kingdom/01-number-guessing-game.yaml steps[2].answer (퀘스트 id …022)
  정답 코드가 자기 규칙을 통과하지 못했어요: 11회 중 8회 실패 (시드 0~4, 8, 9, 무시드(시드 32703163))
  규칙: contains "보다 커요"
  --- 시드 0 ---
  [실패] contains: 출력에 "보다 커요"가 들어 있어야 해요
  실제 출력:
    | 정답!
  안내: 일부 시드에서만 실패하면 출력이 무작위인 퀘스트예요. … contains_any·all 같은 넓은 규칙을 쓰세요
  ```

- **입력 시나리오** (`input()` 퀘스트, P11-05에서 확장): `answer.scenarios`(프로젝트는 `steps[].answer.scenarios`)에 적으면 각 시나리오의 `inputs`가 실행기의 `setStdin` 큐로 한 줄씩 들어갑니다. 입력이 모자라면 `EOFError`(실패). `seed`를 적은 시나리오는 그 시드로 한 번만 실행합니다(입력이 비밀 숫자 같은 난수에 맞춰져 있을 때). 시작 코드도 같은 입력으로 실행합니다. `input("프롬프트")`의 프롬프트는 stdout에 찍히고 입력한 글자는 찍히지 않으므로, 프롬프트가 있는 퀘스트는 `output_match` 대신 `contains` 계열을 씁니다.

  ```yaml
  answer:
    validation: { type: contains, expected: 통과! }
    scenarios:
      - inputs: [열려라]           # 시드 0~9 + 무시드로 실행
      - inputs: [틀림, 열려라]
  # 숫자 맞추기처럼 입력이 난수에 맞춰져 있으면: - { inputs: [abc, '50', '75', '82'], seed: 42 }
  ```

- 시간: 44 퀘스트(48 단위, 실행 1,056회)에 Pyodide 로드 4~13초 + 검사 1~12초(Pyodide 수와 머신 부하에 따라). `npm test`에서는 빠집니다(`*.content.test.ts`, `vitest.config.ts`).

### 왕복 비교 (`content:compare`)

메모리 DB 4개를 띄워 비교합니다.

기본 원본은 커밋한 `supabase/seed.sql`이고, `--seed-rev`를 주면 손으로 쓴 예전 seed입니다.

| 비교 | 뜻 |
|---|---|
| A 원본 = B 생성 | `migrations → 원본 seed`와 `migrations → 생성 seed`의 `stages`·`quests`·`quest_answer_keys` 행이 content 범위에서 같음 |
| B = C 재실행 | 생성 seed를 두 번 실행해도 같음 (멱등) |
| A = D 덮어쓰기 | 원본 데이터가 있는 DB에 생성 seed를 업서트해도 전체 행이 같음 |
| 검증 JSON | 원본 DB에서 만든 JSON = 빌드 결과 |

## 7. P1-12 이관 기록 (2026-11-04, 완료)

```bash
npm run content:extract -- --all --seed-rev   # 1) 손으로 쓴 seed(9b88cea)에서 44 퀘스트 추출
npm run content:build                         # 2) 경고 0, 스테이지 7 · 퀘스트 44 · solution_code 43 · 단계 5/5
npm run content:compare -- --seed-rev         # 3) 콘텐츠 버그를 고치기 전: 4개 비교 모두 PASS, "퀘스트 44/44"
# 4) 콘텐츠 버그 수정 후: 고친 퀘스트만 차이가 나는지 확인
npm run content:compare -- --seed-rev --expect-diff 1-5,4-7,7-1
# 5) seed 교체: 기본 출력이 supabase/seed.sql (paths.ts)
npm run content:build
```

| 퀘스트 | 고친 것 | 작업 ID |
|---|---|---|
| 7-1 2단계 | `code_check "int("` → `all[code_check "guess", contains "추측"]`. 단계 목표·`fallback_text`에 출력 안내 | B30 |
| 7-1 3단계 | `contains "보다 커요"` → `all[code_check "elif", contains_any ["커요","작아요","정답"]]`, 힌트 level_3 | B09 |
| 4-7 | 시작 코드에 `count = count - ___` (무한 루프 → 바로 오류로 멈춤), 힌트 level_3 | B31 |
| 1-5 | `concept`의 `\\n` → `\n` (화면에 역슬래시 두 개로 보였음) | |

- Node Pyodide(P0-09 프로토타입의 실제 워커)로 확인: 48개 검증 단위 모두 정답 통과(무시드 20회 + 시드 0~9), 시작 코드 불합격·타임아웃 없음. 예전 seed는 같은 검사에서 3개 실패(4-7 타임아웃, 7-1#2 시작 코드 통과, 7-1#3 정답 7/30).
- 7-1 2단계 규칙은 `code_check "int(" whole_word` 대신 `guess` + 출력 "추측"으로 정했습니다. `int(random.randint(…))`는 `input()`을 흉내 낸 불필요한 변환이라, 똑같이 맞는 `guess = random.randint(1, 10)`이 떨어지기 때문입니다. 단계 목표("추측 숫자를 변수에 저장")와 다음 단계 코드가 쓰는 `guess` 변수를 확인합니다.
