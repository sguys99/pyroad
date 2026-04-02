# 캐릭터 일러스트 & 애니메이션 강화 디자인

## 배경

pyRoad는 초등학생(4~6학년)이 AI 동물 마스코트 튜터와 함께 파이썬을 배우는 학습 플랫폼이다. 현재 메인 마스코트 "파이뱀 선생님"은 🐍 텍스트 이모지로만 표현되어 있어 아이들의 몰입감과 흥미를 끌기에 한계가 있다. 커스텀 캐릭터 일러스트와 풍부한 애니메이션을 도입하여 학습 경험을 개선한다.

## 접근 방식: 하이브리드 (SVG + Lottie)

- **평상시**: SVG 캐릭터 일러스트 + Framer Motion으로 상태 전환 및 미세 애니메이션
- **임팩트 장면** (레벨업, 프로젝트 완료): Lottie 벡터 애니메이션으로 풍부한 연출
- 기존 Framer Motion + canvas-confetti 인프라 최대 활용

---

## 1. 캐릭터 시스템

### 1.1 파이뱀 선생님 (메인 캐릭터)

10가지 표정/포즈:

| 표정 키 | 감정 | 사용 맥락 |
|---------|------|----------|
| `happy` | 기본 밝은 표정 | 인사, 일반 대화 |
| `thinking` | 고민하는 표정 | AI 응답 생성 중 |
| `celebrating` | 팔 벌리고 점프 | 퀘스트 완료, 레벨업 |
| `encouraging` | 따뜻한 미소+엄지척 | 코드 오류 시 격려 |
| `surprised` | 눈 크게, 입 벌림 | 뱃지 획득 |
| `teaching` | 가르치는 포즈 | 퀘스트 소개, 힌트 |
| `waving` | 손 흔들기 | 랜딩 페이지 입장 |
| `sleeping` | 눈 감고 zzz | 장시간 미사용 |
| `confused` | 고개 갸우뚱 | 타임아웃, 로딩 실패 |
| `proud` | 가슴 펴고 별눈 | 프로젝트 완료, 스테이지 클리어 |

### 1.2 버그버그 (BugBug) — 보조 캐릭터 1

귀여운 무당벌레, 디버깅 도우미 역할.

- 코드 오류 시 등장하여 돋보기로 버그를 찾는 연출
- 표정 3개: `searching` (찾는 중), `found` (발견!), `fixed` (해결!)
- 등장 위치: OutputPanel 오류 상태, CodePanel 코딩 팁

### 1.3 별똥이 (Byeolttongi) — 보조 캐릭터 2

반짝이는 별똥별, 보상/XP 캐릭터.

- 레벨업, XP 획득, 스테이지 해금 시 등장
- 표정 3개: `flying` (날아가기), `landing` (도착), `sparkling` (반짝)
- 등장 위치: LevelUpCelebration, XPProgressBar, StageNode 해금

### 1.4 에셋 크기

- `sm` (32x32px): 채팅 아바타, 인라인 아이콘
- `md` (64x64px): UI 요소, 뱃지 옆
- `lg` (128x128px+): 히어로 섹션, 축하 장면

---

## 2. 화면별 애니메이션 통합

### 2.1 랜딩 페이지 (`src/components/landing/HeroSection.tsx`)

- **현재**: 🐍 이모지 + bounceIn 애니메이션
- **변경**: 파이뱀 `waving` SVG + Framer Motion 입장 애니메이션
- **아이들 상태**: 호흡 애니메이션 (scale 1.0→1.02, 3s ease-in-out infinite) + 주기적 눈깜빡 (4~6초 간격)
- **인터랙션**: 호버 시 `happy` 표정 전환 + spring scale

### 2.2 퀘스트 화면

**ConversationPanel** (`src/components/quest/ConversationPanel.tsx`):
- 채팅 아바타: 메시지 내용에 따라 표정 자동 변경
  - 정답/칭찬 → `celebrating`
  - 오류/앗 → `encouraging`
  - 힌트 → `teaching`
  - 기본 → `happy`
- ThinkingIndicator: `thinking` 표정 + 머리 까딱 애니메이션

**CodePanel** (`src/components/quest/CodePanel.tsx`):
- CodingTipRotator: 🐍 → `teaching` 표정 SVG
- Pyodide 로딩 실패: `confused` 표정 + 버그버그 `searching`

**OutputPanel** (`src/components/quest/OutputPanel.tsx`):
- 타임아웃: `confused` 표정
- 오류: `encouraging` 표정 + 버그버그 `found`
- 성공(검증 통과): `celebrating` 표정
- 성공(검증 미통과): `encouraging` 표정

### 2.3 월드맵 (`src/components/world/WorldMap.tsx`, `StageNode.tsx`)

- 현재 `in_progress` 스테이지 옆에 파이뱀 부유 애니메이션 (y: 0→-4→0, 2s infinite)
- 스테이지 해금 시 별똥이 `flying` → `landing` 애니메이션

### 2.4 축하 장면 (Lottie 적용)

