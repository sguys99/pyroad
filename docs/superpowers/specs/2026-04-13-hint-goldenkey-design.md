# 힌트 개선 및 황금키 시스템 설계

> 고객 피드백 기반 개선: 폴백 힌트 반복 문제 해결 + 황금키(정답 열람) 시스템 도입

## Context

고객으로부터 두 가지 피드백을 받았다:

1. **폴백(rule 기반) 모드에서 힌트를 여러 번 눌러도 동일한 내용 반복** — AI 호출 실패 시 `buildFallbackMessage()`가 같은 힌트 텍스트를 반환
2. **힌트를 봐도 이해가 안 가는 학생을 위한 탈출구 필요** — 황금키를 사용하면 정답을 보고 자동 통과할 수 있는 시스템

## 기능 1: 폴백 힌트 반복 해결

### 문제 분석

- `src/app/api/tutor/helpers.ts`의 `buildFallbackMessage()` (L329-364)
- 폴백 시 `skeleton.hints[hintKey]`를 반환하지만, `hintKey`가 매번 동일한 레벨로 전달되어 같은 텍스트 반복
- `prompt_skeleton.hints`에는 이미 `level_1`, `level_2`, `level_3` 3단계 데이터가 존재

### 해결 방안

- `buildFallbackMessage()`가 `hint_level` 파라미터(1/2/3)를 받아 해당 레벨의 힌트를 반환하도록 수정
- 호출부(`src/app/api/tutor/route.ts`)에서 현재 hint_level을 정확히 전달
- 3회 초과 시 "더 이상 힌트가 없어요. 황금키를 사용해보세요!" 안내 메시지 반환

### 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/app/api/tutor/helpers.ts` | `buildFallbackMessage()`에 hint_level 기반 분기 로직 |
| `src/app/api/tutor/route.ts` | hint_level을 buildFallbackMessage에 정확히 전달 |

## 기능 2: 황금키 시스템

### 핵심 규칙

- **스테이지별 3개** 지급, 새 스테이지 진입 시 3개로 리셋 (누적 아님)
- **언제든 사용 가능** — 힌트 소진 여부와 무관
- **사용 시**: 에디터에 정답 코드 삽입 + 튜터 해설 제공 + 자동 통과
- **XP 0** 부여 (진도만 열림, 경험치 없음)

### DB 스키마 변경

```sql
-- 마이그레이션: 황금키 시스템
ALTER TABLE users ADD COLUMN golden_keys INTEGER NOT NULL DEFAULT 3;
ALTER TABLE user_progress ADD COLUMN used_golden_key BOOLEAN NOT NULL DEFAULT FALSE;
```

- `users.golden_keys`: 현재 스테이지에서 사용 가능한 황금키 잔여 수
- `user_progress.used_golden_key`: 해당 퀘스트에서 황금키 사용 여부

### 정답 코드 데이터

`quests.prompt_skeleton` JSONB에 `solution_code` 필드 추가:

```json
{
  "topic": "변수",
  "hints": { "level_1": "...", "level_2": "...", "level_3": "..." },
  "solution_code": "name = '파이'\nprint(name)",
  "steps": [
    {
      "exercise_description": "...",
      "solution_code": "..."
    }
  ]
}
```

- 단일 퀘스트: `prompt_skeleton.solution_code`
- 다단계 퀘스트: `prompt_skeleton.steps[N].solution_code`로 현재 단계의 정답만 제공
- 44개 퀘스트의 시드 데이터 업데이트 필요

### API 엔드포인트

**`POST /api/quest/golden-key`**

요청:
```json
{
  "quest_id": "uuid",
  "current_step": 0
}
```

처리 흐름:
1. Supabase Auth JWT 검증
2. `users.golden_keys > 0` 확인 (부족 시 400 에러)
3. `users.golden_keys` 1 감소 (UPDATE)
4. `user_progress.used_golden_key = true` 기록 (UPSERT)
5. `prompt_skeleton.solution_code` (또는 `steps[current_step].solution_code`) 조회
6. 정답 코드 + 해설 프롬프트 반환
7. 클라이언트에서 자동 완료 처리 (`/api/quest/complete` 호출, XP 0)