**LevelUpCelebration** (`src/components/quest/LevelUpCelebration.tsx`):
- Star 아이콘 → 파이뱀 Lottie 축하 애니메이션
- canvas-confetti는 기존 유지

**BadgeEarnedPopup** (`src/components/quest/BadgeEarnedPopup.tsx`):
- 파이뱀 `surprised` 정적 SVG 추가 (뱃지 아이콘 위)
- 기존 뱃지 아이콘 + confetti 유지

**ProjectCompleteCelebration** (`src/components/quest/ProjectCompleteCelebration.tsx`):
- 🐍🎉🏆 이모지 → 파이뱀 + 별똥이 함께 축하하는 Lottie 장면

---

## 3. 기술 아키텍처

### 3.1 디렉토리 구조

```
public/
  characters/
    pybaem/
      lottie/
        celebrating.json
        level-up.json
        entrance.json
    bugbug/
      lottie/
        searching.json
    byeolttongi/
      lottie/
        flying.json

src/components/characters/
  CharacterAvatar.tsx         # 메인 래퍼 컴포넌트
  PybaemSvg.tsx              # 파이뱀 SVG (표정별 렌더링)
  BugBugSvg.tsx              # 버그버그 SVG
  ByeolttongiSvg.tsx         # 별똥이 SVG
  LottieCharacter.tsx         # Lottie 래퍼 (dynamic import + SVG 폴백)
  expressions.ts              # 타입 정의
  useCharacterExpression.ts   # 메시지 감정→표정 변환 훅
```

### 3.2 CharacterAvatar 컴포넌트

```tsx
interface CharacterAvatarProps {
  character: 'pybaem' | 'bugbug' | 'byeolttongi';
  expression: Expression;
  size: 'sm' | 'md' | 'lg';   // 32, 64, 128px
  animated?: boolean;           // 호흡/깜빡 미세 애니메이션
  onHover?: Expression;         // 호버 시 표정 변경
  className?: string;
}
```

- `character`에 따라 `PybaemSvg`, `BugBugSvg`, `ByeolttongiSvg` 렌더링
- `animated` 활성화 시 Framer Motion으로 호흡/깜빡 루프
- `onHover` 지정 시 마우스 오버에 표정 전환 + spring scale

### 3.3 LottieCharacter 컴포넌트

```tsx
interface LottieCharacterProps {
  character: Character;
  animation: string;
  size: number;
  autoplay?: boolean;
  loop?: boolean;
  onComplete?: () => void;
}
```

- `lottie-react` (43KB gzip) — `next/dynamic`으로 SSR 비활성화 + 동적 임포트
- Lottie JSON 파일도 `import()`로 온디맨드 로딩
- 로딩 중 정적 SVG `CharacterAvatar`를 폴백으로 표시

### 3.4 useCharacterExpression 훅

```tsx
function useMessageExpression(message: ChatMessage): Expression {
  if (message.content.includes('정답') || message.content.includes('대단')) return 'celebrating';
  if (message.content.includes('앗') || message.content.includes('오류')) return 'encouraging';
  if (message.content.includes('힌트')) return 'teaching';
  return 'happy';
}
```

키워드 기반 휴리스틱. 추후 API에 `sentiment` 필드 추가로 고도화 가능.

### 3.5 성능 보호장치

- **`prefers-reduced-motion`**: Framer Motion `useReducedMotion()` 활용. 감지 시 Lottie → 정적 SVG, 미세 애니메이션 비활성화
- **SVG 최적화**: SVGO 적용, 표정당 5KB 이하 목표
- **Lottie 최적화**: LottieFiles optimizer, 파일당 100KB 이하 (50-80KB 권장)
- **렌더러**: SVG 렌더러 사용 (모바일 안정성)
- **번들 영향**: lottie-react는 축하 트리거 시에만 동적 로딩, 초기 로딩 무영향

### 3.6 에셋 파이프라인

1. **SVG 제작**: AI 이미지 생성 (Midjourney/DALL-E) → Figma 벡터화 → SVGO 최적화 → SVGR React 컴포넌트
2. **Lottie 제작**: LottieFiles 마켓에서 기본 효과 + SVG 기반 커스텀 제작 (After Effects + Bodymovin)
3. **빌드 스크립트**: `"optimize:svg": "svgo -f public/characters --recursive"` 추가
4. **SVG 구조**: 애니메이션 가능하도록 `#body`, `#face`, `#eyes`, `#mouth` 그룹 분리

### 3.7 축하 컴포넌트 리팩토링

공통 모달 오버레이 패턴을 `CelebrationOverlay`로 추출:

```
src/components/quest/celebrations/
  CelebrationOverlay.tsx        # 공유 백드롭 + 모달 spring 애니메이션
  LevelUpCelebration.tsx
  BadgeEarnedPopup.tsx
  ProjectCompleteCelebration.tsx
```

---

## 4. 수정 대상 파일

### 이모지 교체 (13곳)