응답:
```json
{
  "solution_code": "name = '파이'\nprint(name)",
  "explanation": "이 코드는 변수 name에 '파이'를 저장하고 출력합니다."
}
```

### 해설 생성

- AI 튜터 사용 가능 시: solution_code를 포함한 해설 프롬프트로 LLM 호출 (스트리밍)
- 폴백 시: `prompt_skeleton.fallback_text` 또는 고정 해설 메시지 반환

### 스테이지 전환 시 리셋

- 기존 스테이지 완료 판정 로직 (`/api/quest/complete` L148)에서 모든 퀘스트 완료 확인 후
- `users.golden_keys = 3`으로 리셋하는 UPDATE 추가

### XP 처리

- `calculateXP()` 함수 (`src/lib/quest/xp.ts`)에 `usedGoldenKey` 파라미터 추가
- `usedGoldenKey === true`이면 XP 0 반환
- `/api/quest/complete`에서 `body.used_golden_key` 전달

### UI 변경

#### ConversationPanel.tsx

- 황금키 잔여 수 표시: 열쇠 아이콘 + "2/3"
- 황금키 사용 버튼: 힌트 버튼 옆에 배치
- 확인 다이얼로그: "황금키를 사용하면 정답이 공개되고 XP를 받을 수 없어요. 사용할까요?"
- 사용 후 플로우:
  1. 에디터 코드를 정답으로 교체
  2. 자동 실행 → 결과 표시
  3. 튜터가 해설 메시지 표시 (스트리밍)
  4. 축하 애니메이션 (황금키 전용 — 일반 통과와 구분)
  5. 자동 완료 처리

#### ProjectQuestShell.tsx

- `handleGoldenKeyUse()` 함수 추가
- golden_keys 상태 관리 (서버에서 초기 로드)
- 에디터 코드 교체 로직: `setCode(solutionCode)`

#### 월드맵/스테이지 UI

- 황금키 잔여 수를 스테이지 헤더 또는 퀘스트 목록에 표시
- 황금키로 통과한 퀘스트는 별도 마킹 (열쇠 아이콘 오버레이)

## 수정 대상 파일 요약

| 파일 | 변경 유형 |
|------|----------|
| `supabase/migrations/XXXXX_golden_key.sql` | 신규 — DB 마이그레이션 |
| `supabase/seed.sql` | 수정 — solution_code 추가 (44개 퀘스트) |
| `src/app/api/quest/golden-key/route.ts` | 신규 — 황금키 사용 API |
| `src/app/api/quest/complete/route.ts` | 수정 — XP 0 처리, 스테이지 리셋 |
| `src/app/api/tutor/helpers.ts` | 수정 — 폴백 힌트 단계별 반환, 해설 프롬프트 |
| `src/app/api/tutor/route.ts` | 수정 — hint_level 정확 전달 |
| `src/lib/quest/xp.ts` | 수정 — usedGoldenKey 파라미터 |
| `src/components/quest/ProjectQuestShell.tsx` | 수정 — handleGoldenKeyUse, 상태 관리 |
| `src/components/quest/ConversationPanel.tsx` | 수정 — 황금키 버튼, 잔여 수 표시 |
| 월드맵 관련 컴포넌트 | 수정 — 황금키 잔여 수 표시, 퀘스트 마킹 |

## 검증 방법

### 폴백 힌트
1. AI API 키 없이 퀘스트 진입
2. 힌트 버튼 3회 클릭 → 매번 다른 힌트 텍스트 확인
3. 3회 초과 시 황금키 안내 메시지 확인

### 황금키
1. 퀘스트에서 황금키 버튼 클릭 → 확인 다이얼로그 표시
2. 확인 → 에디터에 정답 코드 삽입, 자동 실행, 튜터 해설 표시
3. 자동 통과 후 XP 0 확인
4. 잔여 황금키 수 감소 확인 (3 → 2)
5. 3개 모두 소진 시 버튼 비활성화
6. 다음 스테이지 진입 시 3개로 리셋 확인
7. 황금키로 통과한 퀘스트에 별도 마킹 확인