- [x] `src/components/landing/HeroSection.tsx` — 🐍 → CharacterAvatar `waving` lg
- [x] `src/components/quest/ConversationPanel.tsx` — ThinkingIndicator 🐍 → `thinking` sm
- [x] `src/components/quest/ConversationPanel.tsx` — 채팅 아바타 🐍 → `happy` sm
- [x] `src/components/quest/OutputPanel.tsx` — TutorAvatar 🐍 → 상태별 표정 sm
- [x] `src/components/quest/CodePanel.tsx` — CodingTip 🐍 → `teaching` sm
- [x] `src/components/quest/CodePanel.tsx` — 오류 메시지 🐍 이모지 제거
- [x] `src/components/quest/ProjectCompleteCelebration.tsx` — 🐍 → CharacterAvatar `celebrating` md
- [x] `src/components/world/ProfileSummary.tsx` — 아바타 폴백 🐍 → CharacterAvatar `happy` sm
- [x] `src/app/(protected)/profile/page.tsx` — 프로필 폴백 🐍 → CharacterAvatar `happy` lg

### 새로 생성하는 파일

- [x] `src/components/characters/expressions.ts`
- [x] `src/components/characters/CharacterAvatar.tsx`
- [x] `src/components/characters/PybaemSvg.tsx`
- [x] `src/components/characters/BugBugSvg.tsx` (Phase 4)
- [x] `src/components/characters/ByeolttongiSvg.tsx` (Phase 4)
- [x] `src/components/characters/LottieCharacter.tsx` (Phase 3)
- [x] `src/components/characters/useCharacterExpression.ts` (Phase 2)
- [x] `public/characters/` 디렉토리 구조 생성

---

## 5. 구현 우선순위

### Phase 1: 기반 + 즉시 효과 (1-2주) ✅

목표: 모든 🐍 이모지를 커스텀 캐릭터로 교체

- [x] `CharacterAvatar` 컴포넌트 + `expressions.ts` 타입 생성
- [x] `PybaemSvg` — 10가지 표정 모두 구현
- [x] 13곳 이모지를 `CharacterAvatar`로 교체
- [x] 호흡 애니메이션 (Framer Motion breathe) 추가
- [x] `public/characters/` 디렉토리 구조 생성

### Phase 2: 표정 다양화 (1주) ✅

목표: 맥락에 맞는 표정 변화로 캐릭터에 생명 부여

- [x] `useCharacterExpression` 훅 구현
- [x] ConversationPanel 대화별 동적 표정
- [x] OutputPanel 상태별 표정
- [x] 눈깜빡 애니메이션 추가

### Phase 3: Lottie 축하 장면 (1-2주) ✅

목표: 레벨업/프로젝트 완료 시 임팩트 있는 연출

- [x] `lottie-react` 설치
- [x] `LottieCharacter` 컴포넌트 (dynamic import + SVG 폴백)
- [x] `pybaem/celebrating.json` Lottie 에셋 제작/소싱
- [x] LevelUpCelebration 리팩토링
- [x] ProjectCompleteCelebration 리팩토링
- [x] `prefers-reduced-motion` 지원
- [x] `CelebrationOverlay` ���통 컴포넌트 추출

### Phase 4: 보조 캐릭터 + 월드맵 (1-2주) ✅

목표: 버그버그, 별똥이 도입 + 월드맵 캐릭터 연출

- [x] `BugBugSvg` 컴포넌트 (3 표정)
- [x] `ByeolttongiSvg` 컴포넌트 (3 표정)
- [x] OutputPanel 오류 시 버그버그 등장
- [x] WorldMap 현재 스테이지에 파이뱀 위치 표시
- [x] XP 획득 시 별똥이 비행 애니메이션

### Phase 5: 폴리싱 (1주) ✅

목표: 최종 품질 점검 + 랜딩 페이지 완성

- [x] 랜딩 페이지 Lottie 입장 애니메이션
- [x] Lighthouse 성능 감사
- [x] 저사양 디바이스 테스트 (CPU/네트워크 쓰로틀링)
- [x] reduced-motion 전체 점검
- [x] SVGO 전체 최적화 패스

---

## 6. 검증 방법

- [ ] **시각적 확인**: 모든 페이지(랜딩, 월드맵, 퀘스트, 프로필)에서 캐릭터가 올바르게 표시되는지 확인
- [ ] **표정 변화**: 퀘스트 화면에서 AI 대화, 코드 실행 성공/실패 시 표정이 적절히 변경되는지 확인
- [ ] **Lottie 축하**: 레벨업, 프로젝트 완료 트리거 시 Lottie 애니메이션 재생 확인
- [x] **성능**: Lighthouse Performance 90+ 유지, Lottie 동적 로딩으로 초기 번들 영향 없음 확인
- [x] **접근성**: `prefers-reduced-motion` 활성화 시 모든 애니메이션이 정적 SVG로 폴백되는지 확인
- [ ] **반응형**: 320px~1440px 범위에서 캐릭터 크기(sm/md/lg)가 적절하게 표시되는지 확인
